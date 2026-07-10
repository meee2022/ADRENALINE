/**
 * @file convex/auditLog.ts
 * @description سجل الأحداث الحساسة - للأمان والمراجعة
 */
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./sessions";
import { v } from "convex/values";

export const log = mutation({
  args: {
    actorUserId: v.optional(v.id("users")),
    actorName: v.optional(v.string()),
    actorRole: v.optional(v.string()),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    details: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.insert("auditLog", {
      ...args,
      createdAt: Date.now(),
    });
    return { success: true };
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    entityType: v.optional(v.string()),
    action: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { limit = 100, entityType, action, sessionToken }) => {
    let logs = await ctx.db
      .query("auditLog")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);

    if (entityType) logs = logs.filter((l) => l.entityType === entityType);
    if (action) logs = logs.filter((l) => l.action === action);

    return logs.slice(0, limit);
  },
});

export const stats = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("auditLog").order("desc").take(1000);
    const last24h = all.filter((l) => l.createdAt > Date.now() - 24 * 60 * 60 * 1000);
    const byAction = new Map<string, number>();
    for (const l of last24h) {
      byAction.set(l.action, (byAction.get(l.action) || 0) + 1);
    }
    return {
      total: all.length,
      last24h: last24h.length,
      byAction: Object.fromEntries(byAction),
    };
  },
});
