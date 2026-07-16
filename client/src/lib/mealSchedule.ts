/**
 * @file client/src/lib/mealSchedule.ts
 * @description جدولة الوجبات على دورة المطبخ — المصدر الوحيد للمنيو اليدوي
 *              والخطة الذكية.
 *
 *   ═══ ليه مشتركة؟ ═══
 *   نفس السؤال «هل الوجبة دي مقرَّرة في أسبوع X يوم Y؟» كان متعمول 3 مرات
 *   بـ3 طرق:
 *     PublicMenu : s.week === selectedWeek && s.day === selectedDay
 *     SmartPlan  : Number(s.week) === wk && String(s.day).toLowerCase() === d
 *     ai.ts      : (s.day||"").toLowerCase() === day && Number(s.week) === wk
 *   البيانات حالياً نظيفة (week أرقام، day حروف صغيرة) فالثلاثة يتفقون —
 *   لكن أي مسار كتابة يكتب "2" أو "Saturday" يكسر المنيو اليدوي وحده بصمت
 *   بينما الذكية تكمل شغّالة. التوحيد يقفل الباب ده.
 *
 *   ⚠️ convex/ai.ts نسخته الخاصة لأنه يشتغل على الخادم (لا يستورد من client).
 *      لو غيّرت المنطق هنا، غيّره هناك — المنطق واحد بحكم المنتج.
 */

/* ═══════════════ تصنيف الوجبات: رئيسية مقابل سناك ═══════════════
 *
 *   ⚖️ قرار المنتج: **السلطة سناك**.
 *
 *   كان المنيو اليدوي فيه 3 تعريفات متضاربة في نفس الملف:
 *     - عدّاد اليوم        : category === "snack"        (يتجاهل السلطة)
 *     - عدّاد تقدّم الأسبوع : !isMain                     (يحسب السلطة)
 *     - بوابة حد السناك    : category === "snack"        (فالسلطة بلا حد!)
 *   وconvex/ai.ts يحسبه ["snack","salad"]. النتيجة: نفس الخطة تُعدّ بأربع
 *   طرق مختلفة حسب مين بيسأل.
 *
 *   ⚠️ convex/ai.ts نسخته الخاصة (خادم، لا يستورد من client) — متوافقة مع
 *      هنا. لو غيّرت التصنيف، غيّره هناك.
 */
export const MAIN_CATEGORIES = ["breakfast", "lunch", "dinner"] as const;
export const SNACK_CATEGORIES = ["snack", "salad"] as const;

const norm = (c: any) => String(c || "").toLowerCase().trim();

/** وجبة رئيسية؟ (فطور/غداء/عشاء) */
export function isMainCategory(category: any): boolean {
  return (MAIN_CATEGORIES as readonly string[]).includes(norm(category));
}

/** سناك؟ (سناك أو سلطة) */
export function isSnackCategory(category: any): boolean {
  return (SNACK_CATEGORIES as readonly string[]).includes(norm(category));
}

/** أيام الأسبوع بترتيب Date.getDay() — الأحد 0 … السبت 6. */
export const DAY_NAMES = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

/** الجمعة إجازة — لا توصيل. (Date.getDay() === 5) */
export const FRIDAY = 5;

/** اسم يوم التاريخ بالإنجليزية الصغيرة (نفس صيغة publicMeals.schedule.day). */
export function dayNameOf(d: Date): string {
  return DAY_NAMES[d.getDay()];
}

/** هل ده يوم توصيل؟ (السبت→الخميس، والجمعة إجازة) */
export function isDeliveryDay(d: Date): boolean {
  return d.getDay() !== FRIDAY;
}

/**
 * ✅ تنسيق تاريخ محلي yyyy-MM-dd.
 * ⚠️ لا تستخدم toISOString: بترجع UTC، وقطر UTC+3 — فبعد التاسعة مساءً
 *    بتدي تاريخ بكرة.
 */
export function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * هل الوجبة مقرَّرة في (أسبوع الدورة + اليوم) المطلوبين؟
 *
 * نوحّد النوع قبل المقارنة: week قد يُكتب رقماً أو نصاً، وday بأي حالة أحرف.
 * وجبة بلا جدولة لا تُعتبر متاحة — لا نتساهل فيتسرّب منيو أيام أخرى.
 */
export function mealScheduledFor(meal: any, week: number, day: string): boolean {
  if (!week || !day) return false;
  const d = String(day).toLowerCase();

  if (Array.isArray(meal?.schedule) && meal.schedule.length) {
    return meal.schedule.some(
      (s: any) => Number(s?.week) === Number(week) && String(s?.day || "").toLowerCase() === d,
    );
  }

  // صيغة قديمة: weeks[] + days[] منفصلين
  const weeks = Array.isArray(meal?.weeks) ? meal.weeks.map(Number) : [];
  const days = Array.isArray(meal?.days) ? meal.days.map((x: any) => String(x).toLowerCase()) : [];
  if (weeks.length || days.length) return weeks.includes(Number(week)) && days.includes(d);

  return false;
}
