#!/usr/bin/env bash
# Prova que o backup mais novo realmente restaura: cria um banco de teste, restaura nele,
# compara as tabelas com o banco de verdade e apaga o banco de teste.
# NÃO mexe no banco de verdade (só lê).
set -Eeuo pipefail

DEST="${VEM_BACKUP_DIR:-/var/backups/vem-comer}"
CONT="vemcomer-db"
TESTE="vemcomer_teste_restauracao"

falha() { printf '  TESTE DE RESTAURAÇÃO FALHOU: %s\n' "$*" >&2; exit 1; }

ultimo=$(ls -1t "$DEST"/vemcomer-*.dump 2>/dev/null | head -1 || true)
[ -n "$ultimo" ] || falha "não achei nenhum backup em $DEST"

adm() { docker exec -i "$CONT" psql -U vemcomer -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
sql() { docker exec -i "$CONT" psql -U vemcomer -d "$1" -v ON_ERROR_STOP=1 -qAt -c "$2" </dev/null; }

limpar() { adm -c "DROP DATABASE IF EXISTS $TESTE" </dev/null >/dev/null 2>&1 || true; }
trap limpar EXIT

limpar
adm -c "CREATE DATABASE $TESTE" </dev/null >/dev/null

docker exec -i "$CONT" pg_restore -U vemcomer -d "$TESTE" --no-owner --exit-on-error <"$ultimo" \
  || falha "o pg_restore deu erro ao restaurar $(basename "$ultimo")"

lista="select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"
tabelas_prod=$(sql vemcomer "$lista")
tabelas_rest=$(sql "$TESTE" "$lista")
[ -n "$tabelas_rest" ] || falha "o banco restaurado ficou sem tabelas"
[ "$tabelas_prod" = "$tabelas_rest" ] || falha "as tabelas restauradas são diferentes das de produção"

printf '  restauração ok a partir de %s\n' "$(basename "$ultimo")"
printf '  %-22s %10s %12s\n' tabela producao restaurado
while IFS= read -r tabela; do
  [ -n "$tabela" ] || continue
  n_prod=$(sql vemcomer "select count(*) from public.\"$tabela\"")
  n_rest=$(sql "$TESTE" "select count(*) from public.\"$tabela\"")
  printf '  %-22s %10s %12s\n' "$tabela" "$n_prod" "$n_rest"
done <<<"$tabelas_prod"
echo "  (o restaurado pode ter menos linhas se houve pedidos depois do backup)"
