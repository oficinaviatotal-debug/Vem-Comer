"""Descadastro de um clique (compliance_api.py). Roda no CI (Flask), com banco de mentira."""

import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import compliance_api  # noqa: E402
import outreach  # noqa: E402

SECRET = os.environ["SECRET_KEY"]
EMAIL = "Joao@Empresa.com.br"
TOKEN = outreach.unsubscribe_token(EMAIL, SECRET)
URL = "/api/descadastro"


def fake_connection():
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.fetchone.return_value = None
    return connection, cursor


class UnsubscribePageTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def test_get_shows_a_button_and_never_touches_the_database(self):
        with patch.object(compliance_api, "get_db_connection") as connect:
            reply = self.client.get(f"{URL}?t={TOKEN}")
        connect.assert_not_called()
        self.assertEqual(reply.status_code, 200)
        page = reply.get_data(as_text=True)
        self.assertIn("j***@empresa.com.br", page)
        self.assertNotIn("joao@empresa.com.br", page.lower())  # só a versão escondida
        self.assertIn('method="post"', page)
        self.assertIn('lang="pt-BR"', page)

    def test_the_page_is_never_cached_nor_indexed_and_keeps_the_security_headers(self):
        reply = self.client.get(f"{URL}?t={TOKEN}")
        self.assertEqual(reply.headers["Cache-Control"], "no-store")
        self.assertEqual(reply.headers["X-Robots-Tag"], "noindex")
        self.assertEqual(reply.headers["X-Frame-Options"], "DENY")

    def test_a_bad_or_missing_link_says_so_without_revealing_anything(self):
        for query in ("", "?t=", "?t=lixo", f"?t={TOKEN[:-3]}abc"):
            reply = self.client.get(URL + query)
            self.assertEqual(reply.status_code, 400, query)
            self.assertIn("não é válido", reply.get_data(as_text=True))

    def test_the_masked_address_is_escaped(self):
        token = outreach.unsubscribe_token("<script>@x.co", SECRET)
        page = self.client.get(f"{URL}?t={token}").get_data(as_text=True)
        self.assertNotIn("<script>", page)
        self.assertIn("&lt;***@x.co", page)


class UnsubscribeActionTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def run_post(self, **kwargs):
        connection, cursor = fake_connection()
        with patch.object(compliance_api, "get_db_connection", return_value=connection):
            reply = self.client.post(**kwargs)
        return reply, connection, cursor

    def test_post_blocks_the_address_and_withdraws_every_email_consent_in_one_transaction(self):
        reply, connection, cursor = self.run_post(path=URL, data={"t": TOKEN})
        self.assertEqual(reply.status_code, 200)
        self.assertIn("não vai mais receber", reply.get_data(as_text=True))
        statements = [c.args for c in cursor.execute.call_args_list]
        suppression = [a for sql, a in statements if "INSERT INTO email_suppression" in sql]
        self.assertEqual(suppression, [(outreach.email_hash("joao@empresa.com.br"), "pediu")])
        consents = [a for sql, a in statements if "INSERT INTO consent_records" in sql]
        self.assertEqual([a[2] for a in consents], ["alertas_email", "divulgacao_email"])
        self.assertTrue(all(a[3] is False for a in consents))
        connection.commit.assert_called_once()
        connection.rollback.assert_not_called()

    def test_the_one_click_post_from_the_mail_app_works_without_a_form(self):
        # RFC 8058: o programa de e-mail manda "List-Unsubscribe=One-Click" e o token vai na própria URL
        reply, connection, _ = self.run_post(
            path=f"{URL}?t={TOKEN}", data="List-Unsubscribe=One-Click", content_type="application/x-www-form-urlencoded"
        )
        self.assertEqual(reply.status_code, 200)
        connection.commit.assert_called_once()

    def test_json_clients_get_json(self):
        reply, _, _ = self.run_post(path=f"{URL}?t={TOKEN}", json={}, headers={"Accept": "application/json"})
        self.assertEqual(reply.get_json(), {"ok": True})

    def test_doing_it_twice_is_harmless(self):
        for _ in range(2):
            reply, _, _ = self.run_post(path=URL, data={"t": TOKEN})
            self.assertEqual(reply.status_code, 200)

    def test_a_bad_link_changes_nothing(self):
        for token in ("", "lixo", TOKEN[:-3] + "abc"):
            with patch.object(compliance_api, "get_db_connection") as connect:
                reply = self.client.post(URL, data={"t": token})
            connect.assert_not_called()
            self.assertEqual(reply.status_code, 400)
        with patch.object(compliance_api, "get_db_connection") as connect:
            reply = self.client.post(URL, json={}, headers={"Accept": "application/json"})
        self.assertEqual(reply.status_code, 400)
        self.assertEqual(reply.get_json(), {"error": "Link inválido"})
        connect.assert_not_called()

    def test_a_database_failure_rolls_back_and_hides_the_details(self):
        connection, cursor = fake_connection()
        cursor.execute.side_effect = RuntimeError("senha do banco: segredo123")
        with patch.object(compliance_api, "get_db_connection", return_value=connection):
            reply = self.client.post(URL, data={"t": TOKEN})
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("segredo123", reply.get_data(as_text=True))
        connection.rollback.assert_called_once()
        connection.commit.assert_not_called()
        connection.close.assert_called_once()

    def test_the_route_is_open_without_login(self):
        self.assertIn(URL, [r.rule for r in backend_app.app.url_map.iter_rules()])


if __name__ == "__main__":
    unittest.main()
