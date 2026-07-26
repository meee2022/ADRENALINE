import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireStaff } from "./sessions";

const DEFAULT_AUTOMATION = {
  channel: "WHATSAPP" as const,
  enabled: false,
  testMode: true,
  timezone: "Asia/Qatar",
  sendHour: 10,
  renewal7Enabled: true,
  renewal3Enabled: true,
  expiryDayEnabled: true,
  expired2Enabled: false,
  deliveryFailureEnabled: true,
  templateRenewalAr: "مرحباً {{name}}، اشتراكك في Adrenaline ينتهي بتاريخ {{endDate}}. يسعدنا مساعدتك في التجديد.",
  templateRenewalEn: "Hi {{name}}, your Adrenaline subscription ends on {{endDate}}. We would be happy to help you renew.",
  templateDeliveryAr: "مرحباً {{name}}، نعتذر عن تعذر توصيل طلبك اليوم. سيتواصل معك فريقنا لترتيب وقت بديل.",
  templateDeliveryEn: "Hi {{name}}, we could not complete today's delivery. Our team will contact you to arrange another time.",
};

/** عدد الأيام الماضية التي نبحث فيها عن حالات فشل التوصيل. */
const FAILED_LOOKBACK_DAYS = 7;

/**
 * مساحة عمل المتابعة.
 * ⚠️ كانت تقرأ **كل** الخطط اليومية وكل حقول العملاء في استعلام واحد، فتثقل
 *    كل يوم مع نمو الجدول (710 خطة وقت الكتابة) وترسل وثائق كاملة لا تحتاجها
 *    الواجهة. الآن: نافذة أيام محدودة على فهرس التاريخ، وحقول العميل المطلوبة فقط.
 */
export const workspace = query({
  args: { sessionToken: v.optional(v.string()), lookbackDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);

    const days = Math.min(Math.max(Number(args.lookbackDays) || FAILED_LOOKBACK_DAYS, 1), 60);
    // توقيت قطر (+3) حتى لا يقفز اليوم قبل منتصف الليل محلياً
    const iso = (t: number) => new Date(t + 3 * 3600 * 1000).toISOString().slice(0, 10);
    const today = iso(Date.now());
    const from = iso(Date.now() - days * 86400000);

    const [allCustomers, tasks] = await Promise.all([
      ctx.db.query("customers").collect(),
      ctx.db.query("customerFollowUps").withIndex("by_status", q => q.eq("status", "OPEN")).collect(),
    ]);

    // نافذة التواريخ فقط — لا مسح كامل للجدول
    const plans: any[] = [];
    for (let i = 0; i <= days; i++) {
      const d = iso(Date.now() - i * 86400000);
      if (d < from || d > today) continue;
      const rows = await ctx.db.query("dailyPlans").withIndex("by_date", q => q.eq("date", d)).collect();
      for (const r of rows) if (r.failedAt && r.customerId) plans.push(r);
    }

    // الواجهة تحتاج: الاسم والهاتف ونهاية الاشتراك والحالة فقط
    const slim = (c: any) => c && ({
      _id: c._id, fullName: c.fullName, phone: c.phone,
      endDate: c.endDate, isActive: c.isActive,
    });
    const byId = new Map(allCustomers.map((c: any) => [String(c._id), c]));
    const failed = plans.map((p: any) => ({
      _id: p._id, date: p.date, failReason: p.failReason, failedAt: p.failedAt,
      customer: slim(byId.get(String(p.customerId))),
    }));

    return { customers: allCustomers.map(slim), tasks, failedDeliveries: failed };
  },
});

export const createFollowUp = mutation({
  args: { customerId: v.id("customers"), type: v.union(v.literal("RENEWAL"), v.literal("DELIVERY_FAILURE"), v.literal("GENERAL")), note: v.string(), dueDate: v.optional(v.string()), sourcePlanId: v.optional(v.id("dailyPlans")), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity: any = await requireStaff(ctx, args.sessionToken);
    const note = args.note.trim(); if (!note) throw new Error("ملاحظة المتابعة مطلوبة");
    return await ctx.db.insert("customerFollowUps", { customerId: args.customerId, type: args.type, status: "OPEN", note, dueDate: args.dueDate, sourcePlanId: args.sourcePlanId, createdBy: identity.userId as any, createdAt: Date.now() });
  },
});

export const closeFollowUp = mutation({
  args: { id: v.id("customerFollowUps"), status: v.union(v.literal("DONE"), v.literal("DISMISSED")), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => { await requireStaff(ctx, args.sessionToken); await ctx.db.patch(args.id, { status: args.status, completedAt: Date.now(), updatedAt: Date.now() }); },
});

export const automationSettings = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const saved = await ctx.db.query("messageAutomationSettings")
      .withIndex("by_channel", (q) => q.eq("channel", "WHATSAPP")).first();
    return {
      ...(saved || DEFAULT_AUTOMATION),
      connected: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      hasWebhookSecret: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    };
  },
});

export const saveAutomationSettings = mutation({
  args: {
    enabled: v.boolean(), testMode: v.boolean(), timezone: v.string(), sendHour: v.number(),
    renewal7Enabled: v.boolean(), renewal3Enabled: v.boolean(), expiryDayEnabled: v.boolean(),
    expired2Enabled: v.boolean(), deliveryFailureEnabled: v.boolean(),
    templateRenewalAr: v.string(), templateRenewalEn: v.string(),
    templateDeliveryAr: v.string(), templateDeliveryEn: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx, args.sessionToken);
    if (args.sendHour < 0 || args.sendHour > 23) throw new Error("ساعة الإرسال يجب أن تكون بين 0 و23");
    const { sessionToken: _sessionToken, ...values } = args;
    void _sessionToken;
    const current = await ctx.db.query("messageAutomationSettings")
      .withIndex("by_channel", (q) => q.eq("channel", "WHATSAPP")).first();
    const patch = { ...values, channel: "WHATSAPP" as const, updatedBy: identity.userId as any, updatedAt: Date.now() };
    if (current) { await ctx.db.patch(current._id, patch); return current._id; }
    return await ctx.db.insert("messageAutomationSettings", patch);
  },
});

export const automationLogs = query({
  args: { limit: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.db.query("messageAutomationLogs").order("desc").take(Math.min(args.limit || 50, 200));
  },
});

/** Creates a harmless sample log so the complete workflow can be reviewed before API credentials are added. */
export const simulateAutomation = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const customer: any = await ctx.db.query("customers").order("desc").first();
    if (!customer) throw new Error("لا يوجد عميل لاختبار الرسالة");
    return await ctx.db.insert("messageAutomationLogs", {
      customerId: customer._id, customerName: customer.fullName, phone: customer.phone,
      eventKey: "RENEWAL_7_DAYS", language: "ar", status: "SIMULATED", createdAt: Date.now(),
    });
  },
});
