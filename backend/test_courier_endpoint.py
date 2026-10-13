"""Rotas do motoqueiro e do acerto do dinheiro. Roda no CI (precisa do Flask); o banco é simulado e responde pelo texto do SQL."""

import os
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import courier  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
ORDER_ID = "bbbbbbbb-0000-4000-8000-00000000000a"
ORDER_2 = "bbbbbbbb-0000-4000-8000-00000000000b"
ME = "aaaaaaaa-0000-4000-8000-000000000002"
OTHER = "aaaaaaaa-0000-4000-8000-000000000003"

BASE = f"/api/companies/{COMPANY_ID}"
LIST_URL = f"{BASE}/courier/orders"
PICKUP_URL = f"{LIST_URL}/{ORDER_ID}/pickup"
DELIVER_URL = f"{LIST_URL}/{ORDER_ID}/deliver"
CASH_URL = f"{BASE}/admin/courier-cash"
SETTLE_URL = f"{CASH_URL}/{ME}/settle"


def auth(role="COURIER", company_id=COMPANY_ID, user_id=ME):
    token = backend_app.serializer.dumps({"user_id": user_id, "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


def norm(sql):
    return " ".join(sql.split())


def lock_row(**extra):
    row = {
        "order_type": "entrega", "status": "pronto", "courier_id": None, "delivery_code": "0427",
        "code_attempts": 0, "total_price": Decimal("50.00"), "payment_method": "pix", "payment_status": "PAID",
    }
    row.update(extra)
    return row


class FakeCursor:
    """Responde pelo texto do SQL, como o banco responderia; guarda o que foi executado."""

    def __init__(self, lock=None, picked=True, why=None, attempts_after=1, listed=(), cash=(), settled=()):
        self.lock, self.picked, self.why, self.attempts_after = lock, picked, why, attempts_after
        self.listed, self.cash, self.settled = list(listed), list(cash), list(settled)
        self.executed = []
        self._last = ""

    def execute(self, sql, params=()):
        self._last = norm(sql)
        self.executed.append((self._last, params))

    def fetchone(self):
        if self._last == norm(courier.SQL_PICKUP):
            return {"id": ORDER_ID} if self.picked else None
        if self._last == norm(courier.SQL_WHY):
            return self.why
        if self._last == norm(courier.SQL_LOCK_FOR_DELIVERY):
            return self.lock
        if self._last == norm(courier.SQL_COUNT_WRONG_CODE):
            return {"code_attempts": self.attempts_after}
        return None

    def fetchall(self):
        if self._last == norm(courier.SQL_LIST):
            return self.listed
        if self._last == norm(courier.SQL_CASH_OPEN):
            return self.cash
        if self._last == norm(courier.SQL_SETTLE):
            return self.settled
        return []

    def ran(self, sql):
        return [params for text, params in self.executed if text == norm(sql)]

    def events(self):
        return [params[1] for text, params in self.executed if text == norm(courier.SQL_EVENT)]

    def close(self):
        pass


class Base(unittest.TestCase):
    cursor_args: dict = {}

    def setUp(self):
        self.client = backend_app.app.test_client()
        self.conn = MagicMock()
        self.conn.closed = False
        self.cur = FakeCursor(**self.cursor_args)
        self.conn.cursor.return_value = self.cur
        patcher = patch.object(backend_app, "get_db_connection", return_value=self.conn)
        patcher.start()
        self.addCleanup(patcher.stop)


# ------------------------------------------------------------------------------------------- lista

LISTED = {
    "id": ORDER_ID, "customer_name": "Ana", "customer_phone": "31999998888", "delivery_zone": "Centro",
    "delivery_address": {"street": "Rua A", "number": "10"}, "status": "pronto", "total_price": Decimal("50.00"),
    "payment_method": "dinheiro", "payment_change": Decimal("100.00"), "courier_id": None, "picked_up_at": None,
    "delivered_at": None, "cash_received": None, "cash_settled_at": None, "needs_code": True,
    "payment_status": "PENDING", "delivery_code": "0427",
}


class ListTests(Base):
    cursor_args = {"listed": [LISTED]}

    def test_the_courier_sees_the_deliveries_without_the_code(self):
        reply = self.client.get(LIST_URL, headers=auth())
        self.assertEqual(reply.status_code, 200)
        text = reply.get_data(as_text=True)
        self.assertNotIn("0427", text)
        self.assertNotIn("delivery_code", text)
        order = reply.get_json()[0]
        self.assertEqual((order["customer_name"], order["address"], order["cash_to_receive"]), ("Ana", "Rua A, 10", "50.00"))
        self.assertEqual(order["change_back"], "50.00")
        self.assertTrue(order["needs_code"])

    def test_the_query_is_scoped_to_the_company_of_the_login_and_to_the_courier(self):
        self.client.get(LIST_URL, headers=auth())
        self.assertEqual(self.cur.ran(courier.SQL_LIST), [(COMPANY_ID, ME, False, ME)])

    def test_owner_and_manager_see_every_courier(self):
        for role in ("OWNER", "MANAGER"):
            self.cur.executed.clear()
            self.client.get(LIST_URL, headers=auth(role))
            self.assertEqual(self.cur.ran(courier.SQL_LIST), [(COMPANY_ID, ME, True, ME)], role)

    def test_other_roles_have_no_business_here(self):
        for role in ("WAITER", "CASHIER", "KITCHEN"):
            self.assertEqual(self.client.get(LIST_URL, headers=auth(role)).status_code, 403, role)
        self.assertEqual(self.client.get(LIST_URL).status_code, 401)

    def test_another_restaurant_is_refused(self):
        reply = self.client.get(f"/api/companies/{OTHER_COMPANY_ID}/courier/orders", headers=auth())
        self.assertEqual(reply.status_code, 403)
        self.conn.cursor.assert_not_called()


# ------------------------------------------------------------------------------------------- pegar

class PickupTests(Base):
    def test_picking_up_writes_the_courier_and_the_two_events(self):
        reply = self.client.post(PICKUP_URL, headers=auth())
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json(), {"ok": True, "already": False})
        self.assertEqual(self.cur.ran(courier.SQL_PICKUP), [(ME, ORDER_ID, COMPANY_ID, ME, ME)])
        self.assertEqual(self.cur.events(), ["COURIER_PICKUP", "STATUS_SAIU_PARA_ENTREGA"])
        self.conn.commit.assert_called_once()

    def test_owner_and_manager_can_take_a_delivery_themselves(self):
        for role in ("OWNER", "MANAGER"):
            self.assertEqual(self.client.post(PICKUP_URL, headers=auth(role)).status_code, 200, role)

    def test_waiters_and_cashiers_cannot(self):
        for role in ("WAITER", "CASHIER", "KITCHEN"):
            self.assertEqual(self.client.post(PICKUP_URL, headers=auth(role)).status_code, 403, role)
        self.conn.commit.assert_not_called()


class PickupRefusedTests(Base):
    cursor_args = {"picked": False}

    def refuse(self, why):
        self.cur.why = why
        reply = self.client.post(PICKUP_URL, headers=auth())
        self.conn.commit.assert_not_called()
        self.assertEqual(self.cur.events(), [])
        return reply

    def test_tapping_twice_is_fine_and_writes_nothing_new(self):
        reply = self.refuse(lock_row(courier_id=ME, status="saiu para entrega"))
        self.assertEqual((reply.status_code, reply.get_json()["already"]), (200, True))

    def test_another_courier_got_there_first(self):
        reply = self.refuse(lock_row(courier_id=OTHER, status="saiu para entrega"))
        self.assertEqual(reply.status_code, 409)
        self.assertIn("Outro motoqueiro", reply.get_json()["error"])

    def test_not_ready_yet(self):
        reply = self.refuse(lock_row(status="em preparo"))
        self.assertEqual(reply.status_code, 409)
        self.assertIn("ainda não está pronto", reply.get_json()["error"])

    def test_not_found_in_this_restaurant(self):
        self.assertEqual(self.refuse(None).status_code, 404)
        self.assertEqual(self.cur.ran(courier.SQL_WHY), [(ORDER_ID, COMPANY_ID)])

    def test_not_a_delivery(self):
        self.assertEqual(self.refuse(lock_row(order_type="mesa")).status_code, 400)


# ------------------------------------------------------------------------------------------- entregar

class DeliverTests(Base):
    cursor_args = {"lock": lock_row()}

    def deliver(self, body=None, role="COURIER"):
        return self.client.post(DELIVER_URL, json={"code": "0427"} if body is None else body, headers=auth(role))

    def test_the_right_code_closes_the_delivery(self):
        reply = self.deliver()
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json(), {"ok": True, "already": False, "cash_to_hand_over": "0.00"})
        self.assertEqual(self.cur.ran(courier.SQL_DELIVER), [(ME, None, ORDER_ID, COMPANY_ID)])
        self.assertEqual(self.cur.events(), ["STATUS_CONCLUIDO", "COURIER_DELIVERED"])
        self.conn.commit.assert_called_once()

    def test_the_order_is_locked_before_it_is_read(self):
        self.deliver()
        self.assertEqual(self.cur.executed[0][0], norm(courier.SQL_LOCK_FOR_DELIVERY))
        self.assertEqual(self.cur.executed[0][1], (ORDER_ID, COMPANY_ID))

    def test_the_code_may_come_with_spaces(self):
        self.assertEqual(self.deliver({"code": " 0 4 2 7"}).status_code, 200)

    def test_cash_delivery_stays_open_in_the_name_of_the_courier(self):
        self.cur.lock = lock_row(payment_method="dinheiro", payment_status="PENDING", total_price=Decimal("47.90"))
        reply = self.deliver()
        self.assertEqual(reply.get_json()["cash_to_hand_over"], "47.90")
        self.assertEqual(self.cur.ran(courier.SQL_DELIVER), [(ME, "47.90", ORDER_ID, COMPANY_ID)])

    def test_a_wrong_code_counts_a_try_and_keeps_it_even_though_nothing_else_changes(self):
        self.cur.attempts_after = 1
        reply = self.deliver({"code": "1111"})
        body = reply.get_json()
        self.assertEqual(reply.status_code, 400)
        self.assertTrue(body["wrong_code"])
        self.assertEqual((body["attempts_left"], body["locked"]), (4, False))
        self.assertIn("Restam 4 tentativas", body["error"])
        self.assertEqual(self.cur.ran(courier.SQL_COUNT_WRONG_CODE), [(ORDER_ID, COMPANY_ID)])
        self.conn.commit.assert_called_once()  # a tentativa errada é gravada
        self.assertEqual(self.cur.ran(courier.SQL_DELIVER), [])
        self.assertEqual(self.cur.events(), [])

    def test_the_fifth_wrong_code_locks_the_delivery(self):
        self.cur.lock = lock_row(code_attempts=4)
        self.cur.attempts_after = 5
        reply = self.deliver({"code": "1111"})
        self.assertEqual(reply.status_code, 423)
        self.assertEqual((reply.get_json()["locked"], reply.get_json()["attempts_left"]), (True, 0))
        self.assertEqual(reply.get_json()["error"], courier.LOCKED_MESSAGE)
        self.assertEqual(self.cur.ran(courier.SQL_DELIVER), [])

    def test_a_locked_delivery_refuses_even_the_right_code_and_counts_nothing_more(self):
        self.cur.lock = lock_row(code_attempts=5)
        reply = self.deliver({"code": "0427"})
        self.assertEqual(reply.status_code, 423)
        self.assertTrue(reply.get_json()["locked"])
        self.assertEqual(self.cur.ran(courier.SQL_COUNT_WRONG_CODE), [])
        self.assertEqual(self.cur.ran(courier.SQL_DELIVER), [])
        self.conn.commit.assert_not_called()

    def test_a_code_that_is_not_four_numbers_is_not_a_try(self):
        for body in ({"code": "42"}, {"code": ""}, {"code": "abcd"}, {}, {"code": None}, {"code": ["0427"]}):
            reply = self.deliver(body)
            self.assertEqual(reply.status_code, 400, body)
            self.assertIn("4 números", reply.get_json()["error"])
        self.assertEqual(self.cur.ran(courier.SQL_COUNT_WRONG_CODE), [])
        self.conn.commit.assert_not_called()

    def test_a_body_that_is_not_json_is_the_same_as_no_code(self):
        reply = self.client.post(DELIVER_URL, data="lixo", headers=auth())
        self.assertEqual(reply.status_code, 400)
        self.assertEqual(self.cur.ran(courier.SQL_DELIVER), [])

    def test_an_old_order_without_a_code_closes_without_one(self):
        self.cur.lock = lock_row(delivery_code=None)
        self.assertEqual(self.deliver({}).status_code, 200)
        self.assertEqual(len(self.cur.ran(courier.SQL_DELIVER)), 1)

    def test_a_second_tap_after_delivering_is_fine_and_changes_nothing(self):
        self.cur.lock = lock_row(status="concluido", courier_id=ME)
        reply = self.deliver()
        self.assertEqual((reply.status_code, reply.get_json()["already"]), (200, True))
        self.assertEqual(self.cur.ran(courier.SQL_DELIVER), [])
        self.assertEqual(self.cur.events(), [])
        self.conn.commit.assert_not_called()

    def test_the_order_of_another_courier_is_refused(self):
        self.cur.lock = lock_row(courier_id=OTHER, status="saiu para entrega")
        reply = self.deliver()
        self.assertEqual(reply.status_code, 409)
        self.assertEqual(self.cur.ran(courier.SQL_COUNT_WRONG_CODE), [])
        self.assertEqual(self.cur.ran(courier.SQL_DELIVER), [])

    def test_an_order_that_is_not_ready_is_refused(self):
        self.cur.lock = lock_row(status="em preparo")
        self.assertEqual(self.deliver().status_code, 409)
        self.assertEqual(self.cur.ran(courier.SQL_DELIVER), [])

    def test_an_order_of_another_restaurant_is_not_found(self):
        self.cur.lock = None
        self.assertEqual(self.deliver().status_code, 404)

    def test_who_may_deliver(self):
        for role in ("OWNER", "MANAGER", "COURIER"):
            self.assertEqual(self.deliver(role=role).status_code, 200, role)
        for role in ("WAITER", "CASHIER", "KITCHEN"):
            self.assertEqual(self.deliver(role=role).status_code, 403, role)

    def test_the_answer_never_carries_the_code(self):
        self.assertNotIn("0427", self.deliver().get_data(as_text=True))
        self.assertNotIn("0427", self.deliver({"code": "1111"}).get_data(as_text=True))


# ------------------------------------------------------------------------------------------- o motoqueiro não passa por fora

class CourierCannotBypassTests(Base):
    def test_a_courier_login_cannot_close_an_order_without_the_code(self):
        for status in ("concluido", "saiu para entrega", "em preparo"):
            reply = self.client.put(f"/api/orders/{ORDER_ID}/status", json={"status": status}, headers=auth("COURIER"))
            self.assertEqual(reply.status_code, 403, status)
        self.conn.cursor.assert_not_called()

    def test_a_courier_login_cannot_list_every_order_of_the_restaurant(self):
        reply = self.client.get(f"{BASE}/admin/orders", headers=auth("COURIER"))
        self.assertEqual(reply.status_code, 403)
        self.conn.cursor.assert_not_called()

    def test_the_restaurant_staff_still_changes_the_status_like_before(self):
        for role in ("OWNER", "MANAGER", "KITCHEN", "CASHIER", "WAITER"):
            reply = self.client.put(f"/api/orders/{ORDER_ID}/status", json={"status": "concluido"}, headers=auth(role))
            self.assertNotEqual(reply.status_code, 403, role)

    def test_a_courier_cannot_confirm_payments_or_settle_the_cash(self):
        self.assertEqual(self.client.post(f"/api/orders/{ORDER_ID}/payment/confirm", headers=auth("COURIER")).status_code, 403)
        self.assertEqual(self.client.get(CASH_URL, headers=auth("COURIER")).status_code, 403)
        self.assertEqual(self.client.post(SETTLE_URL, json={"order_ids": [ORDER_ID]}, headers=auth("COURIER")).status_code, 403)


# ------------------------------------------------------------------------------------------- acerto

WHEN = datetime(2026, 10, 13, 15, 30, tzinfo=timezone.utc)
CASH_ROWS = [
    {"id": ORDER_ID, "courier_id": ME, "courier_name": "Ana", "customer_name": "A", "delivery_zone": "Centro",
     "delivered_at": WHEN, "cash_received": Decimal("50.00")},
    {"id": ORDER_2, "courier_id": ME, "courier_name": "Ana", "customer_name": "B", "delivery_zone": "Norte",
     "delivered_at": WHEN, "cash_received": Decimal("12.50")},
]


class CashListTests(Base):
    cursor_args = {"cash": CASH_ROWS}

    def test_the_cashier_sees_what_each_courier_holds(self):
        for role in ("OWNER", "MANAGER", "CASHIER"):
            reply = self.client.get(CASH_URL, headers=auth(role))
            self.assertEqual(reply.status_code, 200, role)
        body = reply.get_json()
        self.assertEqual((body["total"], body["count"]), ("62.50", 2))
        self.assertEqual(body["couriers"][0]["name"], "Ana")
        self.assertEqual(body["couriers"][0]["total"], "62.50")

    def test_scoped_to_the_restaurant_of_the_login(self):
        self.client.get(CASH_URL, headers=auth("CASHIER"))
        self.assertEqual(self.cur.ran(courier.SQL_CASH_OPEN), [(COMPANY_ID,)])

    def test_waiters_and_kitchen_do_not_see_it(self):
        for role in ("WAITER", "KITCHEN"):
            self.assertEqual(self.client.get(CASH_URL, headers=auth(role)).status_code, 403, role)
        other = self.client.get(f"/api/companies/{OTHER_COMPANY_ID}/admin/courier-cash", headers=auth("OWNER"))
        self.assertEqual(other.status_code, 403)


class SettleTests(Base):
    cursor_args = {"settled": [
        {"id": ORDER_ID, "cash_received": Decimal("50.00")}, {"id": ORDER_2, "cash_received": Decimal("12.50")},
    ]}

    def settle(self, body=None, role="CASHIER", url=SETTLE_URL):
        return self.client.post(url, json={"order_ids": [ORDER_ID, ORDER_2]} if body is None else body, headers=auth(role, user_id="cashier-1"))

    def test_settling_closes_the_open_cash_marks_it_paid_and_writes_the_events(self):
        reply = self.settle()
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json(), {"ok": True, "count": 2, "total": "62.50"})
        # (quem acertou, restaurante, motoqueiro, pedidos)
        self.assertEqual(self.cur.ran(courier.SQL_SETTLE), [("cashier-1", COMPANY_ID, ME, [ORDER_ID, ORDER_2])])
        self.assertEqual(self.cur.ran(courier.SQL_MARK_PAID), [([ORDER_ID, ORDER_2], COMPANY_ID)])
        self.assertEqual(self.cur.events(), ["CASH_SETTLED", "CASH_SETTLED"])
        self.conn.commit.assert_called_once()

    def test_only_what_the_database_really_settled_is_marked_paid(self):
        self.cur.settled = [{"id": ORDER_2, "cash_received": Decimal("12.50")}]  # o outro já estava acertado
        reply = self.settle()
        self.assertEqual(reply.get_json(), {"ok": True, "count": 1, "total": "12.50"})
        self.assertEqual(self.cur.ran(courier.SQL_MARK_PAID), [([ORDER_2], COMPANY_ID)])

    def test_nothing_to_settle_is_a_conflict_and_changes_nothing(self):
        self.cur.settled = []
        reply = self.settle()
        self.assertEqual(reply.status_code, 409)
        self.assertEqual(self.cur.ran(courier.SQL_MARK_PAID), [])
        self.conn.commit.assert_not_called()
        self.conn.rollback.assert_called()

    def test_a_bad_list_is_refused_before_touching_the_database(self):
        for body in ({}, {"order_ids": []}, {"order_ids": ["x"]}, {"order_ids": "all"}):
            self.assertEqual(self.settle(body).status_code, 400, body)
        self.conn.cursor.assert_not_called()

    def test_who_may_settle(self):
        for role in ("OWNER", "MANAGER", "CASHIER"):
            self.assertEqual(self.settle(role=role).status_code, 200, role)
        for role in ("WAITER", "KITCHEN", "COURIER"):
            self.assertEqual(self.settle(role=role).status_code, 403, role)

    def test_another_restaurant_is_refused(self):
        url = f"/api/companies/{OTHER_COMPANY_ID}/admin/courier-cash/{ME}/settle"
        self.assertEqual(self.settle(url=url).status_code, 403)
        self.conn.cursor.assert_not_called()

    def test_a_database_failure_answers_a_plain_error_and_rolls_back(self):
        self.conn.cursor.side_effect = RuntimeError("boom")
        reply = self.settle()
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("boom", reply.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
