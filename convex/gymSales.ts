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
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireStaff, requireAdmin, requireRoleOrPermission } from "./sessions";

const GYM_FINANCE_ROLES = ["ACCOUNTANT", "FINANCE_MANAGER"];
// صلاحية الصفحة تغطي البيع والمرتجعات وإدارة حسابات الجيم وأصنافه وأسعاره.
const GYM_FINANCE_PAGES = ["/gym-sales"];

const requireGymSalesAccess = (ctx: MutationCtx, sessionToken?: string) =>
  requireRoleOrPermission(ctx, sessionToken, {
    roles: GYM_FINANCE_ROLES,
    permissions: GYM_FINANCE_PAGES,
  });

/* ═══════════════════════════════ إدارة الجمات ═══════════════════════════════ */

export const listGyms = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db.query("gymAccounts").collect();
    rows.sort((a, b) => (a.isActive === b.isActive ? a.name.localeCompare(b.name) : a.isActive ? -1 : 1));
    return rows.map((g) => ({
      id: String(g._id), name: g.name, address: g.address || "",
      outletType: g.outletType || "GYM",
      contactName: g.contactName || "", contactPhone: g.contactPhone || "",
      discountPct: g.discountPct, notes: g.notes || "", isActive: g.isActive,
    }));
  },
});

/** 🔒 إضافة جم — ADMIN فقط (قرار تجاري). */
export const addGym = mutation({
  args: {
    name: v.string(),
    outletType: v.optional(v.union(v.literal("GYM"), v.literal("STORE"), v.literal("KIOSK"), v.literal("OTHER"))),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    discountPct: v.optional(v.number()),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    const name = args.name.trim();
    if (!name) throw new Error("اسم الجم مطلوب");
    const id = await ctx.db.insert("gymAccounts", {
      name,
      outletType: args.outletType || "GYM",
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
    outletType: v.optional(v.union(v.literal("GYM"), v.literal("STORE"), v.literal("KIOSK"), v.literal("OTHER"))),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    discountPct: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.outletType !== undefined) patch.outletType = args.outletType;
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
    await requireGymSalesAccess(ctx, args.sessionToken);
    await ctx.db.patch(args.mealId, {
      gymPrice: args.gymPrice != null && args.gymPrice >= 0 ? args.gymPrice : undefined,
    } as any);
    return { success: true };
  },
});

/** Update the gym-only display names without changing the public menu. */
export const setMealGymNames = mutation({
  args: {
    mealId: v.id("publicMeals"),
    nameAr: v.string(),
    nameEn: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    const meal: any = await ctx.db.get(args.mealId);
    if (!meal || !meal.isActive) {
      throw new Error("الصنف غير موجود");
    }
    const nameAr = args.nameAr.trim();
    const nameEn = args.nameEn.trim();
    if (!nameAr && !nameEn) throw new Error("اكتب اسم الوجبة بالعربي أو الإنجليزي");
    await ctx.db.patch(args.mealId, {
      gymNameAr: nameAr || undefined,
      gymNameEn: nameEn || undefined,
    });
    return { ok: true };
  },
});

/** Create a meal that belongs exclusively to the gym sales catalogue. */
export const createGymMeal = mutation({
  args: {
    nameAr: v.string(),
    nameEn: v.string(),
    category: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("salad"),
      v.literal("snack"),
    ),
    gymPrice: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    const nameAr = args.nameAr.trim();
    const nameEn = args.nameEn.trim();
    if (!nameAr && !nameEn) throw new Error("اكتب اسم الوجبة بالعربي أو الإنجليزي");
    const gymPrice = Number(args.gymPrice);
    if (!Number.isFinite(gymPrice) || gymPrice < 0) throw new Error("سعر الجيم غير صالح");
    const slug = `gym-${Date.now()}-${nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "meal"}`;
    const id = await ctx.db.insert("publicMeals", {
      nameAr: nameAr || nameEn,
      nameEn: nameEn || undefined,
      slug,
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      category: args.category,
      tags: [],
      ingredients: [],
      priceQAR: gymPrice,
      gymPrice,
      gymNameAr: nameAr || undefined,
      gymNameEn: nameEn || undefined,
      isGymItem: true,
      isGymOnly: true,
      isActive: true,
      sortOrder: Date.now(),
      createdAt: Date.now(),
    });
    return { id: String(id) };
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
    const outletRows: any[] = args.gymId
      ? await ctx.db.query("outletCatalogItems").withIndex("by_outlet", (q) => q.eq("outletId", args.gymId!)).collect()
      : [];
    const hasOutletCatalog = outletRows.length > 0;
    const outletByMeal = new Map(outletRows.filter((row) => row.isActive).map((row) => [String(row.mealId), row]));
    return meals
      .filter((m: any) => hasOutletCatalog ? outletByMeal.has(String(m._id)) : !!m.isGymItem)
      .map((m: any) => {
        const listPrice = Number(m.priceQAR) || 0;
        const outletRow: any = outletByMeal.get(String(m._id));
        const hasCustom = outletRow ? true : m.gymPrice != null && m.gymPrice >= 0;
        const effectivePrice = outletRow ? Number(outletRow.price) : hasCustom ? Number(m.gymPrice) : Math.round(listPrice * (1 - discount / 100) * 100) / 100;
        return {
          id: String(m._id), nameEn: m.gymNameEn || m.nameEn || m.nameAr || "",
          nameAr: m.gymNameAr || m.nameAr || m.nameEn || "", category: m.category || "other",
          listPrice, gymPrice: outletRow ? Number(outletRow.price) : hasCustom ? Number(m.gymPrice) : null,
          effectivePrice, isCustom: hasCustom, sortOrder: outletRow?.sortOrder ?? m.sortOrder ?? 0,
          returnAfterDays: Number(m.gymReturnAfterDays || (m.category === "snack" ? 4 : 2)),
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));
  },
});

/** Copy the online/delivery catalogue to one outlet without touching public or global outlet prices. */
export const copyOnlineCatalogToOutlet = mutation({
  args: { outletId: v.id("gymAccounts"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    const outlet: any = await ctx.db.get(args.outletId);
    if (!outlet) throw new Error("المنفذ غير موجود");
    const posRows: any[] = await ctx.db.query("posItems").collect();
    const onlineRows = posRows
      .filter((row) => row.posPrice != null && Number.isFinite(Number(row.posPrice)) && Number(row.posPrice) >= 0)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    const existing: any[] = await ctx.db.query("outletCatalogItems").withIndex("by_outlet", (q) => q.eq("outletId", args.outletId)).collect();
    const byMeal = new Map(existing.map((row) => [String(row.mealId), row]));
    const included = new Set<string>();
    for (let index = 0; index < onlineRows.length; index++) {
      const row = onlineRows[index];
      const meal: any = await ctx.db.get(row.mealId);
      if (!meal || !meal.isActive) continue;
      included.add(String(row.mealId));
      const current: any = byMeal.get(String(row.mealId));
      const values = { price: Number(row.posPrice), isActive: true, sortOrder: index + 1, updatedAt: Date.now() };
      if (current) await ctx.db.patch(current._id, values);
      else await ctx.db.insert("outletCatalogItems", { outletId: args.outletId, mealId: row.mealId, ...values, createdAt: Date.now() });
    }
    for (const row of existing) {
      if (!included.has(String(row.mealId)) && row.isActive) await ctx.db.patch(row._id, { isActive: false, updatedAt: Date.now() });
    }
    return { outletId: String(args.outletId), outletName: outlet.name, total: included.size };
  },
});

/** Full catalogue editor for one outlet, including disabled items and their retained prices. */
export const listOutletCatalogAdmin = query({
  args: { outletId: v.id("gymAccounts"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const outlet: any = await ctx.db.get(args.outletId);
    if (!outlet) throw new Error("المنفذ غير موجود");
    const meals: any[] = await ctx.db.query("publicMeals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    const rows: any[] = await ctx.db.query("outletCatalogItems").withIndex("by_outlet", (q) => q.eq("outletId", args.outletId)).collect();
    const hasOutletCatalog = rows.length > 0;
    const byMeal = new Map(rows.map((row) => [String(row.mealId), row]));
    return meals.map((meal) => {
      const row: any = byMeal.get(String(meal._id));
      const fallbackPrice = meal.gymPrice != null
        ? Number(meal.gymPrice)
        : Math.round(Number(meal.priceQAR || 0) * (1 - Number(outlet.discountPct || 0) / 100) * 100) / 100;
      return {
        id: String(meal._id),
        nameAr: meal.gymNameAr || meal.nameAr || meal.nameEn || "",
        nameEn: meal.gymNameEn || meal.nameEn || meal.nameAr || "",
        category: meal.category,
        menuPrice: Number(meal.priceQAR || 0),
        outletPrice: row ? Number(row.price) : fallbackPrice,
        listPrice: Number(meal.priceQAR || 0),
        gymPrice: row ? Number(row.price) : fallbackPrice,
        effectivePrice: row ? Number(row.price) : fallbackPrice,
        isCustom: !!row,
        isEnabled: row ? !!row.isActive : !hasOutletCatalog && !!meal.isGymItem,
        hasOutletRecord: !!row,
        sortOrder: row?.sortOrder ?? meal.sortOrder ?? 0,
      };
    }).sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled) || a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));
  },
});

/** Enable, disable, or reprice one item for one outlet. Disabled rows retain their price. */
export const setOutletCatalogItem = mutation({
  args: {
    outletId: v.id("gymAccounts"),
    mealId: v.id("publicMeals"),
    isEnabled: v.optional(v.boolean()),
    price: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    const outlet: any = await ctx.db.get(args.outletId);
    const meal: any = await ctx.db.get(args.mealId);
    if (!outlet || !meal) throw new Error("المنفذ أو الصنف غير موجود");
    if (args.price !== undefined && (!Number.isFinite(args.price) || args.price < 0)) throw new Error("سعر المنفذ غير صالح");
    const outletRows: any[] = await ctx.db.query("outletCatalogItems").withIndex("by_outlet", (q) => q.eq("outletId", args.outletId)).collect();
    if (outletRows.length === 0) {
      const legacyMeals: any[] = await ctx.db.query("publicMeals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
      for (const legacyMeal of legacyMeals.filter((item) => item.isGymItem)) {
        const legacyPrice = legacyMeal.gymPrice != null
          ? Number(legacyMeal.gymPrice)
          : Math.round(Number(legacyMeal.priceQAR || 0) * (1 - Number(outlet.discountPct || 0) / 100) * 100) / 100;
        await ctx.db.insert("outletCatalogItems", {
          outletId: args.outletId,
          mealId: legacyMeal._id,
          price: legacyPrice,
          isActive: true,
          sortOrder: legacyMeal.sortOrder ?? 0,
          createdAt: Date.now(),
        });
      }
    }
    const existing: any = await ctx.db.query("outletCatalogItems").withIndex("by_outlet_meal", (q) => q.eq("outletId", args.outletId).eq("mealId", args.mealId)).first();
    const fallbackPrice = meal.gymPrice != null
      ? Number(meal.gymPrice)
      : Math.round(Number(meal.priceQAR || 0) * (1 - Number(outlet.discountPct || 0) / 100) * 100) / 100;
    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: args.isEnabled ?? existing.isActive,
        price: args.price ?? existing.price,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("outletCatalogItems", {
        outletId: args.outletId,
        mealId: args.mealId,
        price: args.price ?? fallbackPrice,
        isActive: args.isEnabled ?? true,
        sortOrder: meal.sortOrder ?? Date.now(),
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/** Create an item exclusively for one outlet and attach its independent price. */
export const createOutletMeal = mutation({
  args: {
    outletId: v.id("gymAccounts"),
    nameAr: v.string(),
    nameEn: v.string(),
    category: v.union(v.literal("breakfast"), v.literal("lunch"), v.literal("dinner"), v.literal("salad"), v.literal("snack")),
    price: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    const outlet = await ctx.db.get(args.outletId);
    if (!outlet) throw new Error("اختر منفذًا صحيحًا");
    const nameAr = args.nameAr.trim();
    const nameEn = args.nameEn.trim();
    if (!nameAr && !nameEn) throw new Error("اكتب اسم الصنف");
    if (!Number.isFinite(args.price) || args.price < 0) throw new Error("سعر المنفذ غير صالح");
    const mealId = await ctx.db.insert("publicMeals", {
      nameAr: nameAr || nameEn,
      nameEn: nameEn || undefined,
      slug: `outlet-${Date.now()}-${(nameEn || nameAr).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item"}`,
      calories: 0, protein: 0, carbs: 0, fats: 0,
      category: args.category,
      tags: [], ingredients: [],
      priceQAR: args.price,
      isGymItem: false,
      isGymOnly: true,
      isOnlineOnly: false,
      isActive: true,
      sortOrder: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("outletCatalogItems", {
      outletId: args.outletId,
      mealId,
      price: args.price,
      isActive: true,
      sortOrder: Date.now(),
      createdAt: Date.now(),
    });
    return { id: String(mealId) };
  },
});

export const listAllMealsForGymAdmin = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const meals = await ctx.db.query("publicMeals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    return meals
      .map((m: any) => ({
        id: String(m._id), nameEn: m.gymNameEn || m.nameEn || m.nameAr || "",
        nameAr: m.gymNameAr || m.nameAr || m.nameEn || "", category: m.category || "other",
        listPrice: Number(m.priceQAR) || 0,
        gymPrice: m.gymPrice != null && m.gymPrice >= 0 ? Number(m.gymPrice) : null,
        isGymItem: !!m.isGymItem,
        returnAfterDays: Number(m.gymReturnAfterDays || (m.category === "snack" ? 4 : 2)),
      }))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  },
});

/** 🔒 إدراج/إزالة صنف من قائمة الجم — ADMIN. */
export const setMealIsGymItem = mutation({
  args: { mealId: v.id("publicMeals"), isGymItem: v.boolean(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    await ctx.db.patch(args.mealId, { isGymItem: args.isGymItem } as any);
    return { ok: true };
  },
});

export const setMealReturnWindow = mutation({
  args: { mealId: v.id("publicMeals"), days: v.number(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    const days = Math.round(args.days);
    if (days < 1 || days > 14) throw new Error("مدة المرتجع يجب أن تكون بين يوم و14 يوماً");
    await ctx.db.patch(args.mealId, { gymReturnAfterDays: days } as any);
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
    await requireGymSalesAccess(ctx, args.sessionToken);
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

/**
 * 🔒 تطبيق أسعار جم بالاسم العربي أو الإنجليزي المباشر (بدون fuzzy).
 *    للاستخدام لما الاسم في PDF يختلف بشدة عن اسم المنيو، والموظف يحدد
 *    المطابقة يدوياً. يقبل arName أو enName أو مجرد id.
 */
export const applyGymPricesByArName = mutation({
  args: {
    rows: v.array(v.object({
      arName: v.optional(v.string()),
      enName: v.optional(v.string()),
      mealId: v.optional(v.id("publicMeals")),
      price: v.number(),
    })),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
    const meals = await ctx.db.query("publicMeals").collect();
    const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

    const matched: any[] = [];
    const unmatched: string[] = [];
    for (const row of args.rows) {
      if (row.price < 0 || row.price > 10000) {
        unmatched.push(`${row.arName || row.enName || row.mealId} (سعر غير صالح)`);
        continue;
      }
      let meal: any = null;
      if (row.mealId) meal = await ctx.db.get(row.mealId);
      if (!meal && row.arName) {
        const target = norm(row.arName);
        meal = meals.find((m: any) => norm(m.nameAr || "") === target);
      }
      if (!meal && row.enName) {
        const target = norm(row.enName);
        meal = meals.find((m: any) => norm(m.nameEn || "") === target);
      }
      if (!meal) {
        unmatched.push(row.arName || row.enName || String(row.mealId));
        continue;
      }
      await ctx.db.patch(meal._id, { gymPrice: row.price, isGymItem: true } as any);
      matched.push({ input: row.arName || row.enName, matched: meal.nameAr || meal.nameEn, price: row.price });
    }
    return { total: args.rows.length, matched: matched.length, unmatched, details: matched };
  },
});

/** 🔒 تحديث جماعي — ADMIN. */
export const bulkSetGymItems = mutation({
  args: { mealIds: v.array(v.id("publicMeals")), isGymItem: v.boolean(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireGymSalesAccess(ctx, args.sessionToken);
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
      returnedTotal: Number(order.returnedTotal || 0),
      wasteValue: Number(order.wasteValue || 0),
      netTotal: Number(order.netTotal ?? order.total),
      isVoid: !!order.isVoid,
      voidedAt: order.voidedAt || null,
      voidReason: order.voidReason || null,
      createdAt: order.createdAt, updatedAt: order.updatedAt,
      lines: lines.map((l: any) => ({
        id: String(l._id),
        mealId: l.mealId ? String(l.mealId) : null,
        mealNameEn: l.mealNameEn || "", mealNameAr: l.mealNameAr || "",
        qty: l.qty, listPrice: l.listPrice, unitPrice: l.unitPrice, lineTotal: l.lineTotal,
        returnedQty: Number(l.returnedQty || 0),
        wasteValue: Math.round(Number(l.returnedQty || 0) * Number(l.unitPrice || 0) * 100) / 100,
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
        returnedTotal: Number(r.returnedTotal || 0),
        wasteValue: Number(r.wasteValue || 0),
        netTotal: Number(r.netTotal ?? r.total),
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
  const outletRows: any[] = await ctx.db.query("outletCatalogItems").withIndex("by_outlet", (q: any) => q.eq("outletId", gym._id)).collect();
  const hasOutletCatalog = outletRows.length > 0;
  const outletByMeal = new Map(outletRows.filter((row) => row.isActive).map((row) => [String(row.mealId), row]));
  for (const l of clientLines) {
    const qty = Math.max(0, Math.round(Number(l.qty) || 0));
    if (qty === 0) continue;
    if (!l.mealId) throw new Error("mealId مطلوب لكل سطر");
    const meal: any = await ctx.db.get(l.mealId);
    if (!meal || !meal.isActive) throw new Error("وجبة غير متوفرة");
    const outletRow: any = outletByMeal.get(String(meal._id));
    if (hasOutletCatalog && !outletRow) throw new Error("الصنف غير متاح في هذا المنفذ");
    const listPrice = Number(meal.priceQAR) || 0;
    const hasCustom = meal.gymPrice != null && meal.gymPrice >= 0;
    const unitPrice = outletRow
      ? Number(outletRow.price)
      : hasCustom
      ? Number(meal.gymPrice)
      : Math.round(listPrice * (1 - discountPct / 100) * 100) / 100;
    if (unitPrice < 0) throw new Error("سعر غير صالح");
    subtotal += listPrice * qty;
    total += unitPrice * qty;
    mealsCount += qty;
    out.push({
      mealId: meal._id,
      mealNameEn: meal.gymNameEn || meal.nameEn || meal.nameAr || "",
      mealNameAr: meal.gymNameAr || meal.nameAr || meal.nameEn || "",
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
    const sess: any = await requireRoleOrPermission(ctx, args.sessionToken, { roles: GYM_FINANCE_ROLES, permissions: GYM_FINANCE_PAGES });
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
    await requireRoleOrPermission(ctx, args.sessionToken, { roles: GYM_FINANCE_ROLES, permissions: GYM_FINANCE_PAGES });
    const existing: any = await ctx.db.get(args.orderId);
    if (!existing) throw new Error("الطلبية غير موجودة");
    if (existing.isVoid) throw new Error("مش مسموح تعدّل طلبية ملغاة");
    const gym: any = await ctx.db.get(args.gymId);
    if (!gym) throw new Error("الجم غير موجود");

    const built = await buildGymOrderLines(ctx, gym, args.lines);

    const oldLines = await ctx.db.query("gymOrderLines").withIndex("by_order", (q) => q.eq("orderId", args.orderId)).collect();
    const returnedByMeal = new Map(oldLines.map((line: any) => [String(line.mealId), Number(line.returnedQty || 0)]));
    let returnedTotal = 0;
    let wasteValue = 0;
    for (const line of built.lines) {
      const returnedQty = returnedByMeal.get(String(line.mealId)) || 0;
      if (returnedQty > line.qty) {
        throw new Error(`لا يمكن تقليل ${line.mealNameAr || line.mealNameEn} عن الكمية المرتجعة (${returnedQty})`);
      }
      returnedTotal += returnedQty;
      wasteValue += returnedQty * line.unitPrice;
    }
    wasteValue = Math.round(wasteValue * 100) / 100;
    const netTotal = Math.round((built.total - wasteValue) * 100) / 100;
    for (const l of oldLines) await ctx.db.delete(l._id);

    await ctx.db.patch(args.orderId, {
      date: args.date, gymId: args.gymId,
      discountPct: gym.discountPct,
      subtotal: built.subtotal, discountAmount: built.discountAmount,
      total: built.total, mealsCount: built.mealsCount,
      notes: args.notes?.trim() || undefined,
      hasReturns: returnedTotal > 0,
      returnedTotal,
      wasteValue,
      netTotal,
      updatedAt: Date.now(),
    });
    for (const l of built.lines) {
      await ctx.db.insert("gymOrderLines", {
        orderId: args.orderId, date: args.date, gymId: args.gymId,
        mealId: l.mealId,
        mealNameEn: l.mealNameEn, mealNameAr: l.mealNameAr,
        qty: l.qty, listPrice: l.listPrice,
        unitPrice: l.unitPrice, lineTotal: l.lineTotal,
        returnedQty: returnedByMeal.get(String(l.mealId)) || undefined,
      });
    }
    return {
      success: true, subtotal: built.subtotal,
      discountAmount: built.discountAmount,
      total: built.total, mealsCount: built.mealsCount,
      returnedTotal, wasteValue, netTotal,
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
    returnDate: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireRoleOrPermission(ctx, args.sessionToken, { roles: GYM_FINANCE_ROLES, permissions: GYM_FINANCE_PAGES });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.returnDate)) throw new Error("تاريخ المرتجع غير صالح");
    const order: any = await ctx.db.get(args.orderId);
    if (!order) throw new Error("الطلبية غير موجودة");
    if (order.isVoid) throw new Error("مش مسموح على طلبية ملغاة");
    if (args.returnDate < order.date) throw new Error("تاريخ المرتجع لا يمكن أن يسبق تاريخ الفاتورة");

    const lines = await ctx.db
      .query("gymOrderLines")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    const linesById = new Map(lines.map((l) => [String(l._id), l]));

    const batchLines: Array<{ line: any; qty: number; expectedAfterDays: number }> = [];
    for (const r of args.returns) {
      const line: any = linesById.get(String(r.lineId));
      if (!line) throw new Error("سطر غير موجود في الطلبية");
      const q = Math.max(0, Math.round(Number(r.qty) || 0));
      if (q === 0) continue;
      const alreadyReturned = Number(line.returnedQty || 0);
      if (alreadyReturned + q > line.qty) throw new Error(`إجمالي المرتجع أكبر من المتبقي لصنف ${line.mealNameEn || line.mealNameAr}`);
      const meal: any = line.mealId ? await ctx.db.get(line.mealId) : null;
      const expectedAfterDays = Number(meal?.gymReturnAfterDays || (meal?.category === "snack" ? 4 : 2));
      batchLines.push({ line, qty: q, expectedAfterDays });
    }
    if (batchLines.length === 0) throw new Error("أدخل كمية مرتجع واحدة على الأقل");

    const batchQty = batchLines.reduce((sum, item) => sum + item.qty, 0);
    const batchWaste = Math.round(batchLines.reduce((sum, item) => sum + item.qty * Number(item.line.unitPrice || 0), 0) * 100) / 100;
    const returnId = await ctx.db.insert("gymReturnBatches", {
      orderId: args.orderId,
      gymId: order.gymId,
      orderDate: order.date,
      returnDate: args.returnDate,
      totalQty: batchQty,
      wasteValue: batchWaste,
      recordedBy: String((actor as any).userId || (actor as any).role || "staff"),
      createdAt: Date.now(),
    });
    for (const item of batchLines) {
      const line = item.line;
      await ctx.db.patch(line._id, { returnedQty: Number(line.returnedQty || 0) + item.qty });
      await ctx.db.insert("gymReturnBatchLines", {
        returnId,
        orderId: args.orderId,
        orderLineId: line._id,
        mealId: line.mealId,
        mealNameEn: line.mealNameEn,
        mealNameAr: line.mealNameAr,
        qty: item.qty,
        unitPrice: Number(line.unitPrice || 0),
        wasteValue: Math.round(item.qty * Number(line.unitPrice || 0) * 100) / 100,
        expectedAfterDays: item.expectedAfterDays,
      });
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
      returnsRecordedBy: String((actor as any).userId || (actor as any).role || "staff"),
      returnedTotal, wasteValue, netTotal,
      updatedAt: Date.now(),
    });
    return { returnId: String(returnId), batchQty, batchWaste, returnedTotal, wasteValue, netTotal };
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
    date: v.optional(v.string()),
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
    orders = orders.filter((o) => !o.isVoid && (args.date ? o.date === args.date : o.date >= cutoffStr));
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
      const batches = await ctx.db.query("gymReturnBatches").withIndex("by_order", (q) => q.eq("orderId", o._id)).collect();
      out.push({
        id: String(o._id), date: o.date,
        gymId: gid, gymName: gymNames.get(gid) || "",
        total: o.total, mealsCount: o.mealsCount,
        hasReturns: !!o.hasReturns,
        returnedTotal: Number(o.returnedTotal || 0),
        wasteValue: Number(o.wasteValue || 0),
        netTotal: Number(o.netTotal ?? o.total),
        batches: batches.sort((a, b) => b.returnDate.localeCompare(a.returnDate)).map((batch: any) => ({
          id: String(batch._id), returnDate: batch.returnDate, totalQty: batch.totalQty, wasteValue: batch.wasteValue,
        })),
        lines: await Promise.all(lines.map(async (l: any) => {
          const meal: any = l.mealId ? await ctx.db.get(l.mealId) : null;
          const returnAfterDays = Number(meal?.gymReturnAfterDays || (meal?.category === "snack" ? 4 : 2));
          const expected = new Date(`${o.date}T12:00:00`); expected.setDate(expected.getDate() + returnAfterDays);
          return {
          id: String(l._id),
          mealNameEn: l.mealNameEn || "", mealNameAr: l.mealNameAr || "",
          qty: l.qty, unitPrice: l.unitPrice,
          returnedQty: Number(l.returnedQty || 0),
          remainingQty: Math.max(0, Number(l.qty) - Number(l.returnedQty || 0)),
          returnAfterDays,
          expectedReturnDate: expected.toISOString().slice(0, 10),
        }; })),
      });
    }
    return out;
  },
});

/* ═══════════════════════════════ التقارير ═══════════════════════════════ */

export const monthlyReport = query({
  args: {
    month: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    gymId: v.optional(v.id("gymAccounts")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRoleOrPermission(ctx, args.sessionToken, { roles: GYM_FINANCE_ROLES, permissions: GYM_FINANCE_PAGES });
    const from = args.from || (args.month ? `${args.month}-01` : "");
    const to = args.to || (args.month ? `${args.month}-31` : "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      throw new Error("نطاق التاريخ غير صالح");
    }
    let orders: any[] = await ctx.db.query("gymOrders").withIndex("by_date").collect();
    orders = orders.filter((o) => o.date >= from && o.date <= to && !o.isVoid);
    if (args.gymId) orders = orders.filter((o) => String(o.gymId) === String(args.gymId));

    // 💰 المرتجع تالف ولا يُحاسَب عليه المنفذ، فالمستحق الفعلي = الإجمالي − قيمة الهالك.
    //    netTotal متخزّنة على الطلبية (تُحسب في updateOrder/recordReturns)؛ الطلبيات
    //    القديمة قبل ميزة المرتجعات ما فيهاش الحقل، فنرجع لـtotal (لا مرتجعات = الصافي هو الإجمالي).
    const netOf = (o: any) => Number(o.netTotal ?? o.total);

    const byDay = new Map<string, { date: string; meals: number; total: number; waste: number; net: number; returned: number }>();
    for (const o of orders) {
      const d = byDay.get(o.date) || { date: o.date, meals: 0, total: 0, waste: 0, net: 0, returned: 0 };
      d.meals += o.mealsCount;
      d.total = Math.round((d.total + o.total) * 100) / 100;
      d.waste = Math.round((d.waste + Number(o.wasteValue || 0)) * 100) / 100;
      d.net = Math.round((d.net + netOf(o)) * 100) / 100;
      d.returned += Number(o.returnedTotal || 0);
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
    const totalWasteValue = Math.round(orders.reduce((s, o) => s + Number(o.wasteValue || 0), 0) * 100) / 100;
    const totalReturned = orders.reduce((s, o) => s + Number(o.returnedTotal || 0), 0);
    /** المستحق الفعلي على المنفذ بعد خصم المرتجعات. */
    const netRevenue = Math.round(orders.reduce((s, o) => s + netOf(o), 0) * 100) / 100;
    const deliveredMeals = totalMeals - totalReturned;

    return {
      month: args.month, from, to, totalMeals, totalRevenue, totalSubtotal, totalDiscount,
      totalWasteValue, totalReturned, netRevenue, deliveredMeals,
      daysCount: days.length,
      avgPerDay: days.length ? Math.round((netRevenue / days.length) * 100) / 100 : 0,
      bestDay: days.length ? days.reduce((a, b) => (b.total > a.total ? b : a)) : null,
      worstDay: days.length ? days.reduce((a, b) => (b.total < a.total ? b : a)) : null,
      days, meals,
      orders: orders.map((o: any) => ({ id: String(o._id), date: o.date, total: o.total, mealsCount: o.mealsCount })),
    };
  },
});

/* ═══════════════════════ تقرير القرار (Decision report) ═══════════════════════
 *
 *   السؤال اللي بيجاوب عليه: إيه اللي بيكسّب؟ إيه اللي بيخسّر؟ إيه اللي نوقفه؟
 *
 *   ═══ الخسارة ═══
 *   المرتجع تالف (صلاحية يومين للرئيسي / 4 للحلويات) ⇒ قيمته خسارة فعلية،
 *   والمنفذ لا يُحاسَب عليه. فـ: الصافي المستحق = الإجمالي − قيمة الهالك.
 *
 *   ═══ الربح ═══
 *   ⚠️ الربح = الإيراد − التكلفة، والتكلفة (publicMeals.costQAR) اختيارية
 *   وغير معبّأة حالياً لأي وجبة. فبدل ما نخترع رقم: نحسب الربح فقط للأصناف
 *   اللي لها تكلفة، ونرجّع costCoverage عشان التقرير يقول للمدير صراحةً
 *   إن الربح غير متاح ولماذا. تتعبّى التكلفة من صفحة إدارة الوجبات العامة.
 *
 *   ═══ عتبات "أوقف/قلّل" ═══
 *   معايَرة على البيانات الفعلية (مرتجعات 62.5% / 25% / 9.1%):
 *     ≥ 40% ⇒ أوقف   — أكتر من ثلث الإنتاج بيترمي
 *     ≥ 15% ⇒ قلّل   — هدر ملحوظ لكن الصنف بيتباع
 *     <  15% ⇒ مقبول
 *   MIN_SAMPLE: لا نحكم على صنف اتوردّ أقل من 5 مرات — عيّنة صغيرة تدي
 *   نِسَب مضلّلة (مرتجع واحد من 2 = 50% وده مش دليل على حاجة).
 *   ═══════════════════════════════════════════════════════════════════════════ */

const STOP_RATE = 40;
const REDUCE_RATE = 15;
const MIN_SAMPLE = 5;

export const decisionReport = query({
  args: {
    from: v.string(),
    to: v.string(),
    gymId: v.optional(v.id("gymAccounts")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRoleOrPermission(ctx, args.sessionToken, { roles: GYM_FINANCE_ROLES, permissions: GYM_FINANCE_PAGES });
    const { from, to } = args;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      throw new Error("نطاق التاريخ غير صالح");
    }

    let orders: any[] = await ctx.db.query("gymOrders").withIndex("by_date").collect();
    orders = orders.filter((o) => o.date >= from && o.date <= to && !o.isVoid);
    if (args.gymId) orders = orders.filter((o) => String(o.gymId) === String(args.gymId));
    const orderIds = new Set(orders.map((o) => String(o._id)));

    let lines: any[] = await ctx.db.query("gymOrderLines").withIndex("by_date").collect();
    lines = lines.filter((l) => l.date >= from && l.date <= to && orderIds.has(String(l.orderId)));

    // تكلفة الوجبة (لو معبّاة) — نقرأها مرة واحدة لكل mealId
    const costById = new Map<string, number>();
    for (const id of new Set(lines.map((l) => l.mealId).filter(Boolean).map(String))) {
      const m: any = await ctx.db.get(id as any);
      const c = Number(m?.costQAR || 0);
      if (c > 0) costById.set(id, c);
    }

    const byMeal = new Map<string, any>();
    for (const l of lines) {
      const key = l.mealId ? String(l.mealId) : `text:${l.mealNameEn || l.mealNameAr}`;
      const row = byMeal.get(key) || {
        key, nameAr: l.mealNameAr || "", nameEn: l.mealNameEn || "",
        unitPrice: Number(l.unitPrice || 0),
        sent: 0, returned: 0, revenue: 0, wasteValue: 0,
        unitCost: l.mealId ? (costById.get(String(l.mealId)) ?? null) : null,
      };
      const ret = Number(l.returnedQty || 0);
      row.sent += Number(l.qty || 0);
      row.returned += ret;
      row.revenue = Math.round((row.revenue + Number(l.lineTotal || 0)) * 100) / 100;
      row.wasteValue = Math.round((row.wasteValue + ret * Number(l.unitPrice || 0)) * 100) / 100;
      byMeal.set(key, row);
    }

    const meals = Array.from(byMeal.values()).map((r) => {
      const soldQty = r.sent - r.returned;                       // المُستهلك فعلاً
      const netRevenue = Math.round((r.revenue - r.wasteValue) * 100) / 100;
      const returnRate = r.sent ? Math.round((r.returned / r.sent) * 1000) / 10 : 0;

      // الربح: فقط لو التكلفة معروفة. التكلفة تُدفع على كل وحدة أُنتجت (بما فيها
      // المرتجع التالف — اتصنع واترمى)، فالتكلفة على r.sent مش على soldQty.
      const hasCost = r.unitCost != null && r.unitCost > 0;
      const totalCost = hasCost ? Math.round(r.unitCost * r.sent * 100) / 100 : null;
      const profit = hasCost ? Math.round((netRevenue - (totalCost as number)) * 100) / 100 : null;
      const margin = hasCost && netRevenue > 0 ? Math.round(((profit as number) / netRevenue) * 1000) / 10 : null;

      // الصياغة تظهر في مستند رسمي يُسلَّم للإدارة — عربية فصحى، بصيغة الخبر
      // لا الأمر، وبلا عاميّة.
      let verdict: "STOP" | "REDUCE" | "OK" = "OK";
      let reason = "";
      if (r.sent >= MIN_SAMPLE && returnRate >= STOP_RATE) {
        verdict = "STOP";
        reason = `تُرتجع ${returnRate}% من الكمية المورّدة هالكةً — بقيمة ${r.wasteValue.toFixed(2)} ر.ق`;
      } else if (r.sent >= MIN_SAMPLE && returnRate >= REDUCE_RATE) {
        verdict = "REDUCE";
        reason = `نسبة ارتجاع ${returnRate}% — يُوصى بتخفيض الكمية المورّدة`;
      } else if (hasCost && (profit as number) < 0) {
        verdict = "STOP";
        reason = `سعر البيع أقل من التكلفة — خسارة ${Math.abs(profit as number).toFixed(2)} ر.ق`;
      }

      return { ...r, soldQty, netRevenue, returnRate, totalCost, profit, margin, verdict, reason };
    });

    meals.sort((a, b) => b.soldQty - a.soldQty);

    const totalRevenue = Math.round(meals.reduce((s, m) => s + m.revenue, 0) * 100) / 100;
    const totalWaste = Math.round(meals.reduce((s, m) => s + m.wasteValue, 0) * 100) / 100;
    const netRevenue = Math.round((totalRevenue - totalWaste) * 100) / 100;
    const totalSent = meals.reduce((s, m) => s + m.sent, 0);
    const totalReturned = meals.reduce((s, m) => s + m.returned, 0);

    const costed = meals.filter((m) => m.totalCost != null);
    const costCoverage = {
      mealsTotal: meals.length,
      mealsWithCost: costed.length,
      /** الربح متاح فقط لو كل الأصناف لها تكلفة — أي نقص يخلّي الرقم مضلّلاً. */
      profitAvailable: costed.length > 0 && costed.length === meals.length,
      revenueSharePct: totalRevenue > 0
        ? Math.round((costed.reduce((s, m) => s + m.revenue, 0) / totalRevenue) * 1000) / 10
        : 0,
    };
    const totalCost = costed.length ? Math.round(costed.reduce((s, m) => s + (m.totalCost as number), 0) * 100) / 100 : null;
    const totalProfit = costCoverage.profitAvailable ? Math.round((netRevenue - (totalCost as number)) * 100) / 100 : null;

    return {
      from, to,
      totals: {
        totalRevenue, totalWaste, netRevenue, totalSent, totalReturned,
        soldQty: totalSent - totalReturned,
        wastePct: totalSent ? Math.round((totalReturned / totalSent) * 1000) / 10 : 0,
        totalCost, totalProfit,
      },
      costCoverage,
      topSellers: [...meals].filter((m) => m.soldQty > 0).slice(0, 10),
      actions: meals.filter((m) => m.verdict !== "OK")
        .sort((a, b) => b.wasteValue - a.wasteValue),
      meals,
      thresholds: { STOP_RATE, REDUCE_RATE, MIN_SAMPLE },
    };
  },
});
