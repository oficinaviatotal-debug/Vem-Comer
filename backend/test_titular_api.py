"""Páginas e rotas do titular (titular_api.py). Roda no CI (Flask), com banco de mentira."""

import os
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import titular  # noqa: E402
import titular_api  # noqa: E402
from signup import SignupLimiter  # noqa: E402

NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)
USER_ID = "99999999-9999-4999-8999-999999999999"
COMPANY_ID = "11111111-1111-4111-8111-111111111111"


class FakeCursor:
    def __init__(self, rows=()):
        self.rows = list(rows)
        self.executed = []
        self.rowcount = 1

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def fetchall(self):
        rows, self.rows = self.rows, []
        return rows

    def close(self):
        pass


class FakeConnection:
    def __init__(self, rows=()):
        self.cur = FakeCursor(rows)
        self.committed = 0
        self.rolled_back = 0
        self.closed = False

    def cursor(self, **kwargs):
        return self.cur

    def commit(self):
        self.committed += 1

    def rollback(self):
        self.rolled_back += 1

    def close(self):
        self.closed = True


def created_row(protocol="VC-2026-AAAAAAAA"):
    return {"id": "id-1", "protocol": protocol, "due_at": NOW + timedelta(days=15)}


def token_for(role="OWNER"):
    return backend_app.serializer.dumps(
        {"user_id": USER_ID, "company_id": COMPANY_ID, "role": role, "login_at": time.time()}
    )


class Base(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        limiter = patch.object(titular_api, "limiter", SignupLimiter(per_hour=50, per_day=50))
        limiter.start()
        self.addCleanup(limiter.stop)
        env = patch.dict(os.environ, {"CONTROLLER_CNPJ": "", "CONTROLLER_ADDRESS": "", "PRIVACY_CONTACT": "", "PRIVACY_REVIEWED": ""})
        env.start()
        self.addCleanup(env.stop)

    def connect(self, rows=()):
        connection = FakeConnection(rows)
        patcher = patch.object(titular_api, "get_db_connection", return_value=connection)
        patcher.start()
        self.addCleanup(patcher.stop)
        return connection


class PrivacyPageTests(Base):
    def test_the_page_comes_from_the_inventory_and_needs_no_database(self):
        with patch.object(titular_api, "get_db_connection") as db:
            reply = self.client.get("/api/privacidade")
        db.assert_not_called()
        page = reply.get_data(as_text=True)
        self.assertEqual(reply.status_code, 200)
        self.assertIn('lang="pt-BR"', page)
        self.assertIn("Privacidade e os seus direitos", page)
        for item in titular_api.inventario.carregar()["categorias"]:
            self.assertIn(titular_api._esc(item["titular"]), page, item["id"])
            self.assertIn(titular_api._esc(item["guarda"]), page, item["id"])
        self.assertIn('action="/api/privacidade/solicitacoes"', page)
        self.assertIn('name="website"', page)  # armadilha de robô
        self.assertIn("15 dias", page)

    def test_every_kind_of_request_is_offered_except_the_report(self):
        page = self.client.get("/api/privacidade").get_data(as_text=True)
        for kind in titular.KINDS:
            self.assertEqual(f'value="{kind}"' in page, kind != "denuncia", kind)

    def test_draft_banner_until_a_lawyer_reviewed_it(self):
        self.assertIn("Texto preliminar", self.client.get("/api/privacidade").get_data(as_text=True))
        with patch.dict(os.environ, {"PRIVACY_REVIEWED": "1"}):
            self.assertNotIn("Texto preliminar", self.client.get("/api/privacidade").get_data(as_text=True))

    def test_company_data_appears_only_when_it_exists(self):
        page = self.client.get("/api/privacidade").get_data(as_text=True)
        self.assertIn("serão publicados aqui", page)
        env = {"CONTROLLER_CNPJ": "12.345.678/0001-90", "CONTROLLER_ADDRESS": "Rua A, 10, Natal/RN", "PRIVACY_CONTACT": "privacidade@exemplo.com.br"}
        with patch.dict(os.environ, env):
            page = self.client.get("/api/privacidade").get_data(as_text=True)
        self.assertNotIn("serão publicados aqui", page)
        for text in ("12.345.678/0001-90", "Rua A, 10", "privacidade@exemplo.com.br"):
            self.assertIn(text, page)

    def test_the_page_can_be_indexed_but_form_answers_cannot(self):
        reply = self.client.get("/api/privacidade")
        self.assertNotIn("noindex", reply.get_data(as_text=True))
        self.assertEqual(reply.headers["Cache-Control"], "no-store")
        self.assertEqual(reply.headers["X-Frame-Options"], "DENY")

    def test_the_report_page(self):
        page = self.client.get("/api/denuncia").get_data(as_text=True)
        self.assertIn('action="/api/denuncia"', page)
        self.assertIn('name="target_url"', page)
        self.assertIn("190", page)
        self.assertIn("sem se identificar", page)


class CreateRequestTests(Base):
    form = {"kind": "acesso", "contact": "ana@exemplo.com", "description": ""}

    def test_a_valid_request_gets_a_protocol_and_a_follow_link(self):
        connection = self.connect([created_row()])
        reply = self.client.post("/api/privacidade/solicitacoes", data=self.form)
        page = reply.get_data(as_text=True)
        self.assertEqual(reply.status_code, 201)
        self.assertIn("VC-2026-AAAAAAAA", page)
        self.assertIn("/api/privacidade/acompanhar?p=VC-2026-AAAAAAAA&amp;t=", page)
        self.assertEqual(reply.headers["Referrer-Policy"], "no-referrer")
        self.assertIn("noindex", page)
        self.assertEqual(connection.committed, 1)
        self.assertTrue(connection.closed)

    def test_the_platform_admin_is_warned_of_a_new_request(self):
        self.connect([created_row()])
        with patch.object(titular_api.push, "notify_titular_request") as warn:
            self.client.post("/api/privacidade/solicitacoes", data=self.form)
        warn.assert_called_once_with(False)

    def test_a_failed_request_warns_nobody(self):
        with patch.object(titular_api.push, "notify_titular_request") as warn:
            self.client.post("/api/privacidade/solicitacoes", data={**self.form, "contact": "lixo"})
        warn.assert_not_called()

    def test_the_code_shown_is_not_the_one_stored(self):
        connection = self.connect([created_row()])
        body = self.client.post("/api/privacidade/solicitacoes", json=self.form).get_json()
        stored = connection.cur.executed[0][1]
        self.assertNotIn(body["token"], stored)
        self.assertIn(titular.token_hash(body["token"]), stored)
        self.assertEqual(body["protocol"], "VC-2026-AAAAAAAA")
        self.assertTrue(body["follow_url"].startswith("/api/privacidade/acompanhar?p=VC-2026-AAAAAAAA&t="))

    def test_a_bad_request_is_refused_before_touching_the_database(self):
        with patch.object(titular_api, "get_db_connection") as db:
            reply = self.client.post("/api/privacidade/solicitacoes", data={**self.form, "contact": "lixo"})
            as_json = self.client.post("/api/privacidade/solicitacoes", json={**self.form, "kind": "x"})
        db.assert_not_called()
        self.assertEqual(reply.status_code, 400)
        self.assertIn("e-mail ou um WhatsApp", reply.get_data(as_text=True))
        self.assertEqual(as_json.status_code, 400)
        self.assertEqual(as_json.get_json()["field"], "kind")

    def test_the_report_kind_is_not_accepted_on_the_rights_form(self):
        with patch.object(titular_api, "get_db_connection") as db:
            reply = self.client.post("/api/privacidade/solicitacoes", json={"kind": "denuncia", "target_url": "https://x.exemplo/m", "description": "golpe no cardapio"})
        db.assert_not_called()
        self.assertEqual(reply.status_code, 400)

    def test_the_robot_field_is_refused(self):
        with patch.object(titular_api, "get_db_connection") as db:
            reply = self.client.post("/api/privacidade/solicitacoes", data={**self.form, "website": "http://spam.exemplo"})
        db.assert_not_called()
        self.assertEqual(reply.status_code, 400)

    def test_too_many_tries_from_one_network(self):
        with patch.object(titular_api, "limiter", SignupLimiter(per_hour=2, per_day=5)):
            codes = [self.client.post("/api/privacidade/solicitacoes", data={**self.form, "contact": "x"}).status_code for _ in range(3)]
        self.assertEqual(codes, [400, 400, 429])

    def test_a_database_failure_says_nothing_about_the_inside(self):
        connection = self.connect()
        connection.cur.execute = MagicMock(side_effect=RuntimeError("senha do banco: segredo"))
        reply = self.client.post("/api/privacidade/solicitacoes", data=self.form)
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("segredo", reply.get_data(as_text=True))
        self.assertEqual(connection.committed, 0)
        self.assertEqual(connection.rolled_back, 1)


class ReportTests(Base):
    def test_an_anonymous_report_works_and_promises_two_days(self):
        connection = self.connect([created_row("VC-2026-BBBBBBBB")])
        reply = self.client.post("/api/denuncia", data={"target_url": "https://x.exemplo/cardapio", "reason": "golpe", "description": "pede Pix para outra pessoa"})
        page = reply.get_data(as_text=True)
        self.assertEqual(reply.status_code, 201)
        self.assertIn("em até 2 dias", page)
        params = connection.cur.executed[0][1]
        self.assertEqual(params[1], "denuncia")
        self.assertIsNone(params[3])  # sem contato
        self.assertEqual(connection.committed, 1)

    def test_a_report_warns_the_admin_as_a_report(self):
        self.connect([created_row("VC-2026-BBBBBBBB")])
        with patch.object(titular_api.push, "notify_titular_request") as warn:
            self.client.post("/api/denuncia", data={"target_url": "https://x.exemplo/m", "description": "conteudo ilegal aqui"})
        warn.assert_called_once_with(True)

    def test_the_kind_cannot_be_changed_by_the_sender(self):
        connection = self.connect([created_row("VC-2026-BBBBBBBB")])
        self.client.post("/api/denuncia", json={"kind": "eliminacao", "target_url": "https://x.exemplo/m", "description": "conteudo ilegal aqui"})
        self.assertEqual(connection.cur.executed[0][1][1], "denuncia")

    def test_a_report_without_the_place_is_refused(self):
        with patch.object(titular_api, "get_db_connection") as db:
            reply = self.client.post("/api/denuncia", data={"description": "tem golpe no cardapio"})
        db.assert_not_called()
        self.assertEqual(reply.status_code, 400)
        self.assertIn("onde está o conteúdo", reply.get_data(as_text=True).lower())


class FollowTests(Base):
    def row(self, token="codigo-certo", **extra):
        data = {
            "id": "id-1", "protocol": "VC-2026-AAAAAAAA", "kind": "acesso", "status": "respondida",
            "response": "Enviamos a copia. <b>obrigado</b>", "due_at": NOW + timedelta(days=15), "created_at": NOW,
            "answered_at": NOW, "token_hash": titular.token_hash(token),
        }
        data.update(extra)
        return data

    def test_protocol_and_code_show_the_progress_and_the_answer_is_escaped(self):
        self.connect([self.row()])
        reply = self.client.get("/api/privacidade/acompanhar?p=VC-2026-AAAAAAAA&t=codigo-certo")
        page = reply.get_data(as_text=True)
        self.assertEqual(reply.status_code, 200)
        self.assertIn("Respondida", page)
        self.assertIn("&lt;b&gt;obrigado&lt;/b&gt;", page)
        self.assertNotIn("<b>obrigado</b>", page)
        self.assertEqual(reply.headers["Referrer-Policy"], "no-referrer")

    def test_wrong_code_and_unknown_protocol_look_the_same(self):
        self.connect([self.row()])
        wrong = self.client.get("/api/privacidade/acompanhar?p=VC-2026-AAAAAAAA&t=errado")
        self.connect([])
        unknown = self.client.get("/api/privacidade/acompanhar?p=VC-2026-FFFFFFFF&t=codigo-certo")
        junk = self.client.get("/api/privacidade/acompanhar?p=%27%20OR%201%3D1&t=x")
        self.assertEqual((wrong.status_code, unknown.status_code, junk.status_code), (404, 404, 404))
        self.assertEqual(wrong.get_data(), unknown.get_data())
        self.assertNotIn("Enviamos", wrong.get_data(as_text=True))


class LoggedInTests(Base):
    def header(self, role="OWNER"):
        return {"Authorization": "Bearer " + token_for(role)}

    def test_login_is_required(self):
        self.assertEqual(self.client.get("/api/me/dados").status_code, 401)
        self.assertEqual(self.client.post("/api/me/solicitacoes", json={"kind": "eliminacao"}).status_code, 401)

    def test_my_data_is_a_download_that_is_never_cached(self):
        self.connect()
        with patch.object(titular, "export_account", return_value={"usuario": {"email": "dono@x.com"}}) as export:
            reply = self.client.get("/api/me/dados?pedidos=1", headers=self.header())
        self.assertEqual(reply.status_code, 200)
        self.assertIn("attachment", reply.headers["Content-Disposition"])
        self.assertEqual(reply.headers["Cache-Control"], "no-store")
        export.assert_called_once()
        self.assertEqual(export.call_args.args[1:4], (USER_ID, COMPANY_ID, "OWNER"))
        self.assertTrue(export.call_args.kwargs["include_orders"])

    def test_my_request_uses_the_account_email_and_marks_identity_as_checked(self):
        connection = self.connect([{"email": "dono@saiteria.com.br"}, created_row()])
        reply = self.client.post("/api/me/solicitacoes", json={"kind": "eliminacao"}, headers=self.header())
        self.assertEqual(reply.status_code, 201)
        insert = next(p for s, p in connection.cur.executed if "INSERT INTO data_requests" in s)
        self.assertEqual(insert[2], "painel")
        self.assertEqual(insert[3], "dono@saiteria.com.br")
        self.assertIs(insert[7], True)
        self.assertEqual(connection.committed, 1)

    def test_the_email_in_the_body_is_ignored_when_logged_in(self):
        connection = self.connect([{"email": "dono@saiteria.com.br"}, created_row()])
        self.client.post("/api/me/solicitacoes", json={"kind": "acesso", "contact": "outro@estranho.com"}, headers=self.header())
        insert = next(p for s, p in connection.cur.executed if "INSERT INTO data_requests" in s)
        self.assertEqual(insert[3], "dono@saiteria.com.br")


class PlatformTests(Base):
    def setUp(self):
        super().setUp()
        env = patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": "admin@vem.com.br"})
        env.start()
        self.addCleanup(env.stop)

    def header(self):
        return {"Authorization": "Bearer " + token_for("OWNER")}

    def as_admin(self, email="admin@vem.com.br"):
        patcher = patch.object(backend_app, "query_db", return_value={"email": email})
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_only_the_platform_admin_gets_in(self):
        self.as_admin(email="dono@restaurante.com")
        for method, url in (("get", "/api/platform/solicitacoes"), ("post", "/api/platform/titular/anonimizar")):
            self.assertEqual(getattr(self.client, method)(url, headers=self.header(), json={}).status_code, 403, url)
        self.assertEqual(self.client.get("/api/platform/solicitacoes").status_code, 401)

    def test_the_admin_sees_open_requests_and_how_many_are_late(self):
        self.as_admin()
        self.connect()
        items = [{"protocol": "VC-2026-AAAAAAAA", "overdue": True}, {"protocol": "VC-2026-BBBBBBBB", "overdue": False}]
        with patch.object(titular, "list_open", return_value=items):
            body = self.client.get("/api/platform/solicitacoes", headers=self.header()).get_json()
        self.assertEqual(body["overdue"], 1)
        self.assertEqual(len(body["items"]), 2)

    def test_answering(self):
        self.as_admin()
        connection = self.connect()
        with patch.object(titular, "answer", return_value={"id": "x", "status": "respondida"}) as answer:
            reply = self.client.post(
                "/api/platform/solicitacoes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/responder",
                json={"status": "respondida", "response": "Enviamos a copia por e-mail.", "identity_verified": True},
                headers=self.header(),
            )
        self.assertEqual(reply.status_code, 200)
        self.assertIs(answer.call_args.kwargs["identity_verified"], True)
        self.assertEqual(connection.committed, 1)

    def test_a_denial_without_a_reason_is_refused(self):
        self.as_admin()
        self.connect()
        reply = self.client.post(
            "/api/platform/solicitacoes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/responder",
            json={"status": "negada", "response": ""},
            headers=self.header(),
        )
        self.assertEqual(reply.status_code, 400)
        self.assertEqual(reply.get_json()["field"], "response")

    def test_anonymizing_is_a_dry_run_unless_confirmed_in_writing(self):
        self.as_admin()
        connection = self.connect()
        with patch.object(titular, "anonymize_company", return_value={"pessoas": 2}) as run:
            dry = self.client.post("/api/platform/titular/anonimizar", json={"company_id": COMPANY_ID}, headers=self.header())
            wrong = self.client.post("/api/platform/titular/anonimizar", json={"company_id": COMPANY_ID, "confirmar": "sim"}, headers=self.header())
        self.assertEqual(run.call_count, 2)
        self.assertFalse(dry.get_json()["executado"])
        self.assertFalse(wrong.get_json()["executado"])
        self.assertEqual(connection.committed, 0)
        self.assertEqual(connection.rolled_back, 2)

    def test_anonymizing_for_real_needs_the_exact_word(self):
        self.as_admin()
        connection = self.connect()
        with patch.object(titular, "anonymize_user", return_value={"pessoa": 1}):
            reply = self.client.post("/api/platform/titular/anonimizar", json={"user_id": USER_ID, "confirmar": "ANONIMIZAR"}, headers=self.header())
        self.assertTrue(reply.get_json()["executado"])
        self.assertEqual(connection.committed, 1)

    def test_by_email_it_finds_the_person_and_shows_only_a_hint(self):
        self.as_admin()
        connection = self.connect()
        person = {"user_id": USER_ID, "company_id": COMPANY_ID, "role": "OWNER", "name_hint": "J***", "company_name": "Saiteria"}
        with patch.object(titular, "find_person", return_value=person), patch.object(titular, "anonymize_company", return_value={"pessoas": 2}) as run:
            reply = self.client.post("/api/platform/titular/anonimizar", json={"email": "dono@x.com", "escopo": "restaurante"}, headers=self.header())
        body = reply.get_json()
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(body["alvo"]["name_hint"], "J***")
        self.assertFalse(body["executado"])
        self.assertEqual(run.call_args.args[1], COMPANY_ID)
        self.assertEqual(connection.rolled_back, 1)

    def test_only_an_owner_can_close_the_whole_restaurant(self):
        self.as_admin()
        self.connect()
        person = {"user_id": USER_ID, "company_id": COMPANY_ID, "role": "WAITER", "name_hint": "M***", "company_name": "Saiteria"}
        with patch.object(titular, "find_person", return_value=person), patch.object(titular, "anonymize_company") as run:
            reply = self.client.post("/api/platform/titular/anonimizar", json={"email": "maria@x.com", "escopo": "restaurante"}, headers=self.header())
        self.assertEqual(reply.status_code, 400)
        run.assert_not_called()

    def test_by_email_the_scope_is_required_and_the_person_must_exist(self):
        self.as_admin()
        self.connect()
        no_scope = self.client.post("/api/platform/titular/anonimizar", json={"email": "a@x.com"}, headers=self.header())
        with patch.object(titular, "find_person", return_value=None):
            missing = self.client.post("/api/platform/titular/anonimizar", json={"email": "a@x.com", "escopo": "pessoa"}, headers=self.header())
        self.assertEqual((no_scope.status_code, missing.status_code), (400, 404))

    def test_it_asks_for_one_target_only(self):
        self.as_admin()
        self.connect()
        for body in ({}, {"company_id": COMPANY_ID, "user_id": USER_ID}):
            self.assertEqual(self.client.post("/api/platform/titular/anonimizar", json=body, headers=self.header()).status_code, 400)

    def test_a_failure_leaves_everything_as_it_was(self):
        self.as_admin()
        connection = self.connect()
        with patch.object(titular, "anonymize_company", side_effect=RuntimeError("segredo")):
            reply = self.client.post("/api/platform/titular/anonimizar", json={"company_id": COMPANY_ID, "confirmar": "ANONIMIZAR"}, headers=self.header())
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("segredo", reply.get_data(as_text=True))
        self.assertEqual(connection.committed, 0)


if __name__ == "__main__":
    unittest.main()
