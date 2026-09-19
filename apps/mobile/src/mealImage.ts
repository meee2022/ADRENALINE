/**
 * صورة الوجبة (عرض فقط) — **مصدر واحد: Convex**. ما يرفعه الطاقم من لوحة التحكم يظهر في
 * التطبيق والموقع سواءً بسواء، بلا صور مدموجة في الكود تختلف بينهما.
 */
export type MealImage = { uri: string };

export function mealImageSources(_id: unknown, imageUrl?: unknown): MealImage[] {
  return typeof imageUrl === 'string' && /^https:\/\//.test(imageUrl) ? [{ uri: imageUrl }] : [];
}
