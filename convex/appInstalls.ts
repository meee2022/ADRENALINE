/**
 * عدّاد تنزيلات التطبيق (آيفون/أندرويد) — من فتحات التطبيق نفسها لا من تقارير المتجر.
 * كل جهاز يولّد معرّفاً عشوائياً يحفظه محلياً ويرسله عند الفتح؛ لا اسم ولا هاتف
 * ولا معرّف جهاز حقيقي. المجاميع (الإجمالي واليومي) تُحدَّث عند الكتابة، فالقراءة
 * لا تمسح الجدول مهما كبر.
 */
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireStaff } from "./sessions";

const platformArg = v.union(v.literal("ios"), v.literal("android"));
const qatarDay = (now = Date.now()) => new Date(now + 3 * 3600 * 1000).toISOString().slice(0, 10);
const shiftDay = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

async function bumpDaily(ctx: MutationCtx, date: string, platform: "ios" | "android", add: { newInstalls?: number; activeDevices?: number }) {
  const row = await ctx.db.query("appInstallDaily")
    .withIndex("by_date_platform", (q) => q.eq("date", date).eq("platform", platform)).first();
  if (row) await ctx.db.patch(row._id, {
    newInstalls: row.newInstalls + (add.newInstalls || 0),
    activeDevices: row.activeDevices + (add.activeDevices || 0),
  });
  else await ctx.db.insert("appInstallDaily", { date, platform, newInstalls: add.newInstalls || 0, activeDevices: add.activeDevices || 0 });
}

async function bumpTotals(ctx: MutationCtx, platform: "ios" | "android", add: { installs?: number; signedIn?: number }) {
  const row = await ctx.db.query("appInstallTotals").withIndex("by_platform", (q) => q.eq("platform", platform)).first();
  if (row) await ctx.db.patch(row._id, { installs: row.installs + (add.installs || 0), signedIn: row.signedIn + (add.signedIn || 0) });
  else await ctx.db.insert("appInstallTotals", { platform, installs: add.installs || 0, signedIn: add.signedIn || 0 });
}

/** يُستدعى من التطبيق عند الفتح. عام (بلا جلسة) لأنه يعمل قبل تسجيل الدخول. */
export const ping = mutation({
  args: { installId: v.string(), platform: platformArg, appVersion: v.string(), signedIn: v.boolean() },
  handler: async (ctx, args) => {
    if (!/^[a-f0-9]{32}$/.test(args.installId)) return null;
    const today = qatarDay(), now = Date.now();
    const appVersion = args.appVersion.slice(0, 20);
    const existing = await ctx.db.query("appInstalls").withIndex("by_install", (q) => q.eq("installId", args.installId)).first();
    if (!existing) {
      await ctx.db.insert("appInstalls", {
        installId: args.installId, platform: args.platform, appVersion,
        firstSeenDay: today, lastSeenDay: today, firstSeenAt: now, lastSeenAt: now, signedIn: args.signedIn,
      });
      await bumpDaily(ctx, today, args.platform, { newInstalls: 1, activeDevices: 1 });
      await bumpTotals(ctx, args.platform, { installs: 1, signedIn: args.signedIn ? 1 : 0 });
      return null;
    }
    // «سجّل دخولاً» لاصقة: تُحسب مرة واحدة للجهاز ولا تُنقَص عند الخروج.
    const newlySigned = args.signedIn && !existing.signedIn;
    const newDay = existing.lastSeenDay !== today;
    if (!newDay && !newlySigned && existing.appVersion === appVersion) return null;
    await ctx.db.patch(existing._id, {
      appVersion, lastSeenAt: now, lastSeenDay: today, signedIn: existing.signedIn || args.signedIn,
    });
    if (newDay) await bumpDaily(ctx, today, existing.platform, { activeDevices: 1 });
    if (newlySigned) await bumpTotals(ctx, existing.platform, { signedIn: 1 });
    return null;
  },
});

const ACTIVE_CAP = 5000;

export const stats = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const today = qatarDay();
    const totals = await ctx.db.query("appInstallTotals").collect();
    const of = (p: string) => totals.find((t) => t.platform === p);
    const from = shiftDay(today, -13);
    const rows = await ctx.db.query("appInstallDaily")
      .withIndex("by_date_platform", (q) => q.gte("date", from)).collect();
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = shiftDay(from, i);
      const r = rows.filter((x) => x.date === date);
      return { date, newInstalls: r.reduce((s, x) => s + x.newInstalls, 0), activeDevices: r.reduce((s, x) => s + x.activeDevices, 0) };
    });
    // lastSeenDay هو آخر يوم فتح، فعدّ الأجهزة التي آخر فتحها داخل النافذة = النشطون فعلاً بلا تكرار.
    const countSince = async (day: string) =>
      (await ctx.db.query("appInstalls").withIndex("by_lastSeenDay", (q) => q.gte("lastSeenDay", day)).take(ACTIVE_CAP)).length;
    const active7 = await countSince(shiftDay(today, -6));
    const active30 = await countSince(shiftDay(today, -29));
    const first = await ctx.db.query("appInstalls").withIndex("by_firstSeenAt").first();
    return {
      total: totals.reduce((s, t) => s + t.installs, 0),
      ios: of("ios")?.installs || 0,
      android: of("android")?.installs || 0,
      signedIn: totals.reduce((s, t) => s + t.signedIn, 0),
      today: days[days.length - 1],
      active7, active30, capped: active30 >= ACTIVE_CAP,
      countingSince: first?.firstSeenDay || null,
      days,
    };
  },
});
