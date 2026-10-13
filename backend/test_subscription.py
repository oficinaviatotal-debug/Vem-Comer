"""Assinatura do restaurante: as regras de vencimento, bloqueio, aviso e pagamento (subscription.py).

Só regras e datas: não precisa de Flask nem de banco.
"""

import os
import unittest
from datetime import date, datetime, timezone
from unittest.mock import patch

import subscription as sub


def row(paid_until=None, anchor=None, price=19000, canceled=None):
    return {"price_cents": price, "anchor_day": anchor, "paid_until": paid_until, "canceled_at": canceled}


class AddMonthTests(unittest.TestCase):
    def test_same_day_next_month(self):
        self.assertEqual(sub.add_month(date(2026, 10, 5), 5), date(2026, 11, 5))

    def test_december_rolls_the_year(self):
        self.assertEqual(sub.add_month(date(2026, 12, 5), 5), date(2027, 1, 5))

    def test_day_31_goes_to_the_last_day_of_a_shorter_month(self):
        self.assertEqual(sub.add_month(date(2026, 1, 31), 31), date(2026, 2, 28))
        self.assertEqual(sub.add_month(date(2026, 3, 31), 31), date(2026, 4, 30))

    def test_leap_year_february(self):
        self.assertEqual(sub.add_month(date(2028, 1, 31), 31), date(2028, 2, 29))

    def test_the_anchor_comes_back_after_a_short_month(self):
        short = sub.add_month(date(2026, 1, 31), 31)  # 28/02
        self.assertEqual(sub.add_month(short, 31), date(2026, 3, 31))

    def test_day_29_and_30_in_february(self):
        self.assertEqual(sub.add_month(date(2026, 1, 29), 29), date(2026, 2, 28))
        self.assertEqual(sub.add_month(date(2026, 1, 30), 30), date(2026, 2, 28))


class EvaluateTests(unittest.TestCase):
    def test_no_subscription_is_exempt(self):
        view = sub.evaluate(None, date(2026, 10, 13))
        self.assertEqual(view["state"], "none")
        self.assertFalse(view["blocks"])

    def test_waiting_for_the_first_payment_blocks(self):
        view = sub.evaluate(row(), date(2026, 10, 13))
        self.assertEqual(view["state"], "awaiting_payment")
        self.assertTrue(view["blocks"])
        self.assertIsNone(view["due_date"])

    def test_on_the_due_date_still_works(self):
        view = sub.evaluate(row(date(2026, 11, 5), 5), date(2026, 11, 5))
        self.assertEqual(view["state"], "active")
        self.assertFalse(view["blocks"])
        self.assertEqual(view["warning"], "today")
        self.assertEqual(view["days_left"], 0)

    def test_the_day_after_the_due_date_is_blocked(self):
        """Entrou dia 5, vence todo dia 5, no dia 6 não funciona."""
        view = sub.evaluate(row(date(2026, 11, 5), 5), date(2026, 11, 6))
        self.assertEqual(view["state"], "past_due")
        self.assertTrue(view["blocks"])
        self.assertEqual(view["days_left"], -1)

    def test_warning_starts_three_days_before(self):
        due = date(2026, 11, 5)
        self.assertIsNone(sub.evaluate(row(due, 5), date(2026, 11, 1))["warning"])
        self.assertEqual(sub.evaluate(row(due, 5), date(2026, 11, 2))["warning"], "soon")
        self.assertEqual(sub.evaluate(row(due, 5), date(2026, 11, 2))["days_left"], 3)
        self.assertEqual(sub.evaluate(row(due, 5), date(2026, 11, 4))["warning"], "soon")

    def test_canceled_blocks_even_when_paid(self):
        view = sub.evaluate(row(date(2026, 12, 5), 5, canceled=datetime(2026, 10, 1, tzinfo=timezone.utc)), date(2026, 10, 13))
        self.assertEqual(view["state"], "canceled")
        self.assertTrue(view["blocks"])

    def test_dates_that_come_as_text_work(self):
        self.assertEqual(sub.evaluate(row("2026-11-05", 5), date(2026, 11, 6))["state"], "past_due")

    def test_the_price_is_the_one_copied_at_entry(self):
        self.assertEqual(sub.evaluate(row(date(2026, 11, 5), 5, price=14900), date(2026, 10, 13))["price_cents"], 14900)


class EnforcementTests(unittest.TestCase):
    def test_it_is_off_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("BILLING_ENFORCED", None)
            self.assertFalse(sub.billing_enforced())
            self.assertFalse(sub.is_blocked(row(), date(2026, 10, 13)))

    def test_only_blocks_when_turned_on(self):
        with patch.dict(os.environ, {"BILLING_ENFORCED": "1"}):
            self.assertTrue(sub.billing_enforced())
            self.assertTrue(sub.is_blocked(row(), date(2026, 10, 13)))
            self.assertTrue(sub.is_blocked(row(date(2026, 11, 5), 5), date(2026, 11, 6)))
            self.assertFalse(sub.is_blocked(row(date(2026, 11, 5), 5), date(2026, 11, 5)))
            self.assertFalse(sub.is_blocked(None, date(2026, 11, 6)))

    def test_explicit_flag_wins_over_the_environment(self):
        self.assertTrue(sub.is_blocked(row(), date(2026, 10, 13), True))
        self.assertFalse(sub.is_blocked(row(), date(2026, 10, 13), False))

    def test_the_words_that_turn_it_on(self):
        for value in ("1", "true", "TRUE", "yes", "sim", " 1 "):
            with patch.dict(os.environ, {"BILLING_ENFORCED": value}):
                self.assertTrue(sub.billing_enforced(), value)
        for value in ("", "0", "false", "nao", "off"):
            with patch.dict(os.environ, {"BILLING_ENFORCED": value}):
                self.assertFalse(sub.billing_enforced(), value)


class NextPeriodTests(unittest.TestCase):
    def test_first_payment_starts_today_and_sets_the_due_day(self):
        start, until, anchor = sub.next_period(row(), date(2026, 10, 5))
        self.assertEqual((start, until, anchor), (date(2026, 10, 5), date(2026, 11, 5), 5))

    def test_first_payment_on_the_31st_lands_on_the_last_day_of_the_month(self):
        start, until, anchor = sub.next_period(row(), date(2026, 1, 31))
        self.assertEqual((until, anchor), (date(2026, 2, 28), 31))

    def test_paying_on_time_continues_from_the_end_of_the_period(self):
        start, until, anchor = sub.next_period(row(date(2026, 11, 5), 5), date(2026, 11, 5))
        self.assertEqual((start, until, anchor), (date(2026, 11, 5), date(2026, 12, 5), 5))

    def test_paying_early_does_not_lose_days(self):
        start, until, anchor = sub.next_period(row(date(2026, 11, 5), 5), date(2026, 10, 20))
        self.assertEqual((start, until, anchor), (date(2026, 11, 5), date(2026, 12, 5), 5))

    def test_paying_late_gives_a_full_month_from_today_and_moves_the_due_day(self):
        start, until, anchor = sub.next_period(row(date(2026, 11, 5), 5), date(2026, 11, 20))
        self.assertEqual((start, until, anchor), (date(2026, 11, 20), date(2026, 12, 20), 20))

    def test_paying_the_day_after_the_due_date_is_already_late(self):
        start, until, anchor = sub.next_period(row(date(2026, 11, 5), 5), date(2026, 11, 6))
        self.assertEqual((until, anchor), (date(2026, 12, 6), 6))

    def test_a_subscription_with_a_date_but_no_anchor_is_treated_as_first_payment(self):
        start, until, anchor = sub.next_period(row(date(2026, 11, 5), None), date(2026, 10, 13))
        self.assertEqual((start, until, anchor), (date(2026, 10, 13), date(2026, 11, 13), 13))

    def test_after_paying_the_restaurant_is_back_and_not_blocked(self):
        late = row(date(2026, 11, 5), 5)
        today = date(2026, 11, 20)
        self.assertTrue(sub.evaluate(late, today)["blocks"])
        _, until, anchor = sub.next_period(late, today)
        self.assertFalse(sub.evaluate(row(until, anchor), today)["blocks"])


class TodayTests(unittest.TestCase):
    def test_the_day_is_the_brazilian_one(self):
        # 02:30 UTC de 6/11 ainda é 23:30 de 5/11 em Brasília: o dia 5 ainda vale.
        self.assertEqual(sub.today_br(datetime(2026, 11, 6, 2, 30, tzinfo=timezone.utc)), date(2026, 11, 5))
        self.assertEqual(sub.today_br(datetime(2026, 11, 6, 3, 0, tzinfo=timezone.utc)), date(2026, 11, 6))


class MessageTests(unittest.TestCase):
    def view(self, paid_until, anchor, today):
        return sub.evaluate(row(paid_until, anchor), today)

    def test_waiting_for_the_first_payment(self):
        self.assertEqual(sub.owner_message(sub.evaluate(row(), date(2026, 10, 13))),
                         "Falta o pagamento do primeiro mês (R$ 190,00) para começar a vender.")

    def test_overdue_says_nothing_was_deleted_and_what_to_do(self):
        text = sub.owner_message(self.view(date(2026, 11, 5), 5, date(2026, 11, 6)))
        self.assertIn("venceu em 05/11", text)
        self.assertIn("R$ 190,00", text)
        self.assertIn("Nada foi apagado", text)

    def test_warnings(self):
        self.assertEqual(sub.owner_message(self.view(date(2026, 11, 5), 5, date(2026, 11, 5))),
                         "Seu plano vence hoje. Pague R$ 190,00 hoje para não parar amanhã.")
        self.assertEqual(sub.owner_message(self.view(date(2026, 11, 5), 5, date(2026, 11, 2))),
                         "Seu plano vence em 3 dias (05/11).")
        self.assertEqual(sub.owner_message(self.view(date(2026, 11, 5), 5, date(2026, 11, 4))),
                         "Seu plano vence em 1 dia (05/11).")

    def test_in_good_standing_says_nothing(self):
        self.assertEqual(sub.owner_message(self.view(date(2026, 11, 5), 5, date(2026, 10, 20))), "")

    def test_the_customer_never_learns_why(self):
        self.assertNotIn("pag", sub.CUSTOMER_MESSAGE.lower())
        self.assertNotIn("venc", sub.CUSTOMER_MESSAGE.lower())

    def test_money(self):
        self.assertEqual(sub.reais(19000), "R$ 190,00")
        self.assertEqual(sub.reais(14950), "R$ 149,50")
        self.assertEqual(sub.reais(5), "R$ 0,05")


class PaymentInputTests(unittest.TestCase):
    def test_empty_means_the_price(self):
        self.assertEqual(sub.clean_payment({}), (None, "pix", None))
        self.assertEqual(sub.clean_payment(None), (None, "pix", None))
        self.assertEqual(sub.clean_payment({"amount": ""}), (None, "pix", None))

    def test_amounts_the_way_people_write_them(self):
        self.assertEqual(sub.clean_payment({"amount": "190"})[0], 19000)
        self.assertEqual(sub.clean_payment({"amount": "190,00"})[0], 19000)
        self.assertEqual(sub.clean_payment({"amount": "R$ 149,50"})[0], 14950)
        self.assertEqual(sub.clean_payment({"amount": 190})[0], 19000)
        self.assertEqual(sub.clean_payment({"amount": "1.234,50"})[0], 123450)

    def test_bad_amounts_are_refused(self):
        for bad in ("abc", "0", "-5", "190,999", "10001", "1e3"):
            with self.assertRaises(sub.SubscriptionError, msg=bad):
                sub.clean_payment({"amount": bad})

    def test_method_and_reference(self):
        self.assertEqual(sub.clean_payment({"method": "Transferencia", "reference": "  Pix  do   João "}),
                         (None, "transferencia", "Pix do João"))
        with self.assertRaises(sub.SubscriptionError):
            sub.clean_payment({"method": "cheque"})

    def test_the_reference_is_cut_to_the_column_size(self):
        self.assertEqual(len(sub.clean_payment({"reference": "x" * 500})[2]), sub.REFERENCE_MAX)


class PlatformAdminTests(unittest.TestCase):
    def test_nobody_is_admin_without_the_setting(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("PLATFORM_ADMIN_EMAILS", None)
            self.assertFalse(sub.is_platform_admin("gd@exemplo.com"))
            self.assertFalse(sub.is_platform_admin(None))

    def test_emails_are_matched_without_case_and_spaces(self):
        with patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": " GD@Exemplo.com ; outro@exemplo.com"}):
            self.assertTrue(sub.is_platform_admin("gd@exemplo.com"))
            self.assertTrue(sub.is_platform_admin(" OUTRO@exemplo.com "))
            self.assertFalse(sub.is_platform_admin("intruso@exemplo.com"))

    def test_payment_info_keeps_only_what_is_set(self):
        with patch.dict(os.environ, {"BILLING_PIX_KEY": " chave-pix ", "BILLING_CONTACT_PHONE": "+55 (84) 99999-0000"}):
            info = sub.payment_info()
            self.assertEqual(info["pix_key"], "chave-pix")
            self.assertEqual(info["contact_phone"], "5584999990000")


class SortTests(unittest.TestCase):
    def test_who_needs_attention_comes_first(self):
        def item(name, row_):
            return {"name": name, "subscription": sub.evaluate(row_, date(2026, 11, 3))}

        items = [
            item("exempt", None),
            item("ok", row(date(2026, 12, 5), 5)),
            item("soon", row(date(2026, 11, 5), 5)),
            item("late", row(date(2026, 11, 1), 1)),
            item("new", row()),
        ]
        items.sort(key=sub.platform_sort_key)
        self.assertEqual([i["name"] for i in items], ["late", "new", "soon", "ok", "exempt"])


if __name__ == "__main__":
    unittest.main()
