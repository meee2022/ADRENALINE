import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff } from "./sessions";

export const workspace = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const [customers, plans, tasks] = await Promise.all([
      ctx.db.query("customers").collect(), ctx.db.query("dailyPlans").collect(),
      ctx.db.query("customerFollowUps").withIndex("by_status", q => q.eq("status", "OPEN")).collect(),
    ]);
    const byId = new Map(customers.map((c: any) => [String(c._id), c]));
    const failed = plans.filter((p: any) => p.failedAt && p.customerId).map((p: any) => ({ ...p, customer: byId.get(String(p.customerId)) }));
    return { customers, tasks, failedDeliveries: failed };
  },
});

export const createFollowUp = mutation({
  args: { customerId: v.id("customers"), type: v.union(v.literal("RENEWAL"), v.literal("DELIVERY_FAILURE"), v.literal("GENERAL")), note: v.string(), dueDate: v.optional(v.string()), sourcePlanId: v.optional(v.id("dailyPlans")), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity: any = await requireStaff(ctx, args.sessionToken);
    const note = args.note.trim(); if (!note) throw new Error("ملاحظة المتابعة مطلوبة");
    return await ctx.db.insert("customerFollowUps", { customerId: args.customerId, type: args.type, status: "OPEN", note, dueDate: args.dueDate, sourcePlanId: args.sourcePlanId, createdBy: identity.userId as any, createdAt: Date.now() });
  },
});

export const closeFollowUp = mutation({
  args: { id: v.id("customerFollowUps"), status: v.union(v.literal("DONE"), v.literal("DISMISSED")), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => { await requireStaff(ctx, args.sessionToken); await ctx.db.patch(args.id, { status: args.status, completedAt: Date.now(), updatedAt: Date.now() }); },
});
