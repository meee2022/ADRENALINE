// convex/modifiers.ts
import { query, mutation } from "./_generated/server";
import { requireAdmin, requireStaff } from "./sessions";
import { v } from "convex/values";

export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
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

    // ✅ الاستبدالات (رز ← بطاطس مهروسة…) — نوع مستقل يظهر مميّزاً للشيف
    const swap = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "SWAP"))
      .collect();

    return [...portion, ...avoid, ...pref, ...swap];
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    group: v.union(v.literal("AVOID"), v.literal("PREF"), v.literal("PORTION"), v.literal("SWAP")),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    // ── استبدال (SWAP): من ← إلى + فرق السعرات المطبَّق تلقائياً ──
    swapFrom: v.optional(v.string()),
    swapTo: v.optional(v.string()),
    caloriesDelta: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const sortOrder =
      typeof args.sortOrder === "number" ? args.sortOrder : Date.now(); // fallback
    // ⚠️ sessionToken لا يُخزَّن داخل الوثيقة
    const { sessionToken: _t, ...fields } = args;
    return await ctx.db.insert("modifiers", { ...fields, sortOrder });
  },
});

export const update = mutation({
  args: {
    id: v.id("modifiers"),
    data: v.object({
      name: v.optional(v.string()),
      group: v.optional(
        v.union(v.literal("AVOID"), v.literal("PREF"), v.literal("PORTION"), v.literal("SWAP")),
      ),
      isActive: v.optional(v.boolean()),
      sortOrder: v.optional(v.number()),
      swapFrom: v.optional(v.string()),
      swapTo: v.optional(v.string()),
      caloriesDelta: v.optional(v.number()),
    }),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, data, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    await ctx.db.patch(id, data);
    return true;
  },
});

export const remove = mutation({
  args: { id: v.id("modifiers"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
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

/**
 * ⇄ قائمة استبدالات جاهزة (idempotent — يضيف الناقص فقط ولا يكرّر).
 * فرق السعرات تقديري لحصة ~150جم ويُعدَّل يدوياً من شاشة المنيو وقت ما تحب.
 */
export const seedSwaps = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "SWAP"))
      .collect();
    const seen = new Set(existing.map((m: any) => String(m.name || "").toUpperCase()));

    const rows: Array<[string, string, number]> = [
      ["RICE", "MASHED POTATO", -65],
      ["RICE", "SWEET POTATO", -60],
      ["RICE", "BAKED POTATO", -55],
      ["RICE", "PASTA", 0],
      ["RICE", "QUINOA", -15],
      ["RICE", "BULGUR", -70],
      ["RICE", "SALAD", -165],
      ["RICE", "GRILLED VEGETABLES", -140],
      ["WHITE RICE", "BROWN RICE", -5],
      ["PASTA", "MASHED POTATO", -65],
      ["POTATO", "RICE", 65],
      ["BREAD", "SWEET POTATO", -30],
    ];

    let inserted = 0;
    for (let i = 0; i < rows.length; i++) {
      const [from, to, delta] = rows[i];
      const name = `${from} → ${to}`;
      if (seen.has(name.toUpperCase())) continue;
      await ctx.db.insert("modifiers", {
        name,
        group: "SWAP" as const,
        isActive: true,
        sortOrder: 100 + i,
        swapFrom: from,
        swapTo: to,
        caloriesDelta: delta,
      });
      inserted++;
    }
    return { ok: true, inserted, alreadyThere: existing.length };
  },
});
