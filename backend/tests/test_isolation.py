import os
import uuid

import psycopg2
import pytest
from werkzeug.security import generate_password_hash

os.environ.setdefault("SECRET_KEY", "test-only-secret-for-isolation")
os.environ.setdefault("FLASK_DEBUG", "false")

if not os.getenv("DATABASE_URL"):
    pytest.skip("DATABASE_URL não definida para os testes de integração.", allow_module_level=True)

from app import app


@pytest.fixture()
def isolation_data():
    suffix = uuid.uuid4().hex[:12]
    company_a_slug = f"test-isolation-a-{suffix}"
    company_b_slug = f"test-isolation-b-{suffix}"
    email_a = f"a-{suffix}@example.invalid"
    email_b = f"b-{suffix}@example.invalid"
    test_password = uuid.uuid4().hex

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    try:
        cur.execute(
            """
            INSERT INTO vemcomer.companies (name, slug)
            VALUES (%s, %s)
            RETURNING id
            """,
            ("TEST Isolation A", company_a_slug),
        )
        company_a = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO vemcomer.companies (name, slug)
            VALUES (%s, %s)
            RETURNING id
            """,
            ("TEST Isolation B", company_b_slug),
        )
        company_b = cur.fetchone()[0]

        password_hash = generate_password_hash(test_password)

        cur.execute(
            """
            INSERT INTO vemcomer.users
                (company_id, name, email, password_hash, role)
            VALUES (%s, %s, %s, %s, 'OWNER')
            RETURNING id
            """,
            (company_a, "Isolation A", email_a, password_hash),
        )
        user_a = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO vemcomer.users
                (company_id, name, email, password_hash, role)
            VALUES (%s, %s, %s, %s, 'OWNER')
            RETURNING id
            """,
            (company_b, "Isolation B", email_b, password_hash),
        )
        user_b = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO vemcomer.products
                (company_id, name, price)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (company_a, "TEST A Product", 10.00),
        )
        product_a = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO vemcomer.products
                (company_id, name, price)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (company_b, "TEST B Product", 10.00),
        )
        product_b = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO vemcomer.orders
                (company_id, customer_name, status, total_price, payment_method)
            VALUES (%s, %s, 'PENDING_PAYMENT', %s, 'pix')
            RETURNING id
            """,
            (company_b, "TEST B Customer", 10.00),
        )
        order_b = cur.fetchone()[0]

        conn.commit()

        yield {
            "company_a": str(company_a),
            "company_b": str(company_b),
            "email_a": email_a,
            "email_b": email_b,
            "password": test_password,
            "user_a": str(user_a),
            "user_b": str(user_b),
            "product_a": str(product_a),
            "product_b": str(product_b),
            "order_b": str(order_b),
        }
    finally:
        conn.rollback()
        cur.close()
        conn.close()

        cleanup = psycopg2.connect(os.environ["DATABASE_URL"])
        cleanup_cur = cleanup.cursor()
        try:
            cleanup_cur.execute(
                """
                DELETE FROM vemcomer.orders
                WHERE company_id IN (%s, %s)
                """,
                (company_a, company_b),
            )
            cleanup_cur.execute(
                """
                DELETE FROM vemcomer.companies
                WHERE id IN (%s, %s)
                """,
                (company_a, company_b),
            )
            cleanup.commit()
        finally:
            cleanup_cur.close()
            cleanup.close()


def login(client, email, password):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.get_json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_01_a_can_access_a(isolation_data):
    with app.test_client() as client:
        token_a = login(client, isolation_data["email_a"], isolation_data["password"])
        response = client.get(
            f"/api/companies/{isolation_data['company_a']}/users",
            headers=auth(token_a),
        )
        assert response.status_code == 200
        assert any(
            row["id"] == isolation_data["user_a"]
            for row in response.get_json()
        )


def test_02_a_cannot_access_b_users(isolation_data):
    with app.test_client() as client:
        token_a = login(client, isolation_data["email_a"], isolation_data["password"])
        response = client.get(
            f"/api/companies/{isolation_data['company_b']}/users",
            headers=auth(token_a),
        )
        assert response.status_code == 403


def test_03_a_cannot_delete_b_product(isolation_data):
    with app.test_client() as client:
        token_a = login(client, isolation_data["email_a"], isolation_data["password"])
        response = client.delete(
            f"/api/admin/products/{isolation_data['product_b']}",
            headers=auth(token_a),
        )
        assert response.status_code == 404

        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT company_id FROM vemcomer.products WHERE id = %s",
                (isolation_data["product_b"],),
            )
            assert str(cur.fetchone()[0]) == isolation_data["company_b"]
        finally:
            cur.close()
            conn.close()


def test_04_a_cannot_update_b_order(isolation_data):
    with app.test_client() as client:
        token_a = login(client, isolation_data["email_a"], isolation_data["password"])
        response = client.put(
            f"/api/orders/{isolation_data['order_b']}/status",
            headers=auth(token_a),
            json={"status": "concluido"},
        )
        assert response.status_code == 404

        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT status FROM vemcomer.orders WHERE id = %s",
                (isolation_data["order_b"],),
            )
            assert cur.fetchone()[0] == "PENDING_PAYMENT"
        finally:
            cur.close()
            conn.close()


def test_05_b_can_access_b(isolation_data):
    with app.test_client() as client:
        token_b = login(client, isolation_data["email_b"], isolation_data["password"])
        response = client.get(
            f"/api/companies/{isolation_data['company_b']}/users",
            headers=auth(token_b),
        )
        assert response.status_code == 200
        assert any(
            row["id"] == isolation_data["user_b"]
            for row in response.get_json()
        )


def test_06_b_cannot_access_a_users(isolation_data):
    with app.test_client() as client:
        token_b = login(client, isolation_data["email_b"], isolation_data["password"])
        response = client.get(
            f"/api/companies/{isolation_data['company_a']}/users",
            headers=auth(token_b),
        )
        assert response.status_code == 403


def test_07_b_cannot_delete_a_product(isolation_data):
    with app.test_client() as client:
        token_b = login(client, isolation_data["email_b"], isolation_data["password"])
        response = client.delete(
            f"/api/admin/products/{isolation_data['product_a']}",
            headers=auth(token_b),
        )
        assert response.status_code == 404

        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT company_id FROM vemcomer.products WHERE id = %s",
                (isolation_data["product_a"],),
            )
            assert str(cur.fetchone()[0]) == isolation_data["company_a"]
        finally:
            cur.close()
            conn.close()
