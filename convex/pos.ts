/**
 * @file convex/pos.ts
 * @description POS للكاشير — مؤمّن ضد التلاعب:
 *   - الأسعار والأسماء تُجلب من publicMeals/posItems على الخادم — الكاشير مش بيقدر يحدد سعر
 *   - أصناف مخصّصة (custom بدون mealId) → ADMIN فقط
 *   - خصم > MAX_CASHIER_DISCOUNT_PCT → ADMIN فقط
 *   - paymentMethod ضمن قائمة مغلقة؛ "staff" (خارج الإيراد) → ADMIN فقط
 *   - cashReceived لازم يغطي الإجمالي في الدفع النقدي
 *   - البيع بدون وردية مفتوحة مرفوض
 *   - void لفاتورة مدفوعة أو لفاتورة كاشير آخر → ADMIN فقط + سبب إلزامي
 *   - كل بيع بيخصم المخزون تلقائياً من رسيبيات publicMeals عبر mealIngredients
 * @frontend client/src/pages/pos/*
 */
import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { verifyPassword } from "./passwords";
import { writeAudit } from "./lib/audit";
import { awardPointsForPosTicket, reversePointsForPosTicket } from "./loyalty";
import { convertUnit } from "./units";
import { autoPostPosTicket, autoReversePosTicket } from "./financePost";

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
  if (!user || !user.isActive || !canUsePos(user)) throw new Error("Cashier not active");
  return { session, user };
}

function canUsePos(user: any): boolean {
  if (user?.posEnabled === false) return false;
  return user?.posEnabled === true
    || user?.role === "CASHIER"
    || (user?.role === "ADMIN" && !!user?.pinHash);
}

function isAdmin(user: any): boolean {
  return String(user?.role || "").toUpperCase() === "ADMIN";
}

/** يحدّد فرع الكاشير: المُعيَّن عليه، وإلا الفرع الوحيد لو فيه فرع واحد فقط، وإلا undefined. */
async function resolveBranchId(ctx: QueryCtx | MutationCtx, user: any): Promise<Id<"posBranches"> | undefined> {
  if (user?.posBranchId) return user.posBranchId as Id<"posBranches">;
  const active = await ctx.db.query("posBranches").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
  if (active.length === 1) return active[0]._id;
  return undefined;
}

/** معلومات الفرع للعرض (الفاتورة/الوردية). */
async function branchInfo(ctx: QueryCtx | MutationCtx, branchId: any) {
  if (!branchId) return null;
  const b: any = await ctx.db.get(branchId);
  if (!b) return null;
  return { id: String(b._id), name: b.name, code: b.code || null, phone: b.phone || null, address: b.address || null };
}

// حدود مسموحة للكاشير — تجاوزها يستلزم ADMIN
const MAX_CASHIER_DISCOUNT_PCT = 20;                    // خصم أعلى من ده يحتاج مدير
// النقدي/البطاقة/التحويل + منصّات التوصيل (المعروضة في واجهة الدفع)
const ALLOWED_PAYMENT_METHODS = new Set(["cash", "card", "transfer", "other", "talabat", "snoonu", "rafeeq", "keeta"]);
const ADMIN_ONLY_PAYMENT_METHODS = new Set(["staff"]);  // فاتورة موظف = خارج الإيراد

function newToken(): string {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return "pos_" + Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const RL_WINDOW_MS = 5 * 60 * 1000;
const RL_MAX_FAILS = 5;
async function checkAndRecordFailure(ctx: MutationCtx, key: string, failed: boolean) {
  try {
    const now = Date.now();
    const cutoff = now - RL_WINDOW_MS;
    const rows: any[] = await ctx.db
      .query("posLoginAttempts")
      .withIndex("by_key", (q) => q.eq("key", key))
      .collect();
    const recent = rows.filter((r: any) => r.at >= cutoff);
    for (const r of rows) if (r.at < cutoff) await ctx.db.delete(r._id);
    if (recent.length >= RL_MAX_FAILS) {
      throw new Error(`تم قفل الدخول ${Math.ceil(RL_WINDOW_MS / 60000)} دقائق — عدد محاولات كبير`);
    }
    if (failed) await ctx.db.insert("posLoginAttempts", { key, at: now });
  } catch (e: any) {
    if (String(e?.message || "").includes("تم قفل الدخول")) throw e;
  }
}

export const loginWithPin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const clean = pin.trim();
    if (!/^\d{4,6}$/.test(clean)) throw new Error("يجب أن يتكوّن رمز PIN من 4 إلى 6 أرقام");
    await checkAndRecordFailure(ctx, "global", false);
    const users = await ctx.db.query("users").collect();
    let match: any = null;
    for (const u of users) {
      if (!u.isActive) continue;
      if (!canUsePos(u)) continue;
      if (!u.pinHash) continue;
      if (await verifyPassword(clean, u.pinHash)) { match = u; break; }
    }
    if (!match) {
      await checkAndRecordFailure(ctx, "global", true);
      throw new Error("PIN غير صحيح");
    }
    const token = newToken();
    await ctx.db.insert("posSessions", {
      token,
      cashierId: match._id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });
    const branch = await branchInfo(ctx, match.posBranchId);
    return {
      token,
      cashier: { id: String(match._id), name: match.name, role: match.role, branchId: branch?.id || null, branchName: branch?.name || null },
    };
  },
});

export const me = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    try {
      const { user } = await requireCashier(ctx, token);
      const branch = await branchInfo(ctx, user.posBranchId);
      return { id: String(user._id), name: user.name, role: user.role, branchId: branch?.id || null, branchName: branch?.name || null };
    } catch { return null; }
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await ctx.db.query("posSessions").withIndex("by_token", (q) => q.eq("token", token)).first();
    if (s) await ctx.db.delete(s._id);
    return { ok: true };
  },
});

/* ═══════════════════════════════ Categories & Items ═══════════════════════════════ */

/** إعدادات عامة للـPOS يحتاجها الكاشير (رسوم التوصيل الحالية). */
export const posSettings = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (token) await requireCashier(ctx, token);
    const s: any = await ctx.db.query("restaurantSettings").first();
    return { deliveryFee: Number(s?.posDeliveryFee ?? 10) };
  },
});

export const listCategories = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (token) await requireCashier(ctx, token);
    const cats = await ctx.db.query("posCategories").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    return cats.sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({
      id: String(c._id), name: c.name, color: c.color, icon: c.icon,
    }));
  },
});

export const listItems = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    if (token) await requireCashier(ctx, token);
    const meals = await ctx.db.query("publicMeals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    const metas = await ctx.db.query("posItems").collect();
    const metaByMeal = new Map(metas.map((m: any) => [String(m.mealId), m]));
    const out = await Promise.all(meals.map(async (m: any) => {
      const meta = metaByMeal.get(String(m._id));
      const price = meta?.posPrice != null ? Number(meta.posPrice) : null;
      const imageUrl = m.storageId ? await ctx.storage.getUrl(m.storageId) : (m.imageUrl || null);
      return {
        id: String(m._id),
        name: meta?.displayName || m.nameEn || m.nameAr || "—",
        nameAr: m.nameAr || "", nameEn: m.nameEn || "",
        menuCategory: m.category || "other",
        posCategoryId: meta?.posCategoryId ? String(meta.posCategoryId) : null,
        color: meta?.color || null, imageUrl, price,
        hasOnlinePrice: price != null && Number.isFinite(price) && price >= 0,
        isHidden: !!meta?.isHidden,
        sortOrder: meta?.sortOrder ?? m.sortOrder ?? 0,
      };
    }));
    return out
      .filter((m) => !m.isHidden && m.hasOnlinePrice)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  },
});

export const findCustomerByPhone = query({
  args: { token: v.string(), phone: v.string() },
  handler: async (ctx, { token, phone }) => {
    await requireCashier(ctx, token);
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 6) return null;
    const c: any = await ctx.db.query("customers").withIndex("by_phone", (q) => q.eq("phone", normalized)).first();
    if (!c) return null;
    return {
      id: String(c._id), fullName: c.fullName, phone: c.phone,
      loyaltyPoints: Number(c.loyaltyPoints || 0),
      loyaltyCredit: Number(c.loyaltyCredit || 0),
    };
  },
});

/* ═══════════════════════════════ Shift ═══════════════════════════════ */

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
    const branch = await branchInfo(ctx, (s as any).branchId);
    return {
      id: String(s._id), openedAt: s.openedAt, openingCash: s.openingCash,
      totalSales: s.totalSales, ticketsCount: s.ticketsCount,
      branchId: branch?.id || null, branchName: branch?.name || null,
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
    // 🏢 فرع الوردية: فرع الكاشير المُعيَّن (أو الفرع الوحيد). لو فيه فروع متعددة وغير معيَّن → رفض.
    const branchId = await resolveBranchId(ctx, user);
    const branchesCount = (await ctx.db.query("posBranches").withIndex("by_active", (q) => q.eq("isActive", true)).collect()).length;
    if (!branchId && branchesCount > 1) {
      throw new Error("لم يُعيَّن موظف الصندوق على فرع. تواصل مع المدير لإتمام التعيين");
    }
    const id = await ctx.db.insert("posShifts", {
      cashierId: user._id, cashierName: user.name, branchId, openedAt: Date.now(),
      openingCash: Math.max(0, openingCash),
      totalSales: 0, ticketsCount: 0, status: "OPEN",
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
    if (!shift) throw new Error("لا توجد وردية مفتوحة");
    const tickets = await ctx.db
      .query("posTickets")
      .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
      .collect();
    const cashSales = tickets
      .filter((t) => t.status === "PAID" && !t.isNonRevenue)
      .reduce((s, t) => s + cashPortionOf(t), 0);
    const expectedCash = Math.round((shift.openingCash + cashSales) * 100) / 100;
    const diff = Math.round((closingCash - expectedCash) * 100) / 100;
    await ctx.db.patch(shift._id, {
      status: "CLOSED", closedAt: Date.now(),
      closingCash: Math.max(0, closingCash),
      expectedCash, cashDiff: diff,
      notes: notes?.trim() || undefined,
    });
    return { expectedCash, cashDiff: diff };
  },
});

/* ═══════════════════════════════ Server-authoritative pricing ═══════════════════════════════ */

type ClientLineInput = {
  mealId?: string;
  qty: number;
  notes?: string;
  // ⚠️ name/unitPrice من العميل — يُقبل فقط للـcustom (بدون mealId) ومع ADMIN
  name?: string;
  unitPrice?: number;
  // "delivery" = سطر رسوم توصيل يسعّره الخادم (posDeliveryFee) — مسموح للكاشير
  kind?: string;
};

type ServerLine = {
  mealId?: any;
  name: string;
  qty: number;
  unitPrice: number;
  notes?: string;
};

/**
 * 🔒 يحوّل أسطر العميل لأسطر معتمدة من الخادم:
 *   - لكل سطر بـmealId: يقرأ posItems.posPrice أو publicMeals.priceQAR + displayName/nameEn/nameAr
 *   - لكل سطر بدون mealId: custom item — يحتاج isAdmin ويقبل الاسم/السعر المرسل
 *   - يرفض الأسطر بكميات صفرية أو سالبة
 */
async function buildServerLines(
  ctx: MutationCtx,
  clientLines: ClientLineInput[],
  actorIsAdmin: boolean,
): Promise<ServerLine[]> {
  // رسوم التوصيل الثابتة من الإعدادات (يسعّرها الخادم — الكاشير مش بيحدد المبلغ)
  const settingsForFee: any = await ctx.db.query("restaurantSettings").first();
  const deliveryFee = Number(settingsForFee?.posDeliveryFee ?? 10);
  const out: ServerLine[] = [];
  for (const l of clientLines) {
    const qty = Number(l.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("يجب أن تكون الكمية أكبر من صفر");
    if (!l.mealId && l.kind === "delivery") {
      // 🚚 سطر توصيل — يسعّره الخادم، مسموح للكاشير (مش صنف مخصّص حر)
      if (!Number.isFinite(deliveryFee) || deliveryFee < 0) throw new Error("رسوم التوصيل غير مضبوطة");
      out.push({ mealId: undefined, name: "توصيل", qty, unitPrice: deliveryFee, notes: l.notes?.trim() || undefined });
    } else if (l.mealId) {
      const meal: any = await ctx.db.get(l.mealId as Id<"publicMeals">);
      if (!meal || !meal.isActive) throw new Error("الوجبة غير متوفرة");
      const meta = await ctx.db
        .query("posItems")
        .withIndex("by_meal", (q) => q.eq("mealId", meal._id))
        .first();
      if (meta?.posPrice == null) throw new Error("هذا الصنف غير مفعّل للبيع أونلاين: حدّد سعر الأونلاين أولاً");
      const price = Number(meta.posPrice);
      if (!Number.isFinite(price) || price < 0) throw new Error("سعر الأونلاين للصنف غير صالح");
      const name = meta?.displayName || meal.nameEn || meal.nameAr || "—";
      out.push({
        mealId: meal._id, name, qty, unitPrice: price,
        notes: l.notes?.trim() || undefined,
      });
    } else {
      // 🔒 صنف مخصّص (بلا mealId) — ADMIN فقط
      if (!actorIsAdmin) throw new Error("الأصناف المخصّصة تحتاج صلاحية مدير");
      const name = String(l.name || "").trim();
      const unitPrice = Number(l.unitPrice);
      if (!name) throw new Error("اسم الصنف المخصّص مطلوب");
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("سعر الصنف المخصّص غير صالح");
      out.push({
        mealId: undefined, name, qty, unitPrice,
        notes: l.notes?.trim() || undefined,
      });
    }
  }
  if (out.length === 0) throw new Error("يجب إضافة صنف واحد على الأقل");
  return out;
}

/** يحسب المجاميع بحساب إعدادات الضريبة (posTax). */
async function computeTotals(ctx: MutationCtx, lines: ServerLine[], discount = 0) {
  let subtotalRaw = 0;
  for (const l of lines) { subtotalRaw += l.qty * l.unitPrice; }
  subtotalRaw = Math.round(subtotalRaw * 100) / 100;

  const settings: any = await ctx.db.query("restaurantSettings").first();
  const taxCfg = settings?.posTax;
  const taxPct = Number(taxCfg?.pct ?? 0);
  const inclusive = !!taxCfg?.inclusive;

  let subtotal = subtotalRaw, tax = 0, total = 0;
  if (taxPct > 0) {
    if (inclusive) {
      subtotal = Math.round((subtotalRaw / (1 + taxPct / 100)) * 100) / 100;
      tax = Math.round((subtotalRaw - subtotal) * 100) / 100;
      total = Math.max(0, Math.round((subtotalRaw - discount) * 100) / 100);
    } else {
      const afterDiscount = Math.max(0, subtotal - discount);
      tax = Math.round(afterDiscount * (taxPct / 100) * 100) / 100;
      total = Math.round((afterDiscount + tax) * 100) / 100;
    }
  } else {
    total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  }
  return { subtotal, discount: Math.round(discount * 100) / 100, tax, total };
}

/** 🔒 يتحقق أن الخصم ضمن حدود الكاشير. الأدمن ممرور. */
function assertDiscountAllowed(subtotal: number, discount: number, actorIsAdmin: boolean) {
  if (!Number.isFinite(discount) || discount < 0) throw new Error("الخصم غير صالح");
  if (discount === 0) return;
  if (actorIsAdmin) return;
  if (subtotal <= 0) throw new Error("خصم غير مسموح على فاتورة فارغة");
  const pct = (discount / subtotal) * 100;
  if (pct > MAX_CASHIER_DISCOUNT_PCT) {
    throw new Error(`خصم أعلى من ${MAX_CASHIER_DISCOUNT_PCT}% يحتاج صلاحية مدير`);
  }
}

/** 🔒 يتحقق أن paymentMethod ضمن القائمة، ولو "staff" لازم مدير. */
function assertPaymentMethodAllowed(method: string, actorIsAdmin: boolean) {
  const m = String(method || "").toLowerCase();
  if (ADMIN_ONLY_PAYMENT_METHODS.has(m)) {
    if (!actorIsAdmin) throw new Error('فاتورة "staff" (خارج الإيراد) تحتاج صلاحية مدير');
    return m;
  }
  if (!ALLOWED_PAYMENT_METHODS.has(m)) throw new Error("طريقة دفع غير مسموحة");
  return m;
}

type PaymentArg = { paymentMethod?: string; cashReceived?: number; payments?: { method: string; amount: number }[] };
type ResolvedPayment = {
  paymentMethod: string;
  payments?: { method: string; amount: number }[];
  cashReceived?: number;
  changeAmount?: number;
  isStaff: boolean;
};

/**
 * 🔒 يحدّد طريقة/طرق الدفع مع الحفاظ على كل الضوابط القديمة:
 *   - دفع واحد (السلوك القديم): cash يتحقق أن المستلم يغطي الإجمالي ويحسب الباقي.
 *   - دفع مقسوم (payments بطولين+): مجموع المبالغ لازم يساوي الإجمالي بالضبط، staff ممنوع في المقسوم.
 *   جزء الكاش من المقسوم يُخزَّن في cashReceived لحساب تقفيل الوردية.
 */
function resolvePayment(args: PaymentArg, total: number, actorIsAdmin: boolean): ResolvedPayment {
  const split = Array.isArray(args.payments)
    ? args.payments.filter((p) => Number(p.amount) > 0)
    : [];
  if (split.length >= 2) {
    const norm = split.map((p) => ({
      method: assertPaymentMethodAllowed(p.method, actorIsAdmin),
      amount: Math.round(Number(p.amount) * 100) / 100,
    }));
    for (const p of norm) {
      if (p.method === "staff") throw new Error('لا يمكن دمج فاتورة "staff" مع دفع مقسوم');
    }
    const sum = Math.round(norm.reduce((s, p) => s + p.amount, 0) * 100) / 100;
    if (Math.abs(sum - total) > 0.01) {
      throw new Error(`يجب أن يساوي مجموع المدفوعات (${sum.toFixed(2)}) الإجمالي (${total.toFixed(2)})`);
    }
    const cashPortion = Math.round(
      norm.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0) * 100,
    ) / 100;
    return {
      paymentMethod: "mixed",
      payments: norm,
      cashReceived: cashPortion || undefined,
      changeAmount: 0,
      isStaff: false,
    };
  }
  // دفع واحد — نفس السلوك القديم
  const method = assertPaymentMethodAllowed(args.paymentMethod || split[0]?.method || "", actorIsAdmin);
  let change: number | undefined = undefined;
  if (method === "cash") {
    const cr = Number(args.cashReceived ?? 0);
    if (!Number.isFinite(cr) || cr < total) throw new Error("يجب أن يغطي النقد المستلم قيمة الإجمالي");
    change = Math.round((cr - total) * 100) / 100;
  }
  return { paymentMethod: method, cashReceived: args.cashReceived, changeAmount: change, isStaff: method === "staff" };
}

/** جزء الكاش من فاتورة (يدعم الدفع المقسوم) — لتقفيل الوردية. */
function cashPortionOf(t: any): number {
  if (t.isNonRevenue) return 0;
  if (Array.isArray(t.payments) && t.payments.length) {
    return Math.round(
      t.payments
        .filter((p: any) => String(p.method).toLowerCase() === "cash")
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0) * 100,
    ) / 100;
  }
  return t.paymentMethod === "cash" ? Number(t.total || 0) : 0;
}

async function nextTicketNumber(ctx: MutationCtx): Promise<number> {
  const row = await ctx.db.query("posCounters").withIndex("by_key", (q) => q.eq("key", "ticket_number")).first();
  if (!row) { await ctx.db.insert("posCounters", { key: "ticket_number", value: 1 }); return 1; }
  const next = row.value + 1;
  await ctx.db.patch(row._id, { value: next });
  return next;
}

/** Deduct each POS line from the canonical publicMeals recipe. */
async function deductInventoryForTicket(ctx: MutationCtx, ticketId: any, ticketNumber: number, serverLines: ServerLine[]) {
  const now = Date.now();
  const need = new Map<string, number>();
  for (const l of serverLines) {
    if (!l.mealId) continue;
    let recipe = await ctx.db
      .query("mealIngredients")
      .withIndex("by_publicMeal", (q) => q.eq("publicMealId", l.mealId))
      .collect();
    // Compatibility fallback until all legacy recipes have been migrated.
    if (!recipe.length) {
      const legacy = await ctx.db.query("menuItems").withIndex("by_publicMeal", (q) => q.eq("publicMealId", l.mealId)).first();
      if (legacy) recipe = await ctx.db.query("mealIngredients").withIndex("by_menuItem", (q) => q.eq("menuItemId", legacy._id)).collect();
    }
    for (const ing of recipe) {
      const invItem: any = await ctx.db.get(ing.inventoryItemId);
      if (!invItem) continue;
      const per = Number(ing.quantityPerServing) || 0;
      const totalNeeded = convertUnit(per * l.qty, (ing as any).unit, invItem.unit);
      const key = String(ing.inventoryItemId);
      need.set(key, (need.get(key) || 0) + totalNeeded);
    }
  }
  for (const [itemId, qty] of Array.from(need.entries())) {
    if (qty <= 0) continue;
    const item: any = await ctx.db.get(itemId as Id<"inventoryItems">);
    if (!item) continue;
    const deduct = Math.min(item.currentStock, qty);
    if (deduct > 0) {
      await ctx.db.insert("inventoryMovements", {
        itemId: item._id, type: "consume", quantity: -deduct,
        note: `POS #${ticketNumber}`, createdAt: now,
      });
      await ctx.db.patch(item._id, { currentStock: item.currentStock - deduct, updatedAt: now });
      let remaining = deduct;
      const batches = await ctx.db
        .query("inventoryBatches")
        .withIndex("by_itemId", (q) => q.eq("itemId", item._id))
        .collect();
      batches.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
      for (const b of batches) {
        if (remaining <= 0) break;
        if (b.quantityRemaining <= 0) continue;
        const d = Math.min(b.quantityRemaining, remaining);
        await ctx.db.patch(b._id, { quantityRemaining: b.quantityRemaining - d });
        remaining -= d;
      }
    }
  }
}

/** 🔒 يعكس خصم المخزون لفاتورة عند الـvoid/refund (يرجع الكميات المخصومة بعلامة موجبة). */
export async function reverseInventoryForTicket(ctx: MutationCtx, ticketNumber: number, tag = "void") {
  const movements = await ctx.db.query("inventoryMovements").collect();
  const target = movements.filter((m: any) => m.note === `POS #${ticketNumber}` && m.type === "consume");
  // 🔒 حماية من العكس المزدوج: لو فيه عكس سابق لنفس الفاتورة، لا نعكس تاني
  const alreadyReversed = movements.some((m: any) => typeof m.note === "string" && m.note.startsWith(`عكس POS #${ticketNumber}`));
  if (alreadyReversed) return;
  const now = Date.now();
  for (const m of target) {
    const item: any = await ctx.db.get(m.itemId);
    if (!item) continue;
    const back = Math.abs(m.quantity || 0);
    await ctx.db.insert("inventoryMovements", {
      itemId: item._id, type: "adjust", quantity: back,
      note: `عكس POS #${ticketNumber} (${tag})`, createdAt: now,
    });
    await ctx.db.patch(item._id, { currentStock: item.currentStock + back, updatedAt: now });
  }
}

/* ═══════════════════════════════ Tickets ═══════════════════════════════ */

const ticketLineArg = v.object({
  mealId: v.optional(v.id("publicMeals")),
  qty: v.number(),
  notes: v.optional(v.string()),
  name: v.optional(v.string()),        // يُتجاهل لو mealId موجود
  unitPrice: v.optional(v.number()),   // يُتجاهل لو mealId موجود
  kind: v.optional(v.string()),        // "delivery" = رسوم توصيل يسعّرها الخادم
});

/** إنشاء فاتورة مفتوحة (parked). 🔒 يشترط وردية مفتوحة. */
export const createTicket = mutation({
  args: {
    token: v.string(),
    lines: v.array(ticketLineArg),
    orderType: v.optional(v.string()),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCashier(ctx, args.token);
    // 🔒 لازم وردية مفتوحة
    const shift = await ctx.db
      .query("posShifts")
      .withIndex("by_cashier", (q) => q.eq("cashierId", user._id))
      .filter((q) => q.eq(q.field("status"), "OPEN"))
      .first();
    if (!shift) throw new Error("يجب فتح وردية أولًا");

    const serverLines = await buildServerLines(ctx, args.lines as ClientLineInput[], isAdmin(user));
    const totals = await computeTotals(ctx, serverLines, 0);
    const num = await nextTicketNumber(ctx);
    const id = await ctx.db.insert("posTickets", {
      ticketNumber: num, cashierId: user._id, cashierName: user.name,
      branchId: (shift as any).branchId, shiftId: shift._id, status: "OPEN", orderType: args.orderType,
      subtotal: totals.subtotal, discount: 0, tax: 0, total: totals.total,
      customerName: args.customerName?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      createdAt: Date.now(),
    });
    for (const l of serverLines) {
      await ctx.db.insert("posTicketLines", {
        ticketId: id, mealId: l.mealId, name: l.name, qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100,
        notes: l.notes,
      });
    }
    return { id: String(id), ticketNumber: num, total: totals.total };
  },
});

export const listOpenTickets = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { user } = await requireCashier(ctx, token);
    const rows = await ctx.db.query("posTickets").withIndex("by_status", (q) => q.eq("status", "OPEN")).collect();
    return rows
      .filter((t) => String(t.cashierId) === String(user._id))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({
        id: String(t._id), ticketNumber: t.ticketNumber, total: t.total,
        customerName: t.customerName || null, createdAt: t.createdAt,
      }));
  },
});

/** حفظ الطلب مؤقتاً (park) بدون خصم مخزون أو إنشاء حركة مالية. */
export const parkTicket = mutation({
  args: {
    token: v.string(), lines: v.array(ticketLineArg), discount: v.optional(v.number()),
    orderType: v.optional(v.string()), customerName: v.optional(v.string()), notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCashier(ctx, args.token);
    const shift = await ctx.db.query("posShifts").withIndex("by_cashier", q => q.eq("cashierId", user._id)).filter(q => q.eq(q.field("status"), "OPEN")).first();
    if (!shift) throw new Error("يجب فتح وردية أولاً");
    const lines = await buildServerLines(ctx, args.lines as ClientLineInput[], isAdmin(user));
    const rawDiscount = Number(args.discount || 0);
    const preview = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    assertDiscountAllowed(preview, rawDiscount, isAdmin(user));
    const totals = await computeTotals(ctx, lines, rawDiscount);
    const id = await ctx.db.insert("posTickets", { ticketNumber: await nextTicketNumber(ctx), cashierId: user._id, cashierName: user.name, branchId: (shift as any).branchId, shiftId: shift._id, status: "OPEN", orderType: args.orderType, subtotal: totals.subtotal, discount: totals.discount, tax: 0, total: totals.total, customerName: args.customerName?.trim() || undefined, notes: args.notes?.trim() || undefined, createdAt: Date.now(), updatedAt: Date.now() });
    for (const line of lines) await ctx.db.insert("posTicketLines", { ticketId: id, mealId: line.mealId, name: line.name, qty: line.qty, unitPrice: line.unitPrice, lineTotal: Math.round(line.qty * line.unitPrice * 100) / 100, notes: line.notes });
    return { id: String(id) };
  },
});

export const getTicket = query({
  args: { token: v.string(), ticketId: v.id("posTickets") },
  handler: async (ctx, { token, ticketId }) => {
    await requireCashier(ctx, token);
    const t: any = await ctx.db.get(ticketId);
    if (!t) return null;
    const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", ticketId)).collect();
    const branch = await branchInfo(ctx, t.branchId);
    return {
      id: String(t._id), ticketNumber: t.ticketNumber, cashierName: t.cashierName,
      branchName: branch?.name || null, branchPhone: branch?.phone || null, branchAddress: branch?.address || null,
      status: t.status, orderType: t.orderType || null,
      subtotal: t.subtotal, discount: t.discount, total: t.total,
      paymentMethod: t.paymentMethod || null,
      payments: Array.isArray(t.payments) ? t.payments.map((p: any) => ({ method: p.method, amount: p.amount })) : null,
      cashReceived: t.cashReceived || null, changeAmount: t.changeAmount || null,
      customerName: t.customerName || null, notes: t.notes || null,
      paidAt: t.paidAt || null, createdAt: t.createdAt,
      lines: await Promise.all(lines.map(async (l: any) => {
        // اسم عربي + إنجليزي من الوجبة (لو مربوطة) — الفاتورة تعرض الاتنين
        let nameAr: string | null = null, nameEn: string | null = null;
        if (l.mealId) {
          const meal: any = await ctx.db.get(l.mealId);
          if (meal) { nameAr = meal.nameAr || null; nameEn = meal.nameEn || null; }
        }
        return {
          id: String(l._id), name: l.name, nameAr, nameEn, qty: l.qty, unitPrice: l.unitPrice,
          lineTotal: l.lineTotal, notes: l.notes || null,
        };
      })),
    };
  },
});

/** بيانات استئناف فاتورة مفتوحة للواجهة؛ لا يسمح إلا لصاحبها أو المدير. */
export const resumeOpenTicket = mutation({
  args: { token: v.string(), ticketId: v.id("posTickets") },
  handler: async (ctx, args) => {
    const { user } = await requireCashier(ctx, args.token);
    const ticket: any = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.status !== "OPEN") throw new Error("الفاتورة غير متاحة");
    if (String(ticket.cashierId) !== String(user._id) && !isAdmin(user)) throw new Error("لا يمكن فتح فاتورة كاشير آخر");
    const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", q => q.eq("ticketId", args.ticketId)).collect();
    return { id: String(ticket._id), customerName: ticket.customerName || "", orderType: ticket.orderType || "dine_in", discount: ticket.discount || 0, lines: lines.map((l: any) => ({ mealId: l.mealId ? String(l.mealId) : null, name: l.name, qty: l.qty, unitPrice: l.unitPrice, note: l.notes })) };
  },
});

/** 🔒 تعديل فاتورة مفتوحة — صاحب الفاتورة فقط (أو ADMIN). */
export const updateTicketLines = mutation({
  args: {
    token: v.string(),
    ticketId: v.id("posTickets"),
    lines: v.array(ticketLineArg),
    discount: v.optional(v.number()),
    orderType: v.optional(v.string()),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCashier(ctx, args.token);
    const t: any = await ctx.db.get(args.ticketId);
    if (!t || t.status !== "OPEN") throw new Error("الفاتورة غير قابلة للتعديل");
    // 🔒 ownership
    if (String(t.cashierId) !== String(user._id) && !isAdmin(user)) {
      throw new Error("لا يُسمح بتعديل فاتورة موظف صندوق آخر");
    }
    const serverLines = await buildServerLines(ctx, args.lines as ClientLineInput[], isAdmin(user));
    const rawDiscount = Number(args.discount || 0);
    const subtotalPreview = serverLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    assertDiscountAllowed(subtotalPreview, rawDiscount, isAdmin(user));

    const old = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId)).collect();
    for (const l of old) await ctx.db.delete(l._id);
    const totals = await computeTotals(ctx, serverLines, rawDiscount);
    for (const l of serverLines) {
      await ctx.db.insert("posTicketLines", {
        ticketId: args.ticketId, mealId: l.mealId, name: l.name, qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100,
        notes: l.notes,
      });
    }
    await ctx.db.patch(args.ticketId, {
      subtotal: totals.subtotal, discount: totals.discount, total: totals.total,
      orderType: args.orderType || t.orderType,
      customerName: args.customerName?.trim() || t.customerName,
      notes: args.notes?.trim() || t.notes,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** 🔒 الدفع — ownership + payment enum + cash validation + inventory deduct. */
export const chargeTicket = mutation({
  args: {
    token: v.string(),
    ticketId: v.id("posTickets"),
    paymentMethod: v.string(),
    cashReceived: v.optional(v.number()),
    payments: v.optional(v.array(v.object({ method: v.string(), amount: v.number() }))),
    discount: v.optional(v.number()),
    orderType: v.optional(v.string()),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCashier(ctx, args.token);
    const t: any = await ctx.db.get(args.ticketId);
    if (!t) throw new Error("الفاتورة غير موجودة");
    if (t.status !== "OPEN") throw new Error("الفاتورة مدفوعة بالفعل");
    // 🔒 ownership
    if (String(t.cashierId) !== String(user._id) && !isAdmin(user)) {
      throw new Error("لا يُسمح بتحصيل فاتورة موظف صندوق آخر");
    }

    const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId)).collect();
    const serverLines: ServerLine[] = lines.map((l: any) => ({
      mealId: l.mealId, name: l.name, qty: l.qty, unitPrice: l.unitPrice,
    }));
    const rawDiscount = Number(args.discount ?? t.discount ?? 0);
    const subtotalPreview = serverLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    assertDiscountAllowed(subtotalPreview, rawDiscount, isAdmin(user));
    const totals = await computeTotals(ctx, serverLines, rawDiscount);

    // 🔒 تحديد طريقة/طرق الدفع (يدعم الدفع المقسوم) + التحقق من الكاش
    const pay = resolvePayment(args, totals.total, isAdmin(user));
    const method = pay.paymentMethod;
    const change = pay.changeAmount;
    const isStaff = pay.isStaff;
    await ctx.db.patch(args.ticketId, {
      status: "PAID", paymentMethod: method, payments: pay.payments,
      cashReceived: pay.cashReceived, changeAmount: change,
      discount: totals.discount, subtotal: totals.subtotal, total: totals.total,
      orderType: args.orderType || t.orderType,
      customerName: args.customerName?.trim() || t.customerName,
      notes: args.notes?.trim() || t.notes,
      isNonRevenue: isStaff, paidAt: Date.now(), updatedAt: Date.now(),
    });
    if (t.shiftId) {
      const shift: any = await ctx.db.get(t.shiftId);
      if (shift && shift.status === "OPEN") {
        await ctx.db.patch(t.shiftId, {
          totalSales: isStaff ? shift.totalSales : Math.round((shift.totalSales + totals.total) * 100) / 100,
          ticketsCount: shift.ticketsCount + 1,
        });
      }
    }
    // 🔒 خصم المخزون تلقائياً (لا نمنع البيع لو الرسيبي ناقص)
    try { await deductInventoryForTicket(ctx, args.ticketId, t.ticketNumber, serverLines); } catch { /* لا نوقف الدفع */ }

    // 💰 ترحيل محاسبي تلقائي (لا يوقف البيع أبداً)
    try { await autoPostPosTicket(ctx, args.ticketId); } catch { /* لا نوقف الدفع */ }

    return { ok: true, total: totals.total, change };
  },
});

/** 🔒 بيع سريع — نفس ضوابط chargeTicket. */
export const quickSale = mutation({
  args: {
    token: v.string(),
    lines: v.array(ticketLineArg),
    paymentMethod: v.string(),
    cashReceived: v.optional(v.number()),
    payments: v.optional(v.array(v.object({ method: v.string(), amount: v.number() }))),
    discount: v.optional(v.number()),
    orderType: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    notes: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCashier(ctx, args.token);

    // idempotency
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("posTickets")
        .withIndex("by_idem", (q) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();
      if (existing) {
        const changeExisting = (existing as any).changeAmount;
        return { id: String(existing._id), ticketNumber: existing.ticketNumber, total: existing.total, change: changeExisting, duplicate: true };
      }
    }

    // 🔒 لازم وردية مفتوحة
    const shift = await ctx.db
      .query("posShifts")
      .withIndex("by_cashier", (q) => q.eq("cashierId", user._id))
      .filter((q) => q.eq(q.field("status"), "OPEN"))
      .first();
    if (!shift) throw new Error("يجب فتح وردية أولًا");

    const serverLines = await buildServerLines(ctx, args.lines as ClientLineInput[], isAdmin(user));
    const rawDiscount = Number(args.discount || 0);
    const subtotalPreview = serverLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    assertDiscountAllowed(subtotalPreview, rawDiscount, isAdmin(user));
    const totals = await computeTotals(ctx, serverLines, rawDiscount);

    // 🔒 تحديد طريقة/طرق الدفع (يدعم الدفع المقسوم) + التحقق من الكاش
    const pay = resolvePayment(args, totals.total, isAdmin(user));
    const method = pay.paymentMethod;
    const change = pay.changeAmount;
    const isStaff = pay.isStaff;
    const num = await nextTicketNumber(ctx);
    const id = await ctx.db.insert("posTickets", {
      ticketNumber: num, cashierId: user._id, cashierName: user.name,
      branchId: (shift as any).branchId, shiftId: shift._id, status: "PAID", orderType: args.orderType,
      subtotal: totals.subtotal, discount: totals.discount, tax: 0, total: totals.total,
      paymentMethod: method, payments: pay.payments,
      cashReceived: pay.cashReceived, changeAmount: change,
      customerName: args.customerName?.trim() || undefined,
      customerId: args.customerId,
      notes: args.notes?.trim() || undefined,
      isNonRevenue: isStaff, idempotencyKey: args.idempotencyKey,
      paidAt: Date.now(), createdAt: Date.now(),
    });
    for (const l of serverLines) {
      await ctx.db.insert("posTicketLines", {
        ticketId: id, mealId: l.mealId, name: l.name, qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: Math.round(l.qty * l.unitPrice * 100) / 100,
        notes: l.notes,
      });
    }
    await ctx.db.patch(shift._id, {
      totalSales: isStaff ? shift.totalSales : Math.round((shift.totalSales + totals.total) * 100) / 100,
      ticketsCount: shift.ticketsCount + 1,
    });
    let loyaltyAwarded = 0;
    if (args.customerId && !isStaff) {
      try {
        const r = await awardPointsForPosTicket(ctx, String(args.customerId), num, totals.total);
        loyaltyAwarded = r.awarded;
      } catch { /* fail-safe */ }
    }
    // 🔒 خصم المخزون
    try { await deductInventoryForTicket(ctx, id, num, serverLines); } catch { /* لا نوقف البيع */ }

    // 💰 ترحيل محاسبي تلقائي (لا يوقف البيع أبداً)
    try { await autoPostPosTicket(ctx, id); } catch { /* لا نوقف البيع */ }

    return { id: String(id), ticketNumber: num, total: totals.total, change, loyaltyAwarded };
  },
});

/** 🔒 إلغاء فاتورة — parked=صاحبها، PAID=ADMIN فقط + سبب إلزامي. */
export const voidTicket = mutation({
  args: { token: v.string(), ticketId: v.id("posTickets"), reason: v.optional(v.string()) },
  handler: async (ctx, { token, ticketId, reason }) => {
    const { user } = await requireCashier(ctx, token);
    const t: any = await ctx.db.get(ticketId);
    if (!t) return { ok: true };
    const wasPaid = t.status === "PAID";

    if (wasPaid) {
      // 🔒 إلغاء فاتورة مدفوعة → ADMIN فقط + سبب إلزامي
      if (!isAdmin(user)) throw new Error("إلغاء فاتورة مدفوعة يحتاج صلاحية مدير");
      const r = String(reason || "").trim();
      if (r.length < 3) throw new Error("سبب الإلغاء مطلوب (3 أحرف أو أكثر)");
    } else {
      // parked → صاحبها أو ADMIN
      if (String(t.cashierId) !== String(user._id) && !isAdmin(user)) {
        throw new Error("لا يُسمح بإلغاء فاتورة موظف صندوق آخر");
      }
    }

    if (t.status === "OPEN") {
      const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", ticketId)).collect();
      for (const l of lines) await ctx.db.delete(l._id);
      await ctx.db.delete(ticketId);
    } else {
      await ctx.db.patch(ticketId, { status: "VOID", updatedAt: Date.now() });
      if (wasPaid && t.shiftId && !t.isNonRevenue) {
        const shift: any = await ctx.db.get(t.shiftId);
        if (shift && shift.status === "OPEN") {
          await ctx.db.patch(t.shiftId, {
            totalSales: Math.round((shift.totalSales - t.total) * 100) / 100,
            ticketsCount: Math.max(0, shift.ticketsCount - 1),
          });
        }
      }
      // 🔒 عكس خصم المخزون لو الفاتورة كانت مدفوعة وخصمت مخزون
      if (wasPaid) {
        try { await reverseInventoryForTicket(ctx, t.ticketNumber); } catch { /* لا نوقف */ }
        try { await autoReversePosTicket(ctx, ticketId, reason || "إلغاء الفاتورة", user._id); } catch { /* لا نوقف */ }
        // 🔒 عكس نقاط الولاء لو مُنِحت (idempotent)
        if (t.customerId) {
          try { await reversePointsForPosTicket(ctx, String(t.customerId), t.ticketNumber); } catch { /* fail-safe */ }
        }
      }
    }
    await writeAudit(ctx, { userId: String(user._id), name: user.name, role: user.role },
      "VOID_TICKET", "posTicket", String(ticketId),
      { ticketNumber: t.ticketNumber, prevStatus: t.status, total: t.total, reason: reason || null });
    return { ok: true };
  },
});

/** 🔒 استرجاع فاتورة مدفوعة من واجهة الكاشير — ADMIN فقط + سبب إلزامي.
 *   يرجّع المخزون + يعكس نقاط الولاء + يخصم من مبيعات الوردية. */
export const refundTicket = mutation({
  args: { token: v.string(), ticketId: v.id("posTickets"), reason: v.optional(v.string()) },
  handler: async (ctx, { token, ticketId, reason }) => {
    const { user } = await requireCashier(ctx, token);
    if (!isAdmin(user)) throw new Error("الاسترجاع يحتاج صلاحية مدير");
    const t: any = await ctx.db.get(ticketId);
    if (!t) throw new Error("الفاتورة غير موجودة");
    if (t.status !== "PAID") throw new Error("الاسترجاع يكون للفواتير المدفوعة فقط");
    const r = String(reason || "").trim();
    if (r.length < 3) throw new Error("سبب الاسترجاع مطلوب (3 أحرف أو أكثر)");

    await ctx.db.patch(ticketId, { status: "REFUNDED", updatedAt: Date.now() });
    // خصم من مبيعات الوردية (لو مفتوحة وليست خارج الإيراد)
    if (t.shiftId && !t.isNonRevenue) {
      const shift: any = await ctx.db.get(t.shiftId);
      if (shift && shift.status === "OPEN") {
        await ctx.db.patch(t.shiftId, {
          totalSales: Math.round((shift.totalSales - t.total) * 100) / 100,
          ticketsCount: Math.max(0, shift.ticketsCount - 1),
        });
      }
    }
    // 🔒 إرجاع المخزون + عكس نقاط الولاء
    try { await reverseInventoryForTicket(ctx, t.ticketNumber, "refund"); } catch { /* لا نوقف */ }
    try { await autoReversePosTicket(ctx, ticketId, r, user._id); } catch { /* لا نوقف */ }
    if (t.customerId) {
      try { await reversePointsForPosTicket(ctx, String(t.customerId), t.ticketNumber); } catch { /* fail-safe */ }
    }
    await writeAudit(ctx, { userId: String(user._id), name: user.name, role: user.role },
      "REFUND_TICKET", "posTicket", String(ticketId),
      { ticketNumber: t.ticketNumber, prevStatus: t.status, total: t.total, paymentMethod: t.paymentMethod, reason: reason || null });
    return { ok: true };
  },
});

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
      id: String(t._id), ticketNumber: t.ticketNumber, total: t.total,
      status: t.status, paymentMethod: t.paymentMethod || null,
      customerName: t.customerName || null,
      paidAt: t.paidAt || null, createdAt: t.createdAt,
    }));
  },
});
