/**
 * @file convex/sessions.ts
 * @description طبقة صلاحيات السيرفر — إنشاء/التحقق من جلسات الدخول (توكن).
 *   الدوال هنا مساعدات (helpers) تُستدعى من mutations أخرى لفرض الصلاحيات.
 */
import { MutationCtx, QueryCtx } from "./_generated/server";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوم

export type Identity = {
  accountType: "staff" | "customer";
  userId?: string;
  customerAccountId?: string;
  role?: string;
};

/** توليد توكن عشوائي آمن (48 hex) */
export function newToken(): string {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** إنشاء جلسة جديدة وإرجاع التوكن */
export async function createSession(
  ctx: MutationCtx,
  data: { accountType: "staff" | "customer"; userId?: any; customerAccountId?: any; role?: string },
): Promise<string> {
  const token = newToken();
  const now = Date.now();
  await ctx.db.insert("sessions", {
    token,
    accountType: data.accountType,
    userId: data.userId,
    customerAccountId: data.customerAccountId,
    role: data.role,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return token;
}

/** التحقق من توكن وإرجاع الهوية أو null */
export async function validateSession(
  ctx: QueryCtx | MutationCtx,
  token?: string | null,
): Promise<Identity | null> {
  if (!token) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return {
    accountType: session.accountType,
    userId: session.userId as any,
    customerAccountId: session.customerAccountId as any,
    role: session.role,
  };
}

const AUTH_ERR = "غير مصرّح — سجّل الدخول من جديد";
const ADMIN_ERR = "هذه العملية تتطلب صلاحية مدير";

/** يتطلّب موظفاً مسجّلاً (أي دور staff) */
export async function requireStaff(ctx: QueryCtx | MutationCtx, token?: string | null): Promise<Identity> {
  const id = await validateSession(ctx, token);
  if (!id || id.accountType !== "staff") throw new Error(AUTH_ERR);
  return id;
}

/** يتطلّب صلاحية مدير (ADMIN) */
export async function requireAdmin(ctx: QueryCtx | MutationCtx, token?: string | null): Promise<Identity> {
  const id = await requireStaff(ctx, token);
  if (String(id.role || "").toUpperCase() !== "ADMIN") throw new Error(ADMIN_ERR);
  return id;
}

/**
 * يتطلّب: موظف، أو العميل صاحب حساب `customerAccounts` المطلوب نفسه.
 * تُستخدم للاستعلامات/الطفرات التي يملكها العميل (بروفايله، تخطّي يوم…).
 */
export async function requireStaffOrAccountOwner(
  ctx: QueryCtx | MutationCtx,
  token: string | null | undefined,
  accountId: string,
): Promise<Identity> {
  const id = await validateSession(ctx, token);
  if (!id) throw new Error(AUTH_ERR);
  if (id.accountType === "staff") return id;
  if (String(id.customerAccountId) !== String(accountId)) throw new Error(AUTH_ERR);
  return id;
}

/**
 * يتطلّب: موظف، أو العميل المرتبط باشتراك `customerId` المحدّد.
 * الربط: customerAccounts.customerId → customers._id
 */
export async function requireStaffOrSubscriptionOwner(
  ctx: QueryCtx | MutationCtx,
  token: string | null | undefined,
  customerId: string,
): Promise<Identity> {
  const id = await validateSession(ctx, token);
  if (!id) throw new Error(AUTH_ERR);
  if (id.accountType === "staff") return id;
  if (!id.customerAccountId) throw new Error(AUTH_ERR);
  const account: any = await ctx.db.get(id.customerAccountId as any);
  if (!account || String(account.customerId) !== String(customerId)) throw new Error(AUTH_ERR);
  return id;
}

/**
 * يبطل كل جلسات حساب معيّن. يُستدعى عند تغيير/إعادة تعيين كلمة المرور:
 * من سرق توكناً يجب ألا يظل داخلاً بعد أن يغيّر الضحية كلمة مروره.
 */
export async function destroyAllSessionsFor(
  ctx: MutationCtx,
  opts: { userId?: string; customerAccountId?: string },
): Promise<number> {
  const all = await ctx.db.query("sessions").collect();
  let n = 0;
  for (const s of all) {
    const match =
      (opts.userId && String(s.userId) === String(opts.userId)) ||
      (opts.customerAccountId && String(s.customerAccountId) === String(opts.customerAccountId));
    if (match) {
      await ctx.db.delete(s._id);
      n++;
    }
  }
  return n;
}

/** حذف جلسة (تسجيل خروج) */
export async function destroySession(ctx: MutationCtx, token?: string | null): Promise<void> {
  if (!token) return;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (session) await ctx.db.delete(session._id);
}
