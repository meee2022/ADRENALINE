/**
 * @file convex/http.ts
 * @description نقاط HTTP العامة. أهمها: استقبال طلبات المنصّات الأونلاين تلقائياً.
 *   خدمة توجيه البريد (Cloudflare Email Worker / Make / SendGrid Inbound…) تُرسل
 *   كل إيميل طلب إلى هذه النقطة، فنحلّله ونحصره — بلا إدخال يدوي.
 *
 *   الأمان: مفتاح سرّي في الهيدر `x-webhook-key` = ONLINE_ORDERS_KEY (env).
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/online-orders/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // 1) تحقّق المفتاح
    const key = request.headers.get("x-webhook-key");
    const expected = process.env.ONLINE_ORDERS_KEY;
    if (!expected || key !== expected) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401, headers: { "content-type": "application/json" },
      });
    }

    // 2) اقرأ الحمولة — إمّا حقول جاهزة أو إيميل خام (subject/text/from)
    let body: any = {};
    try { body = await request.json(); } catch { body = {}; }

    const result = await ctx.runMutation(internal.onlineOrders.ingestInternal, {
      platform: body.platform,
      mealsCount: body.mealsCount,
      amount: body.amount,
      orderRef: body.orderRef,
      // خام للتحليل التلقائي
      subject: body.subject,
      text: body.text || body.body || body.html,
      from: body.from || body.sender,
      dateISO: body.date, // اختياري yyyy-MM-dd
    });

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { "content-type": "application/json" },
    });
  }),
});

http.route({
  path: "/paylater/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let payload: unknown;
    try { payload = await request.json(); }
    catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }
    const result = await ctx.runAction(internal.payLaterNode.verifyWebhook, { payload });
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 403,
      headers: { "content-type": "application/json" },
    });
  }),
});

export default http;
