"""Rotas da assinatura: pedido recusado quando bloqueado, tela do dono, lista e pagamento do administrador.

Roda no CI (precisa do Flask); o banco é simulado por um cursor que responde pelo texto do SQL.
"""

import os
import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import subscription  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_ID = "22222222-2222-4222-8222-222222222222"
PRODUCT_ID = "33333333-3333-4333-8333-333333333333"
ORDER_ID = "55555555-5555-4555-8555-555555555555"
PAYMENT_ID = "77777777-7777-4777-8777-777777777777"
ADMIN_USER = "99999999-9999-4999-8999-999999999999"

ORDERS_URL = f"/api/companies/{COMPANY_ID}/orders"
TODAY = date(2026, 11, 6)  # o dia depois do vencimento do dia 5
NOW = datetime(2026, 11, 6, 15, 0, tzinfo=timezone.utc)


def auth(role="OWNER", company_id=COMPANY_ID, user_id="user-1"):
    token = backend_app.serializer.dumps({"user_id": user_id, "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


def sub(paid_until=None, anchor=None, price=19000, canceled=None):
    return {"company_id": COMPANY_ID, "plan_code": "vemcomer_mensal", "price_cents": price, "anchor_day": anchor,
            "paid_until": paid_until, "canceled_at": canceled, "created_at": NOW}


PAID_ON_TIME = sub(date(2026, 11, 8), 8)
PAST_DUE = sub(date(2026, 11, 5), 5)
WAITING = sub()


class FakeCursor:
    def __init__(self, subscription_row=None, company_exists=True, duplicate=False):
        self.sub = subscription_row
        self.company_exists = company_exists
        self.duplicate = duplicate
        self.executed = []
        self._last = ""

    def execute(self, sql, params=()):
        self.executed.append((" ".join(sql.split()), params))
        self._last = self.executed[-1][0]

    def fetchone(self):
        last = self._last
        if "FROM subscriptions" in last and "FROM subscriptions s" not in last:
            return self.sub
        if last.startswith("SELECT id FROM companies"):
            return {"id": COMPANY_ID} if self.company_exists else None
        if "FROM subscription_payments" in last and "paid_at >" in last:
            return {"?column?": 1} if self.duplicate else None
        if "INSERT INTO subscription_payments" in last:
            return {"id": PAYMENT_ID, "paid_at": NOW}
        if "FROM companies" in last:
            return {"id": COMPANY_ID, "accepts_pickup": True, "delivery_paused": False}
        if "FROM tables" in last:
            return {"id": "x"}
        if "FROM products" in last:
            return {"id": PRODUCT_ID, "price": Decimal("20.00")}
        if "INSERT INTO orders" in last:
            return {"id": ORDER_ID}
        return None

    def fetchall(self):
        return []

    def close(self):
        pass

    def sql(self, needle):
        return [(s, p) for s, p in self.executed if needle in s]


class Base(unittest.TestCase):
    enforced = True
    admin_emails = "gd@exemplo.com"

    def setUp(self):
        self.client = backend_app.app.test_client()
        self.conn = MagicMock()
        self.conn.closed = False
        self.cur = FakeCursor()
        self.conn.cursor.return_value = self.cur
        for patcher in (
            patch.object(backend_app, "get_db_connection", return_value=self.conn),
            patch.object(backend_app, "order_unit_costs", return_value={}),
            patch.object(backend_app.item_options, "fetch_groups", return_value=[]),
            patch.object(subscription, "today_br", return_value=TODAY),
            patch.dict(os.environ, {"BILLING_ENFORCED": "1" if self.enforced else "",
                                    "PLATFORM_ADMIN_EMAILS": self.admin_emails}),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)


class PublicCompanyTests(Base):
    def get(self, row, **kw):
        company = {"id": COMPANY_ID, "name": "Saiteria", "slug": "saiteria", "logo_key": None}
        with patch.object(backend_app, "query_db", side_effect=[company, row] if kw.get("two", True) else [company]) as q:
            body = self.client.get("/api/companies/by-slug/saiteria").get_json()
        return body, q

    def test_a_blocked_restaurant_says_it_is_not_accepting_orders_and_never_why(self):
        body, _ = self.get(PAST_DUE)
        self.assertIs(body["accepting_orders"], False)
        self.assertNotIn("subscription", body)
        self.assertNotIn("paid_until", body)

    def test_waiting_for_the_first_payment_is_also_closed(self):
        self.assertIs(self.get(WAITING)[0]["accepting_orders"], False)

    def test_a_paid_restaurant_is_open(self):
        self.assertIs(self.get(PAID_ON_TIME)[0]["accepting_orders"], True)

    def test_a_restaurant_without_a_subscription_is_never_closed(self):
        self.assertIs(self.get(None)[0]["accepting_orders"], True)

    def test_a_database_error_does_not_close_the_restaurant(self):
        company = {"id": COMPANY_ID, "name": "Saiteria", "slug": "saiteria", "logo_key": None}
        with patch.object(backend_app, "query_db", side_effect=[company, RuntimeError("banco fora")]):
            body = self.client.get("/api/companies/by-slug/saiteria").get_json()
        self.assertIs(body["accepting_orders"], True)


class NotEnforcedTests(Base):
    enforced = False

    def test_off_means_open_and_the_subscription_is_not_even_read(self):
        company = {"id": COMPANY_ID, "name": "Saiteria", "slug": "saiteria", "logo_key": None}
        with patch.object(backend_app, "query_db", side_effect=[company]) as q:
            body = self.client.get("/api/companies/by-slug/saiteria").get_json()
        self.assertIs(body["accepting_orders"], True)
        self.assertEqual(q.call_count, 1)

    def test_off_means_the_order_goes_through_without_reading_the_subscription(self):
        self.cur.sub = PAST_DUE
        reply = self.client.post(ORDERS_URL, json={"customer_name": "Ana", "payment_method": "pix",
                                                   "items": [{"id": PRODUCT_ID, "quantity": 1}]})
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        self.assertEqual(self.cur.sql("FROM subscriptions"), [])


class OrderEnforcementTests(Base):
    def send(self):
        return self.client.post(ORDERS_URL, json={"customer_name": "Ana", "payment_method": "pix",
                                                  "items": [{"id": PRODUCT_ID, "quantity": 1}]})

    def refused(self, row):
        self.cur.sub = row
        reply = self.send()
        self.assertEqual(reply.status_code, 403, reply.get_data(as_text=True))
        body = reply.get_json()
        self.assertEqual(body["code"], "not_accepting_orders")
        self.assertEqual(body["error"], subscription.CUSTOMER_MESSAGE)
        for needle in ("INSERT INTO orders", "INSERT INTO order_items", "INSERT INTO payments"):
            self.assertEqual(self.cur.sql(needle), [])
        self.conn.commit.assert_not_called()

    def test_overdue_cannot_order(self):
        self.refused(PAST_DUE)

    def test_waiting_for_the_first_payment_cannot_order(self):
        self.refused(WAITING)

    def test_canceled_cannot_order(self):
        self.refused(sub(date(2027, 1, 1), 1, canceled=NOW))

    def test_on_the_due_date_the_order_still_goes_through(self):
        self.cur.sub = sub(TODAY, 6)
        self.assertEqual(self.send().status_code, 201)

    def test_paid_orders_normally(self):
        self.cur.sub = PAID_ON_TIME
        self.assertEqual(self.send().status_code, 201)
        self.assertEqual(len(self.cur.sql("INSERT INTO orders")), 1)

    def test_no_subscription_orders_normally(self):
        self.cur.sub = None
        self.assertEqual(self.send().status_code, 201)

    def test_the_status_of_an_order_in_progress_is_not_blocked_by_this(self):
        """O bloqueio é só do pedido NOVO: a rota que muda o estado não consulta a assinatura."""
        self.cur.sub = PAST_DUE
        with patch.object(backend_app, "query_db", return_value=None):
            self.client.put(f"/api/orders/{ORDER_ID}/status", json={"status": "concluido"}, headers=auth())
        self.assertEqual(self.cur.sql("FROM subscriptions"), [])


class OwnerViewTests(Base):
    URL = "/api/admin/subscription"

    def get(self, row, payments=(), email="dono@exemplo.com", **kw):
        calls = {"SQL_GET": row, "SQL_RECENT_PAYMENTS": list(payments), "SQL_USER_EMAIL": {"email": email}}

        def fake(query, args=(), one=False):
            for name, value in calls.items():
                if query is getattr(subscription, name):
                    return value
            raise AssertionError("unexpected query: " + query)

        with patch.object(backend_app, "query_db", side_effect=fake):
            return self.client.get(self.URL, headers=auth(**kw))

    def test_the_owner_sees_the_plan_and_what_to_do(self):
        reply = self.get(PAST_DUE)
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.headers["Cache-Control"], "no-store")
        body = reply.get_json()
        self.assertEqual((body["state"], body["blocked"], body["enforced"]), ("past_due", True, True))
        self.assertEqual(body["due_date"], "2026-11-05")
        self.assertEqual(body["price_cents"], 19000)
        self.assertIn("venceu em 05/11", body["message"])
        self.assertIs(body["platform_admin"], False)

    def test_a_paid_owner_sees_no_block_and_no_message(self):
        body = self.get(sub(date(2026, 12, 8), 8)).get_json()
        self.assertEqual((body["state"], body["blocked"], body["message"]), ("active", False, ""))

    def test_with_billing_off_the_state_shows_but_nothing_is_blocked(self):
        with patch.dict(os.environ, {"BILLING_ENFORCED": ""}):
            body = self.get(PAST_DUE).get_json()
        self.assertEqual((body["state"], body["blocked"], body["enforced"]), ("past_due", False, False))

    def test_the_payment_list_is_formatted(self):
        row = {"id": PAYMENT_ID, "amount_cents": 19000, "period_start": date(2026, 10, 5),
               "period_end": date(2026, 11, 5), "method": "pix", "paid_at": NOW}
        body = self.get(PAID_ON_TIME, payments=[row]).get_json()
        self.assertEqual(body["payments"], [{"id": PAYMENT_ID, "amount_cents": 19000, "period_start": "2026-10-05",
                                              "period_end": "2026-11-05", "method": "pix", "paid_at": NOW.isoformat()}])

    def test_the_platform_admin_is_told_so(self):
        self.assertIs(self.get(PAID_ON_TIME, email="GD@exemplo.com").get_json()["platform_admin"], True)

    def test_payment_info_comes_from_the_server_settings(self):
        with patch.dict(os.environ, {"BILLING_PIX_KEY": "chave-do-gd", "BILLING_CONTACT_PHONE": "5584999990000"}):
            info = self.get(PAST_DUE).get_json()["payment_info"]
        self.assertEqual(info["pix_key"], "chave-do-gd")
        self.assertEqual(info["contact_phone"], "5584999990000")

    def test_only_the_owner_and_manager_see_it(self):
        for role in ("WAITER", "KITCHEN", "CASHIER", "COURIER"):
            self.assertEqual(self.get(PAST_DUE, role=role).status_code, 403, role)
        self.assertEqual(self.get(PAST_DUE, role="MANAGER").status_code, 200)

    def test_it_needs_a_login(self):
        self.assertEqual(self.client.get(self.URL).status_code, 401)


class PlatformListTests(Base):
    URL = "/api/platform/subscriptions"

    def rows(self):
        def row(cid, name, **extra):
            base = {"company_id": cid, "name": name, "slug": name.lower(), "company_created_at": NOW, "plan_code": None,
                    "price_cents": None, "anchor_day": None, "paid_until": None, "canceled_at": None,
                    "has_subscription": False, "owner_name": "Dono " + name, "owner_email": name.lower() + "@x.com",
                    "owner_phone": "5584999991234"}
            base.update(extra)
            return base

        return [
            row("c1", "Exempt"),
            row("c2", "Ok", has_subscription=True, price_cents=19000, anchor_day=8, paid_until=date(2026, 12, 8)),
            row("c3", "Late", has_subscription=True, price_cents=19000, anchor_day=5, paid_until=date(2026, 11, 5)),
            row("c4", "New", has_subscription=True, price_cents=19000),
        ]

    def get(self, email="gd@exemplo.com", headers=None):
        def fake(query, args=(), one=False):
            if query is subscription.SQL_USER_EMAIL:
                return {"email": email}
            if query is subscription.SQL_PLATFORM_LIST:
                return self.rows()
            raise AssertionError("unexpected query")

        with patch.object(backend_app, "query_db", side_effect=fake):
            return self.client.get(self.URL, headers=headers or auth(user_id=ADMIN_USER))

    def test_the_admin_sees_everyone_with_the_ones_that_need_attention_first(self):
        body = self.get().get_json()
        self.assertEqual([c["name"] for c in body["companies"]], ["Late", "New", "Ok", "Exempt"])
        self.assertEqual(body["needs_attention"], 2)
        self.assertEqual(body["today"], "2026-11-06")
        late = body["companies"][0]
        self.assertEqual(late["subscription"]["state"], "past_due")
        self.assertEqual(late["owner_email"], "late@x.com")
        self.assertEqual(late["owner_phone"], "5584999991234")
        self.assertIn("venceu", late["subscription"]["message"])

    def test_a_normal_owner_is_refused(self):
        self.assertEqual(self.get(email="dono@exemplo.com").status_code, 403)

    def test_without_the_setting_nobody_is_admin(self):
        with patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": ""}):
            self.assertEqual(self.get().status_code, 403)

    def test_it_needs_a_login(self):
        self.assertEqual(self.client.get(self.URL).status_code, 401)


class RecordPaymentTests(Base):
    def url(self, company_id=COMPANY_ID):
        return f"/api/platform/subscriptions/{company_id}/payments"

    def post(self, body=None, email="gd@exemplo.com"):
        def fake(query, args=(), one=False):
            if query is subscription.SQL_USER_EMAIL:
                return {"email": email}
            raise AssertionError("unexpected query")

        with patch.object(backend_app, "query_db", side_effect=fake):
            return self.client.post(self.url(), json=body if body is not None else {}, headers=auth(user_id=ADMIN_USER))

    def inserted(self):
        inserts = self.cur.sql("INSERT INTO subscription_payments")
        self.assertEqual(len(inserts), 1)
        return inserts[0][1]

    def test_the_first_payment_starts_today_and_sets_the_due_day(self):
        self.cur.sub = WAITING
        reply = self.post({"method": "pix", "reference": "Pix do João"})
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        body = reply.get_json()
        self.assertEqual((body["period_start"], body["period_end"], body["amount_cents"]),
                         ("2026-11-06", "2026-12-06", 19000))
        self.assertEqual(body["subscription"]["state"], "active")
        self.assertIs(body["subscription"]["blocked"], False)
        self.assertEqual(self.inserted(), (COMPANY_ID, 19000, date(2026, 11, 6), date(2026, 12, 6), "pix", "Pix do João", ADMIN_USER))
        (apply_sql,) = self.cur.sql("UPDATE subscriptions")
        self.assertEqual(apply_sql[1], (date(2026, 12, 6), 6, COMPANY_ID))
        self.conn.commit.assert_called_once()

    def test_a_restaurant_made_by_the_script_gets_its_subscription_row_on_the_first_payment(self):
        self.cur.sub = WAITING
        self.post()
        self.assertEqual(self.cur.sql("INSERT INTO subscriptions")[0][1], (COMPANY_ID, "vemcomer_mensal"))

    def test_paying_late_brings_it_back_and_moves_the_due_day(self):
        self.cur.sub = PAST_DUE
        body = self.post().get_json()
        self.assertEqual((body["period_start"], body["period_end"]), ("2026-11-06", "2026-12-06"))
        self.assertEqual(body["subscription"]["state"], "active")

    def test_paying_on_time_continues_the_period(self):
        self.cur.sub = PAID_ON_TIME
        body = self.post().get_json()
        self.assertEqual((body["period_start"], body["period_end"]), ("2026-11-08", "2026-12-08"))

    def test_the_amount_defaults_to_the_price_the_restaurant_signed_with(self):
        self.cur.sub = sub(price=14900)
        self.assertEqual(self.post().get_json()["amount_cents"], 14900)
        self.assertEqual(self.inserted()[1], 14900)

    def test_an_amount_that_was_typed_wins(self):
        self.cur.sub = WAITING
        self.assertEqual(self.post({"amount": "149,50"}).get_json()["amount_cents"], 14950)

    def test_a_bad_amount_or_method_changes_nothing(self):
        self.cur.sub = WAITING
        for body in ({"amount": "abc"}, {"method": "cheque"}):
            reply = self.post(body)
            self.assertEqual(reply.status_code, 400)
        self.assertEqual(self.cur.sql("INSERT INTO subscription_payments"), [])
        self.conn.commit.assert_not_called()

    def test_two_taps_in_a_row_do_not_pay_two_months(self):
        self.cur.sub = PAID_ON_TIME
        self.cur.duplicate = True
        reply = self.post()
        self.assertEqual(reply.status_code, 409)
        self.assertEqual(self.cur.sql("INSERT INTO subscription_payments"), [])
        self.assertEqual(self.cur.sql("UPDATE subscriptions"), [])
        self.conn.commit.assert_not_called()

    def test_an_unknown_restaurant_is_a_404(self):
        self.cur.company_exists = False
        self.assertEqual(self.post().status_code, 404)
        self.conn.commit.assert_not_called()

    def test_paying_undoes_a_cancellation(self):
        self.cur.sub = sub(date(2026, 12, 1), 1, canceled=NOW)
        body = self.post().get_json()
        self.assertEqual(body["subscription"]["state"], "active")
        self.assertIn("canceled_at = NULL", self.cur.sql("UPDATE subscriptions")[0][0])

    def test_only_the_platform_admin_can_register(self):
        self.cur.sub = WAITING
        self.assertEqual(self.post(email="dono@exemplo.com").status_code, 403)
        self.assertEqual(self.cur.sql("INSERT INTO subscription_payments"), [])

    def test_a_restaurant_owner_cannot_register_for_himself(self):
        reply = self.client.post(self.url(), json={}, headers=auth(role="OWNER"))
        # sem o e-mail de administrador no banco, o dono comum é recusado
        with patch.object(backend_app, "query_db", return_value={"email": "dono@exemplo.com"}):
            reply = self.client.post(self.url(), json={}, headers=auth(role="OWNER"))
        self.assertEqual(reply.status_code, 403)

    def test_it_needs_a_login(self):
        self.assertEqual(self.client.post(self.url(), json={}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
