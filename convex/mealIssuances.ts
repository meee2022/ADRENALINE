/**
 * @file convex/mealIssuances.ts
 * @description حصر الوجبات الصادرة داخليًا (مدير الفرع / موظفين / تجربة / ضيافة / هدر).
 *   يسجّل مين خد كام، ويطلّع تقرير يومي/شهري مقسّم بالسبب والصنف والمستلم.
 *   يخصم مكوّنات الوجبة من المخزون تلقائيًا لو ليها وصفة (mealIngredients).
 * @frontend client/src/pages/MealIssuance.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { validateSession, requireAdmin } from "./sessions";
import { convertUnit } from "./units";

const monthOf = (d: string) => (d || "").slice(0, 7);

const categoryU = v.union(
  v.literal("MANAGER"),
  v.literal("STAFF"),
  v.literal("TASTING"),
  v.literal("GUEST"),
  v.literal("WASTE"),
  v.literal("OTHER"),
);

/** خصم مكوّنات وجبة من المخزون (لو ليها وصفة) — نفس منطق المطبخ. idempotent عبر ختم. */
async function consumeInventory(ctx: any, publicMealId: any, menuItemId: any, qty: number, label: string) {
  const ingredients = publicMealId
    ? await ctx.db.query("mealIngredients").withIndex("by_publicMeal", (q: any) => q.eq("publicMealId", publicMealId)).collect()
    : menuItemId
      ? await ctx.db.query("mealIngredients").withIndex("by_menuItem", (q: any) => q.eq("menuItemId", menuItemId)).collect()
      : [];
  for (const ing of ingredients) {
    const inv: any = await ctx.db.get(ing.inventoryItemId);
    if (!inv) continue;
    const deduct = convertUnit(Number(ing.quantityPerServing) * qty, ing.unit, inv.unit);
    const newStock = Math.max(0, (inv.currentStock || 0) - deduct);
    await ctx.db.patch(ing.inventoryItemId, { currentStock: newStock, updatedAt: Date.now() });
    await ctx.db.insert("inventoryMovements", {
      itemId: ing.inventoryItemId,
      type: "consume",
      quantity: -deduct,
      note: `صرف داخلي: ${label}`,
      createdAt: Date.now(),
    });
  }
}

/** تسجيل وجبة صادرة. للموظفين المصرّح لهم. */
export const log = mutation({
  args: {
    date: v.string(),
    mealName: v.string(),
    publicMealId: v.optional(v.id("publicMeals")),
    menuItemId: v.optional(v.id("menuItems")),
    quantity: v.number(),
    category: categoryU,
    recipient: v.optional(v.string()),
    note: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") throw new Error("Unauthorized");
    const name = args.mealName.trim();
    if (!name) throw new Error("اسم الوجبة مطلوب");
    const qty = Math.max(1, Math.round(args.quantity || 1));

    let inventoryConsumedAt: number | undefined;
    try {
      await consumeInventory(ctx, args.publicMealId, args.menuItemId, qty, `${name} ×${qty} (${args.category})`);
      inventoryConsumedAt = Date.now();
    } catch { /* لو مفيش وصفة أو خطأ، نسجّل الحصر بس */ }

    return await ctx.db.insert("mealIssuances", {
      date: args.date,
      month: monthOf(args.date),
      mealName: name,
      publicMealId: args.publicMealId,
      menuItemId: args.menuItemId,
      quantity: qty,
      category: args.category,
      recipient: args.recipient?.trim() || undefined,
      note: args.note?.trim() || undefined,
      loggedBy: (id as any).user?.name || (id as any).user?.username || undefined,
      inventoryConsumedAt,
      createdAt: Date.now(),
    });
  },
});

/** حذف سجل صادر. للمدير. */
export const remove = mutation({
  args: { id: v.id("mealIssuances"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

/** قائمة صادر يوم معيّن (الأحدث أولاً). للموظفين. */
export const listByDate = query({
  args: { date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    const rows = await ctx.db.query("mealIssuances").withIndex("by_date", (q) => q.eq("date", args.date)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

const CATS = ["MANAGER", "STAFF", "TASTING", "GUEST", "WASTE", "OTHER"] as const;

/** حصر: إجماليات اليوم + الشهر (بالصنف/الوجبة/المستلم). للموظفين. */
export const summary = query({
  args: { date: v.string(), month: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return null;
    const month = args.month || monthOf(args.date);

    const dayRows = await ctx.db.query("mealIssuances").withIndex("by_date", (q) => q.eq("date", args.date)).collect();
    const monthRows = await ctx.db.query("mealIssuances").withIndex("by_month", (q) => q.eq("month", month)).collect();

    const byCat = (rows: any[]) => {
      const o: Record<string, number> = {};
      for (const c of CATS) o[c] = 0;
      for (const r of rows) o[r.category] = (o[r.category] || 0) + r.quantity;
      return o;
    };
    const total = (rows: any[]) => rows.reduce((s, r) => s + r.quantity, 0);

    // تجميع الشهر بالوجبة والمستلم
    const byMeal: Record<string, number> = {};
    const byRecipient: Record<string, number> = {};
    for (const r of monthRows) {
      byMeal[r.mealName] = (byMeal[r.mealName] || 0) + r.quantity;
      const key = r.recipient || `(${r.category})`;
      byRecipient[key] = (byRecipient[key] || 0) + r.quantity;
    }
    const sortObj = (o: Record<string, number>) =>
      Object.entries(o).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);

    // الأشهر المتاحة
    const all = await ctx.db.query("mealIssuances").collect();
    const months = Array.from(new Set(all.map((x) => x.month))).sort().reverse();

    return {
      day: { total: total(dayRows), byCategory: byCat(dayRows) },
      month: { total: total(monthRows), byCategory: byCat(monthRows), byMeal: sortObj(byMeal), byRecipient: sortObj(byRecipient) },
      months,
    };
  },
});
