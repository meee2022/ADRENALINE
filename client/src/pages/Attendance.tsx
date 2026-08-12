/**
 * @file client/src/pages/Attendance.tsx
 * @description الحضور اليومي للموظفين — يدوي + إدخال جماعي + استيراد جهاز البصمة + ترحيل للرواتب.
 * @convex convex/attendance.ts
 */
import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { openPrintDoc } from "@/lib/printDoc";
import { useStore } from "@/lib/store";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardHeader } from "@/components/DashboardHeader";
import { CalendarCheck, Plus, Trash2, Users, Fingerprint, ArrowRightLeft, Clock, Upload, Printer, Timer, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
// ✅ xlsx بيتحمّل lazy وقت الحاجة فقط (~870KB) — يُوفّر ~40% من التحميل الأولي

const STATUSES = [
  { key: "present", ar: "حاضر", en: "Present", cls: "bg-emerald-50 text-emerald-700", dot: "#10b981" },
  { key: "absent", ar: "غائب", en: "Absent", cls: "bg-red-50 text-red-600", dot: "#ef4444" },
  { key: "leave", ar: "إجازة", en: "Leave", cls: "bg-[#e8f8fd] text-[#0E76AC]", dot: "#3cc4f0" },
  { key: "half", ar: "نصف يوم", en: "Half day", cls: "bg-amber-50 text-amber-700", dot: "#f59e0b" },
];
const stInfo = (k: string) => STATUSES.find((s) => s.key === k) || STATUSES[0];

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = () => new Date().toISOString().slice(0, 7);
const pad = (n: string | number) => String(n).padStart(2, "0");

/** yyyy-MM-dd أو dd/MM/yyyy → yyyy-MM-dd */
function normDate(s: string): string | null {
  s = s.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}
function normTime(s: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  return m ? `${pad(m[1])}:${m[2]}` : null;
}

/** مُحلّل مخصّص لتقرير iVMS-4200 "Attendance Details" (أعمدة Name/Date/Check-In/Check-out). */
type AttendancePunch = { name: string; date: string; time: string; kind?: "in" | "out" };

function parseIvmsReport(text: string): AttendancePunch[] | null {
  const lines = text.split(/\r?\n/);
  const hi = lines.findIndex((l) => /person\s*id/i.test(l) && /name/i.test(l) && /check.?in/i.test(l));
  if (hi < 0) return null;
  const cols = lines[hi].split(",").map((c) => c.trim().toLowerCase());
  const idx = (names: string[]) => cols.findIndex((c) => names.some((n) => c === n || c.includes(n)));
  const iName = idx(["name"]), iDate = idx(["date"]), iIn = idx(["check-in", "check in", "checkin"]), iOut = idx(["check-out", "check out", "checkout"]);
  if (iName < 0 || iDate < 0 || iIn < 0) return null;
  const out: AttendancePunch[] = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const date = (parts[iDate] || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue; // يتخطّى صفوف التفاصيل/الملخّص
    const name = (parts[iName] || "").trim();
    if (!name) continue;
    const ci = normTime(parts[iIn] || ""), co = iOut >= 0 ? normTime(parts[iOut] || "") : null;
    if (ci) out.push({ name, date, time: ci, kind: "in" });
    if (co && co !== ci) out.push({ name, date, time: co, kind: "out" });
  }
  return out.length ? out : null;
}

/** يحلّل نص/ملف الحضور إلى نقاط بصمة {name, date, time}. يكتشف تقرير iVMS تلقائيًا، وإلا يستخدم المُحلّل العام. */
function parsePunches(text: string): AttendancePunch[] {
  const ivms = parseIvmsReport(text);
  if (ivms) return ivms;
  const out: AttendancePunch[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let parts = line.split(/[\t,;|]+/).map((c) => c.trim()).filter(Boolean);
    if (parts.length < 2) parts = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
    let date: string | null = null;
    const times: string[] = [];
    const nameParts: string[] = [];
    for (const p of parts) {
      let used = false;
      for (const s of p.split(/\s+/)) {
        const d = normDate(s), tm = normTime(s);
        if (d && !date) { date = d; used = true; }
        else if (tm) { times.push(tm); used = true; }
      }
      if (!used) nameParts.push(p);
    }
    const name = nameParts.join(" ").trim();
    if (!name || !date || times.length === 0) continue;
    for (const tm of times) out.push({ name, date, time: tm });
  }
  return out;
}

export default function Attendance() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const isAdmin = useStore((s) => s.currentUser?.role) === "ADMIN";

  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(monthStr());

  const rows = (useQuery(api.attendance.listByDate, { date, sessionToken }) as any[] | undefined) || [];
  const summary = useQuery(api.attendance.summary, { date, month, sessionToken }) as any;
  const emps = (useQuery(api.attendance.employeeNames, { sessionToken }) as { name: string; designation: string }[] | undefined) || [];

  const upsertM = useMutation(api.attendance.upsert);
  const bulkM = useMutation(api.attendance.bulkUpsert);
  const importM = useMutation(api.attendance.importPunches);
  const removeM = useMutation(api.attendance.remove);
  const syncM = useMutation(api.attendance.syncToPayroll);
  const otApprovalM = useMutation(api.attendance.setOtApproval);
  const [editOt, setEditOt] = useState<{ name: string; val: string } | null>(null);
  const [detailName, setDetailName] = useState<string | null>(null);
  const detailRows = (useQuery(
    api.attendance.employeeMonth,
    detailName ? { name: detailName, month, sessionToken } : "skip",
  ) as any[] | undefined) || [];

  // ---- تقارير مرنة (شهر / فترة مخصّصة · الكل / موظف واحد) ----
  const [reportOpen, setReportOpen] = useState(false);
  const [rScope, setRScope] = useState<"all" | "one">("all");
  const [rName, setRName] = useState("");
  const [rPeriod, setRPeriod] = useState<"month" | "range">("month");
  const [rMonth, setRMonth] = useState(monthStr());
  const [rFromD, setRFromD] = useState(monthStr() + "-01");
  const [rToD, setRToD] = useState(todayStr());
  const monthBounds = (m: string): [string, string] => {
    const [y, mm] = m.split("-").map(Number);
    const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
    return [`${m}-01`, `${m}-${pad(last)}`];
  };
  const [effFrom, effTo] = rPeriod === "month" ? monthBounds(rMonth) : [rFromD, rToD];
  const validRange = /^\d{4}-\d{2}-\d{2}$/.test(effFrom) && /^\d{4}-\d{2}-\d{2}$/.test(effTo) && effFrom <= effTo;
  const reportData = useQuery(
    api.attendance.rangeReport,
    reportOpen && validRange ? { from: effFrom, to: effTo, name: rScope === "one" && rName ? rName : undefined, sessionToken } : "skip",
  ) as any;

  // ---- إعدادات ساعات الدوام لكل موظف + معامل الأوفرتايم ----
  const [hoursOpen, setHoursOpen] = useState(false);
  const workCfg = useQuery(api.attendance.workHoursSettings, hoursOpen ? { sessionToken } : "skip") as any;
  const setWorkHoursM = useMutation(api.attendance.setWorkHoursBulk);
  const recomputeM = useMutation(api.attendance.recomputeMonthOt);
  const [wHours, setWHours] = useState<Record<string, string>>({});
  const [wRest, setWRest] = useState<Record<string, number[]>>({});
  const [wOtRate, setWOtRate] = useState("1.5");
  const [wBusy, setWBusy] = useState(false);
  const wLoaded = useRef(false);
  useEffect(() => {
    if (workCfg && !wLoaded.current) {
      wLoaded.current = true;
      const initH: Record<string, string> = {};
      const initR: Record<string, number[]> = {};
      for (const e of workCfg.employees) { initH[e.name] = String(e.standardHours); initR[e.name] = e.restDays || []; }
      setWHours(initH);
      setWRest(initR);
      setWOtRate(String(workCfg.otRate));
    }
  }, [workCfg]);
  const toggleRest = (name: string, day: number) => setWRest((prev) => {
    const cur = prev[name] || [];
    return { ...prev, [name]: cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day] };
  });
  const setAllHours = (h: number) => setWHours((prev) => {
    const next: Record<string, string> = {}; for (const k of Object.keys(prev)) next[k] = String(h); return next;
  });
  const saveWorkHours = async (recompute: boolean) => {
    setWBusy(true);
    try {
      const rows = Object.entries(wHours)
        .map(([name, v]) => ({ name, standardHours: Number(v), restDays: wRest[name] || [] }))
        .filter((r) => Number.isFinite(r.standardHours) && r.standardHours > 0);
      await setWorkHoursM({ rows, otRate: Number(wOtRate) || undefined, sessionToken });
      if (recompute) {
        const res: any = await recomputeM({ month, sessionToken });
        void alertDialog({ message: t(`تم الحفظ وإعادة حساب ${res.updated} سجل في شهر ${month}`, `Saved & recomputed ${res.updated} records for ${month}`) });
      } else {
        void alertDialog({ message: t("تم حفظ ساعات الدوام. لتطبيقها على السجلات السابقة اضغط «حفظ + إعادة حساب».", "Work hours saved. Use 'Save + Recompute' to apply to existing records.") });
      }
      setHoursOpen(false); wLoaded.current = false;
    } catch (e: any) { void alertDialog({ message: e?.message || t("فشل الحفظ", "Save failed") }); }
    finally { setWBusy(false); }
  };
  const saveOtApproval = async (name: string, raw: string) => {
    const v = raw.trim() === "" ? undefined : Number(raw);
    if (raw.trim() !== "" && (isNaN(v as number) || (v as number) < 0)) { void alertDialog({ message: t("رقم غير صحيح", "Invalid number") }); return; }
    try { await otApprovalM({ name, month, otHours: v, sessionToken }); setEditOt(null); }
    catch (e: any) { void alertDialog({ message: e?.message || t("فشل الحفظ", "Save failed") }); }
  };

  // ---- Single add/edit ----
  const [dialogOpen, setDialogOpen] = useState(false);
  const emptyForm = { name: "", designation: "", status: "present", checkIn: "", checkOut: "", late: false, note: "" };
  const [form, setForm] = useState<any>({ ...emptyForm });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const openAdd = () => { setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (r: any) => {
    setForm({ name: r.name, designation: r.designation || "", status: r.status, checkIn: r.checkIn || "", checkOut: r.checkOut || "", late: !!r.late, note: r.note || "" });
    setDialogOpen(true);
  };
  const saveOne = async () => {
    if (!form.name.trim()) { void alertDialog({ message: t("اكتب اسم الموظف", "Enter employee name") }); return; }
    try {
      await upsertM({
        name: form.name.trim(), designation: form.designation || undefined, date, status: form.status,
        checkIn: form.checkIn || undefined, checkOut: form.checkOut || undefined, late: !!form.late,
        note: form.note.trim() || undefined, source: "manual", sessionToken,
      });
      setDialogOpen(false);
    } catch (e: any) { void alertDialog({ message: e?.message || t("فشل الحفظ", "Save failed") }); }
  };
  const del = async (r: any) => {
    if (!(await confirmDialog({ message: t(`حذف حضور ${r.name}؟`, `Delete ${r.name}'s record?`), variant: "danger", confirmText: isRtl ? "حذف" : "Delete" }))) return;
    try { await removeM({ id: r._id, sessionToken }); } catch (e: any) { void alertDialog({ message: e?.message || "Error" }); }
  };

  // ---- Bulk mark ----
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<Record<string, { status: string; checkIn: string; checkOut: string }>>({});
  const marked = useMemo(() => new Set(rows.map((r) => r.name)), [rows]);
  const openBulk = () => {
    const init: Record<string, any> = {};
    for (const e of emps) init[e.name] = { status: "present", checkIn: "", checkOut: "" };
    setBulkRows(init);
    setBulkOpen(true);
  };
  const setBulk = (name: string, k: string, v: any) => setBulkRows((s) => ({ ...s, [name]: { ...s[name], [k]: v } }));
  const setAllStatus = (status: string) => setBulkRows((s) => {
    const next: any = {}; for (const k of Object.keys(s)) next[k] = { ...s[k], status }; return next;
  });
  const saveBulk = async () => {
    const payload = emps.map((e) => ({
      name: e.name, designation: e.designation || undefined,
      status: (bulkRows[e.name]?.status || "present") as any,
      checkIn: bulkRows[e.name]?.checkIn || undefined,
      checkOut: bulkRows[e.name]?.checkOut || undefined,
    }));
    try { await bulkM({ date, rows: payload, source: "manual", sessionToken }); setBulkOpen(false); }
    catch (e: any) { void alertDialog({ message: e?.message || t("فشل الحفظ", "Save failed") }); }
  };

  // ---- Biometric import ----
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const rawParsed = useMemo(() => parsePunches(importText), [importText]);
  // ✅ فلترة على أسماء الرواتب فقط + توحيد التهجئة (يتجاهل شركة تانية/غير المسجّلين)
  const [payrollOnly, setPayrollOnly] = useState(true);
  const mapped = useMemo(() => {
    const payNames = (emps || []).map((e) => e.name).filter(Boolean);
    if (!payrollOnly || payNames.length === 0) return { punches: rawParsed, ignored: [] as string[] };
    const nm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const lev = (a: string, b: string) => {
      const m = a.length, n = b.length; const d: number[][] = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
      for (let j = 0; j <= n; j++) d[0][j] = j;
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return d[m][n];
    };
    const payNorm = payNames.map((n2) => ({ n: n2, k: nm(n2) }));
    const cache = new Map<string, string | null>();
    const resolve = (name: string): string | null => {
      const k = nm(name);
      if (cache.has(k)) return cache.get(k)!;
      let best: string | null = null, bd = 1;
      for (const p of payNorm) { const d = lev(k, p.k) / Math.max(k.length, p.k.length, 1); if (d < bd) { bd = d; best = p.n; } }
      const r = bd <= 0.20 ? best : null; cache.set(k, r); return r;
    };
    const punches: { name: string; date: string; time: string }[] = [];
    const ignored = new Set<string>();
    for (const p of rawParsed) { const to = resolve(p.name); if (to) punches.push({ ...p, name: to }); else ignored.add(p.name); }
    return { punches, ignored: Array.from(ignored) };
  }, [rawParsed, emps, payrollOnly]);
  const parsed = mapped.punches;
  const parsedDays = useMemo(() => new Set(parsed.map((p) => p.name + "|" + p.date)).size, [parsed]);
  const parsedEmps = useMemo(() => new Set(parsed.map((p) => p.name)).size, [parsed]);
  // ✅ رفع ملف (Excel/CSV) من تصدير الجهاز/iVMS → يحوّله لنص للمُحلّل
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setImportFileName(file.name);
      const isCsvTxt = /\.(csv|txt)$/i.test(file.name);
      if (isCsvTxt) {
        setImportText(await file.text());
      } else {
        // ✅ Dynamic import: نحمّل xlsx وقت الاستيراد فقط، مش على تحميل الصفحة
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const lines: string[] = [];
        for (const sn of wb.SheetNames) {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
          if (csv.trim()) lines.push(csv);
        }
        setImportText(lines.join("\n"));
      }
    } catch (e: any) {
      void alertDialog({ message: t("تعذّرت قراءة الملف. حاول تصديره بصيغة CSV.", "Couldn't read file — try exporting as CSV") });
    }
  };
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const runImport = async () => {
    if (parsed.length === 0) { void alertDialog({ message: t("لم يتم التعرّف على أي سجلّ", "No records recognized") }); return; }
    // ✅ حماية: لو عدد ضخم غير منطقي، أكّد قبل ما نكمّل
    const empCount = new Set(parsed.map((p) => p.name)).size;
    if (empCount > 400 && !(await confirmDialog({ message: t(
      `تم التعرّف على ${empCount} موظف، وهو عدد كبير قد يشير إلى قراءة الملف بصورة غير صحيحة. هل تريد المتابعة؟`,
      `Detected ${empCount} "employees" — that's unusually high and may mean the file was misread. Continue?`) }))) return;
    setImporting(true); setImportProgress(0);
    try {
      // ✅ اتصال HTTP منفصل (بمعزل عن الاتصال التفاعلي) عشان الاستيراد الكبير مايهنّجش الموقع
      const httpClient = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL as string);
      const importRef = makeFunctionReference<"mutation">("attendance:importPunches");
      const CHUNK = 120;
      const empSet = new Set<string>();
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const slice = parsed.slice(i, i + CHUNK);
        await httpClient.mutation(importRef, { punches: slice, sessionToken } as any);
        slice.forEach((p) => empSet.add(p.name));
        setImportProgress(Math.min(100, Math.round(((i + slice.length) / parsed.length) * 100)));
        await new Promise((r) => setTimeout(r, 40)); // يترك الشاشة تتنفّس وتحدّث المؤشّر
      }
      void alertDialog({ message: t(`تم استيراد ${parsed.length} بصمة (${empSet.size} موظف)`, `Imported ${parsed.length} punches (${empSet.size} employees)`) });
      setImportOpen(false); setImportText(""); setImportFileName("");
    } catch (e: any) { void alertDialog({ message: e?.message || t("فشل الاستيراد", "Import failed") }); }
    finally { setImporting(false); setImportProgress(0); }
  };

  // ---- Sync to payroll ----
  const runSync = async () => {
    if (!(await confirmDialog({ message: t(`ترحيل حضور وأوفرتايم شهر ${month} إلى كشف الرواتب؟`, `Sync ${month} attendance & overtime to payroll?`) }))) return;
    try {
      const res: any = await syncM({ month, sessionToken });
      const msg = t(`تم تحديث ${res.updated} موظف في الرواتب`, `Updated ${res.updated} payroll rows`)
        + (res.unmatched?.length ? "\n" + t("غير مطابق: ", "Unmatched: ") + res.unmatched.join(", ") : "");
      void alertDialog({ message: msg });
    } catch (e: any) { void alertDialog({ message: e?.message || t("فشل الترحيل", "Sync failed") }); }
  };

  // ---- طباعة كشف حضور موظف واحد (A4) ----
  const handlePrintEmployee = () => {
    if (!detailName || detailRows.length === 0) {
      void alertDialog({ message: t("لا حضور مسجّل لهذا الموظف في هذا الشهر", "No records for this employee this month") });
      return;
    }
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    const designation = emps.find((e) => e.name === detailName)?.designation || "";
    const cnt = { present: 0, absent: 0, leave: 0, half: 0, late: 0 };
    let totHrs = 0, totOt = 0;
    for (const r of detailRows) {
      if (r.status === "present") cnt.present++;
      else if (r.status === "absent") cnt.absent++;
      else if (r.status === "leave") cnt.leave++;
      else if (r.status === "half") cnt.half++;
      if (r.late) cnt.late++;
      totHrs += r.workedHours || 0;
      totOt += r.otHours || 0;
    }
    const dowName = (d: string) => {
      const days = isRtl ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const [y, m, dd] = d.split("-").map(Number);
      return days[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
    };
    const statusLabel = (k: string) => { const s = stInfo(k); return isRtl ? s.ar : s.en; };
    const rowsHtml = [...detailRows].sort((a, b) => a.date.localeCompare(b.date)).map((r) => {
      const si = stInfo(r.status);
      return `<tr>
        <td class="c" dir="ltr">${esc(r.date)}</td>
        <td class="c">${dowName(r.date)}</td>
        <td class="c"><span class="pill" style="background:${si.dot}22;color:${si.dot}">${statusLabel(r.status)}${r.late ? " • " + t("متأخر", "Late") : ""}</span></td>
        <td class="c" dir="ltr">${esc(r.checkIn || "—")}</td>
        <td class="c" dir="ltr">${esc(r.checkOut || "—")}</td>
        <td class="c b">${r.workedHours != null ? r.workedHours : "—"}</td>
        <td class="c ot">${r.otHours ? Math.round(r.otHours * 10) / 10 : "—"}</td>
        <td class="r note">${esc(r.note || "")}</td>
      </tr>`;
    }).join("");
    const html = `<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}" lang="${isRtl ? "ar" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=800"><title>${t("كشف حضور", "Attendance")} ${esc(detailName)} ${esc(month)}</title>
      <style>
        *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
        body{margin:0;padding:18px;color:#0f1516}
        h1{font-size:20px;margin:0} .sub{color:#47759c;font-weight:700;font-size:13px;margin:2px 0 12px}
        .kpis{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
        .kpi{flex:1;min-width:90px;border:1px solid #e8eef4;border-radius:10px;padding:8px;text-align:center}
        .kpi .v{font-size:22px;font-weight:900} .kpi .l{font-size:11px;color:#47759c;font-weight:700}
        table{width:100%;border-collapse:collapse;font-size:12.5px}
        th{background:#0E76AC;color:#fff;padding:7px 5px;font-weight:800} td{padding:5px;border-bottom:1px solid #eef2f6}
        tr:nth-child(even) td{background:#f7fbfe} .c{text-align:center} .r{text-align:right} .b{font-weight:900} .ot{color:#0E76AC;font-weight:800}
        .pill{font-size:11px;font-weight:800;border-radius:999px;padding:2px 8px;display:inline-block}
        .note{color:#64748b;font-size:11px}
        .foot{margin-top:24px;display:flex;justify-content:space-between;color:#47759c;font-size:12px;font-weight:700}
        @page{size:A4;margin:12mm}
      </style></head><body>
      <h1>${t("كشف حضور موظف", "Employee Attendance Sheet")} — ADRENALINE</h1>
      <div class="sub">${esc(detailName)}${designation ? " · " + esc(designation) : ""} · ${t("الشهر", "Month")}: ${esc(month)}</div>
      <div class="kpis">
        <div class="kpi"><div class="v" style="color:#10b981">${cnt.present}</div><div class="l">${t("أيام الحضور", "Present")}</div></div>
        <div class="kpi"><div class="v" style="color:#ef4444">${cnt.absent}</div><div class="l">${t("أيام الغياب", "Absent")}</div></div>
        <div class="kpi"><div class="v" style="color:#3cc4f0">${cnt.leave}</div><div class="l">${t("إجازة", "Leave")}</div></div>
        <div class="kpi"><div class="v" style="color:#f59e0b">${cnt.late}</div><div class="l">${t("مرات التأخير", "Late")}</div></div>
        <div class="kpi"><div class="v" style="color:#0f1516">${Math.round(totHrs * 10) / 10}</div><div class="l">${t("إجمالي الساعات", "Total hrs")}</div></div>
        <div class="kpi"><div class="v" style="color:#0E76AC">${Math.round(totOt * 10) / 10}</div><div class="l">${t("الأوفرتايم (س)", "Overtime")}</div></div>
      </div>
      <table><thead><tr>
        <th>${t("التاريخ", "Date")}</th><th>${t("اليوم", "Day")}</th><th>${t("الحالة", "Status")}</th>
        <th>${t("دخول", "In")}</th><th>${t("خروج", "Out")}</th><th>${t("ساعات", "Hrs")}</th><th>${t("أوفر", "OT")}</th><th>${t("ملاحظة", "Note")}</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="foot"><span>${t("طُبع في", "Printed")}: ${new Date().toLocaleDateString()}</span><span>${t("التوقيع", "Signature")}: ____________</span></div>
      </body></html>`;
    openPrintDoc(html, {
      fileName: `${t("كشف حضور", "Attendance")} - ${detailName} - ${month}`,
      isRtl,
      width: 900,
    });
  };

  // ---- طباعة التقرير المرن (فترة/شهر · الكل/موظف) ----
  const handlePrintReport = () => {
    if (!reportData || !reportData.employees?.length) {
      void alertDialog({ message: t("لا توجد بيانات في هذه الفترة", "No data in this period") });
      return;
    }
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    const dowName = (d: string) => {
      const days = isRtl ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const [y, m, dd] = d.split("-").map(Number); return days[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
    };
    const statusLabel = (k: string) => { const s = stInfo(k); return isRtl ? s.ar : s.en; };
    const periodLabel = rPeriod === "month" ? month === rMonth ? rMonth : rMonth : `${effFrom} → ${effTo}`;
    const css = `<style>
        *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
        body{margin:0;padding:18px;color:#0f1516}
        h1{font-size:20px;margin:0} .sub{color:#47759c;font-weight:700;font-size:13px;margin:2px 0 12px}
        .kpis{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
        .kpi{flex:1;min-width:90px;border:1px solid #e8eef4;border-radius:10px;padding:8px;text-align:center}
        .kpi .v{font-size:22px;font-weight:900} .kpi .l{font-size:11px;color:#47759c;font-weight:700}
        table{width:100%;border-collapse:collapse;font-size:12.5px}
        th{background:#0E76AC;color:#fff;padding:7px 5px;font-weight:800} td{padding:5px;border-bottom:1px solid #eef2f6}
        tr:nth-child(even) td{background:#f7fbfe} .c{text-align:center} .r{text-align:right;font-weight:700} .b{font-weight:900} .ot{color:#0E76AC;font-weight:800}
        .pill{font-size:11px;font-weight:800;border-radius:999px;padding:2px 8px;display:inline-block}
        .note{color:#64748b;font-size:11px}
        .foot{margin-top:24px;display:flex;justify-content:space-between;color:#47759c;font-size:12px;font-weight:700}
        @page{size:A4;margin:12mm}
      </style>`;
    let body = "";
    if (rScope === "one") {
      const emp = reportData.employees[0];
      const days = reportData.days as any[];
      const rowsHtml = days.map((r: any) => {
        const si = stInfo(r.status);
        return `<tr>
          <td class="c" dir="ltr">${esc(r.date)}</td><td class="c">${dowName(r.date)}</td>
          <td class="c"><span class="pill" style="background:${si.dot}22;color:${si.dot}">${statusLabel(r.status)}${r.late ? " • " + t("متأخر", "Late") : ""}</span></td>
          <td class="c" dir="ltr">${esc(r.checkIn || "—")}</td><td class="c" dir="ltr">${esc(r.checkOut || "—")}</td>
          <td class="c b">${r.workedHours != null ? r.workedHours : "—"}</td><td class="c ot">${r.otHours ? Math.round(r.otHours * 10) / 10 : "—"}</td>
          <td class="r note">${esc(r.note || "")}</td>
        </tr>`;
      }).join("");
      body = `<h1>${t("كشف حضور موظف", "Employee Attendance Sheet")} — ADRENALINE</h1>
        <div class="sub">${esc(emp.name)}${emp.designation ? " · " + esc(emp.designation) : ""} · ${t("الفترة", "Period")}: ${esc(periodLabel)}</div>
        <div class="kpis">
          <div class="kpi"><div class="v" style="color:#10b981">${emp.present}</div><div class="l">${t("أيام الحضور", "Present")}</div></div>
          <div class="kpi"><div class="v" style="color:#ef4444">${emp.absent}</div><div class="l">${t("أيام الغياب", "Absent")}</div></div>
          <div class="kpi"><div class="v" style="color:#3cc4f0">${emp.leave}</div><div class="l">${t("إجازة", "Leave")}</div></div>
          <div class="kpi"><div class="v" style="color:#f59e0b">${emp.late}</div><div class="l">${t("مرات التأخير", "Late")}</div></div>
          <div class="kpi"><div class="v" style="color:#0f1516">${Math.round((emp.workedHours || 0) * 10) / 10}</div><div class="l">${t("إجمالي الساعات", "Total hrs")}</div></div>
          <div class="kpi"><div class="v" style="color:#0E76AC">${Math.round((emp.otHours || 0) * 10) / 10}</div><div class="l">${t("الأوفرتايم (س)", "Overtime")}</div></div>
        </div>
        <table><thead><tr>
          <th>${t("التاريخ", "Date")}</th><th>${t("اليوم", "Day")}</th><th>${t("الحالة", "Status")}</th>
          <th>${t("دخول", "In")}</th><th>${t("خروج", "Out")}</th><th>${t("ساعات", "Hrs")}</th><th>${t("أوفر", "OT")}</th><th>${t("ملاحظة", "Note")}</th>
        </tr></thead><tbody>${rowsHtml}</tbody></table>`;
    } else {
      const list = reportData.employees as any[];
      const tot = {
        present: list.reduce((s, e) => s + (e.present || 0), 0),
        absent: list.reduce((s, e) => s + (e.absent || 0), 0),
        late: list.reduce((s, e) => s + (e.late || 0), 0),
        ot: list.reduce((s, e) => s + (e.otHours || 0), 0),
      };
      const rowsHtml = list.map((e, i) => `<tr>
        <td class="c">${i + 1}</td><td class="r">${esc(e.name)}${e.designation ? `<div class="note">${esc(e.designation)}</div>` : ""}</td>
        <td class="c b">${e.workedDays ?? 0}</td><td class="c">${e.absent || 0}</td><td class="c">${e.leave || 0}</td>
        <td class="c">${e.late || 0}</td><td class="c ot">${Math.round((e.otHours || 0) * 10) / 10}</td>
      </tr>`).join("");
      body = `<h1>${t("تقرير الحضور", "Attendance Report")} — ADRENALINE</h1>
        <div class="sub">${t("الفترة", "Period")}: ${esc(periodLabel)} · ${t("عدد الموظفين", "Employees")}: ${list.length}</div>
        <div class="kpis">
          <div class="kpi"><div class="v" style="color:#10b981">${tot.present}</div><div class="l">${t("إجمالي أيام الحضور", "Total present days")}</div></div>
          <div class="kpi"><div class="v" style="color:#ef4444">${tot.absent}</div><div class="l">${t("إجمالي الغياب", "Total absences")}</div></div>
          <div class="kpi"><div class="v" style="color:#f59e0b">${tot.late}</div><div class="l">${t("مرات التأخير", "Late count")}</div></div>
          <div class="kpi"><div class="v" style="color:#0E76AC">${Math.round(tot.ot)}</div><div class="l">${t("إجمالي الأوفرتايم (ساعة)", "Total overtime (hrs)")}</div></div>
        </div>
        <table><thead><tr><th>#</th><th>${t("الموظف", "Employee")}</th><th>${t("أيام الحضور", "Present days")}</th><th>${t("الغياب", "Absence")}</th><th>${t("إجازة", "Leave")}</th><th>${t("التأخير", "Late")}</th><th>${t("الأوفرتايم (س)", "Overtime (h)")}</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table>`;
    }
    const html = `<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}" lang="${isRtl ? "ar" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=800"><title>${t("تقرير الحضور", "Attendance")} ${esc(periodLabel)}</title>${css}</head><body>${body}
      <div class="foot"><span>${t("طُبع في", "Printed")}: ${new Date().toLocaleDateString()}</span>${rScope === "one" ? `<span>${t("التوقيع", "Signature")}: ____________</span>` : ""}</div>
      </body></html>`;
    openPrintDoc(html, {
      fileName: `${t("تقرير الحضور", "Attendance")} - ${rScope === "one" ? rName : t("الكل", "All")} - ${periodLabel}`,
      isRtl, width: 900,
    });
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6">
      <DashboardHeader
        icon={<CalendarCheck className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="الحضور اليومي" titleEn="Attendance"
        subtitleAr="حضور الموظفين والأوفرتايم — يدوي أو من جهاز البصمة" subtitleEn="Employee attendance & overtime — manual or biometric"
        kpis={summary ? [
          { value: summary.day.present, labelAr: "حاضر اليوم", labelEn: "Present" },
          { value: summary.day.absent, labelAr: "غائب", labelEn: "Absent" },
          { value: summary.day.leave, labelAr: "إجازة", labelEn: "Leave" },
          { value: summary.day.otHours, labelAr: "ساعات أوفرتايم", labelEn: "OT Hours" },
        ] : undefined}
        actions={isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={openBulk} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm">
              <Users className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("تحضير جماعي", "Bulk Mark")}
            </Button>
            <Button onClick={() => setImportOpen(true)} className="h-11 rounded-xl font-bold text-white bg-[#0E2A4A]/40 hover:bg-[#0E2A4A]/60 border border-white/30 shadow-lg text-sm">
              <Fingerprint className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("استيراد بصمة", "Import Biometric")}
            </Button>
          </div>
        ) : undefined}
      />

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">{t("تاريخ اليوم", "Day")}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full sm:w-[170px]" />
        </div>
        {isAdmin && (
          <Button onClick={openAdd} variant="outline" className="h-10 rounded-xl border-[#3cc4f0] text-[#0E76AC] font-bold">
            <Plus className={cn("h-4 w-4", isRtl ? "ml-1" : "mr-1")} /> {t("إضافة موظف", "Add")}
          </Button>
        )}
        <div className="flex-1" />
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">{t("شهر الملخّص", "Summary month")}</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 w-full sm:w-[150px]" />
        </div>
        <Button onClick={() => setReportOpen(true)} variant="outline" className="h-10 rounded-xl font-bold border-[#3cc4f0] text-[#0E76AC]">
          <Printer className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("تقارير وطباعة", "Reports & Print")}
        </Button>
        {isAdmin && (
          <Button onClick={() => { wLoaded.current = false; setHoursOpen(true); }} variant="outline" className="h-10 rounded-xl font-bold border-[#3cc4f0] text-[#0E76AC]">
            <Timer className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("ساعات الدوام", "Work Hours")}
          </Button>
        )}
        {isAdmin && (
          <Button onClick={runSync} className="h-10 rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
            <ArrowRightLeft className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("ترحيل للرواتب", "Sync to Payroll")}
          </Button>
        )}
      </div>

      {/* Day table */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px solid #e8eef4" }}>
          <CalendarCheck className="h-10 w-10 mx-auto mb-3 text-[#3cc4f0]" />
          {!sessionToken ? (
            <p className="text-sm text-gray-500">{t("سجّل خروج ودخول مرة أخرى لعرض الحضور.", "Sign out and back in to view attendance.")}</p>
          ) : (
            <p className="text-gray-600 font-semibold">{t("لا حضور مسجّل لهذا اليوم — ابدأ بالتحضير الجماعي", "No attendance for this day — start with Bulk Mark")}</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-[#f4f8fb] text-[#47759c]">
                  {[t("الموظف", "Employee"), t("الحالة", "Status"), t("دخول", "In"), t("خروج", "Out"), t("ساعات", "Hours"), t("أوفرتايم", "OT"), t("المصدر", "Source")].map((h, i) => (
                    <th key={i} className={cn("px-3 py-3 font-bold text-xs uppercase", i === 0 ? (isRtl ? "text-right" : "text-left") : "text-center")}>{h}</th>
                  ))}
                  {isAdmin && <th className="px-3 py-3 text-center text-xs font-bold uppercase">{t("إجراء", "")}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const si = stInfo(r.status);
                  return (
                    <tr key={r._id} className="border-t border-gray-100 hover:bg-[#f7fbfe] cursor-pointer" onClick={() => isAdmin && openEdit(r)}>
                      <td className={cn("px-3 py-2.5", isRtl ? "text-right" : "text-left")}>
                        <div className="font-bold text-[#0f1516]">{r.name}</div>
                        {r.designation && <div className="text-[11px] text-gray-400">{r.designation}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1", si.cls)}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: si.dot }} />
                          {isRtl ? si.ar : si.en}
                        </span>
                        {r.late && <span className="ml-1 text-[10px] font-bold text-amber-600">{t("متأخر", "Late")}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-gray-600" dir="ltr">{r.checkIn || "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-gray-600" dir="ltr">{r.checkOut || "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-bold text-[#0f1516]">{r.workedHours != null ? r.workedHours : "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-black" style={{ color: r.otHours ? "#0E76AC" : "#cbd5e1" }}>{r.otHours || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.source === "biometric"
                          ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0E76AC]"><Fingerprint className="h-3 w-3" />{t("بصمة", "Bio")}</span>
                          : <span className="text-[10px] text-gray-400">{t("يدوي", "Manual")}</span>}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300" onClick={() => del(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly per-employee summary */}
      {summary?.employees?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#47759c] mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" /> {t(`ملخّص شهر ${month}`, `${month} Summary`)}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {summary.employees.map((e: any) => (
              <div key={e.name} className="bg-white rounded-2xl p-3" style={{ border: "1px solid #e8eef4" }}>
                <button onClick={() => setDetailName(e.name)}
                  className="text-sm font-bold text-[#0E76AC] hover:underline truncate w-full text-start flex items-center gap-1"
                  title={t("عرض أيام الحضور", "View attendance days")}>
                  {e.name}
                </button>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-emerald-600 font-bold">{t("حضور", "P")} {e.workedDays}</span>
                  {e.absent > 0 && <span className="text-red-500 font-bold">{t("غياب", "A")} {e.absent}</span>}
                  {e.late > 0 && <span className="text-amber-600 font-bold">{t("تأخير", "L")} {e.late}</span>}
                </div>
                {/* الأوفرتايم — قابل للتعديل (اعتماد يدوي يتجاوز المحسوب) */}
                <div className="mt-1.5 flex items-center gap-1.5">
                  {editOt?.name === e.name ? (
                    <>
                      <span className="text-[11px] font-bold text-[#0E76AC]">{t("أوفرتايم", "OT")}:</span>
                      <input autoFocus type="number" value={editOt!.val}
                        onChange={(ev) => setEditOt({ name: e.name, val: ev.target.value })}
                        onKeyDown={(ev) => { if (ev.key === "Enter") saveOtApproval(e.name, editOt!.val); if (ev.key === "Escape") setEditOt(null); }}
                        className="w-16 h-6 text-[11px] rounded border border-[#3cc4f0] px-1" dir="ltr" />
                      <button onClick={() => saveOtApproval(e.name, editOt!.val)} className="text-[10px] font-bold text-white bg-[#0E76AC] rounded px-1.5 h-6">{t("حفظ", "OK")}</button>
                      <button onClick={() => setEditOt(null)} className="text-[10px] text-gray-400">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] font-bold text-[#0E76AC]">
                        {t("أوفرتايم", "OT")}: {e.otHours} {t("ساعة", "h")}
                      </span>
                      {e.otApproved != null && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded px-1" title={t(`المحسوب: ${e.otComputed}`, `Computed: ${e.otComputed}`)}>{t("معتمد", "set")}</span>
                      )}
                      {isAdmin && (
                        <button onClick={() => setEditOt({ name: e.name, val: e.otApproved != null ? String(e.otApproved) : "" })}
                          className="text-[10px] text-gray-400 hover:text-[#0E76AC]" title={t("تعديل الأوفرتايم المعتمد", "Edit approved OT")}>✎</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Employee attendance days dialog ===== */}
      <Dialog open={!!detailName} onOpenChange={(o) => !o && setDetailName(null)}>
        <DialogContent className="max-w-2xl" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>{detailName} — {t(`أيام حضور شهر ${month}`, `${month} attendance`)}</DialogTitle>
              <Button onClick={handlePrintEmployee} variant="outline" size="sm"
                className="h-9 rounded-xl font-bold border-[#3cc4f0] text-[#0E76AC] shrink-0 me-6">
                <Printer className={cn("h-4 w-4", isRtl ? "ml-1.5" : "mr-1.5")} /> {t("طباعة الكشف", "Print sheet")}
              </Button>
            </div>
          </DialogHeader>
          {(() => {
            const present = detailRows.filter((r) => r.status === "present").length;
            const totOt = detailRows.reduce((s, r) => s + (r.otHours || 0), 0);
            const totHrs = detailRows.reduce((s, r) => s + (r.workedHours || 0), 0);
            const dow = (d: string) => { const days = isRtl ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; const [y, m, dd] = d.split("-").map(Number); return days[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]; };
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: present, l: t("أيام حضور", "Days") },
                    { v: Math.round(totHrs * 100) / 100, l: t("إجمالي ساعات", "Total hrs") },
                    { v: Math.round(totOt * 100) / 100, l: t("أوفرتايم", "Overtime") },
                  ].map((c, i) => (
                    <div key={i} className="rounded-xl bg-[#f4f8fb] p-2 text-center" style={{ border: "1px solid #e8eef4" }}>
                      <div className="text-xl font-black text-[#0E76AC] tabular-nums">{c.v}</div>
                      <div className="text-[11px] font-bold text-[#47759c]">{c.l}</div>
                    </div>
                  ))}
                </div>
                <div className="max-h-[55vh] overflow-auto rounded-xl" style={{ border: "1px solid #e8eef4" }}>
                  {detailRows.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-sm">{t("لا حضور مسجّل هذا الشهر", "No records this month")}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[#0E76AC] text-white text-xs">
                        <tr>
                          {[t("التاريخ", "Date"), t("اليوم", "Day"), t("دخول", "In"), t("خروج", "Out"), t("ساعات", "Hrs"), t("أوفر", "OT")].map((h, i) => (
                            <th key={i} className="px-2 py-2 font-bold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailRows.map((r) => (
                          <tr key={r._id} className="border-t border-gray-100 text-center odd:bg-[#f9fbfd]">
                            <td className="px-2 py-1.5 font-bold text-[#0f1516]" dir="ltr">{r.date}</td>
                            <td className="px-2 py-1.5 text-gray-500">{dow(r.date)}</td>
                            <td className="px-2 py-1.5 tabular-nums" dir="ltr">{r.checkIn || "—"}</td>
                            <td className="px-2 py-1.5 tabular-nums" dir="ltr">{r.checkOut || "—"}</td>
                            <td className="px-2 py-1.5 tabular-nums font-bold">{r.workedHours ?? "—"}</td>
                            <td className="px-2 py-1.5 tabular-nums font-bold text-[#0E76AC]">{r.otHours ? r.otHours : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ===== Reports & Print dialog ===== */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-[#0E76AC]" /> {t("تقارير الحضور والطباعة", "Attendance Reports & Print")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* النطاق */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{t("النطاق", "Scope")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {([["all", t("كل الموظفين", "All employees")], ["one", t("موظف واحد", "One employee")]] as const).map(([k, lbl]) => (
                  <button key={k} type="button" onClick={() => setRScope(k as any)}
                    className={cn("h-10 rounded-xl text-sm font-bold border transition-all", rScope === k ? "bg-[#0E76AC] text-white border-transparent" : "bg-gray-50 border-gray-200 text-gray-600")}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {rScope === "one" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">{t("اختر الموظف", "Choose employee")}</Label>
                <Input list="report-emps" value={rName} onChange={(e) => setRName(e.target.value)} placeholder={t("اكتب أو اختر", "Type or pick")} />
                <datalist id="report-emps">{emps.map((x) => <option key={x.name} value={x.name} />)}</datalist>
              </div>
            )}

            {/* الفترة */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{t("الفترة", "Period")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {([["month", t("شهر كامل", "Full month")], ["range", t("فترة مخصّصة", "Custom range")]] as const).map(([k, lbl]) => (
                  <button key={k} type="button" onClick={() => setRPeriod(k as any)}
                    className={cn("h-10 rounded-xl text-sm font-bold border transition-all", rPeriod === k ? "bg-[#0E76AC] text-white border-transparent" : "bg-gray-50 border-gray-200 text-gray-600")}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {rPeriod === "month" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">{t("الشهر", "Month")}</Label>
                <Input type="month" value={rMonth} onChange={(e) => setRMonth(e.target.value)} className="h-10" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs text-gray-500">{t("من", "From")}</Label><Input type="date" value={rFromD} onChange={(e) => setRFromD(e.target.value)} className="h-10" dir="ltr" /></div>
                <div className="space-y-1.5"><Label className="text-xs text-gray-500">{t("إلى", "To")}</Label><Input type="date" value={rToD} onChange={(e) => setRToD(e.target.value)} className="h-10" dir="ltr" /></div>
              </div>
            )}

            {/* معاينة */}
            <div className="rounded-xl bg-[#f4f8fb] px-3 py-2.5 text-xs font-bold text-[#47759c]" style={{ border: "1px solid #e8eef4" }}>
              {!validRange
                ? <span className="text-red-500">{t("تأكّد أن «من» قبل «إلى»", "Ensure From is before To")}</span>
                : reportData === undefined
                  ? t("جاري التحميل…", "Loading…")
                  : rScope === "one"
                    ? (rName
                        ? t(`${reportData?.days?.length || 0} يوم مسجّل لـ ${rName}`, `${reportData?.days?.length || 0} days for ${rName}`)
                        : t("اختر موظفًا", "Pick an employee"))
                    : t(`${reportData?.employees?.length || 0} موظف في الفترة`, `${reportData?.employees?.length || 0} employees in period`)}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handlePrintReport}
              disabled={!validRange || reportData === undefined || (rScope === "one" && !rName)}
              className="rounded-xl font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              <Printer className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("طباعة / PDF", "Print / PDF")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Work hours settings dialog ===== */}
      <Dialog open={hoursOpen} onOpenChange={(o) => { setHoursOpen(o); if (!o) wLoaded.current = false; }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-[#0E76AC]" /> {t("ساعات الدوام والأوفرتايم", "Work Hours & Overtime")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 leading-relaxed">
            {t("حدّد ساعات الدوام القياسية لكل موظف — الأوفرتايم = ساعات العمل الفعلية ناقص ساعاته. ومعامل الأوفرتايم للمطعم كله (ساعة الأوفرتايم = المعدّل الساعي × المعامل).",
               "Set each employee's standard hours — overtime = actual worked hours minus their standard. And the restaurant-wide overtime multiplier.")}
          </p>

          {/* معامل الأوفرتايم + تعيين سريع للكل */}
          <div className="flex flex-wrap items-end gap-3 py-2 border-y border-gray-100">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">{t("معامل الأوفرتايم (المطعم)", "OT multiplier")}</Label>
              <Input type="number" step="0.25" value={wOtRate} onChange={(e) => setWOtRate(e.target.value)} className="h-9 w-24" dir="ltr" />
            </div>
            <div className="flex-1" />
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">{t("تعيين الكل على", "Set all to")}</Label>
              <div className="flex gap-1">
                {[8, 9, 11].map((h) => (
                  <button key={h} onClick={() => setAllHours(h)} className="h-9 px-3 rounded-lg text-sm font-bold bg-[#e8f8fd] text-[#0E76AC] border border-[#cfe7f3] hover:bg-[#d7f0fa]">{h}</button>
                ))}
              </div>
            </div>
          </div>

          {/* قائمة الموظفين */}
          <div className="overflow-y-auto flex-1 -mx-1 px-1 mt-1">
            {!workCfg ? (
              <p className="text-sm text-gray-400 py-6 text-center">{t("جاري التحميل…", "Loading…")}</p>
            ) : workCfg.employees.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">{t("لا يوجد موظفون في كشف الرواتب.", "No employees in payroll.")}</p>
            ) : workCfg.employees.map((e: any) => {
              const DOW = isRtl
                ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
                : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const rest = wRest[e.name] || [];
              return (
                <div key={e.name} className="py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[#0f1516] truncate">{e.name}</div>
                      {e.designation && <div className="text-[10px] text-gray-400 truncate">{e.designation}</div>}
                    </div>
                    <div className="flex gap-1">
                      {[8, 9, 11].map((h) => (
                        <button key={h} onClick={() => setWHours((p) => ({ ...p, [e.name]: String(h) }))}
                          className={cn("h-8 w-8 rounded-lg text-xs font-bold border", Number(wHours[e.name]) === h ? "bg-[#0E76AC] text-white border-transparent" : "bg-gray-50 border-gray-200 text-gray-500")}>{h}</button>
                      ))}
                    </div>
                    <Input type="number" step="0.5" value={wHours[e.name] ?? ""} onChange={(ev) => setWHours((p) => ({ ...p, [e.name]: ev.target.value }))}
                      className="h-8 w-16 text-sm text-center" dir="ltr" />
                    <span className="text-[10px] text-gray-400 w-8">{t("ساعة", "hrs")}</span>
                  </div>
                  {/* أيام الإجازة الأسبوعية — الحضور فيها = كل الساعات أوفرتايم */}
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-[10px] font-bold text-gray-400 w-14 shrink-0">{t("الإجازة:", "Rest:")}</span>
                    {DOW.map((lbl, d) => (
                      <button key={d} onClick={() => toggleRest(e.name, d)}
                        className={cn("h-6 px-1.5 rounded-md text-[10px] font-bold border transition-all",
                          rest.includes(d) ? "bg-amber-500 text-white border-transparent" : "bg-gray-50 border-gray-200 text-gray-400")}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button onClick={() => saveWorkHours(false)} disabled={wBusy || !workCfg} variant="outline" className="rounded-xl font-bold border-[#3cc4f0] text-[#0E76AC]">
              {t("حفظ", "Save")}
            </Button>
            <Button onClick={() => saveWorkHours(true)} disabled={wBusy || !workCfg} className="rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              <RefreshCw className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2", wBusy && "animate-spin")} /> {t(`حفظ + إعادة حساب ${month}`, `Save + Recompute ${month}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Single add/edit dialog ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle>{t("تسجيل حضور", "Record Attendance")} — {date}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t("الموظف", "Employee")}</Label>
              <Input list="att-emps" value={form.name} onChange={(e) => {
                const found = emps.find((x) => x.name === e.target.value);
                setForm((f: any) => ({ ...f, name: e.target.value, designation: found?.designation || f.designation }));
              }} placeholder={t("اكتب أو اختر", "Type or pick")} />
              <datalist id="att-emps">{emps.map((x) => <option key={x.name} value={x.name} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label>{t("الحالة", "Status")}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STATUSES.map((s) => (
                  <button key={s.key} type="button" onClick={() => set("status", s.key)}
                    className={cn("h-9 rounded-lg text-xs font-bold border transition-all", form.status === s.key ? "text-white border-transparent" : "bg-gray-50 border-gray-200 text-gray-500")}
                    style={form.status === s.key ? { background: s.dot } : {}}>
                    {isRtl ? s.ar : s.en}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t("وقت الدخول", "Check In")}</Label><Input type="time" value={form.checkIn} onChange={(e) => set("checkIn", e.target.value)} dir="ltr" /></div>
              <div className="space-y-1.5"><Label>{t("وقت الخروج", "Check Out")}</Label><Input type="time" value={form.checkOut} onChange={(e) => set("checkOut", e.target.value)} dir="ltr" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.late} onChange={(e) => set("late", e.target.checked)} className="h-4 w-4 accent-[#0E76AC]" />
              {t("وصل متأخّر", "Arrived late")}
            </label>
            <div className="space-y-1.5"><Label>{t("ملاحظة (اختياري)", "Note (optional)")}</Label><Input value={form.note} onChange={(e) => set("note", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={saveOne} className="rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>{t("حفظ", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Bulk mark dialog ===== */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle>{t("تحضير جماعي", "Bulk Mark")} — {date}</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2 py-1">
            <span className="text-xs text-gray-500">{t("تعيين الكل:", "Set all:")}</span>
            {STATUSES.map((s) => (
              <button key={s.key} onClick={() => setAllStatus(s.key)} className={cn("text-[11px] font-bold px-2 py-1 rounded-full", s.cls)}>{isRtl ? s.ar : s.en}</button>
            ))}
          </div>
          <div className="overflow-y-auto flex-1 -mx-2 px-2">
            {emps.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">{t("لا يوجد موظفون في كشف الرواتب.", "No employees in payroll.")}</p>
            ) : emps.map((e) => {
              const cur = bulkRows[e.name] || { status: "present", checkIn: "", checkOut: "" };
              const already = marked.has(e.name);
              return (
                <div key={e.name} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-gray-50">
                  <div className="w-full sm:w-40 min-w-0">
                    <div className="text-sm font-bold text-[#0f1516] truncate">{e.name}{already && <span className="ml-1 text-[9px] text-emerald-500">●</span>}</div>
                    <div className="text-[10px] text-gray-400 truncate">{e.designation}</div>
                  </div>
                  <div className="flex gap-1">
                    {STATUSES.map((s) => (
                      <button key={s.key} onClick={() => setBulk(e.name, "status", s.key)}
                        className={cn("h-7 px-2 rounded-md text-[10px] font-bold border", cur.status === s.key ? "text-white border-transparent" : "bg-gray-50 border-gray-200 text-gray-400")}
                        style={cur.status === s.key ? { background: s.dot } : {}}>{isRtl ? s.ar : s.en}</button>
                    ))}
                  </div>
                  <Input type="time" value={cur.checkIn} onChange={(ev) => setBulk(e.name, "checkIn", ev.target.value)} className="h-7 w-24 text-xs" dir="ltr" />
                  <Input type="time" value={cur.checkOut} onChange={(ev) => setBulk(e.name, "checkOut", ev.target.value)} className="h-7 w-24 text-xs" dir="ltr" />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <span className="text-xs text-gray-400 flex-1 self-center">{emps.length} {t("موظف", "employees")}</span>
            <Button onClick={saveBulk} className="rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>{t("حفظ الكل", "Save All")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Biometric import dialog ===== */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5 text-[#0E76AC]" /> {t("استيراد من جهاز البصمة", "Import from Biometric Device")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-gray-500 leading-relaxed">
              {t("الصق تصدير الجهاز (Excel/CSV/سجلّ). كل سطر: الاسم، التاريخ، الوقت (أو أوقات). يتعرّف تلقائيًا على أول بصمة كدخول وآخر بصمة كخروج ويحسب الأوفرتايم.",
                 "Paste device export (Excel/CSV/log). Each line: name, date, time(s). First punch = check-in, last = check-out; OT computed automatically.")}
            </p>
            {/* ✅ رفع ملف Excel/CSV من تصدير الجهاز/iVMS */}
            <label className="flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed border-[#3cc4f0]/50 bg-[#e8f8fd]/40 text-[#0E76AC] text-sm font-bold cursor-pointer hover:bg-[#e8f8fd] transition-colors">
              <Upload className="h-4 w-4" />
              <span className="truncate max-w-[240px]">{importFileName || t("اختر ملف Excel / CSV", "Choose Excel / CSV file")}</span>
              <input type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
                onChange={(e) => onImportFile(e.target.files?.[0])} />
            </label>
            <div className="text-center text-[11px] text-gray-400">{t("— أو الصق النص —", "— or paste text —")}</div>
            <textarea
              value={importText} onChange={(e) => setImportText(e.target.value)} dir="ltr"
              placeholder={"Ahmed, 2026-07-07, 08:02\nAhmed, 2026-07-07, 18:35\nKhalid, 2026-07-07, 08:15\nKhalid, 2026-07-07, 19:40"}
              className="w-full h-40 rounded-xl border border-gray-200 p-3 text-xs font-mono focus:outline-none focus:border-[#3cc4f0]"
            />
            {/* ✅ خيار: الرواتب فقط */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={payrollOnly} onChange={(e) => setPayrollOnly(e.target.checked)} className="h-4 w-4 accent-[#0E76AC]" />
              <span className="font-semibold text-[#0f1516]">{t("المسجّلين في الرواتب فقط (تجاهل غيرهم)", "Payroll employees only (ignore others)")}</span>
            </label>
            {importText.trim() && (
              <>
                <div className={cn("text-xs font-bold rounded-lg px-3 py-2", parsed.length ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")}>
                  {parsed.length
                    ? t(`سيتم استيراد ${parsed.length} بصمة — ${parsedDays} يوم لـ ${parsedEmps} موظف`, `${parsed.length} punches — ${parsedDays} days for ${parsedEmps} employees`)
                    : t("لم يتم التعرّف على أي سجلّ مطابق", "No matching records recognized")}
                </div>
                {payrollOnly && mapped.ignored.length > 0 && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    {t(`تم تجاهل ${mapped.ignored.length} اسم غير مسجّل في الرواتب:`, `Ignored ${mapped.ignored.length} names not in payroll:`)}
                    <span className="text-amber-600"> {mapped.ignored.slice(0, 12).join("، ")}{mapped.ignored.length > 12 ? " …" : ""}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button disabled={!parsed.length || importing} onClick={runImport} className="rounded-xl font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              {importing ? t(`جارٍ الاستيراد… ${importProgress}%`, `Importing… ${importProgress}%`) : t("استيراد", "Import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
