#!/usr/bin/env bash
# Configura e liga a cobrança do plano dos restaurantes (R$ 190 por mês, veja docs/assinatura-e-cobranca.md).
#
# A cobrança vem DESLIGADA: o painel mostra o plano e os avisos, mas nada é bloqueado. Quem decide o dia de ligar é o GD.
#
#   Ver como está:       bash /opt/vem-comer/app/deploy/vps/cobranca.sh status
#   Dizer para onde vai o dinheiro e quem é administrador (qualquer parte, em qualquer ordem):
#     bash /opt/vem-comer/app/deploy/vps/cobranca.sh dados --admin seu@email.com --pix "sua chave pix" \
#          --recebedor "Nome de quem recebe" --whatsapp 5584999999999
#   Ligar a cobrança:    bash /opt/vem-comer/app/deploy/vps/cobranca.sh ligar     (pede para digitar "ligar")
#   Desligar de novo:    bash /opt/vem-comer/app/deploy/vps/cobranca.sh desligar
#
# Mexe só em linhas do arquivo /opt/vem-comer/.env e reinicia só o servidor do Vem Comer (alguns segundos fora do ar).
# Não mexe no banco, nos restaurantes, nos pedidos nem nos cardápios. Desligar devolve tudo como estava.
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

# Troca (ou tira) UMA linha NOME=valor do .env. Valor vazio = linha removida. O resto do arquivo fica igual.
gravar() {
  local nome=$1 valor=$2 tmp
  tmp=$(umask 077; mktemp "$BASE/.env.XXXXXX")
  { grep -v "^${nome}=" "$ENVFILE" || true; } >"$tmp"
  if [ -n "$valor" ]; then
    printf '%s=%s\n' "$nome" "$valor" >>"$tmp"
  fi
  chmod 600 "$tmp"
  mv "$tmp" "$ENVFILE"
  chmod 600 "$ENVFILE"
}

lido() { sed -n "s/^${1}=//p" "$ENVFILE" | head -1; }

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

# O que o PRÓPRIO servidor enxerga (não o arquivo): uma linha "chave=valor" por item.
perguntar_ao_servidor() {
  docker exec vemcomer-api python -c "
import subscription as s
info = s.payment_info()
print('ligada=' + ('sim' if s.billing_enforced() else 'nao'))
print('admins=' + str(len(s.platform_admin_emails())))
print('pix=' + ('sim' if info['pix_key'] else 'nao'))
print('whatsapp=' + ('sim' if info['contact_phone'] else 'nao'))
" 2>/dev/null || echo "erro=1"
}

campo() { printf '%s\n' "$1" | sed -n "s/^${2}=//p" | head -1; }

mostrar_estado() {
  local lido_do_servidor
  lido_do_servidor=$(perguntar_ao_servidor)
  if [ -n "$(campo "$lido_do_servidor" erro)" ]; then
    echo "Não consegui perguntar ao servidor. Veja: docker logs vemcomer-api --tail 30"
    return 1
  fi
  if [ "$(campo "$lido_do_servidor" ligada)" = "sim" ]; then
    echo "A cobrança está LIGADA: restaurante com plano vencido (ou sem o 1º pagamento) não recebe pedido novo."
  else
    echo "A cobrança está DESLIGADA: o painel mostra o plano e os avisos, mas nada é bloqueado."
  fi
  echo "  Administradores (veem todos os restaurantes): $(campo "$lido_do_servidor" admins)"
  echo "  Chave Pix para o dono pagar:   $([ "$(campo "$lido_do_servidor" pix)" = "sim" ] && echo "preenchida" || echo "FALTA")"
  echo "  WhatsApp para o dono chamar:   $([ "$(campo "$lido_do_servidor" whatsapp)" = "sim" ] && echo "preenchido" || echo "FALTA")"
}

# Valor de uma linha do .env: sem quebra de linha, aspas, cifrão, barra, crase nem "#" (o arquivo seria lido errado).
valor_limpo() {
  local rotulo=$1 valor=$2
  valor=$(printf '%s' "$valor" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  case "$valor" in
    *[\"\'\$\\\`#]* | *$'\n'* | *$'\r'*) falhar "$rotulo tem uma letra que não posso gravar (aspas, cifrão, barra, crase ou #). Tire e tente de novo." ;;
  esac
  [ "${#valor}" -le 140 ] || falhar "$rotulo ficou grande demais (até 140 letras)."
  printf '%s' "$valor"
}

comando="${1:-}"
if [ "$#" -gt 0 ]; then shift; fi

case "$comando" in
  status)
    mostrar_estado
    ;;

  dados)
    [ "$#" -gt 0 ] || falhar "Diga o que gravar: --admin e-mail | --pix chave | --recebedor nome | --whatsapp numero"
    ADMIN="" PIX="" RECEBEDOR="" WHATSAPP=""
    tem_admin=0 tem_pix=0 tem_recebedor=0 tem_whatsapp=0
    while [ "$#" -gt 0 ]; do
      [ "$#" -ge 2 ] || falhar "Faltou o valor depois de $1."
      case "$1" in
        --admin) ADMIN=$(valor_limpo "O e-mail do administrador" "$2"); tem_admin=1 ;;
        --pix) PIX=$(valor_limpo "A chave Pix" "$2"); tem_pix=1 ;;
        --recebedor) RECEBEDOR=$(valor_limpo "O nome de quem recebe" "$2"); tem_recebedor=1 ;;
        --whatsapp) WHATSAPP=$(printf '%s' "$2" | tr -cd '0-9'); tem_whatsapp=1 ;;
        *) falhar "Não conheço $1. Use: --admin | --pix | --recebedor | --whatsapp" ;;
      esac
      shift 2
    done
    if [ "$tem_admin" -eq 1 ] && [ -n "$ADMIN" ]; then
      printf '%s' "$ADMIN" | grep -Eq '^[^@,;[:space:]]+@[^@,;[:space:]]+\.[^@,;[:space:]]+(,[^@,;[:space:]]+@[^@,;[:space:]]+\.[^@,;[:space:]]+)*$' \
        || falhar "O e-mail do administrador não parece um e-mail (mais de um: separe por vírgula, sem espaço)."
    fi
    if [ "$tem_whatsapp" -eq 1 ] && [ -n "$WHATSAPP" ]; then
      case "${#WHATSAPP}" in
        10 | 11) WHATSAPP="55$WHATSAPP" ;;
        12 | 13) ;;
        *) falhar "O WhatsApp precisa de DDD e número, assim: 5584999999999." ;;
      esac
    fi
    [ "$tem_admin" -eq 0 ] || gravar PLATFORM_ADMIN_EMAILS "$ADMIN"
    [ "$tem_pix" -eq 0 ] || gravar BILLING_PIX_KEY "$PIX"
    [ "$tem_recebedor" -eq 0 ] || gravar BILLING_PIX_RECEIVER "$RECEBEDOR"
    [ "$tem_whatsapp" -eq 0 ] || gravar BILLING_CONTACT_PHONE "$WHATSAPP"
    ok "dados gravados no arquivo de configuração"
    reiniciar_servidor || falhar "O servidor não voltou. Veja: docker logs vemcomer-api --tail 30"
    ok "servidor reiniciado"
    echo
    mostrar_estado
    ;;

  desligar)
    gravar BILLING_ENFORCED ""
    ok "cobrança desligada no arquivo de configuração"
    reiniciar_servidor || falhar "O servidor não voltou. Veja: docker logs vemcomer-api --tail 30"
    ok "servidor reiniciado"
    [ "$(campo "$(perguntar_ao_servidor)" ligada)" = "nao" ] || falhar "O servidor ainda diz que a cobrança está ligada. Me avise."
    echo
    echo "Pronto: a cobrança está DESLIGADA. Nada ficou bloqueado e nada foi apagado."
    echo "Para ligar de novo: bash $APP/deploy/vps/cobranca.sh ligar"
    ;;

  ligar)
    [ -t 0 ] || falhar "Rode direto no terminal: bash $APP/deploy/vps/cobranca.sh ligar"
    [ -n "$(lido PLATFORM_ADMIN_EMAILS)" ] \
      || falhar "Falta dizer quem é o administrador. Rode antes: bash $APP/deploy/vps/cobranca.sh dados --admin seu@email.com"
    if [ -z "$(lido BILLING_PIX_KEY)" ] && [ -z "$(lido BILLING_CONTACT_PHONE)" ]; then
      falhar "Falta dizer para onde o dono paga. Rode antes: bash $APP/deploy/vps/cobranca.sh dados --pix \"sua chave\" --whatsapp 5584999999999"
    fi
    echo "Ligar a cobrança do plano (R\$ 190 por mês) para os restaurantes"
    echo
    echo "Antes de ligar, confira:"
    echo "  1) Quem se cadastra daqui para a frente nasce esperando o 1º pagamento e NÃO recebe pedido até você registrar"
    echo "     o pagamento no painel (aba Assinaturas). Restaurantes que já existiam não têm plano e não são bloqueados."
    echo "  2) Quando o plano vence, o restaurante para de aceitar pedido NOVO no dia seguinte. Os pedidos em andamento"
    echo "     terminam, nada é apagado e tudo volta na hora em que você registrar o pagamento."
    echo "  3) O pagamento é registrado por você, à mão, no painel. Ainda não há cobrança automática."
    echo "  4) Para desligar quando quiser: bash $APP/deploy/vps/cobranca.sh desligar"
    echo
    read -r -p "Para ligar, digite a palavra ligar e aperte Enter (qualquer outra coisa cancela): " resposta || resposta=""
    resposta=$(printf '%s' "$resposta" | tr -d '[:space:]' | tr 'A-Z' 'a-z')
    [ "$resposta" = "ligar" ] || { echo "Cancelado. A cobrança continua como estava."; exit 1; }
    gravar BILLING_ENFORCED "1"
    ok "cobrança ligada no arquivo de configuração"
    reiniciar_servidor || falhar "O servidor não voltou. Veja: docker logs vemcomer-api --tail 30"
    ok "servidor reiniciado"
    [ "$(campo "$(perguntar_ao_servidor)" ligada)" = "sim" ] || falhar "O servidor não registrou a mudança. Me avise antes de mexer em mais alguma coisa."
    echo
    echo "Pronto: a cobrança está LIGADA."
    echo "Para desligar: bash $APP/deploy/vps/cobranca.sh desligar"
    ;;

  *)
    falhar "Use: cobranca.sh status | dados | ligar | desligar"
    ;;
esac
