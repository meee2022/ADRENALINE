/**
 * @file convex/publicPlans.ts
 * @description إدارة الخطط العامة للموقع
 */
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireStaff } from "./sessions";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    const plans = await ctx.db.query("publicPlans").collect();
    return Promise.all(plans.map(async (plan) => {
      const imageUrl = plan.imageStorageId ? await ctx.storage.getUrl(plan.imageStorageId) : null;
      return imageUrl ? { ...plan, imageUrl } : plan;
    }));
  },
});

export const listByDuration = query({
  args: { duration: v.union(v.literal("week"), v.literal("two_weeks"), v.literal("month")) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("publicPlans").collect();
    // النشطة المطابقة للمدة + الباقات المخصّصة (بلا أسعار جاهزة) تظهر في كل التبويبات
    const filtered = all.filter((p) =>
      p.isActive !== false &&
      (p.duration === args.duration || !p.options || p.options.length === 0)
    );
    return Promise.all(filtered.map(async (plan) => {
      const imageUrl = plan.imageStorageId ? await ctx.storage.getUrl(plan.imageStorageId) : null;
      return imageUrl ? { ...plan, imageUrl } : plan;
    }));
  },
});

export const getById = query({
  args: { id: v.id("publicPlans") },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.id);
    if (!plan) return null;
    const imageUrl = plan.imageStorageId ? await ctx.storage.getUrl(plan.imageStorageId) : null;
    return imageUrl ? { ...plan, imageUrl } : plan;
  },
});

export const create = mutation({
  args: {
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    slug: v.string(),
    descriptionAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    imageUrl: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    duration: v.union(v.literal("week"), v.literal("two_weeks"), v.literal("month")),
    options: v.array(
      v.object({
        mealsCount: v.number(),
        snacksCount: v.number(),
        priceQAR: v.number(),
      })
    ),
    features: v.optional(v.array(v.string())),
    badge: v.optional(v.union(
      v.literal("most_requested"),
      v.literal("best_value"),
      v.literal("most_chosen_business"),
      v.literal("special_offer"),
      v.literal("none")
    )),
    isFeatured: v.optional(v.boolean()),
    showInComparison: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const { badge, sessionToken: _t, ...rest } = args;
    
    const planId = await ctx.db.insert("publicPlans", {
      ...rest,
      badge: badge === "none" ? undefined : badge,
      sortOrder: args.sortOrder ?? 999,
      isActive: args.isActive ?? true,
      createdAt: Date.now(),
    });
    return planId;
  },
});

export const update = mutation({
  args: {
    id: v.id("publicPlans"),
    nameAr: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    slug: v.optional(v.string()),
    descriptionAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    duration: v.optional(v.union(v.literal("week"), v.literal("two_weeks"), v.literal("month"))),
    options: v.optional(
      v.array(
        v.object({
          mealsCount: v.number(),
          snacksCount: v.number(),
          priceQAR: v.number(),
        })
      )
    ),
    features: v.optional(v.array(v.string())),
    badge: v.optional(v.union(
      v.literal("most_requested"),
      v.literal("best_value"),
      v.literal("most_chosen_business"),
      v.literal("special_offer"),
      v.literal("none")
    )),
    isFeatured: v.optional(v.boolean()),
    showInComparison: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const { id, badge, sessionToken: _t, ...updates } = args;
    
    // If badge is "none", set it to undefined
    const finalUpdates = {
      ...updates,
      badge: badge === "none" ? undefined : badge,
    };
    
    await ctx.db.patch(id, finalUpdates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("publicPlans"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * يُعيد صور الباقات إلى أصول الموقع المرفقة.
 *
 * كان يكتب مسارات ‎.png‎ لم تعد موجودة (ضُغطت الصور وصارت ‎.jpg‎)، فتشغيله
 * كان يُفرغ بطاقات الباقات من صورها. وكان يطابق بـ«tanshif/liyaqa» ولا
 * slug في القاعدة يحملها — الأسماء الفعلية diet/fitness/bulking-pack.
 */
export const updateDefaultPlanImages = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    let updated = 0;
    for (const plan of await ctx.db.query("publicPlans").collect()) {
      const key = `${plan.slug || ""} ${plan.nameEn || ""} ${plan.nameAr || ""}`.toLowerCase();
      const asset =
        !plan.options || plan.options.length === 0 ? "/custom-plan-meals.jpg"
        : key.includes("diet") || key.includes("tanshif") || key.includes("تنشيف") ? "/plan-tanshif-real.jpg"
        : key.includes("fitness") || key.includes("liyaqa") || key.includes("لياقة") ? "/plan-liyaqa-real.jpg"
        : key.includes("bulk") || key.includes("tadkhim") || key.includes("تضخيم") ? "/plan-tadkhim-real.jpg"
        : null;
      if (asset && plan.imageUrl !== asset) {
        await ctx.db.patch(plan._id, { imageUrl: asset });
        updated++;
      }
    }
    return { updated };
  },
});
