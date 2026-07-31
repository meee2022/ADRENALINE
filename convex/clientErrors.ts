// convex/clientErrors.ts
// تسجيل انهيارات الواجهة. بلا sessionToken عمداً: الانهيار كثيراً ما يقع
// قبل توفّر الجلسة أو بسببها، والتسجيل يجب ألا يفشل وقتها.
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";
import { v } from "convex/values";

const cap = (s: string, n: number) => String(s || "").slice(0, n);

export const report = mutation({
  args: {
    refCode: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    path: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    /* 🔒 طفرة مفتوحة بلا تسجيل دخول — وهي كذلك بالضرورة: الخطأ قد يقع قبل
       الدخول أصلاً. لكنها تكتب في القاعدة، فكان بالإمكان إغراقها بملايين
       الصفوف من الخارج. نافذة الدقيقة تكفي أعطال المستخدم الحقيقي (يقع خطأ
       أو خطآن) وتوقف الإغراق عند الستين. الفشل صامت — لا نُظهر للمستخدم
       خطأً وهو أصلاً يبلّغ عن خطأ. */
    const WINDOW_MS = 60 * 1000;
    const CAP = 60;
    const now = Date.now();
    const bucket: any = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q: any) => q.eq("key", "clientErrors.report"))
      .first();
    if (!bucket) {
      await ctx.db.insert("rateLimits", { key: "clientErrors.report", count: 1, windowStart: now });
    } else if (now - bucket.windowStart > WINDOW_MS) {
      await ctx.db.patch(bucket._id, { count: 1, windowStart: now });
    } else if (bucket.count >= CAP) {
      return true;   // نتجاهل بصمت بدل رفضٍ يربك المستخدم
    } else {
      await ctx.db.patch(bucket._id, { count: bucket.count + 1 });
    }

    await ctx.db.insert("clientErrors", {
      refCode: cap(args.refCode, 40),
      message: cap(args.message, 1000),
      stack: args.stack ? cap(args.stack, 4000) : undefined,
      path: args.path ? cap(args.path, 300) : undefined,
      userAgent: args.userAgent ? cap(args.userAgent, 300) : undefined,
      userName: args.userName ? cap(args.userName, 120) : undefined,
      at: Date.now(),
    });
    return true;
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.db
      .query("clientErrors")
      .withIndex("by_at")
      .order("desc")
      .take(Math.min(Number(args.limit) || 50, 200));
  },
});
