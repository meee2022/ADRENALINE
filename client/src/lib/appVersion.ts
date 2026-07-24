declare const __APP_BUILD_ID__: string;

const VERSION_STORAGE_KEY = "adrenaline:app-build";
const VERSION_ENDPOINT = "/app-version.json";
const VERSION_CHECK_INTERVAL_MS = 60_000;

let versionCheckInFlight = false;
let reloadStarted = false;

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
  if (reloadStarted) return;
  reloadStarted = true;

  try {
    window.localStorage.setItem(VERSION_STORAGE_KEY, version);
  } catch {
    // Private browsing may reject storage; cache cleanup still remains useful.
  }
  await clearAppCaches();
  reloadWithVersion(version);
}

async function checkForRemoteVersion() {
  if (versionCheckInFlight || reloadStarted) return;
  versionCheckInFlight = true;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (!response.ok) return;

    const payload = await response.json();
    const remoteVersion =
      typeof payload?.version === "string" ? payload.version : null;
    if (remoteVersion && remoteVersion !== __APP_BUILD_ID__) {
      await applyVersion(remoteVersion);
    }
  } catch {
    // A temporary network outage must never block normal application use.
  } finally {
    window.clearTimeout(timeout);
    versionCheckInFlight = false;
  }
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

  void checkForRemoteVersion();

  const checkWhenActive = () => {
    if (document.visibilityState === "visible") {
      void checkForRemoteVersion();
    }
  };

  window.setInterval(checkWhenActive, VERSION_CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", checkWhenActive);
  window.addEventListener("focus", checkWhenActive);
  window.addEventListener("online", checkWhenActive);
}
