from flask import Flask, jsonify, request
from flask_cors import CORS
from db import query_db

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

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
            "SELECT id, company_id, name, description, price FROM products WHERE company_id = %s;",
            (str(company_id),)
        )
        return jsonify(products), 200
    except Exception as e:
        return jsonify({"error": "Erro interno ao buscar produtos", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
