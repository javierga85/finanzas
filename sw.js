// Service worker: red primero para los ficheros de la app (siempre la última versión si hay conexión),
// caché como respaldo para funcionar sin conexión. Nunca cachea la API de GitHub.
const CACHE = 'finanzas-v1.3.0';
const SHELL = ['./', './index.html', './styles.css?v=1.3.0', './js/app.js?v=1.3.0', './js/store.js', './js/calc.js', './js/ui.js', './js/views.js', './js/importer.js', './js/colors.js',
  './vendor/chart.umd.js', './vendor/xlsx.full.min.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('./index.html'))));
});
