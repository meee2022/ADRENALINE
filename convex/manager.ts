/**
 * @file convex/manager.ts
 * @description لوحة تحكم لحظية للمدير — snapshot موحّد لكل ما يحدث الآن:
 *   مبيعات اليوم، الكاشيرون النشطون، آخر الفواتير، أحداث الأمان (Void/Refund)،
 *   تنبيهات (فواتير كبيرة، مخزون منخفض). Convex reactive → التحديث لحظي.
 * @frontend client/src/pages/ManagerLive.tsx
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireStaff } from "./sessions";

/** Snapshot لحظي لكل ما يخص المطعم دلوقتي. */
export const liveSnapshot = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const now = Date.now();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const dayStart = startOfDay.getTime();
    const hourAgo = now - 60 * 60 * 1000;

    /* ═══════ فواتير اليوم ═══════ */
    const tickets: any[] = await ctx.db.query("posTickets").withIndex("by_paidAt").collect();
    const todayPaid = tickets.filter((t) => t.paidAt && t.paidAt >= dayStart && t.status === "PAID");
    const todayRev = todayPaid.filter((t) => !t.isNonRevenue);
    const todayStaff = todayPaid.filter((t) => t.isNonRevenue);
    const lastHour = todayRev.filter((t) => (t.paidAt || 0) >= hourAgo);
    const totalSales = Math.round(todayRev.reduce((s, t) => s + t.total, 0) * 100) / 100;
    const lastHourSales = Math.round(lastHour.reduce((s, t) => s + t.total, 0) * 100) / 100;

    /* ═══════ حسب الطريقة ═══════ */
    const byMethod: Record<string, { method: string; count: number; total: number }> = {};
    for (const t of todayRev) {
      const m = t.paymentMethod || "other";
      if (!byMethod[m]) byMethod[m] = { method: m, count: 0, total: 0 };
      byMethod[m].count++;
      byMethod[m].total = Math.round((byMethod[m].total + t.total) * 100) / 100;
    }

    /* ═══════ الورديات المفتوحة (الكاشيرون) ═══════ */
    const openShifts = (await ctx.db.query("posShifts").withIndex("by_status", (q) => q.eq("status", "OPEN")).collect())
      .map((s: any) => ({
        id: String(s._id),
        cashierName: s.cashierName,
        openedAt: s.openedAt,
        openingCash: s.openingCash,
        totalSales: s.totalSales,
        ticketsCount: s.ticketsCount,
      }))
      .sort((a: any, b: any) => a.openedAt - b.openedAt);

    /* ═══════ آخر 20 فاتورة (activity feed) ═══════ */
    const recent = tickets
      .filter((t) => t.paidAt && t.paidAt >= hourAgo * 6) // آخر 6 ساعات
      .sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0))
      .slice(0, 20)
      .map((t: any) => ({
        id: String(t._id),
        ticketNumber: t.ticketNumber,
        cashierName: t.cashierName,
        total: t.total,
        paymentMethod: t.paymentMethod,
        status: t.status,
        customerName: t.customerName || null,
        paidAt: t.paidAt,
        isNonRevenue: !!t.isNonRevenue,
        isBig: t.total >= 100 && !t.isNonRevenue, // فاتورة كبيرة (تحذير للمتابعة)
      }));

    /* ═══════ أحداث الأمان (آخر 20 من auditLog) ═══════ */
    const auditRows: any[] = await ctx.db.query("auditLog").withIndex("by_createdAt").collect();
    const recentAudit = auditRows
      .filter((r) => r.createdAt >= dayStart)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
      .map((r: any) => {
        let details: any = null;
        try { details = r.details ? JSON.parse(r.details) : null; } catch { details = r.details; }
        return {
          id: String(r._id),
          createdAt: r.createdAt,
          action: r.action,
          entityType: r.entityType,
          actorName: r.actorName || null,
          details,
        };
      });

    /* ═══════ تنبيهات المخزون المنخفض (currentStock <= minStock) ═══════ */
    let lowStockCount = 0;
    let lowStockItems: any[] = [];
    try {
      const inv: any[] = await ctx.db.query("inventoryItems").collect();
      const low = inv.filter((i: any) =>
        i.minStock != null && i.currentStock != null && Number(i.currentStock) <= Number(i.minStock));
      lowStockCount = low.length;
      lowStockItems = low.slice(0, 5).map((i: any) => ({
        id: String(i._id),
        name: i.nameAr || i.nameEn || "—",
        currentStock: Number(i.currentStock),
        minStock: Number(i.minStock),
        unit: i.unit || "",
      }));
    } catch { /* المخزون قد يكون بترتيب مختلف */ }

    /* ═══════ إجمالي التغذية الحيّة ═══════ */
    return {
      generatedAt: now,
      today: {
        totalSales,
        ticketsCount: todayRev.length,
        avgTicket: todayRev.length ? Math.round((totalSales / todayRev.length) * 100) / 100 : 0,
        staffMealsCount: todayStaff.length,
        staffMealsValue: Math.round(todayStaff.reduce((s, t) => s + t.total, 0) * 100) / 100,
      },
      lastHour: {
        ticketsCount: lastHour.length,
        totalSales: lastHourSales,
      },
      byMethod: Object.values(byMethod).sort((a, b) => b.total - a.total),
      openShifts,
      recent,
      audit: recentAudit,
      alerts: {
        bigTickets: recent.filter((t) => t.isBig).length,
        voidsToday: recentAudit.filter((r) => r.action === "VOID_TICKET").length,
        refundsToday: recentAudit.filter((r) => r.action === "REFUND_TICKET").length,
        lowStock: lowStockCount,
        lowStockItems,
      },
    };
  },
});
