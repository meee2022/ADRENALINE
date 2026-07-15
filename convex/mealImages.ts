/**
 * @file convex/mealImages.ts
 * @description ربط صورة مرفوعة (storageId) بوجبة عامة — مؤمّن ضد ملفات
 *   بغير النوع/الحجم المتوقّع، ويحذف الصورة القديمة عند الاستبدال (منع orphans).
 */
import { mutation } from "./_generated/server";
import { requireAdmin } from "./sessions";
import { v } from "convex/values";

// 🔒 حدود ملف صورة الوجبة
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export const setImage = mutation({
  args: { id: v.id("publicMeals"), storageId: v.id("_storage"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, storageId, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);

    // 🔒 تحقق النوع والحجم بعد الرفع (Convex ما بيمنعش في upload URL نفسه)
    const meta = await ctx.db.system.get(storageId);
    if (meta) {
      const contentType = String((meta as any).contentType || "").toLowerCase();
      const size = Number((meta as any).size || 0);
      if (contentType && !ALLOWED_IMAGE_MIMES.has(contentType)) {
        // احذف الملف المرفوض حتى لا يتراكم
        try { await ctx.storage.delete(storageId); } catch { /* ignore */ }
        throw new Error(`نوع الصورة غير مسموح (${contentType || "غير معروف"}) — اسمح فقط JPG/PNG/WebP/GIF`);
      }
      if (size > MAX_IMAGE_BYTES) {
        try { await ctx.storage.delete(storageId); } catch { /* ignore */ }
        throw new Error(`حجم الصورة أكبر من الحد المسموح (${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB)`);
      }
    }

    // 🔒 امسح الصورة القديمة قبل الاستبدال (منع orphan storage blobs)
    const existing: any = await ctx.db.get(id);
    if (existing?.storageId && String(existing.storageId) !== String(storageId)) {
      try { await ctx.storage.delete(existing.storageId); } catch { /* ignore */ }
    }

    await ctx.db.patch(id, { storageId });
    return id;
  },
});
