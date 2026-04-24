/**
 * @file convex/auth.ts
 * @description نظام مصادقة موحد للأدمن والعملاء
 */
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Simple hash function (same as in users.ts and customerAuth.ts)
 */
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Unified authentication - checks both users and customerAccounts tables
 */
export const authenticateUnified = query({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const passwordHash = simpleHash(args.password);

    // First, try to find in users table (Admin, Staff)
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (user) {
      if (!user.isActive) {
        return { success: false, error: "الحساب غير نشط" };
      }

      if (user.passwordHash !== passwordHash) {
        return { success: false, error: "كلمة المرور غير صحيحة" };
      }

      return {
        success: true,
        accountType: "staff", // admin, kitchen, delivery, etc.
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }

    // If not found in users, try customerAccounts table
    const customer = await ctx.db
      .query("customerAccounts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (customer) {
      if (!customer.isActive) {
        return { success: false, error: "الحساب غير نشط" };
      }

      if (customer.passwordHash !== passwordHash) {
        return { success: false, error: "كلمة المرور غير صحيحة" };
      }

      return {
        success: true,
        accountType: "customer",
        customer: {
          id: customer._id,
          email: customer.email,
          phone: customer.phone,
          fullName: customer.fullName,
          customerId: customer.customerId,
        },
      };
    }

    // Not found in either table
    return { success: false, error: "البريد الإلكتروني غير موجود" };
  },
});
