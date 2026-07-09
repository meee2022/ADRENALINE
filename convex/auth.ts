/**
 * @file convex/auth.ts
 * @description نظام مصادقة موحد للأدمن والعملاء + إصدار جلسة (توكن) للسيرفر
 */
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { verifyPassword } from "./passwords";
import { createSession, destroySession } from "./sessions";
import { findStaffByEmail, findCustomerByEmail } from "./accountLookup";

/**
 * Unified authentication - checks both users and customerAccounts tables.
 * الآن mutation (بدل query) عشان تقدر تُنشئ جلسة وترجّع sessionToken.
 */
export const authenticateUnified = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // رسالة موحّدة لمنع كشف وجود البريد (user enumeration)
    const INVALID = { success: false as const, error: "بيانات الدخول غير صحيحة" };

    // First, try to find in users table (Admin, Staff)
    const user = await findStaffByEmail(ctx, args.email);

    if (user) {
      if (!user.isActive) {
        return { success: false, error: "الحساب غير نشط" };
      }

      if (!(await verifyPassword(args.password, user.passwordHash))) {
        return INVALID;
      }

      const sessionToken = await createSession(ctx, {
        accountType: "staff",
        userId: user._id,
        role: user.role,
      });

      return {
        success: true,
        accountType: "staff", // admin, kitchen, delivery, etc.
        sessionToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions || undefined,
        },
      };
    }

    // If not found in users, try customerAccounts table
    const customer = await findCustomerByEmail(ctx, args.email);

    if (customer) {
      if (!customer.isActive) {
        return { success: false, error: "الحساب غير نشط" };
      }

      if (!(await verifyPassword(args.password, customer.passwordHash))) {
        return INVALID;
      }

      const sessionToken = await createSession(ctx, {
        accountType: "customer",
        customerAccountId: customer._id,
      });

      return {
        success: true,
        accountType: "customer",
        sessionToken,
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

/** تسجيل الخروج — يبطل التوكن على السيرفر */
export const logout = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await destroySession(ctx, args.sessionToken);
    return { success: true };
  },
});
