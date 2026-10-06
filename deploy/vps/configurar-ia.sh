#!/usr/bin/env bash
# Liga (ou desliga) a leitura de cardápio por foto, que usa a IA da Anthropic.
#
# A chave da IA é uma senha de conta paga. Por isso:
#   - ela é pedida AQUI, no terminal do servidor, com a digitação escondida (nada aparece na tela);
#   - não vai para o GitHub, não vai para o chat, não aparece em log nem na lista de processos;
#   - fica só no arquivo /opt/vem-comer/.env (só o root lê) e é entregue ao servidor do Vem Comer.
#
# Ligar (ou trocar a chave):
#   bash /opt/vem-comer/app/deploy/vps/configurar-ia.sh
# Desligar:
#   bash /opt/vem-comer/app/deploy/vps/configurar-ia.sh --remover
#
# Variáveis só para testes: VEM_BASE (pasta do Vem Comer), ANTHROPIC_API_URL (endereço da API).
set -Eeuo pipefail

BASE="${VEM_BASE:-/opt/vem-comer}"
APP="$BASE/app"
ENVFILE="$BASE/.env"
API_URL="${ANTHROPIC_API_URL:-https://api.anthropic.com/v1/messages}"
MODELO_TESTE="claude-haiku-4-5-20251001"

falhar() { printf '\n  PAROU: %s\n' "$*" >&2; exit 1; }
ok() { printf '  ok      %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || falhar "Rode como root."
command -v docker >/dev/null 2>&1 || falhar "O Docker não foi encontrado neste servidor."
command -v curl >/dev/null 2>&1 || falhar "O programa curl não foi encontrado neste servidor."
[ -f "$ENVFILE" ] || falhar "Não achei $ENVFILE. Rode antes o instalador do Vem Comer."
[ -f "$APP/deploy/vps/docker-compose.yml" ] || falhar "Não achei o Vem Comer instalado em $APP."

COMPOSE=(docker compose -p vemcomer --env-file "$ENVFILE" -f "$APP/deploy/vps/docker-compose.yml")

# Troca (ou tira) uma linha do .env sem deixar a chave em nenhum arquivo temporário legível.
gravar_chave() {
  local valor=$1 tmp
  tmp=$(umask 077; mktemp "$BASE/.env.XXXXXX")
  { grep -v '^ANTHROPIC_API_KEY=' "$ENVFILE" || true; } >"$tmp"
  if [ -n "$valor" ]; then
    printf 'ANTHROPIC_API_KEY=%s\n' "$valor" >>"$tmp"
  fi
  chmod 600 "$tmp"
  mv "$tmp" "$ENVFILE"
  chmod 600 "$ENVFILE"
}

reiniciar_servidor() {
  "${COMPOSE[@]}" up -d api >/dev/null
  local passado=0 estado=""
  while [ "$passado" -lt 60 ]; do
    estado=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' vemcomer-api 2>/dev/null || echo ausente)
    [ "$estado" = "healthy" ] && return 0
    sleep 2
    passado=$((passado + 2))
  done
  return 1
}

if [ "${1:-}" = "--remover" ]; then
  gravar_chave ""
  ok "chave removida do arquivo de senhas"
  reiniciar_servidor || falhar "O servidor não voltou. Veja: docker logs vemcomer-api --tail 30"
  ok "servidor reiniciado: a leitura de cardápio por foto está desligada"
  exit 0
fi
[ -z "${1:-}" ] || falhar "Opção desconhecida: $1. Use --remover ou nenhuma."

[ -t 0 ] || falhar "Rode direto no terminal: bash $APP/deploy/vps/configurar-ia.sh"

echo "Leitura de cardápio por foto (IA da Anthropic)"
echo "A chave que você colar não aparece na tela. Para desistir, aperte Ctrl+C."
echo

chave=""
tentativas=0
while :; do
  read -r -s -p "Cole a chave da IA e aperte Enter: " bruto || { echo; falhar "A entrada foi encerrada. Nada foi gravado."; }
  echo
  # teclado de celular: tira espaços, quebras de linha e aspas que vêm junto ao colar
  chave=$(printf '%s' "$bruto" | tr -d '[:space:]"'"'")
  unset bruto
  if [[ "$chave" =~ ^sk-ant-[A-Za-z0-9_-]{30,}$ ]] && [ "${#chave}" -le 300 ]; then
    break
  fi
  echo "  Isso não parece uma chave da Anthropic (ela começa com sk-ant- e é bem comprida). Tente colar de novo."
  tentativas=$((tentativas + 1))
  [ "$tentativas" -lt 4 ] || falhar "Muitas tentativas. Rode o comando de novo."
done

echo
echo "Testando a chave com uma pergunta mínima (custa uma fração de centavo)..."
corpo='{"model":"'"$MODELO_TESTE"'","max_tokens":1,"messages":[{"role":"user","content":"oi"}]}'
# A chave vai por um arquivo de configuração lido da entrada padrão: assim ela não aparece nos argumentos
# do programa (que qualquer um pode ver com ps).
codigo=$(printf 'header = "Authorization: Bearer %s"\n' "$chave" | curl -sS -K - --max-time 40 -o /dev/null -w '%{http_code}' \
  -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' \
  -X POST --data "$corpo" "$API_URL" 2>/dev/null) || codigo="000"

case "$codigo" in
  200) ok "a Anthropic aceitou a chave" ;;
  401) unset chave; falhar "A Anthropic não aceitou a chave (erro 401). Confira se copiou a chave inteira e se ela não expirou ou foi apagada. Nada foi gravado." ;;
  402|403) unset chave; falhar "A chave é válida, mas a conta não tem crédito ou permissão (erro $codigo). Coloque crédito em console.anthropic.com e rode de novo. Nada foi gravado." ;;
  429) unset chave; falhar "A Anthropic pediu para esperar (erro 429). Tente de novo em alguns minutos. Nada foi gravado." ;;
  000) unset chave; falhar "Não consegui falar com a Anthropic daqui. Veja se o servidor tem internet e tente de novo. Nada foi gravado." ;;
  *) unset chave; falhar "Resposta inesperada da Anthropic (código $codigo). Nada foi gravado." ;;
esac

gravar_chave "$chave"
unset chave
ok "chave guardada em $ENVFILE (só o root lê)"

reiniciar_servidor || falhar "O servidor não voltou. Veja: docker logs vemcomer-api --tail 30"
ok "servidor reiniciado"

ligada=$(docker exec vemcomer-api python -c "import os; print('sim' if os.getenv('ANTHROPIC_API_KEY') else 'nao')" 2>/dev/null || echo "?")
if [ "$ligada" = "sim" ]; then
  echo
  echo "Pronto: a leitura de cardápio por foto está LIGADA."
  echo "Para desligar um dia: bash $APP/deploy/vps/configurar-ia.sh --remover"
else
  falhar "A chave foi gravada, mas o servidor não a recebeu. Me avise antes de mexer em mais alguma coisa."
fi
