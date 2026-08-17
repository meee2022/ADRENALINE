/**
 * @file convex/coupons.ts
 * @description نظام كوبونات الخصم
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff, requireAdmin } from "./sessions";
import { internalQuery, internalMutation } from "./_generated/server";

/**
 * حكم الكوبون — مصدرٌ واحد يحتكم إليه الطرفان.
 *
 * الاستعلام العام يعرضه للمشترك ليطمئنّ قبل الدفع، والدفع الحقيقي يستدعيه
 * على الخادم قبل إرسال المبلغ لبوّابة الدفع. فلو عبث أحدٌ بما ترسله الصفحة
 * لم يتغيّر شيء: الحساب هنا لا هناك.
 */
export function judgeCoupon(
  coupon: any,
  amount: number,
  restaurantKey = "ADRENALINE",
): { valid: false; error: string } | { valid: true; discount: number; finalTotal: number; coupon: any } {
  if (!coupon) return { valid: false, error: "الكود غير موجود" };
  if (!coupon.isActive) return { valid: false, error: "الكود غير مفعّل" };
  if (String(coupon.restaurantKey || "ADRENALINE") !== restaurantKey) {
    return { valid: false, error: "الكود لا يسري على هذه الباقة" };
  }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: "تم استنفاد عدد مرات الاستخدام" };
  }
  if (coupon.expiresAt) {
    /* توقيت قطر (+3): بعد منتصف الليل بساعات يبقى اليوم في لندن أمس، فيُقبل
       كودٌ منتهٍ أو يُرفض ساري. */
    const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
    if (today > coupon.expiresAt) return { valid: false, error: "الكود منتهي الصلاحية" };
  }
  if (coupon.minOrderQAR && amount < Number(coupon.minOrderQAR)) {
    return { valid: false, error: `الكود يسري على الاشتراكات من ${coupon.minOrderQAR} ر.ق فأكثر` };
  }
  const raw = coupon.discountType === "PERCENT"
    ? amount * (Number(coupon.discountValue) / 100)
    : Number(coupon.discountValue);
  /* لا يتجاوز الحسمُ قيمةَ الاشتراك، ولا يُترك كسراً في فاتورةٍ بالريال. */
  const discount = Math.min(amount, Math.round(raw));
  return { valid: true, discount, finalTotal: Math.max(0, amount - discount), coupon };
}

/** قراءة كوبون بكوده — لمسار الدفع على الخادم (لا يمرّ بجلسة طاقم). */
export const getByCodeInternal = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) =>
    await ctx.db.query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first(),
});

/**
 * يحتسب استخدامَ الكوبون — يُنادى عند **نجاح الدفع** لا عند كتابة الكود.
 * ولو استُدعي مرتين للدفعة نفسها لم يُحتسب مرتين (الختم على الدفعة).
 */
export const countUseInternal = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const c = await ctx.db.query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!c) return false;
    await ctx.db.patch(c._id, { usedCount: Number(c.usedCount || 0) + 1 });
    return true;
  },
});

export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.db.query("coupons").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    code: v.string(),
    discountType: v.union(v.literal("PERCENT"), v.literal("FIXED")),
    discountValue: v.number(),
    maxUses: v.optional(v.number()),
    expiresAt: v.optional(v.string()),
    restaurantKey: v.optional(v.union(v.literal("ADRENALINE"), v.literal("NUTRI_RESET"))),
    minOrderQAR: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const code = args.code.trim().toUpperCase();
    const existing = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (existing) throw new Error("الكود موجود مسبقاً");
    return await ctx.db.insert("coupons", {
      code,
      discountType: args.discountType,
      discountValue: args.discountValue,
      maxUses: args.maxUses,
      usedCount: 0,
      expiresAt: args.expiresAt,
      restaurantKey: args.restaurantKey || "ADRENALINE",
      minOrderQAR: args.minOrderQAR,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("coupons"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    await ctx.db.delete(id);
    return { success: true };
  },
});

export const toggleActive = mutation({
  args: { id: v.id("coupons"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const coupon = await ctx.db.get(id);
    if (!coupon) throw new Error("Coupon not found");
    await ctx.db.patch(id, { isActive: !coupon.isActive });
  },
});

/**
 * التحقق من كوبون - يستخدم في checkout
 */
export const validate = query({
  args: {
    code: v.string(),
    orderTotal: v.number(),
    restaurantKey: v.optional(v.string()),
  },
  handler: async (ctx, { code, orderTotal, restaurantKey }) => {
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    const j = judgeCoupon(coupon, orderTotal, restaurantKey || "ADRENALINE");
    if (!j.valid) return { valid: false, error: j.error };
    return {
      valid: true,
      code: coupon!.code,
      discount: j.discount,
      discountType: coupon!.discountType,
      discountValue: coupon!.discountValue,
      finalTotal: j.finalTotal,
    };
  },
});

export const incrementUsage = mutation({
  args: { code: v.string() , sessionToken: v.optional(v.string()) },
  handler: async (ctx, { code, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!coupon) throw new Error("Coupon not found");
    if (!coupon.isActive) throw new Error("Coupon inactive");
    // ✅ فرض الحد الأقصى للاستخدام داخل الـmutation (Convex يسلسل المعاملات → لا تجاوز)
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      throw new Error("Coupon usage limit reached");
    }
    await ctx.db.patch(coupon._id, { usedCount: coupon.usedCount + 1 });
  },
});
