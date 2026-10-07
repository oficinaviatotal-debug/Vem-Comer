"""Rotas das opções por item: cardápio público, pedido com opções e observação, painel do dono.

Roda no CI (precisa do Flask); o banco é simulado por um cursor que responde pelo texto do SQL.
"""

import json
import os
import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
PRODUCT_ID = "33333333-3333-4333-8333-333333333333"
OTHER_PRODUCT_ID = "44444444-4444-4444-8444-444444444444"
ORDER_ID = "55555555-5555-4555-8555-555555555555"
GROUP_SIZE = "66666666-0000-4000-8000-000000000001"
GROUP_EXTRAS = "66666666-0000-4000-8000-000000000002"
SIZE_SMALL = "77777777-0000-4000-8000-000000000001"
SIZE_BIG = "77777777-0000-4000-8000-000000000002"
EXTRA_NINHO = "88888888-0000-4000-8000-000000000001"
EXTRA_OFF = "88888888-0000-4000-8000-000000000002"
FOREIGN_OPTION = "99999999-0000-4000-8000-000000000001"

ORDERS_URL = f"/api/companies/{COMPANY_ID}/orders"
PRODUCTS_URL = f"/api/companies/{COMPANY_ID}/products"
OPTIONS_URL = f"/api/admin/products/{PRODUCT_ID}/options"

OPTION_ROWS = [
    {"group_id": GROUP_SIZE, "group_name": "Tamanho", "min_choices": 1, "max_choices": 1,
     "item_id": SIZE_SMALL, "item_name": "300 ml", "price_delta": Decimal("0.00"), "item_active": True},
    {"group_id": GROUP_SIZE, "group_name": "Tamanho", "min_choices": 1, "max_choices": 1,
     "item_id": SIZE_BIG, "item_name": "500 ml", "price_delta": Decimal("6.00"), "item_active": True},
    {"group_id": GROUP_EXTRAS, "group_name": "Adicionais", "min_choices": 0, "max_choices": 2,
     "item_id": EXTRA_NINHO, "item_name": "Leite ninho", "price_delta": Decimal("3.00"), "item_active": True},
    {"group_id": GROUP_EXTRAS, "group_name": "Adicionais", "min_choices": 0, "max_choices": 2,
     "item_id": EXTRA_OFF, "item_name": "Granola", "price_delta": Decimal("1.00"), "item_active": False},
]


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


class FakeCursor:
    """Responde pelo texto do SQL e guarda tudo o que rodou."""

    def __init__(self, product=None, option_rows=OPTION_ROWS):
        self.product = product
        self.option_rows = option_rows
        self.executed = []
        self._last = ""
        self.closed = False

    def execute(self, sql, params=()):
        self.executed.append((" ".join(sql.split()), params))
        self._last = self.executed[-1][0]

    def fetchone(self):
        if "FROM products" in self._last:
            return self.product
        if "INSERT INTO orders" in self._last:
            return {"id": ORDER_ID}
        if "INSERT INTO option_groups" in self._last:
            return {"id": "aaaaaaaa-0000-4000-8000-00000000000%d" % len([s for s, _ in self.executed if "INSERT INTO option_groups" in s])}
        if "INSERT INTO option_items" in self._last:
            return {"id": "bbbbbbbb-0000-4000-8000-0000000000%02d" % len([s for s, _ in self.executed if "INSERT INTO option_items" in s])}
        return None

    def fetchall(self):
        if "FROM option_groups g" in self._last and "LEFT JOIN option_items" in self._last:
            return self.option_rows
        return []

    def close(self):
        self.closed = True

    def sql(self, needle):
        return [(s, p) for s, p in self.executed if needle in s]


class Base(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.conn = MagicMock()
        self.conn.closed = False
        self.cur = FakeCursor(product={"id": PRODUCT_ID, "price": Decimal("20.00")})
        self.conn.cursor.return_value = self.cur
        for target, value in (
            ("get_db_connection", self.conn),
        ):
            patcher = patch.object(backend_app, target, return_value=value)
            patcher.start()
            self.addCleanup(patcher.stop)
        costs = patch.object(backend_app, "order_unit_costs", return_value={})
        costs.start()
        self.addCleanup(costs.stop)


class PublicProductsTests(unittest.TestCase):
    def test_every_product_carries_its_option_groups_without_turned_off_options(self):
        client = backend_app.app.test_client()
        products = [
            {"id": PRODUCT_ID, "company_id": COMPANY_ID, "menu_id": None, "name": "Açaí", "description": "",
             "price": Decimal("20.00"), "image_key": None},
            {"id": OTHER_PRODUCT_ID, "company_id": COMPANY_ID, "menu_id": None, "name": "Água", "description": "",
             "price": Decimal("4.00"), "image_key": None},
        ]
        rows = [dict(row, product_id=PRODUCT_ID) for row in OPTION_ROWS]

        def fake(sql, params=(), one=False):
            return products if "FROM products" in sql else rows

        with patch.object(backend_app, "query_db", side_effect=fake):
            reply = client.get(PRODUCTS_URL)

        self.assertEqual(reply.status_code, 200)
        by_id = {p["id"]: p for p in reply.get_json()}
        groups = by_id[PRODUCT_ID]["option_groups"]
        self.assertEqual([g["name"] for g in groups], ["Tamanho", "Adicionais"])
        self.assertEqual([i["name"] for i in groups[1]["items"]], ["Leite ninho"])
        self.assertEqual(groups[0]["items"][1]["price_delta"], "6.00")
        self.assertEqual((groups[0]["min_choices"], groups[0]["max_choices"]), (1, 1))
        self.assertNotIn("active", groups[0]["items"][0])
        self.assertEqual(by_id[OTHER_PRODUCT_ID]["option_groups"], [])

    def test_option_query_is_scoped_to_the_company(self):
        calls = []

        def fake(sql, params=(), one=False):
            calls.append((sql, params))
            return []

        with patch.object(backend_app, "query_db", side_effect=fake):
            backend_app.app.test_client().get(PRODUCTS_URL)

        option_calls = [params for sql, params in calls if "option_groups" in sql]
        self.assertEqual(option_calls, [(COMPANY_ID,)])


class OrderWithOptionsTests(Base):
    def send(self, item, **extra):
        body = {"customer_name": "Ana", "payment_method": "pix", "items": [item]}
        body.update(extra)
        return self.client.post(ORDERS_URL, json=body)

    def item_insert(self):
        inserts = self.cur.sql("INSERT INTO order_items")
        self.assertEqual(len(inserts), 1)
        return inserts[0][1]

    def test_server_adds_the_options_to_the_price_and_keeps_a_copy(self):
        reply = self.send(
            {"id": PRODUCT_ID, "quantity": 2, "options": [SIZE_BIG, EXTRA_NINHO], "note": "  sem   leite condensado "}
        )
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))

        params = self.item_insert()
        # (order_id, product_id, quantity, unit_price, total, unit_cost, options, note)
        self.assertEqual(params[2], 2)
        self.assertEqual(params[3], Decimal("29.00"))
        self.assertEqual(params[4], Decimal("58.00"))
        self.assertEqual(
            json.loads(params[6]),
            [
                {"group": "Tamanho", "name": "500 ml", "price": "6.00"},
                {"group": "Adicionais", "name": "Leite ninho", "price": "3.00"},
            ],
        )
        self.assertEqual(params[7], "sem leite condensado")
        self.assertEqual(self.cur.sql("INSERT INTO orders")[0][1][2], Decimal("58.00"))
        self.assertEqual(self.cur.sql("INSERT INTO payments")[0][1][2], Decimal("58.00"))
        self.conn.commit.assert_called_once()

    def test_the_price_the_phone_sends_is_ignored(self):
        reply = self.send(
            {"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_BIG], "price": 0.01, "unit_price": 0.01, "total": 0.01}
        )
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(self.item_insert()[3], Decimal("26.00"))

    def test_item_without_a_note_stores_nothing_for_it(self):
        self.send({"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_SMALL]})
        params = self.item_insert()
        self.assertIsNone(params[7])
        self.assertEqual(params[3], Decimal("20.00"))

    def test_product_without_option_groups_still_sells_at_the_base_price(self):
        self.cur.option_rows = []
        reply = self.send({"id": PRODUCT_ID, "quantity": 3})
        self.assertEqual(reply.status_code, 201)
        params = self.item_insert()
        self.assertEqual(params[3], Decimal("20.00"))
        self.assertEqual(json.loads(params[6]), [])

    def refused(self, item, expected=None):
        reply = self.send(item)
        self.assertEqual(reply.status_code, 400, reply.get_data(as_text=True))
        if expected:
            self.assertIn(expected, reply.get_json()["error"])
        self.assertEqual(self.cur.sql("INSERT INTO orders"), [])
        self.assertEqual(self.cur.sql("INSERT INTO order_items"), [])
        self.conn.commit.assert_not_called()
        self.conn.rollback.assert_called()

    def test_missing_required_option_is_refused(self):
        self.refused({"id": PRODUCT_ID, "quantity": 1}, "Tamanho")
        self.refused({"id": PRODUCT_ID, "quantity": 1, "options": [EXTRA_NINHO]}, "Tamanho")

    def test_two_sizes_are_refused(self):
        self.refused({"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_SMALL, SIZE_BIG]}, "Tamanho")

    def test_option_of_another_product_or_company_is_refused(self):
        self.refused({"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_SMALL, FOREIGN_OPTION]}, "não existe mais")

    def test_turned_off_option_is_refused(self):
        self.refused({"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_SMALL, EXTRA_OFF]}, "Granola")

    def test_bad_option_shapes_are_refused(self):
        for options in ("x", {"a": 1}, [5], ["nope"], [SIZE_SMALL, SIZE_SMALL]):
            self.setUp()
            self.refused({"id": PRODUCT_ID, "quantity": 1, "options": options})

    def test_long_note_is_refused_never_cut(self):
        self.refused(
            {"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_SMALL], "note": "alergia a amendoim " * 10},
            "passou de 140",
        )

    def test_one_bad_item_stops_the_whole_order(self):
        body = {
            "customer_name": "Ana",
            "payment_method": "pix",
            "items": [
                {"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_SMALL]},
                {"id": PRODUCT_ID, "quantity": 1},
            ],
        }
        reply = self.client.post(ORDERS_URL, json=body)
        self.assertEqual(reply.status_code, 400)
        self.assertEqual(self.cur.sql("INSERT INTO orders"), [])
        self.conn.commit.assert_not_called()

    def test_cash_change_is_checked_against_the_total_with_options(self):
        reply = self.send(
            {"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_BIG]}, payment_method="dinheiro", payment_change=20
        )
        self.assertEqual(reply.status_code, 400)
        reply = self.send(
            {"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_BIG]}, payment_method="dinheiro", payment_change=30
        )
        self.assertEqual(reply.status_code, 201)

    def test_option_lookup_is_scoped_to_the_company_and_the_product(self):
        self.send({"id": PRODUCT_ID, "quantity": 1, "options": [SIZE_SMALL]})
        lookups = self.cur.sql("FROM option_groups g")
        self.assertEqual(lookups[0][1], (COMPANY_ID, PRODUCT_ID))


class OrderReadersTests(unittest.TestCase):
    def test_owner_panel_items_carry_options_and_note(self):
        with patch.object(backend_app, "query_db", return_value=[]) as query_db:
            reply = backend_app.app.test_client().get(
                f"/api/companies/{COMPANY_ID}/admin/orders", headers=auth("KITCHEN")
            )
        self.assertEqual(reply.status_code, 200)
        sql = " ".join(query_db.call_args.args[0].split())
        self.assertIn("'options', oi.options", sql)
        self.assertIn("'note', oi.note", sql)

    def test_customer_slip_items_carry_options_and_note(self):
        token = backend_app.serializer.dumps(
            {"purpose": "order_tracking", "order_id": ORDER_ID, "company_id": COMPANY_ID}
        )
        conn = MagicMock()
        conn.closed = False
        cur = FakeCursor()
        conn.cursor.return_value = cur
        order = {"id": ORDER_ID, "company_id": COMPANY_ID, "customer_name": "Ana", "total_price": Decimal("29.00"),
                 "status": "PENDING_PAYMENT", "payment_method": "pix", "payment_status": "PENDING"}
        item = {"product_id": PRODUCT_ID, "quantity": 1, "unit_price": Decimal("29.00"), "total": Decimal("29.00"),
                "options": [{"group": "Tamanho", "name": "500 ml", "price": "6.00"}], "note": "sem granola", "name": "Açaí"}
        cur.fetchone = MagicMock(return_value=order)
        cur.fetchall = MagicMock(return_value=[item])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            reply = backend_app.app.test_client().get(f"/api/orders/{ORDER_ID}?tracking_token={token}")
        self.assertEqual(reply.status_code, 200)
        body = reply.get_json()["items"][0]
        self.assertEqual(body["options"], item["options"])
        self.assertEqual(body["note"], "sem granola")
        items_sql = [s for s, _ in cur.executed if "FROM order_items" in s][0]
        self.assertIn("oi.options", items_sql)
        self.assertIn("oi.note", items_sql)


class AdminOptionsTests(Base):
    NEW = {
        "groups": [
            {
                "name": "Tamanho",
                "min_choices": 1,
                "max_choices": 1,
                "items": [{"name": "300 ml", "price_delta": "0"}, {"name": "500 ml", "price_delta": "6,00"}],
            }
        ]
    }

    def test_requires_login_and_the_right_role(self):
        self.assertEqual(self.client.get(OPTIONS_URL).status_code, 401)
        self.assertEqual(self.client.put(OPTIONS_URL, json=self.NEW).status_code, 401)
        for role in ("WAITER", "CASHIER", "KITCHEN", "COURIER"):
            self.assertEqual(self.client.get(OPTIONS_URL, headers=auth(role)).status_code, 403, role)
            self.assertEqual(self.client.put(OPTIONS_URL, json=self.NEW, headers=auth(role)).status_code, 403, role)
        self.conn.cursor.assert_not_called()

    def test_get_lists_every_option_including_turned_off_ones(self):
        reply = self.client.get(OPTIONS_URL, headers=auth("MANAGER"))
        self.assertEqual(reply.status_code, 200)
        groups = reply.get_json()["groups"]
        self.assertEqual([g["name"] for g in groups], ["Tamanho", "Adicionais"])
        self.assertEqual([(i["name"], i["active"]) for i in groups[1]["items"]], [("Leite ninho", True), ("Granola", False)])

    def test_product_of_another_company_is_not_found(self):
        self.cur.product = None
        self.assertEqual(self.client.get(OPTIONS_URL, headers=auth()).status_code, 404)
        reply = self.client.put(OPTIONS_URL, json=self.NEW, headers=auth())
        self.assertEqual(reply.status_code, 404)
        self.assertEqual(self.cur.sql("INSERT INTO option_groups"), [])
        self.conn.commit.assert_not_called()
        # a busca do prato usa a empresa do login, nunca uma que veio no pedido
        self.assertEqual(self.cur.sql("FROM products")[0][1], (PRODUCT_ID, COMPANY_ID))

    def test_bad_payload_is_refused_before_touching_the_database(self):
        for body in ({"groups": "x"}, {}, {"groups": [{"name": "", "items": []}]}):
            reply = self.client.put(OPTIONS_URL, json=body, headers=auth())
            self.assertEqual(reply.status_code, 400, body)
            self.assertTrue(reply.get_json()["error"])
        self.assertEqual(self.client.put(OPTIONS_URL, data="not json", headers=auth()).status_code, 400)
        self.conn.cursor.assert_not_called()

    def test_save_creates_the_groups_and_options_in_one_transaction(self):
        reply = self.client.put(OPTIONS_URL, json=self.NEW, headers=auth())
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        group_inserts = self.cur.sql("INSERT INTO option_groups")
        item_inserts = self.cur.sql("INSERT INTO option_items")
        self.assertEqual(len(group_inserts), 1)
        self.assertEqual(group_inserts[0][1][:5], (COMPANY_ID, PRODUCT_ID, "Tamanho", 1, 1))
        self.assertEqual([p[1:4] for _, p in item_inserts], [("300 ml", Decimal("0.00"), True), ("500 ml", Decimal("6.00"), True)])
        self.assertEqual([p[4] for _, p in item_inserts], [0, 1])
        self.assertTrue(self.cur.sql("DELETE FROM option_groups"))
        self.conn.commit.assert_called_once()
        self.assertIn("FOR UPDATE", self.cur.sql("FROM products")[0][0])
        self.assertEqual(reply.get_json()["message"], "Opcoes salvas")

    def test_save_with_an_empty_list_removes_everything(self):
        reply = self.client.put(OPTIONS_URL, json={"groups": []}, headers=auth())
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(self.cur.sql("INSERT INTO option_groups"), [])
        delete = self.cur.sql("DELETE FROM option_groups")[0]
        self.assertEqual(delete[1], (COMPANY_ID, PRODUCT_ID, []))

    def test_a_failure_rolls_back(self):
        with patch.object(backend_app.item_options, "save_groups", side_effect=RuntimeError("boom")):
            reply = self.client.put(OPTIONS_URL, json=self.NEW, headers=auth())
        self.assertEqual(reply.status_code, 500)
        self.conn.rollback.assert_called()
        self.conn.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
