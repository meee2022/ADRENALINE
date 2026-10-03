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

/* ── واتساب: Webhook حالات التسليم وردود العملاء ──
   GET  للتحقق عند الربط (hub.verify_token = WHATSAPP_WEBHOOK_VERIFY_TOKEN).
   POST موقَّع بـ X-Hub-Signature-256 (HMAC-SHA256 بسرّ التطبيق WHATSAPP_APP_SECRET)؛
        بلا سرّ مضبوط أو بتوقيع خاطئ لا يُعالَج شيء. */
http.route({
  path: "/whatsapp/webhook",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const ok = expected && url.searchParams.get("hub.mode") === "subscribe"
      && url.searchParams.get("hub.verify_token") === expected;
    return new Response(ok ? url.searchParams.get("hub.challenge") || "" : "forbidden", { status: ok ? 200 : 403 });
  }),
});

http.route({
  path: "/whatsapp/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const raw = await request.text();
    const secret = process.env.WHATSAPP_APP_SECRET;
    const given = (request.headers.get("x-hub-signature-256") || "").replace(/^sha256=/, "");
    if (!secret || !given) return new Response("ignored", { status: 200 });
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
    const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
    let diff = hex.length ^ given.length;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ (given.charCodeAt(i) || 0);
    if (diff !== 0) return new Response("bad signature", { status: 403 });

    let body: any = {};
    try { body = JSON.parse(raw); } catch { return new Response("ok", { status: 200 }); }
    for (const entry of body?.entry || []) for (const change of entry?.changes || []) {
      const value = change?.value || {};
      for (const st of value.statuses || []) {
        if (!st?.id || !st?.status) continue;
        await ctx.runMutation(internal.whatsapp.recordStatus, {
          providerMessageId: String(st.id), status: String(st.status),
          error: st.errors?.[0] ? `${st.errors[0].code}: ${st.errors[0].title || st.errors[0].message || ""}` : undefined,
        });
      }
      for (const m of value.messages || []) {
        if (!m?.from) continue;
        await ctx.runMutation(internal.whatsapp.recordInbound, {
          from: String(m.from), text: String(m.text?.body || m.button?.text || ""),
        });
      }
    }
    return new Response("ok", { status: 200 });
  }),
});

export default http;
