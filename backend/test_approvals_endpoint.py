"""Rotas da fila de aprovação: só o administrador da plataforma vê e decide. Roda no CI (precisa do Flask)."""

import json
import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import approvals  # noqa: E402
import subscription  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
ACTION_ID = "77777777-7777-4777-8777-777777777777"
ADMIN_USER = "99999999-9999-4999-8999-999999999999"
LIST_URL = "/api/platform/approvals"
DECIDE_URL = f"/api/platform/approvals/{ACTION_ID}/decision"

PENDING_ROW = {
    "id": ACTION_ID, "agent": "captacao", "kind": "nova_origem_de_contatos", "level": 3,
    "title": "Usar o cadastro público de CNPJ", "what": "O quê", "why": "Por quê", "risk": "Risco",
    "if_refused": "Nada muda",
    "evidence": [{"fact": "Sem revisão do advogado", "source": "docs/agentes-e-aprendizado.md", "date": "2026-10-15"}],
    "status": "pendente", "decision_note": "", "result": "", "cost_cents": 0, "since_seconds": 600,
}
DONE_ROW = {**PENDING_ROW, "id": "88888888-8888-4888-8888-888888888888", "level": 1, "status": "feita",
            "result": "Resumo guardado.", "since_seconds": 90000, "agent": "sucesso"}


def auth(role="OWNER", company_id=COMPANY_ID, user_id=ADMIN_USER):
    token = backend_app.serializer.dumps({"user_id": user_id, "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


class Base(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.conn = MagicMock()
        self.conn.closed = False
        self.cur = self.conn.cursor.return_value
        patchers = (
            patch.object(backend_app, "get_db_connection", return_value=self.conn),
            patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": "gd@exemplo.com"}),
        )
        for patcher in patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

    def sql_run(self):
        return [" ".join(call.args[0].split()) for call in self.cur.execute.call_args_list]


class ListTests(Base):
    def get(self, email="gd@exemplo.com", pending=None, recent=None, headers=None):
        def fake(query, args=(), one=False):
            if query is subscription.SQL_USER_EMAIL:
                return {"email": email}
            if query is approvals.SQL_PENDING:
                return [PENDING_ROW] if pending is None else pending
            if query is approvals.SQL_RECENT:
                return [DONE_ROW] if recent is None else recent
            raise AssertionError("unexpected query")

        with patch.object(backend_app, "query_db", side_effect=fake):
            return self.client.get(LIST_URL, headers=headers or auth())

    def test_the_admin_sees_the_queue_and_the_record(self):
        reply = self.get()
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.headers["Cache-Control"], "no-store")
        body = reply.get_json()
        self.assertEqual(body["pending_count"], 1)
        card = body["pending"][0]
        self.assertEqual(card["title"], "Usar o cadastro público de CNPJ")
        self.assertEqual(card["status_label"], "Esperando o seu aval")
        self.assertEqual(card["evidence"][0]["source"], "docs/agentes-e-aprendizado.md")
        self.assertEqual(body["recent"][0]["status"], "feita")
        self.assertEqual(body["recent"][0]["level_label"], "O sistema faz e conta")

    def test_an_empty_queue_is_an_empty_list_and_a_zero(self):
        body = self.get(pending=[], recent=[]).get_json()
        self.assertEqual(body["pending"], [])
        self.assertEqual(body["pending_count"], 0)
        self.assertEqual(body["recent"], [])

    def test_a_normal_owner_is_refused(self):
        self.assertEqual(self.get(email="dono@exemplo.com").status_code, 403)

    def test_without_the_setting_nobody_is_admin(self):
        with patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": ""}):
            self.assertEqual(self.get().status_code, 403)

    def test_it_needs_a_login(self):
        self.assertEqual(self.client.get(LIST_URL).status_code, 401)

    def test_a_database_failure_is_a_plain_message_and_never_the_error_text(self):
        def boom(query, args=(), one=False):
            if query is subscription.SQL_USER_EMAIL:
                return {"email": "gd@exemplo.com"}
            raise RuntimeError("password authentication failed for user vemcomer")

        with patch.object(backend_app, "query_db", side_effect=boom):
            reply = self.client.get(LIST_URL, headers=auth())
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("password", json.dumps(reply.get_json()))


class DecideTests(Base):
    def post(self, body=None, email="gd@exemplo.com", url=DECIDE_URL, headers=None):
        def fake(query, args=(), one=False):
            if query is subscription.SQL_USER_EMAIL:
                return {"email": email}
            raise AssertionError("unexpected query")

        with patch.object(backend_app, "query_db", side_effect=fake):
            return self.client.post(url, json=body if body is not None else {"decision": "approve"}, headers=headers or auth())

    def test_the_admin_approves_and_the_answer_says_what_it_means(self):
        self.cur.fetchone.side_effect = [{"id": ACTION_ID}]
        reply = self.post({"decision": "approve", "note": "pode seguir"})
        self.assertEqual(reply.status_code, 200)
        body = reply.get_json()
        self.assertEqual((body["ok"], body["already"], body["status"]), (True, False, "aprovada"))
        self.assertEqual(body["status_label"], "Aprovada, ainda não executada")
        update = [c for c in self.cur.execute.call_args_list if "UPDATE agent_actions" in c.args[0]][0]
        # quem decide é o login, nunca o corpo da requisição
        self.assertEqual(update.args[1], ("aprovada", "pode seguir", ADMIN_USER, ACTION_ID))
        self.conn.commit.assert_called_once()

    def test_approving_does_not_run_anything_else(self):
        self.cur.fetchone.side_effect = [{"id": ACTION_ID}]
        self.post()
        written = " ".join(self.sql_run())
        self.assertNotIn("INSERT INTO outreach", written)
        self.assertNotIn("DELETE", written)
        self.assertEqual(
            sorted({sql.split()[0] + " " + (sql.split()[2] if sql.startswith("INSERT") else sql.split()[1]) for sql in self.sql_run()}),
            ["INSERT agent_action_events", "UPDATE agent_actions"],
        )

    def test_the_body_cannot_say_who_decided(self):
        self.cur.fetchone.side_effect = [{"id": ACTION_ID}]
        self.post({"decision": "refuse", "decided_by": "outra-pessoa", "status": "feita"})
        update = [c for c in self.cur.execute.call_args_list if "UPDATE agent_actions" in c.args[0]][0]
        self.assertEqual(update.args[1][0], "recusada")
        self.assertEqual(update.args[1][2], ADMIN_USER)

    def test_asking_for_a_change_without_saying_what_is_a_400_before_the_database(self):
        reply = self.post({"decision": "change"})
        self.assertEqual(reply.status_code, 400)
        self.assertIn("mudar", reply.get_json()["error"])
        self.conn.cursor.assert_not_called()

    def test_a_bad_answer_is_a_400_before_the_database(self):
        for body in ({"decision": "aprovada"}, {}, {"decision": 3}):
            reply = self.post(body)
            self.assertEqual(reply.status_code, 400, body)
        self.conn.cursor.assert_not_called()

    def test_the_same_answer_twice_is_not_an_error(self):
        self.cur.fetchone.side_effect = [None, {"level": 3, "status": "aprovada"}]
        reply = self.post({"decision": "approve"})
        self.assertEqual(reply.status_code, 200)
        self.assertTrue(reply.get_json()["already"])

    def test_changing_the_mind_is_a_409_and_writes_nothing(self):
        self.cur.fetchone.side_effect = [None, {"level": 3, "status": "recusada"}]
        reply = self.post({"decision": "approve"})
        self.assertEqual(reply.status_code, 409)
        self.assertIn("recusada", reply.get_json()["error"])
        self.conn.commit.assert_not_called()
        self.assertFalse(any("INSERT INTO agent_action_events" in sql for sql in self.sql_run()))

    def test_an_unknown_action_is_a_404(self):
        self.cur.fetchone.side_effect = [None, None]
        self.assertEqual(self.post().status_code, 404)

    def test_a_normal_owner_cannot_decide(self):
        self.assertEqual(self.post(email="dono@exemplo.com").status_code, 403)
        self.cur.execute.assert_not_called()

    def test_it_needs_a_login(self):
        self.assertEqual(self.client.post(DECIDE_URL, json={"decision": "approve"}).status_code, 401)

    def test_a_bad_id_is_a_404_from_the_router(self):
        self.assertEqual(self.post(url="/api/platform/approvals/nao-e-um-id/decision").status_code, 404)

    def test_a_database_failure_is_a_plain_message(self):
        self.cur.execute.side_effect = RuntimeError("connection to server at 10.0.0.5 failed")
        reply = self.post()
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("10.0.0.5", json.dumps(reply.get_json()))


if __name__ == "__main__":
    unittest.main()
