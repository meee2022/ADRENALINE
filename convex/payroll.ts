/**
 * @file convex/payroll.ts
 * @description كشف رواتب الموظفين — قراءة للموظفين المصرّح لهم، تعديل للمدير فقط.
 *   الحقول المشتقة تُحسب: package = basic+allowance · salary = package×days/31 ·
 *   total = salary+overtime · balance = total − advance − paid.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { validateSession, requireAdmin, assertRole } from "./sessions";

// ✅ الرواتب: قصر القراءة على أدوار مالية/إدارية فقط. ADMIN مسموح تلقائياً (super-user).
const PAYROLL_ROLES = ["ACCOUNTANT", "FINANCE_MANAGER"];

const r = (n: number) => Math.round(n);
function derive(e: any) {
  const basic = e.basic || 0, allowance = e.allowance || 0;
  const days = e.days || 0, overtime = e.overtime || 0;
  const advance = e.advance || 0, paid = e.paid || 0;
  const pkg = basic + allowance;
  const salary = r((pkg * Math.min(days, 31)) / 31);
  const total = salary + overtime;
  const balance = total - advance - paid;
  return { ...e, package: pkg, salary, total, balance };
}

/** قائمة رواتب شهر (افتراضي أحدث شهر). للموظفين فقط — غير المصرّح يحصل على قائمة فارغة. */
export const list = query({
  args: { month: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    try { assertRole(id, PAYROLL_ROLES); } catch { return []; }
    let rows = await ctx.db.query("payroll").collect();
    if (args.month) rows = rows.filter((x) => x.month === args.month);
    rows.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return rows.map(derive);
  },
});

/** الأشهر المتاحة. */
export const months = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    try { assertRole(id, PAYROLL_ROLES); } catch { return []; }
    const rows = await ctx.db.query("payroll").collect();
    return Array.from(new Set(rows.map((x) => x.month))).sort().reverse();
  },
});

/** إجماليات شهر. */
export const summary = query({
  args: { month: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    try { assertRole(id, PAYROLL_ROLES); } catch { return null; }
    let rows = await ctx.db.query("payroll").collect();
    if (args.month) rows = rows.filter((x) => x.month === args.month);
    const d = rows.map(derive);
    const sum = (f: (x: any) => number) => d.reduce((s, x) => s + f(x), 0);
    return {
      headcount: d.length,
      package: sum((x) => x.package),
      salary: sum((x) => x.salary),
      overtime: sum((x) => x.overtime),
      total: sum((x) => x.total),
      advance: sum((x) => x.advance),
      paid: sum((x) => x.paid),
      balance: sum((x) => x.balance),
    };
  },
});

const employeeArgs = {
  name: v.string(),
  designation: v.string(),
  basic: v.number(),
  allowance: v.number(),
  days: v.number(),
  overtime: v.number(),
  advance: v.number(),
  paid: v.number(),
  otHours: v.optional(v.number()),
  fridays: v.optional(v.number()),
  month: v.string(),
};

export const create = mutation({
  args: { ...employeeArgs, sortOrder: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const { sessionToken, sortOrder, ...data } = args;
    const existing = await ctx.db.query("payroll").withIndex("by_month", (q) => q.eq("month", data.month)).collect();
    const nextOrder = sortOrder ?? (existing.reduce((m, x) => Math.max(m, x.sortOrder ?? 0), 0) + 1);
    return await ctx.db.insert("payroll", { ...data, sortOrder: nextOrder, createdAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("payroll"),
    name: v.optional(v.string()),
    designation: v.optional(v.string()),
    basic: v.optional(v.number()),
    allowance: v.optional(v.number()),
    days: v.optional(v.number()),
    overtime: v.optional(v.number()),
    advance: v.optional(v.number()),
    paid: v.optional(v.number()),
    otHours: v.optional(v.number()),
    fridays: v.optional(v.number()),
    month: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
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
  args: { id: v.id("payroll"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/** زرع كشف مايو 2026 (مرة واحدة) — لا يكرّر لو موجود. */
export const seedMay2026 = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const month = "2026-05";
    const existing = await ctx.db.query("payroll").withIndex("by_month", (q) => q.eq("month", month)).first();
    if (existing) return { ok: false, reason: "already seeded" };
    // [name, designation, basic, allowance, days, overtime, advance, paid, otHours, fridays]
    const rows: [string, string, number, number, number, number, number, number, number, number][] = [
      ["Abdulrahman", "MD", 10000, 0, 31, 0, 10000, 0, 0, 0],
      ["Abdulla", "Marketing Dept", 2000, 0, 31, 0, 0, 2000, 0, 0],
      ["Abeer", "Dietitian", 5000, 1000, 31, 0, 6000, 0, 0, 0],
      ["Jimmy", "Accountant", 3000, 1000, 31, 500, 0, 0, 8, 2],
      ["Zuhair", "Finance", 2500, 0, 31, 0, 0, 2500, 0, 0],
      ["Nadir", "Kitchen Supervisor", 2000, 1000, 31, 0, 4030, 0, 0, 0],
      ["Abbas", "PRO", 3000, 500, 31, 0, 0, 3500, 0, 0],
      ["Hanan", "Reception", 2000, 500, 31, 819, 0, 3319, 21, 5],
      ["Muhammed Rashed", "Head Chef", 5000, 1000, 21, 50, 4115, 0, 2, 0],
      ["Aziz", "Head Chef", 6000, 2000, 14, 0, 0, 3615, 0, 0],
      ["Rahil Khan", "Assit. Chef: Subscription", 3000, 500, 31, 1125, 200, 0, 55, 1],
      ["Shariful Islam", "CDP: Subscription", 2000, 500, 31, 1125, 0, 2500, 58, 4],
      ["Mosab", "CDP: Butchery", 2000, 300, 0, 0, 1668, 0, 0, 0],
      ["Iftikhar Hussain", "CDP: Gym+Online+Lusail", 2500, 500, 31, 1038, 3000, 0, 32, 4],
      ["Arman Hussain", "Helper: Deserts", 1400, 400, 31, 719, 0, 1800, 49, 4],
      ["Muhammed Akash", "Helper: Iftikar", 1400, 400, 31, 505, 264, 1536, 33, 3],
      ["Shourub Hussain", "Helper: Subscription", 1400, 400, 31, 820, 0, 1800, 62, 4],
      ["Mary Wanjiru Kangethe", "Helper: Salads All", 1700, 800, 31, 736, 0, 2500, 75, 0],
      ["Saidul Islam Shiblu", "Helper: Iftikar", 1400, 200, 31, 614, 500, 1100, 36, 4],
      ["Bilal Abdul Basser", "Helper: Grill + StaffFood", 1400, 400, 31, 707, 0, 1800, 48, 4],
      ["Mohammed Wagiealla", "Cleaner: OutSide+Kitchen", 1400, 400, 31, 368, 600, 1200, 46, 0],
      ["Nahidul Islam Robin", "Helper: Iftikar", 1200, 200, 31, 457, 100, 1300, 36, 3],
      ["Shakib", "Helper: Subscription", 1200, 200, 31, 512, 0, 1400, 54, 2],
      ["Akram Abdulla", "Cleaner: Dishwash", 1400, 200, 27, 372, 0, 1400, 36, 1],
      ["Arif Mphammed", "Helper: Iftar", 1400, 200, 31, 460, 0, 1600, 57, 0],
      ["Khalid", "Store Keeper", 1200, 400, 31, 450, 0, 1600, 65, 0],
      ["Munna", "Shop", 1800, 200, 31, 893, 0, 0, 36, 5],
      ["Ramsheed", "Supervisor+Purchasing", 2500, 500, 31, 130, 0, 3000, 9, 0],
      ["Anoop", "Driver", 2000, 500, 31, 427, 0, 2500, 37, 0],
      ["Siddig", "Driver", 2000, 500, 31, 692, 0, 2500, 60, 0],
    ];
    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      const [name, designation, basic, allowance, days, overtime, advance, paid, otHours, fridays] = rows[i];
      await ctx.db.insert("payroll", {
        name, designation, basic, allowance, days, overtime, advance, paid, otHours, fridays,
        month, sortOrder: i + 1, createdAt: Date.now(),
      });
      n++;
    }
    return { ok: true, inserted: n };
  },
});
