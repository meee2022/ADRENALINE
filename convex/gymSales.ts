/**
 * @file convex/gymSales.ts
 * @description مبيعات الجم — POS تفصيلي مؤمّن:
 *   - كل الأسعار والأسماء تُجلب من publicMeals + gymAccounts.discountPct على الخادم
 *   - العميل بيبعت { mealId, qty } فقط (unitPrice/listPrice/mealName يُتجاهلوا)
 *   - CRUD الطلبيات → FINANCE_ROLES (ACCOUNTANT/FINANCE_MANAGER) + ADMIN
 *   - CRUD الجمات وسعر الجم للوجبة → ADMIN فقط
 *   - deleteOrder = soft void (isVoid=true + سبب) — الحذف الفعلي محظور
 * @frontend client/src/pages/GymSales.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff, requireAdmin, requireRole } from "./sessions";

const GYM_FINANCE_ROLES = ["ACCOUNTANT", "FINANCE_MANAGER"];

/* ═══════════════════════════════ إدارة الجمات ═══════════════════════════════ */

export const listGyms = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db.query("gymAccounts").collect();
    rows.sort((a, b) => (a.isActive === b.isActive ? a.name.localeCompare(b.name) : a.isActive ? -1 : 1));
    return rows.map((g) => ({
      id: String(g._id), name: g.name, address: g.address || "",
      contactName: g.contactName || "", contactPhone: g.contactPhone || "",
      discountPct: g.discountPct, notes: g.notes || "", isActive: g.isActive,
    }));
  },
});

/** 🔒 إضافة جم — ADMIN فقط (قرار تجاري). */
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
    await requireAdmin(ctx, args.sessionToken);
    const name = args.name.trim();
    if (!name) throw new Error("اسم الجم مطلوب");
    const id = await ctx.db.insert("gymAccounts", {
      name,
      address: args.address?.trim() || undefined,
      contactName: args.contactName?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      discountPct: Math.min(100, Math.max(0, Number(args.discountPct ?? 20))),
      notes: args.notes?.trim() || undefined,
      isActive: true, createdAt: Date.now(),
    });
    return { id: String(id) };
  },
});

/** 🔒 تعديل جم — ADMIN فقط. */
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
    await requireAdmin(ctx, args.sessionToken);
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

/** 🔒 تعديل سعر الجم لوجبة — ADMIN فقط. */
export const setMealGymPrice = mutation({
  args: {
    mealId: v.id("publicMeals"),
    gymPrice: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.patch(args.mealId, {
      gymPrice: args.gymPrice != null && args.gymPrice >= 0 ? args.gymPrice : undefined,
    } as any);
    return { success: true };
  },
});

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
      .filter((m: any) => !!m.isGymItem)
      .map((m: any) => {
        const listPrice = Number(m.priceQAR) || 0;
        const hasCustom = m.gymPrice != null && m.gymPrice >= 0;
        const effectivePrice = hasCustom ? Number(m.gymPrice) : Math.round(listPrice * (1 - discount / 100) * 100) / 100;
        return {
          id: String(m._id), nameEn: m.nameEn || m.nameAr || "",
          nameAr: m.nameAr || m.nameEn || "", category: m.category || "other",
          listPrice, gymPrice: hasCustom ? Number(m.gymPrice) : null,
          effectivePrice, isCustom: hasCustom, sortOrder: m.sortOrder ?? 0,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));
  },
});

export const listAllMealsForGymAdmin = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const meals = await ctx.db.query("publicMeals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    return meals
      .map((m: any) => ({
        id: String(m._id), nameEn: m.nameEn || m.nameAr || "",
        nameAr: m.nameAr || m.nameEn || "", category: m.category || "other",
        listPrice: Number(m.priceQAR) || 0,
        gymPrice: m.gymPrice != null && m.gymPrice >= 0 ? Number(m.gymPrice) : null,
        isGymItem: !!m.isGymItem,
      }))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  },
});

/** 🔒 إدراج/إزالة صنف من قائمة الجم — ADMIN. */
export const setMealIsGymItem = mutation({
  args: { mealId: v.id("publicMeals"), isGymItem: v.boolean(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.patch(args.mealId, { isGymItem: args.isGymItem } as any);
    return { ok: true };
  },
});

/**
 * 🔒 تطبيق قائمة أسعار الجم من ملف PDF/Excel — ADMIN فقط.
 *    لكل صف بالاسم والسعر:
 *      1. يبحث عن أقرب وجبة في publicMeals بالاسم (fuzzy: يهمل الحالة، المسافات
 *         الزائدة، وعلامات الترقيم، ويجرّب Protien↔Protein).
 *      2. يحدّث gymPrice + isGymItem=true.
 *    يعيد تقرير: ماتشات ناجحة، أسماء لم يجد لها مطابقاً.
 */
export const applyGymPriceList = mutation({
  args: {
    rows: v.array(v.object({ name: v.string(), price: v.number() })),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const meals = await ctx.db.query("publicMeals").collect();

    // تطبيع + tokenize: كلمات فقط، مع تصحيح typos ومزامنة الاختصارات
    const STOP = new Set(["and", "with", "w", "the", "a", "of", "&"]);
    const tokens = (s: string) => s.toLowerCase()
      .replace(/protien/g, "protein")
      .replace(/avacodo/g, "avocado")
      .replace(/pistacchio/g, "pistachio")
      .replace(/mediterrenean/g, "mediterranean")
      .replace(/ceaser/g, "caesar")
      .replace(/majboos/g, "majboos")
      .replace(/\bw\/?/g, " with ")           // W/ أو W → with
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOP.has(t));

    type Entry = { meal: any; toks: Set<string> };
    const catalog: Entry[] = [];
    for (const m of meals) {
      for (const key of [m.nameEn, m.nameAr]) {
        const toks = new Set(tokens(String(key || "")));
        if (toks.size === 0) continue;
        catalog.push({ meal: m, toks });
      }
    }

    // مطابقة: أفضل Jaccard similarity ≥ 0.6
    const findFuzzy = (name: string) => {
      const q = new Set(tokens(name));
      if (q.size === 0) return null;
      let best: { meal: any; score: number } | null = null;
      for (const e of catalog) {
        let inter = 0;
        for (const t of Array.from(q)) if (e.toks.has(t)) inter++;
        const union = q.size + e.toks.size - inter;
        const jaccard = union === 0 ? 0 : inter / union;
        // نطلب كل token في الاستعلام موجود، أو Jaccard عالٍ
        const containment = inter / q.size;
        const score = Math.max(jaccard, containment * 0.9);
        if (!best || score > best.score) best = { meal: e.meal, score };
      }
      return best && best.score >= 0.6 ? best.meal : null;
    };

    const matched: any[] = [];
    const unmatched: string[] = [];
    for (const row of args.rows) {
      const meal = findFuzzy(row.name);
      if (!meal) { unmatched.push(row.name); continue; }
      if (row.price < 0 || row.price > 10000) { unmatched.push(`${row.name} (سعر غير صالح)`); continue; }
      await ctx.db.patch(meal._id, {
        gymPrice: row.price,
        isGymItem: true,
      } as any);
      matched.push({ input: row.name, matched: meal.nameEn || meal.nameAr, price: row.price });
    }
    return { total: args.rows.length, matched: matched.length, unmatched, details: matched };
  },
});

/** 🔒 تحديث جماعي — ADMIN. */
export const bulkSetGymItems = mutation({
  args: { mealIds: v.array(v.id("publicMeals")), isGymItem: v.boolean(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    for (const id of args.mealIds) {
      await ctx.db.patch(id, { isGymItem: args.isGymItem } as any);
    }
    return { updated: args.mealIds.length };
  },
});

/* ═══════════════════════════════ الطلبيات ═══════════════════════════════ */

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
      id: String(order._id), date: order.date,
      gymId: String(order.gymId), gymName: gym?.name || "",
      discountPct: order.discountPct, subtotal: order.subtotal,
      discountAmount: order.discountAmount, total: order.total,
      mealsCount: order.mealsCount, notes: order.notes || "",
      isVoid: !!order.isVoid,
      voidedAt: order.voidedAt || null,
      voidReason: order.voidReason || null,
      createdAt: order.createdAt, updatedAt: order.updatedAt,
      lines: lines.map((l: any) => ({
        id: String(l._id),
        mealId: l.mealId ? String(l.mealId) : null,
        mealNameEn: l.mealNameEn || "", mealNameAr: l.mealNameAr || "",
        qty: l.qty, listPrice: l.listPrice, unitPrice: l.unitPrice, lineTotal: l.lineTotal,
      })),
    };
  },
});

export const listOrders = query({
  args: {
    from: v.optional(v.string()), to: v.optional(v.string()),
    gymId: v.optional(v.id("gymAccounts")),
    includeVoided: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    let rows: any[] = await ctx.db.query("gymOrders").withIndex("by_date").collect();
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    if (args.gymId) rows = rows.filter((r) => String(r.gymId) === String(args.gymId));
    if (!args.includeVoided) rows = rows.filter((r) => !r.isVoid);
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
        id: String(r._id), date: r.date, gymId: key,
        gymName: gymNames.get(key) || "",
        subtotal: r.subtotal, discountAmount: r.discountAmount,
        total: r.total, mealsCount: r.mealsCount,
        isVoid: !!r.isVoid,
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

/**
 * 🔒 يحوّل أسطر العميل (mealId+qty) لأسطر معتمدة من الخادم:
 * - يقرأ publicMeals: priceQAR + gymPrice
 * - يطبّق gymAccounts.discountPct لو مفيش gymPrice مخصّص
 * - يرفض أي وجبة غير موجودة أو غير نشطة
 */
async function buildGymOrderLines(
  ctx: any,
  gym: any,
  clientLines: Array<{ mealId?: any; qty: number }>,
) {
  const out: any[] = [];
  let subtotal = 0, total = 0, mealsCount = 0;
  const discountPct = Number(gym.discountPct) || 0;
  for (const l of clientLines) {
    const qty = Math.max(0, Math.round(Number(l.qty) || 0));
    if (qty === 0) continue;
    if (!l.mealId) throw new Error("mealId مطلوب لكل سطر");
    const meal: any = await ctx.db.get(l.mealId);
    if (!meal || !meal.isActive) throw new Error("وجبة غير متوفرة");
    const listPrice = Number(meal.priceQAR) || 0;
    const hasCustom = meal.gymPrice != null && meal.gymPrice >= 0;
    const unitPrice = hasCustom
      ? Number(meal.gymPrice)
      : Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;
    if (unitPrice < 0) throw new Error("سعر غير صالح");
    subtotal += listPrice * qty;
    total += unitPrice * qty;
    mealsCount += qty;
    out.push({
      mealId: meal._id,
      mealNameEn: meal.nameEn || meal.nameAr || "",
      mealNameAr: meal.nameAr || meal.nameEn || "",
      qty, listPrice, unitPrice,
      lineTotal: Math.round(qty * unitPrice * 100) / 100,
    });
  }
  if (out.length === 0) throw new Error("لازم تضيف وجبة واحدة على الأقل");
  subtotal = Math.round(subtotal * 100) / 100;
  total = Math.round(total * 100) / 100;
  const discountAmount = Math.round((subtotal - total) * 100) / 100;
  return { lines: out, subtotal, total, discountAmount, mealsCount };
}

/** 🔒 إنشاء طلبية جم — FINANCE أو ADMIN. الأسعار من الخادم. */
export const createOrder = mutation({
  args: {
    date: v.string(),
    gymId: v.id("gymAccounts"),
    lines: v.array(v.object({
      mealId: v.id("publicMeals"),
      qty: v.number(),
      // الحقول التالية اختيارية — تُقبل من العميل توافقاً لكن تُتجاهل تماماً على الخادم
      // (السعر والاسم يُجلبان من DB — لا يُعتَد بأي شيء من العميل)
      mealNameEn: v.optional(v.string()),
      mealNameAr: v.optional(v.string()),
      listPrice: v.optional(v.number()),
      unitPrice: v.optional(v.number()),
    })),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sess: any = await requireRole(ctx, args.sessionToken, GYM_FINANCE_ROLES);
    const who = sess?.userId ? undefined : undefined;
    const gym: any = await ctx.db.get(args.gymId);
    if (!gym) throw new Error("الجم غير موجود");

    const built = await buildGymOrderLines(ctx, gym, args.lines);

    const orderId = await ctx.db.insert("gymOrders", {
      date: args.date, gymId: args.gymId,
      discountPct: gym.discountPct,
      subtotal: built.subtotal, discountAmount: built.discountAmount,
      total: built.total, mealsCount: built.mealsCount,
      notes: args.notes?.trim() || undefined,
      createdBy: who, createdAt: Date.now(),
    });
    for (const l of built.lines) {
      await ctx.db.insert("gymOrderLines", {
        orderId, date: args.date, gymId: args.gymId,
        mealId: l.mealId,
        mealNameEn: l.mealNameEn, mealNameAr: l.mealNameAr,
        qty: l.qty, listPrice: l.listPrice,
        unitPrice: l.unitPrice, lineTotal: l.lineTotal,
      });
    }
    return {
      id: String(orderId), subtotal: built.subtotal,
      discountAmount: built.discountAmount,
      total: built.total, mealsCount: built.mealsCount,
    };
  },
});

/** 🔒 تعديل طلبية — FINANCE أو ADMIN. الأسعار من الخادم. المُلغاة مش تتعدّل. */
export const updateOrder = mutation({
  args: {
    orderId: v.id("gymOrders"),
    date: v.string(),
    gymId: v.id("gymAccounts"),
    lines: v.array(v.object({
      mealId: v.id("publicMeals"),
      qty: v.number(),
      // الحقول التالية اختيارية — تُقبل من العميل توافقاً لكن تُتجاهل تماماً على الخادم
      // (السعر والاسم يُجلبان من DB — لا يُعتَد بأي شيء من العميل)
      mealNameEn: v.optional(v.string()),
      mealNameAr: v.optional(v.string()),
      listPrice: v.optional(v.number()),
      unitPrice: v.optional(v.number()),
    })),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, GYM_FINANCE_ROLES);
    const existing: any = await ctx.db.get(args.orderId);
    if (!existing) throw new Error("الطلبية غير موجودة");
    if (existing.isVoid) throw new Error("مش مسموح تعدّل طلبية ملغاة");
    const gym: any = await ctx.db.get(args.gymId);
    if (!gym) throw new Error("الجم غير موجود");

    const built = await buildGymOrderLines(ctx, gym, args.lines);

    const oldLines = await ctx.db.query("gymOrderLines").withIndex("by_order", (q) => q.eq("orderId", args.orderId)).collect();
    for (const l of oldLines) await ctx.db.delete(l._id);

    await ctx.db.patch(args.orderId, {
      date: args.date, gymId: args.gymId,
      discountPct: gym.discountPct,
      subtotal: built.subtotal, discountAmount: built.discountAmount,
      total: built.total, mealsCount: built.mealsCount,
      notes: args.notes?.trim() || undefined,
      updatedAt: Date.now(),
    });
    for (const l of built.lines) {
      await ctx.db.insert("gymOrderLines", {
        orderId: args.orderId, date: args.date, gymId: args.gymId,
        mealId: l.mealId,
        mealNameEn: l.mealNameEn, mealNameAr: l.mealNameAr,
        qty: l.qty, listPrice: l.listPrice,
        unitPrice: l.unitPrice, lineTotal: l.lineTotal,
      });
    }
    return {
      success: true, subtotal: built.subtotal,
      discountAmount: built.discountAmount,
      total: built.total, mealsCount: built.mealsCount,
    };
  },
});

/**
 * 🔒 حذف = soft void — الحذف الفعلي محظور.
 *   ADMIN فقط + سبب إلزامي. الأسطر بتفضل موجودة للتدقيق.
 */
export const deleteOrder = mutation({
  args: {
    orderId: v.id("gymOrders"),
    reason: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id: any = await requireAdmin(ctx, args.sessionToken);
    const order: any = await ctx.db.get(args.orderId);
    if (!order) throw new Error("الطلبية غير موجودة");
    if (order.isVoid) return { success: true, alreadyVoid: true };
    const reason = String(args.reason || "").trim();
    if (reason.length < 3) throw new Error("سبب الإلغاء مطلوب (3 أحرف أو أكثر)");
    const actorName = id?.userId ? (await ctx.db.get(id.userId as any) as any)?.name : undefined;
    await ctx.db.patch(args.orderId, {
      isVoid: true, voidedAt: Date.now(),
      voidedBy: actorName || undefined, voidReason: reason,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/* ═══════════════════════════════ المرتجعات ═══════════════════════════════ */

/**
 * 🔒 تسجيل المرتجعات لطلبية — المرتجع = هالك (لا يعود للمخزون).
 *   ADMIN أو FINANCE. يتحقق أن كل returnedQty ≤ qty الأصلي.
 *   يحدّث السطر + يعيد حساب netTotal و wasteValue على مستوى الطلبية.
 */
export const recordOrderReturns = mutation({
  args: {
    orderId: v.id("gymOrders"),
    returns: v.array(v.object({ lineId: v.id("gymOrderLines"), qty: v.number() })),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, GYM_FINANCE_ROLES);
    const order: any = await ctx.db.get(args.orderId);
    if (!order) throw new Error("الطلبية غير موجودة");
    if (order.isVoid) throw new Error("مش مسموح على طلبية ملغاة");

    const lines = await ctx.db
      .query("gymOrderLines")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    const linesById = new Map(lines.map((l) => [String(l._id), l]));

    // تحقق + تطبيق
    for (const r of args.returns) {
      const line: any = linesById.get(String(r.lineId));
      if (!line) throw new Error("سطر غير موجود في الطلبية");
      const q = Math.max(0, Math.round(Number(r.qty) || 0));
      if (q > line.qty) throw new Error(`المرتجع (${q}) أكبر من المُرسل (${line.qty}) لسطر ${line.mealNameEn || line.mealNameAr}`);
      await ctx.db.patch(line._id, { returnedQty: q });
    }

    // إعادة الحساب على مستوى الطلبية
    const updatedLines = await ctx.db
      .query("gymOrderLines")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    let returnedTotal = 0, wasteValue = 0;
    for (const l of updatedLines) {
      const rq = Number((l as any).returnedQty || 0);
      returnedTotal += rq;
      wasteValue += rq * Number(l.unitPrice || 0);
    }
    wasteValue = Math.round(wasteValue * 100) / 100;
    const netTotal = Math.round((Number(order.total || 0) - wasteValue) * 100) / 100;

    await ctx.db.patch(args.orderId, {
      hasReturns: returnedTotal > 0,
      returnsRecordedAt: Date.now(),
      returnedTotal, wasteValue, netTotal,
      updatedAt: Date.now(),
    });
    return { returnedTotal, wasteValue, netTotal };
  },
});

/**
 * تقرير المرتجعات — لكل وجبة: كم اترسل، كم رجع، نسبة الإرجاع، قيمة الهالك.
 *   يُظهر الوجبات الأعلى إرجاعًا أولاً (الأولوية للإيقاف).
 */
export const returnsReport = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    gymId: v.optional(v.id("gymAccounts")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    let lines: any[] = await ctx.db.query("gymOrderLines").withIndex("by_date").collect();
    if (args.from) lines = lines.filter((l) => l.date >= args.from!);
    if (args.to) lines = lines.filter((l) => l.date <= args.to!);
    if (args.gymId) lines = lines.filter((l) => String(l.gymId) === String(args.gymId));

    // نستبعد أسطر الطلبيات الملغاة
    const orderIds = Array.from(new Set(lines.map((l) => String(l.orderId))));
    const voidOrders = new Set<string>();
    for (const oid of orderIds) {
      const o: any = await ctx.db.get(oid as any);
      if (o?.isVoid) voidOrders.add(oid);
    }
    lines = lines.filter((l) => !voidOrders.has(String(l.orderId)));

    // aggregate per meal
    type Row = { key: string; nameEn: string; nameAr: string; sent: number; returned: number; wasteValue: number; unitPriceAvg: number; unitPriceSum: number };
    const perMeal = new Map<string, Row>();
    let sentTotal = 0, returnedTotal = 0, wasteValueTotal = 0, revenueTotal = 0;
    for (const l of lines) {
      const key = l.mealId ? String(l.mealId) : `text:${l.mealNameEn || l.mealNameAr}`;
      const row = perMeal.get(key) || { key, nameEn: l.mealNameEn || "", nameAr: l.mealNameAr || "", sent: 0, returned: 0, wasteValue: 0, unitPriceAvg: 0, unitPriceSum: 0 };
      const rq = Number(l.returnedQty || 0);
      row.sent += l.qty;
      row.returned += rq;
      row.wasteValue += rq * Number(l.unitPrice || 0);
      row.unitPriceSum += Number(l.unitPrice || 0) * l.qty;
      perMeal.set(key, row);
      sentTotal += l.qty;
      returnedTotal += rq;
      wasteValueTotal += rq * Number(l.unitPrice || 0);
      revenueTotal += l.qty * Number(l.unitPrice || 0);
    }
    const meals = Array.from(perMeal.values()).map((r) => ({
      ...r,
      unitPriceAvg: r.sent > 0 ? Math.round((r.unitPriceSum / r.sent) * 100) / 100 : 0,
      net: r.sent - r.returned,
      returnRate: r.sent > 0 ? Math.round((r.returned / r.sent) * 1000) / 10 : 0,
      wasteValue: Math.round(r.wasteValue * 100) / 100,
    })).sort((a, b) => b.returnRate - a.returnRate || b.returned - a.returned);

    return {
      meals,
      totals: {
        sent: sentTotal,
        returned: returnedTotal,
        net: sentTotal - returnedTotal,
        returnRate: sentTotal > 0 ? Math.round((returnedTotal / sentTotal) * 1000) / 10 : 0,
        wasteValue: Math.round(wasteValueTotal * 100) / 100,
        revenue: Math.round(revenueTotal * 100) / 100,
        netRevenue: Math.round((revenueTotal - wasteValueTotal) * 100) / 100,
      },
    };
  },
});

/**
 * قائمة الطلبيات القابلة للتسجيل عليها مرتجعات (آخر 14 يوم).
 *   نرجّع الأسطر مع المرتجعات المسجلة عشان الواجهة تعرض النموذج مباشرة.
 */
export const listOrdersForReturns = query({
  args: {
    days: v.optional(v.number()),
    gymId: v.optional(v.id("gymAccounts")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const days = Math.max(1, Math.min(60, args.days ?? 14));
    const now = new Date();
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    let orders: any[] = await ctx.db.query("gymOrders").withIndex("by_date").collect();
    orders = orders.filter((o) => o.date >= cutoffStr && !o.isVoid);
    if (args.gymId) orders = orders.filter((o) => String(o.gymId) === String(args.gymId));
    orders.sort((a, b) => (a.date < b.date ? 1 : -1));

    const gymNames = new Map<string, string>();
    const out = [];
    for (const o of orders) {
      const gid = String(o.gymId);
      if (!gymNames.has(gid)) {
        const g: any = await ctx.db.get(o.gymId);
        gymNames.set(gid, g?.name || "");
      }
      const lines = await ctx.db.query("gymOrderLines").withIndex("by_order", (q) => q.eq("orderId", o._id)).collect();
      out.push({
        id: String(o._id), date: o.date,
        gymId: gid, gymName: gymNames.get(gid) || "",
        total: o.total, mealsCount: o.mealsCount,
        hasReturns: !!o.hasReturns,
        returnedTotal: Number(o.returnedTotal || 0),
        wasteValue: Number(o.wasteValue || 0),
        netTotal: Number(o.netTotal ?? o.total),
        lines: lines.map((l: any) => ({
          id: String(l._id),
          mealNameEn: l.mealNameEn || "", mealNameAr: l.mealNameAr || "",
          qty: l.qty, unitPrice: l.unitPrice,
          returnedQty: Number(l.returnedQty || 0),
        })),
      });
    }
    return out;
  },
});

/* ═══════════════════════════════ التقارير ═══════════════════════════════ */

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
    orders = orders.filter((o) => o.date >= from && o.date <= to && !o.isVoid);
    if (args.gymId) orders = orders.filter((o) => String(o.gymId) === String(args.gymId));

    const byDay = new Map<string, { date: string; meals: number; total: number }>();
    for (const o of orders) {
      const d = byDay.get(o.date) || { date: o.date, meals: 0, total: 0 };
      d.meals += o.mealsCount;
      d.total = Math.round((d.total + o.total) * 100) / 100;
      byDay.set(o.date, d);
    }
    const days = Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

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
      month: args.month, totalMeals, totalRevenue, totalSubtotal, totalDiscount,
      daysCount: days.length,
      avgPerDay: days.length ? Math.round((totalRevenue / days.length) * 100) / 100 : 0,
      bestDay: days.length ? days.reduce((a, b) => (b.total > a.total ? b : a)) : null,
      worstDay: days.length ? days.reduce((a, b) => (b.total < a.total ? b : a)) : null,
      days, meals,
      orders: orders.map((o: any) => ({ id: String(o._id), date: o.date, total: o.total, mealsCount: o.mealsCount })),
    };
  },
});
