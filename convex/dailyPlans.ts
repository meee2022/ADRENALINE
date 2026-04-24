/**
 * @file convex/dailyPlans.ts
 * @description Convex functions للخطط اليومية
 * @frontend client/src/pages/Plans.tsx, client/src/pages/Kitchen.tsx, client/src/pages/Delivery.tsx, client/src/pages/Dashboard.tsx
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

type PlanStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PREPARED"
  | "DELIVERED"
  | "CANCELLED";

const ALLOWED_STATUSES: PlanStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "PREPARED",
  "DELIVERED",
  "CANCELLED",
];

function normalizeStatus(x: any): PlanStatus {
  const s = String(x || "")
    .trim()
    .toUpperCase();
  return (
    ALLOWED_STATUSES.includes(s as PlanStatus) ? s : "DRAFT"
  ) as PlanStatus;
}

function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  if (to === from) return true;

  // السماح بالإلغاء من أي حالة
  if (to === "CANCELLED") return true;

  // مسارات طبيعية
  if (from === "DRAFT" && to === "CONFIRMED") return true;
  if (from === "CONFIRMED" && to === "PREPARED") return true;
  if (from === "PREPARED" && to === "DELIVERED") return true;

  // السماح بالرجوع من CONFIRMED إلى DRAFT (اختياري)
  if (from === "CONFIRMED" && to === "DRAFT") return true;

  // غير ذلك مرفوض
  return false;
}

function stripSystemFields(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const safe = { ...(obj || {}) };
  delete safe._id;
  delete safe._creationTime;
  delete safe.createdAt;
  return safe;
}

export const list = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    if (date) {
      return await ctx.db
        .query("dailyPlans")
        .withIndex("by_date", (q) => q.eq("date", date))
        .collect();
    }
    return await ctx.db.query("dailyPlans").order("desc").collect();
  },
});

export const getByDateAndCustomer = query({
  args: {
    date: v.string(),
    customerId: v.id("customers"),
  },
  handler: async (ctx, { date, customerId }) => {
    const plans = await ctx.db
      .query("dailyPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    return plans.find((p) => String(p.customerId) === String(customerId)) || null;
  },
});

export const get = query({
  args: { id: v.id("dailyPlans") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    date: v.string(),
    customerId: v.id("customers"),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    status: v.string(),
    notes: v.optional(v.string()),
    items: v.any(),
  },
  handler: async (ctx, args) => {
    const requested = normalizeStatus(args.status);

    const safeStatus: PlanStatus =
      requested === "PREPARED" || requested === "DELIVERED"
        ? "CONFIRMED"
        : requested;

    return await ctx.db.insert("dailyPlans", {
      ...args,
      status: safeStatus,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("dailyPlans"),
    data: v.any(),
  },
  handler: async (ctx, { id, data }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Daily plan not found");

    const currentStatus = normalizeStatus((existing as any).status);
    const requestedStatus =
      data && typeof data === "object" && "status" in data
        ? normalizeStatus((data as any).status)
        : currentStatus;

    // ✅ طبق قواعد الانتقال
    const finalStatus = canTransition(currentStatus, requestedStatus)
      ? requestedStatus
      : currentStatus;

    const safe = stripSystemFields(data || {});
    safe.status = finalStatus;

    await ctx.db.patch(id, safe);
    return true;
  },
});

export const remove = mutation({
  args: { id: v.id("dailyPlans") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return true;
  },
});
