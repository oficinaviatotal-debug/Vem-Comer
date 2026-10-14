import os
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import business_api  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
URL = f"/api/companies/{COMPANY_ID}/admin/business"
NOW = datetime(2026, 10, 14, 18, 0, tzinfo=timezone.utc)


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


class ScriptedCursor:
    """Responde cada SQL pelo trecho que aparece nele e guarda o que foi perguntado."""

    def __init__(self, answers):
        self.answers = answers
        self.executed = []
        self._last = []

    def execute(self, sql, params=None):
        flat = " ".join(sql.split())
        self.executed.append((flat, params))
        self._last = []
        for needle, result in self.answers:
            if needle in flat:
                self._last = result
                return

    def fetchone(self):
        return self._last[0] if self._last else None

    def fetchall(self):
        return list(self._last)

    def close(self):
        pass


class FakeConnection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.rolled_back = False
        self.closed = False

    def cursor(self, **kwargs):
        return self._cursor

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


def answers(company=True):
    return [
        ("FROM companies", [{"cmv_target": 35}] if company else []),
        ("FROM orders o WHERE", [
            {"id": "o1", "created_at": datetime(2026, 10, 14, 15, 0), "status": "concluido", "order_type": "mesa",
             "total_price": Decimal("80.00"), "delivery_fee": Decimal("0"), "payment_method": "pix",
             "courier_id": None, "picked_up_at": None, "delivered_at": None},
        ]),
        ("FROM order_items oi", [
            {"order_id": "o1", "product_id": "p1", "name": "Pizza", "portion": "Grande", "quantity": 1,
             "total": Decimal("80.00"), "unit_cost": Decimal("22.00")},
        ]),
        ("FROM users", [{"id": "u1", "name": "Ana", "role": "WAITER"}]),
        ("count(*) AS waiting", [{"waiting": 0}]),
    ]


class BusinessRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def connect(self, cursor):
        connection = FakeConnection(cursor)
        patcher = patch.object(business_api, "get_db_connection", return_value=connection)
        patcher.start()
        self.addCleanup(patcher.stop)
        return connection

    def test_needs_login_and_owner_or_manager(self):
        self.assertEqual(self.client.get(URL).status_code, 401)
        for role in ("WAITER", "CASHIER", "KITCHEN", "COURIER"):
            self.assertEqual(self.client.get(URL, headers=auth(role)).status_code, 403, role)

    def test_another_restaurant_is_refused(self):
        response = self.client.get(URL, headers=auth(company_id=OTHER_COMPANY_ID))
        self.assertEqual(response.status_code, 403)

    def test_invalid_period_is_a_clear_400(self):
        response = self.client.get(URL + "?period=ontem", headers=auth())
        self.assertEqual(response.status_code, 400)
        self.assertIn("Período inválido", response.get_json()["error"])

    def test_manager_gets_the_panel_and_nothing_is_cached(self):
        cursor = ScriptedCursor(answers())
        connection = self.connect(cursor)
        with patch.object(business_api.insights, "utc", wraps=business_api.insights.utc):
            response = self.client.get(URL + "?period=7d", headers=auth("MANAGER"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        body = response.get_json()
        self.assertEqual(body["period"], "7d")
        self.assertIn("summary", body)
        self.assertIn("attention", body)
        self.assertTrue(connection.rolled_back and connection.closed)

    def test_default_period_is_today(self):
        self.connect(ScriptedCursor(answers()))
        body = self.client.get(URL, headers=auth()).get_json()
        self.assertEqual(body["period"], "hoje")

    def test_every_query_is_tied_to_the_logged_restaurant(self):
        cursor = ScriptedCursor(answers())
        self.connect(cursor)
        self.client.get(URL, headers=auth())
        queries = [(sql, params) for sql, params in cursor.executed if "SET LOCAL" not in sql]
        self.assertGreaterEqual(len(queries), 7)
        for sql, params in queries:
            self.assertTrue("company_id = %s" in sql or "FROM companies WHERE id = %s" in sql, sql)
            self.assertEqual(params[0], COMPANY_ID, sql)

    def test_session_is_set_to_utc_before_reading(self):
        cursor = ScriptedCursor(answers())
        self.connect(cursor)
        self.client.get(URL, headers=auth())
        self.assertEqual(cursor.executed[0][0], "SET LOCAL TIME ZONE 'UTC'")

    def test_unknown_restaurant_is_404(self):
        self.connect(ScriptedCursor(answers(company=False)))
        self.assertEqual(self.client.get(URL, headers=auth()).status_code, 404)

    def test_database_failure_gives_a_plain_message_not_the_error(self):
        class Boom(ScriptedCursor):
            def execute(self, sql, params=None):
                raise RuntimeError("segredo: senha do banco")

        connection = self.connect(Boom([]))
        response = self.client.get(URL, headers=auth())
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("segredo", response.get_data(as_text=True))
        self.assertTrue(connection.closed)

    def test_only_sold_statuses_are_read(self):
        cursor = ScriptedCursor(answers())
        self.connect(cursor)
        self.client.get(URL, headers=auth())
        for sql, _ in cursor.executed:
            if "FROM orders o" in sql or "FROM order_items" in sql:
                for status in business_api.order_status.SOLD_STATUSES:
                    self.assertIn(f"'{status}'", sql)
                self.assertNotIn("PENDING_PAYMENT", sql)

    def test_query_limits_are_naive_utc(self):
        cursor = ScriptedCursor(answers())
        connection = self.connect(cursor)  # noqa: F841
        business_api.load(cursor, COMPANY_ID, "hoje", NOW)
        orders_params = next(p for sql, p in cursor.executed if "FROM orders o" in sql)
        low, high = orders_params[1], orders_params[2]
        self.assertIsNone(low.tzinfo)
        self.assertIsNone(high.tzinfo)
        # ontem 00:00 em Brasília = 03:00 UTC; agora = 18:00 UTC.
        self.assertEqual(low, datetime(2026, 10, 13, 3, 0))
        self.assertEqual(high, datetime(2026, 10, 14, 18, 0))

    def test_load_result_counts_the_order(self):
        cursor = ScriptedCursor(answers())
        body = business_api.load(cursor, COMPANY_ID, "hoje", NOW)
        self.assertEqual(body["summary"]["revenue"], 80.0)
        self.assertEqual(body["dishes"]["by_quantity"][0]["name"], "Pizza · Grande")


class WiringTests(unittest.TestCase):
    def test_route_registered_once_with_get_only(self):
        rules = [r for r in backend_app.app.url_map.iter_rules() if r.rule.endswith("/admin/business")]
        self.assertEqual(len(rules), 1)
        self.assertEqual(rules[0].methods - {"HEAD", "OPTIONS"}, {"GET"})


if __name__ == "__main__":
    unittest.main()
