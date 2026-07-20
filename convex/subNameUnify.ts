/**
 * @file convex/subNameUnify.ts
 * @description توحيد أسماء مشتركين مع إكسل 21-7 — بقائمة صريحة مُراجَعة خارجياً.
 *
 *   6 مشتركين أسماؤهم في القاعدة تختلف إملائياً عن الإكسل (نفس الرقم ونفس
 *   التواريخ ⇒ نفس الشخص): Nasser alhussain→NASSER ALHUSSEIN … إلخ. نوحّدها
 *   ليطابق الاسم الرسمي، فتختفي «الزيادة» الوهمية عن الإكسل.
 *
 *   ⚠️ لا نطابق بالخوارزمية هنا — نستقبل أزواج (id, newName) محسوبة ومراجَعة
 *      خارج القاعدة، ونعيد التأكد أن الاسم الحالي هو المتوقّع قبل التغيير.
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

export const apply = mutation({
  args: {
    updates: v.array(v.object({ id: v.string(), fromName: v.string(), toName: v.string() })),
    confirm: v.literal("RENAME"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { updates, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    let updated = 0, skipped = 0;
    const backup: any[] = [];
    for (const u of updates) {
      const c: any = await ctx.db.get(u.id as any);
      const cur = c?.name ?? c?.fullName ?? c?.customerName ?? "";
      // 🔒 نتخطّى لو الاسم الحالي مش المتوقّع (اتغيّر بعد المراجعة)
      if (!c || cur !== u.fromName) { skipped++; continue; }
      backup.push({ id: u.id, was: cur });
      // نكتب على نفس الحقل الموجود
      const field = c.name !== undefined ? "name" : c.fullName !== undefined ? "fullName" : "customerName";
      await ctx.db.patch(u.id as any, { [field]: u.toName } as any);
      updated++;
    }
    return { updated, skipped, backup };
  },
});
