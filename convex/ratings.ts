/**
 * @file convex/ratings.ts
 * @description تقييمات العملاء للوجبات — مؤمّن ضد الانتحال:
 *   - create يتطلّب sessionToken (عميل مسجّل) + يستخلص customerId من الجلسة
 *   - listAll (إداري) يتطلّب staff — يُظهر تقييمات مع تفاصيل العميل للأدمن
 *   - byMeal (عام) يُرجع فقط النجوم/التعليق/الاسم الأول — بدون رقم هاتف أو ID
 *   - byCustomer يتطلّب ownership (الموظف أو صاحب الاشتراك)
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff, requireStaffOrSubscriptionOwner, validateSession } from "./sessions";

/** أول اسم فقط لعرض عام (بدون كشف الاسم الكامل). */
function shortName(full?: string): string {
  const s = String(full || "").trim();
  if (!s) return "عميل";
  const parts = s.split(/\s+/);
  return parts[0] + (parts.length > 1 ? " " + parts[1][0] + "." : "");
}

/** DTO عام (لا يحوي هاتف/ID/customerId). */
function publicRating(r: any) {
  return {
    id: String(r._id),
    stars: r.stars,
    comment: r.comment || "",
    mealName: r.mealName,
    customerName: shortName(r.customerName),
    createdAt: r.createdAt,
  };
}

/**
 * إنشاء تقييم — مؤمّن:
 *   - يتطلّب sessionToken (عميل مسجّل أو موظف نيابةً)
 *   - customerId يُستخلص من الجلسة نفسها (مش من args) — يمنع الانتحال
 *   - لكل عميل تقييم واحد فقط لكل وجبة/تاريخ (يمنع البصم المتكرر)
 */
export const create = mutation({
  args: {
    menuItemId: v.optional(v.id("menuItems")),
    publicMealId: v.optional(v.id("publicMeals")),
    mealName: v.string(),
    stars: v.number(),
    comment: v.optional(v.string()),
    planDate: v.optional(v.string()),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.stars < 1 || args.stars > 5) throw new Error("يجب أن يكون التقييم بين نجمة واحدة و5 نجوم");
    const id = await validateSession(ctx, args.sessionToken);
    if (!id) throw new Error("غير مصرح. سجّل الدخول لإضافة تقييمك");

    // 🔒 نستخرج customerId + customerName من الجلسة، مش من args
    let customerId: any = undefined;
    let customerName = "عميل";
    let customerPhone: string | undefined;
    if (id.accountType === "customer" && id.customerAccountId) {
      const acct: any = await ctx.db.get(id.customerAccountId as any);
      if (acct?.customerId) {
        customerId = acct.customerId;
        const cust: any = await ctx.db.get(acct.customerId);
        if (cust) {
          customerName = cust.fullName || acct.email || "عميل";
          customerPhone = cust.phone;
        }
      } else {
        customerName = acct?.email || "عميل";
      }
    } else if (id.accountType === "staff" && id.userId) {
      // موظف بيقيّم نيابةً — نسجّل اسمه كـactor
      const u: any = await ctx.db.get(id.userId as any);
      customerName = `[staff] ${u?.name || "employee"}`;
    }

    // 🔒 منع تقييم متكرر لنفس الوجبة/التاريخ من نفس العميل
    if (customerId && (args.menuItemId || args.publicMealId)) {
      const past = await ctx.db
        .query("ratings")
        .withIndex("by_customer", (q) => q.eq("customerId", customerId))
        .collect();
      const dup = past.find((r: any) =>
        (args.menuItemId && String(r.menuItemId) === String(args.menuItemId)) ||
        (args.publicMealId && String(r.publicMealId) === String(args.publicMealId))
      );
      if (dup && (!args.planDate || dup.planDate === args.planDate)) {
        throw new Error("قيّمت هذه الوجبة من قبل");
      }
    }

    return await ctx.db.insert("ratings", {
      customerId,
      customerName,
      customerPhone,
      menuItemId: args.menuItemId,
      publicMealId: args.publicMealId,
      mealName: args.mealName,
      stars: args.stars,
      comment: args.comment,
      planDate: args.planDate,
      createdAt: Date.now(),
    });
  },
});

/** إداري: كل التقييمات مع تفاصيل — للموظفين فقط. */
export const listAll = query({
  args: { limit: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const limit = Math.min(500, args.limit ?? 100);
    return await ctx.db.query("ratings").order("desc").take(limit);
  },
});

/** عام (لعرض تقييمات وجبة على المنيو) — DTO منزوع البيانات الشخصية. */
export const byMeal = query({
  args: { menuItemId: v.id("menuItems") },
  handler: async (ctx, { menuItemId }) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_menuItem", (q) => q.eq("menuItemId", menuItemId))
      .collect();
    const avg = ratings.length ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length : 0;
    return {
      ratings: ratings.map(publicRating),
      count: ratings.length,
      avg: Math.round(avg * 10) / 10,
    };
  },
});

/** تقييمات عميل معيّن — يتطلّب ownership (الموظف أو صاحب الاشتراك). */
export const byCustomer = query({
  args: { customerId: v.id("customers"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { customerId, sessionToken }) => {
    await requireStaffOrSubscriptionOwner(ctx, sessionToken, String(customerId));
    return await ctx.db
      .query("ratings")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();
  },
});

/** ملخص عام (فقط عدد ومتوسط وتوزيع — بلا بيانات شخصية). */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("ratings").collect();
    const count = all.length;
    const avg = count ? all.reduce((s, r) => s + r.stars, 0) / count : 0;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of all) distribution[r.stars] = (distribution[r.stars] || 0) + 1;
    return { count, avg: Math.round(avg * 10) / 10, distribution };
  },
});
