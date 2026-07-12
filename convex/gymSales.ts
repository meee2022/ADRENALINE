/**
 * @file convex/gymSales.ts
 * @description مبيعات الجم بالجملة — تسجيل وجبات تُورَّد يوميًا لصالة الجم
 *   وحصرها أسبوعيًا/شهريًا (عدد الوجبات + الإيراد). للموظفين (أدمن/مطبخ).
 * @frontend client/src/pages/GymSales.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";

/** سجلات مبيعات الجم ضمن مدى تواريخ [from, to] شامل، مع الإجماليات. */
export const list = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    let rows = await ctx.db.query("gymSales").withIndex("by_date").collect();
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    const totalMeals = rows.reduce((s, r) => s + Number(r.meals || 0), 0);
    const totalRevenue = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    return {
      rows: rows.map((r) => ({
        id: String(r._id),
        date: r.date,
        gymName: r.gymName || "",
        meals: Number(r.meals || 0),
        unitPrice: Number(r.unitPrice || 0),
        total: Number(r.total || 0),
        notes: r.notes || "",
        createdBy: r.createdBy || "",
      })),
      totalMeals,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgPrice: totalMeals ? Math.round((totalRevenue / totalMeals) * 100) / 100 : 0,
      count: rows.length,
    };
  },
});

/** إضافة سجل توريد جديد. */
export const add = mutation({
  args: {
    date: v.string(),
    gymName: v.optional(v.string()),
    meals: v.number(),
    unitPrice: v.number(),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await requireStaff(ctx, args.sessionToken);
    const who = (id as any)?.user?.name || (id as any)?.user?.username || undefined;
    const meals = Math.max(0, Math.round(Number(args.meals) || 0));
    const unitPrice = Math.max(0, Number(args.unitPrice) || 0);
    if (meals <= 0) throw new Error("عدد الوجبات لازم يكون أكبر من صفر");
    const total = Math.round(meals * unitPrice * 100) / 100;
    const newId = await ctx.db.insert("gymSales", {
      date: args.date,
      gymName: args.gymName?.trim() || undefined,
      meals,
      unitPrice,
      total,
      notes: args.notes?.trim() || undefined,
      createdBy: who,
      createdAt: Date.now(),
    });
    return { id: newId, total };
  },
});

/** حذف سجل. */
export const remove = mutation({
  args: { id: v.id("gymSales"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
