import artwork from '@shared/menuArtwork.json';

/** Presentation only: never alter meal IDs, nutrition, scheduling or stored orders. */
export function mealArtworkUrl(meal: { _id?: unknown; publicMealId?: unknown; mealId?: unknown } | null | undefined): string | undefined {
  if (!meal) return undefined;
  const images = artwork as Record<string, string>;
  return images[String(meal.publicMealId || meal.mealId || meal._id || '')];
}

/**
 * الصورة الجديدة لو كانت في القائمة، وإلا **صورة الأدمن المرفوعة** كما هي.
 * بلا هذا البديل كانت أي وجبة جديدة يضيفها الطاقم تظهر «الصورة الجديدة قريبًا» حتى إعادة النشر.
 */
export function withMealArtwork<T extends { _id?: unknown; publicMealId?: unknown; imageUrl?: unknown }>(meal: T) {
  const uploaded = typeof meal.imageUrl === "string" && meal.imageUrl ? meal.imageUrl : undefined;
  const imageUrl = mealArtworkUrl(meal) || uploaded;
  return { ...meal, imageUrl, canonicalImageUrl: imageUrl };
}
