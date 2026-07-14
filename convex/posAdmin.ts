/**
 * @file convex/posAdmin.ts
 * @description إدارة POS (للأدمن): الكاشيرون، فئات POS، ألوان الأصناف، التقارير، الورديات.
 * @frontend client/src/pages/PosAdmin.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";
import { hashPassword, verifyPassword } from "./passwords";

/* ═══════════════════════════════ الكاشيرون ═══════════════════════════════ */

export const listCashiers = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u: any) => u.role === "CASHIER")
      .map((u: any) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        isActive: u.isActive,
        hasPin: !!u.pinHash,
      }));
  },
});

export const createCashier = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    pin: v.string(),                   // 4-6 أرقام
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const clean = args.pin.trim();
    if (!/^\d{4,6}$/.test(clean)) throw new Error("PIN لازم يكون 4-6 أرقام");
    const emailLower = args.email.trim().toLowerCase();
    const existing = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", emailLower)).first();
    if (existing) throw new Error("الإيميل مستخدم بالفعل");
    // نشوف كمان PIN مش متكرر (عشان الدخول لا يلتبس)
    const allUsers = await ctx.db.query("users").collect();
    
    for (const u of allUsers) {
      if (u.pinHash && (u.role === "CASHIER" || u.role === "ADMIN")) {
        if (await verifyPassword(clean, u.pinHash)) throw new Error("الـPIN ده مستخدم بالفعل — اختار غيره");
      }
    }
    const pinHash = await hashPassword(clean);
    // نضع باسورد عشوائي (الكاشير هيدخل بـPIN بس)
    const passwordHash = await hashPassword(Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    const id = await ctx.db.insert("users", {
      email: emailLower,
      passwordHash,
      name: args.name.trim(),
      phone: args.phone?.trim() || undefined,
      role: "CASHIER",
      pinHash,
      isActive: true,
      createdAt: Date.now(),
    });
    return { id: String(id) };
  },
});

export const updateCashier = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    pin: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const u: any = await ctx.db.get(args.id);
    if (!u) throw new Error("الكاشير غير موجود");
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.pin !== undefined) {
      const clean = args.pin.trim();
      if (!/^\d{4,6}$/.test(clean)) throw new Error("PIN لازم يكون 4-6 أرقام");
      
      const allUsers = await ctx.db.query("users").collect();
      for (const other of allUsers) {
        if (String(other._id) === String(args.id)) continue;
        if (other.pinHash && (other.role === "CASHIER" || other.role === "ADMIN")) {
          if (await verifyPassword(clean, other.pinHash)) throw new Error("الـPIN ده مستخدم بالفعل");
        }
      }
      patch.pinHash = await hashPassword(clean);
    }
    await ctx.db.patch(args.id, patch);
    return { ok: true };
  },
});

/** تعيين PIN لحساب موجود (زي ADMIN). */
export const setUserPin = mutation({
  args: { userId: v.id("users"), pin: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const clean = args.pin.trim();
    if (!/^\d{4,6}$/.test(clean)) throw new Error("PIN لازم يكون 4-6 أرقام");
    
    const allUsers = await ctx.db.query("users").collect();
    for (const other of allUsers) {
      if (String(other._id) === String(args.userId)) continue;
      if (other.pinHash && (other.role === "CASHIER" || other.role === "ADMIN")) {
        if (await verifyPassword(clean, other.pinHash)) throw new Error("الـPIN ده مستخدم بالفعل");
      }
    }
    await ctx.db.patch(args.userId, { pinHash: await hashPassword(clean), updatedAt: Date.now() } as any);
    return { ok: true };
  },
});

/* ═══════════════════════════════ فئات POS ═══════════════════════════════ */

export const listCategories = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db.query("posCategories").collect();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({
      id: String(c._id), name: c.name, color: c.color, icon: c.icon || null, sortOrder: c.sortOrder, isActive: c.isActive,
    }));
  },
});

export const createCategory = mutation({
  args: { name: v.string(), color: v.string(), icon: v.optional(v.string()), sortOrder: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db.query("posCategories").collect();
    const sortOrder = args.sortOrder ?? (existing.length ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 1);
    const id = await ctx.db.insert("posCategories", {
      name: args.name.trim(),
      color: args.color,
      icon: args.icon,
      sortOrder,
      isActive: true,
      createdAt: Date.now(),
    });
    return { id: String(id) };
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("posCategories"),
    name: v.optional(v.string()), color: v.optional(v.string()), icon: v.optional(v.string()),
    sortOrder: v.optional(v.number()), isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.color !== undefined) patch.color = args.color;
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(args.id, patch);
    return { ok: true };
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("posCategories"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    // إزالة أي posCategoryId للأصناف المرتبطة (بدلاً من حذفها)
    const items = await ctx.db.query("posItems").withIndex("by_pos_category", (q) => q.eq("posCategoryId", args.id)).collect();
    for (const it of items) await ctx.db.patch(it._id, { posCategoryId: undefined } as any);
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

/* ═══════════════════════════════ بيانات عرض الأصناف ═══════════════════════════════ */

/** كل الأصناف مع الـmeta الحالية (للأدمن يظبطهم). */
export const listItemsForAdmin = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const meals = await ctx.db.query("publicMeals").collect();
    const metas = await ctx.db.query("posItems").collect();
    const metaByMeal = new Map(metas.map((m: any) => [String(m.mealId), m]));
    return meals.map((m: any) => {
      const meta = metaByMeal.get(String(m._id));
      return {
        id: String(m._id),
        nameEn: m.nameEn || "",
        nameAr: m.nameAr || "",
        menuCategory: m.category || "other",
        menuPrice: Number(m.priceQAR) || 0,
        isActive: m.isActive,
        // meta
        metaId: meta ? String(meta._id) : null,
        displayName: meta?.displayName || null,
        color: meta?.color || null,
        posCategoryId: meta?.posCategoryId ? String(meta.posCategoryId) : null,
        sortOrder: meta?.sortOrder ?? null,
        isHidden: !!meta?.isHidden,
        posPrice: meta?.posPrice ?? null,
      };
    });
  },
});

/** حفظ/تحديث meta لصنف. */
export const upsertItemMeta = mutation({
  args: {
    mealId: v.id("publicMeals"),
    displayName: v.optional(v.string()),
    color: v.optional(v.string()),
    posCategoryId: v.optional(v.id("posCategories")),
    sortOrder: v.optional(v.number()),
    isHidden: v.optional(v.boolean()),
    posPrice: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db.query("posItems").withIndex("by_meal", (q) => q.eq("mealId", args.mealId)).first();
    const patch: any = { updatedAt: Date.now() };
    if (args.displayName !== undefined) patch.displayName = args.displayName.trim() || undefined;
    if (args.color !== undefined) patch.color = args.color || undefined;
    if (args.posCategoryId !== undefined) patch.posCategoryId = args.posCategoryId;
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
    if (args.isHidden !== undefined) patch.isHidden = args.isHidden;
    if (args.posPrice !== undefined) patch.posPrice = args.posPrice >= 0 ? args.posPrice : undefined;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { id: String(existing._id) };
    }
    const id = await ctx.db.insert("posItems", { mealId: args.mealId, ...patch } as any);
    return { id: String(id) };
  },
});

/* ═══════════════════════════════ التقارير ═══════════════════════════════ */

/** ملخص اليوم: مبيعات، عدد الفواتير، متوسط الفاتورة، وحسب طريقة الدفع. */
export const dailySummary = query({
  args: { date: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const day = args.date || new Date().toISOString().slice(0, 10);
    const start = new Date(day + "T00:00:00").getTime();
    const end = new Date(day + "T23:59:59.999").getTime();
    const tickets: any[] = await ctx.db.query("posTickets").withIndex("by_paidAt").collect();
    const paidAll = tickets.filter((t) => t.paidAt && t.paidAt >= start && t.paidAt <= end && t.status === "PAID");
    const paid = paidAll.filter((t) => !t.isNonRevenue);
    const staffTix = paidAll.filter((t) => t.isNonRevenue);
    const totalSales = paid.reduce((s, t) => s + t.total, 0);
    const staffValue = staffTix.reduce((s, t) => s + t.total, 0);
    const byMethod: Record<string, { count: number; total: number }> = {};
    for (const t of paid) {
      const m = t.paymentMethod || "other";
      if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
      byMethod[m].count += 1;
      byMethod[m].total = Math.round((byMethod[m].total + t.total) * 100) / 100;
    }
    const byCashier: Record<string, { name: string; count: number; total: number }> = {};
    for (const t of paid) {
      const key = String(t.cashierId);
      if (!byCashier[key]) byCashier[key] = { name: t.cashierName, count: 0, total: 0 };
      byCashier[key].count += 1;
      byCashier[key].total = Math.round((byCashier[key].total + t.total) * 100) / 100;
    }
    return {
      date: day,
      totalSales: Math.round(totalSales * 100) / 100,
      ticketsCount: paid.length,
      avgTicket: paid.length ? Math.round((totalSales / paid.length) * 100) / 100 : 0,
      byMethod: Object.entries(byMethod).map(([k, v]) => ({ method: k, ...v })),
      byCashier: Object.values(byCashier),
      staffMealsCount: staffTix.length,
      staffMealsValue: Math.round(staffValue * 100) / 100,
    };
  },
});

/** أفضل الأصناف مبيعاً في مدى تاريخ. */
export const topItems = query({
  args: { from: v.string(), to: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const start = new Date(args.from + "T00:00:00").getTime();
    const end = new Date(args.to + "T23:59:59.999").getTime();
    const tickets: any[] = await ctx.db.query("posTickets").withIndex("by_paidAt").collect();
    const paid = tickets.filter((t) => t.paidAt && t.paidAt >= start && t.paidAt <= end && t.status === "PAID");
    const paidIds = new Set(paid.map((t) => String(t._id)));
    const allLines = await ctx.db.query("posTicketLines").collect();
    const byItem = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const l of allLines) {
      if (!paidIds.has(String(l.ticketId))) continue;
      const key = l.mealId ? String(l.mealId) : `text:${l.name}`;
      const row = byItem.get(key) || { name: l.name, qty: 0, revenue: 0 };
      row.qty += l.qty;
      row.revenue = Math.round((row.revenue + l.lineTotal) * 100) / 100;
      byItem.set(key, row);
    }
    return Array.from(byItem.values()).sort((a, b) => b.qty - a.qty);
  },
});

/** قائمة الفواتير المدفوعة (للسجل الشامل). */
export const listReceipts = query({
  args: { from: v.string(), to: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const start = new Date(args.from + "T00:00:00").getTime();
    const end = new Date(args.to + "T23:59:59.999").getTime();
    const rows: any[] = await ctx.db.query("posTickets").withIndex("by_paidAt").collect();
    const filtered = rows
      .filter((t) => t.paidAt && t.paidAt >= start && t.paidAt <= end)
      .sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
    return filtered.map((t) => ({
      id: String(t._id),
      ticketNumber: t.ticketNumber,
      cashierName: t.cashierName,
      status: t.status,
      total: t.total,
      paymentMethod: t.paymentMethod || null,
      customerName: t.customerName || null,
      paidAt: t.paidAt,
    }));
  },
});

/** فاتورة كاملة (للأدمن). */
export const getTicket = query({
  args: { ticketId: v.id("posTickets"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const t: any = await ctx.db.get(args.ticketId);
    if (!t) return null;
    const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId)).collect();
    return {
      id: String(t._id),
      ticketNumber: t.ticketNumber,
      cashierName: t.cashierName,
      status: t.status,
      subtotal: t.subtotal, discount: t.discount, total: t.total,
      paymentMethod: t.paymentMethod || null,
      cashReceived: t.cashReceived || null, changeAmount: t.changeAmount || null,
      customerName: t.customerName || null, notes: t.notes || null,
      paidAt: t.paidAt || null, createdAt: t.createdAt,
      lines: lines.map((l: any) => ({
        name: l.name, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal, notes: l.notes || null,
      })),
    };
  },
});

/** إلغاء فاتورة مدفوعة (Refund). */
export const refundTicket = mutation({
  args: { ticketId: v.id("posTickets"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const t: any = await ctx.db.get(args.ticketId);
    if (!t) throw new Error("مش موجودة");
    if (t.status === "REFUNDED" || t.status === "VOID") return { ok: true };
    await ctx.db.patch(args.ticketId, { status: "REFUNDED", updatedAt: Date.now() });
    if (t.shiftId) {
      const shift: any = await ctx.db.get(t.shiftId);
      if (shift && shift.status === "OPEN") {
        await ctx.db.patch(t.shiftId, {
          totalSales: Math.round((shift.totalSales - t.total) * 100) / 100,
          ticketsCount: Math.max(0, shift.ticketsCount - 1),
        });
      }
    }
    return { ok: true };
  },
});

/** الورديات (سجل). */
export const listShifts = query({
  args: { from: v.optional(v.string()), to: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const start = args.from ? new Date(args.from + "T00:00:00").getTime() : 0;
    const end = args.to ? new Date(args.to + "T23:59:59.999").getTime() : Date.now();
    const rows = await ctx.db.query("posShifts").collect();
    return rows
      .filter((s) => s.openedAt >= start && s.openedAt <= end)
      .sort((a, b) => b.openedAt - a.openedAt)
      .map((s) => ({
        id: String(s._id),
        cashierName: s.cashierName,
        status: s.status,
        openedAt: s.openedAt,
        closedAt: s.closedAt || null,
        openingCash: s.openingCash,
        closingCash: s.closingCash || null,
        expectedCash: s.expectedCash || null,
        cashDiff: s.cashDiff || null,
        totalSales: s.totalSales,
        ticketsCount: s.ticketsCount,
      }));
  },
});
