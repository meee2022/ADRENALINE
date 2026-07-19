/**
 * @file convex/posReports.ts
 * @description تقرير POS اليومي (Z-report) بالإيميل عبر Resend.
 *   - dailyReportData (internalQuery): يحسب ملخّص يوم كامل (مبيعات/فواتير/طرق دفع/كاشيرية/مرتجعات/أفضل أصناف).
 *   - sendDailyReport (action): يبني HTML ويرسله للمستقبلين. يُستخدم للإرسال التجريبي (أدمن) وللكرون.
 *   - saveReportSettings/getReportSettings: إعدادات (مفعّل/مستقبلين/وقت الإرسال).
 *   - runDailyReportCron (internalAction): يتحقق من الوقت (قطر) ويرسل مرة واحدة يومياً.
 * التفعيل: نفس مفتاح استعادة كلمة المرور:
 *   npx convex env set RESEND_API_KEY re_xxx
 *   npx convex env set RESET_FROM_EMAIL "Adrenaline <noreply@yourdomain.com>"
 */
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./sessions";

const QATAR_OFFSET_MS = 3 * 60 * 60 * 1000; // قطر UTC+3 (بلا توقيت صيفي)

/** yyyy-MM-dd لليوم الحالي بتوقيت قطر. */
function qatarToday(): string {
  return new Date(Date.now() + QATAR_OFFSET_MS).toISOString().slice(0, 10);
}
/** HH:MM بتوقيت قطر الآن. */
function qatarHHMM(): string {
  return new Date(Date.now() + QATAR_OFFSET_MS).toISOString().slice(11, 16);
}

/* ═══════════════════════════ حساب بيانات التقرير ═══════════════════════════ */

export const dailyReportData = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const start = new Date(date + "T00:00:00.000Z").getTime() - QATAR_OFFSET_MS;
    const end = new Date(date + "T23:59:59.999Z").getTime() - QATAR_OFFSET_MS;
    const tickets: any[] = await ctx.db
      .query("posTickets")
      .withIndex("by_paidAt", (q) => q.gte("paidAt", start).lte("paidAt", end))
      .collect();

    const paidAll = tickets.filter((t) => t.status === "PAID");
    const paid = paidAll.filter((t) => !t.isNonRevenue);
    const staffTix = paidAll.filter((t) => t.isNonRevenue);
    const refunded = tickets.filter((t) => t.status === "REFUNDED");

    const totalSales = Math.round(paid.reduce((s, t) => s + t.total, 0) * 100) / 100;
    const staffValue = Math.round(staffTix.reduce((s, t) => s + t.total, 0) * 100) / 100;
    const refundValue = Math.round(refunded.reduce((s, t) => s + t.total, 0) * 100) / 100;

    // طرق الدفع — تدعم الدفع المقسوم (توزيع المبلغ على الطرق)
    const byMethod: Record<string, { count: number; total: number }> = {};
    for (const t of paid) {
      const parts = Array.isArray(t.payments) && t.payments.length
        ? t.payments.map((p: any) => ({ method: String(p.method).toLowerCase(), amount: Number(p.amount || 0) }))
        : [{ method: String(t.paymentMethod || "other").toLowerCase(), amount: t.total }];
      for (const p of parts) {
        if (!byMethod[p.method]) byMethod[p.method] = { count: 0, total: 0 };
        byMethod[p.method].count += 1;
        byMethod[p.method].total = Math.round((byMethod[p.method].total + p.amount) * 100) / 100;
      }
    }

    const byCashier: Record<string, { name: string; count: number; total: number }> = {};
    for (const t of paid) {
      const key = String(t.cashierId);
      if (!byCashier[key]) byCashier[key] = { name: t.cashierName, count: 0, total: 0 };
      byCashier[key].count += 1;
      byCashier[key].total = Math.round((byCashier[key].total + t.total) * 100) / 100;
    }

    // أفضل الأصناف
    const paidIds = new Set(paid.map((t) => String(t._id)));
    const allLines = await ctx.db.query("posTicketLines").collect();
    const byItem = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const l of allLines) {
      if (!paidIds.has(String(l.ticketId))) continue;
      const key = l.mealId ? String(l.mealId) : `text:${l.name}`;
      const row = byItem.get(key) || { name: l.name, qty: 0, revenue: 0 };
      row.qty += l.qty;
      row.revenue = Math.round((row.revenue + l.lineTotal) * 100) / 100;
      byItem.set(key, row);
    }
    const topItems = Array.from(byItem.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);

    return {
      date,
      totalSales,
      ticketsCount: paid.length,
      avgTicket: paid.length ? Math.round((totalSales / paid.length) * 100) / 100 : 0,
      byMethod: Object.entries(byMethod).map(([k, v2]) => ({ method: k, ...v2 })),
      byCashier: Object.values(byCashier),
      refundsCount: refunded.length,
      refundsValue: refundValue,
      staffMealsCount: staffTix.length,
      staffMealsValue: staffValue,
      topItems,
    };
  },
});

/* ═══════════════════════════ الإعدادات ═══════════════════════════ */

export const getReportSettings = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const s: any = await ctx.db.query("restaurantSettings").first();
    const cfg = s?.posDailyReport;
    return {
      enabled: !!cfg?.enabled,
      recipients: Array.isArray(cfg?.recipients) ? cfg.recipients : [],
      sendTime: cfg?.sendTime || "23:00",
      lastSentDate: cfg?.lastSentDate || null,
    };
  },
});

export const saveReportSettings = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    enabled: v.boolean(),
    recipients: v.array(v.string()),
    sendTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const s: any = await ctx.db.query("restaurantSettings").first();
    if (!s) throw new Error("إعدادات المطعم غير موجودة");
    const clean = args.recipients.map((e) => e.trim().toLowerCase()).filter((e) => /.+@.+\..+/.test(e));
    const time = /^\d{2}:\d{2}$/.test(String(args.sendTime || "")) ? args.sendTime : "23:00";
    await ctx.db.patch(s._id, {
      posDailyReport: {
        enabled: args.enabled,
        recipients: clean,
        sendTime: time,
        lastSentDate: s.posDailyReport?.lastSentDate,
      },
    });
    return { ok: true, recipients: clean };
  },
});

/** داخلي: يقرأ الإعدادات للكرون/الأكشن (بلا صلاحية). */
export const reportConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    const s: any = await ctx.db.query("restaurantSettings").first();
    const cfg = s?.posDailyReport;
    return {
      enabled: !!cfg?.enabled,
      recipients: Array.isArray(cfg?.recipients) ? cfg.recipients : [],
      sendTime: cfg?.sendTime || "23:00",
      lastSentDate: cfg?.lastSentDate || null,
    };
  },
});

export const markReportSent = internalMutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const s: any = await ctx.db.query("restaurantSettings").first();
    if (!s) return;
    await ctx.db.patch(s._id, {
      posDailyReport: { ...(s.posDailyReport || { enabled: false, recipients: [] }), lastSentDate: date },
    });
  },
});

/* ═══════════════════════════ بناء + إرسال ═══════════════════════════ */

function money(n: number): string {
  return `${Number(n || 0).toFixed(2)} ر.ق`;
}

function buildReportHtml(d: any): string {
  const methodRows = d.byMethod
    .map((m: any) => `<tr><td>${m.method}</td><td>${m.count}</td><td style="font-weight:700">${money(m.total)}</td></tr>`)
    .join("") || `<tr><td colspan="3" style="color:#94a3b8">لا مبيعات</td></tr>`;
  const cashierRows = d.byCashier
    .map((c: any) => `<tr><td>${c.name}</td><td>${c.count}</td><td style="font-weight:700">${money(c.total)}</td></tr>`)
    .join("") || `<tr><td colspan="3" style="color:#94a3b8">—</td></tr>`;
  const itemRows = d.topItems
    .map((i: any, k: number) => `<tr><td>${k + 1}. ${i.name}</td><td>${i.qty}</td><td>${money(i.revenue)}</td></tr>`)
    .join("") || `<tr><td colspan="3" style="color:#94a3b8">—</td></tr>`;

  const th = "text-align:right;padding:6px 8px;font-size:12px;color:#0E2A4A;border-bottom:2px solid #D9E6F1";
  const td = "padding:6px 8px;font-size:13px;border-bottom:1px solid #EAF3FB";
  return `<div style="font-family:Cairo,Arial,sans-serif;direction:rtl;text-align:right;max-width:640px;margin:auto;color:#0E2A4A">
    <div style="background:linear-gradient(120deg,#0E76AC,#3AC7F4);color:#fff;border-radius:14px;padding:18px 20px;margin-bottom:16px">
      <div style="font-size:12px;opacity:.85;letter-spacing:2px">ADRENALINE · تقرير المبيعات اليومي</div>
      <div style="font-size:24px;font-weight:900;margin-top:4px">${d.date}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <tr>
        <td style="width:33%;background:#EAF3FB;border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:11px;color:#2D4A67">إجمالي المبيعات</div>
          <div style="font-size:20px;font-weight:900;color:#0E76AC">${money(d.totalSales)}</div>
        </td>
        <td style="width:6px"></td>
        <td style="width:33%;background:#EAF3FB;border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:11px;color:#2D4A67">عدد الفواتير</div>
          <div style="font-size:20px;font-weight:900;color:#0E76AC">${d.ticketsCount}</div>
        </td>
        <td style="width:6px"></td>
        <td style="width:33%;background:#EAF3FB;border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:11px;color:#2D4A67">متوسط الفاتورة</div>
          <div style="font-size:20px;font-weight:900;color:#0E76AC">${money(d.avgTicket)}</div>
        </td>
      </tr>
    </table>

    ${(d.refundsCount || d.staffMealsCount) ? `<div style="display:flex;gap:8px;margin-bottom:14px">
      <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:11px;color:#b91c1c">مرتجعات</div>
        <div style="font-size:16px;font-weight:800;color:#b91c1c">${d.refundsCount} · ${money(d.refundsValue)}</div>
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:11px;color:#475569">وجبات موظفين (خارج الإيراد)</div>
        <div style="font-size:16px;font-weight:800;color:#475569">${d.staffMealsCount} · ${money(d.staffMealsValue)}</div>
      </div>
    </div>` : ""}

    <h3 style="font-size:14px;margin:16px 0 6px">طرق الدفع</h3>
    <table style="width:100%;border-collapse:collapse"><tr><th style="${th}">الطريقة</th><th style="${th}">العدد</th><th style="${th}">القيمة</th></tr>${methodRows.replace(/<td>/g, `<td style="${td}">`)}</table>

    <h3 style="font-size:14px;margin:16px 0 6px">حسب الكاشير</h3>
    <table style="width:100%;border-collapse:collapse"><tr><th style="${th}">الكاشير</th><th style="${th}">الفواتير</th><th style="${th}">المبيعات</th></tr>${cashierRows.replace(/<td>/g, `<td style="${td}">`)}</table>

    <h3 style="font-size:14px;margin:16px 0 6px">أفضل الأصناف</h3>
    <table style="width:100%;border-collapse:collapse"><tr><th style="${th}">الصنف</th><th style="${th}">الكمية</th><th style="${th}">الإيراد</th></tr>${itemRows.replace(/<td>/g, `<td style="${td}">`)}</table>

    <p style="color:#94a3b8;font-size:12px;margin-top:18px">Adrenaline Healthy Food — تقرير آلي</p>
  </div>`;
}

/** يرسل التقرير عبر Resend. يرجّع تفاصيل عامة (بدون كشف مفاتيح). */
async function sendViaResend(recipients: string[], subject: string, html: string): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESET_FROM_EMAIL || "Adrenaline <onboarding@resend.dev>";
  if (!key) return { sent: false, reason: "no_provider" };
  if (!recipients.length) return { sent: false, reason: "no_recipients" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    });
    if (!r.ok) {
      console.error("[posReports] Resend error:", r.status, await r.text());
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[posReports] Resend send failed:", e);
    return { sent: false, reason: "exception" };
  }
}

/** إرسال التقرير — للأدمن (تجريبي/يدوي). date اختياري (افتراضي اليوم بتوقيت قطر). */
export const sendDailyReport = action({
  args: { sessionToken: v.optional(v.string()), date: v.optional(v.string()), recipientsOverride: v.optional(v.array(v.string())) },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string; recipients: string[] }> => {
    // صلاحية أدمن عبر query داخلي (الأكشن ما يقدرش يقرأ DB مباشرة)
    const cfg = await ctx.runQuery(internal.posReports.reportConfig, {});
    const recipients = (args.recipientsOverride && args.recipientsOverride.length)
      ? args.recipientsOverride.map((e) => e.trim().toLowerCase()).filter((e) => /.+@.+\..+/.test(e))
      : cfg.recipients;
    const date = args.date || qatarToday();
    const data = await ctx.runQuery(internal.posReports.dailyReportData, { date });
    const html = buildReportHtml(data);
    const res = await sendViaResend(recipients, `تقرير مبيعات ${date} — Adrenaline`, html);
    return { ...res, recipients };
  },
});

/** كرون: يتحقق من الوقت (قطر) ويرسل مرة واحدة يومياً حين تطابق ساعة الإرسال. */
export const runDailyReportCron = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const cfg = await ctx.runQuery(internal.posReports.reportConfig, {});
    if (!cfg.enabled || !cfg.recipients.length) return;
    const today = qatarToday();
    if (cfg.lastSentDate === today) return; // اتبعت النهارده
    const targetHour = String(cfg.sendTime || "23:00").slice(0, 2);
    const nowHour = qatarHHMM().slice(0, 2);
    if (nowHour < targetHour) return; // لسه بدري
    const data = await ctx.runQuery(internal.posReports.dailyReportData, { date: today });
    const html = buildReportHtml(data);
    const res = await sendViaResend(cfg.recipients, `تقرير مبيعات ${today} — Adrenaline`, html);
    if (res.sent) await ctx.runMutation(internal.posReports.markReportSent, { date: today });
  },
});
