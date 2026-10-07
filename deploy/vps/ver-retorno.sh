#!/usr/bin/env bash
# Mostra o "Como foi?" dos últimos dias: quantos rostinhos bons, médios e ruins em cada tarefa, e o
# que as pessoas pediram para melhorar. É a matéria-prima da melhoria diária.
#
# Rode no terminal do servidor (padrão: último dia):
#   bash /opt/vem-comer/app/deploy/vps/ver-retorno.sh
#   bash /opt/vem-comer/app/deploy/vps/ver-retorno.sh 7      (últimos 7 dias)
#
# Só lê o banco; não muda nada. Mostra o nome do restaurante, nunca e-mail ou nome de pessoa.
set -Eeuo pipefail

dias="${1:-1}"
[[ "$dias" =~ ^[0-9]{1,3}$ ]] && [ "$dias" -ge 1 ] || { echo "Use um número de dias entre 1 e 999. Ex.: ver-retorno.sh 7"; exit 1; }

docker inspect vemcomer-db >/dev/null 2>&1 || { echo "O banco do Vem Comer não está rodando neste servidor."; exit 1; }
psql_vc() { docker exec -i -e 'PGOPTIONS=-c client_min_messages=warning' vemcomer-db psql -U vemcomer -d vemcomer -v ON_ERROR_STOP=1 -q "$@"; }

tem=$(psql_vc -tA -c "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'feedback'")
[ "$tem" = "1" ] || { echo "A tabela do retorno ainda não existe. Rode o instalador primeiro."; exit 1; }

echo "Como foi? — últimos $dias dia(s)"
echo
psql_vc -v dias="$dias" <<'SQL'
\pset footer off
SELECT context AS tarefa,
       count(*) FILTER (WHERE rating = 3) AS bom,
       count(*) FILTER (WHERE rating = 2) AS medio,
       count(*) FILTER (WHERE rating = 1) AS ruim,
       count(*) AS total
  FROM feedback
 WHERE created_at >= now() - make_interval(days => :dias)
 GROUP BY context
 ORDER BY ruim DESC, total DESC;

SELECT to_char(f.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS quando,
       c.name AS restaurante,
       f.context AS tarefa,
       CASE f.rating WHEN 3 THEN 'bom' WHEN 2 THEN 'medio' ELSE 'ruim' END AS nota,
       f.comment AS o_que_melhorar
  FROM feedback f
  JOIN companies c ON c.id = f.company_id
 WHERE f.created_at >= now() - make_interval(days => :dias)
   AND f.comment IS NOT NULL
 ORDER BY f.rating, f.created_at DESC
 LIMIT 200;
SQL
