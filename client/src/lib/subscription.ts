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

import { localISO, isSnackCategory, isMainCategory } from "./mealSchedule";

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

/**
 * تاريخ اليوم داخل بلوكه الطبيعي — أول ظهور لـ(دورة + يوم) بالمشي من بداية
 * الاشتراك **بلا** قصّ عند «بكرة». يُستخدم لعرض التاريخ جنب اسم اليوم في المنيو.
 *
 * ⚠️ الفرق عن slotToDate: هذه لا تشترط أن يكون التاريخ ≥ بكرة. فيوم في بلوك
 *    البداية عدّى ميعاده (كسبت اليوم) يُرجِع تاريخه الحقيقي (18 يوليو) بدل أن
 *    يقفز 6 أسابيع لأول سبت‑دورة‑2 قادم. المنيو يخفيه لأنه ماضٍ، بدل أن يعرض
 *    تاريخاً بعيداً مربكاً. أما slotToDate (للتوصيل/الاعتماد) فتقصّ عند بكرة عمداً.
 */
export function slotBlockDate(
  startDate: string | null | undefined,
  startRotationWeek: number,
  week: number,
  day: string,
): string | null {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const target = String(day).toLowerCase();
  const subStart = new Date(`${startDate}T00:00:00`);
  let rotWeek = startRotationWeek >= 1 && startRotationWeek <= 4 ? startRotationWeek : 1;
  // ⚠️ نبدأ المشي من سبت الأسبوع (حدّ الدورة) لا من يوم البداية نفسه: لو بدأ
  //    العميل الاثنين، فسبت وأحد دورته (18/19) قبل بدايته لكنهما جزء من بلوكه.
  //    نمشي منهما فيأخذان تاريخهما الحقيقي (الماضي) ويُخفَيان، بدل أن نقفز لأول
  //    سبت‑دورة قادم بعد 4 أسابيع. لا جمعة بين سبت الأسبوع والبداية فالدورة ثابتة.
  const cur = new Date(subStart);
  while (cur.getDay() !== 6) cur.setDate(cur.getDate() - 1); // ارجع لأقرب سبت ≤ البداية
  for (let guard = 0; guard < 400; guard++) {
    const dow = cur.getDay();
    if (dow !== 5) {
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

/* ═══════════════════════════════════════════════════════════════════════
 *  نقص الخطة عن الاشتراك — المصدر الوحيد لفحص «كم وجبة/سناك ناقصة».
 *
 *  ⚠️ لا يغيّر أي قيد قائم (السقف، الجدولة، تحديد الأيام) — فقط يحسب.
 *  القاعدة (صارمة): كل يوم مضمَّن في الطلب يجب أن يحتوي بالضبط عدد وجبات
 *  الاشتراك (mealsPerDay رئيسية + snacksPerDay سناك). لو أقل → نقص.
 *  السقف الأعلى محكوم أصلاً في المنيو، فهنا نكتفي بفحص «الأقل».
 * ═══════════════════════════════════════════════════════════════════════ */

export interface PlanShortfall {
  mealsShort: number;   // إجمالي الوجبات الرئيسية الناقصة عبر كل الأيام
  snacksShort: number;  // إجمالي السناكات الناقصة
  incompleteDays: number;
  worstDay: { week: number; day: string; mains: number; snacks: number } | null;
}

/** يحسب نقص الخطة عن الاشتراك. بلا عدد مضبوط (0/غير معرّف) ⇒ لا نقص (لا فحص). */
export function planShortfall(
  items: Array<{ week?: number | string; day?: string; category?: string; isOff?: boolean }>,
  mealsPerDay: number,
  snacksPerDay: number,
): PlanShortfall {
  const mpd = Number.isFinite(mealsPerDay) && mealsPerDay > 0 ? Math.floor(mealsPerDay) : 0;
  const spd = Number.isFinite(snacksPerDay) && snacksPerDay > 0 ? Math.floor(snacksPerDay) : 0;
  if (!mpd && !spd) return { mealsShort: 0, snacksShort: 0, incompleteDays: 0, worstDay: null };

  const byDay = new Map<string, { week: number; day: string; mains: number; snacks: number }>();
  for (const it of items) {
    if (it?.isOff) continue;
    const week = Number(it?.week); const day = String(it?.day || "").toLowerCase();
    if (!week || !day) continue;
    const k = `${week}:${day}`;
    const rec = byDay.get(k) || { week, day, mains: 0, snacks: 0 };
    // ⚠️ نفس تصنيف المنيو اليدوي بالضبط (PublicMenu): الرئيسية = isMainCategory،
    //    السناك = isSnackCategory. الفئات غير المعروفة لا تُحسب في أيٍّ منهما،
    //    كي لا تكون البوابة أصرم من المنيو فتمنع طلباً يعتبره المنيو مكتملاً.
    if (isSnackCategory(it?.category)) rec.snacks++;
    else if (isMainCategory(it?.category)) rec.mains++;
    byDay.set(k, rec);
  }

  let mealsShort = 0, snacksShort = 0, incompleteDays = 0;
  let worst: PlanShortfall["worstDay"] = null;
  for (const rec of byDay.values()) {
    const ms = Math.max(0, mpd - rec.mains);
    const ss = Math.max(0, spd - rec.snacks);
    if (ms || ss) { incompleteDays++; if (!worst) worst = rec; }
    mealsShort += ms; snacksShort += ss;
  }
  return { mealsShort, snacksShort, incompleteDays, worstDay: worst };
}

/**
 * نقص الخطة عبر **كل أيام الاشتراك** (لا الأيام المختارة فقط) — البوابة الصارمة
 * لتأكيد الطلب. العميل يجب أن يُكمل كل يوم توصيل في اشتراكه (mealsPerDay رئيسية +
 * snacksPerDay سناك) قبل الإرسال؛ يومٌ ناقص أو غائب = نقص → «أكمل وجباتك».
 *
 * ⚠️ نفس مصدر المنيو: `slots` = `orderedSubscriptionSlots(...)` مُزال منها التكرار
 *    بمفتاح week:day (كما يفعل المنيو بـ Set). التصنيف مطابق للمنيو. بلا عددٍ مضبوط
 *    (0) أو بلا سلوتات ⇒ لا فحص (لا نمنع من لا نعرف اشتراكه).
 */
export function subscriptionShortfall(
  items: Array<{ week?: number | string; day?: string; category?: string; isOff?: boolean }>,
  slots: Array<{ week: number; day: string }>,
  mealsPerDay: number,
  snacksPerDay: number,
): PlanShortfall {
  const mpd = Number.isFinite(mealsPerDay) && mealsPerDay > 0 ? Math.floor(mealsPerDay) : 0;
  const spd = Number.isFinite(snacksPerDay) && snacksPerDay > 0 ? Math.floor(snacksPerDay) : 0;
  if ((!mpd && !spd) || !slots || slots.length === 0) {
    return { mealsShort: 0, snacksShort: 0, incompleteDays: 0, worstDay: null };
  }

  // عدّ ما اختاره العميل لكل (أسبوع:يوم)
  const counts = new Map<string, { mains: number; snacks: number }>();
  for (const it of items) {
    if (it?.isOff) continue;
    const week = Number(it?.week); const day = String(it?.day || "").toLowerCase();
    if (!week || !day) continue;
    const k = `${week}:${day}`;
    const rec = counts.get(k) || { mains: 0, snacks: 0 };
    if (isSnackCategory(it?.category)) rec.snacks++;
    else if (isMainCategory(it?.category)) rec.mains++;
    counts.set(k, rec);
  }

  // كل سلوت اشتراك مطلوب (بلا تكرار) لازم يكتمل
  const seen = new Set<string>();
  let mealsShort = 0, snacksShort = 0, incompleteDays = 0;
  let worst: PlanShortfall["worstDay"] = null;
  for (const s of slots) {
    const day = String(s.day || "").toLowerCase();
    const k = `${Number(s.week)}:${day}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const rec = counts.get(k) || { mains: 0, snacks: 0 };
    const ms = Math.max(0, mpd - rec.mains);
    const ss = Math.max(0, spd - rec.snacks);
    if (ms || ss) {
      incompleteDays++;
      if (!worst) worst = { week: Number(s.week), day, mains: rec.mains, snacks: rec.snacks };
    }
    mealsShort += ms; snacksShort += ss;
  }
  return { mealsShort, snacksShort, incompleteDays, worstDay: worst };
}
