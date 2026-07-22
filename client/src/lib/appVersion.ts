declare const __APP_BUILD_ID__: string;

const VERSION_STORAGE_KEY = "adrenaline:app-build";
const VERSION_ENDPOINT = "/app-version.json";

async function clearAppCaches() {
  if ("caches" in window) {
    const keys = await window.caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("adrenaline-"))
        .map((key) => window.caches.delete(key)),
    );
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

function reloadWithVersion(version: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("app-version", version.slice(0, 16));
  window.location.replace(url.toString());
}

async function applyVersion(version: string) {
  try {
    window.localStorage.setItem(VERSION_STORAGE_KEY, version);
  } catch {
    // Private browsing may reject storage; cache cleanup still remains useful.
  }
  await clearAppCaches();
  reloadWithVersion(version);
}

/**
 * Runs once at application startup. It never clears authentication or customer
 * data; only Cache Storage and legacy service-worker registrations are removed.
 */
export function initializeAppVersion() {
  if (!import.meta.env.PROD) return;

  let installedVersion: string | null = null;
  try {
    installedVersion = window.localStorage.getItem(VERSION_STORAGE_KEY);
    if (!installedVersion) {
      window.localStorage.setItem(VERSION_STORAGE_KEY, __APP_BUILD_ID__);
    }
  } catch {
    // Continue without persistent version storage.
  }

  if (installedVersion && installedVersion !== __APP_BUILD_ID__) {
    void applyVersion(__APP_BUILD_ID__);
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);

  void fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
    signal: controller.signal,
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      const remoteVersion = typeof payload?.version === "string" ? payload.version : null;
      if (remoteVersion && remoteVersion !== __APP_BUILD_ID__) {
        return applyVersion(remoteVersion);
      }
    })
    .catch(() => undefined)
    .finally(() => window.clearTimeout(timeout));
}
