"""Teste do atualizar-sozinho.sh com Docker, curl e systemctl "de mentira".

O git é o de verdade (um repositório local faz o papel do GitHub). O instalador da versão nova também é de
mentira: ele só imita o que o verdadeiro faz (troca o código, sobe o servidor e passa a informar a versão).

Roda só como root e com bash instalado (o script confere que é root). Rode à mão antes de mexer no script:
    python3 deploy/vps/test_atualizar_sozinho.py
"""

import json
import os
import shutil
import stat
import subprocess
import tempfile
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(AQUI, "atualizar-sozinho.sh")

DOCKER_SHIM = r"""#!/usr/bin/env bash
echo "docker $*" >>"$SHIM_LOG"
case "$1" in
  inspect)
    if [ -f "$SHIM_DIR/api_doente" ]; then echo unhealthy; else echo healthy; fi
    ;;
  compose)
    case " $* " in
      *" up "*)
        [ -f "$SHIM_DIR/volta_falha" ] && exit 1
        echo "${VEM_VERSION:-manual}" >"$SHIM_DIR/versao_no_ar"
        echo ok >"$SHIM_DIR/saude"
        ;;
    esac
    ;;
esac
exit 0
"""

CURL_SHIM = r"""#!/usr/bin/env bash
url=""
for a in "$@"; do case "$a" in http*|file*) url="$a" ;; esac; done
echo "curl $url" >>"$SHIM_LOG"
case "$url" in
  https://teste.example.com/api/health)
    [ "$(cat "$SHIM_DIR/saude" 2>/dev/null)" = ok ] || exit 22
    printf '{"service":"vem-comer-api","status":"ok","version":"%s"}\n' "$(cat "$SHIM_DIR/versao_no_ar")"
    ;;
  */check-runs*)
    [ -f "$SHIM_DIR/ci.json" ] || exit 22
    cat "$SHIM_DIR/ci.json"
    ;;
  *) exit 22 ;;
esac
"""

SYSTEMCTL_SHIM = r"""#!/usr/bin/env bash
echo "systemctl $*" >>"$SHIM_LOG"
[ "$1" = is-active ] && echo active
exit 0
"""

# instalador de mentira (vai dentro de cada commit de teste)
INSTALAR_FALSO = r"""#!/usr/bin/env bash
set -e
echo "instalar COMMIT=${VEM_COMMIT:-} SOB=${VEM_SOB_ATUALIZADOR:-}" >>"$SHIM_LOG"
[ -f "$SHIM_DIR/instalador_falha_cedo" ] && exit 3
git -C "$VEM_BASE/app" fetch --quiet origin "$VEM_RAMO"
git -C "$VEM_BASE/app" checkout --quiet -f -B "$VEM_RAMO" "$VEM_COMMIT"
versao=$(printf '%s' "$VEM_COMMIT" | cut -c1-12)
# a atualização do banco falhou: o código já foi trocado, mas o servidor antigo continua no ar e respondendo
[ -f "$SHIM_DIR/migracao_falha" ] && exit 6
if [ -f "$SHIM_DIR/quebrada" ] && [ "$(cat "$SHIM_DIR/quebrada")" = "$versao" ]; then
  echo "$versao" >"$SHIM_DIR/versao_no_ar"
  rm -f "$SHIM_DIR/saude"
  exit 5
fi
echo "$versao" >"$SHIM_DIR/versao_no_ar"
echo ok >"$SHIM_DIR/saude"
[ -f "$SHIM_DIR/backup_pos_falha" ] && exit 1
exit 0
"""

BACKUP_FALSO = r"""#!/usr/bin/env bash
echo "backup" >>"$SHIM_LOG"
[ -f "$SHIM_DIR/backup_falha" ] && exit 1
exit 0
"""


def git(*args, cwd, **kw):
    env = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t")
    return subprocess.run(["git", *args], cwd=cwd, env=env, check=True, capture_output=True, text=True, **kw).stdout.strip()


def run_json(n=5, status="completed", conclusao="success", extra=None, indent=None):
    """Imita o formato do GitHub (check-runs), com objetos aninhados como os de verdade."""
    runs = []
    for i in range(n):
        s, c = status, conclusao
        if extra and i < len(extra):
            s, c = extra[i]
        runs.append({
            "id": 100 + i, "name": f"job{i}", "head_sha": "x", "status": s, "conclusion": c if s == "completed" else None,
            "output": {"title": None, "summary": None, "text": None, "annotations_count": 0},
            "check_suite": {"id": 7},
            "app": {"id": 1, "slug": "github-actions", "name": "GitHub Actions",
                    "owner": {"login": "github", "type": "Organization"},
                    "permissions": {"actions": "write", "checks": "write"}, "events": ["push", "pull_request"]},
            "pull_requests": [],
        })
    return json.dumps({"total_count": n, "check_runs": runs}, indent=indent, separators=None if indent else (",", ":"))


@unittest.skipUnless(os.geteuid() == 0 and shutil.which("bash") and shutil.which("git"), "precisa de root, bash e git")
class AtualizadorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.remote = os.path.join(self.tmp, "remote.git")
        self.work = os.path.join(self.tmp, "work")
        self.base = os.path.join(self.tmp, "vem-comer")
        self.shim = os.path.join(self.tmp, "shim")
        self.estado = os.path.join(self.tmp, "estado")
        for d in (self.shim, os.path.join(self.tmp, "bin")):
            os.makedirs(d)
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", self.remote], check=True)
        subprocess.run(["git", "clone", "-q", self.remote, self.work], check=True, capture_output=True)
        git("checkout", "-q", "-B", "main", cwd=self.work)
        self.c1 = self.commit({"backend/app.py": "v1\n", "docs/a.md": "a\n"}, "primeiro")
        # o servidor já tem a primeira versão instalada e no ar
        os.makedirs(self.base)
        subprocess.run(["git", "clone", "-q", "--branch", "main", self.remote, os.path.join(self.base, "app")], check=True,
                       capture_output=True)
        with open(os.path.join(self.base, ".env"), "w") as f:
            f.write("SITE_ADDRESS=teste.example.com\nPOSTGRES_PASSWORD=a\nSECRET_KEY=b\nAPP_DB_PASSWORD=c\n")
        for nome, conteudo in (("docker", DOCKER_SHIM), ("curl", CURL_SHIM), ("systemctl", SYSTEMCTL_SHIM)):
            caminho = os.path.join(self.tmp, "bin", nome)
            with open(caminho, "w") as f:
                f.write(conteudo)
            os.chmod(caminho, os.stat(caminho).st_mode | stat.S_IEXEC)
        self.log = os.path.join(self.tmp, "shim.log")
        self.env = {
            "PATH": os.path.join(self.tmp, "bin") + ":" + os.environ["PATH"],
            "HOME": self.tmp,
            "TERM": "dumb",
            "SHIM_DIR": self.shim,
            "SHIM_LOG": self.log,
            "VEM_BASE": self.base,
            "VEM_REPO": "file://" + self.remote,
            "VEM_ESTADO_DIR": self.estado,
            "VEM_LOG": os.path.join(self.tmp, "atualizar.log"),
            "VEM_LOCK": os.path.join(self.tmp, "lock"),
            "VEM_BIN": os.path.join(self.tmp, "sbin", "vem-comer-atualizar"),
            "VEM_UNIT_DIR": os.path.join(self.tmp, "units"),
            "VEM_ESPERA": "0",
            "VEM_TENTATIVAS_SAUDE": "2",
        }
        os.makedirs(self.estado)
        self.escrever(self.estado, "ultimo-ok", self.c1)
        self.escrever(self.shim, "versao_no_ar", self.c1[:12])
        self.escrever(self.shim, "saude", "ok")
        self.escrever(self.shim, "ci.json", run_json())

    # ------------------------------------------------------------------ ajudas
    def escrever(self, pasta, nome, texto):
        with open(os.path.join(pasta, nome), "w") as f:
            f.write(texto)

    def lido(self, pasta, nome):
        with open(os.path.join(pasta, nome)) as f:
            return f.read().strip()

    def commit(self, arquivos, mensagem):
        arquivos = dict(arquivos)
        arquivos.setdefault("deploy/vps/instalar.sh", INSTALAR_FALSO)
        arquivos.setdefault("deploy/vps/backup.sh", BACKUP_FALSO)
        arquivos.setdefault("deploy/vps/docker-compose.yml", "name: vemcomer\n")
        for caminho, texto in arquivos.items():
            alvo = os.path.join(self.work, caminho)
            os.makedirs(os.path.dirname(alvo), exist_ok=True)
            with open(alvo, "w") as f:
                f.write(texto)
        git("add", "-A", cwd=self.work)
        git("commit", "-q", "-m", mensagem, cwd=self.work)
        git("push", "-q", "origin", "main", cwd=self.work)
        return git("rev-parse", "HEAD", cwd=self.work)

    def rodar(self, *args, extra_env=None):
        env = dict(self.env, **(extra_env or {}))
        feito = subprocess.run(["bash", SCRIPT, *args], env=env, capture_output=True, text=True, stdin=subprocess.DEVNULL,
                               timeout=60)
        return feito.returncode, feito.stdout + feito.stderr

    def chamadas(self):
        try:
            with open(self.log) as f:
                return f.read()
        except FileNotFoundError:
            return ""

    def versao_no_ar(self):
        return self.lido(self.shim, "versao_no_ar")

    def ultimo_ok(self):
        return self.lido(self.estado, "ultimo-ok")

    def head_do_servidor(self):
        return git("rev-parse", "HEAD", cwd=os.path.join(self.base, "app"))

    def estado_texto(self):
        return self.lido(self.estado, "estado.txt")

    # ------------------------------------------------------------------ testes do ciclo
    def test_em_dia_nao_faz_nada(self):
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("em dia", self.estado_texto())
        self.assertNotIn("instalar", self.chamadas())
        self.assertNotIn("backup", self.chamadas())

    def test_atualiza_quando_os_testes_estao_verdes(self):
        c2 = self.commit({"backend/app.py": "v2\n"}, "segundo")
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertEqual(self.ultimo_ok(), c2)
        self.assertEqual(self.versao_no_ar(), c2[:12])
        self.assertEqual(self.head_do_servidor(), c2)
        self.assertIn("ATUALIZADO", self.estado_texto())
        chamadas = self.chamadas()
        # o backup vem ANTES do instalador, e o instalador recebe o commit exato e a marca de "sob o atualizador"
        self.assertLess(chamadas.index("backup"), chamadas.index("instalar"))
        self.assertIn(f"instalar COMMIT={c2} SOB=1", chamadas)

    def test_json_do_github_bonito_ou_compacto(self):
        self.commit({"backend/app.py": "v2\n"}, "segundo")
        self.escrever(self.shim, "ci.json", run_json(indent=2))
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("ATUALIZADO", self.estado_texto())

    def test_teste_vermelho_nao_instala(self):
        c2 = self.commit({"backend/app.py": "v2\n"}, "segundo")
        self.escrever(self.shim, "ci.json", run_json(extra=[("completed", "success"), ("completed", "failure")]))
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("VERMELHO", self.estado_texto())
        self.assertEqual(self.ultimo_ok(), self.c1)
        self.assertNotIn("instalar", self.chamadas())
        self.assertNotIn("backup", self.chamadas())
        self.assertNotEqual(self.head_do_servidor(), c2)

    def test_teste_ainda_rodando_espera(self):
        self.commit({"backend/app.py": "v2\n"}, "segundo")
        self.escrever(self.shim, "ci.json", run_json(extra=[("completed", "success"), ("in_progress", None)]))
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("aguardando", self.estado_texto())
        self.assertNotIn("instalar", self.chamadas())

    def test_poucos_testes_nao_bastam(self):
        self.commit({"backend/app.py": "v2\n"}, "segundo")
        self.escrever(self.shim, "ci.json", run_json(n=3))
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("só 3 testes", self.estado_texto())
        self.assertNotIn("instalar", self.chamadas())

    def test_sem_resposta_do_github_nao_instala(self):
        self.commit({"backend/app.py": "v2\n"}, "segundo")
        os.remove(os.path.join(self.shim, "ci.json"))
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("não consegui consultar", self.estado_texto())
        self.assertNotIn("instalar", self.chamadas())

    def test_testes_ignorados_ou_neutros_contam_como_verdes(self):
        self.commit({"backend/app.py": "v2\n"}, "segundo")
        self.escrever(self.shim, "ci.json", run_json(extra=[("completed", "skipped"), ("completed", "neutral")]))
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("ATUALIZADO", self.estado_texto())

    def test_so_documentacao_nao_reinicia_nada(self):
        c2 = self.commit({"docs/a.md": "novo\n", "tests/x.mjs": "x\n"}, "so docs")
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertEqual(self.ultimo_ok(), c2)
        self.assertIn("só muda documentação", self.estado_texto())
        self.assertNotIn("instalar", self.chamadas())
        self.assertNotIn("backup", self.chamadas())
        self.assertEqual(self.versao_no_ar(), self.c1[:12])

    def test_codigo_junto_com_documentacao_instala(self):
        c2 = self.commit({"docs/a.md": "novo\n", "frontend/src/x.ts": "x\n"}, "misto")
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertEqual(self.versao_no_ar(), c2[:12])

    def test_pausa(self):
        self.commit({"backend/app.py": "v2\n"}, "segundo")
        open(os.path.join(self.base, "PAUSAR-ATUALIZACAO"), "w").close()
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("pausado", self.estado_texto())
        self.assertNotIn("instalar", self.chamadas())

    def test_backup_com_falha_nao_instala_e_para_depois_de_tres(self):
        c2 = self.commit({"backend/app.py": "v2\n"}, "segundo")
        self.escrever(self.shim, "backup_falha", "1")
        for tentativa in (1, 2):
            rc, saida = self.rodar()
            self.assertEqual(rc, 0, saida)
            self.assertIn(f"Tentativa {tentativa} de 3", self.estado_texto())
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("PARADA", self.estado_texto())
        self.assertNotIn("instalar", self.chamadas())
        self.assertEqual(self.ultimo_ok(), self.c1)
        # a quarta rodada nem tenta de novo
        antes = self.chamadas().count("backup")
        self.rodar()
        self.assertEqual(self.chamadas().count("backup"), antes)
        self.assertIn("já falhou antes", self.estado_texto())
        # uma versão mais nova volta a ser tentada
        c3 = self.commit({"backend/app.py": "v3\n"}, "terceiro")
        os.remove(os.path.join(self.shim, "backup_falha"))
        self.rodar()
        self.assertEqual(self.ultimo_ok(), c3)
        self.assertNotEqual(c2, c3)

    def test_instalador_que_para_cedo_nao_reverte_nada(self):
        self.commit({"backend/app.py": "v2\n"}, "segundo")
        self.escrever(self.shim, "instalador_falha_cedo", "1")
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("Tentativa 1 de 3", self.estado_texto())
        self.assertEqual(self.ultimo_ok(), self.c1)
        self.assertEqual(self.versao_no_ar(), self.c1[:12])
        self.assertNotIn("compose", self.chamadas())  # nada foi reconstruído nem reiniciado

    def test_versao_que_nao_sobe_e_revertida(self):
        c2 = self.commit({"backend/app.py": "v2 quebrada\n"}, "segundo")
        self.escrever(self.shim, "quebrada", c2[:12])
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("REVERTIDO", self.estado_texto())
        self.assertEqual(self.versao_no_ar(), self.c1[:12])  # voltou
        self.assertEqual(self.head_do_servidor(), self.c1)
        self.assertEqual(self.ultimo_ok(), self.c1)
        self.assertTrue(self.lido(self.estado, "ruim").startswith(c2))
        self.assertIn("VEM_VERSION=" + self.c1[:12], self.lido(self.base, ".env"))
        # na rodada seguinte, não tenta a versão ruim de novo
        antes = self.chamadas().count("instalar")
        self.rodar()
        self.assertEqual(self.chamadas().count("instalar"), antes)
        # mas uma versão mais nova é tentada e entra
        c3 = self.commit({"backend/app.py": "v3\n"}, "terceiro")
        self.rodar()
        self.assertEqual(self.versao_no_ar(), c3[:12])
        self.assertEqual(self.ultimo_ok(), c3)

    def test_atualizacao_do_banco_falha_com_servidor_antigo_ainda_no_ar_tambem_reverte(self):
        # o site antigo continua respondendo, mas NÃO é a versão nova: não pode contar como sucesso
        c2 = self.commit({"backend/app.py": "v2\n"}, "segundo")
        self.escrever(self.shim, "migracao_falha", "1")
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("REVERTIDO", self.estado_texto())
        self.assertEqual(self.ultimo_ok(), self.c1)
        self.assertEqual(self.head_do_servidor(), self.c1)
        self.assertEqual(self.versao_no_ar(), self.c1[:12])
        self.assertTrue(self.lido(self.estado, "ruim").startswith(c2))

    def test_se_nem_a_volta_funciona_trava_e_avisa(self):
        c2 = self.commit({"backend/app.py": "v2 quebrada\n"}, "segundo")
        self.escrever(self.shim, "quebrada", c2[:12])
        self.escrever(self.shim, "volta_falha", "1")
        rc, saida = self.rodar()
        self.assertEqual(rc, 1, saida)
        self.assertIn("EMERGÊNCIA", self.estado_texto())
        self.assertTrue(os.path.exists(os.path.join(self.estado, "emergencia")))
        # trava: não mexe em mais nada até alguém olhar
        antes = self.chamadas().count("instalar")
        rc, _ = self.rodar()
        self.assertEqual(rc, 1)
        self.assertEqual(self.chamadas().count("instalar"), antes)

    def test_backup_pos_instalacao_com_falha_nao_derruba_o_site(self):
        c2 = self.commit({"backend/app.py": "v2\n"}, "segundo")
        self.escrever(self.shim, "backup_pos_falha", "1")  # o instalador sai com código 1, mas o site subiu
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertEqual(self.ultimo_ok(), c2)
        self.assertEqual(self.versao_no_ar(), c2[:12])
        self.assertIn("ATUALIZADO", self.estado_texto())

    def test_site_nao_responde_de_fora_mas_servidor_esta_bem_adia(self):
        self.commit({"backend/app.py": "v2\n"}, "segundo")
        os.remove(os.path.join(self.shim, "saude"))
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertIn("não responde de fora", self.estado_texto())
        self.assertNotIn("instalar", self.chamadas())

    def test_servidor_quebrado_por_dentro_tenta_a_versao_nova(self):
        c2 = self.commit({"backend/app.py": "v2 conserto\n"}, "conserto")
        os.remove(os.path.join(self.shim, "saude"))
        self.escrever(self.shim, "api_doente", "1")
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertEqual(self.versao_no_ar(), c2[:12])
        self.assertIn("ATUALIZADO", self.estado_texto())

    def test_sem_github_nao_faz_nada(self):
        rc, saida = self.rodar(extra_env={"VEM_REPO": "file://" + os.path.join(self.tmp, "nao-existe.git")})
        self.assertEqual(rc, 0, saida)
        self.assertIn("não consegui falar com o GitHub", self.estado_texto())

    def test_a_atualizacao_renova_o_proprio_script(self):
        with open(SCRIPT) as f:
            novo = f.read() + "\n# versão nova\n"
        c2 = self.commit({"deploy/vps/atualizar-sozinho.sh": novo}, "atualizador novo")
        os.makedirs(os.path.dirname(self.env["VEM_BIN"]), exist_ok=True)
        shutil.copy(SCRIPT, self.env["VEM_BIN"])
        os.makedirs(self.env["VEM_UNIT_DIR"], exist_ok=True)
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        self.assertEqual(self.ultimo_ok(), c2)
        with open(self.env["VEM_BIN"]) as f:
            self.assertTrue(f.read().endswith("# versão nova\n"))

    def test_script_com_erro_de_sintaxe_nao_e_instalado_por_cima(self):
        c2 = self.commit({"deploy/vps/atualizar-sozinho.sh": "if then\n"}, "quebrado")
        os.makedirs(os.path.dirname(self.env["VEM_BIN"]), exist_ok=True)
        shutil.copy(SCRIPT, self.env["VEM_BIN"])
        os.makedirs(self.env["VEM_UNIT_DIR"], exist_ok=True)
        rc, saida = self.rodar()
        self.assertEqual(rc, 0, saida)
        with open(SCRIPT) as f, open(self.env["VEM_BIN"]) as g:
            self.assertEqual(f.read(), g.read())
        self.assertEqual(self.ultimo_ok(), c2)

    # ------------------------------------------------------------------ comandos
    def commit_com_arquivos_do_atualizador(self):
        arquivos = {}
        for nome in ("atualizar-sozinho.sh", "vem-comer-atualizar.service", "vem-comer-atualizar.timer"):
            with open(os.path.join(AQUI, nome)) as f:
                arquivos["deploy/vps/" + nome] = f.read()
        return self.commit(arquivos, "atualizador")

    def test_instalar_copia_arquivos_liga_o_relogio_e_marca_o_ponto_de_partida(self):
        self.commit_com_arquivos_do_atualizador()
        os.remove(os.path.join(self.estado, "ultimo-ok"))
        rc, saida = self.rodar("--instalar")
        self.assertEqual(rc, 0, saida)
        self.assertTrue(os.access(self.env["VEM_BIN"], os.X_OK))
        self.assertTrue(os.path.exists(os.path.join(self.env["VEM_UNIT_DIR"], "vem-comer-atualizar.timer")))
        self.assertTrue(os.path.exists(os.path.join(self.env["VEM_UNIT_DIR"], "vem-comer-atualizar.service")))
        self.assertIn("systemctl enable --now vem-comer-atualizar.timer", self.chamadas())
        # ponto de partida = o que está rodando agora (não o que acabou de ser baixado)
        self.assertEqual(self.ultimo_ok(), self.c1)
        self.assertEqual(self.head_do_servidor(), self.c1, "instalar o atualizador não pode trocar o código do site")
        self.assertIn("PRONTO", saida)

    def test_instalar_recusa_quando_o_site_nao_esta_instalado(self):
        shutil.rmtree(os.path.join(self.base, "app"))
        rc, saida = self.rodar("--instalar")
        self.assertNotEqual(rc, 0)
        self.assertIn("ainda não foi instalado", saida)

    def test_instalar_recusa_quando_o_github_ainda_nao_tem_os_arquivos(self):
        rc, saida = self.rodar("--instalar")
        self.assertNotEqual(rc, 0)
        self.assertIn("ainda não tem", saida)

    def test_pausar_e_retomar(self):
        rc, _ = self.rodar("--pausar")
        self.assertEqual(rc, 0)
        self.assertTrue(os.path.exists(os.path.join(self.base, "PAUSAR-ATUALIZACAO")))
        rc, _ = self.rodar("--retomar")
        self.assertEqual(rc, 0)
        self.assertFalse(os.path.exists(os.path.join(self.base, "PAUSAR-ATUALIZACAO")))

    def test_estado_mostra_o_essencial(self):
        self.rodar()
        rc, saida = self.rodar("--estado")
        self.assertEqual(rc, 0, saida)
        self.assertIn("Situação: ligado", saida)
        self.assertIn(self.c1[:12], saida)
        self.assertIn("ok:" + self.c1[:12], saida)

    def test_desinstalar(self):
        self.commit_com_arquivos_do_atualizador()
        self.rodar("--instalar")
        rc, saida = self.rodar("--desinstalar")
        self.assertEqual(rc, 0, saida)
        self.assertFalse(os.path.exists(self.env["VEM_BIN"]))
        self.assertIn("disable --now vem-comer-atualizar.timer", self.chamadas())

    def test_opcao_desconhecida(self):
        rc, saida = self.rodar("--nao-existe")
        self.assertNotEqual(rc, 0)
        self.assertIn("Opção desconhecida", saida)


class ArquivosDoRepositorioTests(unittest.TestCase):
    def test_sintaxe_dos_scripts(self):
        for nome in ("atualizar-sozinho.sh", "instalar.sh", "backup.sh"):
            feito = subprocess.run(["bash", "-n", os.path.join(AQUI, nome)], capture_output=True, text=True)
            self.assertEqual(feito.returncode, 0, f"{nome}: {feito.stderr}")

    def test_relogio_aponta_para_o_script_instalado(self):
        with open(os.path.join(AQUI, "vem-comer-atualizar.service")) as f:
            servico = f.read()
        self.assertIn("ExecStart=/usr/local/sbin/vem-comer-atualizar\n", servico)
        with open(os.path.join(AQUI, "vem-comer-atualizar.timer")) as f:
            relogio = f.read()
        self.assertIn("OnUnitInactiveSec=10min", relogio)
        self.assertIn("WantedBy=timers.target", relogio)

    def test_instalador_aceita_commit_exato_e_guarda_a_versao(self):
        with open(os.path.join(AQUI, "instalar.sh")) as f:
            texto = f.read()
        self.assertIn("VEM_COMMIT", texto)
        self.assertIn("VEM_VERSION", texto)
        self.assertIn("VEM_SOB_ATUALIZADOR", texto)
        with open(os.path.join(AQUI, "docker-compose.yml")) as f:
            self.assertIn("VEM_VERSION: ${VEM_VERSION:-manual}", f.read())


if __name__ == "__main__":
    unittest.main()
