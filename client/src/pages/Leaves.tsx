/**
 * @file client/src/pages/Leaves.tsx
 * @description إجازات الموظفين — سنوية/مرضية/بدون راتب/طارئة + رصيد + إضافة/تعديل/حذف (للمدير).
 * @convex convex/leaves.ts
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
import { CalendarDays, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPES = [
  { key: "annual", ar: "سنوية", en: "Annual", cls: "bg-[#e8f8fd] text-[#0E76AC]" },
  { key: "sick", ar: "مرضية", en: "Sick", cls: "bg-amber-50 text-amber-700" },
  { key: "travel", ar: "سفر", en: "Travel", cls: "bg-cyan-50 text-cyan-700" },
  { key: "unpaid", ar: "بدون راتب", en: "Unpaid", cls: "bg-red-50 text-red-700" },
  { key: "emergency", ar: "طارئة", en: "Emergency", cls: "bg-purple-50 text-purple-700" },
  { key: "other", ar: "أخرى", en: "Other", cls: "bg-gray-100 text-gray-600" },
];
const typeInfo = (k: string) => TYPES.find((t) => t.key === k) || TYPES[4];

const emptyForm = { name: "", type: "annual", startDate: "", endDate: "", days: "", paid: true, reason: "" };
const daysBetween = (a: string, b: string) => {
  if (!a || !b) return 0;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
  return d > 0 ? d : 0;
};

export default function Leaves() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const isAdmin = useStore((s) => s.currentUser?.role) === "ADMIN";

  const rows = (useQuery(api.leaves.list, { sessionToken }) as any[] | undefined) || [];
  const summary = useQuery(api.leaves.summary, { sessionToken }) as any;
  const names = (useQuery(api.leaves.employeeNames, { sessionToken }) as string[] | undefined) || [];

  const createM = useMutation(api.leaves.create);
  const updateM = useMutation(api.leaves.update);
  const removeM = useMutation(api.leaves.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const set = (k: string, v: any) => setForm((f: any) => {
    const next = { ...f, [k]: v };
    if (k === "startDate" || k === "endDate") next.days = String(daysBetween(next.startDate, next.endDate) || "");
    return next;
  });

  const openAdd = () => { setEditingId(null); setForm({ ...emptyForm }); setDialogOpen(true); };
  const openEdit = (r: any) => {
    setEditingId(r._id);
    setForm({ name: r.name, type: r.type, startDate: r.startDate, endDate: r.endDate, days: String(r.days), paid: r.paid, reason: r.reason || "" });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) { void alertDialog({ message: t("املأ الاسم والتواريخ", "Fill name and dates") }); return; }
    const payload: any = {
      name: form.name.trim(), type: form.type, startDate: form.startDate, endDate: form.endDate,
      days: Number(form.days) || daysBetween(form.startDate, form.endDate), paid: !!form.paid,
      reason: form.reason.trim() || undefined, sessionToken,
    };
    try {
      if (editingId) await updateM({ id: editingId as any, ...payload });
      else await createM(payload);
      setDialogOpen(false);
    } catch (e: any) { void alertDialog({ message: e?.message || t("فشل الحفظ", "Save failed") }); }
  };
  const del = async (r: any) => {
    if (!(await confirmDialog({ message: t(`حذف إجازة ${r.name}؟`, `Delete ${r.name}'s leave?`), variant: "danger", confirmText: isRtl ? "حذف" : "Delete" }))) return;
    try { await removeM({ id: r._id, sessionToken }); } catch (e: any) { void alertDialog({ message: e?.message || "Error" }); }
  };

  const fmt = (d: string) => d;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6">
      <DashboardHeader
        icon={<CalendarDays className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="الإجازات" titleEn="Leaves"
        subtitleAr="إجازات الموظفين والأرصدة" subtitleEn="Employee leaves & balances"
        kpis={summary ? [
          { value: summary.totalRecords, labelAr: "إجمالي الإجازات", labelEn: "Records" },
          { value: summary.onLeaveNow, labelAr: "في إجازة الآن", labelEn: "On Leave Now" },
          { value: summary.annualUsed, labelAr: "أيام سنوية مستخدمة", labelEn: "Annual Used" },
          { value: summary.sickDays, labelAr: "أيام مرضية", labelEn: "Sick Days" },
        ] : undefined}
        actions={isAdmin ? (
          <Button onClick={openAdd} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm">
            <Plus className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("إجازة جديدة", "Add Leave")}
          </Button>
        ) : undefined}
      />

      {/* Per-employee annual balance */}
      {summary?.employees?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {summary.employees.map((e: any) => (
            <div key={e.name} className="bg-white rounded-2xl p-3" style={{ border: "1px solid #e8eef4" }}>
              <div className="text-sm font-bold text-[#0f1516] truncate">{e.name}</div>
              <div className="flex items-end justify-between mt-1">
                <div>
                  <span className="text-2xl font-black tabular-nums text-[#0E76AC]">{e.annualRemaining}</span>
                  <span className="text-xs text-gray-400"> / {e.annualEntitlement}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-semibold">{t("رصيد سنوي", "Annual left")}</div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (e.annualRemaining / e.annualEntitlement) * 100)}%`, background: "linear-gradient(90deg,#3cc4f0,#0E76AC)" }} />
              </div>
              {(e.sick > 0 || e.unpaid > 0) && (
                <div className="text-[10px] text-gray-400 mt-1">
                  {e.sick > 0 && <span>{t("مرضية", "Sick")}: {e.sick} </span>}
                  {e.unpaid > 0 && <span className="text-red-500">{t("بدون راتب", "Unpaid")}: {e.unpaid}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Leaves table */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px solid #e8eef4" }}>
          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-[#3cc4f0]" />
          {!sessionToken ? (
            <p className="text-sm text-gray-500">{t("سجّل خروج ودخول مرة أخرى لعرض الإجازات.", "Sign out and back in to view leaves.")}</p>
          ) : (
            <p className="text-gray-600 font-semibold">{t("لا توجد إجازات مسجّلة", "No leaves recorded yet")}</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-[#f4f8fb] text-[#47759c]">
                  {[t("الموظف", "Employee"), t("النوع", "Type"), t("من", "From"), t("إلى", "To"), t("أيام", "Days"), t("مدفوعة", "Paid"), t("السبب", "Reason")].map((h, i) => (
                    <th key={i} className={cn("px-3 py-3 font-bold text-xs uppercase", i === 0 || i === 6 ? (isRtl ? "text-right" : "text-left") : "text-center")}>{h}</th>
                  ))}
                  {isAdmin && <th className="px-3 py-3 text-center text-xs font-bold uppercase">{t("إجراء", "")}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ti = typeInfo(r.type);
                  return (
                    <tr key={r._id} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                      <td className={cn("px-3 py-2.5 font-bold text-[#0f1516]", isRtl ? "text-right" : "text-left")}>{r.name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", ti.cls)}>{isRtl ? ti.ar : ti.en}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-gray-600">{fmt(r.startDate)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-gray-600">{fmt(r.endDate)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-black text-[#0f1516]">{r.days}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.paid ? <span className="text-[11px] font-bold text-emerald-600">{t("نعم", "Yes")}</span> : <span className="text-[11px] font-bold text-red-500">{t("لا", "No")}</span>}
                      </td>
                      <td className={cn("px-3 py-2.5 text-gray-500 text-xs max-w-[180px] truncate", isRtl ? "text-right" : "text-left")}>{r.reason || "—"}</td>
                      {isAdmin && (
                        <td className="px-3 py-2.5 text-center">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingId ? t("تعديل إجازة", "Edit Leave") : t("إجازة جديدة", "New Leave")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t("الموظف", "Employee")}</Label>
              <Input list="emp-names" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("اكتب أو اختر", "Type or pick")} />
              <datalist id="emp-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label>{t("نوع الإجازة", "Leave type")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((ty) => (
                  <button key={ty.key} type="button" onClick={() => set("type", ty.key)}
                    className={cn("h-9 rounded-lg text-xs font-bold border transition-all", form.type === ty.key ? "text-white border-transparent" : "bg-gray-50 border-gray-200 text-gray-500")}
                    style={form.type === ty.key ? { background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" } : {}}>
                    {isRtl ? ty.ar : ty.en}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("من", "From")}</Label>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("إلى", "To")}</Label>
                <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("عدد الأيام", "Days")}</Label>
                <Input type="number" value={form.days} onChange={(e) => set("days", e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("مدفوعة؟", "Paid?")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: true, ar: "نعم", en: "Yes" }, { v: false, ar: "لا", en: "No" }].map((o) => (
                    <button key={String(o.v)} type="button" onClick={() => set("paid", o.v)}
                      className={cn("h-10 rounded-lg text-sm font-bold border", form.paid === o.v ? "text-white border-transparent" : "bg-gray-50 border-gray-200 text-gray-500")}
                      style={form.paid === o.v ? { background: o.v ? "#10b981" : "#ef4444" } : {}}>
                      {isRtl ? o.ar : o.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("السبب (اختياري)", "Reason (optional)")}</Label>
              <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} />
            </div>
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
