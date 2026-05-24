#!/usr/bin/env bash
set -euo pipefail

PORT=5802
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.aiwriter.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping AiWriter (pid $PID)..."
    kill "$PID" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      kill -0 "$PID" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$PID" 2>/dev/null; then
      echo "Force killing pid $PID..."
      kill -9 "$PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
fi

PORT_PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$PORT_PIDS" ]]; then
  echo "Killing leftover listeners on port $PORT: $PORT_PIDS"
  kill $PORT_PIDS 2>/dev/null || true
  sleep 1
  PORT_PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$PORT_PIDS" ]] && kill -9 $PORT_PIDS 2>/dev/null || true
fi

echo "AiWriter stopped."
