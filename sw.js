// Service Worker: hält die App offline verfügbar.
// Es werden NUR die Programmdateien zwischengespeichert – nie Sitzplan-Dateien oder Schülerdaten.
// Die Seite selbst wird immer zuerst aus dem Internet geladen (neue Version sofort da);
// nur ohne Verbindung kommt sie aus dem Zwischenspeicher.
const CACHE = 'klassenmanager-v4';
const FILES = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-48.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  if (isPage) {   // Netz zuerst (max. 4 s), sonst Zwischenspeicher
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const r = await Promise.race([fetch(req, { cache: 'no-store' }), new Promise((_, no) => setTimeout(no, 4000))]);
        if (r.ok) c.put('./index.html', r.clone());
        return r;
      } catch (err) { return (await c.match('./index.html')) || (await c.match(req, { ignoreSearch: true })) || Response.error(); }
    })());
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {   // Symbole usw.: Zwischenspeicher, im Hintergrund auffrischen
    const cached = await c.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => cached);
    return cached || fresh;
  }));
});
