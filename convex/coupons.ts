/**
 * @file convex/coupons.ts
 * @description نظام كوبونات الخصم
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff, requireAdmin } from "./sessions";
import { internalQuery, internalMutation } from "./_generated/server";

/**
 * تنقية الكود قبل الحفظ وقبل البحث.
 *
 * كُتب كودان في الإنتاج بكيبورد عربي، فسبقت الحروفَ حركةُ تشكيل لا شكل لها
 * على الشاشة (كسرة/كسرتان). فالمحفوظ «ٍSTEM» والمكتوب «STEM»، والبحث لا
 * يلتقيهما — والرسالة «الكود غير موجود» تُتَّهم بها الكوبونات لا الحرف.
 * فتُحذف الحركات والمدّة والمحارف الصفرية العرض، وتبقى الحروف العربية
 * صالحةً في الأكواد كما كانت.
 */
export function normalizeCode(code: string): string {
  return String(code)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")   // تشكيل وتطويل
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "")   // محارف صفرية العرض
    .trim()
    .toUpperCase();
}

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
  duration?: string,
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
  /* المدّة تُفحص حين تُعرف: الاستعلام العام قد يُنادى بلا باقة (المشترك يكتب
     الكود قبل أن يختار)، فلا يُردّ حينها بل يُترك للحظة الدفع حيث تُعرف. */
  const allowed: string[] = Array.isArray(coupon.durations) ? coupon.durations : [];
  if (allowed.length && duration && !allowed.includes(duration)) {
    const label: Record<string, string> = {
      week: "الأسبوعية", two_weeks: "النصف شهرية", month: "الشهرية",
    };
    const names = allowed.map((d) => label[d] || d).join(" و");
    return { valid: false, error: `الكود يسري على الاشتراكات ${names} فقط` };
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
      .withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
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
      .withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
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
    durations: v.optional(v.array(v.string())),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const code = normalizeCode(args.code);
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
      durations: args.durations?.length ? args.durations : undefined,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

/**
 * تعديل كوبون قائم.
 *
 * كان الإنشاء والحذف وحدهما، فتغييرُ نسبةٍ من ٢٠٪ إلى ١٥٪ يعني حذفَ الكود
 * وإنشاءه من جديد — وقد يكون منشوراً على إنستجرام وفي جيوب الناس. فيُعدَّل
 * في مكانه، ويبقى `usedCount` كما هو لأنه سجلُّ ما حدث لا إعدادٌ يُضبط.
 * والحقول الاختيارية تُمحى بإرسالها فارغةً صراحةً.
 */
export const update = mutation({
  args: {
    id: v.id("coupons"),
    code: v.optional(v.string()),
    discountType: v.optional(v.union(v.literal("PERCENT"), v.literal("FIXED"))),
    discountValue: v.optional(v.number()),
    maxUses: v.optional(v.union(v.number(), v.null())),
    expiresAt: v.optional(v.union(v.string(), v.null())),
    restaurantKey: v.optional(v.union(v.literal("ADRENALINE"), v.literal("NUTRI_RESET"))),
    minOrderQAR: v.optional(v.union(v.number(), v.null())),
    durations: v.optional(v.union(v.array(v.string()), v.null())),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const coupon = await ctx.db.get(args.id);
    if (!coupon) throw new Error("الكود غير موجود");

    const patch: Record<string, any> = {};

    if (args.code !== undefined) {
      const code = normalizeCode(args.code);
      if (!code) throw new Error("الكود لا يصحّ فارغاً");
      if (code !== coupon.code) {
        const clash = await ctx.db.query("coupons")
          .withIndex("by_code", (q) => q.eq("code", code)).first();
        if (clash) throw new Error("الكود موجود مسبقاً");
        patch.code = code;
      }
    }
    if (args.discountType !== undefined) patch.discountType = args.discountType;
    if (args.discountValue !== undefined) {
      if (!(args.discountValue > 0)) throw new Error("قيمة الخصم لا تصحّ صفراً");
      if (args.discountType === "PERCENT" && args.discountValue > 100) {
        throw new Error("النسبة لا تتجاوز ١٠٠٪");
      }
      patch.discountValue = args.discountValue;
    }
    if (args.restaurantKey !== undefined) patch.restaurantKey = args.restaurantKey;
    if (args.maxUses !== undefined) {
      /* السقف دون ما استُهلك يجعل الكود ميّتاً بلا سبب ظاهر. */
      if (args.maxUses !== null && args.maxUses < Number(coupon.usedCount || 0)) {
        throw new Error(`الكود استُخدم ${coupon.usedCount} مرة — السقف لا يقلّ عنها`);
      }
      patch.maxUses = args.maxUses ?? undefined;
    }
    if (args.expiresAt !== undefined) patch.expiresAt = args.expiresAt || undefined;
    if (args.minOrderQAR !== undefined) patch.minOrderQAR = args.minOrderQAR ?? undefined;
    if (args.durations !== undefined) {
      patch.durations = args.durations && args.durations.length ? args.durations : undefined;
    }

    await ctx.db.patch(args.id, patch);
    return { success: true };
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
    duration: v.optional(v.string()),
  },
  handler: async (ctx, { code, orderTotal, restaurantKey, duration }) => {
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
      .first();
    const j = judgeCoupon(coupon, orderTotal, restaurantKey || "ADRENALINE", duration);
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
      .withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
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
