// convex/modifiers.ts
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./sessions";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    // نجيب كل الجروبات مرتبة
    const portion = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "PORTION"))
      .collect();

    const avoid = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "AVOID"))
      .collect();

    const pref = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "PREF"))
      .collect();

    return [...portion, ...avoid, ...pref];
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    group: v.union(v.literal("AVOID"), v.literal("PREF"), v.literal("PORTION")),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sortOrder =
      typeof args.sortOrder === "number" ? args.sortOrder : Date.now(); // fallback
    return await ctx.db.insert("modifiers", { ...args, sortOrder });
  },
});

export const update = mutation({
  args: {
    id: v.id("modifiers"),
    data: v.object({
      name: v.optional(v.string()),
      group: v.optional(
        v.union(v.literal("AVOID"), v.literal("PREF"), v.literal("PORTION")),
      ),
      isActive: v.optional(v.boolean()),
      sortOrder: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { id, data }) => {
    await ctx.db.patch(id, data);
    return true;
  },
});

export const remove = mutation({
  args: { id: v.id("modifiers") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return true;
  },
});

export const seedDefaults = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const anyRow = await ctx.db.query("modifiers").first();
    if (anyRow) return { ok: true, message: "Already seeded" };

    const rows = [
      // PORTION
      {
        name: "LIGHT",
        group: "PORTION" as const,
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "STANDARD",
        group: "PORTION" as const,
        isActive: true,
        sortOrder: 2,
      },
      {
        name: "HEAVY",
        group: "PORTION" as const,
        isActive: true,
        sortOrder: 3,
      },

      // AVOID
      {
        name: "No tomato",
        group: "AVOID" as const,
        isActive: true,
        sortOrder: 10,
      },
      {
        name: "No onion",
        group: "AVOID" as const,
        isActive: true,
        sortOrder: 11,
      },
      {
        name: "No garlic",
        group: "AVOID" as const,
        isActive: true,
        sortOrder: 12,
      },
      {
        name: "No dairy",
        group: "AVOID" as const,
        isActive: true,
        sortOrder: 13,
      },
      {
        name: "No gluten",
        group: "AVOID" as const,
        isActive: true,
        sortOrder: 14,
      },
      {
        name: "No nuts",
        group: "AVOID" as const,
        isActive: true,
        sortOrder: 15,
      },
      {
        name: "No salad",
        group: "AVOID" as const,
        isActive: true,
        sortOrder: 16,
      },

      // PREF
      {
        name: "Less salt",
        group: "PREF" as const,
        isActive: true,
        sortOrder: 30,
      },
      {
        name: "No spicy",
        group: "PREF" as const,
        isActive: true,
        sortOrder: 31,
      },
      {
        name: "Sauce on side",
        group: "PREF" as const,
        isActive: true,
        sortOrder: 32,
      },
      {
        name: "Extra protein",
        group: "PREF" as const,
        isActive: true,
        sortOrder: 33,
      },
    ];

    for (const r of rows) {
      await ctx.db.insert("modifiers", r);
    }

    return { ok: true, inserted: rows.length };
  },
});
