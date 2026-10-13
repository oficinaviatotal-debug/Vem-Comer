#!/usr/bin/env bash
# Atualizador automático do Vem Comer neste servidor.
#
# Você roda UM comando, UMA vez (veja "Instalar" abaixo). Daí em diante, a cada ~10 minutos o
# servidor confere se o GitHub tem uma versão nova do ramo main e só a coloca no ar se:
#   1) todos os testes automáticos dessa versão estão VERDES (mínimo de 5 conferências);
#   2) o backup do banco e das fotos, feito antes, deu certo.
# Depois de instalar, ele confere de fora (https://seu.endereco/api/health) que o site subiu NA versão nova.
# Se não subiu, volta sozinho para a versão anterior e anota a versão ruim para não tentar de novo.
#
# Nada é apagado: o banco fica no volume do Docker, os backups em /var/backups/vem-comer.
# Só mexe no Vem Comer ("vemcomer", /opt/vem-comer). Não toca no runtime da ChatGPT.
#
# Instalar (uma vez, como root, no servidor):
#   curl -fsSL https://raw.githubusercontent.com/oficinaviatotal-debug/Vem-Comer/main/deploy/vps/atualizar-sozinho.sh | bash -s -- --instalar
#
# Depois, para olhar / controlar (já instalado):
#   vem-comer-atualizar --estado      mostra o que está no ar, o último ciclo e o fim do registro
#   vem-comer-atualizar --pausar      para de atualizar sozinho (cria /opt/vem-comer/PAUSAR-ATUALIZACAO)
#   vem-comer-atualizar --retomar     volta a atualizar sozinho
#   vem-comer-atualizar               roda um ciclo agora (é o que o relógio faz a cada 10 minutos)
#   vem-comer-atualizar --desinstalar tira o relógio (o site continua como está)
#
# Variáveis (só para testes; o normal é não mexer): VEM_BASE, VEM_REPO, VEM_RAMO, VEM_CI_URL, VEM_CI_MINIMO,
# VEM_ESTADO_DIR, VEM_LOG, VEM_BIN, VEM_UNIT_DIR, VEM_ESPERA, VEM_TENTATIVAS_SAUDE.

set -Eeuo pipefail

BASE="${VEM_BASE:-/opt/vem-comer}"
APP="$BASE/app"
ENVFILE="$BASE/.env"
REPO="${VEM_REPO:-https://github.com/oficinaviatotal-debug/Vem-Comer.git}"
RAMO="${VEM_RAMO:-main}"
CI_URL="${VEM_CI_URL:-https://api.github.com/repos/oficinaviatotal-debug/Vem-Comer/commits}"
CI_MINIMO="${VEM_CI_MINIMO:-5}"
ESTADO_DIR="${VEM_ESTADO_DIR:-/var/lib/vem-comer}"
LOG="${VEM_LOG:-/var/log/vem-comer-atualizar.log}"
BIN="${VEM_BIN:-/usr/local/sbin/vem-comer-atualizar}"
UNIT_DIR="${VEM_UNIT_DIR:-/etc/systemd/system}"
LOCK="${VEM_LOCK:-/var/lock/vem-comer-atualizar.lock}"
PAUSA="$BASE/PAUSAR-ATUALIZACAO"
ESPERA="${VEM_ESPERA:-5}"
TENTATIVAS_SAUDE="${VEM_TENTATIVAS_SAUDE:-36}"
FALHAS_MAXIMAS=3
TMP_INSTALAR=""

log() {
  local linha
  linha="$(date '+%Y-%m-%d %H:%M:%S') $*"
  printf '%s\n' "$linha"
  printf '%s\n' "$linha" >>"$LOG" 2>/dev/null || true
}

curto() { printf '%s' "${1:0:12}"; }
sha_valido() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }

# Anota o estado atual (uma frase). Só escreve no registro quando a frase muda, para não encher o arquivo.
registrar() {
  local anterior=""
  [ -f "$ESTADO_DIR/estado.txt" ] && anterior=$(cat "$ESTADO_DIR/estado.txt")
  if [ "$anterior" != "$*" ]; then
    printf '%s\n' "$*" >"$ESTADO_DIR/estado.txt"
    log "$*"
  fi
}

dominio_do_site() { sed -n 's/^SITE_ADDRESS=//p' "$ENVFILE" 2>/dev/null | head -1; }

# "fora" ou "ok:<versão>" (versão "?" se o servidor ainda não informa)
saude_publica() {
  local dominio=$1 corpo versao
  [ -n "$dominio" ] || { echo fora; return 0; }
  corpo=$(curl -fsS --max-time 10 "https://$dominio/api/health" 2>/dev/null) || { echo fora; return 0; }
  printf '%s' "$corpo" | grep -Eq '"status": ?"ok"' || { echo fora; return 0; }
  versao=$(printf '%s' "$corpo" | grep -oE '"version": ?"[^"]*"' | head -1 | cut -d'"' -f4 || true)
  echo "ok:${versao:-?}"
}

api_saudavel() {
  [ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' vemcomer-api 2>/dev/null || echo ausente)" = healthy ]
}

# Espera o site responder de fora; se $2 não for vazio, exige também essa versão.
esperar_publico() {
  local dominio=$1 versao=${2:-} i atual
  for i in $(seq 1 "$TENTATIVAS_SAUDE"); do
    atual=$(saude_publica "$dominio")
    if [ "${atual%%:*}" = ok ] && { [ -z "$versao" ] || [ "${atual#ok:}" = "$versao" ]; }; then
      return 0
    fi
    sleep "$ESPERA"
  done
  return 1
}

# verde | esperando | poucos:N | vermelho | indisponivel
ci_estado() {
  local sha=$1 corpo total n_status pendentes ruins
  corpo=$(curl -fsSL --max-time 20 -H 'Accept: application/vnd.github+json' -H 'User-Agent: vem-comer-atualizador' \
    "$CI_URL/$sha/check-runs?per_page=100" 2>/dev/null) || { echo indisponivel; return 0; }
  total=$(printf '%s' "$corpo" | grep -oE '"total_count": *[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
  [[ "$total" =~ ^[0-9]+$ ]] || { echo indisponivel; return 0; }
  if [ "$total" -gt 100 ]; then echo indisponivel; return 0; fi
  n_status=$(printf '%s' "$corpo" | grep -oE '"status": *"[a-z_]+"' | grep -c . || true)
  [ "$n_status" -eq "$total" ] || { echo indisponivel; return 0; }
  pendentes=$(printf '%s' "$corpo" | grep -oE '"status": *"[a-z_]+"' | grep -vc '"completed"' || true)
  if [ "$total" -lt "$CI_MINIMO" ]; then
    # pode ser que as conferências ainda nem tenham começado
    echo "poucos:$total"
    return 0
  fi
  if [ "$pendentes" -gt 0 ]; then echo esperando; return 0; fi
  ruins=$(printf '%s' "$corpo" | grep -oE '"conclusion": *"[a-z_]+"' | grep -Evc '"(success|skipped|neutral)"' || true)
  if [ "$ruins" -gt 0 ]; then echo vermelho; else echo verde; fi
}

contar_falha() {
  local sha=$1 motivo=$2 n=0 arq="$ESTADO_DIR/falhas"
  if [ -f "$arq" ] && [ "$(cut -d' ' -f1 "$arq")" = "$sha" ]; then
    n=$(cut -d' ' -f2 "$arq")
  fi
  n=$((n + 1))
  if [ "$n" -ge "$FALHAS_MAXIMAS" ]; then
    printf '%s %s\n' "$sha" "$motivo" >"$ESTADO_DIR/ruim"
    rm -f "$arq"
    registrar "versão $(curto "$sha") PARADA depois de $n tentativas sem sucesso ($motivo). O site segue na versão anterior. Espero a próxima versão."
  else
    printf '%s %s\n' "$sha" "$n" >"$arq"
    registrar "versão $(curto "$sha") não foi instalada ($motivo); o site segue na versão anterior. Tentativa $n de $FALHAS_MAXIMAS; tento de novo no próximo ciclo."
  fi
}

somente_documentacao() {
  # recebe a lista de arquivos alterados (um por linha); verdadeiro se nada ali muda o site no ar
  local arquivo
  while IFS= read -r arquivo; do
    case "$arquivo" in
      docs/* | tests/* | .github/* | *.md | .gitignore) ;;
      *) return 1 ;;
    esac
  done <<<"$1"
  return 0
}

voltar_versao() {
  # $1 = commit para onde voltar
  local alvo=$1
  local compose=(docker compose -p vemcomer --env-file "$ENVFILE" -f "$APP/deploy/vps/docker-compose.yml")
  git -C "$APP" checkout --quiet -f -B "$RAMO" "$alvo" >>"$LOG" 2>&1 || return 1
  export VEM_VERSION
  VEM_VERSION=$(curto "$alvo")
  local tmpv
  tmpv=$(mktemp "$BASE/.env.XXXXXX")
  { grep -v '^VEM_VERSION=' "$ENVFILE" || true; echo "VEM_VERSION=$VEM_VERSION"; } >"$tmpv"
  chmod 600 "$tmpv"
  mv "$tmpv" "$ENVFILE"
  "${compose[@]}" build --quiet >>"$LOG" 2>&1 || return 1
  "${compose[@]}" up -d db api web >>"$LOG" 2>&1 || return 1
  return 0
}

atualizar_a_si_mesmo() {
  # Depois de uma atualização que deu certo, copia a versão nova deste script e dos agendadores.
  local origem="$APP/deploy/vps" mudou=0 u
  if [ -f "$origem/atualizar-sozinho.sh" ] && ! cmp -s "$origem/atualizar-sozinho.sh" "$BIN"; then
    if bash -n "$origem/atualizar-sozinho.sh"; then
      install -m 755 "$origem/atualizar-sozinho.sh" "$BIN.novo" && mv -f "$BIN.novo" "$BIN"
      log "atualizador renovado (nova versão do próprio script)"
    fi
  fi
  for u in vem-comer-atualizar.service vem-comer-atualizar.timer; do
    if [ -f "$origem/$u" ] && ! cmp -s "$origem/$u" "$UNIT_DIR/$u"; then
      install -m 644 "$origem/$u" "$UNIT_DIR/$u"
      mudou=1
    fi
  done
  if [ "$mudou" -eq 1 ]; then systemctl daemon-reload || true; fi
}

# ------------------------------------------------------------------------------------ um ciclo
ciclo() {
  install -d -m 755 "$ESTADO_DIR"
  # registro com no máximo ~1 MB: guarda só o final
  if [ -f "$LOG" ] && [ "$(wc -c <"$LOG")" -gt 1048576 ]; then
    tail -n 2000 "$LOG" >"$LOG.tmp" && mv -f "$LOG.tmp" "$LOG"
  fi
  date '+%Y-%m-%d %H:%M:%S' >"$ESTADO_DIR/ultima-checagem"

  exec 9>"$LOCK"
  flock -n 9 || { echo "outra atualização está rodando; saio."; return 0; }

  if [ -e "$PAUSA" ]; then
    registrar "pausado (arquivo $PAUSA existe). Para voltar: vem-comer-atualizar --retomar"
    return 0
  fi
  if [ -f "$ESTADO_DIR/emergencia" ]; then
    registrar "EMERGÊNCIA registrada em $(cat "$ESTADO_DIR/emergencia" | head -1): não atualizo mais sozinho até alguém olhar. Depois: rm $ESTADO_DIR/emergencia"
    return 1
  fi
  [ -d "$APP/.git" ] || { registrar "o Vem Comer ainda não está instalado aqui; nada a atualizar"; return 0; }

  local remoto ok_sha ruim_sha
  remoto=$(git ls-remote "$REPO" "refs/heads/$RAMO" 2>/dev/null | awk 'NR==1 {print $1}' || true)
  if ! sha_valido "$remoto"; then
    registrar "não consegui falar com o GitHub agora; tento no próximo ciclo"
    return 0
  fi
  ok_sha=$(cat "$ESTADO_DIR/ultimo-ok" 2>/dev/null || true)
  if [ "$remoto" = "$ok_sha" ]; then
    registrar "em dia: versão $(curto "$remoto")"
    return 0
  fi
  ruim_sha=$(cut -d' ' -f1 "$ESTADO_DIR/ruim" 2>/dev/null || true)
  if [ "$remoto" = "$ruim_sha" ]; then
    registrar "versão $(curto "$remoto") já falhou antes e foi posta de lado; espero uma versão mais nova"
    return 0
  fi

  local ci
  ci=$(ci_estado "$remoto")
  case "$ci" in
    verde) ;;
    esperando) registrar "versão $(curto "$remoto") nova: aguardando os testes automáticos terminarem"; return 0 ;;
    poucos:*) registrar "versão $(curto "$remoto") nova: só ${ci#poucos:} testes automáticos apareceram (mínimo $CI_MINIMO); aguardando"; return 0 ;;
    vermelho) registrar "versão $(curto "$remoto") tem teste automático VERMELHO; não instalo. Espero a correção"; return 0 ;;
    *) registrar "não consegui consultar os testes automáticos no GitHub agora; tento no próximo ciclo"; return 0 ;;
  esac

  local head_antes anterior dominio pre
  head_antes=$(git -C "$APP" rev-parse HEAD)
  anterior="$ok_sha"
  sha_valido "$anterior" || anterior="$head_antes"
  dominio=$(dominio_do_site)

  # O que está no ar tem que estar respondendo, senão não dá para saber se a versão nova funciona.
  # (Exceção: se o servidor interno está quebrado, uma versão nova pode ser justamente o conserto.)
  pre=$(saude_publica "$dominio")
  if [ "$pre" = fora ] && api_saudavel; then
    registrar "versão $(curto "$remoto") pronta, mas o site não responde de fora (HTTPS/DNS) apesar de o servidor estar bem por dentro; não atualizo até isso ser corrigido"
    return 0
  fi

  # busca o código sem mexer no que está rodando
  if ! git -C "$APP" fetch --quiet origin "$RAMO" >>"$LOG" 2>&1 || ! git -C "$APP" cat-file -e "$remoto^{commit}" 2>/dev/null; then
    registrar "não consegui baixar a versão $(curto "$remoto"); tento no próximo ciclo"
    return 0
  fi

  # Mudou só documentação/testes desde a última versão CONFIRMADA no ar? Então o site já é igual: não reinicia nada.
  # (A comparação é com a última versão confirmada, não com a pasta do servidor, que pode estar no meio de uma
  # atualização interrompida.)
  local mudados
  if sha_valido "$ok_sha" && mudados=$(git -C "$APP" diff --name-only "$ok_sha" "$remoto" 2>/dev/null) \
    && { [ -z "$mudados" ] || somente_documentacao "$mudados"; }; then
    printf '%s\n' "$remoto" >"$ESTADO_DIR/ultimo-ok"
    rm -f "$ESTADO_DIR/falhas"
    registrar "versão $(curto "$remoto") só muda documentação/testes; o site no ar continua igual (nada reiniciado)"
    return 0
  fi

  log "Atualizando: $(curto "$head_antes") → $(curto "$remoto") (testes automáticos verdes)"

  if ! bash "$APP/deploy/vps/backup.sh" >>"$LOG" 2>&1; then
    contar_falha "$remoto" "o backup antes da atualização falhou"
    return 0
  fi
  log "backup antes da atualização: ok"

  local tmp rc=0
  tmp=$(mktemp -d)
  # roda uma CÓPIA do instalador da versão nova: o git vai trocar os arquivos do repositório durante a instalação
  if ! git -C "$APP" show "$remoto:deploy/vps/instalar.sh" >"$tmp/instalar.sh" 2>/dev/null; then
    rm -rf "$tmp"
    contar_falha "$remoto" "a versão não tem o instalador"
    return 0
  fi
  VEM_SOB_ATUALIZADOR=1 VEM_COMMIT="$remoto" VEM_RAMO="$RAMO" VEM_REPO="$REPO" \
    bash "$tmp/instalar.sh" >>"$LOG" 2>&1 </dev/null || rc=$?
  rm -rf "$tmp"

  if esperar_publico "$dominio" "$(curto "$remoto")"; then
    [ "$rc" -eq 0 ] || log "aviso: o instalador terminou com código $rc, mas o site já responde na versão nova (provável falha só no backup depois da instalação; veja o registro)"
    printf '%s\n' "$remoto" >"$ESTADO_DIR/ultimo-ok"
    rm -f "$ESTADO_DIR/falhas"
    atualizar_a_si_mesmo
    registrar "ATUALIZADO: o site está no ar na versão $(curto "$remoto"), conferido de fora"
    return 0
  fi

  # Não subiu na versão nova.
  local head_agora
  head_agora=$(git -C "$APP" rev-parse HEAD 2>/dev/null || true)
  if [ "$head_agora" = "$head_antes" ] && [ "$(saude_publica "$dominio")" != fora ]; then
    # o instalador parou antes de mexer em qualquer coisa (falta de espaço/memória, por exemplo)
    contar_falha "$remoto" "o instalador parou antes de começar (código $rc)"
    return 0
  fi

  log "A versão $(curto "$remoto") NÃO subiu corretamente (instalador: código $rc). Voltando para $(curto "$anterior")."
  if voltar_versao "$anterior" && esperar_publico "$dominio" ""; then
    printf '%s volta-automatica\n' "$remoto" >"$ESTADO_DIR/ruim"
    rm -f "$ESTADO_DIR/falhas"
    registrar "REVERTIDO: a versão $(curto "$remoto") não subiu; voltei para $(curto "$anterior") e o site responde. A versão ruim foi posta de lado."
    return 0
  fi

  printf '%s versão %s não subiu e a volta para %s também falhou\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$(curto "$remoto")" "$(curto "$anterior")" >"$ESTADO_DIR/emergencia"
  registrar "EMERGÊNCIA: a versão $(curto "$remoto") não subiu e não consegui voltar para $(curto "$anterior"). Avise o Claude e mostre: vem-comer-atualizar --estado"
  return 1
}

# ------------------------------------------------------------------------------------ comandos
exigir_root() { [ "$(id -u)" -eq 0 ] || { echo "Rode como root." >&2; exit 1; }; }

instalar_agora() {
  exigir_root
  local faltando="" cmd
  for cmd in docker git curl flock systemctl install cmp; do
    command -v "$cmd" >/dev/null 2>&1 || faltando="$faltando $cmd"
  done
  [ -z "$faltando" ] || { echo "Faltam estes programas:$faltando" >&2; exit 1; }
  [ -d "$APP/.git" ] || { echo "O Vem Comer ainda não foi instalado aqui ($APP não existe). Rode primeiro o comando de instalação do site (instalar.sh)." >&2; exit 1; }

  local arq
  TMP_INSTALAR=$(mktemp -d)
  trap 'rm -rf "${TMP_INSTALAR:-}"' EXIT
  local tmp=$TMP_INSTALAR
  git -C "$APP" fetch --quiet origin "$RAMO"
  for arq in atualizar-sozinho.sh vem-comer-atualizar.service vem-comer-atualizar.timer; do
    git -C "$APP" show "FETCH_HEAD:deploy/vps/$arq" >"$tmp/$arq" 2>/dev/null \
      || { echo "O GitHub ($RAMO) ainda não tem deploy/vps/$arq." >&2; exit 1; }
  done
  bash -n "$tmp/atualizar-sozinho.sh" || { echo "O script baixado está com erro de sintaxe; não instalei." >&2; exit 1; }

  install -d -m 755 "$ESTADO_DIR"
  install -d -m 755 "$(dirname "$BIN")" "$UNIT_DIR"
  install -m 755 "$tmp/atualizar-sozinho.sh" "$BIN"
  install -m 644 "$tmp/vem-comer-atualizar.service" "$UNIT_DIR/vem-comer-atualizar.service"
  install -m 644 "$tmp/vem-comer-atualizar.timer" "$UNIT_DIR/vem-comer-atualizar.timer"
  systemctl daemon-reload
  systemctl enable --now vem-comer-atualizar.timer >/dev/null 2>&1

  # ponto de partida: o que está no ar agora, se estiver respondendo
  local dominio estado_site
  dominio=$(dominio_do_site)
  estado_site=$(saude_publica "$dominio")
  if [ ! -s "$ESTADO_DIR/ultimo-ok" ] && [ "${estado_site%%:*}" = ok ]; then
    git -C "$APP" rev-parse HEAD >"$ESTADO_DIR/ultimo-ok"
  fi

  printf '\nPRONTO. O servidor passa a conferir o GitHub a cada ~10 minutos.\n'
  printf '  Site agora: %s\n' "$estado_site"
  printf '  Ver o que está acontecendo:  vem-comer-atualizar --estado\n'
  printf '  Parar de atualizar sozinho:  vem-comer-atualizar --pausar\n'
  printf '  A primeira conferência acontece em ~2 minutos.\n'
}

desinstalar() {
  exigir_root
  systemctl disable --now vem-comer-atualizar.timer >/dev/null 2>&1 || true
  rm -f "$UNIT_DIR/vem-comer-atualizar.timer" "$UNIT_DIR/vem-comer-atualizar.service" "$BIN"
  systemctl daemon-reload || true
  echo "Atualizador removido. O site continua como está. O histórico fica em $ESTADO_DIR e $LOG."
}

mostrar_estado() {
  exigir_root
  local dominio ok ruim
  dominio=$(dominio_do_site)
  echo "== Atualizador do Vem Comer =="
  if [ -e "$PAUSA" ]; then echo "Situação: PAUSADO (vem-comer-atualizar --retomar para voltar)"; else echo "Situação: ligado"; fi
  [ -f "$ESTADO_DIR/emergencia" ] && echo "EMERGÊNCIA: $(head -1 "$ESTADO_DIR/emergencia")"
  echo "Último estado: $(cat "$ESTADO_DIR/estado.txt" 2>/dev/null || echo 'ainda nenhum')"
  echo "Última conferência: $(cat "$ESTADO_DIR/ultima-checagem" 2>/dev/null || echo 'nunca')"
  ok=$(cat "$ESTADO_DIR/ultimo-ok" 2>/dev/null || true)
  echo "Última versão confirmada no ar: ${ok:+$(curto "$ok")}${ok:-nenhuma ainda}"
  ruim=$(cat "$ESTADO_DIR/ruim" 2>/dev/null || true)
  [ -n "$ruim" ] && echo "Versão posta de lado: $(curto "${ruim%% *}") (${ruim#* })"
  echo "Site (de fora): $(saude_publica "$dominio")"
  if command -v systemctl >/dev/null 2>&1; then
    echo "Relógio: $(systemctl is-active vem-comer-atualizar.timer 2>/dev/null || true)"
  fi
  echo "-- fim do registro ($LOG) --"
  tail -n 12 "$LOG" 2>/dev/null || true
}

main() {
  exec 0</dev/null # nada aqui dentro pode ler o próprio script pela entrada padrão (importante com curl | bash)
  [[ "$RAMO" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || { echo "VEM_RAMO inválido." >&2; exit 1; }
  [[ "$REPO" =~ ^(https://|file:///)[A-Za-z0-9._~:/@%+-]+$ ]] || { echo "VEM_REPO inválido." >&2; exit 1; }

  case "${1:-}" in
    "" | --agora)
      exigir_root
      install -d -m 755 "$ESTADO_DIR"
      ciclo
      ;;
    --instalar) instalar_agora ;;
    --desinstalar) desinstalar ;;
    --estado) mostrar_estado ;;
    --pausar)
      exigir_root
      : >"$PAUSA"
      echo "Pausado: não vou atualizar sozinho. Para voltar: vem-comer-atualizar --retomar"
      ;;
    --retomar)
      exigir_root
      rm -f "$PAUSA"
      echo "Retomado: volto a conferir o GitHub a cada ~10 minutos."
      ;;
    *)
      echo "Opção desconhecida: $1. Use --instalar, --estado, --pausar, --retomar, --agora ou --desinstalar." >&2
      exit 1
      ;;
  esac
}

main "$@"
