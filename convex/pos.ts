/**
 * @file convex/pos.ts
 * @description POS للكاشير — PIN login, sales, tickets, receipts, shifts.
 * @frontend client/src/pages/pos/*
 */
import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { hashPassword, verifyPassword } from "./passwords";

/* ═══════════════════════════════ Auth (PIN) ═══════════════════════════════ */

async function requireCashier(ctx: QueryCtx | MutationCtx, token?: string | null) {
  if (!token) throw new Error("POS session required");
  const session = await ctx.db
    .query("posSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session) throw new Error("Invalid POS session");
  if (session.expiresAt < Date.now()) throw new Error("POS session expired");
  const user: any = await ctx.db.get(session.cashierId);
  if (!user || !user.isActive) throw new Error("Cashier not active");
  return { session, user };
}

function newToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "pos_";
  for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** الدخول بـPIN. يقبل CASHIER أو ADMIN. */
export const loginWithPin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const clean = pin.trim();
    if (!/^\d{4,6}$/.test(clean)) throw new Error("PIN لازم يكون 4-6 أرقام");
    // البحث بين كل الحسابات النشطة اللي عندهم PIN
    const users = await ctx.db.query("users").collect();
    let match: any = null;
    for (const u of users) {
      if (!u.isActive) continue;
      if (!u.pinHash) continue;
      if (u.role !== "CASHIER" && u.role !== "ADMIN") continue;
      if (await verifyPassword(clean, u.pinHash)) { match = u; break; }
    }
    if (!match) throw new Error("PIN غير صحيح");
    const token = newToken();
    await ctx.db.insert("posSessions", {
      token,
      cashierId: match._id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
    return {
      token,
      cashier: { id: String(match._id), name: match.name, role: match.role },
    };
  },
});

/** بيانات الكاشير الحالي. */
export const me = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    try {
      const { user } = await requireCashier(ctx, token);
      return { id: String(user._id), name: user.name, role: user.role };
    } catch { return null; }
  },
});

/** الخروج. */
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await ctx.db.query("posSessions").withIndex("by_token", (q) => q.eq("token", token)).first();
    if (s) await ctx.db.delete(s._id);
    return { ok: true };
  },
});

/* ═══════════════════════════════ Categories & Items ═══════════════════════════════ */

/** فئات POS النشطة. */
export const listCategories = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (token) await requireCashier(ctx, token);
    const cats = await ctx.db.query("posCategories").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    return cats.sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({
      id: String(c._id),
      name: c.name,
      color: c.color,
      icon: c.icon,
    }));
  },
});

/** الأصناف مع بيانات POS + فئتها الفعلية (posCategoryId أو fallback). */
export const listItems = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (token) await requireCashier(ctx, token);
    const meals = await ctx.db.query("publicMeals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    const metas = await ctx.db.query("posItems").collect();
    const metaByMeal = new Map(metas.map((m: any) => [String(m.mealId), m]));
    return meals
      .map((m: any) => {
        const meta = metaByMeal.get(String(m._id));
        const price = meta?.posPrice != null ? meta.posPrice : (Number(m.priceQAR) || 0);
        return {
          id: String(m._id),
          name: meta?.displayName || m.nameEn || m.nameAr || "—",
          nameAr: m.nameAr || "",
          nameEn: m.nameEn || "",
          menuCategory: m.category || "other",
          posCategoryId: meta?.posCategoryId ? String(meta.posCategoryId) : null,
          color: meta?.color || null,
          price,
          isHidden: !!meta?.isHidden,
          sortOrder: meta?.sortOrder ?? m.sortOrder ?? 0,
        };
      })
      .filter((m) => !m.isHidden)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  },
});

/* ═══════════════════════════════ Shift ═══════════════════════════════ */

/** الوردية المفتوحة الحالية للكاشير (لو موجودة). */
export const currentShift = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { user } = await requireCashier(ctx, token);
    const s = await ctx.db
      .query("posShifts")
      .withIndex("by_cashier", (q) => q.eq("cashierId", user._id))
      .filter((q) => q.eq(q.field("status"), "OPEN"))
      .first();
    if (!s) return null;
    return {
      id: String(s._id),
      openedAt: s.openedAt,
      openingCash: s.openingCash,
      totalSales: s.totalSales,
      ticketsCount: s.ticketsCount,
    };
  },
});

export const openShift = mutation({
  args: { token: v.string(), openingCash: v.number() },
  handler: async (ctx, { token, openingCash }) => {
    const { user } = await requireCashier(ctx, token);
    const existing = await ctx.db
      .query("posShifts")
      .withIndex("by_cashier", (q) => q.eq("cashierId", user._id))
      .filter((q) => q.eq(q.field("status"), "OPEN"))
      .first();
    if (existing) return { id: String(existing._id), already: true };
    const id = await ctx.db.insert("posShifts", {
      cashierId: user._id,
      cashierName: user.name,
      openedAt: Date.now(),
      openingCash: Math.max(0, openingCash),
      totalSales: 0,
      ticketsCount: 0,
      status: "OPEN",
    });
    return { id: String(id), already: false };
  },
});

export const closeShift = mutation({
  args: { token: v.string(), closingCash: v.number(), notes: v.optional(v.string()) },
  handler: async (ctx, { token, closingCash, notes }) => {
    const { user } = await requireCashier(ctx, token);
    const shift = await ctx.db
      .query("posShifts")
      .withIndex("by_cashier", (q) => q.eq("cashierId", user._id))
      .filter((q) => q.eq(q.field("status"), "OPEN"))
      .first();
    if (!shift) throw new Error("مفيش وردية مفتوحة");
    // حساب الكاش المتوقع = افتتاحية + كل المدفوعات كاش في الوردية
    const tickets = await ctx.db
      .query("posTickets")
      .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
      .collect();
    const cashSales = tickets
      .filter((t) => t.status === "PAID" && t.paymentMethod === "cash")
      .reduce((s, t) => s + t.total, 0);
    const expectedCash = Math.round((shift.openingCash + cashSales) * 100) / 100;
    const diff = Math.round((closingCash - expectedCash) * 100) / 100;
    await ctx.db.patch(shift._id, {
      status: "CLOSED",
      closedAt: Date.now(),
      closingCash: Math.max(0, closingCash),
      expectedCash,
      cashDiff: diff,
      notes: notes?.trim() || undefined,
    });
    return { expectedCash, cashDiff: diff };
  },
});

/* ═══════════════════════════════ Tickets ═══════════════════════════════ */

async function nextTicketNumber(ctx: MutationCtx): Promise<number> {
  const row = await ctx.db.query("posCounters").withIndex("by_key", (q) => q.eq("key", "ticket_number")).first();
  if (!row) { await ctx.db.insert("posCounters", { key: "ticket_number", value: 1 }); return 1; }
  const next = row.value + 1;
  await ctx.db.patch(row._id, { value: next });
  return next;
}

type LineInput = { mealId?: string; name: string; qty: number; unitPrice: number; notes?: string };

async function computeTotals(lines: LineInput[], discount = 0) {
  let subtotal = 0;
  for (const l of lines) { subtotal += l.qty * l.unitPrice; }
  subtotal = Math.round(subtotal * 100) / 100;
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  return { subtotal, discount: Math.round(discount * 100) / 100, tax: 0, total };
}

/** إنشاء فاتورة جديدة (بحالة OPEN — معلّقة، مش مدفوعة بعد). */
export const createTicket = mutation({
  args: {
    token: v.string(),
    lines: v.array(v.object({
      mealId: v.optional(v.id("publicMeals")),
      name: v.string(),
      qty: v.number(),
      unitPrice: v.number(),
      notes: v.optional(v.string()),
    })),
    orderType: v.optional(v.string()),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCashier(ctx, args.token);
    const shift = await ctx.db
      .query("posShifts")
      .withIndex("by_cashier", (q) => q.eq("cashierId", user._id))
      .filter((q) => q.eq(q.field("status"), "OPEN"))
      .first();
    if (args.lines.length === 0) throw new Error("لازم تضيف صنف واحد على الأقل");
    const totals = await computeTotals(args.lines as any, 0);
    const num = await nextTicketNumber(ctx);
    const id = await ctx.db.insert("posTickets", {
      ticketNumber: num,
      cashierId: user._id,
      cashierName: user.name,
      shiftId: shift?._id,
      status: "OPEN",
      orderType: args.orderType,
      subtotal: totals.subtotal,
      discount: 0,
      tax: 0,
      total: totals.total,
      customerName: args.customerName?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      createdAt: Date.now(),
    });
    for (const l of args.lines) {
      await ctx.db.insert("posTicketLines", {
        ticketId: id,
        mealId: l.mealId as any,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100,
        notes: l.notes,
      });
    }
    return { id: String(id), ticketNumber: num, total: totals.total };
  },
});

/** الفواتير المفتوحة (parked). */
export const listOpenTickets = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { user } = await requireCashier(ctx, token);
    const rows = await ctx.db.query("posTickets").withIndex("by_status", (q) => q.eq("status", "OPEN")).collect();
    return rows
      .filter((t) => String(t.cashierId) === String(user._id))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({
        id: String(t._id),
        ticketNumber: t.ticketNumber,
        total: t.total,
        customerName: t.customerName || null,
        createdAt: t.createdAt,
      }));
  },
});

/** فاتورة كاملة بأسطرها. */
export const getTicket = query({
  args: { token: v.string(), ticketId: v.id("posTickets") },
  handler: async (ctx, { token, ticketId }) => {
    await requireCashier(ctx, token);
    const t: any = await ctx.db.get(ticketId);
    if (!t) return null;
    const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", ticketId)).collect();
    return {
      id: String(t._id),
      ticketNumber: t.ticketNumber,
      cashierName: t.cashierName,
      status: t.status,
      orderType: t.orderType || null,
      subtotal: t.subtotal,
      discount: t.discount,
      total: t.total,
      paymentMethod: t.paymentMethod || null,
      cashReceived: t.cashReceived || null,
      changeAmount: t.changeAmount || null,
      customerName: t.customerName || null,
      notes: t.notes || null,
      paidAt: t.paidAt || null,
      createdAt: t.createdAt,
      lines: lines.map((l: any) => ({
        id: String(l._id),
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        notes: l.notes || null,
      })),
    };
  },
});

/** تعديل أسطر فاتورة مفتوحة (استبدال كامل). */
export const updateTicketLines = mutation({
  args: {
    token: v.string(),
    ticketId: v.id("posTickets"),
    lines: v.array(v.object({
      mealId: v.optional(v.id("publicMeals")),
      name: v.string(),
      qty: v.number(),
      unitPrice: v.number(),
      notes: v.optional(v.string()),
    })),
    discount: v.optional(v.number()),
    orderType: v.optional(v.string()),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCashier(ctx, args.token);
    const t: any = await ctx.db.get(args.ticketId);
    if (!t || t.status !== "OPEN") throw new Error("الفاتورة غير قابلة للتعديل");
    const old = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId)).collect();
    for (const l of old) await ctx.db.delete(l._id);
    const totals = await computeTotals(args.lines as any, args.discount || 0);
    for (const l of args.lines) {
      await ctx.db.insert("posTicketLines", {
        ticketId: args.ticketId,
        mealId: l.mealId as any,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100,
        notes: l.notes,
      });
    }
    await ctx.db.patch(args.ticketId, {
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      orderType: args.orderType || t.orderType,
      customerName: args.customerName?.trim() || t.customerName,
      notes: args.notes?.trim() || t.notes,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** الدفع — يحول الفاتورة إلى PAID، يخصم من المخزون (لاحقاً)، يحدث ملخص الوردية. */
export const chargeTicket = mutation({
  args: {
    token: v.string(),
    ticketId: v.id("posTickets"),
    paymentMethod: v.string(),   // cash / card / transfer / other
    cashReceived: v.optional(v.number()),
    discount: v.optional(v.number()),
    orderType: v.optional(v.string()),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCashier(ctx, args.token);
    const t: any = await ctx.db.get(args.ticketId);
    if (!t) throw new Error("الفاتورة غير موجودة");
    if (t.status !== "OPEN") throw new Error("الفاتورة مدفوعة بالفعل");
    // ✅ إعادة الحساب مع خصم جديد لو اتغيّر
    const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId)).collect();
    const totals = await computeTotals(lines.map((l: any) => ({ qty: l.qty, unitPrice: l.unitPrice, name: l.name })) as any, args.discount ?? t.discount ?? 0);
    const change = args.paymentMethod === "cash" && args.cashReceived != null
      ? Math.round((args.cashReceived - totals.total) * 100) / 100
      : undefined;
    await ctx.db.patch(args.ticketId, {
      status: "PAID",
      paymentMethod: args.paymentMethod,
      cashReceived: args.cashReceived,
      changeAmount: change,
      discount: totals.discount,
      subtotal: totals.subtotal,
      total: totals.total,
      orderType: args.orderType || t.orderType,
      customerName: args.customerName?.trim() || t.customerName,
      notes: args.notes?.trim() || t.notes,
      paidAt: Date.now(),
      updatedAt: Date.now(),
    });
    // تحديث ملخص الوردية
    if (t.shiftId) {
      const shift: any = await ctx.db.get(t.shiftId);
      if (shift && shift.status === "OPEN") {
        await ctx.db.patch(t.shiftId, {
          totalSales: Math.round((shift.totalSales + totals.total) * 100) / 100,
          ticketsCount: shift.ticketsCount + 1,
        });
      }
    }
    return { ok: true, total: totals.total, change };
  },
});

/** بيع سريع: إنشاء + دفع في خطوة واحدة (المسار الشائع في POS). */
export const quickSale = mutation({
  args: {
    token: v.string(),
    lines: v.array(v.object({
      mealId: v.optional(v.id("publicMeals")),
      name: v.string(),
      qty: v.number(),
      unitPrice: v.number(),
      notes: v.optional(v.string()),
    })),
    paymentMethod: v.string(),
    cashReceived: v.optional(v.number()),
    discount: v.optional(v.number()),
    orderType: v.optional(v.string()),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCashier(ctx, args.token);
    if (args.lines.length === 0) throw new Error("لازم تضيف صنف واحد على الأقل");
    const shift = await ctx.db
      .query("posShifts")
      .withIndex("by_cashier", (q) => q.eq("cashierId", user._id))
      .filter((q) => q.eq(q.field("status"), "OPEN"))
      .first();
    const totals = await computeTotals(args.lines as any, args.discount || 0);
    const change = args.paymentMethod === "cash" && args.cashReceived != null
      ? Math.round((args.cashReceived - totals.total) * 100) / 100
      : undefined;
    const num = await nextTicketNumber(ctx);
    const id = await ctx.db.insert("posTickets", {
      ticketNumber: num,
      cashierId: user._id,
      cashierName: user.name,
      shiftId: shift?._id,
      status: "PAID",
      orderType: args.orderType,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: 0,
      total: totals.total,
      paymentMethod: args.paymentMethod,
      cashReceived: args.cashReceived,
      changeAmount: change,
      customerName: args.customerName?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      paidAt: Date.now(),
      createdAt: Date.now(),
    });
    for (const l of args.lines) {
      await ctx.db.insert("posTicketLines", {
        ticketId: id,
        mealId: l.mealId as any,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100,
        notes: l.notes,
      });
    }
    if (shift) {
      await ctx.db.patch(shift._id, {
        totalSales: Math.round((shift.totalSales + totals.total) * 100) / 100,
        ticketsCount: shift.ticketsCount + 1,
      });
    }
    return { id: String(id), ticketNumber: num, total: totals.total, change };
  },
});

/** حذف فاتورة معلّقة. */
export const voidTicket = mutation({
  args: { token: v.string(), ticketId: v.id("posTickets") },
  handler: async (ctx, { token, ticketId }) => {
    await requireCashier(ctx, token);
    const t: any = await ctx.db.get(ticketId);
    if (!t) return { ok: true };
    if (t.status === "OPEN") {
      const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", ticketId)).collect();
      for (const l of lines) await ctx.db.delete(l._id);
      await ctx.db.delete(ticketId);
    } else {
      await ctx.db.patch(ticketId, { status: "VOID", updatedAt: Date.now() });
    }
    return { ok: true };
  },
});

/** فواتير اليوم للكاشير (Receipts screen). */
export const myTodayReceipts = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { user } = await requireCashier(ctx, token);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const rows = await ctx.db
      .query("posTickets")
      .withIndex("by_cashier", (q) => q.eq("cashierId", user._id))
      .filter((q) => q.gte(q.field("createdAt"), start.getTime()))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.map((t) => ({
      id: String(t._id),
      ticketNumber: t.ticketNumber,
      total: t.total,
      status: t.status,
      paymentMethod: t.paymentMethod || null,
      customerName: t.customerName || null,
      paidAt: t.paidAt || null,
      createdAt: t.createdAt,
    }));
  },
});
