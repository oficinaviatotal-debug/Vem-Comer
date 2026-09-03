from flask import Flask, jsonify, request
from flask_cors import CORS
from psycopg2.extras import RealDictCursor
from db import query_db, get_db_connection

app = Flask(__name__)

CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "service": "vem-comer-api"
    }), 200

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)