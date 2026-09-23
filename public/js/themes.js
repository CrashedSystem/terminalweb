'use strict';
/* themes.js — Windows Terminal color schemes + UI theme engine */

TW.themes = (() => {
  // Windows Terminal built-in color schemes
  const SCHEMES = {
    'Campbell': {
      background: '#0c0c0c', foreground: '#cccccc', cursor: '#ffffff', cursorAccent: '#0c0c0c',
      selectionBackground: '#ffffff', black: '#0c0c0c', red: '#c50f1f', green: '#13a10e',
      yellow: '#c19c00', blue: '#0037da', magenta: '#881798', cyan: '#3a96dd', white: '#cccccc',
      brightBlack: '#767676', brightRed: '#e74856', brightGreen: '#16c60c', brightYellow: '#f9f1a5',
      brightBlue: '#3b78ff', brightMagenta: '#b4009e', brightCyan: '#61d6d6', brightWhite: '#f2f2f2',
    },
    'Campbell Powershell': {
      background: '#0c0c0c', foreground: '#cccccc', cursor: '#ffffff', cursorAccent: '#0c0c0c',
      selectionBackground: '#ffffff', black: '#0c0c0c', red: '#e74856', green: '#16c60c',
      yellow: '#f9f1a5', blue: '#3b78ff', magenta: '#b4009e', cyan: '#61d6d6', white: '#cccccc',
      brightBlack: '#767676', brightRed: '#e74856', brightGreen: '#16c60c', brightYellow: '#f9f1a5',
      brightBlue: '#3b78ff', brightMagenta: '#b4009e', brightCyan: '#61d6d6', brightWhite: '#f2f2f2',
    },
    'One Half Dark': {
      background: '#282c34', foreground: '#dcdfe4', cursor: '#528bff', cursorAccent: '#282c34',
      selectionBackground: '#3e4451', black: '#282c34', red: '#e06c75', green: '#98c379',
      yellow: '#e5c07b', blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#dcdfe4',
      brightBlack: '#282c34', brightRed: '#e06c75', brightGreen: '#98c379', brightYellow: '#e5c07b',
      brightBlue: '#61afef', brightMagenta: '#c678dd', brightCyan: '#56b6c2', brightWhite: '#dcdfe4',
    },
    'One Half Light': {
      background: '#fafafa', foreground: '#383a42', cursor: '#4f525e', cursorAccent: '#fafafa',
      selectionBackground: '#e5e5e6', black: '#383a42', red: '#e45649', green: '#50a14f',
      yellow: '#c18401', blue: '#0184bc', magenta: '#a626a4', cyan: '#0997b3', white: '#fafafa',
      brightBlack: '#4f525e', brightRed: '#e45649', brightGreen: '#50a14f', brightYellow: '#c18401',
      brightBlue: '#0184bc', brightMagenta: '#a626a4', brightCyan: '#0997b3', brightWhite: '#fafafa',
    },
    'Solarized Dark': {
      background: '#002b36', foreground: '#839496', cursor: '#839496', cursorAccent: '#002b36',
      selectionBackground: '#073642', black: '#073642', red: '#dc322f', green: '#859900',
      yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
      brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
      brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
    },
    'Solarized Light': {
      background: '#fdf6e3', foreground: '#657b83', cursor: '#657b83', cursorAccent: '#fdf6e3',
      selectionBackground: '#eee8d5', black: '#073642', red: '#dc322f', green: '#859900',
      yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
      brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
      brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
    },
    'Tango Dark': {
      background: '#2e3436', foreground: '#d3d7cf', cursor: '#ffffff', cursorAccent: '#2e3436',
      selectionBackground: '#ffffff', black: '#000000', red: '#cc0000', green: '#4e9a06',
      yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b', cyan: '#06989a', white: '#d3d7cf',
      brightBlack: '#555753', brightRed: '#ef2929', brightGreen: '#8ae234', brightYellow: '#fce94f',
      brightBlue: '#729fcf', brightMagenta: '#ad7fa8', brightCyan: '#34e2e2', brightWhite: '#eeeeec',
    },
    'Tango Light': {
      background: '#ffffff', foreground: '#555753', cursor: '#000000', cursorAccent: '#ffffff',
      selectionBackground: '#000000', black: '#000000', red: '#cc0000', green: '#4e9a06',
      yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b', cyan: '#06989a', white: '#d3d7cf',
      brightBlack: '#555753', brightRed: '#ef2929', brightGreen: '#8ae234', brightYellow: '#fce94f',
      brightBlue: '#729fcf', brightMagenta: '#ad7fa8', brightCyan: '#34e2e2', brightWhite: '#eeeeec',
    },
    'Vintage': {
      background: '#1b1b1b', foreground: '#c0c0c0', cursor: '#c0c0c0', cursorAccent: '#1b1b1b',
      selectionBackground: '#c0c0c0', black: '#1b1b1b', red: '#c91b00', green: '#00c200',
      yellow: '#c7c400', blue: '#0225c7', magenta: '#ca30c7', cyan: '#00c5c7', white: '#c7c7c7',
      brightBlack: '#686868', brightRed: '#ff6e67', brightGreen: '#5ffa68', brightYellow: '#fffc67',
      brightBlue: '#6871ff', brightMagenta: '#ff77ff', brightCyan: '#5ffdff', brightWhite: '#ffffff',
    },
    'Dracula': {
      background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f2', cursorAccent: '#282a36',
      selectionBackground: '#44475a', black: '#21222c', red: '#ff5555', green: '#50fa7b',
      yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
      brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
      brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff',
    },
    // Miku theme — Dark+ scheme from DamourYouKnow/windows-terminal-miku
    'Miku': {
      background: '#0e0e0e', foreground: '#cccccc', cursor: '#ffffff', cursorAccent: '#0e0e0e',
      selectionBackground: '#264f78', black: '#000000', red: '#cd3131', green: '#0dbc79',
      yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
      brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543',
      brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#e5e5e5',
    },
  };

  // User-defined schemes from settings.json ("schemes": { name: { ...colors } }).
  // Kept separate from SCHEMES so removing one in settings actually removes it.
  const CUSTOM = {};

  /** Replace the custom scheme set (called whenever settings are (re)loaded). */
  function setCustomSchemes(schemes) {
    Object.keys(CUSTOM).forEach((k) => delete CUSTOM[k]);
    if (!schemes || typeof schemes !== 'object') return;
    for (const [name, def] of Object.entries(schemes)) {
      if (!name || !def || typeof def !== 'object') continue;
      // Fill unspecified colors from One Half Dark so partial definitions work.
      CUSTOM[name] = { ...SCHEMES['One Half Dark'], ...def };
    }
  }

  function getScheme(name) {
    return CUSTOM[name] || SCHEMES[name] || SCHEMES['One Half Dark'];
  }

  function schemeNames() {
    const custom = Object.keys(CUSTOM).filter((n) => !SCHEMES[n]);
    return Object.keys(SCHEMES).concat(custom);
  }

  // Build xterm theme object from a scheme + opacity
  function toXtermTheme(scheme, opacity) {
    const t = {
      background: opacity < 1 ? TW.util.hexToRgba(scheme.background, opacity) : scheme.background,
      foreground: scheme.foreground,
      cursor: scheme.cursor,
      cursorAccent: scheme.cursorAccent,
      selectionBackground: scheme.selectionBackground,
      black: scheme.black, red: scheme.red, green: scheme.green, yellow: scheme.yellow,
      blue: scheme.blue, magenta: scheme.magenta, cyan: scheme.cyan, white: scheme.white,
      brightBlack: scheme.brightBlack, brightRed: scheme.brightRed, brightGreen: scheme.brightGreen,
      brightYellow: scheme.brightYellow, brightBlue: scheme.brightBlue, brightMagenta: scheme.brightMagenta,
      brightCyan: scheme.brightCyan, brightWhite: scheme.brightWhite,
    };
    return t;
  }

  // Apply UI theme (dark/light/system) to CSS variables
  function applyUiTheme(theme) {
    const mode = theme.mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme.mode;
    document.body.classList.toggle('light', mode === 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'light' ? '#ffffff' : '#0c0c0c');
  }

  return { SCHEMES, getScheme, schemeNames, setCustomSchemes, toXtermTheme, applyUiTheme };
})();