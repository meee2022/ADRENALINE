/**
 * @file convex/gymSales.ts
 * @description مبيعات الجم — POS تفصيلي (طلبيات + أسطر) + تقارير + إدارة الجمات + سعر الجم لكل وجبة.
 * @frontend client/src/pages/GymSales.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";

/* ═══════════════════════════════ إدارة الجمات ═══════════════════════════════ */

/** قائمة الجمات (النشطة أولاً). */
export const listGyms = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db.query("gymAccounts").collect();
    rows.sort((a, b) => (a.isActive === b.isActive ? a.name.localeCompare(b.name) : a.isActive ? -1 : 1));
    return rows.map((g) => ({
      id: String(g._id),
      name: g.name,
      address: g.address || "",
      contactName: g.contactName || "",
      contactPhone: g.contactPhone || "",
      discountPct: g.discountPct,
      notes: g.notes || "",
      isActive: g.isActive,
    }));
  },
});

/** إضافة جم جديد. */
export const addGym = mutation({
  args: {
    name: v.string(),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    discountPct: v.optional(v.number()),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const name = args.name.trim();
    if (!name) throw new Error("اسم الجم مطلوب");
    const id = await ctx.db.insert("gymAccounts", {
      name,
      address: args.address?.trim() || undefined,
      contactName: args.contactName?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      discountPct: Math.min(100, Math.max(0, Number(args.discountPct ?? 20))),
      notes: args.notes?.trim() || undefined,
      isActive: true,
      createdAt: Date.now(),
    });
    return { id: String(id) };
  },
});

/** تعديل جم. */
export const updateGym = mutation({
  args: {
    id: v.id("gymAccounts"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    discountPct: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.address !== undefined) patch.address = args.address.trim() || undefined;
    if (args.contactName !== undefined) patch.contactName = args.contactName.trim() || undefined;
    if (args.contactPhone !== undefined) patch.contactPhone = args.contactPhone.trim() || undefined;
    if (args.discountPct !== undefined) patch.discountPct = Math.min(100, Math.max(0, args.discountPct));
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(args.id, patch);
    return { success: true };
  },
});

/* ═══════════════════════════════ سعر الجم للوجبات ═══════════════════════════════ */

/** تحديث سعر الجم المؤقّت لوجبة. أرسل null/undefined لمسح السعر (يرجع للحساب من الخصم). */
export const setMealGymPrice = mutation({
  args: {
    mealId: v.id("publicMeals"),
    gymPrice: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    await ctx.db.patch(args.mealId, {
      gymPrice: args.gymPrice != null && args.gymPrice >= 0 ? args.gymPrice : undefined,
    } as any);
    return { success: true };
  },
});

/** قائمة الوجبات مع السعر النافذ للجم (يحسب gymPrice أو priceQAR×(1-discount)). */
export const listMealsForGym = query({
  args: { gymId: v.optional(v.id("gymAccounts")), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    let discount = 20;
    if (args.gymId) {
      const g: any = await ctx.db.get(args.gymId);
      if (g) discount = g.discountPct;
    }
    const meals = await ctx.db.query("publicMeals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    return meals
      .map((m: any) => {
        const listPrice = Number(m.priceQAR) || 0;
        const hasCustom = m.gymPrice != null && m.gymPrice >= 0;
        const effectivePrice = hasCustom ? Number(m.gymPrice) : Math.round(listPrice * (1 - discount / 100) * 100) / 100;
        return {
          id: String(m._id),
          nameEn: m.nameEn || m.nameAr || "",
          nameAr: m.nameAr || m.nameEn || "",
          category: m.category || "other",
          listPrice,
          gymPrice: hasCustom ? Number(m.gymPrice) : null,
          effectivePrice,
          isCustom: hasCustom,
          sortOrder: m.sortOrder ?? 0,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));
  },
});

/* ═══════════════════════════════ الطلبيات (Orders) ═══════════════════════════════ */

/** تفاصيل طلبية واحدة مع أسطرها والجم. */
export const getOrder = query({
  args: { orderId: v.id("gymOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const order: any = await ctx.db.get(args.orderId);
    if (!order) return null;
    const gym: any = await ctx.db.get(order.gymId);
    const lines = await ctx.db
      .query("gymOrderLines")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    return {
      id: String(order._id),
      date: order.date,
      gymId: String(order.gymId),
      gymName: gym?.name || "",
      discountPct: order.discountPct,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      total: order.total,
      mealsCount: order.mealsCount,
      notes: order.notes || "",
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      lines: lines.map((l: any) => ({
        id: String(l._id),
        mealId: l.mealId ? String(l.mealId) : null,
        mealNameEn: l.mealNameEn || "",
        mealNameAr: l.mealNameAr || "",
        qty: l.qty,
        listPrice: l.listPrice,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
    };
  },
});

/** قائمة الطلبيات ضمن مدى تواريخ (كل الجمات أو جم واحد). */
export const listOrders = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    gymId: v.optional(v.id("gymAccounts")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    let rows: any[] = await ctx.db.query("gymOrders").withIndex("by_date").collect();
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    if (args.gymId) rows = rows.filter((r) => String(r.gymId) === String(args.gymId));
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    const gymNames = new Map<string, string>();
    const out = [];
    for (const r of rows) {
      const key = String(r.gymId);
      if (!gymNames.has(key)) {
        const g: any = await ctx.db.get(r.gymId);
        gymNames.set(key, g?.name || "");
      }
      out.push({
        id: String(r._id),
        date: r.date,
        gymId: key,
        gymName: gymNames.get(key) || "",
        subtotal: r.subtotal,
        discountAmount: r.discountAmount,
        total: r.total,
        mealsCount: r.mealsCount,
      });
    }
    return {
      rows: out,
      totalMeals: out.reduce((s, r) => s + r.mealsCount, 0),
      totalRevenue: Math.round(out.reduce((s, r) => s + r.total, 0) * 100) / 100,
      count: out.length,
    };
  },
});

/** إنشاء طلبية جديدة بأسطرها. */
export const createOrder = mutation({
  args: {
    date: v.string(),
    gymId: v.id("gymAccounts"),
    lines: v.array(v.object({
      mealId: v.optional(v.id("publicMeals")),
      mealNameEn: v.optional(v.string()),
      mealNameAr: v.optional(v.string()),
      qty: v.number(),
      listPrice: v.number(),
      unitPrice: v.number(),
    })),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sess: any = await requireStaff(ctx, args.sessionToken);
    const who = sess?.user?.name || undefined;
    const gym: any = await ctx.db.get(args.gymId);
    if (!gym) throw new Error("الجم غير موجود");
    if (!args.lines.length) throw new Error("لازم تضيف وجبة واحدة على الأقل");

    let subtotal = 0, total = 0, mealsCount = 0;
    for (const l of args.lines) {
      const q = Math.max(0, Math.round(l.qty || 0));
      if (q === 0) continue;
      subtotal += (l.listPrice || 0) * q;
      total += (l.unitPrice || 0) * q;
      mealsCount += q;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    total = Math.round(total * 100) / 100;
    const discountAmount = Math.round((subtotal - total) * 100) / 100;

    const orderId = await ctx.db.insert("gymOrders", {
      date: args.date,
      gymId: args.gymId,
      discountPct: gym.discountPct,
      subtotal,
      discountAmount,
      total,
      mealsCount,
      notes: args.notes?.trim() || undefined,
      createdBy: who,
      createdAt: Date.now(),
    });

    for (const l of args.lines) {
      const q = Math.max(0, Math.round(l.qty || 0));
      if (q === 0) continue;
      await ctx.db.insert("gymOrderLines", {
        orderId,
        date: args.date,
        gymId: args.gymId,
        mealId: l.mealId,
        mealNameEn: l.mealNameEn?.trim() || undefined,
        mealNameAr: l.mealNameAr?.trim() || undefined,
        qty: q,
        listPrice: l.listPrice,
        unitPrice: l.unitPrice,
        lineTotal: Math.round(q * l.unitPrice * 100) / 100,
      });
    }

    return { id: String(orderId), subtotal, discountAmount, total, mealsCount };
  },
});

/** تعديل طلبية (يستبدل كل الأسطر). */
export const updateOrder = mutation({
  args: {
    orderId: v.id("gymOrders"),
    date: v.string(),
    gymId: v.id("gymAccounts"),
    lines: v.array(v.object({
      mealId: v.optional(v.id("publicMeals")),
      mealNameEn: v.optional(v.string()),
      mealNameAr: v.optional(v.string()),
      qty: v.number(),
      listPrice: v.number(),
      unitPrice: v.number(),
    })),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const gym: any = await ctx.db.get(args.gymId);
    if (!gym) throw new Error("الجم غير موجود");
    // امسح الأسطر القديمة
    const oldLines = await ctx.db.query("gymOrderLines").withIndex("by_order", (q) => q.eq("orderId", args.orderId)).collect();
    for (const l of oldLines) await ctx.db.delete(l._id);

    let subtotal = 0, total = 0, mealsCount = 0;
    for (const l of args.lines) {
      const q = Math.max(0, Math.round(l.qty || 0));
      if (q === 0) continue;
      subtotal += (l.listPrice || 0) * q;
      total += (l.unitPrice || 0) * q;
      mealsCount += q;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    total = Math.round(total * 100) / 100;
    const discountAmount = Math.round((subtotal - total) * 100) / 100;

    await ctx.db.patch(args.orderId, {
      date: args.date,
      gymId: args.gymId,
      discountPct: gym.discountPct,
      subtotal,
      discountAmount,
      total,
      mealsCount,
      notes: args.notes?.trim() || undefined,
      updatedAt: Date.now(),
    });

    for (const l of args.lines) {
      const q = Math.max(0, Math.round(l.qty || 0));
      if (q === 0) continue;
      await ctx.db.insert("gymOrderLines", {
        orderId: args.orderId,
        date: args.date,
        gymId: args.gymId,
        mealId: l.mealId,
        mealNameEn: l.mealNameEn?.trim() || undefined,
        mealNameAr: l.mealNameAr?.trim() || undefined,
        qty: q,
        listPrice: l.listPrice,
        unitPrice: l.unitPrice,
        lineTotal: Math.round(q * l.unitPrice * 100) / 100,
      });
    }

    return { success: true, subtotal, discountAmount, total, mealsCount };
  },
});

/** حذف طلبية بكل أسطرها. */
export const deleteOrder = mutation({
  args: { orderId: v.id("gymOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const lines = await ctx.db.query("gymOrderLines").withIndex("by_order", (q) => q.eq("orderId", args.orderId)).collect();
    for (const l of lines) await ctx.db.delete(l._id);
    await ctx.db.delete(args.orderId);
    return { success: true };
  },
});

/* ═══════════════════════════════ التقارير ═══════════════════════════════ */

/**
 * تقرير شهر لجم واحد: الإجمالي + التفصيل اليومي + تفصيل حسب الوجبة.
 * month: yyyy-MM
 */
export const monthlyReport = query({
  args: {
    month: v.string(),
    gymId: v.optional(v.id("gymAccounts")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const from = `${args.month}-01`;
    const to = `${args.month}-31`;
    let orders: any[] = await ctx.db.query("gymOrders").withIndex("by_date").collect();
    orders = orders.filter((o) => o.date >= from && o.date <= to);
    if (args.gymId) orders = orders.filter((o) => String(o.gymId) === String(args.gymId));

    const byDay = new Map<string, { date: string; meals: number; total: number }>();
    for (const o of orders) {
      const d = byDay.get(o.date) || { date: o.date, meals: 0, total: 0 };
      d.meals += o.mealsCount;
      d.total = Math.round((d.total + o.total) * 100) / 100;
      byDay.set(o.date, d);
    }
    const days = Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

    // per-meal breakdown
    const orderIds = new Set(orders.map((o) => String(o._id)));
    let allLines: any[] = await ctx.db.query("gymOrderLines").withIndex("by_date").collect();
    allLines = allLines.filter((l) => l.date >= from && l.date <= to && orderIds.has(String(l.orderId)));
    const byMeal = new Map<string, { key: string; nameEn: string; nameAr: string; qty: number; revenue: number }>();
    for (const l of allLines) {
      const key = l.mealId ? String(l.mealId) : `text:${l.mealNameEn || l.mealNameAr}`;
      const row = byMeal.get(key) || { key, nameEn: l.mealNameEn || "", nameAr: l.mealNameAr || "", qty: 0, revenue: 0 };
      row.qty += l.qty;
      row.revenue = Math.round((row.revenue + l.lineTotal) * 100) / 100;
      byMeal.set(key, row);
    }
    const meals = Array.from(byMeal.values()).sort((a, b) => b.qty - a.qty);

    const totalMeals = orders.reduce((s, o) => s + o.mealsCount, 0);
    const totalRevenue = Math.round(orders.reduce((s, o) => s + o.total, 0) * 100) / 100;
    const totalSubtotal = Math.round(orders.reduce((s, o) => s + o.subtotal, 0) * 100) / 100;
    const totalDiscount = Math.round(orders.reduce((s, o) => s + o.discountAmount, 0) * 100) / 100;

    return {
      month: args.month,
      totalMeals,
      totalRevenue,
      totalSubtotal,
      totalDiscount,
      daysCount: days.length,
      avgPerDay: days.length ? Math.round((totalRevenue / days.length) * 100) / 100 : 0,
      bestDay: days.length ? days.reduce((a, b) => (b.total > a.total ? b : a)) : null,
      worstDay: days.length ? days.reduce((a, b) => (b.total < a.total ? b : a)) : null,
      days,
      meals,
      orders: orders.map((o: any) => ({ id: String(o._id), date: o.date, total: o.total, mealsCount: o.mealsCount })),
    };
  },
});
