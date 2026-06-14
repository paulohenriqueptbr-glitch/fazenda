const CACHE_NAME = "agro-plus-v31";
const APP_FILES = [
  "./",
  "./index.html",
  "./landing.html",
  "./admin.html",
  "./privacy.html",
  "./styles.css?v=26",
  "./icons.js?v=19",
  "./privacy.js?v=20",
  "./landing.js?v=20",
  "./admin.js?v=19",
  "./app.js?v=30",
  "./vendor/supabase.js?v=2.108.0",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
  "https://unpkg.com/lucide@0.383.0/dist/umd/lucide.min.js",
];

const isConfigRequest = (url) => url.pathname === "/api/config.js";
const isApiRequest = (url) => url.pathname.startsWith("/api/");
const emptyConfigResponse = () =>
  new Response("window.CONTROLE_LEITE_CONFIG = {};", {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(APP_FILES.map((file) => cache.add(file).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (isConfigRequest(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response && response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          return (await cache.match(event.request)) || emptyConfigResponse();
        }
      })
    );
    return;
  }

  if (isApiRequest(url)) return;

  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      }
    })
  );
});
