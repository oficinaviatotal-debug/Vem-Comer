"""Motoqueiro: código de entrega, decisões de pegar/entregar e visão do dinheiro. Só regras; não precisa de banco nem de Flask."""

import re
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch

import courier
from courier import CourierError

ME = "aaaaaaaa-0000-4000-8000-000000000002"
OTHER = "aaaaaaaa-0000-4000-8000-000000000003"
ORDER = "bbbbbbbb-0000-4000-8000-00000000000a"


def locked(**extra):
    row = {
        "order_type": "entrega", "status": "pronto", "courier_id": None, "delivery_code": "0427",
        "code_attempts": 0, "total_price": Decimal("50.00"), "payment_method": "pix", "payment_status": "PAID",
    }
    row.update(extra)
    return row


class CodeTests(unittest.TestCase):
    def test_the_code_has_four_digits_and_keeps_leading_zeros(self):
        with patch.object(courier.secrets, "randbelow", return_value=7) as draw:
            self.assertEqual(courier.new_delivery_code(), "0007")
        draw.assert_called_once_with(10_000)
        for _ in range(200):
            self.assertRegex(courier.new_delivery_code(), r"^\d{4}$")

    def test_codes_are_not_all_the_same(self):
        self.assertGreater(len({courier.new_delivery_code() for _ in range(60)}), 20)

    def test_what_the_courier_types_is_cleaned_to_four_digits(self):
        for typed in ("4821", " 4821 ", "4 8 2 1", "48-21", 4821, "4821\n"):
            self.assertEqual(courier.clean_code(typed), "4821", typed)
        self.assertEqual(courier.clean_code("0427"), "0427")

    def test_anything_else_is_not_a_code(self):
        for typed in ("", "482", "48211", "abcd", None, True, False, 4.5, [], {}, "４８２１", "٤٨٢١"):
            self.assertIsNone(courier.clean_code(typed), repr(typed))

    def test_matching_is_exact_and_needs_both_sides(self):
        self.assertTrue(courier.code_matches("0427", "0427"))
        self.assertFalse(courier.code_matches("0427", "0428"))
        self.assertFalse(courier.code_matches("0427", None))
        self.assertFalse(courier.code_matches(None, "0427"))
        self.assertFalse(courier.code_matches("", ""))

    def test_the_comparison_is_the_constant_time_one(self):
        with patch.object(courier.hmac, "compare_digest", return_value=True) as compare:
            self.assertTrue(courier.code_matches("0427", "0427"))
        compare.assert_called_once()

    def test_attempts_run_out_after_five(self):
        self.assertEqual([courier.attempts_left(n) for n in (0, 1, 4, 5, 6, None)], [5, 4, 1, 0, 0, 5])

    def test_the_wrong_code_message_counts_down_in_good_portuguese(self):
        self.assertIn("Restam 4 tentativas", courier.wrong_code_message(1))
        self.assertIn("Resta 1 tentativa.", courier.wrong_code_message(4))
        self.assertEqual(courier.wrong_code_message(5), courier.LOCKED_MESSAGE)
        self.assertIn("restaurante", courier.LOCKED_MESSAGE)


class MoneyAndAddressTests(unittest.TestCase):
    def test_money_always_has_two_decimals_and_never_breaks(self):
        self.assertEqual(courier.money("12.5"), Decimal("12.50"))
        self.assertEqual(courier.money(None), Decimal("0.00"))
        self.assertEqual(courier.money("lixo"), Decimal("0.00"))
        self.assertEqual(courier.money(Decimal("7")), Decimal("7.00"))

    def test_cash_is_owed_only_when_paying_in_cash_and_not_yet_confirmed(self):
        self.assertTrue(courier.owes_cash("dinheiro", "PENDING"))
        self.assertTrue(courier.owes_cash("dinheiro", None))
        self.assertFalse(courier.owes_cash("dinheiro", "PAID"))
        self.assertFalse(courier.owes_cash("pix", "PENDING"))
        self.assertFalse(courier.owes_cash("cartao", "PENDING"))
        self.assertFalse(courier.owes_cash(None, None))

    def test_the_address_comes_on_one_line(self):
        self.assertEqual(
            courier.address_line({"street": "Rua das Flores", "number": "120", "complement": "apto 3",
                                  "neighborhood": "Centro", "city": "BH"}),
            "Rua das Flores, 120 · apto 3 · Centro · BH",
        )
        self.assertEqual(courier.address_line({"street": " Rua  A ", "neighborhood": "Norte"}), "Rua A · Norte")
        self.assertEqual(courier.address_line(None), "")
        self.assertEqual(courier.address_line({"street": 5}), "")


class OrderViewTests(unittest.TestCase):
    def row(self, **extra):
        row = {
            "id": ORDER, "customer_name": "Ana", "customer_phone": "31999998888", "delivery_zone": "Centro",
            "delivery_address": {"street": "Rua A", "number": "10", "reference": "portão azul"},
            "status": "pronto", "total_price": Decimal("50.00"), "payment_method": "dinheiro",
            "payment_change": Decimal("100.00"), "courier_id": None, "picked_up_at": None, "delivered_at": None,
            "cash_received": None, "cash_settled_at": None, "needs_code": True, "payment_status": "PENDING",
            "delivery_code": "0427",
        }
        row.update(extra)
        return row

    def test_the_courier_never_gets_the_code_even_if_the_row_has_it(self):
        view = courier.order_view(self.row(), ME)
        self.assertNotIn("delivery_code", view)
        self.assertNotIn("0427", repr(view))
        self.assertTrue(view["needs_code"])

    def test_cash_to_receive_and_change_to_give_back(self):
        view = courier.order_view(self.row(), ME)
        self.assertEqual((view["cash_to_receive"], view["change_for"], view["change_back"]), ("50.00", "100.00", "50.00"))
        self.assertEqual(view["address"], "Rua A, 10")
        self.assertEqual(view["reference"], "portão azul")

    def test_no_cash_to_receive_when_paid_by_pix_or_already_confirmed(self):
        for method, paid in (("pix", "PENDING"), ("cartao", "PENDING"), ("dinheiro", "PAID")):
            view = courier.order_view(self.row(payment_method=method, payment_status=paid, payment_change=Decimal("0")), ME)
            self.assertEqual((view["cash_to_receive"], view["change_for"], view["change_back"]), ("0.00", "", ""), method)

    def test_exact_money_needs_no_change(self):
        view = courier.order_view(self.row(payment_change=Decimal("50.00")), ME)
        self.assertEqual((view["change_for"], view["change_back"]), ("", ""))

    def test_whose_order_it_is(self):
        free = courier.order_view(self.row(), ME)
        mine = courier.order_view(self.row(courier_id=ME), ME)
        theirs = courier.order_view(self.row(courier_id=OTHER), ME)
        self.assertEqual((free["mine"], free["taken_by_other"]), (False, False))
        self.assertEqual((mine["mine"], mine["taken_by_other"]), (True, False))
        self.assertEqual((theirs["mine"], theirs["taken_by_other"]), (False, True))

    def test_times_and_settlement_state(self):
        when = datetime(2026, 10, 13, 15, 30, tzinfo=timezone.utc)
        view = courier.order_view(
            self.row(status="concluido", courier_id=ME, delivered_at=when, cash_received=Decimal("50"),
                     cash_settled_at=when), ME)
        self.assertEqual(view["delivered_at"], when.isoformat())
        self.assertEqual((view["cash_received"], view["settled"]), ("50.00", True))

    def test_an_address_that_is_not_an_object_does_not_break_the_screen(self):
        view = courier.order_view(self.row(delivery_address="texto solto"), ME)
        self.assertEqual((view["address"], view["reference"]), ("", ""))


class SettlementViewTests(unittest.TestCase):
    def test_open_cash_is_grouped_by_courier_with_totals(self):
        when = datetime(2026, 10, 13, 15, 30, tzinfo=timezone.utc)
        rows = [
            {"id": "o1", "courier_id": OTHER, "courier_name": "beto", "customer_name": "A", "delivery_zone": "Norte",
             "delivered_at": when, "cash_received": Decimal("35.00")},
            {"id": "o2", "courier_id": ME, "courier_name": "Ana", "customer_name": "B", "delivery_zone": "Centro",
             "delivered_at": when, "cash_received": Decimal("50.00")},
            {"id": "o3", "courier_id": ME, "courier_name": "Ana", "customer_name": "C", "delivery_zone": None,
             "delivered_at": None, "cash_received": Decimal("12.50")},
        ]
        view = courier.settlement_view(rows)
        self.assertEqual([g["name"] for g in view["couriers"]], ["Ana", "beto"])
        ana = view["couriers"][0]
        self.assertEqual((ana["total"], ana["count"], len(ana["orders"])), ("62.50", 2, 2))
        self.assertEqual((view["total"], view["count"]), ("97.50", 3))
        self.assertEqual(ana["orders"][0]["amount"], "50.00")

    def test_nothing_open_is_an_empty_list_with_zero(self):
        self.assertEqual(courier.settlement_view([]), {"couriers": [], "total": "0.00", "count": 0})


class SettleIdsTests(unittest.TestCase):
    A = "AAAAAAAA-0000-4000-8000-00000000000A"

    def test_ids_are_checked_lowercased_and_deduplicated(self):
        ids = courier.clean_settle_ids({"order_ids": [self.A, self.A.lower(), ORDER]})
        self.assertEqual(ids, [self.A.lower(), ORDER])

    def test_bad_requests_say_what_is_wrong(self):
        for payload in (None, [], {}, {"order_ids": []}, {"order_ids": "x"}, {"order_ids": [1]},
                        {"order_ids": ["não é id"]}, {"order_ids": [ORDER, "1; DROP TABLE orders"]}):
            with self.assertRaises(CourierError, msg=repr(payload)) as caught:
                courier.clean_settle_ids(payload)
            self.assertEqual(caught.exception.status, 400)

    def test_there_is_a_limit_per_settlement(self):
        many = [f"bbbbbbbb-0000-4000-8000-{n:012d}" for n in range(courier.MAX_SETTLE_ORDERS + 1)]
        with self.assertRaises(CourierError):
            courier.clean_settle_ids({"order_ids": many})
        self.assertEqual(len(courier.clean_settle_ids({"order_ids": many[:-1]})), courier.MAX_SETTLE_ORDERS)


class PickupOutcomeTests(unittest.TestCase):
    def problem(self, found, user=ME):
        with self.assertRaises(CourierError) as caught:
            courier.pickup_outcome(found, user)
        return caught.exception

    def test_an_order_that_does_not_exist_here_is_404(self):
        self.assertEqual(self.problem(None).status, 404)

    def test_only_deliveries_can_be_picked_up(self):
        self.assertEqual(self.problem(locked(order_type="balcao")).status, 400)

    def test_another_courier_already_has_it(self):
        error = self.problem(locked(courier_id=OTHER, status="saiu para entrega"))
        self.assertEqual(error.status, 409)
        self.assertIn("Outro motoqueiro", error.message)

    def test_tapping_again_is_fine(self):
        self.assertEqual(courier.pickup_outcome(locked(courier_id=ME, status="saiu para entrega"), ME), "already")

    def test_not_ready_and_already_delivered_say_so(self):
        self.assertIn("ainda não está pronto", self.problem(locked(status="em preparo")).message)
        self.assertIn("já foi entregue", self.problem(locked(status="concluido")).message)


class DeliveryDecisionTests(unittest.TestCase):
    def decide(self, row, code="0427", user=ME):
        return courier.delivery_decision(row, user, code)

    def problem(self, row, code="0427", user=ME):
        with self.assertRaises(CourierError) as caught:
            courier.delivery_decision(row, user, code)
        return caught.exception

    def test_the_right_code_closes_the_delivery(self):
        for status in ("pronto", "saiu para entrega"):
            self.assertEqual(self.decide(locked(status=status)), {"action": "deliver", "cash": None}, status)

    def test_the_code_may_be_typed_with_spaces(self):
        self.assertEqual(self.decide(locked(), code="0 4 2 7")["action"], "deliver")

    def test_a_wrong_code_does_not_close_it(self):
        self.assertEqual(self.decide(locked(), code="0428"), {"action": "wrong_code"})

    def test_a_code_that_is_not_four_numbers_is_asked_again_without_counting(self):
        for typed in (None, "", "42", "abcd", "04277"):
            error = self.problem(locked(), code=typed)
            self.assertEqual(error.status, 400, typed)
            self.assertIn("4 números", error.message)

    def test_after_five_wrong_tries_it_is_locked_even_with_the_right_code(self):
        error = self.problem(locked(code_attempts=5), code="0427")
        self.assertEqual((error.status, error.message), (423, courier.LOCKED_MESSAGE))
        self.assertEqual(self.decide(locked(code_attempts=4), code="0427")["action"], "deliver")

    def test_an_old_order_without_a_code_closes_without_one(self):
        self.assertEqual(self.decide(locked(delivery_code=None), code=None)["action"], "deliver")

    def test_a_delivery_in_cash_hands_the_amount_to_the_courier(self):
        row = locked(payment_method="dinheiro", payment_status="PENDING", total_price=Decimal("47.9"))
        self.assertEqual(self.decide(row), {"action": "deliver", "cash": Decimal("47.90")})

    def test_cash_already_confirmed_by_the_cashier_is_not_the_couriers(self):
        row = locked(payment_method="dinheiro", payment_status="PAID")
        self.assertIsNone(self.decide(row)["cash"])

    def test_a_free_order_can_be_closed_by_whoever_has_it_in_hand(self):
        self.assertEqual(self.decide(locked(courier_id=None))["action"], "deliver")
        self.assertEqual(self.decide(locked(courier_id=ME))["action"], "deliver")

    def test_the_order_of_another_courier_is_not_yours_to_close(self):
        error = self.problem(locked(courier_id=OTHER, status="saiu para entrega"))
        self.assertEqual(error.status, 409)

    def test_a_second_tap_after_delivered_is_fine_for_the_same_courier_only(self):
        self.assertEqual(self.decide(locked(status="concluido", courier_id=ME)), {"action": "already"})
        self.assertEqual(self.problem(locked(status="concluido", courier_id=None)).status, 409)
        self.assertEqual(self.problem(locked(status="concluido", courier_id=OTHER)).status, 409)

    def test_the_kitchen_must_have_finished_first(self):
        for status in ("PENDING_PAYMENT", "em preparo"):
            self.assertIn("ainda não está pronto", self.problem(locked(status=status)).message)

    def test_missing_and_non_delivery_orders(self):
        self.assertEqual(self.problem(None).status, 404)
        self.assertEqual(self.problem(locked(order_type="mesa")).status, 400)


class SqlSafetyTests(unittest.TestCase):
    """Todo SQL que mexe em pedido só mexe nos do restaurante da conta; os valores vão sempre por parâmetro."""

    SCOPED = ("SQL_LIST", "SQL_PICKUP", "SQL_WHY", "SQL_LOCK_FOR_DELIVERY", "SQL_COUNT_WRONG_CODE", "SQL_DELIVER",
              "SQL_CASH_OPEN", "SQL_SETTLE", "SQL_MARK_PAID")

    def test_each_statement_is_limited_to_one_restaurant(self):
        for name in self.SCOPED:
            self.assertIn("company_id", getattr(courier, name), name)

    def test_the_lock_is_a_real_row_lock(self):
        self.assertIn("FOR UPDATE", courier.SQL_LOCK_FOR_DELIVERY)

    def test_the_list_never_selects_the_code(self):
        self.assertNotIn("delivery_code,", courier.SQL_LIST)
        self.assertNotRegex(courier.SQL_LIST, r"o\.delivery_code\s*,")
        self.assertIn("delivery_code IS NOT NULL", courier.SQL_LIST)

    def test_the_list_keeps_a_delivery_with_unsettled_cash_however_old(self):
        sql = " ".join(courier.SQL_LIST.split())
        self.assertIn("cash_received IS NOT NULL AND o.cash_settled_at IS NULL", sql)
        self.assertIn("interval '12 hours'", sql)

    def test_settling_only_touches_open_cash_of_that_courier(self):
        sql = " ".join(courier.SQL_SETTLE.split())
        for needle in ("courier_id = %s", "cash_received IS NOT NULL", "cash_settled_at IS NULL"):
            self.assertIn(needle, sql)

    def test_pickup_does_not_take_an_order_from_another_courier(self):
        sql = " ".join(courier.SQL_PICKUP.split())
        self.assertIn("(courier_id IS NULL OR courier_id = %s)", sql)

    def test_no_value_is_pasted_into_the_text_of_a_statement(self):
        for name in dir(courier):
            if name.startswith("SQL_"):
                self.assertEqual(len(re.findall(r"\{[^}]*\}", getattr(courier, name))), 0, name)


if __name__ == "__main__":
    unittest.main()
