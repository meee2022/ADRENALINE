/**
 * أثرُ العمليات الحسّاسة — «من فعل ماذا ومتى؟»
 *
 * السؤال الذي استغرقت الإجابة عنه ساعةً حين تحوّل خمسة مشتركين من صباحي
 * لمسائي فتكرّرت خططهم وطُبخت ثلاثون وجبةً زائدة: لم يكن في النظام ما يقول
 * من فعلها. `auditLog` موجود منذ البداية لكنه يُكتب من أربعة مواضع فقط —
 * صفٌّ واحد في قاعدة كاملة — فلا يجيب شيئاً.
 *
 * هذا المساعد يجعل التسجيل سطراً واحداً في أي عملية، ولا يُفشِل العملية
 * أبداً: فشلُ الكتابة في السجل لا يجوز أن يمنع طبخاً أو توصيلاً، فيُبتلع
 * الخطأ ويستمر العمل.
 */
import type { MutationCtx } from "../_generated/server";

export type TrailInput = {
  /** فعلٌ بصيغة الأمر الماضي بالإنجليزية الحيادية: PLAN_CREATED, ORDER_APPROVED … */
  action: string;
  /** نوع الكيان المتأثّر: plan | customer | order | template | inventory … */
  entityType: string;
  entityId?: string;
  /** جملة عربية يقرؤها الطاقم — لا JSON خام. */
  details?: string;
  /** الهوية العائدة من requireStaff (تحمل userId والدور، لا الاسم). */
  staff?: { userId?: string; role?: string } | null;
};

/**
 * يسجّل عملية في `auditLog`. اسم المنفِّذ يُجلب من جدول المستخدمين لأن هوية
 * الجلسة تحمل المعرّف والدور فقط — وقد كُتب السجل فارغ الاسم قبل ذلك فأجاب
 * «ماذا» دون «من»، وهو نصف السؤال.
 */
export async function trail(ctx: MutationCtx, input: TrailInput): Promise<void> {
  try {
    let actorName: string | undefined;
    let actorRole: string | undefined = input.staff?.role;
    if (input.staff?.userId) {
      const u: any = await ctx.db.get(input.staff.userId as any);
      actorName = u?.name || u?.username || undefined;
      actorRole = actorRole || u?.role || undefined;
    }
    await ctx.db.insert("auditLog", {
      actorUserId: (input.staff?.userId as any) || undefined,
      actorName,
      actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details ? String(input.details).slice(0, 400) : undefined,
      createdAt: Date.now(),
    });
  } catch {
    /* السجل مساعِد لا حاكم: لا يُوقف عملاً في المطبخ إن تعذّرت كتابته. */
  }
}
