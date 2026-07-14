/**
 * @file convex/auth.ts
 * @description نظام مصادقة موحد للأدمن والعملاء + إصدار جلسة (توكن) للسيرفر
 */
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { verifyPassword, verifyAndMaybeUpgrade } from "./passwords";
import { createSession, destroySession, requireAdmin } from "./sessions";
import { findStaffByEmail, findCustomerByEmail } from "./accountLookup";

/* ═══════════ تحديد محاولات تسجيل الدخول (منع تخمين كلمة المرور) ═══════════ */

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // نافذة 15 دقيقة
const MAX_ATTEMPTS = 5;
const THROTTLED = "محاولات كثيرة — حاول مرة أخرى بعد 15 دقيقة";

const attemptKey = (email: string) => String(email || "").trim().toLowerCase();

/** يرمي خطأً إذا تجاوز البريد الحدّ. يُستدعى قبل أي مقارنة لكلمة المرور. */
async function assertNotThrottled(ctx: any, email: string) {
  const key = attemptKey(email);
  const row = await ctx.db
    .query("loginAttempts")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  if (!row) return;
  // انتهت النافذة → صفّر العدّاد
  if (Date.now() - row.firstAt > ATTEMPT_WINDOW_MS) {
    await ctx.db.delete(row._id);
    return;
  }
  if (row.count >= MAX_ATTEMPTS) throw new Error(THROTTLED);
}

/** يسجّل محاولة فاشلة. */
async function recordFailure(ctx: any, email: string) {
  const key = attemptKey(email);
  const now = Date.now();
  const row = await ctx.db
    .query("loginAttempts")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  if (!row) {
    await ctx.db.insert("loginAttempts", { key, count: 1, firstAt: now, lastAt: now });
    return;
  }
  if (now - row.firstAt > ATTEMPT_WINDOW_MS) {
    await ctx.db.patch(row._id, { count: 1, firstAt: now, lastAt: now });
  } else {
    await ctx.db.patch(row._id, { count: row.count + 1, lastAt: now });
  }
}

/** ينظّف العدّاد بعد نجاح الدخول. */
async function clearFailures(ctx: any, email: string) {
  const row = await ctx.db
    .query("loginAttempts")
    .withIndex("by_key", (q: any) => q.eq("key", attemptKey(email)))
    .first();
  if (row) await ctx.db.delete(row._id);
}

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
    // 🔒 قبل أي مقارنة لكلمة المرور
    await assertNotThrottled(ctx, args.email);

    // رسالة موحّدة لمنع كشف وجود البريد (user enumeration)
    const INVALID = { success: false as const, error: "بيانات الدخول غير صحيحة" };

    // First, try to find in users table (Admin, Staff)
    const user = await findStaffByEmail(ctx, args.email);

    if (user) {
      if (!user.isActive) {
        return { success: false, error: "الحساب غير نشط" };
      }

      // ✅ يتحقق ويرقّي الـhash القديم لـPBKDF2 تلقائياً على أول دخول ناجح
      const ok = await verifyAndMaybeUpgrade(args.password, user.passwordHash, async (newHash) => {
        await ctx.db.patch(user._id, { passwordHash: newHash });
      });
      if (!ok) {
        await recordFailure(ctx, args.email);
        return INVALID;
      }

      await clearFailures(ctx, args.email);
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

      // ✅ نفس منطق الترقية التلقائية للعملاء
      const okCust = await verifyAndMaybeUpgrade(args.password, customer.passwordHash, async (newHash) => {
        await ctx.db.patch(customer._id, { passwordHash: newHash });
      });
      if (!okCust) {
        await recordFailure(ctx, args.email);
        return INVALID;
      }

      await clearFailures(ctx, args.email);
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

    // Not found in either table — رسالة موحّدة (ونحتسبها محاولة فاشلة أيضاً)
    await recordFailure(ctx, args.email);
    return INVALID;
  },
});

/**
 * فكّ حظر بريد قُفل بعد محاولات كثيرة (للأدمن، أو للطوارئ من CLI).
 * بلا وسيط `email` يمسح كل العدّادات.
 */
export const clearLoginAttempts = mutation({
  args: { email: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // متاح من CLI بلا توكن فقط عندما تُفعَّل الصلاحية الطارئة صراحةً،
    // وإلا فهو للأدمن. هذا يمنع مهاجماً من مسح عدّاده بنفسه.
    if (process.env.ALLOW_UNLOCK_FROM_CLI !== "true") {
      await requireAdmin(ctx, args.sessionToken);
    }
    const rows = await ctx.db.query("loginAttempts").collect();
    let cleared = 0;
    for (const r of rows) {
      if (!args.email || r.key === attemptKey(args.email)) {
        await ctx.db.delete(r._id);
        cleared++;
      }
    }
    return { cleared };
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
