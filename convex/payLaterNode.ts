"use node";

import crypto from "node:crypto";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

function sameHex(left: string, right: string) {
  const a = Buffer.from(left.toLowerCase(), "utf8");
  const b = Buffer.from(right.toLowerCase(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const verifyWebhook = internalAction({
  args: { payload: v.any() },
  handler: async (ctx, { payload }): Promise<{ ok: boolean; reason?: string; updated?: boolean }> => {
    const secret = process.env.PAYLATER_WEBHOOK_SECRET;
    if (!secret) return { ok: false, reason: "webhook_not_configured" };
    const merchantId = String(payload.merchantId ?? payload.merchant_id ?? "");
    const orderId = String(payload.orderId ?? payload.order_id ?? "");
    const rawStatus = String(payload.status ?? "");
    const timestamp = String(payload.timestamp ?? "");
    const comments = String(payload.comments ?? "");
    const receivedHash = String(payload.txHash ?? payload.tx_hash ?? "");
    if (!merchantId || !orderId || !rawStatus || !timestamp || !receivedHash) return { ok: false, reason: "invalid_payload" };

    const source = `${merchantId}${orderId}${rawStatus}${timestamp}${comments}`.toUpperCase();
    const md5 = crypto.createHash("md5").update(source).digest("hex");
    const expectedHash = crypto.createHmac("sha256", secret).update(md5).digest("hex");
    if (!sameHex(receivedHash, expectedHash)) return { ok: false, reason: "invalid_signature" };

    const normalized = rawStatus.toLowerCase();
    const status = rawStatus === "2" || normalized === "success" || normalized === "successful"
      ? "success" as const
      : rawStatus === "3" || normalized === "failed" || normalized === "failure" || normalized === "cancelled"
        ? "failed" as const
        : "pending" as const;
    const updated: boolean = await ctx.runMutation(internal.payLater.applyStatus, {
      orderId,
      status,
      payLaterOrderId: payload.payLaterOrderId ? String(payload.payLaterOrderId) : undefined,
    });
    return { ok: true, updated };
  },
});
