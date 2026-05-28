/**
 * @file convex/publicPlans.ts
 * @description إدارة الخطط العامة للموقع
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("publicPlans").collect();
  },
});

export const listByDuration = query({
  args: { duration: v.union(v.literal("week"), v.literal("two_weeks"), v.literal("month")) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("publicPlans")
      .filter((q) => q.eq(q.field("duration"), args.duration))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("publicPlans") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
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
  },
  handler: async (ctx, args) => {
    const { badge, ...rest } = args;
    
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
  },
  handler: async (ctx, args) => {
    const { id, badge, ...updates } = args;
    
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
  args: { id: v.id("publicPlans") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const updateDefaultPlanImages = mutation({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("publicPlans").collect();
    for (const plan of plans) {
      if (plan.slug === "tanshif" || plan.slug.includes("tanshif") || plan.nameAr.includes("تنشيف") || plan.nameAr.includes("التنشيف")) {
        await ctx.db.patch(plan._id, { imageUrl: "/plan-tanshif-real.png" });
      } else if (plan.slug === "liyaqa" || plan.slug.includes("liyaqa") || plan.nameAr.includes("لياقة") || plan.nameAr.includes("اللياقة")) {
        await ctx.db.patch(plan._id, { imageUrl: "/plan-liyaqa-real.png" });
      } else if (plan.slug === "tadkhim" || plan.slug.includes("tadkhim") || plan.nameAr.includes("تضخيم") || plan.nameAr.includes("التضخيم")) {
        await ctx.db.patch(plan._id, { imageUrl: "/plan-tadkhim-real.jpg" });
      }
    }
  }
});
