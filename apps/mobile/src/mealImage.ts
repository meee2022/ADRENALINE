/**
 * صورة الوجبة (عرض فقط): صورة الخادم أولاً فيظهر ما يرفعه الطاقم من لوحة التحكم فوراً بلا بناء جديد،
 * والصورة المدموجة احتياط عند غياب صورة الخادم أو تعذّر تحميلها. لا يمسّ معرّفات الوجبات ولا بياناتها.
 */
import { menuArtwork } from '@/menuArtwork';

export type MealImage = number | { uri: string };

export function mealImageSources(id: unknown, imageUrl?: unknown): MealImage[] {
  const bundled = menuArtwork[String(id || '')];
  const live = typeof imageUrl === 'string' && /^https:\/\//.test(imageUrl) ? { uri: imageUrl } : null;
  return [live, bundled].filter(Boolean) as MealImage[];
}
