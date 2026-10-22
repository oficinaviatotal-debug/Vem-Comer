"""Prova no PostgreSQL de verdade: criar, mudar e apagar prato com o SQL real e o esquema real.

Roda só com VEM_TEST_DATABASE_URL (fluxo .github/workflows/compliance.yml). As rotas fazem commit de
verdade, então cada teste cria o seu restaurante e o apaga no fim (as tabelas apagam em cascata).
"""

import os
import threading
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import product_fields  # noqa: E402

URL = os.getenv("VEM_TEST_DATABASE_URL")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # pragma: no cover
    psycopg2 = None


def auth(company_id, role="OWNER"):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": str(company_id), "role": role})
    return {"Authorization": f"Bearer {token}"}


@unittest.skipUnless(URL and psycopg2, "defina VEM_TEST_DATABASE_URL para rodar os testes de banco")
class ProductDbTests(unittest.TestCase):
    def setUp(self):
        self.admin = psycopg2.connect(URL)
        self.admin.autocommit = True
        self.cur = self.admin.cursor(cursor_factory=RealDictCursor)
        self.companies = []
        self.company, self.lanches, self.bebidas = self.restaurant("Cantina A")
        other, self.menu_of_other, _ = self.restaurant("Cantina B")
        self.other_company = other
        patcher = patch.object(backend_app, "get_db_connection", side_effect=lambda: psycopg2.connect(URL))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = backend_app.app.test_client()

    def tearDown(self):
        for company in self.companies:
            self.cur.execute("DELETE FROM companies WHERE id = %s", (company,))
        self.cur.close()
        self.admin.close()

    def restaurant(self, name):
        self.cur.execute(
            "INSERT INTO companies (name, slug) VALUES (%s, %s) RETURNING id",
            (name, f"prato-{os.getpid()}-{len(self.companies)}-{threading.get_ident()}"),
        )
        company = self.cur.fetchone()["id"]
        self.companies.append(company)
        ids = []
        for menu in ("Lanches", "Bebidas"):
            self.cur.execute("INSERT INTO menus (company_id, name) VALUES (%s, %s) RETURNING id", (company, menu))
            ids.append(str(self.cur.fetchone()["id"]))
        return str(company), ids[0], ids[1]

    def dish(self, product_id):
        self.cur.execute("SELECT name, description, price, menu_id FROM products WHERE id = %s", (product_id,))
        return self.cur.fetchone()

    def create(self, **body):
        return self.client.post(f"/api/companies/{self.company}/admin/products", json=body, headers=auth(self.company))

    def make(self, **body):
        body.setdefault("name", "X-tudo")
        body.setdefault("price", 25)
        body.setdefault("menu_id", self.lanches)
        reply = self.create(**body)
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        return str(reply.get_json()["product_id"])

    def order(self, product_id):
        """Um pedido de verdade com este prato, como o cliente faz."""
        self.cur.execute(
            "INSERT INTO orders (company_id, customer_name, customer, total_price, status, payment_method, order_type) "
            "VALUES (%s, 'Cliente', 'Cliente', 25, 'concluido', 'pix', 'mesa') RETURNING id",
            (self.company,),
        )
        order = self.cur.fetchone()["id"]
        self.cur.execute(
            "INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (%s, %s, 1, 25, 25)",
            (order, product_id),
        )
        return order

    # --- criar e mudar -------------------------------------------------------------------------
    def test_create_then_change_every_field(self):
        product = self.make(name="  x-tudo  ", price="R$ 25,5", description=" completo ")
        row = self.dish(product)
        self.assertEqual((row["name"], row["description"], str(row["price"]), str(row["menu_id"])), ("x-tudo", "completo", "25.50", self.lanches))

        reply = self.client.put(
            f"/api/admin/products/{product}",
            json={"name": "X-Tudo Especial", "price": "27,9", "description": "", "menu_id": self.bebidas},
            headers=auth(self.company),
        )
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        self.assertEqual(reply.get_json(), {"id": product, "name": "X-Tudo Especial", "description": "", "price": "27.90", "menu_id": self.bebidas})
        row = self.dish(product)
        self.assertEqual((row["name"], row["description"], str(row["price"]), str(row["menu_id"])), ("X-Tudo Especial", "", "27.90", self.bebidas))

    def test_taking_the_dish_out_of_its_category_and_changing_only_the_price(self):
        product = self.make()
        self.assertEqual(self.client.put(f"/api/admin/products/{product}", json={"menu_id": None}, headers=auth(self.company)).status_code, 200)
        self.assertIsNone(self.dish(product)["menu_id"])
        self.assertEqual(self.client.put(f"/api/admin/products/{product}", json={"price": 30}, headers=auth(self.company)).status_code, 200)
        row = self.dish(product)
        self.assertEqual((row["name"], str(row["price"]), row["menu_id"]), ("X-tudo", "30.00", None))

    def test_a_change_of_price_does_not_touch_the_price_of_orders_already_made(self):
        product = self.make()
        order = self.order(product)
        self.assertEqual(self.client.put(f"/api/admin/products/{product}", json={"price": 99}, headers=auth(self.company)).status_code, 200)
        self.cur.execute("SELECT unit_price, total FROM order_items WHERE order_id = %s", (order,))
        row = self.cur.fetchone()
        self.assertEqual((str(row["unit_price"]), str(row["total"])), ("25.00", "25.00"))

    def test_the_same_name_in_the_same_category_is_refused_with_accents_and_capitals_ignored(self):
        self.make(name="Pão de queijo")
        reply = self.create(name="PAO DE QUEIJO", price=5, menu_id=self.lanches)
        self.assertEqual(reply.status_code, 409)
        self.assertEqual(reply.get_json()["error"], product_fields.TWICE)
        self.assertEqual(self.create(name="PAO DE QUEIJO", price=5, menu_id=self.bebidas).status_code, 201)
        other = self.make(name="Coxinha")
        reply = self.client.put(f"/api/admin/products/{other}", json={"name": "pao de queijo"}, headers=auth(self.company))
        self.assertEqual(reply.status_code, 409)
        self.assertEqual(self.dish(other)["name"], "Coxinha")

    def test_a_dish_with_no_category_is_compared_with_the_others_with_no_category(self):
        self.assertEqual(self.create(name="Brinde", price=1).status_code, 201)
        self.assertEqual(self.create(name="brinde", price=1).status_code, 409)
        self.assertEqual(self.create(name="Brinde", price=1, menu_id=self.lanches).status_code, 201)

    def test_two_taps_at_the_same_time_make_one_dish(self):
        replies = []

        def tap():
            client = backend_app.app.test_client()
            replies.append(client.post(
                f"/api/companies/{self.company}/admin/products",
                json={"name": "Pastel", "price": 8, "menu_id": self.lanches},
                headers=auth(self.company),
            ).status_code)

        threads = [threading.Thread(target=tap) for _ in range(6)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(sorted(replies), [201, 409, 409, 409, 409, 409])
        self.cur.execute("SELECT count(*) AS n FROM products WHERE company_id = %s AND name = 'Pastel'", (self.company,))
        self.assertEqual(self.cur.fetchone()["n"], 1)

    def test_another_restaurant_cannot_touch_the_dish_or_use_the_category(self):
        product = self.make()
        mine = auth(self.other_company)
        self.assertEqual(self.client.put(f"/api/admin/products/{product}", json={"price": 1}, headers=mine).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/admin/products/{product}", headers=mine).status_code, 404)
        self.assertEqual(str(self.dish(product)["price"]), "25.00")
        reply = self.client.put(f"/api/admin/products/{product}", json={"menu_id": self.menu_of_other}, headers=auth(self.company))
        self.assertEqual(reply.status_code, 400)
        self.assertEqual(str(self.dish(product)["menu_id"]), self.lanches)
        self.assertEqual(self.create(name="Pastel", price=8, menu_id=self.menu_of_other).status_code, 400)

    def test_absurd_values_are_refused_before_the_database_chokes(self):
        product = self.make()
        for body in ({"price": 1e30}, {"price": "99999999999"}, {"name": "a" * 400}, {"menu_id": "não-é-id"}):
            reply = self.client.put(f"/api/admin/products/{product}", json=body, headers=auth(self.company))
            self.assertEqual(reply.status_code, 400, body)

    # --- apagar ---------------------------------------------------------------------------------
    def test_a_dish_that_was_ordered_cannot_be_deleted_and_the_order_keeps_its_item(self):
        product = self.make()
        order = self.order(product)
        reply = self.client.delete(f"/api/admin/products/{product}", headers=auth(self.company))
        self.assertEqual(reply.status_code, 409)
        self.assertEqual(reply.get_json()["error"], product_fields.ORDERED)
        self.assertIsNotNone(self.dish(product))
        self.cur.execute("SELECT count(*) AS n FROM order_items WHERE order_id = %s", (order,))
        self.assertEqual(self.cur.fetchone()["n"], 1)

    def test_the_cascade_that_made_this_necessary_is_still_in_the_schema(self):
        # Se um dia o esquema trocar o CASCADE por RESTRICT, a trava acima deixa de ser a unica defesa;
        # este teste avisa para rever as duas coisas juntas.
        self.cur.execute(
            "SELECT confdeltype FROM pg_constraint WHERE conname = 'order_items_product_id_fkey'"
        )
        self.assertEqual(self.cur.fetchone()["confdeltype"], "c")

    def test_a_dish_never_ordered_is_deleted(self):
        product = self.make()
        self.assertEqual(self.client.delete(f"/api/admin/products/{product}", headers=auth(self.company)).status_code, 200)
        self.assertIsNone(self.dish(product))

    def test_the_other_dishes_of_an_ordered_menu_can_still_be_deleted(self):
        ordered = self.make(name="Vendido")
        free = self.make(name="Nunca pedido")
        self.order(ordered)
        self.assertEqual(self.client.delete(f"/api/admin/products/{free}", headers=auth(self.company)).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/admin/products/{ordered}", headers=auth(self.company)).status_code, 409)


if __name__ == "__main__":
    unittest.main()
