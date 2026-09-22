# terminalweb

Self-hosted web terminal for Termux (Android) with Windows Terminal feature parity.
Runs on `localhost` only — no LAN exposure. Sessions persist across server/browser restarts via tmux.

## Features

- **Tabs & split panes** — arbitrary split tree (Ctrl+Shift+T new tab, Ctrl+Shift+D split, Alt+arrows focus, drag dividers)
- **Profiles** — bash / zsh / python, per-profile color scheme, icon, cwd
- **Color schemes** — 10 Windows Terminal schemes (Campbell, Dracula, One Half, Solarized, Tango, Vintage, ...)
- **UI themes** — dark/light, background opacity, background image
- **Command palette** — Ctrl+Shift+P, fuzzy search over actions
- **Search** — Ctrl+Shift+F, highlight matches in buffer
- **Keybindings** — Windows Terminal defaults, overridable in settings
- **Copy/paste** — selection auto-copies (OSC 52), Ctrl+Shift+C/V
- **Export buffer** — Ctrl+Shift+E downloads full scrollback as text
- **Bell** — visual flash (optional audio)
- **Mobile optimized** — 2-row touch keyboard (modifiers, navigation, 32 shell symbols with Ctrl/Alt sticky combos), pinch zoom, keyboard avoidance, toggleable via ⌨ button
- **PWA** — installable, offline app shell
- **PWA** — installable (standalone), offline app shell via service worker, icons included
- **Persistence** — tmux-backed sessions survive server restarts (POSIX); killed only by user action. On Windows sessions run for the lifetime of the server process (tmux is not available).

## Quick Start

```bash
cd ~/projects/terminalweb
./install.sh   # npm deps + vendor bundles + tmux config + .bashrc hook
./start.sh     # starts server (idempotent)
```

Open `http://localhost:8080` in Android Chrome.

**Install as app**: Chrome menu → "Add to Home screen" (or "Install app"). The app runs standalone with its own icon; the shell loads even when the server is offline.

Stop: `./stop.sh` (tmux sessions survive).

## Windows (desktop) Quick Start

Run from PowerShell 7+ (or `npm install --no-audit --no-fund && npm run install:vendor` manually):

```powershell
cd C:\path\to\terminalweb
.\install.ps1   # npm deps + vendor bundles (no tmux config — not needed)
.\start.ps1     # starts server in background (idempotent)
```

Open `http://localhost:8080` in your browser. `npm start` also works.

Stop: `.\stop.ps1` — note that sessions are NOT preserved across restarts on Windows (no tmux persistence).

**Shells**: the server auto-detects and prefers `pwsh` (PowerShell 7), then Windows PowerShell, then `cmd`. The default profile and Settings-panel profiles are selected accordingly; any unavailable shell (e.g. `bash` without WSL) falls back to the first available Windows shell. Custom shells like `wsl` work too — just set the profile `command` in settings.

## Auto-Start

- **Termux launch**: `install.sh` appends a hook to `~/.bashrc` that calls `start.sh` automatically.
- **Device boot (optional)**: install Termux:Boot from F-Droid, then:

```bash
mkdir -p ~/.termux/boot
cp ~/projects/terminalweb/termux-boot.sh ~/.termux/boot/terminalweb.sh
chmod +x ~/.termux/boot/terminalweb.sh
```

## Configuration

Edit `settings.json` (server reads it at startup; the Settings panel in the UI writes it):

```jsonc
{
  "port": 8080,
  "token": "",              // optional: set to require a token on first visit
  "defaultProfile": "bash",
  "profiles": [
    { "id": "bash", "name": "bash", "icon": "🐚", "command": "bash", "cwd": "~", "scheme": "One Half Dark" }
  ],
  "schemes": {},            // custom color schemes (name -> {background, foreground, cursor, selectionBackground, black, red, green, yellow, blue, magenta, cyan, white, brightBlack, ...})
  "theme": { "mode": "dark", "opacity": 1.0, "backgroundImage": "" },
  "font": { "family": "monospace", "size": 14, "lineHeight": 1.2, "ligatures": true, "cursorStyle": "block", "cursorBlink": false },
  "scrollback": 10000,
  "keybindings": {},        // e.g. { "ctrl+shift+t": "newTab" } — overrides defaults
  "bell": { "visual": true, "audio": false }
}
```

## Keybindings (defaults)

| Shortcut | Action |
|---|---|
| Ctrl+Shift+T | New tab |
| Ctrl+Shift+W | Close tab |
| Ctrl+Shift+D | Split pane |
| Ctrl+Shift+P | Command palette |
| Ctrl+Shift+F | Search |
| Ctrl+Shift+C / V | Copy / Paste |
| Ctrl+Shift+E | Export buffer |
| Alt+←/→/↑/↓ | Focus pane |
| Ctrl+Shift+1..9 | Switch tab |

## Architecture

```
server/
  index.js     HTTP + WebSocket entry, token auth, graceful shutdown
  pty.js       PTY spawn — tmux-backed (POSIX) or direct shell via ConPTY (Windows)
  shells.js    Windows shell resolution (pwsh / PowerShell / cmd, PATH lookup)
  sessions.js  session attach/detach/kill/list
  api.js       REST: /api/health /api/settings /api/sessions /api/session/:id
  config.js    settings.json merge with defaults (platform-aware profiles)
  tmux.conf    tmux options (status off, mouse on, xterm-256color)
public/
  index.html, manifest.json, sw.js, css/app.css
  icons/       PWA icons (192, 512, maskable)
  js/          app.js (tabs/splits/actions), terminal.js (xterm build),
               sessions.js (WS client w/ backoff reconnect), themes.js,
               keybindings.js, palette.js, settings.js, touchbar.js, util.js
  vendor/      local xterm bundles (no CDN)
scripts/vendor.js   copies xterm bundles from node_modules
```

## Troubleshooting

- **Blank terminal / WebGL issues**: renderer falls back to canvas/DOM automatically.
- **Port in use**: `start.sh` / `start.ps1` detects it and assumes the server is running.
- **Server log**: `~/.terminalweb/server.log`.
- **Windows**: requires Node 18+ (node-pty ships prebuilt ConPTY binaries). If the terminal opens but shows prompt only, check `~/.terminalweb/server.err.log`. Custom profiles on Windows must use a real shell (pwsh, powershell, cmd, wsl, ...).
- **Ligatures**: `@xterm/addon-ligatures` is ESM-only and desktop-oriented, so the toggle is a no-op; font falls back to monospace.
- **Scrollback on reconnect**: tmux `history-limit 0` means xterm.js owns scrollback; buffer resets on reconnect (accepted trade-off).

## Security

- Binds `127.0.0.1` only.
- Optional `token` in settings.json: when set, first visit prompts for the token (stored in sessionStorage); WebSocket authenticated via query parameter.