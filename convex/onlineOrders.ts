/**
 * @file convex/onlineOrders.ts
 * @description حصر طلبات المنصّات الأونلاين (طلبات/سنونو/رفيق/ديليفرو/كيتا) بالأسعار.
 *   يسجّل لكل طلب: المنصّة + عدد الوجبات + القيمة، ويطلّع تقرير لكل منصّة (طلبات/وجبات/إيراد).
 * @frontend client/src/pages/OnlineOrders.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { validateSession, requireAdmin } from "./sessions";

const monthOf = (d: string) => (d || "").slice(0, 7);
const PLATFORMS = ["TALABAT", "SNOONU", "RAFEEQ", "DELIVEROO", "KEETA", "OTHER"] as const;
const platformU = v.union(
  v.literal("TALABAT"), v.literal("SNOONU"), v.literal("RAFEEQ"),
  v.literal("DELIVEROO"), v.literal("KEETA"), v.literal("OTHER"),
);

/** تسجيل طلب أونلاين. للموظفين المصرّح لهم. */
export const log = mutation({
  args: {
    date: v.string(),
    platform: platformU,
    mealsCount: v.number(),
    amount: v.number(),
    orderRef: v.optional(v.string()),
    note: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") throw new Error("Unauthorized");
    return await ctx.db.insert("onlineOrders", {
      date: args.date,
      month: monthOf(args.date),
      platform: args.platform,
      mealsCount: Math.max(0, Math.round(args.mealsCount || 0)),
      amount: Math.max(0, args.amount || 0),
      orderRef: args.orderRef?.trim() || undefined,
      note: args.note?.trim() || undefined,
      loggedBy: (id as any).user?.name || (id as any).user?.username || undefined,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("onlineOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

/** قائمة طلبات يوم (الأحدث أولاً). للموظفين. */
export const listByDate = query({
  args: { date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    const rows = await ctx.db.query("onlineOrders").withIndex("by_date", (q) => q.eq("date", args.date)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** حصر: إجماليات اليوم + الشهر لكل منصّة (طلبات/وجبات/إيراد). للموظفين. */
export const summary = query({
  args: { date: v.string(), month: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return null;
    const month = args.month || monthOf(args.date);

    const dayRows = await ctx.db.query("onlineOrders").withIndex("by_date", (q) => q.eq("date", args.date)).collect();
    const monthRows = await ctx.db.query("onlineOrders").withIndex("by_month", (q) => q.eq("month", month)).collect();

    const byPlatform = (rows: any[]) => {
      const o: Record<string, { orders: number; meals: number; revenue: number }> = {};
      for (const p of PLATFORMS) o[p] = { orders: 0, meals: 0, revenue: 0 };
      for (const r of rows) {
        o[r.platform].orders += 1;
        o[r.platform].meals += r.mealsCount;
        o[r.platform].revenue += r.amount;
      }
      return o;
    };
    const totals = (rows: any[]) => ({
      orders: rows.length,
      meals: rows.reduce((s, r) => s + r.mealsCount, 0),
      revenue: rows.reduce((s, r) => s + r.amount, 0),
    });

    const all = await ctx.db.query("onlineOrders").collect();
    const months = Array.from(new Set(all.map((x) => x.month))).sort().reverse();

    return {
      day: { totals: totals(dayRows), byPlatform: byPlatform(dayRows) },
      month: { totals: totals(monthRows), byPlatform: byPlatform(monthRows) },
      months,
    };
  },
});
