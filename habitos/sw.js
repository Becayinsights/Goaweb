// Offline: la app abre sin red; la IA y la sincronización necesitan conexión.
const C = 'habitos-v8';
const FILES = ['/', '/manifest.json', '/icon-192.png', '/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/') || (u.origin !== location.origin && !fonts)) return;
  // red primero para recibir actualizaciones; caché si no hay conexión
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/'))));
});
