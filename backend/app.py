from flask import Flask, jsonify, request
from flask_cors import CORS
from db import query_db

app = Flask(__name__)
# Permite que o frontend React acesse a API sem erros de CORS
CORS(app)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Rota de validação operacional da API."""
    return jsonify({
        "status": "ok",
        "service": "vem-comer-api"
    }), 200

@app.route('/api/companies/<company_id>', methods=['GET'])
def get_company(company_id):
    """Busca os dados públicos de uma empresa específica (Multiempresa)."""
    try:
        # Consulta segura contra SQL Injection usando tupla de argumentos
        company = query_db(
            "SELECT id, name, slug, logo_url FROM companies WHERE id = %s;", 
            (company_id,), 
            one=True
        )
        
        if not company:
            return jsonify({"error": "Estabelecimento não encontrado"}), 404
            
        return jsonify(company), 200
    except Exception as e:
        return jsonify({"error": "Erro interno no servidor", "details": str(e)}), 500

if __name__ == '__main__':
    # Roda o servidor Flask na porta 5000 acessível pelo Codespaces
    app.run(host='0.0.0.0', port=5000)
