'use strict';
/* settings.js — settings UI (GUI + raw JSON) */

TW.settingsUI = (() => {
  const panel = () => document.getElementById('settings-panel');
  const body = () => document.getElementById('settings-body');

  function row(label, control) {
    return TW.util.el('div', { class: 'set-row' }, [
      TW.util.el('label', { text: label }),
      control,
    ]);
  }

  function textInput(value, onInput) {
    const el = TW.util.el('input', { type: 'text', value: value || '' });
    el.addEventListener('input', () => onInput(el.value));
    return el;
  }

  function numInput(value, onInput) {
    const el = TW.util.el('input', { type: 'number', value: value != null ? value : '' });
    el.addEventListener('input', () => onInput(Number(el.value)));
    return el;
  }

  function selectInput(options, value, onInput) {
    const el = TW.util.el('select', {}, options.map((o) =>
      TW.util.el('option', { value: o, text: o, selected: o === value ? 'selected' : null })
    ));
    el.addEventListener('change', () => onInput(el.value));
    return el;
  }

  function checkInput(value, onInput) {
    const el = TW.util.el('input', { type: 'checkbox', checked: value ? 'checked' : null });
    el.addEventListener('change', () => onInput(el.checked));
    return el;
  }

  function renderProfiles(s, onChange) {
    const sec = TW.util.el('div', { class: 'set-section' }, [TW.util.el('h3', { text: 'Profiles' })]);
    s.profiles.forEach((p, i) => {
      const card = TW.util.el('div', { class: 'profile-card' });
      const head = TW.util.el('div', { class: 'pc-head' });
      const nameInput = textInput(p.name, (v) => { s.profiles[i].name = v; onChange(); });
      head.appendChild(nameInput);
      const delBtn = TW.util.el('button', { class: 'btn small danger', text: 'Remove' });
      delBtn.addEventListener('click', () => {
        s.profiles.splice(i, 1);
        render();
      });
      head.appendChild(delBtn);
      card.appendChild(head);

      card.appendChild(row('Icon', textInput(p.icon, (v) => { s.profiles[i].icon = v; onChange(); })));
      card.appendChild(row('Command', textInput(p.command, (v) => { s.profiles[i].command = v; onChange(); })));
      card.appendChild(row('CWD', textInput(p.cwd, (v) => { s.profiles[i].cwd = v; onChange(); })));
      card.appendChild(row('Scheme', selectInput(TW.themes.schemeNames(), p.scheme, (v) => { s.profiles[i].scheme = v; onChange(); })));
      card.appendChild(row('Default', checkInput(s.defaultProfile === p.id, (v) => {
        if (v) s.defaultProfile = p.id;
        onChange();
      })));
      sec.appendChild(card);
    });
    const addBtn = TW.util.el('button', { class: 'btn small', text: '+ Add profile' });
    addBtn.addEventListener('click', () => {
      s.profiles.push({ id: 'p' + Date.now(), name: 'New', icon: '▸', command: 'bash', cwd: '~', scheme: 'Campbell' });
      render();
    });
    sec.appendChild(addBtn);
    return sec;
  }

  function renderAppearance(s, onChange) {
    const sec = TW.util.el('div', { class: 'set-section' }, [TW.util.el('h3', { text: 'Appearance' })]);
    sec.appendChild(row('Theme mode', selectInput(['dark', 'light', 'system'], s.theme.mode, (v) => { s.theme.mode = v; onChange(); })));
    const opRow = row('Opacity', TW.util.el('input', { type: 'range', min: '0.3', max: '1', step: '0.05', value: String(s.theme.opacity) }));
    opRow.querySelector('input').addEventListener('input', (e) => { s.theme.opacity = Number(e.target.value); onChange(); });
    sec.appendChild(opRow);
    sec.appendChild(row('Background image URL', textInput(s.theme.backgroundImage, (v) => { s.theme.backgroundImage = v; onChange(); })));
    return sec;
  }

  function renderFont(s, onChange) {
    const sec = TW.util.el('div', { class: 'set-section' }, [TW.util.el('h3', { text: 'Font' })]);
    sec.appendChild(row('Family', textInput(s.font.family, (v) => { s.font.family = v; onChange(); })));
    sec.appendChild(row('Size', numInput(s.font.size, (v) => { s.font.size = v; onChange(); })));
    sec.appendChild(row('Line height', numInput(s.font.lineHeight, (v) => { s.font.lineHeight = v; onChange(); })));
    sec.appendChild(row('Cursor style', selectInput(['block', 'bar', 'underline'], s.font.cursorStyle, (v) => { s.font.cursorStyle = v; onChange(); })));
    sec.appendChild(row('Cursor blink', checkInput(s.font.cursorBlink, (v) => { s.font.cursorBlink = v; onChange(); })));
    sec.appendChild(row('Ligatures', checkInput(s.font.ligatures, (v) => { s.font.ligatures = v; onChange(); })));
    sec.appendChild(TW.util.el('div', { class: 'set-hint', text: 'Ligatures require a ligature font (e.g. Fira Code) installed on the device.' }));
    return sec;
  }

  function renderTerminal(s, onChange) {
    const sec = TW.util.el('div', { class: 'set-section' }, [TW.util.el('h3', { text: 'Terminal' })]);
    sec.appendChild(row('Scrollback', numInput(s.scrollback, (v) => { s.scrollback = v; onChange(); })));
    sec.appendChild(TW.util.el('div', { class: 'set-hint', text: 'Scrollback applies to new terminals.' }));
    sec.appendChild(row('Bell (visual)', checkInput(s.bell.visual, (v) => { s.bell.visual = v; onChange(); })));
    sec.appendChild(row('Bell (audio)', checkInput(s.bell.audio, (v) => { s.bell.audio = v; onChange(); })));
    return sec;
  }

  function renderKeybindings(s, onChange) {
    const sec = TW.util.el('div', { class: 'set-section' }, [TW.util.el('h3', { text: 'Keybindings (JSON)' })]);
    const ta = TW.util.el('textarea', {});
    ta.value = JSON.stringify(s.keybindings || {}, null, 2);
    ta.addEventListener('input', () => {
      try {
        s.keybindings = JSON.parse(ta.value || '{}');
        onChange();
      } catch (e) { /* invalid JSON — keep editing */ }
    });
    sec.appendChild(ta);
    sec.appendChild(TW.util.el('div', { class: 'set-hint', text: 'Format: "ctrl+shift+t": "newTab". Overrides defaults.' }));
    return sec;
  }

  function renderRaw(s, onChange) {
    const sec = TW.util.el('div', { class: 'set-section' }, [TW.util.el('h3', { text: 'Raw JSON' })]);
    const ta = TW.util.el('textarea', {});
    ta.value = JSON.stringify(s, null, 2);
    ta.addEventListener('input', () => {
      try {
        const parsed = JSON.parse(ta.value);
        Object.keys(s).forEach((k) => delete s[k]);
        Object.assign(s, parsed);
        onChange();
      } catch (e) { /* invalid */ }
    });
    sec.appendChild(ta);
    return sec;
  }

  function render() {
    const s = TW.app.getSettings();
    body().innerHTML = '';
    body().appendChild(renderProfiles(s, () => render()));
    body().appendChild(renderAppearance(s, () => render()));
    body().appendChild(renderFont(s, () => render()));
    body().appendChild(renderTerminal(s, () => render()));
    body().appendChild(renderKeybindings(s, () => render()));
    body().appendChild(renderRaw(s, () => render()));
  }

  function open() {
    render();
    panel().classList.remove('hidden');
  }

  function close() {
    panel().classList.add('hidden');
  }

  function isOpen() {
    return !panel().classList.contains('hidden');
  }

  async function save() {
    const s = TW.app.getSettings();
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!res.ok) throw new Error('save failed');
      await TW.app.reloadSettings();
      TW.util.toast('Settings saved');
      close();
    } catch (e) {
      TW.util.toast('Save failed: ' + e.message);
    }
  }

  function init() {
    document.getElementById('settings-close').addEventListener('click', close);
    document.getElementById('settings-save').addEventListener('click', save);
    document.getElementById('settings-reset').addEventListener('click', async () => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await TW.app.reloadSettings();
        render();
        TW.util.toast('Settings reset to defaults');
      }
    });
  }

  return { init, open, close, isOpen, render };
})();