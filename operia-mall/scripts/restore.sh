#!/usr/bin/env bash
# Uso: scripts/restore.sh backups/db-AAAAMMDD-HHMMSS.dump backups/objetos-AAAAMMDD-HHMMSS.tar.gz
set -euo pipefail
DB="$1"; OBJ="$2"; COMPOSE="${COMPOSE:-docker compose}"
read -r -p "Isto SOBRESCREVE banco e anexos atuais. Digite RESTAURAR para continuar: " ok
[ "$ok" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }
$COMPOSE stop api
$COMPOSE exec -T db pg_restore -U operia -d operia --clean --if-exists < "$DB"
gunzip -c "$OBJ" | $COMPOSE exec -T minio sh -c 'tar -C /data -xf -'
$COMPOSE start api
echo "Restauracao concluida. Valide: GET /health e abertura de uma ocorrencia com anexo."
