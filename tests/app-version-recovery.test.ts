import { afterEach, beforeEach, expect, it, vi } from "vitest";

let doc: EventTarget;
let replace: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv("PROD", true);
  vi.stubGlobal("__APP_BUILD_ID__", "old-build");
  doc = new EventTarget();
  Object.assign(doc, { visibilityState: "visible" });
  replace = vi.fn();
  vi.stubGlobal("document", doc);
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("window", {
    location: { href: "https://example.com/gym-sales", replace },
    localStorage: { getItem: () => "old-build", setItem: vi.fn() },
    setTimeout, clearTimeout, setInterval, addEventListener: vi.fn(),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "new-build" }) }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("loads a new build automatically on an idle page and does not loop", async () => {
  const { initializeAppVersion } = await import("../client/src/lib/appVersion");
  initializeAppVersion();
  await vi.advanceTimersByTimeAsync(1);
  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith("https://example.com/gym-sales?app-version=new-build");
  await vi.advanceTimersByTimeAsync(120_000);
  expect(replace).toHaveBeenCalledTimes(1);
});

it("defers background updates after the user starts editing", async () => {
  const { initializeAppVersion } = await import("../client/src/lib/appVersion");
  initializeAppVersion();
  doc.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(120_000);
  expect(replace).not.toHaveBeenCalled();
});

it("does not reload or erase a session when the version endpoint is unavailable", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("offline"));
  const { initializeAppVersion } = await import("../client/src/lib/appVersion");
  initializeAppVersion();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(replace).not.toHaveBeenCalled();
});
