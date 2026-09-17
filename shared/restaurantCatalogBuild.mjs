// منيو المطعم (عرض فقط): من صفوف publicMeals إلى بطاقات الكتالوج. مصدر واحد يستخدمه استعلام Convex الحي
// (convex/restaurantCatalog.ts) وسكربت اللقطة (scripts/export-app-catalog.mjs) فلا يختلفان.
// لا يغيّر معرّفات الوجبات ولا الأسعار ولا أي منطق اشتراكات.
import { groupCatalogRows, catalogNames } from './restaurantCatalogIdentity.mjs';

const excluded = new Set(['SAUCE', 'SPRINKLES', 'SALSA', 'CARBS', 'SIDES', 'PROTEIN']);

/** أصناف الجرام والصوصات والإضافات ليست أطباقاً تُعرض في المنيو. */
export function isCatalogDish(r) {
  return Boolean(r.isActive) && r.priceUnit !== 'gram' && !/\b\d+\s*g\b/i.test(r.nameEn || '')
    && !excluded.has(r.outletCategory) && !/sundried tomato|balsamic dressing/i.test(r.nameEn || '');
}

export function catalogCategory(r) {
  const n = (r.nameEn || r.nameAr || '').toLowerCase();
  if (/gathering box/.test(n)) return 'boxes';
  if (/juice|shot|drink|water|smoothie|^golden$|^detox$/.test(n)) return 'drinks';
  if (/salad|soup|fattoush|feta/.test(n)) return 'salads';
  if (/cake|brownie|basbousa|pudding|snicker|kunafa|pecan|talbina|umm|tarte|heaven|power ball|energy ball|dates ball|chips|cookies/.test(n) || r.category === 'snack' || r.outletCategory === 'SWEETS') return 'snacks';
  if (r.category === 'breakfast') return 'breakfast';
  if (/sandwich|wrap|burger|tacos|shawarma/.test(n) && !/rice/.test(n)) return 'sandwiches';
  if (/pasta|spaghetti|noodle|lasagna/.test(n)) return 'pasta';
  if (/salmon|shrimp|fish/.test(n)) return 'seafood';
  if (/beef|steak|kofta|tenderloin|dawoud/.test(n)) return 'beef';
  if (/chicken|cordon|tawook|crispy strips/.test(n)) return 'chicken';
  return 'other';
}

const channelOf = (x) => (x.isOnlineOnly ? 'online' : x.isGymOnly ? 'outlet' : 'subscription');

/**
 * @param rows صفوف publicMeals
 * @param imageFor (group, representative) => string|null
 * @param ingredientsFor (group, representative) => string[]
 */
export function buildCatalog(rows, { imageFor, ingredientsFor }) {
  const meals = groupCatalogRows(rows.filter(isCatalogDish)).map((group) => {
    const r = group.find((x) => !x.isGymOnly && !x.isOnlineOnly) || group[0];
    // أرقام البطاقة الممثِّلة أولاً، وإن خلت فمن بطاقة نفس الطبق في قناة أخرى.
    const value = (k) => [r, ...group].map((x) => x[k]).find((v) => Number.isFinite(v) && v > 0) ?? null;
    return {
      id: r._id, sourceIds: group.map((x) => x._id), ingredients: ingredientsFor(group, r) || [], ...catalogNames(group),
      category: catalogCategory(r), channels: [...new Set(group.map(channelOf))], image: imageFor(group, r) || null,
      calories: value('calories'), protein: value('protein'), carbs: value('carbs'), fats: value('fats'),
    };
  });
  meals.sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)) || a.en.localeCompare(b.en));
  return meals;
}
