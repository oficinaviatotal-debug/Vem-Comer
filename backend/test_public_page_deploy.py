"""Os arquivos de instalação da página pública: o Caddy encaminha as rotas certas, a chave vem desligada e o script existe.

Não roda o Caddy (o CI não tem Docker aqui); confere o texto: chaves balanceadas, os três blocos antes do bloco que serve o
aplicativo, nenhuma rota do aplicativo roubada, e as duas chaves vazias no docker-compose.
"""

import os
import re
import stat
import subprocess
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VPS = os.path.join(ROOT, "deploy", "vps")


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as handle:
        return handle.read()


class CaddyfileTests(unittest.TestCase):
    def setUp(self):
        self.text = read("deploy", "vps", "Caddyfile")

    def test_braces_are_balanced(self):
        code = "\n".join(line.split("#")[0] for line in self.text.splitlines())
        self.assertEqual(code.count("{"), code.count("}"))

    def test_the_three_public_page_routes_go_to_the_server(self):
        for path in ("/r/*", "/robots.txt", "/sitemap.xml"):
            block = re.search(r"handle " + re.escape(path) + r" \{\s*reverse_proxy api:5000\s*\}", self.text)
            self.assertIsNotNone(block, path)

    def test_they_come_before_the_block_that_serves_the_app(self):
        catch_all = self.text.index("\thandle {\n")
        for path in ("/r/*", "/robots.txt", "/sitemap.xml"):
            self.assertLess(self.text.index(f"handle {path} "), catch_all, path)

    def test_the_api_and_photos_still_come_first_and_unchanged(self):
        self.assertIn("handle /api/* {\n\t\treverse_proxy api:5000\n\t}", self.text)
        self.assertIn("handle_path /media/* {", self.text)
        self.assertIn("handle /api/auth/register-company* {\n\t\trespond 404\n\t}", self.text)

    def test_the_app_keeps_serving_every_other_path(self):
        tail = self.text[self.text.index("\thandle {\n"):]
        self.assertIn("try_files {path} /index.html", tail)
        self.assertIn("root * /srv/site", tail)

    def test_security_headers_are_still_set_for_the_whole_site(self):
        for header in ("Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"):
            self.assertIn(header, self.text)


class ComposeTests(unittest.TestCase):
    def setUp(self):
        self.text = read("deploy", "vps", "docker-compose.yml")

    def test_both_switches_come_empty_from_the_file(self):
        self.assertIn("PUBLIC_PAGE_OPEN: ${PUBLIC_PAGE_OPEN:-}", self.text)
        self.assertIn("PUBLIC_PAGE_INDEX: ${PUBLIC_PAGE_INDEX:-}", self.text)

    def test_the_site_address_reaches_the_server(self):
        self.assertIn("PUBLIC_BASE_URL: https://${SITE_ADDRESS}", self.text)

    def test_nothing_turns_them_on_by_default(self):
        self.assertNotRegex(self.text, r"PUBLIC_PAGE_(OPEN|INDEX): [\"']?1")
        self.assertNotRegex(self.text, r"PUBLIC_PAGE_(OPEN|INDEX): \$\{PUBLIC_PAGE_(OPEN|INDEX):-1")


class ScriptTests(unittest.TestCase):
    def test_the_switch_script_exists_runs_in_bash_and_is_executable(self):
        path = os.path.join(VPS, "abrir-pagina-publica.sh")
        self.assertTrue(os.path.isfile(path))
        self.assertTrue(os.stat(path).st_mode & stat.S_IXUSR)
        done = subprocess.run(["bash", "-n", path], capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)

    def test_the_script_only_touches_its_two_lines(self):
        text = read("deploy", "vps", "abrir-pagina-publica.sh")
        self.assertIn("PUBLIC_PAGE_OPEN|PUBLIC_PAGE_INDEX", text)
        self.assertNotIn("SIGNUP_OPEN", text)
        self.assertNotIn("rm -", text)

    def test_the_docker_image_for_the_server_carries_the_fonts(self):
        # Dockerfile.api copia a pasta backend/ inteira (inclusive backend/fonts)
        self.assertIn("COPY backend/ ./", read("deploy", "vps", "Dockerfile.api"))
        self.assertTrue(os.path.isfile(os.path.join(ROOT, "backend", "fonts", "BricolageGrotesque-Bold.woff")))


if __name__ == "__main__":
    unittest.main()
