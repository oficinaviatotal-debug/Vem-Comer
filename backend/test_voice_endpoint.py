"""Rota da voz natural do guia (POST /api/admin/voz) e o aviso na lista do que o servidor sabe fazer.

Roda no CI (precisa do Flask). O provedor de voz é simulado; nada sai para a internet.
"""

import base64
import json
import os
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import media_store  # noqa: E402
import voice_tts  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
VOICE_URL = "/api/admin/voz"
CAPS_URL = "/api/admin/menu/capabilities"
GOOGLE_KEY = "chave-google-de-teste-123"
MP3 = b"ID3" + b"\x00" * 64


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


def google_answer():
    return json.dumps({"audioContent": base64.b64encode(MP3).decode("ascii")}).encode("utf-8"), "application/json"


class VoiceEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        for patcher in (
            patch.object(media_store, "UPLOAD_DIR", self.tmp.name),
            patch.object(voice_tts, "limiter", voice_tts.Limiter()),
            patch.dict(os.environ, {"VOZ_PROVEDOR": "google", "VOZ_GOOGLE_CHAVE": GOOGLE_KEY}),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        post = patch.object(voice_tts, "_post", return_value=google_answer())
        self.post = post.start()
        self.addCleanup(post.stop)

    def say(self, text, headers=None):
        return self.client.post(VOICE_URL, json={"text": text}, headers=auth() if headers is None else headers)

    def test_gives_the_address_and_keeps_the_audio(self):
        reply = self.say("Anotei X-Tudo, 25 reais.")
        self.assertEqual(reply.status_code, 200)
        url = reply.get_json()["url"]
        self.assertRegex(url, r"^/media/voz/[0-9a-f]{40}\.mp3$")
        self.assertEqual(self.say("Anotei X-Tudo, 25 reais.").get_json()["url"], url)
        self.assertEqual(self.post.call_count, 1)
        self.assertTrue(os.path.exists(os.path.join(self.tmp.name, "voz", url.rsplit("/", 1)[1])))

    def test_the_key_never_reaches_the_browser(self):
        body = self.say("Olá").get_data(as_text=True)
        self.assertNotIn(GOOGLE_KEY, body)
        self.assertNotIn(GOOGLE_KEY, self.client.get(CAPS_URL, headers=auth()).get_data(as_text=True))

    def test_capabilities_tell_whether_the_natural_voice_is_on(self):
        self.assertIs(self.client.get(CAPS_URL, headers=auth()).get_json()["natural_voice"], True)
        with patch.dict(os.environ, {"VOZ_PROVEDOR": ""}):
            self.assertIs(self.client.get(CAPS_URL, headers=auth()).get_json()["natural_voice"], False)
            self.assertEqual(self.say("Olá").status_code, 501)

    def test_needs_login_and_the_owner_or_manager(self):
        self.assertEqual(self.client.post(VOICE_URL, json={"text": "Olá"}).status_code, 401)
        for role in ("WAITER", "CASHIER", "KITCHEN", "COURIER"):
            self.assertEqual(self.say("Olá", headers=auth(role)).status_code, 403)
        self.assertEqual(self.say("Olá", headers=auth("MANAGER")).status_code, 200)

    def test_bad_text_and_provider_failure(self):
        self.assertEqual(self.client.post(VOICE_URL, json={}, headers=auth()).status_code, 400)
        self.assertEqual(self.say("a" * (voice_tts.MAX_TEXT + 1)).status_code, 400)
        self.post.side_effect = voice_tts.VoiceError("fora", 503)
        reply = self.say("Outra frase")
        self.assertEqual(reply.status_code, 503)
        self.assertIn("error", reply.get_json())


if __name__ == "__main__":
    unittest.main()
