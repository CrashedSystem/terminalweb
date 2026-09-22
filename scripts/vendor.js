#!/usr/bin/env node
/**
 * Vendor copier: copies xterm.js + addon bundles from node_modules
 * into public/vendor/ so the app runs with zero CDN dependency.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'public', 'vendor');

const PACKAGES = [
  { pkg: 'xterm', files: ['lib/xterm.js', 'css/xterm.css'] },
  { pkg: '@xterm/addon-fit', files: ['lib/addon-fit.js'] },
  { pkg: '@xterm/addon-search', files: ['lib/addon-search.js'] },
  { pkg: '@xterm/addon-webgl', files: ['lib/addon-webgl.js'] },
  { pkg: '@xterm/addon-unicode11', files: ['lib/addon-unicode11.js'] },
  { pkg: '@xterm/addon-serialize', files: ['lib/addon-serialize.js'] },
  // NOTE: @xterm/addon-ligatures is ESM-only + font-finder (desktop) — excluded.
  // Ligature toggle kept in settings as no-op; needs ligature font on device.
  { pkg: '@xterm/addon-unicode-graphemes', files: ['lib/addon-unicode-graphemes.js'] },
];

fs.mkdirSync(VENDOR, { recursive: true });

const copied = [];
for (const { pkg, files } of PACKAGES) {
  for (const file of files) {
    const src = path.join(ROOT, 'node_modules', pkg, file);
    const destName = pkg.replace('@xterm/addon-', 'xterm-addon-') + '-' + path.basename(file);
    const dest = path.join(VENDOR, destName);
    if (!fs.existsSync(src)) {
      console.error(`MISSING: ${src}`);
      process.exitCode = 1;
      continue;
    }
    fs.copyFileSync(src, dest);
    copied.push(destName);
  }
}

console.log('Vendor files copied to public/vendor/:');
for (const f of copied) console.log('  ' + f);