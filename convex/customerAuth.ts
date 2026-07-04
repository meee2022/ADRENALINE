/**
 * @file convex/customerAuth.ts
 * @description Customer authentication and profile management
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { hashPassword, verifyPassword } from "./passwords";

/**
 * Simple hash function (same as users.ts)
 */
// التشفير الآمن في convex/passwords.ts (PBKDF2 + توافق رجعي)

/**
 * Register new customer account
 */
export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    phone: v.string(),
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existingEmail = await ctx.db
      .query("customerAccounts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingEmail) {
      return { success: false, error: "البريد الإلكتروني مستخدم بالفعل" };
    }

    // Check if phone already exists
    const existingPhone = await ctx.db
      .query("customerAccounts")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existingPhone) {
      return { success: false, error: "رقم الهاتف مستخدم بالفعل" };
    }

    const passwordHash = await hashPassword(args.password);

    const accountId = await ctx.db.insert("customerAccounts", {
      email: args.email,
      passwordHash,
      phone: args.phone,
      fullName: args.fullName,
      isActive: true,
      createdAt: Date.now(),
    });

    return {
      success: true,
      account: {
        id: accountId,
        email: args.email,
        phone: args.phone,
        fullName: args.fullName,
      },
    };
  },
});

/**
 * Authenticate customer
 */
export const authenticate = query({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("customerAccounts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!account) {
      return { success: false, error: "بيانات الدخول غير صحيحة" };
    }

    if (!account.isActive) {
      return { success: false, error: "الحساب غير نشط" };
    }

    if (!(await verifyPassword(args.password, account.passwordHash))) {
      return { success: false, error: "بيانات الدخول غير صحيحة" };
    }

    return {
      success: true,
      account: {
        id: account._id,
        email: account.email,
        phone: account.phone,
        fullName: account.fullName,
        customerId: account.customerId,
      },
    };
  },
});

/**
 * Get customer profile with subscription details
 */
export const getProfile = query({
  args: { accountId: v.id("customerAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return null;

    let subscription = null;
    if (account.customerId) {
      const customer = await ctx.db.get(account.customerId);
      if (customer) {
        subscription = {
          id: customer._id,
          fullName: customer.fullName,
          phone: customer.phone,
          deliveryTime: customer.deliveryTime,
          startDate: customer.startDate,
          endDate: customer.endDate,
          isActive: customer.isActive,
          skippedDates: Array.isArray((customer as any).skippedDates) ? (customer as any).skippedDates : [],
          loyaltyPoints: Number((customer as any).loyaltyPoints || 0),
          referralCode: "ADR-" + String(customer._id).replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase(),
          program: customer.program,
          packageLabel: customer.packageLabel,
          mealsPerDay: customer.mealsPerDay,
          snacksPerDay: customer.snacksPerDay,
          price: customer.price,
          finalPrice: customer.finalPrice,
          goals: customer.goals,
          allergies: customer.allergies,
          address: customer.address,
        };
      }
    }

    return {
      account: {
        id: account._id,
        email: account.email,
        phone: account.phone,
        fullName: account.fullName,
      },
      subscription,
    };
  },
});

/**
 * Link customer account to subscription
 */
export const linkSubscription = mutation({
  args: {
    accountId: v.id("customerAccounts"),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      customerId: args.customerId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update customer account profile
 */
export const updateProfile = mutation({
  args: {
    accountId: v.id("customerAccounts"),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { updatedAt: Date.now() };
    
    if (args.fullName) updates.fullName = args.fullName;
    if (args.phone) updates.phone = args.phone;

    await ctx.db.patch(args.accountId, updates);
  },
});

/**
 * List all customer accounts
 */
export const listCustomers = query({
  handler: async (ctx) => {
    const accounts = await ctx.db.query("customerAccounts").collect();
    return accounts.map(acc => ({
      id: acc._id,
      email: acc.email,
      phone: acc.phone,
      fullName: acc.fullName,
      isActive: acc.isActive,
      createdAt: acc.createdAt,
      customerId: acc.customerId,
    }));
  },
});

/**
 * Change password
 */
export const changePassword = mutation({
  args: {
    accountId: v.id("customerAccounts"),
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("الحساب غير موجود");
    }

    if (!(await verifyPassword(args.oldPassword, account.passwordHash))) {
      throw new Error("كلمة المرور القديمة غير صحيحة");
    }

    const newPasswordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(args.accountId, {
      passwordHash: newPasswordHash,
      updatedAt: Date.now(),
    });
  },
});

// ===== إعادة تعيين كلمة المرور (تحقّق بالبريد + رقم الهاتف المسجّلين) =====
export const resetPassword = mutation({
  args: {
    email: v.string(),
    phone: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 6) {
      return { success: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" };
    }
    const account = await ctx.db
      .query("customerAccounts")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim().toLowerCase()))
      .first();

    // تحقّق أن البريد والهاتف يخصّان نفس الحساب (رسالة موحّدة لمنع الكشف)
    const norm = (s: string) => String(s || "").replace(/\D/g, "");
    if (!account || norm(account.phone) !== norm(args.phone)) {
      return { success: false, error: "البريد الإلكتروني ورقم الهاتف غير متطابقين مع أي حساب" };
    }

    await ctx.db.patch(account._id, {
      passwordHash: await hashPassword(args.newPassword),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
