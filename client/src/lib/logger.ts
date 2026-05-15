/**
 * @file client/src/lib/logger.ts
 * @description Lightweight error logging - يحفظ آخر 50 خطأ في localStorage للمراجعة
 */

interface LogEntry {
  timestamp: number;
  level: "error" | "warn" | "info";
  message: string;
  stack?: string;
  url?: string;
  userId?: string;
}

const STORAGE_KEY = "adrenaline:error-log";
const MAX_ENTRIES = 50;

function getLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(entries: LogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // ignore quota errors
  }
}

export function logError(message: string, stack?: string) {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level: "error",
    message,
    stack,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  };
  const log = getLog();
  log.push(entry);
  saveLog(log);

  // eslint-disable-next-line no-console
  console.error("[App Error]", message, stack);
}

export function logWarn(message: string) {
  const log = getLog();
  log.push({
    timestamp: Date.now(),
    level: "warn",
    message,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  });
  saveLog(log);
  console.warn("[App Warn]", message);
}

export function getRecentLogs(): LogEntry[] {
  return getLog().slice().reverse();
}

export function clearLogs() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * تركيب handlers عامة للأخطاء غير المتوقعة
 */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    logError(event.message, event.error?.stack);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = typeof reason === "string" ? reason : reason?.message || "Unhandled rejection";
    logError(`Unhandled Promise: ${msg}`, reason?.stack);
  });
}
