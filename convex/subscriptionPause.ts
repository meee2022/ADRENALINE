/**
 * @file convex/subscriptionPause.ts
 * @description تجميد واستئناف اشتراك المشترك (سفر / ظرف طارئ).
 *
 * القاعدة: العميل لا يخسر أيامه. عند الاستئناف نعدّ **أيام التوصيل** التي فاتته
 * أثناء التجميد ونمدّ `endDate` بنفس العدد.
 *
 * لماذا أيام التوصيل وليس الأيام التقويمية:
 *   المطعم يوصّل السبت→الخميس (6 أيام)، الجمعة وحدها بلا توصيل — انظر lib/dates.
 *   لو جمّدنا 14 يوماً تقويمياً فذلك 12 يوم توصيل؛ تمديد 14 يوماً يمنح العميل
 *   يومين لم يدفع مقابلهما.
 *
 * الصلاحية: موظفون فقط (قرار العمل: العميل يتصل والموظف ينفّذ).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";

/* ========== أدوات التاريخ — مصدر واحد في convex/lib/dates.ts ========== */
import {
  parseDate,
  fmtDate,
  addDays,
  isDeliveryDay,
  countDeliveryDays,
  addDeliveryDays,
  subDeliveryDays,
} from "./lib/dates";

/* ========== الاستعلام: حالة الاشتراك والمتبقّي ========== */

export const status = query({
  args: { id: v.id("customers"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const c = await ctx.db.get(args.id);
    if (!c) return null;

    const skipped: string[] = Array.isArray((c as any).skippedDates) ? (c as any).skippedDates : [];
    const today = fmtDate(new Date());
    const isPaused = Boolean((c as any).pausedFrom);

    // المتبقّي = أيام التوصيل من اليوم (أو من يوم التجميد) حتى endDate شاملاً.
    const countFrom = isPaused ? (c as any).pausedFrom : today;
    const endExclusive = fmtDate(addDays(parseDate(c.endDate), 1));
    const remaining =
      parseDate(countFrom).getTime() > parseDate(c.endDate).getTime()
        ? 0
        : countDeliveryDays(countFrom, endExclusive, skipped);

    const history = ((c as any).pauseHistory || []) as Array<{ deliveryDays: number }>;

    return {
      isPaused,
      pausedFrom: (c as any).pausedFrom ?? null,
      pauseExpectedResume: (c as any).pauseExpectedResume ?? null,
      endDate: c.endDate,
      remainingDeliveryDays: remaining,
      totalFrozenDays: history.reduce((s, h) => s + (h.deliveryDays || 0), 0),
      pauseCount: history.length,
      // ✅ الأيام المتخطّاة القادمة (اليوم فصاعداً) لعرضها مع زر إلغاء التخطّي.
      skippedDates: skipped.filter((d) => d >= today).sort(),
    };
  },
});

/* ========== التجميد ========== */

export const pause = mutation({
  args: {
    id: v.id("customers"),
    from: v.optional(v.string()),            // yyyy-MM-dd — افتراضياً اليوم
    expectedResume: v.optional(v.string()),  // yyyy-MM-dd — اختياري
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx, args.sessionToken);
    const c = await ctx.db.get(args.id);
    if (!c) return { success: false, error: "المشترك غير موجود" };
    if ((c as any).pausedFrom) return { success: false, error: "الاشتراك مجمّد بالفعل" };

    const from = args.from || fmtDate(new Date());
    if (parseDate(from).getTime() > parseDate(c.endDate).getTime()) {
      return { success: false, error: "تاريخ التجميد بعد نهاية الاشتراك" };
    }
    if (args.expectedResume && parseDate(args.expectedResume).getTime() <= parseDate(from).getTime()) {
      return { success: false, error: "تاريخ الرجوع يجب أن يكون بعد تاريخ التجميد" };
    }

    // احذف خطط المطبخ المستقبلية من يوم التجميد فصاعداً، وإلا يفضل المطبخ يطبخ له.
    const plans = await ctx.db
      .query("dailyPlans")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.id))
      .collect();
    let removed = 0;
    for (const p of plans) {
      if (String(p.date).slice(0, 10) >= from) {
        await ctx.db.delete(p._id);
        removed++;
      }
    }

    await ctx.db.patch(args.id, {
      pausedFrom: from,
      pauseExpectedResume: args.expectedResume,
      isActive: false,
      updatedAt: Date.now(),
    });

    return { success: true, from, removedPlans: removed, by: staff.userId };
  },
});

/* ========== الاستئناف ========== */

export const resume = mutation({
  args: {
    id: v.id("customers"),
    on: v.optional(v.string()), // yyyy-MM-dd — أول يوم يرجع فيه الأكل. افتراضياً اليوم.
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx, args.sessionToken);
    const c = await ctx.db.get(args.id);
    if (!c) return { success: false, error: "المشترك غير موجود" };

    const from = (c as any).pausedFrom as string | undefined;
    if (!from) return { success: false, error: "الاشتراك غير مجمّد" };

    const on = args.on || fmtDate(new Date());
    if (parseDate(on).getTime() <= parseDate(from).getTime()) {
      return { success: false, error: "تاريخ الاستئناف يجب أن يكون بعد تاريخ التجميد" };
    }

    const skipped: string[] = Array.isArray((c as any).skippedDates) ? (c as any).skippedDates : [];
    // المدى [from, on) — يوم الاستئناف نفسه يوم خدمة، فلا يُحتسب مجمّداً.
    const frozen = countDeliveryDays(from, on, skipped);
    const newEndDate = frozen > 0 ? addDeliveryDays(c.endDate, frozen) : c.endDate;

    const history = Array.isArray((c as any).pauseHistory) ? (c as any).pauseHistory : [];

    await ctx.db.patch(args.id, {
      pausedFrom: undefined,
      pauseExpectedResume: undefined,
      isActive: true,
      endDate: newEndDate,
      pauseHistory: [
        ...history,
        { from, to: on, deliveryDays: frozen, by: String(staff.userId ?? ""), at: Date.now() },
      ],
      updatedAt: Date.now(),
    });

    return {
      success: true,
      frozenDeliveryDays: frozen,
      oldEndDate: c.endDate,
      newEndDate,
    };
  },
});

/**
 * ✅ إيقاف/إرجاع وجبات أيام محددة (سيناريو: "الأحد والاثنين نعم، باقي الأسبوع مسافر").
 *    - يعلّم/يزيل الأيام في skippedDates.
 *    - يحذف خطط المطبخ المستقبلية لتلك الأيام حتى لا يطبخها المطبخ.
 *    أبسط من التجميد الكامل: لا يمدّ endDate — العميل اختار تخطّي أيام معدودة.
 *
 * تعويض العميل (قرار العمل): العميل لا يخسر أيامه — كل يوم توصيل يتخطّاه
 * يُمدّ به `endDate` (تماماً كالتجميد). الجمعة لا تُحتسب (ليست يوم توصيل).
 * التراجع (unskip) يقصّر `endDate` بنفس القدر حتى لا يتراكم التعويض.
 *
 * mode:
 *   "skip"   → أضف التواريخ إلى skippedDates، احذف خططها، ومدّ endDate بأيام التوصيل المضافة.
 *   "unskip" → أزل التواريخ من skippedDates وقصّر endDate بأيام التوصيل المُزالة
 *              (لا يعيد إنشاء الخطط؛ تُعاد بالاعتماد).
 */
export const setSkippedDays = mutation({
  args: {
    id: v.id("customers"),
    dates: v.array(v.string()), // yyyy-MM-dd
    mode: v.union(v.literal("skip"), v.literal("unskip")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const c = await ctx.db.get(args.id);
    if (!c) return { success: false, error: "المشترك غير موجود" };

    const want = new Set(args.dates.map((d) => String(d).slice(0, 10)));
    const cur: string[] = Array.isArray((c as any).skippedDates) ? (c as any).skippedDates : [];
    const curSet = new Set(cur);

    // احسب التغيير الفعلي فقط (لتفادي تعويض مكرّر لو أُرسل التاريخ نفسه مرتين)،
    // وعُدّ منه أيام التوصيل وحدها — الجمعة لا تُعوَّض.
    let changedDeliveryDays = 0;
    if (args.mode === "skip") {
      for (const d of want) {
        if (!curSet.has(d)) {
          curSet.add(d);
          if (isDeliveryDay(parseDate(d))) changedDeliveryDays++;
        }
      }
    } else {
      for (const d of want) {
        if (curSet.has(d)) {
          curSet.delete(d);
          if (isDeliveryDay(parseDate(d))) changedDeliveryDays++;
        }
      }
    }

    // تعويض/سحب أيام التوصيل من endDate.
    const oldEndDate = c.endDate;
    let newEndDate = oldEndDate;
    if (changedDeliveryDays > 0) {
      newEndDate =
        args.mode === "skip"
          ? addDeliveryDays(oldEndDate, changedDeliveryDays)
          : subDeliveryDays(oldEndDate, changedDeliveryDays);
    }

    await ctx.db.patch(args.id, {
      skippedDates: Array.from(curSet).sort(),
      endDate: newEndDate,
      updatedAt: Date.now(),
    });

    // عند التخطّي: احذف خطط المطبخ لتلك التواريخ (وإلا يظل المطبخ يطبخها).
    let removed = 0;
    if (args.mode === "skip") {
      const plans = await ctx.db
        .query("dailyPlans")
        .withIndex("by_customerId", (q) => q.eq("customerId", args.id))
        .collect();
      for (const p of plans) {
        if (want.has(String(p.date).slice(0, 10))) {
          await ctx.db.delete(p._id);
          removed++;
        }
      }
    }

    return {
      success: true,
      skippedCount: curSet.size,
      removedPlans: removed,
      creditedDeliveryDays: args.mode === "skip" ? changedDeliveryDays : 0,
      withdrawnDeliveryDays: args.mode === "unskip" ? changedDeliveryDays : 0,
      oldEndDate,
      newEndDate,
    };
  },
});
