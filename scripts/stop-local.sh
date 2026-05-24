#!/usr/bin/env bash
# stop-local.sh — stop both the AiWriter dev server and the
# ClaudeInBrowserSocket WS server started by start-local.sh.
set -euo pipefail

AIWRITER_PORT=5802
WS_PORT="${CLAUDE_SOCKET_PORT:-8787}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

AIWRITER_PID_FILE="$ROOT/.aiwriter.pid"
WS_PID_FILE="$ROOT/.aiwriter-ws.pid"

stop_pid_file() {
  local label="$1" pidfile="$2"
  [[ -f "$pidfile" ]] || return 0
  local pid
  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping $label (pid $pid)..."
    kill "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "Force killing $label pid $pid..."
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$pidfile"
}

stop_port() {
  local label="$1" port="$2"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  echo "Killing leftover $label listeners on port $port: $pids"
  kill $pids 2>/dev/null || true
  sleep 1
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
}

stop_pid_file "AiWriter" "$AIWRITER_PID_FILE"
stop_pid_file "WS server" "$WS_PID_FILE"
stop_port "AiWriter" "$AIWRITER_PORT"
stop_port "WS server" "$WS_PORT"

echo "Local-mode stack stopped."
