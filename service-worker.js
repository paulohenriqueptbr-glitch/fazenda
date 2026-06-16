const CACHE_NAME = "terrasyn-v33";
const APP_FILES = [
  "./",
  "./index.html",
  "./landing.html",
  "./admin.html",
  "./privacy.html",
  "./styles.css?v=28",
  "./icons.js?v=19",
  "./privacy.js?v=20",
  "./landing.js?v=21",
  "./admin.js?v=19",
  "./app.js?v=32",
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
  // NÃO chama skipWaiting() aqui — o usuário decide quando atualizar
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(APP_FILES.map((file) => cache.add(file).catch(() => null)))
    )
  );
});

// O app envia SKIP_WAITING quando o usuário clica em "Atualizar agora"
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "Terrasyn", body: "Você tem um novo alerta.", icon: "./icons/icon-192.png", tag: "terrasyn-alert", url: "/" };
  try {
    if (event.data) Object.assign(data, event.data.json());
  } catch { /* payload inválido — usa defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: data.tag || "terrasyn-alert",
      data: { url: data.url || "/" },
      requireInteraction: Boolean(data.requireInteraction),
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then((c) => c.navigate(target));
      return self.clients.openWindow(target);
    })
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

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
