/**
 * @file convex/analytics.ts
 * @description Queries لإحصائيات وتحليلات النظام
 */
import { query } from "./_generated/server";
import { requireStaff } from "./sessions";
import { v } from "convex/values";

// نظرة عامة للأعمال
export const overview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const customers = await ctx.db.query("customers").collect();
    const orders = await ctx.db.query("customerOrders").collect();
    const plans = await ctx.db.query("dailyPlans").collect();
    const meals = await ctx.db.query("menuItems").collect();

    const activeCustomers = customers.filter((c) => c.isActive).length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;
    const confirmedOrders = orders.filter((o) => o.status === "confirmed").length;
    const completedOrders = orders.filter((o) => o.status === "completed").length;

    // الإيرادات
    const totalRevenue = orders
      .filter((o) => o.status !== "cancelled" && o.status !== "pending")
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    // اليوم
    const today = new Date().toISOString().split("T")[0];
    const plansToday = plans.filter((p) => p.date === today);
    const todayMeals = plansToday.reduce((sum, p) => {
      return sum + (Array.isArray(p.items) ? p.items.filter((i: any) => !i?.isOff).length : 0);
    }, 0);

    return {
      totalCustomers: customers.length,
      activeCustomers,
      totalOrders: orders.length,
      pendingOrders,
      confirmedOrders,
      completedOrders,
      totalRevenue,
      totalMeals: meals.length,
      todayPlans: plansToday.length,
      todayMeals,
    };
  },
});

// مبيعات آخر 30 يوم (للرسم البياني)
export const salesLast30Days = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const orders = await ctx.db
      .query("customerOrders")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", cutoff))
      .collect();

    // تجميع حسب اليوم
    const byDay = new Map<string, { count: number; revenue: number }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const day = new Date(o.createdAt).toISOString().split("T")[0];
      const cur = byDay.get(day) || { count: 0, revenue: 0 };
      cur.count++;
      cur.revenue += o.totalPrice || 0;
      byDay.set(day, cur);
    }

    // ملء الأيام الفاضية + ترتيب
    const result: Array<{ date: string; count: number; revenue: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      const data = byDay.get(key) || { count: 0, revenue: 0 };
      result.push({
        date: key.slice(5), // MM-DD
        count: data.count,
        revenue: data.revenue,
      });
    }
    return result;
  },
});

// توزيع الطلبات حسب الحالة
export const orderStatusDistribution = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const orders = await ctx.db.query("customerOrders").collect();
    const counts = new Map<string, number>();
    for (const o of orders) {
      counts.set(o.status, (counts.get(o.status) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
  },
});

// أشهر الوجبات
export const topMeals = query({
  args: { limit: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { limit = 10, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const orderItems = await ctx.db.query("customerOrderItems").collect();
    const counts = new Map<string, { name: string; count: number; revenue: number }>();

    for (const it of orderItems) {
      const key = String(it.mealId);
      const cur = counts.get(key) || { name: it.mealNameAr, count: 0, revenue: 0 };
      cur.count++;
      cur.revenue += it.priceQAR || 0;
      counts.set(key, cur);
    }

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },
});

// نمو العملاء (آخر 12 شهر)
export const customerGrowth = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const customers = await ctx.db.query("customers").collect();
    const byMonth = new Map<string, number>();

    for (const c of customers) {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, (byMonth.get(key) || 0) + 1);
    }

    const result: Array<{ month: string; count: number; cumulative: number }> = [];
    let cumulative = 0;
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const count = byMonth.get(key) || 0;
      cumulative += count;
      result.push({ month: key.slice(2), count, cumulative });
    }
    return result;
  },
});

// أداء المطبخ (الخطط لكل حالة)
export const kitchenPerformance = query({
  args: { days: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { days = 7, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const plans = await ctx.db.query("dailyPlans").collect();
    const recent = plans.filter((p) => (p.createdAt || 0) > cutoff);

    const byDate = new Map<string, { confirmed: number; prepared: number; delivered: number; cancelled: number }>();
    for (const p of recent) {
      const cur = byDate.get(p.date) || { confirmed: 0, prepared: 0, delivered: 0, cancelled: 0 };
      const status = String(p.status || "").toUpperCase();
      if (status === "CONFIRMED") cur.confirmed++;
      else if (status === "PREPARED") cur.prepared++;
      else if (status === "DELIVERED") cur.delivered++;
      else if (status === "CANCELLED") cur.cancelled++;
      byDate.set(p.date, cur);
    }

    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date: date.slice(5), ...data }));
  },
});

// ✅ إيراد منصّات الأونلاين لهذا الشهر (طلبات/سنونو/رفيق…) — لكل منصّة عدد+وجبات+إيراد
export const onlinePlatforms = query({
  args: { month: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const month = args.month || new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 7);
    const rows = await ctx.db
      .query("onlineOrders")
      .withIndex("by_month", (q) => q.eq("month", month))
      .collect();
    const map: Record<string, { platform: string; orders: number; meals: number; revenue: number }> = {};
    for (const r of rows) {
      const k = r.platform;
      (map[k] ||= { platform: k, orders: 0, meals: 0, revenue: 0 });
      map[k].orders++; map[k].meals += r.mealsCount || 0; map[k].revenue += r.amount || 0;
    }
    const platforms = Object.values(map).sort((a, b) => b.revenue - a.revenue);
    return {
      month,
      platforms,
      totals: {
        orders: platforms.reduce((s, p) => s + p.orders, 0),
        meals: platforms.reduce((s, p) => s + p.meals, 0),
        revenue: platforms.reduce((s, p) => s + p.revenue, 0),
      },
    };
  },
});

// ✅ أداء السائقين آخر N يوم — عدد التوصيلات ومتوسط زمن التوصيل
export const driverStats = query({
  args: { days: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const days = args.days || 7;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const plans = await ctx.db.query("dailyPlans").collect();
    const drivers = await ctx.db.query("users").collect();
    const nameOf = new Map(drivers.map((u: any) => [String(u._id), u.name || u.username || "?"]));

    const map: Record<string, { driver: string; delivered: number; totalMin: number; timed: number }> = {};
    for (const p of plans as any[]) {
      if (!p.driverId || !p.deliveredAt || p.deliveredAt < cutoff) continue;
      const k = String(p.driverId);
      (map[k] ||= { driver: nameOf.get(k) || "?", delivered: 0, totalMin: 0, timed: 0 });
      map[k].delivered++;
      if (p.outForDeliveryAt && p.deliveredAt > p.outForDeliveryAt) {
        map[k].totalMin += (p.deliveredAt - p.outForDeliveryAt) / 60000;
        map[k].timed++;
      }
    }
    return Object.values(map)
      .map((d) => ({ driver: d.driver, delivered: d.delivered, avgMinutes: d.timed ? Math.round(d.totalMin / d.timed) : null }))
      .sort((a, b) => b.delivered - a.delivered);
  },
});
