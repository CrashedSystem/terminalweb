'use strict';
/* app.js — bootstrap, tabs, split panes, actions, mobile handling */

TW.app = (() => {
  const state = {
    settings: null,
    tabs: [],
    activeTabId: null,
    activePaneId: null,
  };

  /* ---------- helpers ---------- */

  function getSettings() { return state.settings; }
  function getActiveTab() { return state.tabs.find((t) => t.id === state.activeTabId) || null; }
  function getActivePane() {
    const tab = getActiveTab();
    if (!tab) return null;
    return findPane(tab.root, tab.activePaneId);
  }
  function findPane(node, paneId) {
    if (node.type === 'pane') return node.pane.id === paneId ? node.pane : null;
    for (const c of node.children) {
      const r = findPane(c, paneId);
      if (r) return r;
    }
    return null;
  }
  function getProfile(id) {
    const profiles = (state.settings && state.settings.profiles) || [];
    return profiles.find((p) => p.id === id) || profiles[0] || { id: 'bash', name: 'bash', command: 'bash', scheme: 'One Half Dark' };
  }
  function allPanes(tab) {
    const out = [];
    (function walk(node) {
      if (node.type === 'pane') out.push(node.pane);
      else node.children.forEach(walk);
    })(tab.root);
    return out;
  }

  /* ---------- pane tree ---------- */

  function getPath(node, paneId, trail = []) {
    if (node.type === 'pane') return node.pane.id === paneId ? trail : null;
    for (let i = 0; i < node.children.length; i++) {
      const res = getPath(node.children[i], paneId, trail.concat([node]));
      if (res) return res;
    }
    return null;
  }
  function containsPane(node, paneId) {
    if (node.type === 'pane') return node.pane.id === paneId;
    return node.children.some((c) => containsPane(c, paneId));
  }
  function childIndex(node, paneId) {
    return node.children.findIndex((c) => (c.type === 'pane' ? c.pane.id === paneId : containsPane(c, paneId)));
  }
  function firstPane(node) {
    if (node.type === 'pane') return node.pane;
    return firstPane(node.children[0]);
  }

  /* ---------- layout DOM ---------- */

  function applyRatio(node) {
    if (!node.dom) return;
    node.dom.slotA.style.flexGrow = String(node.ratio);
    node.dom.slotB.style.flexGrow = String(1 - node.ratio);
  }

  function attachDivider(node) {
    const { root, divider } = node.dom;
    divider.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      divider.setPointerCapture(e.pointerId);
      const start = node.dir === 'h' ? e.clientX : e.clientY;
      const startRatio = node.ratio;
      const move = (ev) => {
        const pos = node.dir === 'h' ? ev.clientX : ev.clientY;
        const total = node.dir === 'h' ? root.clientWidth : root.clientHeight;
        if (total <= 0) return;
        let r = startRatio + (pos - start) / total;
        r = Math.min(0.85, Math.max(0.15, r));
        node.ratio = r;
        applyRatio(node);
      };
      const up = () => {
        divider.removeEventListener('pointermove', move);
        divider.removeEventListener('pointerup', up);
        divider.classList.remove('dragging');
        fitAll();
      };
      divider.addEventListener('pointermove', move);
      divider.addEventListener('pointerup', up);
      divider.classList.add('dragging');
    });
  }

  function buildNode(node, tab) {
    if (node.type === 'pane') {
      const slot = TW.util.el('div', { class: 'pane-slot' });
      slot.appendChild(node.pane.container);
      return slot;
    }
    const root = TW.util.el('div', { class: 'pane-tree split-' + node.dir });
    const slotA = TW.util.el('div', { class: 'pane-slot' });
    const slotB = TW.util.el('div', { class: 'pane-slot' });
    slotA.appendChild(buildNode(node.children[0], tab));
    slotB.appendChild(buildNode(node.children[1], tab));
    const divider = TW.util.el('div', { class: 'pane-divider' });
    node.dom = { root, slotA, slotB, divider };
    root.appendChild(slotA);
    root.appendChild(divider);
    root.appendChild(slotB);
    attachDivider(node);
    applyRatio(node);
    return root;
  }

  function rebuildTab(tab) {
    tab.dom.innerHTML = '';
    tab.dom.appendChild(buildNode(tab.root, tab));
    requestAnimationFrame(() => fitTab(tab));
  }

  /* ---------- session persistence (localStorage) ---------- */

  const LS_KEY = 'terminalweb.sessions';
  function storedSessions() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function storeSession(id) {
    if (!id) return;
    const list = storedSessions();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    }
  }
  function unstoreSession(id) {
    if (!id) return;
    const list = storedSessions().filter((s) => s !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  /* ---------- pane lifecycle ---------- */

  function createPane(tab, profileId, sessionId) {
    const profile = getProfile(profileId);
    const pane = {
      id: TW.util.uuid(),
      tabId: tab.id,
      profileId,
      sessionId: sessionId || null,
      status: 'connecting',
      title: '',
      container: null,
      overlay: null,
      bell: null,
      term: null,
      fitAddon: null,
      searchAddon: null,
      serializeAddon: null,
      client: null,
      ro: null,
    };

    const container = TW.util.el('div', { class: 'pane-container' });
    const host = TW.util.el('div', { class: 'xterm-host' });
    const bell = TW.util.el('div', { class: 'pane-bell' });
    const overlay = TW.util.el('div', { class: 'pane-overlay hidden' });
    container.appendChild(host);
    container.appendChild(bell);
    container.appendChild(overlay);
    // Acrylic (transparent terminal over the workspace background image)
    const opacity = Number(state.settings.theme.opacity != null ? state.settings.theme.opacity : 1);
    container.classList.toggle('acrylic', opacity < 1);
    pane.container = container;
    pane.bell = bell;
    pane.overlay = overlay;

    const created = TW.terminal.create(host, state.settings, profile.scheme);
    pane.term = created.term;
    pane.fitAddon = created.fitAddon;
    pane.searchAddon = created.searchAddon;
    pane.serializeAddon = created.serializeAddon;

    pane.term.onData((data) => {
      // Honor sticky Ctrl/Alt from the touchbar for software-keyboard input
      const mod = TW.touchbar.getSticky();
      if (mod && data.length === 1) {
        const c = data.charCodeAt(0);
        if (c >= 0x20 && c < 0x7f) { // printable ASCII only
          TW.touchbar.consumeSticky();
          if (mod === 'ctrl') data = String.fromCharCode(c & 0x1f);
          else data = '\x1b' + data;
        }
      }
      if (pane.client) pane.client.sendInput(data);
    });
    pane.term.onResize(({ cols, rows }) => { if (pane.client) pane.client.resize(cols, rows); });
    pane.term.onTitleChange((title) => {
      pane.title = title;
      renderTabbar();
    });
    pane.term.onBell(() => {
      if (state.settings.bell.visual) ringBell(pane);
      if (state.settings.bell.audio) beep();
      // A bell char always raises an OS notification — even with the tab
      // focused/visible (matches the old termux-api alerts).
      notifyBell(pane);
    });
    pane.term.onSelectionChange(() => {
      if (pane.term.hasSelection()) TW.util.copyText(pane.term.getSelection());
    });
    // Touch drag → rectangular selection (xterm itself only does mouse-drag
    // selection; on mobile the gesture is consumed as scroll). We translate
    // pointer events to cell coordinates and feed them to term.select(), so a
    // finger drag both selects AND auto-copies via the onSelectionChange above.
    let touchDrag = null;
    function cellAt(clientX, clientY) {
      const dim = pane.term.dimensions;
      const r = container.getBoundingClientRect();
      return {
        col: Math.max(0, Math.min(dim.cols - 1, Math.floor((clientX - r.left) / dim.actualCellWidth))),
        row: Math.max(0, Math.min(dim.rows - 1, Math.floor((clientY - r.top) / dim.actualCellHeight))),
      };
    }
    container.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return; // mouse keeps xterm's native drag
      if (e.button !== 0 && e.pointerType === 'touch') return;
      touchDrag = { a: cellAt(e.clientX, e.clientY), live: true };
      container.setPointerCapture(e.pointerId);
    });
    container.addEventListener('pointermove', (e) => {
      if (!touchDrag || !touchDrag.live || e.pointerType !== 'touch') return;
      const b = cellAt(e.clientX, e.clientY);
      const cols = pane.term.dimensions.cols, rows = pane.term.dimensions.rows;
      const x1 = Math.min(touchDrag.a.col, b.col), x2 = Math.max(touchDrag.a.col, b.col);
      const y1 = Math.min(touchDrag.a.row, b.row), y2 = Math.max(touchDrag.a.row, b.row);
      pane.term.select(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
    });
    const endTouchDrag = (e) => {
      if (!touchDrag || e.pointerType !== 'touch') return;
      touchDrag.live = false;
      touchDrag = null;
    };
    container.addEventListener('pointerup', endTouchDrag);
    container.addEventListener('pointercancel', endTouchDrag);

    container.addEventListener('pointerdown', () => { setActivePane(tab, pane, false); });
    // Touch drag → rectangular selection + auto-copy. xterm's own *mouse*
    // drag already selects (and our onSelectionChange above copies). But a
    // finger drag is consumed by the browser as a scroll, so we translate
    // pointer events to cell coordinates and feed them to pane.term.select(),
    // which fires onSelectionChange → auto-copy. Works for both rect drag and
    // plain touch-tap (tap = 1×1 cell, still copied).
    let touchAnchor = null;
    function cellAtPx(clientX, clientY) {
      const d = pane.term.dimensions;
      const r = container.getBoundingClientRect();
      const col = Math.max(0, Math.min(d.cols - 1, Math.floor((clientX - r.left) / d.actualCellWidth)));
      const row = Math.max(0, Math.min(d.rows - 1, Math.floor((clientY - r.top) / d.actualCellHeight)));
      return { col, row };
    }
    container.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return; // mouse = xterm's native drag
      touchAnchor = cellAtPx(e.clientX, e.clientY);
      try { container.setPointerCapture(e.pointerId); } catch (_) {}
    });
    container.addEventListener('pointermove', (e) => {
      if (!touchAnchor || e.pointerType !== 'touch') return;
      const b = cellAtPx(e.clientX, e.clientY);
      const x1 = Math.min(touchAnchor.col, b.col), x2 = Math.max(touchAnchor.col, b.col);
      const y1 = Math.min(touchAnchor.row, b.row), y2 = Math.max(touchAnchor.row, b.row);
      pane.term.select(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
    });
    const clearTouchAnchor = () => { touchAnchor = null; };
    container.addEventListener('pointerup', clearTouchAnchor);
    container.addEventListener('pointercancel', clearTouchDrag);
    
attachPinch(container, pane);

    // Session client callbacks
    pane.onOutput = (data) => pane.term.write(data);
    pane.onExit = (code) => {
      pane.status = 'ended';
      pane.term.options.disableStdin = true;
      updateOverlay(pane);
    };
    pane.onStatus = (status) => {
      pane.status = status;
      updateOverlay(pane);
    };
    pane.onSessionId = (id) => {
      pane.sessionId = id;
      storeSession(id);
    };

    pane.client = TW.sessions.connect(pane, {
      sessionId,
      profileId,
      cols: 80,
      rows: 24,
    });
    pane.client.connect();

    const ro = new ResizeObserver(TW.util.debounce(() => TW.terminal.fit(pane), 60));
    ro.observe(container);
    pane.ro = ro;

    return pane;
  }

  function destroyPane(pane) {
    unstoreSession(pane.sessionId);
    try { if (pane.client) pane.client.kill(); } catch (e) { /* ignore */ }
    try { if (pane.client) pane.client.close(); } catch (e) { /* ignore */ }
    try { if (pane.ro) pane.ro.disconnect(); } catch (e) { /* ignore */ }
    try { if (pane.term) pane.term.dispose(); } catch (e) { /* ignore */ }
    if (pane.container && pane.container.parentNode) pane.container.parentNode.removeChild(pane.container);
  }

  function updateOverlay(pane) {
    const ov = pane.overlay;
    ov.innerHTML = '';
    if (pane.status === 'connected') {
      ov.classList.add('hidden');
      return;
    }
    ov.classList.remove('hidden');
    let title = 'Connecting...';
    let sub = '';
    if (pane.status === 'reconnecting') {
      title = 'Reconnecting...';
      sub = 'Session preserved on server';
    } else if (pane.status === 'ended') {
      title = 'Session ended';
      sub = 'The shell process has exited';
    } else if (pane.status === 'error') {
      title = 'Connection error';
    }
    ov.appendChild(TW.util.el('div', { class: 'ov-title', text: title }));
    if (sub) ov.appendChild(TW.util.el('div', { class: 'ov-sub', text: sub }));
    if (pane.status === 'ended' || pane.status === 'error') {
      const actions = TW.util.el('div', { class: 'ov-actions' });
      const reconnect = TW.util.el('button', { class: 'btn primary', text: 'Reconnect' });
      reconnect.addEventListener('click', () => reconnectPane(pane));
      const close = TW.util.el('button', { class: 'btn', text: 'Close' });
      close.addEventListener('click', () => {
        if (confirmClose(pane.title || '세션')) closePane(getActiveTab(), pane);
      });
      actions.appendChild(reconnect);
      actions.appendChild(close);
      ov.appendChild(actions);
    }
  }

  function ringBell(pane) {
    pane.bell.classList.remove('ringing');
    void pane.bell.offsetWidth;
    pane.bell.classList.add('ringing');
  }

  /* OS-native notification when the bell rings.
     Uses the Service Worker showNotification() path when available (survives
     the page being backgrounded and works from an installed PWA), falling
     back to the direct Notification constructor. Clicking the SW notification
     reopens/focuses the app via the global 'focus-pane' message listener. */
  function notifyBell(pane) {
    const title = (pane.title && pane.title !== '' ? pane.title : 'terminal') + '';
    const body = 'Bell — terminal wants your attention';
    const icon = new URL(state.settings.theme.backgroundImage || 'images/miku.png', location.href).href;
    try {
      if (!('Notification' in window)) return; // unsupported (private mode / iOS)
      if (Notification.permission !== 'granted') {
        if (Notification.permission === 'default') {
          try {
            const p = Notification.requestPermission();
            if (p && p.catch) p.catch(() => { /* ignore */ });
          } catch (e) { /* ignore */ }
        }
        return; // can't show before permission is granted
      }
      const notifyOpts = {
        body,
        tag: `bell-${pane.id}`,
        icon,
        renotify: true,
        data: { paneId: pane.id },
      };
      const swReady = navigator.serviceWorker && navigator.serviceWorker.ready;
      const viaPage = () => {
        const n = new Notification(`${TW.util.projectName} ▸ ${title}`, {
          body,
          tag: `bell-${pane.id}`,
          icon,
          renotify: true,
        });
        n.addEventListener('click', () => {
          n.close();
          window.focus();
          const tab = state.tabs.find((t) => t.id === state.activeTabId);
          if (tab) setActivePane(tab, pane);
        });
        setTimeout(() => n.close(), 8000);
      };
      if (swReady) {
        swReady.then((reg) => reg.showNotification(`${TW.util.projectName} ▸ ${title}`, notifyOpts)).catch(() => viaPage());
      } else {
        viaPage();
      }
    } catch (e) {
      // Notifications unsupported — silently skip.
    }
  }

  let audioCtx = null;
  // Autoplay policy: a fresh AudioContext stays suspended until the user
  // interacts. Reuse one shared context and resume it on the first
  // touch/keypress so later beeps are actually audible.
  function unlockAudio() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.frequency.value = 880;
      o.type = 'sine';
      g.gain.setValueAtTime(0.06, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      o.start();
      o.stop(audioCtx.currentTime + 0.15);
    } catch (e) { /* audio unavailable */ }
  }

  /* ---------- tabs ---------- */

  function newTab(profileId, sessionId) {
    const tab = {
      id: TW.util.uuid(),
      title: 'Terminal',
      root: null,
      activePaneId: null,
      dom: null,
    };
    state.tabs.push(tab);
    const pane = createPane(tab, profileId || state.settings.defaultProfile, sessionId);
    tab.root = { type: 'pane', pane };
    tab.activePaneId = pane.id;
    tab.dom = TW.util.el('div', { class: 'tab-view', dataset: { tabId: tab.id } });
    tab.dom.appendChild(buildNode(tab.root, tab));
    document.getElementById('workspace').appendChild(tab.dom);
    renderTabbar();
    setActiveTab(tab.id);
    requestAnimationFrame(() => TW.terminal.fit(pane));
    return tab;
  }

  function setActiveTab(tabId) {
    state.activeTabId = tabId;
    state.tabs.forEach((t) => {
      const active = t.id === tabId;
      t.dom.classList.toggle('active', active);
      if (active) fitTab(t);
    });
    renderTabbar();
  }

  // Accidental ✕ / menu taps kill running shells — make destructive closes
  // require explicit confirmation. Returns true when the user accepts.
  function confirmClose(label) {
    const s = String(label || '세션');
    const name = s.length > 24 ? s.slice(0, 24) + '…' : s;
    return window.confirm(`"${name}" 닫을까요?\n실행 중인 셸 세션 작업이 종료됩니다.`);
  }

  function closeTab(tab) {
    if (!tab) return;
    const idx = state.tabs.indexOf(tab);
    allPanes(tab).forEach(destroyPane);
    tab.dom.remove();
    state.tabs.splice(idx, 1);
    if (state.tabs.length === 0) {
      state.activeTabId = null;
      state.activePaneId = null;
      renderTabbar();
      return;
    }
    const next = state.tabs[Math.min(idx, state.tabs.length - 1)];
    setActiveTab(next.id);
  }

  function closePane(tab, pane) {
    if (!tab || !pane) return;
    if (tab.root.type === 'pane' && tab.root.pane.id === pane.id) {
      closeTab(tab);
      return;
    }
    const path = getPath(tab.root, pane.id);
    const parent = path[path.length - 1];
    const idx = childIndex(parent, pane.id);
    const sibling = parent.children[idx === 0 ? 1 : 0];
    if (path.length === 1) {
      tab.root = sibling;
    } else {
      const grand = path[path.length - 2];
      grand.children[grand.children.indexOf(parent)] = sibling;
    }
    destroyPane(pane);
    rebuildTab(tab);
    const fp = firstPane(sibling);
    if (fp) setActivePane(tab, fp);
  }

  function splitPane(tab, pane, dir) {
    if (!tab || !pane) return;
    const newPane = createPane(tab, pane.profileId, null);
    const newNode = { type: 'pane', pane: newPane };
    const path = getPath(tab.root, pane.id);
    if (path.length === 0) {
      tab.root = { type: 'split', dir, ratio: 0.5, children: [{ type: 'pane', pane }, newNode] };
    } else {
      const parent = path[path.length - 1];
      const idx = childIndex(parent, pane.id);
      const split = { type: 'split', dir, ratio: 0.5, children: [parent.children[idx], newNode] };
      parent.children[idx] = split;
    }
    rebuildTab(tab);
    setActivePane(tab, newPane);
  }

  function setActivePane(tab, pane, focus = true) {
    tab.activePaneId = pane.id;
    state.activePaneId = pane.id;
    allPanes(tab).forEach((p) => p.container.classList.toggle('focused', p.id === pane.id));
    if (focus) pane.term.focus();
  }

  function navigate(tab, paneId, dir) {
    const path = getPath(tab.root, paneId);
    for (let i = path.length - 1; i >= 0; i--) {
      const node = path[i];
      const isH = dir === 'left' || dir === 'right';
      if (node.type === 'split' && (isH ? node.dir === 'h' : node.dir === 'v')) {
        const idx = childIndex(node, paneId);
        const next = isH ? (dir === 'left' ? idx - 1 : idx + 1) : (dir === 'up' ? idx - 1 : idx + 1);
        if (next >= 0 && next < node.children.length) {
          const fp = firstPane(node.children[next]);
          if (fp) setActivePane(tab, fp);
          return;
        }
      }
    }
  }

  /* ---------- fit ---------- */

  function fitTab(tab) {
    allPanes(tab).forEach((p) => TW.terminal.fit(p));
  }
  function fitAll() {
    state.tabs.forEach((t) => {
      if (t.id === state.activeTabId) fitTab(t);
    });
  }

  /* ---------- actions ---------- */

  function reconnectPane(pane) {
    try { if (pane.client) pane.client.close(); } catch (e) { /* ignore */ }
    pane.term.options.disableStdin = false;
    pane.client = TW.sessions.connect(pane, {
      sessionId: pane.sessionId,
      profileId: pane.profileId,
      cols: pane.term.cols,
      rows: pane.term.rows,
    });
    pane.client.connect();
  }

  function killPane(pane) {
    const tab = state.tabs.find((t) => t.id === pane.tabId);
    closePane(tab, pane);
  }

  function exportBuffer() {
    const pane = getActivePane();
    if (!pane || !pane.serializeAddon) return;
    const text = pane.serializeAddon.serialize();
    TW.util.download(`terminal-${Date.now()}.txt`, text);
    TW.util.toast('Buffer exported');
  }

  async function copySelection() {
    const pane = getActivePane();
    if (pane && pane.term.hasSelection()) {
      await TW.util.copyText(pane.term.getSelection());
      TW.util.toast('Copied');
    }
  }

  async function pasteClipboard() {
    const pane = getActivePane();
    if (!pane) return;
    const text = await TW.util.readClipboard();
    if (text != null) pane.term.paste(text);
  }

  function changeFontSize(delta) {
    state.settings.font.size = Math.min(32, Math.max(8, Number(state.settings.font.size || 14) + delta));
    allPanes(getActiveTab() || { root: null }).forEach((p) => {
      if (p.term) p.term.options.fontSize = state.settings.font.size;
    });
    fitAll();
  }

  function setScheme(name) {
    const tab = getActiveTab();
    if (!tab) return;
    allPanes(tab).forEach((p) => {
      const profile = getProfile(p.profileId);
      profile.scheme = name;
      TW.terminal.applySettings(p.term, state.settings, name);
    });
    fitAll();
    TW.util.toast('Scheme: ' + name);
  }

  function toggleTheme() {
    state.settings.theme.mode = state.settings.theme.mode === 'dark' ? 'light' : 'dark';
    TW.themes.applyUiTheme(state.settings.theme);
    TW.util.toast('Theme: ' + state.settings.theme.mode);
  }

  /* ---------- search ---------- */

  function toggleSearch() {
    const bar = document.getElementById('searchbar');
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden')) {
      const inp = document.getElementById('search-input');
      inp.value = '';
      inp.focus();
    } else {
      getActivePane() && getActivePane().term.focus();
    }
  }

  function doSearch(backwards) {
    const pane = getActivePane();
    if (!pane || !pane.searchAddon) return;
    const q = document.getElementById('search-input').value;
    if (!q) return;
    const opts = {
      regex: document.getElementById('search-regex').checked,
      caseSensitive: document.getElementById('search-case').checked,
      wholeWord: document.getElementById('search-word').checked,
      incremental: true,
    };
    try {
      if (backwards) pane.searchAddon.findPrevious(q, opts);
      else pane.searchAddon.findNext(q, opts);
    } catch (e) { /* invalid regex */ }
  }

  /* ---------- command palette ---------- */

  function openPalette() {
    const tab = getActiveTab();
    const pane = getActivePane();
    const commands = [
      { icon: '▸', title: 'New Tab', action: () => newTab(state.settings.defaultProfile) },
    ];
    (state.settings.profiles || []).forEach((p) => {
      commands.push({
        icon: p.icon || '▸',
        title: 'New Tab: ' + p.name,
        sub: p.command,
        action: () => newTab(p.id),
      });
    });
    commands.push(
      { icon: '▤', title: 'Sessions...', action: openSessionsList },
      { icon: '⇅', title: 'Split Horizontal', action: () => splitPane(tab, pane, 'v') },
      { icon: '⇄', title: 'Split Vertical', action: () => splitPane(tab, pane, 'h') },
      { icon: '✕', title: 'Close Pane', action: () => { if (confirmClose('Pane')) closePane(tab, pane); } },
      { icon: '✕', title: 'Close Tab', action: () => { if (confirmClose('Tab')) closeTab(tab); } },
      { icon: '◀', title: 'Previous Tab', action: () => switchTab(-1) },
      { icon: '▶', title: 'Next Tab', action: () => switchTab(1) },
      { icon: '⌕', title: 'Search', action: toggleSearch },
      { icon: '⧉', title: 'Copy', action: copySelection },
      { icon: '▤', title: 'Paste', action: pasteClipboard },
      { icon: '⇩', title: 'Export Buffer', action: exportBuffer },
      { icon: 'A+', title: 'Increase Font Size', action: () => changeFontSize(1) },
      { icon: 'A-', title: 'Decrease Font Size', action: () => changeFontSize(-1) },
      { icon: '↺', title: 'Reset Font Size', action: () => { state.settings.font.size = 14; fitAll(); } },
      { icon: '☀', title: 'Toggle Theme', action: toggleTheme },
      { icon: '⚙', title: 'Settings', action: () => TW.settingsUI.open() },
      { icon: '↻', title: 'Reconnect', action: () => pane && reconnectPane(pane) },
      { icon: '☠', title: 'Kill Session', action: () => pane && killPane(pane) },
    );
    TW.themes.schemeNames().forEach((name) => {
      commands.push({ icon: '🎨', title: 'Color Scheme: ' + name, action: () => setScheme(name) });
    });
    TW.palette.open(commands, (it) => it.action());
  }

  async function openSessionsList() {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      const items = (data.sessions || []).map((id) => ({
        icon: '▤',
        title: 'Re-attach: ' + id.slice(0, 8),
        sub: id,
        action: () => newTab(state.settings.defaultProfile, id),
      }));
      if (items.length === 0) {
        items.push({ icon: '—', title: 'No live sessions', action: () => {} });
      }
      TW.palette.open(items, (it) => it.action());
    } catch (e) {
      TW.util.toast('Failed to list sessions');
    }
  }

  function switchTab(dir) {
    if (state.tabs.length < 2) return;
    const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
    const next = (idx + dir + state.tabs.length) % state.tabs.length;
    setActiveTab(state.tabs[next].id);
  }

  /* ---------- context menu ---------- */

  function showContextMenu(x, y, pane) {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = '';
    const items = [
      { label: 'Copy', action: () => { if (pane.term.hasSelection()) TW.util.copyText(pane.term.getSelection()); } },
      { label: 'Paste', action: async () => { const t = await TW.util.readClipboard(); if (t != null) pane.term.paste(t); } },
      { label: 'Reconnect', action: () => reconnectPane(pane) },
      { label: 'Kill Session', cls: 'danger', action: () => killPane(pane) },
    ];
    items.forEach((it) => {
      const row = TW.util.el('div', { class: 'cm-item' + (it.cls ? ' ' + it.cls : ''), text: it.label });
      row.addEventListener('click', () => { hideContextMenu(); it.action(); });
      menu.appendChild(row);
    });
    menu.classList.remove('hidden');
    menu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 200) + 'px';
  }

  function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
  }

  /* ---------- mobile: pinch zoom ---------- */

  function attachPinch(container, pane) {
    const pointers = new Map();
    let startDist = 0;
    let startSize = 0;
    container.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        startDist = Math.hypot(a.x - b.x, a.y - b.y);
        startSize = Number(state.settings.font.size || 14);
      }
    });
    container.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && startDist > 0) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const newSize = Math.round(Math.min(32, Math.max(8, startSize * (dist / startDist))));
        if (newSize !== Number(state.settings.font.size)) {
          state.settings.font.size = newSize;
          pane.term.options.fontSize = newSize;
          TW.terminal.fit(pane);
        }
      }
    });
    const clear = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) startDist = 0;
    };
    container.addEventListener('pointerup', clear);
    container.addEventListener('pointercancel', clear);
  }

  /* ---------- tab bar ---------- */

  function renderTabbar() {
    const tabsEl = document.getElementById('tabs');
    tabsEl.innerHTML = '';
    state.tabs.forEach((t) => {
      const pane = findPane(t.root, t.activePaneId);
      const profile = pane ? getProfile(pane.profileId) : null;
      const title = (pane && pane.title) || (profile && profile.name) || 'Terminal';
      const icon = (profile && profile.icon) || '▸';
      const tabEl = TW.util.el('div', {
        class: 'tab' + (t.id === state.activeTabId ? ' active' : ''),
        role: 'tab',
      }, [
        TW.util.el('span', { class: 'tab-icon', text: icon }),
        TW.util.el('span', { class: 'tab-title', text: title }),
        TW.util.el('button', { class: 'tab-close', text: '✕' }),
      ]);
      tabEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) return;
        setActiveTab(t.id);
      });
      tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirmClose(title)) return;
        closeTab(t);
      });
      tabsEl.appendChild(tabEl);
    });
  }

  /* ---------- settings apply ---------- */

  function applyBackground() {
    const ws = document.getElementById('workspace');
    const img = state.settings.theme.backgroundImage;
    ws.style.backgroundImage = img ? `url("${img}")` : '';
    if (img) {
      // "uniform" (repo stretchMode): whole character always visible, never cropped.
      // Bottom-anchored → when the soft keyboard opens and the viewport shrinks,
      // the image rescales to stay fully visible right above the keyboard (tracks terminal).
      ws.style.backgroundSize = 'contain';
      ws.style.backgroundPosition = 'center bottom';
      ws.style.backgroundRepeat = 'no-repeat';
    }
    const opacity = Number(state.settings.theme.opacity != null ? state.settings.theme.opacity : 1);
    state.tabs.forEach((t) => {
      allPanes(t).forEach((p) => {
        p.container.classList.toggle('acrylic', opacity < 1);
      });
    });
  }

  async function reloadSettings() {
    const res = await fetch('/api/settings');
    state.settings = await res.json();
    TW.themes.applyUiTheme(state.settings.theme);
    applyBackground();
    state.tabs.forEach((t) => {
      allPanes(t).forEach((p) => {
        const profile = getProfile(p.profileId);
        TW.terminal.applySettings(p.term, state.settings, profile.scheme);
      });
    });
    fitAll();
    renderTabbar();
  }

  /* ---------- init ---------- */

  function init() {
    TW.palette.init();
    TW.settingsUI.init();
    TW.touchbar.init();

    document.getElementById('btn-palette').addEventListener('click', openPalette);
    document.getElementById('btn-settings').addEventListener('click', () => TW.settingsUI.open());
    document.getElementById('btn-sessions').addEventListener('click', openSessionsList);
    document.getElementById('btn-touchbar').addEventListener('click', () => TW.touchbar.toggle());

    // Search bar
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => doSearch(false));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doSearch(e.shiftKey); }
      else if (e.key === 'Escape') { e.preventDefault(); toggleSearch(); }
    });
    document.getElementById('search-next').addEventListener('click', () => doSearch(false));
    document.getElementById('search-prev').addEventListener('click', () => doSearch(true));
    document.getElementById('search-close').addEventListener('click', toggleSearch);
    ['search-regex', 'search-case', 'search-word'].forEach((id) => {
      document.getElementById(id).addEventListener('change', () => doSearch(false));
    });

    // Global keyboard (capture phase — intercept chords before xterm)
    document.addEventListener('keydown', (e) => {
      if (TW.palette.isOpen() || TW.settingsUI.isOpen()) return;
      const action = TW.keybindings.handleKeydown(e, state.settings);
      if (action && ACTIONS[action]) ACTIONS[action]();
    }, true);
    // Unlock the shared AudioContext on the first real user interaction so the
    // terminal bell is audible (browser autoplay policy), and ask for
    // notification permission in the same gesture so bell alerts can fire.
    function unlockInteraction() {
      unlockAudio();
      if (window.Notification && Notification.permission === 'default') {
        try {
          const p = Notification.requestPermission();
          if (p && p.catch) p.catch(() => { /* ignore */ });
        } catch (e) { /* ignore */ }
      }
    }
    window.addEventListener('pointerdown', unlockInteraction, { capture: true, once: false });
    window.addEventListener('keydown', unlockInteraction, { capture: true, once: false });

    // Clicking a bell notification reopens/focuses the pane that rang.
    try {
      navigator.serviceWorker.addEventListener('message', (ev) => {
        if (!ev.data || ev.data.type !== 'focus-pane') return;
        const tab = state.tabs.find((t) => t.id === state.activeTabId);
        const target = ev.data.id ? findPane(state.tabs, ev.data.id) : null;
        if (tab && target) setActivePane(tab, target);
        window.focus();
      });
    } catch (e) { /* ignore */ }

    // Hide context menu on outside click
    document.addEventListener('pointerdown', (e) => {
      if (!document.getElementById('context-menu').contains(e.target)) hideContextMenu();
    });

    // Viewport / keyboard handling — keep the app above the software keyboard.
    // Strategy:
    //  1. `interactive-widget=resizes-content` (index.html) makes the layout
    //     viewport shrink with the keyboard on Chrome 108+ — 100dvh handles it.
    //  2. Fallback for overlay mode / older browsers: sync #app to the visual
    //     viewport whenever it differs from the layout viewport.
    const appEl = document.getElementById('app');
    function onViewportChange() {
      const vv = window.visualViewport;
      if (!vv) return;
      const differs = Math.abs(window.innerHeight - vv.height) > 2 || vv.offsetTop > 0;
      if (differs) {
        appEl.style.height = vv.height + 'px';
        appEl.style.transform = vv.offsetTop ? 'translateY(' + vv.offsetTop + 'px)' : '';
      } else {
        appEl.style.height = '';
        appEl.style.transform = '';
      }
      fitAll();
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportChange);
      window.visualViewport.addEventListener('scroll', onViewportChange);
    }
    window.addEventListener('resize', () => fitAll());
    window.addEventListener('orientationchange', () => setTimeout(fitAll, 200));

    // Load settings then boot
    fetch('/api/settings')
      .then((r) => r.json())
      .then(async (s) => {
        state.settings = s;
        TW.themes.applyUiTheme(s.theme);
        applyBackground();
        // Wait for web fonts so xterm measures cell metrics with the real font
        await ensureFonts();
        const stored = storedSessions();
        if (stored.length > 0) {
          stored.forEach((id) => newTab(s.defaultProfile, id));
        } else {
          newTab(s.defaultProfile);
        }
        // Touchbar visibility was decided at init (hidden on desktop by default).
        // Re-fit in case fonts finished loading after pane creation
        requestAnimationFrame(() => fitAll());
      })
      .catch((err) => {
        console.error('init failed:', err);
        document.getElementById('workspace').innerHTML =
          '<div class="pane-overlay"><div class="ov-title">Cannot reach server</div>' +
          '<div class="ov-sub">Run ./start.sh (Termux) or .\\start.ps1 (Windows) and reload</div></div>';
      });
  }

  // Load the terminal web fonts before creating panes so xterm.js measures
  // cell dimensions with the real font (Iosevka/Pretendard), not the fallback.
  function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const family = (state.settings.font && state.settings.font.family) || 'monospace';
    const size = (state.settings.font && state.settings.font.size) || 14;
    const spec = `${size}px ${family.split(',')[0].trim()}`;
    return Promise.race([
      Promise.all([
        document.fonts.load(spec),
        document.fonts.load(`${size}px Pretendard`),
      ]).catch(() => {}),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  }

  const ACTIONS = {
    newTab: () => newTab(state.settings.defaultProfile),
    closeTab: () => closeTab(getActiveTab()),
    nextTab: () => switchTab(1),
    prevTab: () => switchTab(-1),
    tab1: () => state.tabs[0] && setActiveTab(state.tabs[0].id),
    tab2: () => state.tabs[1] && setActiveTab(state.tabs[1].id),
    tab3: () => state.tabs[2] && setActiveTab(state.tabs[2].id),
    tab4: () => state.tabs[3] && setActiveTab(state.tabs[3].id),
    tab5: () => state.tabs[4] && setActiveTab(state.tabs[4].id),
    tab6: () => state.tabs[5] && setActiveTab(state.tabs[5].id),
    tab7: () => state.tabs[6] && setActiveTab(state.tabs[6].id),
    tab8: () => state.tabs[7] && setActiveTab(state.tabs[7].id),
    tab9: () => state.tabs[8] && setActiveTab(state.tabs[8].id),
    splitHorizontal: () => splitPane(getActiveTab(), getActivePane(), 'v'),
    splitVertical: () => splitPane(getActiveTab(), getActivePane(), 'h'),
    focusUp: () => navigate(getActiveTab(), getActivePane() && getActivePane().id, 'up'),
    focusDown: () => navigate(getActiveTab(), getActivePane() && getActivePane().id, 'down'),
    focusLeft: () => navigate(getActiveTab(), getActivePane() && getActivePane().id, 'left'),
    focusRight: () => navigate(getActiveTab(), getActivePane() && getActivePane().id, 'right'),
    commandPalette: openPalette,
    search: toggleSearch,
    copy: copySelection,
    paste: pasteClipboard,
    exportBuffer,
    increaseFont: () => changeFontSize(1),
    decreaseFont: () => changeFontSize(-1),
    resetFont: () => { state.settings.font.size = 14; fitAll(); },
    sessionsList: openSessionsList,
    settings: () => TW.settingsUI.open(),
    killSession: () => killPane(getActivePane()),
    reconnect: () => reconnectPane(getActivePane()),
  };

  return {
    init,
    getSettings,
    getActiveTab,
    getActivePane,
    newTab,
    reloadSettings,
    setActivePane,
  };
})();

document.addEventListener('DOMContentLoaded', () => TW.app.init());