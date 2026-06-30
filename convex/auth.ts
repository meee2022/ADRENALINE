/**
 * @file convex/auth.ts
 * @description نظام مصادقة موحد للأدمن والعملاء
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import { verifyPassword } from "./passwords";

/**
 * Unified authentication - checks both users and customerAccounts tables
 */
export const authenticateUnified = query({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // رسالة موحّدة لمنع كشف وجود البريد (user enumeration)
    const INVALID = { success: false as const, error: "بيانات الدخول غير صحيحة" };

    // First, try to find in users table (Admin, Staff)
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (user) {
      if (!user.isActive) {
        return { success: false, error: "الحساب غير نشط" };
      }

      if (!(await verifyPassword(args.password, user.passwordHash))) {
        return INVALID;
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

      if (!(await verifyPassword(args.password, customer.passwordHash))) {
        return INVALID;
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

    // Not found in either table — رسالة موحّدة
    return INVALID;
  },
});
