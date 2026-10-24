"""As rotas da página pública (public_page_routes.py): fechadas de fábrica, o que cada uma responde e o que o dono pode mudar.

Roda no CI (precisa do Flask). Usa um app de teste só com estas rotas e um banco de mentira que responde pelo texto do SQL;
a trava por cargo e o token são os de verdade (app.require_roles).
"""

import io
import os
import unittest
from contextlib import contextmanager
from decimal import Decimal
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

from flask import Flask  # noqa: E402
from PIL import Image  # noqa: E402

import app as backend_app  # noqa: E402
import public_page  # noqa: E402
import public_page_routes as routes  # noqa: E402
from table_qr import qr_png_for_url  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_ID = "22222222-2222-4222-8222-222222222222"
SLUG = "pastelaria-do-ze"
PHOTO_KEY = "a" * 32

COMPANY_ROW = {"id": COMPANY_ID, "name": "Pastelaria do Zé", "slug": SLUG, "logo_key": None, "orders_paused": False, "public_page_listed": True}
MENUS = [{"id": "m1", "company_id": COMPANY_ID, "name": "Pastéis", "active": True}]
PRODUCTS = [
    {"id": "p1", "company_id": COMPANY_ID, "menu_id": "m1", "name": "Pastel de carne", "description": "Carne e ovo.", "subcategory": None,
     "price": Decimal("9.00"), "image_key": PHOTO_KEY, "sold_out": False},
    {"id": "p2", "company_id": COMPANY_ID, "menu_id": "m1", "name": "Pastel de queijo", "description": "", "subcategory": None,
     "price": Decimal("8.50"), "image_key": None, "sold_out": False},
]


@contextmanager
def env(**values):
    with patch.dict(os.environ, {}, clear=False):
        for name, value in values.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        yield


class FakeCursor:
    def __init__(self, db):
        self.db = db
        self.row = None

    def execute(self, sql, params=()):
        self.db.executed.append((sql, params))
        if sql is routes.SQL_OWNER_SET:
            if str(params[1]) == COMPANY_ID:
                self.db.listed = params[0]
                self.row = {"slug": SLUG, "public_page_listed": params[0]}
            else:
                self.row = None

    def fetchone(self):
        return self.row

    def close(self):
        pass


class FakeConn:
    closed = False

    def __init__(self, db):
        self.db = db

    def cursor(self, cursor_factory=None):
        return FakeCursor(self.db)

    def commit(self):
        self.db.commits += 1

    def rollback(self):
        self.db.rollbacks += 1

    def close(self):
        self.closed = True


class FakeDb:
    def __init__(self):
        self.executed = []
        self.listed = True
        self.commits = 0
        self.rollbacks = 0
        self.fail = False
        self.products = [dict(p) for p in PRODUCTS]
        self.sitemap_rows = [{"id": COMPANY_ID, "slug": SLUG}, {"id": OTHER_ID, "slug": "pizza-da-nona"}]

    def query(self, sql, params=(), one=False):
        self.executed.append((sql, params))
        if self.fail:
            raise RuntimeError("banco fora do ar")
        if sql is routes.SQL_COMPANY:
            row = dict(COMPANY_ROW, public_page_listed=self.listed) if params[0] == SLUG else None
            return row if one else ([row] if row else [])
        if sql is routes.SQL_MENUS:
            return [dict(m) for m in MENUS] if params[0] == COMPANY_ID else []
        if sql is routes.SQL_PRODUCTS:
            return [dict(p) for p in self.products] if params[0] == COMPANY_ID else []
        if sql is routes.SQL_SITEMAP:
            return list(self.sitemap_rows)
        if sql is routes.SQL_OWNER_GET:
            row = {"slug": SLUG, "public_page_listed": self.listed} if str(params[0]) == COMPANY_ID else None
            return row if one else ([row] if row else [])
        raise AssertionError(f"SQL inesperado: {sql}")


def public_company(row):
    """Do jeito do app: nome, logo, pedidos, horário; a chave sorteada da logomarca não sai."""
    company = dict(row)
    company.pop("logo_key", None)
    company["logo_url"] = None
    company["logo_thumb_url"] = None
    company["accepting_orders"] = not company.pop("orders_paused", False)
    company["hours"] = {"configured": False, "open_now": True, "message": "", "paused": False}
    return company


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


class RoutesBase(unittest.TestCase):
    def setUp(self):
        self.db = FakeDb()
        self.accepts = {"value": True}
        self.app = Flask(__name__)
        routes.register(
            self.app,
            query_db=self.db.query,
            get_db_connection=lambda: FakeConn(self.db),
            public_company=public_company,
            accepts_orders=lambda company_id: self.accepts["value"],
            require_roles=backend_app.require_roles,
        )
        self.client = self.app.test_client()
        patcher = env(PUBLIC_PAGE_OPEN="1", PUBLIC_PAGE_INDEX="1", PUBLIC_BASE_URL="https://vem.example.com")
        patcher.__enter__()
        self.addCleanup(patcher.__exit__, None, None, None)


class ClosedByDefaultTests(RoutesBase):
    URLS = (f"/r/{SLUG}", f"/r/{SLUG}/previa.jpg", f"/r/{SLUG}/qr.png", "/robots.txt", "/sitemap.xml")

    def test_every_route_answers_404_and_never_touches_the_database(self):
        for open_value in (None, "", "0"):
            with env(PUBLIC_PAGE_OPEN=open_value, PUBLIC_PAGE_INDEX="1"):
                for url in self.URLS:
                    response = self.client.get(url)
                    self.assertEqual(response.status_code, 404, (open_value, url))
        self.assertEqual(self.db.executed, [])

    def test_the_404_page_has_no_index_header(self):
        with env(PUBLIC_PAGE_OPEN=None):
            response = self.client.get(f"/r/{SLUG}")
            self.assertEqual(response.status_code, 404)
            self.assertIn("noindex", response.headers["X-Robots-Tag"])
            self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_the_sitemap_needs_the_second_key_too(self):
        with env(PUBLIC_PAGE_OPEN="1", PUBLIC_PAGE_INDEX=None):
            self.assertEqual(self.client.get("/sitemap.xml").status_code, 404)
            self.assertEqual(self.client.get("/robots.txt").status_code, 200)

    def test_the_real_app_has_the_routes_and_is_closed(self):
        client = backend_app.app.test_client()
        with env(PUBLIC_PAGE_OPEN=None):
            for url in self.URLS:
                self.assertEqual(client.get(url).status_code, 404, url)


class PageTests(RoutesBase):
    def test_a_restaurant_page(self):
        response = self.client.get(f"/r/{SLUG}")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content_type.startswith("text/html"))
        body = response.get_data(as_text=True)
        self.assertIn("Pastel de carne", body)
        self.assertIn("R$ 9,00", body)
        self.assertIn("https://vem.example.com/?empresa=pastelaria-do-ze", body)
        self.assertEqual(response.headers["Content-Security-Policy"], public_page.CSP)
        self.assertEqual(response.headers["Cache-Control"], "public, max-age=60")
        self.assertNotIn("X-Robots-Tag", response.headers)  # restaurante que o dono liberou, com as duas chaves

    def test_a_trailing_slash_works_too(self):
        self.assertEqual(self.client.get(f"/r/{SLUG}/").status_code, 200)

    def test_only_the_restaurants_own_data_is_asked_for(self):
        self.client.get(f"/r/{SLUG}")
        for sql, params in self.db.executed:
            self.assertIn(params[0], (SLUG, COMPANY_ID))
        self.assertTrue(all("INSERT" not in sql and "UPDATE" not in sql and "DELETE" not in sql for sql, _ in self.db.executed))

    def test_the_origin_reaches_the_button_and_a_bad_one_does_not(self):
        body = self.client.get(f"/r/{SLUG}?de=whatsapp").get_data(as_text=True)
        self.assertIn("empresa=pastelaria-do-ze&amp;de=whatsapp", body)
        body = self.client.get(f"/r/{SLUG}?de=%3Cscript%3E").get_data(as_text=True)
        self.assertIn('href="https://vem.example.com/?empresa=pastelaria-do-ze"', body)  # marca desconhecida: descartada
        self.assertNotIn("%3Cscript", body)
        self.assertNotIn("<script>", body.replace('<script type="application/ld+json">', ""))

    def test_unknown_or_malformed_names_get_the_same_404(self):
        bodies = set()
        for slug in ("nao-existe", "Maiuscula", "a%20b", "a.b", "x" * 200):
            response = self.client.get(f"/r/{slug}")
            self.assertEqual(response.status_code, 404, slug)
            bodies.add(response.get_data(as_text=True))
        self.assertEqual(len(bodies), 1)
        # nome malformado nem chega ao banco
        asked = [params[0] for _, params in self.db.executed]
        self.assertEqual(asked, ["nao-existe"])

    def test_without_the_owners_yes_the_page_asks_google_not_to_keep_it(self):
        self.db.listed = False
        response = self.client.get(f"/r/{SLUG}")
        self.assertEqual(response.status_code, 200)
        self.assertIn("noindex", response.headers["X-Robots-Tag"])
        self.assertIn('content="noindex,nofollow"', response.get_data(as_text=True))

    def test_open_without_the_google_key_is_noindex_for_everyone(self):
        with env(PUBLIC_PAGE_INDEX=None):
            response = self.client.get(f"/r/{SLUG}")
            self.assertIn("noindex", response.headers["X-Robots-Tag"])

    def test_a_blocked_plan_still_renders_without_saying_why(self):
        self.db.listed = True

        def blocked(row):
            data = public_company(row)
            data["accepting_orders"] = False
            return data

        app2 = Flask(__name__)
        routes.register(app2, query_db=self.db.query, get_db_connection=lambda: FakeConn(self.db), public_company=blocked,
                        accepts_orders=lambda i: False, require_roles=backend_app.require_roles)
        body = app2.test_client().get(f"/r/{SLUG}").get_data(as_text=True)
        self.assertIn("Pedidos indisponíveis no momento.", body)
        for word in ("assinatura", "plano", "pagamento"):
            self.assertNotIn(word, body.lower())
        self.assertIn('content="noindex,nofollow"', body)

    def test_a_database_failure_is_a_short_503_with_no_details(self):
        self.db.fail = True
        response = self.client.get(f"/r/{SLUG}")
        self.assertEqual(response.status_code, 503)
        text = response.get_data(as_text=True)
        self.assertNotIn("banco fora do ar", text)
        self.assertNotIn("Traceback", text)
        self.assertEqual(response.headers["Retry-After"], "30")

    def test_the_rate_limit_answers_429(self):
        with env(PUBLIC_PAGE_PER_MINUTE="3"):
            app2 = Flask(__name__)
            routes.register(app2, query_db=self.db.query, get_db_connection=lambda: FakeConn(self.db), public_company=public_company,
                            accepts_orders=lambda i: True, require_roles=backend_app.require_roles)
            client = app2.test_client()
            codes = [client.get(f"/r/{SLUG}").status_code for _ in range(5)]
        self.assertEqual(codes, [200, 200, 200, 429, 429])

    def test_head_requests_work_for_link_checkers(self):
        self.assertEqual(self.client.head(f"/r/{SLUG}").status_code, 200)

    def test_only_get_is_allowed(self):
        for method in ("post", "put", "delete", "patch"):
            self.assertEqual(getattr(self.client, method)(f"/r/{SLUG}").status_code, 405, method)


class PreviewAndQrTests(RoutesBase):
    def test_the_preview_is_a_jpeg_card_and_cached(self):
        response = self.client.get(f"/r/{SLUG}/previa.jpg")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type, "image/jpeg")
        image = Image.open(io.BytesIO(response.data))
        self.assertEqual(image.size, (1200, 630))
        self.assertEqual(response.headers["Cache-Control"], "public, max-age=3600")
        with patch.object(routes.page_preview, "render", side_effect=AssertionError("deveria sair do cache")):
            again = self.client.get(f"/r/{SLUG}/previa.jpg")
        self.assertEqual(again.data, response.data)

    def test_the_preview_uses_the_first_dish_photo_from_disk(self):
        calls = []

        def fake_read(company_id, key, max_bytes=0):
            calls.append((company_id, key))
            return None

        with patch.object(routes.media_store, "read_full", fake_read):
            self.client.get(f"/r/{SLUG}/previa.jpg")
        self.assertEqual(calls, [(COMPANY_ID, PHOTO_KEY)])

    def test_unknown_restaurant_has_no_preview_and_no_qr(self):
        self.assertEqual(self.client.get("/r/nao-existe/previa.jpg").status_code, 404)
        self.assertEqual(self.client.get("/r/nao-existe/qr.png").status_code, 404)

    def test_the_qr_points_at_the_page_with_the_origin_mark(self):
        response = self.client.get(f"/r/{SLUG}/qr.png")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type, "image/png")
        self.assertTrue(response.data.startswith(b"\x89PNG"))
        self.assertEqual(response.data, qr_png_for_url(f"https://vem.example.com/r/{SLUG}?de=qr"))
        self.assertIn(f"qr-{SLUG}.png", response.headers["Content-Disposition"])

    def test_the_qr_origin_can_change_only_to_a_known_one(self):
        known = self.client.get(f"/r/{SLUG}/qr.png?de=instagram")
        self.assertEqual(known.data, qr_png_for_url(f"https://vem.example.com/r/{SLUG}?de=instagram"))
        weird = self.client.get(f"/r/{SLUG}/qr.png?de=https://evil.example/")
        self.assertEqual(weird.data, qr_png_for_url(f"https://vem.example.com/r/{SLUG}?de=qr"))

    def test_images_have_their_own_tighter_limit(self):
        with env(PUBLIC_IMAGE_PER_MINUTE="2"):
            app2 = Flask(__name__)
            routes.register(app2, query_db=self.db.query, get_db_connection=lambda: FakeConn(self.db), public_company=public_company,
                            accepts_orders=lambda i: True, require_roles=backend_app.require_roles)
            codes = [app2.test_client().get(f"/r/{SLUG}/qr.png").status_code for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])


class GoogleFilesTests(RoutesBase):
    def test_robots_without_and_with_the_google_key(self):
        with env(PUBLIC_PAGE_INDEX=None):
            body = self.client.get("/robots.txt").get_data(as_text=True)
            self.assertIn("Disallow: /r/", body)
        body = self.client.get("/robots.txt").get_data(as_text=True)
        self.assertIn("Allow: /r/", body)
        self.assertIn("Sitemap: https://vem.example.com/sitemap.xml", body)

    def test_sitemap_lists_the_restaurants_the_database_gives(self):
        response = self.client.get("/sitemap.xml")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content_type.startswith("application/xml"))
        body = response.get_data(as_text=True)
        self.assertIn("https://vem.example.com/r/pastelaria-do-ze", body)
        self.assertIn("https://vem.example.com/r/pizza-da-nona", body)

    def test_sitemap_skips_restaurants_that_do_not_take_orders(self):
        self.accepts["value"] = False
        self.assertEqual(self.client.get("/sitemap.xml").get_data(as_text=True).count("<loc>"), 0)

    def test_sitemap_is_cached_for_a_few_minutes(self):
        self.client.get("/sitemap.xml")
        before = len([1 for sql, _ in self.db.executed if sql is routes.SQL_SITEMAP])
        self.client.get("/sitemap.xml")
        after = len([1 for sql, _ in self.db.executed if sql is routes.SQL_SITEMAP])
        self.assertEqual(before, after)

    def test_only_the_owners_choice_puts_a_restaurant_in_the_sitemap_query(self):
        self.assertIn("public_page_listed", routes.SQL_SITEMAP)


class OwnerChoiceTests(RoutesBase):
    URL = "/api/admin/public-page"

    def test_needs_a_login_and_the_owner_role(self):
        self.assertEqual(self.client.get(self.URL).status_code, 401)
        self.assertEqual(self.client.put(self.URL, json={"listed": True}).status_code, 401)
        for role in ("MANAGER", "WAITER", "KITCHEN", "COURIER"):
            self.assertEqual(self.client.get(self.URL, headers=auth(role)).status_code, 403, role)
            self.assertEqual(self.client.put(self.URL, json={"listed": True}, headers=auth(role)).status_code, 403, role)

    def test_the_owner_sees_the_link_and_the_choice(self):
        self.db.listed = False
        response = self.client.get(self.URL, headers=auth())
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["listed"], False)
        self.assertEqual(data["open"], True)
        self.assertEqual(data["indexed"], True)
        self.assertEqual(data["page_url"], f"https://vem.example.com/r/{SLUG}")
        self.assertEqual(data["qr_path"], f"/r/{SLUG}/qr.png")
        self.assertNotIn("owner_phone", data)

    def test_the_owner_says_yes_and_no(self):
        for value in (True, False):
            response = self.client.put(self.URL, json={"listed": value}, headers=auth())
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["listed"], value)
            self.assertEqual(self.db.listed, value)
        self.assertEqual(self.db.commits, 2)

    def test_the_change_always_targets_the_logged_in_restaurant(self):
        self.client.put(self.URL, json={"listed": True}, headers=auth(company_id=OTHER_ID))
        # o restaurante do token não é o da base de mentira: nada muda e a resposta é 404
        response = self.client.put(self.URL, json={"listed": True}, headers=auth(company_id=OTHER_ID))
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.db.commits, 0)
        self.assertGreaterEqual(self.db.rollbacks, 1)

    def test_anything_but_a_real_true_or_false_is_refused(self):
        for bad in ({}, {"listed": "true"}, {"listed": 1}, {"listed": None}, {"listed": "sim"}, [], "x", None):
            response = self.client.put(self.URL, json=bad, headers=auth())
            self.assertEqual(response.status_code, 400, repr(bad))
        self.assertEqual(self.db.commits, 0)

    def test_the_server_sql_is_parameterized(self):
        for sql in (routes.SQL_OWNER_SET, routes.SQL_OWNER_GET, routes.SQL_COMPANY, routes.SQL_MENUS, routes.SQL_PRODUCTS, routes.SQL_SITEMAP):
            self.assertNotIn("{", sql)
            self.assertNotIn("%s'", sql)


if __name__ == "__main__":
    unittest.main()
