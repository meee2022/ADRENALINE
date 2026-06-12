/**
 * @file convex/cleanupDuplicateMeals.ts
 * @description Delete meals created by seedMealSchedule that are duplicates of existing meals
 * Run once after seedMealSchedule:seed
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const deleteMeals = mutation({
  args: { ids: v.array(v.id("publicMeals")) },
  handler: async (ctx, { ids }) => {
    let deleted = 0;
    for (const id of ids) {
      const meal = await ctx.db.get(id);
      if (meal && meal.calories === 0 && meal.priceQAR === 0) {
        await ctx.db.delete(id);
        deleted++;
      }
    }
    return { deleted };
  },
});
