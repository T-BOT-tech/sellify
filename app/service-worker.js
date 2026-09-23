/*
 * Sellify service worker.
 *
 * The app is offline-first at the data layer (localStorage / IndexedDB), so
 * this worker only needs to make the app shell itself available offline.
 * The shell is network-first so a deployment is picked up immediately when
 * online, with the previous shell kept as an offline fallback. There are no
 * hashed build assets in this zero-build PWA, so cache-first JS would leave
 * sellers stuck on stale code after a deployment.
 */
const CACHE_VERSION = 'sellify-shell-v3';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
      .then(() => notifyClients({ type: 'SELLIFY_UPDATE_READY' }))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GETs; let everything else (CDN scripts, sync
  // POSTs to the bot server) go straight to the network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});

async function notifyClients(message) {
  // Do not interrupt a first install. Only an existing app controlled by the
  // previous worker should receive the update prompt.
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
  clients.forEach((client) => client.postMessage(message));
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SELLIFY_SKIP_WAITING') {
    self.skipWaiting();
  }
});
