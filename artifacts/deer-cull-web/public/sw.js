/**
 * Deer Cull Records — Service Worker
 * Caches map tiles from Esri and OpenStreetMap for offline use.
 */

const CACHE_NAME = "deer-cull-tiles-v1";

const TILE_HOSTS = [
  "server.arcgisonline.com",
  "tile.openstreetmap.org",
];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const isTile = TILE_HOSTS.some(h => url.hostname.includes(h));
  if (!isTile) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached;

        // Tiles may not have CORS headers — use no-cors (opaque response)
        return fetch(event.request, { mode: "no-cors" }).then(response => {
          // Cache opaque (no-cors) and regular successful responses
          if (response.type === "opaque" || response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => {
          // Offline and not cached — nothing we can do
          return new Response("", { status: 503, statusText: "Offline" });
        });
      })
    )
  );
});

// ── Messaging ──────────────────────────────────────────────────────────
self.addEventListener("message", event => {
  const { type } = event.data || {};

  if (type === "GET_CACHE_INFO") {
    caches.open(CACHE_NAME).then(cache =>
      cache.keys().then(keys => {
        event.ports[0].postMessage({ count: keys.length });
      })
    );
    return;
  }

  if (type === "CLEAR_CACHE") {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ ok: true });
    });
    return;
  }

  if (type === "CACHE_TILES") {
    const { urls } = event.data;
    caches.open(CACHE_NAME).then(async cache => {
      let done = 0;
      const clients = await self.clients.matchAll();

      for (const url of urls) {
        try {
          const req = new Request(url);
          const existing = await cache.match(req);
          if (!existing) {
            const res = await fetch(req, { mode: "no-cors" });
            if (res.type === "opaque" || res.ok) {
              await cache.put(req, res);
            }
          }
        } catch {
          // skip failed tile
        }
        done++;
        for (const client of clients) {
          client.postMessage({ type: "TILE_PROGRESS", done, total: urls.length });
        }
      }

      for (const client of clients) {
        client.postMessage({ type: "TILE_DONE", total: urls.length });
      }
    });
    return;
  }
});
