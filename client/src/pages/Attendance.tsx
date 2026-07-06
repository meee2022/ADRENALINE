/**
 * @file client/src/pages/Attendance.tsx
 * @description الحضور اليومي للموظفين — يدوي + إدخال جماعي + استيراد جهاز البصمة + ترحيل للرواتب.
 * @convex convex/attendance.ts
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardHeader } from "@/components/DashboardHeader";
import { CalendarCheck, Plus, Trash2, Users, Fingerprint, ArrowRightLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

/** يحلّل نص مُلصق من جهاز البصمة إلى نقاط بصمة {name, date, time}. مرن: يقبل CSV/TSV/سجلّ خام. */
function parsePunches(text: string): { name: string; date: string; time: string }[] {
  const out: { name: string; date: string; time: string }[] = [];
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
    if (!form.name.trim()) { alert(t("اكتب اسم الموظف", "Enter employee name")); return; }
    try {
      await upsertM({
        name: form.name.trim(), designation: form.designation || undefined, date, status: form.status,
        checkIn: form.checkIn || undefined, checkOut: form.checkOut || undefined, late: !!form.late,
        note: form.note.trim() || undefined, source: "manual", sessionToken,
      });
      setDialogOpen(false);
    } catch (e: any) { alert(e?.message || t("فشل الحفظ", "Save failed")); }
  };
  const del = async (r: any) => {
    if (!confirm(t(`حذف حضور ${r.name}؟`, `Delete ${r.name}'s record?`))) return;
    try { await removeM({ id: r._id, sessionToken }); } catch (e: any) { alert(e?.message || "Error"); }
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
    catch (e: any) { alert(e?.message || t("فشل الحفظ", "Save failed")); }
  };

  // ---- Biometric import ----
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const parsed = useMemo(() => parsePunches(importText), [importText]);
  const parsedDays = useMemo(() => new Set(parsed.map((p) => p.name + "|" + p.date)).size, [parsed]);
  const parsedEmps = useMemo(() => new Set(parsed.map((p) => p.name)).size, [parsed]);
  const runImport = async () => {
    if (parsed.length === 0) { alert(t("لم يتم التعرّف على أي سجلّ", "No records recognized")); return; }
    try {
      const res: any = await importM({ punches: parsed, sessionToken });
      alert(t(`تم استيراد ${res.days} يوم لـ ${res.employees} موظف`, `Imported ${res.days} days for ${res.employees} employees`));
      setImportOpen(false); setImportText("");
    } catch (e: any) { alert(e?.message || t("فشل الاستيراد", "Import failed")); }
  };

  // ---- Sync to payroll ----
  const runSync = async () => {
    if (!confirm(t(`ترحيل حضور وأوفرتايم شهر ${month} إلى كشف الرواتب؟`, `Sync ${month} attendance & overtime to payroll?`))) return;
    try {
      const res: any = await syncM({ month, sessionToken });
      const msg = t(`تم تحديث ${res.updated} موظف في الرواتب`, `Updated ${res.updated} payroll rows`)
        + (res.unmatched?.length ? "\n" + t("غير مطابق: ", "Unmatched: ") + res.unmatched.join(", ") : "");
      alert(msg);
    } catch (e: any) { alert(e?.message || t("فشل الترحيل", "Sync failed")); }
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
                <div className="text-sm font-bold text-[#0f1516] truncate">{e.name}</div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-emerald-600 font-bold">{t("حضور", "P")} {e.workedDays}</span>
                  {e.absent > 0 && <span className="text-red-500 font-bold">{t("غياب", "A")} {e.absent}</span>}
                  {e.late > 0 && <span className="text-amber-600 font-bold">{t("تأخير", "L")} {e.late}</span>}
                </div>
                {e.otHours > 0 && (
                  <div className="mt-1 text-[11px] font-bold text-[#0E76AC]">{t("أوفرتايم", "OT")}: {e.otHours} {t("ساعة", "h")}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
              <div className="grid grid-cols-4 gap-2">
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
            <textarea
              value={importText} onChange={(e) => setImportText(e.target.value)} dir="ltr"
              placeholder={"Ahmed, 2026-07-07, 08:02\nAhmed, 2026-07-07, 18:35\nKhalid, 2026-07-07, 08:15\nKhalid, 2026-07-07, 19:40"}
              className="w-full h-40 rounded-xl border border-gray-200 p-3 text-xs font-mono focus:outline-none focus:border-[#3cc4f0]"
            />
            {importText.trim() && (
              <div className={cn("text-xs font-bold rounded-lg px-3 py-2", parsed.length ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")}>
                {parsed.length
                  ? t(`تم التعرّف على ${parsed.length} بصمة — ${parsedDays} يوم لـ ${parsedEmps} موظف`, `${parsed.length} punches — ${parsedDays} days for ${parsedEmps} employees`)
                  : t("لم يتم التعرّف على أي سجلّ — تأكد من وجود التاريخ والوقت", "No records recognized — check date & time format")}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button disabled={!parsed.length} onClick={runImport} className="rounded-xl font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              {t("استيراد", "Import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
