"""Rotas da Mesa viva. Roda no CI (precisa do Flask); o banco é simulado."""

import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import table_calls  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
TABLE_ID = "33333333-3333-4333-8333-333333333333"
CALL_ID = "44444444-4444-4444-8444-444444444444"

CALLS_URL = f"/api/companies/{COMPANY_ID}/tables/{TABLE_ID}/calls"
STATUS_URL = f"{CALLS_URL}/{CALL_ID}"
LIST_URL = f"/api/companies/{COMPANY_ID}/admin/table-calls"
ANSWER_URL = f"{LIST_URL}/{CALL_ID}/answer"


def auth(role="WAITER", company_id=COMPANY_ID, user_id="user-1"):
    token = backend_app.serializer.dumps({"user_id": user_id, "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


class Base(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        limiter = patch.object(backend_app, "table_call_limiter", table_calls.Limiter())
        limiter.start()
        self.addCleanup(limiter.stop)
        self.conn = MagicMock()
        self.cur = self.conn.cursor.return_value
        db = patch.object(backend_app, "get_db_connection", return_value=self.conn)
        db.start()
        self.addCleanup(db.stop)

    def sql_run(self):
        return [call.args[0] for call in self.cur.execute.call_args_list]


class CustomerCallTests(Base):
    def test_first_tap_opens_a_call(self):
        self.cur.fetchone.side_effect = [
            {"id": TABLE_ID, "number": 4},  # a mesa existe neste restaurante
            None,  # nenhuma chamada igual aberta
            {"id": CALL_ID, "kind": "garcom", "status": "open"},  # a nova
        ]
        reply = self.client.post(CALLS_URL, json={"kind": "garcom"})
        self.assertEqual(reply.status_code, 201)
        body = reply.get_json()
        self.assertEqual(body["id"], CALL_ID)
        self.assertFalse(body["already"])
        self.assertTrue(body["message"])
        insert_sql, params = self.cur.execute.call_args_list[-1].args
        self.assertIn("INSERT INTO table_calls", insert_sql)
        self.assertEqual(params, (COMPANY_ID, TABLE_ID, "garcom"))
        self.conn.commit.assert_called_once()

    def test_the_table_lookup_is_scoped_to_the_restaurant_in_the_address(self):
        self.cur.fetchone.side_effect = [None]
        self.client.post(CALLS_URL, json={"kind": "garcom"})
        sql, params = self.cur.execute.call_args_list[0].args
        self.assertIn("company_id", sql)
        self.assertEqual(params, (TABLE_ID, COMPANY_ID))

    def test_tapping_again_does_not_create_a_second_call(self):
        self.cur.fetchone.side_effect = [
            {"id": TABLE_ID, "number": 4},
            {"id": CALL_ID, "kind": "conta", "status": "open"},
        ]
        reply = self.client.post(CALLS_URL, json={"kind": "conta"})
        self.assertEqual(reply.status_code, 200)
        self.assertTrue(reply.get_json()["already"])
        sqls = self.sql_run()
        self.assertTrue(any("UPDATE table_calls" in sql for sql in sqls))
        self.assertFalse(any("INSERT INTO table_calls" in sql for sql in sqls))
        self.conn.commit.assert_called_once()

    def test_a_table_that_does_not_exist_is_a_404_and_writes_nothing(self):
        self.cur.fetchone.side_effect = [None]
        reply = self.client.post(CALLS_URL, json={"kind": "agua"})
        self.assertEqual(reply.status_code, 404)
        self.conn.commit.assert_not_called()

    def test_a_bad_kind_is_refused_without_touching_the_database(self):
        for body in ({"kind": "pizza"}, {}, None):
            reply = self.client.post(CALLS_URL, json=body)
            self.assertEqual(reply.status_code, 400)
        self.cur.execute.assert_not_called()

    def test_too_many_taps_from_one_table_get_a_friendly_429(self):
        statuses = []
        for _ in range(table_calls.PER_TABLE_PER_10_MIN + 1):
            self.cur.fetchone.side_effect = [
                {"id": TABLE_ID, "number": 4},
                {"id": CALL_ID, "kind": "garcom", "status": "open"},
            ]
            statuses.append(self.client.post(CALLS_URL, json={"kind": "garcom"}).status_code)
        self.assertEqual(statuses[:-1], [200] * table_calls.PER_TABLE_PER_10_MIN)
        self.assertEqual(statuses[-1], 429)

    def test_too_many_taps_from_one_address_get_429_before_the_database(self):
        for _ in range(table_calls.PER_IP_PER_HOUR):
            self.cur.fetchone.side_effect = [None]
            self.client.post(CALLS_URL, json={"kind": "garcom"})
        self.cur.execute.reset_mock()
        reply = self.client.post(CALLS_URL, json={"kind": "garcom"})
        self.assertEqual(reply.status_code, 429)
        self.cur.execute.assert_not_called()

    def test_a_database_failure_asks_the_customer_to_call_by_hand(self):
        self.cur.execute.side_effect = RuntimeError("caiu")
        reply = self.client.post(CALLS_URL, json={"kind": "garcom"})
        self.assertEqual(reply.status_code, 500)
        self.assertIn("Chame", reply.get_json()["error"])
        self.conn.rollback.assert_called_once()
        self.conn.close.assert_called_once()

    def test_the_customer_can_check_progress_and_sees_nothing_else(self):
        self.cur.fetchone.side_effect = [
            {"id": CALL_ID, "kind": "garcom", "status": "answered", "repeats": 2, "answered_by": "user-1"}
        ]
        reply = self.client.get(STATUS_URL)
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json(), {"id": CALL_ID, "kind": "garcom", "status": "answered"})
        sql, params = self.cur.execute.call_args.args
        self.assertEqual(params, (CALL_ID, COMPANY_ID, TABLE_ID))

    def test_progress_of_an_unknown_call_is_404(self):
        self.cur.fetchone.side_effect = [None]
        self.assertEqual(self.client.get(STATUS_URL).status_code, 404)


class PanelTests(Base):
    def test_listing_needs_login(self):
        self.assertEqual(self.client.get(LIST_URL).status_code, 401)

    def test_another_restaurant_cannot_see_the_calls(self):
        reply = self.client.get(LIST_URL, headers=auth(company_id=OTHER_COMPANY_ID))
        self.assertEqual(reply.status_code, 403)
        self.cur.execute.assert_not_called()

    def test_the_team_sees_open_calls_with_text_and_colour(self):
        self.cur.fetchall.return_value = [
            {"id": CALL_ID, "table_id": TABLE_ID, "table_number": 7, "kind": "garcom", "repeats": 0, "waiting_seconds": 500},
            {"id": "c2", "table_id": "t2", "table_number": 2, "kind": "agua", "repeats": 0, "waiting_seconds": 20},
        ]
        reply = self.client.get(LIST_URL, headers=auth(role="WAITER"))
        self.assertEqual(reply.status_code, 200)
        body = reply.get_json()
        self.assertEqual(body[0]["text"], "Mesa 7 chama o garçom")
        self.assertEqual(body[0]["urgency"], "urgent")
        self.assertEqual(body[1]["urgency"], "normal")
        self.assertEqual(self.cur.execute.call_args.args[1], (COMPANY_ID, table_calls.OPEN_WINDOW_MINUTES))

    def test_answering_closes_the_call_and_records_who_answered(self):
        self.cur.fetchone.side_effect = [{"id": CALL_ID, "seconds_to_answer": 75}]
        reply = self.client.post(ANSWER_URL, headers=auth(user_id="garcom-9"))
        self.assertEqual(reply.status_code, 200)
        self.assertEqual(reply.get_json(), {"ok": True, "already": False, "seconds_to_answer": 75})
        sql, params = self.cur.execute.call_args.args
        self.assertIn("status = 'open'", sql)
        self.assertEqual(params, ("garcom-9", CALL_ID, COMPANY_ID))
        self.conn.commit.assert_called_once()

    def test_two_waiters_tapping_the_same_call_is_not_an_error(self):
        self.cur.fetchone.side_effect = [None, {"status": "answered"}]
        reply = self.client.post(ANSWER_URL, headers=auth())
        self.assertEqual(reply.status_code, 200)
        self.assertTrue(reply.get_json()["already"])
        self.conn.commit.assert_not_called()

    def test_a_call_from_another_restaurant_is_not_found(self):
        self.cur.fetchone.side_effect = [None, None]
        reply = self.client.post(ANSWER_URL, headers=auth())
        self.assertEqual(reply.status_code, 404)

    def test_answering_needs_login_and_the_right_restaurant(self):
        self.assertEqual(self.client.post(ANSWER_URL).status_code, 401)
        reply = self.client.post(ANSWER_URL, headers=auth(company_id=OTHER_COMPANY_ID))
        self.assertEqual(reply.status_code, 403)
        self.cur.execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
