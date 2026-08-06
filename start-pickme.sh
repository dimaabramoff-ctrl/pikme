#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

command -v node >/dev/null 2>&1 || { echo "Node.js не найден"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm не найден"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl не найден"; exit 1; }

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof не найден, пропускаю проверку занятых портов"
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Порт 3000 уже занят"
  fi
  if lsof -iTCP:5174 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Порт 5174 уже занят"
  fi
fi

if ! (echo > /dev/tcp/127.0.0.1/5432) >/dev/null 2>&1; then
  echo "PostgreSQL не отвечает на 127.0.0.1:5432"
  echo "Запустите базу и повторите запуск"
  exit 1
fi

mkdir -p .runtime

BACKEND_LOG=".runtime/backend.log"
FRONTEND_LOG=".runtime/frontend.log"

echo "Запуск backend..."
(cd backend && npm run start:dev) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
FRONTEND_PID=""

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

for _ in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    echo "Backend завершился с ошибкой. См. $BACKEND_LOG"
    exit 1
  fi
done

if ! curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1; then
  echo "Backend health-check не прошел. См. $BACKEND_LOG"
  exit 1
fi

echo "Запуск frontend..."
(cd frontend && npm run dev -- --host 0.0.0.0 --port 5174) >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

for _ in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:5174 >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    echo "Frontend завершился с ошибкой. См. $FRONTEND_LOG"
    exit 1
  fi
done

if ! curl -fsS http://127.0.0.1:5174 >/dev/null 2>&1; then
  echo "Frontend health-check не прошел. См. $FRONTEND_LOG"
  exit 1
fi

APP_URL="http://127.0.0.1:5174"

echo "PickMe запущен: $APP_URL"

if [[ -n "${BROWSER:-}" ]]; then
  "$BROWSER" "$APP_URL" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$APP_URL" >/dev/null 2>&1 || true
fi

echo "Логи: $BACKEND_LOG и $FRONTEND_LOG"
echo "Для остановки нажмите Ctrl+C"
wait
