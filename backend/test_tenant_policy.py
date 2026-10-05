import unittest
from decimal import Decimal

from tenant_policy import can_access_order, server_total


class TenantPolicyTests(unittest.TestCase):
    def test_no_session_is_denied(self):
        self.assertFalse(can_access_order(None, "company-a"))

    def test_company_a_cannot_access_company_b(self):
        self.assertFalse(can_access_order({"tenant_id": "company-a"}, "company-b"))

    def test_company_a_can_access_own_order(self):
        self.assertTrue(can_access_order({"tenant_id": "company-a"}, "company-a"))

    def test_client_price_does_not_change_server_total(self):
        catalog = {"p1": Decimal("10.00")}
        client = {"product_id": "p1", "quantity": 2, "price": Decimal("0.01")}
        self.assertEqual(server_total([client], catalog), Decimal("20.00"))


if __name__ == "__main__":
    unittest.main()
