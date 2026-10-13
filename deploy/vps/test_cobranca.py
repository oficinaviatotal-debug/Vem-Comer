"""Teste do cobranca.sh com um "docker" de mentira.

Roda só como root e com bash instalado (o script confere que é root). Não faz parte do CI do GitHub;
rode à mão antes de mexer no script:
    python3 deploy/vps/test_cobranca.py
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

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cobranca.sh")
BASE_ENV = "SITE_ADDRESS=teste.example.com\nPOSTGRES_PASSWORD=aaa\nSECRET_KEY=bbb\nAPP_DB_PASSWORD=ccc\nSIGNUP_OPEN=1\n"

# O servidor de mentira lê o .env como o de verdade (o compose repassa as linhas) e responde "chave=valor".
DOCKER_SHIM = r"""#!/usr/bin/env bash
echo "docker $*" >>"$SHIM_LOG"
case "$1" in
  compose) exit 0 ;;
  inspect) echo "${SHIM_HEALTH:-healthy}" ;;
  exec)
    f="$VEM_BASE/.env"
    if grep -q '^BILLING_ENFORCED=1$' "$f"; then echo ligada=sim; else echo ligada=nao; fi
    echo "admins=$(sed -n 's/^PLATFORM_ADMIN_EMAILS=//p' "$f" | tr ',' '\n' | grep -c .)"
    if grep -q '^BILLING_PIX_KEY=.' "$f"; then echo pix=sim; else echo pix=nao; fi
    if grep -q '^BILLING_CONTACT_PHONE=.' "$f"; then echo whatsapp=sim; else echo whatsapp=nao; fi
    ;;
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
class CobrancaTests(unittest.TestCase):
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

    def dados(self, *args):
        return run_script(["dados", *args], [], self.env, tty=False)

    def ready_env(self):
        self.write_env(BASE_ENV + "PLATFORM_ADMIN_EMAILS=gd@example.com\nBILLING_PIX_KEY=chave-pix\n")

    # ---------------------------------------------------------------------------------------- status

    def test_status_is_off_by_default_and_says_what_is_missing(self):
        code, output = run_script(["status"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertIn("DESLIGADA", output)
        self.assertIn("FALTA", output)
        self.assertNotIn("compose", self.docker_log())  # só olhar não reinicia nada
        self.assertEqual(self.read_env(), BASE_ENV)

    def test_status_reports_what_the_server_sees(self):
        self.write_env(BASE_ENV + "BILLING_ENFORCED=1\nPLATFORM_ADMIN_EMAILS=a@x.com,b@x.com\nBILLING_PIX_KEY=k\nBILLING_CONTACT_PHONE=5584999999999\n")
        code, output = run_script(["status"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertIn("LIGADA", output)
        self.assertIn("veem todos os restaurantes): 2", output)
        self.assertIn("preenchida", output)
        self.assertIn("preenchido", output)
        self.assertNotIn("FALTA", output)

    # ---------------------------------------------------------------------------------------- dados

    def test_dados_writes_only_the_given_lines_and_keeps_the_rest(self):
        code, output = self.dados("--admin", "gd@example.com", "--pix", "000.111.222-33", "--recebedor", "Vem Tecnologia",
                                  "--whatsapp", "(84) 99999-1234")
        self.assertEqual(code, 0, output)
        text = self.read_env()
        for kept in BASE_ENV.strip().splitlines():
            self.assertIn(kept + "\n", text)
        self.assertIn("PLATFORM_ADMIN_EMAILS=gd@example.com\n", text)
        self.assertIn("BILLING_PIX_KEY=000.111.222-33\n", text)
        self.assertIn("BILLING_PIX_RECEIVER=Vem Tecnologia\n", text)
        self.assertIn("BILLING_CONTACT_PHONE=5584999991234\n", text)  # só dígitos, com o 55 na frente
        self.assertNotIn("BILLING_ENFORCED", text)  # dados nunca liga a cobrança
        self.assertEqual(stat.S_IMODE(os.stat(self.envfile).st_mode), 0o600)
        self.assertIn("compose", self.docker_log())
        self.assertEqual([n for n in os.listdir(self.base) if n.startswith(".env.")], [])

    def test_dados_twice_replaces_instead_of_repeating(self):
        self.dados("--pix", "primeira")
        code, output = self.dados("--pix", "segunda")
        self.assertEqual(code, 0, output)
        text = self.read_env()
        self.assertEqual(text.count("BILLING_PIX_KEY="), 1)
        self.assertIn("BILLING_PIX_KEY=segunda\n", text)

    def test_dados_with_an_empty_value_removes_the_line(self):
        self.dados("--pix", "alguma")
        code, output = self.dados("--pix", "")
        self.assertEqual(code, 0, output)
        self.assertNotIn("BILLING_PIX_KEY", self.read_env())

    def test_dados_accepts_two_admins_separated_by_comma(self):
        code, output = self.dados("--admin", "a@x.com,b@x.com")
        self.assertEqual(code, 0, output)
        self.assertIn("PLATFORM_ADMIN_EMAILS=a@x.com,b@x.com\n", self.read_env())

    def test_dados_refuses_what_would_break_the_env_file(self):
        for bad in ('chave"aspas', "chave com $cifrao", "chave#comentario", "chave`crase`", "barra\\invertida", "linha1\nlinha2"):
            code, output = self.dados("--pix", bad)
            self.assertNotEqual(code, 0, bad)
            self.assertIn("não posso gravar", output)
            self.assertEqual(self.read_env(), BASE_ENV, bad)
        self.assertEqual(self.docker_log(), "")

    def test_dados_refuses_an_invalid_email_phone_or_flag(self):
        for args, words in (
            (("--admin", "sem-arroba"), "não parece um e-mail"),
            (("--admin", "a@x.com b@x.com"), "não parece um e-mail"),
            (("--whatsapp", "123"), "DDD"),
            (("--tudo", "x"), "Não conheço"),
            (("--pix",), "Faltou o valor"),
            ((), "Diga o que gravar"),
        ):
            code, output = self.dados(*args)
            self.assertNotEqual(code, 0, args)
            self.assertIn(words, output)
            self.assertEqual(self.read_env(), BASE_ENV, args)

    def test_dados_does_not_save_half_when_one_value_is_bad(self):
        code, output = self.dados("--pix", "boa", "--admin", "ruim")
        self.assertNotEqual(code, 0)
        self.assertEqual(self.read_env(), BASE_ENV)

    # ---------------------------------------------------------------------------------------- ligar / desligar

    def test_ligar_needs_a_terminal(self):
        self.ready_env()
        before = self.read_env()
        code, output = run_script(["ligar"], [], self.env, tty=False)
        self.assertNotEqual(code, 0)
        self.assertIn("terminal", output)
        self.assertEqual(self.read_env(), before)

    def test_ligar_refuses_without_admin_or_payment_info(self):
        for text, words in (
            (BASE_ENV, "quem é o administrador"),
            (BASE_ENV + "PLATFORM_ADMIN_EMAILS=gd@example.com\n", "para onde o dono paga"),
            (BASE_ENV + "BILLING_PIX_KEY=k\n", "quem é o administrador"),
        ):
            self.write_env(text)
            code, output = run_script(["ligar"], ["ligar"], self.env)
            self.assertNotEqual(code, 0)
            self.assertIn(words, output)
            self.assertEqual(self.read_env(), text)
        self.assertEqual(self.docker_log(), "")

    def test_ligar_works_with_only_the_whatsapp_as_payment_info(self):
        self.write_env(BASE_ENV + "PLATFORM_ADMIN_EMAILS=gd@example.com\nBILLING_CONTACT_PHONE=5584999999999\n")
        code, output = run_script(["ligar"], ["ligar"], self.env)
        self.assertEqual(code, 0, output)
        self.assertIn("BILLING_ENFORCED=1\n", self.read_env())

    def test_ligar_after_typing_the_word_and_the_checklist_is_shown(self):
        self.ready_env()
        code, output = run_script(["ligar"], ["ligar"], self.env)
        self.assertEqual(code, 0, output)
        self.assertIn("LIGADA", output)
        for words in ("1º pagamento", "NÃO recebe pedido", "à mão", "desligar"):
            self.assertIn(words, output)
        text = self.read_env()
        self.assertEqual(text.count("BILLING_ENFORCED="), 1)
        self.assertIn("BILLING_ENFORCED=1\n", text)
        for kept in BASE_ENV.strip().splitlines():
            self.assertIn(kept + "\n", text)
        self.assertIn("compose", self.docker_log())

    def test_case_and_spaces_do_not_matter(self):
        self.ready_env()
        code, output = run_script(["ligar"], ["  LIGAR \t"], self.env)
        self.assertEqual(code, 0, output)
        self.assertIn("BILLING_ENFORCED=1\n", self.read_env())

    def test_anything_else_cancels_and_changes_nothing(self):
        self.ready_env()
        before = self.read_env()
        for answer in ("sim", "s", "", "ligar agora", "n"):
            code, output = run_script(["ligar"], [answer], self.env)
            self.assertNotEqual(code, 0, answer)
            self.assertIn("Cancelado", output)
            self.assertEqual(self.read_env(), before, answer)
        self.assertEqual(self.docker_log(), "")

    def test_ligar_twice_does_not_repeat_the_line(self):
        self.ready_env()
        run_script(["ligar"], ["ligar"], self.env)
        code, output = run_script(["ligar"], ["ligar"], self.env)
        self.assertEqual(code, 0, output)
        self.assertEqual(self.read_env().count("BILLING_ENFORCED="), 1)

    def test_desligar_removes_only_that_line(self):
        self.ready_env()
        run_script(["ligar"], ["ligar"], self.env)
        code, output = run_script(["desligar"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertIn("DESLIGADA", output)
        text = self.read_env()
        self.assertNotIn("BILLING_ENFORCED", text)
        self.assertIn("PLATFORM_ADMIN_EMAILS=gd@example.com\n", text)
        self.assertIn("BILLING_PIX_KEY=chave-pix\n", text)
        for kept in BASE_ENV.strip().splitlines():
            self.assertIn(kept + "\n", text)

    def test_desligar_when_already_off_is_fine(self):
        code, output = run_script(["desligar"], [], self.env, tty=False)
        self.assertEqual(code, 0, output)
        self.assertEqual(self.read_env(), BASE_ENV)

    def test_server_that_does_not_come_back_is_reported(self):
        env = dict(self.env, SHIM_HEALTH="starting")
        code, output = run_script(["desligar"], [], env, tty=False, timeout=90)
        self.assertNotEqual(code, 0)
        self.assertIn("não voltou", output)

    # ---------------------------------------------------------------------------------------- geral

    def test_unknown_or_missing_command(self):
        for args in ([], ["talvez"]):
            code, output = run_script(args, [], self.env, tty=False)
            self.assertNotEqual(code, 0)
            self.assertIn("Use:", output)
            self.assertEqual(self.read_env(), BASE_ENV)

    def test_refuses_when_not_installed(self):
        os.remove(self.envfile)
        code, output = run_script(["status"], [], self.env, tty=False)
        self.assertNotEqual(code, 0)
        self.assertIn("instalador", output)


class ComposePassesTheBillingSettings(unittest.TestCase):
    def test_every_setting_the_server_reads_is_passed_by_the_compose_file(self):
        compose = os.path.join(os.path.dirname(SCRIPT), "docker-compose.yml")
        with open(compose, encoding="utf-8") as handle:
            text = handle.read()
        for name in ("BILLING_ENFORCED", "PLATFORM_ADMIN_EMAILS", "BILLING_PIX_KEY", "BILLING_PIX_RECEIVER", "BILLING_CONTACT_PHONE"):
            self.assertIn(f"{name}: ${{{name}:-}}", text, name)  # vazio por padrão = cobrança desligada


if __name__ == "__main__":
    unittest.main()
