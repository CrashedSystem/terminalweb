#!/data/data/com.termux/files/usr/bin/bash
# terminalweb Termux:Boot launcher — copy to ~/.termux/boot/terminalweb.sh
# Starts the terminalweb server at device boot (requires Termux:Boot app).
# Idempotent: start.sh exits early if the server is already running.

exec "$HOME/projects/terminalweb/start.sh"