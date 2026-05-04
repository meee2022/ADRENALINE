/**
 * @file convex/seed.ts
 * @description Seed data for initial setup
 */
import { mutation } from "./_generated/server";

export const seedAll = mutation({
  handler: async (ctx) => {
    // Check if already seeded
    const existingCategories = await ctx.db.query("mealCategories").first();
    if (existingCategories) {
      return { message: "Data already seeded" };
    }

    // Seed meal categories
    const breakfast = await ctx.db.insert("mealCategories", {
      name: "Breakfast / فطور",
      sortOrder: 1,
    });

    const lunch = await ctx.db.insert("mealCategories", {
      name: "Lunch / غداء",
      sortOrder: 2,
    });

    const dinner = await ctx.db.insert("mealCategories", {
      name: "Dinner / عشاء",
      sortOrder: 3,
    });

    const snacks = await ctx.db.insert("mealCategories", {
      name: "Snacks / سناك",
      sortOrder: 4,
    });

    // Seed menu items
    await ctx.db.insert("menuItems", {
      name: "Grilled Chicken / دجاج مشوي",
      categoryId: lunch,
      isActive: true,
    });

    await ctx.db.insert("menuItems", {
      name: "Scrambled Eggs / بيض مخفوق",
      categoryId: breakfast,
      isActive: true,
    });

    await ctx.db.insert("menuItems", {
      name: "Salmon Fillet / شرائح سلمون",
      categoryId: dinner,
      isActive: true,
    });

    await ctx.db.insert("menuItems", {
      name: "Protein Bar / بروتين بار",
      categoryId: snacks,
      isActive: true,
    });

    // Seed modifiers
    await ctx.db.insert("modifiers", {
      name: "No Nuts / بدون مكسرات",
      group: "AVOID",
      sortOrder: 1,
      isActive: true,
    });

    await ctx.db.insert("modifiers", {
      name: "Extra Protein / بروتين إضافي",
      group: "PREF",
      sortOrder: 1,
      isActive: true,
    });

    await ctx.db.insert("modifiers", {
      name: "Half Portion / نصف حصة",
      group: "PORTION",
      sortOrder: 1,
      isActive: true,
    });

    // Seed customers
    await ctx.db.insert("customers", {
      fullName: "Ahmed Ali",
      phone: "97450123456",
      deliveryTime: "MORNING",
      program: "5 Days Plan",
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      isActive: true,
      preferences: "Extra vegetables",
      avoid: "Nuts",
      allergies: "",
      address: "Doha, Qatar",
      createdAt: Date.now(),
    });

    await ctx.db.insert("customers", {
      fullName: "Fatima Hassan",
      phone: "97450234567",
      deliveryTime: "MORNING",
      program: "7 Days Plan",
      startDate: "2026-02-01",
      endDate: "2026-02-15",
      isActive: true,
      preferences: "Low carb",
      avoid: "Dairy",
      allergies: "Lactose intolerant",
      address: "Doha, Qatar",
      createdAt: Date.now(),
    });

    await ctx.db.insert("customers", {
      fullName: "Mohammed Khalil",
      phone: "97450345678",
      deliveryTime: "MORNING",
      program: "3 Days Plan",
      startDate: "2026-02-01",
      endDate: "2026-02-10",
      isActive: false,
      preferences: "Spicy food",
      avoid: "",
      allergies: "",
      address: "Doha, Qatar",
      createdAt: Date.now(),
    });

    return {
      message: "Seed data created successfully",
      categories: 4,
      menuItems: 4,
      modifiers: 3,
      customers: 3,
    };
  },
});
