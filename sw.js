// Service worker: red primero (revalidando siempre con el servidor) y caché solo como respaldo sin conexión.
// Nunca cachea la API de GitHub.
const VER = '1.5.2';
const CACHE = 'finanzas-v' + VER;
const SHELL = ['./', './index.html', './styles.css?v=' + VER, './js/app.js?v=' + VER, './js/store.js?v=' + VER, './js/calc.js?v=' + VER, './js/ui.js?v=' + VER, './js/views.js?v=' + VER, './js/importer.js?v=' + VER, './js/colors.js?v=' + VER,
  './vendor/chart.umd.js', './vendor/xlsx.full.min.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => r.ok && c.put(u, r)).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
