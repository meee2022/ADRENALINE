/**
 * هوية الوجبة — قناة الوجبة، ومفتاح اسمها، وخطة دمج بطاقتين لنفس الطبق.
 *
 * المشكلة التي يعالجها: الطبق الواحد كان يُسجَّل بطاقةً جديدة كل مرة يُدخَل فيها المنيو
 * (فبراير ثم يوليو…)، فتصير له بطاقتان بجدولتين وسعراتٍ وصورتين، وتتفرّق طلباته
 * ووصفته وأسعار منافذه بينهما. الحل: بطاقة واحدة لكل طبق في كل قناة، ودمجٌ يحفظ
 * التاريخ (البطاقة القديمة تُقفل ولا تُحذف، والطلبات القديمة تبقى بمعرّفها).
 *
 * دوال نقية بلا قاعدة بيانات حتى تُختبر (tests/meal-identity.test.ts).
 */

import { ConvexError } from "convex/values";

export type MealChannel = "subscription" | "online" | "outlet";

export type MealLike = {
  _id?: string;
  nameAr?: string;
  nameEn?: string;
  isOnlineOnly?: boolean;
  isGymOnly?: boolean;
  isActive?: boolean;
  schedule?: { week: number; day: string }[];
  weeks?: number[];
  days?: string[];
};

/** القناة التي تظهر فيها البطاقة: أونلاين، منافذ، أو منيو المشتركين. */
export function mealChannel(m: MealLike): MealChannel {
  if (m.isOnlineOnly) return "online";
  if (m.isGymOnly) return "outlet";
  return "subscription";
}

/** مفتاح مقارنة الأسماء: حروف وأرقام فقط، بلا حالة ولا مسافات، و«w/» = with. */
export function normMealName(s?: string | null): string {
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/w\//g, "with")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9؀-ۿ]/g, "");
}

/** هل البطاقتان تحملان نفس الاسم (بالإنجليزية أو العربية) في نفس القناة؟ */
export function sameNameSameChannel(a: MealLike, b: MealLike): boolean {
  if (mealChannel(a) !== mealChannel(b)) return false;
  const en = normMealName(a.nameEn) && normMealName(a.nameEn) === normMealName(b.nameEn);
  const ar = normMealName(a.nameAr) && normMealName(a.nameAr) === normMealName(b.nameAr);
  return Boolean(en || ar);
}

/** اتحاد جدولتين بلا تكرار، مرتّب بالأسبوع ثم اليوم. */
export function mergeSchedules(
  a: { week: number; day: string }[] | undefined,
  b: { week: number; day: string }[] | undefined,
): { week: number; day: string }[] {
  const seen = new Map<string, { week: number; day: string }>();
  for (const s of [...(a || []), ...(b || [])]) {
    if (!s || !Number.isFinite(s.week) || !s.day) continue;
    seen.set(`${s.week}|${String(s.day).toLowerCase()}`, { week: Number(s.week), day: String(s.day).toLowerCase() });
  }
  return [...seen.values()].sort((x, y) => x.week - y.week || x.day.localeCompare(y.day));
}

/**
 * ما الذي يتغيّر على البطاقة الباقية عند الدمج: الجدولة اتحاد الاثنتين،
 * والحقول الفارغة تُكمَّل من البطاقة المقفلة (صورة، وصف…)، أما الاسم والسعر
 * والسعرات فتبقى للبطاقة الباقية (الأحدث/الأكثر استخداماً بقرار بشري).
 */
export function mergePlan(keep: Record<string, any>, retire: Record<string, any>) {
  const patch: Record<string, any> = {};
  const schedule = mergeSchedules(keep.schedule, retire.schedule);
  if (JSON.stringify(schedule) !== JSON.stringify(keep.schedule || [])) patch.schedule = schedule;
  const weeks = [...new Set([...(keep.weeks || []), ...(retire.weeks || [])])].sort((a, b) => a - b);
  if (weeks.length && JSON.stringify(weeks) !== JSON.stringify(keep.weeks || [])) patch.weeks = weeks;
  const days = [...new Set([...(keep.days || []), ...(retire.days || [])])];
  if (days.length && JSON.stringify(days) !== JSON.stringify(keep.days || [])) patch.days = days;
  for (const f of ["storageId", "imageUrl", "descriptionAr", "descriptionEn", "aboutAr", "aboutEn", "costQAR", "gymPrice"]) {
    // الصورة تُقرأ من storageId أولاً؛ رابط imageUrl القديم لا يُنسخ إن كانت للباقية صورة مخزّنة
    if (f === "imageUrl" && keep.storageId) continue;
    if ((keep[f] === undefined || keep[f] === null || keep[f] === "") && retire[f] !== undefined && retire[f] !== null && retire[f] !== "") patch[f] = retire[f];
  }
  return patch;
}

/**
 * حارس التكرار — بطاقة واحدة لكل طبق في كل قناة. الطبق الذي أُدخل مرتين (فبراير/يوليو) تفرّقت
 * جدولته ووصفته وطلباته بين بطاقتين — فنرفض إنشاء أو تسمية بطاقة نشطة باسم
 * (إنجليزي أو عربي) تحمله بطاقة نشطة أخرى في نفس القناة، ونذكر أيّها.
 */
export async function assertUniqueMealName(ctx: any, meal: { nameAr?: string; nameEn?: string; isOnlineOnly?: boolean; isGymOnly?: boolean; isActive?: boolean }, excludeId?: any) {
  if (meal.isActive === false) return;
  const en = normMealName(meal.nameEn), ar = normMealName(meal.nameAr);
  if (!en && !ar) return;
  const channel = mealChannel(meal);
  const active: any[] = await ctx.db.query("publicMeals").withIndex("by_active", (q: any) => q.eq("isActive", true)).collect();
  const clash = active.find((m) =>
    (!excludeId || String(m._id) !== String(excludeId)) &&
    mealChannel(m) === channel &&
    ((en && normMealName(m.nameEn) === en) || (ar && normMealName(m.nameAr) === ar)),
  );
  if (clash) {
    const ch = channel === "online" ? "الأونلاين" : channel === "outlet" ? "المنافذ" : "المشتركين";
    throw new ConvexError(`الطبق «${clash.nameAr || clash.nameEn}» موجود بالفعل في قائمة ${ch} ببطاقة أخرى. عدّل البطاقة الموجودة بدل إنشاء نسخة ثانية، أو غيّر الاسم لو كان طبقاً مختلفاً فعلاً.`);
  }
}
