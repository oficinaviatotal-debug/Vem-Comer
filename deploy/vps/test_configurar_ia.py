"""Teste do configurar-ia.sh com um "docker" de mentira e uma "Anthropic" de mentira (servidor local).

Roda só como root e com bash e curl instalados (o script confere que é root). Não faz parte do CI
do GitHub; rode à mão antes de mexer no script:
    python3 deploy/vps/test_configurar_ia.py
"""

import json
import os
import pty
import select
import shutil
import stat
import subprocess
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "configurar-ia.sh")
KEY = "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcdef"
BASE_ENV = "SITE_ADDRESS=teste.example.com\nPOSTGRES_PASSWORD=aaa\nSECRET_KEY=bbb\nAPP_DB_PASSWORD=ccc\n"

DOCKER_SHIM = r"""#!/usr/bin/env bash
echo "docker $*" >>"$SHIM_LOG"
case "$1" in
  compose) exit 0 ;;
  inspect) echo healthy ;;
  exec) if grep -q '^ANTHROPIC_API_KEY=.' "$VEM_BASE/.env"; then echo sim; else echo nao; fi ;;
  *) exit 0 ;;
esac
"""

CURL_SHIM = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CURL_ARGS_LOG"
exec "$REAL_CURL" "$@"
"""


class FakeApi:
    def __init__(self):
        self.status = 200
        self.requests = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):  # noqa: N802
                size = int(self.headers.get("content-length", "0"))
                outer.requests.append({"headers": {k.lower(): v for k, v in self.headers.items()}, "body": self.rfile.read(size)})
                payload = b'{"type":"message"}' if outer.status == 200 else b'{"type":"error"}'
                self.send_response(outer.status)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    @property
    def url(self):
        return f"http://127.0.0.1:{self.server.server_address[1]}/v1/messages"

    def stop(self):
        self.server.shutdown()
        self.server.server_close()


def run_script(args, answers, env, tty=True, timeout=60):
    """Roda o script. Com tty, cada resposta é digitada quando o programa pede (como uma pessoa)."""
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
            if pending and (b"Enter: " in output.rsplit(b"\n", 1)[-1]):
                os.write(fd, pending.pop(0).encode() + b"\n")
    _, status = os.waitpid(pid, 0)
    return os.waitstatus_to_exitcode(status), output.decode(errors="replace")


@unittest.skipUnless(os.geteuid() == 0 and shutil.which("bash") and shutil.which("curl"), "precisa de root, bash e curl")
class ConfigurarIaTests(unittest.TestCase):
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
        for name, body in (("docker", DOCKER_SHIM), ("curl", CURL_SHIM)):
            path = os.path.join(bin_dir, name)
            with open(path, "w") as handle:
                handle.write(body)
            os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC)
        self.shim_log = os.path.join(self.tmp, "docker.log")
        self.curl_log = os.path.join(self.tmp, "curl.log")
        self.api = FakeApi()
        self.addCleanup(self.api.stop)
        self.env = {
            "PATH": bin_dir + ":" + os.environ["PATH"],
            "HOME": self.tmp,
            "TERM": "dumb",
            "VEM_BASE": self.base,
            "ANTHROPIC_API_URL": self.api.url,
            "SHIM_LOG": self.shim_log,
            "CURL_ARGS_LOG": self.curl_log,
            "REAL_CURL": shutil.which("curl"),
        }

    def write_env(self, text):
        with open(self.envfile, "w") as handle:
            handle.write(text)
        os.chmod(self.envfile, 0o600)

    def read_env(self):
        with open(self.envfile) as handle:
            return handle.read()

    def test_good_key_is_tested_saved_and_server_restarted(self):
        code, output = run_script([], [KEY], self.env)
        self.assertEqual(code, 0, output)
        self.assertIn("LIGADA", output)
        self.assertNotIn(KEY, output)  # nunca aparece na tela
        text = self.read_env()
        self.assertIn(f"ANTHROPIC_API_KEY={KEY}\n", text)
        self.assertEqual(text.count("ANTHROPIC_API_KEY="), 1)
        for kept in BASE_ENV.strip().splitlines():
            self.assertIn(kept, text)
        self.assertEqual(stat.S_IMODE(os.stat(self.envfile).st_mode), 0o600)
        # a chave foi à API só no cabeçalho, e o teste custa 1 token
        sent = self.api.requests[0]
        self.assertEqual(sent["headers"]["x-api-key"], KEY)
        self.assertEqual(sent["headers"]["anthropic-version"], "2023-06-01")
        self.assertEqual(json.loads(sent["body"])["max_tokens"], 1)
        # e nunca nos argumentos do curl (que qualquer um vê com ps)
        with open(self.curl_log) as handle:
            self.assertNotIn(KEY, handle.read())
        with open(self.shim_log) as handle:
            log = handle.read()
        self.assertIn("compose", log)
        self.assertNotIn(KEY, log)
        self.assertEqual([name for name in os.listdir(self.base) if name.startswith(".env.")], [])

    def test_pasted_spaces_and_quotes_are_cleaned(self):
        code, output = run_script([], [f'  "{KEY}" \t'], self.env)
        self.assertEqual(code, 0, output)
        self.assertIn(f"ANTHROPIC_API_KEY={KEY}\n", self.read_env())

    def test_replaces_the_old_key(self):
        self.write_env(BASE_ENV + "ANTHROPIC_API_KEY=sk-ant-antiga\nOUTRA=1\n")
        code, output = run_script([], [KEY], self.env)
        self.assertEqual(code, 0, output)
        text = self.read_env()
        self.assertEqual(text.count("ANTHROPIC_API_KEY="), 1)
        self.assertNotIn("antiga", text)
        self.assertIn("OUTRA=1", text)

    def test_wrong_format_asks_again_and_gives_up(self):
        code, output = run_script([], ["abc", "123", "sk-ant-curta", "isso nao e chave"], self.env)
        self.assertNotEqual(code, 0)
        self.assertEqual(self.read_env(), BASE_ENV)
        self.assertEqual(self.api.requests, [])
        self.assertIn("Muitas tentativas", output)

    def test_wrong_format_then_good_key(self):
        code, output = run_script([], ["abc", KEY], self.env)
        self.assertEqual(code, 0, output)
        self.assertIn(f"ANTHROPIC_API_KEY={KEY}", self.read_env())

    def test_refused_keys_are_never_saved(self):
        for status, words in ((401, "não aceitou"), (402, "crédito"), (403, "crédito"), (429, "esperar"), (500, "inesperada")):
            self.write_env(BASE_ENV)
            self.api.status = status
            code, output = run_script([], [KEY], self.env)
            self.assertNotEqual(code, 0, status)
            self.assertIn(words, output, status)
            self.assertIn("Nada foi gravado", output)
            self.assertEqual(self.read_env(), BASE_ENV, status)
            self.assertNotIn(KEY, output)

    def test_no_internet_is_never_saved(self):
        self.api.stop()
        code, output = run_script([], [KEY], self.env)
        self.assertNotEqual(code, 0)
        self.assertIn("Nada foi gravado", output)
        self.assertEqual(self.read_env(), BASE_ENV)

    def test_remove_turns_it_off(self):
        self.write_env(BASE_ENV + f"ANTHROPIC_API_KEY={KEY}\n")
        code, output = run_script(["--remover"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertIn("desligada", output)
        self.assertEqual(self.read_env(), BASE_ENV)

    def test_needs_a_terminal_and_a_known_option(self):
        code, output = run_script([], [], self.env, tty=False)
        self.assertNotEqual(code, 0)
        self.assertIn("terminal", output)
        code, output = run_script(["--outra"], [], self.env, tty=False)
        self.assertNotEqual(code, 0)
        self.assertEqual(self.read_env(), BASE_ENV)

    def test_refuses_when_not_installed(self):
        os.remove(self.envfile)
        code, output = run_script([], [KEY], self.env)
        self.assertNotEqual(code, 0)
        self.assertIn("instalador", output)


if __name__ == "__main__":
    unittest.main()
