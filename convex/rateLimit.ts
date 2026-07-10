/**
 * @file convex/rateLimit.ts
 * @description تحديد معدّل بسيط (نافذة ثابتة) للدوال العامة المكلِّفة.
 *
 * السبب: `ai.chat` و`ai.generateSmartPlan` و`generateWeeklyPlan` نقاط نهاية
 * عامة تستدعي واجهة Anthropic المدفوعة. بدون حدّ، حلقة `while(true)` من أي
 * متصفح تحرق رصيد الحساب.
 *
 * ⚠️ Convex لا يمرّر عنوان IP للدوال، لذلك لا يمكن التحديد لكل زائر.
 *    نستخدم طبقتين:
 *      1. دلو لكل هاتف (عند توفّره) — يوقف إساءة مستخدم واحد.
 *      2. دلو عام لكل دالة — سقف تكلفة مطلق مهما كان عدد المهاجمين.
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * يستهلك وحدة من الدلو. يرجّع `{ ok: false }` إذا تجاوز الحدّ.
 * نافذة ثابتة: أبسط من الانزلاقية وكافية لمنع استنزاف التكلفة.
 */
export const consume = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, { key, limit, windowMs }) => {
    const now = Date.now();
    const row = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!row || now - row.windowStart >= windowMs) {
      if (row) await ctx.db.patch(row._id, { count: 1, windowStart: now });
      else await ctx.db.insert("rateLimits", { key, count: 1, windowStart: now });
      return { ok: true as const, remaining: limit - 1 };
    }

    if (row.count >= limit) {
      return {
        ok: false as const,
        retryAfterMs: row.windowStart + windowMs - now,
      };
    }

    await ctx.db.patch(row._id, { count: row.count + 1 });
    return { ok: true as const, remaining: limit - row.count - 1 };
  },
});
