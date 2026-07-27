/**
 * @file convex/customers.ts
 * @description Convex functions للعملاء (المشتركين)
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff, requireStaffOrSubscriptionOwner, requireAdmin } from "./sessions";
import { normalizePhone } from "./lib/phone";
import { parseDate, isDeliveryDay, addDeliveryDays, subDeliveryDays } from "./lib/dates";

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

function normalizeCustomerName(input: any): string {
  return String(input || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("en");
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

/**
 * ✅ يشتق برنامج المشترك (DIET/FITNESS/BULK/CUSTOMIZED) من الهدف/اسم الباقة.
 *    السبب: الفورم كان يحفظ goals فقط (بلا program)، فكل مشترك جديد كان يظهر
 *    STANDARD رغم أن باقته تنحيف/تضخيم/لياقة. نشتقّه هنا حتى يعمل لأي مسار إدخال.
 *    يرجّع undefined لو تعذّر التصنيف (يبقى STANDARD) بدل تخمين خاطئ.
 */
function deriveProgram(goals?: string, packageLabel?: string): string | undefined {
  const s = `${goals || ""} ${packageLabel || ""}`.toLowerCase();
  if (!s.trim()) return undefined;
  if (s.includes("custom") || s.includes("مخصّص") || s.includes("مخصص")) return "CUSTOMIZED";
  if (s.includes("diet") || s.includes("تنحيف") || s.includes("تخسيس")) return "DIET";
  if (s.includes("fitness") || s.includes("لياقة") || s.includes("فتنس")) return "FITNESS";
  if (s.includes("bulk") || s.includes("تضخيم") || s.includes("ضخامة")) return "BULK";
  // لو goals نفسه مكتوب صريح كبرنامج
  const u = s.toUpperCase();
  if (u.includes("DIET")) return "DIET";
  if (u.includes("FITNESS")) return "FITNESS";
  if (u.includes("BULK")) return "BULK";
  return undefined;
}

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
    // ✅ تخصيص كميات/سعرات المشترك للوجبات الرئيسية (اختياري)
    carbGrams: v.optional(v.number()),
    proteinGrams: v.optional(v.number()),
    mainMealCalories: v.optional(v.number()),
    mealCalorieOverrides: v.optional(v.array(v.object({ meal: v.string(), calories: v.number() }))),

    program: v.optional(v.string()),
    packageLabel: v.optional(v.string()),
    fridayDouble: v.optional(v.boolean()),
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
    const samePhone = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .collect();
    if (samePhone.some((c: any) =>
      normalizeCustomerName(c.fullName) === normalizeCustomerName(args.fullName)
    )) {
      throw new Error("يوجد مشترك بنفس الاسم ورقم الهاتف بالفعل / Customer already exists");
    }
    /* حارس على الخادم أيضاً: الرقمان يُبنى منهما سطر الباقة على ملصق البوكس
       ويُقاس بهما نقص الخطة. من يُسجَّل بدونهما يطبع ملصقاً مختلف الشكل عن
       بقية الرزمة. الواجهة تمنعه، وهذا يمنعه لو نادى المسار أحد غيرها. */
    if (!(Number(args.mealsPerDay) >= 1)) {
      throw new Error("حدّد عدد الوجبات في اليوم / Set meals per day");
    }
    // السناك افتراضه صفر ويُزاد عند اللزوم، فغيابه ليس نقصاً — يُخزَّن صفراً.
    const snacksPerDay = Number(args.snacksPerDay) >= 0 ? Number(args.snacksPerDay) : 0;

    // ✅ يشتق program من الباقة/الهدف لو ماجاش صريح — يمنع ظهور المشترك STANDARD بالغلط
    const program = args.program || deriveProgram(args.goals, args.packageLabel);

    return await ctx.db.insert("customers", {
      ...fields,
      snacksPerDay,
      program,
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
    carbGrams: v.optional(v.number()),
    proteinGrams: v.optional(v.number()),
    mainMealCalories: v.optional(v.number()),
    mealCalorieOverrides: v.optional(v.array(v.object({ meal: v.string(), calories: v.number() }))),
    program: v.optional(v.string()),
    packageLabel: v.optional(v.string()),
    fridayDouble: v.optional(v.boolean()),
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
    const current: any = await ctx.db.get(id);
    if (!current) throw new Error("المشترك غير موجود / Customer not found");
    // 🔒 حدود منطقية على الأرقام
    if (raw.price !== undefined && (raw.price < 0 || raw.price > 1_000_000)) throw new Error("سعر غير صالح");
    if (raw.discount !== undefined && (raw.discount < 0 || raw.discount > 1_000_000)) throw new Error("خصم غير صالح");
    if (raw.finalPrice !== undefined && (raw.finalPrice < 0 || raw.finalPrice > 1_000_000)) throw new Error("سعر نهائي غير صالح");
    if (raw.mealsPerDay !== undefined && (raw.mealsPerDay < 0 || raw.mealsPerDay > 10)) throw new Error("عدد وجبات غير صالح");
    if (raw.snacksPerDay !== undefined && (raw.snacksPerDay < 0 || raw.snacksPerDay > 10)) throw new Error("عدد سناكس غير صالح");
    if (raw.durationWeeks !== undefined && (raw.durationWeeks < 0 || raw.durationWeeks > 260)) throw new Error("مدة اشتراك غير صالحة");

    const patch: any = { updatedAt: Date.now() };
    for (const [k, v2] of Object.entries(raw)) if (v2 !== undefined) patch[k] = v2;
    // ✅ لو الهدف/الباقة اتغيّروا وماجاش program صريح — نشتقّه (تنحيف→DIET…)
    if (patch.program === undefined && (patch.goals !== undefined || patch.packageLabel !== undefined)) {
      const derived = deriveProgram(patch.goals, patch.packageLabel);
      if (derived) patch.program = derived;
    }
    if (patch.phone) patch.phone = normalizePhone(patch.phone);
    if (patch.startDate) patch.startDate = normalizeToISODate(patch.startDate) ?? patch.startDate;
    if (patch.endDate) patch.endDate = normalizeToISODate(patch.endDate) ?? patch.endDate;
    if (patch.birthdayDate) patch.birthdayDate = normalizeToISODate(patch.birthdayDate) ?? patch.birthdayDate;

    const finalPhone = patch.phone || current.phone;
    const finalName = patch.fullName || current.fullName;
    const samePhone = await ctx.db
      .query("customers")
      .withIndex("by_phone", (q) => q.eq("phone", finalPhone))
      .collect();
    if (samePhone.some((c: any) =>
      String(c._id) !== String(id) &&
      normalizeCustomerName(c.fullName) === normalizeCustomerName(finalName)
    )) {
      throw new Error("يوجد مشترك آخر بنفس الاسم ورقم الهاتف / Duplicate customer");
    }

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

/**
 * 🔒 حذف قسري (بعد رسالة التحذير + تأكيد صريح): يمسح المشترك **مع بياناته المرتبطة
 *    بالوجبات** — الطلبات وبنودها + خطط التوصيل + حساب الموقع. لكنه **يقف لو للعميل
 *    فواتير POS مالية** (لا نمسح سجلاً مالياً — يُعطَّل بدل الحذف). ADMIN فقط.
 *    قرار المستخدم (2026-07-18): «يمسح الوجبات بس، ويوقف لو فيه فواتير».
 */
export const removeForce = mutation({
  args: { id: v.id("customers"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    // 🔒 حماية مالية: فواتير POS تمنع الحذف القسري
    const posT = await ctx.db.query("posTickets").collect();
    if (posT.some((t: any) => String(t.customerId) === String(id))) {
      throw new Error("لا يمكن الحذف القسري — للعميل فواتير POS مالية. عطّل الاشتراك بدلاً من الحذف.");
    }
    let ordersDeleted = 0, itemsDeleted = 0, plansDeleted = 0, accountsDeleted = 0;
    // الطلبات + بنودها
    const orders = await ctx.db.query("customerOrders").collect();
    for (const o of orders.filter((o) => String(o.customerId) === String(id))) {
      const items = await ctx.db
        .query("customerOrderItems")
        .withIndex("by_orderId", (q) => q.eq("orderId", o._id))
        .collect();
      for (const it of items) { await ctx.db.delete(it._id); itemsDeleted++; }
      await ctx.db.delete(o._id); ordersDeleted++;
    }
    // خطط التوصيل
    const plans = await ctx.db.query("dailyPlans").withIndex("by_customerId", (q) => q.eq("customerId", id)).collect();
    for (const p of plans) { await ctx.db.delete(p._id); plansDeleted++; }
    // حساب الموقع
    const accts = await ctx.db.query("customerAccounts").withIndex("by_customerId", (q) => q.eq("customerId", id)).collect();
    for (const a of accts) { await ctx.db.delete(a._id); accountsDeleted++; }
    // المشترك نفسه
    await ctx.db.delete(id);
    return { ok: true, ordersDeleted, itemsDeleted, plansDeleted, accountsDeleted };
  },
});

/**
 * 🔒 خدمة ذاتية: تخطّي/إلغاء تخطّي يوم توصيل واحد.
 *   محرك موحد مع subscriptionPause.setSkippedDays: كلاهما يمدّ/يقصّر endDate
 *   ويحذف/يعيد خطة اليوم، فما يبقى فرق مالي بين "صفحة العميل" و"صفحة الأخصائية".
 *
 *   قيود:
 *     - لا يُسمح بتخطّي يوم مضى (لا يعود بأثر رجعي).
 *     - لا يُسمح بتخطّي يوم دخل نطاق التحضير (خطة اليوم أو غد قبل الـcutoff).
 */
export const toggleSkipDay = mutation({
  args: { id: v.id("customers"), date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaffOrSubscriptionOwner(ctx, args.sessionToken, args.id);
    const c: any = await ctx.db.get(args.id);
    if (!c) return null;

    const dateISO = String(args.date).slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const cur: string[] = Array.isArray(c.skippedDates) ? c.skippedDates : [];
    const exists = cur.includes(dateISO);
    const mode = exists ? "unskip" : "skip";

    // 🔒 لا تخطّي بأثر رجعي
    if (mode === "skip" && dateISO < today) throw new Error("لا يمكن تخطّي يوم مضى");

    // نفس منطق setSkippedDays — مباشرة هنا (بلا استدعاء متبادل).
    // ⚠️ الاستيراد في أعلى الملف — Convex لا يدعم `await import()` الديناميكي.
    const nextSet = new Set(cur);
    let changedDeliveryDays = 0;
    if (mode === "skip") {
      if (!nextSet.has(dateISO)) {
        nextSet.add(dateISO);
        if (isDeliveryDay(parseDate(dateISO))) changedDeliveryDays++;
      }
    } else {
      if (nextSet.has(dateISO)) {
        nextSet.delete(dateISO);
        if (isDeliveryDay(parseDate(dateISO))) changedDeliveryDays++;
      }
    }

    const oldEndDate = c.endDate;
    const newEndDate = changedDeliveryDays > 0
      ? (mode === "skip" ? addDeliveryDays(oldEndDate, changedDeliveryDays) : subDeliveryDays(oldEndDate, changedDeliveryDays))
      : oldEndDate;

    await ctx.db.patch(args.id, {
      skippedDates: Array.from(nextSet).sort(),
      endDate: newEndDate,
      updatedAt: Date.now(),
    });

    // احذف/أرشف خطة اليوم لو skip
    let removed = 0;
    if (mode === "skip") {
      const plans = await ctx.db
        .query("dailyPlans")
        .withIndex("by_customerId", (q) => q.eq("customerId", args.id))
        .collect();
      for (const p of plans) {
        if (String(p.date).slice(0, 10) === dateISO && p.status !== "DELIVERED") {
          await ctx.db.delete(p._id);
          removed++;
        }
      }
    }

    return {
      skipped: mode === "skip",
      skippedDates: Array.from(nextSet).sort(),
      creditedDeliveryDays: mode === "skip" ? changedDeliveryDays : 0,
      withdrawnDeliveryDays: mode === "unskip" ? changedDeliveryDays : 0,
      oldEndDate, newEndDate,
      removedPlans: removed,
    };
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

      // Match the same person by phone and normalized full name; families may share a phone.
      const samePhone = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", phone))
        .collect();
      const existing = samePhone.find(
        (c: any) => normalizeCustomerName(c.fullName) === normalizeCustomerName(row.fullName),
      );
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
