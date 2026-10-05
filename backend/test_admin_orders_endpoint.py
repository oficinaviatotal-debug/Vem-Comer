import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
ROUTE = f"/api/companies/{COMPANY_ID}/admin/orders"

ORDER_ROWS = [
    {
        "id": "55555555-5555-4555-8555-555555555555",
        "customer_name": "Ana",
        "total_price": "105.80",
        "status": "PENDING_PAYMENT",
        "payment_method": "pix",
        "payment_change": None,
        "created_at": "2026-10-05T15:35:44",
        "table_number": "4",
        "items": [
            {"name": "Combinado 20 pecas", "quantity": 2, "unit_price": 49.9, "total": 99.8},
            {"name": "Refrigerante", "quantity": 1, "unit_price": 6.0, "total": 6.0},
        ],
    }
]


def auth(company_id=COMPANY_ID, role="KITCHEN"):
    token = backend_app.serializer.dumps(
        {"user_id": "user-1", "company_id": company_id, "role": role}
    )
    return {"Authorization": f"Bearer {token}"}


class AdminOrdersEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def test_requires_login(self):
        self.assertEqual(self.client.get(ROUTE).status_code, 401)

    def test_other_company_is_forbidden(self):
        response = self.client.get(
            ROUTE, headers=auth(company_id=OTHER_COMPANY_ID)
        )
        self.assertEqual(response.status_code, 403)

    def test_returns_orders_with_items_and_table_number(self):
        with patch.object(backend_app, "query_db", return_value=ORDER_ROWS):
            response = self.client.get(ROUTE, headers=auth())

        self.assertEqual(response.status_code, 200)
        orders = response.get_json()
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["table_number"], "4")
        self.assertEqual(
            [item["name"] for item in orders[0]["items"]],
            ["Combinado 20 pecas", "Refrigerante"],
        )
        self.assertEqual(orders[0]["items"][0]["quantity"], 2)

    def test_query_is_scoped_to_the_company_of_the_login(self):
        with patch.object(
            backend_app, "query_db", return_value=[]
        ) as query_db:
            response = self.client.get(ROUTE, headers=auth())

        self.assertEqual(response.status_code, 200)
        sql, params = query_db.call_args.args
        self.assertEqual(params, (COMPANY_ID,))
        # Every table touched by the query is tied to the same company, so an
        # order can never pick up another restaurant's product or table.
        self.assertIn("WHERE o.company_id = %s", sql)
        self.assertIn("p.company_id = o.company_id", sql)
        self.assertIn("t.company_id = o.company_id", sql)
        self.assertIn("order_items", sql)
        self.assertIn("table_number", sql)

    def test_empty_restaurant_gets_an_empty_list(self):
        with patch.object(backend_app, "query_db", return_value=[]):
            response = self.client.get(ROUTE, headers=auth())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])


if __name__ == "__main__":
    unittest.main()
