#!/usr/bin/env bash
# Instala ou atualiza o Vem Comer neste servidor, em contêineres Docker próprios.
#
# Só mexe no que se chama "vemcomer" e na pasta /opt/vem-comer. Não toca no runtime
# da ChatGPT (/opt/vem-tecnologia), nos backups dela (/var/backups/vem-audit), nem em
# outros serviços. Pode rodar de novo com segurança: atualiza o código e reinicia só o
# Vem Comer. Os dados do banco ficam guardados num volume separado.
#
# Só conferir o servidor, sem mudar nada:
#   curl -fsSL https://raw.githubusercontent.com/oficinaviatotal-debug/Vem-Comer/main/deploy/vps/instalar.sh | bash -s -- --checar
#
# Instalar ou atualizar:
#   curl -fsSL https://raw.githubusercontent.com/oficinaviatotal-debug/Vem-Comer/main/deploy/vps/instalar.sh | VEM_DOMINIO=seu.endereco bash
#
# Variáveis opcionais:
#   VEM_DOMINIO  endereço do site (guardado no .env; se faltar, usa o que já está lá)
#   VEM_RAMO     ramo do GitHub a instalar (padrão: main)
#   VEM_REPO     endereço do repositório (só para testes; padrão: o do GitHub)

set -Eeuo pipefail

PASSO_ATUAL="início"

passo() { PASSO_ATUAL="$2"; printf '\n[%s] %s\n' "$1" "$2"; }
ok() { printf '  ok      %s\n' "$*"; }
aviso() { printf '  ATENÇÃO %s\n' "$*"; }
falhar() { printf '\n  PAROU: %s\n  Nada do runtime da ChatGPT foi tocado.\n' "$*" >&2; exit 1; }

gerar_segredo() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

dominio_valido() {
  # letras minúsculas, números, pontos e hífens; precisa ter pelo menos um ponto
  [[ "$1" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] && [[ "$1" == *.* ]] && [[ "$1" != *..* ]]
}

esperar_saudavel() {
  local nome=$1 limite=$2 passado=0 estado=""
  while [ "$passado" -lt "$limite" ]; do
    estado=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$nome" 2>/dev/null || echo ausente)
    [ "$estado" = "healthy" ] && return 0
    sleep 2
    passado=$((passado + 2))
  done
  return 1
}

main() {
  exec 0</dev/null # nada aqui dentro pode ler o próprio script pela entrada padrão

  local BASE=/opt/vem-comer
  local APP="$BASE/app"
  local ENVFILE="$BASE/.env"
  local REPO="${VEM_REPO:-https://github.com/oficinaviatotal-debug/Vem-Comer.git}"
  local RAMO="${VEM_RAMO:-main}"
  local BACKUPS=/var/backups/vem-comer
  local SO_CHECAR=0

  case "${1:-}" in
    --checar) SO_CHECAR=1 ;;
    "") ;;
    *) falhar "Opção desconhecida: $1. Use --checar ou nenhuma." ;;
  esac

  trap 'printf "\n  PAROU no passo: %s (linha %s).\n  Nada do runtime da ChatGPT foi tocado. Tire um print desta tela.\n" "$PASSO_ATUAL" "$LINENO" >&2' ERR

  # ---------------------------------------------------------------- 1
  passo 1 "Conferindo o servidor"
  [ "$(id -u)" -eq 0 ] || falhar "Rode como root."

  local faltando=""
  local cmd
  for cmd in docker git curl ss ip getent awk od df seq install systemctl; do
    command -v "$cmd" >/dev/null 2>&1 || faltando="$faltando $cmd"
  done
  [ -z "$faltando" ] || falhar "Faltam estes programas:$faltando"

  docker info >/dev/null 2>&1 || falhar "O Docker está instalado, mas não responde."
  docker compose version >/dev/null 2>&1 || falhar "Falta o Docker Compose (plugin 'docker compose')."
  ok "Docker $(docker version -f '{{.Server.Version}}' 2>/dev/null || echo '?') e Compose funcionando"

  local raiz_docker livre_mb mem_mb
  raiz_docker=$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)
  livre_mb=$(df -Pm "$raiz_docker" 2>/dev/null | awk 'NR==2 {print $4}')
  [ "${livre_mb:-0}" -ge 6000 ] || falhar "Pouco espaço livre (${livre_mb:-0} MB). Preciso de pelo menos 6000 MB."
  ok "espaço livre: ${livre_mb} MB"

  mem_mb=$(awk '/MemAvailable/ {print int($2 / 1024)}' /proc/meminfo)
  if [ "${mem_mb:-0}" -lt 1500 ]; then
    aviso "pouca memória livre (${mem_mb} MB); a montagem do site pode demorar ou falhar"
  else
    ok "memória livre: ${mem_mb} MB"
  fi

  # Endereço do site
  local dominio="${VEM_DOMINIO:-}"
  if [ -z "$dominio" ] && [ -f "$ENVFILE" ]; then
    dominio=$(sed -n 's/^SITE_ADDRESS=//p' "$ENVFILE" | head -1)
  fi
  if [ -z "$dominio" ]; then
    dominio=$(hostname -f 2>/dev/null || true)
  fi
  dominio=$(printf '%s' "$dominio" | tr 'A-Z' 'a-z')
  if ! dominio_valido "$dominio"; then
    if [ -n "${VEM_DOMINIO:-}" ]; then
      falhar "O endereço informado não é válido. Use só letras, números, pontos e hífens (ex.: meurestaurante.com.br)."
    fi
    falhar "Não sei qual endereço usar. Rode de novo com VEM_DOMINIO=seu.endereco"
  fi
  ok "endereço do site: $dominio"

  # DNS: o endereço precisa apontar para este servidor, senão o HTTPS não sai
  local ip_local ip_dns
  ip_local=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") {print $(i + 1); exit}}' || true)
  ip_dns=$(getent ahostsv4 "$dominio" 2>/dev/null | awk 'NR==1 {print $1}' || true)
  if [ -z "$ip_dns" ]; then
    aviso "o endereço $dominio ainda não aponta para nenhum servidor (DNS)"
  elif [ -n "$ip_local" ] && [ "$ip_dns" != "$ip_local" ]; then
    aviso "o endereço $dominio aponta para $ip_dns, mas este servidor é $ip_local"
  else
    ok "o endereço aponta para este servidor ($ip_dns)"
  fi

  # Portas 80 e 443: precisam estar livres (ou já ser do próprio Vem Comer, numa atualização)
  local porta
  local web_ativo
  web_ativo=$(docker ps -q --filter name='^vemcomer-web$' --filter status=running 2>/dev/null || true)
  for porta in 80 443; do
    if [ -z "$web_ativo" ] && ss -tlnH "sport = :$porta" 2>/dev/null | grep -q .; then
      falhar "A porta $porta já está em uso por outro programa. Não vou mexer nele."
    fi
  done
  ok "portas 80 e 443 disponíveis para o Vem Comer"

  echo "  Já existe aqui e NÃO será tocado:"
  [ -d /opt/vem-tecnologia ] && echo "    - /opt/vem-tecnologia (runtime da ChatGPT)"
  [ -d /var/backups/vem-audit ] && echo "    - /var/backups/vem-audit (backups dela)"
  systemctl is-active --quiet vem-tecnologia-runtime 2>/dev/null && echo "    - serviço vem-tecnologia-runtime (rodando)"
  docker ps -a --format '    - contêiner {{.Names}}' 2>/dev/null | grep -v 'contêiner vemcomer-' || true

  if [ "$SO_CHECAR" -eq 1 ]; then
    printf '\nConferência terminou. Nada foi alterado.\n'
    return 0
  fi

  # ---------------------------------------------------------------- 2
  passo 2 "Baixando o código ($RAMO)"
  install -d -m 755 "$BASE"
  if [ -d "$APP/.git" ]; then
    git -C "$APP" fetch --quiet origin "$RAMO"
    git -C "$APP" checkout --quiet -f -B "$RAMO" "origin/$RAMO"
  else
    [ ! -e "$APP" ] || falhar "A pasta $APP existe mas não é uma cópia do Vem Comer. Não vou apagar."
    git clone --quiet --branch "$RAMO" "$REPO" "$APP"
  fi
  ok "código em $APP ($(git -C "$APP" rev-parse --short HEAD))"

  local COMPOSE=(docker compose -p vemcomer --env-file "$ENVFILE" -f "$APP/deploy/vps/docker-compose.yml")

  # ---------------------------------------------------------------- 3
  passo 3 "Arquivo de senhas"
  if [ -f "$ENVFILE" ]; then
    grep -q '^POSTGRES_PASSWORD=.' "$ENVFILE" && grep -q '^SECRET_KEY=.' "$ENVFILE" \
      || falhar "O arquivo $ENVFILE existe, mas está incompleto. Não vou inventar senhas por cima."
    local atual
    atual=$(sed -n 's/^SITE_ADDRESS=//p' "$ENVFILE" | head -1)
    if [ "$atual" != "$dominio" ]; then
      local tmp
      tmp=$(mktemp "$BASE/.env.XXXXXX")
      { grep -v '^SITE_ADDRESS=' "$ENVFILE" || true; echo "SITE_ADDRESS=$dominio"; } >"$tmp"
      mv "$tmp" "$ENVFILE"
      ok "endereço do site atualizado para $dominio"
    else
      ok "mantido o arquivo de senhas que já existe"
    fi
  else
    if docker volume inspect vemcomer_pgdata >/dev/null 2>&1; then
      falhar "Já existe um banco do Vem Comer aqui, mas não há arquivo de senhas. Não vou apagar nada. Me avise."
    fi
    (
      umask 077
      {
        echo "SITE_ADDRESS=$dominio"
        echo "POSTGRES_PASSWORD=$(gerar_segredo)"
        echo "SECRET_KEY=$(gerar_segredo)"
      } >"$ENVFILE"
    )
    ok "senhas geradas ao acaso e guardadas em $ENVFILE (só o root lê)"
  fi
  chmod 600 "$ENVFILE"

  "${COMPOSE[@]}" config -q
  ok "configuração conferida"

  # ---------------------------------------------------------------- 4
  passo 4 "Montando o site e o servidor (alguns minutos)"
  "${COMPOSE[@]}" build --quiet
  ok "imagens prontas"

  # ---------------------------------------------------------------- 5
  passo 5 "Banco de dados"
  "${COMPOSE[@]}" up -d db
  esperar_saudavel vemcomer-db 90 || falhar "O banco não ficou pronto. Veja: docker logs vemcomer-db --tail 30"
  ok "banco no ar"

  psql_vc() { docker exec -i -e 'PGOPTIONS=-c client_min_messages=warning' vemcomer-db psql -U vemcomer -d vemcomer -v ON_ERROR_STOP=1 -q "$@"; }

  local tem
  tem=$(psql_vc -tA -c "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'companies'")
  if [ "$tem" = "0" ]; then
    # \restrict / \unrestrict são comandos de segurança do pg_dump; o psql do contêiner pode não conhecê-los
    grep -vE '^\\(un)?restrict ' "$APP/database/schema.production.sql" | psql_vc >/dev/null
    ok "tabelas criadas"
  else
    ok "tabelas já existiam (dados mantidos)"
  fi

  local arq
  for arq in "$APP"/database/migrations/*.sql; do
    case "$(basename "$arq")" in 001_*) continue ;; esac # 001 carrega o schema de desenvolvimento
    psql_vc >/dev/null <"$arq"
  done
  ok "atualizações do banco aplicadas"

  # ---------------------------------------------------------------- 6
  passo 6 "Servidor e HTTPS"
  "${COMPOSE[@]}" up -d api web
  esperar_saudavel vemcomer-api 90 || falhar "O servidor não ficou pronto. Veja: docker logs vemcomer-api --tail 30"
  ok "servidor no ar"

  # ---------------------------------------------------------------- 7
  passo 7 "Backup diário e teste de restauração"
  install -d -m 700 "$BACKUPS"
  install -m 644 "$APP/deploy/vps/vem-comer-backup.service" /etc/systemd/system/vem-comer-backup.service
  install -m 644 "$APP/deploy/vps/vem-comer-backup.timer" /etc/systemd/system/vem-comer-backup.timer
  systemctl daemon-reload
  systemctl enable --now vem-comer-backup.timer >/dev/null 2>&1
  ok "backup agendado todo dia às 03:30 (Brasília)"
  bash "$APP/deploy/vps/backup.sh"
  bash "$APP/deploy/vps/restaurar-teste.sh"

  # ---------------------------------------------------------------- 8
  passo 8 "Teste de fora (HTTPS)"
  local i publico=0
  for i in $(seq 1 36); do
    if curl -fsS --max-time 10 "https://$dominio/api/health" 2>/dev/null | grep -Eq '"status": ?"ok"'; then
      publico=1
      break
    fi
    sleep 5
  done

  if [ "$publico" -eq 1 ]; then
    ok "https://$dominio/api/health respondeu"
    local codigo
    codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "https://$dominio/api/auth/register-company" || true)
    if [ "$codigo" = "404" ]; then
      ok "cadastro público de restaurante está fechado (como deve ser)"
    else
      aviso "o cadastro público respondeu $codigo; era para ser 404. Me avise."
    fi
    printf '\nPRONTO. Abra: https://%s\n' "$dominio"
    printf 'Para cadastrar o primeiro restaurante:\n  bash %s/deploy/vps/criar-restaurante.sh\n' "$APP"
  else
    aviso "o servidor está rodando por dentro, mas https://$dominio ainda não responde de fora."
    echo "  Causas mais comuns:"
    echo "   1) as portas 80 e 443 não estão liberadas no firewall da Hostinger"
    echo "   2) o endereço $dominio ainda não aponta para este servidor"
    echo "  Últimas linhas do porteiro (Caddy):"
    docker logs vemcomer-web --tail 12 2>&1 | cut -c1-160 || true
    echo "  Depois de corrigir, rode o mesmo comando de novo."
  fi
}

main "$@"
