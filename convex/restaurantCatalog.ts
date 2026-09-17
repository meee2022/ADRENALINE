/**
 * منيو المطعم — قراءة حية (عرض فقط).
 * كان لقطة مجمّدة داخل الكود (JSON + صور مدموجة) فلا تظهر صورة أو سعرات جديدة إلا ببناء جديد للتطبيق.
 * الآن الاسم والصورة والمكونات والسعرات تُقرأ من publicMeals مباشرة: ما يُعدَّل في لوحة التحكم يظهر فوراً.
 * لا يكتب شيئاً ولا يمسّ الأسعار أو الاشتراكات. قواعد الاختيار والتجميع في shared/restaurantCatalogBuild.mjs.
 */
import { query } from "./_generated/server";
import { buildCatalog } from "../shared/restaurantCatalogBuild.mjs";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("publicMeals").collect();
    const urls = new Map<string, string>();
    await Promise.all(
      rows.filter((r) => r.isActive && r.storageId).map(async (r) => {
        const url = await ctx.storage.getUrl(r.storageId!);
        if (url) urls.set(String(r._id), url);
      })
    );
    const imageOf = (r: any) => urls.get(String(r._id)) || (/^https:\/\//.test(r.imageUrl || "") ? r.imageUrl : null);
    return buildCatalog(rows as any[], {
      // صورة البطاقة الممثِّلة أولاً ثم أي بطاقة لنفس الطبق في قناة أخرى.
      imageFor: (group: any[], r: any) => [r, ...group].map(imageOf).find(Boolean) ?? null,
      ingredientsFor: (group: any[], r: any) => [r, ...group].map((x) => x.ingredients).find((l) => Array.isArray(l) && l.length) ?? [],
    }) as {
      id: string; sourceIds: string[]; ingredients: string[]; ar: string; en: string; category: string;
      channels: string[]; image: string | null; calories: number | null; protein: number | null; carbs: number | null; fats: number | null;
    }[];
  },
});
