/**
 * @file convex/mealMerge.ts
 * @description دمج بطاقتين لنفس الطبق في بطاقة واحدة — من سطر الأوامر فقط (internal).
 *
 * لماذا: الطبق الواحد تكرّر كبطاقتين (فبراير/يوليو) فتفرّقت جدولته ووصفته وأسعار
 * منافذه وطلباته. الدمج ينقل ما يلزم إلى البطاقة الباقية ويقفل القديمة بلا حذف:
 *   - الجدولة: اتحاد الجدولتين (فيظهر الطبق للمشترك في كل أسابيعه من بطاقة واحدة).
 *   - الخطط اليدوية (menuItems) والتقييمات (ratings): تُعاد إلى البطاقة الباقية.
 *   - أسعار المنافذ (outletCatalogItems): تُنقل إن لم يكن للمنفذ سعر على الباقية،
 *     وإلا يُقفل سعر القديمة (سعر الباقية هو الساري).
 *   - الوصفة (mealIngredients): تُنقل فقط إن كانت الباقية بلا وصفة، وإلا تبقى
 *     وصفة الباقية ولا تُمسّ وصفة القديمة (تاريخ).
 *   - الطلبات والمبيعات القديمة (customerOrderItems/posTicketLines/gymOrderLines)
 *     لا تُلمس: تحمل معرّف القديمة واسمها وقت الطلب.
 *   - القديمة: isActive=false + mergedIntoId + mergedAt (رجوع ممكن بإلغاء ذلك).
 * حماية: compare-and-set على الاسمين، وdryRun يعرض الخطة دون كتابة.
 */
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { validateSession } from "./sessions";
import { mealChannel, mergePlan, normMealName } from "./lib/mealIdentity";

export const apply = internalMutation({
  args: {
    keepId: v.id("publicMeals"),
    retireId: v.id("publicMeals"),
    expectKeepEn: v.string(),
    expectRetireEn: v.string(),
    dryRun: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (String(args.keepId) === String(args.retireId)) throw new Error("keep and retire are the same meal");
    const keep: any = await ctx.db.get(args.keepId);
    const retire: any = await ctx.db.get(args.retireId);
    if (!keep || !retire) throw new Error("meal not found");
    if ((keep.nameEn || "") !== args.expectKeepEn || (retire.nameEn || "") !== args.expectRetireEn) throw new Error("names changed since review");
    if (mealChannel(keep) !== mealChannel(retire)) throw new Error("different channels: " + mealChannel(keep) + " vs " + mealChannel(retire));
    if (retire.mergedIntoId) throw new Error("retire meal already merged");

    const patch = mergePlan(keep, retire);
    const menuItems = await ctx.db.query("menuItems").withIndex("by_publicMeal", (q: any) => q.eq("publicMealId", args.retireId)).collect();
    const ratings = await ctx.db.query("ratings").withIndex("by_publicMeal", (q: any) => q.eq("publicMealId", args.retireId)).collect();
    const keepOutlet: any[] = (await ctx.db.query("outletCatalogItems").collect()).filter((r: any) => String(r.mealId) === String(args.keepId));
    const retireOutlet: any[] = (await ctx.db.query("outletCatalogItems").collect()).filter((r: any) => String(r.mealId) === String(args.retireId));
    const keepRecipe = await ctx.db.query("mealIngredients").withIndex("by_publicMeal", (q: any) => q.eq("publicMealId", args.keepId)).collect();
    const retireRecipe = await ctx.db.query("mealIngredients").withIndex("by_publicMeal", (q: any) => q.eq("publicMealId", args.retireId)).collect();
    const keepPos = await ctx.db.query("posItems").withIndex("by_meal", (q: any) => q.eq("mealId", args.keepId)).first();
    const retirePos = await ctx.db.query("posItems").withIndex("by_meal", (q: any) => q.eq("mealId", args.retireId)).first();

    const outletMoves = retireOutlet.map((r: any) => ({
      id: r._id, outletId: r.outletId,
      action: keepOutlet.some((k: any) => String(k.outletId) === String(r.outletId)) ? "deactivate" : "move",
    }));
    const plan = {
      keep: { id: keep._id, nameEn: keep.nameEn, nameAr: keep.nameAr, channel: mealChannel(keep) },
      retire: { id: retire._id, nameEn: retire.nameEn, nameAr: retire.nameAr },
      keepPatch: patch,
      menuItemsRepointed: menuItems.length,
      ratingsRepointed: ratings.length,
      outlet: outletMoves,
      recipe: keepRecipe.length ? "keep has recipe; retire recipe left as history" : (retireRecipe.length ? `move ${retireRecipe.length} ingredient rows` : "none"),
      posMeta: !keepPos && retirePos ? "move" : "keep",
    };
    if (args.dryRun) return { dryRun: true, ...plan };

    const now = Date.now();
    if (Object.keys(patch).length) await ctx.db.patch(args.keepId, patch);
    for (const m of menuItems) await ctx.db.patch(m._id, { publicMealId: args.keepId });
    for (const r of ratings) await ctx.db.patch(r._id, { publicMealId: args.keepId });
    for (const o of outletMoves) {
      if (o.action === "move") await ctx.db.patch(o.id, { mealId: args.keepId, updatedAt: now });
      else await ctx.db.patch(o.id, { isActive: false, updatedAt: now });
    }
    if (!keepRecipe.length) for (const r of retireRecipe) await ctx.db.patch(r._id, { publicMealId: args.keepId });
    if (!keepPos && retirePos) await ctx.db.patch(retirePos._id, { mealId: args.keepId, updatedAt: now });
    await ctx.db.patch(args.retireId, { isActive: false, mergedIntoId: args.keepId, mergedAt: now });
    return { dryRun: false, ...plan };
  },
});

/** تقرير التكرار داخل القناة الواحدة — للطاقم: بطاقات نشطة تحمل نفس الاسم في نفس القناة. */
export const duplicates = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    const meals: any[] = await ctx.db.query("publicMeals").withIndex("by_active", (q: any) => q.eq("isActive", true)).collect();
    const groups = new Map<string, any[]>();
    for (const m of meals) {
      for (const key of [normMealName(m.nameEn), normMealName(m.nameAr)]) {
        if (!key) continue;
        const k = mealChannel(m) + "|" + key;
        const g = groups.get(k) || [];
        if (!g.some((x) => String(x._id) === String(m._id))) g.push(m);
        groups.set(k, g);
      }
    }
    return [...groups.entries()]
      .filter(([, g]) => g.length > 1)
      .map(([k, g]) => ({
        channel: k.split("|")[0],
        meals: g.map((m) => ({ _id: m._id, nameAr: m.nameAr, nameEn: m.nameEn, priceQAR: m.priceQAR, calories: m.calories, schedule: m.schedule || [], createdAt: m.createdAt })),
      }));
  },
});
