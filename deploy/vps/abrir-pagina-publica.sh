#!/usr/bin/env bash
# Liga, desliga ou mostra o estado da PÁGINA PÚBLICA dos restaurantes (/r/<restaurante>).
#
# É a página que o dono manda no WhatsApp: cardápio legível, prévia bonita do link e QR Code. Vem DESLIGADA.
# Enquanto estiver desligada, /r/..., /robots.txt e /sitemap.xml respondem 404, como se não existissem.
#
# Três degraus, cada um com a sua palavra (nenhum liga sozinho):
#
#   Ver o estado:                  bash /opt/vem-comer/app/deploy/vps/abrir-pagina-publica.sh status
#   1) Abrir a página e a prévia:  bash /opt/vem-comer/app/deploy/vps/abrir-pagina-publica.sh abrir
#        Quem tem o link vê a página e o WhatsApp mostra a prévia. O Google é avisado para NÃO guardar.
#   2) Convidar o Google:          bash /opt/vem-comer/app/deploy/vps/abrir-pagina-publica.sh google
#        Só entra no Google o restaurante cujo DONO tocou em "Aparecer no Google" (padrão: ninguém).
#   Desligar tudo:                 bash /opt/vem-comer/app/deploy/vps/abrir-pagina-publica.sh fechar
#
# Cada comando mexe só em duas linhas do arquivo /opt/vem-comer/.env (PUBLIC_PAGE_OPEN e PUBLIC_PAGE_INDEX) e
# reinicia só o servidor do Vem Comer (alguns segundos fora do ar). Não mexe no banco nem nos restaurantes.
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

# Troca (ou tira) as duas linhas do .env. Valor vazio = linha removida = desligado.
gravar() {
  local aberta=$1 google=$2 tmp
  tmp=$(umask 077; mktemp "$BASE/.env.XXXXXX")
  { grep -vE '^(PUBLIC_PAGE_OPEN|PUBLIC_PAGE_INDEX)=' "$ENVFILE" || true; } >"$tmp"
  if [ -n "$aberta" ]; then
    printf 'PUBLIC_PAGE_OPEN=%s\n' "$aberta" >>"$tmp"
  fi
  if [ -n "$google" ]; then
    printf 'PUBLIC_PAGE_INDEX=%s\n' "$google" >>"$tmp"
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

# Pergunta ao próprio servidor (não ao arquivo): fechada, aberta, google ou ?
perguntar_ao_servidor() {
  docker exec vemcomer-api python -c "
import urllib.error, urllib.request
try:
    texto = urllib.request.urlopen('http://127.0.0.1:5000/robots.txt', timeout=5).read().decode()
except urllib.error.HTTPError as erro:
    print('fechada' if erro.code == 404 else '?')
else:
    print('google' if 'Allow: /r/' in texto else 'aberta')
" 2>/dev/null || echo "?"
}

mostrar_estado() {
  case "$(perguntar_ao_servidor)" in
    fechada) echo "A página pública está FECHADA: /r/... responde 404 e o WhatsApp não mostra prévia." ;;
    aberta) echo "A página pública está ABERTA, sem o Google: quem tem o link vê a página e a prévia; o Google é avisado para não guardar." ;;
    google) echo "A página pública está ABERTA e o Google está CONVIDADO: entram só os restaurantes cujo dono tocou em \"Aparecer no Google\"." ;;
    *) echo "Não consegui perguntar ao servidor. Veja: docker logs vemcomer-api --tail 30" ;;
  esac
}

# Pede a palavra certa, digitada por uma pessoa. Qualquer outra coisa cancela.
pedir_palavra() {
  local palavra=$1 resposta
  read -r -p "Para continuar, digite a palavra $palavra e aperte Enter (qualquer outra coisa cancela): " resposta || resposta=""
  resposta=$(printf '%s' "$resposta" | tr -d '[:space:]' | tr 'A-Z' 'a-z')
  [ "$resposta" = "$palavra" ] || { echo "Cancelado. Nada mudou."; exit 1; }
}

aplicar() {
  local esperado=$1
  ok "configuração gravada no arquivo .env"
  reiniciar_servidor || falhar "O servidor não voltou. Veja: docker logs vemcomer-api --tail 30"
  ok "servidor reiniciado"
  [ "$(perguntar_ao_servidor)" = "$esperado" ] || falhar "O servidor não registrou a mudança. Me avise antes de mexer em mais alguma coisa."
}

comando="${1:-}"
case "$comando" in
  status)
    mostrar_estado
    ;;

  fechar)
    gravar "" ""
    aplicar fechada
    echo
    echo "Pronto: a página pública está FECHADA. Para abrir de novo: bash $APP/deploy/vps/abrir-pagina-publica.sh abrir"
    ;;

  abrir)
    [ -t 0 ] || falhar "Rode direto no terminal: bash $APP/deploy/vps/abrir-pagina-publica.sh abrir"
    echo "Abrir a página pública dos restaurantes para QUEM TIVER O LINK"
    echo
    echo "O que a página mostra: o nome, a logomarca, se está aberto, o cardápio com preços e fotos."
    echo "É o mesmo que o aplicativo já mostra a qualquer cliente. Nunca aparece telefone do dono, e-mail,"
    echo "chave Pix, custos ou pedidos. A página não tem nenhum script e não conta ninguém."
    echo
    echo "Antes de abrir, confira:"
    echo "  1) Você olhou a página de um restaurante de verdade (https://${dominio:-SEU.ENDERECO}/r/NOME-DO-RESTAURANTE)."
    echo "  2) Você sabe que o endereço /r/... passa a existir para qualquer restaurante que já esteja cadastrado."
    echo "  3) O Google continua AVISADO PARA NÃO GUARDAR (isso é o degrau seguinte, com outra palavra)."
    echo
    pedir_palavra abrir
    gravar "1" ""
    aplicar aberta
    echo
    echo "Pronto: a página pública está ABERTA (sem o Google)."
    echo "  Exemplo: https://${dominio:-SEU.ENDERECO}/r/NOME-DO-RESTAURANTE"
    echo "Para fechar: bash $APP/deploy/vps/abrir-pagina-publica.sh fechar"
    ;;

  google)
    [ -t 0 ] || falhar "Rode direto no terminal: bash $APP/deploy/vps/abrir-pagina-publica.sh google"
    [ "$(perguntar_ao_servidor)" != "fechada" ] || falhar "Abra a página antes (comando abrir)."
    echo "Convidar o GOOGLE a guardar as páginas dos restaurantes"
    echo
    echo "Só entra o restaurante cujo DONO tocou em \"Aparecer no Google\" na tela Meu link (padrão: ninguém)."
    echo "Os que não tocaram continuam pedindo ao Google para não guardar. O sitemap.xml lista só os que tocaram."
    echo
    pedir_palavra google
    gravar "1" "1"
    aplicar google
    echo
    echo "Pronto: o Google está CONVIDADO. Sitemap: https://${dominio:-SEU.ENDERECO}/sitemap.xml"
    echo "Para voltar ao degrau anterior: bash $APP/deploy/vps/abrir-pagina-publica.sh abrir (e digite abrir)."
    ;;

  *)
    falhar "Use: abrir-pagina-publica.sh status | abrir | google | fechar"
    ;;
esac
