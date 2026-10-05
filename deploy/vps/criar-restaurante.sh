#!/usr/bin/env bash
# Cadastra um restaurante e o seu dono, pelo servidor.
# Pergunta tudo na tela. A senha não aparece e não fica guardada no histórico do terminal.
#
# Rode assim, direto no terminal do servidor:
#   bash /opt/vem-comer/app/deploy/vps/criar-restaurante.sh
set -Eeuo pipefail

[ -t 0 ] || { echo "Rode direto no terminal: bash /opt/vem-comer/app/deploy/vps/criar-restaurante.sh"; exit 1; }

docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' vemcomer-api 2>/dev/null | grep -q healthy \
  || { echo "O servidor do Vem Comer não está pronto. Rode antes o instalador."; exit 1; }

dominio=$(sed -n 's/^SITE_ADDRESS=//p' /opt/vem-comer/.env 2>/dev/null | head -1)

echo "Cadastro de restaurante (aperte Ctrl+C para desistir)"
echo

read -r -p "Nome do restaurante: " VC_EMPRESA
[ -n "$VC_EMPRESA" ] && [ "${#VC_EMPRESA}" -le 120 ] || { echo "Nome do restaurante vazio ou grande demais."; exit 1; }

read -r -p "Endereço curto, só letras minúsculas, números e hífen (ex.: bar-do-ze): " VC_SLUG
[[ "$VC_SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] && [ "${#VC_SLUG}" -ge 3 ] && [ "${#VC_SLUG}" -le 60 ] \
  || { echo "Endereço curto inválido. Use de 3 a 60 caracteres: letras minúsculas, números e hífen."; exit 1; }

read -r -p "Nome do dono: " VC_DONO
[ -n "$VC_DONO" ] && [ "${#VC_DONO}" -le 100 ] || { echo "Nome do dono vazio ou grande demais."; exit 1; }

read -r -p "E-mail do dono (será o login): " VC_EMAIL
[[ "$VC_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] && [ "${#VC_EMAIL}" -le 200 ] \
  || { echo "E-mail inválido."; exit 1; }

read -r -s -p "Senha do dono (mínimo 8 caracteres, não aparece na tela): " VC_SENHA
echo
read -r -s -p "Repita a senha: " VC_SENHA2
echo
[ "${#VC_SENHA}" -ge 8 ] || { echo "A senha precisa ter pelo menos 8 caracteres."; exit 1; }
[ "$VC_SENHA" = "$VC_SENHA2" ] || { echo "As duas senhas são diferentes."; exit 1; }
unset VC_SENHA2

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
