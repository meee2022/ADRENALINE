const TECHNICAL_MARKERS = [
  "request id", "convex", "argumentvalidationerror", "validationerror",
  "server error", "uncaught", "stack", "validator:", "sessiontoken",
  "object contains extra field", "called by client", "typeerror",
];

function currentLanguage(): "ar" | "en" {
  try { return localStorage.getItem("app_language") === "en" ? "en" : "ar"; }
  catch { return "ar"; }
}

export function getUserError(error: unknown, language: "ar" | "en" = currentLanguage()): string {
  const fallback = language === "ar"
    ? "تعذر إكمال العملية. حاول مرة أخرى، وإذا استمرت المشكلة تواصل مع المسؤول."
    : "The operation could not be completed. Try again, and contact an administrator if it continues.";
  const raw = String((error as any)?.message ?? error ?? "").trim();
  if (!raw) return fallback;

  if (raw.includes("Object contains extra field `returnDate`")) {
    return language === "ar"
      ? "تحديث نظام المرتجعات لم يُفعّل على الخادم بعد. تواصل مع المسؤول."
      : "The returns update is not active on the server yet. Contact an administrator.";
  }
  if (/network|fetch failed|failed to fetch|internet|websocket/i.test(raw)) {
    return language === "ar"
      ? "تعذر الاتصال بالخادم. تحقق من الشبكة ثم حاول مرة أخرى."
      : "Could not connect to the server. Check the network and try again.";
  }
  if (/not authenticated|unauthorized|انتهت الجلسة|غير مصرح/i.test(raw)) {
    return language === "ar"
      ? "انتهت الجلسة أو لا تملك صلاحية تنفيذ هذه العملية."
      : "Your session expired or you do not have permission for this action.";
  }

  // ✅ رسائل الأعمال المرمية بـ `throw new Error("…")` تصل مغلّفة:
  //    "… Server Error\nUncaught Error: <الرسالة>\n at …". نستخرج <الرسالة>
  //    ونزيل بادئة "Uncaught Error:" قبل فحص العلامات التقنية — وإلا تحجبها كلمة
  //    "uncaught" فتظهر رسالة عامة بلا سبب (مثال: «لا يمكن الحذف — للعميل طلبات»).
  let serverMessage = raw
    .match(/Server Error\s*\n?([\s\S]*?)(?:\n\s*at\s|\n\s*Called by client|$)/i)?.[1]
    ?.trim();
  if (serverMessage) {
    serverMessage = serverMessage.replace(/^Uncaught\s+(?:Convex)?Error:\s*/i, "").trim();
  }
  if (serverMessage && !TECHNICAL_MARKERS.some((marker) => serverMessage!.toLowerCase().includes(marker))) {
    return serverMessage.slice(0, 240);
  }

  const lower = raw.toLowerCase();
  if (TECHNICAL_MARKERS.some((marker) => lower.includes(marker)) || raw.length > 300) return fallback;

  return raw
    .replace(/^\[CONVEX[^\]]*\]\s*/i, "")
    .replace(/^Request ID:[^\n]*\n?/i, "")
    .trim()
    .slice(0, 240) || fallback;
}

export function sanitizeUserText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const lower = value.toLowerCase();
  return TECHNICAL_MARKERS.some((marker) => lower.includes(marker)) || value.length > 300
    ? getUserError(value)
    : value;
}
