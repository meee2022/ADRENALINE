/**
 * @file convex/seedUsers.ts
 * @description Seed initial admin user
 */
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./sessions";
import { hashPassword } from "./passwords";

// ⚠️ يُقرأ من بيئة Convex — لا تضع كلمة مرور حقيقية في الكود.
// عيّنها بـ: npx convex env set SEED_ADMIN_EMAIL ... و SEED_ADMIN_PASSWORD ...
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!2024";

/**
 * Seed admin user
 */
export const seedAdminUser = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    // Check if admin already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", ADMIN_EMAIL))
      .first();

    if (existing) {
      console.log("Admin user already exists");
      return { success: false, message: "المسؤول موجود بالفعل" };
    }

    // Create admin user with the provided credentials
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    const userId = await ctx.db.insert("users", {
      email: ADMIN_EMAIL,
      passwordHash,
      name: "المسؤول",
      role: "ADMIN",
      isActive: true,
      createdAt: Date.now(),
    });

    console.log("Admin user created:", userId);
    return {
      success: true,
      message: "تم إنشاء حساب المسؤول بنجاح",
      userId,
    };
  },
});
