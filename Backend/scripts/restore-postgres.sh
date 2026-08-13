#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[restore:error] DATABASE_URL is required." >&2
  exit 1
fi

if [ -z "${BACKUP_FILE:-}" ]; then
  echo "[restore:error] BACKUP_FILE is required." >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore:error] BACKUP_FILE does not exist: $BACKUP_FILE" >&2
  exit 1
fi

case "$BACKUP_FILE" in
  *.gz)
    gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
    ;;
  *)
    psql "$DATABASE_URL" < "$BACKUP_FILE"
    ;;
esac

echo "[restore:ok] PostgreSQL restore completed from $BACKUP_FILE"
