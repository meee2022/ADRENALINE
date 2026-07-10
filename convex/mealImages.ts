/**
 * @file convex/mealImages.ts
 * @description ربط صورة مرفوعة (storageId) بوجبة عامة.
 */
import { mutation } from "./_generated/server";
import { requireAdmin } from "./sessions";
import { v } from "convex/values";

export const setImage = mutation({
  args: { id: v.id("publicMeals"), storageId: v.id("_storage") , sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, storageId, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(id, { storageId });
    return id;
  },
});
