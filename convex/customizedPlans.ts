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
    // عدّاد الأيام المكتملة (بنية جديدة {days}) أو الخانات (قالب قديم مصفوفة)
    const filledCount = (tpl: any): number => {
      const slots = tpl?.slots;
      if (slots && slots.days && typeof slots.days === "object") {
        return Object.values(slots.days).filter(
          (arr: any) => Array.isArray(arr) && arr.some((s: any) => s && s.type !== "OFF" && s.baseName),
        ).length;
      }
      if (Array.isArray(slots)) return slots.filter((s: any) => s && s.type !== "OFF").length;
      return 0;
    };
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
        slotCount: filledCount(byCust.get(String(c._id))),
      }))
      .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), "ar"));
  },
});

/**
 * ✅ وجبات العملاء المخصّصين ليوم معيّن (من قوالبهم) — للمطبخ والاستيكر.
 *    يختار خانات يوم الأسبوع من قالب كل عميل، ويرجّع النص المركّب + الكميات.
 */
export const forDate = query({
  args: { date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayKey = DOW[new Date(args.date + "T00:00:00Z").getUTCDay()];

    const templates = await ctx.db.query("customizedTemplates").collect();
    const out: any[] = [];
    for (const tpl of templates) {
      const days = (tpl.slots as any)?.days;
      const slots: any[] = Array.isArray(days?.[dayKey]) ? days[dayKey] : Array.isArray(tpl.slots) ? (tpl.slots as any) : [];
      const items = slots
        .filter((s) => s && s.type !== "OFF" && (s.baseName || s.text))
        .map((s) => ({
          text: s.text || s.baseName || "",
          baseName: s.baseName || "",
          type: s.type,
          proteinName: s.proteinName || "",
          proteinG: s.proteinG || null,
          carbName: s.carbName || "",
          carbG: s.carbG || null,
          notes: s.notes || "",
        }));
      if (!items.length) continue;
      const c: any = await ctx.db.get(tpl.customerId);
      if (!c || !c.isActive) continue;
      out.push({
        customerId: String(tpl.customerId),
        customerName: c.fullName || "",
        phone: c.phone || "",
        deliveryTime: c.deliveryTime || "MORNING",
        allergies: c.allergies || "",
        avoid: c.avoid || "",
        items,
      });
    }
    return out.sort((a, b) => String(a.customerName).localeCompare(String(b.customerName), "ar"));
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
