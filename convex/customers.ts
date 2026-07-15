/**
 * @file convex/customers.ts
 * @description Convex functions للعملاء (المشتركين)
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff, requireStaffOrSubscriptionOwner, requireAdmin } from "./sessions";
import { normalizePhone } from "./lib/phone";

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


/* =========================
   Queries
========================= */

/**
 * الحقول الوحيدة التي يحتاجها الموقع العام بعد تأكيد رقم الجوال.
 * لا عنوان، لا سعر، لا ملاحظات.
 *
 * ✅ تواريخ الاشتراك (بداية/نهاية/مدة) مكشوفة عمداً: العميل بعد تأكيد رقمه
 *    يحتاجها ليعرف موقعه في الدورة، فيُبنى المينو على تاريخ بداية اشتراكه
 *    تلقائياً بدل أن يخمّن. تخصّ اشتراكه هو المرتبط برقمه.
 */
function publicCustomerView(c: any) {
  return {
    _id: c._id,
    fullName: c.fullName,
    phone: c.phone,
    program: c.program,
    mealsPerDay: c.mealsPerDay,
    snacksPerDay: c.snacksPerDay,
    allergies: c.allergies,
    avoid: c.avoid,
    startDate: c.startDate,
    endDate: c.endDate,
    durationWeeks: c.durationWeeks,
  };
}

/**
 * ✅ للموقع العام: يبحث بالرقم على **السيرفر** ويرجّع حقولاً محدودة فقط.
 * العائلات قد تتشارك رقماً واحداً، لذلك يرجّع مصفوفة.
 *
 * ⚠️ لا تستبدلها بـ list + فلترة في المتصفح: ذلك كان يُنزّل قاعدة المشتركين
 *    كاملة (أسماء/عناوين/أسعار/حساسية) لأي زائر يفتح DevTools.
 */
export const findPublicByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return [];

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
      .collect();

    return customers.map(publicCustomerView);
  },
});

// ✅ البحث عن مشترك برقم الجوال (للربط التلقائي - أول مطابق) — موظفون فقط
export const findByPhone = query({
  args: { phone: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { phone, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return null;

    const customer = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
      .first();

    return customer || null;
  },
});

// ✅ كل المشتركين بنفس الرقم (للعائلات اللي بتشارك رقم واحد) — موظفون فقط
export const findAllByPhone = query({
  args: { phone: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { phone, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return [];

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
      .collect();

    return customers;
  },
});

/** كل بيانات المشتركين — موظفون فقط (أسماء، هواتف، عناوين، حساسية، أسعار). */
export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
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
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    // ⚠️ sessionToken لا يُخزَّن — نستبعده قبل الـinsert (الـhandler يعمل ...args)
    const { sessionToken: _t, ...fields } = args;
    const phone = normalizePhone(args.phone);

    return await ctx.db.insert("customers", {
      ...fields,
      phone,
      // نخزن ISO نظيف
      startDate: normalizeToISODate(args.startDate) ?? args.startDate,
      endDate: normalizeToISODate(args.endDate) ?? args.endDate,
      birthdayDate: normalizeToISODate(args.birthdayDate) ?? args.birthdayDate,
      createdAt: Date.now(),
    });
  },
});

/**
 * 🔒 تحديث عميل — قائمة بيضاء (whitelist) صارمة للحقول التشغيلية.
 *    الحقول المالية والداخلية (loyaltyPoints/loyaltyCredit/pausedFrom/
 *    pauseHistory/skippedDates/defaultDriverId/customerId links) لا تُقبل
 *    من هذا endpoint — لها mutations إدارية منفصلة.
 */
export const update = mutation({
  args: {
    id: v.id("customers"),
    // حقول العميل التشغيلية فقط — كل حقل بنوعه الصريح
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("MALE"), v.literal("FEMALE"))),
    deliveryTime: v.optional(v.union(v.literal("MORNING"), v.literal("EVENING"))),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    address: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
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
    goalType: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    price: v.optional(v.number()),
    discount: v.optional(v.number()),
    finalPrice: v.optional(v.number()),
    birthdayDate: v.optional(v.string()),
    status: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const { id, sessionToken: _t, ...raw } = args as any;
    // 🔒 حدود منطقية على الأرقام
    if (raw.price !== undefined && (raw.price < 0 || raw.price > 1_000_000)) throw new Error("سعر غير صالح");
    if (raw.discount !== undefined && (raw.discount < 0 || raw.discount > 1_000_000)) throw new Error("خصم غير صالح");
    if (raw.finalPrice !== undefined && (raw.finalPrice < 0 || raw.finalPrice > 1_000_000)) throw new Error("سعر نهائي غير صالح");
    if (raw.mealsPerDay !== undefined && (raw.mealsPerDay < 0 || raw.mealsPerDay > 10)) throw new Error("عدد وجبات غير صالح");
    if (raw.snacksPerDay !== undefined && (raw.snacksPerDay < 0 || raw.snacksPerDay > 10)) throw new Error("عدد سناكس غير صالح");
    if (raw.durationWeeks !== undefined && (raw.durationWeeks < 0 || raw.durationWeeks > 260)) throw new Error("مدة اشتراك غير صالحة");

    const patch: any = { updatedAt: Date.now() };
    for (const [k, v2] of Object.entries(raw)) if (v2 !== undefined) patch[k] = v2;
    if (patch.phone) patch.phone = normalizePhone(patch.phone);
    if (patch.startDate) patch.startDate = normalizeToISODate(patch.startDate) ?? patch.startDate;
    if (patch.endDate) patch.endDate = normalizeToISODate(patch.endDate) ?? patch.endDate;
    if (patch.birthdayDate) patch.birthdayDate = normalizeToISODate(patch.birthdayDate) ?? patch.birthdayDate;

    await ctx.db.patch(id, patch);
    return true;
  },
});

/**
 * 🔒 حذف عميل — ADMIN فقط، ويرفض الحذف لو فيه سجلات مرتبطة (خطط/طلبات/فواتير POS/gymOrders/حساب عميل).
 *    التعطيل الآمن = isActive:false. الحذف نهائي بس بعد تنظيف يدوي للمراجع.
 */
export const remove = mutation({
  args: { id: v.id("customers"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    // 🔒 ref-check — نمنع الحذف اليتيم
    const plans = await ctx.db.query("dailyPlans").withIndex("by_customerId", (q) => q.eq("customerId", id)).take(1);
    if (plans.length) throw new Error("لا يمكن الحذف — للعميل خطط توصيل. عطّل الاشتراك بدلاً من الحذف.");
    const orders = await ctx.db.query("customerOrders").collect();
    if (orders.some((o) => String(o.customerId) === String(id))) {
      throw new Error("لا يمكن الحذف — للعميل طلبات محفوظة.");
    }
    const acct = await ctx.db.query("customerAccounts").withIndex("by_customerId", (q) => q.eq("customerId", id)).first();
    if (acct) throw new Error("لا يمكن الحذف — للعميل حساب موقع مرتبط. احذف الحساب أولاً.");
    const posT = await ctx.db.query("posTickets").collect();
    if (posT.some((t: any) => String(t.customerId) === String(id))) {
      throw new Error("لا يمكن الحذف — للعميل فواتير POS.");
    }
    await ctx.db.delete(id);
    return true;
  },
});

// خدمة ذاتية: تبديل يوم توصيل في قائمة skippedDates (yyyy-MM-dd)
// يسمح بها لصاحب الاشتراك نفسه أو لموظف — وليس لأي شخص يعرف الـid.
export const toggleSkipDay = mutation({
  args: { id: v.id("customers"), date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaffOrSubscriptionOwner(ctx, args.sessionToken, args.id);
    const c = await ctx.db.get(args.id);
    if (!c) return null;
    const cur: string[] = Array.isArray((c as any).skippedDates) ? (c as any).skippedDates : [];
    const exists = cur.includes(args.date);
    const next = exists ? cur.filter((d) => d !== args.date) : [...cur, args.date].sort();
    await ctx.db.patch(args.id, { skippedDates: next, updatedAt: Date.now() });
    return { skipped: !exists, skippedDates: next };
  },
});

/**
 * 🔒 إيقاف/استئناف اشتراك:
 *    - إيقاف (active=false) → مسموح لصاحب الاشتراك (خدمة ذاتية).
 *    - تنشيط (active=true) → موظف فقط — يحتاج مراجعة الدفع والتواريخ.
 *      العميل يقدر يرفع طلب استئناف عبر واجهة أخرى، بس القرار إداري.
 */
export const setSubscriptionActive = mutation({
  args: { id: v.id("customers"), active: v.boolean(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.active) {
      // تنشيط = موظف فقط
      await requireStaff(ctx, args.sessionToken);
      const c: any = await ctx.db.get(args.id);
      if (!c) throw new Error("العميل غير موجود");
      // تحذير لو منتهي — الأدمن يقدر يعيد تفعيل بس ياخد قرار واعي
      // (لو حبيت تمنع نهائياً استبدل بـthrow)
    } else {
      // إيقاف = مسموح لصاحب الاشتراك
      await requireStaffOrSubscriptionOwner(ctx, args.sessionToken, args.id);
    }
    await ctx.db.patch(args.id, { isActive: args.active, updatedAt: Date.now() });
    return { isActive: args.active };
  },
});

/* =========================
   ✅ NEW: Activate ALL customers
========================= */
export const activateAll = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
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
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    // 🔒 حماية: عملية مدمّرة (مسح كل العملاء) — معطّلة افتراضياً.
    // لتشغيلها مؤقتاً: npx convex env set ALLOW_DESTRUCTIVE true (ثم أعدها false).
    if (process.env.ALLOW_DESTRUCTIVE !== "true") {
      throw new Error("عملية المسح الجماعي معطّلة لأسباب أمنية");
    }
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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { rows, sessionToken }) => {
    // 🔒 ADMIN فقط. لا حذف مسبق — upsert بالهاتف. لو رقم موجود يُحدَّث؛ لو لا يُضاف.
    await requireAdmin(ctx, sessionToken);
    let added = 0, updated = 0, skipped = 0;

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
      };

      // upsert بالهاتف
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", phone))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...payload, updatedAt: Date.now() });
        updated++;
      } else {
        await ctx.db.insert("customers", { ...payload, createdAt: Date.now() });
        added++;
      }
    }

    return { total: rows.length, added, updated, skipped };
  },
});
