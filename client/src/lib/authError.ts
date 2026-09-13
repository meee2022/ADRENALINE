/**
 * @file client/src/lib/authError.ts
 * @description كشف أخطاء انتهاء الجلسة القادمة من Convex.
 *
 * دوال Convex المحميّة ترمي `AUTH_ERR` من convex/sessions.ts. الاستعلام الذي
 * يرمي أثناء العرض يصعد إلى ErrorBoundary فيسقط التطبيق كله بشاشة "خطأ غير
 * متوقّع" — وهذا ما يحدث لأي موظف انتهت جلسته أو غُيّرت كلمة مروره
 * (تغيير كلمة المرور يُبطل الجلسات القديمة عمداً).
 *
 * الصحيح أن يُعاد إلى صفحة الدخول، لا أن يرى انهياراً.
 */

/** نصوص الأخطاء كما ترميها convex/sessions.ts — أبقِها متطابقة. */
const AUTH_MESSAGES = [
  "غير مصرّح — سجّل الدخول من جديد",
];

/** هل هذا الخطأ سببه جلسة غير صالحة/منتهية؟ */
export function isAuthError(error: unknown): boolean {
  const data = error && typeof error === "object" && "data" in error ? error.data : undefined;
  const msg =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return AUTH_MESSAGES.some((m) => msg.includes(m) || (typeof data === "string" && data.includes(m)));
}
