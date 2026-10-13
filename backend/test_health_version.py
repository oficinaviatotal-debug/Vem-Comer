"""/api/health informa a versão que está no ar (o atualizador automático confere de fora que subiu a certa)."""
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402


class HealthVersionTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()

    def test_informa_a_versao_do_ambiente(self):
        with patch.dict(os.environ, {"VEM_VERSION": "abc123def456"}):
            resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["version"], "abc123def456")

    def test_sem_variavel_diz_dev(self):
        env = {k: v for k, v in os.environ.items() if k != "VEM_VERSION"}
        with patch.dict(os.environ, env, clear=True):
            resp = self.client.get("/api/health")
        self.assertEqual(resp.get_json()["version"], "dev")

    def test_continua_passando_na_conferencia_do_instalador(self):
        # o instalador procura exatamente isto no texto da resposta
        import re
        resp = self.client.get("/api/health")
        self.assertTrue(re.search(r'"status": ?"ok"', resp.get_data(as_text=True)))


if __name__ == "__main__":
    unittest.main()
