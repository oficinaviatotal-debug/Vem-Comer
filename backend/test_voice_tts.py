"""Voz natural do guia: configuração, pedido a cada provedor, cache em disco e limites de custo.

Nenhum teste fala com a internet: a chamada HTTP (voice_tts._post) é trocada por uma falsa.
"""

import base64
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import media_store  # noqa: E402
import voice_tts  # noqa: E402

MP3 = b"ID3" + b"\x00" * 64
GOOGLE_ENV = {"VOZ_PROVEDOR": "google", "VOZ_GOOGLE_CHAVE": "chave-google"}
ELEVEN_ENV = {"VOZ_PROVEDOR": "elevenlabs", "VOZ_ELEVENLABS_CHAVE": "chave-eleven", "VOZ_ELEVENLABS_VOZ": "voz do GD/1"}


def google_answer(audio=MP3):
    return json.dumps({"audioContent": base64.b64encode(audio).decode("ascii")}).encode("utf-8"), "application/json"


class ConfigTests(unittest.TestCase):
    def test_off_by_default(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(voice_tts.is_configured())
            self.assertEqual(voice_tts.voice_name(), "")

    def test_google_needs_the_key(self):
        with mock.patch.dict(os.environ, {"VOZ_PROVEDOR": "google"}, clear=True):
            self.assertFalse(voice_tts.is_configured())
        with mock.patch.dict(os.environ, GOOGLE_ENV, clear=True):
            self.assertTrue(voice_tts.is_configured())
            self.assertEqual(voice_tts.voice_name(), "pt-BR-Neural2-B")
        with mock.patch.dict(os.environ, {**GOOGLE_ENV, "VOZ_GOOGLE_VOZ": "pt-BR-Neural2-A"}, clear=True):
            self.assertEqual(voice_tts.voice_name(), "pt-BR-Neural2-A")

    def test_elevenlabs_needs_key_and_voice(self):
        with mock.patch.dict(os.environ, {"VOZ_PROVEDOR": "elevenlabs", "VOZ_ELEVENLABS_CHAVE": "k"}, clear=True):
            self.assertFalse(voice_tts.is_configured())
        with mock.patch.dict(os.environ, ELEVEN_ENV, clear=True):
            self.assertTrue(voice_tts.is_configured())

    def test_unknown_provider_is_off(self):
        with mock.patch.dict(os.environ, {"VOZ_PROVEDOR": "outro", "VOZ_GOOGLE_CHAVE": "x"}, clear=True):
            self.assertFalse(voice_tts.is_configured())


class TextTests(unittest.TestCase):
    def test_clean_text(self):
        self.assertEqual(voice_tts.clean_text("  Anotei\nX-Tudo,\t25 reais. "), "Anotei X-Tudo, 25 reais.")
        self.assertEqual(voice_tts.clean_text(None), "")
        self.assertEqual(voice_tts.clean_text(25), "")
        self.assertEqual(voice_tts.clean_text("\x00\x07"), "")

    def test_cache_key_changes_with_voice_and_provider(self):
        a = voice_tts.cache_key("Oi", "v1", "google")
        self.assertEqual(a, voice_tts.cache_key("Oi", "v1", "google"))
        self.assertNotEqual(a, voice_tts.cache_key("Oi", "v2", "google"))
        self.assertNotEqual(a, voice_tts.cache_key("Oi", "v1", "elevenlabs"))
        self.assertRegex(a, r"^[0-9a-f]{40}$")

    def test_path_refuses_anything_but_a_key(self):
        with self.assertRaises(ValueError):
            voice_tts._path_for("../../etc/passwd")


class ProviderTests(unittest.TestCase):
    def test_google_request_carries_the_key_in_a_header_not_the_url(self):
        with mock.patch.dict(os.environ, GOOGLE_ENV, clear=True):
            url, headers, body = voice_tts.build_google_request("Olá", "pt-BR-Neural2-B")
        self.assertNotIn("chave-google", url)
        self.assertEqual(headers["x-goog-api-key"], "chave-google")
        self.assertEqual(body["input"], {"text": "Olá"})
        self.assertEqual(body["voice"], {"languageCode": "pt-BR", "name": "pt-BR-Neural2-B"})
        self.assertEqual(body["audioConfig"]["audioEncoding"], "MP3")

    def test_elevenlabs_request(self):
        with mock.patch.dict(os.environ, ELEVEN_ENV, clear=True):
            url, headers, body = voice_tts.build_elevenlabs_request("Olá")
        self.assertTrue(url.endswith("/voz%20do%20GD%2F1?output_format=mp3_22050_32"))
        self.assertEqual(headers["xi-api-key"], "chave-eleven")
        self.assertEqual(body["model_id"], "eleven_flash_v2_5")
        self.assertEqual(body["text"], "Olá")

    def test_google_answer_is_decoded(self):
        with mock.patch.dict(os.environ, GOOGLE_ENV, clear=True), mock.patch.object(
            voice_tts, "_post", return_value=google_answer()
        ):
            self.assertEqual(voice_tts.synthesize("Olá"), MP3)

    def test_elevenlabs_answer_is_the_audio(self):
        with mock.patch.dict(os.environ, ELEVEN_ENV, clear=True), mock.patch.object(
            voice_tts, "_post", return_value=(MP3, "audio/mpeg")
        ):
            self.assertEqual(voice_tts.synthesize("Olá"), MP3)

    def test_an_answer_that_is_not_mp3_is_refused(self):
        with mock.patch.dict(os.environ, ELEVEN_ENV, clear=True), mock.patch.object(
            voice_tts, "_post", return_value=(b'{"detail": "erro"}', "application/json")
        ):
            with self.assertRaises(voice_tts.VoiceError) as caught:
                voice_tts.synthesize("Olá")
        self.assertEqual(caught.exception.status, 502)
        with mock.patch.dict(os.environ, GOOGLE_ENV, clear=True), mock.patch.object(
            voice_tts, "_post", return_value=(b"nao e json", "text/plain")
        ):
            with self.assertRaises(voice_tts.VoiceError):
                voice_tts.synthesize("Olá")


class SpeechUrlTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = mock.patch.object(media_store, "UPLOAD_DIR", self.tmp.name)
        patcher.start()
        self.addCleanup(patcher.stop)
        voice_tts.limiter = voice_tts.Limiter()

    def test_not_configured(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(voice_tts.VoiceError) as caught:
                voice_tts.speech_url("Olá", "c1")
        self.assertEqual(caught.exception.status, 501)

    def test_empty_and_too_long(self):
        with mock.patch.dict(os.environ, GOOGLE_ENV, clear=True):
            for text in ("", "   ", None):
                with self.assertRaises(voice_tts.VoiceError) as caught:
                    voice_tts.speech_url(text, "c1")
                self.assertEqual(caught.exception.status, 400)
            with self.assertRaises(voice_tts.VoiceError):
                voice_tts.speech_url("a" * (voice_tts.MAX_TEXT + 1), "c1")

    def test_first_time_generates_and_saves_then_comes_from_disk(self):
        with mock.patch.dict(os.environ, GOOGLE_ENV, clear=True), mock.patch.object(
            voice_tts, "_post", return_value=google_answer()
        ) as post:
            first = voice_tts.speech_url("Anotei X-Tudo, 25 reais.", "c1")
            second = voice_tts.speech_url("  Anotei X-Tudo,  25 reais. ", "c2")
        self.assertEqual(first, second)
        self.assertEqual(post.call_count, 1)
        self.assertRegex(first, r"^/media/voz/[0-9a-f]{40}\.mp3$")
        saved = os.path.join(self.tmp.name, "voz", first.rsplit("/", 1)[1])
        with open(saved, "rb") as fh:
            self.assertEqual(fh.read(), MP3)

    def test_hourly_limit_per_restaurant_and_cached_phrases_do_not_count(self):
        with mock.patch.dict(os.environ, GOOGLE_ENV, clear=True), mock.patch.object(
            voice_tts, "_post", return_value=google_answer()
        ), mock.patch.object(voice_tts, "PER_COMPANY_PER_HOUR", 2):
            voice_tts.speech_url("frase um", "c1")
            voice_tts.speech_url("frase dois", "c1")
            voice_tts.speech_url("frase um", "c1")  # já guardada: não conta
            with self.assertRaises(voice_tts.VoiceError) as caught:
                voice_tts.speech_url("frase tres", "c1")
            self.assertEqual(caught.exception.status, 429)
            voice_tts.speech_url("frase tres", "c2")  # outro restaurante tem a cota dele

    def test_daily_character_ceiling(self):
        with mock.patch.dict(os.environ, GOOGLE_ENV, clear=True), mock.patch.object(
            voice_tts, "_post", return_value=google_answer()
        ), mock.patch.object(voice_tts, "CHARS_PER_DAY", 20):
            voice_tts.speech_url("a" * 15, "c1")
            with self.assertRaises(voice_tts.VoiceError) as caught:
                voice_tts.speech_url("b" * 10, "c2")
        self.assertEqual(caught.exception.status, 429)

    def test_provider_failure_does_not_spend_the_quota(self):
        failing = mock.patch.object(voice_tts, "_post", side_effect=voice_tts.VoiceError("fora", 503))
        with mock.patch.dict(os.environ, GOOGLE_ENV, clear=True), mock.patch.object(
            voice_tts, "PER_COMPANY_PER_HOUR", 1
        ):
            with failing:
                with self.assertRaises(voice_tts.VoiceError):
                    voice_tts.speech_url("frase", "c1")
            with mock.patch.object(voice_tts, "_post", return_value=google_answer()):
                self.assertTrue(voice_tts.speech_url("frase", "c1").startswith("/media/voz/"))
        self.assertEqual(os.listdir(os.path.join(self.tmp.name, "voz")).__len__(), 1)


if __name__ == "__main__":
    unittest.main()
