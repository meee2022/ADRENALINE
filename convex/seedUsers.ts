/**
 * @file convex/seedUsers.ts
 * @description Seed initial admin user
 */
import { mutation } from "./_generated/server";

/**
 * Simple hash function (same as in users.ts)
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

// ⚠️ يُقرأ من بيئة Convex — لا تضع كلمة مرور حقيقية في الكود.
// عيّنها بـ: npx convex env set SEED_ADMIN_EMAIL ... و SEED_ADMIN_PASSWORD ...
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!2024";

/**
 * Seed admin user
 */
export const seedAdminUser = mutation({
  handler: async (ctx) => {
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
    const passwordHash = simpleHash(ADMIN_PASSWORD);

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
