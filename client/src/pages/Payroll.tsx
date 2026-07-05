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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Banknote, Plus, Pencil, Trash2, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

const money = (n: number) => (n || 0).toLocaleString("en-US");

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
    if (!form.name.trim()) { alert(t("أدخل الاسم", "Enter a name")); return; }
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
    } catch (e: any) { alert(e?.message || t("فشل الحفظ", "Save failed")); }
  };

  const del = async (r: any) => {
    if (!confirm(t(`حذف ${r.name}؟`, `Delete ${r.name}?`))) return;
    try { await removeM({ id: r._id, sessionToken }); } catch (e: any) { alert(e?.message || "Error"); }
  };

  // livePreview الحقول المشتقة داخل الديالوج
  const dPkg = (Number(form.basic) || 0) + (Number(form.allowance) || 0);
  const dSalary = Math.round((dPkg * Math.min(Number(form.days) || 0, 31)) / 31);
  const dTotal = dSalary + (Number(form.overtime) || 0);
  const dBalance = dTotal - (Number(form.advance) || 0) - (Number(form.paid) || 0);

  const cols = [
    { k: "sr", ar: "#", en: "#" },
    { k: "name", ar: "الاسم", en: "Name" },
    { k: "designation", ar: "الوظيفة", en: "Designation" },
    { k: "basic", ar: "الأساسي", en: "Basic" },
    { k: "allowance", ar: "البدل", en: "Allow." },
    { k: "days", ar: "أيام", en: "Days" },
    { k: "package", ar: "الباقة", en: "Package" },
    { k: "salary", ar: "الراتب", en: "Salary" },
    { k: "overtime", ar: "إضافي", en: "OT" },
    { k: "total", ar: "الإجمالي", en: "Total" },
    { k: "advance", ar: "سلفة", en: "Advance" },
    { k: "paid", ar: "مدفوع", en: "Paid" },
    { k: "balance", ar: "الرصيد", en: "Balance" },
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6 print:space-y-2">
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
          <p className="text-gray-600 font-semibold">
            {t("لا توجد بيانات رواتب لهذا الشهر", "No payroll data for this month")}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-[#f4f8fb] text-[#47759c]">
                  {cols.map((c) => (
                    <th key={c.k} className={cn("px-3 py-3 font-bold text-xs uppercase", ["name", "designation"].includes(c.k) ? (isRtl ? "text-right" : "text-left") : "text-center")}>
                      {isRtl ? c.ar : c.en}
                    </th>
                  ))}
                  {isAdmin && <th className="px-3 py-3 text-center text-xs font-bold uppercase print:hidden">{t("إجراء", "")}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r._id} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                    <td className="px-3 py-2.5 text-center text-gray-400 font-semibold">{i + 1}</td>
                    <td className={cn("px-3 py-2.5 font-bold text-[#0f1516]", isRtl ? "text-right" : "text-left")}>{r.name}</td>
                    <td className={cn("px-3 py-2.5 text-gray-500 text-xs", isRtl ? "text-right" : "text-left")}>{r.designation}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{money(r.basic)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{r.allowance ? money(r.allowance) : "—"}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{r.days}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-semibold">{money(r.package)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{money(r.salary)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-[#0E76AC]">{r.overtime ? money(r.overtime) : "—"}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-black text-[#0f1516]">{money(r.total)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{r.advance ? money(r.advance) : "—"}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{r.paid ? money(r.paid) : "—"}</td>
                    <td className={cn("px-3 py-2.5 text-center tabular-nums font-black", r.balance < 0 ? "text-red-600" : r.balance > 0 ? "text-emerald-600" : "text-gray-400")}>
                      {money(r.balance)}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2.5 text-center print:hidden">
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
                  <tr className="border-t-2 border-[#e8eef4] bg-[#f4f8fb] font-black text-[#0f1516]">
                    <td className="px-3 py-3" colSpan={3}>{t("الإجمالي", "TOTAL")}</td>
                    <td></td><td></td><td></td>
                    <td className="px-3 py-3 text-center tabular-nums">{money(summary.package)}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{money(summary.salary)}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{money(summary.overtime)}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{money(summary.total)}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{money(summary.advance)}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{money(summary.paid)}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{money(summary.balance)}</td>
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
          {/* Live derived preview */}
          <div className="grid grid-cols-4 gap-2 rounded-xl p-3" style={{ background: "#f4f8fb" }}>
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
    </div>
  );
}
