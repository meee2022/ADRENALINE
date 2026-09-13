declare const __APP_BUILD_ID__: string;

const VERSION_STORAGE_KEY = "adrenaline:app-build";
const VERSION_ENDPOINT = "/app-version.json";
const VERSION_CHECK_INTERVAL_MS = 60_000;

let versionCheckInFlight = false;
let reloadStarted = false;
let hasUnsavedInteraction = false;
let lastInteractionAt = 0;

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
  try {
    await clearAppCaches();
  } catch {
    // Cache APIs differ between browsers; a failed cleanup must not prevent
    // the cache-busted navigation that actually loads the new build.
  }
  reloadWithVersion(version);
}

/**
 * Clears obsolete app assets and reloads the newest deployed build. This is
 * also used by the global error boundary as a one-time self-healing step.
 */
export async function recoverLatestApplication() {
  let version = __APP_BUILD_ID__;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (response.ok) {
      const payload = await response.json();
      if (typeof payload?.version === "string" && payload.version) version = payload.version;
    }
  } catch {
    // Even while offline, clearing stale local assets and reloading is useful.
  } finally {
    window.clearTimeout(timeout);
  }

  await applyVersion(version);
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
    // Do not interrupt typing, a POS basket, or an in-flight user action.
    // A fresh page load will use the newest assets; explicit crash recovery
    // remains available independently of this background update guard.
    if (remoteVersion && remoteVersion !== __APP_BUILD_ID__ &&
        !hasUnsavedInteraction && Date.now() - lastInteractionAt > 30_000) {
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

  // The running bundle is already loaded. An older tab must not reload merely
  // because another tab updated this shared localStorage marker.
  if (installedVersion !== __APP_BUILD_ID__) {
    try { window.localStorage.setItem(VERSION_STORAGE_KEY, __APP_BUILD_ID__); } catch { /* optional */ }
  }

  document.addEventListener("input", () => { hasUnsavedInteraction = true; }, true);
  document.addEventListener("click", (event) => {
    lastInteractionAt = Date.now();
    // Button-driven selections (meal picker / POS) need the same protection
    // as text fields. Avoid assuming that a click was successfully saved.
    if (event.target instanceof Element && event.target.closest("button,[role='button']")) {
      hasUnsavedInteraction = true;
    }
  }, true);

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
