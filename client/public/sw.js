// Synapse Service Worker v2 - Network-first for all HTML, cache static assets only
const CACHE_NAME = 'synapse-v2';

// Only cache actual static assets (not HTML documents)
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: cache static assets only (NOT the HTML shell)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean ALL old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls: always network (no cache)
// - Navigation (HTML): always network, no fallback to cache
// - Static assets (JS/CSS/images): cache-first with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // API calls — always network, never cache
  if (url.pathname.startsWith('/api')) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests (HTML pages) — ALWAYS network
  // This ensures the app always gets the latest HTML with fresh JS bundles
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets — cache-first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
