from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="../frontend", static_url_path="")


@app.get("/")
def index():
    return send_from_directory("../frontend", "index.html")


@app.get("/api/menu")
def menu():
    return jsonify({
        "restaurant": "Restaurante Exemplo",
        "products": [
            {
                "id": 1,
                "name": "Hambúrguer",
                "price": 25.00
            },
            {
                "id": 2,
                "name": "Batata frita",
                "price": 12.00
            }
        ]
    })


@app.post("/api/feedback")
def feedback():
    data = request.get_json(silent=True) or {}

    print("Feedback recebido:", data)

    return jsonify({
        "success": True
    })


if __name__ == "__main__":
    app.run(debug=True)