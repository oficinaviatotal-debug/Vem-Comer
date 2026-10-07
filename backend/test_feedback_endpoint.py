"""Rota do 'Como foi?' (POST /api/admin/feedback). Roda no CI (precisa do Flask); o banco é simulado."""

import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import feedback  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
URL = "/api/admin/feedback"


def auth(role="OWNER", company_id=COMPANY_ID, user_id="user-1"):
    token = backend_app.serializer.dumps({"user_id": user_id, "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


class FeedbackEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        limiter = patch.object(feedback, "limiter", feedback.Limiter())
        limiter.start()
        self.addCleanup(limiter.stop)
        self.conn = MagicMock()
        self.cur = self.conn.cursor.return_value
        db = patch.object(backend_app, "get_db_connection", return_value=self.conn)
        db.start()
        self.addCleanup(db.stop)

    def test_needs_login(self):
        self.assertEqual(self.client.post(URL, json={"rating": 3}).status_code, 401)

    def test_saves_for_the_company_and_person_of_the_login(self):
        reply = self.client.post(
            URL, json={"context": "cardapio_falado", "rating": 1, "comment": "a voz está robótica"},
            headers=auth(role="WAITER"),
        )
        self.assertEqual(reply.status_code, 201)
        sql, params = self.cur.execute.call_args.args
        self.assertIn("INSERT INTO feedback", sql)
        self.assertEqual(params, (COMPANY_ID, "user-1", "cardapio_falado", 1, "a voz está robótica"))
        self.conn.commit.assert_called_once()

    def test_company_id_in_the_body_is_ignored(self):
        self.client.post(URL, json={"rating": 3, "company_id": "22222222-2222-4222-8222-222222222222"}, headers=auth())
        self.assertEqual(self.cur.execute.call_args.args[1][0], COMPANY_ID)

    def test_bad_answer_is_refused_without_touching_the_database(self):
        reply = self.client.post(URL, json={"rating": 7}, headers=auth())
        self.assertEqual(reply.status_code, 400)
        self.cur.execute.assert_not_called()

    def test_database_failure(self):
        self.cur.execute.side_effect = RuntimeError("caiu")
        reply = self.client.post(URL, json={"rating": 2}, headers=auth())
        self.assertEqual(reply.status_code, 500)
        self.conn.rollback.assert_called_once()
        self.conn.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
