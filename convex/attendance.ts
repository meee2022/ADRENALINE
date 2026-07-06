/**
 * @file convex/attendance.ts
 * @description الحضور اليومي للموظفين — قراءة للموظفين المصرّح لهم، تعديل للمدير.
 *   يدعم الإدخال اليدوي، الإدخال الجماعي، واستيراد سجلّات جهاز البصمة (punches).
 *   يوم العمل القياسي 9 ساعات؛ الأوفرتايم = max(0, ساعات العمل − 9).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { validateSession, requireAdmin } from "./sessions";

const WORK_HOURS_PER_DAY = 9;   // الدوام القياسي
const DAYS_PER_MONTH = 30;      // لحساب المعدّل الساعي (نفس منطق الرواتب)
const DEFAULT_OT_RATE = 1.25;

const r2 = (n: number) => Math.round(n * 100) / 100;
const monthOf = (date: string) => (date || "").slice(0, 7);

/** "HH:mm" أو "HH:mm:ss" → دقائق منذ منتصف الليل. */
function timeToMin(t?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((t || "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** يحسب ساعات العمل والأوفرتايم من وقت الدخول والخروج (يعالج الدوام العابر لمنتصف الليل). */
function computeHours(checkIn?: string, checkOut?: string) {
  const a = timeToMin(checkIn), b = timeToMin(checkOut);
  if (a == null || b == null) return { workedHours: undefined as number | undefined, otHours: undefined as number | undefined };
  let diff = b - a;
  if (diff < 0) diff += 24 * 60; // خروج بعد منتصف الليل
  const workedHours = r2(diff / 60);
  const otHours = Math.max(0, r2(workedHours - WORK_HOURS_PER_DAY));
  return { workedHours, otHours };
}

/** مسافة ليفنشتاين (لمطابقة الأسماء التقريبية). */
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
/** يبني دالة تطابق اسم جهاز البصمة باسم من الرواتب (توحيد التهجئة) أو null لو مش مسجّل. */
async function buildPayrollResolver(ctx: any) {
  const pay = await ctx.db.query("payroll").collect();
  const names = Array.from(new Set(pay.map((p: any) => p.name).filter(Boolean))) as string[];
  const nm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const payNorm = names.map((n) => ({ n, k: nm(n) }));
  const cache = new Map<string, string | null>();
  return (name: string): string | null => {
    const k = nm(name);
    if (cache.has(k)) return cache.get(k)!;
    let best: string | null = null, bd = 1;
    for (const p of payNorm) { const dd = lev(k, p.k) / Math.max(k.length, p.k.length, 1); if (dd < bd) { bd = dd; best = p.n; } }
    const r = bd <= 0.20 ? best : null; cache.set(k, r); return r;
  };
}

/** حضور يوم معيّن (افتراضي اليوم). للموظفين فقط. */
export const listByDate = query({
  args: { date: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    if (!args.date) return [];
    const rows = await ctx.db.query("attendance").withIndex("by_date", (q) => q.eq("date", args.date!)).collect();
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  },
});

/** حضور شهر كامل. للموظفين فقط. */
export const listByMonth = query({
  args: { month: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    if (!args.month) return [];
    const rows = await ctx.db.query("attendance").withIndex("by_month", (q) => q.eq("month", args.month!)).collect();
    rows.sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date)));
    return rows;
  },
});

/** ملخّص يوم + الأشهر المتاحة + ملخّص شهري لكل موظف. */
export const summary = query({
  args: { date: v.optional(v.string()), month: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return null;

    // ملخّص اليوم
    const dayRows = args.date
      ? await ctx.db.query("attendance").withIndex("by_date", (q) => q.eq("date", args.date!)).collect()
      : [];
    const day = {
      present: dayRows.filter((x) => x.status === "present").length,
      absent: dayRows.filter((x) => x.status === "absent").length,
      leave: dayRows.filter((x) => x.status === "leave").length,
      half: dayRows.filter((x) => x.status === "half").length,
      late: dayRows.filter((x) => x.late).length,
      otHours: r2(dayRows.reduce((s, x) => s + (x.otHours || 0), 0)),
    };

    // ملخّص الشهر لكل موظف
    const monthRows = args.month
      ? await ctx.db.query("attendance").withIndex("by_month", (q) => q.eq("month", args.month!)).collect()
      : [];
    const byName: Record<string, any> = {};
    for (const x of monthRows) {
      const b = (byName[x.name] ??= { name: x.name, present: 0, absent: 0, leave: 0, half: 0, late: 0, otHours: 0 });
      if (x.status === "present") b.present++;
      else if (x.status === "absent") b.absent++;
      else if (x.status === "leave") b.leave++;
      else if (x.status === "half") b.half++;
      if (x.late) b.late++;
      b.otHours = r2(b.otHours + (x.otHours || 0));
    }
    // ✅ الأوفرتايم المعتمد يدويًا (يتجاوز المحسوب)
    const approvals = args.month
      ? await ctx.db.query("otApprovals").withIndex("by_month", (q) => q.eq("month", args.month!)).collect()
      : [];
    const approvedByName: Record<string, number> = {};
    for (const a of approvals) approvedByName[a.name] = a.otHours;

    const employees = Object.values(byName).map((b: any) => ({
      ...b,
      workedDays: r2(b.present + b.half * 0.5),
      otComputed: b.otHours,
      otApproved: approvedByName[b.name] ?? null,
      otHours: approvedByName[b.name] ?? b.otHours, // المعتمد إن وُجد وإلا المحسوب
    }));

    // الأشهر المتاحة
    const all = await ctx.db.query("attendance").collect();
    const months = Array.from(new Set(all.map((x) => x.month))).sort().reverse();

    return { day, employees, months };
  },
});

/** عدّادات حضور اليوم للوحة التحكم (حاضر/غائب/إجازة/نصف يوم/متأخر). للموظفين فقط. */
export const todayCounts = query({
  args: { date: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff" || !args.date) return null;
    const rows = await ctx.db.query("attendance").withIndex("by_date", (q) => q.eq("date", args.date!)).collect();
    return {
      present: rows.filter((x) => x.status === "present").length,
      absent: rows.filter((x) => x.status === "absent").length,
      leave: rows.filter((x) => x.status === "leave").length,
      half: rows.filter((x) => x.status === "half").length,
      late: rows.filter((x) => x.late).length,
      marked: rows.length,
    };
  },
});

/** أسماء الموظفين (من كشف الرواتب) لاختيارهم. */
export const employeeNames = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    const pay = await ctx.db.query("payroll").collect();
    const seen = new Map<string, string>();
    for (const p of pay) if (!seen.has(p.name)) seen.set(p.name, p.designation || "");
    return Array.from(seen.entries()).map(([name, designation]) => ({ name, designation })).sort((a, b) => a.name.localeCompare(b.name));
  },
});

const statusU = v.union(v.literal("present"), v.literal("absent"), v.literal("leave"), v.literal("half"));

/** إضافة/تحديث سجلّ حضور لموظف في يوم (upsert على الاسم+التاريخ). للمدير. */
export const upsert = mutation({
  args: {
    name: v.string(),
    designation: v.optional(v.string()),
    date: v.string(),
    status: statusU,
    checkIn: v.optional(v.string()),
    checkOut: v.optional(v.string()),
    late: v.optional(v.boolean()),
    note: v.optional(v.string()),
    source: v.optional(v.union(v.literal("manual"), v.literal("biometric"))),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const { workedHours, otHours } = computeHours(args.checkIn, args.checkOut);
    const doc = {
      name: args.name.trim(),
      designation: args.designation,
      date: args.date,
      month: monthOf(args.date),
      status: args.status,
      checkIn: args.checkIn || undefined,
      checkOut: args.checkOut || undefined,
      workedHours,
      otHours,
      late: args.late,
      note: args.note || undefined,
      source: args.source || "manual",
    };
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_name_date", (q) => q.eq("name", doc.name).eq("date", doc.date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...doc, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("attendance", { ...doc, createdAt: Date.now() });
  },
});

/** إدخال جماعي — قائمة سجلّات ليوم واحد. للمدير. */
export const bulkUpsert = mutation({
  args: {
    date: v.string(),
    source: v.optional(v.union(v.literal("manual"), v.literal("biometric"))),
    rows: v.array(
      v.object({
        name: v.string(),
        designation: v.optional(v.string()),
        status: statusU,
        checkIn: v.optional(v.string()),
        checkOut: v.optional(v.string()),
        late: v.optional(v.boolean()),
      }),
    ),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const month = monthOf(args.date);
    let n = 0;
    for (const row of args.rows) {
      const name = row.name.trim();
      if (!name) continue;
      const { workedHours, otHours } = computeHours(row.checkIn, row.checkOut);
      const doc = {
        name, designation: row.designation, date: args.date, month, status: row.status,
        checkIn: row.checkIn || undefined, checkOut: row.checkOut || undefined,
        workedHours, otHours, late: row.late, source: args.source || "manual",
      };
      const existing = await ctx.db
        .query("attendance")
        .withIndex("by_name_date", (q) => q.eq("name", name).eq("date", args.date))
        .first();
      if (existing) await ctx.db.patch(existing._id, { ...doc, updatedAt: Date.now() });
      else await ctx.db.insert("attendance", { ...doc, createdAt: Date.now() });
      n++;
    }
    return { ok: true, count: n };
  },
});

/**
 * استيراد سجلّات جهاز البصمة — نقاط بصمة خام (punches): كل نقطة {name, date, time}.
 * يُجمّع لكل موظف/يوم: أول بصمة = دخول، آخر بصمة = خروج، ويحسب الساعات والأوفرتايم.
 * للمدير.
 */
export const importPunches = mutation({
  args: {
    punches: v.array(v.object({ name: v.string(), date: v.string(), time: v.string() })),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    // تجميع بالاسم+التاريخ
    const groups = new Map<string, { name: string; date: string; times: string[] }>();
    for (const p of args.punches) {
      const name = (p.name || "").trim();
      const date = (p.date || "").trim();
      if (!name || !date || timeToMin(p.time) == null) continue;
      const key = name + "|" + date;
      const g = groups.get(key) || { name, date, times: [] };
      g.times.push(p.time.trim());
      groups.set(key, g);
    }
    let n = 0;
    const groupList = Array.from(groups.values());
    for (const g of groupList) {
      g.times.sort((a: string, b: string) => (timeToMin(a)! - timeToMin(b)!));
      const checkIn = g.times[0];
      const checkOut = g.times.length > 1 ? g.times[g.times.length - 1] : undefined;
      const { workedHours, otHours } = computeHours(checkIn, checkOut);
      const doc = {
        name: g.name, date: g.date, month: monthOf(g.date), status: "present" as const,
        checkIn, checkOut, workedHours, otHours, source: "biometric" as const,
      };
      const existing = await ctx.db
        .query("attendance")
        .withIndex("by_name_date", (q) => q.eq("name", g.name).eq("date", g.date))
        .first();
      if (existing) await ctx.db.patch(existing._id, { ...doc, updatedAt: Date.now() });
      else await ctx.db.insert("attendance", { ...doc, createdAt: Date.now() });
      n++;
    }
    return { ok: true, days: n, employees: new Set(groupList.map((g) => g.name)).size };
  },
});

/**
 * استيراد بصمات من جهاز البصمة (Bridge) — مُؤمّن بمفتاح سري بدل تسجيل دخول.
 * المفتاح يُضبط في متغيّرات Convex: npx convex env set DEVICE_BRIDGE_KEY <key>
 * نفس منطق importPunches: يجمّع لكل موظف/يوم أول وآخر بصمة ويحسب الأوفرتايم.
 */
export const importPunchesDevice = mutation({
  args: {
    key: v.string(),
    punches: v.array(v.object({ name: v.string(), date: v.string(), time: v.string() })),
  },
  handler: async (ctx, args) => {
    const expected = process.env.DEVICE_BRIDGE_KEY;
    if (!expected || args.key !== expected) throw new Error("Unauthorized device");
    // ✅ يطابق أسماء البصمة بأسماء الرواتب تلقائيًا ويتجاهل غير المسجّلين (شركة تانية إلخ)
    const resolve = await buildPayrollResolver(ctx);
    const groups = new Map<string, { name: string; date: string; times: string[] }>();
    for (const p of args.punches) {
      const canonical = resolve((p.name || "").trim());
      const name = canonical || "";
      const date = (p.date || "").trim();
      if (!name || !date || timeToMin(p.time) == null) continue;
      const gkey = name + "|" + date;
      const g = groups.get(gkey) || { name, date, times: [] };
      g.times.push(p.time.trim());
      groups.set(gkey, g);
    }
    let n = 0;
    const groupList = Array.from(groups.values());
    for (const g of groupList) {
      g.times.sort((a: string, b: string) => (timeToMin(a)! - timeToMin(b)!));
      const checkIn = g.times[0];
      const checkOut = g.times.length > 1 ? g.times[g.times.length - 1] : undefined;
      const { workedHours, otHours } = computeHours(checkIn, checkOut);
      const doc = {
        name: g.name, date: g.date, month: monthOf(g.date), status: "present" as const,
        checkIn, checkOut, workedHours, otHours, source: "biometric" as const,
      };
      const existing = await ctx.db
        .query("attendance")
        .withIndex("by_name_date", (q) => q.eq("name", g.name).eq("date", g.date))
        .first();
      if (existing) await ctx.db.patch(existing._id, { ...doc, updatedAt: Date.now() });
      else await ctx.db.insert("attendance", { ...doc, createdAt: Date.now() });
      n++;
    }
    return { ok: true, days: n, employees: new Set(groupList.map((g) => g.name)).size };
  },
});

/** اعتماد/تعديل الأوفرتايم الإجمالي لموظف في شهر (يتجاوز المحسوب من البصمة). للمدير. */
export const setOtApproval = mutation({
  args: { name: v.string(), month: v.string(), otHours: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const existing = await ctx.db.query("otApprovals")
      .withIndex("by_name_month", (q) => q.eq("name", args.name).eq("month", args.month)).first();
    // لو otHours undefined أو null → إزالة الاعتماد (رجوع للمحسوب)
    if (args.otHours == null) {
      if (existing) await ctx.db.delete(existing._id);
      return { ok: true, cleared: true };
    }
    if (existing) await ctx.db.patch(existing._id, { otHours: args.otHours, updatedAt: Date.now() });
    else await ctx.db.insert("otApprovals", { name: args.name, month: args.month, otHours: args.otHours, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { id: v.id("attendance"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * ترحيل الأوفرتايم وأيام الحضور من الحضور الشهري إلى كشف الرواتب.
 * لكل موظف في الشهر: days = أيام الحضور (present + نصف اليوم×0.5)،
 * otHours = مجموع ساعات الأوفرتايم، overtime = otHours × (الباقة/(30×9)) × المعدّل.
 * للمدير.
 */
export const syncToPayroll = mutation({
  args: { month: v.string(), otRate: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rate = args.otRate || DEFAULT_OT_RATE;
    const rows = await ctx.db.query("attendance").withIndex("by_month", (q) => q.eq("month", args.month)).collect();
    const byName: Record<string, { workedDays: number; otHours: number }> = {};
    for (const x of rows) {
      const b = (byName[x.name] ??= { workedDays: 0, otHours: 0 });
      if (x.status === "present") b.workedDays += 1;
      else if (x.status === "half") b.workedDays += 0.5;
      b.otHours += x.otHours || 0;
    }
    // ✅ الأوفرتايم المعتمد يدويًا يتجاوز المحسوب
    const approvals = await ctx.db.query("otApprovals").withIndex("by_month", (q) => q.eq("month", args.month)).collect();
    const approvedByName: Record<string, number> = {};
    for (const a of approvals) approvedByName[a.name] = a.otHours;

    const payroll = await ctx.db.query("payroll").withIndex("by_month", (q) => q.eq("month", args.month)).collect();
    let updated = 0;
    const unmatched: string[] = [];
    for (const [name, agg] of Object.entries(byName)) {
      const pay = payroll.find((p) => p.name === name);
      if (!pay) { unmatched.push(name); continue; }
      const pkg = (pay.basic || 0) + (pay.allowance || 0);
      const hourly = pkg / (DAYS_PER_MONTH * WORK_HOURS_PER_DAY);
      const otHours = r2(approvedByName[name] ?? agg.otHours);
      const overtime = Math.round(otHours * hourly * rate);
      await ctx.db.patch(pay._id, {
        days: Math.min(31, Math.round(agg.workedDays)),
        otHours,
        overtime,
        updatedAt: Date.now(),
      });
      updated++;
    }
    return { ok: true, updated, unmatched };
  },
});
