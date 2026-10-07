"""Login que se renova enquanto o painel está em uso (POST /api/auth/refresh). Roda no CI (Flask)."""

import os
import time
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

from werkzeug.security import generate_password_hash  # noqa: E402

import app as backend_app  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
USER_ID = "33333333-3333-4333-8333-333333333333"
URL = "/api/auth/refresh"
USER_ROW = {"id": USER_ID, "company_id": COMPANY_ID, "name": "GD", "email": "gd@exemplo.com", "role": "OWNER"}


def token(**claims):
    base = {"user_id": USER_ID, "company_id": COMPANY_ID, "role": "OWNER"}
    base.update(claims)
    return backend_app.serializer.dumps(base)


def headers(value):
    return {"Authorization": f"Bearer {value}"}


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def test_needs_a_valid_login(self):
        self.assertEqual(self.client.post(URL).status_code, 401)
        self.assertEqual(self.client.post(URL, headers=headers("lixo")).status_code, 401)

    def test_gives_a_new_login_that_keeps_the_first_login_time(self):
        login_at = int(time.time()) - 3600
        with patch.object(backend_app, "query_db", return_value=USER_ROW):
            reply = self.client.post(URL, headers=headers(token(login_at=login_at)))
        self.assertEqual(reply.status_code, 200)
        body = reply.get_json()
        claims = backend_app.serializer.loads(body["token"])
        self.assertEqual(claims["login_at"], login_at)
        self.assertEqual(claims["company_id"], COMPANY_ID)
        self.assertEqual(body["user"]["email"], "gd@exemplo.com")

    def test_the_role_comes_from_the_database(self):
        with patch.object(backend_app, "query_db", return_value={**USER_ROW, "role": "WAITER"}):
            body = self.client.post(URL, headers=headers(token(login_at=int(time.time())))).get_json()
        self.assertEqual(backend_app.serializer.loads(body["token"])["role"], "WAITER")

    def test_an_old_login_without_the_time_starts_counting_now(self):
        with patch.object(backend_app, "query_db", return_value=USER_ROW):
            body = self.client.post(URL, headers=headers(token())).get_json()
        self.assertAlmostEqual(backend_app.serializer.loads(body["token"])["login_at"], int(time.time()), delta=5)

    def test_after_the_maximum_the_password_is_needed_again(self):
        too_old = int(time.time()) - backend_app.SESSION_MAX_SECONDS - 10
        with patch.object(backend_app, "query_db", return_value=USER_ROW) as query:
            reply = self.client.post(URL, headers=headers(token(login_at=too_old)))
        self.assertEqual(reply.status_code, 401)
        query.assert_not_called()

    def test_deactivated_person_or_other_restaurant_is_refused(self):
        with patch.object(backend_app, "query_db", return_value=None):
            self.assertEqual(self.client.post(URL, headers=headers(token(login_at=int(time.time())))).status_code, 401)
        moved = {**USER_ROW, "company_id": "22222222-2222-4222-8222-222222222222"}
        with patch.object(backend_app, "query_db", return_value=moved):
            self.assertEqual(self.client.post(URL, headers=headers(token(login_at=int(time.time())))).status_code, 401)

    def test_login_with_password_records_the_login_time(self):
        row = {**USER_ROW, "password_hash": generate_password_hash("senha-boa-123")}
        with patch.object(backend_app, "query_db", return_value=row), patch.object(
            backend_app, "is_login_blocked", return_value=False
        ), patch.object(backend_app, "clear_failed_logins"):
            reply = self.client.post("/api/auth/login", json={"email": "gd@exemplo.com", "password": "senha-boa-123"})
        self.assertEqual(reply.status_code, 200)
        claims = backend_app.serializer.loads(reply.get_json()["token"])
        self.assertAlmostEqual(claims["login_at"], int(time.time()), delta=5)


if __name__ == "__main__":
    unittest.main()
