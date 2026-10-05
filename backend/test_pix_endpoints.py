import os
import unittest
from unittest.mock import patch

from werkzeug.security import generate_password_hash

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import pix  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
ORDER_ID = "55555555-5555-4555-8555-555555555555"
USER_ID = "99999999-9999-4999-8999-999999999999"
PASSWORD = "segredo-123"

CONFIGURED = {
    "pix_key_type": "cpf",
    "pix_key": "52998224725",
    "pix_receiver_name": "JACK SUSHIMA",
    "pix_city": "NATAL",
}
NOT_CONFIGURED = {
    "pix_key_type": None,
    "pix_key": None,
    "pix_receiver_name": None,
    "pix_city": None,
}


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps(
        {"user_id": USER_ID, "company_id": company_id, "role": role}
    )
    return {"Authorization": f"Bearer {token}"}


def tracking_token(order_id=ORDER_ID, company_id=COMPANY_ID, purpose="order_tracking"):
    return backend_app.serializer.dumps(
        {"purpose": purpose, "order_id": order_id, "company_id": company_id}
    )


class FakeCursor:
    def __init__(self, rows):
        self.rows = list(rows)
        self.executed = []

    def execute(self, sql, params=None):
        self.executed.append((" ".join(sql.split()), params))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def fetchall(self):
        return []

    def close(self):
        pass


class FakeConnection:
    def __init__(self, rows=()):
        self.cursor_obj = FakeCursor(rows)
        self.committed = False
        self.closed = False

    def cursor(self, **kwargs):
        return self.cursor_obj

    def commit(self):
        self.committed = True

    def rollback(self):
        pass

    def close(self):
        self.closed = True


def sql_text(connection):
    return [sql for sql, _ in connection.cursor_obj.executed]


class PixEndpointTestCase(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        backend_app._failed_login_attempts.clear()


class PaymentOptionsTests(PixEndpointTestCase):
    route = f"/api/companies/{COMPANY_ID}/payment-options"

    def test_pix_is_offered_only_when_the_restaurant_set_it_up(self):
        with patch.object(backend_app, "query_db", return_value=CONFIGURED):
            self.assertEqual(self.client.get(self.route).get_json(), {"pix": True})
        with patch.object(backend_app, "query_db", return_value=NOT_CONFIGURED):
            self.assertEqual(self.client.get(self.route).get_json(), {"pix": False})
        with patch.object(backend_app, "query_db", return_value=None):
            self.assertEqual(self.client.get(self.route).get_json(), {"pix": False})

    def test_it_never_exposes_the_key(self):
        with patch.object(backend_app, "query_db", return_value=CONFIGURED):
            body = self.client.get(self.route).get_data(as_text=True)
        self.assertNotIn(CONFIGURED["pix_key"], body)


class OrderPixTests(PixEndpointTestCase):
    def route(self, token=None, order_id=ORDER_ID):
        token = tracking_token() if token is None else token
        return f"/api/orders/{order_id}/pix?tracking_token={token}"

    def order(self, **overrides):
        row = {
            "id": ORDER_ID,
            "company_id": COMPANY_ID,
            "total_price": "179.80",
            "payment_method": "pix",
        }
        row.update(overrides)
        return row

    def call(self, order, company, **kwargs):
        def fake(sql, params=(), one=False):
            return order if "FROM orders" in sql else company

        with patch.object(backend_app, "query_db", side_effect=fake):
            return self.client.get(self.route(**kwargs))

    def test_without_a_valid_tracking_token_nothing_is_revealed(self):
        for token in ("", "garbage", tracking_token(order_id="other"), tracking_token(purpose="login")):
            response = self.client.get(self.route(token=token or "x"))
            self.assertEqual(response.status_code, 401, token)

    def test_a_token_from_another_company_is_refused(self):
        response = self.call(
            self.order(), CONFIGURED, token=tracking_token(company_id=OTHER_COMPANY_ID)
        )
        self.assertEqual(response.status_code, 401)

    def test_code_carries_the_exact_order_total(self):
        response = self.call(self.order(), CONFIGURED)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["amount"], "179.80")
        self.assertEqual(data["receiver_name"], "JACK SUSHIMA")
        self.assertTrue(data["qr_data_url"].startswith("data:image/png;base64,"))

        payload = data["payload"]
        self.assertTrue(pix.is_valid_payload(payload))
        fields = pix.parse_payload(payload)
        self.assertEqual(fields["54"], "179.80")
        self.assertEqual(fields["59"], "JACK SUSHIMA")
        self.assertEqual(pix.parse_payload(fields["26"])["01"], "52998224725")
        self.assertEqual(pix.parse_payload(fields["62"])["05"], "VC55555555")

    def test_only_pix_orders_get_a_code(self):
        for method in ("cartao", "dinheiro", None):
            response = self.call(self.order(payment_method=method), CONFIGURED)
            self.assertEqual(response.status_code, 404, method)

    def test_restaurant_without_pix_gets_a_clear_not_found(self):
        response = self.call(self.order(), NOT_CONFIGURED)
        self.assertEqual(response.status_code, 404)

    def test_unknown_order_is_not_found(self):
        response = self.call(None, CONFIGURED)
        self.assertEqual(response.status_code, 404)


class AdminPixSettingsTests(PixEndpointTestCase):
    route = f"/api/companies/{COMPANY_ID}/admin/pix"

    def user_row(self):
        return {"email": "dono@jack.com", "password_hash": generate_password_hash(PASSWORD)}

    def fake_query(self, settings=CONFIGURED, user=True):
        def fake(sql, params=(), one=False):
            if "FROM users" in sql:
                return self.user_row() if user else None
            return settings

        return fake

    def save(self, body, role="OWNER", connection=None, user=True):
        connection = connection or FakeConnection()
        with patch.object(backend_app, "query_db", side_effect=self.fake_query(user=user)), patch.object(
            backend_app, "get_db_connection", return_value=connection
        ):
            response = self.client.put(self.route, json=body, headers=auth(role))
        return response, connection

    def good_body(self, **overrides):
        body = {
            "key_type": "cpf",
            "key": "529.982.247-25",
            "receiver_name": "Jack Sushima Ltda",
            "city": "Natal",
            "password": PASSWORD,
        }
        body.update(overrides)
        return body

    # --- reading -------------------------------------------------------

    def test_reading_needs_owner_or_manager_of_this_company(self):
        self.assertEqual(self.client.get(self.route).status_code, 401)
        for role in ("WAITER", "CASHIER", "KITCHEN"):
            self.assertEqual(self.client.get(self.route, headers=auth(role)).status_code, 403, role)
        self.assertEqual(
            self.client.get(self.route, headers=auth("OWNER", OTHER_COMPANY_ID)).status_code, 403
        )

    def test_reading_shows_a_masked_key_never_the_full_one(self):
        with patch.object(backend_app, "query_db", return_value=CONFIGURED):
            response = self.client.get(self.route, headers=auth("MANAGER"))
        data = response.get_json()
        self.assertEqual(data["configured"], True)
        self.assertEqual(data["key_masked"], "529••••••25")
        self.assertNotIn("52998224725", response.get_data(as_text=True))

    def test_reading_when_nothing_is_set(self):
        with patch.object(backend_app, "query_db", return_value=NOT_CONFIGURED):
            self.assertEqual(
                self.client.get(self.route, headers=auth()).get_json(), {"configured": False}
            )

    # --- saving --------------------------------------------------------

    def test_only_the_owner_can_change_where_the_money_goes(self):
        for role in ("MANAGER", "CASHIER", "WAITER", "KITCHEN"):
            response, connection = self.save(self.good_body(), role=role)
            self.assertEqual(response.status_code, 403, role)
            self.assertFalse(connection.committed)
        self.assertEqual(self.client.put(self.route, json=self.good_body()).status_code, 401)

    def test_another_company_cannot_be_edited(self):
        with patch.object(backend_app, "get_db_connection", return_value=FakeConnection()):
            response = self.client.put(
                self.route, json=self.good_body(), headers=auth("OWNER", OTHER_COMPANY_ID)
            )
        self.assertEqual(response.status_code, 403)

    def test_the_password_is_asked_again(self):
        for password in ("", "errada-123", None):
            response, connection = self.save(self.good_body(password=password))
            self.assertEqual(response.status_code, 403, password)
            self.assertFalse(connection.committed)
            self.assertEqual(connection.cursor_obj.executed, [])

    def test_wrong_passwords_are_rate_limited(self):
        statuses = []
        for _ in range(backend_app.LOGIN_MAX_ATTEMPTS + 1):
            response, _ = self.save(self.good_body(password="errada-123"))
            statuses.append(response.status_code)
        self.assertEqual(statuses[:-1], [403] * backend_app.LOGIN_MAX_ATTEMPTS)
        self.assertEqual(statuses[-1], 429)
        # Even the right password waits while blocked.
        response, _ = self.save(self.good_body())
        self.assertEqual(response.status_code, 429)

    def test_a_removed_or_unknown_user_cannot_save(self):
        response, connection = self.save(self.good_body(), user=False)
        self.assertEqual(response.status_code, 403)
        self.assertFalse(connection.committed)

    def test_invalid_data_is_refused_with_a_message_the_owner_can_act_on(self):
        cases = [
            (self.good_body(key="529.982.247-26"), "CPF inválido"),
            (self.good_body(key_type="cartao"), "tipo da chave"),
            (self.good_body(receiver_name=""), "nome do recebedor"),
            (self.good_body(city="!!!"), "cidade"),
        ]
        for body, expected in cases:
            response, connection = self.save(body)
            self.assertEqual(response.status_code, 400, expected)
            self.assertIn(expected, response.get_json()["error"])
            self.assertFalse(connection.committed)

    def test_saving_stores_the_normalised_values_for_this_company_only(self):
        response, connection = self.save(self.good_body())
        self.assertEqual(response.status_code, 200)
        self.assertTrue(connection.committed)
        self.assertIn("UPDATE companies", sql_text(connection)[0])
        self.assertEqual(
            connection.cursor_obj.executed[0][1],
            ("cpf", "52998224725", "JACK SUSHIMA LTDA", "NATAL", COMPANY_ID),
        )
        data = response.get_json()
        self.assertEqual(data["configured"], True)
        self.assertNotIn("52998224725", response.get_data(as_text=True))

    def test_the_owner_can_turn_pix_off(self):
        response, connection = self.save({"remove": True, "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            connection.cursor_obj.executed[0][1], (None, None, None, None, COMPANY_ID)
        )
        self.assertEqual(response.get_json(), {"configured": False})


class PreviewTests(PixEndpointTestCase):
    route = f"/api/companies/{COMPANY_ID}/admin/pix/preview"

    def test_roles_and_company(self):
        self.assertEqual(self.client.get(self.route).status_code, 401)
        self.assertEqual(self.client.get(self.route, headers=auth("WAITER")).status_code, 403)
        self.assertEqual(
            self.client.get(self.route, headers=auth("OWNER", OTHER_COMPANY_ID)).status_code, 403
        )

    def test_test_code_is_one_real_and_marked_as_a_test(self):
        with patch.object(backend_app, "query_db", return_value=CONFIGURED):
            response = self.client.get(self.route, headers=auth("MANAGER"))
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["amount"], "1.00")
        self.assertTrue(pix.is_valid_payload(data["payload"]))
        fields = pix.parse_payload(data["payload"])
        self.assertEqual(pix.parse_payload(fields["62"])["05"], "TESTE")

    def test_without_pix_it_says_so(self):
        with patch.object(backend_app, "query_db", return_value=NOT_CONFIGURED):
            self.assertEqual(self.client.get(self.route, headers=auth()).status_code, 404)


class ConfirmPaymentTests(PixEndpointTestCase):
    route = f"/api/orders/{ORDER_ID}/payment/confirm"

    def confirm(self, rows, role="CASHIER", company_id=COMPANY_ID):
        connection = FakeConnection(rows)
        with patch.object(backend_app, "get_db_connection", return_value=connection):
            response = self.client.post(self.route, headers=auth(role, company_id))
        return response, connection

    def test_only_people_who_handle_money_can_confirm(self):
        self.assertEqual(self.client.post(self.route).status_code, 401)
        for role in ("WAITER", "KITCHEN", "COURIER"):
            response, connection = self.confirm([{"id": "p1", "status": "PENDING"}], role=role)
            self.assertEqual(response.status_code, 403, role)
            self.assertFalse(connection.committed)
        for role in ("OWNER", "MANAGER", "CASHIER"):
            response, _ = self.confirm([{"id": "p1", "status": "PENDING"}], role=role)
            self.assertEqual(response.status_code, 200, role)

    def test_confirming_marks_paid_and_records_the_event(self):
        response, connection = self.confirm([{"id": "pay-1", "status": "PENDING"}])
        self.assertEqual(response.status_code, 200)
        self.assertTrue(connection.committed)
        statements = sql_text(connection)
        self.assertIn("UPDATE payments SET status = 'PAID'", statements[1])
        self.assertIn("PAYMENT_CONFIRMED", statements[2])
        self.assertEqual(connection.cursor_obj.executed[1][1], ("pay-1",))

    def test_the_lookup_is_scoped_to_the_company_of_the_login(self):
        _, connection = self.confirm([{"id": "pay-1", "status": "PENDING"}])
        sql, params = connection.cursor_obj.executed[0]
        self.assertIn("o.company_id = %s", sql)
        self.assertEqual(params, (ORDER_ID, COMPANY_ID))

    def test_an_order_of_another_restaurant_is_not_found(self):
        response, connection = self.confirm([], company_id=OTHER_COMPANY_ID)
        self.assertEqual(response.status_code, 404)
        self.assertFalse(connection.committed)

    def test_confirming_twice_is_harmless(self):
        response, connection = self.confirm([{"id": "pay-1", "status": "PAID"}])
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["already_paid"])
        self.assertFalse(connection.committed)
        self.assertEqual(len(connection.cursor_obj.executed), 1)


class PaymentStateIsVisibleTests(PixEndpointTestCase):
    def test_owner_panel_orders_carry_the_payment_state(self):
        with patch.object(backend_app, "query_db", return_value=[]) as query_db:
            self.client.get(f"/api/companies/{COMPANY_ID}/admin/orders", headers=auth("KITCHEN"))
        sql = " ".join(query_db.call_args[0][0].split())
        self.assertIn("AS payment_status", sql)
        self.assertIn("WHERE o.company_id = %s", sql)

    def test_the_customers_order_carries_how_it_is_paid_and_whether_it_was(self):
        order = {
            "id": ORDER_ID,
            "company_id": COMPANY_ID,
            "customer_name": "Jack",
            "total_price": "179.80",
            "status": "PENDING_PAYMENT",
            "payment_method": "pix",
            "payment_status": "PAID",
        }
        connection = FakeConnection([order])
        with patch.object(backend_app, "get_db_connection", return_value=connection):
            response = self.client.get(f"/api/orders/{ORDER_ID}?tracking_token={tracking_token()}")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["payment_method"], "pix")
        self.assertEqual(data["payment_status"], "PAID")
        self.assertIn("AS payment_status", sql_text(connection)[0])


if __name__ == "__main__":
    unittest.main()
