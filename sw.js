// Basketball Duel service worker: caches the static app so "Play vs CPU" works offline.
// Online games always go to the network (/api/*).
const CACHE = 'bd-v5';
const ASSETS = [
  '/', '/index.html', '/game.js', '/i18n.js', '/lang/core.js', '/lang/extra.js', '/lang/features.js',
  '/lib/teams.js', '/lib/rules.js', '/select.js', '/select.css', '/cheer.js',
  '/manifest.webmanifest', '/icon.svg', '/fonts/fonts.css',
  '/fonts/bungee-latin.woff2', '/fonts/bungee-latin-ext.woff2',
  '/fonts/rubik-latin.woff2', '/fonts/rubik-latin-ext.woff2', '/fonts/rubik-arabic.woff2',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;
  // Network first (fresh code when online), cache fallback (offline)
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(url.origin === location.origin && url.pathname === '/' ? '/' : req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('/') : undefined)))
  );
});
