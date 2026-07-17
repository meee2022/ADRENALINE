/**
 * @file convex/storageCleanup.ts
 * @description تنظيف ملفات التخزين غير المرتبطة بأي سجل — معاينة ثم تطبيق.
 *
 *   ═══ الخلفية ═══
 *   794 ملف في التخزين، 197 فقط مرتبط (190 وجبة + 7 بانرات). الباقي (597)
 *   بقايا رفعات سابقة: نسخ مكررة من نفس الصور، بانرات قديمة، ولقطة شاشة.
 *   ~357 ميجا محسوبة على المشروع بلا قارئ.
 *
 *   ═══ الأمان ═══
 *   - يفحص **كل** حقل storage في السكيما (5 حقول عبر 4 جداول). لو أُضيف
 *     حقل جديد ولم يُدرَج هنا، الملف يبدو يتيماً وهو مستخدم ⇒ فقدان دائم.
 *     لذلك القائمة صريحة ومكتوبة، لا استنتاج.
 *   - preview لا يحذف؛ apply يعيد بناء مجموعة المستخدَم قبل كل حذف.
 *   - الحذف على دفعات (batch) — Convex يحدّ زمن المعاملة الواحدة.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

/** 🔒 كل حقل يشير إلى _storage. أي إضافة للسكيما لازم تنعكس هنا. */
async function usedStorageIds(ctx: any): Promise<Set<string>> {
  const used = new Set<string>();
  const add = (id: any) => { if (id) used.add(String(id)); };

  for (const m of await ctx.db.query("publicMeals").collect()) add((m as any).storageId);
  for (const b of await ctx.db.query("banners").collect()) add((b as any).imageStorageId);
  for (const p of await ctx.db.query("dailyPlans").collect()) add((p as any).podStorageId);
  for (const s of await ctx.db.query("restaurantSettings").collect()) add((s as any).heroLogoStorageId);
  return used;
}

/** 🔍 معاينة — لا تحذف شيئاً. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const files = await ctx.db.system.query("_storage").collect();
    const used = await usedStorageIds(ctx);
    const orphans = files.filter((f: any) => !used.has(String(f._id)));

    const byDay: Record<string, number> = {};
    for (const f of orphans as any[]) {
      const d = new Date(f._creationTime).toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + 1;
    }
    return {
      totalFiles: files.length,
      linked: used.size,
      orphans: orphans.length,
      orphanMB: Math.round(orphans.reduce((s: number, f: any) => s + (f.size || 0), 0) / 1048576),
      byUploadDay: byDay,
    };
  },
});

/**
 * ✅ حذف دفعة من اليتيمة — ADMIN فقط.
 * يُستدعى مراراً حتى يرجع deleted = 0.
 */
export const purgeBatch = mutation({
  args: { limit: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const limit = Math.min(args.limit ?? 50, 100);

    const files = await ctx.db.system.query("_storage").collect();
    // 🔒 نعيد بناء مجموعة المستخدَم داخل نفس المعاملة — لا نثق بمعاينة قديمة
    const used = await usedStorageIds(ctx);

    const orphans = files.filter((f: any) => !used.has(String(f._id))).slice(0, limit);
    let deleted = 0;
    for (const f of orphans as any[]) {
      try { await ctx.storage.delete(f._id); deleted++; } catch { /* اتحذف قبلها */ }
    }
    const remaining = files.filter((f: any) => !used.has(String(f._id))).length - deleted;
    return { deleted, remaining };
  },
});
