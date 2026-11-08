const CACHE_NAME = 'redvecina-shell-v1';
const TILES_CACHE_NAME = 'redvecina-tiles-v1';
const STATIC_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== TILES_CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // En desarrollo Next.js (HMR, webpack, sockets, etc.), omitir interceptación del Service Worker
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('hot-reloader') ||
    url.pathname.startsWith('/api/') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // Stale-While-Revalidate para tiles de OpenStreetMap (Soporte Cartográfico Offline Resiliente)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILES_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        if (cachedResponse) {
          return cachedResponse;
        }
        const res = await fetchPromise;
        if (res) return res;
        return new Response('', { status: 408, statusText: 'Request timed out or offline' });
      })
    );
    return;
  }

  // Estrategia por defecto: Network first, fallback a caché seguro garantizando Response válida
  event.respondWith(
    fetch(event.request)
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Si no está en caché y falla la red en navegación HTML, retornar fallback o 503 controlado
        if (event.request.mode === 'navigate') {
          const appShell = await caches.match('/');
          if (appShell) return appShell;
        }
        return new Response('Red no disponible y recurso no almacenado en caché', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});

