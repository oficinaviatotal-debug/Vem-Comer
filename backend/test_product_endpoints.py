"""Criar, mudar e apagar prato: quem pode, o que e conferido e o que nunca se perde."""

import os
import unittest
import uuid
from decimal import Decimal
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import product_fields  # noqa: E402

COMPANY = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY = "22222222-2222-4222-8222-222222222222"
LANCHES = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
BEBIDAS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
MENU_OF_OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
X_TUDO = "d0000000-0000-4000-8000-000000000001"
X_SALADA = "d0000000-0000-4000-8000-000000000002"
COCA = "d0000000-0000-4000-8000-000000000003"
DISH_OF_OTHER = "d0000000-0000-4000-8000-000000000009"
CREATE_URL = f"/api/companies/{COMPANY}/admin/products"


def auth(role="OWNER", company_id=COMPANY):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


class FakeDb:
    """Um restaurante pequeno na memoria. Entende so as consultas que estas rotas fazem."""

    def __init__(self):
        self.menus = {LANCHES: COMPANY, BEBIDAS: COMPANY, MENU_OF_OTHER: OTHER_COMPANY}
        self.products = {
            X_TUDO: self.dish(COMPANY, LANCHES, "X-tudo", "completo", "25.00"),
            X_SALADA: self.dish(COMPANY, LANCHES, "X-salada", "", "20.00"),
            COCA: self.dish(COMPANY, BEBIDAS, "Coca-Cola lata", "", "6.00"),
            DISH_OF_OTHER: self.dish(OTHER_COMPANY, MENU_OF_OTHER, "X-tudo", "", "30.00"),
        }
        self.ordered = set()
        self.log = []
        self.commits = 0
        self.rollbacks = 0
        self.closed = False
        self.opened = 0
        self._rows = []

    @staticmethod
    def dish(company, menu, name, description, price):
        return {"company_id": company, "menu_id": menu, "name": name, "description": description,
                "price": Decimal(price), "image_key": None}

    # --- a conexao ---------------------------------------------------------------------------
    def open(self):
        self.opened += 1
        return self

    def cursor(self, **kwargs):
        return self

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True

    # --- as consultas ------------------------------------------------------------------------
    def execute(self, sql, params=None):
        sql = " ".join(sql.split())
        self.log.append((sql, params))
        self._rows = []

        if sql.startswith("SELECT pg_advisory_xact_lock"):
            return
        if sql.startswith("SELECT id FROM menus"):
            menu_id, company_id = params
            if self.menus.get(menu_id) == company_id:
                self._rows = [{"id": menu_id}]
        elif sql.startswith("SELECT name FROM products"):
            company_id, menu_id, own, _same = params
            self._rows = [
                {"name": p["name"]} for pid, p in self.products.items()
                if p["company_id"] == company_id and p["menu_id"] == menu_id and pid != own
            ]
        elif sql.startswith("INSERT INTO products"):
            company_id, menu_id, name, description, price = params
            new_id = str(uuid.uuid4())
            self.products[new_id] = self.dish(company_id, menu_id, name, description, str(price))
            self._rows = [{"id": uuid.UUID(new_id)}]
        elif sql.startswith("SELECT id, menu_id, name, description, price FROM products"):
            pid, company_id = params
            p = self.products.get(pid)
            if p and p["company_id"] == company_id:
                self._rows = [{"id": pid, "menu_id": uuid.UUID(p["menu_id"]) if p["menu_id"] else None,
                               "name": p["name"], "description": p["description"], "price": p["price"]}]
        elif sql.startswith("UPDATE products SET name"):
            name, description, price, menu_id, pid, company_id = params
            p = self.products[pid]
            assert p["company_id"] == company_id
            p.update(name=name, description=description, price=Decimal(price), menu_id=menu_id)
            self._rows = [{"id": uuid.UUID(pid), "name": name, "description": description, "price": p["price"],
                           "menu_id": uuid.UUID(menu_id) if menu_id else None}]
        elif sql.startswith("SELECT image_key FROM products"):
            pid, company_id = params
            p = self.products.get(pid)
            if p and p["company_id"] == company_id:
                self._rows = [(p["image_key"],)]
        elif sql.startswith("SELECT 1 FROM order_items"):
            if params[0] in self.ordered:
                self._rows = [(1,)]
        elif sql.startswith("DELETE FROM products"):
            pid, company_id = params
            p = self.products.get(pid)
            if p and p["company_id"] == company_id:
                self._rows = [(p["image_key"],)]
                del self.products[pid]
        else:
            raise AssertionError(f"consulta inesperada: {sql}")

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)

    # --- para os testes ----------------------------------------------------------------------
    def ran(self, start):
        return [(sql, params) for sql, params in self.log if sql.startswith(start)]

    def names(self, company=COMPANY):
        return sorted(p["name"] for p in self.products.values() if p["company_id"] == company)


class Base(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.db = FakeDb()
        patcher = patch.object(backend_app, "get_db_connection", side_effect=self.db.open)
        patcher.start()
        self.addCleanup(patcher.stop)

    def create(self, role="OWNER", **body):
        return self.client.post(CREATE_URL, json=body, headers=auth(role))

    def change(self, product=X_TUDO, role="OWNER", company=COMPANY, **body):
        return self.client.put(f"/api/admin/products/{product}", json=body, headers=auth(role, company))


class CreateTests(Base):
    def test_creates_with_clean_text_and_a_real_price(self):
        reply = self.create(name="  Pastel   de  queijo ", price="R$ 8,5", description=" crocante\n", menu_id=BEBIDAS.upper())
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        (sql, params), = self.db.ran("INSERT INTO products")
        self.assertEqual(params, (COMPANY, BEBIDAS, "Pastel de queijo", "crocante", Decimal("8.50")))
        self.assertEqual(self.db.commits, 1)
        self.assertTrue(self.db.closed)

    def test_without_a_category_is_fine(self):
        reply = self.create(name="Pastel", price=8)
        self.assertEqual(reply.status_code, 201)
        (sql, params), = self.db.ran("INSERT INTO products")
        self.assertIsNone(params[1])

    def test_the_new_dish_belongs_to_the_restaurant_of_the_login_only(self):
        self.create(name="Pastel", price=8, company_id=OTHER_COMPANY)
        (sql, params), = self.db.ran("INSERT INTO products")
        self.assertEqual(params[0], COMPANY)
        reply = self.client.post(f"/api/companies/{OTHER_COMPANY}/admin/products", json={"name": "Pastel", "price": 8}, headers=auth())
        self.assertEqual(reply.status_code, 403)
        self.assertEqual(len(self.db.ran("INSERT INTO products")), 1)

    def test_a_bad_dish_never_reaches_the_database(self):
        bad = [
            {"price": 8}, {"name": "  ", "price": 8}, {"name": "Pastel"}, {"name": "Pastel", "price": 0},
            {"name": "Pastel", "price": -3}, {"name": "Pastel", "price": "muito"}, {"name": "Pastel", "price": 1e30},
            {"name": "a" * 151, "price": 8}, {"name": "Pastel", "price": 8, "description": 5},
            {"name": "Pastel", "price": 8, "menu_id": "lanches"},
        ]
        for body in bad:
            reply = self.client.post(CREATE_URL, json=body, headers=auth())
            self.assertEqual(reply.status_code, 400, body)
            self.assertIn("error", reply.get_json())
        self.assertEqual(self.db.opened, 0)

    def test_a_body_that_is_not_json_is_a_400_not_a_crash(self):
        for raw in ("{oops", "", "[1, 2]", "null"):
            reply = self.client.post(CREATE_URL, data=raw, content_type="application/json", headers=auth())
            self.assertEqual(reply.status_code, 400, raw)
        self.assertEqual(self.db.opened, 0)

    def test_a_category_of_another_restaurant_is_refused_and_the_connection_is_closed(self):
        reply = self.create(name="Pastel", price=8, menu_id=MENU_OF_OTHER)
        self.assertEqual(reply.status_code, 400)
        self.assertEqual(reply.get_json()["error"], product_fields.MENU_BAD)
        self.assertEqual(self.db.ran("INSERT INTO products"), [])
        self.assertTrue(self.db.closed, "a conexao ficava aberta quando a categoria era recusada")

    def test_a_category_that_does_not_exist_is_refused(self):
        reply = self.create(name="Pastel", price=8, menu_id="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
        self.assertEqual(reply.status_code, 400)

    def test_the_same_dish_in_the_same_category_is_refused_without_looking_at_accent_or_capital(self):
        for name in ("X-tudo", "x-TUDO", " X-tudo  "):
            reply = self.create(name=name, price=30, menu_id=LANCHES)
            self.assertEqual(reply.status_code, 409, name)
            self.assertEqual(reply.get_json()["error"], product_fields.TWICE)
        self.assertEqual(self.db.ran("INSERT INTO products"), [])
        self.assertTrue(self.db.closed)

    def test_the_same_name_in_another_category_or_another_restaurant_is_fine(self):
        self.assertEqual(self.create(name="X-tudo", price=30, menu_id=BEBIDAS).status_code, 201)
        self.assertEqual(self.create(name="X-tudo", price=30).status_code, 201)
        self.assertEqual(len(self.db.ran("INSERT INTO products")), 2)

    def test_a_second_try_after_a_lost_answer_is_not_a_duplicate(self):
        self.assertEqual(self.create(name="Pastel", price=8, menu_id=LANCHES).status_code, 201)
        again = self.create(name="Pastel", price=8, menu_id=LANCHES)
        self.assertEqual(again.status_code, 409)
        self.assertEqual(self.db.names().count("Pastel"), 1)

    def test_the_restaurant_is_locked_before_anything_is_read(self):
        self.create(name="Pastel", price=8)
        first_sql = self.db.log[0][0]
        self.assertTrue(first_sql.startswith("SELECT pg_advisory_xact_lock"), first_sql)
        self.assertEqual(self.db.log[0][1], (f"produtos:{COMPANY}",))

    def test_only_owner_and_manager(self):
        for role in ("WAITER", "KITCHEN", "CASHIER", "COURIER"):
            self.assertEqual(self.create(role, name="Pastel", price=8).status_code, 403, role)
        self.assertEqual(self.create("MANAGER", name="Pastel", price=8).status_code, 201)
        self.assertEqual(self.client.post(CREATE_URL, json={"name": "Pastel", "price": 8}).status_code, 401)


class ChangeTests(Base):
    def test_changing_only_the_price_keeps_everything_else(self):
        reply = self.change(price="27,5")
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        self.assertEqual(reply.get_json(), {"id": X_TUDO, "name": "X-tudo", "description": "completo", "price": "27.50", "menu_id": LANCHES})
        (sql, params), = self.db.ran("UPDATE products")
        self.assertEqual(params, ("X-tudo", "completo", Decimal("27.50"), LANCHES, X_TUDO, COMPANY))
        self.assertIn("AND company_id = %s", sql)
        self.assertEqual(self.db.commits, 1)
        self.assertTrue(self.db.closed)

    def test_changing_everything_at_once(self):
        reply = self.change(name=" X-tudo  especial ", description=" com ovo ", price=31, menu_id=BEBIDAS)
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        self.assertEqual(reply.get_json(), {"id": X_TUDO, "name": "X-tudo especial", "description": "com ovo", "price": "31.00", "menu_id": BEBIDAS})

    def test_taking_a_dish_out_of_its_category(self):
        reply = self.change(menu_id=None)
        self.assertEqual(reply.status_code, 200)
        self.assertIsNone(reply.get_json()["menu_id"])
        self.assertIsNone(self.db.products[X_TUDO]["menu_id"])

    def test_clearing_the_text(self):
        reply = self.change(description="")
        self.assertEqual(reply.get_json()["description"], "")

    def test_a_field_that_did_not_come_does_not_change(self):
        self.change(name="X-tudo grande")
        p = self.db.products[X_TUDO]
        self.assertEqual((p["description"], p["price"], p["menu_id"]), ("completo", Decimal("25.00"), LANCHES))

    def test_the_same_values_again_are_fine(self):
        self.assertEqual(self.change(name="X-tudo", price=25).status_code, 200)

    def test_a_dish_can_change_its_own_capital_letters(self):
        self.assertEqual(self.change(name="x-TUDO").status_code, 200)
        self.assertEqual(self.db.products[X_TUDO]["name"], "x-TUDO")

    def test_the_name_of_another_dish_in_the_same_category_is_refused(self):
        reply = self.change(name="x-salada")
        self.assertEqual(reply.status_code, 409)
        self.assertEqual(reply.get_json()["error"], product_fields.TWICE)
        self.assertEqual(self.db.ran("UPDATE products"), [])
        self.assertEqual(self.db.products[X_TUDO]["name"], "X-tudo")
        self.assertTrue(self.db.closed)

    def test_moving_into_a_category_that_already_has_that_name_is_refused(self):
        self.db.products[COCA]["name"] = "X-tudo"
        self.assertEqual(self.change(menu_id=BEBIDAS).status_code, 409)

    def test_the_name_of_a_dish_of_another_restaurant_or_category_is_fine(self):
        self.assertEqual(self.change(product=X_SALADA, name="Coca-Cola lata").status_code, 200)

    def test_changing_only_the_price_is_never_blocked_by_a_repeat_that_was_already_there(self):
        self.db.products[X_SALADA]["name"] = "X-tudo"
        reply = self.change(price=26)
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        self.assertEqual(self.db.ran("SELECT name FROM products"), [])

    def test_a_category_of_another_restaurant_is_refused(self):
        reply = self.change(menu_id=MENU_OF_OTHER)
        self.assertEqual(reply.status_code, 400)
        self.assertEqual(reply.get_json()["error"], product_fields.MENU_BAD)
        self.assertEqual(self.db.ran("UPDATE products"), [])

    def test_a_dish_of_another_restaurant_is_not_found_and_stays_as_it_was(self):
        reply = self.change(product=DISH_OF_OTHER, price=1)
        self.assertEqual(reply.status_code, 404)
        self.assertEqual(self.db.products[DISH_OF_OTHER]["price"], Decimal("30.00"))
        self.assertEqual(self.db.ran("UPDATE products"), [])
        self.assertEqual(self.db.commits, 0)

    def test_a_dish_that_does_not_exist_is_not_found(self):
        self.assertEqual(self.change(product="d0000000-0000-4000-8000-0000000000ff", price=1).status_code, 404)

    def test_nothing_to_change_is_a_400(self):
        for body in ({}, {"sold_out": True}, {"company_id": OTHER_COMPANY, "image_key": "x"}):
            reply = self.client.put(f"/api/admin/products/{X_TUDO}", json=body, headers=auth())
            self.assertEqual(reply.status_code, 400, body)
            self.assertEqual(reply.get_json()["error"], product_fields.NOTHING_TO_CHANGE)
        self.assertEqual(self.db.opened, 0)

    def test_what_the_tap_cannot_say_never_reaches_the_database(self):
        for body in ({"price": 0}, {"price": "x"}, {"name": ""}, {"name": "a" * 151}, {"description": 3}, {"menu_id": "x"}):
            reply = self.client.put(f"/api/admin/products/{X_TUDO}", json=body, headers=auth())
            self.assertEqual(reply.status_code, 400, body)
        for raw in ("{oops", "[]", "null"):
            reply = self.client.put(f"/api/admin/products/{X_TUDO}", data=raw, content_type="application/json", headers=auth())
            self.assertEqual(reply.status_code, 400, raw)
        self.assertEqual(self.db.opened, 0)

    def test_the_dish_cannot_be_moved_to_another_restaurant_or_have_its_flags_changed(self):
        self.change(price=26, company_id=OTHER_COMPANY, sold_out=True, image_key="x")
        p = self.db.products[X_TUDO]
        self.assertEqual(p["company_id"], COMPANY)
        self.assertIsNone(p["image_key"])
        (sql, params), = self.db.ran("UPDATE products")
        self.assertNotIn("sold_out", sql)
        self.assertNotIn("company_id =", sql.split("WHERE")[0])

    def test_the_restaurant_is_locked_and_the_dish_row_too(self):
        self.change(price=26)
        self.assertTrue(self.db.log[0][0].startswith("SELECT pg_advisory_xact_lock"))
        (sql, params), = self.db.ran("SELECT id, menu_id, name, description, price FROM products")
        self.assertTrue(sql.endswith("FOR UPDATE;"), sql)

    def test_only_owner_and_manager(self):
        for role in ("WAITER", "KITCHEN", "CASHIER", "COURIER"):
            self.assertEqual(self.change(role=role, price=26).status_code, 403, role)
        self.assertEqual(self.change(role="MANAGER", price=26).status_code, 200)
        self.assertEqual(self.client.put(f"/api/admin/products/{X_TUDO}", json={"price": 26}).status_code, 401)
        self.assertEqual(self.db.products[X_TUDO]["price"], Decimal("26.00"))

    def test_a_database_failure_is_a_plain_500_and_the_connection_is_closed(self):
        with patch.object(self.db, "execute", side_effect=RuntimeError("banco caiu")):
            reply = self.change(price=26)
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("banco caiu", reply.get_data(as_text=True))
        self.assertTrue(self.db.closed)


class DeleteTests(Base):
    def delete(self, product=X_TUDO, role="OWNER"):
        return self.client.delete(f"/api/admin/products/{product}", headers=auth(role))

    def test_a_dish_never_ordered_is_deleted(self):
        reply = self.delete()
        self.assertEqual(reply.status_code, 200)
        self.assertNotIn(X_TUDO, self.db.products)
        self.assertEqual(self.db.commits, 1)

    def test_a_dish_already_ordered_is_not_deleted_and_the_answer_says_what_to_do(self):
        self.db.ordered.add(X_TUDO)
        reply = self.delete()
        self.assertEqual(reply.status_code, 409)
        self.assertEqual(reply.get_json()["error"], product_fields.ORDERED)
        self.assertIn("Esgotou", reply.get_json()["error"])
        self.assertIn(X_TUDO, self.db.products)
        self.assertEqual(self.db.ran("DELETE FROM products"), [])
        self.assertEqual(self.db.commits, 0)
        self.assertTrue(self.db.closed)

    def test_the_dish_row_is_locked_before_looking_at_the_orders(self):
        self.delete()
        order = [sql.split(" WHERE")[0] for sql, _ in self.db.log]
        self.assertEqual(order[:3], ["SELECT image_key FROM products", "SELECT 1 FROM order_items", "DELETE FROM products"])
        self.assertTrue(self.db.log[0][0].endswith("FOR UPDATE;"))

    def test_a_dish_of_another_restaurant_is_not_found_and_stays(self):
        reply = self.delete(DISH_OF_OTHER)
        self.assertEqual(reply.status_code, 404)
        self.assertIn(DISH_OF_OTHER, self.db.products)
        self.assertEqual(self.db.ran("SELECT 1 FROM order_items"), [])

    def test_only_owner_and_manager(self):
        for role in ("WAITER", "KITCHEN", "CASHIER", "COURIER"):
            self.assertEqual(self.delete(role=role).status_code, 403, role)
        self.assertIn(X_TUDO, self.db.products)

    def test_the_orders_of_another_restaurant_do_not_matter_here(self):
        self.db.ordered.add(DISH_OF_OTHER)
        self.assertEqual(self.delete(X_SALADA).status_code, 200)


if __name__ == "__main__":
    unittest.main()
