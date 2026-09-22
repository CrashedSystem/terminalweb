'use strict';
/**
 * pty.js — node-pty wrapper.
 * POSIX: each session spawns a tmux client: `tmux new-session -A -s tw-<id>`.
 *   - New session: tmux creates it and runs the profile shell.
 *   - Existing session (server restart / reconnect): -A re-attaches.
 *   - Killing the pty (client) only detaches; the tmux session survives.
 * Windows: tmux is unavailable, so the profile shell (pwsh/powershell/cmd)
 *   is spawned directly via ConPTY. Sessions live only as long as the server
 *   process — no cross-restart persistence on win32.
 */
const os = require('os');
const path = require('path');
const pty = require('node-pty');
const shells = require('./shells');

const IS_WIN = shells.IS_WIN;
const TMUX_CONF = path.join(__dirname, 'tmux.conf');

function expandHome(p) {
  if (!p) return undefined;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** Spawn the profile shell directly (win32, no tmux). */
function spawnWinSession({ profile, cols, rows }) {
  let exe = shells.resolveWinShell(profile.command);
  if (!exe) exe = shells.resolveWinShell();
  const name = path.basename(exe.toLowerCase());
  const args = [];
  if (name.startsWith('pwsh') || name.startsWith('powershell')) args.push('-NoLogo');
  const env = { ...process.env, TERM: 'xterm-256color', ...(profile.env || {}) };
  const cwd = expandHome(profile.cwd) || os.homedir();
  return pty.spawn(exe, args, { name: 'xterm-256color', cols, rows, cwd, env });
}

/**
 * Spawn a tmux-backed PTY for a session.
 * @param {object} opts { id, profile, cols, rows }
 * @returns node-pty process
 */
function spawnSession({ id, profile, cols, rows }) {
  if (IS_WIN) return spawnWinSession({ profile, cols, rows });

  const tmuxName = `tw-${id}`;
  const shell = profile.command || 'bash';
  const args = [
    '-f', TMUX_CONF,
    'new-session', '-A',
    '-s', tmuxName,
    '-x', String(cols),
    '-y', String(rows),
    shell,
  ];
  const env = { ...process.env, TERM: 'xterm-256color', ...(profile.env || {}) };
  const cwd = expandHome(profile.cwd) || os.homedir();

  return pty.spawn('tmux', args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env,
  });
}

function resize(p, cols, rows) {
  try {
    p.resize(cols, rows);
  } catch (e) {
    /* pty already dead */
  }
}

module.exports = { spawnSession, resize, supportsTmux: !IS_WIN };