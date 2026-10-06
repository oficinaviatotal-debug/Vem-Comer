#!/usr/bin/env bash
# Abre, fecha ou mostra o estado do cadastro de restaurantes pela internet.
#
# O cadastro vem FECHADO. Enquanto estiver fechado, só o administrador cria restaurantes
# (deploy/vps/criar-restaurante.sh) e a página de cadastro nem aparece para o público.
#
#   Ver se está aberto:  bash /opt/vem-comer/app/deploy/vps/abrir-cadastro.sh status
#   Abrir:               bash /opt/vem-comer/app/deploy/vps/abrir-cadastro.sh abrir
#   Fechar:              bash /opt/vem-comer/app/deploy/vps/abrir-cadastro.sh fechar
#
# Abrir e fechar mexem só em uma linha do arquivo /opt/vem-comer/.env e reiniciam só o servidor
# do Vem Comer (alguns segundos fora do ar). Não mexem no banco nem nos restaurantes.
#
# Variável só para testes: VEM_BASE (pasta do Vem Comer).
set -Eeuo pipefail

BASE="${VEM_BASE:-/opt/vem-comer}"
APP="$BASE/app"
ENVFILE="$BASE/.env"

falhar() { printf '\n  PAROU: %s\n' "$*" >&2; exit 1; }
ok() { printf '  ok      %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || falhar "Rode como root."
command -v docker >/dev/null 2>&1 || falhar "O Docker não foi encontrado neste servidor."
[ -f "$ENVFILE" ] || falhar "Não achei $ENVFILE. Rode antes o instalador do Vem Comer."
[ -f "$APP/deploy/vps/docker-compose.yml" ] || falhar "Não achei o Vem Comer instalado em $APP."

COMPOSE=(docker compose -p vemcomer --env-file "$ENVFILE" -f "$APP/deploy/vps/docker-compose.yml")
dominio=$(sed -n 's/^SITE_ADDRESS=//p' "$ENVFILE" | head -1)

# Troca (ou tira) a linha SIGNUP_OPEN do .env. Valor vazio = linha removida = fechado.
gravar_abertura() {
  local valor=$1 tmp
  tmp=$(umask 077; mktemp "$BASE/.env.XXXXXX")
  { grep -v '^SIGNUP_OPEN=' "$ENVFILE" || true; } >"$tmp"
  if [ -n "$valor" ]; then
    printf 'SIGNUP_OPEN=%s\n' "$valor" >>"$tmp"
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

# Pergunta ao próprio servidor (não ao arquivo) se o cadastro está aberto: sim, nao ou ?
perguntar_ao_servidor() {
  docker exec vemcomer-api python -c "
import json, urllib.request
print('sim' if json.load(urllib.request.urlopen('http://127.0.0.1:5000/api/signup/status', timeout=5)).get('open') else 'nao')
" 2>/dev/null || echo "?"
}

mostrar_estado() {
  case "$(perguntar_ao_servidor)" in
    sim) echo "O cadastro está ABERTO: qualquer pessoa cria um restaurante em https://${dominio:-SEU.ENDERECO}/?cadastro=1" ;;
    nao) echo "O cadastro está FECHADO: só o administrador cria restaurantes." ;;
    *) echo "Não consegui perguntar ao servidor. Veja: docker logs vemcomer-api --tail 30" ;;
  esac
}

comando="${1:-}"
case "$comando" in
  status)
    mostrar_estado
    ;;

  fechar)
    gravar_abertura ""
    ok "cadastro público desligado no arquivo de configuração"
    reiniciar_servidor || falhar "O servidor não voltou. Veja: docker logs vemcomer-api --tail 30"
    ok "servidor reiniciado"
    [ "$(perguntar_ao_servidor)" = "nao" ] || falhar "O servidor ainda diz que o cadastro está aberto. Me avise."
    echo
    echo "Pronto: o cadastro está FECHADO. Para abrir de novo: bash $APP/deploy/vps/abrir-cadastro.sh abrir"
    ;;

  abrir)
    [ -t 0 ] || falhar "Rode direto no terminal: bash $APP/deploy/vps/abrir-cadastro.sh abrir"
    echo "Abrir o cadastro de restaurantes para QUALQUER pessoa da internet"
    echo
    echo "Antes de abrir, confira:"
    echo "  1) Os termos de uso e a política de privacidade foram revisados por um advogado."
    echo "     (Os textos da tela são uma versão preliminar.)"
    echo "  2) Existe um contato de suporte (e-mail ou WhatsApp) para quem quiser cancelar ou apagar os dados."
    echo "  3) Ainda NÃO existe confirmação de e-mail nem \"esqueci a senha\". Quem esquecer a senha"
    echo "     depende de você para redefinir."
    echo "  4) O limite é de poucos cadastros por rede por hora e 200 por dia no servidor todo."
    echo
    read -r -p "Para abrir, digite a palavra abrir e aperte Enter (qualquer outra coisa cancela): " resposta || resposta=""
    resposta=$(printf '%s' "$resposta" | tr -d '[:space:]' | tr 'A-Z' 'a-z')
    [ "$resposta" = "abrir" ] || { echo "Cancelado. O cadastro continua como estava."; exit 1; }
    gravar_abertura "1"
    ok "cadastro público ligado no arquivo de configuração"
    reiniciar_servidor || falhar "O servidor não voltou. Veja: docker logs vemcomer-api --tail 30"
    ok "servidor reiniciado"
    [ "$(perguntar_ao_servidor)" = "sim" ] || falhar "O servidor não registrou a abertura. Me avise antes de mexer em mais alguma coisa."
    echo
    echo "Pronto: o cadastro está ABERTO."
    echo "  Página de cadastro: https://${dominio:-SEU.ENDERECO}/?cadastro=1"
    echo "Para fechar: bash $APP/deploy/vps/abrir-cadastro.sh fechar"
    ;;

  *)
    falhar "Use: abrir-cadastro.sh status | abrir | fechar"
    ;;
esac
