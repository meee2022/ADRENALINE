/**
 * @file convex/mealImages.ts
 * @description ربط صورة مرفوعة (storageId) بوجبة عامة.
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const setImage = mutation({
  args: { id: v.id("publicMeals"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    await ctx.db.patch(id, { storageId });
    return id;
  },
});
