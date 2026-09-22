#!/data/data/com.termux/files/usr/bin/bash
# terminalweb stop — sessions survive (tmux)
PIDFILE="$HOME/.terminalweb/server.pid"

if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "terminalweb stopped (pid $PID). tmux sessions preserved."
  else
    echo "No running process (stale pid file)."
  fi
  rm -f "$PIDFILE"
else
  echo "No pid file — server not running?"
fi