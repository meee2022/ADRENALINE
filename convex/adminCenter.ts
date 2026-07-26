import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff } from "./sessions";

const day = (offset = 0) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** A deliberately small, action-first summary for managers; source records stay authoritative. */
export const dailyActions = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const [customers, plans, stock, orders, followUps] = await Promise.all([
      ctx.db.query("customers").collect(), ctx.db.query("dailyPlans").collect(),
      ctx.db.query("inventoryItems").collect(), ctx.db.query("customerOrders").collect(),
      ctx.db.query("customerFollowUps").withIndex("by_status", q => q.eq("status", "OPEN")).collect(),
    ]);
    const today = day(); const soon = day(7);
    return {
      pendingOrders: orders.filter((o: any) => ["PENDING", "NEW"].includes(String(o.status))).slice(0, 12),
      lowStock: stock.filter((i: any) => Number(i.currentStock || 0) <= Number(i.minStock || 0)).slice(0, 12),
      failedDeliveries: plans.filter((p: any) => p.failedAt && p.date >= day(-7)).slice(0, 12),
      renewals: customers.filter((c: any) => c.isActive && c.endDate >= today && c.endDate <= soon).slice(0, 12),
      openFollowUps: followUps.slice(0, 12),
    };
  },
});
