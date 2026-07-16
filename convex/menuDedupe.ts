/**
 * @file convex/menuDedupe.ts
 * @description دمج أصناف المطبخ المكرّرة (menuItems) بأمان.
 *
 *   ═══ المشكلة ═══
 *   استيراد/مزامنة اتشغّلت أكتر من مرة فأنتجت نسخاً بنفس الاسم حرفياً.
 *   النمط ثابت في كل المجموعات: نسخة واحدة بسعرات (الحقيقية) + نسخ بلا سعرات.
 *   لكن بعض الخطط اختارت النسخة الفاضية بالغلط — فالحذف الأعمى يكسرها.
 *
 *   ═══ الحل ═══
 *   دمج، لا حذف: نختار فائزاً لكل مجموعة، نحوّل كل المراجع إليه، ثم نحذف الباقي.
 *
 *   ═══ نطاق التأثير ═══
 *   menuItems مُشار إليه من 4 جداول — كلها تُحوَّل:
 *     dailyPlans.items[].menuItemId   (مضمّن داخل مصفوفة)
 *     mealIngredients.menuItemId      (الوصفات — الأهم)
 *     ratings.menuItemId
 *     mealIssuances.menuItemId
 *   لا يلمس publicMeals ولا posItems/posCategories ولا outletCatalogItems،
 *   فلا يمكن أن يؤثر على منيو العميل ولا الأونلاين ولا المنافذ.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

/** تطبيع الاسم للتجميع: قصّ الأطراف + توحيد المسافات + حروف صغيرة. */
function normName(s: string): string {
  return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * يختار الفائز داخل مجموعة مكرّرة، بالترتيب:
 *   1) عنده سعرات  (النسخة الحقيقية القادمة من منيو العميل)
 *   2) الأكثر استخداماً في الخطط
 *   3) عنده macros
 *   4) الأقدم (_creationTime)
 */
function pickWinner(group: any[], planUse: Record<string, number>): any {
  const score = (m: any) => [
    m.calories ? 1 : 0,
    planUse[String(m._id)] || 0,
    m.macros ? 1 : 0,
    -(m._creationTime || 0),
  ];
  return [...group].sort((a, b) => {
    const sa = score(a), sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i];
    return 0;
  })[0];
}

/** يجمع الحقائق المشتركة بين preview و apply. */
async function analyze(ctx: any) {
  const menu = await ctx.db.query("menuItems").collect();
  const plans = await ctx.db.query("dailyPlans").collect();
  const recipes = await ctx.db.query("mealIngredients").collect();
  const rates = await ctx.db.query("ratings").collect();
  const issues = await ctx.db.query("mealIssuances").collect();

  // كم مرة استُخدم كل صنف في الخطط
  const planUse: Record<string, number> = {};
  for (const p of plans) {
    for (const it of (Array.isArray(p.items) ? p.items : [])) {
      const id = it?.menuItemId ? String(it.menuItemId) : null;
      if (id) planUse[id] = (planUse[id] || 0) + 1;
    }
  }

  // تجميع بالاسم المطبَّع
  const groups: Record<string, any[]> = {};
  for (const m of menu) {
    const k = normName(m.name);
    if (!k) continue;
    (groups[k] ||= []).push(m);
  }

  // خطة الدمج: loserId → winnerId
  const remap: Record<string, string> = {};
  const merges: any[] = [];
  for (const [key, group] of Object.entries(groups)) {
    if (group.length < 2) continue;
    const winner = pickWinner(group, planUse);
    const losers = group.filter((m) => String(m._id) !== String(winner._id));
    for (const l of losers) remap[String(l._id)] = String(winner._id);
    merges.push({
      name: winner.name,
      copies: group.length,
      winner: {
        id: winner._id,
        calories: winner.calories ?? null,
        planUses: planUse[String(winner._id)] || 0,
      },
      losers: losers.map((l) => ({
        id: l._id,
        calories: l.calories ?? null,
        planUses: planUse[String(l._id)] || 0,
      })),
    });
  }

  // كم مرجع سيُحوَّل في كل جدول
  let planItemsToRepoint = 0;
  const plansToPatch: any[] = [];
  for (const p of plans) {
    const items = Array.isArray(p.items) ? p.items : [];
    let hit = 0;
    for (const it of items) {
      const id = it?.menuItemId ? String(it.menuItemId) : null;
      if (id && remap[id]) hit++;
    }
    if (hit > 0) { planItemsToRepoint += hit; plansToPatch.push(p); }
  }
  const recipesToRepoint = recipes.filter((r: any) => remap[String(r.menuItemId)]);
  const ratingsToRepoint = rates.filter((r: any) => r.menuItemId && remap[String(r.menuItemId)]);
  const issuesToRepoint = issues.filter((r: any) => r.menuItemId && remap[String(r.menuItemId)]);

  return {
    menu, merges, remap, plansToPatch, planItemsToRepoint,
    recipesToRepoint, ratingsToRepoint, issuesToRepoint,
  };
}

/**
 * 🔍 معاينة — لا تكتب أي شيء. تعرض بالضبط ما ستفعله apply().
 */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const a = await analyze(ctx);
    const toDelete = Object.keys(a.remap).length;
    return {
      summary: {
        totalMenuItems: a.menu.length,
        duplicateGroups: a.merges.length,
        copiesToDelete: toDelete,
        menuItemsAfter: a.menu.length - toDelete,
      },
      referencesToRepoint: {
        dailyPlanItems: a.planItemsToRepoint,
        plansAffected: a.plansToPatch.length,
        recipes: a.recipesToRepoint.length,
        ratings: a.ratingsToRepoint.length,
        mealIssuances: a.issuesToRepoint.length,
      },
      merges: a.merges,
    };
  },
});

/**
 * ✅ تنفيذ — ADMIN فقط.
 *   الترتيب مقصود: نحوّل كل المراجع أولاً، ثم نحذف الخاسرين — فلا تبقى
 *   أي وثيقة تشاور على صنف محذوف في أي لحظة.
 */
export const apply = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const a = await analyze(ctx);
    if (Object.keys(a.remap).length === 0) {
      return { deleted: 0, repointed: { planItems: 0, recipes: 0, ratings: 0, issuances: 0 } };
    }

    // 1) الخطط اليومية — menuItemId مضمّن داخل مصفوفة items
    let planItems = 0;
    for (const p of a.plansToPatch) {
      const items = (Array.isArray(p.items) ? p.items : []).map((it: any) => {
        const id = it?.menuItemId ? String(it.menuItemId) : null;
        if (id && a.remap[id]) { planItems++; return { ...it, menuItemId: a.remap[id] }; }
        return it;
      });
      await ctx.db.patch(p._id, { items, updatedAt: Date.now() });
    }

    // 2) الوصفات (الأهم — ربط المخزون)
    let recipes = 0;
    for (const r of a.recipesToRepoint) {
      await ctx.db.patch(r._id, { menuItemId: a.remap[String(r.menuItemId)] as any });
      recipes++;
    }

    // 3) التقييمات
    let ratings = 0;
    for (const r of a.ratingsToRepoint) {
      await ctx.db.patch(r._id, { menuItemId: a.remap[String(r.menuItemId)] as any });
      ratings++;
    }

    // 4) حصر الصادر
    let issuances = 0;
    for (const r of a.issuesToRepoint) {
      await ctx.db.patch(r._id, { menuItemId: a.remap[String(r.menuItemId)] as any });
      issuances++;
    }

    // 5) الحذف — بعد أن أصبح الخاسرون بلا أي مراجع
    let deleted = 0;
    for (const loserId of Object.keys(a.remap)) {
      await ctx.db.delete(loserId as any);
      deleted++;
    }

    return { deleted, repointed: { planItems, recipes, ratings, issuances } };
  },
});
