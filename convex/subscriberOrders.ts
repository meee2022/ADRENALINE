/**
 * «طلباتي وخطتي المعتمدة» للمشترك — قراءة فقط.
 *
 * لا يغيّر شيئاً في دورة الطلب (إرسال ← اعتماد ← خطط المطبخ). الطلب يُعرف
 * بتوكن التتبع السرّي الذي يعيده customerOrders.create ويحفظه جهاز المشترك،
 * أو يُستعاد بـ(رقم الطلب + الهاتف) معاً، أو من حساب المشترك المسجَّل.
 *
 * الجدول المعروض بعد الاعتماد يُقرأ من dailyPlans المملوكة للطلب
 * (sourceOrderId) — نفس ما يطبخه المطبخ ويوصّله — لا من أسبوع/يوم الطلب:
 * الأخصائية قد تعدّل بعد الاعتماد، وطلب أحدث قد يستبدل أياماً من طلب أقدم.
 * ولا يُكشف من الخطة إلا الوجبات (لا حساسية ولا ممنوعات ولا هاتف).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { newToken, requireStaffOrAccountOwner } from "./sessions";

const digits = (p: unknown) => {
  const d = String(p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("974") ? d.slice(3) : d;
};

const mealView = (it: any) => ({
  mealNameAr: it?.mealNameAr || "",
  mealNameEn: it?.mealNameEn || "",
  category: it?.category || "",
  calories: it?.calories ?? null,
  protein: it?.protein ?? null,
  carbs: it?.carbs ?? null,
  fats: it?.fats ?? null,
  imageUrl: it?.imageUrl ?? null,
});

/** طلب واحد كاملاً بتوكن التتبع: الحالة + الوجبات المطلوبة + الجدول الفعلي بعد الاعتماد. */
export const view = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token || token.length < 20) return null;
    const order: any = await ctx.db.query("customerOrders")
      .withIndex("by_tracking_token", (q) => q.eq("trackingToken", token)).first();
    if (!order) return null;
    const items = await ctx.db.query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id)).collect();

    let schedule: Array<{ date: string; deliveryTime: string; status: string; meals: any[] }> = [];
    if (order.status === "confirmed" || order.status === "active" || order.status === "completed") {
      const plans = await ctx.db.query("dailyPlans")
        .withIndex("by_source_order", (q: any) => q.eq("sourceOrderId", order._id)).collect();
      schedule = (plans as any[])
        .map((p) => ({
          date: String(p.date).slice(0, 10),
          deliveryTime: String(p.deliveryTime || ""),
          status: String(p.status || ""),
          meals: (Array.isArray(p.items) ? p.items : []).map(mealView),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      createdAt: order.createdAt,
      approvedAt: order.approvedAt ?? null,
      rejectionReason: order.status === "cancelled" ? (order.rejectionReason || "") : "",
      preferredStartDate: order.preferredStartDate || "",
      totalMeals: order.totalMeals,
      totalCalories: order.totalCalories,
      items: items.map((it: any) => ({ ...mealView(it), week: it.week, day: it.day })),
      schedule,
    };
  },
});

/**
 * استعادة طلب على جهاز جديد: رقم الطلب والهاتف معاً (أحدهما وحده لا يكفي).
 * mutation لأن الطلبات القديمة قد تسبق توكن التتبع فيُولَّد لها مرة واحدة.
 */
export const recover = mutation({
  args: { orderNumber: v.string(), phone: v.string() },
  handler: async (ctx, { orderNumber, phone }) => {
    const num = String(orderNumber || "").trim().toUpperCase();
    const order: any = await ctx.db.query("customerOrders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", num)).first();
    if (!order || !digits(phone) || digits(phone) !== digits(order.customerPhone)) return null;
    let token = order.trackingToken as string | undefined;
    if (!token) { token = newToken(); await ctx.db.patch(order._id, { trackingToken: token }); }
    return { token, orderNumber: order.orderNumber, createdAt: order.createdAt };
  },
});

/** طلبات صاحب الحساب المسجَّل (المربوط باشتراكه) — تظهر له على أي جهاز. */
export const forAccount = mutation({
  args: { accountId: v.id("customerAccounts"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { accountId, sessionToken }) => {
    await requireStaffOrAccountOwner(ctx, sessionToken, accountId);
    const account: any = await ctx.db.get(accountId);
    const customer: any = account?.customerId ? await ctx.db.get(account.customerId) : null;
    if (!customer) return [];
    const d = digits(customer.phone);
    const variants = [...new Set([String(customer.phone || ""), d, `974${d}`, `+974${d}`].filter(Boolean))];
    const seen = new Set<string>();
    const out: Array<{ token: string; orderNumber: string; createdAt: number }> = [];
    for (const ph of variants) {
      const rows = await ctx.db.query("customerOrders").withIndex("by_phone", (q) => q.eq("customerPhone", ph)).collect();
      for (const o of rows as any[]) {
        if (seen.has(String(o._id))) continue;
        // رقم تتشاركه عائلة: طلب مربوط بمشترك آخر لا يظهر هنا.
        if (o.customerId && String(o.customerId) !== String(customer._id)) continue;
        seen.add(String(o._id));
        let token = o.trackingToken as string | undefined;
        if (!token) { token = newToken(); await ctx.db.patch(o._id, { trackingToken: token }); }
        out.push({ token, orderNumber: o.orderNumber, createdAt: o.createdAt });
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  },
});
