"""Prova no PostgreSQL de verdade: a página pública lê o esquema real, separa um restaurante do outro e só põe no
sitemap quem o dono liberou.

Roda só com VEM_TEST_DATABASE_URL (fluxo .github/workflows/compliance.yml). Cada teste trabalha dentro de uma transação
desfeita no fim: o banco não fica sujo.
"""

import os
import unittest
from contextlib import contextmanager
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

URL = os.getenv("VEM_TEST_DATABASE_URL")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # pragma: no cover
    psycopg2 = None

if psycopg2 is not None:
    from flask import Flask

    import app as backend_app
    import public_page_routes as routes


@contextmanager
def env(**values):
    with patch.dict(os.environ, {}, clear=False):
        for name, value in values.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        yield


class _Conn:
    """A mesma conexão do teste, mas sem fechar nem confirmar: no fim tudo é desfeito."""

    def __init__(self, conn):
        self._conn = conn
        self.closed = False

    def cursor(self, cursor_factory=None):
        return self._conn.cursor(cursor_factory=cursor_factory)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


@unittest.skipUnless(URL and psycopg2, "defina VEM_TEST_DATABASE_URL para rodar os testes de banco")
class PublicPageDbTests(unittest.TestCase):
    def setUp(self):
        self.conn = psycopg2.connect(URL)
        self.cur = self.conn.cursor(cursor_factory=RealDictCursor)
        self.n = 0

        def query_db(sql, args=(), one=False):
            cur = self.conn.cursor(cursor_factory=RealDictCursor)
            try:
                cur.execute(sql, args)
                rows = cur.fetchall() if cur.description else None
            finally:
                cur.close()
            if rows:
                return rows[0] if one else rows
            return None if one else []

        self.query_db = query_db
        # as consultas do app (horário, plano) também passam pela transação do teste
        patcher = patch.object(backend_app, "query_db", query_db)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.app = Flask(__name__)
        routes.register(
            self.app,
            query_db=query_db,
            get_db_connection=lambda: _Conn(self.conn),
            public_company=backend_app.public_company,
            accepts_orders=backend_app.company_accepts_orders,
            require_roles=backend_app.require_roles,
        )
        self.client = self.app.test_client()

        opener = env(PUBLIC_PAGE_OPEN="1", PUBLIC_PAGE_INDEX="1", PUBLIC_BASE_URL="https://vem.example.com")
        opener.__enter__()
        self.addCleanup(opener.__exit__, None, None, None)

    def tearDown(self):
        self.conn.rollback()
        self.cur.close()
        self.conn.close()

    # ---- ajudantes

    def restaurante(self, nome="Pastelaria do Teste", listed=None):
        self.n += 1
        slug = f"teste-{os.getpid()}-{self.n}"
        if listed is None:
            self.cur.execute("INSERT INTO companies (name, slug) VALUES (%s, %s) RETURNING id", (nome, slug))
        else:
            self.cur.execute(
                "INSERT INTO companies (name, slug, public_page_listed) VALUES (%s, %s, %s) RETURNING id", (nome, slug, listed)
            )
        return str(self.cur.fetchone()["id"]), slug

    def categoria(self, company_id, nome, active=True):
        self.cur.execute("INSERT INTO menus (company_id, name, active) VALUES (%s, %s, %s) RETURNING id", (company_id, nome, active))
        return str(self.cur.fetchone()["id"])

    def prato(self, company_id, nome, preco="9.00", menu_id=None, esgotado=False, descricao=None, sub=None):
        self.cur.execute(
            "INSERT INTO products (company_id, menu_id, name, description, price, sold_out, subcategory) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (company_id, menu_id, nome, descricao, preco, esgotado, sub),
        )
        return str(self.cur.fetchone()["id"])

    def get(self, slug, query=""):
        response = self.client.get(f"/r/{slug}{query}")
        return response, response.get_data(as_text=True)

    # ---- a página

    def test_a_new_restaurant_is_not_listed_by_default(self):
        company_id, slug = self.restaurante()
        self.cur.execute("SELECT public_page_listed FROM companies WHERE id = %s", (company_id,))
        self.assertIs(self.cur.fetchone()["public_page_listed"], False)

    def test_the_page_shows_the_menu_in_the_order_the_app_shows_it(self):
        company_id, slug = self.restaurante("Pastelaria do Zé", listed=True)
        pasteis = self.categoria(company_id, "Pastéis")
        bebidas = self.categoria(company_id, "Bebidas")
        self.prato(company_id, "Pastel de carne", "9.00", pasteis, descricao="Carne e ovo.", sub="Tradicionais")
        self.prato(company_id, "Caldo de cana", "6.50", bebidas)
        self.prato(company_id, "Brigadeiro", "3.00")
        response, body = self.get(slug)
        self.assertEqual(response.status_code, 200)
        self.assertLess(body.index("Pastéis"), body.index("Bebidas"))
        self.assertLess(body.index("Bebidas"), body.index("Outros"))
        for text in ("Pastel de carne", "R$ 9,00", "R$ 6,50", "Tradicionais", "Carne e ovo.", "Brigadeiro"):
            self.assertIn(text, body)
        self.assertNotIn("X-Robots-Tag", response.headers)

    def test_one_restaurant_never_shows_another_ones_dishes(self):
        a_id, a_slug = self.restaurante("Casa A", listed=True)
        b_id, b_slug = self.restaurante("Casa B", listed=True)
        self.prato(a_id, "Prato exclusivo da A")
        self.prato(b_id, "Prato exclusivo da B")
        _, body_a = self.get(a_slug)
        _, body_b = self.get(b_slug)
        self.assertIn("Prato exclusivo da A", body_a)
        self.assertNotIn("Prato exclusivo da B", body_a)
        self.assertIn("Prato exclusivo da B", body_b)
        self.assertNotIn("Prato exclusivo da A", body_b)

    def test_sold_out_is_shown_and_a_turned_off_category_is_hidden(self):
        company_id, slug = self.restaurante(listed=True)
        ligada = self.categoria(company_id, "Ligada")
        desligada = self.categoria(company_id, "Desligada", active=False)
        self.prato(company_id, "Acabou", "5.00", ligada, esgotado=True)
        self.prato(company_id, "Escondido", "5.00", desligada)
        _, body = self.get(slug)
        self.assertIn("Acabou", body)
        self.assertIn("Esgotado", body)
        self.assertNotIn("Escondido", body)
        self.assertNotIn("Desligada", body)

    def test_text_the_owner_typed_is_escaped_after_a_round_trip_through_the_database(self):
        company_id, slug = self.restaurante('<b onmouseover="x">Casa</b>', listed=True)
        self.prato(company_id, "<script>alert(1)</script>", descricao="<img src=x onerror=alert(2)>")
        _, body = self.get(slug)
        self.assertNotIn("<script>alert(1)", body)
        self.assertNotIn("<img src=x", body)
        self.assertNotIn("<b onmouseover", body)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", body)

    def test_the_hours_status_comes_from_the_real_hours_table(self):
        company_id, slug = self.restaurante(listed=True)
        self.prato(company_id, "Pastel")
        self.cur.execute("UPDATE companies SET orders_paused = TRUE WHERE id = %s", (company_id,))
        _, body = self.get(slug)
        self.assertIn("pausa nos pedidos", body)
        self.assertIn('content="noindex,nofollow"', body)

    def test_without_the_owners_yes_the_page_works_but_is_not_for_google(self):
        company_id, slug = self.restaurante(listed=False)
        self.prato(company_id, "Pastel")
        response, body = self.get(slug)
        self.assertEqual(response.status_code, 200)
        self.assertIn("noindex", response.headers["X-Robots-Tag"])

    def test_the_preview_image_and_the_qr_come_out_for_a_real_restaurant(self):
        company_id, slug = self.restaurante("Açaí da Maria", listed=True)
        self.prato(company_id, "Açaí 300 ml")
        preview = self.client.get(f"/r/{slug}/previa.jpg")
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.content_type, "image/jpeg")
        qr = self.client.get(f"/r/{slug}/qr.png")
        self.assertEqual(qr.status_code, 200)
        self.assertTrue(qr.data.startswith(b"\x89PNG"))

    # ---- o sitemap

    def test_the_sitemap_lists_only_who_said_yes_and_has_dishes(self):
        yes_id, yes_slug = self.restaurante("Sim", listed=True)
        no_id, no_slug = self.restaurante("Não", listed=False)
        empty_id, empty_slug = self.restaurante("Sem prato", listed=True)
        self.prato(yes_id, "Pastel")
        self.prato(no_id, "Pastel")
        body = self.client.get("/sitemap.xml").get_data(as_text=True)
        self.assertIn(f"/r/{yes_slug}<", body)
        self.assertNotIn(f"/r/{no_slug}<", body)
        self.assertNotIn(f"/r/{empty_slug}<", body)

    # ---- a escolha do dono

    def test_the_owner_turns_the_google_choice_on_and_off(self):
        company_id, slug = self.restaurante()
        token = backend_app.serializer.dumps({"user_id": "u", "company_id": company_id, "role": "OWNER"})
        headers = {"Authorization": f"Bearer {token}"}
        got = self.client.get("/api/admin/public-page", headers=headers).get_json()
        self.assertIs(got["listed"], False)
        self.assertEqual(got["page_url"], f"https://vem.example.com/r/{slug}")
        saved = self.client.put("/api/admin/public-page", json={"listed": True}, headers=headers)
        self.assertEqual(saved.status_code, 200)
        self.cur.execute("SELECT public_page_listed FROM companies WHERE id = %s", (company_id,))
        self.assertIs(self.cur.fetchone()["public_page_listed"], True)
        self.client.put("/api/admin/public-page", json={"listed": False}, headers=headers)
        self.cur.execute("SELECT public_page_listed FROM companies WHERE id = %s", (company_id,))
        self.assertIs(self.cur.fetchone()["public_page_listed"], False)

    def test_an_owner_cannot_change_another_restaurants_choice(self):
        mine_id, mine_slug = self.restaurante("Minha")
        other_id, other_slug = self.restaurante("Outra")
        token = backend_app.serializer.dumps({"user_id": "u", "company_id": mine_id, "role": "OWNER"})
        self.client.put("/api/admin/public-page", json={"listed": True}, headers={"Authorization": f"Bearer {token}"})
        self.cur.execute("SELECT public_page_listed FROM companies WHERE id = %s", (other_id,))
        self.assertIs(self.cur.fetchone()["public_page_listed"], False)


if __name__ == "__main__":
    unittest.main()
