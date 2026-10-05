#!/usr/bin/env bash
# Backup do banco do Vem Comer (só dele; o runtime da ChatGPT tem o seu próprio backup).
# Roda todo dia pelo timer do systemd e também no fim da instalação.
# Guarda os últimos 14 dias em /var/backups/vem-comer, sempre mantendo pelo menos os 3 mais novos.
#
# ATENÇÃO: estes arquivos ficam NESTE servidor. Protegem contra erro e contra perda de dados,
# não contra a perda do servidor inteiro (para isso valem os backups da Hostinger e,
# mais para frente, uma cópia para fora).
set -Eeuo pipefail
umask 077

DEST="${VEM_BACKUP_DIR:-/var/backups/vem-comer}"
DIAS="${VEM_BACKUP_DIAS:-14}"
CONT="vemcomer-db"

falha() { printf '  BACKUP FALHOU: %s\n' "$*" >&2; exit 1; }

docker inspect -f '{{.State.Running}}' "$CONT" 2>/dev/null | grep -q true || falha "o banco ($CONT) não está rodando"

install -d -m 700 "$DEST"
# sobra de uma rodada que foi interrompida à força (falta de memória, desligamento)
find "$DEST" -maxdepth 1 -name 'vemcomer-*.partial' -mmin +120 -delete 2>/dev/null || true
stamp=$(date -u +%Y%m%dT%H%M%SZ)
final="$DEST/vemcomer-$stamp.dump"
tmp="$final.partial"
trap 'rm -f "$tmp"' EXIT

docker exec "$CONT" pg_dump -U vemcomer -d vemcomer --format=custom --no-owner </dev/null >"$tmp" \
  || falha "o pg_dump deu erro"
[ -s "$tmp" ] || falha "o arquivo saiu vazio"

# um arquivo válido consegue listar o próprio conteúdo
docker exec -i "$CONT" pg_restore --list <"$tmp" >/dev/null || falha "o arquivo gerado não é um backup válido"

mv "$tmp" "$final"
trap - EXIT

# apaga só os que passaram de $DIAS dias, e nunca os 3 mais novos
mapfile -t antigos < <(ls -1t "$DEST"/vemcomer-*.dump 2>/dev/null | tail -n +4)
for arq in "${antigos[@]}"; do
  if [ -n "$(find "$arq" -maxdepth 0 -mtime +"$DIAS" 2>/dev/null)" ]; then
    rm -f -- "$arq"
  fi
done

printf '  backup ok: %s (%s)\n' "$final" "$(du -h "$final" | cut -f1)"
