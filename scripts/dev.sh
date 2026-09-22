#!/usr/bin/env bash
# Run the preview stack (mock BFF + Next.js dev) in ONE foreground terminal.
# Pattern follows 9router-fastapi/scripts/start-local.sh: background jobs +
# `wait` + trap cleanup. Ctrl+C stops both — no pidfiles, no detach tricks.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${DEV_PORT:-3100}"
BFF_PORT="${MOCK_BFF_PORT:-18080}"

port_busy() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$1" 2>/dev/null | grep -q ":$1"
    return
  fi
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

cleanup() {
  trap - EXIT INT TERM
  local pids
  pids="$(jobs -p 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill "$pids" 2>/dev/null || true
    wait "$pids" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "${1:-start}" == "stop" ]]; then
  # Sweep leftover processes of this stack by specific command patterns.
  pkill -f "node scripts/mock-bff.js" 2>/dev/null && echo "mock bff dihentikan" || true
  pkill -f "next dev --port $PORT" 2>/dev/null && echo "next dev dihentikan" || true
  exit 0
fi

if port_busy "$PORT"; then
  echo "error: port $PORT sudah dipakai" >&2
  echo "hint: jalankan 'pnpm dev:down' dulu, atau pakai DEV_PORT=3200" >&2
  exit 1
fi

# Mock BFF is skipped when the real Go BFF already owns the port.
USE_MOCK=1
if port_busy "$BFF_PORT"; then
  USE_MOCK=0
  echo "[dev] port $BFF_PORT terpakai — mock BFF dilewati (diasumsikan backend asli)"
fi

echo "[dev] lobby    http://localhost:$PORT/lobby"
echo "[dev] Ctrl+C menghentikan semua proses"

if [[ "$USE_MOCK" == "1" ]]; then
  (
    cd "$ROOT"
    exec env MOCK_BFF_PORT="$BFF_PORT" node scripts/mock-bff.js
  ) 2>&1 | sed -u 's/^/[mock]  /' &
fi

(
  cd "$ROOT"
  exec "$ROOT/node_modules/.bin/next" dev --port "$PORT"
) 2>&1 | sed -u 's/^/[next]  /' &

wait
