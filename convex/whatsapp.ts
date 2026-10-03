/**
 * @file convex/whatsapp.ts
 * @description محرّك رسائل واتساب التلقائية (WhatsApp Cloud API) لصفحة «متابعة العملاء».
 *
 * لا يغيّر شيئاً في الاشتراكات أو الخطط — يقرأ تاريخ انتهاء الاشتراك وحالات فشل
 * التوصيل فقط، ثم يرسل قالباً معتمداً من Meta.
 *
 * لماذا قوالب لا نصّ حر: واتساب لا يسمح للنشاط أن يبدأ محادثة إلا بقالب معتمد
 * (Utility). النصوص في إعدادات الصفحة للعرض والمراجعة؛ ما يُرسَل فعلاً هو القالب
 * بالاسم أدناه ومتغيّراته {{1}} {{2}} {{3}}.
 *
 * الأمان: التوكن في متغيرات بيئة Convex فقط (WHATSAPP_ACCESS_TOKEN,
 * WHATSAPP_PHONE_NUMBER_ID) — لا يُخزَّن في القاعدة ولا يصل للواجهة.
 */
import { action, internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./sessions";

/** أسماء القوالب في WhatsApp Manager — تُغيَّر من البيئة إن سُمّيت بغير ذلك. */
export const TEMPLATES = {
  renewal: () => process.env.WHATSAPP_TEMPLATE_RENEWAL || "subscription_renewal_reminder",
  expired: () => process.env.WHATSAPP_TEMPLATE_EXPIRED || "subscription_expired_notice",
  delivery: () => process.env.WHATSAPP_TEMPLATE_DELIVERY || "delivery_failed_notice",
};

/** الحساب غير الموثَّق عند Meta محدود بـ250 مستلماً مختلفاً كل 24 ساعة. */
const DAILY_CAP = 250;
/** في الوضع التجريبي كل الرسائل تذهب لرقم التجربة، فيكفي عدد قليل لمراجعة الشكل. */
const TEST_CAP = 5;
/** لا رسائل للعملاء خارج هذه الساعات (توقيت قطر). */
const QUIET_FROM = 21, QUIET_UNTIL = 8;

export const isConnected = () =>
  Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

const qatarNow = (now = Date.now()) => new Date(now + 3 * 3600 * 1000);
const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const shiftISO = (iso: string, days: number) =>
  isoOf(new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000));

/** رقم واتساب دولي بلا «+»: 8 أرقام قطرية تُسبَق بـ974. */
export function waPhone(value: unknown): string {
  const d = String(value || "").replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/\D/g, "").replace(/^00/, "");
  if (d.length === 8) return `974${d}`;
  return d.length >= 10 && d.length <= 15 ? d : "";
}
const localPhone = (value: unknown) => {
  const d = waPhone(value);
  return d.startsWith("974") && d.length === 11 ? d.slice(3) : d;
};

async function settingsOf(ctx: any) {
  return await ctx.db.query("messageAutomationSettings")
    .withIndex("by_channel", (q: any) => q.eq("channel", "WHATSAPP")).first();
}

/** رقم الأخصائية الذي يظهر في الرسالة — من إعدادات المطعم. */
async function contactPhone(ctx: any): Promise<string> {
  const rs: any = await ctx.db.query("restaurantSettings").first();
  const d = waPhone(rs?.whatsappNumber);
  return d ? `+${d}` : "";
}

type Job = {
  dedupeKey: string; eventKey: string; customerId?: any; customerName: string;
  phone: string; template: string; params: string[]; language: string;
};

/**
 * يسجّل الرسالة في السجل ويجدول إرسالها — مرة واحدة فقط لكل dedupeKey.
 * في الوضع التجريبي تذهب لرقم التجربة بمفتاح مستقل، فلا تمنع الإرسال الحقيقي لاحقاً.
 */
async function enqueue(ctx: any, s: any, job: Job, today: string): Promise<boolean> {
  const test = Boolean(s.testMode);
  const key = test ? `test:${today}:${job.dedupeKey}` : job.dedupeKey;
  const existing = await ctx.db.query("messageAutomationLogs")
    .withIndex("by_dedupe", (q: any) => q.eq("dedupeKey", key)).first();
  if (existing) return false;

  const to = test ? waPhone(s.testPhone) : waPhone(job.phone);
  const base = {
    customerId: job.customerId, customerName: job.customerName, phone: job.phone,
    eventKey: job.eventKey, language: job.language, dedupeKey: key,
    templateName: job.template, templateParams: job.params, createdAt: Date.now(),
  };
  if (!to) {
    // تجريبي بلا رقم تجربة = محاكاة فقط؛ حقيقي برقم غير صالح = تخطٍّ مسجَّل.
    await ctx.db.insert("messageAutomationLogs", {
      ...base, status: test ? "SIMULATED" : "SKIPPED",
      error: test ? undefined : "رقم هاتف غير صالح",
    });
    return false;
  }
  const logId = await ctx.db.insert("messageAutomationLogs", { ...base, status: "QUEUED", sentTo: to });
  await ctx.scheduler.runAfter(0, internal.whatsapp.sendOne, { logId });
  return true;
}

/**
 * نبضة كل ساعة. التجديدات مرة واحدة يومياً عند ساعة الإرسال؛ فشل التوصيل في كل
 * نبضة داخل ساعات النهار (يحدث بعد ساعة الإرسال غالباً). كل شيء محميّ ضد التكرار.
 */
export const tick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const s: any = await settingsOf(ctx);
    if (!s || !s.enabled) return { skipped: "disabled" };
    if (!isConnected()) return { skipped: "not_connected" };

    const q = qatarNow();
    const today = isoOf(q), hour = q.getUTCHours();
    if (hour >= QUIET_FROM || hour < QUIET_UNTIL) return { skipped: "quiet_hours" };

    const cap = s.testMode ? TEST_CAP : DAILY_CAP;
    const contact = await contactPhone(ctx);
    let queued = 0;

    if (hour >= s.sendHour && s.lastRenewalRunDate !== today) {
      const events: Array<{ on: boolean; key: string; offset: number; template: string; activeOnly: boolean }> = [
        { on: s.renewal7Enabled, key: "RENEWAL_7_DAYS", offset: 7, template: TEMPLATES.renewal(), activeOnly: true },
        { on: s.renewal3Enabled, key: "RENEWAL_3_DAYS", offset: 3, template: TEMPLATES.renewal(), activeOnly: true },
        { on: s.expiryDayEnabled, key: "EXPIRY_DAY", offset: 0, template: TEMPLATES.renewal(), activeOnly: true },
        { on: s.expired2Enabled, key: "EXPIRED_2_DAYS", offset: -2, template: TEMPLATES.expired(), activeOnly: false },
      ];
      const wanted = new Map(events.filter((e) => e.on).map((e) => [shiftISO(today, e.offset), e]));
      if (wanted.size) {
        // الجدول صغير (مئات) ويُقرأ كاملاً في workspace أيضاً؛ لا فهرس على endDate.
        const customers = await ctx.db.query("customers").collect();
        for (const c of customers as any[]) {
          if (queued >= cap) break;
          const e = wanted.get(String(c.endDate || "").slice(0, 10));
          if (!e) continue;
          if (String(c.restaurantKey || "ADRENALINE") !== "ADRENALINE") continue;
          if (e.activeOnly && !c.isActive) continue;
          if (c.pausedFrom) continue; // المجمَّد لا يُذكَّر بالتجديد
          const ok = await enqueue(ctx, s, {
            dedupeKey: `${e.key}:${c._id}:${c.endDate}`, eventKey: e.key,
            customerId: c._id, customerName: c.fullName, phone: c.phone,
            template: e.template, language: "ar",
            params: [c.fullName, String(c.endDate), contact],
          }, today);
          if (ok) queued++;
        }
      }
      await ctx.db.patch(s._id, { lastRenewalRunDate: today });
    }

    if (s.deliveryFailureEnabled) {
      for (const date of [today, shiftISO(today, -1)]) {
        const plans = await ctx.db.query("dailyPlans").withIndex("by_date", (x: any) => x.eq("date", date)).collect();
        for (const p of plans as any[]) {
          if (queued >= cap) break;
          if (!p.failedAt || !p.customerId) continue;
          const c: any = await ctx.db.get(p.customerId);
          if (!c) continue;
          const ok = await enqueue(ctx, s, {
            dedupeKey: `DELIVERY_FAILURE:${p._id}`, eventKey: "DELIVERY_FAILURE",
            customerId: c._id, customerName: c.fullName, phone: c.phone,
            template: TEMPLATES.delivery(), language: "ar",
            params: [c.fullName, contact],
          }, today);
          if (ok) queued++;
        }
      }
    }
    return { queued, testMode: Boolean(s.testMode) };
  },
});

export const jobFor = internalQuery({
  args: { logId: v.id("messageAutomationLogs") },
  handler: async (ctx, { logId }) => {
    const log: any = await ctx.db.get(logId);
    if (!log || log.status !== "QUEUED" || !log.sentTo) return null;
    return {
      to: log.sentTo as string, template: log.templateName as string | undefined,
      language: log.language as string, params: (log.templateParams || []) as string[],
      text: log.freeText as string | undefined,
    };
  },
});

export const markResult = internalMutation({
  args: { logId: v.id("messageAutomationLogs"), ok: v.boolean(), providerMessageId: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.logId, a.ok
      ? { status: "SENT", providerMessageId: a.providerMessageId, sentAt: Date.now(), deliveryStatus: "sent" }
      : { status: "FAILED", error: (a.error || "فشل غير معروف").slice(0, 300) });
  },
});

/** يرسل رسالة واحدة عبر Graph API ويسجّل النتيجة. لا يُعاد تلقائياً عند الفشل. */
export const sendOne = internalAction({
  args: { logId: v.id("messageAutomationLogs") },
  handler: async (ctx, { logId }): Promise<void> => {
    const job: { to: string; template?: string; language: string; params: string[]; text?: string } | null =
      await ctx.runQuery(internal.whatsapp.jobFor, { logId });
    if (!job) return;
    const token = process.env.WHATSAPP_ACCESS_TOKEN, numberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !numberId) {
      await ctx.runMutation(internal.whatsapp.markResult, { logId, ok: false, error: "واتساب غير متصل (لا يوجد توكن)" });
      return;
    }
    const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
    const message = job.text
      ? { type: "text", text: { body: job.text } }
      : {
        type: "template",
        template: {
          name: job.template, language: { code: job.language },
          components: job.params.length
            ? [{ type: "body", parameters: job.params.map((text) => ({ type: "text", text })) }]
            : [],
        },
      };
    try {
      const res = await fetch(`https://graph.facebook.com/${version}/${numberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: job.to, ...message }),
      });
      const data: any = await res.json().catch(() => ({}));
      const id = data?.messages?.[0]?.id;
      if (res.ok && id) await ctx.runMutation(internal.whatsapp.markResult, { logId, ok: true, providerMessageId: String(id) });
      else {
        const e = data?.error;
        await ctx.runMutation(internal.whatsapp.markResult, {
          logId, ok: false,
          error: e ? `${e.code ?? res.status}: ${e.error_data?.details || e.message || "خطأ من Meta"}` : `HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      await ctx.runMutation(internal.whatsapp.markResult, { logId, ok: false, error: `تعذّر الاتصال: ${String(err?.message || err)}` });
    }
  },
});

/**
 * رسالة تجربة لرقم التجربة فقط — لا تصل لأي عميل.
 * hello_world قالب جاهز من Meta (بالإنجليزية) يعمل قبل اعتماد قوالبنا.
 */
export const sendTest = mutation({
  args: { kind: v.union(v.literal("hello_world"), v.literal("renewal"), v.literal("delivery")), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    if (!isConnected()) throw new ConvexError("واتساب غير متصل — أضف التوكن ورقم الخط في إعدادات Convex أولاً");
    const s: any = await settingsOf(ctx);
    const to = waPhone(s?.testPhone);
    if (!to) throw new ConvexError("اكتب رقم التجربة واحفظ الإعدادات أولاً");
    const contact = await contactPhone(ctx);
    const today = isoOf(qatarNow());
    const sample = {
      hello_world: { template: "hello_world", language: "en_US", params: [] as string[] },
      renewal: { template: TEMPLATES.renewal(), language: "ar", params: ["عميل تجريبي", shiftISO(today, 7), contact] },
      delivery: { template: TEMPLATES.delivery(), language: "ar", params: ["عميل تجريبي", contact] },
    }[args.kind];
    const logId = await ctx.db.insert("messageAutomationLogs", {
      customerName: "رسالة تجربة", phone: String(s.testPhone), eventKey: `TEST_${args.kind.toUpperCase()}`,
      language: sample.language, status: "QUEUED", sentTo: to,
      templateName: sample.template, templateParams: sample.params, createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.whatsapp.sendOne, { logId });
    return logId;
  },
});

/** تحديث حالة التسليم من Webhook (sent → delivered → read / failed). */
export const recordStatus = internalMutation({
  args: { providerMessageId: v.string(), status: v.string(), error: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const log: any = await ctx.db.query("messageAutomationLogs")
      .withIndex("by_provider", (q: any) => q.eq("providerMessageId", a.providerMessageId)).first();
    if (!log) return;
    const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };
    if ((rank[a.status] || 0) <= (rank[log.deliveryStatus] || 0)) return; // الأحداث تصل بلا ترتيب
    await ctx.db.patch(log._id, a.status === "failed"
      ? { deliveryStatus: "failed", status: "FAILED", error: (a.error || "فشل التسليم").slice(0, 300) }
      : { deliveryStatus: a.status });
  },
});

/**
 * عميل ردّ على رقم الإشعارات: نفتح متابعة للفريق، ونردّ مرة واحدة يومياً برقم
 * الأخصائية (الردّ داخل نافذة 24 ساعة نصٌّ حر مسموح بلا قالب).
 */
export const recordInbound = internalMutation({
  args: { from: v.string(), text: v.string() },
  handler: async (ctx, a) => {
    const to = waPhone(a.from);
    if (!to) return;
    const today = isoOf(qatarNow());
    const key = `inbound:${to}:${today}`;
    const seen = await ctx.db.query("messageAutomationLogs")
      .withIndex("by_dedupe", (q: any) => q.eq("dedupeKey", key)).first();
    if (seen) return;

    const local = localPhone(to);
    const customer: any = (await ctx.db.query("customers").collect())
      .find((c: any) => localPhone(c.phone) === local);
    if (customer) {
      await ctx.db.insert("customerFollowUps", {
        customerId: customer._id, type: "GENERAL", status: "OPEN",
        note: `ردّ على رسالة واتساب التلقائية: ${a.text.slice(0, 400) || "(رسالة بلا نص)"}`,
        createdAt: Date.now(),
      });
    }
    const contact = await contactPhone(ctx);
    const logId = await ctx.db.insert("messageAutomationLogs", {
      customerId: customer?._id, customerName: customer?.fullName || `+${to}`, phone: `+${to}`,
      eventKey: "INBOUND_REPLY", language: "ar", status: "QUEUED", dedupeKey: key, sentTo: to,
      freeText: `شكراً لتواصلك مع Adrenaline Healthy Food 🌿\nهذا الرقم للإشعارات فقط.${contact ? `\nللتواصل مع الأخصائية على واتساب: ${contact}` : ""}`,
      createdAt: Date.now(),
    });
    if (isConnected()) await ctx.scheduler.runAfter(0, internal.whatsapp.sendOne, { logId });
  },
});

/** فحص صلاحية المدير من داخل action (الـaction لا يقرأ القاعدة مباشرة). */
export const assertAdmin = internalQuery({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => { await requireAdmin(ctx, args.sessionToken); return true; },
});

const graphError = (data: any, status: number) => {
  const e = data?.error;
  return e
    ? { code: e.code ?? status, subcode: e.error_subcode, message: String(e.error_data?.details || e.error_user_msg || e.message || ""), trace: e.fbtrace_id }
    : { code: status, message: `HTTP ${status}` };
};

/**
 * حالة رقم الإرسال عند Meta كما هي (اسم العرض، التحقق، التسجيل، الجودة) —
 * لتشخيص «لماذا لا يُرسِل» من الصفحة بدل التخمين.
 */
export const numberStatus = action({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args): Promise<any> => {
    await ctx.runQuery(internal.whatsapp.assertAdmin, { sessionToken: args.sessionToken });
    const token = process.env.WHATSAPP_ACCESS_TOKEN, numberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !numberId) return { ok: false, error: { code: 0, message: "واتساب غير متصل — أضف التوكن ورقم الخط في إعدادات Convex" } };
    const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
    const fields = "display_phone_number,verified_name,name_status,code_verification_status,status,quality_rating,platform_type,account_mode";
    const res = await fetch(`https://graph.facebook.com/${version}/${numberId}?fields=${fields}`, { headers: { Authorization: `Bearer ${token}` } });
    const data: any = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, info: data } : { ok: false, error: graphError(data, res.status) };
  },
});

/**
 * تسجيل الرقم على Cloud API برقم سرّي (PIN) يكتبه المدير في الصفحة. لوحة Meta
 * تُظهر «Registration failed» بلا سبب؛ هذا الطلب المباشر يعيد كود الخطأ الحقيقي.
 * الـPIN لا يُخزَّن ولا يُسجَّل.
 */
export const registerNumber = action({
  args: { pin: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args): Promise<any> => {
    await ctx.runQuery(internal.whatsapp.assertAdmin, { sessionToken: args.sessionToken });
    if (!/^\d{6}$/.test(args.pin)) return { ok: false, error: { code: 0, message: "الرقم السرّي ستة أرقام إنجليزية" } };
    const token = process.env.WHATSAPP_ACCESS_TOKEN, numberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !numberId) return { ok: false, error: { code: 0, message: "واتساب غير متصل — أضف التوكن ورقم الخط في إعدادات Convex" } };
    const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
    const res = await fetch(`https://graph.facebook.com/${version}/${numberId}/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin: args.pin }),
    });
    const data: any = await res.json().catch(() => ({}));
    return res.ok && data?.success ? { ok: true } : { ok: false, error: graphError(data, res.status) };
  },
});
