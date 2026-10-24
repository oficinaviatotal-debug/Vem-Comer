"""Teste do abrir-pagina-publica.sh com um "docker" de mentira.

Roda só como root e com bash instalado (o script confere que é root). O "servidor" de mentira responde como o de
verdade: página fechada sem PUBLIC_PAGE_OPEN=1 no .env; com ela, aberta; com PUBLIC_PAGE_INDEX=1 também, "google".
    sudo python3 deploy/vps/test_abrir_pagina_publica.py
"""

import os
import pty
import select
import shutil
import stat
import subprocess
import tempfile
import time
import unittest

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "abrir-pagina-publica.sh")
BASE_ENV = "SITE_ADDRESS=teste.example.com\nPOSTGRES_PASSWORD=aaa\nSECRET_KEY=bbb\nAPP_DB_PASSWORD=ccc\nSIGNUP_OPEN=1\n"

DOCKER_SHIM = r"""#!/usr/bin/env bash
echo "docker $*" >>"$SHIM_LOG"
case "$1" in
  compose) exit 0 ;;
  inspect) echo "${SHIM_HEALTH:-healthy}" ;;
  exec)
    if grep -q '^PUBLIC_PAGE_INDEX=1$' "$VEM_BASE/.env" && grep -q '^PUBLIC_PAGE_OPEN=1$' "$VEM_BASE/.env"; then echo google
    elif grep -q '^PUBLIC_PAGE_OPEN=1$' "$VEM_BASE/.env"; then echo aberta
    else echo fechada; fi ;;
  *) exit 0 ;;
esac
"""


def run_script(args, answers, env, tty=True, timeout=60):
    """Com tty, cada resposta é digitada quando o programa pede (como uma pessoa)."""
    if not tty:
        done = subprocess.run(["bash", SCRIPT, *args], env=env, capture_output=True, text=True,
                              stdin=subprocess.DEVNULL, timeout=timeout)
        return done.returncode, done.stdout + done.stderr
    pid, fd = pty.fork()
    if pid == 0:
        os.execvpe("bash", ["bash", SCRIPT, *args], env)
    output = b""
    pending = list(answers)
    deadline = time.time() + timeout
    while time.time() < deadline:
        ready, _, _ = select.select([fd], [], [], 0.2)
        if ready:
            try:
                chunk = os.read(fd, 4096)
            except OSError:
                break
            if not chunk:
                break
            output += chunk
            if pending and output.rstrip().endswith(b"cancela):"):
                os.write(fd, pending.pop(0).encode() + b"\n")
    _, status = os.waitpid(pid, 0)
    return os.waitstatus_to_exitcode(status), output.decode(errors="replace")


@unittest.skipUnless(os.geteuid() == 0 and shutil.which("bash"), "precisa de root e bash")
class AbrirPaginaPublicaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.base = os.path.join(self.tmp, "vem-comer")
        os.makedirs(os.path.join(self.base, "app", "deploy", "vps"))
        open(os.path.join(self.base, "app", "deploy", "vps", "docker-compose.yml"), "w").close()
        self.envfile = os.path.join(self.base, ".env")
        self.write_env(BASE_ENV)
        bin_dir = os.path.join(self.tmp, "bin")
        os.makedirs(bin_dir)
        path = os.path.join(bin_dir, "docker")
        with open(path, "w") as handle:
            handle.write(DOCKER_SHIM)
        os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC)
        self.shim_log = os.path.join(self.tmp, "docker.log")
        self.env = {
            "PATH": bin_dir + ":" + os.environ["PATH"],
            "HOME": self.tmp,
            "TERM": "dumb",
            "VEM_BASE": self.base,
            "SHIM_LOG": self.shim_log,
        }

    def write_env(self, text):
        with open(self.envfile, "w") as handle:
            handle.write(text)
        os.chmod(self.envfile, 0o600)

    def read_env(self):
        with open(self.envfile) as handle:
            return handle.read()

    def docker_log(self):
        try:
            with open(self.shim_log) as handle:
                return handle.read()
        except FileNotFoundError:
            return ""

    def assert_rest_kept(self, text):
        for kept in BASE_ENV.strip().splitlines():
            self.assertIn(kept, text)

    def test_open_writes_only_the_first_key(self):
        code, output = run_script(["abrir"], ["abrir"], self.env)
        self.assertEqual(code, 0, output)
        self.assertIn("ABERTA", output)
        text = self.read_env()
        self.assertEqual(text.count("PUBLIC_PAGE_OPEN="), 1)
        self.assertIn("PUBLIC_PAGE_OPEN=1\n", text)
        self.assertNotIn("PUBLIC_PAGE_INDEX", text)
        self.assert_rest_kept(text)
        self.assertEqual(stat.S_IMODE(os.stat(self.envfile).st_mode), 0o600)
        self.assertIn("compose", self.docker_log())
        self.assertEqual([n for n in os.listdir(self.base) if n.startswith(".env.")], [])

    def test_the_checklist_says_what_the_page_shows_and_never_shows(self):
        code, output = run_script(["abrir"], ["abrir"], self.env)
        for words in ("cardápio com preços e fotos", "Nunca aparece telefone do dono", "NÃO GUARDAR"):
            self.assertIn(words, output)

    def test_anything_else_cancels_and_changes_nothing(self):
        for answer in ("sim", "s", "", "abrir agora", "google"):
            code, output = run_script(["abrir"], [answer], self.env)
            self.assertNotEqual(code, 0, answer)
            self.assertIn("Cancelado", output)
            self.assertEqual(self.read_env(), BASE_ENV, answer)
        self.assertEqual(self.docker_log(), "")

    def test_google_needs_the_page_open_first(self):
        code, output = run_script(["google"], ["google"], self.env)
        self.assertNotEqual(code, 0)
        self.assertIn("Abra a página antes", output)
        self.assertEqual(self.read_env(), BASE_ENV)

    def test_google_has_its_own_word_and_the_open_word_does_not_work(self):
        self.write_env(BASE_ENV + "PUBLIC_PAGE_OPEN=1\n")
        code, output = run_script(["google"], ["abrir"], self.env)
        self.assertNotEqual(code, 0)
        self.assertNotIn("PUBLIC_PAGE_INDEX", self.read_env())
        code, output = run_script(["google"], ["google"], self.env)
        self.assertEqual(code, 0, output)
        text = self.read_env()
        self.assertIn("PUBLIC_PAGE_OPEN=1\n", text)
        self.assertIn("PUBLIC_PAGE_INDEX=1\n", text)
        self.assertEqual(text.count("PUBLIC_PAGE_INDEX="), 1)
        self.assertIn("sitemap.xml", output)
        self.assert_rest_kept(text)

    def test_the_google_checklist_names_the_owner_choice(self):
        self.write_env(BASE_ENV + "PUBLIC_PAGE_OPEN=1\n")
        code, output = run_script(["google"], ["google"], self.env)
        self.assertIn("Aparecer no Google", output)
        self.assertIn("padrão: ninguém", output)

    def test_going_back_from_google_to_open_drops_only_the_index_key(self):
        self.write_env(BASE_ENV + "PUBLIC_PAGE_OPEN=1\nPUBLIC_PAGE_INDEX=1\n")
        code, output = run_script(["abrir"], ["abrir"], self.env)
        self.assertEqual(code, 0, output)
        text = self.read_env()
        self.assertIn("PUBLIC_PAGE_OPEN=1\n", text)
        self.assertNotIn("PUBLIC_PAGE_INDEX", text)

    def test_closing_removes_both_keys_and_keeps_the_rest(self):
        self.write_env(BASE_ENV + "PUBLIC_PAGE_OPEN=1\nPUBLIC_PAGE_INDEX=1\nANTHROPIC_API_KEY=sk-ant-x\n")
        code, output = run_script(["fechar"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertIn("FECHADA", output)
        text = self.read_env()
        self.assertNotIn("PUBLIC_PAGE", text)
        self.assertIn("ANTHROPIC_API_KEY=sk-ant-x\n", text)
        self.assert_rest_kept(text)

    def test_closing_when_already_closed_is_fine(self):
        code, output = run_script(["fechar"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertEqual(self.read_env(), BASE_ENV)

    def test_status_asks_the_server_and_restarts_nothing(self):
        said = {}
        for extra, word in (("", "FECHADA"), ("PUBLIC_PAGE_OPEN=1\n", "ABERTA"), ("PUBLIC_PAGE_OPEN=1\nPUBLIC_PAGE_INDEX=1\n", "CONVIDADO")):
            self.write_env(BASE_ENV + extra)
            code, output = run_script(["status"], [], self.env, tty=False)
            self.assertEqual(code, 0, output)
            self.assertIn(word, output)
            said[word] = True
        self.assertNotIn("compose", self.docker_log())

    def test_opening_needs_a_terminal(self):
        for command in ("abrir", "google"):
            code, output = run_script([command], [], self.env, tty=False)
            self.assertNotEqual(code, 0)
            self.assertIn("terminal", output)
            self.assertEqual(self.read_env(), BASE_ENV)

    def test_unknown_or_missing_command(self):
        for args in ([], ["talvez"]):
            code, output = run_script(args, [], self.env, tty=False)
            self.assertNotEqual(code, 0)
            self.assertIn("Use:", output)
            self.assertEqual(self.read_env(), BASE_ENV)

    def test_server_that_does_not_come_back_is_reported(self):
        env = dict(self.env, SHIM_HEALTH="starting")
        code, output = run_script(["fechar"], [], env, tty=False, timeout=90)
        self.assertNotEqual(code, 0)
        self.assertIn("não voltou", output)

    def test_refuses_when_not_installed(self):
        os.remove(self.envfile)
        code, output = run_script(["status"], [], self.env, tty=False)
        self.assertNotEqual(code, 0)
        self.assertIn("instalador", output)


if __name__ == "__main__":
    unittest.main()
