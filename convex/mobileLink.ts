/**
 * @file convex/mobileLink.ts
 * @description ربط هاتف المشترك باشتراكه بكود من الأخصائية — لتسجيل إشعارات الجوال.
 *
 * لماذا كود لا رقم الهاتف: من يكتب رقم مشترك آخر كان سيستقبل تنبيهات توصيله ورابط تتبّع
 * السائق. الكود يصل للمشترك الحقيقي وحده (واتساب الأخصائية)، ولا يُخزَّن إلا هاشه.
 */
import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireStaff, createSession } from "./sessions";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // بلا 0/O/1/I/L لتفادي اللبس عند الكتابة
const CODE_LEN = 8; // 31^8 ≈ 8.5×10^11 احتمال
const CODE_TTL_MS = 72 * 60 * 60 * 1000;
const BAD_CODE = "الكود غير صحيح أو انتهت صلاحيته. اطلب كوداً جديداً من الأخصائية.";

function newCode(): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length); // رفض البايتات الزائدة: توزيع متساوٍ بلا انحياز
  while (out.length < CODE_LEN) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    for (const b of buf) if (b < limit && out.length < CODE_LEN) out.push(ALPHABET[b % ALPHABET.length]);
  }
  return out.join("");
}

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const normalizeLinkCode = (code: string) => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** الأخصائية/الطاقم: كود جديد للمشترك (يلغي أي كود سابق لم يُستخدم). يُعرض مرة واحدة. */
export const createCode = mutation({
  args: { customerId: v.id("customers"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { customerId, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const customer: any = await ctx.db.get(customerId);
    if (!customer) throw new ConvexError("المشترك غير موجود.");
    const old = await ctx.db.query("subscriberLinkCodes").withIndex("by_customerId", (q) => q.eq("customerId", customerId)).collect();
    for (const o of old) if (!o.usedAt) await ctx.db.delete(o._id);
    const code = newCode();
    const now = Date.now();
    await ctx.db.insert("subscriberLinkCodes", {
      customerId, codeHash: await sha256(code), createdAt: now, expiresAt: now + CODE_TTL_MS,
      createdBy: (staff.userId as any) || undefined,
    });
    return { code, expiresAt: now + CODE_TTL_MS, fullName: String(customer.fullName || ""), phone: String(customer.phone || "") };
  },
});

/** التطبيق: يستبدل الكود بجلسة «مشترك مربوط» لهذا المشترك. نفس الرسالة لكل فشل حتى لا تُسهّل التخمين. */
export const redeem = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const c = normalizeLinkCode(code);
    if (c.length !== CODE_LEN) throw new ConvexError(BAD_CODE);
    const hash = await sha256(c);
    const row = await ctx.db.query("subscriberLinkCodes").withIndex("by_codeHash", (q) => q.eq("codeHash", hash)).first();
    if (!row || row.usedAt || row.expiresAt < Date.now()) throw new ConvexError(BAD_CODE);
    const customer: any = await ctx.db.get(row.customerId);
    if (!customer) throw new ConvexError(BAD_CODE);
    await ctx.db.patch(row._id, { usedAt: Date.now() });
    const token = await createSession(ctx, { accountType: "subscriber", customerId: row.customerId });
    return { token, customerId: row.customerId, fullName: String(customer.fullName || "") };
  },
});
