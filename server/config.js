'use strict';
/**
 * config.js — settings load/merge/save + profile resolution.
 * User settings live in settings.json (project root), merged over defaults.
 * On win32 the defaults additionally expose native shells (pwsh / PowerShell / cmd)
 * and the default profile falls back to the first shell that actually exists.
 */
const fs = require('fs');
const path = require('path');
const shells = require('./shells');

const SETTINGS_PATH = path.join(__dirname, '..', 'settings.json');

const IS_WIN = shells.IS_WIN;

const DEFAULTS = {
  port: 8080,
  token: '',
  defaultProfile: IS_WIN ? 'pwsh' : 'bash',
  profiles: [
    { id: 'bash', name: 'bash', icon: '🐚', command: 'bash', cwd: '~', scheme: 'One Half Dark' },
    ...shells.winProfiles(),
  ],
  schemes: {},
  theme: { mode: 'dark', opacity: 1.0, backgroundImage: '' },
  font: { family: 'monospace', size: 14, lineHeight: 1.2, ligatures: true, cursorStyle: 'block', cursorBlink: false },
  scrollback: 10000,
  keybindings: {},
  bell: { visual: true, audio: false }
};

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    if (isPlainObject(v) && isPlainObject(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * On win32, resolve the auto-detected (runtime) shell profiles and make sure
 * defaultProfile points at a shell that actually exists.
 *
 * Runtime profiles are persisted in settings.json WITHOUT their executable
 * path (save() strips it — it is machine-specific), so the path is resolved
 * fresh from PATH here on every load. The user's edits to those profiles
 * (name / icon / cwd / scheme) survive the round-trip.
 */
function finalizeWin(cfg) {
  if (!Array.isArray(cfg.profiles)) return;
  const winProfiles = shells.winProfiles();
  const autoById = new Map(winProfiles.map((p) => [p.id, p]));

  // Re-resolve the executable for each runtime profile, and drop any whose
  // shell is no longer installed on this machine.
  cfg.profiles = cfg.profiles
    .filter((p) => !p || !p.runtime || autoById.has(p.id))
    .map((p) => {
      if (!p.runtime) return p;
      const auto = autoById.get(p.id);
      return { ...auto, ...p, command: auto.command };
    });

  // Every shell available on this machine needs a profile entry.
  for (const wp of winProfiles) {
    if (!cfg.profiles.some((p) => p.id === wp.id)) cfg.profiles.push(wp);
  }

  const def = cfg.profiles.find((p) => p.id === cfg.defaultProfile);
  if (!def || !shells.resolveWinShell(def.command)) {
    const fallback = winProfiles[0];
    if (fallback) {
      if (!cfg.profiles.some((p) => p.id === fallback.id)) cfg.profiles.push(fallback);
      cfg.defaultProfile = fallback.id;
    }
  }
}

function load() {
  let user = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      user = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch (e) {
      console.error(`[config] settings.json parse error: ${e.message}`);
    }
  }
  const cfg = deepMerge(DEFAULTS, user);
  if (IS_WIN) finalizeWin(cfg);
  return cfg;
}

/**
 * Persist settings.
 *
 * Auto-detected (runtime) shell profiles are KEPT — dropping them discarded
 * every user edit made to them (scheme, name, icon, cwd), which is why
 * changing the scheme of the default Windows profile never stuck. Only their
 * machine-specific `command` path is stripped; finalizeWin() re-resolves it
 * from PATH on the next load().
 */
function save(settings) {
  const clean = { ...settings };
  if (Array.isArray(clean.profiles)) {
    clean.profiles = clean.profiles.map((p) => {
      if (!p || !p.runtime) return p;
      const { command, ...rest } = p;
      return rest;
    });
  }
  const json = JSON.stringify(clean, null, 2);
  fs.writeFileSync(SETTINGS_PATH, json);
  return json;
}

function getProfile(id) {
  const cfg = load();
  if (id) {
    const p = cfg.profiles.find((x) => x.id === id);
    if (p) return p;
  }
  return (
    cfg.profiles.find((x) => x.id === cfg.defaultProfile) ||
    cfg.profiles[0] ||
    DEFAULTS.profiles[0]
  );
}

module.exports = { load, save, getProfile, DEFAULTS, SETTINGS_PATH };