const CACHE_NAME = 'roomkhojo-cache-v4';

// App install hote hi background me ready ho jana
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Hotfix: pehle fetch fail par fake 200 (text/plain) return hota tha —
// isse JS chunk ki import() MIME error se crash hoti thi (ErrorBoundary).
// Ab: network-first + cache fallback, fail par honest error (fake response NAHI).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // backend API (alag origin) — browser handle kare
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
