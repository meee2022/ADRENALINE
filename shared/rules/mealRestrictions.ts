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

/**
 * أي كلمة منع طابقت الوجبة — لنُسمّيها للمشترك في الرسالة بدل تحذير مبهم.
 * تُرجع الكلمة كما كتبتها الأخصائية (TURKEY / AVOCADO) أو null.
 */
export function matchedRestriction(meal: any, words: string[]): string | null {
  if (!words.length || !meal) return null;
  const hay = [
    meal.nameAr, meal.nameEn, meal.name,
    ...(Array.isArray(meal.ingredients) ? meal.ingredients : []),
    ...(Array.isArray(meal.tags) ? meal.tags : []),
  ].filter(Boolean).join(" ").toLowerCase();
  return words.find((w) => hay.includes(w)) || null;
}

/**
 * كلمات التجنّب الخام (بلا إسقاط كلمات الوصل) — احتياط لفحص الوصف الذي لا يفحصه
 * restrictionWords/matchedRestriction. نُقلت من شاشة المنيو كما هي.
 */
export function avoidTokens(allergies?: string | null, avoid?: string | null): string[] {
  const text = [allergies, avoid].filter(Boolean).join(" ").toLowerCase();
  return text.split(/[,،|/·•·\s]+/).map((t) => t.trim()).filter((t) => t.length >= 3);
}

/**
 * الكلمة المخالفة للوجبة: أولاً بالمصدر الموحّد (الاسم + المكوّنات + الوسوم) عبر
 * matchedRestriction، ثم الوصف بالكلمات الخام حتى لا يفلت شيء. null = لا مخالفة.
 */
export function restrictionHit(meal: any, words: string[], tokens: string[]): string | null {
  const byLib = matchedRestriction(meal, words);
  if (byLib) return byLib;
  if (!tokens.length || !meal) return null;
  const hay = [meal.descriptionAr, meal.descriptionEn].filter(Boolean).join(" ").toLowerCase();
  return tokens.find((t) => hay.includes(t)) || null;
}
