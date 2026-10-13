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

/**
 * Per-macro portion factors. One factor for everything was wrong: a FITNESS plate carries
 * 1.5x the rice but only ~1.24x the protein of a DIET plate, and BULK 1.7x / ~1.72x.
 * Ratios come from the cooked portion weights in programPortions (rice 100/150/170 g,
 * protein 85/105/155 g); protein is a little under the meat ratio because rice and sauce
 * contribute a fixed share. `cal` is only for dishes that have calories but no macros.
 */
export interface MacroFactors { protein: number; carbs: number; fats: number; cal: number; }
const DEFAULT_MACRO_FACTORS: Record<string, { protein: number; carbs: number; fats: number }> = {
  FITNESS: { protein: 1.24, carbs: 1.5, fats: 1.25 },
  BULK: { protein: 1.72, carbs: 1.7, fats: 1.4 },
};
export function programMacroFactors(program: unknown, portions?: ProgramPortions | null): MacroFactors {
  const prog = String(program || "").toUpperCase();
  const key = prog.includes("FITNESS") ? "FITNESS" : prog.includes("BULK") ? "BULK" : "";
  const d = DEFAULT_MACRO_FACTORS[key] || { protein: 1, carbs: 1, fats: 1 };
  const o: any = key ? (portions as any)?.[key] : null; // optional overrides from restaurant settings
  return {
    protein: Number(o?.proteinFactor) || d.protein,
    carbs: Number(o?.carbFactor) || d.carbs,
    fats: Number(o?.fatFactor) || d.fats,
    cal: programCalFactor(program, portions),
  };
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
export function scaledNutrition(meal: any, factor: number | MacroFactors): Nutrition {
  const scaled = isScaledCategory(meal?.category);
  const mf: MacroFactors = typeof factor === "number"
    ? { protein: factor, carbs: factor, fats: factor, cal: factor } : factor;
  const macro = (v: unknown, f: number) => (v == null || v === "" ? 0 : Math.round(Number(v) * (scaled ? f : 1)));
  const protein = Number(macro(meal?.protein, mf.protein)) || 0;
  const carbs = Number(macro(meal?.carbs, mf.carbs)) || 0;
  const fats = Number(macro(meal?.fats, mf.fats)) || 0;
  const rawCal = meal?.calories;
  const catCal = rawCal == null || rawCal === "" ? rawCal : Math.round(Number(rawCal) * (scaled ? mf.cal : 1));
  const calories = scaled && (protein || carbs || fats) ? protein * 4 + carbs * 4 + fats * 9 : catCal;
  return { calories, protein, carbs, fats };
}
