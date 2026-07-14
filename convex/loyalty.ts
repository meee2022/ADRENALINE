/**
 * @file convex/loyalty.ts
 * @description برنامج الولاء بالنظام القياسي للمطاعم — العميل يكسب نقاطاً مع كل
 *   طلب معتمد، ويستبدلها برصيد خصم (ر.ق) يُخصم من تجديد اشتراكه القادم.
 *   الإعدادات (نقاط/طلب، قيمة النقطة، أقل حد للاستبدال) في restaurantSettings.loyalty.
 * @frontend client/src/pages/public/CustomerProfile.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaffOrSubscriptionOwner } from "./sessions";

/** إعدادات الولاء الافتراضية — النظام القياسي (كل نقطة = 0.10 ر.ق، 100 نقطة = 10 ر.ق). */
const DEFAULTS = { pointsPerOrder: 10, riyalPerPoint: 0.1, minRedeem: 100 };

/** يقرأ إعدادات الولاء (مع القيم الافتراضية لو غير مضبوطة). داخلي. */
export async function loyaltyConfig(ctx: any) {
  const s = await ctx.db.query("restaurantSettings").first();
  const l = (s as any)?.loyalty;
  return {
    pointsPerOrder: Number(l?.pointsPerOrder ?? DEFAULTS.pointsPerOrder),
    riyalPerPoint: Number(l?.riyalPerPoint ?? DEFAULTS.riyalPerPoint),
    minRedeem: Number(l?.minRedeem ?? DEFAULTS.minRedeem),
  };
}

/** إعدادات الولاء — متاحة للجميع (لعرض قاعدة الاستبدال في البورتال). */
export const config = query({
  args: {},
  handler: async (ctx) => loyaltyConfig(ctx),
});

/**
 * استبدال النقاط برصيد خصم. يستبدل بمضاعفات الحد الأدنى فقط، ويخصم النقاط
 *   المستخدَمة ويضيف الرصيد المكافئ. للعميل صاحب الاشتراك أو الموظف.
 */
export const redeem = mutation({
  args: {
    customerId: v.id("customers"),
    points: v.optional(v.number()), // عدد النقاط المطلوب استبدالها؛ افتراضياً كل المتاح
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffOrSubscriptionOwner(ctx, args.sessionToken, String(args.customerId));
    const cfg = await loyaltyConfig(ctx);
    const cust: any = await ctx.db.get(args.customerId);
    if (!cust) throw new Error("العميل غير موجود");
    const available = Number(cust.loyaltyPoints || 0);

    // اطلب مضاعفات الحد الأدنى فقط
    let want = args.points != null ? Math.floor(args.points) : available;
    want = Math.min(want, available);
    const redeemable = Math.floor(want / cfg.minRedeem) * cfg.minRedeem;
    if (redeemable < cfg.minRedeem) {
      throw new Error(`تحتاج ${cfg.minRedeem} نقطة على الأقل للاستبدال`);
    }
    const credit = Math.round(redeemable * cfg.riyalPerPoint * 100) / 100;
    const history = Array.isArray(cust.loyaltyHistory) ? cust.loyaltyHistory : [];
    await ctx.db.patch(args.customerId, {
      loyaltyPoints: available - redeemable,
      loyaltyCredit: Math.round((Number(cust.loyaltyCredit || 0) + credit) * 100) / 100,
      loyaltyHistory: [
        ...history,
        { type: "REDEEM", points: -redeemable, credit, note: `استبدال ${redeemable} نقطة`, at: Date.now() },
      ].slice(-50),
      updatedAt: Date.now(),
    });
    return { redeemed: redeemable, credit, remainingPoints: available - redeemable };
  },
});

/**
 * ✅ منح نقاط ولاء لعميل عن فاتورة POS مربوطة به.
 *   يستخدمه POS بعد الدفع لو التذكرة عليها customerId.
 *   يحتفظ بسجل الحركة (EARN_POS) مع رقم الفاتورة.
 */
export async function awardPointsForPosTicket(ctx: any, customerId: string, ticketNumber: number, total: number) {
  const cust: any = await ctx.db.get(customerId);
  if (!cust) return { awarded: 0 };
  const cfg = await loyaltyConfig(ctx);
  // نقاط لكل فاتورة كاملة (نفس منطق الاشتراك؛ يمكن تطويرها لاحقاً بنسبة من المبلغ)
  const points = Math.max(0, Math.floor(cfg.pointsPerOrder));
  if (points <= 0) return { awarded: 0 };
  const history = Array.isArray(cust.loyaltyHistory) ? cust.loyaltyHistory : [];
  await ctx.db.patch(customerId as any, {
    loyaltyPoints: Number(cust.loyaltyPoints || 0) + points,
    loyaltyHistory: [
      ...history,
      { type: "EARN_POS", points, credit: 0, note: `فاتورة POS #${ticketNumber} · ${total.toFixed(2)} ر.ق`, at: Date.now() },
    ].slice(-50),
    updatedAt: Date.now(),
  });
  return { awarded: points };
}

