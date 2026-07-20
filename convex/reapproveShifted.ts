/**
 * @file convex/reapproveShifted.ts
 * @description إصلاح خطط الـ4 المتزحلقة بإعادة اعتماد طلباتهم بالكود المصلَّح.
 *
 *   ═══ السبب ═══
 *   باگ ×6 القديم زحلق تواريخ خططهم فوقعت أيام على الجمعة (لا توصيل). المشترك
 *   اختار صح (بلا جمعة)؛ النظام هو من أخطأ الحساب. الكود صُلِح (5a58f06)، فإعادة
 *   الاعتماد تولّد الخطط من جديد صحيحةً بلا جمعة.
 *
 *   ═══ الآلية (بقرار المستخدم) ═══
 *   الماضي لا يهم — نصلّح الخطط **القادمة** فقط (date >= today). الخطط المسلّمة
 *   أو التي مضى موعدها تُترك كما هي (حقائق حصلت).
 *
 *   لكل مشترك: (1) نشتقّ تاريخ البداية الصحيح من أول يوم في خطته، (2) نحذف خططه
 *   القادمة، (3) نُرجع الطلب pending، (4) نعيد approve بنفس startDate.
 *
 *   ⚠️ approve يأخذ startDate جديداً — لو غلط، تخرج التواريخ كلها غلط. نشتقّه من
 *      أقدم خطة للمشترك (أول يوم توصيل فعلي) لا من الجمعة.
 *   ⚠️ معاينة أولاً: تحسب أين ستقع كل وجبة بالكود المصلَّح دون أي كتابة.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";
import { parseDate, fmtDate, addDeliveryDays, isDeliveryDay, getDayOffset } from "./lib/dates";

/** نفس حساب approve المصلَّح — نحاكيه للمعاينة. */
function computeDates(startISO: string, items: any[]): { date: string; item: any }[] {
  const startIso = String(startISO).slice(0, 10);
  const firstDelivery = isDeliveryDay(parseDate(startIso)) ? startIso : addDeliveryDays(startIso, 1);
  const chosenWeeks = Array.from(new Set(items.map((it) => Number(it.week)))).sort((a, b) => a - b);
  const rank = new Map(chosenWeeks.map((w, i) => [w, i]));
  return items.map((it) => {
    const n = (rank.get(Number(it.week)) ?? 0) * 6 + getDayOffset(String(it.day));
    return { date: addDeliveryDays(firstDelivery, n), item: it };
  });
}

const AFFECTED = ["mansour ketbi", "sultan alsoufi", "abdulrahman almahmoud", "fahd nasser"];

async function survey(ctx: any) {
  const orders = await ctx.db.query("customerOrders").collect();
  const custs = await ctx.db.query("customers").collect();
  const nameById = new Map(custs.map((c: any) => [String(c._id), c.name || c.fullName || c.customerName || ""]));
  const plans = await ctx.db.query("dailyPlans").collect();
  const today = fmtDate(parseDate(new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)));

  const out: any[] = [];
  for (const ord of orders as any[]) {
    const nm = String(ord.customerName || nameById.get(String(ord.customerId)) || "").toLowerCase();
    if (!AFFECTED.some((a) => nm.includes(a))) continue;
    if (!ord.customerId) continue;

    // خطط هذا المشترك من هذا الطلب
    const his = (plans as any[]).filter((p) => String(p.customerId) === String(ord.customerId));
    const fromOrder = his.filter((p) => String(p.sourceOrderId || "") === String(ord._id));
    const future = fromOrder.filter((p) => p.date >= today);
    const past = fromOrder.filter((p) => p.date < today);

    // تاريخ البداية الصحيح = أقدم يوم توصيل في خطط هذا الطلب
    const allDates = fromOrder.map((p) => p.date).sort();
    const start = allDates[0] || ord.preferredStartDate || today;

    // الأصناف من الطلب
    const items = await ctx.db.query("customerOrderItems")
      .withIndex("by_orderId", (q: any) => q.eq("orderId", ord._id)).collect();

    // النتيجة المتوقعة بالكود المصلَّح
    const computed = computeDates(start, items as any[]);
    const wouldHitFriday = computed.filter((c) => parseDate(c.date).getUTCDay() === 5).length;
    const futureFriday = future.filter((p) => parseDate(p.date).getUTCDay() === 5).length;

    out.push({
      orderId: String(ord._id), orderNumber: ord.orderNumber, status: ord.status,
      customer: ord.customerName || nameById.get(String(ord.customerId)),
      customerId: String(ord.customerId),
      derivedStart: start, items: items.length,
      currentFuturePlans: future.length, currentPastPlans: past.length,
      currentFutureFriday: futureFriday,
      afterFriday: wouldHitFriday, // يجب أن يكون 0
      sampleNewDates: computed.slice(0, 3).map((c) => c.date),
    });
  }
  return out;
}

/** 🔍 معاينة — لا تكتب. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    return { orders: await survey(ctx) };
  },
});

/**
 * ✅ التنفيذ لطلب واحد — نمرّره orderId + startDate (من المعاينة).
 *    باك أب كل خطط الطلب → حذفها → إرجاع الطلب pending. **لا نُعيد approve هنا**؛
 *    نستدعي customerOrders.approve من السكربت بعدها بنفس startDate، فيمرّ على
 *    الكود المصلَّح الوحيد المسؤول عن توليد الخطط (لا نكرّر منطقه).
 */
export const resetForReapprove = mutation({
  args: { orderId: v.id("customerOrders"), confirm: v.literal("RESET"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { orderId, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const order: any = await ctx.db.get(orderId);
    if (!order) throw new Error("الطلب غير موجود");

    // باك أب + حذف كل خطط هذا الطلب
    const plans = (await ctx.db.query("dailyPlans").collect() as any[])
      .filter((p) => String(p.sourceOrderId || "") === String(orderId));
    const backup: any[] = [];
    for (const p of plans) { backup.push(p); await ctx.db.delete(p._id); }

    // إرجاع الطلب pending حتى يقبل approve إعادةَ التوليد (idempotency يمنعه لو confirmed)
    await ctx.db.patch(orderId, { status: "pending" });

    return { deletedPlans: plans.length, backup, customerId: String(order.customerId || ""), orderNumber: order.orderNumber };
  },
});
