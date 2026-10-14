"""Rota de cardápio por arquivo (planilha sem IA, PDF com IA simulada)."""

import io
import json
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-not-for-production")

import app as backend_app  # noqa: E402
import menu_photo  # noqa: E402
from test_menu_file import make_xlsx  # noqa: E402

COMPANY_ID = "11111111-1111-4111-8111-111111111111"
FAKE_KEY = "sk-ant-api03-THIS-IS-A-TEST-KEY-1234567890"
URL = "/api/admin/menu/parse-file"
CAPS_URL = "/api/admin/menu/capabilities"

CSV = "Categoria;Prato;Preço\nLanches;X-Burguer;18,50\nBebidas;Coca-Cola;6,00\n".encode("utf-8")
PDF = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def auth(role="OWNER", company_id=COMPANY_ID):
    token = backend_app.serializer.dumps({"user_id": "user-1", "company_id": company_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


def tool_response(payload):
    return {"content": [{"type": "tool_use", "id": "t1", "name": menu_photo.TOOL_NAME, "input": payload}]}


PDF_READING = {
    "readable": True,
    "categories": [{"name": "Pizzas", "items": [{"name": "Calabresa (G)", "price": "52,00"}]}],
    "notes": "",
}


class ParseFileRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = backend_app.app.test_client()
        env = patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)
        limiter = patch.object(menu_photo, "limiter", menu_photo.RateLimiter())
        limiter.start()
        self.addCleanup(limiter.stop)
        self.calls = []

        def fake_post(body, key):
            self.calls.append((body, key))
            return tool_response(PDF_READING)

        post = patch.object(menu_photo, "_post", side_effect=fake_post)
        post.start()
        self.addCleanup(post.stop)

    def send(self, data, name="cardapio.csv", field="file", headers=None):
        payload = {field: (io.BytesIO(data), name)} if data is not None else {}
        return self.client.post(URL, data=payload, headers=auth() if headers is None else headers,
                                content_type="multipart/form-data")

    def test_planilha_csv_funciona_sem_chave_de_ia_e_nunca_chama_a_ia(self):
        reply = self.send(CSV)
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        body = reply.get_json()
        self.assertEqual(set(body), {"readable", "categories", "notes"})
        self.assertEqual(body["categories"][0], {"name": "Lanches", "items": [{"name": "X-Burguer", "price": "18.50", "description": "", "subcategory": ""}]})
        self.assertEqual(self.calls, [])

    def test_planilha_xlsx(self):
        data = make_xlsx([["Prato", "Preço"], ["Pastel", 8], ["Caldo de cana", 7.5]])
        reply = self.send(data, "cardapio.xlsx")
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        items = reply.get_json()["categories"][0]["items"]
        self.assertEqual(
            items,
            [
                {"name": "Pastel", "price": "8.00", "description": "", "subcategory": ""},
                {"name": "Caldo de cana", "price": "7.50", "description": "", "subcategory": ""},
            ],
        )

    def test_o_tipo_vem_do_conteudo_e_nao_do_nome_do_arquivo(self):
        reply = self.send(CSV, "foto.jpg")
        self.assertEqual(reply.status_code, 200)

    def test_pdf_sem_chave_de_ia_e_501_com_conselho(self):
        reply = self.send(PDF, "cardapio.pdf")
        self.assertEqual(reply.status_code, 501)
        self.assertIn("planilha", reply.get_json()["error"])
        self.assertEqual(self.calls, [])

    def test_pdf_com_ia_manda_o_documento_e_limpa_a_resposta(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": FAKE_KEY}):
            reply = self.send(PDF, "cardapio.pdf")
        self.assertEqual(reply.status_code, 200, reply.get_data(as_text=True))
        self.assertEqual(reply.get_json()["categories"][0]["items"][0], {"name": "Calabresa (G)", "price": "52.00", "description": "", "subcategory": ""})
        body, key = self.calls[0]
        self.assertEqual(key, FAKE_KEY)
        documents = [b for b in body["messages"][0]["content"] if b["type"] == "document"]
        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0]["source"]["media_type"], "application/pdf")
        self.assertNotIn(FAKE_KEY, reply.get_data(as_text=True))

    def test_pdf_com_falha_do_servico_nao_gasta_a_cota(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": FAKE_KEY}):
            with patch.object(menu_photo, "_post", side_effect=menu_photo.MenuPhotoError("ocupado", 503)):
                for _ in range(menu_photo.PER_COMPANY_PER_HOUR + 2):
                    self.assertEqual(self.send(PDF, "c.pdf").status_code, 503)

    def test_pdf_respeita_o_limite_por_hora_do_restaurante(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": FAKE_KEY}):
            codes = [self.send(PDF, "c.pdf").status_code for _ in range(menu_photo.PER_COMPANY_PER_HOUR + 1)]
        self.assertEqual(codes[:-1], [200] * menu_photo.PER_COMPANY_PER_HOUR)
        self.assertEqual(codes[-1], 429)

    def test_planilha_nao_gasta_a_cota_da_ia(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": FAKE_KEY}):
            for _ in range(menu_photo.PER_COMPANY_PER_HOUR + 3):
                self.assertEqual(self.send(CSV).status_code, 200)

    def test_sem_arquivo_campo_errado_e_vazio(self):
        self.assertEqual(self.send(None).status_code, 400)
        self.assertEqual(self.send(CSV, field="photos").status_code, 400)
        self.assertEqual(self.send(b"").status_code, 400)

    def test_formatos_que_nao_lemos_dizem_o_que_fazer(self):
        reply = self.send(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"0" * 100, "antigo.xls")
        self.assertEqual(reply.status_code, 400)
        self.assertIn(".xlsx", reply.get_json()["error"])
        reply = self.send(b"\x89PNG\r\n\x1a\n" + b"0" * 100, "foto.png")
        self.assertEqual(reply.status_code, 400)
        self.assertIn("foto", reply.get_json()["error"])

    def test_planilha_grande_demais_e_413_mas_a_porta_aceita_ate_10_mib(self):
        reply = self.send(b"a;b\n" * 800_000)  # ~3 MiB: passa da porta (1 MiB) e cai no limite da planilha (2 MiB)
        self.assertEqual(reply.status_code, 413)
        self.assertIn("2 MB", reply.get_json()["error"])

    def test_corpo_gigante_e_recusado_antes_da_rota(self):
        reply = self.send(b"x" * (backend_app.PHOTO_MAX_BYTES + 200_000))
        self.assertEqual(reply.status_code, 413)

    def test_login_e_papel(self):
        self.assertEqual(self.client.post(URL).status_code, 401)
        for role in ("WAITER", "CASHIER", "KITCHEN", "COURIER"):
            self.assertEqual(self.send(CSV, headers=auth(role)).status_code, 403, role)
        for role in ("OWNER", "MANAGER"):
            self.assertEqual(self.send(CSV, headers=auth(role)).status_code, 200, role)

    def test_outras_rotas_continuam_com_corpo_pequeno(self):
        reply = self.client.post("/api/admin/menu/import", data=b"x" * 1_200_000, headers=auth(),
                                 content_type="application/json")
        self.assertIn(reply.status_code, (404, 413))

    def test_planilha_ilegivel_volta_como_leitura_e_nao_como_erro(self):
        reply = self.send("Prato;Preço\n".encode("utf-8"))
        self.assertEqual(reply.status_code, 200)
        self.assertFalse(reply.get_json()["readable"])

    def test_erro_inesperado_e_500_limpo(self):
        with patch("menu_file.read_menu_sheet", side_effect=RuntimeError("segredo interno")):
            reply = self.send(CSV)
        self.assertEqual(reply.status_code, 500)
        self.assertNotIn("segredo interno", reply.get_data(as_text=True))

    def test_capacidades(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}):
            body = self.client.get(CAPS_URL, headers=auth()).get_json()
        self.assertIs(body["file_menu"], True)
        self.assertIs(body["pdf_menu"], False)
        self.assertIs(body["photo_menu"], False)
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": FAKE_KEY}):
            body = self.client.get(CAPS_URL, headers=auth()).get_json()
        self.assertIs(body["pdf_menu"], True)
        self.assertIs(body["photo_menu"], True)
        self.assertNotIn(FAKE_KEY, json.dumps(body))


if __name__ == "__main__":
    unittest.main()
