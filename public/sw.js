'use strict';
/* sw.js — terminalweb service worker: app-shell cache, offline fallback, API bypass */

const CACHE = 'terminalweb-v24';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/app.css',
  '/js/util.js',
  '/js/themes.js',
  '/js/keybindings.js',
  '/js/sessions.js',
  '/js/terminal.js',
  '/js/palette.js',
  '/js/settings.js',
  '/js/touchbar.js',
  '/js/app.js',
  '/vendor/xterm-xterm.js',
  '/vendor/xterm-xterm.css',
  '/vendor/xterm-addon-fit-addon-fit.js',
  '/vendor/xterm-addon-search-addon-search.js',
  '/vendor/xterm-addon-unicode11-addon-unicode11.js',
  '/vendor/xterm-addon-serialize-addon-serialize.js',
  '/vendor/xterm-addon-unicode-graphemes-addon-unicode-graphemes.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/fonts/Iosevka-Regular.woff2',
  '/fonts/Pretendard-Regular.woff2',
  '/images/miku.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Never cache API or WebSocket traffic
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') return;
  if (req.method !== 'GET') return;

  // Navigations: network-first, fall back to cached shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets: stale-while-revalidate — serve the cached copy (offline shell)
  // while re-fetching in the background so updates appear on the next reload.
  e.respondWith(
    caches.match(req).then((hit) => {
      const revalidate = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || revalidate;
    })
  );
});