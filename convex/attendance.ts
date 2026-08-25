/**
 * @file convex/attendance.ts
 * @description الحضور اليومي للموظفين — قراءة للموظفين المصرّح لهم، تعديل للمدير.
 *   يدعم الإدخال اليدوي، الإدخال الجماعي، واستيراد سجلّات جهاز البصمة (punches).
 *   يوم العمل القياسي 9 ساعات؛ الأوفرتايم = max(0, ساعات العمل − 9).
 */
import { v } from "convex/values";
import { addDays, dateToDays, fmtDate, parseDate } from "./lib/dates";
import { mutation, query } from "./_generated/server";
import { validateSession, requireAdmin } from "./sessions";

const WORK_HOURS_PER_DAY = 9;   // الدوام القياسي الافتراضي (لو الموظف مش محدّد له ساعات)
const DAYS_PER_MONTH = 30;      // لحساب المعدّل الساعي (نفس منطق الرواتب)
const DEFAULT_OT_RATE = 1.5;    // معامل الأوفرتايم في المطعم (ساعة ونص)

/** يبني خريطة اسم→{ساعات الدوام، أيام الإجازة} من employeeWorkSettings. */
type WorkSetting = { std: number; rest: number[] };
async function buildWorkSettingsMap(ctx: any): Promise<Map<string, WorkSetting>> {
  const rows = await ctx.db.query("employeeWorkSettings").collect();
  const m = new Map<string, WorkSetting>();
  for (const r of rows) {
    const h = Number(r.standardHours);
    m.set(r.name, {
      std: Number.isFinite(h) && h > 0 ? h : WORK_HOURS_PER_DAY,
      rest: Array.isArray(r.restDays) ? r.restDays.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
    });
  }
  return m;
}
const stdFor = (m: Map<string, WorkSetting>, name: string) => m.get(name)?.std ?? WORK_HOURS_PER_DAY;
const restFor = (m: Map<string, WorkSetting>, name: string) => m.get(name)?.rest ?? [];

/** يوم الأسبوع لتاريخ yyyy-MM-dd (0=الأحد ... 6=السبت). */
function dowOf(date: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}
/** هل هذا التاريخ يوم إجازة أسبوعية لهذا الموظف؟ */
function isRestDay(m: Map<string, WorkSetting>, name: string, date: string): boolean {
  const rest = restFor(m, name);
  return rest.length > 0 && rest.includes(dowOf(date));
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const monthOf = (date: string) => (date || "").slice(0, 7);
const normEmployeeKey = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const NIGHT_SHIFT_EMPLOYEES = new Set([
  "Shariful Islam", "Shorub Hossan", "Shourub Hussain", "Akram Abdulla", "Mohamed Wagiealla", "Mohammed Wagiealla",
  "Arif Mohammad", "Arif Mohamed", "Arif Mohammed", "Arif Mphammed", "Muhammed Rashed",
].map(normEmployeeKey));

/** "HH:mm" أو "HH:mm:ss" → دقائق منذ منتصف الليل. */
function timeToMin(t?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((t || "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** يحسب ساعات العمل والأوفرتايم من وقت الدخول والخروج (يعالج الدوام العابر لمنتصف الليل). */
export function computeHours(
  checkIn?: string,
  checkOut?: string,
  standardHours: number = WORK_HOURS_PER_DAY,
  fullOt = false, // يوم إجازة → كل الساعات أوفرتايم
) {
  const a = timeToMin(checkIn), b = timeToMin(checkOut);
  if (a == null || b == null) return { workedHours: undefined as number | undefined, otHours: undefined as number | undefined };
  let diff = b - a;
  if (diff < 0) diff += 24 * 60; // خروج بعد منتصف الليل
  const workedHours = r2(diff / 60);
  const otHours = fullOt ? workedHours : Math.max(0, r2(workedHours - standardHours));
  return { workedHours, otHours };
}

// أقصى مدة شيفت (12 ساعة + هامش). يفصل خروج الشيفت عن دخول الشيفت اللي بعده،
// وبيسمح للشيفت الليلي يعدّي منتصف الليل من غير ما يتلغبط مع اليوم الجديد.
type Punch = { name: string; date: string; time: string; kind?: "in" | "out" };

/** "YYYY-MM-DD" → عدد الأيام منذ حقبة (لحساب زمن مطلق يعدّي منتصف الليل). */

/**
 * يحوّل بصمات خام {name,date,time} إلى شيفتات فعلية {name, date(=يوم الدخول), checkIn, checkOut}.
 * لكل موظف: يرتّب كل بصماته زمنيًا، يقرن كل دخول بالبصمة التالية كخروج طالما الفرق ≤ 16 ساعة
 * (فبصمة 3 الفجر تُقرن كخروج للشيفت اللي بدأ 3 العصر إمبارح، مش دخول يوم جديد).
 * الشيفتات اللي ليها نفس يوم الدخول تُدمج (أول دخول/آخر خروج) لمعالجة فترات الراحة.
 */
export function buildShifts(raw: Punch[]) {
  const byEmp = new Map<string, { date: string; time: string; abs: number; kind?: "in" | "out" }[]>();
  for (const p of raw) {
    const name = (p.name || "").trim();
    const date = (p.date || "").trim();
    const tm = timeToMin(p.time);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || tm == null) continue;
    let arr = byEmp.get(name);
    if (!arr) { arr = []; byEmp.set(name, arr); }
    arr.push({ date, time: p.time.trim(), abs: dateToDays(date) * 1440 + tm, kind: p.kind });
  }
  const shifts: { name: string; date: string; checkIn?: string; checkOut?: string }[] = [];
  for (const [name, list] of byEmp) {
    list.sort((a, b) => a.abs - b.abs);
    // إزالة البصمات المكررة القريبة (أقل من دقيقتين)
    const dd: typeof list = [];
    for (const p of list) if (!dd.length || p.abs - dd[dd.length - 1].abs >= 2) dd.push(p);
    const byDate = new Map<string, typeof dd>();
    for (const p of dd) {
      const day = byDate.get(p.date) ?? [];
      day.push(p);
      byDate.set(p.date, day);
    }
    for (const [date, day] of byDate) {
      const explicitIn = day.find((p) => p.kind === "in");
      const explicitOut = day.slice().reverse().find((p) => p.kind === "out");
      if (explicitIn || explicitOut) {
        shifts.push({ name, date, checkIn: explicitIn?.time, checkOut: explicitOut?.time });
      } else {
        // Without a direction from the device, keep punches inside their calendar
        // day. Pairing blindly across dates makes one missed punch shift the rest
        // of the month (an out becomes the next in, and so on).
        shifts.push({
          name,
          date,
          checkIn: day[0]?.time,
          checkOut: day.length > 1 ? day[day.length - 1].time : undefined,
        });
      }
    }
  }
  return shifts.sort((a, b) => a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date));
}

/** يكتب شيفتات البصمة، ويحذف سجلّات البصمة القديمة على أيام لم تعُد يوم دخول (خروج شيفت ليلي). */
async function applyShifts(
  ctx: any,
  shifts: { name: string; date: string; checkIn?: string; checkOut?: string }[],
  rawKeys: Set<string>,
) {
  // Never delete a previously valid biometric day merely because a partial
  // polling window could not rebuild it. A later complete pull may update it.
  const wsMap = await buildWorkSettingsMap(ctx);
  for (const s of shifts) {
    // Historical imports before the night-shift fix stored a 00:00-04:00
    // checkout as the next day's check-in. Remove that stale next-day row when
    // the same punch is now correctly attached to the prior work date.
    const outMin = timeToMin(s.checkOut);
    if (s.checkOut && outMin != null && outMin <= 4 * 60) {
      const nextDate = fmtDate(addDays(parseDate(s.date), 1));
      const stale = await ctx.db.query("attendance").withIndex("by_name_date", (q: any) => q.eq("name", s.name).eq("date", nextDate)).first();
      if (stale && stale.source === "biometric" && stale.checkIn === s.checkOut) await ctx.db.delete(stale._id);
    }
    const ex = await ctx.db.query("attendance").withIndex("by_name_date", (q: any) => q.eq("name", s.name).eq("date", s.date)).first();
    const checkIn = s.checkIn ?? (ex?.source === "biometric" ? ex.checkIn : undefined);
    const checkOut = s.checkOut ?? (ex?.source === "biometric" ? ex.checkOut : undefined);
    const { workedHours, otHours } = computeHours(checkIn, checkOut, stdFor(wsMap, s.name), isRestDay(wsMap, s.name, s.date));
    const doc = {
      name: s.name, date: s.date, month: monthOf(s.date), status: "present" as const,
      checkIn, checkOut, workedHours, otHours, source: "biometric" as const,
    };
    if (ex) await ctx.db.patch(ex._id, { ...doc, updatedAt: Date.now() });
    else await ctx.db.insert("attendance", { ...doc, createdAt: Date.now() });
  }
  return { ok: true, days: shifts.length, employees: new Set(shifts.map((s) => s.name)).size };
}

async function reconcileHistoricalAbsences(ctx: any, from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return 0;
  let inserted = 0;
  for (let cur = parseDate(from), guard = 0; fmtDate(cur) <= to && guard < 370; cur = addDays(cur, 1), guard++) {
    const date = fmtDate(cur);
    const month = monthOf(date);
    const payroll = await ctx.db.query("payroll").withIndex("by_month", (q: any) => q.eq("month", month)).collect();
    const names = Array.from(new Set(payroll.filter((p: any) => !p.isVoid).map((p: any) => String(p.name || "").trim()).filter(Boolean))) as string[];
    for (const name of names) {
      const existing = await ctx.db.query("attendance").withIndex("by_name_date", (q: any) => q.eq("name", name).eq("date", date)).first();
      if (existing) continue;
      await ctx.db.insert("attendance", {
        name, date, month, status: "absent", source: "biometric", note: "Historical reconciliation: no biometric punch", createdAt: Date.now(),
      });
      inserted++;
    }
  }
  return inserted;
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
  const activeMonths = pay.filter((p: any) => !p.isVoid).map((p: any) => p.month).filter(Boolean);
  const latestMonth = activeMonths.sort().at(-1);
  const names = Array.from(new Set(pay.filter((p: any) => !p.isVoid && p.month === latestMonth).map((p: any) => p.name).filter(Boolean))) as string[];
  const nm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const toks = (s: string) => String(s || "").toLowerCase().split(/\s+/).map(nm).filter((t) => t.length >= 3);
  const payNorm = names.map((n) => ({ n, k: nm(n), t: toks(n) }));
  // Device names are sometimes intentionally short. Keep an explicit,
  // auditable mapping so a roster update cannot silently drop their punches.
  // Only return the alias when its canonical employee exists in latest payroll.
  const explicitAliases: Record<string, string> = {
    [nm("Shakib")]: "Abu Sayed Shakib",
    [nm("Bilal Abdul Basser")]: "Billal Abulbassar",
    [nm("Arman Hussain")]: "Arman Hossan",
    [nm("Shorub Hussain")]: "Shorub Hossan",
    [nm("Mohammed Rashed")]: "Muhammed Rashed",
    [nm("Hanan")]: "Amal Hanan",
    [nm("Saidul Islam Shiblu")]: "Saidul Islam Nurul",
    [nm("Mohammed Wagiealla")]: "Mohamed Wagiealla",
    [nm("Mosaab")]: "Mosab Eltahir",
    [nm("Arif Mohamed")]: "Arif Mohammad",
    [nm("Bakri")]: "Bakri Mirghani Mustafa Elhassan",
    [nm("Ratul")]: "MD Ratul Islam",
    [nm("Sifatullah")]: "Sifatullah",
    [nm("Abdulaziz")]: "Abdelaziz Mohamed",
    [nm("Mohanad Elbadwi")]: "Mohanad Elbadwi",
    [nm("Ramsheed")]: "Ramsheed Majeed",
    [nm("Siddig")]: "Siddig Mohamed",
    [nm("Fakhereidin Ashraf Sabir Eisa")]: "Fakheredin Ashraf Sabir Eisa",
    [nm("Fakheredin Ashraf Sabir Eisa")]: "Fakheredin Ashraf Sabir Eisa",
    [nm("Fakrudheen")]: "Fakheredin Ashraf Sabir Eisa",
    [nm("Md Robin Md Nasir Sheikh")]: "Md Robin Md Nasir Sheikh",
    [nm("Yasin")]: "Md Robin Md Nasir Sheikh",
  };
  const payrollNameSet = new Set(names);
  const ratio = (a: string, b: string) => lev(a, b) / Math.max(a.length, b.length, 1);
  const cache = new Map<string, string | null>();
  return (name: string): string | null => {
    const k = nm(name);
    if (cache.has(k)) return cache.get(k)!;
    const explicit = explicitAliases[k];
    if (explicit && payrollNameSet.has(explicit)) {
      cache.set(k, explicit);
      return explicit;
    }
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
      /* عدد من له سجلٌّ في هذا اليوم — يكشف النقص: لو كان أقلّ من عدّة الشهر
         فثمّة من لم تصل بصمته أصلاً، لا من حضر وغاب. */
      recorded: dayRows.length,
    };

    // ملخّص الشهر لكل موظف
    const monthRows = args.month
      ? await ctx.db.query("attendance").withIndex("by_month", (q) => q.eq("month", args.month!)).collect()
      : [];
    const byName: Record<string, any> = {};
    /* عدّة الشهر: كل اسمٍ ظهر ولو مرّةً واحدة. الأدقّ من عدّ اليوم لأن الغائب
       والمُجاز يبقيان من الطاقم، ومن لم تصل بصمته لا يُسقَط من العدد. */
    const staffCount = new Set(monthRows.map((x) => String(x.name || "").trim())).size;
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

    return { day, employees, months, staffCount };
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
    const all = await ctx.db.query("payroll").collect();
    const latestMonth = all.filter((p: any) => !p.isVoid).map((p: any) => p.month).sort().at(-1);
    const pay = all.filter((p: any) => !p.isVoid && p.month === latestMonth);
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
    const name0 = args.name.trim();
    const stdRow: any = await ctx.db.query("employeeWorkSettings").withIndex("by_name", (q) => q.eq("name", name0)).first();
    const std = stdRow?.standardHours ?? WORK_HOURS_PER_DAY;
    const rest: number[] = Array.isArray(stdRow?.restDays) ? stdRow.restDays : [];
    const fullOt = rest.length > 0 && rest.includes(dowOf(args.date));
    const { workedHours, otHours } = computeHours(args.checkIn, args.checkOut, std, fullOt);
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
    const wsMap = await buildWorkSettingsMap(ctx);
    let n = 0;
    for (const row of args.rows) {
      const name = row.name.trim();
      if (!name) continue;
      const { workedHours, otHours } = computeHours(row.checkIn, row.checkOut, stdFor(wsMap, name), isRestDay(wsMap, name, args.date));
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
    punches: v.array(v.object({ name: v.string(), date: v.string(), time: v.string(), kind: v.optional(v.union(v.literal("in"), v.literal("out"))) })),
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
    punches: v.array(v.object({ name: v.string(), date: v.string(), time: v.string(), kind: v.optional(v.union(v.literal("in"), v.literal("out"))) })),
    reconcileFrom: v.optional(v.string()),
    reconcileTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.DEVICE_BRIDGE_KEY;
    if (!expected || args.key !== expected) throw new Error("Unauthorized device");
    // ✅ يطابق أسماء البصمة بأسماء الرواتب تلقائيًا ويتجاهل غير المسجّلين (شركة تانية إلخ)
    const resolve = await buildPayrollResolver(ctx);
    const resolved = args.punches
      .map((p) => {
        const name = resolve((p.name || "").trim()) || "";
        let date = (p.date || "").trim();
        let kind = p.kind;
        const tm = timeToMin(p.time);
        // Some Hikvision users return no attendanceStatus even though their
        // names resolve correctly in payroll. Apply the night rule after name
        // resolution so spelling aliases cannot bypass it. An early punch with
        // no direction is still on the device's next calendar day, so move it
        // back one work date. Already-adjusted bridge punches have kind="out"
        // and must not be shifted a second time.
        if (name && NIGHT_SHIFT_EMPLOYEES.has(normEmployeeKey(name)) && tm != null) {
          if (tm <= 4 * 60 && !kind) {
            date = fmtDate(addDays(parseDate(date), -1));
            kind = "out";
          } else if (tm >= 22 * 60) kind = "out";
          else if (tm >= 14 * 60 + 30 && tm <= 18 * 60) kind = "in";
        }
        return { name, date, time: p.time, kind };
      })
      .filter((p) => p.name && p.date);
    const rawKeys = new Set<string>();
    for (const p of resolved) rawKeys.add(p.name + "|" + p.date);
    const shifts = buildShifts(resolved);
    const result = await applyShifts(ctx, shifts, rawKeys);
    const absences = args.reconcileFrom && args.reconcileTo
      ? await reconcileHistoricalAbsences(ctx, args.reconcileFrom, args.reconcileTo)
      : 0;
    return { ...result, absences };
  },
});

/** One-time data repair: collapse historical spellings of Arif into the roster name. */
export const mergeArifAttendanceAliases = mutation({
  args: {},
  handler: async (ctx) => {
    const canonical = "Arif Mohamed";
    const aliases = new Set([canonical, "Arif Mohammed", "Arif Mphammed"]);
    const rows = (await ctx.db.query("attendance").collect()).filter((r) => aliases.has(r.name));
    const byDate = new Map<string, typeof rows>();
    for (const row of rows) {
      const group = byDate.get(row.date) ?? [];
      group.push(row);
      byDate.set(row.date, group);
    }

    let renamed = 0, deleted = 0;
    for (const group of byDate.values()) {
      // Prefer a complete, believable shift; then prefer the most recently updated row.
      const score = (r: any) => {
        const complete = r.checkIn && r.checkOut ? 100 : (r.checkIn || r.checkOut ? 20 : 0);
        const believable = typeof r.workedHours === "number" && r.workedHours <= 14 ? 30 : 0;
        return complete + believable + Number(r.updatedAt ?? r.createdAt ?? 0) / 1e15;
      };
      group.sort((a, b) => score(b) - score(a));
      const winner = group[0];
      if (winner.name !== canonical) {
        await ctx.db.patch(winner._id, { name: canonical, updatedAt: Date.now() });
        renamed++;
      }
      for (const duplicate of group.slice(1)) {
        await ctx.db.delete(duplicate._id);
        deleted++;
      }
    }
    return { canonical, dates: byDate.size, renamed, deleted };
  },
});

/**
 * Repair rows produced by the legacy day-boundary bug. A row such as
 * 01:10 -> 16:00 is not one 15-hour shift: 01:10 is yesterday's checkout
 * and 16:00 is today's check-in. Only biometric rows matching that exact
 * shape are touched; genuinely missing punches remain incomplete.
 */
export const repairLegacyShiftChains = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const allowedMonths = new Set(["2026-07", "2026-08"]);
    const rows = (await ctx.db.query("attendance").collect())
      .filter((r) => allowedMonths.has(r.month) && r.source === "biometric");
    const byNameDate = new Map(rows.map((r) => [`${r.name}\u0000${r.date}`, r]));
    const wsMap = await buildWorkSettingsMap(ctx);
    const fixes: Array<{ name: string; date: string; from: string; to: string; previousDate: string }> = [];

    for (const row of rows) {
      const a = timeToMin(row.checkIn), b = timeToMin(row.checkOut);
      if (a == null || b == null || b <= a) continue;
      const sameDayHours = (b - a) / 60;
      const isKnownNight = NIGHT_SHIFT_EMPLOYEES.has(normEmployeeKey(row.name));
      const threshold = isKnownNight ? 14 : 16;
      if (a > 8 * 60 || b < 14 * 60 || sameDayHours < threshold) continue;

      const previousDate = fmtDate(addDays(parseDate(row.date), -1));
      const previous = byNameDate.get(`${row.name}\u0000${previousDate}`);
      fixes.push({ name: row.name, date: row.date, from: `${row.checkIn}-${row.checkOut}`, to: `${row.checkOut}-`, previousDate });
      if (args.dryRun) continue;

      // Current row keeps the afternoon punch as its check-in.
      await ctx.db.patch(row._id, {
        checkIn: row.checkOut,
        checkOut: undefined,
        workedHours: undefined,
        otHours: undefined,
        updatedAt: Date.now(),
      });

      if (previous) {
        const checkIn = previous.checkIn;
        const checkOut = row.checkIn;
        const hours = computeHours(checkIn, checkOut, stdFor(wsMap, row.name), isRestDay(wsMap, row.name, previousDate));
        await ctx.db.patch(previous._id, { checkOut, ...hours, updatedAt: Date.now() });
      } else {
        const hours = computeHours(undefined, row.checkIn, stdFor(wsMap, row.name), isRestDay(wsMap, row.name, previousDate));
        const inserted: any = {
          name: row.name, date: previousDate, month: monthOf(previousDate), status: "present" as const,
          checkOut: row.checkIn, ...hours, source: "biometric" as const, createdAt: Date.now(),
        };
        const id = await ctx.db.insert("attendance", inserted);
        byNameDate.set(`${row.name}\u0000${previousDate}`, { ...inserted, _id: id });
      }
    }
    return { dryRun: !!args.dryRun, candidates: fixes.length, fixes };
  },
});

/** Remove impossible near-24h totals left by two consecutive early-morning punches. */
export const sanitizeImpossibleLegacyHours = mutation({
  args: {},
  handler: async (ctx) => {
    const months = new Set(["2026-07", "2026-08"]);
    const rows = (await ctx.db.query("attendance").collect()).filter((r) =>
      months.has(r.month) && r.source === "biometric" && (r.workedHours ?? 0) > 16,
    );
    const fixed: Array<{ name: string; date: string; keptCheckout?: string }> = [];
    for (const row of rows) {
      await ctx.db.patch(row._id, {
        checkIn: undefined,
        workedHours: undefined,
        otHours: undefined,
        note: row.note ? `${row.note} | Legacy biometric pair requires review` : "Legacy biometric pair requires review",
        updatedAt: Date.now(),
      });
      fixed.push({ name: row.name, date: row.date, keptCheckout: row.checkOut });
    }
    return { fixed: fixed.length, rows: fixed };
  },
});

/** Replace 1-7 July legacy timezone rows from the original iVMS report. */
export const repairJulyFirstWeekFromDeviceReport = mutation({
  args: {
    rows: v.array(v.object({
      name: v.string(), date: v.string(),
      checkIn: v.optional(v.string()), checkOut: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const resolveName = await buildPayrollResolver(ctx);
    const wsMap = await buildWorkSettingsMap(ctx);
    let updated = 0, inserted = 0, skipped = 0;
    for (const source of args.rows) {
      if (!/^2026-07-0[1-7]$/.test(source.date) || (!source.checkIn && !source.checkOut)) { skipped++; continue; }
      const name = resolveName(source.name);
      if (!name) { skipped++; continue; }
      const checkIn = source.checkIn?.slice(0, 5);
      const checkOut = source.checkOut?.slice(0, 5);
      const hours = computeHours(checkIn, checkOut, stdFor(wsMap, name), isRestDay(wsMap, name, source.date));
      const existing = await ctx.db.query("attendance").withIndex("by_name_date", (q: any) => q.eq("name", name).eq("date", source.date)).first();
      const doc = {
        name, date: source.date, month: "2026-07", status: "present" as const,
        checkIn, checkOut, ...hours, source: "biometric" as const,
        note: "Corrected from original iVMS July report", updatedAt: Date.now(),
      };
      if (existing) { await ctx.db.patch(existing._id, doc); updated++; }
      else { await ctx.db.insert("attendance", { ...doc, createdAt: Date.now() }); inserted++; }
    }
    return { updated, inserted, skipped };
  },
});

/** Apply the legacy iVMS +08:00 to Qatar +03:00 correction for 1-9 July. */
export const repairJuly1To9Timezone = mutation({
  args: {
    rows: v.array(v.object({
      name: v.string(), date: v.string(),
      checkIn: v.optional(v.string()), checkOut: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const resolveName = await buildPayrollResolver(ctx);
    const wsMap = await buildWorkSettingsMap(ctx);
    const convert = (date: string, time?: string) => {
      const mins = timeToMin(time);
      if (mins == null) return null;
      const shifted = mins - 5 * 60;
      return shifted < 0
        ? { date: fmtDate(addDays(parseDate(date), -1)), time: `${String(Math.floor((shifted + 1440) / 60)).padStart(2, "0")}:${String((shifted + 1440) % 60).padStart(2, "0")}` }
        : { date, time: `${String(Math.floor(shifted / 60)).padStart(2, "0")}:${String(shifted % 60).padStart(2, "0")}` };
    };
    let updated = 0, inserted = 0, moved = 0, skipped = 0;
    for (const source of args.rows) {
      if (!/^2026-07-0[1-9]$/.test(source.date) || (!source.checkIn && !source.checkOut)) { skipped++; continue; }
      const name = resolveName(source.name);
      if (!name) { skipped++; continue; }
      const cin = convert(source.date, source.checkIn);
      const cout = convert(source.date, source.checkOut);
      const workDate = cin?.date ?? cout?.date ?? source.date;
      const checkIn = cin?.time;
      const checkOut = cout?.time;
      const hours = computeHours(checkIn, checkOut, stdFor(wsMap, name), isRestDay(wsMap, name, workDate));

      // Remove the temporary unshifted row created by the previous repair.
      if (workDate !== source.date) {
        const stale = await ctx.db.query("attendance").withIndex("by_name_date", (q: any) => q.eq("name", name).eq("date", source.date)).first();
        if (stale?.note === "Corrected from original iVMS July report") await ctx.db.delete(stale._id);
        moved++;
      }

      const existing = await ctx.db.query("attendance").withIndex("by_name_date", (q: any) => q.eq("name", name).eq("date", workDate)).first();
      const doc = {
        name, date: workDate, month: monthOf(workDate), status: "present" as const,
        checkIn, checkOut, ...hours, source: "biometric" as const,
        note: "Manually corrected iVMS timezone (-5h), source 1-9 July", updatedAt: Date.now(),
      };
      if (existing) { await ctx.db.patch(existing._id, doc); updated++; }
      else { await ctx.db.insert("attendance", { ...doc, createdAt: Date.now() }); inserted++; }
    }
    return { updated, inserted, moved, skipped };
  },
});

/** Remove unshifted July 9 copies whose source punches moved to July 8 after -5h. */
export const cleanupJuly9UnshiftedCopies = mutation({
  args: {},
  handler: async (ctx) => {
    const affected = new Set([
      "Arif Mohamed", "Arman Hussain", "Aziz", "Mohammed Wagiealla", "Nadir", "Shariful Islam",
    ]);
    const rows = await ctx.db.query("attendance").withIndex("by_date", (q: any) => q.eq("date", "2026-07-09")).collect();
    const removed: string[] = [];
    for (const row of rows) {
      if (row.source !== "biometric" || !affected.has(row.name) || row.note?.startsWith("Manually corrected iVMS timezone")) continue;
      await ctx.db.delete(row._id);
      removed.push(row.name);
    }
    return { removed: removed.length, names: removed.sort() };
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
    const byName = new Map(settingsRows.map((r) => [r.name, r]));
    const restaurant: any = await ctx.db.query("restaurantSettings").first();
    const employees = Array.from(seen.entries())
      .map(([name, designation]) => {
        const row: any = byName.get(name);
        return {
          name, designation,
          standardHours: row?.standardHours ?? WORK_HOURS_PER_DAY,
          restDays: Array.isArray(row?.restDays) ? row.restDays : [],
          custom: byName.has(name),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { employees, otRate: restaurant?.attendanceOtRate ?? DEFAULT_OT_RATE, defaultHours: WORK_HOURS_PER_DAY };
  },
});

/** حفظ ساعات الدوام لموظفين + (اختياري) معامل الأوفرتايم العام. للمدير. */
export const setWorkHoursBulk = mutation({
  args: {
    rows: v.array(v.object({
      name: v.string(),
      standardHours: v.number(),
      restDays: v.optional(v.array(v.number())),
    })),
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
      const rest = Array.isArray(row.restDays)
        ? Array.from(new Set(row.restDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)))
        : [];
      const ex = await ctx.db.query("employeeWorkSettings").withIndex("by_name", (q) => q.eq("name", name)).first();
      if (ex) await ctx.db.patch(ex._id, { standardHours: r2(h), restDays: rest, updatedAt: Date.now() });
      else await ctx.db.insert("employeeWorkSettings", { name, standardHours: r2(h), restDays: rest, updatedAt: Date.now() });
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
    const wsMap = await buildWorkSettingsMap(ctx);
    const rows = await ctx.db.query("attendance").withIndex("by_month", (q) => q.eq("month", args.month)).collect();
    let updated = 0;
    for (const r of rows) {
      if (!r.checkIn || !r.checkOut) continue;
      const { workedHours, otHours } = computeHours(r.checkIn, r.checkOut, stdFor(wsMap, r.name), isRestDay(wsMap, r.name, r.date));
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
    const wsMap = await buildWorkSettingsMap(ctx);
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
      const hourly = pkg / (DAYS_PER_MONTH * stdFor(wsMap, name));
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
