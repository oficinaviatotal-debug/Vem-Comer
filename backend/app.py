import os
import time
import threading
from functools import wraps
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.security import check_password_hash, generate_password_hash
from db import query_db, get_db_connection

app = Flask(__name__)

SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY nao definida. Adicione SECRET_KEY=<valor aleatorio> no .env")
serializer = URLSafeTimedSerializer(SECRET_KEY)
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 8  # 8 horas

CORS_ORIGIN_REGEX = os.getenv('CORS_ORIGIN_REGEX', r"https://.*\.app\.github\.dev")

CORS(app, resources={r"/*": {
    "origins": [CORS_ORIGIN_REGEX],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

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
            data = serializer.loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
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
                return jsonify({"error": "Acesso negado para este cargo"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

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

def register_failed_login(email):
    now = time.time()
    with _login_lock:
        attempts = [t for t in _failed_login_attempts.get(email, []) if now - t < LOGIN_WINDOW_SECONDS]
        attempts.append(now)
        _failed_login_attempts[email] = attempts

def is_login_blocked(email):
    now = time.time()
    with _login_lock:
        attempts = [t for t in _failed_login_attempts.get(email, []) if now - t < LOGIN_WINDOW_SECONDS]
        _failed_login_attempts[email] = attempts
        return len(attempts) >= LOGIN_MAX_ATTEMPTS

def clear_failed_logins(email):
    with _login_lock:
        _failed_login_attempts.pop(email, None)

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not email or not password:
            return jsonify({"error": "Email e senha sao obrigatorios"}), 400

        if is_login_blocked(email):
            return jsonify({"error": "Muitas tentativas. Tente novamente em alguns minutos."}), 429

        user = query_db(
            "SELECT id, company_id, name, email, password_hash, role FROM users WHERE email = %s AND active = TRUE;",
            (email,),
            one=True
        )

        # Mensagem genérica em ambos os casos, pra não revelar se o email existe
        if not user or not check_password_hash(user['password_hash'], password):
            register_failed_login(email)
            return jsonify({"error": "Email ou senha invalidos"}), 401

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
        return jsonify({"error": "Erro interno ao autenticar", "details": str(e)}), 500

@app.route('/api/companies/<uuid:company_id>', methods=['GET'])
def get_company(company_id):
    try:
        company = query_db(
            "SELECT id, name, slug FROM companies WHERE id = %s;", 
            (str(company_id),), 
            one=True
        )
        if not company:
            return jsonify({"error": "Estabelecimento não encontrado"}), 404
        return jsonify(company), 200
    except Exception as e:
        return jsonify({"error": "Erro interno no servidor", "details": str(e)}), 500

@app.route('/api/companies/<uuid:company_id>/users', methods=['GET'])
def get_company_users(company_id):
    try:
        users = query_db(
            "SELECT id, company_id, name, email, role FROM users WHERE company_id = %s;",
            (str(company_id),)
        )
        return jsonify(users), 200
    except Exception as e:
        return jsonify({"error": "Erro interno ao buscar usuários", "details": str(e)}), 500

@app.route('/api/companies/<uuid:company_id>/products', methods=['GET'])
def get_company_products(company_id):
    try:
        products = query_db(
            "SELECT id, company_id, menu_id, name, description, price FROM products WHERE company_id = %s;",
            (str(company_id),)
        )
        return jsonify(products), 200
    except Exception as e:
        return jsonify({"error": "Erro interno ao buscar produtos", "details": str(e)}), 500

@app.route('/api/companies/<uuid:company_id>/feedbacks', methods=['POST'])
def create_feedback(company_id):
    try:
        data = request.get_json()
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO feedbacks (company_id, food_rating, service_rating, delivery_rating, comment) VALUES (%s, %s, %s, %s, %s);",
            (str(company_id), data.get('food'), data.get('service'), data.get('delivery'), data.get('comment'))
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Feedback salvo com sucesso"}), 201
    except Exception as e:
        return jsonify({"error": "Erro ao salvar feedback", "details": str(e)}), 500

@app.route('/api/companies/<uuid:company_id>/menus', methods=['GET'])
def get_company_menus(company_id):
    try:
        menus = query_db(
            "SELECT id, company_id, name, active FROM menus WHERE company_id = %s AND active = TRUE;",
            (str(company_id),)
        )
        return jsonify(menus), 200
    except Exception as e:
        return jsonify({"error": "Erro interno ao buscar categorias", "details": str(e)}), 500

@app.route('/api/companies/<uuid:company_id>/orders', methods=['POST'])
def create_company_order(company_id):
    try:
        data = request.get_json()
        customer_name = data.get('customer_name', 'Cliente Balcão')
        cart_items = data.get('items', [])
        total_price = data.get('total_price', 0)
        
        # Captura os dados de checkout enviados pelo React
        payment_method = data.get('payment_method', 'pix')
        payment_change = data.get('payment_change', 0)
        
        if not cart_items:
            return jsonify({"error": "O carrinho esta vazio"}), 400
            
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Alimenta as novas colunas com os parâmetros dinâmicos
        cur.execute(
            """
            INSERT INTO orders (company_id, customer_name, customer, total_price, total, payment_method, payment_change) 
            VALUES (%s, %s, %s, %s, %s, %s, %s) 
            RETURNING id;
            """,
            (str(company_id), customer_name, customer_name, total_price, total_price, payment_method, float(payment_change or 0))
        )
        order_row = cur.fetchone()
        order_id = order_row['id']
        
        for item in cart_items:
            product_id = item.get('id')
            quantity = int(item.get('quantity', 1))
            price = item.get('price')
            if price is None:
                cur.execute("SELECT price FROM products WHERE id = %s;", (str(product_id),))
                prod_row = cur.fetchone()
                price = prod_row['price'] if prod_row else 0
            item_price = float(price)
            item_total = item_price * quantity
            cur.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, price, value) VALUES (%s, %s, %s, %s, %s, %s, %s);",
                (str(order_id), str(product_id), quantity, item_price, item_total, item_price, item_price)
            )
            
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Pedido realizado com sucesso", "order_id": str(order_id)}), 201
    except Exception as e:
        if 'conn' in locals() and not conn.closed:
            conn.rollback()
            cur.close()
            conn.close()
        return jsonify({"error": "Erro interno ao processar pedido", "details": str(e)}), 500

@app.route('/api/orders/<uuid:order_id>', methods=['GET'])
def get_order(order_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            """
            SELECT id, company_id, customer_name, total_price, status
            FROM orders
            WHERE id = %s;
            """,
            (str(order_id),)
        )

        order = cur.fetchone()

        if not order:
            cur.close()
            conn.close()
            return jsonify({"error": "Pedido não encontrado"}), 404

        cur.execute(
            """
            SELECT
                oi.product_id,
                oi.quantity,
                oi.unit_price,
                oi.total,
                p.name
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = %s;
            """,
            (str(order_id),)
        )

        items = cur.fetchall()

        cur.close()
        conn.close()

        order["items"] = items

        return jsonify(order), 200

    except Exception as e:
        return jsonify({
            "error": "Erro ao buscar pedido",
            "details": str(e)
        }), 500
        
@app.route('/api/companies/<uuid:company_id>/admin/orders', methods=['GET'])
@require_auth
def get_admin_orders(company_id):
    try:
        orders = query_db(
            """
            SELECT id, customer_name, total_price, status, payment_method, payment_change, created_at 
            FROM orders 
            WHERE company_id = %s 
            ORDER BY created_at DESC;
            """,
            (str(company_id),)
        )
        return jsonify(orders), 200
    except Exception as e:
        return jsonify({"error": "Erro ao buscar pedidos do painel", "details": str(e)}), 500

@app.route('/api/orders/<uuid:order_id>/status', methods=['PUT'])
@require_auth
def update_order_status(order_id):
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({"error": "Status nao informado"}), 400
            
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE orders SET status = %s WHERE id = %s;",
            (new_status, str(order_id))
        )
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({"message": f"Status atualizado para {new_status} com sucesso"}), 200
    except Exception as e:
        if 'conn' in locals() and not conn.closed:
            conn.rollback()
            cur.close()
            conn.close()
        return jsonify({"error": "Erro ao atualizar status", "details": str(e)}), 500


@app.route('/api/companies/<uuid:company_id>/admin/products', methods=['POST'])
@require_roles('OWNER', 'MANAGER')
def admin_create_product(company_id):
    try:
        data = request.get_json()
        name = data.get('name')
        description = data.get('description', '')
        price = data.get('price')
        menu_id = data.get('menu_id')

        if not name or price is None:
            return jsonify({"error": "Nome e preco sao obrigatorios"}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            INSERT INTO products (company_id, menu_id, name, description, price)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (str(company_id), str(menu_id) if menu_id else None, name, description, float(price))
        )
        new_prod = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Produto criado com sucesso", "product_id": new_prod['id']}), 201
    except Exception as e:
        if 'conn' in locals() and not conn.closed:
            conn.rollback()
            cur.close()
            conn.close()
        return jsonify({"error": "Erro ao criar produto", "details": str(e)}), 500

@app.route('/api/admin/products/<uuid:product_id>', methods=['DELETE'])
@require_roles('OWNER', 'MANAGER')
def admin_delete_product(product_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM products WHERE id = %s;", (str(product_id),))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Produto removido com sucesso"}), 200
    except Exception as e:
        if 'conn' in locals() and not conn.closed:
            conn.rollback()
            cur.close()
            conn.close()
        return jsonify({"error": "Erro ao deletar produto", "details": str(e)}), 500

@app.route('/api/companies/<uuid:company_id>/admin/menus', methods=['POST'])
@require_roles('OWNER', 'MANAGER')
def admin_create_menu(company_id):
    try:
        data = request.get_json()
        name = data.get('name')

        if not name:
            return jsonify({"error": "Nome e obrigatorio"}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            INSERT INTO menus (company_id, name)
            VALUES (%s, %s)
            RETURNING id;
            """,
            (str(company_id), name)
        )
        new_menu = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Categoria criada com sucesso", "menu_id": new_menu['id']}), 201
    except Exception as e:
        if 'conn' in locals() and not conn.closed:
            conn.rollback()
            cur.close()
            conn.close()
        return jsonify({"error": "Erro ao criar categoria", "details": str(e)}), 500

@app.route('/api/admin/menus/<uuid:menu_id>', methods=['DELETE'])
@require_roles('OWNER', 'MANAGER')
def admin_delete_menu(menu_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM menus WHERE id = %s;", (str(menu_id),))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Categoria removida com sucesso"}), 200
    except Exception as e:
        if 'conn' in locals() and not conn.closed:
            conn.rollback()
            cur.close()
            conn.close()
        return jsonify({"error": "Erro ao deletar categoria", "details": str(e)}), 500

VALID_ROLES = ('OWNER', 'MANAGER', 'WAITER', 'CASHIER', 'KITCHEN', 'COURIER')

@app.route('/api/companies/<uuid:company_id>/admin/users', methods=['GET'])
@require_roles('OWNER', 'MANAGER')
def admin_list_users(company_id):
    try:
        users = query_db(
            "SELECT id, name, email, role, active, created_at FROM users WHERE company_id = %s ORDER BY created_at DESC;",
            (str(company_id),)
        )
        return jsonify(users), 200
    except Exception as e:
        return error_response("Erro ao buscar usuarios", e)

@app.route('/api/companies/<uuid:company_id>/admin/users', methods=['POST'])
@require_roles('OWNER')
def admin_create_user(company_id):
    try:
        data = request.get_json()
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        role = data.get('role') or ''

        if not name or not email or not password or role not in VALID_ROLES:
            return jsonify({"error": "Nome, email, senha e cargo valido sao obrigatorios"}), 400
        if len(password) < 8:
            return jsonify({"error": "Senha deve ter pelo menos 8 caracteres"}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(
                """
                INSERT INTO users (company_id, name, email, password_hash, role)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (str(company_id), name, email, generate_password_hash(password), role)
            )
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": "Ja existe um usuario com este email"}), 409

        new_user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Usuario criado com sucesso", "user_id": new_user['id']}), 201
    except Exception as e:
        if 'conn' in locals() and not conn.closed:
            conn.rollback()
            cur.close()
            conn.close()
        return error_response("Erro ao criar usuario", e)

@app.route('/api/admin/users/<uuid:user_id>/deactivate', methods=['PUT'])
@require_roles('OWNER')
def admin_deactivate_user(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE users SET active = FALSE WHERE id = %s;", (str(user_id),))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Usuario desativado com sucesso"}), 200
    except Exception as e:
        if 'conn' in locals() and not conn.closed:
            conn.rollback()
            cur.close()
            conn.close()
        return error_response("Erro ao desativar usuario", e)

@app.route('/api/admin/users/<uuid:user_id>', methods=['DELETE'])
@require_roles('OWNER')
def admin_delete_user(user_id):
    try:
        if str(user_id) == request.user.get('user_id'):
            return jsonify({"error": "Voce nao pode apagar seu proprio usuario"}), 400

        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT role, active FROM users WHERE id = %s;", (str(user_id),))
        target = cur.fetchone()
        if not target:
            cur.close()
            conn.close()
            return jsonify({"error": "Usuario nao encontrado"}), 404

        if target['active']:
            cur.close()
            conn.close()
            return jsonify({"error": "Desative o usuario antes de apaga-lo"}), 400

        if target['role'] == 'OWNER':
            cur.execute("SELECT COUNT(*) AS total FROM users WHERE company_id = %s AND role = 'OWNER' AND active = TRUE;", (request.user.get('company_id'),))
            owner_count = cur.fetchone()['total']
            if owner_count <= 1:
                cur.close()
                conn.close()
                return jsonify({"error": "Nao e possivel apagar o unico OWNER do estabelecimento"}), 400

        cur.execute("DELETE FROM users WHERE id = %s;", (str(user_id),))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Usuario apagado com sucesso"}), 200
    except Exception as e:
        if 'conn' in locals() and not conn.closed:
            conn.rollback()
            cur.close()
            conn.close()
        return error_response("Erro ao apagar usuario", e)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)