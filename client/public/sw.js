/**
 * @file public/sw.js
 * @description Service Worker - دعم الـ offline والـ caching للأصول
 */

const CACHE_VERSION = "adrenaline-v3";
const STATIC_ASSETS = [
  "/",
  "/heart-logo.png",
  "/heart-icon.png",
  "/adrenaline-logo.png",
  "/adrenaline-logo-full.png",
  "/manifest.webmanifest",
];

// Install: cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // ✅ نتعامل فقط مع طلبات نفس الموقع عبر http(s):
  //  - نتجاهل chrome-extension:// (الـ Cache API يرفض تخزينها) وأي بروتوكول آخر
  //  - نتجاهل الطلبات عبر المصادر (بلاطات الخريطة/الخطوط/كونفكس) فتذهب للشبكة مباشرة بدون تدخّل
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML (so user always gets latest)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request) || caches.match("/")),
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          if (resp.ok && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => cached || new Response("Offline", { status: 503 }));
    }),
  );
});
