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

export const AUTH_ERR = "غير مصرّح — سجّل الدخول من جديد";
export const ADMIN_ERR = "هذه العملية تتطلب صلاحية مدير";
export const ROLE_ERR = "دورك لا يسمح بهذه العملية";

/**
 * ✅ pure function — نتحقق أن دور الهوية ضمن قائمة مسموحة. تُستدعى داخل
 *    requireRole، ومنفصلة عشان تكون قابلة للاختبار بلا Convex context.
 *    ADMIN دائماً مسموح (super-user).
 */
export function assertRole(id: Identity | null, allowed: string[]): asserts id is Identity {
  if (!id || id.accountType !== "staff") throw new Error(AUTH_ERR);
  const role = String(id.role || "").toUpperCase();
  if (role === "ADMIN") return;                          // ADMIN يمر دائماً
  const ok = allowed.map((r) => r.toUpperCase()).includes(role);
  if (!ok) throw new Error(ROLE_ERR);
}

/** ✅ يتطلّب دور من قائمة محددة (أو ADMIN تلقائياً). للـfinance/HR/kitchen…إلخ. */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  token: string | null | undefined,
  allowed: string[],
): Promise<Identity> {
  const id = await validateSession(ctx, token);
  assertRole(id, allowed);
  return id!;
}

/**
 * ✅ يتطلّب واحد من:
 *   - ADMIN (يمر دائماً)
 *   - دور ضمن `roles`
 *   - أو صلاحية صفحة (`permissions`) موجودة في users.permissions للمستخدم
 *     (مطابقة exact، أو prefix — /drivers يغطي /drivers/*)
 *
 * الفكرة: المدير يقدر يعطي أي موظف صفحة معينة (مثلاً /drivers) ويحصل
 * على القدرة لتشغيل mutations الصفحة تلقائياً، بدل ما يبقى مربوطاً بدور
 * محدد فقط.
 */
export async function requireRoleOrPermission(
  ctx: QueryCtx | MutationCtx,
  token: string | null | undefined,
  opts: { roles?: string[]; permissions?: string[] },
): Promise<Identity> {
  const id = await validateSession(ctx, token);
  if (!id || id.accountType !== "staff") throw new Error(AUTH_ERR);
  const role = String(id.role || "").toUpperCase();
  if (role === "ADMIN") return id;
  const allowedRoles = (opts.roles || []).map((r) => r.toUpperCase());
  if (allowedRoles.includes(role)) return id;

  // فحص الصلاحيات المخصّصة على مستوى المستخدم
  const wanted = opts.permissions || [];
  if (wanted.length > 0 && id.userId) {
    const user: any = await ctx.db.get(id.userId as any);
    const perms: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
    if (perms.length > 0) {
      for (const w of wanted) {
        for (const p of perms) {
          if (p === w) return id;
          if (p === "/") continue;
          // /drivers/* يغطي /drivers و /drivers/foo
          if (p.endsWith("/*") && (w === p.slice(0, -2) || w.startsWith(p.slice(0, -2) + "/"))) return id;
          // /drivers يغطي /drivers/foo
          if (w.startsWith(p + "/")) return id;
        }
      }
    }
  }
  throw new Error(ROLE_ERR);
}

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
