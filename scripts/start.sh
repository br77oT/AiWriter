#!/usr/bin/env bash
set -euo pipefail

PORT=5802
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.aiwriter.pid"
LOG_FILE="$ROOT/.aiwriter.log"

cd "$ROOT"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "AiWriter already running (pid $(cat "$PID_FILE")) on port $PORT"
  exit 0
fi

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Run scripts/stop.sh first."
  exit 1
fi

echo "Starting AiWriter on port $PORT..."
nohup npx next dev -p "$PORT" >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

echo "Started (pid $(cat "$PID_FILE")). Logs: $LOG_FILE"
echo "Open: http://localhost:$PORT"
