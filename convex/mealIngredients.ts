/**
 * @file convex/mealIngredients.ts
 * @description ربط الوجبة بمكوّنات المخزون - لخصم تلقائي عند التحضير
 */
import { internalMutation, mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";
import { v } from "convex/values";

export const listByMeal = query({
  args: {
    publicMealId: v.optional(v.id("publicMeals")),
    menuItemId: v.optional(v.id("menuItems")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { publicMealId, menuItemId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    if (!publicMealId && !menuItemId) return [];
    const ingredients = publicMealId
      ? await ctx.db.query("mealIngredients").withIndex("by_publicMeal", (q) => q.eq("publicMealId", publicMealId)).collect()
      : await ctx.db.query("mealIngredients").withIndex("by_menuItem", (q) => q.eq("menuItemId", menuItemId)).collect();

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
    publicMealId: v.optional(v.id("publicMeals")),
    menuItemId: v.optional(v.id("menuItems")),
    inventoryItemId: v.id("inventoryItems"),
    quantityPerServing: v.number(),
    unit: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    if (!args.publicMealId && !args.menuItemId) throw new Error("Meal is required");
    if (args.quantityPerServing <= 0) throw new Error("Quantity must be greater than zero");
    const existing = args.publicMealId
      ? await ctx.db.query("mealIngredients").withIndex("by_publicMeal", (q) => q.eq("publicMealId", args.publicMealId)).collect()
      : await ctx.db.query("mealIngredients").withIndex("by_menuItem", (q) => q.eq("menuItemId", args.menuItemId)).collect();
    if (existing.some((row) => String(row.inventoryItemId) === String(args.inventoryItemId))) {
      throw new Error("This ingredient is already linked to the meal");
    }
    const { sessionToken: _token, ...fields } = args;
    return await ctx.db.insert("mealIngredients", {
      ...fields,
      createdAt: Date.now(),
    });
  },
});

/**
 * One-way compatibility migration: attach every legacy recipe to its linked
 * public meal. The legacy key is retained so historical screens keep working.
 */
export const migrateToPublicMeals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const recipes = await ctx.db.query("mealIngredients").collect();
    let migrated = 0;
    let alreadyCanonical = 0;
    let unlinked = 0;
    let conflicts = 0;
    for (const recipe of recipes) {
      if (recipe.publicMealId) {
        alreadyCanonical++;
        continue;
      }
      if (!recipe.menuItemId) {
        unlinked++;
        continue;
      }
      const legacy = await ctx.db.get(recipe.menuItemId);
      if (!legacy?.publicMealId) {
        unlinked++;
        continue;
      }
      const canonicalRows = await ctx.db
        .query("mealIngredients")
        .withIndex("by_publicMeal", (q) => q.eq("publicMealId", legacy.publicMealId))
        .collect();
      if (canonicalRows.some((row) => String(row.inventoryItemId) === String(recipe.inventoryItemId))) {
        conflicts++;
        continue;
      }
      await ctx.db.patch(recipe._id, { publicMealId: legacy.publicMealId });
      migrated++;
    }
    return { total: recipes.length, migrated, alreadyCanonical, unlinked, conflicts };
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
