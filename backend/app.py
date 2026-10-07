import base64
import os
import time
import threading
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from functools import wraps
from urllib.parse import parse_qs, urlparse

from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.security import check_password_hash, generate_password_hash

from db import query_db, get_db_connection
import costing
from costs_view import (  # noqa: F401 (cost_since e build_cost_view tambem sao usados pelos testes)
    COST_PERIOD_DAYS,
    _num,
    build_cost_view,
    cost_since,
    order_unit_costs,
)
import image_enhance
import logo_image
import media_store
import menu_photo
import voice_tts
import feedback
import menu_import
import menu_templates
import pix
import signup
import table_calls
from table_qr import qr_png_for_url
from trusted_proxy import wrap_trusted_proxy

from dotenv import load_dotenv

load_dotenv()


app = Flask(__name__)
# Behind our HTTPS front door (Caddy) read the real visitor address. Off unless TRUST_PROXY=1.
app.wsgi_app = wrap_trusted_proxy(app.wsgi_app)
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', '1048576'))  # 1 MiB
# Foto de prato: so as rotas de foto aceitam corpo maior (veja allow_big_body_for_photos).
PHOTO_MAX_BYTES = int(os.getenv('PHOTO_MAX_BYTES', str(10 * 1024 * 1024)))  # 10 MiB
PHOTO_ENDPOINTS = {'admin_upload_product_photo', 'admin_parse_menu_photo', 'admin_upload_company_logo'}
# Logomarca: o celular ja manda reduzida (ate ~1 MiB); acima disso nao e logomarca.
LOGO_MAX_BYTES = int(os.getenv('LOGO_MAX_BYTES', str(4 * 1024 * 1024)))  # 4 MiB
# No maximo 2 fotos sendo processadas ao mesmo tempo: o processamento usa memoria e processador.
_photo_slots = threading.BoundedSemaphore(2)
# Leitura de cardapio por foto: cada uma segura uma linha de execucao por ate ~1 minuto esperando a IA.
# Com so 2 ao mesmo tempo, sobram linhas para o resto do servidor.
_menu_read_slots = threading.BoundedSemaphore(2)

SECRET_KEY = os.getenv('SECRET_KEY')

if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY nao definida. Adicione SECRET_KEY=<valor aleatorio> no .env"
    )

serializer = URLSafeTimedSerializer(SECRET_KEY)
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 horas por token; o painel renova enquanto esta em uso
# Mesmo renovando, depois deste tempo do login a pessoa entra de novo com a senha.
SESSION_MAX_SECONDS = int(os.getenv("SESSION_MAX_DAYS", "30")) * 86400

CORS_ORIGIN_REGEX = os.getenv(
    'CORS_ORIGIN_REGEX',
    r"https://.*\.app\.github\.dev|http://localhost:5174"
)

CORS(app, resources={r"/*": {
    "origins": [CORS_ORIGIN_REGEX],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'


@app.before_request
def allow_big_body_for_photos():
    if request.endpoint in PHOTO_ENDPOINTS:
        # margem para o envelope do formulario (multipart) em volta da foto
        request.max_content_length = PHOTO_MAX_BYTES + 64 * 1024
    elif (request.content_length or 0) > app.config['MAX_CONTENT_LENGTH']:
        # recusa logo na porta (413) em vez de falhar la dentro da rota com erro 500
        return jsonify({"error": "O arquivo enviado e grande demais."}), 413


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "O arquivo enviado e grande demais."}), 413


@app.after_request
def add_security_headers(response):
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'DENY')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    return response


def error_response(public_message, exception=None, status=500):
    body = {"error": public_message}

    if FLASK_DEBUG and exception is not None:
        body["details"] = str(exception)

    return jsonify(body), status


def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Nao autenticado"}), 401

        token = auth_header[len('Bearer '):]

        try:
            data = serializer.loads(
                token,
                max_age=TOKEN_MAX_AGE_SECONDS
            )
        except SignatureExpired:
            return jsonify({"error": "Sessao expirada"}), 401
        except BadSignature:
            return jsonify({"error": "Token invalido"}), 401

        request.user = data

        return f(*args, **kwargs)

    return wrapper


def require_roles(*allowed_roles):
    def decorator(f):
        @wraps(f)
        @require_auth
        def wrapper(*args, **kwargs):
            if request.user.get('role') not in allowed_roles:
                return jsonify({
                    "error": "Acesso negado para este cargo"
                }), 403

            return f(*args, **kwargs)

        return wrapper

    return decorator


def require_company_access(company_id):
    if str(request.user.get('company_id')) != str(company_id):
        return jsonify({
            "error": "Acesso negado a este estabelecimento"
        }), 403

    return None


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "service": "vem-comer-api"
    }), 200


LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 15 * 60

_failed_login_attempts = {}
_login_lock = threading.Lock()


def login_rate_limit_key(email):
    return (email, request.remote_addr or 'unknown')


def register_failed_login(email):
    now = time.time()
    key = login_rate_limit_key(email)

    with _login_lock:
        attempts = [
            t
            for t in _failed_login_attempts.get(key, [])
            if now - t < LOGIN_WINDOW_SECONDS
        ]

        attempts.append(now)
        _failed_login_attempts[key] = attempts


def is_login_blocked(email):
    now = time.time()
    key = login_rate_limit_key(email)

    with _login_lock:
        attempts = [
            t
            for t in _failed_login_attempts.get(key, [])
            if now - t < LOGIN_WINDOW_SECONDS
        ]

        _failed_login_attempts[key] = attempts

        return len(attempts) >= LOGIN_MAX_ATTEMPTS


def clear_failed_logins(email):
    with _login_lock:
        _failed_login_attempts.pop(login_rate_limit_key(email), None)


@app.route('/api/auth/register-company', methods=['POST'])
def register_company():
    try:
        data = request.get_json() or {}

        company_name = (data.get('company_name') or '').strip()
        slug = (data.get('slug') or '').strip().lower()
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not company_name or not slug or not name or not email or not password:
            return jsonify({
                "error": "Empresa, slug, nome, email e senha sao obrigatorios"
            }), 400

        if len(password) < 8:
            return jsonify({
                "error": "Senha deve ter pelo menos 8 caracteres"
            }), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            cur.execute(
                """
                INSERT INTO companies (name, slug)
                VALUES (%s, %s)
                RETURNING id, name, slug;
                """,
                (company_name, slug)
            )

            company = cur.fetchone()

            cur.execute(
                """
                INSERT INTO users (
                    company_id,
                    name,
                    email,
                    password_hash,
                    role
                )
                VALUES (%s, %s, %s, %s, 'OWNER')
                RETURNING id, name, email, role;
                """,
                (
                    company['id'],
                    name,
                    email,
                    generate_password_hash(password)
                )
            )

            user = cur.fetchone()

            conn.commit()

            return jsonify({
                "company": company,
                "user": user
            }), 201

        except psycopg2.errors.UniqueViolation:
            conn.rollback()

            return jsonify({
                "error": "Slug ou email ja cadastrado"
            }), 409

        finally:
            cur.close()
            conn.close()

    except Exception as e:
        return error_response(
            "Erro interno ao cadastrar estabelecimento",
            e
        )


# Cadastro do restaurante pela internet (veja signup.py). Fechado ate o administrador ligar
# SIGNUP_OPEN=1 (deploy/vps/abrir-cadastro.sh). Enquanto fechado, as duas rotas respondem 404.
signup_limiter = signup.SignupLimiter()


@app.route('/api/signup/status', methods=['GET'])
def signup_status():
    return jsonify({
        "open": signup.is_open(),
        "terms_version": signup.TERMS_VERSION
    }), 200


def signup_failure(error):
    body = {"error": error.message}

    if error.field:
        body["field"] = error.field

    return jsonify(body), error.status


@app.route('/api/signup', methods=['POST'])
def signup_restaurant():
    if not signup.is_open():
        return jsonify({"error": "O cadastro ainda nao esta aberto."}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Pedido invalido."}), 400

    # campo escondido na tela: so robo preenche
    if data.get('website'):
        return jsonify({"error": "Nao foi possivel cadastrar."}), 400

    try:
        signup_limiter.check(request.remote_addr or 'unknown')
        clean = signup.validate(data)
    except signup.SignupError as error:
        return signup_failure(error)

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(signup.SQL_COUNT_TODAY)
        created_today = (cur.fetchone() or {}).get('n') or 0

        if int(created_today) >= signup.max_per_day():
            return signup_failure(signup.SignupError(
                "Recebemos muitos cadastros hoje. Tente de novo amanha.", 429
            ))

        cur.execute(signup.SQL_EMAIL_TAKEN, (clean['email'],))

        if cur.fetchone():
            return signup_failure(signup.SignupError(
                "Esse e-mail ja tem cadastro. Toque em Entrar.", 409, "email"
            ))

        company = None

        for slug in signup.slug_candidates(clean['restaurant_name']):
            cur.execute(
                signup.SQL_INSERT_COMPANY,
                (clean['restaurant_name'], slug, clean['phone'], signup.TERMS_VERSION)
            )
            company = cur.fetchone()

            if company:
                break

        if not company:
            conn.rollback()

            return signup_failure(signup.SignupError(
                "Nao consegui criar o endereco do restaurante. Tente um nome um pouco diferente.",
                409,
                "restaurant_name"
            ))

        cur.execute(
            signup.SQL_INSERT_OWNER,
            (
                company['id'],
                clean['owner_name'],
                clean['email'],
                generate_password_hash(clean['password'])
            )
        )

        user = cur.fetchone()

        conn.commit()

        token = serializer.dumps({
            "user_id": str(user['id']),
            "company_id": str(company['id']),
            "role": user['role'],
            "login_at": int(time.time())
        })

        response = jsonify({
            "token": token,
            "user": {
                "id": user['id'],
                "name": user['name'],
                "email": user['email'],
                "role": user['role'],
                "company_id": company['id']
            },
            "company": company
        })
        response.status_code = 201
        response.headers['Cache-Control'] = 'no-store'

        return response

    except psycopg2.errors.UniqueViolation:
        # duas pessoas com o mesmo e-mail ao mesmo tempo: o indice unico segura a segunda
        if conn is not None:
            conn.rollback()

        return signup_failure(signup.SignupError(
            "Esse e-mail ja tem cadastro. Toque em Entrar.", 409, "email"
        ))

    except Exception as e:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass

        return error_response("Erro interno ao cadastrar o restaurante", e)

    finally:
        if cur is not None:
            cur.close()

        if conn is not None:
            conn.close()


@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json() or {}

        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not email or not password:
            return jsonify({
                "error": "Email e senha sao obrigatorios"
            }), 400

        if is_login_blocked(email):
            return jsonify({
                "error": "Muitas tentativas. Tente novamente em alguns minutos."
            }), 429

        user = query_db(
            """
            SELECT id, company_id, name, email, password_hash, role
            FROM users
            WHERE email = %s AND active = TRUE;
            """,
            (email,),
            one=True
        )

        if not user or not check_password_hash(
            user['password_hash'],
            password
        ):
            register_failed_login(email)

            return jsonify({
                "error": "Email ou senha invalidos"
            }), 401

        clear_failed_logins(email)

        token = serializer.dumps({
            "user_id": str(user['id']),
            "company_id": str(user['company_id']),
            "role": user['role'],
            "login_at": int(time.time())
        })

        return jsonify({
            "token": token,
            "user": {
                "id": user['id'],
                "name": user['name'],
                "email": user['email'],
                "role": user['role'],
                "company_id": user['company_id']
            }
        }), 200

    except Exception as e:
        return error_response(
            "Erro interno ao autenticar",
            e
        )


@app.route('/api/auth/refresh', methods=['POST'])
@require_auth
def refresh_session():
    """Troca um login ainda valido por um novo, enquanto o painel esta em uso.

    Assim ninguem e deslogado no meio do expediente. Nao renova: depois de SESSION_MAX_SECONDS desde
    o login com senha, ou quando a pessoa foi desativada ou mudou de restaurante.
    """
    claims = request.user
    now = int(time.time())
    login_at = claims.get('login_at')

    if isinstance(login_at, bool) or not isinstance(login_at, int) or login_at > now + 60:
        login_at = now  # login de antes desta versao: o prazo comeca a contar agora

    if now - login_at > SESSION_MAX_SECONDS:
        return jsonify({"error": "Sessao expirada"}), 401

    try:
        user = query_db(
            """
            SELECT id, company_id, name, email, role
            FROM users
            WHERE id = %s AND active = TRUE;
            """,
            (claims.get('user_id'),),
            one=True
        )
    except Exception as e:
        return error_response("Erro ao renovar o acesso", e)

    if not user or str(user['company_id']) != str(claims.get('company_id')):
        return jsonify({"error": "Sessao expirada"}), 401

    token = serializer.dumps({
        "user_id": str(user['id']),
        "company_id": str(user['company_id']),
        "role": user['role'],
        "login_at": login_at
    })

    return jsonify({
        "token": token,
        "user": {
            "id": user['id'],
            "name": user['name'],
            "email": user['email'],
            "role": user['role'],
            "company_id": user['company_id']
        }
    }), 200


def public_company(row):
    """Dados do restaurante que qualquer cliente pode ver. A chave sorteada da logomarca nunca sai:
    sai so o endereco publico (ou None, se o restaurante ainda nao tem logomarca)."""
    company = dict(row)
    urls = media_store.public_urls(company.get('id'), company.pop('logo_key', None))
    company['logo_url'] = urls['image_url']
    company['logo_thumb_url'] = urls['thumb_url']
    return company


@app.route('/api/companies/<uuid:company_id>', methods=['GET'])
def get_company(company_id):
    try:
        company = query_db(
            """
            SELECT id, name, slug, logo_key
            FROM companies
            WHERE id = %s;
            """,
            (str(company_id),),
            one=True
        )

        if not company:
            return jsonify({
                "error": "Estabelecimento não encontrado"
            }), 404

        return jsonify(public_company(company)), 200

    except Exception as e:
        return error_response(
            "Erro interno no servidor",
            e
        )


@app.route('/api/companies/by-slug/<slug>', methods=['GET'])
def get_company_by_slug(slug):
    try:
        company = query_db(
            """
            SELECT id, name, slug, logo_key
            FROM companies
            WHERE slug = %s;
            """,
            (slug,),
            one=True
        )

        if not company:
            return jsonify({
                "error": "Estabelecimento não encontrado"
            }), 404

        return jsonify(public_company(company)), 200

    except Exception as e:
        return error_response(
            "Erro ao buscar estabelecimento",
            e
        )


@app.route('/api/companies/<uuid:company_id>/tables/<uuid:table_id>', methods=['GET'])
def get_table(company_id, table_id):
    try:
        table = query_db(
            """
            SELECT id, number
            FROM tables
            WHERE id = %s
            AND company_id = %s;
            """,
            (str(table_id), str(company_id)),
            one=True
        )

        if not table:
            return jsonify({
                "error": "Mesa nao encontrada"
            }), 404

        return jsonify(table), 200

    except Exception as e:
        return error_response(
            "Erro ao buscar mesa",
            e
        )


# Mesa viva (veja table_calls.py): o cliente chama o garcom pela tela da mesa, sem login.
table_call_limiter = table_calls.Limiter()


@app.route('/api/companies/<uuid:company_id>/tables/<uuid:table_id>/calls', methods=['POST'])
def create_table_call(company_id, table_id):
    """Chamar garcom, pedir a conta, agua ou limpeza. Tocar de novo num pedido aberto so sobe o contador."""
    try:
        kind = table_calls.normalize_kind(request.get_json(silent=True))
        table_call_limiter.check_ip(request.remote_addr or 'unknown')
    except table_calls.CallError as error:
        return jsonify({"error": error.message}), error.status

    conn = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(table_calls.SQL_TABLE, (str(table_id), str(company_id)))

        if not cur.fetchone():
            return jsonify({"error": "Mesa nao encontrada"}), 404

        table_call_limiter.check_table(str(table_id))

        cur.execute(
            table_calls.SQL_OPEN_SAME,
            (str(company_id), str(table_id), kind, table_calls.OPEN_WINDOW_MINUTES)
        )
        open_call = cur.fetchone()

        if open_call:
            cur.execute(
                table_calls.SQL_BUMP,
                (table_calls.MAX_REPEATS, str(open_call['id']), str(company_id))
            )
            conn.commit()
            return jsonify(table_calls.public_view(open_call, already=True)), 200

        cur.execute(table_calls.SQL_INSERT, (str(company_id), str(table_id), kind))
        created = cur.fetchone()
        conn.commit()

        return jsonify(table_calls.public_view(created, already=False)), 201

    except table_calls.CallError as error:
        return jsonify({"error": error.message}), error.status
    except Exception as e:
        if conn is not None:
            conn.rollback()
        return error_response("Nao foi possivel avisar o atendente. Chame com a mao.", e)
    finally:
        if conn is not None:
            conn.close()


@app.route('/api/companies/<uuid:company_id>/tables/<uuid:table_id>/calls/<uuid:call_id>', methods=['GET'])
def get_table_call(company_id, table_id, call_id):
    """O cliente confere se a chamada dele ja foi atendida. So o tipo e o andamento, nada de dado de gente."""
    conn = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            table_calls.SQL_PUBLIC_STATUS,
            (str(call_id), str(company_id), str(table_id))
        )
        row = cur.fetchone()

        if not row:
            return jsonify({"error": "Chamada nao encontrada"}), 404

        return jsonify(table_calls.public_view(row)), 200

    except Exception as e:
        return error_response("Erro ao buscar a chamada", e)
    finally:
        if conn is not None:
            conn.close()


@app.route('/api/companies/<uuid:company_id>/users', methods=['GET'])
@require_roles('OWNER', 'MANAGER')
def get_company_users(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    try:
        users = query_db(
            """
            SELECT id, company_id, name, email, role
            FROM users
            WHERE company_id = %s;
            """,
            (str(company_id),)
        )

        return jsonify(users), 200

    except Exception as e:
        return error_response(
            "Erro interno ao buscar usuários",
            e
        )


@app.route('/api/companies/<uuid:company_id>/products', methods=['GET'])
def get_company_products(company_id):
    try:
        products = query_db(
            """
            SELECT id, company_id, menu_id, name, description, price, image_key
            FROM products
            WHERE company_id = %s;
            """,
            (str(company_id),)
        )

        for product in products:
            key = product.pop('image_key', None)
            product.update(media_store.public_urls(company_id, key))

        return jsonify(products), 200

    except Exception as e:
        return error_response(
            "Erro interno ao buscar produtos",
            e
        )


@app.route('/api/companies/<uuid:company_id>/feedbacks', methods=['POST'])
def create_feedback(company_id):
    try:
        data = request.get_json() or {}

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO feedbacks (
                company_id,
                food_rating,
                service_rating,
                delivery_rating,
                comment
            )
            VALUES (%s, %s, %s, %s, %s);
            """,
            (
                str(company_id),
                data.get('food'),
                data.get('service'),
                data.get('delivery'),
                data.get('comment')
            )
        )

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Feedback salvo com sucesso"
        }), 201

    except Exception as e:
        return error_response(
            "Erro ao salvar feedback",
            e
        )


@app.route('/api/companies/<uuid:company_id>/menus', methods=['GET'])
def get_company_menus(company_id):
    try:
        menus = query_db(
            """
            SELECT id, company_id, name, active
            FROM menus
            WHERE company_id = %s
            AND active = TRUE;
            """,
            (str(company_id),)
        )

        return jsonify(menus), 200

    except Exception as e:
        return error_response(
            "Erro interno ao buscar categorias",
            e
        )


@app.route('/api/companies/<uuid:company_id>/orders', methods=['POST'])
def create_company_order(company_id):
    conn = None
    cur = None

    try:
        data = request.get_json() or {}

        customer_name = (data.get('customer_name') or 'Cliente Balcão').strip()
        cart_items = data.get('items')
        table_id = data.get('table_id')

        payment_method = (data.get('payment_method') or '').lower()
        payment_change = data.get('payment_change', 0)

        if not customer_name or not isinstance(cart_items, list) or not cart_items:
            return jsonify({
                "error": "Cliente e itens do pedido sao obrigatorios"
            }), 400

        payment_methods = {
            'pix': 'PIX',
            'cartao': 'CARD',
            'dinheiro': 'CASH'
        }

        if payment_method not in payment_methods:
            return jsonify({
                "error": "Forma de pagamento invalida"
            }), 400

        try:
            payment_change = Decimal(str(payment_change))
        except (InvalidOperation, TypeError, ValueError):
            return jsonify({
                "error": "Valor de troco invalido"
            }), 400

        if payment_change < 0:
            return jsonify({
                "error": "Valor de troco invalido"
            }), 400

        conn = get_db_connection()

        cur = conn.cursor(cursor_factory=RealDictCursor)

        def invalid_order(message):
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({
                "error": message
            }), 400

        if table_id:
            cur.execute(
                """
                SELECT id
                FROM tables
                WHERE id = %s
                AND company_id = %s;
                """,
                (
                    str(table_id),
                    str(company_id)
                )
            )

            if not cur.fetchone():
                return invalid_order("Mesa invalida")

        order_items = []
        total = Decimal('0')

        for item in cart_items:
            if not isinstance(item, dict):
                return invalid_order("Item invalido")

            product_id = item.get('id')
            quantity = item.get('quantity')

            if (
                not product_id
                or not isinstance(quantity, int)
                or isinstance(quantity, bool)
                or not 1 <= quantity <= 100
            ):
                return invalid_order("Produto ou quantidade invalida")

            cur.execute(
                """
                SELECT id, price
                FROM products
                WHERE id = %s
                AND company_id = %s
                FOR SHARE;
                """,
                (
                    str(product_id),
                    str(company_id)
                )
            )

            product = cur.fetchone()

            if not product:
                return invalid_order("Produto indisponivel")

            item_total = product['price'] * quantity
            total += item_total

            order_items.append(
                (
                    product['id'],
                    quantity,
                    product['price'],
                    item_total
                )
            )

        if payment_method == 'dinheiro' and payment_change < total:
            return invalid_order(
                "Troco deve ser informado com o valor entregue"
            )

        if payment_method != 'dinheiro' and payment_change != 0:
            return invalid_order(
                "Troco so pode ser informado para pagamento em dinheiro"
            )

        cur.execute(
            """
            INSERT INTO orders (
                company_id,
                customer_name,
                total_price,
                status,
                payment_method,
                payment_change,
                table_id
            )
            VALUES (%s, %s, %s, 'PENDING_PAYMENT', %s, %s, %s)
            RETURNING id;
            """,
            (
                str(company_id),
                customer_name,
                total,
                payment_method,
                payment_change,
                str(table_id) if table_id else None
            )
        )

        order_id = cur.fetchone()['id']

        # Custo de cada prato agora (ficha tecnica), para o CMV do mes nao mudar quando o insumo encarecer.
        unit_costs = order_unit_costs(
            cur,
            company_id,
            [item[0] for item in order_items]
        )

        for product_id, quantity, unit_price, item_total in order_items:
            cur.execute(
                """
                INSERT INTO order_items (
                    order_id,
                    product_id,
                    quantity,
                    unit_price,
                    total,
                    unit_cost
                )
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (
                    str(order_id),
                    str(product_id),
                    quantity,
                    unit_price,
                    item_total,
                    unit_costs.get(str(product_id))
                )
            )

        cur.execute(
            """
            INSERT INTO payments (
                order_id,
                method,
                status,
                amount
            )
            VALUES (%s, %s, 'PENDING', %s);
            """,
            (
                str(order_id),
                payment_methods[payment_method],
                total
            )
        )

        cur.execute(
            """
            INSERT INTO order_events (
                order_id,
                event_type
            )
            VALUES (%s, 'ORDER_CREATED');
            """,
            (str(order_id),)
        )

        if table_id:
            cur.execute(
                """
                UPDATE tables
                SET status = 'ocupada'
                WHERE id = %s
                AND company_id = %s;
                """,
                (
                    str(table_id),
                    str(company_id)
                )
            )

        conn.commit()

        cur.close()
        conn.close()

        tracking_token = serializer.dumps({
            'purpose': 'order_tracking',
            'order_id': str(order_id),
            'company_id': str(company_id)
        })

        return jsonify({
            "message": "Pedido realizado com sucesso",
            "order_id": str(order_id),
            "tracking_token": tracking_token
        }), 201

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro interno ao processar pedido",
            e
        )


@app.route('/api/orders/<uuid:order_id>', methods=['GET'])
def get_order(order_id):
    conn = None
    cur = None

    try:
        tracking_token = request.args.get('tracking_token', '')

        try:
            tracking = serializer.loads(
                tracking_token,
                max_age=60 * 60 * 24 * 7
            )
        except (SignatureExpired, BadSignature):
            return jsonify({
                "error": "Acesso de acompanhamento invalido"
            }), 401

        if (
            tracking.get('purpose') != 'order_tracking'
            or tracking.get('order_id') != str(order_id)
        ):
            return jsonify({
                "error": "Acesso de acompanhamento invalido"
            }), 401

        conn = get_db_connection()

        cur = conn.cursor(
            cursor_factory=RealDictCursor
        )

        cur.execute(
            """
            SELECT
                id,
                company_id,
                customer_name,
                total_price,
                status,
                payment_method,
                (
                    SELECT pay.status
                    FROM payments pay
                    WHERE pay.order_id = orders.id
                    ORDER BY pay.created_at DESC
                    LIMIT 1
                ) AS payment_status
            FROM orders
            WHERE id = %s;
            """,
            (str(order_id),)
        )

        order = cur.fetchone()

        if not order:
            cur.close()
            conn.close()

            return jsonify({
                "error": "Pedido não encontrado"
            }), 404

        if tracking.get('company_id') != str(order['company_id']):
            cur.close()
            conn.close()

            return jsonify({
                "error": "Acesso de acompanhamento invalido"
            }), 401

        cur.execute(
            """
            SELECT
                oi.product_id,
                oi.quantity,
                oi.unit_price,
                oi.total,
                p.name
            FROM order_items oi
            JOIN products p
                ON p.id = oi.product_id
            WHERE oi.order_id = %s
            AND p.company_id = %s;
            """,
            (
                str(order_id),
                str(order['company_id'])
            )
        )

        items = cur.fetchall()

        cur.close()
        conn.close()

        order["items"] = items

        return jsonify(order), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao buscar pedido",
            e
        )


@app.route(
    '/api/companies/<uuid:company_id>/admin/orders',
    methods=['GET']
)
@require_auth
def get_admin_orders(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    try:
        # Each order carries its items and table number: the kitchen and the
        # counter need to know what to prepare and where to take it.
        orders = query_db(
            """
            SELECT
                o.id,
                o.customer_name,
                o.total_price,
                o.status,
                o.payment_method,
                o.payment_change,
                o.created_at,
                t.number AS table_number,
                (
                    SELECT pay.status
                    FROM payments pay
                    WHERE pay.order_id = o.id
                    ORDER BY pay.created_at DESC
                    LIMIT 1
                ) AS payment_status,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'name', p.name,
                                'quantity', oi.quantity,
                                'unit_price', oi.unit_price,
                                'total', oi.total
                            )
                            ORDER BY p.name
                        )
                        FROM order_items oi
                        JOIN products p
                            ON p.id = oi.product_id
                            AND p.company_id = o.company_id
                        WHERE oi.order_id = o.id
                    ),
                    '[]'::json
                ) AS items
            FROM orders o
            LEFT JOIN tables t
                ON t.id = o.table_id
                AND t.company_id = o.company_id
            WHERE o.company_id = %s
            ORDER BY o.created_at DESC
            LIMIT 200;
            """,
            (str(company_id),)
        )

        return jsonify(orders), 200

    except Exception as e:
        return error_response(
            "Erro ao buscar pedidos do painel",
            e
        )


@app.route('/api/orders/<uuid:order_id>/status', methods=['PUT'])
@require_auth
def update_order_status(order_id):
    conn = None
    cur = None

    try:
        data = request.get_json() or {}
        new_status = data.get('status')

        if not new_status:
            return jsonify({
                "error": "Status nao informado"
            }), 400

        if new_status not in (
            'PENDING_PAYMENT',
            'em preparo',
            'concluido'
        ):
            return jsonify({
                "error": "Status invalido"
            }), 400

        company_id = request.user.get('company_id')

        conn = get_db_connection()

        cur = conn.cursor()

        cur.execute(
            """
            UPDATE orders
            SET status = %s
            WHERE id = %s
            AND company_id = %s;
            """,
            (
                new_status,
                str(order_id),
                str(company_id)
            )
        )

        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "error": "Pedido nao encontrado"
            }), 404

        if new_status == 'concluido':
            cur.execute(
                """
                UPDATE tables
                SET status = 'livre'
                WHERE id = (
                    SELECT table_id
                    FROM orders
                    WHERE id = %s
                    AND company_id = %s
                )
                AND company_id = %s;
                """,
                (
                    str(order_id),
                    str(company_id),
                    str(company_id)
                )
            )

        cur.execute(
            """
            INSERT INTO order_events (
                order_id,
                event_type
            )
            VALUES (%s, %s);
            """,
            (
                str(order_id),
                'STATUS_' + new_status.upper().replace(' ', '_')
            )
        )

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": f"Status atualizado para {new_status} com sucesso"
        }), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao atualizar status",
            e
        )


@app.route(
    '/api/companies/<uuid:company_id>/admin/products',
    methods=['POST']
)
@require_roles('OWNER', 'MANAGER')
def admin_create_product(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    conn = None
    cur = None

    try:
        data = request.get_json() or {}

        name = data.get('name')
        description = data.get('description', '')
        price = data.get('price')
        menu_id = data.get('menu_id')

        if not name or price is None:
            return jsonify({
                "error": "Nome e preco sao obrigatorios"
            }), 400

        conn = get_db_connection()

        cur = conn.cursor(
            cursor_factory=RealDictCursor
        )

        if menu_id:
            cur.execute(
                """
                SELECT id
                FROM menus
                WHERE id = %s
                AND company_id = %s;
                """,
                (
                    str(menu_id),
                    str(company_id)
                )
            )

            if not cur.fetchone():
                return jsonify({
                    "error": "Categoria invalida"
                }), 400

        cur.execute(
            """
            INSERT INTO products (
                company_id,
                menu_id,
                name,
                description,
                price
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                str(company_id),
                str(menu_id) if menu_id else None,
                name,
                description,
                float(price)
            )
        )

        new_prod = cur.fetchone()

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Produto criado com sucesso",
            "product_id": new_prod['id']
        }), 201

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao criar produto",
            e
        )


@app.route('/api/admin/products/<uuid:product_id>', methods=['DELETE'])
@require_roles('OWNER', 'MANAGER')
def admin_delete_product(product_id):
    conn = None
    cur = None

    try:
        company_id = request.user.get('company_id')

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            DELETE FROM products
            WHERE id = %s
            AND company_id = %s
            RETURNING image_key;
            """,
            (
                str(product_id),
                str(company_id)
            )
        )

        removed = cur.fetchone()

        if removed is None:
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "error": "Produto nao encontrado"
            }), 404

        conn.commit()

        cur.close()
        conn.close()

        media_store.delete_pair(company_id, removed[0])

        return jsonify({
            "message": "Produto removido com sucesso"
        }), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao deletar produto",
            e
        )


@app.route('/api/admin/products/<uuid:product_id>/photo', methods=['POST'])
@require_roles('OWNER', 'MANAGER')
def admin_upload_product_photo(product_id):
    """Recebe a foto de um prato (campo "photo"), melhora e guarda. Troca a foto antiga, se houver."""
    company_id = request.user.get('company_id')
    upload = request.files.get('photo')

    if upload is None:
        return jsonify({"error": "Nao recebi nenhuma foto. Tente de novo."}), 400

    data = upload.read(PHOTO_MAX_BYTES + 1)

    if len(data) > PHOTO_MAX_BYTES:
        return jsonify({"error": "A foto e grande demais. Tire outra com a camera normal do celular."}), 413

    if not _photo_slots.acquire(timeout=10):
        return jsonify({"error": "O servidor esta ocupado agora. Tente de novo em alguns segundos."}), 503

    try:
        enhanced = image_enhance.enhance_photo(data)
    except image_enhance.PhotoError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return error_response("Erro ao processar a foto", e)
    finally:
        _photo_slots.release()

    conn = None
    cur = None
    key = media_store.new_key()
    files_saved = False

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # trava a linha do prato: duas fotos chegando juntas ficam uma depois da outra
        cur.execute(
            """
            SELECT image_key
            FROM products
            WHERE id = %s
            AND company_id = %s
            FOR UPDATE;
            """,
            (str(product_id), str(company_id))
        )

        row = cur.fetchone()

        if row is None:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": "Produto nao encontrado"}), 404

        old_key = row[0]

        media_store.save_pair(company_id, key, enhanced.full, enhanced.thumb)
        files_saved = True

        cur.execute(
            """
            UPDATE products
            SET image_key = %s
            WHERE id = %s
            AND company_id = %s;
            """,
            (key, str(product_id), str(company_id))
        )

        conn.commit()

        cur.close()
        conn.close()

        media_store.delete_pair(company_id, old_key)

        body = {
            "message": "Foto salva",
            "improvements": enhanced.improvements,
            "tips": enhanced.tips,
        }
        body.update(media_store.public_urls(company_id, key))

        return jsonify(body), 201

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        if files_saved:
            media_store.delete_pair(company_id, key)

        return error_response("Erro ao salvar a foto", e)


@app.route('/api/admin/products/<uuid:product_id>/photo', methods=['DELETE'])
@require_roles('OWNER', 'MANAGER')
def admin_delete_product_photo(product_id):
    company_id = request.user.get('company_id')
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT image_key
            FROM products
            WHERE id = %s
            AND company_id = %s
            FOR UPDATE;
            """,
            (str(product_id), str(company_id))
        )

        row = cur.fetchone()

        if row is None:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": "Produto nao encontrado"}), 404

        cur.execute(
            """
            UPDATE products
            SET image_key = NULL
            WHERE id = %s
            AND company_id = %s;
            """,
            (str(product_id), str(company_id))
        )

        conn.commit()

        cur.close()
        conn.close()

        media_store.delete_pair(company_id, row[0])

        return jsonify({"message": "Foto removida"}), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response("Erro ao remover a foto", e)


@app.route('/api/admin/company/logo', methods=['POST'])
@require_roles('OWNER', 'MANAGER')
def admin_upload_company_logo():
    """Recebe a logomarca (campo "logo"), prepara e guarda. Troca a logomarca antiga, se houver."""
    company_id = request.user.get('company_id')
    upload = request.files.get('logo')

    if upload is None:
        return jsonify({"error": "Nao recebi nenhuma imagem. Tente de novo."}), 400

    data = upload.read(LOGO_MAX_BYTES + 1)

    if len(data) > LOGO_MAX_BYTES:
        return jsonify({"error": "A imagem e grande demais. Escolha uma menor."}), 413

    if not _photo_slots.acquire(timeout=10):
        return jsonify({"error": "O servidor esta ocupado agora. Tente de novo em alguns segundos."}), 503

    try:
        prepared = logo_image.prepare_logo(data)
    except logo_image.LogoError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return error_response("Erro ao processar a logomarca", e)
    finally:
        _photo_slots.release()

    conn = None
    cur = None
    key = media_store.new_key()
    files_saved = False

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # trava a linha do restaurante: duas logomarcas chegando juntas ficam uma depois da outra
        cur.execute(
            """
            SELECT logo_key
            FROM companies
            WHERE id = %s
            FOR UPDATE;
            """,
            (str(company_id),)
        )

        row = cur.fetchone()

        if row is None:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": "Estabelecimento nao encontrado"}), 404

        old_key = row[0]

        media_store.save_pair(company_id, key, prepared.full, prepared.thumb)
        files_saved = True

        cur.execute(
            """
            UPDATE companies
            SET logo_key = %s
            WHERE id = %s;
            """,
            (key, str(company_id))
        )

        conn.commit()

        cur.close()
        conn.close()

        media_store.delete_pair(company_id, old_key)

        urls = media_store.public_urls(company_id, key)

        return jsonify({
            "message": "Logomarca salva",
            "logo_url": urls["image_url"],
            "logo_thumb_url": urls["thumb_url"],
        }), 201

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        if files_saved:
            media_store.delete_pair(company_id, key)

        return error_response("Erro ao salvar a logomarca", e)


@app.route('/api/admin/company/logo', methods=['DELETE'])
@require_roles('OWNER', 'MANAGER')
def admin_delete_company_logo():
    company_id = request.user.get('company_id')
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT logo_key
            FROM companies
            WHERE id = %s
            FOR UPDATE;
            """,
            (str(company_id),)
        )

        row = cur.fetchone()

        if row is None:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": "Estabelecimento nao encontrado"}), 404

        cur.execute(
            """
            UPDATE companies
            SET logo_key = NULL
            WHERE id = %s;
            """,
            (str(company_id),)
        )

        conn.commit()

        cur.close()
        conn.close()

        media_store.delete_pair(company_id, row[0])

        return jsonify({"message": "Logomarca removida"}), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response("Erro ao remover a logomarca", e)


@app.route(
    '/api/companies/<uuid:company_id>/admin/menus',
    methods=['POST']
)
@require_roles('OWNER', 'MANAGER')
def admin_create_menu(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    conn = None
    cur = None

    try:
        data = request.get_json() or {}
        name = data.get('name')

        if not name:
            return jsonify({
                "error": "Nome e obrigatorio"
            }), 400

        conn = get_db_connection()

        cur = conn.cursor(
            cursor_factory=RealDictCursor
        )

        cur.execute(
            """
            INSERT INTO menus (company_id, name)
            VALUES (%s, %s)
            RETURNING id;
            """,
            (
                str(company_id),
                name
            )
        )

        new_menu = cur.fetchone()

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Categoria criada com sucesso",
            "menu_id": new_menu['id']
        }), 201

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao criar categoria",
            e
        )


@app.route('/api/admin/menu/templates', methods=['GET'])
@require_roles('OWNER', 'MANAGER')
def admin_list_menu_templates():
    return jsonify(menu_templates.list_templates()), 200


@app.route('/api/admin/menu/templates/<template_id>', methods=['GET'])
@require_roles('OWNER', 'MANAGER')
def admin_get_menu_template(template_id):
    template = menu_templates.get_template(template_id)

    if template is None:
        return jsonify({
            "error": "Modelo nao encontrado"
        }), 404

    return jsonify(template), 200


@app.route('/api/admin/menu/capabilities', methods=['GET'])
@require_roles('OWNER', 'MANAGER')
def admin_menu_capabilities():
    """Diz para a tela o que este servidor sabe fazer: ler cardapio por foto e falar com voz natural."""
    return jsonify({
        "photo_menu": menu_photo.is_configured(),
        "natural_voice": voice_tts.is_configured(),
    }), 200


@app.route('/api/admin/voz', methods=['POST'])
@require_roles('OWNER', 'MANAGER')
def admin_natural_voice():
    """Devolve o endereco do audio de uma frase do guia em voz natural (gera e guarda na primeira vez).

    Qualquer falha devolve erro curto: a tela fala com a voz do proprio celular.
    """
    company_id = request.user.get('company_id')
    body = request.get_json(silent=True) or {}

    try:
        url = voice_tts.speech_url(body.get('text'), str(company_id))
    except voice_tts.VoiceError as e:
        return jsonify({"error": e.message}), e.status
    except Exception as e:
        return error_response("Erro ao preparar a voz", e)

    return jsonify({"url": url}), 200


@app.route('/api/admin/feedback', methods=['POST'])
@require_auth
def admin_feedback():
    """Guarda o "Como foi?" do fim de uma tarefa: rostinho (1 a 3) e, se a pessoa quis, o que melhorar."""
    company_id = request.user.get('company_id')
    user_id = request.user.get('user_id')

    try:
        context, rating, comment = feedback.normalize(request.get_json(silent=True))
        feedback.limiter.check(f"{company_id}:{user_id}")
    except feedback.FeedbackError as e:
        return jsonify({"error": str(e)}), 400

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO feedback (company_id, user_id, context, rating, comment)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (company_id, user_id, context, rating, comment or None),
        )
        conn.commit()
        cur.close()
    except Exception as e:
        if conn is not None:
            conn.rollback()
        return error_response("Nao foi possivel guardar a resposta", e)
    finally:
        if conn is not None:
            conn.close()

    return jsonify({"ok": True}), 201


@app.route('/api/admin/menu/parse-photo', methods=['POST'])
@require_roles('OWNER', 'MANAGER')
def admin_parse_menu_photo():
    """Le a(s) foto(s) de um cardapio (campo "photos") e devolve categorias, pratos e preços.

    Nao grava nada: o dono confere na tela e o cadastro acontece pela rota de importacao de sempre.
    """
    company_id = request.user.get('company_id')

    if not menu_photo.is_configured():
        return jsonify({
            "error": "A leitura por foto ainda nao foi ligada neste servidor."
        }), 501

    uploads = request.files.getlist('photos')

    if not uploads:
        return jsonify({"error": "Nao recebi nenhuma foto. Tente de novo."}), 400

    if len(uploads) > menu_photo.MAX_IMAGES:
        return jsonify({
            "error": f"Mande no maximo {menu_photo.MAX_IMAGES} fotos de cada vez."
        }), 400

    photos = []
    total = 0

    for upload in uploads:
        data = upload.read(PHOTO_MAX_BYTES + 1)
        total += len(data)

        if total > PHOTO_MAX_BYTES:
            return jsonify({
                "error": "As fotos sao grandes demais. Tire menos fotos ou use a camera normal do celular."
            }), 413

        photos.append(data)

    if not _menu_read_slots.acquire(timeout=5):
        return jsonify({
            "error": "O servidor esta ocupado lendo outros cardapios. Tente de novo em alguns segundos."
        }), 503

    try:
        result = menu_photo.read_menu(photos, str(company_id))
    except menu_photo.MenuPhotoError as e:
        return jsonify({"error": e.message}), e.status
    except Exception as e:
        return error_response("Erro ao ler o cardapio da foto", e)
    finally:
        _menu_read_slots.release()

    return jsonify(result), 200


@app.route(
    '/api/companies/<uuid:company_id>/admin/menu/import',
    methods=['POST']
)
@require_roles('OWNER', 'MANAGER')
def admin_import_menu(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    categories, problem = menu_import.validate_payload(
        request.get_json(silent=True)
    )

    if problem:
        return jsonify({
            "error": problem
        }), 400

    conn = None
    cur = None

    try:
        conn = get_db_connection()

        cur = conn.cursor(
            cursor_factory=RealDictCursor
        )

        summary = menu_import.import_menu(cur, company_id, categories)

        if summary is None:
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "error": "Estabelecimento nao encontrado"
            }), 404

        conn.commit()

        cur.close()
        conn.close()

        created = (
            summary["menus_created"] + summary["products_created"]
        ) > 0

        return jsonify({
            "message": "Cardapio cadastrado com sucesso",
            **summary
        }), (201 if created else 200)

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao cadastrar o cardapio",
            e
        )


@app.route('/api/admin/menus/<uuid:menu_id>', methods=['DELETE'])
@require_roles('OWNER', 'MANAGER')
def admin_delete_menu(menu_id):
    conn = None
    cur = None

    try:
        company_id = request.user.get('company_id')

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            DELETE FROM menus
            WHERE id = %s
            AND company_id = %s;
            """,
            (
                str(menu_id),
                str(company_id)
            )
        )

        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "error": "Categoria nao encontrada"
            }), 404

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Categoria removida com sucesso"
        }), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao deletar categoria",
            e
        )


VALID_ROLES = (
    'OWNER',
    'MANAGER',
    'WAITER',
    'CASHIER',
    'KITCHEN',
    'COURIER'
)


@app.route(
    '/api/companies/<uuid:company_id>/admin/users',
    methods=['GET']
)
@require_roles('OWNER', 'MANAGER')
def admin_list_users(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    try:
        users = query_db(
            """
            SELECT
                id,
                name,
                email,
                role,
                active,
                created_at
            FROM users
            WHERE company_id = %s
            ORDER BY created_at DESC;
            """,
            (str(company_id),)
        )

        return jsonify(users), 200

    except Exception as e:
        return error_response(
            "Erro ao buscar usuarios",
            e
        )


@app.route(
    '/api/companies/<uuid:company_id>/admin/users',
    methods=['POST']
)
@require_roles('OWNER')
def admin_create_user(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    conn = None
    cur = None

    try:
        data = request.get_json() or {}

        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        role = data.get('role') or ''

        if (
            not name
            or not email
            or not password
            or role not in VALID_ROLES
        ):
            return jsonify({
                "error": "Nome, email, senha e cargo valido sao obrigatorios"
            }), 400

        if len(password) < 8:
            return jsonify({
                "error": "Senha deve ter pelo menos 8 caracteres"
            }), 400

        conn = get_db_connection()

        cur = conn.cursor(
            cursor_factory=RealDictCursor
        )

        try:
            cur.execute(
                """
                INSERT INTO users (
                    company_id,
                    name,
                    email,
                    password_hash,
                    role
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (
                    str(company_id),
                    name,
                    email,
                    generate_password_hash(password),
                    role
                )
            )

        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "error": "Ja existe um usuario com este email"
            }), 409

        new_user = cur.fetchone()

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Usuario criado com sucesso",
            "user_id": new_user['id']
        }), 201

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao criar usuario",
            e
        )


@app.route(
    '/api/admin/users/<uuid:user_id>/deactivate',
    methods=['PUT']
)
@require_roles('OWNER')
def admin_deactivate_user(user_id):
    conn = None
    cur = None

    try:
        company_id = request.user.get('company_id')

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            UPDATE users
            SET active = FALSE
            WHERE id = %s
            AND company_id = %s;
            """,
            (
                str(user_id),
                str(company_id)
            )
        )

        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "error": "Usuario nao encontrado"
            }), 404

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Usuario desativado com sucesso"
        }), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao desativar usuario",
            e
        )


@app.route('/api/admin/users/<uuid:user_id>', methods=['DELETE'])
@require_roles('OWNER')
def admin_delete_user(user_id):
    conn = None
    cur = None

    try:
        company_id = request.user.get('company_id')

        if str(user_id) == str(request.user.get('user_id')):
            return jsonify({
                "error": "Voce nao pode apagar seu proprio usuario"
            }), 400

        conn = get_db_connection()

        cur = conn.cursor(
            cursor_factory=RealDictCursor
        )

        cur.execute(
            """
            SELECT role, active
            FROM users
            WHERE id = %s
            AND company_id = %s;
            """,
            (
                str(user_id),
                str(company_id)
            )
        )

        target = cur.fetchone()

        if not target:
            cur.close()
            conn.close()

            return jsonify({
                "error": "Usuario nao encontrado"
            }), 404

        if target['active']:
            cur.close()
            conn.close()

            return jsonify({
                "error": "Desative o usuario antes de apaga-lo"
            }), 400

        if target['role'] == 'OWNER':
            cur.execute(
                """
                SELECT COUNT(*) AS total
                FROM users
                WHERE company_id = %s
                AND role = 'OWNER'
                AND active = TRUE;
                """,
                (str(company_id),)
            )

            owner_count = cur.fetchone()['total']

            if owner_count <= 1:
                cur.close()
                conn.close()

                return jsonify({
                    "error": "Nao e possivel apagar o unico OWNER do estabelecimento"
                }), 400

        cur.execute(
            """
            DELETE FROM users
            WHERE id = %s
            AND company_id = %s;
            """,
            (
                str(user_id),
                str(company_id)
            )
        )

        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "error": "Usuario nao encontrado"
            }), 404

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Usuario apagado com sucesso"
        }), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao apagar usuario",
            e
        )


@app.route(
    '/api/companies/<uuid:company_id>/admin/tables',
    methods=['GET']
)
@require_auth
def admin_get_tables(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    try:
        tables = query_db(
            """
            SELECT id, number, status
            FROM tables
            WHERE company_id = %s
            ORDER BY number ASC;
            """,
            (str(company_id),)
        )

        return jsonify(tables), 200

    except Exception as e:
        return error_response(
            "Erro ao buscar mesas",
            e
        )


@app.route(
    '/api/companies/<uuid:company_id>/admin/table-calls',
    methods=['GET']
)
@require_auth
def admin_list_table_calls(company_id):
    """As chamadas abertas das mesas, a mais antiga primeiro. Qualquer pessoa da equipe do restaurante ve."""
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    conn = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            table_calls.SQL_LIST_OPEN,
            (str(company_id), table_calls.OPEN_WINDOW_MINUTES)
        )
        rows = cur.fetchall() or []

        return jsonify([table_calls.admin_view(row) for row in rows]), 200

    except Exception as e:
        return error_response("Erro ao buscar as chamadas das mesas", e)
    finally:
        if conn is not None:
            conn.close()


@app.route(
    '/api/companies/<uuid:company_id>/admin/table-calls/<uuid:call_id>/answer',
    methods=['POST']
)
@require_auth
def admin_answer_table_call(company_id, call_id):
    """Atender: fecha a chamada e guarda a hora e quem atendeu (o tempo ate aqui vira a meta do garcom)."""
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    conn = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            table_calls.SQL_ANSWER,
            (request.user.get('user_id'), str(call_id), str(company_id))
        )
        answered = cur.fetchone()

        if answered:
            conn.commit()
            return jsonify({
                "ok": True,
                "already": False,
                "seconds_to_answer": answered['seconds_to_answer']
            }), 200

        # Nao fechou agora: ou outra pessoa ja atendeu (tudo certo) ou a chamada nao e deste restaurante.
        cur.execute(table_calls.SQL_EXISTS, (str(call_id), str(company_id)))

        if cur.fetchone():
            return jsonify({"ok": True, "already": True}), 200

        return jsonify({"error": "Chamada nao encontrada"}), 404

    except Exception as e:
        if conn is not None:
            conn.rollback()
        return error_response("Nao foi possivel marcar como atendida", e)
    finally:
        if conn is not None:
            conn.close()


TABLE_QR_MAX_URL_LENGTH = 500


@app.route(
    '/api/companies/<uuid:company_id>/admin/tables/<uuid:table_id>/qr',
    methods=['GET']
)
@require_auth
def admin_get_table_qr(company_id, table_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    try:
        target_url = (request.args.get('url') or '').strip()

        if not target_url or len(target_url) > TABLE_QR_MAX_URL_LENGTH:
            return jsonify({
                "error": "Link da mesa invalido"
            }), 400

        company = query_db(
            """
            SELECT slug
            FROM companies
            WHERE id = %s;
            """,
            (str(company_id),),
            one=True
        )

        table = query_db(
            """
            SELECT id
            FROM tables
            WHERE id = %s
            AND company_id = %s;
            """,
            (str(table_id), str(company_id)),
            one=True
        )

        if not company or not table:
            return jsonify({
                "error": "Mesa nao encontrada"
            }), 404

        parsed = urlparse(target_url)
        params = parse_qs(parsed.query)

        # The QR may only point at this company's own table link.
        if (
            parsed.scheme not in ('http', 'https')
            or not parsed.netloc
            or params.get('empresa') != [company['slug']]
            or params.get('mesa') != [str(table_id)]
        ):
            return jsonify({
                "error": "Link da mesa invalido"
            }), 400

        png = qr_png_for_url(target_url)

        return jsonify({
            "data_url": "data:image/png;base64,"
            + base64.b64encode(png).decode('ascii')
        }), 200

    except Exception as e:
        return error_response(
            "Erro ao gerar QR da mesa",
            e
        )


@app.route(
    '/api/companies/<uuid:company_id>/admin/tables',
    methods=['POST']
)
@require_roles('OWNER', 'MANAGER')
def admin_create_table(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    conn = None
    cur = None

    try:
        data = request.get_json() or {}
        number = data.get('number')

        if not number:
            return jsonify({
                "error": "O numero da mesa eh obrigatorio"
            }), 400

        existing = query_db(
            """
            SELECT id
            FROM tables
            WHERE company_id = %s
            AND number = %s;
            """,
            (
                str(company_id),
                int(number)
            )
        )

        if existing:
            return jsonify({
                "error": "Ja existe uma mesa com este numero"
            }), 400

        conn = get_db_connection()

        cur = conn.cursor(
            cursor_factory=RealDictCursor
        )

        cur.execute(
            """
            INSERT INTO tables (
                company_id,
                number,
                status
            )
            VALUES (%s, %s, 'livre')
            RETURNING id;
            """,
            (
                str(company_id),
                int(number)
            )
        )

        new_table = cur.fetchone()

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Mesa criada com sucesso",
            "table_id": new_table['id']
        }), 201

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao criar mesa",
            e
        )


@app.route('/api/admin/tables/<uuid:table_id>', methods=['DELETE'])
@require_roles('OWNER', 'MANAGER')
def admin_delete_table(table_id):
    conn = None
    cur = None

    try:
        company_id = request.user.get('company_id')

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            DELETE FROM tables
            WHERE id = %s
            AND company_id = %s;
            """,
            (
                str(table_id),
                str(company_id)
            )
        )

        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "error": "Mesa nao encontrada"
            }), 404

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Mesa removida com sucesso"
        }), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao deletar mesa",
            e
        )


# ---------------------------------------------------------------------------
# Pix do restaurante (Pix estatico: o dinheiro vai direto para a conta do
# restaurante; quem confirma o recebimento e uma pessoa do restaurante)
# ---------------------------------------------------------------------------

PIX_PREVIEW_AMOUNT = Decimal('1.00')
PIX_PREVIEW_REFERENCE = 'TESTE'


def pix_qr_data_url(payload):
    png = qr_png_for_url(payload)

    return "data:image/png;base64," + base64.b64encode(png).decode('ascii')


def load_company_pix(company_id):
    return query_db(
        """
        SELECT pix_key_type, pix_key, pix_receiver_name, pix_city
        FROM companies
        WHERE id = %s;
        """,
        (str(company_id),),
        one=True
    )


def company_pix_is_configured(row):
    return bool(
        row
        and row.get('pix_key')
        and row.get('pix_receiver_name')
        and row.get('pix_city')
    )


def build_company_pix_payload(row, amount, reference):
    name, city = pix.clean_receiver(
        row['pix_receiver_name'],
        row['pix_city']
    )

    return pix.build_payload(
        key=row['pix_key'],
        receiver_name=name,
        city=city,
        amount=amount,
        txid=reference
    )


def read_tracking_token(order_id):
    """Valid tracking data for this order, or None."""
    try:
        tracking = serializer.loads(
            request.args.get('tracking_token', ''),
            max_age=60 * 60 * 24 * 7
        )
    except (SignatureExpired, BadSignature):
        return None

    if (
        tracking.get('purpose') != 'order_tracking'
        or tracking.get('order_id') != str(order_id)
    ):
        return None

    return tracking


@app.route(
    '/api/companies/<uuid:company_id>/payment-options',
    methods=['GET']
)
def get_payment_options(company_id):
    try:
        row = load_company_pix(company_id)

        return jsonify({
            "pix": company_pix_is_configured(row)
        }), 200

    except Exception as e:
        return error_response(
            "Erro ao buscar formas de pagamento",
            e
        )


@app.route('/api/orders/<uuid:order_id>/pix', methods=['GET'])
def get_order_pix(order_id):
    tracking = read_tracking_token(order_id)

    if tracking is None:
        return jsonify({
            "error": "Acesso de acompanhamento invalido"
        }), 401

    try:
        order = query_db(
            """
            SELECT id, company_id, total_price, payment_method
            FROM orders
            WHERE id = %s;
            """,
            (str(order_id),),
            one=True
        )

        if not order:
            return jsonify({
                "error": "Pedido nao encontrado"
            }), 404

        if tracking.get('company_id') != str(order['company_id']):
            return jsonify({
                "error": "Acesso de acompanhamento invalido"
            }), 401

        if (order['payment_method'] or '').lower() != 'pix':
            return jsonify({
                "error": "Este pedido nao e Pix"
            }), 404

        row = load_company_pix(order['company_id'])

        if not company_pix_is_configured(row):
            return jsonify({
                "error": "Pix nao configurado neste restaurante"
            }), 404

        # The amount always comes from the order saved on the server.
        payload = build_company_pix_payload(
            row,
            order['total_price'],
            pix.txid_for_order(order['id'])
        )

        return jsonify({
            "payload": payload,
            "qr_data_url": pix_qr_data_url(payload),
            "receiver_name": row['pix_receiver_name'],
            "amount": pix.format_amount(order['total_price'])
        }), 200

    except pix.PixError:
        return jsonify({
            "error": "Pix nao configurado neste restaurante"
        }), 404

    except Exception as e:
        return error_response(
            "Erro ao gerar o Pix do pedido",
            e
        )


def pix_settings_view(row):
    if not company_pix_is_configured(row):
        return {"configured": False}

    return {
        "configured": True,
        "key_type": row['pix_key_type'],
        "key_masked": pix.mask_key(row['pix_key_type'], row['pix_key']),
        "receiver_name": row['pix_receiver_name'],
        "city": row['pix_city']
    }


@app.route(
    '/api/companies/<uuid:company_id>/admin/pix',
    methods=['GET']
)
@require_roles('OWNER', 'MANAGER')
def admin_get_pix(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    try:
        return jsonify(
            pix_settings_view(load_company_pix(company_id))
        ), 200

    except Exception as e:
        return error_response(
            "Erro ao buscar o Pix do restaurante",
            e
        )


@app.route(
    '/api/companies/<uuid:company_id>/admin/pix',
    methods=['PUT']
)
@require_roles('OWNER')
def admin_save_pix(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    conn = None
    cur = None

    try:
        data = request.get_json() or {}
        password = data.get('password') or ''

        # Changing where the money goes needs the password again, so a
        # stolen session alone cannot redirect the payments.
        user = query_db(
            """
            SELECT email, password_hash
            FROM users
            WHERE id = %s
            AND company_id = %s
            AND active = TRUE;
            """,
            (
                str(request.user.get('user_id')),
                str(company_id)
            ),
            one=True
        )

        if not user:
            return jsonify({
                "error": "Usuario nao encontrado"
            }), 403

        if is_login_blocked(user['email']):
            return jsonify({
                "error": "Muitas tentativas. Tente novamente em alguns minutos."
            }), 429

        if not password or not check_password_hash(
            user['password_hash'],
            password
        ):
            register_failed_login(user['email'])

            return jsonify({
                "error": "Senha incorreta"
            }), 403

        clear_failed_logins(user['email'])

        if data.get('remove') is True:
            values = (None, None, None, None)
        else:
            try:
                key = pix.normalize_key(
                    data.get('key_type'),
                    data.get('key')
                )
                name, city = pix.clean_receiver(
                    data.get('receiver_name'),
                    data.get('city')
                )
            except pix.PixError as error:
                return jsonify({
                    "error": str(error)
                }), 400

            values = (
                str(data.get('key_type')).strip().lower(),
                key,
                name,
                city
            )

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            """
            UPDATE companies
            SET pix_key_type = %s,
                pix_key = %s,
                pix_receiver_name = %s,
                pix_city = %s
            WHERE id = %s;
            """,
            values + (str(company_id),)
        )

        conn.commit()

        cur.close()
        conn.close()

        return jsonify(pix_settings_view({
            "pix_key_type": values[0],
            "pix_key": values[1],
            "pix_receiver_name": values[2],
            "pix_city": values[3]
        })), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao salvar o Pix do restaurante",
            e
        )


@app.route(
    '/api/companies/<uuid:company_id>/admin/pix/preview',
    methods=['GET']
)
@require_roles('OWNER', 'MANAGER')
def admin_preview_pix(company_id):
    access_error = require_company_access(company_id)

    if access_error:
        return access_error

    try:
        row = load_company_pix(company_id)

        if not company_pix_is_configured(row):
            return jsonify({
                "error": "Pix nao configurado"
            }), 404

        payload = build_company_pix_payload(
            row,
            PIX_PREVIEW_AMOUNT,
            PIX_PREVIEW_REFERENCE
        )

        return jsonify({
            "payload": payload,
            "qr_data_url": pix_qr_data_url(payload),
            "receiver_name": row['pix_receiver_name'],
            "amount": pix.format_amount(PIX_PREVIEW_AMOUNT)
        }), 200

    except pix.PixError as error:
        return jsonify({
            "error": str(error)
        }), 400

    except Exception as e:
        return error_response(
            "Erro ao gerar o codigo de teste",
            e
        )


@app.route(
    '/api/orders/<uuid:order_id>/payment/confirm',
    methods=['POST']
)
@require_roles('OWNER', 'MANAGER', 'CASHIER')
def confirm_order_payment(order_id):
    conn = None
    cur = None

    try:
        company_id = request.user.get('company_id')

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            """
            SELECT pay.id, pay.status
            FROM payments pay
            JOIN orders o
                ON o.id = pay.order_id
            WHERE o.id = %s
            AND o.company_id = %s
            ORDER BY pay.created_at DESC
            LIMIT 1;
            """,
            (str(order_id), str(company_id))
        )

        payment = cur.fetchone()

        if not payment:
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "error": "Pedido nao encontrado"
            }), 404

        if payment['status'] == 'PAID':
            conn.rollback()
            cur.close()
            conn.close()

            return jsonify({
                "message": "Pagamento ja estava confirmado",
                "already_paid": True
            }), 200

        cur.execute(
            """
            UPDATE payments
            SET status = 'PAID',
                paid_at = NOW()
            WHERE id = %s;
            """,
            (str(payment['id']),)
        )

        cur.execute(
            """
            INSERT INTO order_events (
                order_id,
                event_type
            )
            VALUES (%s, 'PAYMENT_CONFIRMED');
            """,
            (str(order_id),)
        )

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Pagamento confirmado"
        }), 200

    except Exception as e:
        if conn is not None and not conn.closed:
            conn.rollback()

            if cur is not None:
                cur.close()

            conn.close()

        return error_response(
            "Erro ao confirmar pagamento",
            e
        )


# =====================================================================================
# Custos, porcao e CMV (item 6 da ordem de trabalho). Contas em costing.py.
# So dono e gerente veem custo; o cliente nunca ve (a rota publica de produtos nao muda).
# =====================================================================================
COST_ROLES = ('OWNER', 'MANAGER')


def _close_quietly(conn, cur=None, rollback=True):
    if conn is None or conn.closed:
        return
    if rollback:
        conn.rollback()
    if cur is not None:
        cur.close()
    conn.close()


def load_cost_view(company_id):
    company = query_db(
        "SELECT cmv_target FROM companies WHERE id = %s;",
        (str(company_id),),
        one=True
    )
    if not company:
        return None
    target = int(company.get('cmv_target') or costing.DEFAULT_TARGET)

    ingredient_rows = query_db(
        """
        SELECT id, name, unit, package_qty, package_price, yield_pct, stock_qty, stock_at
        FROM ingredients
        WHERE company_id = %s
        ORDER BY lower(name), id;
        """,
        (str(company_id),)
    ) or []
    product_rows = query_db(
        """
        SELECT id, name, price, menu_id, portion, portion_grams, yield_portions, extra_cost
        FROM products
        WHERE company_id = %s
        ORDER BY lower(name), id;
        """,
        (str(company_id),)
    ) or []
    line_rows = query_db(
        """
        SELECT pi.product_id, pi.ingredient_id, pi.quantity
        FROM product_ingredients pi
        JOIN products p ON p.id = pi.product_id
        JOIN ingredients i ON i.id = pi.ingredient_id
        WHERE p.company_id = %s
        AND i.company_id = p.company_id;
        """,
        (str(company_id),)
    ) or []
    now = datetime.now(timezone.utc)
    sold_rows = query_db(
        """
        SELECT oi.product_id, oi.quantity, oi.unit_price, oi.unit_cost, o.created_at
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.company_id = %s
        AND o.status IN ('em preparo', 'concluido')
        AND o.created_at >= %s;
        """,
        (str(company_id), cost_since(ingredient_rows, now))
    ) or []

    return build_cost_view(target, ingredient_rows, product_rows, line_rows, sold_rows, now)


def ingredient_fields(data):
    name = costing.clean_name(data.get('name'), 'Nome do insumo')
    package_qty, unit = costing.to_base(
        data.get('quantity'),
        data.get('unit'),
        'Tamanho da embalagem'
    )
    price = costing.money(costing.parse_number(
        data.get('price'),
        'Preco pago',
        maximum=costing.MAX_PACKAGE_PRICE
    ))
    yield_pct = costing.normalize_yield_pct(data.get('yield_pct'))
    return {
        "name": name, "unit": unit, "package_qty": package_qty, "package_price": price, "yield_pct": yield_pct
    }


@app.route('/api/companies/<uuid:company_id>/admin/costs', methods=['GET'])
@require_roles(*COST_ROLES)
def admin_get_costs(company_id):
    access_error = require_company_access(company_id)
    if access_error:
        return access_error

    try:
        view = load_cost_view(company_id)
    except Exception as e:
        return error_response("Erro ao carregar os custos", e)

    if view is None:
        return jsonify({"error": "Restaurante nao encontrado"}), 404

    return jsonify(view), 200


@app.route('/api/companies/<uuid:company_id>/admin/costs/target', methods=['PUT'])
@require_roles(*COST_ROLES)
def admin_save_cost_target(company_id):
    access_error = require_company_access(company_id)
    if access_error:
        return access_error

    data = request.get_json(silent=True) or {}
    try:
        target = costing.normalize_target(data.get('target'))
    except costing.CostError as error:
        return jsonify({"error": str(error)}), 400

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "UPDATE companies SET cmv_target = %s WHERE id = %s RETURNING cmv_target;",
            (target, str(company_id))
        )
        row = cur.fetchone()
        if row is None:
            _close_quietly(conn, cur)
            return jsonify({"error": "Restaurante nao encontrado"}), 404
        conn.commit()
        _close_quietly(conn, cur, rollback=False)
        return jsonify({"target": target}), 200
    except Exception as e:
        _close_quietly(conn, cur)
        return error_response("Erro ao salvar a meta", e)


@app.route('/api/companies/<uuid:company_id>/admin/ingredients', methods=['POST'])
@require_roles(*COST_ROLES)
def admin_create_ingredient(company_id):
    access_error = require_company_access(company_id)
    if access_error:
        return access_error

    data = request.get_json(silent=True) or {}
    try:
        fields = ingredient_fields(data)
    except costing.CostError as error:
        return jsonify({"error": str(error)}), 400

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            INSERT INTO ingredients (company_id, name, unit, package_qty, package_price, yield_pct)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                str(company_id), fields['name'], fields['unit'], fields['package_qty'], fields['package_price'],
                fields['yield_pct']
            )
        )
        row = cur.fetchone()
        conn.commit()
        _close_quietly(conn, cur, rollback=False)
        return jsonify({"id": str(row['id']), "message": "Insumo salvo"}), 201
    except psycopg2.errors.UniqueViolation:
        _close_quietly(conn, cur)
        return jsonify({"error": "Ja existe um insumo com esse nome."}), 409
    except Exception as e:
        _close_quietly(conn, cur)
        return error_response("Erro ao salvar o insumo", e)


@app.route('/api/companies/<uuid:company_id>/admin/ingredients/<uuid:ingredient_id>', methods=['PUT'])
@require_roles(*COST_ROLES)
def admin_update_ingredient(company_id, ingredient_id):
    access_error = require_company_access(company_id)
    if access_error:
        return access_error

    data = request.get_json(silent=True) or {}
    try:
        fields = ingredient_fields(data)
    except costing.CostError as error:
        return jsonify({"error": str(error)}), 400

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT unit
            FROM ingredients
            WHERE id = %s
            AND company_id = %s
            FOR UPDATE;
            """,
            (str(ingredient_id), str(company_id))
        )
        current = cur.fetchone()
        if current is None:
            _close_quietly(conn, cur)
            return jsonify({"error": "Insumo nao encontrado"}), 404

        if current['unit'] != fields['unit']:
            cur.execute(
                "SELECT count(*) AS n FROM product_ingredients WHERE ingredient_id = %s;",
                (str(ingredient_id),)
            )
            used = int((cur.fetchone() or {}).get('n') or 0)
            if used:
                _close_quietly(conn, cur)
                return jsonify({
                    "error": (
                        f"Esse insumo esta em {used} prato(s). Para trocar peso por liquido ou por unidade, "
                        "crie outro insumo."
                    )
                }), 409

        cur.execute(
            """
            UPDATE ingredients
            SET name = %s, unit = %s, package_qty = %s, package_price = %s, yield_pct = %s, updated_at = now()
            WHERE id = %s
            AND company_id = %s;
            """,
            (
                fields['name'], fields['unit'], fields['package_qty'], fields['package_price'], fields['yield_pct'],
                str(ingredient_id), str(company_id)
            )
        )
        conn.commit()
        _close_quietly(conn, cur, rollback=False)
        return jsonify({"message": "Insumo salvo"}), 200
    except psycopg2.errors.UniqueViolation:
        _close_quietly(conn, cur)
        return jsonify({"error": "Ja existe um insumo com esse nome."}), 409
    except Exception as e:
        _close_quietly(conn, cur)
        return error_response("Erro ao salvar o insumo", e)


@app.route('/api/companies/<uuid:company_id>/admin/ingredients/<uuid:ingredient_id>', methods=['DELETE'])
@require_roles(*COST_ROLES)
def admin_delete_ingredient(company_id, ingredient_id):
    access_error = require_company_access(company_id)
    if access_error:
        return access_error

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            DELETE FROM ingredients
            WHERE id = %s
            AND company_id = %s
            RETURNING id;
            """,
            (str(ingredient_id), str(company_id))
        )
        removed = cur.fetchone()
        if removed is None:
            _close_quietly(conn, cur)
            return jsonify({"error": "Insumo nao encontrado"}), 404
        conn.commit()
        _close_quietly(conn, cur, rollback=False)
        return jsonify({"message": "Insumo removido. Ele saiu das fichas dos pratos."}), 200
    except Exception as e:
        _close_quietly(conn, cur)
        return error_response("Erro ao remover o insumo", e)


@app.route('/api/companies/<uuid:company_id>/admin/products/<uuid:product_id>/recipe', methods=['PUT'])
@require_roles(*COST_ROLES)
def admin_save_recipe(company_id, product_id):
    """Troca a ficha tecnica inteira do prato (insumos e quantidades), a porcao e os outros custos."""
    access_error = require_company_access(company_id)
    if access_error:
        return access_error

    data = request.get_json(silent=True) or {}
    items = data.get('items', [])
    extra_raw = data.get('extra_cost')
    try:
        portion = costing.clean_portion(data.get('portion'))
        yield_portions = costing.normalize_yield_portions(data.get('yield_portions'))
        portion_grams = costing.normalize_portion_grams(data.get('portion_grams'))
        extra_cost = costing.money(costing.parse_number(
            0 if extra_raw in (None, '') else extra_raw,
            'Outros custos',
            maximum=costing.MAX_EXTRA_COST
        ))
        if not isinstance(items, list):
            raise costing.CostError("Ficha tecnica invalida.")
    except costing.CostError as error:
        return jsonify({"error": str(error)}), 400

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT p.id, p.price, c.cmv_target
            FROM products p
            JOIN companies c ON c.id = p.company_id
            WHERE p.id = %s
            AND p.company_id = %s
            FOR UPDATE OF p;
            """,
            (str(product_id), str(company_id))
        )
        product = cur.fetchone()
        if product is None:
            _close_quietly(conn, cur)
            return jsonify({"error": "Prato nao encontrado"}), 404

        ids = sorted({
            str(item.get('ingredient_id'))
            for item in items
            if isinstance(item, dict) and item.get('ingredient_id')
        })
        known = {}
        if ids:
            cur.execute(
                """
                SELECT id, unit, package_qty, package_price, yield_pct
                FROM ingredients
                WHERE company_id = %s
                AND id::text = ANY(%s)
                FOR SHARE;
                """,
                (str(company_id), ids)
            )
            known = {str(row['id']): row for row in (cur.fetchall() or [])}

        try:
            lines = costing.recipe_lines(items, {iid: row['unit'] for iid, row in known.items()})
            cost = costing.product_cost(
                (
                    (qty, known[iid]['package_qty'], known[iid]['package_price'], known[iid].get('yield_pct') or 100)
                    for iid, qty in lines
                ),
                extra_cost,
                yield_portions
            )
            if cost is not None and cost > costing.MAX_PORTION_COST:
                raise costing.CostError(
                    "O custo da porcao passou de R$ 100.000. Confira o tamanho da embalagem e as quantidades."
                )
        except costing.CostError as error:
            _close_quietly(conn, cur)
            return jsonify({"error": str(error)}), 400

        cur.execute(
            "DELETE FROM product_ingredients WHERE product_id = %s;",
            (str(product_id),)
        )
        for ingredient_id, quantity in lines:
            cur.execute(
                """
                INSERT INTO product_ingredients (product_id, ingredient_id, quantity)
                VALUES (%s, %s, %s);
                """,
                (str(product_id), ingredient_id, quantity)
            )
        cur.execute(
            """
            UPDATE products
            SET portion = %s, extra_cost = %s, yield_portions = %s, portion_grams = %s
            WHERE id = %s
            AND company_id = %s;
            """,
            (portion, extra_cost, yield_portions, portion_grams, str(product_id), str(company_id))
        )
        conn.commit()
        _close_quietly(conn, cur, rollback=False)

        target = int(product.get('cmv_target') or costing.DEFAULT_TARGET)
        price = Decimal(product.get('price') or 0)
        return jsonify({
            "message": "Ficha salva",
            "cost": _num(cost),
            "cmv": _num(costing.cmv_percent(cost, price), '0.1'),
            "status": costing.status(cost, price, target),
            "suggested_price": _num(costing.suggested_price(cost, target)),
        }), 200
    except Exception as e:
        _close_quietly(conn, cur)
        return error_response("Erro ao salvar a ficha do prato", e)


@app.route('/api/companies/<uuid:company_id>/admin/ingredients/<uuid:ingredient_id>/stock', methods=['POST'])
@require_roles(*COST_ROLES)
def admin_ingredient_stock(company_id, ingredient_id):
    """Estoque pela ficha. mode: 'contagem' (o que tem agora), 'compra' (soma ao que tem) ou 'parar'."""
    access_error = require_company_access(company_id)
    if access_error:
        return access_error

    data = request.get_json(silent=True) or {}
    mode = data.get('mode')
    if mode not in ('contagem', 'compra', 'parar'):
        return jsonify({"error": "Escolha: contei, comprei ou parar de controlar."}), 400
    amount = None
    unit = None
    if mode != 'parar':
        try:
            if mode == 'contagem' and costing.parse_number(data.get('quantity'), 'Quantidade') == 0:
                # "contei e acabou": zero e uma contagem valida
                amount = Decimal('0.000')
                unit = costing.UNITS[costing.normalize_unit(data.get('unit'))][0]
            else:
                amount, unit = costing.to_base(data.get('quantity'), data.get('unit'), 'Quantidade')
        except costing.CostError as error:
            return jsonify({"error": str(error)}), 400

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT unit, yield_pct, stock_qty, stock_at
            FROM ingredients
            WHERE id = %s
            AND company_id = %s
            FOR UPDATE;
            """,
            (str(ingredient_id), str(company_id))
        )
        row = cur.fetchone()
        if row is None:
            _close_quietly(conn, cur)
            return jsonify({"error": "Insumo nao encontrado"}), 404
        if unit is not None and unit != row['unit']:
            _close_quietly(conn, cur)
            return jsonify({"error": "Unidade nao combina com o insumo: peso com peso, liquido com liquido."}), 400

        new_stock = None
        if mode == 'contagem':
            new_stock = amount
        elif mode == 'compra':
            current = Decimal('0')
            if row.get('stock_qty') is not None and row.get('stock_at') is not None:
                cur.execute(
                    """
                    SELECT oi.quantity AS sold, pi.quantity AS recipe_qty, p.yield_portions
                    FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    JOIN products p ON p.id = oi.product_id AND p.company_id = o.company_id
                    JOIN product_ingredients pi ON pi.product_id = p.id
                    WHERE o.company_id = %s
                    AND o.status IN ('em preparo', 'concluido')
                    AND o.created_at > %s
                    AND pi.ingredient_id = %s;
                    """,
                    (str(company_id), row['stock_at'], str(ingredient_id))
                )
                used = sum(
                    (costing.gross_use(r['sold'], r['recipe_qty'], r.get('yield_portions') or 1, row.get('yield_pct'))
                     for r in (cur.fetchall() or [])),
                    Decimal('0')
                )
                current = max(costing.stock_now(row['stock_qty'], used), Decimal('0'))
            new_stock = current + amount
            if new_stock > costing.MAX_PACKAGE_QTY * 100:
                _close_quietly(conn, cur)
                return jsonify({"error": "Quantidade grande demais. Confira se digitou certo."}), 400

        cur.execute(
            """
            UPDATE ingredients
            SET stock_qty = %s, stock_at = CASE WHEN %s IS NULL THEN NULL ELSE now() END
            WHERE id = %s
            AND company_id = %s;
            """,
            (new_stock, new_stock, str(ingredient_id), str(company_id))
        )
        conn.commit()
        _close_quietly(conn, cur, rollback=False)
        return jsonify({"stock_qty": _num(new_stock, '0.001'), "unit": row['unit']}), 200
    except Exception as e:
        _close_quietly(conn, cur)
        return error_response("Erro ao salvar o estoque", e)


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=FLASK_DEBUG
    )