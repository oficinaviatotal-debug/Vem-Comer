import io
import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

from PIL import Image, ImageDraw  # noqa: E402

import app as backend_app  # noqa: E402
import media_store  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OTHER_PRODUCT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
PHOTO_URL = f"/api/admin/products/{PRODUCT_ID}/photo"


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps(
        {"user_id": "user-1", "company_id": company_id, "role": role}
    )
    return {"Authorization": f"Bearer {token}"}


def jpeg(width=1200, height=900):
    im = Image.new("RGB", (width, height), (190, 150, 100))
    draw = ImageDraw.Draw(im)
    draw.ellipse((width // 4, height // 4, width * 3 // 4, height * 3 // 4), fill=(200, 60, 40))
    draw.rectangle((0, 0, 40, 40), fill=(0, 0, 0))
    draw.rectangle((50, 0, 90, 40), fill=(255, 255, 255))
    out = io.BytesIO()
    im.save(out, "JPEG", quality=88)
    return out.getvalue()


class FakeProducts:
    """Just enough of the products table to watch image_key change."""

    def __init__(self, products=None):
        # product id -> [company id, image_key]
        self.products = products if products is not None else {
            PRODUCT_ID: [COMPANY_ID, None],
            OTHER_PRODUCT_ID: [OTHER_COMPANY_ID, None],
        }
        self.committed = 0
        self.rolled_back = 0
        self.closed = False
        self.fail_on_update = False
        self._row = None

    def cursor(self, **kwargs):
        return self

    def execute(self, sql, params=None):
        sql = " ".join(sql.split())
        if sql.startswith("SELECT image_key FROM products"):
            product_id, company_id = params
            row = self.products.get(product_id)
            self._row = (row[1],) if row and row[0] == company_id else None
        elif sql.startswith("UPDATE products SET image_key = NULL"):
            product_id, company_id = params
            self.products[product_id][1] = None
            self._row = None
        elif sql.startswith("UPDATE products SET image_key = %s"):
            if self.fail_on_update:
                raise RuntimeError("database went away")
            key, product_id, company_id = params
            self.products[product_id][1] = key
            self._row = None
        elif sql.startswith("DELETE FROM products"):
            product_id, company_id = params
            row = self.products.get(product_id)
            if row and row[0] == company_id:
                self._row = (row[1],)
                del self.products[product_id]
            else:
                self._row = None
        else:
            raise AssertionError(f"unexpected SQL: {sql}")

    def fetchone(self):
        return self._row

    def commit(self):
        self.committed += 1

    def rollback(self):
        self.rolled_back += 1

    def close(self):
        self.closed = True

    @property
    def key(self):
        return self.products[PRODUCT_ID][1]


class PhotoEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = patch.object(media_store, "UPLOAD_DIR", self.tmp.name)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.db = FakeProducts()
        patcher = patch.object(backend_app, "get_db_connection", return_value=self.db)
        patcher.start()
        self.addCleanup(patcher.stop)

    def upload(self, data=None, headers=None, url=PHOTO_URL, field="photo"):
        body = {} if data is None else {field: (io.BytesIO(data), "foto.jpg")}
        return self.client.post(
            url, data=body, headers=auth() if headers is None else headers,
            content_type="multipart/form-data",
        )

    def stored_files(self):
        found = []
        for root, _dirs, files in os.walk(self.tmp.name):
            found.extend(os.path.join(root, name) for name in files)
        return sorted(found)

    # --- who may upload ---------------------------------------------------
    def test_needs_login(self):
        response = self.upload(jpeg(), headers={})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.stored_files(), [])

    def test_waiter_cannot_upload(self):
        response = self.upload(jpeg(), headers=auth("WAITER"))
        self.assertEqual(response.status_code, 403)

    def test_manager_can_upload(self):
        self.assertEqual(self.upload(jpeg(), headers=auth("MANAGER")).status_code, 201)

    def test_cannot_touch_another_companys_product(self):
        response = self.upload(jpeg(), url=f"/api/admin/products/{OTHER_PRODUCT_ID}/photo")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.stored_files(), [])
        self.assertIsNone(self.db.products[OTHER_PRODUCT_ID][1])

    def test_unknown_product(self):
        response = self.upload(jpeg(), url="/api/admin/products/cccccccc-cccc-4ccc-8ccc-cccccccccccc/photo")
        self.assertEqual(response.status_code, 404)

    # --- the happy path ---------------------------------------------------
    def test_upload_saves_two_files_and_the_key(self):
        response = self.upload(jpeg())
        self.assertEqual(response.status_code, 201)
        body = response.get_json()

        key = self.db.key
        self.assertTrue(media_store.is_valid_key(key))
        self.assertEqual(body["image_url"], f"/media/{COMPANY_ID}/{key}.webp")
        self.assertEqual(body["thumb_url"], f"/media/{COMPANY_ID}/{key}-thumb.webp")
        self.assertIn("Cores mais vivas", body["improvements"])
        self.assertIsInstance(body["tips"], list)

        names = [os.path.basename(path) for path in self.stored_files()]
        self.assertEqual(names, sorted([f"{key}.webp", f"{key}-thumb.webp"]))
        for path in self.stored_files():
            self.assertTrue(os.path.dirname(path).endswith(COMPANY_ID))
            with Image.open(path) as saved:
                self.assertEqual(saved.format, "WEBP")
        self.assertEqual(self.db.committed, 1)

    def test_a_new_photo_replaces_the_old_one_and_deletes_its_files(self):
        self.upload(jpeg())
        first = self.db.key
        self.upload(jpeg(1000, 700))
        second = self.db.key
        self.assertNotEqual(first, second)
        names = [os.path.basename(path) for path in self.stored_files()]
        self.assertEqual(names, sorted([f"{second}.webp", f"{second}-thumb.webp"]))

    def test_remove_photo(self):
        self.upload(jpeg())
        response = self.client.delete(PHOTO_URL, headers=auth())
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(self.db.key)
        self.assertEqual(self.stored_files(), [])

    def test_remove_photo_of_another_company_is_404(self):
        response = self.client.delete(f"/api/admin/products/{OTHER_PRODUCT_ID}/photo", headers=auth())
        self.assertEqual(response.status_code, 404)

    def test_deleting_a_dish_deletes_its_photo_files(self):
        self.upload(jpeg())
        self.assertEqual(len(self.stored_files()), 2)
        response = self.client.delete(f"/api/admin/products/{PRODUCT_ID}", headers=auth())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.stored_files(), [])
        self.assertNotIn(PRODUCT_ID, self.db.products)

    # --- refusals -----------------------------------------------------------
    def test_no_file(self):
        response = self.upload(None)
        self.assertEqual(response.status_code, 400)
        self.assertIn("foto", response.get_json()["error"])

    def test_wrong_field_name(self):
        self.assertEqual(self.upload(jpeg(), field="file").status_code, 400)

    def test_not_a_photo_is_refused_in_plain_portuguese(self):
        response = self.upload(b"<html><script>alert(1)</script></html>")
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("Traceback", response.get_json()["error"])
        self.assertEqual(self.stored_files(), [])
        self.assertIsNone(self.db.key)

    def test_too_big_is_413_json(self):
        with patch.object(backend_app, "PHOTO_MAX_BYTES", 50_000):
            response = self.upload(b"\xff\xd8\xff" + os.urandom(400_000))
        self.assertEqual(response.status_code, 413)
        self.assertIn("error", response.get_json())
        self.assertEqual(self.stored_files(), [])

    def test_busy_server_says_try_again(self):
        busy = MagicMock()
        busy.acquire.return_value = False
        with patch.object(backend_app, "_photo_slots", busy):
            response = self.upload(jpeg())
        self.assertEqual(response.status_code, 503)

    def test_slot_is_released_even_when_the_photo_is_refused(self):
        slots = MagicMock()
        slots.acquire.return_value = True
        with patch.object(backend_app, "_photo_slots", slots):
            self.upload(b"not a photo")
        slots.release.assert_called_once()

    def test_files_are_cleaned_when_the_database_fails(self):
        self.db.fail_on_update = True
        response = self.upload(jpeg())
        self.assertEqual(response.status_code, 500)
        self.assertEqual(self.stored_files(), [])
        self.assertEqual(self.db.rolled_back, 1)

    # --- the limit is raised only here ---------------------------------------
    def test_other_routes_keep_the_small_body_limit(self):
        big = {"name": "x" * (2 * 1024 * 1024), "price": 1}
        response = self.client.post(
            f"/api/companies/{COMPANY_ID}/admin/products", json=big, headers=auth()
        )
        self.assertEqual(response.status_code, 413)


class PublicProductsTests(unittest.TestCase):
    def test_products_list_gives_urls_not_keys(self):
        key = media_store.new_key()
        rows = [
            {"id": "p1", "company_id": COMPANY_ID, "menu_id": None, "name": "X-Burguer",
             "description": "", "price": 18, "image_key": key},
            {"id": "p2", "company_id": COMPANY_ID, "menu_id": None, "name": "Suco",
             "description": "", "price": 6, "image_key": None},
        ]
        def fake(sql, params=(), one=False):
            # a segunda busca da rota traz as opcoes por item (nenhuma neste teste)
            return rows if "FROM products" in sql else []

        with patch.object(backend_app, "query_db", side_effect=fake):
            response = backend_app.app.test_client().get(f"/api/companies/{COMPANY_ID}/products")
        self.assertEqual(response.status_code, 200)
        first, second = response.get_json()
        self.assertEqual(first["image_url"], f"/media/{COMPANY_ID}/{key}.webp")
        self.assertEqual(first["thumb_url"], f"/media/{COMPANY_ID}/{key}-thumb.webp")
        self.assertNotIn("image_key", first)
        self.assertIsNone(second["image_url"])
        self.assertIsNone(second["thumb_url"])


class MediaStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = patch.object(media_store, "UPLOAD_DIR", self.tmp.name)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_keys_are_random_hex(self):
        keys = {media_store.new_key() for _ in range(50)}
        self.assertEqual(len(keys), 50)
        for key in keys:
            self.assertTrue(media_store.is_valid_key(key))

    def test_refuses_keys_that_could_escape_the_folder(self):
        for bad in ("../../etc/passwd", "a" * 31, "A" * 32, "g" * 32, "", None, 5, "a" * 32 + "/x"):
            self.assertFalse(media_store.is_valid_key(bad), repr(bad))
            with self.assertRaises(ValueError):
                media_store.save_pair(COMPANY_ID, bad, b"x", b"y")
            self.assertEqual(media_store.public_urls(COMPANY_ID, bad), {"image_url": None, "thumb_url": None})

    def test_refuses_company_ids_that_are_not_ids(self):
        with self.assertRaises(ValueError):
            media_store.save_pair("../../tmp", media_store.new_key(), b"x", b"y")

    def test_delete_never_raises(self):
        media_store.delete_pair(COMPANY_ID, media_store.new_key())  # missing files
        media_store.delete_pair(COMPANY_ID, None)
        media_store.delete_pair("not-an-id", media_store.new_key())

    def test_files_are_readable_by_the_web_server(self):
        key = media_store.new_key()
        media_store.save_pair(COMPANY_ID, key, b"full", b"thumb")
        for name in (f"{key}.webp", f"{key}-thumb.webp"):
            mode = os.stat(os.path.join(self.tmp.name, COMPANY_ID, name)).st_mode & 0o777
            self.assertEqual(mode, 0o644)
        leftovers = [n for n in os.listdir(os.path.join(self.tmp.name, COMPANY_ID)) if n.endswith(".tmp")]
        self.assertEqual(leftovers, [])


if __name__ == "__main__":
    unittest.main()
