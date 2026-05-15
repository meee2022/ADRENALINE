/**
 * @file convex/mealIngredients.ts
 * @description ربط الوجبة بمكوّنات المخزون - لخصم تلقائي عند التحضير
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByMeal = query({
  args: { menuItemId: v.id("menuItems") },
  handler: async (ctx, { menuItemId }) => {
    const ingredients = await ctx.db
      .query("mealIngredients")
      .withIndex("by_menuItem", (q) => q.eq("menuItemId", menuItemId))
      .collect();

    // جلب بيانات المخزون لكل عنصر
    const withDetails = await Promise.all(
      ingredients.map(async (ing) => {
        const item = await ctx.db.get(ing.inventoryItemId);
        return {
          ...ing,
          inventoryItem: item,
        };
      }),
    );
    return withDetails;
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("mealIngredients").collect();
  },
});

export const create = mutation({
  args: {
    menuItemId: v.id("menuItems"),
    inventoryItemId: v.id("inventoryItems"),
    quantityPerServing: v.number(),
    unit: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mealIngredients", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("mealIngredients"),
    quantityPerServing: v.optional(v.number()),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, rest);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("mealIngredients") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return { success: true };
  },
});
