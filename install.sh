#!/data/data/com.termux/files/usr/bin/bash
# terminalweb installer — idempotent
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "[1/4] Installing npm dependencies..."
npm install
npm install-scripts approve node-pty 2>/dev/null || true

echo "[2/4] Copying vendor bundles..."
node scripts/vendor.js

echo "[3/4] Writing tmux config..."
mkdir -p "$HOME/.config/tmux"
cp -f server/tmux.conf "$HOME/.config/tmux/tmux.conf"

echo "[4/4] Installing .bashrc auto-start hook..."
HOOK='# terminalweb auto-start
[ -f "$HOME/projects/terminalweb/start.sh" ] && "$HOME/projects/terminalweb/start.sh"'
if ! grep -q "terminalweb auto-start" "$HOME/.bashrc" 2>/dev/null; then
  printf '\n%s\n' "$HOOK" >> "$HOME/.bashrc"
  echo "  .bashrc hook added"
else
  echo "  .bashrc hook already present"
fi

echo "Done. Start with: ./start.sh  (URL: http://localhost:8080)"