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

/**
 * إملاء إنجليزي — المطابقة بالاسم الإنجليزي الحالي بالضبط.
 * ⚠️ إملاء فقط: لا نغيّر اسم طبق لآخر. «Chicken Madrooba» مثلاً تُترك —
 *    مضروبة طبق قائم بذاته لا تحريف لغيره.
 */
const EN_FIXES: { en: string; newEn: string }[] = [
  { en: "Chicken Harps", newEn: "Chicken Herbs" },
  { en: "Teryaki Chicken", newEn: "Teriyaki Chicken" },
  { en: "Chicken Teryaki", newEn: "Chicken Teriyaki" },
  { en: "Slamon with Salsa", newEn: "Salmon with Salsa" },
  { en: "Spaghette  Meat Ball", newEn: "Spaghetti Meat Balls" },
  { en: "Spaghette Bolognese", newEn: "Spaghetti Bolognese" },
  { en: "Creamu Zucchini Pasta", newEn: "Creamy Zucchini Pasta" },
  { en: "Falafal Wrap", newEn: "Falafel Wrap" },
  { en: "Chicken Ceasar Salad", newEn: "Chicken Caesar Salad" },
  { en: "Beef Stragnoff", newEn: "Beef Stroganoff" },
  { en: "Mongolia Beef Noodles", newEn: "Mongolian Beef Noodles" },
  { en: "MANGOLIAN NOODLES", newEn: "MONGOLIAN NOODLES" },
  { en: "BEEF VINDALO & RICE", newEn: "BEEF VINDALOO & RICE" },
  { en: "Cordon Blue", newEn: "Cordon Bleu" },
  { en: "Classic Fattouch", newEn: "Classic Fattoush" },
  { en: "Shishatwook with Rice", newEn: "Shish Tawook with Rice" },
  { en: "Shishatawook with Rice", newEn: "Shish Tawook with Rice" },
  { en: "CROISANT EGG RING", newEn: "CROISSANT EGG RING" },
  { en: "Crispy Chicken  Cutlets", newEn: "Crispy Chicken Cutlets" },
];

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
  // ⛔ مرفوض من صاحب المطعم: «راب تركي بالجبن» يفضل كما هو — الاسم المعروف
  //    للعميل، ولو تقنياً «تركي» = من تركيا. القرار قراره لا قرارنا.
  //    (كان: راب تركي بالجبن → راب الديك الرومي بالجبن)
  { ar: "راب الديك الرومي بالجبن", newAr: "راب تركي بالجبن",
    why: "تراجع — الاسم القديم هو المعتمد." },
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

/** خطة إصلاح الإملاء الإنجليزي — منفصلة عن العربي. */
async function planEn(ctx: any) {
  const meals = await ctx.db.query("publicMeals").collect();
  return EN_FIXES.map((f) => {
    const hits = meals.filter((m: any) => m.nameEn === f.en);
    return {
      from: f.en, to: f.newEn,
      ar: hits[0]?.nameAr ?? null,
      ids: hits.map((m: any) => String(m._id)),
      status: hits.length === 0 ? "لا مطابق" : hits.length > 1 ? "أكثر من مطابق" : "جاهز",
    };
  });
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
      en: await planEn(ctx),
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
    // ── الإملاء الإنجليزي ──
    let updatedEn = 0;
    for (const r of await planEn(ctx)) {
      if (r.status !== "جاهز") { skipped.push(`EN: ${r.from} (${r.status})`); continue; }
      const cur: any = await ctx.db.get(r.ids[0] as any);
      if (!cur || cur.nameEn !== r.from) { skipped.push(`EN: ${r.from} (تغيّر قبل الكتابة)`); continue; }
      await ctx.db.patch(r.ids[0] as any, { nameEn: r.to });
      updatedEn++;
    }
    return { updated, updatedEn, skipped };
  },
});
