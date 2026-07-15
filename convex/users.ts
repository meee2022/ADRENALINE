/**
 * @file convex/users.ts
 * @description User authentication and management
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { hashPassword } from "./passwords";
import { requireAdmin, requireStaff, destroyAllSessionsFor } from "./sessions";

/** أقل طول مقبول لكلمة المرور — مطابق لما تفرضه شاشة استعادة كلمة المرور. */
const MIN_PASSWORD_LENGTH = 8;

function assertStrongEnough(password: string) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
  }
}

/**
 * Simple hash function for passwords (FOR DEMO ONLY)
 * In production, use bcrypt or similar proper hashing
 */
// التشفير الآمن في convex/passwords.ts (PBKDF2 + توافق رجعي)

// ملاحظة: `authenticate` القديمة أُزيلت. كانت query عامة تتحقق من كلمة المرور،
// غير مستخدمة من أي مكان، وتكشف "البريد غير موجود" (تعداد حسابات).
// تسجيل الدخول يمرّ عبر auth.authenticateUnified وحدها.

/**
 * Get user by ID — موظفون فقط
 */
export const getUserById = query({
  args: { userId: v.id("users"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    };
  },
});

/**
 * List all users (admin only)
 */
export const listUsers = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // يكشف كل الموظفين وأدوارهم وصلاحياتهم — خريطة جاهزة لاستهدافهم
    await requireAdmin(ctx, args.sessionToken);
    const users = await ctx.db.query("users").collect();
    return users.map((user) => ({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: (user as any).permissions || undefined,
      isActive: user.isActive,
      createdAt: user.createdAt,
    }));
  },
});

/**
 * Create a new user (admin only)
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("ADMIN"),
      v.literal("KITCHEN"),
      v.literal("DELIVERY"),
      v.literal("NUTRITIONIST"),
      v.literal("INVENTORY_MANAGER"),
      v.literal("ACCOUNTANT"),
      v.literal("FINANCE_MANAGER"),
      v.literal("CASHIER")
    ),
    permissions: v.optional(v.array(v.string())),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    assertStrongEnough(args.password);
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("البريد الإلكتروني مستخدم بالفعل");
    }

    const passwordHash = await hashPassword(args.password);

    const userId = await ctx.db.insert("users", {
      email: args.email,
      passwordHash,
      name: args.name,
      role: args.role,
      permissions: args.permissions,
      isActive: true,
      createdAt: Date.now(),
    });

    return userId;
  },
});

/**
 * Update user status
 */
export const updateUserStatus = mutation({
  args: {
    userId: v.id("users"),
    isActive: v.boolean(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.patch(args.userId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Change user password
 */
export const changePassword = mutation({
  args: {
    userId: v.id("users"),
    newPassword: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    assertStrongEnough(args.newPassword);
    const passwordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(args.userId, {
      passwordHash,
      updatedAt: Date.now(),
    });
    // 🔒 أبطل جلسات هذا الموظف بعد تغيير كلمة مروره
    await destroyAllSessionsFor(ctx, { userId: String(args.userId) });
  },
});

/**
 * Delete user
 */
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.delete(args.userId);
  },
});

/**
 * Update user details
 */
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("ADMIN"),
        v.literal("KITCHEN"),
        v.literal("DELIVERY"),
        v.literal("NUTRITIONIST"),
        v.literal("INVENTORY_MANAGER"),
        v.literal("ACCOUNTANT"),
        v.literal("FINANCE_MANAGER"),
        v.literal("CASHIER")
      )
    ),
    permissions: v.optional(v.array(v.string())),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const updates: any = { updatedAt: Date.now() };

    if (args.name) updates.name = args.name;
    if (args.email) updates.email = args.email;
    if (args.role) updates.role = args.role;
    if (args.permissions !== undefined) updates.permissions = args.permissions;

    await ctx.db.patch(args.userId, updates);
  },
});
