/**
 * @file convex/phoneOtp.ts
 * @description Subscriber sign-in by phone + WhatsApp code (OTP).
 *
 *   Off by default (`messageAutomationSettings.phoneOtpEnabled`): the app and the public
 *   menu keep the old behaviour — type a phone, see the subscription, pick meals.
 *   On: the phone gets a 6-digit code on WhatsApp; a correct code yields a `subscriber`
 *   session token (same kind `mobileLink.redeem` issues) bound to the chosen subscriber.
 *
 *   Deployed but inert until the toggle is switched on from the CRM page.
 */
import { v, ConvexError } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { createSession, validateSession } from "./sessions";
import { normalizePhone } from "./lib/phone";
import { TEMPLATES } from "./whatsapp";

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_SENDS_PER_DAY = 6;
const GENERIC = "لو الرقم مسجّل لدينا فسيصلك كود على واتساب خلال لحظات";

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function gen6(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, "0");
}

async function settings(ctx: any) {
  return await ctx.db.query("messageAutomationSettings")
    .withIndex("by_channel", (q: any) => q.eq("channel", "WHATSAPP")).first();
}

/** Public: lets the app/menu decide whether to ask for a code. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const s: any = await settings(ctx);
    return { enabled: Boolean(s?.phoneOtpEnabled) };
  },
});

/**
 * Step 1 — request a code. Always answers the same sentence so nobody can probe which
 * numbers are subscribers. Rate-limited per phone; the code itself never leaves the server.
 */
export const request = mutation({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const s: any = await settings(ctx);
    if (!s?.phoneOtpEnabled) throw new ConvexError("التحقق بالكود غير مفعّل حالياً");
    const phone = normalizePhone(args.phone);
    if (!phone) throw new ConvexError("أدخل رقم جوال صحيحاً");
    const now = Date.now();

    const prior = await ctx.db.query("phoneOtpCodes").withIndex("by_phone", (q) => q.eq("phone", phone)).collect();
    const latest = prior.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (latest && now - latest.createdAt < RESEND_AFTER_MS) {
      throw new ConvexError("انتظر دقيقة قبل طلب كود جديد");
    }
    const today = prior.filter((r) => now - r.createdAt < 24 * 60 * 60 * 1000).length;
    if (today >= MAX_SENDS_PER_DAY) throw new ConvexError("تجاوزت الحد اليومي لطلب الأكواد — حاول غداً أو تواصل معنا");

    const subscribers = await ctx.db.query("customers").withIndex("by_phone", (q) => q.eq("phone", phone)).collect();
    // Log the attempt even for unknown numbers so the per-phone limits still apply to probing.
    for (const o of prior) if (now - o.createdAt >= 24 * 60 * 60 * 1000) await ctx.db.delete(o._id);
    if (!subscribers.length) {
      await ctx.db.insert("phoneOtpCodes", { phone, codeHash: "", expiresAt: now, attempts: MAX_ATTEMPTS, createdAt: now });
      return { ok: true, message: GENERIC };
    }

    for (const o of prior) { try { await ctx.db.delete(o._id); } catch { /* already gone */ } }
    const code = gen6();
    await ctx.db.insert("phoneOtpCodes", { phone, codeHash: await sha256(code), expiresAt: now + CODE_TTL_MS, attempts: 0, createdAt: now });

    const to = phone.length === 8 ? `974${phone}` : phone;
    const logId = await ctx.db.insert("messageAutomationLogs", {
      customerId: subscribers[0]._id, customerName: subscribers[0].fullName || "", phone,
      eventKey: "PHONE_OTP", language: "ar", status: "QUEUED", sentTo: to,
      templateName: TEMPLATES.otp(), templateParams: ["<code>"], createdAt: now,
    } as any);
    await ctx.scheduler.runAfter(0, internal.phoneOtp.deliver, { logId, code });
    return { ok: true, message: GENERIC };
  },
});

/** Hands the code to the WhatsApp sender without storing it in the log. */
export const deliver = internalMutation({
  args: { logId: v.id("messageAutomationLogs"), code: v.string() },
  handler: async (ctx, { logId, code }) => {
    await ctx.scheduler.runAfter(0, internal.whatsapp.sendOtp, { logId, code });
  },
});

export const logFor = internalQuery({
  args: { logId: v.id("messageAutomationLogs") },
  handler: async (ctx, { logId }) => {
    const l: any = await ctx.db.get(logId);
    return l ? { to: String(l.sentTo || ""), template: String(l.templateName || "") } : null;
  },
});

/**
 * Step 2 — verify. Returns the subscribers on that phone (a family may share one) and a
 * subscriber session token for the chosen one. With several matches the caller verifies
 * once, then calls `choose` with the same code within the TTL.
 */
export const verify = mutation({
  args: { phone: v.string(), code: v.string(), customerId: v.optional(v.id("customers")) },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    const code = String(args.code || "").replace(/\D/g, "");
    if (!phone || code.length !== 6) throw new ConvexError("الكود غير صحيح");
    const rows = await ctx.db.query("phoneOtpCodes").withIndex("by_phone", (q) => q.eq("phone", phone)).collect();
    const row = rows.sort((a, b) => b.createdAt - a.createdAt)[0];
    const now = Date.now();
    if (!row || !row.codeHash || row.expiresAt < now) throw new ConvexError("الكود غير صحيح أو انتهت صلاحيته — اطلب كوداً جديداً");
    if (row.attempts >= MAX_ATTEMPTS) throw new ConvexError("محاولات كثيرة — اطلب كوداً جديداً");
    if (row.codeHash !== await sha256(code)) {
      await ctx.db.patch(row._id, { attempts: row.attempts + 1 });
      const left = MAX_ATTEMPTS - row.attempts - 1;
      throw new ConvexError(left > 0 ? `الكود غير صحيح — متبقٍ ${left} ${left === 1 ? "محاولة" : "محاولات"}` : "الكود غير صحيح — اطلب كوداً جديداً");
    }

    const subscribers = await ctx.db.query("customers").withIndex("by_phone", (q) => q.eq("phone", phone)).collect();
    const list = subscribers.map((c: any) => ({ _id: String(c._id), fullName: c.fullName || "", program: c.program || c.goals || "" }));
    let chosen = subscribers.length === 1 ? subscribers[0] : null;
    if (args.customerId) chosen = subscribers.find((c) => String(c._id) === String(args.customerId)) || null;
    if (!chosen) {
      if (subscribers.length > 1) return { ok: true, needsChoice: true, subscribers: list };
      throw new ConvexError("الرقم غير مرتبط باشتراك");
    }
    // One code = one session; a shared-phone family picks the person first, then the code is spent.
    await ctx.db.delete(row._id);
    const token = await createSession(ctx, { accountType: "subscriber", customerId: chosen._id });
    return { ok: true, needsChoice: false, token, customerId: String(chosen._id), name: chosen.fullName || "", phone };
  },
});

/** Is this subscriber token still valid for that subscriber? Used by the app on launch. */
export const check = query({
  args: { token: v.string(), customerId: v.id("customers") },
  handler: async (ctx, { token, customerId }) => {
    const id = await validateSession(ctx, token);
    return Boolean(id && id.accountType === "subscriber" && String(id.customerId) === String(customerId));
  },
});
