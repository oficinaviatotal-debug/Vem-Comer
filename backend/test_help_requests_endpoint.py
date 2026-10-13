"""Rotas do pedido de ajuda: o dono pede, o administrador vê a caixa e resolve. Roda no CI (precisa do Flask)."""

import os
import unittest
from unittest.mock import MagicMock, patch
from urllib.parse import unquote

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import help_requests  # noqa: E402
import subscription  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
REQUEST_ID = "66666666-6666-4666-8666-666666666666"
ADMIN_USER = "99999999-9999-4999-8999-999999999999"
ASK_URL = "/api/admin/help"
INBOX_URL = "/api/platform/help"
RESOLVE_URL = f"/api/platform/help/{REQUEST_ID}/resolve"


def auth(role="OWNER", company_id=COMPANY_ID, user_id="user-1"):
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
            patch.object(backend_app, "help_limiter", help_requests.Limiter()),
            patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": "gd@exemplo.com", "SUPPORT_WHATSAPP": "",
                                    "BILLING_CONTACT_PHONE": ""}),
        )
        for patcher in patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

    def sql_run(self):
        return [" ".join(call.args[0].split()) for call in self.cur.execute.call_args_list]


CONTEXT = {"company_name": "Pizzaria do Zé", "owner_phone": "84999991234", "user_name": "José"}


class AskForHelpTests(Base):
    def ask(self, body=None, headers=None):
        return self.client.post(ASK_URL, json=body if body is not None else {"topic": "cardapio"}, headers=headers or auth())

    def test_the_first_request_is_written_with_the_owner_and_the_screen(self):
        self.cur.fetchone.side_effect = [CONTEXT, None, {"id": REQUEST_ID}]
        reply = self.ask({"topic": "foto", "message": "a foto sai escura", "screen": "assistente", "phone": "(84) 98888-7777"})
        self.assertEqual(reply.status_code, 201)
        body = reply.get_json()
        self.assertTrue(body["ok"])
        self.assertFalse(body["already"])
        self.assertIn("Recebi", body["message"])
        insert = [c for c in self.cur.execute.call_args_list if "INSERT INTO help_requests" in c.args[0]]
        self.assertEqual(len(insert), 1)
        self.assertEqual(insert[0].args[1], (COMPANY_ID, "user-1", "foto", "assistente", "a foto sai escura", "84988887777"))
        self.conn.commit.assert_called_once()

    def test_asking_again_updates_the_open_request_instead_of_adding_one(self):
        self.cur.fetchone.side_effect = [CONTEXT, {"id": REQUEST_ID, "topic": "foto"}, {"id": REQUEST_ID}]
        reply = self.ask({"topic": "logo", "message": ""})
        self.assertEqual(reply.status_code, 200)
        body = reply.get_json()
        self.assertTrue(body["already"])
        self.assertIn("continua aberto", body["message"])
        sqls = self.sql_run()
        self.assertTrue(any("UPDATE help_requests" in sql for sql in sqls))
        self.assertFalse(any("INSERT INTO help_requests" in sql for sql in sqls))
        update = [c for c in self.cur.execute.call_args_list if "UPDATE help_requests" in c.args[0]][0]
        # o pedido certo, do restaurante certo
        self.assertEqual(update.args[1][-2:], (REQUEST_ID, COMPANY_ID))
        self.assertEqual(update.args[1][-3], help_requests.MAX_REPEATS)

    def test_the_open_request_is_looked_up_for_the_restaurant_of_the_login_only(self):
        self.cur.fetchone.side_effect = [CONTEXT, None, {"id": REQUEST_ID}]
        self.ask()
        lookup = [c for c in self.cur.execute.call_args_list if "FROM help_requests" in c.args[0]][0]
        self.assertIn("company_id = %s", lookup.args[0])
        self.assertEqual(lookup.args[1], (COMPANY_ID,))
        # nada do corpo da requisição escolhe o restaurante
        self.cur.reset_mock()
        self.cur.fetchone.side_effect = [CONTEXT, None, {"id": REQUEST_ID}]
        self.ask({"topic": "erro", "company_id": "22222222-2222-4222-8222-222222222222"})
        insert = [c for c in self.cur.execute.call_args_list if "INSERT INTO help_requests" in c.args[0]][0]
        self.assertEqual(insert.args[1][0], COMPANY_ID)

    def test_with_a_support_whatsapp_the_owner_gets_a_ready_message(self):
        self.cur.fetchone.side_effect = [CONTEXT, None, {"id": REQUEST_ID}]
        with patch.dict(os.environ, {"SUPPORT_WHATSAPP": "(84) 97777-0000"}):
            body = self.ask({"topic": "cardapio", "message": "não acho o botão"}).get_json()
        self.assertTrue(body["whatsapp_url"].startswith("https://wa.me/5584977770000?text="))
        text = unquote(body["whatsapp_url"])
        self.assertIn("Pizzaria do Zé", text)
        self.assertIn("não acho o botão", text)
        self.assertIn("WhatsApp", body["message"])

    def test_without_a_support_whatsapp_there_is_no_link(self):
        self.cur.fetchone.side_effect = [CONTEXT, None, {"id": REQUEST_ID}]
        self.assertEqual(self.ask().get_json()["whatsapp_url"], "")

    def test_a_bad_request_is_refused_before_the_database(self):
        for body in ({"topic": "pizza"}, {}, {"topic": "outro"}, {"topic": "erro", "phone": "123"}):
            reply = self.client.post(ASK_URL, json=body, headers=auth())
            self.assertEqual(reply.status_code, 400, body)
            self.assertTrue(reply.get_json()["error"])
        self.conn.cursor.assert_not_called()

    def test_a_flood_is_stopped(self):
        statuses = []
        for _ in range(help_requests.PER_COMPANY_PER_HOUR + 2):
            self.cur.fetchone.side_effect = [CONTEXT, {"id": REQUEST_ID, "topic": "erro"}, {"id": REQUEST_ID}]
            statuses.append(self.ask().status_code)
        self.assertEqual(statuses[-1], 429)
        self.assertEqual(statuses[0], 200)

    def test_only_owner_and_manager_can_ask(self):
        for role in ("WAITER", "KITCHEN", "CASHIER", "COURIER"):
            self.assertEqual(self.ask(headers=auth(role=role)).status_code, 403, role)
        self.cur.fetchone.side_effect = [CONTEXT, None, {"id": REQUEST_ID}]
        self.assertEqual(self.ask(headers=auth(role="MANAGER")).status_code, 201)
        self.assertEqual(self.client.post(ASK_URL, json={"topic": "erro"}).status_code, 401)

    def test_a_restaurant_that_does_not_exist_writes_nothing(self):
        self.cur.fetchone.side_effect = [None]
        reply = self.ask()
        self.assertEqual(reply.status_code, 404)
        self.conn.commit.assert_not_called()

    def test_a_database_failure_is_a_plain_message_and_never_the_error_text(self):
        self.cur.execute.side_effect = RuntimeError("senha do banco: segredo")
        reply = self.ask()
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("segredo", reply.get_data(as_text=True))
        self.conn.rollback.assert_called()


INBOX_ROW = {"id": REQUEST_ID, "company_id": COMPANY_ID, "topic": "foto", "screen": "assistente", "message": "não sai",
             "contact_phone": None, "repeats": 1, "company_name": "Pizzaria", "slug": "pizzaria",
             "owner_phone": "84999991234", "owner_name": "José", "waiting_seconds": 900}
TRACK_ROW = {"company_id": COMPANY_ID, "name": "Pizzaria", "slug": "pizzaria", "owner_phone": "84999991234",
             "age_seconds": 3 * 86400 + 60, "products": 0, "ready_seconds": None, "has_open_help": True,
             "owner_name": "José", "owner_email": "jose@x.com"}


class PlatformInboxTests(Base):
    def get(self, email="gd@exemplo.com", inbox=None, tracking=None):
        calls = []

        def fake(query, args=(), one=False):
            calls.append((query, args))
            if query is subscription.SQL_USER_EMAIL:
                return {"email": email}
            if query is help_requests.SQL_INBOX:
                return [INBOX_ROW] if inbox is None else inbox
            if query is help_requests.SQL_TRACKING:
                return [TRACK_ROW] if tracking is None else tracking
            raise AssertionError("unexpected query")

        self.calls = calls
        with patch.object(backend_app, "query_db", side_effect=fake):
            return self.client.get(INBOX_URL, headers=auth(user_id=ADMIN_USER))

    def test_the_admin_sees_open_requests_and_the_signup_follow_up(self):
        reply = self.get()
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.headers["Cache-Control"], "no-store")
        body = reply.get_json()
        self.assertEqual(body["open_count"], 1)
        self.assertEqual(body["open"][0]["topic_label"], "Foto de prato")
        self.assertEqual(body["open"][0]["phone"], "5584999991234")
        self.assertEqual(body["tracking"][0]["state"], "over")
        self.assertTrue(body["tracking"][0]["has_open_help"])
        self.assertEqual(body["summary"]["over_deadline"], 1)
        self.assertEqual(body["deadline_days"], 3)

    def test_the_tracking_query_gets_the_dish_count_that_means_ready(self):
        self.get()
        args = [a for q, a in self.calls if q is help_requests.SQL_TRACKING][0]
        self.assertEqual(args, (help_requests.MENU_READY_PRODUCTS - 1,))

    def test_the_tracking_only_follows_restaurants_that_signed_up_by_themselves(self):
        self.assertIn("signup_source = 'web'", help_requests.SQL_TRACKING)

    def test_a_normal_owner_is_refused(self):
        self.assertEqual(self.get(email="dono@exemplo.com").status_code, 403)

    def test_without_the_setting_nobody_is_admin(self):
        with patch.dict(os.environ, {"PLATFORM_ADMIN_EMAILS": ""}):
            self.assertEqual(self.get().status_code, 403)

    def test_it_needs_a_login(self):
        self.assertEqual(self.client.get(INBOX_URL).status_code, 401)

    def test_an_empty_inbox_is_an_empty_list(self):
        body = self.get(inbox=[], tracking=[]).get_json()
        self.assertEqual(body["open"], [])
        self.assertEqual(body["tracking"], [])
        self.assertEqual(body["summary"]["total"], 0)


class ResolveTests(Base):
    def post(self, email="gd@exemplo.com", url=RESOLVE_URL):
        def fake(query, args=(), one=False):
            if query is subscription.SQL_USER_EMAIL:
                return {"email": email}
            raise AssertionError("unexpected query")

        with patch.object(backend_app, "query_db", side_effect=fake):
            return self.client.post(url, headers=auth(user_id=ADMIN_USER))

    def test_the_admin_resolves_a_request(self):
        self.cur.fetchone.side_effect = [{"id": REQUEST_ID}]
        reply = self.post()
        self.assertEqual(reply.status_code, 200)
        update = [c for c in self.cur.execute.call_args_list if "UPDATE help_requests" in c.args[0]][0]
        self.assertEqual(update.args[1], (ADMIN_USER, REQUEST_ID))
        self.conn.commit.assert_called_once()

    def test_resolving_twice_is_not_an_error(self):
        self.cur.fetchone.side_effect = [None, {"status": "done"}]
        self.assertEqual(self.post().status_code, 200)

    def test_a_request_that_does_not_exist_is_a_404(self):
        self.cur.fetchone.side_effect = [None, None]
        self.assertEqual(self.post().status_code, 404)

    def test_a_normal_owner_cannot_resolve(self):
        self.assertEqual(self.post(email="dono@exemplo.com").status_code, 403)
        self.cur.execute.assert_not_called()

    def test_a_bad_id_is_a_404_from_the_router(self):
        self.assertEqual(self.post(url="/api/platform/help/nao-e-um-id/resolve").status_code, 404)


if __name__ == "__main__":
    unittest.main()
