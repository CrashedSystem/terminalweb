'use strict';
/* palette.js — command palette with fuzzy search */

TW.palette = (() => {
  let items = [];
  let selected = 0;
  let onSelect = null;

  const box = () => document.getElementById('palette');
  const input = () => document.getElementById('palette-input');
  const list = () => document.getElementById('palette-list');

  function fuzzyScore(query, text) {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    if (!q) return 1;
    let qi = 0;
    let score = 0;
    let streak = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        qi++;
        streak++;
        score += 1 + streak * 0.5;
      } else {
        streak = 0;
      }
    }
    return qi === q.length ? score : 0;
  }

  function render() {
    const q = input().value;
    const scored = items
      .map((it) => ({ it, score: fuzzyScore(q, it.title) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    list().innerHTML = '';
    if (scored.length === 0) {
      list().appendChild(TW.util.el('div', { class: 'palette-empty', text: 'No matching commands' }));
      return;
    }
    if (selected >= scored.length) selected = 0;

    scored.forEach(({ it }, idx) => {
      const row = TW.util.el('div', {
        class: 'palette-item' + (idx === selected ? ' selected' : ''),
        dataset: { idx: String(idx) },
      }, [
        TW.util.el('span', { class: 'pi-icon', text: it.icon || '›' }),
        TW.util.el('span', { class: 'pi-title', text: it.title }),
        it.sub ? TW.util.el('span', { class: 'pi-sub', text: it.sub }) : null,
      ]);
      row.addEventListener('click', () => choose(idx));
      row.addEventListener('mousemove', () => {
        selected = idx;
        refreshSelection();
      });
      list().appendChild(row);
    });
  }

  function refreshSelection() {
    const rows = list().querySelectorAll('.palette-item');
    rows.forEach((r, i) => r.classList.toggle('selected', i === selected));
    const sel = rows[selected];
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function choose(idx) {
    const q = input().value;
    const scored = items
      .map((it) => ({ it, score: fuzzyScore(q, it.title) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const it = scored[idx] && scored[idx].it;
    if (it && onSelect) onSelect(it);
    close();
  }

  function open(commandItems, handler) {
    items = commandItems;
    onSelect = handler;
    selected = 0;
    box().classList.remove('hidden');
    input().value = '';
    render();
    input().focus();
  }

  function close() {
    box().classList.add('hidden');
    onSelect = null;
  }

  function isOpen() {
    return !box().classList.contains('hidden');
  }

  function init() {
    input().addEventListener('input', () => {
      selected = 0;
      render();
    });
    input().addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(selected + 1, list().children.length - 1); refreshSelection(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(selected - 1, 0); refreshSelection(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(selected); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    box().addEventListener('click', (e) => {
      if (e.target === box()) close();
    });
  }

  return { init, open, close, isOpen };
})();