import os
import unittest
from decimal import Decimal
from unittest.mock import patch

import psycopg2

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
PRODUCT_ID = "aaaaaaaa-0000-4000-8000-000000000001"
JUICE_ID = "aaaaaaaa-0000-4000-8000-000000000002"
CHICKEN_ID = "bbbbbbbb-0000-4000-8000-000000000001"
POTATO_ID = "bbbbbbbb-0000-4000-8000-000000000002"

BASE = f"/api/companies/{COMPANY_ID}/admin"


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


class ScriptedCursor:
    """Responde cada SQL pelo primeiro trecho do roteiro que aparece nele (e gasta esse trecho)."""

    def __init__(self, script):
        self.script = list(script)
        self.executed = []
        self._last = None

    def execute(self, sql, params=None):
        flat = " ".join(sql.split())
        self.executed.append((flat, params))
        for index, (needle, result) in enumerate(self.script):
            if needle in flat:
                self.script.pop(index)
                if isinstance(result, Exception):
                    raise result
                self._last = result
                return
        self._last = None

    def fetchone(self):
        if isinstance(self._last, list):
            return self._last[0] if self._last else None
        return self._last

    def fetchall(self):
        if self._last is None:
            return []
        return self._last if isinstance(self._last, list) else [self._last]

    def close(self):
        pass


class FakeConnection:
    def __init__(self, script=()):
        self.cursor_obj = ScriptedCursor(script)
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def cursor(self, **kwargs):
        return self.cursor_obj

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True

    def sql(self):
        return [sql for sql, _ in self.cursor_obj.executed]


INGREDIENT_ROWS = [
    {"id": CHICKEN_ID, "name": "Frango", "unit": "g", "package_qty": Decimal("1000.000"), "package_price": Decimal("18.90")},
    {"id": POTATO_ID, "name": "Batata", "unit": "g", "package_qty": Decimal("2000.000"), "package_price": Decimal("12.00")},
]
PRODUCT_ROWS = [
    {"id": PRODUCT_ID, "name": "Frango com batata", "price": Decimal("25.00"), "menu_id": None,
     "portion": "1 pessoa", "extra_cost": Decimal("1.50")},
    {"id": JUICE_ID, "name": "Suco de laranja", "price": Decimal("8.00"), "menu_id": None,
     "portion": None, "extra_cost": Decimal("0.00")},
]
LINE_ROWS = [
    {"product_id": PRODUCT_ID, "ingredient_id": CHICKEN_ID, "quantity": Decimal("250.000")},
    {"product_id": PRODUCT_ID, "ingredient_id": POTATO_ID, "quantity": Decimal("200.000")},
]
SOLD_ROWS = [
    {"quantity": 2, "unit_price": Decimal("25.00"), "unit_cost": Decimal("7.43")},
    {"quantity": 1, "unit_price": Decimal("8.00"), "unit_cost": None},
]


def fake_query(company=None, missing_company=False):
    calls = []

    def run(sql, args=(), one=False):
        calls.append((" ".join(sql.split()), args))
        if "FROM companies" in sql:
            return None if missing_company else (company or {"cmv_target": 35})
        if "FROM ingredients" in sql:
            return INGREDIENT_ROWS
        if "FROM product_ingredients" in sql:
            return LINE_ROWS
        if "FROM order_items" in sql:
            return SOLD_ROWS
        if "FROM products" in sql:
            return PRODUCT_ROWS
        raise AssertionError("SQL inesperado: " + sql)

    run.calls = calls
    return run


class CostsViewTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def test_requires_login_owner_or_manager_and_same_company(self):
        self.assertEqual(self.client.get(f"{BASE}/costs").status_code, 401)
        self.assertEqual(self.client.get(f"{BASE}/costs", headers=auth("WAITER")).status_code, 403)
        self.assertEqual(self.client.get(f"{BASE}/costs", headers=auth("CASHIER")).status_code, 403)
        self.assertEqual(
            self.client.get(f"{BASE}/costs", headers=auth(company_id=OTHER_COMPANY_ID)).status_code, 403
        )

    def test_view_has_cost_cmv_status_and_period(self):
        query = fake_query()
        with patch.object(backend_app, "query_db", side_effect=query):
            response = self.client.get(f"{BASE}/costs", headers=auth("MANAGER"))

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["target"], 35)
        dish = next(p for p in body["products"] if p["id"] == PRODUCT_ID)
        self.assertEqual(dish["cost"], 7.43)          # 4,725 + 1,20 + 1,50
        self.assertEqual(dish["cmv"], 29.7)
        self.assertEqual(dish["status"], "ok")
        self.assertEqual(dish["margin"], 17.57)
        self.assertEqual(dish["portion"], "1 pessoa")
        self.assertEqual(len(dish["recipe"]), 2)
        juice = next(p for p in body["products"] if p["id"] == JUICE_ID)
        self.assertIsNone(juice["cost"])
        self.assertEqual(juice["status"], "sem_custo")
        self.assertEqual(body["with_cost"], 1)
        chicken = next(i for i in body["ingredients"] if i["id"] == CHICKEN_ID)
        self.assertEqual(chicken["used_in"], 1)
        self.assertEqual(chicken["unit_cost"], 0.0189)
        self.assertEqual(body["period"]["cmv"], 29.7)
        self.assertEqual(body["period"]["coverage"], 86)
        # Toda consulta e presa ao restaurante do login.
        for sql, args in query.calls:
            self.assertEqual(args[0], COMPANY_ID, sql)

    def test_cost_is_never_in_the_public_product_list(self):
        with patch.object(backend_app, "query_db", return_value=[]) as query_db:
            self.client.get(f"/api/companies/{COMPANY_ID}/products")
        for call in query_db.call_args_list:
            self.assertNotIn("ingredients", call.args[0])
            self.assertNotIn("extra_cost", call.args[0])

    def test_unknown_company(self):
        with patch.object(backend_app, "query_db", side_effect=fake_query(missing_company=True)):
            response = self.client.get(f"{BASE}/costs", headers=auth())
        self.assertEqual(response.status_code, 404)


class TargetTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def test_rejects_out_of_range(self):
        response = self.client.put(f"{BASE}/costs/target", json={"target": 3}, headers=auth())
        self.assertEqual(response.status_code, 400)

    def test_saves(self):
        conn = FakeConnection([("UPDATE companies", {"cmv_target": 30})])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.put(f"{BASE}/costs/target", json={"target": "30"}, headers=auth())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["target"], 30)
        self.assertTrue(conn.committed)
        self.assertEqual(conn.cursor_obj.executed[0][1], (30, COMPANY_ID))


class IngredientTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def test_create_converts_to_stored_unit(self):
        conn = FakeConnection([("INSERT INTO ingredients", {"id": CHICKEN_ID})])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.post(
                f"{BASE}/ingredients",
                json={"name": " Frango ", "quantity": "1", "unit": "kg", "price": "18,90"},
                headers=auth(),
            )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(conn.committed)
        _, params = conn.cursor_obj.executed[0]
        self.assertEqual(params, (COMPANY_ID, "Frango", "g", Decimal("1000.000"), Decimal("18.90")))

    def test_create_rejects_bad_input_without_touching_the_database(self):
        for body in (
            {"name": "", "quantity": 1, "unit": "kg", "price": 10},
            {"name": "Frango", "quantity": 0, "unit": "kg", "price": 10},
            {"name": "Frango", "quantity": 1, "unit": "xicara", "price": 10},
            {"name": "Frango", "quantity": 1, "unit": "kg", "price": "abc"},
        ):
            with patch.object(backend_app, "get_db_connection") as connect:
                response = self.client.post(f"{BASE}/ingredients", json=body, headers=auth())
            self.assertEqual(response.status_code, 400, body)
            connect.assert_not_called()

    def test_duplicate_name(self):
        conn = FakeConnection([("INSERT INTO ingredients", psycopg2.errors.UniqueViolation("duplicado"))])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.post(
                f"{BASE}/ingredients",
                json={"name": "Frango", "quantity": 1, "unit": "kg", "price": 10},
                headers=auth(),
            )
        self.assertEqual(response.status_code, 409)
        self.assertTrue(conn.rolled_back)

    def test_update_not_found(self):
        conn = FakeConnection([("FROM ingredients", None)])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.put(
                f"{BASE}/ingredients/{CHICKEN_ID}",
                json={"name": "Frango", "quantity": 1, "unit": "kg", "price": 20},
                headers=auth(),
            )
        self.assertEqual(response.status_code, 404)

    def test_update_refuses_to_change_unit_when_used(self):
        conn = FakeConnection([("FROM ingredients", {"unit": "g"}), ("FROM product_ingredients", {"n": 2})])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.put(
                f"{BASE}/ingredients/{CHICKEN_ID}",
                json={"name": "Frango", "quantity": 1, "unit": "L", "price": 20},
                headers=auth(),
            )
        self.assertEqual(response.status_code, 409)
        self.assertFalse(conn.committed)
        self.assertFalse(any(sql.startswith("UPDATE ingredients") for sql in conn.sql()))

    def test_update_new_price(self):
        conn = FakeConnection([("FROM ingredients", {"unit": "g"})])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.put(
                f"{BASE}/ingredients/{CHICKEN_ID}",
                json={"name": "Frango", "quantity": "1", "unit": "kg", "price": "21,50"},
                headers=auth("MANAGER"),
            )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(conn.committed)
        update = next(item for item in conn.cursor_obj.executed if item[0].startswith("UPDATE ingredients"))
        self.assertEqual(update[1], ("Frango", "g", Decimal("1000.000"), Decimal("21.50"), CHICKEN_ID, COMPANY_ID))
        self.assertIn("AND company_id = %s", update[0])

    def test_delete(self):
        conn = FakeConnection([("DELETE FROM ingredients", None)])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            missing = self.client.delete(f"{BASE}/ingredients/{CHICKEN_ID}", headers=auth())
        self.assertEqual(missing.status_code, 404)

        conn = FakeConnection([("DELETE FROM ingredients", {"id": CHICKEN_ID})])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.delete(f"{BASE}/ingredients/{CHICKEN_ID}", headers=auth())
        self.assertEqual(response.status_code, 200)
        self.assertTrue(conn.committed)
        self.assertEqual(conn.cursor_obj.executed[0][1], (CHICKEN_ID, COMPANY_ID))

    def test_kitchen_cannot_change_ingredients(self):
        response = self.client.post(
            f"{BASE}/ingredients",
            json={"name": "Frango", "quantity": 1, "unit": "kg", "price": 10},
            headers=auth("KITCHEN"),
        )
        self.assertEqual(response.status_code, 403)


class RecipeTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.route = f"{BASE}/products/{PRODUCT_ID}/recipe"
        self.body = {
            "portion": "1 pessoa",
            "extra_cost": "1,50",
            "items": [
                {"ingredient_id": CHICKEN_ID, "quantity": "250", "unit": "g"},
                {"ingredient_id": POTATO_ID, "quantity": "0,2", "unit": "kg"},
            ],
        }

    def test_bad_extra_cost(self):
        body = dict(self.body, extra_cost="-1")
        with patch.object(backend_app, "get_db_connection") as connect:
            response = self.client.put(self.route, json=body, headers=auth())
        self.assertEqual(response.status_code, 400)
        connect.assert_not_called()

    def test_product_of_another_restaurant_is_not_found(self):
        conn = FakeConnection([("FROM products p", None)])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.put(self.route, json=self.body, headers=auth())
        self.assertEqual(response.status_code, 404)
        self.assertIn("AND p.company_id = %s", conn.sql()[0])

    def test_ingredient_of_another_restaurant_is_refused(self):
        conn = FakeConnection([
            ("FROM products p", {"id": PRODUCT_ID, "price": Decimal("25.00"), "cmv_target": 35}),
            ("FROM ingredients", [INGREDIENT_ROWS[0]]),  # so o frango e deste restaurante
        ])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.put(self.route, json=self.body, headers=auth())
        self.assertEqual(response.status_code, 400)
        self.assertFalse(conn.committed)
        self.assertFalse(any("DELETE FROM product_ingredients" in sql for sql in conn.sql()))

    def test_saves_recipe_and_returns_the_cost(self):
        conn = FakeConnection([
            ("FROM products p", {"id": PRODUCT_ID, "price": Decimal("25.00"), "cmv_target": 35}),
            ("FROM ingredients", INGREDIENT_ROWS),
        ])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.put(self.route, json=self.body, headers=auth())

        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual(body["cost"], 7.43)
        self.assertEqual(body["cmv"], 29.7)
        self.assertEqual(body["status"], "ok")
        self.assertTrue(conn.committed)

        executed = conn.cursor_obj.executed
        ingredient_query = next(item for item in executed if "FROM ingredients" in item[0])
        self.assertEqual(ingredient_query[1][0], COMPANY_ID)
        inserts = [params for sql, params in executed if sql.startswith("INSERT INTO product_ingredients")]
        self.assertEqual(
            sorted(inserts),
            sorted([
                (PRODUCT_ID, CHICKEN_ID, Decimal("250.000")),
                (PRODUCT_ID, POTATO_ID, Decimal("200.000")),
            ]),
        )
        update = next(params for sql, params in executed if sql.startswith("UPDATE products"))
        self.assertEqual(update, ("1 pessoa", Decimal("1.50"), PRODUCT_ID, COMPANY_ID))

    def test_empty_recipe_clears_it(self):
        conn = FakeConnection([("FROM products p", {"id": PRODUCT_ID, "price": Decimal("25.00"), "cmv_target": 35})])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            response = self.client.put(self.route, json={"items": []}, headers=auth())
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()["cost"])
        self.assertEqual(response.get_json()["status"], "sem_custo")
        self.assertTrue(any("DELETE FROM product_ingredients" in sql for sql in conn.sql()))


class OrderUnitCostTests(unittest.TestCase):
    def test_costs_per_product(self):
        cursor = ScriptedCursor([
            ("FROM products p", [
                {"product_id": PRODUCT_ID, "extra_cost": Decimal("1.50"), "quantity": Decimal("250"),
                 "package_qty": Decimal("1000"), "package_price": Decimal("18.90")},
                {"product_id": PRODUCT_ID, "extra_cost": Decimal("1.50"), "quantity": Decimal("200"),
                 "package_qty": Decimal("2000"), "package_price": Decimal("12.00")},
                {"product_id": JUICE_ID, "extra_cost": Decimal("0"), "quantity": None,
                 "package_qty": None, "package_price": None},
            ]),
        ])
        costs = backend_app.order_unit_costs(cursor, COMPANY_ID, [PRODUCT_ID, JUICE_ID, PRODUCT_ID])
        self.assertEqual(costs[PRODUCT_ID], Decimal("7.43"))
        self.assertIsNone(costs[JUICE_ID])
        self.assertEqual(cursor.executed[0][0], "SAVEPOINT unit_costs;")
        self.assertEqual(cursor.executed[1][1], (COMPANY_ID, sorted([PRODUCT_ID, JUICE_ID])))

    def test_failure_never_blocks_the_order(self):
        cursor = ScriptedCursor([("FROM products p", RuntimeError("coluna nao existe"))])
        self.assertEqual(backend_app.order_unit_costs(cursor, COMPANY_ID, [PRODUCT_ID]), {})
        self.assertIn("ROLLBACK TO SAVEPOINT unit_costs;", [sql for sql, _ in cursor.executed])


if __name__ == "__main__":
    unittest.main()
