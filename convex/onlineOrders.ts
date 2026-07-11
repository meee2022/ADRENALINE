/**
 * @file convex/onlineOrders.ts
 * @description حصر طلبات المنصّات الأونلاين (طلبات/سنونو/رفيق/ديليفرو/كيتا) بالأسعار.
 *   يسجّل لكل طلب: المنصّة + عدد الوجبات + القيمة، ويطلّع تقرير لكل منصّة (طلبات/وجبات/إيراد).
 * @frontend client/src/pages/OnlineOrders.tsx
 */
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { validateSession, requireAdmin } from "./sessions";

const monthOf = (d: string) => (d || "").slice(0, 7);

/** yyyy-MM-dd بتوقيت قطر (+03) من الآن. */
function todayQatarISO(): string {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** تخمين المنصّة من المُرسِل/العنوان. */
function detectPlatform(text: string): typeof PLATFORMS[number] {
  const s = String(text || "").toLowerCase();
  if (s.includes("talabat") || s.includes("طلبات")) return "TALABAT";
  if (s.includes("snoonu") || s.includes("سنونو")) return "SNOONU";
  if (s.includes("rafeeq") || s.includes("رفيق")) return "RAFEEQ";
  if (s.includes("deliveroo") || s.includes("ديليفرو")) return "DELIVEROO";
  if (s.includes("keeta") || s.includes("كيتا")) return "KEETA";
  return "OTHER";
}

/** استخراج قيمة الطلب (ريال قطري) من نص الإيميل — أكبر مبلغ مقترن بـ QAR/ر.ق. */
function parseAmount(text: string): number {
  const s = String(text || "");
  const nums: number[] = [];
  const re = /(?:QAR|ر\.?\s?ق|QR)\s*([0-9]+(?:[.,][0-9]{1,2})?)|([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:QAR|ر\.?\s?ق|QR)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const raw = (m[1] || m[2] || "").replace(",", ".");
    const n = parseFloat(raw);
    if (Number.isFinite(n)) nums.push(n);
  }
  return nums.length ? Math.max(...nums) : 0;
}

/** استخراج رقم الطلب المرجعي (Order #12345 / رقم الطلب). */
function parseOrderRef(text: string): string | undefined {
  const s = String(text || "");
  const m =
    s.match(/(?:order\s*(?:no\.?|number|#|id)?|رقم\s*الطلب|طلب\s*رقم)\s*[:#]?\s*([A-Za-z0-9\-]{3,})/i) ||
    s.match(/#\s*([A-Za-z0-9\-]{4,})/);
  return m ? m[1] : undefined;
}

/** تخمين عدد الوجبات — مجموع كميات البنود (2x, ×3) أو عدد الأسطر. */
function parseMealsCount(text: string): number {
  const s = String(text || "");
  let total = 0;
  const re = /(?:^|\n|\s)(?:x\s*)?(\d{1,2})\s*(?:x|×|✕)\s/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) total += parseInt(m[1], 10) || 0;
  return total > 0 ? total : 1; // على الأقل وجبة واحدة
}
const PLATFORMS = ["TALABAT", "SNOONU", "RAFEEQ", "DELIVEROO", "KEETA", "OTHER"] as const;
const platformU = v.union(
  v.literal("TALABAT"), v.literal("SNOONU"), v.literal("RAFEEQ"),
  v.literal("DELIVEROO"), v.literal("KEETA"), v.literal("OTHER"),
);

/** تسجيل طلب أونلاين. للموظفين المصرّح لهم. */
export const log = mutation({
  args: {
    date: v.string(),
    platform: platformU,
    mealsCount: v.number(),
    amount: v.number(),
    orderRef: v.optional(v.string()),
    note: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") throw new Error("Unauthorized");
    return await ctx.db.insert("onlineOrders", {
      date: args.date,
      month: monthOf(args.date),
      platform: args.platform,
      mealsCount: Math.max(0, Math.round(args.mealsCount || 0)),
      amount: Math.max(0, args.amount || 0),
      orderRef: args.orderRef?.trim() || undefined,
      note: args.note?.trim() || undefined,
      loggedBy: (id as any).user?.name || (id as any).user?.username || undefined,
      createdAt: Date.now(),
    });
  },
});

/**
 * ✅ الاستقبال التلقائي (من webhook البريد/المنصّة). داخلي — يُستدعى من http.ts.
 *    يقبل حقولاً جاهزة أو إيميلاً خاماً فيحلّله. يمنع التكرار بـ (platform+orderRef).
 */
export const ingestInternal = internalMutation({
  args: {
    platform: v.optional(v.string()),
    mealsCount: v.optional(v.number()),
    amount: v.optional(v.number()),
    orderRef: v.optional(v.string()),
    subject: v.optional(v.string()),
    text: v.optional(v.string()),
    from: v.optional(v.string()),
    dateISO: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const blob = `${args.from || ""}\n${args.subject || ""}\n${args.text || ""}`;
    const platformRaw = (args.platform || detectPlatform(blob)).toUpperCase();
    const platform = (PLATFORMS as readonly string[]).includes(platformRaw)
      ? (platformRaw as typeof PLATFORMS[number]) : "OTHER";

    const amount = args.amount != null ? Math.max(0, args.amount) : parseAmount(blob);
    const mealsCount = args.mealsCount != null ? Math.max(0, Math.round(args.mealsCount)) : parseMealsCount(blob);
    const orderRef = args.orderRef?.trim() || parseOrderRef(blob);
    const date = args.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(args.dateISO) ? args.dateISO : todayQatarISO();

    // منع التكرار: نفس المنصّة + نفس رقم الطلب في نفس اليوم
    if (orderRef) {
      const sameDay = await ctx.db.query("onlineOrders").withIndex("by_date", (q) => q.eq("date", date)).collect();
      if (sameDay.some((r) => r.platform === platform && r.orderRef === orderRef)) {
        return { ok: true, duplicate: true, platform, orderRef };
      }
    }

    const id = await ctx.db.insert("onlineOrders", {
      date, month: monthOf(date), platform, mealsCount, amount,
      orderRef: orderRef || undefined,
      note: undefined,
      loggedBy: `AUTO · ${platform}`,
      createdAt: Date.now(),
    });
    return { ok: true, id, platform, mealsCount, amount, orderRef: orderRef || null };
  },
});

export const remove = mutation({
  args: { id: v.id("onlineOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

/** قائمة طلبات يوم (الأحدث أولاً). للموظفين. */
export const listByDate = query({
  args: { date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    const rows = await ctx.db.query("onlineOrders").withIndex("by_date", (q) => q.eq("date", args.date)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** حصر: إجماليات اليوم + الشهر لكل منصّة (طلبات/وجبات/إيراد). للموظفين. */
export const summary = query({
  args: { date: v.string(), month: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return null;
    const month = args.month || monthOf(args.date);

    const dayRows = await ctx.db.query("onlineOrders").withIndex("by_date", (q) => q.eq("date", args.date)).collect();
    const monthRows = await ctx.db.query("onlineOrders").withIndex("by_month", (q) => q.eq("month", month)).collect();

    const byPlatform = (rows: any[]) => {
      const o: Record<string, { orders: number; meals: number; revenue: number }> = {};
      for (const p of PLATFORMS) o[p] = { orders: 0, meals: 0, revenue: 0 };
      for (const r of rows) {
        o[r.platform].orders += 1;
        o[r.platform].meals += r.mealsCount;
        o[r.platform].revenue += r.amount;
      }
      return o;
    };
    const totals = (rows: any[]) => ({
      orders: rows.length,
      meals: rows.reduce((s, r) => s + r.mealsCount, 0),
      revenue: rows.reduce((s, r) => s + r.amount, 0),
    });

    const all = await ctx.db.query("onlineOrders").collect();
    const months = Array.from(new Set(all.map((x) => x.month))).sort().reverse();

    return {
      day: { totals: totals(dayRows), byPlatform: byPlatform(dayRows) },
      month: { totals: totals(monthRows), byPlatform: byPlatform(monthRows) },
      months,
    };
  },
});
