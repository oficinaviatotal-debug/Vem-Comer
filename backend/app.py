import base64
import os
import time
import threading
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
import image_enhance
import media_store
import menu_import
import menu_templates
import pix
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
PHOTO_ENDPOINTS = {'admin_upload_product_photo'}
# No maximo 2 fotos sendo processadas ao mesmo tempo: o processamento usa memoria e processador.
_photo_slots = threading.BoundedSemaphore(2)

SECRET_KEY = os.getenv('SECRET_KEY')

if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY nao definida. Adicione SECRET_KEY=<valor aleatorio> no .env"
    )

serializer = URLSafeTimedSerializer(SECRET_KEY)
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 horas

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
            "role": user['role']
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


@app.route('/api/companies/<uuid:company_id>', methods=['GET'])
def get_company(company_id):
    try:
        company = query_db(
            """
            SELECT id, name, slug
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

        return jsonify(company), 200

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
            SELECT id, name, slug
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

        return jsonify(company), 200

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

        for product_id, quantity, unit_price, item_total in order_items:
            cur.execute(
                """
                INSERT INTO order_items (
                    order_id,
                    product_id,
                    quantity,
                    unit_price,
                    total
                )
                VALUES (%s, %s, %s, %s, %s);
                """,
                (
                    str(order_id),
                    str(product_id),
                    quantity,
                    unit_price,
                    item_total
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


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=FLASK_DEBUG
    )