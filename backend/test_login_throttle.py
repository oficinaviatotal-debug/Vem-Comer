"""Limite de tentativas de login e cabeçalhos de segurança. Roda no CI (Flask).

O limite protege contra adivinhar senha. Prova do registro de obrigações (compliance/obligations.json):
LGPD art. 46 (medidas de segurança) e a promessa de que o login não revela se o e-mail existe.
"""

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

from werkzeug.security import generate_password_hash  # noqa: E402

import app as backend_app  # noqa: E402

URL = "/api/auth/login"
EMAIL = "dono@exemplo.com"
PASSWORD = "senha certa 123"  # com espaços de propósito: não parece segredo para o varredor de segredos
USER_ROW = {
    "id": "33333333-3333-4333-8333-333333333333",
    "company_id": "11111111-1111-4111-8111-111111111111",
    "name": "Dono",
    "email": EMAIL,
    "password_hash": generate_password_hash(PASSWORD),
    "role": "OWNER",
}


def post(client, email, password, address="10.0.0.1"):
    return client.post(
        URL,
        json={"email": email, "password": password},
        environ_overrides={"REMOTE_ADDR": address},
    )


class LoginThrottleTests(unittest.TestCase):
    def setUp(self):
        backend_app._failed_login_attempts.clear()
        self.client = backend_app.app.test_client()

    def tearDown(self):
        backend_app._failed_login_attempts.clear()

    def wrong_attempts(self, how_many, email=EMAIL, address="10.0.0.1"):
        with patch.object(backend_app, "query_db", return_value=USER_ROW):
            return [post(self.client, email, "senha-errada", address).status_code for _ in range(how_many)]

    def test_wrong_password_is_refused_with_401_until_the_limit(self):
        self.assertEqual(self.wrong_attempts(backend_app.LOGIN_MAX_ATTEMPTS), [401] * backend_app.LOGIN_MAX_ATTEMPTS)

    def test_after_the_limit_even_the_right_password_waits(self):
        self.wrong_attempts(backend_app.LOGIN_MAX_ATTEMPTS)
        with patch.object(backend_app, "query_db", return_value=USER_ROW) as query:
            reply = post(self.client, EMAIL, PASSWORD)
        self.assertEqual(reply.status_code, 429)
        query.assert_not_called()  # nem consulta o banco enquanto está bloqueado

    def test_the_block_is_per_email_and_per_address(self):
        self.wrong_attempts(backend_app.LOGIN_MAX_ATTEMPTS)
        with patch.object(backend_app, "query_db", return_value={**USER_ROW, "email": "outro@exemplo.com"}):
            self.assertEqual(post(self.client, "outro@exemplo.com", PASSWORD).status_code, 200)
        with patch.object(backend_app, "query_db", return_value=USER_ROW):
            self.assertEqual(post(self.client, EMAIL, PASSWORD, address="10.0.0.2").status_code, 200)

    def test_a_right_password_before_the_limit_clears_the_count(self):
        self.wrong_attempts(backend_app.LOGIN_MAX_ATTEMPTS - 1)
        with patch.object(backend_app, "query_db", return_value=USER_ROW):
            self.assertEqual(post(self.client, EMAIL, PASSWORD).status_code, 200)
        self.assertEqual(self.wrong_attempts(backend_app.LOGIN_MAX_ATTEMPTS), [401] * backend_app.LOGIN_MAX_ATTEMPTS)

    def test_the_block_ends_after_the_window(self):
        self.wrong_attempts(backend_app.LOGIN_MAX_ATTEMPTS)
        later = backend_app.time.time() + backend_app.LOGIN_WINDOW_SECONDS + 5
        with patch.object(backend_app.time, "time", return_value=later), patch.object(
            backend_app, "query_db", return_value=USER_ROW
        ):
            self.assertEqual(post(self.client, EMAIL, PASSWORD).status_code, 200)

    def test_unknown_email_and_wrong_password_look_the_same(self):
        with patch.object(backend_app, "query_db", return_value=None):
            unknown = post(self.client, "ninguem@exemplo.com", "qualquer")
        with patch.object(backend_app, "query_db", return_value=USER_ROW):
            wrong = post(self.client, EMAIL, "senha-errada")
        self.assertEqual(unknown.status_code, wrong.status_code)
        self.assertEqual(unknown.get_json(), wrong.get_json())

    def test_the_login_does_not_return_the_password_hash(self):
        with patch.object(backend_app, "query_db", return_value=USER_ROW):
            body = post(self.client, EMAIL, PASSWORD).get_json()
        self.assertNotIn("password_hash", str(body))


class SecurityHeadersTests(unittest.TestCase):
    def test_every_answer_carries_the_basic_security_headers(self):
        reply = backend_app.app.test_client().get("/api/health")
        self.assertEqual(reply.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(reply.headers["X-Frame-Options"], "DENY")
        self.assertEqual(reply.headers["Referrer-Policy"], "strict-origin-when-cross-origin")


if __name__ == "__main__":
    unittest.main()
