/**
 * @file convex/mealNameFix.ts
 * @description تصحيح أسماء الوجبات العامة (عربي/إنجليزي) — معاينة ثم تطبيق.
 *
 *   ═══ الخلفية ═══
 *   أسماء publicMeals اتولدت من أسماء ملفات الصور وقت الاستيراد، فورثت
 *   أخطاءها حرفياً: «دجاج هارب» (Harps تحريف Herbs)، «سلطة فاكهة العاطفة»
 *   (ترجمة حرفية لـPassion Fruit)، «جاج الترياكي» (دال ساقطة)… وبعضها
 *   خطأ في القاعدة وحدها بينما الملف صحيح («غيندالو» مقابل ملف «فيندالو»).
 *
 *   ملفات المصدر اتصلّحت في OneDrive؛ وده بيصلّح القاعدة اللي بيقرا منها
 *   الموقع فعلاً (الموقع لا يقرأ أسماء الملفات).
 *
 *   ═══ الأمان ═══
 *   - المطابقة بالاسم العربي الحالي بالضبط — لا تخمين.
 *   - preview لا يكتب شيئاً؛ apply يفحص كل صف مرة أخرى قبل الكتابة.
 *   - لا يمسّ الصور ولا الجدولة ولا الأسعار ولا أي مرجع — الاسم فقط.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

type Fix = { ar: string; en?: string; newAr: string; newEn?: string; why: string };

/** المطابقة بالاسم العربي الحالي؛ en اختياري لتمييز الصفوف المتشابهة. */
const FIXES: Fix[] = [
  { ar: "دجاج هارب", newAr: "دجاج بالأعشاب", newEn: "Chicken Herbs",
    why: "«هارب» = يهرب. Harps تحريف Herbs." },
  { ar: "جاج الترياكي", newAr: "دجاج الترياكي", newEn: "Teriyaki Chicken",
    why: "حرف الدال ساقط + Teryaki إملاء خاطئ." },
  { ar: "سلطة فاكهة العاطفة", newAr: "سلطة الباشن فروت",
    why: "ترجمة حرفية لـPassion Fruit." },
  { ar: "ساندويتش البيضلبينا  والسلطعون", newAr: "ساندويتش البيض واللبنة والسلطعون",
    newEn: "Crab Egg Labneh Sandwich", why: "كلمات ملزوقة + مسافة مزدوجة." },
  { ar: "سلمون بدونكربوهيدرات", newAr: "سلمون بدون كربوهيدرات", newEn: "No Carb Salmon",
    why: "مسافة ناقصة." },
  { ar: "لحم البقر المقطع إلى خيوط", newAr: "لحم بقري مقطّع شرائح",
    why: "ترجمة آلية حرفية لـBeef Thread." },
  { ar: "ديناميت شرمب", newAr: "ديناميت روبيان",
    why: "«شرمب» منقحر — المنيو يستخدم «روبيان»." },
  { ar: "فطيرة عادية", newAr: "فطائر البان كيك",
    why: "«فطيرة عادية» = pie. الصواب بان كيك." },
  { ar: "برياني الدجاج", newAr: "برياني الروبيان", newEn: "Shrimp Biryani",
    why: "الطبق روبيان فعلاً — الصورة الأصلية في المصدر روبيان." },
  { ar: "راب تركي بالجبن", newAr: "راب الديك الرومي بالجبن",
    why: "«تركي» = من تركيا؛ المقصود الطائر. ملف المصدر صحيح أصلاً." },
  { ar: "غيندالو لحم بقري مع الأرز", newAr: "فيندالو لحم بقري مع الأرز",
    why: "«غيندالو» خطأ؛ ملف المصدر مكتوب «فيندالو» صحيحاً." },
  { ar: "شكشوكة بيض جديدة", newAr: "شكشوكة البيض",
    why: "«جديدة» بادئة استيراد تسرّبت لاسم يراه المشترك." },
];

async function plan(ctx: any) {
  const meals = await ctx.db.query("publicMeals").collect();
  const rows: any[] = [];
  for (const f of FIXES) {
    const hits = meals.filter(
      (m: any) => m.nameAr === f.ar && (!f.en || m.nameEn === f.en),
    );
    rows.push({
      from: f.ar, to: f.newAr, why: f.why,
      fromEn: hits[0]?.nameEn ?? null, toEn: f.newEn ?? null,
      matches: hits.length,
      ids: hits.map((m: any) => String(m._id)),
      status: hits.length === 0 ? "لا مطابق" : hits.length > 1 ? "أكثر من مطابق" : "جاهز",
    });
  }
  return rows;
}

/** 🔍 معاينة — لا تكتب شيئاً. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await plan(ctx);
    return {
      summary: {
        total: rows.length,
        ready: rows.filter((r) => r.status === "جاهز").length,
        noMatch: rows.filter((r) => r.status === "لا مطابق").length,
        multi: rows.filter((r) => r.status === "أكثر من مطابق").length,
      },
      rows,
    };
  },
});

/** ✅ تطبيق — ADMIN فقط. يحدّث الاسم فقط، ويتخطّى أي صف غير حاسم. */
export const apply = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await plan(ctx);
    let updated = 0;
    const skipped: string[] = [];
    for (const r of rows) {
      // 🔒 نتخطّى غير الحاسم: صفر مطابق أو أكثر من واحد ⇒ لا نخمّن
      if (r.status !== "جاهز") { skipped.push(`${r.from} (${r.status})`); continue; }
      const id = r.ids[0];
      const cur: any = await ctx.db.get(id as any);
      if (!cur || cur.nameAr !== r.from) { skipped.push(`${r.from} (تغيّر قبل الكتابة)`); continue; }
      const patch: any = { nameAr: r.to };
      if (r.toEn) patch.nameEn = r.toEn;
      await ctx.db.patch(id as any, patch);
      updated++;
    }
    return { updated, skipped };
  },
});
