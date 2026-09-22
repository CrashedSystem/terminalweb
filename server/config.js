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

/** On win32, ensure native shell profiles exist and defaultProfile points at a real shell. */
function finalizeWin(cfg) {
  const winProfiles = shells.winProfiles();
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

function save(settings) {
  const json = JSON.stringify(settings, null, 2);
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