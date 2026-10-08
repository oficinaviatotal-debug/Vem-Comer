"""Rotas da entrega: pedido com tipo, endereço e taxa; regiões públicas e do painel.

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
PRODUCT_ID = "33333333-3333-4333-8333-333333333333"
ORDER_ID = "55555555-5555-4555-8555-555555555555"
TABLE_ID = "66666666-6666-4666-8666-666666666666"
ZONE_CENTRO = "aaaaaaaa-0000-4000-8000-000000000001"
ZONE_NORTE = "aaaaaaaa-0000-4000-8000-000000000002"

ORDERS_URL = f"/api/companies/{COMPANY_ID}/orders"
DELIVERY_URL = f"/api/companies/{COMPANY_ID}/delivery"
QUOTE_URL = f"/api/companies/{COMPANY_ID}/delivery/quote"
ADMIN_URL = "/api/admin/delivery"

ZONE_ROWS = [
    {"id": ZONE_CENTRO, "name": "Centro", "cep_prefixes": ["30110", "30120"], "fee": Decimal("5.00"),
     "min_order": Decimal("20.00"), "eta_minutes": 40, "active": True},
    {"id": ZONE_NORTE, "name": "Norte", "cep_prefixes": ["30140"], "fee": Decimal("8.00"),
     "min_order": Decimal("0.00"), "eta_minutes": None, "active": True},
]
OPEN = {"accepts_pickup": True, "delivery_paused": False}
ADDRESS = {"cep": "30140-071", "street": "Rua das Flores", "number": "123", "neighborhood": "Norte"}


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


class FakeCursor:
    def __init__(self, company=OPEN, zones=ZONE_ROWS):
        self.company = company
        self.zones = zones
        self.executed = []
        self._last = ""

    def execute(self, sql, params=()):
        self.executed.append((" ".join(sql.split()), params))
        self._last = self.executed[-1][0]

    def fetchone(self):
        if "FOR UPDATE" in self._last and "FROM companies" in self._last:
            return {"id": COMPANY_ID}
        if "FROM companies" in self._last:
            return self.company
        if "FROM products" in self._last:
            return {"id": PRODUCT_ID, "price": Decimal("20.00")}
        if "INSERT INTO orders" in self._last:
            return {"id": ORDER_ID}
        if "INSERT INTO delivery_zones" in self._last:
            n = len([s for s, _ in self.executed if "INSERT INTO delivery_zones" in s])
            return {"id": "bbbbbbbb-0000-4000-8000-0000000000%02d" % n}
        return None

    def fetchall(self):
        if "FROM delivery_zones" in self._last and self._last.startswith("SELECT id, name"):
            return self.zones
        if "SELECT id FROM delivery_zones" in self._last:
            return [{"id": row["id"]} for row in self.zones]
        return []

    def close(self):
        pass

    def sql(self, needle):
        return [(s, p) for s, p in self.executed if needle in s]


class Base(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.conn = MagicMock()
        self.conn.closed = False
        self.cur = FakeCursor()
        self.conn.cursor.return_value = self.cur
        patcher = patch.object(backend_app, "get_db_connection", return_value=self.conn)
        patcher.start()
        self.addCleanup(patcher.stop)
        costs = patch.object(backend_app, "order_unit_costs", return_value={})
        costs.start()
        self.addCleanup(costs.stop)
        groups = patch.object(backend_app.item_options, "fetch_groups", return_value=[])
        groups.start()
        self.addCleanup(groups.stop)


class OrderTests(Base):
    def send(self, quantity=2, **extra):
        body = {"customer_name": "Ana", "payment_method": "pix", "items": [{"id": PRODUCT_ID, "quantity": quantity}]}
        body.update(extra)
        return self.client.post(ORDERS_URL, json=body)

    def order_insert(self):
        inserts = self.cur.sql("INSERT INTO orders")
        self.assertEqual(len(inserts), 1)
        return inserts[0][1]

    def test_delivery_adds_the_fee_of_the_region_to_the_total_and_keeps_a_copy(self):
        reply = self.send(order_type="entrega", address=ADDRESS, phone="(31) 99999-8888")
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        body = reply.get_json()
        self.assertEqual((body["order_type"], body["delivery_fee"], body["total"]), ("entrega", "8.00", "48.00"))

        # (company, customer, total, payment_method, change, table, order_type, fee, zone, address, phone)
        params = self.order_insert()
        self.assertEqual(params[2], Decimal("48.00"))
        self.assertEqual(params[6:9], ("entrega", Decimal("8.00"), "Norte"))
        self.assertEqual(
            json.loads(params[9]),
            {"cep": "30140071", "street": "Rua das Flores", "number": "123", "neighborhood": "Norte"},
        )
        self.assertEqual(params[10], "31999998888")
        # o Pix e o pagamento levam o total COM a taxa
        self.assertEqual(self.cur.sql("INSERT INTO payments")[0][1][2], Decimal("48.00"))
        # os pratos continuam sem a taxa: o CMV nao conta frete como venda de comida
        self.assertEqual(self.cur.sql("INSERT INTO order_items")[0][1][4], Decimal("40.00"))
        self.conn.commit.assert_called_once()

    def test_the_fee_the_phone_sends_is_ignored(self):
        reply = self.send(order_type="entrega", address=ADDRESS, phone="31999998888", delivery_fee=0, fee=0, total=1)
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(self.order_insert()[2], Decimal("48.00"))

    def refused(self, expected=None, **extra):
        reply = self.send(**extra)
        self.assertEqual(reply.status_code, 400, reply.get_data(as_text=True))
        if expected:
            self.assertIn(expected, reply.get_json()["error"])
        self.assertEqual(self.cur.sql("INSERT INTO orders"), [])
        self.assertEqual(self.cur.sql("INSERT INTO order_items"), [])
        self.assertEqual(self.cur.sql("INSERT INTO payments"), [])
        self.conn.commit.assert_not_called()
        self.conn.rollback.assert_called()

    def test_a_cep_outside_every_region_is_refused(self):
        self.refused("Ainda não entregamos", order_type="entrega", address=dict(ADDRESS, cep="01310-100"), phone="31999998888")

    def test_the_minimum_order_of_the_region_is_checked_on_the_dishes(self):
        self.cur.zones = [dict(ZONE_ROWS[0], min_order=Decimal("25.00"))]
        centro = dict(ADDRESS, cep="30110-050")
        # one dish is R$ 20,00: below the R$ 25,00 minimum, and the R$ 5,00 fee does not help it pass
        self.refused("R$ 25,00", quantity=1, order_type="entrega", address=centro, phone="31999998888")

    def test_the_minimum_is_met_by_the_dishes_and_the_fee_comes_on_top(self):
        reply = self.send(quantity=2, order_type="entrega", address=dict(ADDRESS, cep="30110-050"), phone="31999998888")
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(self.order_insert()[2], Decimal("45.00"))
        self.assertEqual(self.order_insert()[6:9], ("entrega", Decimal("5.00"), "Centro"))

    def test_address_and_phone_are_required_for_delivery(self):
        self.refused("endereço", order_type="entrega", phone="31999998888")
        self.refused("rua", order_type="entrega", address={"cep": "30140071", "number": "1", "neighborhood": "N"}, phone="31999998888")
        self.refused("telefone", order_type="entrega", address=ADDRESS)
        self.refused("Telefone inválido", order_type="entrega", address=ADDRESS, phone="123")

    def test_delivery_needs_a_name(self):
        reply = self.client.post(
            ORDERS_URL,
            json={"payment_method": "pix", "items": [{"id": PRODUCT_ID, "quantity": 2}],
                  "order_type": "entrega", "address": ADDRESS, "phone": "31999998888"},
        )
        self.assertEqual(reply.status_code, 400)
        self.assertIn("nome", reply.get_json()["error"])

    def test_paused_delivery_or_no_regions_is_refused_but_pickup_still_works(self):
        self.cur.company = dict(OPEN, delivery_paused=True)
        self.refused("pausada", order_type="entrega", address=ADDRESS, phone="31999998888")
        self.setUp()
        self.cur.zones = []
        self.refused("não faz entrega", order_type="entrega", address=ADDRESS, phone="31999998888")

    def test_pickup_has_no_fee_and_keeps_the_phone_if_given(self):
        reply = self.send(order_type="retirada", phone="31999998888")
        self.assertEqual(reply.status_code, 201)
        params = self.order_insert()
        self.assertEqual((params[2], params[6], params[7], params[8], params[9], params[10]),
                         (Decimal("40.00"), "retirada", Decimal("0.00"), None, None, "31999998888"))

    def test_pickup_can_be_turned_off(self):
        self.cur.company = dict(OPEN, accepts_pickup=False)
        self.refused("retirada", order_type="retirada")

    def test_an_old_phone_without_a_type_orders_like_before(self):
        reply = self.send()
        self.assertEqual(reply.status_code, 201)
        params = self.order_insert()
        self.assertEqual((params[2], params[6], params[7]), (Decimal("40.00"), "balcao", Decimal("0.00")))
        # sem entrega, nem precisa ler as regioes
        self.assertEqual(self.cur.sql("FROM delivery_zones"), [])

    def test_a_table_order_is_a_table_order(self):
        reply = self.send(table_id=TABLE_ID)
        self.assertEqual(reply.status_code, 400)  # the fake has no such table
        self.setUp()
        original = self.cur.fetchone

        def with_table():
            if "FROM tables" in self.cur._last:
                return {"id": TABLE_ID}
            return original()

        self.cur.fetchone = with_table
        reply = self.send(table_id=TABLE_ID)
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        self.assertEqual((self.order_insert()[6], self.order_insert()[7]), ("mesa", Decimal("0.00")))
        self.refused_after = None

    def test_a_table_cannot_ask_for_delivery(self):
        original = self.cur.fetchone
        self.cur.fetchone = lambda: {"id": TABLE_ID} if "FROM tables" in self.cur._last else original()
        self.refused("mesa", table_id=TABLE_ID, order_type="entrega", address=ADDRESS, phone="31999998888")

    def test_unknown_order_type_is_refused(self):
        self.refused("Tipo de pedido", order_type="moto")

    def test_cash_change_counts_the_fee(self):
        reply = self.send(order_type="entrega", address=ADDRESS, phone="31999998888", payment_method="dinheiro", payment_change=45)
        self.assertEqual(reply.status_code, 400)
        self.assertIn("Troco", reply.get_json()["error"])
        self.setUp()
        reply = self.send(order_type="entrega", address=ADDRESS, phone="31999998888", payment_method="dinheiro", payment_change=50)
        self.assertEqual(reply.status_code, 201)

    def test_the_company_flags_and_zones_are_read_for_the_company_of_the_url(self):
        self.send(order_type="entrega", address=ADDRESS, phone="31999998888")
        self.assertEqual(self.cur.sql("FROM companies")[0][1], (COMPANY_ID,))
        self.assertEqual(self.cur.sql("FROM delivery_zones")[0][1], (COMPANY_ID,))


class PublicTests(unittest.TestCase):
    def patch_db(self, company=OPEN, zones=ZONE_ROWS):
        def fake(sql, params=(), one=False):
            if "FROM companies" in sql:
                return company if one else [company]
            return zones

        return patch.object(backend_app, "query_db", side_effect=fake)

    def test_the_public_page_lists_regions_without_the_cep_lists(self):
        with self.patch_db():
            reply = backend_app.app.test_client().get(DELIVERY_URL)
        self.assertEqual(reply.status_code, 200)
        body = reply.get_json()
        self.assertEqual((body["pickup"], body["delivery"]), (True, True))
        self.assertEqual([z["name"] for z in body["zones"]], ["Centro", "Norte"])
        self.assertNotIn("cep_prefixes", json.dumps(body))

    def test_unknown_company_is_not_found(self):
        with self.patch_db(company=None):
            self.assertEqual(backend_app.app.test_client().get(DELIVERY_URL).status_code, 404)
            self.assertEqual(backend_app.app.test_client().get(QUOTE_URL + "?cep=30140071").status_code, 404)

    def test_quote_answers_for_a_cep(self):
        client = backend_app.app.test_client()
        with self.patch_db():
            ok = client.get(QUOTE_URL + "?cep=30110-050").get_json()
            far = client.get(QUOTE_URL + "?cep=01310100").get_json()
            bad = client.get(QUOTE_URL + "?cep=12").get_json()
            none = client.get(QUOTE_URL).get_json()
        self.assertEqual((ok["available"], ok["zone"], ok["fee"], ok["min_order"], ok["eta_minutes"]), (True, "Centro", "5.00", "20.00", 40))
        self.assertEqual((far["available"], far["reason"]), (False, "out_of_area"))
        self.assertEqual(bad["reason"], "invalid_cep")
        self.assertEqual(none["reason"], "invalid_cep")

    def test_quote_is_scoped_to_the_company_of_the_url(self):
        calls = []

        def fake(sql, params=(), one=False):
            calls.append(params)
            return OPEN if "FROM companies" in sql else ZONE_ROWS

        with patch.object(backend_app, "query_db", side_effect=fake):
            backend_app.app.test_client().get(QUOTE_URL + "?cep=30110050")
        self.assertEqual(calls, [(COMPANY_ID,), (COMPANY_ID,)])


class AdminTests(Base):
    BODY = {
        "accepts_pickup": True,
        "delivery_paused": False,
        "zones": [
            {"id": ZONE_CENTRO, "name": "Centro", "cep_prefixes": "30110, 30120", "fee": "6,00", "min_order": "20", "eta_minutes": 45},
            {"name": "Sul", "cep_prefixes": ["30160"], "fee": "9"},
        ],
    }

    def test_requires_login_and_the_right_role(self):
        self.assertEqual(self.client.get(ADMIN_URL).status_code, 401)
        self.assertEqual(self.client.put(ADMIN_URL, json=self.BODY).status_code, 401)
        for role in ("WAITER", "CASHIER", "KITCHEN", "COURIER"):
            self.assertEqual(self.client.get(ADMIN_URL, headers=auth(role)).status_code, 403, role)
            self.assertEqual(self.client.put(ADMIN_URL, json=self.BODY, headers=auth(role)).status_code, 403, role)
        self.conn.cursor.assert_not_called()

    def test_get_shows_everything_with_ids_for_the_owner_and_the_manager(self):
        def fake(sql, params=(), one=False):
            return OPEN if "FROM companies" in sql else ZONE_ROWS

        for role in ("OWNER", "MANAGER"):
            with patch.object(backend_app, "query_db", side_effect=fake):
                reply = self.client.get(ADMIN_URL, headers=auth(role))
            self.assertEqual(reply.status_code, 200, role)
            zones = reply.get_json()["zones"]
            self.assertEqual([(z["id"], z["cep_prefixes"], z["fee"]) for z in zones],
                             [(ZONE_CENTRO, ["30110", "30120"], "5.00"), (ZONE_NORTE, ["30140"], "8.00")])

    def test_put_keeps_the_ids_it_knows_creates_the_new_and_removes_the_rest(self):
        reply = self.client.put(ADMIN_URL, json=self.BODY, headers=auth("MANAGER"))
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        updates = self.cur.sql("UPDATE delivery_zones")
        self.assertEqual(len(updates), 1)
        self.assertEqual(updates[0][1][-2:], (ZONE_CENTRO, COMPANY_ID))
        self.assertEqual(updates[0][1][:6], ("Centro", ["30110", "30120"], Decimal("6.00"), Decimal("20.00"), 45, True))
        inserts = self.cur.sql("INSERT INTO delivery_zones")
        self.assertEqual(len(inserts), 1)
        self.assertEqual(inserts[0][1][0], "Sul")
        self.assertEqual(inserts[0][1][-1], COMPANY_ID)
        delete = self.cur.sql("DELETE FROM delivery_zones")[0]
        self.assertEqual(delete[1][0], COMPANY_ID)
        self.assertIn(ZONE_CENTRO, delete[1][1])
        self.assertNotIn(ZONE_NORTE, delete[1][1])
        self.conn.commit.assert_called_once()

    def test_put_locks_the_company_row_and_saves_the_switches(self):
        self.client.put(ADMIN_URL, json=dict(self.BODY, accepts_pickup=False, delivery_paused=True), headers=auth())
        self.assertTrue(self.cur.sql("FOR UPDATE"))
        switches = self.cur.sql("UPDATE companies")[0]
        self.assertEqual(switches[1], (False, True, COMPANY_ID))

    def test_put_only_touches_the_company_of_the_token(self):
        other = "99999999-9999-4999-8999-999999999999"
        self.client.put(ADMIN_URL, json=self.BODY, headers=auth(company_id=other))
        for sql, params in self.cur.executed:
            if "delivery_zones" in sql or "companies" in sql:
                self.assertIn(other, params, sql)
                self.assertNotIn(COMPANY_ID, params, sql)

    def test_an_empty_list_removes_every_region(self):
        reply = self.client.put(ADMIN_URL, json={"zones": []}, headers=auth())
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(self.cur.sql("INSERT INTO delivery_zones"), [])
        self.assertEqual(self.cur.sql("DELETE FROM delivery_zones")[0][1][1], [])

    def test_a_bad_save_says_why_and_writes_nothing(self):
        bad_bodies = [
            {"accepts_pickup": True},
            {"zones": [{"name": "Centro", "cep_prefixes": "12"}]},
            {"zones": [{"name": "Centro", "cep_prefixes": "30110", "fee": "-2"}]},
            {"zones": [{"name": "A", "cep_prefixes": "30110"}, {"name": "a", "cep_prefixes": "30120"}]},
            [],
        ]
        for body in bad_bodies:
            self.setUp()
            reply = self.client.put(ADMIN_URL, json=body, headers=auth())
            self.assertEqual(reply.status_code, 400, repr(body))
            self.assertTrue(reply.get_json()["error"])
            self.conn.cursor.assert_not_called()
            self.conn.commit.assert_not_called()


class OrderReadersTests(unittest.TestCase):
    def test_owner_panel_orders_carry_type_fee_region_address_and_phone(self):
        with patch.object(backend_app, "query_db", return_value=[]) as query_db:
            reply = backend_app.app.test_client().get(
                f"/api/companies/{COMPANY_ID}/admin/orders", headers=auth("KITCHEN")
            )
        self.assertEqual(reply.status_code, 200)
        sql = " ".join(query_db.call_args.args[0].split())
        for column in ("o.order_type", "o.delivery_fee", "o.delivery_zone", "o.delivery_address", "o.customer_phone"):
            self.assertIn(column, sql)

    def test_the_customer_slip_carries_them_too(self):
        token = backend_app.serializer.dumps(
            {"purpose": "order_tracking", "order_id": ORDER_ID, "company_id": COMPANY_ID}
        )
        conn = MagicMock()
        conn.closed = False
        cur = FakeCursor()
        conn.cursor.return_value = cur
        order = {"id": ORDER_ID, "company_id": COMPANY_ID, "customer_name": "Ana", "total_price": Decimal("48.00"),
                 "status": "PENDING_PAYMENT", "payment_method": "pix", "payment_status": "PENDING",
                 "order_type": "entrega", "delivery_fee": Decimal("8.00"), "delivery_zone": "Norte",
                 "delivery_address": {"cep": "30140071"}, "customer_phone": "31999998888"}
        cur.fetchone = MagicMock(return_value=order)
        cur.fetchall = MagicMock(return_value=[])
        with patch.object(backend_app, "get_db_connection", return_value=conn):
            reply = backend_app.app.test_client().get(f"/api/orders/{ORDER_ID}?tracking_token={token}")
        self.assertEqual(reply.status_code, 200)
        body = reply.get_json()
        self.assertEqual((body["order_type"], body["delivery_fee"], body["delivery_zone"]), ("entrega", "8.00", "Norte"))
        order_sql = cur.executed[0][0]
        for column in ("order_type", "delivery_fee", "delivery_zone", "delivery_address", "customer_phone"):
            self.assertIn(column, order_sql)


if __name__ == "__main__":
    unittest.main()
