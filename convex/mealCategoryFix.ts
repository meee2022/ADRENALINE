/**
 * @file convex/mealCategoryFix.ts
 * @description تصحيح تصنيف الوجبة (فطور/غداء/عشاء/سناك) من الإكسل — معاينة ثم تطبيق.
 *
 *   الإكسل هو المرجع: خانة الوجبة فيه (BREAKFAST / SNACK1 / LUNCH / DINNER /
 *   SNACK2) هي تصنيفها الصحيح. القاعدة انحرفت عنه في موضعين مرّا بصمت لأن
 *   `OFFICIAL` كان يحفظ الأسماء بلا خاناتها — فلا شيء يكشف الفرق.
 *
 *   ⚠️ لا نحكم إلا على وجبة **مجدولة على اليوم نفسه** في القاعدة. الوجبة غير
 *      المجدولة قد تكون نسخة أونلاين أو بقيّة قديمة، وتصنيفها ليس شأن الإكسل.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";
import { OFFICIAL_SLOTS } from "./menuOfficial";

/** تصحيحات إملاء الإكسل — نفس قائمة menuLink، فالمصدر واحد والأخطاء واحدة. */
const TYPOS: [RegExp, string][] = [
  [/\bshawerma\b/g, "shawarma"], [/\bzaater\b/g, "zaatar"], [/\bcroisant\b/g, "croissant"],
  [/\bsyadiah\b/g, "sayadieh"], [/\bwaldoraf\b/g, "waldorf"], [/\brizotto\b/g, "risotto"],
  [/\bmangolian\b/g, "mongolian"], [/\bpenne\b/g, "penni"], [/\bblue\b/g, "bleu"],
  [/\bpotatoes\b/g, "potato"], [/\bteryaki\b/g, "teriyaki"], [/\bslamon\b/g, "salmon"],
  [/\bspaghette\b/g, "spaghetti"], [/\bfalafal\b/g, "falafel"], [/\bceasar\b/g, "caesar"],
  [/\bvindalo\b/g, "vindaloo"], [/\bfattouch\b/g, "fattoush"], [/\bstragnoff\b/g, "stroganoff"],
  [/\bcreamu\b/g, "creamy"], [/\bharps\b/g, "herbs"], [/\bomelete\b/g, "omelette"],
  // ⚠️ الحدّ \b ضرورة: بدونه يلتهم "stroganoff" الصحيح فيصير "stroganofff"
  [/\bstroganof\b/g, "stroganoff"], [/\bhuumus\b/g, "hummus"], [/\bbriyani\b/g, "biryani"],
];

function norm(s: any): string {
  let x = " " + String(s || "").toLowerCase() + " ";
  x = x.replace(/&/g, " and ").replace(/w\//g, " with ");
  x = x.replace(/[\/\-_,.()]/g, " ").replace(/\s+/g, " ");
  for (const [re, to] of TYPOS) x = x.replace(re, to);   // التصحيح قبل الضغط
  x = x.replace(/\bwith\b/g, " ").replace(/\band\b/g, " ").replace(/\bthe\b/g, " ");
  x = x.split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");
  return x.replace(/[^a-z0-9]/g, "");
}

async function plan(ctx: any) {
  const all = await ctx.db.query("publicMeals").collect();
  // 🔒 منيو المشتركين وحده — الأونلاين والجم ليسا في الإكسل
  const meals = (all as any[]).filter((m) => !m.isGymOnly && !m.isOnlineOnly);
  const byNorm = new Map<string, any[]>();
  for (const m of meals) {
    const k = norm(m.nameEn);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k)!.push(m);
  }

  const rows: any[] = [];
  const seen = new Set<string>();
  for (const [key, items] of Object.entries(OFFICIAL_SLOTS)) {
    const [ws, day] = key.split(":");
    const week = Number(ws);
    for (const [name, cat] of Object.entries(items as Record<string, string>)) {
      const cands = byNorm.get(norm(name)) || [];
      // 🔑 المجدولة على هذا اليوم هي المقصودة — لا نحكم على غيرها
      const hit = cands.find((m) =>
        (m.schedule || []).some((s: any) => Number(s.week) === week && String(s.day).toLowerCase() === day));
      if (!hit) continue;
      if (String(hit.category).toLowerCase() === cat) continue;
      const id = String(hit._id);
      if (seen.has(id)) continue;   // الصنف الواحد يُصحَّح مرة
      seen.add(id);
      rows.push({ id, nameEn: hit.nameEn, nameAr: hit.nameAr,
        from: hit.category, to: cat, excelName: name, at: key });
    }
  }
  return rows;
}

/** 🔍 معاينة — لا تكتب شيئاً. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await plan(ctx);
    return { total: rows.length, rows };
  },
});

/** ✅ تطبيق — ADMIN فقط. التصنيف وحده؛ لا اسم ولا جدولة ولا سعر. */
export const apply = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await plan(ctx);
    let updated = 0, skipped = 0;
    for (const r of rows) {
      const cur: any = await ctx.db.get(r.id as any);
      // 🔒 نتخطّى لو الصف تغيّر بعد المعاينة
      if (!cur || String(cur.category).toLowerCase() !== r.from) { skipped++; continue; }
      await ctx.db.patch(r.id as any, { category: r.to });
      updated++;
    }
    return { updated, skipped };
  },
});
