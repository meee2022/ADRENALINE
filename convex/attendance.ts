/**
 * @file convex/attendance.ts
 * @description الحضور اليومي للموظفين — قراءة للموظفين المصرّح لهم، تعديل للمدير.
 *   يدعم الإدخال اليدوي، الإدخال الجماعي، واستيراد سجلّات جهاز البصمة (punches).
 *   يوم العمل القياسي 9 ساعات؛ الأوفرتايم = max(0, ساعات العمل − 9).
 */
import { v } from "convex/values";
import { dateToDays } from "./lib/dates";
import { mutation, query } from "./_generated/server";
import { validateSession, requireAdmin } from "./sessions";

const WORK_HOURS_PER_DAY = 9;   // الدوام القياسي الافتراضي (لو الموظف مش محدّد له ساعات)
const DAYS_PER_MONTH = 30;      // لحساب المعدّل الساعي (نفس منطق الرواتب)
const DEFAULT_OT_RATE = 1.5;    // معامل الأوفرتايم في المطعم (ساعة ونص)

/** يبني خريطة اسم→ساعات الدوام القياسية من employeeWorkSettings (الافتراضي 9). */
async function buildStdHoursMap(ctx: any): Promise<Map<string, number>> {
  const rows = await ctx.db.query("employeeWorkSettings").collect();
  const m = new Map<string, number>();
  for (const r of rows) {
    const h = Number(r.standardHours);
    if (Number.isFinite(h) && h > 0) m.set(r.name, h);
  }
  return m;
}
const stdFor = (m: Map<string, number>, name: string) => m.get(name) ?? WORK_HOURS_PER_DAY;

const r2 = (n: number) => Math.round(n * 100) / 100;
const monthOf = (date: string) => (date || "").slice(0, 7);

/** "HH:mm" أو "HH:mm:ss" → دقائق منذ منتصف الليل. */
function timeToMin(t?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((t || "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** يحسب ساعات العمل والأوفرتايم من وقت الدخول والخروج (يعالج الدوام العابر لمنتصف الليل). */
export function computeHours(checkIn?: string, checkOut?: string, standardHours: number = WORK_HOURS_PER_DAY) {
  const a = timeToMin(checkIn), b = timeToMin(checkOut);
  if (a == null || b == null) return { workedHours: undefined as number | undefined, otHours: undefined as number | undefined };
  let diff = b - a;
  if (diff < 0) diff += 24 * 60; // خروج بعد منتصف الليل
  const workedHours = r2(diff / 60);
  const otHours = Math.max(0, r2(workedHours - standardHours));
  return { workedHours, otHours };
}

// أقصى مدة شيفت (12 ساعة + هامش). يفصل خروج الشيفت عن دخول الشيفت اللي بعده،
// وبيسمح للشيفت الليلي يعدّي منتصف الليل من غير ما يتلغبط مع اليوم الجديد.
const MAX_SHIFT_MIN = 16 * 60;

/** "YYYY-MM-DD" → عدد الأيام منذ حقبة (لحساب زمن مطلق يعدّي منتصف الليل). */

/**
 * يحوّل بصمات خام {name,date,time} إلى شيفتات فعلية {name, date(=يوم الدخول), checkIn, checkOut}.
 * لكل موظف: يرتّب كل بصماته زمنيًا، يقرن كل دخول بالبصمة التالية كخروج طالما الفرق ≤ 16 ساعة
 * (فبصمة 3 الفجر تُقرن كخروج للشيفت اللي بدأ 3 العصر إمبارح، مش دخول يوم جديد).
 * الشيفتات اللي ليها نفس يوم الدخول تُدمج (أول دخول/آخر خروج) لمعالجة فترات الراحة.
 */
function buildShifts(raw: { name: string; date: string; time: string }[]) {
  const byEmp = new Map<string, { date: string; time: string; abs: number }[]>();
  for (const p of raw) {
    const name = (p.name || "").trim();
    const date = (p.date || "").trim();
    const tm = timeToMin(p.time);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || tm == null) continue;
    let arr = byEmp.get(name);
    if (!arr) { arr = []; byEmp.set(name, arr); }
    arr.push({ date, time: p.time.trim(), abs: dateToDays(date) * 1440 + tm });
  }
  // name|يوم-الدخول → مُجمّع الشيفت
  const acc = new Map<string, { name: string; date: string; inAbs: number; inTime: string; outAbs: number | null; outTime: string | null }>();
  for (const [name, list] of byEmp) {
    list.sort((a, b) => a.abs - b.abs);
    // إزالة البصمات المكررة القريبة (أقل من دقيقتين)
    const dd: typeof list = [];
    for (const p of list) if (!dd.length || p.abs - dd[dd.length - 1].abs >= 2) dd.push(p);
    let i = 0;
    while (i < dd.length) {
      const inn = dd[i];
      const nxt = dd[i + 1];
      let out: typeof inn | null = null;
      if (nxt && nxt.abs - inn.abs <= MAX_SHIFT_MIN) { out = nxt; i += 2; } else { i += 1; }
      const key = name + "|" + inn.date;
      const cur = acc.get(key);
      if (!cur) acc.set(key, { name, date: inn.date, inAbs: inn.abs, inTime: inn.time, outAbs: out ? out.abs : null, outTime: out ? out.time : null });
      else {
        if (inn.abs < cur.inAbs) { cur.inAbs = inn.abs; cur.inTime = inn.time; }
        if (out && (cur.outAbs == null || out.abs > cur.outAbs)) { cur.outAbs = out.abs; cur.outTime = out.time; }
      }
    }
  }
  return Array.from(acc.values()).map((s) => ({ name: s.name, date: s.date, checkIn: s.inTime, checkOut: s.outTime || undefined }));
}

/** يكتب شيفتات البصمة، ويحذف سجلّات البصمة القديمة على أيام لم تعُد يوم دخول (خروج شيفت ليلي). */
async function applyShifts(
  ctx: any,
  shifts: { name: string; date: string; checkIn: string; checkOut?: string }[],
  rawKeys: Set<string>,
) {
  const shiftKeys = new Set(shifts.map((s) => s.name + "|" + s.date));
  for (const key of rawKeys) {
    if (shiftKeys.has(key)) continue;
    const [name, date] = key.split("|");
    const ex = await ctx.db.query("attendance").withIndex("by_name_date", (q: any) => q.eq("name", name).eq("date", date)).first();
    if (ex && ex.source === "biometric") await ctx.db.delete(ex._id);
  }
  const stdMap = await buildStdHoursMap(ctx);
  for (const s of shifts) {
    const { workedHours, otHours } = computeHours(s.checkIn, s.checkOut, stdFor(stdMap, s.name));
    const doc = {
      name: s.name, date: s.date, month: monthOf(s.date), status: "present" as const,
      checkIn: s.checkIn, checkOut: s.checkOut, workedHours, otHours, source: "biometric" as const,
    };
    const ex = await ctx.db.query("attendance").withIndex("by_name_date", (q: any) => q.eq("name", s.name).eq("date", s.date)).first();
    if (ex) await ctx.db.patch(ex._id, { ...doc, updatedAt: Date.now() });
    else await ctx.db.insert("attendance", { ...doc, createdAt: Date.now() });
  }
  return { ok: true, days: shifts.length, employees: new Set(shifts.map((s) => s.name)).size };
}

/** مسافة ليفنشتاين (لمطابقة الأسماء التقريبية). */
export function lev(a: string, b: string): number {
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
  const toks = (s: string) => String(s || "").toLowerCase().split(/\s+/).map(nm).filter((t) => t.length >= 3);
  const payNorm = names.map((n) => ({ n, k: nm(n), t: toks(n) }));
  const ratio = (a: string, b: string) => lev(a, b) / Math.max(a.length, b.length, 1);
  const cache = new Map<string, string | null>();
  return (name: string): string | null => {
    const k = nm(name);
    if (cache.has(k)) return cache.get(k)!;
    const dt = toks(name);
    let best: string | null = null, bestScore = 0;
    for (const p of payNorm) {
      // 1) تطابق الاسم الكامل (تقريبي) — قوي
      let score = ratio(k, p.k) <= 0.20 ? 2 : 0;
      // 2) تطابق أي كلمة مشتركة (اسم أول/أخير) — يعالج "Mary" ↔ "Mary Wanjiru Kangethe"
      for (const a of dt) {
        let bestTok = 1;
        for (const b of p.t) { const r = ratio(a, b); if (r < bestTok) bestTok = r; }
        if (bestTok <= 0.20) score += 1 - bestTok; // كلمة شبه مطابقة تزوّد النقاط
      }
      if (score > bestScore) { bestScore = score; best = p.n; }
    }
    // كلمة واحدة شبه مطابقة (score≈1) كفاية؛ العتبة 0.8 تسمح بفرق حرف بسيط
    const r = bestScore >= 0.8 ? best : null; cache.set(k, r); return r;
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

/** تفاصيل حضور موظف واحد في شهر (كل الأيام بالترتيب). للموظفين فقط. */
export const employeeMonth = query({
  args: { name: v.string(), month: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return [];
    const rows = await ctx.db.query("attendance").withIndex("by_month", (q) => q.eq("month", args.month)).collect();
    return rows.filter((r) => r.name === args.name).sort((a, b) => a.date.localeCompare(b.date));
  },
});

/** تقرير حضور لفترة مخصّصة (from..to شامل) — لكل الموظفين أو موظف واحد.
 *  يرجّع تجميعة لكل موظف + (لو name محدّد) الأيام التفصيلية. للموظفين فقط.
 *  ملاحظة: الأوفرتايم هنا = المحسوب اليومي (لا نطبّق اعتماد الشهر لأن الفترة قد تعبر أشهرًا). */
export const rangeReport = query({
  args: {
    from: v.string(),
    to: v.string(),
    name: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return null;
    const from = args.from, to = args.to;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return null;

    // الفهرس على التاريخ (yyyy-MM-dd يرتّب زمنيًا) — مدى مباشر
    let rows = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
      .collect();
    if (args.name) rows = rows.filter((r) => r.name === args.name);

    // خريطة المسمّى الوظيفي من الرواتب
    const pay = await ctx.db.query("payroll").collect();
    const desig = new Map<string, string>();
    for (const p of pay) if (!desig.has(p.name)) desig.set(p.name, p.designation || "");

    const byName: Record<string, any> = {};
    for (const x of rows) {
      const b = (byName[x.name] ??= {
        name: x.name, designation: desig.get(x.name) || "",
        present: 0, absent: 0, leave: 0, half: 0, late: 0, otHours: 0, workedHours: 0,
      });
      if (x.status === "present") b.present++;
      else if (x.status === "absent") b.absent++;
      else if (x.status === "leave") b.leave++;
      else if (x.status === "half") b.half++;
      if (x.late) b.late++;
      b.otHours = r2(b.otHours + (x.otHours || 0));
      b.workedHours = r2(b.workedHours + (x.workedHours || 0));
    }
    const employees = Object.values(byName)
      .map((b: any) => ({ ...b, workedDays: r2(b.present + b.half * 0.5) }))
      .sort((a: any, b: any) => (b.workedDays || 0) - (a.workedDays || 0));

    // الأيام التفصيلية لموظف واحد
    const days = args.name
      ? rows.slice().sort((a, b) => a.date.localeCompare(b.date))
      : [];

    return { from, to, employees, days };
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
    const stdRow = await ctx.db.query("employeeWorkSettings").withIndex("by_name", (q) => q.eq("name", args.name.trim())).first();
    const std = stdRow?.standardHours ?? WORK_HOURS_PER_DAY;
    const { workedHours, otHours } = computeHours(args.checkIn, args.checkOut, std);
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
    const stdMap = await buildStdHoursMap(ctx);
    let n = 0;
    for (const row of args.rows) {
      const name = row.name.trim();
      if (!name) continue;
      const { workedHours, otHours } = computeHours(row.checkIn, row.checkOut, stdFor(stdMap, name));
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
    const rawKeys = new Set<string>();
    for (const p of args.punches) {
      const name = (p.name || "").trim(), date = (p.date || "").trim();
      if (name && date) rawKeys.add(name + "|" + date);
    }
    const shifts = buildShifts(args.punches);
    return await applyShifts(ctx, shifts, rawKeys);
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
    const resolved = args.punches
      .map((p) => ({ name: resolve((p.name || "").trim()) || "", date: (p.date || "").trim(), time: p.time }))
      .filter((p) => p.name && p.date);
    const rawKeys = new Set<string>();
    for (const p of resolved) rawKeys.add(p.name + "|" + p.date);
    const shifts = buildShifts(resolved);
    return await applyShifts(ctx, shifts, rawKeys);
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

/** ساعات الدوام لكل موظف + معامل الأوفرتايم — لواجهة الإعدادات. للموظفين. */
export const workHoursSettings = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id || id.accountType !== "staff") return null;
    const pay = await ctx.db.query("payroll").collect();
    const seen = new Map<string, string>();
    for (const p of pay) if (!seen.has(p.name)) seen.set(p.name, p.designation || "");
    const settingsRows = await ctx.db.query("employeeWorkSettings").collect();
    const stdByName = new Map(settingsRows.map((r) => [r.name, r.standardHours]));
    const restaurant: any = await ctx.db.query("restaurantSettings").first();
    const employees = Array.from(seen.entries())
      .map(([name, designation]) => ({
        name, designation,
        standardHours: stdByName.get(name) ?? WORK_HOURS_PER_DAY,
        custom: stdByName.has(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { employees, otRate: restaurant?.attendanceOtRate ?? DEFAULT_OT_RATE, defaultHours: WORK_HOURS_PER_DAY };
  },
});

/** حفظ ساعات الدوام لموظفين + (اختياري) معامل الأوفرتايم العام. للمدير. */
export const setWorkHoursBulk = mutation({
  args: {
    rows: v.array(v.object({ name: v.string(), standardHours: v.number() })),
    otRate: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    let saved = 0;
    for (const row of args.rows) {
      const name = row.name.trim();
      const h = Number(row.standardHours);
      if (!name || !Number.isFinite(h) || h <= 0 || h > 24) continue;
      const ex = await ctx.db.query("employeeWorkSettings").withIndex("by_name", (q) => q.eq("name", name)).first();
      if (ex) await ctx.db.patch(ex._id, { standardHours: r2(h), updatedAt: Date.now() });
      else await ctx.db.insert("employeeWorkSettings", { name, standardHours: r2(h), updatedAt: Date.now() });
      saved++;
    }
    if (args.otRate != null && Number.isFinite(args.otRate) && args.otRate > 0) {
      const s: any = await ctx.db.query("restaurantSettings").first();
      if (s) await ctx.db.patch(s._id, { attendanceOtRate: r2(args.otRate) });
    }
    return { ok: true, saved };
  },
});

/** إعادة حساب ساعات العمل والأوفرتايم لكل سجلّات شهر بحسب ساعات الموظف الحالية.
 *  يستخدم بعد تعديل ساعات الدوام عشان السجلات القديمة تتصحّح بدون إعادة استيراد. للمدير. */
export const recomputeMonthOt = mutation({
  args: { month: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const stdMap = await buildStdHoursMap(ctx);
    const rows = await ctx.db.query("attendance").withIndex("by_month", (q) => q.eq("month", args.month)).collect();
    let updated = 0;
    for (const r of rows) {
      if (!r.checkIn || !r.checkOut) continue;
      const { workedHours, otHours } = computeHours(r.checkIn, r.checkOut, stdFor(stdMap, r.name));
      if (workedHours !== r.workedHours || otHours !== r.otHours) {
        await ctx.db.patch(r._id, { workedHours, otHours, updatedAt: Date.now() });
        updated++;
      }
    }
    return { ok: true, updated, total: rows.length };
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
    const settings: any = await ctx.db.query("restaurantSettings").first();
    const rate = args.otRate ?? settings?.attendanceOtRate ?? DEFAULT_OT_RATE;
    const stdMap = await buildStdHoursMap(ctx);
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
      const hourly = pkg / (DAYS_PER_MONTH * stdFor(stdMap, name));
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
