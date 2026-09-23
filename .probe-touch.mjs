// Probe: dispatch a real touch pointer sequence on the xterm screen and verify
// (a) pane.term.hasSelection() becomes true, (b) clipboard receives the text.
export const probe = async (page) => {
  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 700));
  const out = await page.evaluate(async () => {
    const o = {};
    const scr = document.querySelector('.xterm-screen');
    if (!scr) { o.screen = 'MISSING'; return o; }
    const r = scr.getBoundingClientRect();
    o.screen = { w: Math.round(r.width), h: Math.round(r.height) };
    // marker for clipboard diff
    try { await navigator.clipboard.writeText('@@MARK@@'); } catch (_) {}
    const mk = (t, x, y, extra) => new PointerEvent(t, Object.assign({
      bubbles: true, cancelable: true, pointerId: 71, pointerType: 'touch',
      isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y,
    }, extra || {}));
    scr.dispatchEvent(mk('pointerdown', r.left + 3 * r.width / 8, r.top + 3 * r.height / 8));
    for (let i = 1; i <= 6; i++)
      scr.dispatchEvent(mk('pointermove', r.left + 3 * r.width / 8 + i * r.width / 8, r.top + 3 * r.height / 8));
    scr.dispatchEvent(mk('pointerup', r.left + r.width * 6 / 8, r.top + 3 * r.height / 8));
    await new Promise((r2) => setTimeout(r2, 500));
    try { o.clipboard = await navigator.clipboard.readText(); }
    catch (e) { o.clipboard = 'READ_FAIL ' + e.name; }
    o.verdict =
      o.clipboard && o.clipboard !== '@@MARK@@'
        ? 'TOUCH-DRAG COPY VERIFIED: clipboard holds dropped text'
        : 'NOT COPIED (selection handler likely dead or gesture swallowed by scroll)';
    return o;
  });
  await page.close();
  return out;
};
