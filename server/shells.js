'use strict';
/**
 * shells.js — cross-platform shell resolution.
 * - win32: pick the first available shell (pwsh → Windows PowerShell → cmd),
 *   resolving profile.command even when it names an unavailable binary (e.g. bash).
 * - POSIX: not used (tmux + profile.command path continues to work as-is).
 */
const fs = require('fs');
const path = require('path');

const IS_WIN = process.platform === 'win32';

const WIN_CANDIDATES = [
  { id: 'pwsh', name: 'PowerShell 7', icon: '>_', exe: () => {
    const pf = process.env.ProgramFiles;
    return pf ? path.join(pf, 'PowerShell', '7', 'pwsh.exe') : null;
  } },
  { id: 'windows-powershell', name: 'Windows PowerShell 5', icon: '>_', exe: () =>
    path.join(process.env.windir || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') },
  { id: 'cmd', name: 'Command Prompt', icon: 'C>', exe: () =>
    path.join(process.env.windir || 'C:\\Windows', 'System32', 'cmd.exe') },
];

function findInPath(name, exts) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const suffixes = exts || (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const base = path.extname(name) ? [name] : suffixes.map((e) => name + e);
  for (const dir of dirs) {
    for (const cand of base) {
      const p = path.join(dir, cand);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * Resolve an executable for a shell command on win32.
 * Returns absolute path if found, null otherwise.
 * @param {string|undefined} cmd profile.command, or undefined for platform default
 */
function resolveWinShell(cmd) {
  if (!IS_WIN) return null;
  const requested = cmd ? String(cmd) : '';
  if (requested) {
    if (path.isAbsolute(requested)) return fs.existsSync(requested) ? requested : null;
    let found = findInPath(requested);
    if (found) return found;
    if (requested.toLowerCase() === 'pwsh') {
      const p = WIN_CANDIDATES[0].exe();
      if (p && fs.existsSync(p)) return p;
    }
    return null;
  }
  for (const cand of WIN_CANDIDATES) {
    const exe = cand.exe();
    if (exe && fs.existsSync(exe)) return exe;
  }
  return path.join(process.env.windir || 'C:\\Windows', 'System32', 'cmd.exe');
}

/** Available win32 shell profiles ({id,name,icon,command,cwd,scheme}). */
function winProfiles() {
  if (!IS_WIN) return [];
  return WIN_CANDIDATES
    .filter((c) => { const exe = c.exe(); return exe && fs.existsSync(exe); })
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, command: c.exe(), cwd: '~', scheme: 'Campbell' }));
}

module.exports = { IS_WIN, resolveWinShell, winProfiles, findInPath };