"""Regras do pedido de ajuda e do acompanhamento dos cadastros parados (help_requests.py). Sem Flask, sem banco."""

import os
import unittest
from unittest.mock import patch
from urllib.parse import unquote

import help_requests as h


class CleanRequestTests(unittest.TestCase):
    def test_a_normal_request_keeps_what_the_owner_wrote(self):
        data = h.clean_request({"topic": "cardapio", "message": "  Não consigo mandar a foto  ", "screen": "assistente"})
        self.assertEqual(data, {"topic": "cardapio", "screen": "assistente", "message": "Não consigo mandar a foto", "phone": None})

    def test_every_topic_on_the_screen_is_accepted(self):
        for topic in h.TOPICS:
            self.assertEqual(h.clean_request({"topic": topic, "message": "ajuda"})["topic"], topic)

    def test_a_topic_that_does_not_exist_is_refused(self):
        for payload in ({"topic": "pizza"}, {"topic": ""}, {"topic": None}, {"topic": 3}, {}, None, "texto", [], 7):
            with self.assertRaises(h.HelpError, msg=repr(payload)):
                h.clean_request(payload)

    def test_other_needs_a_few_words(self):
        with self.assertRaises(h.HelpError):
            h.clean_request({"topic": "outro", "message": "  "})
        self.assertEqual(h.clean_request({"topic": "outro", "message": "oi, travei"})["message"], "oi, travei")
        # os outros assuntos já dizem o que é, a mensagem é opcional
        self.assertEqual(h.clean_request({"topic": "logo"})["message"], "")

    def test_the_message_is_cleaned_and_limited(self):
        raw = "linha\x00 um\x07\r\n\r\n\r\n\r\nlinha dois" + "x" * 900
        message = h.clean_request({"topic": "erro", "message": raw})["message"]
        self.assertLessEqual(len(message), h.MAX_MESSAGE)
        self.assertNotIn("\x00", message)
        self.assertNotIn("\x07", message)
        self.assertNotIn("\r", message)
        self.assertNotIn("\n\n\n", message)

    def test_html_in_the_message_is_kept_as_plain_text_never_interpreted(self):
        # a tela escreve com React (sem HTML cru); o servidor só guarda texto
        message = h.clean_request({"topic": "erro", "message": "<script>alert(1)</script>"})["message"]
        self.assertEqual(message, "<script>alert(1)</script>")

    def test_the_screen_name_is_reduced_to_safe_letters(self):
        self.assertEqual(h.clean_request({"topic": "erro", "screen": "Assistente"})["screen"], "assistente")
        self.assertEqual(h.clean_request({"topic": "erro", "screen": "../../etc; DROP TABLE"})["screen"], "etcdroptable")
        self.assertEqual(len(h.clean_request({"topic": "erro", "screen": "a" * 200})["screen"]), h.MAX_SCREEN)
        self.assertEqual(h.clean_request({"topic": "erro", "screen": 5})["screen"], "")

    def test_the_phone_is_only_digits_with_the_area_code(self):
        self.assertEqual(h.clean_phone("(84) 99999-1234"), "84999991234")
        self.assertEqual(h.clean_phone("+55 84 99999-1234"), "84999991234")
        self.assertEqual(h.clean_phone("8433331234"), "8433331234")
        self.assertIsNone(h.clean_phone(None))
        self.assertIsNone(h.clean_phone("   "))
        for bad in ("12345", "999991234", "(84) 99999-12345678", 84999991234, ["8499"]):
            with self.assertRaises(h.HelpError, msg=repr(bad)):
                h.clean_phone(bad)


class WhatsAppTests(unittest.TestCase):
    def test_no_number_means_no_link(self):
        with patch.dict(os.environ, {"SUPPORT_WHATSAPP": "", "BILLING_CONTACT_PHONE": ""}):
            self.assertEqual(h.support_whatsapp(), "")
        self.assertEqual(h.whatsapp_link("", "oi"), "")

    def test_the_support_number_falls_back_to_the_billing_one(self):
        with patch.dict(os.environ, {"SUPPORT_WHATSAPP": "", "BILLING_CONTACT_PHONE": "(84) 99999-1234"}):
            self.assertEqual(h.support_whatsapp(), "5584999991234")
        with patch.dict(os.environ, {"SUPPORT_WHATSAPP": "+55 11 98888-7777", "BILLING_CONTACT_PHONE": "84999991234"}):
            self.assertEqual(h.support_whatsapp(), "5511988887777")

    def test_a_number_that_is_not_a_phone_is_ignored(self):
        with patch.dict(os.environ, {"SUPPORT_WHATSAPP": "abc", "BILLING_CONTACT_PHONE": ""}):
            self.assertEqual(h.support_whatsapp(), "")
        with patch.dict(os.environ, {"SUPPORT_WHATSAPP": "123", "BILLING_CONTACT_PHONE": ""}):
            self.assertEqual(h.support_whatsapp(), "")

    def test_the_message_has_who_where_and_what(self):
        text = h.help_text("Pizzaria do Zé", "José", "foto", "a foto sai escura")
        self.assertIn("José", text)
        self.assertIn("Pizzaria do Zé", text)
        self.assertIn("foto de prato", text)
        self.assertIn("a foto sai escura", text)
        link = h.whatsapp_link("5584999991234", text)
        self.assertTrue(link.startswith("https://wa.me/5584999991234?text="))
        self.assertNotIn(" ", link)
        self.assertNotIn("\n", link)

    def test_the_message_survives_missing_names(self):
        text = h.help_text(None, None, "cardapio", "")
        self.assertIn("meu restaurante", text)
        self.assertTrue(text.endswith("."))

    def test_the_confirmation_tells_if_it_was_already_open(self):
        self.assertIn("Recebi", h.confirmation(False, False))
        self.assertIn("continua aberto", h.confirmation(True, False))
        self.assertIn("WhatsApp", h.confirmation(False, True))
        self.assertNotIn("WhatsApp", h.confirmation(False, False))


class LimiterTests(unittest.TestCase):
    def test_after_the_limit_the_owner_is_asked_to_wait(self):
        now = [1000.0]
        limiter = h.Limiter(clock=lambda: now[0])
        for _ in range(h.PER_COMPANY_PER_HOUR):
            limiter.check("a")
        with self.assertRaises(h.HelpError) as caught:
            limiter.check("a")
        self.assertEqual(caught.exception.status, 429)
        limiter.check("b")  # outro restaurante não é afetado
        now[0] += 3601
        limiter.check("a")  # passou uma hora


class TimeTextTests(unittest.TestCase):
    def test_waiting_label(self):
        self.assertEqual(h.waiting_label(0), "agora")
        self.assertEqual(h.waiting_label(119), "agora")
        self.assertEqual(h.waiting_label(300), "há 5 min")
        self.assertEqual(h.waiting_label(7200), "há 2 h")
        self.assertEqual(h.waiting_label(86400), "há 1 dia")
        self.assertEqual(h.waiting_label(3 * 86400 + 5), "há 3 dias")
        self.assertEqual(h.waiting_label(-5), "agora")
        self.assertEqual(h.waiting_label(None), "agora")

    def test_duration_label(self):
        self.assertEqual(h.duration_label(10), "1 min")
        self.assertEqual(h.duration_label(45 * 60), "45 min")
        self.assertEqual(h.duration_label(2 * 3600), "2 h")
        self.assertEqual(h.duration_label(3 * 3600 + 20 * 60), "3 h 20 min")
        self.assertEqual(h.duration_label(86400), "1 dia")
        self.assertEqual(h.duration_label(2 * 86400 + 4 * 3600), "2 dias 4 h")

    def test_deadline_state_follows_the_three_day_promise(self):
        day = 86400
        self.assertEqual(h.deadline_state(2 * 3600, False), "ok")
        self.assertEqual(h.deadline_state(1 * day, False), "watch")
        self.assertEqual(h.deadline_state(2 * day, False), "late")
        self.assertEqual(h.deadline_state(3 * day, False), "over")
        self.assertEqual(h.deadline_state(10 * day, True), "done")

    def test_deadline_text(self):
        day = 86400
        self.assertIn("Faltam", h.deadline_text(1 * day, False))
        self.assertIn("Passou do prazo", h.deadline_text(4 * day, False))
        self.assertEqual(h.deadline_text(day, True, 3 * 3600 + 20 * 60), "Cardápio cadastrado em 3 h 20 min.")


def tracking_input(**extra):
    row = {"company_id": "c1", "name": "Pizzaria", "slug": "pizzaria", "owner_phone": "(84) 99999-1234",
           "age_seconds": 86400 * 2, "products": 0, "ready_seconds": None, "has_open_help": False,
           "owner_name": "José", "owner_email": "jose@x.com"}
    row.update(extra)
    return row


class TrackingTests(unittest.TestCase):
    def test_a_restaurant_without_menu_gets_a_nudge_link(self):
        view = h.tracking_row(tracking_input())
        self.assertFalse(view["ready"])
        self.assertEqual(view["state"], "late")
        self.assertEqual(view["products"], 0)
        self.assertTrue(view["whatsapp_url"].startswith("https://wa.me/5584999991234?text="))
        self.assertIn("Faltam", view["text"])

    def test_a_restaurant_with_enough_dishes_is_done_and_timed(self):
        view = h.tracking_row(tracking_input(products=h.MENU_READY_PRODUCTS, ready_seconds=3 * 3600 + 1200))
        self.assertTrue(view["ready"])
        self.assertEqual(view["state"], "done")
        self.assertEqual(view["ready_seconds"], 3 * 3600 + 1200)
        self.assertEqual(view["whatsapp_url"], "")
        self.assertIn("3 h 20 min", view["text"])

    def test_one_dish_short_is_not_ready(self):
        self.assertFalse(h.tracking_row(tracking_input(products=h.MENU_READY_PRODUCTS - 1))["ready"])

    def test_an_old_unfinished_signup_is_no_longer_followed(self):
        self.assertIsNone(h.tracking_row(tracking_input(age_seconds=(h.WATCH_DAYS + 1) * 86400)))
        # quem terminou continua na conta, por mais antigo que seja (entra nos números do cronômetro)
        old_done = h.tracking_row(tracking_input(age_seconds=(h.WATCH_DAYS + 5) * 86400, products=9, ready_seconds=600))
        self.assertTrue(old_done["ready"])

    def test_without_a_phone_there_is_no_link(self):
        view = h.tracking_row(tracking_input(owner_phone=None))
        self.assertEqual(view["phone"], "")
        self.assertEqual(view["whatsapp_url"], "")

    def test_the_ones_past_the_deadline_come_first(self):
        rows = [
            h.tracking_row(tracking_input(company_id="done", products=7, ready_seconds=60)),
            h.tracking_row(tracking_input(company_id="new", age_seconds=3600)),
            h.tracking_row(tracking_input(company_id="over", age_seconds=5 * 86400)),
            h.tracking_row(tracking_input(company_id="late", age_seconds=2 * 86400 + 5)),
            h.tracking_row(tracking_input(company_id="older-over", age_seconds=9 * 86400)),
        ]
        rows.sort(key=h.tracking_sort_key)
        self.assertEqual([r["company_id"] for r in rows], ["older-over", "over", "late", "new", "done"])

    def test_the_summary_counts_and_takes_the_median(self):
        rows = [
            h.tracking_row(tracking_input(company_id="a", products=6, ready_seconds=3600)),
            h.tracking_row(tracking_input(company_id="b", products=6, ready_seconds=7200)),
            h.tracking_row(tracking_input(company_id="c", products=6, ready_seconds=5 * 86400)),
            h.tracking_row(tracking_input(company_id="d", age_seconds=4 * 86400)),
            h.tracking_row(tracking_input(company_id="e", age_seconds=3600)),
        ]
        summary = h.tracking_summary(rows)
        self.assertEqual(summary["total"], 5)
        self.assertEqual(summary["done"], 3)
        self.assertEqual(summary["done_within_deadline"], 2)
        self.assertEqual(summary["stalled"], 2)
        self.assertEqual(summary["over_deadline"], 1)
        self.assertEqual(summary["median_seconds"], 7200)
        self.assertEqual(summary["median_label"], "2 h")

    def test_an_empty_summary_has_no_median(self):
        summary = h.tracking_summary([])
        self.assertEqual(summary["total"], 0)
        self.assertIsNone(summary["median_seconds"])
        self.assertEqual(summary["median_label"], "")


class InboxTests(unittest.TestCase):
    def row(self, **extra):
        base = {"id": "r1", "company_id": "c1", "topic": "foto", "screen": "assistente", "message": "não sai",
                "contact_phone": None, "repeats": 2, "company_name": "Pizzaria", "slug": "pizzaria",
                "owner_phone": "(84) 99999-1234", "owner_name": "José", "waiting_seconds": 600}
        base.update(extra)
        return base

    def test_the_row_has_what_is_needed_to_answer(self):
        view = h.inbox_row(self.row())
        self.assertEqual(view["topic_label"], "Foto de prato")
        self.assertEqual(view["waiting_label"], "há 10 min")
        self.assertEqual(view["repeats"], 2)
        self.assertEqual(view["phone"], "5584999991234")
        self.assertIn("foto de prato", unquote(view["whatsapp_url"]))
        self.assertEqual(view["message"], "não sai")

    def test_the_number_typed_in_the_request_wins_over_the_signup_one(self):
        view = h.inbox_row(self.row(contact_phone="11988887777"))
        self.assertEqual(view["phone"], "5511988887777")

    def test_without_any_phone_there_is_no_link(self):
        view = h.inbox_row(self.row(owner_phone=None))
        self.assertEqual(view["whatsapp_url"], "")

    def test_a_topic_the_screen_does_not_know_still_shows(self):
        self.assertEqual(h.topic_label("nao-existe"), h.TOPICS["outro"])


class MigrationTests(unittest.TestCase):
    def test_the_topics_in_the_code_are_the_ones_the_database_accepts(self):
        path = os.path.join(os.path.dirname(__file__), "..", "database", "migrations", "014_pedidos_de_ajuda.sql")
        with open(path, encoding="utf-8") as handle:
            sql = handle.read()
        for topic in h.TOPICS:
            self.assertIn(f"'{topic}'", sql, topic)
        self.assertIn("CREATE TABLE IF NOT EXISTS help_requests", sql)
        self.assertIn("CREATE INDEX IF NOT EXISTS", sql)
        self.assertNotIn("DROP ", sql.upper())


if __name__ == "__main__":
    unittest.main()
