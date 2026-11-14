#!/usr/bin/env bash
# Backup do PostgreSQL + objetos (MinIO). Agende no cron: 0 2 * * * /opt/operia/scripts/backup.sh
set -euo pipefail
DEST="${BACKUP_DIR:-./backups}"; STAMP="$(date +%Y%m%d-%H%M%S)"; KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE="${COMPOSE:-docker compose}"
mkdir -p "$DEST"
$COMPOSE exec -T db pg_dump -U operia -Fc operia > "$DEST/db-$STAMP.dump"
$COMPOSE exec -T minio sh -c 'tar -C /data -cf - .' | gzip > "$DEST/objetos-$STAMP.tar.gz"
find "$DEST" -type f -mtime +"$KEEP_DAYS" -delete
echo "Backup concluido: $DEST/db-$STAMP.dump e objetos-$STAMP.tar.gz"
