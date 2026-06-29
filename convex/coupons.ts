/**
 * @file convex/coupons.ts
 * @description نظام كوبونات الخصم
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
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
  },
  handler: async (ctx, args) => {
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
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("coupons") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return { success: true };
  },
});

export const toggleActive = mutation({
  args: { id: v.id("coupons") },
  handler: async (ctx, { id }) => {
    const coupon = await ctx.db.get(id);
    if (!coupon) throw new Error("Coupon not found");
    await ctx.db.patch(id, { isActive: !coupon.isActive });
  },
});

/**
 * التحقق من كوبون - يستخدم في checkout
 */
export const validate = query({
  args: { code: v.string(), orderTotal: v.number() },
  handler: async (ctx, { code, orderTotal }) => {
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();

    if (!coupon) return { valid: false, error: "الكود غير موجود" };
    if (!coupon.isActive) return { valid: false, error: "الكود غير مفعّل" };
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, error: "تم استنفاد عدد مرات الاستخدام" };
    }
    if (coupon.expiresAt) {
      const today = new Date().toISOString().split("T")[0];
      if (today > coupon.expiresAt) return { valid: false, error: "الكود منتهي الصلاحية" };
    }

    const discount =
      coupon.discountType === "PERCENT"
        ? Math.round(orderTotal * (coupon.discountValue / 100))
        : coupon.discountValue;

    return {
      valid: true,
      discount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      finalTotal: Math.max(0, orderTotal - discount),
    };
  },
});

export const incrementUsage = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
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
