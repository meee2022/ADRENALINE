/**
 * @file convex/mealIngredients.ts
 * @description ربط الوجبة بمكوّنات المخزون - لخصم تلقائي عند التحضير
 */
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";
import { v } from "convex/values";

export const listByMeal = query({
  args: { menuItemId: v.id("menuItems"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { menuItemId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
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
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.db.query("mealIngredients").collect();
  },
});

export const create = mutation({
  args: {
    menuItemId: v.id("menuItems"),
    inventoryItemId: v.id("inventoryItems"),
    quantityPerServing: v.number(),
    unit: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
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
    sessionToken: v.optional(v.string()),
  },
  // sessionToken قبل الـrest حتى لا يُخزَّن داخل الوثيقة
  handler: async (ctx, { id, sessionToken, ...rest }) => {
    await requireStaff(ctx, sessionToken);
    await ctx.db.patch(id, rest);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("mealIngredients"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    await ctx.db.delete(id);
    return { success: true };
  },
});
