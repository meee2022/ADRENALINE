/**
 * @file client/src/lib/mealRestrictions.ts
 * @description المصدر الوحيد (جهة العميل) لفحص ممنوعات/حساسية المشترك في الوجبة.
 *
 *   ═══ لماذا مصدر واحد؟ ═══
 *   المنيو العام (PublicMenu) والملء التلقائي في الخطط اليومية (Plans) كلاهما
 *   يحتاج نفس الحكم: هل هذه الوجبة تخالف ممنوعات المشترك؟ لو حسبها كلٌّ بنفسه
 *   لاختلفا. يعكس هذا منطق الخادم `convex/ai.ts` → `isBlocked` (يفحص الاسم +
 *   المكوّنات + الوسوم) فلا يفترق اليدوي عن الذكي.
 *
 *   ⚠️ لا نلمس منطق الحجب في الخادم — هذا مرآته على العميل. النص المصدر «NO
 *      SEAFOOD / NO EGG» فنُسقِط كلمات النفي/الوصل ونُبقي المحظور الفعلي فقط.
 */

/** كلمات وصل/نفي لا تُعتبر مادةً محظورة بذاتها. */
const STOPWORDS = new Set([
  "no", "not", "without", "reduce", "less", "only", "add", "my", "choice",
  "always", "put", "separate", "off", "and", "or", "the", "in", "with",
  "high", "low", "extra", "please", "calories", "carb", "carbs",
  "breakfast", "lunch", "dinner", "snack", "meal", "meals",
]);

/**
 * يستخرج كلمات المنع من نصّي الممنوعات + الحساسية.
 * يقسّم على الفواصل و«/» والنقاط والمسافات، ويُسقِط كلمات الوصل والقصيرة (<3).
 */
export function restrictionWords(
  avoid?: string | null,
  allergies?: string | null,
): string[] {
  const raw = `${allergies || ""} ${avoid || ""}`.toLowerCase();
  const words = raw
    .split(/[,،/.\s]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

/**
 * هل الوجبة تخالف الممنوعات؟ نفس منطق الخادم `ai.isBlocked`:
 * تُطابَق كلمات المنع بنص (الاسم عربي/إنجليزي + المكوّنات + الوسوم).
 * `words` من `restrictionWords`. بلا كلمات → لا حجب.
 */
export function mealIsRestricted(meal: any, words: string[]): boolean {
  if (!words.length || !meal) return false;
  const hay = [
    meal.nameAr, meal.nameEn, meal.name,
    ...(Array.isArray(meal.ingredients) ? meal.ingredients : []),
    ...(Array.isArray(meal.tags) ? meal.tags : []),
  ].filter(Boolean).join(" ").toLowerCase();
  return words.some((w) => hay.includes(w));
}
