/**
 * @file convex/lib/audit.ts
 * @description Helper لكتابة سجلات auditLog. يُستخدم من mutations الحساسة
 *   (إلغاء فاتورة، استرجاع، خصم، حذف خطة، تغيير سعر…).
 */
import type { MutationCtx } from "../_generated/server";

export type AuditActor = {
  userId?: string;
  name?: string;
  role?: string;
};

/** يكتب سطر واحد في auditLog. لا يرمي أخطاء (fail-safe) — تسجيل التدقيق مايمنعش العملية الأساسية. */
export async function writeAudit(
  ctx: MutationCtx,
  actor: AuditActor,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, any> | string,
): Promise<void> {
  try {
    await ctx.db.insert("auditLog", {
      actorUserId: actor.userId as any,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      details: typeof details === "string" ? details : details ? JSON.stringify(details) : undefined,
      createdAt: Date.now(),
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[audit] failed to write log:", (e as any)?.message);
  }
}
