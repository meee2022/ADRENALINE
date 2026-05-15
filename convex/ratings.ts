/**
 * @file convex/ratings.ts
 * @description تقييمات العملاء للوجبات
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    customerId: v.optional(v.id("customers")),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    menuItemId: v.optional(v.id("menuItems")),
    publicMealId: v.optional(v.id("publicMeals")),
    mealName: v.string(),
    stars: v.number(),
    comment: v.optional(v.string()),
    planDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.stars < 1 || args.stars > 5) throw new Error("Stars must be 1-5");
    return await ctx.db.insert("ratings", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 100 }) => {
    return await ctx.db.query("ratings").order("desc").take(limit);
  },
});

export const byMeal = query({
  args: { menuItemId: v.id("menuItems") },
  handler: async (ctx, { menuItemId }) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_menuItem", (q) => q.eq("menuItemId", menuItemId))
      .collect();
    const avg = ratings.length
      ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length
      : 0;
    return {
      ratings,
      count: ratings.length,
      avg: Math.round(avg * 10) / 10,
    };
  },
});

export const byCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    return await ctx.db
      .query("ratings")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();
  },
});

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("ratings").collect();
    const count = all.length;
    const avg = count ? all.reduce((s, r) => s + r.stars, 0) / count : 0;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of all) {
      distribution[r.stars] = (distribution[r.stars] || 0) + 1;
    }
    return {
      count,
      avg: Math.round(avg * 10) / 10,
      distribution,
    };
  },
});
