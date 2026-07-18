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

/* ═══════════════════════════════════════════════════════════════════════
 *  جدولة أيام الاشتراك — المصدر الوحيد للمنيو اليدوي والخطة الذكية معاً.
 *
 *  ⚠️ لماذا هنا؟ نفس القاعدة يحتاجها الاثنان: من أي يوم يبدأ العميل، أي دورة،
 *     وأي الأيام مسموح له بها. لو حسبها كل منهما بنفسه لاختلفا — وهو ما حصل
 *     فعلاً (المنيو يفتح على أسبوع خاطئ). مصدر واحد فلا يفترقان.
 *
 *  القاعدة: نمشي على التقويم من بداية الاشتراك، نتخطّى الجمعة (لا توصيل)،
 *  ونعطي كل يوم اسمَه الحقيقي ودورتَه الحقيقية. الاسم يطابق التاريخ دائماً.
 * ═══════════════════════════════════════════════════════════════════════ */

export const DELIVERY_DAY_NAMES = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"] as const;
export type DeliveryDayName = (typeof DELIVERY_DAY_NAMES)[number];

/** اسم اليوم من رقم getDay() (الأحد=0 … الجمعة=5 … السبت=6). الجمعة تُرجِع "". */
const DOW_NAME: Record<number, string> = {
  0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "", 6: "saturday",
};

export interface SubSlot { week: number; day: DeliveryDayName; }

/**
 * أيام الاشتراك مرتّبة زمنياً — (دورة + يوم) لكل يوم توصيل فعلي بين البداية
 * والنهاية (يتخطّى الجمعة). نقطة الانطلاق = ماكس(بداية الاشتراك، بكرة) لأن اليوم
 * انقضى ميعاد تحضيره. الدورة تبدأ من `startRotationWeek` وتتقدّم +1 كل جمعة.
 *
 * دورات العميل قد تلفّ [2,3,4,1]، فالترتيب زمني لا برقم الدورة.
 */
export function orderedSubscriptionSlots(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  startRotationWeek: number,
): SubSlot[] {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return [];
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return [];
  const subStart = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (end.getTime() < subStart.getTime()) return [];
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const effStart = subStart.getTime() > now.getTime() ? subStart : tomorrow;

  let rotWeek = startRotationWeek >= 1 && startRotationWeek <= 4 ? startRotationWeek : 1;
  const out: SubSlot[] = [];
  const cur = new Date(subStart);
  for (let guard = 0; guard < 400 && cur.getTime() <= end.getTime(); guard++) {
    const dow = cur.getDay();
    if (dow !== 5 && cur.getTime() >= effStart.getTime()) {
      const name = DOW_NAME[dow];
      if (name) out.push({ week: rotWeek, day: name as DeliveryDayName });
    }
    if (dow === 5) rotWeek = (rotWeek % 4) + 1; // كل جمعة → الدورة تتقدّم
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** أول يوم في الاشتراك (نقطة انطلاق المنيو/الخطة) — أو null لو لا اشتراك. */
export function firstSubscriptionSlot(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  startRotationWeek: number,
): SubSlot | null {
  return orderedSubscriptionSlots(startDate, endDate, startRotationWeek)[0] ?? null;
}

/**
 * التاريخ الحقيقي لصنف يحمل (دورة + يوم) — نفس ما تفعله المراجعة والاعتماد.
 * نمشي على التقويم من أول يوم توصيل (ماكس(البداية، بكرة))، نتخطّى الجمعة،
 * ونلتقط أول تاريخ يومُه = day ودورتُه = week. الاسم يطابق التاريخ دائماً.
 *
 * ⚠️ نقطة الانطلاق = بكرة لو الاشتراك بدأ فعلاً (اليوم انقضى ميعاد تحضيره) —
 *    نفس منطق المنيو، فلا يفترقان. بلا endDate نمشي أفقاً ثابتاً (يكفي أي طلب).
 */
export function slotToDate(
  startDate: string | null | undefined,
  startRotationWeek: number,
  week: number,
  day: string,
): string | null {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const target = String(day).toLowerCase();
  const subStart = new Date(`${startDate}T00:00:00`);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const effStart = subStart.getTime() > now.getTime() ? subStart : tomorrow;

  // الدورة عند بداية الاشتراك؛ تتقدّم كل جمعة بين البداية والتاريخ الجاري.
  let rotWeek = startRotationWeek >= 1 && startRotationWeek <= 4 ? startRotationWeek : 1;
  const cur = new Date(subStart);
  for (let guard = 0; guard < 400; guard++) {
    const dow = cur.getDay();
    if (dow !== 5 && cur.getTime() >= effStart.getTime()) {
      const name = DOW_NAME[dow];
      if (name === target && rotWeek === Number(week)) {
        const p = (n: number) => String(n).padStart(2, "0");
        return `${cur.getFullYear()}-${p(cur.getMonth() + 1)}-${p(cur.getDate())}`;
      }
    }
    if (dow === 5) rotWeek = (rotWeek % 4) + 1;
    cur.setDate(cur.getDate() + 1);
  }
  return null;
}
