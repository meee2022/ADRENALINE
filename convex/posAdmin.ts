/**
 * @file convex/posAdmin.ts
 * @description إدارة POS (للأدمن): الكاشيرون، فئات POS، ألوان الأصناف، التقارير، الورديات.
 * @frontend client/src/pages/PosAdmin.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireStaff } from "./sessions";
import { hashPassword, verifyPassword } from "./passwords";
import { writeAudit } from "./lib/audit";
import { ONLINE_PRICE_LIST } from "./onlinePriceList";
import { reverseInventoryForTicket } from "./pos";
import { reversePointsForPosTicket } from "./loyalty";

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
        gymPrice: m.gymPrice != null ? Number(m.gymPrice) : null,
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
    if (args.posPrice !== undefined) await requireAdmin(ctx, args.sessionToken);
    else await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db.query("posItems").withIndex("by_meal", (q) => q.eq("mealId", args.mealId)).first();
    const patch: any = { updatedAt: Date.now() };
    if (args.displayName !== undefined) patch.displayName = args.displayName.trim() || undefined;
    if (args.color !== undefined) patch.color = args.color || undefined;
    if (args.posCategoryId !== undefined) patch.posCategoryId = args.posCategoryId;
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
    if (args.isHidden !== undefined) patch.isHidden = args.isHidden;
    if (args.posPrice !== undefined) {
      if (!Number.isFinite(args.posPrice) || args.posPrice < 0) throw new Error("سعر الأونلاين غير صالح");
      patch.posPrice = args.posPrice;
    }
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { id: String(existing._id) };
    }
    const id = await ctx.db.insert("posItems", { mealId: args.mealId, ...patch } as any);
    return { id: String(id) };
  },
});

/** Apply the approved online price list to existing POS items without touching public menu prices. */
export const applyOnlinePriceList = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const meals: any[] = await ctx.db.query("publicMeals").collect();
    const metas: any[] = await ctx.db.query("posItems").collect();
    const metaByMeal = new Map(metas.map((meta) => [String(meta.mealId), meta]));
    const normalize = (value: string) => value.toLowerCase()
      .replace(/&/g, " and ")
      .replace(/\bwith\b|\bw\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\b(chilli|chili)\b/g, "chili")
      .replace(/\b(shishtawook|shish tawook)\b/g, "shish tawook")
      .replace(/\b(falafil|falafel)\b/g, "falafel")
      .replace(/\b(omlette|omelette)\b/g, "omelette")
      .replace(/\b(zuchini|zucchini)\b/g, "zucchini")
      .replace(/\b(mediterraneen|mediterranean)\b/g, "mediterranean")
      .replace(/\s+/g, " ").trim();
    const mealByName = new Map<string, any>();
    for (const meal of meals) {
      for (const raw of [meal.nameEn, meal.nameAr]) {
        const key = normalize(String(raw || ""));
        if (key && !mealByName.has(key)) mealByName.set(key, meal);
      }
    }
    const matched: Array<{ input: string; meal: string; price: number }> = [];
    const created: Array<{ input: string; price: number }> = [];
    const includedMealIds = new Set<string>();
    const slugify = (value: string) => normalize(value).replace(/\s+/g, "-");
    const inferCategory = (name: string): "breakfast" | "lunch" | "dinner" | "salad" | "snack" => {
      const key = normalize(name);
      if (/salad|fattoush/.test(key)) return "salad";
      if (/breakfast|egg|omelette|toast|muffin|shakshouka/.test(key)) return "breakfast";
      if (/cake|ball|brownie|cookie|pudding|tiramisu|basbousa|kunafa|tarte|snickers|ummali|juice|shot|water|chips|fruit|pineapple|pomegranate|mandarin|strawberry|blueberry|drink/.test(key)) return "snack";
      return "lunch";
    };
    for (let index = 0; index < ONLINE_PRICE_LIST.length; index++) {
      const row = ONLINE_PRICE_LIST[index];
      let meal = mealByName.get(normalize(row.name));
      if (!meal) {
        let slug = `online-${slugify(row.name)}`;
        let suffix = 2;
        while (await ctx.db.query("publicMeals").withIndex("by_slug", (q) => q.eq("slug", slug)).first()) {
          slug = `online-${slugify(row.name)}-${suffix++}`;
        }
        const mealId = await ctx.db.insert("publicMeals", {
          nameAr: row.name,
          nameEn: row.name,
          slug,
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          category: inferCategory(row.name),
          tags: [],
          ingredients: [],
          priceQAR: row.price,
          isGymItem: false,
          isGymOnly: false,
          isOnlineOnly: true,
          isActive: true,
          sortOrder: index + 1,
          createdAt: Date.now(),
        });
        meal = await ctx.db.get(mealId);
        created.push({ input: row.name, price: row.price });
      }
      if (!meal) continue;
      includedMealIds.add(String(meal._id));
      const existing = metaByMeal.get(String(meal._id));
      if (existing) await ctx.db.patch(existing._id, { posPrice: row.price, isHidden: false, sortOrder: index + 1, updatedAt: Date.now() });
      else await ctx.db.insert("posItems", { mealId: meal._id, posPrice: row.price, isHidden: false, sortOrder: index + 1, updatedAt: Date.now() } as any);
      matched.push({ input: row.name, meal: meal.nameEn || meal.nameAr, price: row.price });
    }
    let disabled = 0;
    for (const meta of metas) {
      if (meta.posPrice != null && !includedMealIds.has(String(meta.mealId))) {
        await ctx.db.patch(meta._id, { posPrice: undefined, updatedAt: Date.now() });
        disabled++;
      }
    }
    return { total: ONLINE_PRICE_LIST.length, matched, created, unmatched: [], disabled };
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
    // ✅ نطاق زمني عبر الفهرس بدل full-scan
    const tickets: any[] = await ctx.db
      .query("posTickets")
      .withIndex("by_paidAt", (q) => q.gte("paidAt", start).lte("paidAt", end))
      .collect();
    const paidAll = tickets.filter((t) => t.status === "PAID");
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
  args: {
    from: v.string(), to: v.string(),
    // ✅ pagination: مع نمو الفواتير مافيش معنى نجيبها كلها. الافتراضي 200.
    limit: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const start = new Date(args.from + "T00:00:00").getTime();
    const end = new Date(args.to + "T23:59:59.999").getTime();
    const cap = Math.min(1000, Math.max(1, args.limit ?? 200));
    // ✅ استعمل by_paidAt مباشرة: نطاق زمني عبر withIndex بدل full-scan + filter بالذاكرة
    const rows: any[] = await ctx.db
      .query("posTickets")
      .withIndex("by_paidAt", (q) => q.gte("paidAt", start).lte("paidAt", end))
      .order("desc")
      .take(cap);
    return rows.map((t) => ({
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

/**
 * تقرير ربحية الأصناف + Menu Engineering (Star / Puzzle / Plowhorse / Dog).
 * التصنيف قياسي في صناعة المطاعم:
 *   - Star:     مبيعات عالية + هامش عالٍ  ✅ (روّج أكتر)
 *   - Puzzle:   مبيعات منخفضة + هامش عالٍ  🧩 (سوّق ليها)
 *   - Plowhorse: مبيعات عالية + هامش منخفض  🐴 (ارفع سعر أو خفّض تكلفة)
 *   - Dog:      مبيعات منخفضة + هامش منخفض  🐕 (اشطبها)
 * تُحسب مقارنةً بالوسط: عناصر فوق الوسط في المبيعات = "عالي"،
 *   عناصر فوق الوسط في الـmargin% = "عالي".
 */
export const profitabilityReport = query({
  args: {
    from: v.optional(v.string()),   // yyyy-MM-dd
    to: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const start = args.from ? new Date(args.from + "T00:00:00").getTime() : new Date(Date.now() - 30 * 86400000).getTime();
    const end = args.to ? new Date(args.to + "T23:59:59.999").getTime() : Date.now();

    // ✅ نطاق زمني عبر الفهرس (أخفّ بكتير من full-scan للجدول)
    const tickets = (await ctx.db
      .query("posTickets")
      .withIndex("by_paidAt", (q) => q.gte("paidAt", start).lte("paidAt", end))
      .collect())
      .filter((t: any) => t.status === "PAID" && !t.isNonRevenue);
    const ticketIds = new Set(tickets.map((t: any) => String(t._id)));

    // جمّع الأسطر
    type Agg = { mealId: string; name: string; qty: number; revenue: number; cost: number };
    const byMeal = new Map<string, Agg>();
    // خريطة meta الوجبات
    const meals = await ctx.db.query("publicMeals").collect();
    const mealMap = new Map(meals.map((m: any) => [String(m._id), m]));

    for (const t of tickets) {
      const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q) => q.eq("ticketId", t._id)).collect();
      for (const l of lines as any[]) {
        const mid = l.mealId ? String(l.mealId) : `x:${l.name}`;
        const meal: any = l.mealId ? mealMap.get(String(l.mealId)) : null;
        const unitCost = meal?.costQAR != null ? Number(meal.costQAR) : 0;
        const row = byMeal.get(mid) || { mealId: mid, name: meal?.nameEn || meal?.nameAr || l.name, qty: 0, revenue: 0, cost: 0 };
        row.qty += l.qty;
        row.revenue = Math.round((row.revenue + l.lineTotal) * 100) / 100;
        row.cost = Math.round((row.cost + unitCost * l.qty) * 100) / 100;
        byMeal.set(mid, row);
        void ticketIds; // تجنب تحذير غير مستخدم
      }
    }
    const items = Array.from(byMeal.values()).map((r) => {
      const profit = Math.round((r.revenue - r.cost) * 100) / 100;
      const marginPct = r.revenue > 0 ? Math.round((profit / r.revenue) * 1000) / 10 : 0;
      const hasCost = r.cost > 0;
      return { ...r, profit, marginPct, hasCost };
    });

    // Menu Engineering: نقارن مع الوسط للـtqty والـmarginPct
    const withCost = items.filter((i) => i.hasCost);
    const avgQty = withCost.length ? withCost.reduce((s, i) => s + i.qty, 0) / withCost.length : 0;
    const avgMargin = withCost.length ? withCost.reduce((s, i) => s + i.marginPct, 0) / withCost.length : 0;

    const classified = items.map((i) => {
      let category: "star" | "puzzle" | "plowhorse" | "dog" | "no-cost" = "no-cost";
      if (i.hasCost) {
        const highQty = i.qty >= avgQty;
        const highMargin = i.marginPct >= avgMargin;
        category = highQty && highMargin ? "star"
                 : !highQty && highMargin ? "puzzle"
                 : highQty && !highMargin ? "plowhorse"
                 : "dog";
      }
      return { ...i, category };
    });

    const totals = {
      revenue: Math.round(classified.reduce((s, i) => s + i.revenue, 0) * 100) / 100,
      cost:    Math.round(classified.reduce((s, i) => s + i.cost, 0) * 100) / 100,
      profit:  Math.round(classified.reduce((s, i) => s + i.profit, 0) * 100) / 100,
      marginPct: 0,
      itemsSold: classified.reduce((s, i) => s + i.qty, 0),
      itemsWithoutCost: classified.filter((i) => !i.hasCost).length,
      counts: {
        star:      classified.filter((i) => i.category === "star").length,
        puzzle:    classified.filter((i) => i.category === "puzzle").length,
        plowhorse: classified.filter((i) => i.category === "plowhorse").length,
        dog:       classified.filter((i) => i.category === "dog").length,
      },
    };
    totals.marginPct = totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 1000) / 10 : 0;

    classified.sort((a, b) => b.profit - a.profit);
    return {
      from: new Date(start).toISOString().slice(0, 10),
      to: new Date(end).toISOString().slice(0, 10),
      averages: { qty: Math.round(avgQty * 10) / 10, marginPct: Math.round(avgMargin * 10) / 10 },
      totals,
      items: classified,
    };
  },
});

/** سجل تدقيق أحداث POS الحساسة (Void/Refund/Discount/…) للأدمن. */
export const auditTrail = query({
  args: {
    from: v.optional(v.string()),        // yyyy-MM-dd
    to: v.optional(v.string()),
    action: v.optional(v.string()),      // فلتر بنوع الحدث
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const start = args.from ? new Date(args.from + "T00:00:00").getTime() : 0;
    const end = args.to ? new Date(args.to + "T23:59:59.999").getTime() : Date.now();
    // ✅ نطاق زمني عبر الفهرس + take بدل full scan + slice
    let rows: any[] = await ctx.db
      .query("auditLog")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", start).lte("createdAt", end))
      .order("desc")
      .take(500);
    if (args.action) rows = rows.filter((r) => r.action === args.action);
    return rows.map((r: any) => ({
      id: String(r._id),
      createdAt: r.createdAt,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId || null,
      actorName: r.actorName || null,
      actorRole: r.actorRole || null,
      details: r.details ? (() => { try { return JSON.parse(r.details); } catch { return r.details; } })() : null,
    }));
  },
});

/** إلغاء فاتورة مدفوعة (Refund) — مع تسجيل في auditLog. */
export const refundTicket = mutation({
  args: { ticketId: v.id("posTickets"), reason: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await requireStaff(ctx, args.sessionToken);
    const t: any = await ctx.db.get(args.ticketId);
    if (!t) throw new Error("مش موجودة");
    if (t.status === "REFUNDED" || t.status === "VOID") return { ok: true };
    await ctx.db.patch(args.ticketId, { status: "REFUNDED", updatedAt: Date.now() });
    if (t.shiftId && !t.isNonRevenue) {
      const shift: any = await ctx.db.get(t.shiftId);
      if (shift && shift.status === "OPEN") {
        await ctx.db.patch(t.shiftId, {
          totalSales: Math.round((shift.totalSales - t.total) * 100) / 100,
          ticketsCount: Math.max(0, shift.ticketsCount - 1),
        });
      }
    }
    // 🔒 إرجاع المخزون + عكس نقاط الولاء (كان ناقص — الاسترجاع كان بيغيّر الحالة فقط)
    try { await reverseInventoryForTicket(ctx, t.ticketNumber, "refund"); } catch { /* لا نوقف */ }
    if (t.customerId) {
      try { await reversePointsForPosTicket(ctx, String(t.customerId), t.ticketNumber); } catch { /* fail-safe */ }
    }
    const actor: any = id.userId ? await ctx.db.get(id.userId as any) : null;
    await writeAudit(ctx,
      { userId: id.userId ? String(id.userId) : undefined, name: actor?.name, role: id.role },
      "REFUND_TICKET", "posTicket", String(args.ticketId),
      { ticketNumber: t.ticketNumber, prevStatus: t.status, total: t.total, paymentMethod: t.paymentMethod, reason: args.reason || null });
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
