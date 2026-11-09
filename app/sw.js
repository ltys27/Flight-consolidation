/* Offline-first app shell. Bump VERSION on every deploy so clients refresh. */
const VERSION = 'cup-debrief-v23';
const SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icon.svg', './icon-192.png', './icon-512.png', './seed.json'];

self.addEventListener('install', e => {
  // fetch fresh copies: GitHub Pages lets browsers cache files for 10 minutes, which could trap a stale app.js in the new cache
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (r.ok) return c.put(u, r); })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
