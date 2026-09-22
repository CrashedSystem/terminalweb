'use strict';
/* keybindings.js — Windows Terminal-style chord keybinding engine */

TW.keybindings = (() => {
  // Default bindings (Windows Terminal conventions)
  const DEFAULTS = {
    'ctrl+shift+t': 'newTab',
    'ctrl+shift+w': 'closeTab',
    'ctrl+shift+p': 'commandPalette',
    'ctrl+shift+f': 'search',
    'ctrl+shift+c': 'copy',
    'ctrl+shift+v': 'paste',
    'ctrl+shift+s': 'sessionsList',
    'ctrl+shift+o': 'settings',
    'ctrl+shift+e': 'exportBuffer',
    'ctrl+shift+d': 'splitVertical',
    'ctrl+shift+alt+arrowup': 'splitHorizontal',
    'alt+shift+-': 'splitHorizontal',
    'alt+shift+d': 'splitVertical',
    'alt+arrowleft': 'focusLeft',
    'alt+arrowright': 'focusRight',
    'alt+arrowup': 'focusUp',
    'alt+arrowdown': 'focusDown',
    'ctrl+shift+arrowleft': 'prevTab',
    'ctrl+shift+arrowright': 'nextTab',
    'ctrl+shift+1': 'tab1', 'ctrl+shift+2': 'tab2', 'ctrl+shift+3': 'tab3',
    'ctrl+shift+4': 'tab4', 'ctrl+shift+5': 'tab5', 'ctrl+shift+6': 'tab6',
    'ctrl+shift+7': 'tab7', 'ctrl+shift+8': 'tab8', 'ctrl+shift+9': 'tab9',
    'ctrl+=': 'increaseFont',
    'ctrl++': 'increaseFont',
    'ctrl+-': 'decreaseFont',
    'ctrl+0': 'resetFont',
    'ctrl+shift+k': 'killSession',
    'ctrl+shift+r': 'reconnect',
  };

  // Parse "ctrl+shift+t" → { ctrl:true, shift:true, alt:false, meta:false, key:'t' }
  function parse(chord) {
    const parts = chord.toLowerCase().split('+');
    const spec = { ctrl: false, shift: false, alt: false, meta: false, key: '' };
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        spec.key = p;
      } else if (p === 'ctrl' || p === 'control') spec.ctrl = true;
      else if (p === 'shift') spec.shift = true;
      else if (p === 'alt' || p === 'option') spec.alt = true;
      else if (p === 'meta' || p === 'cmd' || p === 'super') spec.meta = true;
    }
    return spec;
  }

  function matchesEvent(e, spec) {
    if (e.ctrlKey !== spec.ctrl) return false;
    if (e.shiftKey !== spec.shift) return false;
    if (e.altKey !== spec.alt) return false;
    if (e.metaKey !== spec.meta) return false;
    const key = (e.key || '').toLowerCase();
    // Normalize: '-' key with shift → '+' sometimes; compare raw and shifted forms
    if (key === spec.key) return true;
    // Handle numpad / punctuation aliases
    if (spec.key === '+' && (key === '+' || key === '=')) return true;
    if (spec.key === '-' && (key === '-' || key === '_')) return true;
    return false;
  }

  function getBindings(settings) {
    const merged = { ...DEFAULTS, ...(settings.keybindings || {}) };
    // Pre-parse each chord once
    const parsed = [];
    for (const [chord, action] of Object.entries(merged)) {
      parsed.push({ spec: parse(chord), action, chord });
    }
    return parsed;
  }

  function handleKeydown(e, settings) {
    const bindings = getBindings(settings);
    for (const b of bindings) {
      if (matchesEvent(e, b.spec)) {
        e.preventDefault();
        e.stopPropagation();
        return b.action;
      }
    }
    return null;
  }

  function defaults() {
    return { ...DEFAULTS };
  }

  return { DEFAULTS, parse, matchesEvent, getBindings, handleKeydown, defaults };
})();