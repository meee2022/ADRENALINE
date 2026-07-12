/**
 * @file convex/customizedPlans.ts
 * @description قوالب الوجبات المخصّصة — لكل عميل مخصّص قالب وجبات ثابت
 *   (رئيسية بجرامات + سناك/سلطة). تُبنى بالضغط بدل الكتابة الحرة، وتغذّي
 *   المطبخ والاستيكر لاحقاً.
 * @frontend client/src/pages/Customized.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";

/** عملاء البرنامج المخصّص + هل لهم قالب محفوظ. للموظفين. */
export const listCustomized = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const customers = await ctx.db.query("customers").collect();
    const custom = customers.filter(
      (c: any) =>
        c.isActive &&
        String(c.program || c.goalType || c.goals || "").toUpperCase().includes("CUSTOM"),
    );
    const templates = await ctx.db.query("customizedTemplates").collect();
    const byCust = new Map(templates.map((t) => [String(t.customerId), t]));
    return custom
      .map((c: any) => ({
        _id: c._id,
        fullName: c.fullName,
        phone: c.phone,
        deliveryTime: c.deliveryTime,
        allergies: c.allergies || "",
        avoid: c.avoid || "",
        mealsPerDay: c.mealsPerDay,
        snacksPerDay: c.snacksPerDay,
        hasTemplate: byCust.has(String(c._id)),
        slotCount: (byCust.get(String(c._id))?.slots as any[] | undefined)?.filter((s) => s && s.type !== "OFF")?.length || 0,
      }))
      .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), "ar"));
  },
});

/** قالب عميل واحد. للموظفين. */
export const getTemplate = query({
  args: { customerId: v.id("customers"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const t = await ctx.db
      .query("customizedTemplates")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .first();
    return t || null;
  },
});

/** حفظ/تحديث قالب عميل. للموظفين. */
export const saveTemplate = mutation({
  args: {
    customerId: v.id("customers"),
    slots: v.any(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await requireStaff(ctx, args.sessionToken);
    const who = (id as any)?.user?.name || (id as any)?.user?.username || undefined;
    const existing = await ctx.db
      .query("customizedTemplates")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { slots: args.slots, updatedAt: Date.now(), updatedBy: who });
      return { id: existing._id, updated: true };
    }
    const newId = await ctx.db.insert("customizedTemplates", {
      customerId: args.customerId,
      slots: args.slots,
      updatedAt: Date.now(),
      updatedBy: who,
    });
    return { id: newId, updated: false };
  },
});
