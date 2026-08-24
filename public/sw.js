const CACHE = 'thimar-shell-v1';
const ASSETS = ['/', '/index.html', '/app.html', '/app-core.js', '/islamic-hub.js', '/islamic-hub.css', '/islamic-data.js', '/legacy-i18n.js', '/quran/quran.pdf', '/vendor/pdfjs/pdf.min.mjs', '/vendor/pdfjs/pdf.worker.min.mjs', '/audio/athan-alert.mp3', '/audio/notification-chime.mp3', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) { event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } }))); return; }
  event.respondWith(caches.match(event.request).then(cached => { const fresh = fetch(event.request).then(response => { if (response.ok && event.request.method === 'GET') caches.open(CACHE).then(cache => cache.put(event.request, response.clone())); return response; }).catch(() => cached); return cached || fresh; }));
});
