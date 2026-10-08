// Offline: la app abre sin red; la IA y la sincronización necesitan conexión.
const C = 'habitos-v20';
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
  // la página se guarda siempre como «/»: así no quedan en caché enlaces con invitaciones o tokens
  const key = e.request.mode === 'navigate' ? '/' : e.request;
  const cached = () => caches.match(key).then(r => r || caches.match('/'));
  // red primero para recibir actualizaciones; con mala cobertura, a los 3 s se abre lo guardado
  const net = fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(C).then(c => c.put(key, copy)); }
    return r;
  });
  e.respondWith(new Promise(resolve => {
    let done = false;
    const t = setTimeout(() => cached().then(r => { if (r && !done) { done = true; resolve(r); } }), 3000);
    net.then(r => { if (!done) { done = true; clearTimeout(t); resolve(r); } })
      .catch(() => cached().then(r => { if (!done) { done = true; clearTimeout(t); resolve(r || Response.error()); } }));
  }));
});
