/**
 * @file convex/publicMeals.ts
 * @description إدارة الوجبات العامة للموقع
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    const meals = await ctx.db.query("publicMeals").collect();
    
    // Add imageUrl from storageId
    return Promise.all(
      meals.map(async (meal) => {
        if (meal.storageId) {
          const imageUrl = await ctx.storage.getUrl(meal.storageId);
          return { ...meal, imageUrl };
        }
        return meal;
      })
    );
  },
});

export const listMeals = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let meals = ctx.db.query("publicMeals");

    // Filter by category if provided
    if (args.category && args.category !== "الكل") {
      meals = meals.filter((q) => q.eq(q.field("category"), args.category));
    }

    let results = await meals.collect();

    // Filter by search term if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      results = results.filter(
        (meal) =>
          meal.nameAr?.toLowerCase().includes(searchLower) ||
          meal.nameEn?.toLowerCase().includes(searchLower)
      );
    }

    // Add imageUrl from storageId
    return Promise.all(
      results.map(async (meal) => {
        if (meal.storageId) {
          const imageUrl = await ctx.storage.getUrl(meal.storageId);
          return { ...meal, imageUrl };
        }
        return meal;
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("publicMeals") },
  handler: async (ctx, args) => {
    const meal = await ctx.db.get(args.id);
    if (!meal) return null;
    
    // Add imageUrl from storageId
    if (meal.storageId) {
      const imageUrl = await ctx.storage.getUrl(meal.storageId);
      return { ...meal, imageUrl };
    }
    return meal;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const meal = await ctx.db
      .query("publicMeals")
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .first();
    
    if (!meal) return null;
    
    // Add imageUrl from storageId
    if (meal.storageId) {
      const imageUrl = await ctx.storage.getUrl(meal.storageId);
      return { ...meal, imageUrl };
    }
    return meal;
  },
});

export const create = mutation({
  args: {
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    slug: v.string(),
    descriptionAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    aboutAr: v.optional(v.string()),
    aboutEn: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")), // NEW
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fats: v.number(),
    tags: v.array(v.string()),
    ingredients: v.optional(v.array(v.string())),
    category: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("salad"),
      v.literal("snack")
    ),
    priceQAR: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    // NEW: Scheduling
    weeks: v.optional(v.array(v.number())),
    days: v.optional(v.array(v.string())),
    cutoffTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mealId = await ctx.db.insert("publicMeals", {
      nameAr: args.nameAr,
      nameEn: args.nameEn,
      slug: args.slug,
      descriptionAr: args.descriptionAr,
      descriptionEn: args.descriptionEn,
      aboutAr: args.aboutAr,
      aboutEn: args.aboutEn,
      imageUrl: args.imageUrl,
      storageId: args.storageId, // NEW
      calories: args.calories,
      protein: args.protein,
      carbs: args.carbs,
      fats: args.fats,
      tags: args.tags,
      ingredients: args.ingredients || [],
      category: args.category,
      priceQAR: args.priceQAR || 0,
      sortOrder: args.sortOrder || 999,
      isActive: args.isActive ?? true,
      weeks: args.weeks,
      days: args.days,
      cutoffTime: args.cutoffTime,
      createdAt: Date.now(),
    });
    return mealId;
  },
});

export const update = mutation({
  args: {
    id: v.id("publicMeals"),
    nameAr: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    slug: v.optional(v.string()),
    descriptionAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    aboutAr: v.optional(v.string()),
    aboutEn: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fats: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    ingredients: v.optional(v.array(v.string())),
    category: v.optional(v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("salad"),
      v.literal("snack")
    )),
    priceQAR: v.optional(v.number()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    // NEW: Scheduling
    weeks: v.optional(v.array(v.number())),
    days: v.optional(v.array(v.string())),
    cutoffTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("publicMeals") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const deleteAll = mutation({
  handler: async (ctx) => {
    const meals = await ctx.db.query("publicMeals").collect();
    for (const meal of meals) {
      await ctx.db.delete(meal._id);
    }
    return { deleted: meals.length };
  },
});
