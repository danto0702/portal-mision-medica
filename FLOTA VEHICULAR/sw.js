/**
 * Service worker de Flota HRNO.
 *
 * Solo cachea el armazón de la aplicación para que abra sin señal. Las
 * peticiones a la API nunca se cachean: un dato viejo de itinerario o de
 * marcación sería peor que no tener dato. Las marcas tomadas sin cobertura
 * las guarda la propia aplicación y las envía al recuperar la señal.
 */
const CACHE = 'flota-v1';
const ARMAZON = ['./', './index.html', './app.js', './manifest.json', './libs/chart.umd.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARMAZON)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;          // la API siempre va a la red
  if (url.origin !== location.origin) return;            // fuentes y librerías, igual

  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
