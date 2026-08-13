#!/usr/bin/env bash
#
# Backend (:4000) болон frontend (:3000)-г зэрэг асаана.
#
# Frontend нь backend рүү хандаж өгөгдлөө татдаг тул хоёулаа ажиллаж байх ёстой.
# Зөвхөн frontend асаавал "Сервертэй холбогдож чадсангүй" гэсэн алдаа гарна.
#
#   ./dev.sh        — хоёуланг нь асаана, Ctrl+C дарвал хоёулаа зогсоно
#
# macOS-ийн үндсэн bash бол 3.2 тул `wait -n` зэрэг шинэ боломж ашиглахгүй.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
DATABASE_URL="${DATABASE_URL:-}"
EXPOCRAFT_DB_PROVIDER="${EXPOCRAFT_DB_PROVIDER:-json}"
EXPOCRAFT_POSTGRES_RELATIONAL_SYNC="${EXPOCRAFT_POSTGRES_RELATIONAL_SYNC:-true}"
DEV_DATA_DIR="${EXPOCRAFT_DATA_DIR:-$ROOT/.dev-data/backend}"

read_env_value() {
  local file="$1"
  local key="$2"
  local value=""
  [ -f "$file" ] || return 0
  value="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1 | cut -d= -f2-)"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf "%s" "$value"
}

BACKEND_GOOGLE_CLIENT_ID="$(read_env_value "$ROOT/Backend/.env" "GOOGLE_CLIENT_ID")"
FRONTEND_GOOGLE_CLIENT_ID="$(read_env_value "$ROOT/frontend/.env.local" "NEXT_PUBLIC_GOOGLE_CLIENT_ID")"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-$BACKEND_GOOGLE_CLIENT_ID}"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-$FRONTEND_GOOGLE_CLIENT_ID}"

# Google Client ID бол public утга. Local demo дээр нэг талд нь тавьсан бол
# нөгөө тал руу нь дамжуулж, frontend/backend mismatch гарахаас хамгаална.
if [ -z "${GOOGLE_CLIENT_ID:-}" ] && [ -n "${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}" ]; then
  GOOGLE_CLIENT_ID="$NEXT_PUBLIC_GOOGLE_CLIENT_ID"
fi
if [ -z "${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}" ] && [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  NEXT_PUBLIC_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"
fi
if [ -n "${GOOGLE_CLIENT_ID:-}" ] && [ -n "${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}" ] && [ "$GOOGLE_CLIENT_ID" != "$NEXT_PUBLIC_GOOGLE_CLIENT_ID" ]; then
  echo "⚠️  GOOGLE_CLIENT_ID болон NEXT_PUBLIC_GOOGLE_CLIENT_ID зөрж байна. Google login ажиллахгүй." >&2
fi
if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  export GOOGLE_CLIENT_ID
fi
if [ -n "${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}" ]; then
  export NEXT_PUBLIC_GOOGLE_CLIENT_ID
fi

detect_lan_host() {
  local host=""
  if command -v ipconfig >/dev/null 2>&1; then
    host="$(ipconfig getifaddr en0 2>/dev/null || true)"
    [ -n "$host" ] || host="$(ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [ -z "$host" ] && command -v hostname >/dev/null 2>&1; then
    host="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  [ -n "$host" ] || host="localhost"
  echo "$host"
}

LAN_HOST="${LAN_HOST:-$(detect_lan_host)}"
PUBLIC_FRONTEND_URL="http://${LAN_HOST}:${FRONTEND_PORT}"
PUBLIC_BACKEND_URL="http://${LAN_HOST}:${BACKEND_PORT}"
LOCAL_FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
DEV_CORS_ORIGINS="${EXPOCRAFT_CORS_ORIGINS:-${LOCAL_FRONTEND_URL},${PUBLIC_FRONTEND_URL}}"

# Өмнөх ажиллаж байгаа процесс портыг эзэлсэн бол Next өөр порт руу үсэрч,
# frontend буруу хаяг руу ханддаг. Тиймээс эхлэхээсээ өмнө шалгана.
for stale_port in "$BACKEND_PORT" 4001 3001 "$FRONTEND_PORT"; do
  stale_pids="$(lsof -ti:"$stale_port" 2>/dev/null || true)"
  if [ -n "$stale_pids" ]; then
    echo "→ Хуучин dev порт $stale_port цэвэрлэж байна"
    kill $stale_pids 2>/dev/null || true
    sleep 0.5
    stale_pids="$(lsof -ti:"$stale_port" 2>/dev/null || true)"
    if [ -n "$stale_pids" ]; then
      kill -9 $stale_pids 2>/dev/null || true
    fi
  fi
done

for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if lsof -ti:"$port" >/dev/null 2>&1; then
    echo "Алдаа: $port порт аль хэдийн ашиглагдаж байна." >&2
    echo "  Зогсоох:  lsof -ti:$port | xargs kill" >&2
    exit 1
  fi
done

# Next dev cache эвдэрвэл `page.js`, `_document.js`, webpack chunk ENOENT
# маягийн алдаанууд бүх хуудсан дээр зэрэг гардаг. Dev output `.next-dev`
# дээр тусдаа тул `next build` ажилласан ч browser дээр нээлттэй dev server
# chunk-ээ алдахгүй.
if [ "${EXPOCRAFT_KEEP_NEXT_CACHE:-}" != "true" ]; then
  echo "→ Frontend cache цэвэрлэж байна"
  rm -rf "$ROOT/frontend/.next-dev"
fi

BACKEND_PID=""
FRONTEND_PID=""

# npm нь node-г хүү процессоор ажиллуулдаг тул зөвхөн npm-ийг устгавал node
# үлдэж, порт эзэлсээр байдаг. Иймд хүүхдүүдийг нь хамт устгана.
kill_tree() {
  local pid="$1"
  [ -z "$pid" ] && return 0
  pkill -P "$pid" 2>/dev/null
  kill "$pid" 2>/dev/null
  return 0
}

cleanup() {
  trap - INT TERM EXIT
  echo "" >&2
  echo "Зогсоож байна…" >&2
  kill_tree "$FRONTEND_PID"
  kill_tree "$BACKEND_PID"
  sleep 1
  # Ямар нэг зүйл үлдсэн бол портыг чөлөөлнө — дараагийн ажиллуулалт саадгүй болно.
  for port in "$BACKEND_PORT" 4001 3001 "$FRONTEND_PORT"; do
    lsof -ti:"$port" 2>/dev/null | xargs kill -9 2>/dev/null
  done
  return 0
}
trap cleanup INT TERM EXIT

echo "→ Backend  http://localhost:${BACKEND_PORT}"
echo "→ Backend  ${PUBLIC_BACKEND_URL}"
(
  cd "$ROOT/Backend" &&
  PORT="$BACKEND_PORT" \
  DATABASE_URL="$DATABASE_URL" \
  EXPOCRAFT_DB_PROVIDER="$EXPOCRAFT_DB_PROVIDER" \
  EXPOCRAFT_DATA_DIR="$DEV_DATA_DIR" \
  EXPOCRAFT_POSTGRES_RELATIONAL_SYNC="$EXPOCRAFT_POSTGRES_RELATIONAL_SYNC" \
  EXPOCRAFT_WEB_ORIGIN="$LOCAL_FRONTEND_URL" \
  EXPOCRAFT_CORS_ORIGINS="$DEV_CORS_ORIGINS" \
  npm run dev
) &
BACKEND_PID=$!

echo "→ Frontend http://localhost:${FRONTEND_PORT}"
echo "→ Frontend ${PUBLIC_FRONTEND_URL}"
(
  cd "$ROOT/frontend" &&
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${BACKEND_PORT}}" \
  API_URL="${API_URL:-http://localhost:${BACKEND_PORT}}" \
  NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-$PUBLIC_FRONTEND_URL}" \
  npm run dev -- -H 0.0.0.0 -p "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

# Аль нэг сервер унавал нөгөөг нь ч зогсооно (cleanup trap дуудагдана).
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

echo "Сервер зогслоо — нөгөөг нь ч хаана." >&2
