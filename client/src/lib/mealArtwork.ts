import artwork from '@shared/menuArtwork.json';

/** Presentation only: never alter meal IDs, nutrition, scheduling or stored orders. */
export function mealArtworkUrl(meal: { _id?: unknown; id?: unknown; publicMealId?: unknown; mealId?: unknown } | null | undefined): string | undefined {
  if (!meal) return undefined;
  const images = artwork as Record<string, string>;
  // bestSellers يعيد `id` لا `_id`
  return images[String(meal.publicMealId || meal.mealId || meal._id || meal.id || '')];
}

/**
 * **صورة لوحة التحكم المرفوعة أولاً** فيظهر ما يرفعه الطاقم فوراً، والصورة المدموجة احتياط لمن لا صورة له.
 * (منذ 2026-09-17 رُفعت صور التصميم الجديد إلى الخادم لكل البطاقات، فلم يعد الملف المدموج هو المصدر.)
 */
export function withMealArtwork<T extends { _id?: unknown; publicMealId?: unknown; imageUrl?: unknown }>(meal: T) {
  const uploaded = typeof meal.imageUrl === "string" && meal.imageUrl ? meal.imageUrl : undefined;
  // مصدر واحد: Convex. لا بديل من ملفات الكود حتى لا يختلف الموقع عن التطبيق.
  const imageUrl = uploaded;
  return { ...meal, imageUrl, canonicalImageUrl: imageUrl };
}
