'use strict';
/* touchbar.js — mobile on-screen keyboard: modifiers, navigation, shell symbols */

TW.touchbar = (() => {
  let sticky = null; // 'ctrl' | 'alt' | null

  const ROW1 = [
    { label: 'Esc', seq: '\x1b' },
    { label: 'Tab', seq: '\t' },
    { label: 'Ctrl', sticky: 'ctrl' },
    { label: 'Alt', sticky: 'alt' },
    { label: 'Home', seq: '\x1b[H', modSeq: '\x1b[1;5H', altSeq: '\x1b\x1b[H' },
    { label: 'End', seq: '\x1b[F', modSeq: '\x1b[1;5F', altSeq: '\x1b\x1b[F' },
    { label: 'PgUp', seq: '\x1b[5~', modSeq: '\x1b[5;5~', altSeq: '\x1b\x1b[5~' },
    { label: 'PgDn', seq: '\x1b[6~', modSeq: '\x1b[6;5~', altSeq: '\x1b\x1b[6~' },
    { label: 'Del', seq: '\x1b[3~', modSeq: '\x1b[3;5~', altSeq: '\x1b\x1b[3~' },
    { label: '⏎', seq: '\r' },
  ];

  // Arrow cluster — kept together on the bottom row so all four fit on screen.
  const ROW2 = [
    { label: '←', seq: '\x1b[D', modSeq: '\x1b[1;5D', altSeq: '\x1b\x1b[D' },
    { label: '↑', seq: '\x1b[A', modSeq: '\x1b[1;5A', altSeq: '\x1b\x1b[A' },
    { label: '↓', seq: '\x1b[B', modSeq: '\x1b[1;5B', altSeq: '\x1b\x1b[B' },
    { label: '→', seq: '\x1b[C', modSeq: '\x1b[1;5C', altSeq: '\x1b\x1b[C' },
  ];

  function send(seq) {
    const pane = TW.app.getActivePane();
    if (pane && pane.client) pane.client.sendInput(seq);
  }

  // Expose sticky state so software-keyboard input can honor Ctrl/Alt combos
  function getSticky() { return sticky; }
  function consumeSticky() {
    const s = sticky;
    if (s) { sticky = null; render(); }
    return s;
  }

  function makeKey(k) {
    const btn = TW.util.el('button', {
      class: 'tb-key',
      text: k.label,
      tabindex: -1,
    });
    btn.addEventListener('click', () => {
      if (k.sticky) {
        sticky = sticky === k.sticky ? null : k.sticky;
        updateStickyUI();
        flash(btn);
        refocusTerminal();
        return;
      }
      let seq = k.seq;
      if (sticky === 'ctrl' && k.modSeq) seq = k.modSeq;
      if (sticky === 'alt' && k.altSeq) seq = k.altSeq;
      sticky = null;
      updateStickyUI();
      send(seq);
      flash(btn);
      refocusTerminal();
    });
    if (k.sticky && sticky === k.sticky) btn.classList.add('sticky');
    return btn;
  }

  // Toggle the persistent highlight on sticky modifier keys only —
  // avoids re-rendering the whole bar (which would kill the press flash).
  function updateStickyUI() {
    document.querySelectorAll('.tb-key.sticky').forEach((b) => b.classList.remove('sticky'));
    if (!sticky) return;
    const label = sticky === 'ctrl' ? 'Ctrl' : 'Alt';
    const btn = [...document.querySelectorAll('.tb-key')].find((b) => b.textContent === label);
    if (btn) btn.classList.add('sticky');
  }

  // Brief highlight on any key press for tactile feedback.
  function flash(btn) {
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 300);
  }

  // Keep focus on the terminal so the software keyboard stays open.
  function refocusTerminal() {
    const pane = TW.app.getActivePane();
    if (pane && pane.term) {
      try { pane.term.focus(); } catch (e) { /* ignore */ }
    }
  }

  function render() {
    const bar = document.getElementById('touchbar');
    bar.innerHTML = '';
    // Prevent buttons from stealing focus (which would dismiss the keyboard)
    bar.addEventListener('pointerdown', (e) => e.preventDefault());
    const row1 = TW.util.el('div', { class: 'tb-row' });
    const row2 = TW.util.el('div', { class: 'tb-row' });
    ROW1.forEach((k) => row1.appendChild(makeKey(k)));
    ROW2.forEach((k) => row2.appendChild(makeKey(k)));
    bar.appendChild(row1);
    bar.appendChild(row2);
  }

  function show() {
    document.getElementById('touchbar').classList.remove('hidden');
    try { localStorage.setItem('terminalweb.touchbar', '1'); } catch (e) { /* ignore */ }
  }

  function hide() {
    document.getElementById('touchbar').classList.add('hidden');
    try { localStorage.setItem('terminalweb.touchbar', '0'); } catch (e) { /* ignore */ }
  }

  function toggle() {
    const bar = document.getElementById('touchbar');
    if (bar.classList.contains('hidden')) show();
    else hide();
  }

  function isVisible() {
    return !document.getElementById('touchbar').classList.contains('hidden');
  }

  function isTouchPrimary() {
    // Phone/tablet-like: primary pointer is coarse AND hover is not supported.
    // Touchscreen laptops (fine pointer) are treated as desktop — no touchbar.
    return !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }

  function init() {
    render();
    if (!isTouchPrimary()) {
      // Desktop: physical keyboard is the input device — the on-screen keys only
      // waste space. Stay hidden unconditionally (the ⌨ button still toggles it).
      hide();
      return;
    }
    // Mobile: restore the user's last-choice (default: shown).
    let stored = null;
    try { stored = localStorage.getItem('terminalweb.touchbar'); } catch (e) { /* ignore */ }
    if (stored === '0') hide();
  }

  return { init, show, hide, toggle, isVisible, render, getSticky, consumeSticky };
})();