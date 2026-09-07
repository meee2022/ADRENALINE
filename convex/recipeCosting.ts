/**
 * @file convex/recipeCosting.ts
 * @description تكلفة الوجبة من رسب المخزون (mealIngredients) + معاينة خصم يوم كامل قبل التحضير.
 *
 *   ═══ من أين تأتي تكلفة المكوّن؟ ═══
 *   ١) آخر دفعة شراء مسعّرة للصنف (inventoryBatches.unitCost لوحدة الأساس) — الحقيقة.
 *   ٢) وإلا التكلفة المرجعية refUnitCost (من ورقة أسعار الرسب) — تقدير حتى تأتي أول فاتورة.
 *   الوحدة: الرسيبي بوحدة الصنف نفسها (جم/مل/قطعة)، والتحويل عبر convertUnit للاحتياط.
 *
 *   ═══ لماذا refreshAllCostQAR؟ ═══
 *   تقارير الربحية (posAdmin/financeReports/gymSales) تقرأ publicMeals.costQAR كرقم جاهز.
 *   بدل تغيير كل تقرير ليحسب من الرسب، نحدّث costQAR من الرسب دورياً (وعند كل استلام).
 */
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdmin, requireStaff } from "./sessions";
import { convertUnit } from "./units";

type Ctx = any;

/** آخر تكلفة معروفة لوحدة الأساس: آخر دفعة مسعّرة، وإلا المرجعية. */
async function unitCostOf(ctx: Ctx, item: any): Promise<{ cost: number; source: "batch" | "ref" | "none" }> {
  const batches = await ctx.db.query("inventoryBatches")
    .withIndex("by_itemId", (q: any) => q.eq("itemId", item._id)).collect();
  const priced = batches.filter((b: any) => Number(b.unitCost || 0) > 0)
    .sort((a: any, b: any) => String(a.receivedAt).localeCompare(String(b.receivedAt)));
  if (priced.length) return { cost: Number(priced[priced.length - 1].unitCost), source: "batch" };
  if (Number(item.refUnitCost || 0) > 0) return { cost: Number(item.refUnitCost), source: "ref" };
  return { cost: 0, source: "none" };
}

export async function costOfMeal(ctx: Ctx, publicMealId: any) {
  const rows = await ctx.db.query("mealIngredients")
    .withIndex("by_publicMeal", (q: any) => q.eq("publicMealId", publicMealId)).collect();
  let total = 0, priced = 0, unpriced = 0;
  const lines: any[] = [];
  for (const r of rows) {
    const item = await ctx.db.get(r.inventoryItemId);
    if (!item) continue;
    const qty = convertUnit(Number(r.quantityPerServing) || 0, r.unit, item.unit);
    const { cost, source } = await unitCostOf(ctx, item);
    const line = qty * cost;
    total += line;
    if (cost > 0) priced++; else unpriced++;
    lines.push({ itemId: String(item._id), nameAr: item.nameAr, qty, unit: item.unit, unitCost: cost, source, lineCost: Math.round(line * 1000) / 1000 });
  }
  return { total: Math.round(total * 100) / 100, priced, unpriced, lines };
}

/** تكلفة وجبة واحدة بتفاصيل سطورها — لشاشة إدارة الأصناف. */
export const mealCost = query({
  args: { publicMealId: v.id("publicMeals"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { publicMealId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    return await costOfMeal(ctx, publicMealId);
  },
});

/** تحديث publicMeals.costQAR من الرسب لكل الأصناف التي لها رسيبي. أدمن. */
export const refreshAllCostQAR = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    return await refreshAll(ctx);
  },
});

export const refreshAllCostQARInternal = internalMutation({
  args: {},
  handler: async (ctx) => await refreshAll(ctx),
});

async function refreshAll(ctx: Ctx) {
  const rows = await ctx.db.query("mealIngredients").collect();
  const mealIds = new Set<string>();
  for (const r of rows) if (r.publicMealId) mealIds.add(String(r.publicMealId));
  let updated = 0, unchanged = 0, partial = 0;
  for (const id of Array.from(mealIds)) {
    const meal = await ctx.db.get(id as any);
    if (!meal) continue;
    const c = await costOfMeal(ctx, id);
    if (c.unpriced > 0) partial++;
    const next = Math.round(c.total * 100) / 100;
    if (Math.abs(Number((meal as any).costQAR ?? -1) - next) < 0.005) { unchanged++; continue; }
    await ctx.db.patch(id as any, { costQAR: next });
    updated++;
  }
  return { meals: mealIds.size, updated, unchanged, partial };
}

/**
 * معاينة «تحضير الكل» ليوم: ماذا سيُخصم من كل صنف، وهل المخزون يكفي — بلا أي كتابة.
 * للمطبخ ومدير المخزون قبل الضغط على الزر.
 */
export const previewPrepareAll = query({
  args: { date: v.string(), deliveryTime: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { date, deliveryTime, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const plans = await ctx.db.query("dailyPlans").withIndex("by_date", (q: any) => q.eq("date", date)).collect();
    const need = new Map<string, number>();
    let plansCounted = 0, itemsWithRecipe = 0, itemsWithoutRecipe = 0;
    const missingRecipe = new Map<string, number>();
    for (const p of plans as any[]) {
      if (p.status !== "CONFIRMED") continue;
      if (p.origin === "CUSTOMIZED") continue;
      if (deliveryTime && String(p.deliveryTime) !== deliveryTime) continue;
      if (p.inventoryConsumedAt) continue;
      plansCounted++;
      for (const it of (Array.isArray(p.items) ? p.items : [])) {
        if (it?.isOff) continue;
        const publicMealId = it.publicMealId || (!it.menuItemId ? it.mealId : null);
        const recipe = publicMealId
          ? await ctx.db.query("mealIngredients").withIndex("by_publicMeal", (q: any) => q.eq("publicMealId", publicMealId)).collect()
          : it.menuItemId
            ? await ctx.db.query("mealIngredients").withIndex("by_menuItem", (q: any) => q.eq("menuItemId", it.menuItemId)).collect()
            : [];
        if (!recipe.length) {
          itemsWithoutRecipe++;
          const k = String(it.mealNameAr || it.mealNameEn || it.mealName || "?");
          missingRecipe.set(k, (missingRecipe.get(k) || 0) + 1);
          continue;
        }
        itemsWithRecipe++;
        for (const ing of recipe) {
          const inv: any = await ctx.db.get(ing.inventoryItemId);
          if (!inv) continue;
          const qty = convertUnit(Number(ing.quantityPerServing) || 0, ing.unit, inv.unit);
          need.set(String(inv._id), (need.get(String(inv._id)) || 0) + qty);
        }
      }
    }
    const lines: any[] = [];
    let shortItems = 0, estCost = 0;
    for (const [id, qty] of Array.from(need.entries())) {
      const inv: any = await ctx.db.get(id as any);
      if (!inv) continue;
      const { cost } = await unitCostOf(ctx, inv);
      const short = Math.max(0, qty - Number(inv.currentStock || 0));
      if (short > 0) shortItems++;
      estCost += qty * cost;
      lines.push({ itemId: id, nameAr: inv.nameAr, unit: inv.unit, need: Math.round(qty * 100) / 100,
                   stock: inv.currentStock, short: Math.round(short * 100) / 100, unitCost: cost });
    }
    lines.sort((a, b) => b.short - a.short || b.need - a.need);
    return {
      date, plansCounted, itemsWithRecipe, itemsWithoutRecipe,
      missingRecipe: Array.from(missingRecipe.entries()).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
      shortItems, estCost: Math.round(estCost * 100) / 100, lines,
    };
  },
});
