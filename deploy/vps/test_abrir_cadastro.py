"""Teste do abrir-cadastro.sh com um "docker" de mentira.

Roda só como root e com bash instalado (o script confere que é root). Não faz parte do CI do GitHub;
rode à mão antes de mexer no script:
    python3 deploy/vps/test_abrir_cadastro.py
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

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "abrir-cadastro.sh")
BASE_ENV = "SITE_ADDRESS=teste.example.com\nPOSTGRES_PASSWORD=aaa\nSECRET_KEY=bbb\nAPP_DB_PASSWORD=ccc\n"

# O servidor de mentira responde "sim" só se o .env tiver SIGNUP_OPEN=1, como o servidor de verdade.
DOCKER_SHIM = r"""#!/usr/bin/env bash
echo "docker $*" >>"$SHIM_LOG"
case "$1" in
  compose) exit 0 ;;
  inspect) echo "${SHIM_HEALTH:-healthy}" ;;
  exec) if grep -q '^SIGNUP_OPEN=1$' "$VEM_BASE/.env"; then echo sim; else echo nao; fi ;;
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
class AbrirCadastroTests(unittest.TestCase):
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

    def test_open_after_typing_the_word(self):
        code, output = run_script(["abrir"], ["abrir"], self.env)
        self.assertEqual(code, 0, output)
        self.assertIn("ABERTO", output)
        self.assertIn("https://teste.example.com/?cadastro=1", output)
        text = self.read_env()
        self.assertEqual(text.count("SIGNUP_OPEN="), 1)
        self.assertIn("SIGNUP_OPEN=1\n", text)
        for kept in BASE_ENV.strip().splitlines():
            self.assertIn(kept, text)
        self.assertEqual(stat.S_IMODE(os.stat(self.envfile).st_mode), 0o600)
        self.assertIn("compose", self.docker_log())
        self.assertEqual([n for n in os.listdir(self.base) if n.startswith(".env.")], [])

    def test_the_checklist_is_shown_before_opening(self):
        code, output = run_script(["abrir"], ["abrir"], self.env)
        for words in ("advogado", "contato de suporte", "esqueci a senha"):
            self.assertIn(words, output)

    def test_case_and_spaces_do_not_matter(self):
        code, output = run_script(["abrir"], ["  ABRIR \t"], self.env)
        self.assertEqual(code, 0, output)
        self.assertIn("SIGNUP_OPEN=1\n", self.read_env())

    def test_anything_else_cancels_and_changes_nothing(self):
        for answer in ("sim", "s", "", "abrir agora", "n"):
            code, output = run_script(["abrir"], [answer], self.env)
            self.assertNotEqual(code, 0, answer)
            self.assertIn("Cancelado", output)
            self.assertEqual(self.read_env(), BASE_ENV, answer)
        self.assertEqual(self.docker_log(), "")

    def test_opening_twice_does_not_repeat_the_line(self):
        run_script(["abrir"], ["abrir"], self.env)
        code, output = run_script(["abrir"], ["abrir"], self.env)
        self.assertEqual(code, 0, output)
        self.assertEqual(self.read_env().count("SIGNUP_OPEN="), 1)

    def test_closing_removes_the_line_and_keeps_the_rest(self):
        self.write_env(BASE_ENV + "SIGNUP_OPEN=1\nANTHROPIC_API_KEY=sk-ant-x\n")
        code, output = run_script(["fechar"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertIn("FECHADO", output)
        text = self.read_env()
        self.assertNotIn("SIGNUP_OPEN", text)
        self.assertIn("ANTHROPIC_API_KEY=sk-ant-x\n", text)
        for kept in BASE_ENV.strip().splitlines():
            self.assertIn(kept, text)

    def test_closing_when_already_closed_is_fine(self):
        code, output = run_script(["fechar"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertEqual(self.read_env(), BASE_ENV)

    def test_status_asks_the_server(self):
        code, output = run_script(["status"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertIn("FECHADO", output)
        self.write_env(BASE_ENV + "SIGNUP_OPEN=1\n")
        code, output = run_script(["status"], [], self.env, tty=False)
        self.assertIn("ABERTO", output)
        self.assertIn("/?cadastro=1", output)
        self.assertNotIn("compose", self.docker_log())  # só olhar não reinicia nada

    def test_opening_needs_a_terminal(self):
        code, output = run_script(["abrir"], [], self.env, tty=False)
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
