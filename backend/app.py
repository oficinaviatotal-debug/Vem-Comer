from flask import Flask, jsonify, request
from db import get_connection

app = Flask(__name__)


@app.get("/api/health")
def health():
    with get_connection() as connection:
        connection.execute("SELECT 1")

    return jsonify({"status": "ok"})


@app.get("/api/menu/<slug>")
def menu(slug):
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                c.name AS category
            FROM products p
            JOIN companies company
                ON company.id = p.company_id
            LEFT JOIN categories c
                ON c.id = p.category_id
            WHERE company.slug = %s
              AND p.active = TRUE
            ORDER BY c.name, p.name
            """,
            (slug,)
        ).fetchall()

    return jsonify([
        {
            "id": str(row[0]),
            "name": row[1],
            "description": row[2],
            "price": float(row[3]),
            "category": row[4]
        }
        for row in rows
    ])


@app.post("/api/feedback")
def create_feedback():
    data = request.get_json(silent=True) or {}

    company_id = data.get("company_id")

    if not company_id:
        return jsonify({"error": "company_id é obrigatório"}), 400

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO feedback (
                company_id,
                order_id,
                food,
                service,
                delivery,
                comment
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                company_id,
                data.get("order_id"),
                data.get("food"),
                data.get("service"),
                data.get("delivery"),
                data.get("comment")
            )
        )

    return jsonify({"success": True}), 201


if __name__ == "__main__":
    app.run()