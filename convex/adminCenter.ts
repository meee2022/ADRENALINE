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
    // الخطط والطلبات تُقرأ بالفهرس لا كاملة: القراءة الكاملة تجاوزت حدّ Convex وأسقطت اللوحة (23-9).
    const [customers, plans, stock, pendingOrders, followUps] = await Promise.all([
      ctx.db.query("customers").collect(),
      ctx.db.query("dailyPlans").withIndex("by_date", q => q.gte("date", day(-7))).collect(),
      ctx.db.query("inventoryItems").collect(),
      // الحالة مخزّنة بحروف صغيرة: الفلتر القديم ("PENDING"/"NEW") لم يطابق شيئاً فكانت البطاقة فارغة دائماً.
      ctx.db.query("customerOrders").withIndex("by_status", q => q.eq("status", "pending")).order("desc").take(12),
      ctx.db.query("customerFollowUps").withIndex("by_status", q => q.eq("status", "OPEN")).collect(),
    ]);
    const today = day(); const soon = day(7);
    return {
      pendingOrders,
      lowStock: stock.filter((i: any) => Number(i.currentStock || 0) <= Number(i.minStock || 0)).slice(0, 12),
      failedDeliveries: plans.filter((p: any) => p.failedAt && p.date >= day(-7)).slice(0, 12),
      renewals: customers.filter((c: any) => c.isActive && c.endDate >= today && c.endDate <= soon).slice(0, 12),
      openFollowUps: followUps.slice(0, 12),
    };
  },
});
