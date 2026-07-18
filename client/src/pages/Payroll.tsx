/**
 * @file client/src/pages/Payroll.tsx
 * @description قسم رواتب الموظفين — جدول كامل + إجماليات + إضافة/تعديل (للمدير) + طباعة.
 * @convex convex/payroll.ts
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Banknote, Plus, Pencil, Trash2, Printer, Clock4 } from "lucide-react";
import { cn } from "@/lib/utils";

const money = (n: number) => (n || 0).toLocaleString("en-US");

// دوام العمل: 9 ساعات/يوم — يُستخدم لحساب سعر الساعة والأوفرتايم
const WORK_HOURS_PER_DAY = 9;
const DAYS_PER_MONTH = 30;

const emptyForm = {
  name: "", designation: "", basic: "", allowance: "", days: "31",
  overtime: "", advance: "", paid: "", otHours: "", fridays: "",
};

export default function Payroll() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const isAdmin = useStore((s) => s.currentUser?.role) === "ADMIN";

  const months = (useQuery(api.payroll.months, { sessionToken }) as string[] | undefined) || [];
  const [month, setMonth] = useState<string>("");
  const activeMonth = month || months[0] || "2026-05";

  const rows = (useQuery(api.payroll.list, { month: activeMonth, sessionToken }) as any[] | undefined) || [];
  const summary = useQuery(api.payroll.summary, { month: activeMonth, sessionToken }) as any;

  const createM = useMutation(api.payroll.create);
  const updateM = useMutation(api.payroll.update);
  const removeM = useMutation(api.payroll.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  // معدّل الأوفرتايم (قابل للتعديل) — 1.25 = +25% (قانون العمل القطري لأيام الأسبوع)
  const [otRate, setOtRate] = useState("1.25");

  // ─── أوفرتايم جماعي ───
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRate, setBulkRate] = useState("1.25");
  const [bulkFilter, setBulkFilter] = useState<"all" | "kitchen" | "delivery">("kitchen");
  const [bulkHours, setBulkHours] = useState<Record<string, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const isKitchen = (d: string) => /chef|cdp|helper|kitchen|cleaner|butcher|grill|salad|dessert|desert|iftar|iftikar|store/i.test(d || "");
  const isDelivery = (d: string) => /driver|delivery|توصيل|سائق/i.test(d || "");
  const bulkRows = rows.filter((r: any) =>
    bulkFilter === "all" ? true : bulkFilter === "kitchen" ? isKitchen(r.designation) : isDelivery(r.designation));

  const bulkOTFor = (r: any) => {
    const hrs = Number(bulkHours[r._id]) || 0;
    const hourly = (r.package || 0) / (DAYS_PER_MONTH * WORK_HOURS_PER_DAY);
    return { hrs, amount: Math.round(hrs * hourly * (Number(bulkRate) || 1)) };
  };

  const saveBulk = async () => {
    const targets = bulkRows.filter((r: any) => (Number(bulkHours[r._id]) || 0) > 0);
    if (!targets.length) { void alertDialog({ message: t("أدخل ساعات لموظف واحد على الأقل", "Enter hours for at least one employee") }); return; }
    setBulkSaving(true);
    try {
      for (const r of targets) {
        const { hrs, amount } = bulkOTFor(r);
        await updateM({ id: r._id, otHours: hrs, overtime: amount, sessionToken });
      }
      setBulkHours({});
      setBulkOpen(false);
    } catch (e: any) { void alertDialog({ message: e?.message || t("فشل الحفظ", "Save failed") }); }
    finally { setBulkSaving(false); }
  };

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    const namesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const namesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const i = (parseInt(mo) || 1) - 1;
    return `${isRtl ? namesAr[i] : namesEn[i]} ${y}`;
  };

  const openAdd = () => { setEditingId(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (r: any) => {
    setEditingId(r._id);
    setForm({
      name: r.name, designation: r.designation, basic: String(r.basic), allowance: String(r.allowance),
      days: String(r.days), overtime: String(r.overtime), advance: String(r.advance), paid: String(r.paid),
      otHours: r.otHours != null ? String(r.otHours) : "", fridays: r.fridays != null ? String(r.fridays) : "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { void alertDialog({ message: t("أدخل الاسم", "Enter a name") }); return; }
    const num = (v: string) => Number(v) || 0;
    const payload: any = {
      name: form.name.trim(), designation: form.designation.trim(),
      basic: num(form.basic), allowance: num(form.allowance), days: num(form.days),
      overtime: num(form.overtime), advance: num(form.advance), paid: num(form.paid),
      otHours: num(form.otHours), fridays: num(form.fridays), month: activeMonth, sessionToken,
    };
    try {
      if (editingId) await updateM({ id: editingId as any, ...payload });
      else await createM(payload);
      setDialogOpen(false);
    } catch (e: any) { void alertDialog({ message: e?.message || t("فشل الحفظ", "Save failed") }); }
  };

  const del = async (r: any) => {
    if (!(await confirmDialog({
      title: t("تأكيد الحذف", "Confirm Delete"),
      message: t(`حذف ${r.name}؟`, `Delete ${r.name}?`),
      variant: "danger",
      confirmText: t("حذف", "Delete"),
    }))) return;
    try { await removeM({ id: r._id, sessionToken }); } catch (e: any) { void alertDialog({ message: e?.message || "Error" }); }
  };

  // livePreview الحقول المشتقة داخل الديالوج
  const dPkg = (Number(form.basic) || 0) + (Number(form.allowance) || 0);
  const dSalary = Math.round((dPkg * Math.min(Number(form.days) || 0, 31)) / 31);
  const dTotal = dSalary + (Number(form.overtime) || 0);
  const dBalance = dTotal - (Number(form.advance) || 0) - (Number(form.paid) || 0);

  // حاسبة الأوفرتايم: سعر الساعة = الباقة ÷ (30 يوم × 9 ساعات) ثم × المعدّل
  const hourlyRate = dPkg / (DAYS_PER_MONTH * WORK_HOURS_PER_DAY);
  const otHoursNum = Number(form.otHours) || 0;
  const rateNum = Number(otRate) || 1;
  const suggestedOT = Math.round(otHoursNum * hourlyRate * rateNum);

  // ألوان ثابتة لأيقونة كل موظف حسب أول حرف
  const avatarBg = (name: string) => {
    const g = ["linear-gradient(135deg,#3cc4f0,#0E76AC)", "linear-gradient(135deg,#8b5cf6,#6d28d9)", "linear-gradient(135deg,#10b981,#047857)", "linear-gradient(135deg,#f59e0b,#b45309)", "linear-gradient(135deg,#47759c,#2d5c82)"];
    let s = 0; for (const c of name) s += c.charCodeAt(0);
    return g[s % g.length];
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6 print:space-y-2">
      <h1 className="sr-only">{t("الرواتب", "Payroll")}</h1>
      <div className="print:hidden">
        <DashboardHeader
          icon={<Banknote className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="الرواتب" titleEn="Payroll"
          subtitleAr={`كشف رواتب ${monthLabel(activeMonth)}`} subtitleEn={`Salary sheet — ${monthLabel(activeMonth)}`}
          kpis={summary ? [
            { value: summary.headcount, labelAr: "موظف", labelEn: "Employees" },
            { value: money(summary.total), labelAr: "إجمالي الرواتب", labelEn: "Total Salary" },
            { value: money(summary.paid), labelAr: "المدفوع", labelEn: "Paid" },
            { value: money(summary.balance), labelAr: "المتبقّي", labelEn: "Balance" },
          ] : undefined}
          actions={
            <>
              <Button onClick={() => window.print()} className="h-11 rounded-xl font-bold text-white shadow-lg text-sm backdrop-blur-md"
                style={{ background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)" }}>
                <Printer className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("طباعة", "Print")}
              </Button>
              {isAdmin && (
                <Button onClick={() => { setBulkHours({}); setBulkOpen(true); }} className="h-11 rounded-xl font-bold text-white shadow-lg text-sm backdrop-blur-md"
                  style={{ background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)" }}>
                  <Clock4 className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("أوفرتايم جماعي", "Bulk OT")}
                </Button>
              )}
              {isAdmin && (
                <Button onClick={openAdd} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm">
                  <Plus className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("موظف جديد", "Add Employee")}
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* Month tabs */}
      {months.length > 1 && (
        <div className="flex gap-2 flex-wrap print:hidden">
          {months.map((m) => (
            <button key={m} onClick={() => setMonth(m)}
              className={cn("px-4 h-9 rounded-xl text-sm font-bold transition-all",
                m === activeMonth ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
              style={m === activeMonth ? { background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" } : {}}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
      )}

      {/* Not authorized / empty */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px solid #e8eef4" }}>
          <Banknote className="h-10 w-10 mx-auto mb-3 text-[#3cc4f0]" />
          {!sessionToken ? (
            <>
              <p className="text-gray-700 font-bold mb-1">
                {t("جلستك تحتاج تحديثاً", "Your session needs a refresh")}
              </p>
              <p className="text-sm text-gray-500">
                {t("بعد ترقية الأمان — سجّل خروج ودخول مرة أخرى لعرض بيانات الرواتب.",
                   "After the security upgrade — please sign out and back in to view payroll.")}
              </p>
            </>
          ) : (
            <p className="text-gray-600 font-semibold">
              {t("لا توجد بيانات رواتب لهذا الشهر", "No payroll data for this month")}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap border-collapse">
              <thead>
                <tr className="bg-[#f4f8fb] text-[#47759c] sticky top-0 z-10">
                  <th className="px-2 py-3 text-center text-[11px] font-bold w-10">#</th>
                  <th className={cn("px-3 py-3 text-[11px] font-bold uppercase", isRtl ? "text-right" : "text-left")}>{t("الموظف", "Employee")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase">{t("الأساسي", "Basic")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase">{t("البدل", "Allow.")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase">{t("أيام", "Days")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase">{t("الباقة", "Package")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase">{t("الراتب", "Salary")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase text-[#0E76AC]">{t("إضافي", "OT")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-black uppercase text-[#0f1516]">{t("الإجمالي", "Total")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase border-s-2 border-[#dbe7f2]">{t("سلفة", "Advance")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase">{t("مدفوع", "Paid")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase">{t("الرصيد", "Balance")}</th>
                  {isAdmin && <th className="px-3 py-3 text-center text-[11px] font-bold uppercase print:hidden">{t("إجراء", "")}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r._id} className={cn("border-t border-gray-100 hover:bg-[#eef7fd] transition-colors", i % 2 === 1 && "bg-[#fafcff]")}>
                    <td className="px-2 py-2 text-center text-gray-300 font-bold tabular-nums">{i + 1}</td>
                    <td className={cn("px-3 py-2", isRtl ? "text-right" : "text-left")}>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0" style={{ background: avatarBg(r.name) }}>
                          {(r.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#0f1516] leading-tight truncate max-w-[160px]">{r.name}</div>
                          <div className="text-[11px] text-gray-400 leading-tight truncate max-w-[160px]">{r.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-400">{money(r.basic)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-400">{r.allowance ? money(r.allowance) : "—"}</td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", r.days >= 31 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>{r.days}</span>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-500">{money(r.package)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-600 font-semibold">{money(r.salary)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-[#0E76AC] font-semibold">{r.overtime ? money(r.overtime) : "—"}</td>
                    <td className="px-3 py-2 text-center tabular-nums font-black text-[#0f1516] bg-[#f7fbfe]">{money(r.total)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-500 border-s-2 border-[#eef3f8]">{r.advance ? money(r.advance) : "—"}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-500">{r.paid ? money(r.paid) : "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn("inline-block min-w-[54px] tabular-nums text-xs font-black px-2.5 py-1 rounded-full",
                        r.balance < 0 ? "bg-red-50 text-red-600" : r.balance > 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400")}>
                        {money(r.balance)}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-gray-200 text-gray-500 hover:text-[#0E76AC] hover:border-[#3cc4f0]" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300" onClick={() => del(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {summary && (
                  <tr className="border-t-2 border-[#dbe7f2] bg-[#eef4fa] font-black text-[#0E2A4A]">
                    <td className="px-3 py-3.5" colSpan={2}>{t("الإجمالي", "TOTAL")}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums text-gray-400">{money(rows.reduce((s: number, r: any) => s + (r.basic || 0), 0))}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums text-gray-400">{money(rows.reduce((s: number, r: any) => s + (r.allowance || 0), 0))}</td>
                    <td></td>
                    <td className="px-3 py-3.5 text-center tabular-nums">{money(summary.package)}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums">{money(summary.salary)}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums text-[#0E76AC]">{money(summary.overtime)}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums bg-[#e3eef7]">{money(summary.total)}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums border-s-2 border-[#dbe7f2]">{money(summary.advance)}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums">{money(summary.paid)}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums">{money(summary.balance)}</td>
                    {isAdmin && <td className="print:hidden"></td>}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingId ? t("تعديل موظف", "Edit Employee") : t("موظف جديد", "New Employee")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>{t("الاسم", "Name")}</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{t("الوظيفة", "Designation")}</Label>
              <Input value={form.designation} onChange={(e) => set("designation", e.target.value)} />
            </div>
            {[
              { k: "basic", ar: "الأساسي", en: "Basic" },
              { k: "allowance", ar: "البدل", en: "Allowance" },
              { k: "days", ar: "أيام العمل", en: "Days" },
              { k: "overtime", ar: "الإضافي (مبلغ)", en: "Overtime" },
              { k: "advance", ar: "سلفة", en: "Advance" },
              { k: "paid", ar: "المدفوع", en: "Paid" },
              { k: "otHours", ar: "ساعات إضافي", en: "OT Hours" },
              { k: "fridays", ar: "أيام الجمعة", en: "Fridays" },
            ].map((f) => (
              <div key={f.k} className="space-y-1.5">
                <Label className="text-xs">{isRtl ? f.ar : f.en}</Label>
                <Input type="number" value={(form as any)[f.k]} onChange={(e) => set(f.k, e.target.value)} dir="ltr" />
              </div>
            ))}
          </div>
          {/* OT calculator — دوام 9 ساعات */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "#eef9fe", border: "1px solid #3cc4f033" }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-bold text-[#0E76AC]">
                {t("حاسبة الأوفرتايم (دوام 9 ساعات)", "Overtime calculator (9-hour shift)")}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-gray-500">{t("المعدّل ×", "Rate ×")}</Label>
                <Input value={otRate} onChange={(e) => setOtRate(e.target.value)} type="number" step="0.05" dir="ltr" className="h-8 w-20 text-center" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#47759c]">
              <span>{t("سعر الساعة", "Hourly")}: <b className="text-[#0E76AC]">{hourlyRate.toFixed(2)}</b> {t("ر.ق", "QAR")}</span>
              <span>{otHoursNum} {t("ساعة", "hrs")} × {rateNum} = <b className="text-[#0E76AC]">{money(suggestedOT)}</b> {t("ر.ق", "QAR")}</span>
            </div>
            <Button type="button" onClick={() => set("overtime", String(suggestedOT))}
              className="w-full h-9 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              {t(`طبّق الأوفرتايم المحسوب (${money(suggestedOT)} ر.ق)`, `Apply calculated OT (${money(suggestedOT)} QAR)`)}
            </Button>
          </div>

          {/* Live derived preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl p-3" style={{ background: "#f4f8fb" }}>
            {[
              { l: t("الباقة", "Package"), v: dPkg },
              { l: t("الراتب", "Salary"), v: dSalary },
              { l: t("الإجمالي", "Total"), v: dTotal },
              { l: t("الرصيد", "Balance"), v: dBalance },
            ].map((x, i) => (
              <div key={i} className="text-center">
                <div className={cn("text-base font-black tabular-nums", i === 3 && dBalance < 0 ? "text-red-600" : "text-[#0E76AC]")}>{money(x.v)}</div>
                <div className="text-[10px] text-gray-400 font-semibold">{x.l}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={save} className="rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              {t("حفظ", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk overtime dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Clock4 className="h-5 w-5 text-[#0E76AC]" /> {t("إدخال أوفرتايم جماعي", "Bulk Overtime Entry")}
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 space-y-3">
            {/* group filter + rate */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-1.5">
                {([
                  { k: "kitchen", ar: "المطبخ", en: "Kitchen" },
                  { k: "delivery", ar: "التوصيل", en: "Delivery" },
                  { k: "all", ar: "الكل", en: "All" },
                ] as const).map((g) => (
                  <button key={g.k} onClick={() => setBulkFilter(g.k)}
                    className={cn("px-3 h-8 rounded-lg text-xs font-bold transition-all", bulkFilter === g.k ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
                    style={bulkFilter === g.k ? { background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" } : {}}>
                    {isRtl ? g.ar : g.en}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-gray-500">{t("المعدّل ×", "Rate ×")}</Label>
                <Input value={bulkRate} onChange={(e) => setBulkRate(e.target.value)} type="number" step="0.05" dir="ltr" className="h-8 w-20 text-center" />
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              {t("اكتب عدد ساعات الأوفرتايم لكل موظف — والمبلغ يُحسب تلقائيًا (باقة ÷ 270 × ساعات × المعدّل).",
                 "Enter OT hours per employee — the amount is auto-computed (package ÷ 270 × hours × rate).")}
            </p>
          </div>

          {/* employee list with hours inputs */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1.5">
            {bulkRows.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">{t("لا يوجد موظفون في هذه المجموعة", "No employees in this group")}</p>
            ) : bulkRows.map((r: any) => {
              const { amount } = bulkOTFor(r);
              return (
                <div key={r._id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "#f7fbfe", border: "1px solid #eef3f8" }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#0f1516] truncate">{r.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{r.designation}</div>
                  </div>
                  {amount > 0 && <div className="text-xs font-black text-[#0E76AC] tabular-nums">{money(amount)} {t("ر.ق", "QAR")}</div>}
                  <Input type="number" placeholder={t("ساعات", "hrs")} dir="ltr"
                    value={bulkHours[r._id] || ""} onChange={(e) => setBulkHours((h) => ({ ...h, [r._id]: e.target.value }))}
                    className="h-9 w-24 text-center" />
                </div>
              );
            })}
          </div>

          <DialogFooter className="p-5 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between w-full gap-3">
              <span className="text-xs text-gray-400">
                {bulkRows.filter((r: any) => (Number(bulkHours[r._id]) || 0) > 0).length} {t("موظف محدّد", "selected")}
              </span>
              <Button onClick={saveBulk} disabled={bulkSaving} className="rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
                {bulkSaving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ الكل", "Save All")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
