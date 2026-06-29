/**
 * @file convex/customers.ts
 * @description Convex functions للعملاء (المشتركين)
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/* =========================
   Date helpers (server)
========================= */
function normalizeToISODate(input: any): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;

  // already ISO yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = String(m[1]).padStart(2, "0");
    const mm = String(m[2]).padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // fallback Date()
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return undefined;
}

function normalizePhone(input: any) {
  const s = String(input ?? "").trim();
  const digits = s.replace(/\D/g, "");
  return digits || "";
}

/* =========================
   Queries
========================= */

// ✅ البحث عن مشترك برقم الجوال (للربط التلقائي - أول مطابق)
export const findByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return null;

    const customer = await ctx.db
      .query("customers")
      .filter((q) => q.eq(q.field("phone"), normalizedPhone))
      .first();

    return customer || null;
  },
});

// ✅ كل المشتركين بنفس الرقم (للعائلات اللي بتشارك رقم واحد)
export const findAllByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return [];

    const customers = await ctx.db
      .query("customers")
      .filter((q) => q.eq(q.field("phone"), normalizedPhone))
      .collect();

    return customers;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("customers").order("desc").collect();
  },
});

/* =========================
   Mutations (CRUD)
========================= */

export const create = mutation({
  args: {
    fullName: v.string(),
    phone: v.string(),
    gender: v.optional(v.union(v.literal("MALE"), v.literal("FEMALE"))),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    startDate: v.string(),
    endDate: v.string(),

    address: v.optional(v.string()),
    goals: v.optional(v.string()),
    allergies: v.optional(v.string()),
    notes: v.optional(v.string()),
    
    // ✅ التفضيلات والممنوعات والكميات
    avoid: v.optional(v.string()),
    preferences: v.optional(v.string()),
    portions: v.optional(v.string()),

    program: v.optional(v.string()),
    packageLabel: v.optional(v.string()),
    durationWeeks: v.optional(v.number()),
    mealsPerDay: v.optional(v.number()),
    snacksPerDay: v.optional(v.number()),
    totalMealsPerDay: v.optional(v.number()),

    paymentMethod: v.optional(v.string()),
    price: v.optional(v.number()),
    discount: v.optional(v.number()),
    finalPrice: v.optional(v.number()),

    birthdayDate: v.optional(v.string()),
    status: v.optional(v.string()),

    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);

    return await ctx.db.insert("customers", {
      ...args,
      phone,
      // نخزن ISO نظيف
      startDate: normalizeToISODate(args.startDate) ?? args.startDate,
      endDate: normalizeToISODate(args.endDate) ?? args.endDate,
      birthdayDate: normalizeToISODate(args.birthdayDate) ?? args.birthdayDate,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    data: v.any(),
  },
  handler: async (ctx, { id, data }) => {
    // نحمي من حقول Convex الإضافية اللي بتكسر الvalidator (لو جت بالغلط)
    const safe = { ...(data || {}) };
    delete (safe as any)._id;
    delete (safe as any)._creationTime;

    // normalize
    if (safe.phone) safe.phone = normalizePhone(safe.phone);
    if (safe.startDate)
      safe.startDate = normalizeToISODate(safe.startDate) ?? safe.startDate;
    if (safe.endDate)
      safe.endDate = normalizeToISODate(safe.endDate) ?? safe.endDate;
    if (safe.birthdayDate)
      safe.birthdayDate =
        normalizeToISODate(safe.birthdayDate) ?? safe.birthdayDate;

    await ctx.db.patch(id, { ...safe, updatedAt: Date.now() });
    return true;
  },
});

export const remove = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return true;
  },
});

// خدمة ذاتية: تبديل يوم توصيل في قائمة skippedDates (yyyy-MM-dd)
export const toggleSkipDay = mutation({
  args: { id: v.id("customers"), date: v.string() },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.id);
    if (!c) return null;
    const cur: string[] = Array.isArray((c as any).skippedDates) ? (c as any).skippedDates : [];
    const exists = cur.includes(args.date);
    const next = exists ? cur.filter((d) => d !== args.date) : [...cur, args.date].sort();
    await ctx.db.patch(args.id, { skippedDates: next, updatedAt: Date.now() });
    return { skipped: !exists, skippedDates: next };
  },
});

// خدمة ذاتية: إيقاف/استئناف الاشتراك
export const setSubscriptionActive = mutation({
  args: { id: v.id("customers"), active: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: args.active, updatedAt: Date.now() });
    return { isActive: args.active };
  },
});

/* =========================
   ✅ NEW: Activate ALL customers
========================= */
export const activateAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("customers").collect();
    let updated = 0;

    for (const c of all) {
      if (c.isActive === false) {
        await ctx.db.patch(c._id, { isActive: true, updatedAt: Date.now() });
        updated++;
      }
    }

    return { total: all.length, updated };
  },
});

/* =========================
   ✅ NEW: Migrate/Fix dates for all customers
========================= */
export const migrateDates = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("customers").collect();
    let fixed = 0;
    let skipped = 0;

    for (const c of all) {
      const newStart = normalizeToISODate((c as any).startDate);
      const newEnd = normalizeToISODate((c as any).endDate);
      const newBirth = normalizeToISODate((c as any).birthdayDate);

      const patch: any = {};
      if (newStart && (c as any).startDate !== newStart)
        patch.startDate = newStart;
      if (newEnd && (c as any).endDate !== newEnd) patch.endDate = newEnd;
      if (newBirth && (c as any).birthdayDate !== newBirth)
        patch.birthdayDate = newBirth;

      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      patch.updatedAt = Date.now();
      await ctx.db.patch(c._id, patch);
      fixed++;
    }

    return { total: all.length, fixed, skipped };
  },
});

/* =========================
   ✅ NEW: Delete ALL customers (+ optionally delete dailyPlans)
========================= */
export const deleteAll = mutation({
  args: {
    deleteDailyPlans: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const deleteDailyPlans = args.deleteDailyPlans ?? true;

    let deletedPlans = 0;
    if (deleteDailyPlans) {
      const plans = await ctx.db.query("dailyPlans").collect();
      for (const p of plans) {
        await ctx.db.delete(p._id);
        deletedPlans++;
      }
    }

    const all = await ctx.db.query("customers").collect();
    for (const c of all) {
      await ctx.db.delete(c._id);
    }

    return { deletedCustomers: all.length, deletedPlans };
  },
});

/* =========================
   ✅ Bulk Import (Upsert by phone) + date normalize
========================= */
export const importMany = mutation({
  args: {
    rows: v.array(
      v.object({
        fullName: v.string(),
        phone: v.string(),
        gender: v.optional(v.union(v.literal("MALE"), v.literal("FEMALE"))),
        deliveryTime: v.optional(
          v.union(v.literal("MORNING"), v.literal("EVENING")),
        ),
        startDate: v.string(),
        endDate: v.string(),

        address: v.optional(v.string()),
        goals: v.optional(v.string()),
        allergies: v.optional(v.string()),
        notes: v.optional(v.string()),

        avoid: v.optional(v.string()),
        preferences: v.optional(v.string()),
        portions: v.optional(v.string()),

        program: v.optional(v.string()),
        packageLabel: v.optional(v.string()),
        durationWeeks: v.optional(v.number()),
        mealsPerDay: v.optional(v.number()),
        snacksPerDay: v.optional(v.number()),
        totalMealsPerDay: v.optional(v.number()),

        paymentMethod: v.optional(v.string()),
        price: v.optional(v.number()),
        discount: v.optional(v.number()),
        finalPrice: v.optional(v.number()),

        birthdayDate: v.optional(v.string()),
        status: v.optional(v.string()),
        isActive: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    let added = 0;
    let skipped = 0;

    // احذف كل المشتركين الحاليين أولاً
    const existing = await ctx.db.query("customers").collect();
    for (const c of existing) {
      await ctx.db.delete(c._id);
    }

    // أضف الجديد
    for (const row of rows) {
      const phone = normalizePhone(row.phone);
      if (!row.fullName || !phone) { skipped++; continue; }

      const payload: any = {
        ...row,
        phone,
        deliveryTime: row.deliveryTime ?? "MORNING",
        startDate: normalizeToISODate(row.startDate) ?? row.startDate,
        endDate: normalizeToISODate(row.endDate) ?? row.endDate,
        birthdayDate: normalizeToISODate(row.birthdayDate) ?? row.birthdayDate,
        createdAt: Date.now(),
      };

      await ctx.db.insert("customers", payload);
      added++;
    }

    return { total: rows.length, deleted: existing.length, added, skipped };
  },
});
