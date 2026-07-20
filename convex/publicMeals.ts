/**
 * @file convex/publicMeals.ts
 * @description إدارة الوجبات العامة للموقع
 */
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireStaff, requireRole, validateSession } from "./sessions";
import { v } from "convex/values";

// 🔒 صلاحيات المنيو — إدارة الوجبات لأدوار التغذية والمنيو، مش لأي staff
const MENU_MANAGE_ROLES = ["NUTRITIONIST"]; // ADMIN تلقائي

/**
 * 🔒 DTO عام — بدون costQAR (تكلفة داخلية) ولا gymPrice/isGymItem (أسعار الجم).
 *    يُظهر النشط فقط. schedule/weeks/days مسموح — العميل يحتاجها في SmartPlan
 *    عشان يعرف الوجبة متاحة أنهي يوم في دورة المنيو (مش سر تشغيلي).
 *    لعرض إداري كامل: adminList (staff فقط).
 */
function publicMealDTO(m: any, imageUrl?: string | null) {
  return {
    _id: m._id,
    nameAr: m.nameAr,
    nameEn: m.nameEn || "",
    slug: m.slug,
    descriptionAr: m.descriptionAr || "",
    descriptionEn: m.descriptionEn || "",
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fats: m.fats,
    category: m.category,
    tags: m.tags || [],
    ingredients: m.ingredients || [],
    priceQAR: m.priceQAR,
    imageUrl: imageUrl ?? m.imageUrl ?? null,
    sortOrder: m.sortOrder,
    // ✅ يجدولة المنيو — يحتاجها SmartPlan لعرض بدائل نفس اليوم لعميل
    schedule: m.schedule || undefined,
    weeks: m.weeks || undefined,
    days: m.days || undefined,
    // ❌ NOT included: costQAR, gymPrice, isGymItem (تكلفة/تسعير جم داخلية)
  };
}

/**
 * قائمة الوجبات.
 * - بدون sessionToken أو جلسة غير staff → النشط فقط + DTO منزوع الحقول الداخلية.
 * - staff بجلسة صالحة → الوثيقة كاملة (بما فيها costQAR/schedule/gymPrice/isActive)
 *   للتوافق مع شاشات الإدارة الحالية.
 */
export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = args.sessionToken ? await validateSession(ctx, args.sessionToken) : null;
    const isStaff = identity?.accountType === "staff";
    if (isStaff) {
      const all = await ctx.db.query("publicMeals").collect();
      return Promise.all(
        all.map(async (meal) => {
          const imageUrl = meal.storageId ? await ctx.storage.getUrl(meal.storageId) : null;
          return imageUrl ? { ...meal, imageUrl } : meal;
        })
      );
    }
    const meals = await ctx.db
      .query("publicMeals")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const publicMeals = meals.filter((meal: any) => !meal.isGymOnly && !meal.isOnlineOnly);
    return Promise.all(
      publicMeals.map(async (meal) => {
        const imageUrl = meal.storageId ? await ctx.storage.getUrl(meal.storageId) : null;
        return publicMealDTO(meal, imageUrl);
      })
    );
  },
});

/** 🔒 قائمة إدارية كاملة — للموظفين فقط. */
export const adminList = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const meals = await ctx.db.query("publicMeals").collect();
    return Promise.all(
      meals.map(async (meal) => {
        if (meal.storageId) {
          const imageUrl = await ctx.storage.getUrl(meal.storageId);
          return { ...meal, imageUrl };
        }
        return meal;
      })
    );
  },
});

/**
 * قائمة المنيو للموقع العام — النشط فقط، DTO منزوع الحقول الداخلية.
 * تُبقى العلامة hasAbout للواجهة (نص تفاصيل قابل للتحميل عند فتح المنيو).
 */
export const listMeals = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = args.sessionToken ? await validateSession(ctx, args.sessionToken) : null;
    const isStaff = identity?.accountType === "staff";
    let results = isStaff
      ? await ctx.db.query("publicMeals").collect()
      : await ctx.db.query("publicMeals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    if (!isStaff) results = results.filter((meal: any) => !meal.isGymOnly && !meal.isOnlineOnly);

    if (args.category && args.category !== "الكل") {
      results = results.filter((m) => m.category === args.category);
    }
    if (args.search) {
      const s = args.search.toLowerCase();
      results = results.filter(
        (m) => m.nameAr?.toLowerCase().includes(s) || m.nameEn?.toLowerCase().includes(s)
      );
    }

    return Promise.all(
      results.map(async (meal) => {
        const hasAbout = Boolean(String((meal as any).aboutAr || "").trim() || String((meal as any).aboutEn || "").trim());
        const imageUrl = meal.storageId ? await ctx.storage.getUrl(meal.storageId) : null;
        if (isStaff) {
          // للأدمن: الوثيقة كاملة (aboutAr/En مستبعدين لتقليل الحجم — يُقرأ من getBySlug/getById)
          const { aboutAr, aboutEn, ...light } = meal as any;
          return { ...light, hasAbout, imageUrl };
        }
        return { ...publicMealDTO(meal, imageUrl), hasAbout };
      })
    );
  },
});

/** 🔒 يحوّل عام/إداري حسب وجود جلسة موظف. */
async function toMealResponse(ctx: any, meal: any, sessionToken?: string) {
  const imageUrl = meal.storageId ? await ctx.storage.getUrl(meal.storageId) : null;
  if (sessionToken) {
    const id = await validateSession(ctx, sessionToken);
    if (id?.accountType === "staff") {
      return imageUrl ? { ...meal, imageUrl } : meal;
    }
  }
  return publicMealDTO(meal, imageUrl);
}

export const getById = query({
  args: { id: v.id("publicMeals"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const meal = await ctx.db.get(args.id);
    if (!meal) return null;
    // للزائر: نُظهر النشط فقط + DTO منزوع الحقول الداخلية
    const isStaffCall = !!args.sessionToken && (await validateSession(ctx, args.sessionToken))?.accountType === "staff";
    if (!isStaffCall && (!(meal as any).isActive || (meal as any).isGymOnly || (meal as any).isOnlineOnly)) return null;
    return await toMealResponse(ctx, meal, args.sessionToken);
  },
});

export const getBySlug = query({
  args: { slug: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const meal = await ctx.db
      .query("publicMeals")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!meal) return null;
    const isStaffCall = !!args.sessionToken && (await validateSession(ctx, args.sessionToken))?.accountType === "staff";
    if (!isStaffCall && (!(meal as any).isActive || (meal as any).isGymOnly || (meal as any).isOnlineOnly)) return null;
    return await toMealResponse(ctx, meal, args.sessionToken);
  },
});

export const create = mutation({
  args: {
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    slug: v.string(),
    descriptionAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    aboutAr: v.optional(v.string()),
    aboutEn: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")), // NEW
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fats: v.number(),
    tags: v.array(v.string()),
    ingredients: v.optional(v.array(v.string())),
    category: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("salad"),
      v.literal("snack")
    ),
    priceQAR: v.optional(v.number()),
    costQAR: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    isOnlineOnly: v.optional(v.boolean()),
    // NEW: Scheduling
    weeks: v.optional(v.array(v.number())),
    days: v.optional(v.array(v.string())),
    schedule: v.optional(v.array(v.object({ week: v.number(), day: v.string() }))),
    cutoffTime: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, MENU_MANAGE_ROLES); // 🔒 NUTRITIONIST/ADMIN
    // 🔒 validation
    validateMealFields(args);
    // 🔒 slug فريد
    const dupSlug = await ctx.db.query("publicMeals").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (dupSlug) throw new Error("slug مكرر — اختر واحد مختلف");
    const mealId = await ctx.db.insert("publicMeals", {
      nameAr: args.nameAr,
      nameEn: args.nameEn,
      slug: args.slug,
      descriptionAr: args.descriptionAr,
      descriptionEn: args.descriptionEn,
      aboutAr: args.aboutAr,
      aboutEn: args.aboutEn,
      imageUrl: args.imageUrl,
      storageId: args.storageId, // NEW
      calories: args.calories,
      protein: args.protein,
      carbs: args.carbs,
      fats: args.fats,
      tags: args.tags,
      ingredients: args.ingredients || [],
      category: args.category,
      priceQAR: args.priceQAR || 0,
      sortOrder: args.sortOrder || 999,
      isActive: args.isActive ?? true,
      isOnlineOnly: args.isOnlineOnly ?? false,
      weeks: args.weeks,
      days: args.days,
      schedule: args.schedule,
      cutoffTime: args.cutoffTime,
      createdAt: Date.now(),
    });
    return mealId;
  },
});

export const update = mutation({
  args: {
    id: v.id("publicMeals"),
    nameAr: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    slug: v.optional(v.string()),
    descriptionAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    aboutAr: v.optional(v.string()),
    aboutEn: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fats: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    ingredients: v.optional(v.array(v.string())),
    category: v.optional(v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("salad"),
      v.literal("snack")
    )),
    priceQAR: v.optional(v.number()),
    costQAR: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    isOnlineOnly: v.optional(v.boolean()),
    // NEW: Scheduling
    weeks: v.optional(v.array(v.number())),
    days: v.optional(v.array(v.string())),
    schedule: v.optional(v.array(v.object({ week: v.number(), day: v.string() }))),
    cutoffTime: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, MENU_MANAGE_ROLES); // 🔒
    const { id, sessionToken: _t, ...updates } = args;
    validateMealFields(updates);
    if (updates.slug) {
      const dup = await ctx.db.query("publicMeals").withIndex("by_slug", (q) => q.eq("slug", updates.slug!)).first();
      if (dup && String(dup._id) !== String(id)) throw new Error("slug مكرر");
    }
    await ctx.db.patch(id, updates);
    return id;
  },
});

/**
 * 🔒 حذف = ref-check صارم. الوجبة المستخدَمة في طلبات/خطط/رسيبيات/POS/gym
 *    لا تُحذف — عطّلها بـisActive:false بديلاً.
 */
export const remove = mutation({
  args: { id: v.id("publicMeals"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken); // 🔒 حذف نهائي = ADMIN

    /* 🔒 فحص المراجع — كل جدول يشير إلى publicMeals.
     *
     *   🔴 كان يفحص 3 جداول فقط (الطلبات · فواتير POS · طلبات الجم) من أصل 8.
     *   فوجبة موجودة في كتالوج المنافذ أو أصناف POS أو حصر الصادر أو
     *   التقييمات أو مرتجعات الجم — ولا شيء غيرها — كانت تُحذف بنجاح
     *   ويفضل المرجع معلّقاً على وجبة غير موجودة، بلا أي خطأ ظاهر.
     *   (حالة حقيقية: «فتوش كلاسيكي» مستخدمة في كتالوج المنافذ فقط.)
     */
    const id = String(args.id);
    const has = (rows: any[], key: string) => rows.some((r: any) => String(r[key] ?? "") === id);

    const orderItems = await ctx.db.query("customerOrderItems").withIndex("by_mealId", (q) => q.eq("mealId", args.id)).take(1);
    if (orderItems.length) throw new Error("الوجبة مستخدمة في طلبات — عطّلها بدل الحذف");

    if (has(await ctx.db.query("posTicketLines").collect(), "mealId")) {
      throw new Error("الوجبة مستخدمة في فواتير POS — عطّلها بدل الحذف");
    }
    if (has(await ctx.db.query("gymOrderLines").collect(), "mealId")) {
      throw new Error("الوجبة مستخدمة في طلبات المنافذ — عطّلها بدل الحذف");
    }
    if (has(await ctx.db.query("gymReturnBatchLines").collect(), "mealId")) {
      throw new Error("الوجبة مستخدمة في مرتجعات المنافذ — عطّلها بدل الحذف");
    }
    if (has(await ctx.db.query("outletCatalogItems").collect(), "mealId")) {
      throw new Error("الوجبة موجودة في كتالوج المنافذ — احذفها منه أولاً");
    }
    if (has(await ctx.db.query("posItems").collect(), "mealId")) {
      throw new Error("الوجبة موجودة في أصناف نقطة البيع — احذفها منها أولاً");
    }
    if (has(await ctx.db.query("mealIssuances").collect(), "publicMealId")) {
      throw new Error("الوجبة مستخدمة في حصر الصادر — عطّلها بدل الحذف");
    }
    if (has(await ctx.db.query("ratings").collect(), "publicMealId")) {
      throw new Error("الوجبة عليها تقييمات عملاء — عطّلها بدل الحذف");
    }
    // 🔗 ربط الخطة اليدوية (menuItems.publicMealId) — حذفها يقطع الجسر
    //    فتختفي الوجبة من خطة الأخصائية بصمت.
    if (has(await ctx.db.query("menuItems").collect(), "publicMealId")) {
      throw new Error("الوجبة مربوطة بصنف في منيو المطبخ — فُكّ الربط أولاً");
    }
    // ⚠️ dailyPlans.items نوعه v.any(): الـmealId بداخله ليس مفتاحاً في
    //    السكيما، فلا يظهر في أي فحص للمفاتيح. حذفها هنا يترك خطة مطبخ
    //    تشير إلى وجبة غير موجودة — وهذا ما يصل المشترك خطأً.
    const plans = await ctx.db.query("dailyPlans").collect();
    const inPlan = (plans as any[]).some((p) =>
      (Array.isArray(p.items) ? p.items : []).some((it: any) => String(it?.mealId ?? "") === id));
    if (inPlan) {
      throw new Error("الوجبة مستعملة في خطط يومية — عطّلها بدل الحذف");
    }

    // احذف الصورة من التخزين لو موجودة
    const meal: any = await ctx.db.get(args.id);
    if (meal?.storageId) { try { await ctx.storage.delete(meal.storageId); } catch { /* ignore */ } }
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/** 🔒 validation نطاق للقيم الغذائية والأسعار والجدولة. */
function validateMealFields(m: any) {
  if (m.calories !== undefined && (m.calories < 0 || m.calories > 5000)) throw new Error("سعرات غير معقولة");
  if (m.protein !== undefined && (m.protein < 0 || m.protein > 500)) throw new Error("بروتين غير معقول");
  if (m.carbs !== undefined && (m.carbs < 0 || m.carbs > 500)) throw new Error("كربوهيدرات غير معقولة");
  if (m.fats !== undefined && (m.fats < 0 || m.fats > 500)) throw new Error("دهون غير معقولة");
  if (m.priceQAR !== undefined && (m.priceQAR < 0 || m.priceQAR > 10000)) throw new Error("سعر غير صالح");
  if (m.costQAR !== undefined && (m.costQAR < 0 || m.costQAR > 10000)) throw new Error("تكلفة غير صالحة");
  if (m.gymPrice !== undefined && m.gymPrice !== null && (m.gymPrice < 0 || m.gymPrice > 10000)) throw new Error("سعر جم غير صالح");
  if (m.weeks) {
    for (const w of m.weeks) if (!Number.isInteger(w) || w < 1 || w > 4) throw new Error("weeks لازم 1..4");
  }
  const VALID_DAYS = new Set(["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]);
  if (m.days) {
    for (const d of m.days) if (!VALID_DAYS.has(String(d).toLowerCase())) throw new Error("day غير صالح");
  }
  if (m.schedule) {
    for (const s of m.schedule) {
      if (!Number.isInteger(s.week) || s.week < 1 || s.week > 4) throw new Error("schedule.week 1..4");
      if (!VALID_DAYS.has(String(s.day).toLowerCase())) throw new Error("schedule.day غير صالح");
    }
  }
  if (m.slug !== undefined && !/^[a-z0-9-]{2,80}$/.test(String(m.slug))) throw new Error("slug: أحرف صغيرة/أرقام/- فقط (2-80)");
}

export const deleteAll = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    // 🔒 حماية: عملية مدمّرة (مسح كل وجبات الموقع) — معطّلة افتراضياً.
    if (process.env.ALLOW_DESTRUCTIVE !== "true") {
      throw new Error("عملية المسح الجماعي معطّلة لأسباب أمنية");
    }
    const meals = await ctx.db.query("publicMeals").collect();
    for (const meal of meals) {
      await ctx.db.delete(meal._id);
    }
    return { deleted: meals.length };
  },
});

// ===== الأكثر طلبًا (للموقع العام) =====
// يحسب الأكثر مبيعًا من طلبات العملاء الفعلية، مع صور، وfallback لو لا توجد طلبات.
export const bestSellers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 6 }) => {
    const items = await ctx.db.query("customerOrderItems").collect();
    const counts = new Map<string, number>();
    for (const it of items) {
      const k = String(it.mealId);
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    const active = await ctx.db
      .query("publicMeals")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // رتّب الوجبات النشطة حسب عدد الطلبات (ثم sortOrder كاحتياطي)
    const ranked = active.filter((meal: any) => !meal.isGymOnly && !meal.isOnlineOnly).sort((a, b) => {
      const ca = counts.get(String(a._id)) || 0;
      const cb = counts.get(String(b._id)) || 0;
      if (cb !== ca) return cb - ca;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

    const top = ranked.slice(0, limit);
    return Promise.all(
      top.map(async (m) => ({
        id: m._id,
        nameAr: m.nameAr,
        nameEn: m.nameEn || "",
        slug: m.slug,
        calories: m.calories,
        protein: m.protein,
        priceQAR: m.priceQAR,
        category: m.category,
        orders: counts.get(String(m._id)) || 0,
        imageUrl: m.storageId ? await ctx.storage.getUrl(m.storageId) : (m.imageUrl || null),
      }))
    );
  },
});
