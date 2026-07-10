/**
 * @file convex/resetTestData.ts
 * @description تصفير بيانات التجربة قبل التشغيل الفعلي.
 *
 * يمسح: الطلبات وأصنافها، خطط المطبخ، الإشعارات، حصر الصادر،
 *        الطلبات الأونلاين، حركات المخزون ودفعاته (ويصفّر الأرصدة).
 *
 * لا يمسح: المشتركين، حسابات العملاء، الموظفين، المنيو والوجبات،
 *          الباقات، أصناف المخزون نفسها، الموردين، الرواتب، الحضور.
 *
 * 🔒 حمايتان معاً — عملية لا رجعة فيها:
 *    1. جلسة مدير (requireAdmin)، أو مفتاح الطوارئ ALLOW_DESTRUCTIVE=true
 *    2. لا تنفّذ شيئاً إلا إذا أُرسل confirm="RESET" حرفياً
 *
 * وضع المعاينة (dryRun) يرجّع الأعداد دون حذف أي شيء.
 */
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./sessions";

/** الجداول التي تُفرَّغ بالكامل. */
const WIPE = [
  "customerOrderItems",
  "customerOrders",
  "dailyPlans",
  "notifications",
  "mealIssuances",
  "onlineOrders",
  "inventoryMovements",
  "inventoryBatches",
] as const;

export const resetOperationalData = mutation({
  args: {
    /** يجب أن تساوي "RESET" حرفياً، وإلا لا يحدث شيء. */
    confirm: v.string(),
    /** true = عدّ فقط بلا حذف. */
    dryRun: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (process.env.ALLOW_DESTRUCTIVE !== "true") {
      await requireAdmin(ctx, args.sessionToken);
    }
    if (args.confirm !== "RESET") {
      throw new Error('التأكيد مطلوب: أرسل confirm="RESET"');
    }

    const counts: Record<string, number> = {};

    for (const table of WIPE) {
      const rows = await ctx.db.query(table as any).collect();
      counts[table] = rows.length;
      if (!args.dryRun) {
        for (const r of rows) await ctx.db.delete(r._id);
      }
    }

    // بعد مسح الدفعات لا يوجد ما يفسّر أي رصيد ⇒ الحالة المتّسقة هي صفر.
    const items = await ctx.db.query("inventoryItems").collect();
    counts["inventoryItems.currentStock -> 0"] = items.filter((i) => i.currentStock !== 0).length;
    if (!args.dryRun) {
      for (const it of items) {
        if (it.currentStock !== 0) await ctx.db.patch(it._id, { currentStock: 0 });
      }
    }

    return { dryRun: Boolean(args.dryRun), counts };
  },
});
