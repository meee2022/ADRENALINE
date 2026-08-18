/**
 * @file convex/notifications.ts
 * @description إشعارات داخلية — مؤمّنة:
 *   - listForRole/unreadCount/markAllAsRead: الدور يُستخرج من الجلسة، مش من args
 *   - listForCustomer/markAllAsReadForCustomer: تتطلب جلسة مالك الاشتراك
 *   - markAsRead: يتحقق أن الإشعار يخص دور المستدعي (staff) أو عميل (owner)
 */
import { mutation, query, internalMutation } from "./_generated/server";
import { requireAdmin, requireStaff, validateSession, requireStaffOrSubscriptionOwner, AUTH_ERR } from "./sessions";
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

/** يحوّل دور المستخدم لاستعلام دقيق. ADMIN يشوف الكل. */
function roleFromIdentity(id: any): string | null {
  if (!id || id.accountType !== "staff") return null;
  return String(id.role || "").toUpperCase() || null;
}

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
      ...args, isRead: false, createdAt: Date.now(),
    });
    return id;
  },
});

/**
 * 🔒 قائمة إشعارات — الدور من الجلسة، مش من args.
 * ADMIN يشوف الكل. باقي الأدوار يشوفوا إشعارات دورهم فقط.
 */
export const listForRole = query({
  args: { onlyUnread: v.optional(v.boolean()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    const role = roleFromIdentity(id);
    // Queries used by the global notification bell must never take down the
    // current page when a laptop wakes with a stale persisted session. Convex
    // intentionally hides server error details in production, so throwing
    // here reaches React as a generic error that the auth guard cannot
    // identify. An unauthenticated user simply has no staff notifications.
    if (!role) return [];
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);
    return all
      .filter((n) => {
        if (role === "ADMIN") {
          // ADMIN يشوف الكل (بما فيها العام)
        } else {
          if (n.targetRole !== role) return false;
        }
        if (args.onlyUnread && n.isRead) return false;
        return true;
      })
      .slice(0, 50);
  },
});

export const unreadCount = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    const role = roleFromIdentity(id);
    if (!role) return 0;
    if (role === "ADMIN") {
      const all = await ctx.db.query("notifications").order("desc").take(200);
      return all.filter((n: any) => !n.isRead).length;
    }
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_targetRole", (q) => q.eq("targetRole", role as any).eq("isRead", false))
      .collect();
    return rows.length;
  },
});

/** 🔒 markAsRead — يتحقق أن الإشعار يخص المستدعي (staff بنفس الدور أو عميل مالك). */
export const markAsRead = mutation({
  args: { id: v.id("notifications"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await validateSession(ctx, args.sessionToken);
    if (!identity) throw new Error(AUTH_ERR);
    const notif: any = await ctx.db.get(args.id);
    if (!notif) return;
    if (identity.accountType === "staff") {
      const role = roleFromIdentity(identity);
      if (role !== "ADMIN") {
        if (notif.targetRole && notif.targetRole !== role) throw new Error("لا تملك صلاحية الوصول إلى هذا الإشعار");
      }
    } else {
      // عميل — لا يعلّم إلا إشعاراته
      if (!identity.customerAccountId) throw new Error(AUTH_ERR);
      const acct: any = await ctx.db.get(identity.customerAccountId as any);
      if (!acct?.customerId || String(notif.targetCustomerId) !== String(acct.customerId)) {
        throw new Error("لا تملك صلاحية الوصول إلى هذا الإشعار");
      }
    }
    await ctx.db.patch(args.id, { isRead: true, readAt: Date.now() });
  },
});

export const markAllAsRead = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await validateSession(ctx, args.sessionToken);
    const role = roleFromIdentity(identity);
    if (!role) throw new Error(AUTH_ERR);
    const now = Date.now();
    let count = 0;
    if (role === "ADMIN") {
      const global = await ctx.db.query("notifications").order("desc").take(500);
      for (const n of global) {
        if (!n.isRead) { await ctx.db.patch(n._id, { isRead: true, readAt: now }); count++; }
      }
    } else {
      const rows = await ctx.db
        .query("notifications")
        .withIndex("by_targetRole", (q) => q.eq("targetRole", role as any).eq("isRead", false))
        .collect();
      for (const n of rows) { await ctx.db.patch(n._id, { isRead: true, readAt: now }); count++; }
    }
    return { success: true, count };
  },
});

/** 🔒 إشعارات عميل — لصاحب الاشتراك أو موظف فقط. */
export const listForCustomer = query({
  args: { customerId: v.id("customers"), onlyUnread: v.optional(v.boolean()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaffOrSubscriptionOwner(ctx, args.sessionToken, String(args.customerId));
    let rows = await ctx.db
      .query("notifications")
      .withIndex("by_targetCustomer", (q) => q.eq("targetCustomerId", args.customerId))
      .collect();
    rows = rows.sort((a, z) => z.createdAt - a.createdAt).slice(0, 50);
    return args.onlyUnread ? rows.filter((n) => !n.isRead) : rows;
  },
});

export const markAllAsReadForCustomer = mutation({
  args: { customerId: v.id("customers"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaffOrSubscriptionOwner(ctx, args.sessionToken, String(args.customerId));
    const open = await ctx.db
      .query("notifications")
      .withIndex("by_targetCustomer", (q) => q.eq("targetCustomerId", args.customerId).eq("isRead", false))
      .collect();
    const now = Date.now();
    for (const n of open) await ctx.db.patch(n._id, { isRead: true, readAt: now });
    return { success: true, count: open.length };
  },
});

export const cleanupOld = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("notifications")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .collect();
    for (const n of old) await ctx.db.delete(n._id);
    return { deleted: old.length };
  },
});

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
        targetRole: role, type: args.type, title: args.title,
        message: args.message, link: args.link, relatedId: args.relatedId,
        isRead: false, createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});
