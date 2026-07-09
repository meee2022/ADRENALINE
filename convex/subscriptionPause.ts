/**
 * @file convex/subscriptionPause.ts
 * @description تجميد واستئناف اشتراك المشترك (سفر / ظرف طارئ).
 *
 * القاعدة: العميل لا يخسر أيامه. عند الاستئناف نعدّ **أيام التوصيل** التي فاتته
 * أثناء التجميد ونمدّ `endDate` بنفس العدد.
 *
 * لماذا أيام التوصيل وليس الأيام التقويمية:
 *   المطعم يوصّل السبت→الأربعاء فقط (الخميس والجمعة إجازة — انظر customerOrders.getDayOffset).
 *   لو جمّدنا 14 يوماً تقويمياً فذلك 10 أيام توصيل فقط؛ تمديد 14 يوماً يمنح العميل
 *   4 أيام لم يدفع مقابلها.
 *
 * الصلاحية: موظفون فقط (قرار العمل: العميل يتصل والموظف ينفّذ).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";

/* ========== أدوات التاريخ (UTC حتى لا ينزلق اليوم مع المنطقة الزمنية) ========== */

/** yyyy-MM-dd → Date (UTC midnight) */
function parseDate(s: string): Date {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date → yyyy-MM-dd */
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * أيام التوصيل: السبت(6) الأحد(0) الاثنين(1) الثلاثاء(2) الأربعاء(3).
 * الخميس(4) والجمعة(5) إجازة.
 */
function isDeliveryDay(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow !== 4 && dow !== 5;
}

/** عدد أيام التوصيل في المدى [from, toExclusive) مع استبعاد أيام تخطّاها العميل مسبقاً. */
function countDeliveryDays(from: string, toExclusive: string, skipped: string[] = []): number {
  const skip = new Set(skipped);
  let n = 0;
  let cur = parseDate(from);
  const end = parseDate(toExclusive);
  // حدّ احترازي: سنة كاملة
  for (let i = 0; i < 400 && cur.getTime() < end.getTime(); i++) {
    if (isDeliveryDay(cur) && !skip.has(fmtDate(cur))) n++;
    cur = addDays(cur, 1);
  }
  return n;
}

/** يمدّ تاريخاً إلى الأمام بعدد `n` من أيام التوصيل، ويرجّع آخر يوم توصيل مضاف. */
function addDeliveryDays(fromDate: string, n: number): string {
  let cur = parseDate(fromDate);
  let added = 0;
  for (let i = 0; i < 800 && added < n; i++) {
    cur = addDays(cur, 1);
    if (isDeliveryDay(cur)) added++;
  }
  return fmtDate(cur);
}

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
