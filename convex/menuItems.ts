/**
 * @file convex/menuItems.ts
 * @description Convex functions لعناصر القائمة (Menu Items)
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("menuItems").collect();
  },
});

export const getById = query({
  args: { id: v.id("menuItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    categoryId: v.id("mealCategories"),
    calories: v.optional(v.number()),
    macros: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const menuItemId = await ctx.db.insert("menuItems", {
      name: args.name,
      categoryId: args.categoryId,
      calories: args.calories,
      macros: args.macros,
      tags: args.tags,
      isActive: args.isActive ?? true,
    });
    return menuItemId;
  },
});

export const update = mutation({
  args: {
    id: v.id("menuItems"),
    name: v.optional(v.string()),
    categoryId: v.optional(v.id("mealCategories")),
    calories: v.optional(v.number()),
    macros: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("menuItems") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
