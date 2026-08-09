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

# Өмнөх ажиллаж байгаа процесс портыг эзэлсэн бол Next өөр порт руу үсэрч,
# frontend буруу хаяг руу ханддаг. Тиймээс эхлэхээсээ өмнө шалгана.
for port in 4000 3000; do
  if lsof -ti:"$port" >/dev/null 2>&1; then
    echo "Алдаа: $port порт аль хэдийн ашиглагдаж байна." >&2
    echo "  Зогсоох:  lsof -ti:$port | xargs kill" >&2
    exit 1
  fi
done

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
  for port in 4000 3000; do
    lsof -ti:"$port" 2>/dev/null | xargs kill -9 2>/dev/null
  done
  return 0
}
trap cleanup INT TERM EXIT

echo "→ Backend  http://localhost:4000"
(cd "$ROOT/Backend" && npm run dev) &
BACKEND_PID=$!

echo "→ Frontend http://localhost:3000"
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

# Аль нэг сервер унавал нөгөөг нь ч зогсооно (cleanup trap дуудагдана).
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

echo "Сервер зогслоо — нөгөөг нь ч хаана." >&2
