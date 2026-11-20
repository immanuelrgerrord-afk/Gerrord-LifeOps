const CACHE_NAME = "lifeops-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("lifeops-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            try {
              await (await caches.open(CACHE_NAME)).put(request, response.clone());
            } catch {
              // Keep the online response if storage is unavailable.
            }
          }
          return response;
        } catch {
          return (await caches.match(request)) || (await caches.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  if (
    url.pathname.startsWith("/assets/") ||
    /\.(?:png|svg|webmanifest|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          try {
            await (await caches.open(CACHE_NAME)).put(request, response.clone());
          } catch {
            // Keep the online response if storage is unavailable.
          }
        }
        return response;
      })(),
    );
  }
});
