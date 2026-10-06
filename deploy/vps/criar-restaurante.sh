#!/usr/bin/env bash
# Cadastra um restaurante e o seu dono, pelo servidor.
# Pergunta tudo na tela, aceita maiúsculas e espaço sobrando (teclado de celular) e confirma antes de criar.
# A senha não aparece e não fica guardada no histórico do terminal.
#
# Rode assim, direto no terminal do servidor:
#   bash /opt/vem-comer/app/deploy/vps/criar-restaurante.sh
set -Eeuo pipefail

[ -t 0 ] || { echo "Rode direto no terminal: bash /opt/vem-comer/app/deploy/vps/criar-restaurante.sh"; exit 1; }

docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' vemcomer-api 2>/dev/null | grep -qx healthy \
  || { echo "O servidor do Vem Comer não está pronto. Rode antes o instalador."; exit 1; }

dominio=$(sed -n 's/^SITE_ADDRESS=//p' /opt/vem-comer/.env 2>/dev/null | head -1)

echo "Cadastro de restaurante (aperte Ctrl+C para desistir)"
echo

# Teclado de celular: costuma pôr a primeira letra em maiúscula e um espaço no fim. Por isso
# cada resposta tem os espaços das pontas tirados, e se algo estiver errado ele PERGUNTA DE NOVO
# (em vez de terminar).
tirar_espacos() {
  local v=$1
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}
minusculas() { printf '%s' "$1" | tr 'A-Z' 'a-z'; }
como_endereco() { printf '%s' "$1" | tr 'A-Z' 'a-z' | tr ' ' '-' | tr -s '-'; }

val_empresa() { [ -n "$1" ] && [ "${#1}" -le 120 ]; }
val_dono() { [ -n "$1" ] && [ "${#1}" -le 100 ]; }
val_slug() { [[ "$1" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] && [ "${#1}" -ge 3 ] && [ "${#1}" -le 60 ]; }
val_email() { [[ "$1" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] && [ "${#1}" -le 200 ]; }

# perguntar VARIAVEL "texto" FUNCAO_DE_AJUSTE|- FUNCAO_DE_VALIDACAO "mensagem de erro"
perguntar() {
  local var=$1 texto=$2 ajustar=$3 validar=$4 erro=$5 valor bruto tentativas=0
  while :; do
    read -r -p "$texto" bruto || { echo; echo "A entrada foi encerrada. Nada foi criado."; exit 1; }
    valor=$(tirar_espacos "$bruto")
    if [ "$ajustar" != "-" ]; then valor=$("$ajustar" "$valor"); fi
    if "$validar" "$valor"; then
      [ "$valor" = "$bruto" ] || echo "  (ajustei para: $valor)"
      printf -v "$var" '%s' "$valor"
      return 0
    fi
    echo "  $erro"
    tentativas=$((tentativas + 1))
    [ "$tentativas" -lt 5 ] || { echo "Muitas tentativas. Rode o comando de novo."; exit 1; }
  done
}

perguntar VC_EMPRESA "Nome do restaurante: " - val_empresa "Digite o nome do restaurante (até 120 letras)."
perguntar VC_SLUG "Endereço curto, só letras, números e hífen (ex.: bar-do-ze): " como_endereco val_slug \
  "Use de 3 a 60 caracteres: letras, números e hífen, sem acentos."
perguntar VC_DONO "Nome do dono: " - val_dono "Digite o nome do dono (até 100 letras)."
perguntar VC_EMAIL "E-mail do dono (será o login): " minusculas val_email "E-mail inválido. Exemplo: nome@dominio.com"

tentativas=0
while :; do
  read -r -s -p "Senha do dono (mínimo 8 caracteres, não aparece na tela): " VC_SENHA || { echo; exit 1; }
  echo
  read -r -s -p "Repita a senha: " VC_SENHA2 || { echo; exit 1; }
  echo
  if [ "${#VC_SENHA}" -lt 8 ]; then
    echo "  A senha precisa ter pelo menos 8 caracteres."
  elif [ "$VC_SENHA" != "$VC_SENHA2" ]; then
    echo "  As duas senhas são diferentes. Digite de novo."
  else
    break
  fi
  tentativas=$((tentativas + 1))
  [ "$tentativas" -lt 5 ] || { echo "Muitas tentativas. Rode o comando de novo."; exit 1; }
done
unset VC_SENHA2

echo
echo "Confira antes de criar:"
echo "  Restaurante:     $VC_EMPRESA"
echo "  Endereço curto:  $VC_SLUG"
echo "  Dono:            $VC_DONO"
echo "  Login (e-mail):  $VC_EMAIL"
read -r -p "Está certo? Digite s e Enter para criar (qualquer outra coisa cancela): " CONFIRMA || CONFIRMA=n
case "$(minusculas "$(tirar_espacos "$CONFIRMA")")" in
  s | sim) ;;
  *) echo "Cancelado. Nada foi criado."; exit 1 ;;
esac

read -r -d '' CODIGO <<'PY' || true
import json, os, urllib.error, urllib.request

dados = {
    "company_name": os.environ["VC_EMPRESA"],
    "slug": os.environ["VC_SLUG"],
    "name": os.environ["VC_DONO"],
    "email": os.environ["VC_EMAIL"],
    "password": os.environ["VC_SENHA"],
}
pedido = urllib.request.Request(
    "http://127.0.0.1:5000/api/auth/register-company",
    data=json.dumps(dados).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    resposta = urllib.request.urlopen(pedido, timeout=15)
    print(resposta.status)
except urllib.error.HTTPError as erro:
    print(erro.code)
    try:
        print(json.loads(erro.read().decode("utf-8", "replace")).get("error", ""))
    except Exception:
        print("")
PY

export VC_EMPRESA VC_SLUG VC_DONO VC_EMAIL VC_SENHA
# Os valores vão pelo ambiente (nome sem "=valor"), então a senha nunca aparece na lista de processos.
resposta=$(docker exec -i -e VC_EMPRESA -e VC_SLUG -e VC_DONO -e VC_EMAIL -e VC_SENHA vemcomer-api python -c "$CODIGO" </dev/null || true)
unset VC_SENHA

codigo=$(printf '%s\n' "$resposta" | sed -n 1p)
mensagem=$(printf '%s\n' "$resposta" | sed -n 2p)

echo
case "$codigo" in
  201)
    echo "Pronto! Restaurante criado."
    echo "  Painel do dono: https://${dominio:-SEU.ENDERECO}/?empresa=${VC_SLUG}&painel=1"
    echo "  Login: ${VC_EMAIL}"
    echo "Abra o painel, entre com esse e-mail e a senha, e siga o guia da tela."
    ;;
  409)
    echo "Não criei: esse endereço curto ou esse e-mail já está cadastrado."
    exit 1
    ;;
  400)
    echo "Não criei: ${mensagem:-dados inválidos}."
    exit 1
    ;;
  *)
    echo "Não consegui criar (resposta: ${codigo:-nenhuma}). Veja: docker logs vemcomer-api --tail 30"
    exit 1
    ;;
esac
