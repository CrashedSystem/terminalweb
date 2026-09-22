'use strict';
/* terminal.js — xterm.js instance wrapper */

TW.terminal = (() => {
  function buildOptions(settings, schemeName) {
    const scheme = TW.themes.getScheme(schemeName || 'One Half Dark');
    const opacity = Number(settings.theme.opacity != null ? settings.theme.opacity : 1);
    return {
      allowProposedApi: true,
      allowTransparency: opacity < 1,
      fontFamily: settings.font.family || 'monospace',
      fontSize: Number(settings.font.size || 14),
      lineHeight: Number(settings.font.lineHeight || 1.2),
      letterSpacing: Number(settings.font.letterSpacing || 0),
      cursorStyle: settings.font.cursorStyle || 'block',
      cursorBlink: !!settings.font.cursorBlink,
      scrollback: Number(settings.scrollback || 10000),
      theme: TW.themes.toXtermTheme(scheme, opacity),
      linkHandler: {
        activate: (e, text) => {
          if (/^https?:\/\//i.test(text)) {
            window.open(text, '_blank', 'noopener');
          } else {
            TW.util.toast(`Link: ${text}`);
          }
        },
      },
      rightClickSelectsWord: false,
      smoothScrollDuration: 0,
      minimumContrastRatio: 1,
      drawBoldTextInBrightColors: true,
      convertEol: false,
      windowsMode: false,
    };
  }

  /**
   * Create a terminal inside a container element.
   * @returns {object} { term, fitAddon, searchAddon, serializeAddon }
   */
  function create(container, settings, schemeName) {
    const term = new Terminal(buildOptions(settings, schemeName));

    const fitAddon = new FitAddon.FitAddon();
    const searchAddon = new SearchAddon.SearchAddon();
    const serializeAddon = new SerializeAddon.SerializeAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(serializeAddon);

    // Unicode 11 (emoji/CJK) + grapheme clusters
    try {
      const u11 = new Unicode11Addon.Unicode11Addon();
      term.loadAddon(u11);
      term.unicode.activeVersion = '11';
    } catch (e) { /* older runtime */ }
    try {
      const graphemes = new UnicodeGraphemesAddon.UnicodeGraphemesAddon();
      term.loadAddon(graphemes);
      term.unicode.activeVersion = 'graphemes';
    } catch (e) { /* optional */ }

    // Canvas renderer is the default and paints per-cell RGB exactly.
    // The WebGL addon is intentionally NOT loaded: it quantizes truecolor
    // (SGR 38;2) down to its 256-color atlas, breaking 24-bit output.

    // The passed container IS the styled .xterm-host — open directly.
    // (Creating a second wrapper here caused fitAddon to measure a stale,
    //  content-sized parent that never shrank with the keyboard.)
    term.open(container);

    return { term, fitAddon, searchAddon, serializeAddon };
  }

  function applySettings(term, settings, schemeName) {
    const scheme = TW.themes.getScheme(schemeName || 'One Half Dark');
    const opacity = Number(settings.theme.opacity != null ? settings.theme.opacity : 1);
    term.options.fontFamily = settings.font.family || 'monospace';
    term.options.fontSize = Number(settings.font.size || 14);
    term.options.lineHeight = Number(settings.font.lineHeight || 1.2);
    term.options.letterSpacing = Number(settings.font.letterSpacing || 0);
    term.options.cursorStyle = settings.font.cursorStyle || 'block';
    term.options.cursorBlink = !!settings.font.cursorBlink;
    term.options.allowTransparency = opacity < 1;
    term.options.theme = TW.themes.toXtermTheme(scheme, opacity);
  }

  function fit(pane) {
    if (!pane.fitAddon) return;
    try {
      pane.fitAddon.fit();
    } catch (e) {
      // Container not visible yet
    }
  }

  return { create, applySettings, fit, buildOptions };
})();