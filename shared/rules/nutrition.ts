/**
 * تغذية الوجبة بحسب برنامج المشترك — المعامل يسري على الغداء/العشاء فقط (الرز والبروتين
 * هما ما يتغيّر حجمهما بالبرنامج)؛ الفطار/السناك/السلطة حصتها ثابتة لكل الأهداف.
 * TypeScript صافٍ — نُقل من شاشة المنيو كما هو. الاستيكرات في الخادم تطبّق المعامل نفسه.
 */
export interface ProgramPortions { DIET?: { calFactor?: number }; FITNESS?: { calFactor?: number }; BULK?: { calFactor?: number }; }

/** قيم كشف المطبخ الافتراضية — تعمل حتى قبل أول حفظ من إعدادات المطعم. */
export const DEFAULT_PROGRAM_PORTIONS: ProgramPortions = {
  DIET: { calFactor: 1 },
  FITNESS: { calFactor: 1.08 },
  BULK: { calFactor: 1.15 },
};

/** معامل السعرات لبرنامج العميل (DIET/FITNESS/BULK داخل أي من الحقول القديمة). بلا برنامج = 1. */
export function programCalFactor(program: unknown, portions?: ProgramPortions | null): number {
  const prog = String(program || "").toUpperCase();
  const pp = portions || DEFAULT_PROGRAM_PORTIONS;
  if (!prog) return 1;
  if (prog.includes("DIET")) return Number(pp.DIET?.calFactor) || 1;
  if (prog.includes("FITNESS")) return Number(pp.FITNESS?.calFactor) || 1;
  if (prog.includes("BULK")) return Number(pp.BULK?.calFactor) || 1;
  return 1;
}

/** برنامج العميل من ملفه — قد يكون في program أو goalType أو goals (بيانات قديمة). */
export function customerProgram(customer: any): string {
  return String(customer?.program || customer?.goalType || customer?.goals || "");
}

const SCALED_CATS = new Set(["lunch", "dinner"]);
export function isScaledCategory(category: unknown): boolean {
  return SCALED_CATS.has(String(category || "").toLowerCase());
}

export interface Nutrition { calories: number; protein: number; carbs: number; fats: number; }

/**
 * القيم الفعلية التي يراها المشترك (وتُحفظ في سلته): الماكروز مضروبة بالمعامل للأطباق
 * المُقاسة، والسعرات تُعاد من الماكروز (4/4/9) لتبقى متّسقة رياضياً؛ وإلا سعرات الكتالوج.
 */
export function scaledNutrition(meal: any, calFactor: number): Nutrition {
  const scaled = isScaledCategory(meal?.category);
  const f = scaled ? calFactor : 1;
  const macro = (v: unknown) => (v == null || v === "" ? 0 : Math.round(Number(v) * f));
  const protein = Number(macro(meal?.protein)) || 0;
  const carbs = Number(macro(meal?.carbs)) || 0;
  const fats = Number(macro(meal?.fats)) || 0;
  const rawCal = meal?.calories;
  const catCal = rawCal == null || rawCal === "" ? rawCal : Math.round(Number(rawCal) * f);
  const calories = scaled && (protein || carbs || fats) ? protein * 4 + carbs * 4 + fats * 9 : catCal;
  return { calories, protein, carbs, fats };
}
