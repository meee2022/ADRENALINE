/**
 * @file convex/notifications.ts
 * @description نظام الإشعارات الداخلية - للأدوار والمستخدمين
 */
import { mutation, query, internalMutation } from "./_generated/server";
import { requireAdmin } from "./sessions";
import { v } from "convex/values";

const NOTIF_TYPE = v.union(
  v.literal("NEW_ORDER"),
  v.literal("ORDER_APPROVED"),
  v.literal("PLAN_CONFIRMED"),
  v.literal("MEAL_PREPARED"),
  v.literal("MEAL_DELIVERED"),
  v.literal("LOW_STOCK"),
  v.literal("SYSTEM"),
);

const ROLE = v.union(
  v.literal("ADMIN"),
  v.literal("KITCHEN"),
  v.literal("DELIVERY"),
  v.literal("NUTRITIONIST"),
  v.literal("INVENTORY_MANAGER"),
);

/**
 * إنشاء إشعار - يستخدم داخلياً من mutations أخرى
 */
export const create = mutation({
  args: {
    targetRole: v.optional(ROLE),
    targetUserId: v.optional(v.id("users")),
    type: NOTIF_TYPE,
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    relatedId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const id = await ctx.db.insert("notifications", {
      ...args,
      isRead: false,
      createdAt: Date.now(),
    });
    return id;
  },
});

/**
 * جلب إشعارات حسب الدور (آخر 50)
 */
export const listForRole = query({
  args: { role: ROLE, onlyUnread: v.optional(v.boolean()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);

    return all
      .filter((n) => {
        // إشعار للدور أو إشعار عام (بدون targetRole = للجميع/ADMIN)
        const matchRole = n.targetRole === args.role
          || (args.role === "ADMIN" && !n.targetRole);
        if (!matchRole) return false;
        if (args.onlyUnread && n.isRead) return false;
        return true;
      })
      .slice(0, 50);
  },
});

/**
 * عدد الإشعارات غير المقروءة لدور معين
 */
export const unreadCount = query({
  args: { role: ROLE, sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_targetRole", (q) => q.eq("targetRole", args.role).eq("isRead", false))
      .collect();

    // أيضاً الإشعارات بدون targetRole (للأدمن)
    let adminGlobal: any[] = [];
    if (args.role === "ADMIN") {
      const global = await ctx.db.query("notifications").order("desc").take(100);
      adminGlobal = global.filter((n) => !n.targetRole && !n.isRead);
    }

    return all.length + adminGlobal.length;
  },
});

/**
 * تعليم إشعار كمقروء
 */
export const markAsRead = mutation({
  args: { id: v.id("notifications"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isRead: true, readAt: Date.now() });
  },
});

/**
 * تعليم كل إشعارات الدور كمقروءة
 */
export const markAllAsRead = mutation({
  args: { role: ROLE, sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_targetRole", (q) => q.eq("targetRole", args.role).eq("isRead", false))
      .collect();

    const now = Date.now();
    for (const n of all) {
      await ctx.db.patch(n._id, { isRead: true, readAt: now });
    }

    if (args.role === "ADMIN") {
      const global = await ctx.db.query("notifications").order("desc").take(200);
      for (const n of global) {
        if (!n.targetRole && !n.isRead) {
          await ctx.db.patch(n._id, { isRead: true, readAt: now });
        }
      }
    }

    return { success: true, count: all.length };
  },
});

// إشعارات عميل معيّن (بوابة العميل)
export const listForCustomer = query({
  args: { customerId: v.id("customers"), onlyUnread: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let rows = await ctx.db
      .query("notifications")
      .withIndex("by_targetCustomer", (q) => q.eq("targetCustomerId", args.customerId))
      .collect();
    rows = rows.sort((a, z) => z.createdAt - a.createdAt).slice(0, 50);
    return args.onlyUnread ? rows.filter((n) => !n.isRead) : rows;
  },
});

export const markAllAsReadForCustomer = mutation({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const open = await ctx.db
      .query("notifications")
      .withIndex("by_targetCustomer", (q) => q.eq("targetCustomerId", args.customerId).eq("isRead", false))
      .collect();
    const now = Date.now();
    for (const n of open) await ctx.db.patch(n._id, { isRead: true, readAt: now });
    return { success: true, count: open.length };
  },
});

/**
 * حذف الإشعارات القديمة (أكثر من 30 يوم)
 */
export const cleanupOld = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("notifications")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .collect();

    for (const n of old) {
      await ctx.db.delete(n._id);
    }
    return { deleted: old.length };
  },
});

/**
 * Helper: إنشاء إشعار لعدة أدوار دفعة واحدة
 */
export const broadcast = mutation({
  args: {
    roles: v.array(ROLE),
    type: NOTIF_TYPE,
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    relatedId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const ids: any[] = [];
    for (const role of args.roles) {
      const id = await ctx.db.insert("notifications", {
        targetRole: role,
        type: args.type,
        title: args.title,
        message: args.message,
        link: args.link,
        relatedId: args.relatedId,
        isRead: false,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});
