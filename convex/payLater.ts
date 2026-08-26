import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { judgeCoupon } from "./coupons";
import { v } from "convex/values";

const UAT = "https://connect.uat.paylaterapp.com";

function config() {
  const production = process.env.PAYLATER_ENV === "production";
  return {
    environment: production ? "production" as const : "sandbox" as const,
    baseUrl: production ? "https://connect.paylaterapp.com" : UAT,
    clientId: production ? process.env.PAYLATER_CLIENT_ID : (process.env.PAYLATER_CLIENT_ID || "merchant-138"),
    clientSecret: production ? process.env.PAYLATER_CLIENT_SECRET : (process.env.PAYLATER_CLIENT_SECRET || "M6Xjszdtd8X2XivLmUvS9Pa7Hm0JeA6g"),
    outletId: Number(production ? process.env.PAYLATER_OUTLET_ID : (process.env.PAYLATER_OUTLET_ID || "1000000061")),
  };
}

async function accessToken(c: ReturnType<typeof config>) {
  if (!c.clientId || !c.clientSecret || !Number.isFinite(c.outletId)) throw new Error("PayLater is not configured");
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: c.clientId, client_secret: c.clientSecret });
  const res = await fetch(`${c.baseUrl}/auth/realms/api/protocol/openid-connect/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body,
  });
  if (!res.ok) throw new Error(`PayLater authentication failed (${res.status})`);
  return String((await res.json()).access_token || "");
}

export const saveAttempt = internalMutation({
  args: {
    orderId: v.string(), checkoutToken: v.string(), planId: v.id("publicPlans"), planName: v.string(),
    optionIndex: v.number(), amount: v.number(),
    originalAmount: v.optional(v.number()), couponCode: v.optional(v.string()),
    couponDiscount: v.optional(v.number()),
    customerName: v.string(), customerPhone: v.string(),
    customerEmail: v.optional(v.string()), environment: v.union(v.literal("sandbox"), v.literal("production")),
    paymentLinkUrl: v.string(),
  },
  handler: async (ctx, a) => ctx.db.insert("payLaterPayments", {
    ...a, currency: "QAR", status: "pending", createdAt: Date.now(), updatedAt: Date.now(),
  }),
});

export const applyStatus = internalMutation({
  args: { orderId: v.string(), status: v.union(v.literal("pending"), v.literal("success"), v.literal("failed")), payLaterOrderId: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("payLaterPayments").withIndex("by_orderId", q => q.eq("orderId", a.orderId)).unique();
    if (!row) return false;
    await ctx.db.patch(row._id, { status: a.status, payLaterOrderId: a.payLaterOrderId, updatedAt: Date.now() });

    /* الاستخدام يُحتسب عند نجاح الدفع وحده — لا عند كتابة الكود، وإلا أحرقه
       من جرّبه ولم يشترِ. و`couponCounted` يمنع تكرار الاحتساب لو استُعلم عن
       حالة الدفعة أكثر من مرة (والصفحة تستعلم عند كل فتح). */
    if (a.status === "success" && row.couponCode && !row.couponCounted) {
      const c = await ctx.db.query("coupons")
        .withIndex("by_code", (q) => q.eq("code", String(row.couponCode).toUpperCase()))
        .first();
      if (c) await ctx.db.patch(c._id, { usedCount: Number(c.usedCount || 0) + 1 });
      await ctx.db.patch(row._id, { couponCounted: true });
    }
    return true;
  },
});

export const createCheckout = action({
  args: {
    planId: v.id("publicPlans"), optionIndex: v.number(), customerName: v.string(), customerPhone: v.string(),
    customerEmail: v.optional(v.string()), returnOrigin: v.string(),
    couponCode: v.optional(v.string()),
  },
  handler: async (ctx, a): Promise<any> => {
    const plan: any = await ctx.runQuery(internal.payLater.getPlanInternal, { planId: a.planId });
    if (!plan || plan.isActive === false) throw new Error("Plan is not available");
    const option = plan.options?.[a.optionIndex];
    const listPrice = Number(option?.priceQAR);
    if (!Number.isFinite(listPrice)) throw new Error("This plan has no price");

    /* الخصم يُحسب هنا لا في المتصفح: الصفحة ترسل الكود وحده، والمبلغ الذاهب
       إلى بوّابة الدفع يُشتقّ من سعر الباقة المخزَّن. فلو بُعث خصمٌ مصنوع
       من جهة العميل لم يُقرأ أصلاً. */
    let amount = listPrice;
    let couponCode: string | undefined;
    let couponDiscount = 0;
    if (a.couponCode && a.couponCode.trim()) {
      const coupon: any = await ctx.runQuery(internal.coupons.getByCodeInternal, { code: a.couponCode });
      const j = judgeCoupon(coupon, listPrice, "ADRENALINE");
      if (!j.valid) throw new Error(j.error);
      amount = j.finalTotal;
      couponDiscount = j.discount;
      couponCode = String(coupon.code);
    }
    if (amount < 300 || amount > 25000) {
      throw new Error(couponCode
        ? `المبلغ بعد الخصم (${amount} ر.ق) خارج حدود الدفع الإلكتروني — تواصل مع أخصائية التغذية لإتمام الاشتراك`
        : "This plan is outside PayLater's allowed amount range");
    }
    const origin = new URL(a.returnOrigin);
    if (origin.protocol !== "https:" && origin.hostname !== "localhost") throw new Error("Invalid return URL");
    const c = config();
    const token = await accessToken(c);
    const orderId = `ADR-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const checkoutToken = crypto.randomUUID();
    const resultUrl = `${origin.origin}/public/paylater/result?token=${encodeURIComponent(checkoutToken)}`;
    const res = await fetch(`${c.baseUrl}/api/paylater/merchant-portal/v2/web-checkout`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ outlet_id: c.outletId, currency: "QAR", amount, order_id: orderId, success_redirect_url: `${resultUrl}&result=success`, fail_redirect_url: `${resultUrl}&result=failed`, expiry_duration: 30 }),
    });
    const json: any = await res.json();
    if (!res.ok || !json.paymentLinkUrl) throw new Error(json.error || `PayLater checkout failed (${res.status})`);
    await ctx.runMutation(internal.payLater.saveAttempt, {
      orderId, checkoutToken, planId: a.planId, planName: plan.nameEn || plan.nameAr, optionIndex: a.optionIndex,
      amount, originalAmount: listPrice, couponCode, couponDiscount: couponDiscount || undefined,
      customerName: a.customerName.trim(), customerPhone: a.customerPhone.trim(), customerEmail: a.customerEmail?.trim() || undefined,
      environment: c.environment, paymentLinkUrl: json.paymentLinkUrl,
    });
    return { paymentLinkUrl: json.paymentLinkUrl, checkoutToken };
  },
});

export const refreshStatus = action({
  args: { checkoutToken: v.string() },
  handler: async (ctx, a): Promise<any> => {
    const payment: any = await ctx.runQuery(internal.payLater.getPaymentInternal, { checkoutToken: a.checkoutToken });
    if (!payment) throw new Error("Payment not found");
    const c = config();
    const token = await accessToken(c);
    const res = await fetch(`${c.baseUrl}/api/paylater/merchant-portal/v2/web-checkout/status?order_id=${encodeURIComponent(payment.orderId)}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Unable to verify payment (${res.status})`);
    const json: any = await res.json();
    const status = json.status === 2 ? "success" : json.status === 3 ? "failed" : "pending";
    await ctx.runMutation(internal.payLater.applyStatus, { orderId: payment.orderId, status, payLaterOrderId: json.payLaterOrderId });
    return { status, orderId: payment.orderId, amount: payment.amount, planName: payment.planName, environment: payment.environment };
  },
});

export const getPlanInternal = internalQuery({
  args: { planId: v.id("publicPlans") },
  handler: (ctx, a) => ctx.db.get(a.planId),
});
export const getPaymentInternal = internalQuery({
  args: { checkoutToken: v.string() },
  handler: (ctx, a) => ctx.db.query("payLaterPayments").withIndex("by_checkoutToken", q => q.eq("checkoutToken", a.checkoutToken)).unique(),
});

export const publicStatus = query({
  args: { checkoutToken: v.string() },
  handler: async (ctx, a) => {
    const p = await ctx.db.query("payLaterPayments").withIndex("by_checkoutToken", q => q.eq("checkoutToken", a.checkoutToken)).unique();
    return p ? { status: p.status, orderId: p.orderId, amount: p.amount, planName: p.planName, environment: p.environment } : null;
  },
});

// Expose only the non-sensitive environment label so the checkout UI never
// shows a sandbox warning while the backend is configured for live payments.
export const publicEnvironment = query({
  args: {},
  handler: () => ({ environment: config().environment }),
});
