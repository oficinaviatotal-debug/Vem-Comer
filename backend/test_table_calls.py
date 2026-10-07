"""Regras da Mesa viva (chamar garçom): tipos, urgência, limites e o que cada lado vê."""

import unittest

import table_calls
from table_calls import CallError, Limiter


class Clock:
    def __init__(self, now=1000.0):
        self.now = now

    def __call__(self):
        return self.now


class KindTests(unittest.TestCase):
    def test_the_four_kinds_are_accepted(self):
        for kind in ("garcom", "conta", "agua", "limpeza"):
            self.assertEqual(table_calls.normalize_kind({"kind": kind}), kind)

    def test_anything_else_is_refused_with_a_message_for_the_screen(self):
        for payload in (None, [], "garcom", {}, {"kind": "pizza"}, {"kind": 3}, {"kind": None}):
            with self.assertRaises(CallError) as caught:
                table_calls.normalize_kind(payload)
            self.assertEqual(caught.exception.status, 400)
            self.assertTrue(caught.exception.message)

    def test_every_kind_has_a_button_name_and_a_panel_sentence(self):
        self.assertEqual(table_calls.label("conta"), "Conta")
        self.assertEqual(table_calls.phrase("garcom"), "chama o garçom")
        self.assertEqual(set(table_calls.KINDS), {"garcom", "conta", "agua", "limpeza"})


class UrgencyTests(unittest.TestCase):
    def test_colour_follows_the_waiting_time(self):
        self.assertEqual(table_calls.urgency(0), "normal")
        self.assertEqual(table_calls.urgency(table_calls.LATE_AFTER_SECONDS - 1), "normal")
        self.assertEqual(table_calls.urgency(table_calls.LATE_AFTER_SECONDS), "late")
        self.assertEqual(table_calls.urgency(table_calls.URGENT_AFTER_SECONDS - 1), "late")
        self.assertEqual(table_calls.urgency(table_calls.URGENT_AFTER_SECONDS), "urgent")

    def test_a_customer_who_taps_again_is_urgent_even_if_recent(self):
        self.assertEqual(table_calls.urgency(10, repeats=1), "normal")
        self.assertEqual(table_calls.urgency(10, repeats=table_calls.URGENT_AFTER_REPEATS), "urgent")

    def test_a_clock_that_ran_backwards_does_not_break_it(self):
        self.assertEqual(table_calls.urgency(-5), "normal")


class ViewTests(unittest.TestCase):
    def test_the_customer_sees_only_kind_and_progress(self):
        row = {"id": "c1", "kind": "agua", "status": "open", "table_id": "t1", "repeats": 3}
        self.assertEqual(table_calls.public_view(row), {"id": "c1", "kind": "agua", "status": "open"})

    def test_the_confirmation_says_if_it_was_already_asked(self):
        row = {"id": "c1", "kind": "garcom", "status": "open"}
        fresh = table_calls.public_view(row, already=False)
        again = table_calls.public_view(row, already=True)
        self.assertFalse(fresh["already"])
        self.assertTrue(again["already"])
        self.assertNotEqual(fresh["message"], again["message"])

    def test_the_panel_line_names_the_table_and_what_it_wants(self):
        view = table_calls.admin_view(
            {"id": "c1", "table_id": "t1", "table_number": 4, "kind": "conta", "waiting_seconds": 200, "repeats": 0}
        )
        self.assertEqual(view["text"], "Mesa 4 pede a conta")
        self.assertEqual(view["urgency"], "late")
        self.assertEqual(view["label"], "Conta")


class LimiterTests(unittest.TestCase):
    def test_one_network_address_cannot_tap_without_end(self):
        clock = Clock()
        limiter = Limiter(clock)
        for _ in range(table_calls.PER_IP_PER_HOUR):
            limiter.check_ip("1.2.3.4")
        with self.assertRaises(CallError) as caught:
            limiter.check_ip("1.2.3.4")
        self.assertEqual(caught.exception.status, 429)
        limiter.check_ip("5.6.7.8")

    def test_the_hour_passes_and_the_address_can_tap_again(self):
        clock = Clock()
        limiter = Limiter(clock)
        for _ in range(table_calls.PER_IP_PER_HOUR):
            limiter.check_ip("1.2.3.4")
        clock.now += 3601
        limiter.check_ip("1.2.3.4")

    def test_one_table_cannot_flood_the_panel_from_many_phones(self):
        clock = Clock()
        limiter = Limiter(clock)
        for _ in range(table_calls.PER_TABLE_PER_10_MIN):
            limiter.check_table("t1")
        with self.assertRaises(CallError) as caught:
            limiter.check_table("t1")
        self.assertEqual(caught.exception.status, 429)
        limiter.check_table("t2")
        clock.now += 601
        limiter.check_table("t1")

    def test_old_keys_are_forgotten_so_memory_does_not_grow(self):
        clock = Clock()
        limiter = Limiter(clock)
        for index in range(table_calls._PRUNE_ABOVE + 10):
            limiter.check_ip(f"10.0.{index // 250}.{index % 250}")
        clock.now += 4000
        limiter.check_ip("9.9.9.9")
        self.assertLess(len(limiter._per_ip), 100)


if __name__ == "__main__":
    unittest.main()
