/**
 * @file convex/mealCategories.ts
 * @description Convex functions لأصناف الوجبات
 */
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./sessions";
import { v } from "convex/values";

function normalizeName(s: string) {
  return (s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

const DEFAULT_CATEGORIES = [
  { name: "Breakfast", sortOrder: 1 },
  { name: "Lunch", sortOrder: 2 },
  { name: "Dinner", sortOrder: 3 },
  { name: "Snacks", sortOrder: 4 },
] as const;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const cats = await ctx.db
      .query("mealCategories")
      .withIndex("by_sortOrder")
      .collect();
    return cats.sort(
      (a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  },
});

export const get = query({
  args: { id: v.id("mealCategories") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: { name: v.string(), sortOrder: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("mealCategories").collect();
    const exists = existing.some(
      (c: any) => normalizeName(c.name) === normalizeName(args.name),
    );
    if (exists) throw new Error("Category name already exists");
    return await ctx.db.insert("mealCategories", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("mealCategories"),
    data: v.object({
      name: v.optional(v.string()),
      sortOrder: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { id, data }) => {
    if (data.name) {
      const all = await ctx.db.query("mealCategories").collect();
      const exists = all.some(
        (c: any) =>
          c._id !== id &&
          normalizeName(c.name) === normalizeName(data.name as string),
      );
      if (exists) throw new Error("Category name already exists");
    }

    await ctx.db.patch(id, data);
    return true;
  },
});

export const reorder = mutation({
  args: {
    categories: v.array(
      v.object({
        id: v.id("mealCategories"),
        sortOrder: v.number(),
      }),
    ),
  },
  handler: async (ctx, { categories }) => {
    for (const cat of categories) {
      await ctx.db.patch(cat.id, { sortOrder: cat.sortOrder });
    }
    return true;
  },
});

export const remove = mutation({
  args: { id: v.id("mealCategories") },
  handler: async (ctx, { id }) => {
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", id))
      .take(1);

    if (items.length > 0) {
      throw new Error("Cannot delete a category that has menu items");
    }

    await ctx.db.delete(id);
    return true;
  },
});

export const seedDefaults = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const existing = await ctx.db.query("mealCategories").collect();
    if (existing.length > 0) return { seeded: false, created: 0 };

    for (const c of DEFAULT_CATEGORIES) {
      await ctx.db.insert("mealCategories", c);
    }
    return { seeded: true, created: DEFAULT_CATEGORIES.length };
  },
});
