import io
import os
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

from PIL import Image, ImageDraw  # noqa: E402

import app as backend_app  # noqa: E402
import logo_image  # noqa: E402
import media_store  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222"
LOGO_URL = "/api/admin/company/logo"


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps(
        {"user_id": "user-1", "company_id": company_id, "role": role}
    )
    return {"Authorization": f"Bearer {token}"}


def png(width=512, height=512, transparent=True, color=(200, 40, 30)):
    mode = "RGBA" if transparent else "RGB"
    background = (0, 0, 0, 0) if transparent else (255, 255, 255)
    im = Image.new(mode, (width, height), background)
    draw = ImageDraw.Draw(im)
    draw.ellipse((width // 8, height // 8, width * 7 // 8, height * 7 // 8), fill=color)
    out = io.BytesIO()
    im.save(out, "PNG")
    return out.getvalue()


def jpeg(width=900, height=600):
    im = Image.new("RGB", (width, height), (30, 90, 160))
    ImageDraw.Draw(im).rectangle((10, 10, 90, 90), fill=(250, 250, 250))
    out = io.BytesIO()
    exif = Image.Exif()
    exif[0x010F] = "FakePhone"  # fabricante: tem de sumir
    im.save(out, "JPEG", quality=88, exif=exif)
    return out.getvalue()


def webp_open(data):
    im = Image.open(io.BytesIO(data))
    im.load()
    return im


class PrepareLogoTests(unittest.TestCase):
    def test_png_with_transparency_keeps_it(self):
        prepared = logo_image.prepare_logo(png())
        self.assertTrue(prepared.has_transparency)
        full = webp_open(prepared.full)
        self.assertEqual(full.format, "WEBP")
        self.assertEqual(full.mode, "RGBA")
        self.assertEqual(full.getpixel((0, 0))[3], 0)       # canto continua transparente
        self.assertEqual(full.getpixel((256, 256))[:3], (200, 40, 30))  # cor exata: sem perda

    def test_opaque_png_drops_the_alpha_channel(self):
        prepared = logo_image.prepare_logo(png(transparent=False))
        self.assertFalse(prepared.has_transparency)
        self.assertEqual(webp_open(prepared.full).mode, "RGB")

    def test_big_image_is_shrunk_keeping_the_shape(self):
        prepared = logo_image.prepare_logo(png(2000, 1000))
        self.assertEqual((prepared.width, prepared.height), (512, 256))
        thumb = webp_open(prepared.thumb)
        self.assertEqual(thumb.size, (160, 80))

    def test_small_image_is_never_stretched(self):
        prepared = logo_image.prepare_logo(png(200, 100))
        self.assertEqual((prepared.width, prepared.height), (200, 100))
        self.assertEqual(webp_open(prepared.thumb).size, (160, 80))

    def test_no_cropping_and_no_square_forcing(self):
        prepared = logo_image.prepare_logo(png(300, 900))
        self.assertEqual((prepared.width, prepared.height), (171, 512))  # 300:900 mantido, nada cortado

    def test_jpeg_is_accepted_and_hidden_data_is_dropped(self):
        original = jpeg()
        self.assertIn(b"FakePhone", original)
        prepared = logo_image.prepare_logo(original)
        self.assertNotIn(b"FakePhone", prepared.full)
        self.assertNotIn(b"FakePhone", prepared.thumb)
        self.assertEqual(webp_open(prepared.full).format, "WEBP")

    def test_not_an_image_is_refused_with_a_plain_message(self):
        with self.assertRaises(logo_image.LogoError) as caught:
            logo_image.prepare_logo(b"<?xml version='1.0'?><svg onload='alert(1)'/>")
        self.assertIn("imagem", str(caught.exception))

    def test_svg_and_gif_are_refused(self):
        for blob in (b"<svg xmlns='http://www.w3.org/2000/svg'/>", b"GIF89a" + b"\x00" * 40):
            with self.assertRaises(logo_image.LogoError):
                logo_image.prepare_logo(blob)

    def test_empty_upload(self):
        with self.assertRaises(logo_image.LogoError):
            logo_image.prepare_logo(b"")

    def test_too_small(self):
        with self.assertRaises(logo_image.LogoError) as caught:
            logo_image.prepare_logo(png(32, 32))
        self.assertIn("pequena", str(caught.exception))

    def test_damaged_file_with_a_valid_header(self):
        broken = png()[:60]
        with self.assertRaises(logo_image.LogoError):
            logo_image.prepare_logo(broken)

    def test_too_many_pixels_is_refused_before_loading(self):
        with patch.object(logo_image, "MAX_OTHER_PIXELS", 1000):
            with self.assertRaises(logo_image.LogoError) as caught:
                logo_image.prepare_logo(png(100, 100))
        self.assertIn("grande", str(caught.exception))

    def test_animated_webp_uses_first_frame_only(self):
        frames = [Image.new("RGB", (100, 100), color) for color in ((255, 0, 0), (0, 0, 255))]
        out = io.BytesIO()
        frames[0].save(out, "WEBP", save_all=True, append_images=frames[1:], duration=100, lossless=True)
        prepared = logo_image.prepare_logo(out.getvalue())
        pixel = webp_open(prepared.full).convert("RGB").getpixel((50, 50))
        self.assertGreater(pixel[0], 200)  # vermelho, o primeiro quadro


class FakeCompanies:
    """Just enough of the companies table to watch logo_key change."""

    def __init__(self):
        self.logo_keys = {COMPANY_ID: None, OTHER_COMPANY_ID: "f" * 32}
        self.committed = 0
        self.rolled_back = 0
        self.closed = False
        self.fail_on_update = False
        self._row = None

    def cursor(self, **kwargs):
        return self

    def execute(self, sql, params=None):
        sql = " ".join(sql.split())
        if sql.startswith("SELECT logo_key FROM companies"):
            (company_id,) = params
            self._row = (self.logo_keys[company_id],) if company_id in self.logo_keys else None
        elif sql.startswith("UPDATE companies SET logo_key = NULL"):
            (company_id,) = params
            self.logo_keys[company_id] = None
            self._row = None
        elif sql.startswith("UPDATE companies SET logo_key = %s"):
            if self.fail_on_update:
                raise RuntimeError("database went away")
            key, company_id = params
            self.logo_keys[company_id] = key
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


class LogoEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = patch.object(media_store, "UPLOAD_DIR", self.tmp.name)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.db = FakeCompanies()
        patcher = patch.object(backend_app, "get_db_connection", return_value=self.db)
        patcher.start()
        self.addCleanup(patcher.stop)

    def upload(self, data=None, headers=None, field="logo"):
        body = {} if data is None else {field: (io.BytesIO(data), "logo.png")}
        return self.client.post(
            LOGO_URL, data=body, headers=auth() if headers is None else headers,
            content_type="multipart/form-data",
        )

    def stored_files(self):
        found = []
        for root, _dirs, files in os.walk(self.tmp.name):
            found.extend(os.path.join(root, name) for name in files)
        return sorted(found)

    # --- who may upload ---------------------------------------------------
    def test_needs_login(self):
        response = self.upload(png(), headers={})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.stored_files(), [])

    def test_waiter_and_kitchen_cannot_upload(self):
        for role in ("WAITER", "KITCHEN", "CASHIER", "COURIER"):
            self.assertEqual(self.upload(png(), headers=auth(role)).status_code, 403, role)
        self.assertEqual(self.stored_files(), [])

    def test_manager_can_upload(self):
        self.assertEqual(self.upload(png(), headers=auth("MANAGER")).status_code, 201)

    def test_it_only_touches_the_callers_own_company(self):
        self.assertEqual(self.upload(png()).status_code, 201)
        self.assertIsNotNone(self.db.logo_keys[COMPANY_ID])
        self.assertEqual(self.db.logo_keys[OTHER_COMPANY_ID], "f" * 32)  # a outra não mudou
        for path in self.stored_files():
            self.assertIn(COMPANY_ID, path)
            self.assertNotIn(OTHER_COMPANY_ID, path)

    def test_unknown_company_in_token(self):
        response = self.upload(png(), headers=auth(company_id="33333333-3333-4333-8333-333333333333"))
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.stored_files(), [])

    # --- the happy path ---------------------------------------------------
    def test_saves_two_files_and_answers_with_public_addresses(self):
        response = self.upload(png())
        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        key = self.db.logo_keys[COMPANY_ID]
        self.assertTrue(media_store.is_valid_key(key))
        self.assertEqual(body["logo_url"], f"/media/{COMPANY_ID}/{key}.webp")
        self.assertEqual(body["logo_thumb_url"], f"/media/{COMPANY_ID}/{key}-thumb.webp")
        self.assertEqual(len(self.stored_files()), 2)
        self.assertEqual(self.db.committed, 1)

    def test_replacing_deletes_the_old_files(self):
        self.upload(png())
        first_key = self.db.logo_keys[COMPANY_ID]
        self.upload(png(color=(10, 120, 40)))
        second_key = self.db.logo_keys[COMPANY_ID]
        self.assertNotEqual(first_key, second_key)
        names = [os.path.basename(path) for path in self.stored_files()]
        self.assertEqual(sorted(names), sorted([f"{second_key}.webp", f"{second_key}-thumb.webp"]))

    def test_the_key_never_comes_from_the_user(self):
        response = self.client.post(
            LOGO_URL,
            data={"logo": (io.BytesIO(png()), "../../etc/passwd.png"), "key": "0" * 32},
            headers=auth(),
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 201)
        self.assertNotEqual(self.db.logo_keys[COMPANY_ID], "0" * 32)
        for path in self.stored_files():
            self.assertTrue(path.startswith(self.tmp.name))

    # --- bad input --------------------------------------------------------
    def test_no_file(self):
        response = self.upload()
        self.assertEqual(response.status_code, 400)

    def test_wrong_field_name(self):
        self.assertEqual(self.upload(png(), field="photo").status_code, 400)

    def test_not_an_image(self):
        response = self.upload(b"<svg xmlns='http://www.w3.org/2000/svg'/>")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.stored_files(), [])
        self.assertIsNone(self.db.logo_keys[COMPANY_ID])

    def test_too_big_for_a_logo(self):
        with patch.object(backend_app, "LOGO_MAX_BYTES", 1000):
            response = self.upload(png(600, 600, transparent=False, color=(1, 2, 3)) + b"\x00" * 2000)
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.stored_files(), [])

    def test_a_logo_may_be_bigger_than_the_normal_body_limit(self):
        # o limite normal de corpo e 1 MiB; a rota da logomarca aceita mais (ate LOGO_MAX_BYTES)
        im = Image.effect_noise((900, 900), 80).convert("RGB")
        out = io.BytesIO()
        im.save(out, "PNG")
        data = out.getvalue()
        self.assertGreater(len(data), 1024 * 1024)
        self.assertEqual(self.upload(data).status_code, 201)

    def test_server_busy(self):
        class Busy:
            def acquire(self, timeout=None):
                return False

            def release(self):
                raise AssertionError("must not release a slot it never got")

        with patch.object(backend_app, "_photo_slots", Busy()):
            response = self.upload(png())
        self.assertEqual(response.status_code, 503)

    # --- failures cleanly undone -------------------------------------------
    def test_database_failure_removes_the_new_files_and_keeps_the_old_logo(self):
        self.upload(png())
        old_key = self.db.logo_keys[COMPANY_ID]
        files_before = self.stored_files()
        self.db.fail_on_update = True
        response = self.upload(png(color=(0, 0, 0)))
        self.assertEqual(response.status_code, 500)
        self.assertEqual(self.db.logo_keys[COMPANY_ID], old_key)
        self.assertEqual(self.stored_files(), files_before)
        self.assertNotIn("database went away", response.get_data(as_text=True))

    # --- delete -----------------------------------------------------------
    def test_delete_removes_files_and_key(self):
        self.upload(png())
        response = self.client.delete(LOGO_URL, headers=auth())
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(self.db.logo_keys[COMPANY_ID])
        self.assertEqual(self.stored_files(), [])

    def test_delete_without_a_logo_is_fine(self):
        self.assertEqual(self.client.delete(LOGO_URL, headers=auth()).status_code, 200)

    def test_delete_needs_the_right_role(self):
        self.assertEqual(self.client.delete(LOGO_URL).status_code, 401)
        self.assertEqual(self.client.delete(LOGO_URL, headers=auth("WAITER")).status_code, 403)

    def test_delete_leaves_other_companies_alone(self):
        self.client.delete(LOGO_URL, headers=auth())
        self.assertEqual(self.db.logo_keys[OTHER_COMPANY_ID], "f" * 32)


class PublicCompanyTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def row(self, logo_key):
        return {"id": COMPANY_ID, "name": "Saiteria do João", "slug": "saiteria-do-joao", "logo_key": logo_key}

    def test_company_with_logo_shows_addresses_and_never_the_key(self):
        key = "a" * 32
        with patch.object(backend_app, "query_db", return_value=self.row(key)):
            for url in (f"/api/companies/{COMPANY_ID}", "/api/companies/by-slug/saiteria-do-joao"):
                body = self.client.get(url).get_json()
                self.assertEqual(body["logo_url"], f"/media/{COMPANY_ID}/{key}.webp")
                self.assertEqual(body["logo_thumb_url"], f"/media/{COMPANY_ID}/{key}-thumb.webp")
                self.assertNotIn("logo_key", body)
                self.assertEqual(body["name"], "Saiteria do João")

    def test_company_without_logo(self):
        with patch.object(backend_app, "query_db", return_value=self.row(None)):
            body = self.client.get("/api/companies/by-slug/saiteria-do-joao").get_json()
        self.assertIsNone(body["logo_url"])
        self.assertIsNone(body["logo_thumb_url"])
        self.assertNotIn("logo_key", body)

    def test_a_strange_key_in_the_database_never_becomes_an_address(self):
        with patch.object(backend_app, "query_db", return_value=self.row("../../etc/passwd")):
            body = self.client.get("/api/companies/by-slug/saiteria-do-joao").get_json()
        self.assertIsNone(body["logo_url"])

    def test_missing_company(self):
        with patch.object(backend_app, "query_db", return_value=None):
            self.assertEqual(self.client.get("/api/companies/by-slug/nao-existe").status_code, 404)


if __name__ == "__main__":
    unittest.main()
