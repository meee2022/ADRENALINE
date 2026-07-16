/**
 * @file client/src/lib/subscription.ts
 * @description حالة اشتراك المشترك على الموقع العام — المصدر الوحيد.
 *
 *   ═══ لماذا مشتركة؟ ═══
 *   المنيو اليدوي والخطة الذكية كلاهما يحتاج نفس الحكم: هل الاشتراك ساري؟
 *   لو حسبها كل منهما بنفسه لاختلفا مع الوقت (وهو ما حصل فعلاً في تقارير
 *   المنافذ: صفحة تقول "أوقف" وPDF يقول "قلّل" لنفس الصنف).
 *
 *   ═══ التوقيت ═══
 *   التواريخ هنا "تاريخ فقط" (yyyy-MM-dd) بلا وقت. قطر UTC+3، وtoISOString
 *   بترجع UTC — فبعد الساعة 9 مساءً بتدي تاريخ بكرة. لذلك نبني التاريخ من
 *   getFullYear/getMonth/getDate المحلية.
 */

import { localISO } from "./mealSchedule";

/** تاريخ اليوم محلياً بصيغة yyyy-MM-dd. */
export function localToday(): string {
  return localISO(new Date());
}

export type SubscriptionState =
  /** لا يوجد اشتراك مرتبط بالرقم. */
  | { status: "none" }
  /** الاشتراك سارٍ — daysLeft = الأيام حتى تاريخ الانتهاء (0 = ينتهي اليوم). */
  | { status: "active"; endDate: string; daysLeft: number }
  /** انتهى — endDate في الماضي. */
  | { status: "expired"; endDate: string; daysAgo: number };

/** فرق الأيام بين تاريخين (yyyy-MM-dd) — b − a. */
function daysBetween(a: string, b: string): number {
  const t1 = new Date(`${a}T00:00:00`).getTime();
  const t2 = new Date(`${b}T00:00:00`).getTime();
  return Math.round((t2 - t1) / 86400000);
}

/**
 * يحدّد حالة الاشتراك من تاريخ انتهائه.
 * ⚠️ endDate يومٌ شامل: اشتراك ينتهي اليوم لا يزال سارياً.
 */
export function subscriptionState(endDate?: string | null): SubscriptionState {
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { status: "none" };
  const today = localToday();
  const diff = daysBetween(today, endDate); // موجب = باقي أيام
  if (diff < 0) return { status: "expired", endDate, daysAgo: -diff };
  return { status: "active", endDate, daysLeft: diff };
}

/** اختصار: هل انتهى الاشتراك؟ */
export function isExpired(endDate?: string | null): boolean {
  return subscriptionState(endDate).status === "expired";
}
