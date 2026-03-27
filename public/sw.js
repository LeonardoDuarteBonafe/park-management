const CACHE_NAME = "parkflow-static-v3";
const OFFLINE_FALLBACK = "/offline.html";
const APP_SHELL = [OFFLINE_FALLBACK];
const STATIC_DESTINATIONS = new Set(["style", "script", "image", "font"]);
const STATIC_ASSET_PATTERN =
  /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf)$/i;

function isStaticAssetRequest(request, url) {
  return STATIC_DESTINATIONS.has(request.destination) || STATIC_ASSET_PATTERN.test(url.pathname);
}

async function putInCache(request, response) {
  if (!response.ok) {
    return response;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());

  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }

          return Promise.resolve();
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match(OFFLINE_FALLBACK)) ?? Response.error();
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    return;
  }

  if (!isStaticAssetRequest(request, url)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        void fetch(request)
          .then((response) => putInCache(request, response))
          .catch(() => undefined);
        return cached;
      }

      return fetch(request).then((response) => putInCache(request, response));
    }),
  );
});
