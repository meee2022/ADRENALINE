/**
 * @file convex/lib/calories.ts
 * @description تقدير تقريبي للسعرات من نص الوجبة المخصّصة (بالجرامات).
 *   يحلّل مقاطع مثل "150 G BEEF KOFTA + 200 G RICE" ويجمع سعرات كل مقطع
 *   حسب جدول سعرات المكوّنات (لكل 100جم، قيم مطبوخة تقريبية).
 */

// سعرات تقريبية لكل 100جم (مطبوخ). المفتاح كلمة تُبحث في نص المقطع.
const KCAL_PER_100: Array<{ kw: RegExp; kcal: number }> = [
  // بروتينات
  { kw: /crispy|cutlet|strips|fried|panne|بانيه|مقلي/i, kcal: 250 },
  { kw: /kofta|kebab|كفتة|كباب/i, kcal: 250 },
  { kw: /steak|ستيك/i, kcal: 250 },
  { kw: /minced|mince|مفروم/i, kcal: 240 },
  { kw: /beef|lamb|meat|لحم|بقري/i, kcal: 240 },
  { kw: /salmon|سلمون/i, kcal: 200 },
  { kw: /shishtawook|shish\s*tawook|tawook|شيش|طاووق/i, kcal: 170 },
  { kw: /grilled\s*chicken|chicken\s*breast|فراخ|صدر|دجاج مشوي/i, kcal: 165 },
  { kw: /chicken|shishtawook|fajita|فاهيتا|دجاج/i, kcal: 165 },
  { kw: /turkey|ديك\s*رومي|تركي/i, kcal: 135 },
  { kw: /tuna|تونة/i, kcal: 130 },
  { kw: /shrimp|dynamite|جمبري/i, kcal: 110 },
  { kw: /white\s*fish|fish|سمك/i, kcal: 100 },
  { kw: /egg\s*whites?|بياض/i, kcal: 52 },
  { kw: /egg|بيض/i, kcal: 155 },
  // كارب / جوانب
  { kw: /fries|بطاطس\s*مقلية/i, kcal: 300 },
  { kw: /bread|toast|خبز|توست/i, kcal: 265 },
  { kw: /oats|شوفان/i, kcal: 350 },
  { kw: /pasta|macaroni|noodles|spaghetti|مكرونة|باستا/i, kcal: 160 },
  { kw: /rice|رز|أرز/i, kcal: 130 },
  { kw: /quinoa|كينوا/i, kcal: 120 },
  { kw: /sweet\s*potato|بطاطا\s*حلوة/i, kcal: 90 },
  { kw: /mashed|potato|بطاطس|بطاطا/i, kcal: 90 },
  { kw: /bulgur|برغل/i, kcal: 85 },
  { kw: /avocado|أفوكادو/i, kcal: 160 },
  { kw: /nuts|peanut|almond|مكسرات|فول\s*سوداني|لوز/i, kcal: 600 },
  { kw: /berries|blueberr|توت/i, kcal: 55 },
  { kw: /dates?|تمر/i, kcal: 280 },
  { kw: /salad|vegetable|سلطة|خضار/i, kcal: 25 },
];

function segKcalPer100(seg: string): number {
  for (const f of KCAL_PER_100) if (f.kw.test(seg)) return f.kcal;
  return 150; // افتراضي معتدل لو فيه جرامات بلا مكوّن معروف
}

/**
 * يقدّر إجمالي سعرات نص وجبة. يعتمد على مقاطع "<grams> G <food>".
 * أمثلة: "150 G BEEF KOFTA+200 G RICE" → ~635. "250 G GRILLED CHICKEN +SALAD" → ~415.
 */
export function estimateCalories(text: string): number {
  if (!text) return 0;
  const segments = String(text).split(/[+/,]|\band\b|\&/i);
  let total = 0;
  for (const seg of segments) {
    const m = seg.match(/(\d+(?:\.\d+)?)\s*(?:G\b|GM\b|جم|جرام)/i);
    if (m) {
      const grams = Number(m[1]) || 0;
      total += (grams / 100) * segKcalPer100(seg);
      continue;
    }
    // "6 EGG WHITES" / "2 WHOLE EGGS" — بالعدد
    const em = seg.match(/(\d+)\s*(?:whole\s*)?eggs?\s*whites?/i);
    if (em) { total += Number(em[1]) * 17; continue; }
    const ew = seg.match(/(\d+)\s*(?:whole\s*)?eggs?/i);
    if (ew) { total += Number(ew[1]) * 78; continue; }
  }
  return Math.round(total);
}

/** سعرات من الحقول المركّبة (بروتين+كارب بجرامات) — لخانة MAIN المهيكلة. */
export function estimateFromParts(proteinName?: string, proteinG?: number | null, carbName?: string, carbG?: number | null): number {
  let total = 0;
  if (proteinG) total += (Number(proteinG) / 100) * segKcalPer100(String(proteinName || ""));
  if (carbG && String(carbName || "").trim() && !/^none|بدون/i.test(String(carbName))) total += (Number(carbG) / 100) * segKcalPer100(String(carbName));
  return Math.round(total);
}
