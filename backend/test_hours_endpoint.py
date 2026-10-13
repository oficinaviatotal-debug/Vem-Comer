"""Rotas do horário, da pausa e do "esgotou": pedido recusado fora do horário, telas do dono e a página pública.

Roda no CI (precisa do Flask); o banco é simulado por um cursor que responde pelo texto do SQL.
"""

import os
import unittest
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import hours  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_ID = "22222222-2222-4222-8222-222222222222"
PRODUCT_ID = "33333333-3333-4333-8333-333333333333"
ORDER_ID = "55555555-5555-4555-8555-555555555555"
ORDERS_URL = f"/api/companies/{COMPANY_ID}/orders"

B = hours.BRAZIL
LUNCH_DINNER = [{"opens": "11:00", "closes": "15:00"}, {"opens": "18:00", "closes": "23:00"}]


def at(day, hour, minute=0):
    return datetime(2026, 10, 12 + day, hour, minute, tzinfo=B)  # 12/10/2026 é segunda


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


def week_payload(shifts=None, closed=(6,)):
    return {"week": [{"weekday": d, "closed": d in closed, "shifts": [] if d in closed else (shifts or LUNCH_DINNER)} for d in range(7)]}


def rows_of(payload):
    week = hours.normalize_week(payload)
    out = []
    for day in week:
        first = day["shifts"][0] if day["shifts"] else None
        second = day["shifts"][1] if len(day["shifts"]) > 1 else None
        out.append({"weekday": day["weekday"], "opens_at": hours.clock(first[0]) if first else None,
                    "closes_at": hours.clock(first[1]) if first else None, "accepts_orders": not day["closed"],
                    "opens_at_2": hours.clock(second[0]) if second else None,
                    "closes_at_2": hours.clock(second[1]) if second else None})
    return out


class FakeCursor:
    def __init__(self):
        self.paused = False
        self.hours_rows = []
        self.sold_out = False
        self.product_exists = True
        self.updated = 1
        self.rowcount = 1
        self.executed = []
        self._last = ""

    def execute(self, sql, params=()):
        self.executed.append((" ".join(sql.split()), params))
        self._last = self.executed[-1][0]
        if self._last.startswith(("UPDATE products", "UPDATE companies")):
            self.rowcount = self.updated if self.product_exists else 0

    def fetchone(self):
        last = self._last
        if last.startswith("SELECT orders_paused FROM companies"):
            return {"orders_paused": self.paused}
        if last.startswith("SELECT id FROM companies"):
            return {"id": COMPANY_ID}
        if "FROM companies" in last:
            return {"id": COMPANY_ID, "accepts_pickup": True, "delivery_paused": False}
        if "FROM tables" in last:
            return {"id": "x"}
        if "FROM products" in last:
            return {"id": PRODUCT_ID, "price": Decimal("20.00"), "name": "Pastel de carne", "sold_out": self.sold_out}
        if "INSERT INTO orders" in last:
            return {"id": ORDER_ID}
        return None

    def fetchall(self):
        return list(self.hours_rows) if "FROM business_hours" in self._last else []

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
        for patcher in (
            patch.object(backend_app, "get_db_connection", return_value=self.conn),
            patch.object(backend_app, "order_unit_costs", return_value={}),
            patch.object(backend_app.item_options, "fetch_groups", return_value=[]),
            patch.dict(os.environ, {"BILLING_ENFORCED": ""}),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def clock(self, moment):
        patcher = patch.object(hours, "local_now", return_value=moment)
        patcher.start()
        self.addCleanup(patcher.stop)


class OrderGateTests(Base):
    def send(self, table=None):
        body = {"customer_name": "Ana", "payment_method": "pix", "items": [{"id": PRODUCT_ID, "quantity": 1}]}
        if table:
            body["table_id"] = table
        return self.client.post(ORDERS_URL, json=body)

    def test_without_hours_and_without_a_pause_the_order_goes_in(self):
        self.assertEqual(self.send().status_code, 201)

    def test_outside_the_hours_a_pickup_or_delivery_is_refused_with_when_it_opens(self):
        self.cur.hours_rows = rows_of(week_payload())
        self.clock(at(1, 16))
        reply = self.send()
        self.assertEqual(reply.status_code, 403, reply.get_data(as_text=True))
        self.assertEqual(reply.get_json(), {"error": "Fechado agora. Abre hoje às 18h.", "code": "closed_now"})
        self.assertEqual(self.cur.sql("INSERT INTO orders"), [], "nada foi gravado")
        self.conn.commit.assert_not_called()

    def test_inside_the_hours_it_goes_in(self):
        self.cur.hours_rows = rows_of(week_payload())
        self.clock(at(1, 12))
        self.assertEqual(self.send().status_code, 201)

    def test_a_table_order_ignores_the_hours_and_does_not_even_read_them(self):
        self.cur.hours_rows = rows_of(week_payload())
        self.clock(at(6, 12))  # domingo, fechado
        reply = self.send(table="44444444-4444-4444-8444-444444444444")
        self.assertEqual(reply.status_code, 201, reply.get_data(as_text=True))
        self.assertEqual(self.cur.sql("FROM business_hours"), [])

    def test_a_pause_stops_every_order_even_at_the_table_and_even_with_no_hours(self):
        self.cur.paused = True
        for table in (None, "44444444-4444-4444-8444-444444444444"):
            reply = self.send(table=table)
            self.assertEqual(reply.status_code, 403)
            self.assertEqual(reply.get_json()["code"], "paused")
            self.assertEqual(reply.get_json()["error"], hours.PAUSED_MESSAGE)
        self.assertEqual(self.cur.sql("INSERT INTO orders"), [])

    def test_the_checks_are_tied_to_the_restaurant_of_the_order(self):
        self.cur.hours_rows = rows_of(week_payload())
        self.clock(at(1, 12))
        self.send()
        for needle in ("SELECT orders_paused FROM companies", "FROM business_hours"):
            (_, params), = self.cur.sql(needle)
            self.assertEqual(params, (COMPANY_ID,), needle)

    def test_a_sold_out_dish_is_refused_by_name_and_nothing_is_saved(self):
        self.cur.sold_out = True
        reply = self.send()
        self.assertEqual(reply.status_code, 400, reply.get_data(as_text=True))
        self.assertIn("Pastel de carne acabou", reply.get_json()["error"])
        self.assertEqual(self.cur.sql("INSERT INTO orders"), [])
        self.conn.commit.assert_not_called()

    def test_a_dish_that_is_not_sold_out_is_fine(self):
        self.cur.sold_out = False
        self.assertEqual(self.send().status_code, 201)


class PublicPageTests(Base):
    def get(self, rows, paused=False):
        company = {"id": COMPANY_ID, "name": "Saiteria", "slug": "saiteria", "logo_key": None, "orders_paused": paused}
        with patch.object(backend_app, "query_db", side_effect=[company, rows]):
            return self.client.get("/api/companies/by-slug/saiteria").get_json()

    def test_no_hours_means_open_and_says_nothing(self):
        body = self.get([])
        self.assertEqual(body["hours"], {"configured": False, "open_now": True, "message": "", "paused": False})
        self.assertIs(body["accepting_orders"], True)
        self.assertNotIn("orders_paused", body)

    def test_closed_now_says_when_it_opens_but_shows_no_shifts(self):
        self.clock(at(1, 16))
        body = self.get(rows_of(week_payload()))
        self.assertEqual(body["hours"], {"configured": True, "open_now": False,
                                         "message": "Fechado agora. Abre hoje às 18h.", "paused": False})
        self.assertIs(body["accepting_orders"], True, "o horario nao fecha a mesa: quem decide e o cliente (mesa ou nao)")

    def test_a_pause_closes_everything(self):
        body = self.get([], paused=True)
        self.assertIs(body["accepting_orders"], False)
        self.assertIs(body["hours"]["paused"], True)

    def test_a_hours_error_never_closes_the_restaurant(self):
        company = {"id": COMPANY_ID, "name": "Saiteria", "slug": "saiteria", "logo_key": None, "orders_paused": False}
        with patch.object(backend_app, "query_db", side_effect=[company, RuntimeError("banco fora")]):
            body = self.client.get("/api/companies/by-slug/saiteria").get_json()
        self.assertTrue(body["hours"]["open_now"])
        self.assertIs(body["accepting_orders"], True)

    def test_the_list_of_dishes_carries_the_sold_out_flag(self):
        dishes = [{"id": PRODUCT_ID, "company_id": COMPANY_ID, "menu_id": None, "name": "Pastel", "description": None,
                   "price": Decimal("8.00"), "image_key": None, "sold_out": True}]
        with patch.object(backend_app, "query_db", side_effect=[dishes, []]) as q:
            body = self.client.get(f"/api/companies/{COMPANY_ID}/products").get_json()
        self.assertIn("sold_out", q.call_args_list[0].args[0])
        self.assertIs(body[0]["sold_out"], True)


class AdminHoursTests(Base):
    URL = "/api/admin/hours"

    def test_requires_login_and_the_right_role(self):
        self.assertEqual(self.client.get(self.URL).status_code, 401)
        for role in ("WAITER", "CASHIER", "COURIER"):
            self.assertEqual(self.client.get(self.URL, headers=auth(role)).status_code, 403, role)
        for role in ("OWNER", "MANAGER", "KITCHEN"):
            with patch.object(backend_app, "query_db", side_effect=[[], {"orders_paused": False}]):
                self.assertEqual(self.client.get(self.URL, headers=auth(role)).status_code, 200, role)

    def test_the_owner_sees_seven_days_and_the_pause(self):
        self.clock(at(1, 12))
        with patch.object(backend_app, "query_db", side_effect=[rows_of(week_payload()), {"orders_paused": True}]) as q:
            body = self.client.get(self.URL, headers=auth()).get_json()
        self.assertEqual(len(body["week"]), 7)
        self.assertTrue(body["orders_paused"])
        self.assertTrue(body["configured"])
        for call in q.call_args_list:
            self.assertEqual(call.args[1], (COMPANY_ID,))

    def test_saving_replaces_the_week_in_one_transaction_for_the_company_of_the_login(self):
        reply = self.client.put(self.URL, json=week_payload(), headers=auth("MANAGER"))
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        self.assertEqual(reply.get_json()["message"], "Horario salvo")
        self.assertEqual(len(self.cur.sql("DELETE FROM business_hours")), 1)
        inserts = self.cur.sql("INSERT INTO business_hours")
        self.assertEqual(len(inserts), 7)
        for _, params in inserts:
            self.assertEqual(params[0], COMPANY_ID)
        self.assertEqual(inserts[0][1], (COMPANY_ID, 0, "11:00", "15:00", True, "18:00", "23:00"))
        self.assertEqual(inserts[6][1], (COMPANY_ID, 6, None, None, False, None, None))
        self.assertEqual(self.cur.sql("FOR UPDATE")[0][1], (COMPANY_ID,), "trava a linha do restaurante")
        self.conn.commit.assert_called_once()

    def test_a_bad_week_is_explained_and_nothing_is_touched(self):
        bad = week_payload()
        bad["week"][2]["shifts"] = [{"opens": "11:00", "closes": "11:00"}]
        reply = self.client.put(self.URL, json=bad, headers=auth())
        self.assertEqual(reply.status_code, 400)
        self.assertIn("mesma hora", reply.get_json()["error"])
        self.assertEqual(self.cur.executed, [])
        self.conn.commit.assert_not_called()
        for junk in (None, {}, {"week": []}, "x"):
            self.assertEqual(self.client.put(self.URL, json=junk, headers=auth()).status_code, 400)

    def test_the_kitchen_cannot_change_the_hours_but_can_read_them(self):
        self.assertEqual(self.client.put(self.URL, json=week_payload(), headers=auth("KITCHEN")).status_code, 403)
        self.assertEqual(self.client.delete(self.URL, headers=auth("KITCHEN")).status_code, 403)

    def test_removing_the_hours_clears_only_this_restaurant(self):
        reply = self.client.delete(self.URL, headers=auth())
        self.assertEqual(reply.status_code, 200)
        (_, params), = self.cur.sql("DELETE FROM business_hours")
        self.assertEqual(params, (COMPANY_ID,))
        self.conn.commit.assert_called_once()


class PauseTests(Base):
    URL = "/api/admin/orders-pause"

    def test_pausing_and_resuming(self):
        for paused in (True, False):
            self.cur.executed.clear()
            reply = self.client.put(self.URL, json={"paused": paused}, headers=auth("KITCHEN"))
            self.assertEqual(reply.status_code, 200)
            self.assertEqual(reply.get_json(), {"orders_paused": paused})
            (sql, params), = self.cur.sql("UPDATE companies")
            self.assertEqual(params, (paused, COMPANY_ID))

    def test_only_a_real_yes_or_no_is_accepted(self):
        for body in ({}, {"paused": "true"}, {"paused": 1}, {"paused": None}):
            self.assertEqual(self.client.put(self.URL, json=body, headers=auth()).status_code, 400, body)
        self.assertEqual(self.cur.executed, [])

    def test_waiters_cashiers_and_couriers_cannot_pause(self):
        for role in ("WAITER", "CASHIER", "COURIER"):
            self.assertEqual(self.client.put(self.URL, json={"paused": True}, headers=auth(role)).status_code, 403, role)
        self.assertEqual(self.client.put(self.URL, json={"paused": True}).status_code, 401)


class SoldOutTests(Base):
    def url(self, product=PRODUCT_ID):
        return f"/api/admin/products/{product}/sold-out"

    def test_one_tap_marks_and_unmarks_a_dish_of_this_restaurant_only(self):
        for flag in (True, False):
            self.cur.executed.clear()
            reply = self.client.put(self.url(), json={"sold_out": flag}, headers=auth("KITCHEN"))
            self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
            self.assertEqual(reply.get_json(), {"id": PRODUCT_ID, "sold_out": flag})
            (sql, params), = self.cur.sql("UPDATE products")
            self.assertEqual(params, (flag, PRODUCT_ID, COMPANY_ID))
            self.assertIn("AND company_id = %s", sql)

    def test_a_dish_of_another_restaurant_is_a_404(self):
        self.cur.product_exists = False
        reply = self.client.put(self.url(), json={"sold_out": True}, headers=auth())
        self.assertEqual(reply.status_code, 404)
        self.conn.commit.assert_not_called()

    def test_only_a_real_yes_or_no_is_accepted(self):
        for body in ({}, {"sold_out": "sim"}, {"sold_out": 1}):
            self.assertEqual(self.client.put(self.url(), json=body, headers=auth()).status_code, 400)
        self.assertEqual(self.cur.executed, [])

    def test_roles(self):
        for role in ("WAITER", "CASHIER", "COURIER"):
            self.assertEqual(self.client.put(self.url(), json={"sold_out": True}, headers=auth(role)).status_code, 403)
        self.assertEqual(self.client.put(self.url(), json={"sold_out": True}).status_code, 401)

    def test_back_to_everything_clears_only_this_restaurant(self):
        self.cur.updated = 3
        reply = self.client.post("/api/admin/products/sold-out/reset", headers=auth("MANAGER"))
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        self.assertEqual(reply.get_json(), {"changed": 3})
        (sql, params), = self.cur.sql("UPDATE products")
        self.assertEqual(params, (COMPANY_ID,))
        self.assertIn("SET sold_out = FALSE", sql)
        self.assertEqual(self.client.post("/api/admin/products/sold-out/reset", headers=auth("WAITER")).status_code, 403)


if __name__ == "__main__":
    unittest.main()
