#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/expocraft-postgres-$STAMP.sql.gz"
fi

if [[ -d "${EXPOCRAFT_DATA_DIR:-./data}" ]]; then
  tar -czf "$BACKUP_DIR/expocraft-data-$STAMP.tgz" "${EXPOCRAFT_DATA_DIR:-./data}"
fi

find "$BACKUP_DIR" -type f -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete
echo "Backup complete: $BACKUP_DIR"
