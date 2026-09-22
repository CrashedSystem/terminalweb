#!/data/data/com.termux/files/usr/bin/bash
# terminalweb start — idempotent, nohup background
DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$HOME/.terminalweb/server.pid"
LOGFILE="$HOME/.terminalweb/server.log"
PORT="${PORT:-8080}"

mkdir -p "$HOME/.terminalweb"

# Already running?
if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "terminalweb already running (pid $PID) — http://localhost:$PORT"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

# Port already in use?
if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "Port $PORT already in use — assuming server running"
  exit 0
fi

cd "$DIR"
nohup node server/index.js >> "$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"
sleep 1
if kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "terminalweb started (pid $(cat "$PIDFILE")) — http://localhost:$PORT"
else
  echo "FAILED to start — see $LOGFILE"
  exit 1
fi