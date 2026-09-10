/**
 * قواعد اختيار الوجبات — حدود الاشتراك اليومية، اكتمال اليوم، والحكم على إضافة وجبة.
 * TypeScript صافٍ. المصدر الوحيد لهذه القواعد: المنيو اليدوي، الخطة الذكية، الخادم،
 * وتطبيق الجوال يستوردونها من هنا ولا يعيد أيٌّ منهم كتابتها.
 *
 * ⚠️ نُقلت من شاشة المنيو (PublicMenu) كما هي؛ الفرق الوحيد المقصود: «اكتمال اليوم»
 *    صار حكماً واحداً (dayComplete) بعد أن كانت للشاشة نسختان تختلفان حين لا يكون
 *    للمشترك حدّ وجبات مسجَّل — الآن تُستخدم نسخة dayProgress في الموضعين.
 */
import { isMainCategory, isSnackCategory, isBreakfastCategory, BREAKFAST_MAX_PER_DAY } from "./mealSchedule";
import { orderedSubscriptionSlots } from "./subscription";

/** حدّ يومي: **صفر يعني صفر** (مشترك بلا سناك مثلاً)؛ null/undefined/"" فقط تعني «بلا حدّ معروف» (Infinity). */
export function dailyLimit(v: unknown): number {
  if (v === null || v === undefined || v === "") return Infinity;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : Infinity;
}

export interface DailyLimits {
  mealsPerDay: number;
  snacksPerDay: number;
  hasMealLimit: boolean;
  hasSnackLimit: boolean;
  /** اشتراك مسجَّل بلا أي عدد (لا رئيسية ولا سناك) — لا يُسمح بالاختيار حتى تضبطه الأخصائية. */
  noMealPlan: boolean;
}

/** حدود العميل اليومية من ملفه. `customer` غير المسجَّل (null) = بلا حدود وبلا منع. */
export function dailyLimits(customer: { mealsPerDay?: unknown; snacksPerDay?: unknown } | null | undefined): DailyLimits {
  const mealsPerDay = dailyLimit(customer?.mealsPerDay);
  const snacksPerDay = dailyLimit(customer?.snacksPerDay);
  const hasMealLimit = Number.isFinite(mealsPerDay);
  const hasSnackLimit = Number.isFinite(snacksPerDay);
  return { mealsPerDay, snacksPerDay, hasMealLimit, hasSnackLimit, noMealPlan: !!customer && !hasMealLimit && !hasSnackLimit };
}

export interface PickCounts { meals: number; snacks: number; breakfasts: number; count: number; }

/** عدّ ما اختاره العميل ليوم واحد (رئيسية / سناك / فطار / الكل). */
export function countPicks(picked: ReadonlyArray<{ category?: unknown }>): PickCounts {
  let meals = 0, snacks = 0, breakfasts = 0;
  for (const p of picked) {
    const c = p?.category;
    if (isMainCategory(c)) meals++;
    if (isSnackCategory(c)) snacks++;
    if (isBreakfastCategory(c)) breakfasts++;
  }
  return { meals, snacks, breakfasts, count: picked.length };
}

/** هل اكتمل اليوم؟ بلا حدود مسجَّلة لا يكتمل أبداً (يبقى مفتوحاً). */
export function dayComplete(c: PickCounts, l: DailyLimits): boolean {
  return (l.hasMealLimit || l.hasSnackLimit)
    && (!l.hasMealLimit || c.meals >= l.mealsPerDay)
    && (!l.hasSnackLimit || c.snacks >= l.snacksPerDay);
}

export interface DayProgress extends PickCounts { complete: boolean; }

export function dayProgress(picked: ReadonlyArray<{ category?: unknown }>, l: DailyLimits): DayProgress {
  const c = countPicks(picked);
  return { ...c, complete: dayComplete(c, l) };
}

/** هل امتلأت خانة هذا النوع (سناك أو رئيسية) لليوم؟ — يعطّل زر «أضف» في البطاقة. */
export function slotFull(category: unknown, c: PickCounts, l: DailyLimits): boolean {
  return isSnackCategory(category) ? c.snacks >= l.snacksPerDay : c.meals >= l.mealsPerDay;
}

export type AddBlock = "noMealPlan" | "snacksFull" | "mealsFull" | null;

/**
 * الحكم على إضافة وجبة ليوم: ما الذي يمنعها، وهل تحتاج تأكيد «فطار ثانٍ».
 * ترتيب الفحص كما في الشاشة: بلا خطة → السناك ممتلئ → (تأكيد فطار ثانٍ) → الرئيسية ممتلئة.
 * الفطار الثاني مسموح بتأكيد صريح من العميل (يُحسب من الرئيسية)؛ أما الاختيار
 * التلقائي فيبقى على سقف BREAKFAST_MAX_PER_DAY.
 */
export function addMealVerdict(category: unknown, c: PickCounts, l: DailyLimits): { block: AddBlock; secondBreakfast: boolean } {
  if (l.noMealPlan) return { block: "noMealPlan", secondBreakfast: false };
  const snack = isSnackCategory(category);
  if (snack && c.snacks >= l.snacksPerDay) return { block: "snacksFull", secondBreakfast: false };
  const secondBreakfast = !snack && isBreakfastCategory(category) && c.breakfasts >= BREAKFAST_MAX_PER_DAY;
  if (!snack && c.meals >= l.mealsPerDay) return { block: "mealsFull", secondBreakfast };
  return { block: null, secondBreakfast };
}

/** مفتاح خانة الاشتراك «دورة:يوم». */
export function slotKey(week: number | string, day: string): string {
  return `${week}:${day}`;
}

/**
 * مجموعة خانات الاشتراك الفعلية «دورة:يوم» بين البداية والنهاية (من ≥ بكرة، تتخطّى
 * الجمعة، الدورة تتقدّم كل جمعة). null = لا اشتراك مؤرَّخ (بلا حدّ). نفس المشي
 * الزمني الذي تستخدمه الخطة الذكية والمراجعة (orderedSubscriptionSlots).
 */
export function subscriptionSlotKeys(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  startRotationWeek: number,
): Set<string> | null {
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  if (new Date(`${endDate}T00:00:00`).getTime() < new Date(`${startDate}T00:00:00`).getTime()) return null;
  const out = new Set<string>();
  for (const s of orderedSubscriptionSlots(startDate, endDate, startRotationWeek)) out.add(slotKey(s.week, s.day));
  return out;
}
