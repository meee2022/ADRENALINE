import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  customers: defineTable({
    fullName: v.string(),
    phone: v.string(),
    gender: v.optional(v.union(v.literal("MALE"), v.literal("FEMALE"))),

    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    startDate: v.string(), // yyyy-MM-dd
    endDate: v.string(), // yyyy-MM-dd

    // extra fields
    address: v.optional(v.string()),
    goals: v.optional(v.string()),
    allergies: v.optional(v.string()),
    notes: v.optional(v.string()),

    program: v.optional(v.string()),
    packageLabel: v.optional(v.string()),
    durationWeeks: v.optional(v.number()),
    mealsPerDay: v.optional(v.number()),
    snacksPerDay: v.optional(v.number()),
    totalMealsPerDay: v.optional(v.number()),

    paymentMethod: v.optional(v.string()),
    price: v.optional(v.number()),
    discount: v.optional(v.number()),
    finalPrice: v.optional(v.number()),
    birthdayDate: v.optional(v.string()),
    status: v.optional(v.string()),

    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_phone", ["phone"])
    .index("by_deliveryTime", ["deliveryTime"]),

  mealCategories: defineTable({
    name: v.string(),
    sortOrder: v.number(),
  }).index("by_sort", ["sortOrder"]),

  menuItems: defineTable({
    name: v.string(),
    categoryId: v.id("mealCategories"),
    calories: v.optional(v.number()),
    macros: v.optional(v.string()),
    isActive: v.boolean(),
    tags: v.optional(v.array(v.string())),
  }).index("by_category", ["categoryId"]),

  addons: defineTable({
    name: v.string(),
    price: v.optional(v.number()),
    isActive: v.boolean(),
  }),

  // ✅ NEW: modifiers
  modifiers: defineTable({
    name: v.string(),
    group: v.union(v.literal("AVOID"), v.literal("PREF"), v.literal("PORTION")),
    isActive: v.boolean(),
    sortOrder: v.number(),
  }).index("by_group", ["group"]),

  dailyPlans: defineTable({
    date: v.string(), // yyyy-MM-dd
    customerId: v.id("customers"),
    deliveryTime: v.string(),
    status: v.string(),
    notes: v.optional(v.string()),
    items: v.any(),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_customer", ["customerId"])
    .index("by_date_customer", ["date", "customerId"]),
});
