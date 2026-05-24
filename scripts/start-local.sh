#!/usr/bin/env bash
# start-local.sh — boot AiWriter in local-LLM mode.
#
# Starts (a) the ClaudeInBrowserSocket WebSocket server that fronts
# `claude -p`, and (b) AiWriter's Next.js dev server with LLM_PROVIDER=local
# pointed at it. Both run in the background; PIDs and logs land beside the
# existing .aiwriter.pid / .aiwriter.log so scripts/stop-local.sh can find
# them.
#
# Override the server location via:
#   CLAUDE_SOCKET_REPO   path to ClaudeInBrowserSocket checkout
#   CLAUDE_SOCKET_PORT   port for the WS server (default 8787)
set -euo pipefail

AIWRITER_PORT=5802
WS_PORT="${CLAUDE_SOCKET_PORT:-8787}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WS_REPO="${CLAUDE_SOCKET_REPO:-$(cd "$ROOT/../../Mini/ClaudeInBrowserSocket" && pwd)}"

AIWRITER_PID_FILE="$ROOT/.aiwriter.pid"
AIWRITER_LOG_FILE="$ROOT/.aiwriter.log"
WS_PID_FILE="$ROOT/.aiwriter-ws.pid"
WS_LOG_FILE="$ROOT/.aiwriter-ws.log"

cd "$ROOT"

if [[ ! -d "$WS_REPO" ]]; then
  echo "ClaudeInBrowserSocket repo not found at $WS_REPO" >&2
  echo "Set CLAUDE_SOCKET_REPO=/path/to/ClaudeInBrowserSocket and retry." >&2
  exit 1
fi
if [[ ! -f "$WS_REPO/server.js" ]]; then
  echo "Expected $WS_REPO/server.js — is this the right repo?" >&2
  exit 1
fi

# Start the WS server (skip if already up on this port).
if lsof -iTCP:"$WS_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "WS server already listening on port $WS_PORT — reusing it."
else
  echo "Starting ClaudeInBrowserSocket on port $WS_PORT..."
  (cd "$WS_REPO" && PORT="$WS_PORT" nohup node server.js >"$WS_LOG_FILE" 2>&1 &
   echo $! >"$WS_PID_FILE")
  # Give the server a moment to bind so the AiWriter dev server doesn't
  # race the first request.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    lsof -iTCP:"$WS_PORT" -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 0.3
  done
  if ! lsof -iTCP:"$WS_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "WS server failed to bind port $WS_PORT. Check $WS_LOG_FILE" >&2
    exit 1
  fi
  echo "WS server started (pid $(cat "$WS_PID_FILE")). Logs: $WS_LOG_FILE"
fi

# Start AiWriter (skip if already up).
if [[ -f "$AIWRITER_PID_FILE" ]] && kill -0 "$(cat "$AIWRITER_PID_FILE")" 2>/dev/null; then
  echo "AiWriter already running (pid $(cat "$AIWRITER_PID_FILE")) on port $AIWRITER_PORT"
  exit 0
fi
if lsof -iTCP:"$AIWRITER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $AIWRITER_PORT is already in use. Run scripts/stop-local.sh first." >&2
  exit 1
fi

echo "Starting AiWriter on port $AIWRITER_PORT (LLM_PROVIDER=local)..."
LLM_PROVIDER=local \
AIWRITER_LOCAL_LLM_URL="ws://127.0.0.1:$WS_PORT" \
nohup npx next dev -p "$AIWRITER_PORT" >"$AIWRITER_LOG_FILE" 2>&1 &
echo $! >"$AIWRITER_PID_FILE"

echo "AiWriter started (pid $(cat "$AIWRITER_PID_FILE")). Logs: $AIWRITER_LOG_FILE"
echo "Open: http://localhost:$AIWRITER_PORT"
