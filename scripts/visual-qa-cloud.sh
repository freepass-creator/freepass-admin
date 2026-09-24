#!/usr/bin/env bash
set -euo pipefail

PORT="${VISUAL_QA_PORT:-3100}"
HOST="${VISUAL_QA_HOST:-127.0.0.1}"
BASE_URL="http://${HOST}:${PORT}"
LOG_DIR="${VISUAL_QA_LOG_DIR:-artifacts/visual-qa}"
SERVER_LOG="${LOG_DIR}/server.log"

mkdir -p "${LOG_DIR}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[visual:qa:cloud] starting Next dev server at ${BASE_URL}"
npm run dev -- --hostname "${HOST}" --port "${PORT}" >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

echo "[visual:qa:cloud] waiting for server..."
READY=0
for _ in $(seq 1 90); do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    echo "[visual:qa:cloud] server exited early"
    cat "${SERVER_LOG}" || true
    exit 1
  fi

  if curl -fsS --max-time 2 "${BASE_URL}/products" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "${READY}" != "1" ]]; then
  echo "[visual:qa:cloud] server did not become ready within 90s"
  cat "${SERVER_LOG}" || true
  exit 1
fi

echo "[visual:qa:cloud] server ready"
echo "[visual:qa:cloud] running screenshot harness"

if [[ -d /opt/node22/lib/node_modules ]]; then
  export NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}"
fi

npm run visual:qa -- "${BASE_URL}"

echo "[visual:qa:cloud] complete"
echo "[visual:qa:cloud] results: artifacts/visual-qa/"
