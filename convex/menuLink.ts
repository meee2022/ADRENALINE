/**
 * @file convex/menuLink.ts
 * @description ربط menuItems بالمنيو العام publicMeals — مرة واحدة وبالـID.
 *
 *   ═══ المشكلة ═══
 *   الخطة اليومية اليدوية تخزّن menuItemId (وعليه تتعلّق وصفات المخزون في
 *   mealIngredients، فلا يمكن تغييره). لكن الجدولة والاسم العربي والصورة كلها
 *   في publicMeals. فكانت صفحة الخطط تربط الجدولين **بمطابقة الاسم وقت العرض**.
 *
 *   وهذا يفشل بصمت: 15 وجبة مجدولة من 139 لا تظهر للأخصائية لأن الإملاء يختلف
 *   (BEEF SHAWERMA مقابل Beef Shawarma). لا رسالة خطأ — خانة فاضية فقط،
 *   فتظن الأخصائية أن لا وجبة مقرّرة اليوم. وأي تصحيح إملائي لاحق يكسر المزيد.
 *
 *   ═══ الحل ═══
 *   نحسم المطابقة هنا مرة واحدة ونخزّنها في menuItems.publicMealId.
 *   بعدها يقرأ العرض الرابط جاهزاً — فتصحيح الأسماء لا يكسر شيئاً.
 *
 *   ⚠️ لا نطابق إلا بيقين: تطابق تام بعد التطبيع، أو زوج تحريف مُثبَت في
 *      TYPOS أدناه. أي شكّ ⇒ نتركه ونُبلغ عنه، لا نخمّن.
 *      وجبة خاطئة تصل المشترك = مشكلة حقيقية في المطعم.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

/**
 * تحريفات مُثبَتة في menuItems القديم مقابل الإملاء الصحيح في المنيو العام.
 * كل زوج تحقّقنا منه بالعين: نفس الطبق، إملاء مختلف.
 *
 * ⚠️ الترتيب مقصود: نصحّح **قبل** ضغط المسافات. لو ضغطنا أولاً لالتحمت
 *    الكلمات وتصادمت القواعد ("Vegetable Soup" → vegetablesoup → /vegetables/
 *    تُطابِق داخلها → vegetableoup).
 */
const TYPOS: [RegExp, string][] = [
  [/\bshawerma\b/g, "shawarma"],
  [/\bzaater\b/g, "zaatar"],
  [/\bcroisant\b/g, "croissant"],
  [/\bsyadiah\b/g, "sayadieh"],
  [/\bwaldoraf\b/g, "waldorf"],
  [/\brizotto\b/g, "risotto"],
  [/\bmangolian\b/g, "mongolian"],
  [/\bpenne\b/g, "penni"],
  [/\bblue\b/g, "bleu"],
  [/\bpotatoes\b/g, "potato"],
  [/\bteryaki\b/g, "teriyaki"],
  [/\bslamon\b/g, "salmon"],
  [/\bspaghette\b/g, "spaghetti"],
  [/\bfalafal\b/g, "falafel"],
  [/\bceasar\b/g, "caesar"],
  [/\bvindalo\b/g, "vindaloo"],
  [/\bfattouch\b/g, "fattoush"],
  [/\bstragnoff\b/g, "stroganoff"],
  [/\bcreamu\b/g, "creamy"],
  [/\bharps\b/g, "herbs"],
  [/\bomelete\b/g, "omelette"],
  // ⚠️ الحدّ \b هنا ضرورة لا زينة: بدونه يلتهم /stroganof/ الاسمَ الصحيح
  //    "stroganoff" ويحوّله "stroganofff". مع الحدّ لا يُطابَق إلا القاصر.
  [/\bstroganof\b/g, "stroganoff"],
];

/**
 * توحيد الاسم للمطابقة: «W/ RICE» و«with Rice» و«& » كلها شكل واحد،
 * و«BALLS» = «Ball» (المطبخ يكتب الجمع والمنيو المفرد بلا نظام).
 */
function norm(s: any): string {
  let x = " " + String(s || "").toLowerCase() + " ";
  x = x.replace(/&/g, " and ").replace(/w\//g, " with ");
  x = x.replace(/[\/\-_,.()]/g, " ").replace(/\s+/g, " ");
  // التصحيح **قبل** الضغط: بعده تلتحم الكلمات فتتصادم القواعد
  for (const [re, to] of TYPOS) x = x.replace(re, to);
  x = x.replace(/\bwith\b/g, " ").replace(/\band\b/g, " ").replace(/\bthe\b/g, " ");
  // توحيد الجمع/المفرد — نطبّقه على الطرفين فالمقارنة تبقى عادلة
  x = x.split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");
  // الضغط في النهاية فقط — بعد أن أدّت حدود الكلمات دورها
  return x.replace(/[^a-z0-9]/g, "");
}

const isScheduled = (m: any) => Array.isArray(m.schedule) && m.schedule.length > 0;

async function plan(ctx: any) {
  const items = await ctx.db.query("menuItems").collect();
  const all = await ctx.db.query("publicMeals").collect();

  // 🔒 خطة الأخصائية للمشتركين فقط — وجبات الأونلاين والجم ليست في دورة
  //    الإكسل ولا تُقدَّم للمشترك، فربطها بها يضع صنفاً خاطئاً في خطته.
  const meals = (all as any[]).filter((m) => !m.isGymOnly && !m.isOnlineOnly);

  // فهرس المنيو العام بالاسم الموحّد
  const byNorm = new Map<string, any[]>();
  for (const m of meals) {
    for (const n of [m.nameEn, m.nameAr]) {
      const k = norm(n);
      if (!k) continue;
      if (!byNorm.has(k)) byNorm.set(k, []);
      if (!byNorm.get(k)!.some((x) => String(x._id) === String(m._id))) byNorm.get(k)!.push(m);
    }
  }

  const link: any[] = [], ambiguous: any[] = [], orphan: any[] = [];
  for (const it of items as any[]) {
    let hits = byNorm.get(norm(it.name)) || [];
    // 8 أسماء لها نسختان في منيو المشتركين، المجدولة منهما واحدة والأخرى
    // بقيّة قديمة. الخطة تعنيها المجدولة — قاعدة قاطعة لا تخمين.
    if (hits.length > 1) {
      const sched = hits.filter(isScheduled);
      if (sched.length === 1) hits = sched;
    }
    if (hits.length === 1) {
      const m = hits[0];
      link.push({
        id: String(it._id), menuName: it.name,
        mealId: String(m._id), mealEn: m.nameEn, mealAr: m.nameAr,
        already: String(it.publicMealId || "") === String(m._id),
        scheduled: isScheduled(m),
      });
    } else if (hits.length > 1) {
      // 🚩 اسمان في المنيو العام يطابقان صنفاً واحداً — لا نخمّن
      ambiguous.push({ menuName: it.name, candidates: hits.map((m: any) => m.nameEn || m.nameAr) });
    } else {
      orphan.push({ menuName: it.name, active: it.isActive });
    }
  }
  return { link, ambiguous, orphan, totalItems: items.length, totalMeals: meals.length };
}

/** 🔍 معاينة — لا تكتب شيئاً. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const p = await plan(ctx);
    // 🎯 المقياس الحقيقي: هل كل وجبة **مجدولة** ستجد طريقها لخطة الأخصائية؟
    const all = await ctx.db.query("publicMeals").collect();
    const linkedMealIds = new Set(p.link.map((l: any) => l.mealId));
    const scheduledUnlinked = (all as any[])
      .filter((m) => !m.isGymOnly && !m.isOnlineOnly)
      .filter((m) => isScheduled(m) && !linkedMealIds.has(String(m._id)))
      .map((m) => ({ nameEn: m.nameEn, nameAr: m.nameAr, cat: m.category, slots: m.schedule.length }));
    return {
      totalItems: p.totalItems, totalMeals: p.totalMeals,
      willLink: p.link.filter((l: any) => !l.already).length,
      alreadyLinked: p.link.filter((l: any) => l.already).length,
      ambiguous: p.ambiguous, orphanCount: p.orphan.length,
      orphanActive: p.orphan.filter((o: any) => o.active).map((o: any) => o.menuName),
      scheduledUnlinked,
      newLinks: p.link.filter((l: any) => !l.already).map((l: any) => ({
        from: l.menuName, to: l.mealEn, ar: l.mealAr, scheduled: l.scheduled,
      })),
    };
  },
});

/** ✅ تطبيق — ADMIN فقط. يكتب publicMealId فقط، لا يمسّ اسماً ولا وصفة. */
export const apply = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const p = await plan(ctx);
    let updated = 0, skipped = 0;
    for (const l of p.link) {
      if (l.already) { skipped++; continue; }
      const cur: any = await ctx.db.get(l.id as any);
      // 🔒 نعيد الفحص: قد يكون الاسم تغيّر بعد المعاينة
      if (!cur || cur.name !== l.menuName) { skipped++; continue; }
      await ctx.db.patch(l.id as any, { publicMealId: l.mealId as any });
      updated++;
    }
    return { updated, skipped, ambiguous: p.ambiguous.length, orphans: p.orphan.length };
  },
});
