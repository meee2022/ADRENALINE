/**
 * @file convex/leaves.ts
 * @description إجازات الموظفين — قراءة للموظفين، تعديل للمدير. رصيد الإجازة السنوية 30 يوم/سنة.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { validateSession, requireAdmin } from "./sessions";

const ANNUAL_ENTITLEMENT = 30; // رصيد الإجازة السنوية الافتراضي (يوم/سنة)

/** كل الإجازات (اختياري بالاسم أو النوع). للموظفين فقط. */
export const list = query({
  args: { name: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    let rows = await ctx.db.query("leaves").collect();
    if (args.name) rows = rows.filter((x) => x.name === args.name);
    rows.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    return rows;
  },
});

/** أسماء الموظفين المتاحين (من كشف الرواتب) لاختيارهم عند إضافة إجازة. */
export const employeeNames = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    const pay = await ctx.db.query("payroll").collect();
    return Array.from(new Set(pay.map((p) => p.name))).sort();
  },
});

/** ملخص إجازات كل موظف + الرصيد السنوي المتبقّي. */
export const summary = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return null;
    const rows = await ctx.db.query("leaves").collect();
    const byName: Record<string, any> = {};
    for (const r of rows) {
      const b = (byName[r.name] ??= { name: r.name, annual: 0, sick: 0, unpaid: 0, emergency: 0, other: 0, total: 0 });
      b[r.type] = (b[r.type] || 0) + r.days;
      b.total += r.days;
    }
    const today = new Date().toISOString().slice(0, 10);
    const onLeaveNow = rows.filter((r) => r.startDate <= today && r.endDate >= today).length;
    const employees = Object.values(byName).map((b: any) => ({
      ...b,
      annualEntitlement: ANNUAL_ENTITLEMENT,
      annualRemaining: Math.max(0, ANNUAL_ENTITLEMENT - b.annual),
    }));
    return {
      totalRecords: rows.length,
      onLeaveNow,
      annualUsed: rows.filter((r) => r.type === "annual").reduce((s, r) => s + r.days, 0),
      sickDays: rows.filter((r) => r.type === "sick").reduce((s, r) => s + r.days, 0),
      unpaidDays: rows.filter((r) => r.type === "unpaid").reduce((s, r) => s + r.days, 0),
      employees,
    };
  },
});

const leaveArgs = {
  name: v.string(),
  type: v.union(v.literal("annual"), v.literal("sick"), v.literal("unpaid"), v.literal("emergency"), v.literal("other")),
  startDate: v.string(),
  endDate: v.string(),
  days: v.number(),
  paid: v.boolean(),
  reason: v.optional(v.string()),
  status: v.optional(v.string()),
};

export const create = mutation({
  args: { ...leaveArgs, sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const { sessionToken, ...data } = args;
    return await ctx.db.insert("leaves", { ...data, createdAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("leaves"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("annual"), v.literal("sick"), v.literal("unpaid"), v.literal("emergency"), v.literal("other"))),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    days: v.optional(v.number()),
    paid: v.optional(v.boolean()),
    reason: v.optional(v.string()),
    status: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const { id, sessionToken, ...rest } = args as any;
    const updates: any = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) if (val !== undefined) updates[k] = val;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("leaves"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
