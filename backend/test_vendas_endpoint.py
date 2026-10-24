"""Rotas da máquina de vendas: só o administrador da plataforma vê e muda. Roda no CI (precisa do Flask)."""

import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import subscription  # noqa: E402
import vendas  # noqa: E402
import vendas_api  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
ADMIN_USER = "99999999-9999-4999-8999-999999999999"
PROSPECT = "55555555-5555-4555-8555-555555555555"
BASE = "/api/platform/sales"
ROUTES = (
    ("get", BASE),
    ("post", f"{BASE}/read-contact"),
    ("post", f"{BASE}/prospects"),
    ("post", f"{BASE}/prospects/{PROSPECT}/touch"),
    ("post", f"{BASE}/prospects/{PROSPECT}/reply"),
    ("post", f"{BASE}/prospects/{PROSPECT}/stage"),
    ("post", f"{BASE}/prospects/{PROSPECT}/forget"),
)
VIEW = {"id": PROSPECT, "business_name": "Pastelaria do Zé", "stage": "chamado"}
GOOD = {
    "business_name": "Pastelaria do Zé", "business_kind": "pastelaria", "city": "Natal", "phone": "(84) 99999-8888",
    "source": "anuncio_publico", "source_note": "Anúncio no Instagram",
}


def auth(role="OWNER", user_id=ADMIN_USER):
    token = backend_app.serializer.dumps({"user_id": user_id, "company_id": COMPANY_ID, "role": role})
    return {"Authorization": f"Bearer {token}"}


class Base(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.conn = MagicMock()
        self.conn.closed = False
        self.cur = self.conn.cursor.return_value
        self.email = "gd@exemplo.com"

        def fake_query(query, args=(), one=False):
            if query is subscription.SQL_USER_EMAIL:
                return {"email": self.email}
            raise AssertionError("unexpected query")

        patchers = (
            patch.object(vendas_api, "get_db_connection", return_value=self.conn),
            patch.object(backend_app, "query_db", side_effect=fake_query),
            patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": "gd@exemplo.com"}),
            patch.object(vendas, "view_of", side_effect=lambda row, *a, **k: dict(VIEW)),
        )
        for patcher in patchers:
            patcher.start()
            self.addCleanup(patcher.stop)
        self.cur.fetchone.return_value = {"id": PROSPECT}

    def call(self, method, url, body=None, headers=None):
        return getattr(self.client, method)(url, json=body, headers=auth() if headers is None else headers)


class AccessTests(Base):
    def test_nobody_without_login_gets_in(self):
        for method, url in ROUTES:
            self.assertEqual(self.call(method, url, {}, headers={}).status_code, 401, url)

    def test_a_logged_user_who_is_not_the_platform_admin_is_refused(self):
        self.email = "dono-de-restaurante@exemplo.com"
        for method, url in ROUTES:
            reply = self.call(method, url, {})
            self.assertEqual(reply.status_code, 403, url)
        self.conn.commit.assert_not_called()

    def test_every_sales_route_is_in_the_list_above(self):
        found = sorted(rule.rule.replace("<uuid:prospect_id>", PROSPECT) for rule in backend_app.app.url_map.iter_rules() if rule.rule.startswith(BASE))
        self.assertEqual(found, sorted({url for _, url in ROUTES}))


class OverviewTests(Base):
    def test_the_overview_is_read_only_and_not_cached(self):
        with patch.object(vendas, "overview", return_value={"today": {"items": []}, "funnel": {"total": 0}}) as overview:
            reply = self.call("get", BASE)
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json()["funnel"]["total"], 0)
        self.assertEqual(reply.headers["Cache-Control"], "no-store")
        overview.assert_called_once()
        self.conn.commit.assert_not_called()
        self.conn.close.assert_called()


class ReadContactTests(Base):
    def test_it_separates_the_contact_without_touching_the_database(self):
        reply = self.call("post", f"{BASE}/read-contact", {"text": "Pizzaria do Zé\nPedidos (84) 99999-8888\n@pizzariadoze"})
        self.assertEqual(reply.status_code, 200)
        found = reply.get_json()
        self.assertEqual((found["name"], found["phone"], found["instagram"]), ("Pizzaria do Zé", "5584999998888", "pizzariadoze"))
        self.conn.cursor.assert_not_called()

    def test_empty_text_is_asked_again_in_plain_words(self):
        for body in ({}, {"text": "  "}, {"text": 5}):
            reply = self.call("post", f"{BASE}/read-contact", body)
            self.assertEqual(reply.status_code, 400)
            self.assertIn("Cole ou fale", reply.get_json()["error"])


class AddTests(Base):
    def test_a_new_business_is_created_and_saved(self):
        with patch.object(vendas, "add_prospect", return_value={"id": PROSPECT, "created": True, "reason": None}) as add:
            reply = self.call("post", f"{BASE}/prospects", GOOD)
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.get_json()["prospect"]["business_name"], "Pastelaria do Zé")
        self.assertEqual(add.call_args.args[2], ADMIN_USER)  # quem fez fica no registro
        self.conn.commit.assert_called_once()

    def test_the_same_contact_returns_the_one_that_exists(self):
        with patch.object(vendas, "add_prospect", return_value={"id": PROSPECT, "created": False, "reason": "ja_existe"}):
            reply = self.call("post", f"{BASE}/prospects", GOOD)
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json()["reason"], "ja_existe")

    def test_someone_who_asked_to_stop_is_not_added(self):
        with patch.object(vendas, "add_prospect", return_value={"id": None, "created": False, "reason": "na_lista_de_bloqueio"}):
            reply = self.call("post", f"{BASE}/prospects", GOOD)
        self.assertEqual(reply.status_code, 409)
        self.assertIn("pediu para não receber", reply.get_json()["error"])

    def test_a_rule_error_comes_back_in_plain_words_and_nothing_is_saved(self):
        reply = self.call("post", f"{BASE}/prospects", {**GOOD, "source": None})
        self.assertEqual(reply.status_code, 400)
        self.assertIn("de onde veio", reply.get_json()["error"])
        self.conn.commit.assert_not_called()
        self.conn.rollback.assert_called()

    def test_an_unexpected_failure_hides_the_details(self):
        with patch.object(vendas, "add_prospect", side_effect=RuntimeError("senha do banco: abc123")):
            reply = self.call("post", f"{BASE}/prospects", GOOD)
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("abc123", reply.get_data(as_text=True))
        self.conn.rollback.assert_called()


class ActionTests(Base):
    def test_touch_passes_the_channel_and_the_author(self):
        with patch.object(vendas, "record_touch", return_value={"ok": True}) as touch:
            reply = self.call("post", f"{BASE}/prospects/{PROSPECT}/touch", {"channel": "whatsapp"})
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(touch.call_args.args[2:], ("whatsapp", ADMIN_USER))
        self.conn.commit.assert_called_once()

    def test_a_refused_touch_is_a_409_with_the_reason_in_words(self):
        with patch.object(vendas, "record_touch", side_effect=vendas.ProspectError(vendas.TOUCH_REFUSALS["limite_de_contatos"], 409)):
            reply = self.call("post", f"{BASE}/prospects/{PROSPECT}/touch", {"channel": "email"})
        self.assertEqual(reply.status_code, 409)
        self.assertIn("3 contatos", reply.get_json()["error"])
        self.conn.commit.assert_not_called()

    def test_the_reply_text_is_read_but_never_sent_back_or_kept(self):
        secret = "Não quero, obrigado. Meu CPF é 123"
        with patch.object(vendas, "record_reply", return_value={"ok": True, "result": "nao_quer", "stage": "nao_quer"}) as reply_fn:
            reply = self.call("post", f"{BASE}/prospects/{PROSPECT}/reply", {"text": secret})
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply_fn.call_args.kwargs["text"], secret)
        self.assertNotIn("CPF", reply.get_data(as_text=True))

    def test_the_reply_accepts_a_chosen_result_without_text(self):
        with patch.object(vendas, "record_reply", return_value={"ok": True, "result": "interessado", "stage": "respondeu"}) as reply_fn:
            reply = self.call("post", f"{BASE}/prospects/{PROSPECT}/reply", {"result": "interessado"})
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply_fn.call_args.kwargs, {"text": None, "result": "interessado"})

    def test_bad_reply_payloads(self):
        for body in ({"text": 5}, {"result": 5}):
            self.assertEqual(self.call("post", f"{BASE}/prospects/{PROSPECT}/reply", body).status_code, 400, body)

    def test_stage_needs_a_word(self):
        self.assertEqual(self.call("post", f"{BASE}/prospects/{PROSPECT}/stage", {"stage": 3}).status_code, 400)
        with patch.object(vendas, "set_stage", return_value={"ok": True, "stage": "demonstracao", "already": False}) as stage:
            reply = self.call("post", f"{BASE}/prospects/{PROSPECT}/stage", {"stage": "demonstracao"})
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(stage.call_args.args[2:], ("demonstracao", ADMIN_USER))

    def test_a_missing_business_is_a_404(self):
        with patch.object(vendas, "set_stage", side_effect=vendas.ProspectError("Não achei esse negócio.", 404)):
            reply = self.call("post", f"{BASE}/prospects/{PROSPECT}/stage", {"stage": "chamado"})
        self.assertEqual(reply.status_code, 404)


class ForgetTests(Base):
    def test_forgetting_needs_the_written_word(self):
        with patch.object(vendas, "forget_prospect") as forget:
            for body in ({}, {"confirm": "apagar"}, {"confirm": "sim"}):
                reply = self.call("post", f"{BASE}/prospects/{PROSPECT}/forget", body)
                self.assertEqual(reply.status_code, 400, body)
                self.assertIn("APAGAR", reply.get_json()["error"])
            forget.assert_not_called()
        self.conn.commit.assert_not_called()

    def test_with_the_word_it_forgets_and_saves(self):
        with patch.object(vendas, "forget_prospect", return_value={"ok": True}) as forget:
            reply = self.call("post", f"{BASE}/prospects/{PROSPECT}/forget", {"confirm": "APAGAR"})
        self.assertEqual(reply.status_code, 200)
        forget.assert_called_once()
        self.conn.commit.assert_called_once()


class InterestFormTests(Base):
    """O formulário público: fechado por padrão, aberto só com INTEREST_OPEN=1, sem login."""

    URL = "/api/interest"
    FORM = {"business_name": "Sorveteria Gelo Bom", "business_kind": "sorveteria", "city": "Natal", "phone": "(84) 98888-7777", "consent": True}

    def open(self):
        patcher = patch.dict(os.environ, {"INTEREST_OPEN": "1"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def post(self, body=None, ip="10.0.0.1"):
        return self.client.post(self.URL, json=body if body is not None else dict(self.FORM), environ_overrides={"REMOTE_ADDR": ip})

    def test_closed_by_default_with_no_trace(self):
        with patch.dict(os.environ, {"INTEREST_OPEN": ""}):
            self.assertEqual(self.client.get("/api/interest/status").get_json(), {"open": False})
            reply = self.post()
            self.assertEqual(reply.status_code, 404)
        self.conn.cursor.assert_not_called()

    def test_open_status_carries_the_exact_text_the_person_authorizes(self):
        self.open()
        status = self.client.get("/api/interest/status").get_json()
        self.assertTrue(status["open"])
        self.assertEqual(status["consent_text"], vendas.INTEREST_CONSENT_TEXT)
        self.assertEqual(status["text_version"], vendas.INTEREST_TEXT_VERSION)
        self.assertIn({"id": "pastelaria", "label": "Pastelaria"}, status["kinds"])

    def test_no_login_is_needed_and_the_thanks_does_not_say_who_was_already_known(self):
        self.open()
        with patch.object(vendas, "add_inbound", return_value={"id": "x", "created": False, "reason": "ja_existe"}) as add:
            reply = self.post()
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json(), {"ok": True, "message": vendas.INTEREST_THANKS})
        self.assertEqual(add.call_args.kwargs["ip"], "10.0.0.1")
        self.conn.commit.assert_called_once()

    def test_a_blocked_contact_gets_a_plain_refusal(self):
        self.open()
        with patch.object(vendas, "add_inbound", return_value={"id": None, "created": False, "reason": "na_lista_de_bloqueio"}):
            reply = self.post()
        self.assertEqual(reply.status_code, 409)
        self.assertEqual(reply.get_json()["error"], vendas.INTEREST_BLOCKED)

    def test_without_the_ticked_box_nothing_is_saved(self):
        self.open()
        reply = self.post({**self.FORM, "consent": False})
        self.assertEqual(reply.status_code, 400)
        self.assertIn("marque a caixa", reply.get_json()["error"])
        self.conn.commit.assert_not_called()

    def test_the_hidden_field_makes_a_robot_think_it_worked_and_keeps_nothing(self):
        self.open()
        with patch.object(vendas, "add_inbound") as add:
            reply = self.post({**self.FORM, "website": "http://spam.example"})
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json()["ok"], True)
        add.assert_not_called()
        self.conn.cursor.assert_not_called()

    def test_a_network_that_insists_is_slowed_down(self):
        self.open()
        with patch.object(vendas, "add_inbound", return_value={"id": "x", "created": True, "reason": None}):
            codes = [self.post(ip="10.9.9.9").status_code for _ in range(30)]
            other_network = self.post(ip="10.8.8.8").status_code  # outra rede não paga pela primeira
        self.assertEqual(codes[0], 200)
        self.assertIn(429, codes)
        self.assertEqual(other_network, 200)

    def test_bad_payloads(self):
        self.open()
        self.assertEqual(self.client.post(self.URL, data="não é json", content_type="text/plain").status_code, 400)
        self.assertEqual(self.client.post(self.URL, json=[1, 2]).status_code, 400)

    def test_an_unexpected_failure_hides_the_details(self):
        self.open()
        with patch.object(vendas, "add_inbound", side_effect=RuntimeError("senha do banco: abc123")):
            reply = self.post(ip="10.7.7.7")
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("abc123", reply.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
