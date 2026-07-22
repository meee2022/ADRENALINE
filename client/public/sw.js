/**
 * Cleanup worker for installations that still have an older Adrenaline service
 * worker. The live application requires network access, so the old offline cache
 * is removed to prevent stale bundles and images on installed mobile apps.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("adrenaline-"))
            .map((key) => caches.delete(key)),
        ),
      ),
      self.registration.unregister(),
    ]),
  );
});
