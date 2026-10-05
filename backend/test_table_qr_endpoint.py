import base64
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
TABLE_ID = "33333333-3333-4333-8333-333333333333"
OTHER_TABLE_ID = "44444444-4444-4444-8444-444444444444"
SLUG = "jack-sushima"

ROUTE = f"/api/companies/{COMPANY_ID}/admin/tables/{TABLE_ID}/qr"


def table_link(slug=SLUG, table_id=TABLE_ID, scheme="https"):
    return f"{scheme}://app.example/?empresa={slug}&mesa={table_id}"


def auth(company_id=COMPANY_ID, role="WAITER"):
    token = backend_app.serializer.dumps(
        {"user_id": "user-1", "company_id": company_id, "role": role}
    )
    return {"Authorization": f"Bearer {token}"}


class TableQrEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def get(self, url=None, headers=None):
        query = {} if url is None else {"url": url}
        return self.client.get(
            ROUTE,
            query_string=query,
            headers=auth() if headers is None else headers,
        )

    def db(self, company=True, table=True):
        return patch.object(
            backend_app,
            "query_db",
            side_effect=[
                {"slug": SLUG} if company else None,
                {"id": TABLE_ID} if table else None,
            ],
        )

    def test_requires_login(self):
        response = self.get(table_link(), headers={})
        self.assertEqual(response.status_code, 401)

    def test_other_company_is_forbidden(self):
        response = self.get(
            table_link(), headers=auth(company_id=OTHER_COMPANY_ID)
        )
        self.assertEqual(response.status_code, 403)

    def test_returns_png_data_url_for_own_table(self):
        with self.db():
            response = self.get(table_link())

        self.assertEqual(response.status_code, 200)
        data_url = response.get_json()["data_url"]
        prefix = "data:image/png;base64,"
        self.assertTrue(data_url.startswith(prefix))
        png = base64.b64decode(data_url[len(prefix):])
        self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_missing_url_is_rejected(self):
        response = self.get(None)
        self.assertEqual(response.status_code, 400)

    def test_link_for_another_company_is_rejected(self):
        with self.db():
            response = self.get(table_link(slug="outra-empresa"))
        self.assertEqual(response.status_code, 400)

    def test_link_for_another_table_is_rejected(self):
        with self.db():
            response = self.get(table_link(table_id=OTHER_TABLE_ID))
        self.assertEqual(response.status_code, 400)

    def test_non_http_link_is_rejected(self):
        with self.db():
            response = self.get(table_link(scheme="ftp"))
        self.assertEqual(response.status_code, 400)

    def test_unknown_table_returns_404(self):
        with self.db(table=False):
            response = self.get(table_link())
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
