/**
 * @file convex/passwordReset.ts
 * @description استعادة كلمة المرور عبر كود لمرة واحدة (OTP) يُرسل بالإيميل (Resend).
 *   - requestReset (action): يولّد كود، يخزّن هاشه، ويرسله بالإيميل.
 *   - verifyAndReset (mutation): يتحقق من الكود ويعيّن كلمة مرور جديدة.
 * التفعيل: ضع RESEND_API_KEY (واختيارياً RESET_FROM_EMAIL) في متغيّرات Convex:
 *   npx convex env set RESEND_API_KEY re_xxx
 *   npx convex env set RESET_FROM_EMAIL "Adrenaline <noreply@yourdomain.com>"
 */
import { v } from "convex/values";
import { action, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { hashPassword } from "./passwords";
import { findAccountByEmail } from "./accountLookup";
import { destroyAllSessionsFor } from "./sessions";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 دقائق
const MAX_ATTEMPTS = 5;

// 🔒 حد إرسال الأكواد: 3 طلبات لكل بريد كل 15 دقيقة — يمنع flooding + تعطيل الحساب
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;

const normEmail = (e: string) => String(e || "").trim().toLowerCase();

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function gen6(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, "0");
}

/** داخلي: يتحقق من وجود الحساب، يولّد كوداً ويخزّن هاشه. يرجّع الكود للـaction فقط.
 *  🔒 محمي بـrate limit لكل بريد. لو تجاوز الحد، يرجع rateLimited=true
 *     بدلاً من كشف السبب للمهاجم في الاستجابة العامة. */
export const createCode = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normEmail(args.email);
    const now = Date.now();
    const cutoff = now - REQUEST_WINDOW_MS;

    // 🔒 rate limit: عدّ الطلبات لهذا البريد في النافذة الأخيرة (نظّف القديم كذلك)
    const past = await ctx.db.query("passwordResetRequests").withIndex("by_email", (q) => q.eq("email", email)).collect();
    let recentCount = 0;
    for (const r of past) {
      if (r.at < cutoff) await ctx.db.delete(r._id);
      else recentCount++;
    }
    if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
      return { ok: false as const, rateLimited: true as const };
    }
    // نسجّل الطلب بغضّ النظر عن وجود الحساب (يمنع enumeration attack عبر توقيت الرد)
    await ctx.db.insert("passwordResetRequests", { email, at: now });

    // نفس ترتيب تسجيل الدخول: موظف أولاً ثم عميل
    const found = await findAccountByEmail(ctx, args.email);
    if (!found) return { ok: false as const };

    // احذف أي أكواد سابقة لنفس البريد
    const old = await ctx.db.query("passwordResetCodes").withIndex("by_email", (q) => q.eq("email", email)).collect();
    for (const o of old) await ctx.db.delete(o._id);

    const code = gen6();
    await ctx.db.insert("passwordResetCodes", {
      email,
      codeHash: await sha256(code),
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      createdAt: now,
    });
    return { ok: true as const, code };
  },
});

/** إرسال كود الاستعادة بالإيميل. يرجّع رسالة عامة دائماً (لمنع كشف وجود البريد).
 *  🔒 لا يُرجع الكود في الاستجابة أبداً — حتى لو مزود البريد غير مُهيّأ.
 *     إذا مفتاح Resend غير موجود، الكود يُنشأ لكن مايتبعتش (يُسجَّل في server log
 *     للأدمن). الاستجابة تبقى موحّدة عشان تمنع enumeration + هجوم عبر التوقيت. */
export const requestReset = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const res = await ctx.runMutation(internal.passwordReset.createCode, { email: args.email });
    // رسالة عامة موحّدة سواء وُجد الحساب أم لا أو حتى لو الـrate limit اتضرب
    if (!res.ok) return { success: true };

    const email = normEmail(args.email);
    const code = res.code;
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESET_FROM_EMAIL || "Adrenaline <onboarding@resend.dev>";

    if (!key) {
      // 🔒 لا مزود بريد — لا نُرجع الكود مطلقاً. نسجّله في السيرفر فقط.
      //    (الحدث ده لا يجب أن يحدث في production — يعني الأدمن نسي إعداد Resend.)
      console.error("[passwordReset] RESEND_API_KEY missing — code NOT sent for", email);
      return { success: true };
    }

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "كود استعادة كلمة المرور — Adrenaline",
          html: `<div style="font-family:Cairo,Arial,sans-serif;direction:rtl;text-align:right;max-width:480px;margin:auto">
            <h2 style="color:#0E2A4A">استعادة كلمة المرور</h2>
            <p>كود التحقق الخاص بك هو:</p>
            <div style="font-size:32px;font-weight:900;letter-spacing:6px;color:#0E76AC;background:#EAF3FB;border-radius:12px;padding:16px;text-align:center">${code}</div>
            <p style="color:#47759C;font-size:13px">الكود صالح لمدة 10 دقائق. إذا لم تطلب الاستعادة تجاهل هذه الرسالة.</p>
            <p style="color:#94a3b8;font-size:12px">Adrenaline Healthy Food</p>
          </div>`,
        }),
      });
      if (!r.ok) console.error("Resend error:", r.status, await r.text());
    } catch (e) {
      console.error("Resend send failed:", e);
    }
    return { success: true };
  },
});

/** التحقق من الكود وتعيين كلمة مرور جديدة. */
export const verifyAndReset = mutation({
  args: { email: v.string(), code: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 8) {
      return { success: false, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };
    }
    const email = normEmail(args.email);
    const record = await ctx.db.query("passwordResetCodes").withIndex("by_email", (q) => q.eq("email", email)).first();
    if (!record) return { success: false, error: "لا يوجد طلب استعادة — اطلب كوداً جديداً" };
    if (record.expiresAt < Date.now()) {
      await ctx.db.delete(record._id);
      return { success: false, error: "انتهت صلاحية الكود — اطلب كوداً جديداً" };
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      await ctx.db.delete(record._id);
      return { success: false, error: "محاولات كثيرة — اطلب كوداً جديداً" };
    }

    const codeHash = await sha256(String(args.code).trim());
    if (codeHash !== record.codeHash) {
      await ctx.db.patch(record._id, { attempts: record.attempts + 1 });
      return { success: false, error: "الكود غير صحيح" };
    }

    // نفس ترتيب تسجيل الدخول — نُحدّث الحساب الذي سيستخدمه المستخدم فعلاً للدخول
    const found = await findAccountByEmail(ctx, args.email);
    if (!found) {
      await ctx.db.delete(record._id);
      return { success: false, error: "الحساب غير موجود" };
    }

    await ctx.db.patch(found.doc._id, { passwordHash: await hashPassword(args.newPassword), updatedAt: Date.now() });
    await ctx.db.delete(record._id);

    // 🔒 أبطل كل الجلسات القديمة — من سرق توكناً يجب أن يخرج
    const revoked = await destroyAllSessionsFor(
      ctx,
      found.kind === "staff"
        ? { userId: String(found.doc._id) }
        : { customerAccountId: String(found.doc._id) },
    );

    return { success: true, revokedSessions: revoked };
  },
});
