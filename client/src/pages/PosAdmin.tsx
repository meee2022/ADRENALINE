/**
 * @file client/src/pages/PosAdmin.tsx
 * @description إدارة POS (للأدمن): الكاشيرون، الفئات، ألوان الأصناف، التقارير، الورديات.
 * @convex convex/posAdmin.ts
 */
import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Store, Users, LayoutGrid, Palette, BarChart3, Clock, Plus, Save, Trash2, RefreshCw, Link as LinkIcon, ExternalLink, TrendingUp, ShieldCheck, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Tab = "overview" | "branches" | "cashiers" | "categories" | "items" | "reports" | "profit" | "audit" | "shifts";

export default function PosAdmin() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<Store className="h-6 w-6" />}
          titleAr="إدارة نقطة البيع"
          titleEn="POS Admin"
          subtitleAr="الكاشيرون · الأصناف · التقارير · الورديات"
          subtitleEn="Cashiers · Items · Reports · Shifts"
          actions={
            <a href="/pos" target="_blank" rel="noreferrer">
              <Button className="text-white font-bold" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
                <ExternalLink className="h-4 w-4 me-1" /> {t("افتح شل الكاشير", "Open Cashier Shell")}
              </Button>
            </a>
          }
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-10">
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
          {([
            ["overview",   BarChart3,    t("نظرة عامة", "Overview")],
            ["branches",   Building2,    t("الفروع",     "Branches")],
            ["cashiers",   Users,        t("الكاشيرون",  "Cashiers")],
            ["categories", LayoutGrid,   t("الفئات",     "Categories")],
            ["items",      Palette,      t("الأصناف",    "Items")],
            ["reports",    BarChart3,    t("التقارير",   "Reports")],
            ["profit",     TrendingUp,   t("الربحية",    "Profit")],
            ["audit",      ShieldCheck,  t("سجل التدقيق","Audit")],
            ["shifts",     Clock,        t("الورديات",   "Shifts")],
          ] as [Tab, any, string][]).map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center justify-center gap-2 h-11 rounded-xl text-xs sm:text-sm font-bold transition-all",
                tab === k ? "bg-[#0E76AC] text-white shadow-md" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "overview"   && <OverviewTab   t={t} sessionToken={sessionToken} />}
          {tab === "branches"   && <BranchesTab   t={t} sessionToken={sessionToken} toast={toast} />}
          {tab === "cashiers"   && <CashiersTab   t={t} sessionToken={sessionToken} toast={toast} isRtl={isRtl} />}
          {tab === "categories" && <CategoriesTab t={t} sessionToken={sessionToken} toast={toast} />}
          {tab === "items"      && <ItemsTab      t={t} sessionToken={sessionToken} toast={toast} isRtl={isRtl} />}
          {tab === "reports"    && <ReportsTab    t={t} sessionToken={sessionToken} />}
          {tab === "profit"     && <ProfitTab     t={t} sessionToken={sessionToken} isRtl={isRtl} />}
          {tab === "audit"      && <AuditTab      t={t} sessionToken={sessionToken} />}
          {tab === "shifts"     && <ShiftsTab     t={t} sessionToken={sessionToken} />}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ Overview ═══════════════════════════════ */

function BranchesTab({ t, sessionToken, toast }: any) {
  const rows = useQuery(api.posBranches.list, { sessionToken, includeInactive: true }) as any[] | undefined;
  const create = useMutation(api.posBranches.create);
  const update = useMutation(api.posBranches.update);
  const [f, setF] = useState({ name: "", code: "", phone: "", address: "" });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!f.name.trim()) { void alertDialog({ message: t("اسم الفرع مطلوب", "Branch name required") }); return; }
    setBusy(true);
    try {
      await create({ name: f.name, code: f.code || undefined, phone: f.phone || undefined, address: f.address || undefined, sessionToken });
      setF({ name: "", code: "", phone: "", address: "" });
      toast({ title: t("تم إضافة الفرع", "Branch added") });
    } catch (e: any) { void alertDialog({ message: e?.message || "خطأ" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-black mb-1">{t("إضافة فرع", "Add Branch")}</h3>
          <p className="text-xs text-slate-500 mb-3">{t("كل فرع له كاشيرون وورديات وفواتير منفصلة. الاسم والعنوان يظهران على الفاتورة.", "Each branch has its own cashiers, shifts and tickets. Name & address show on the receipt.")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2"><Label className="text-xs font-bold text-slate-500">{t("اسم الفرع", "Branch name")}</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("فرع لوسيل", "Lusail branch")} className="h-10" /></div>
            <div><Label className="text-xs font-bold text-slate-500">{t("كود", "Code")}</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="LUS" className="h-10" /></div>
            <div><Label className="text-xs font-bold text-slate-500">{t("هاتف", "Phone")}</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="h-10" dir="ltr" /></div>
            <div className="flex items-end"><Button onClick={add} disabled={busy} className="w-full h-10 text-white font-bold" style={{ background: "#0E76AC" }}><Plus className="h-4 w-4 me-1" />{t("إضافة", "Add")}</Button></div>
            <div className="sm:col-span-5"><Label className="text-xs font-bold text-slate-500">{t("العنوان (يظهر على الفاتورة)", "Address (on receipt)")}</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className="h-10" /></div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-black mb-3">{t("الفروع", "Branches")}</h3>
          {!rows ? <p className="text-sm text-slate-400 py-4 text-center">{t("جاري التحميل…", "Loading…")}</p>
            : rows.length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">{t("لا توجد فروع حتى الآن. أضف فرعين للبدء.", "No branches yet — add two.")}</p>
            : (
            <div className="space-y-2">
              {rows.map((b: any) => (
                <BranchRow key={b.id} b={b} t={t} update={update} sessionToken={sessionToken} toast={toast} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BranchRow({ b, t, update, sessionToken, toast }: any) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: b.name, code: b.code || "", phone: b.phone || "", address: b.address || "" });
  const save = async () => {
    try { await update({ id: b.id as any, name: f.name, code: f.code, phone: f.phone, address: f.address, sessionToken }); setEdit(false); toast({ title: t("تم الحفظ", "Saved") }); }
    catch (e: any) { void alertDialog({ message: e?.message || "خطأ" }); }
  };
  if (edit) {
    return (
      <div className="rounded-xl border-2 border-[#cfe7f3] p-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("الاسم", "Name")} className="h-9" />
        <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="Code" className="h-9" />
        <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder={t("هاتف", "Phone")} className="h-9" dir="ltr" />
        <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder={t("العنوان", "Address")} className="h-9" />
        <div className="sm:col-span-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setEdit(false)} className="h-9">{t("إلغاء", "Cancel")}</Button>
          <Button onClick={save} className="h-9 text-white" style={{ background: "#0E76AC" }}>{t("حفظ", "Save")}</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
      <div className="flex-1 min-w-0">
        <div className="font-black text-slate-800 truncate">{b.name} {b.code && <span className="text-[10px] font-bold text-[#0E76AC] bg-[#eef7fb] rounded px-1.5 py-0.5">{b.code}</span>}</div>
        <div className="text-[11px] text-slate-400 truncate">{[b.phone, b.address].filter(Boolean).join(" · ") || "—"}</div>
      </div>
      <button onClick={() => update({ id: b.id as any, isActive: !b.isActive, sessionToken })}
        className={cn("text-[10px] font-bold px-2 py-1 rounded-full", b.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
        {b.isActive ? t("نشط", "Active") : t("موقوف", "Off")}
      </button>
      <Button variant="outline" size="sm" onClick={() => setEdit(true)} className="h-8">{t("تعديل", "Edit")}</Button>
    </div>
  );
}

function OverviewTab({ t, sessionToken }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const branches = useQuery(api.posBranches.list, { sessionToken, includeInactive: true }) as any[] | undefined;
  const [branchId, setBranchId] = useState<string>("");
  const daily = useQuery(api.posAdmin.dailySummary, { date: today, ...(branchId ? { branchId: branchId as any } : {}), sessionToken }) as any;
  const cashiers = useQuery(api.posAdmin.listCashiers, { sessionToken }) as any[] | undefined;
  const cats = useQuery(api.posAdmin.listCategories, { sessionToken }) as any[] | undefined;
  const settings = useQuery(api.restaurantSettings.get, {}) as any;
  const setPosTax = useMutation(api.restaurantSettings.setPosTax);
  const setDeliveryFee = useMutation(api.restaurantSettings.setPosDeliveryFee);
  const [taxPct, setTaxPct] = useState<string>("");
  const [taxIncl, setTaxIncl] = useState(true);
  const [taxLabel, setTaxLabel] = useState("VAT");
  const [delFee, setDelFee] = useState<string>("");
  useMemo(() => {
    if (settings?.posTax) {
      setTaxPct(String(settings.posTax.pct));
      setTaxIncl(!!settings.posTax.inclusive);
      setTaxLabel(settings.posTax.label || "VAT");
    }
  }, [settings?.posTax]);
  useMemo(() => {
    if (settings) setDelFee(String(settings.posDeliveryFee ?? 10));
  }, [settings?.posDeliveryFee]);
  const saveTax = async () => {
    try {
      await setPosTax({ pct: Number(taxPct) || 0, inclusive: taxIncl, label: taxLabel, sessionToken });
      void alertDialog({ message: t("تم حفظ إعدادات الضريبة", "Tax settings saved") });
    } catch (e: any) { void alertDialog({ message: e?.message || "خطأ" }); }
  };
  const saveDelFee = async () => {
    try {
      await setDeliveryFee({ fee: Number(delFee) || 0, sessionToken });
      void alertDialog({ message: t("تم حفظ رسوم التوصيل", "Delivery fee saved") });
    } catch (e: any) { void alertDialog({ message: e?.message || "خطأ" }); }
  };

  const hasBranches = (branches?.length || 0) > 0;
  return (
    <div className="space-y-3">
      {hasBranches && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">{t("الفرع:", "Branch:")}</span>
          <button onClick={() => setBranchId("")} className={cn("h-9 px-3 rounded-xl text-sm font-bold border", !branchId ? "bg-[#0E76AC] text-white border-transparent" : "bg-white border-slate-200 text-slate-600")}>{t("الكل", "All")}</button>
          {(branches || []).map((b: any) => (
            <button key={b.id} onClick={() => setBranchId(b.id)} className={cn("h-9 px-3 rounded-xl text-sm font-bold border", branchId === b.id ? "bg-[#0E76AC] text-white border-transparent" : "bg-white border-slate-200 text-slate-600")}>{b.name}</button>
          ))}
        </div>
      )}
      <Card className="rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white border-0">
        <CardContent className="p-6">
          <p className="text-cyan-100 text-sm font-bold uppercase">{t("مبيعات اليوم", "Today's Sales")}{branchId ? ` · ${branches?.find((b: any) => b.id === branchId)?.name || ""}` : ""}</p>
          <p className="text-5xl font-black mt-1">{daily?.totalSales?.toFixed(2) ?? "—"}
            <span className="text-xl text-cyan-200 ms-2">QAR</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div><span className="text-cyan-200">{t("فواتير", "Tickets")}:</span> <b>{daily?.ticketsCount ?? 0}</b></div>
            <div><span className="text-cyan-200">{t("متوسط", "Avg")}:</span> <b>{daily?.avgTicket?.toFixed(2) ?? "—"}</b></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickCard title={t("الكاشيرون", "Cashiers")}  value={cashiers?.length ?? "—"} color="#0E76AC" icon={Users} />
        <QuickCard title={t("فئات POS", "Categories")} value={cats?.filter((c: any) => c.isActive).length ?? "—"} color="#f59e0b" icon={LayoutGrid} />
        <QuickCard title={t("طرق الدفع اليوم", "Methods today")} value={daily?.byMethod?.length ?? "—"} color="#16a34a" icon={BarChart3} />
        <QuickCard title={t("وجبات موظفين اليوم", "Staff meals today")}
          value={daily?.staffMealsCount != null ? `${daily.staffMealsCount} · ${daily.staffMealsValue.toFixed(2)}` : "—"}
          color="#475569" icon={Users} />
      </div>

      {daily?.byMethod?.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <h3 className="font-black mb-3">{t("حسب طريقة الدفع", "By payment method")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {daily.byMethod.map((m: any) => (
                <div key={m.method} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase font-bold text-slate-500">{m.method}</p>
                  <p className="text-xl font-black text-slate-900">{m.total.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">{m.count} {t("فاتورة", "tickets")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasBranches && daily?.byBranch?.length > 0 && !branchId && (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <h3 className="font-black mb-3">{t("مبيعات اليوم حسب الفرع", "Today by branch")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {daily.byBranch.map((b: any, i: number) => (
                <div key={i} className="rounded-xl bg-[#eef7fb] p-3">
                  <p className="text-xs font-bold text-[#0E76AC]">{b.name}</p>
                  <p className="text-xl font-black text-slate-900">{b.total.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">{b.count} {t("فاتورة", "tickets")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ✅ إعدادات ضريبة POS */}
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-black mb-1">{t("إعدادات الضريبة (POS)", "POS Tax Settings")}</h3>
          <p className="text-xs text-slate-500 mb-3">{t("تُطبَّق تلقائياً على كل فواتير نقطة البيع الجديدة.", "Applied automatically to every new POS ticket.")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-bold text-slate-500">{t("النسبة %", "Percent %")}</Label>
              <Input type="number" step="0.1" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} placeholder="0" className="h-10" />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-500">{t("مسمّى", "Label")}</Label>
              <Input value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} placeholder="VAT" className="h-10" />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-500">{t("نظام الحساب", "Mode")}</Label>
              <select value={taxIncl ? "incl" : "excl"} onChange={(e) => setTaxIncl(e.target.value === "incl")} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                <option value="incl">{t("السعر شامل الضريبة", "Price includes tax")}</option>
                <option value="excl">{t("الضريبة تُضاف فوق السعر", "Tax added on top")}</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={saveTax} className="w-full h-10 text-white font-bold" style={{ background: "#0E76AC" }}>
                <Save className="h-4 w-4 me-1" /> {t("حفظ", "Save")}
              </Button>
            </div>
          </div>
          {settings?.posTax && (
            <div className="mt-3 text-xs text-slate-500 font-bold">
              {t("الوضع الحالي:", "Current:")} <b>{settings.posTax.pct}%</b> ({settings.posTax.label || "Tax"}) —
              {settings.posTax.inclusive ? t(" شامل", " inclusive") : t(" إضافي", " on top")}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-black mb-1">{t("رسوم التوصيل (طلب مباشر)", "Delivery Fee (direct order)")}</h3>
          <p className="text-xs text-slate-500 mb-3">{t("تُستخدم مع زر «+توصيل» في شاشة البيع للطلبات المباشرة. طلبات المنصّات لا تُضاف لها رسوم (المنصّة تحصّلها).", "Used by the '+Delivery' button for direct orders. Platform orders should NOT add it (the platform collects it).")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold text-slate-500">{t("الرسوم (ر.ق)", "Fee (QAR)")}</Label>
              <Input type="number" step="0.5" value={delFee} onChange={(e) => setDelFee(e.target.value)} placeholder="10" className="h-10" />
            </div>
            <div className="flex items-end">
              <Button onClick={saveDelFee} className="w-full h-10 text-white font-bold" style={{ background: "#0E76AC" }}>
                <Save className="h-4 w-4 me-1" /> {t("حفظ", "Save")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickCard({ title, value, color, icon: Icon }: any) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: color + "20", color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase">{title}</p>
          <p className="text-2xl font-black" style={{ color }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ Cashiers ═══════════════════════════════ */

function CashiersTab({ t, sessionToken, toast, isRtl }: any) {
  const rows = useQuery(api.posAdmin.listCashiers, { sessionToken }) as any[] | undefined;
  const branches = useQuery(api.posBranches.list, { sessionToken, includeInactive: true }) as any[] | undefined;
  const create = useMutation(api.posAdmin.createCashier);
  const update = useMutation(api.posAdmin.updateCashier);
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", pin: "", branchId: "" });
  const [editing, setEditing] = useState<any | null>(null);
  const [newPin, setNewPin] = useState("");
  const hasBranches = (branches?.length || 0) > 0;

  const submit = async () => {
    try {
      const { branchId, ...rest } = f;
      await create({ ...rest, ...(branchId ? { posBranchId: branchId as any } : {}), sessionToken });
      toast({ title: t("تم إنشاء الكاشير ✓", "Cashier created ✓") });
      setShowForm(false); setF({ name: "", email: "", phone: "", pin: "", branchId: "" });
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message?.replace(/^\[.*?\]\s*/, "") }); }
  };
  const reassign = async (id: string, branchId: string) => {
    try { await update({ id: id as any, posBranchId: (branchId || undefined) as any, sessionToken }); toast({ title: t("تم تحديث الفرع ✓", "Branch updated ✓") }); }
    catch (e: any) { void alertDialog({ message: e?.message || "خطأ" }); }
  };
  const changePin = async (id: string) => {
    if (!/^\d{4,6}$/.test(newPin)) return toast({ title: t("يجب أن يتكوّن رمز PIN من 4 إلى 6 أرقام", "PIN must be 4-6 digits") });
    try {
      await update({ id: id as any, pin: newPin, sessionToken });
      toast({ title: t("تم تغيير الـPIN ✓", "PIN updated ✓") });
      setEditing(null); setNewPin("");
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-slate-600 text-sm font-bold">{rows?.length || 0} {t("كاشير", "cashier(s)")}</p>
        <Button onClick={() => setShowForm(true)} className="h-10 text-white font-bold" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
          <Plus className="h-4 w-4 me-1" /> {t("كاشير جديد", "New cashier")}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-2xl border-2 border-[#0E76AC]/30">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>{t("الاسم", "Name")}</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>{t("البريد الإلكتروني", "Email")}</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><Label>{t("الهاتف", "Phone")}</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div><Label>{t("PIN (4-6 أرقام)", "PIN (4-6 digits)")}</Label><Input value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="1234" /></div>
            {hasBranches && (
              <div className="sm:col-span-2">
                <Label>{t("الفرع", "Branch")}</Label>
                <select value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                  <option value="">{t("— اختر الفرع —", "— select branch —")}</option>
                  {(branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>{t("إلغاء", "Cancel")}</Button>
              <Button onClick={submit} className="text-white" style={{ background: "#0E76AC" }}><Save className="h-4 w-4 me-1" />{t("حفظ", "Save")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-start p-3">{t("الاسم", "Name")}</th>
                <th className="text-start p-3">{t("البريد الإلكتروني", "Email")}</th>
                {hasBranches && <th className="text-start p-3">{t("الفرع", "Branch")}</th>}
                <th className="text-center p-3">PIN</th>
                <th className="text-center p-3">{t("نشط", "Active")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((c: any) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="p-3 font-bold">{c.name}</td>
                  <td className="p-3 text-slate-600 text-xs">{c.email}</td>
                  {hasBranches && (
                    <td className="p-3">
                      <select value={c.branchId || ""} onChange={(e) => reassign(c.id, e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold">
                        <option value="">{t("— بدون —", "— none —")}</option>
                        {(branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </td>
                  )}
                  <td className="p-3 text-center">
                    {editing?.id === c.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-20 h-8 text-center border border-slate-200 rounded font-bold" placeholder="Nrew PIN" />
                        <button onClick={() => changePin(c.id)} className="text-xs font-bold text-[#0E76AC] hover:underline">{t("حفظ", "Save")}</button>
                        <button onClick={() => { setEditing(null); setNewPin(""); }} className="text-xs font-bold text-slate-400 hover:underline">{t("إلغاء", "Cancel")}</button>
                      </div>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{c.hasPin ? "✓" : t("مطلوب", "needs PIN")}</span>
                        <button onClick={() => setEditing(c)} className="ms-2 text-xs font-bold text-[#0E76AC] hover:underline">{t("تغيير", "Change")}</button>
                      </>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => update({ id: c.id as any, isActive: !c.isActive, sessionToken })} className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                      {c.isActive ? t("نشط", "Active") : t("موقوف", "Off")}
                    </button>
                  </td>
                  <td className="p-3 text-end" />
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr><td colSpan={hasBranches ? 6 : 5} className="text-center py-8 text-slate-400">{t("لم تتم إضافة أي موظف صندوق حتى الآن", "No cashiers yet")}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ POS Categories ═══════════════════════════════ */

function CategoriesTab({ t, sessionToken, toast }: any) {
  const rows = useQuery(api.posAdmin.listCategories, { sessionToken }) as any[] | undefined;
  const create = useMutation(api.posAdmin.createCategory);
  const update = useMutation(api.posAdmin.updateCategory);
  const del = useMutation(api.posAdmin.deleteCategory);
  const [f, setF] = useState({ name: "", color: "#0E76AC" });
  const colors = ["#dc2626","#ea580c","#f59e0b","#16a34a","#0891b2","#0E76AC","#7c3aed","#db2777","#475569"];

  const submit = async () => {
    if (!f.name.trim()) return;
    try {
      await create({ name: f.name, color: f.color, sessionToken });
      toast({ title: t("تم ✓", "Added ✓") });
      setF({ name: "", color: "#0E76AC" });
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-2 border-dashed border-slate-200">
        <CardContent className="p-4">
          <p className="text-xs font-bold text-slate-500 mb-2">{t("إذا لم تضف فئات، فسيستخدم النظام تصنيفات قائمة الوجبات تلقائيًا", "If empty, POS falls back to menu categories")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label>{t("اسم الفئة", "Category name")}</Label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Beef / Chicken / Burgers / ..." />
            </div>
            <div>
              <Label>{t("اللون", "Color")}</Label>
              <div className="flex gap-1 flex-wrap mt-1">
                {colors.map((c) => (
                  <button key={c} onClick={() => setF({ ...f, color: c })}
                    className={cn("w-8 h-8 rounded-full", f.color === c && "ring-2 ring-offset-2 ring-slate-900")}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={submit} className="w-full text-white" style={{ background: "#0E76AC" }}>
                <Plus className="h-4 w-4 me-1" /> {t("أضف", "Add")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(rows || []).map((c: any) => (
            <div key={c.id} className="rounded-xl overflow-hidden shadow-md" style={{ background: c.color }}>
              <div className="p-4 text-white text-center font-black">{c.name}</div>
              <div className="bg-white p-2 flex gap-1">
                <button onClick={() => update({ id: c.id as any, isActive: !c.isActive, sessionToken })} className="flex-1 text-xs font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">
                  {c.isActive ? t("موقوف", "Hide") : t("تفعيل", "Show")}
                </button>
                <button onClick={async () => { if (await confirmDialog({ message: t("حذف؟", "Delete?"), variant: "danger", confirmText: "حذف" })) { await del({ id: c.id as any, sessionToken }); toast({ title: t("محذوف", "Deleted") }); } }} className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {rows && rows.length === 0 && <p className="col-span-full text-center text-slate-400 py-8 text-sm font-bold">{t("لا توجد فئات مضافة", "No categories yet")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ POS Items ═══════════════════════════════ */

function ItemsTab({ t, sessionToken, toast, isRtl }: any) {
  const items = useQuery(api.posAdmin.listItemsForAdmin, { sessionToken }) as any[] | undefined;
  const cats = useQuery(api.posAdmin.listCategories, { sessionToken }) as any[] | undefined;
  const upsert = useMutation(api.posAdmin.upsertItemMeta);
  const applyOnlinePrices = useMutation(api.posAdmin.applyOnlinePriceList);
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [importingPrices, setImportingPrices] = useState(false);
  const [priceImportResult, setPriceImportResult] = useState<any | null>(null);
  const colors = ["#dc2626","#ea580c","#f59e0b","#16a34a","#0891b2","#0E76AC","#7c3aed","#db2777","#475569"];

  const filtered = useMemo(() => (items || []).filter((m: any) => {
    if (!q.trim()) return true;
    const qq = q.toLowerCase();
    return String(m.nameEn).toLowerCase().includes(qq) || String(m.nameAr).toLowerCase().includes(qq);
  }), [items, q]);

  const set = (id: string, patch: any) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const save = async (m: any) => {
    const d = drafts[m.id] || {};
    try {
      await upsert({
        mealId: m.id as any,
        displayName: d.displayName,
        color: d.color,
        posCategoryId: d.posCategoryId as any,
        isHidden: d.isHidden,
        posPrice: d.posPrice != null && d.posPrice !== "" ? Number(d.posPrice) : undefined,
        sessionToken,
      });
      toast({ title: t("تم ✓", "Saved ✓") });
      setDrafts((cp) => { const n = { ...cp }; delete n[m.id]; return n; });
    } catch (e: any) { toast({ title: t("فشل", "Failed"), description: e?.message }); }
  };

  const importOnlinePrices = async () => {
    setImportingPrices(true);
    try {
      const result = await applyOnlinePrices({ sessionToken });
      setPriceImportResult(result);
      toast({
        title: t("تم استيراد أسعار الأونلاين ✓", "Online prices imported ✓"),
        description: `${result.total}/${result.total} ${t("صنف أونلاين جاهز", "online items ready")}`,
      });
    } catch (e: any) {
      toast({ title: t("فشل استيراد الأسعار", "Price import failed"), description: e?.message });
    } finally {
      setImportingPrices(false);
    }
  };
  return (
    <div className="space-y-3">
      <Card className="rounded-2xl">
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث…", "Search…")} className="h-10 min-w-0 flex-1" />
            <Button onClick={importOnlinePrices} disabled={importingPrices} className="h-10 shrink-0 text-white font-bold" style={{ background: "#0E76AC" }}>
              <RefreshCw className={cn("h-4 w-4 me-2", importingPrices && "animate-spin")} />
              {importingPrices ? t("جاري المطابقة…", "Matching…") : t("استيراد أسعار الأونلاين", "Import online prices")}
            </Button>
          </div>
          {priceImportResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex flex-wrap gap-3 font-bold">
                <span className="text-emerald-700">{t("إجمالي أصناف الأونلاين", "Online items")}: {priceImportResult.total}</span>
                <span className="text-cyan-700">{t("أصناف جديدة", "Created")}: {priceImportResult.created?.length || 0}</span>
                <span className="text-slate-600">{t("أسعار قديمة أُوقفت", "Old prices disabled")}: {priceImportResult.disabled || 0}</span>
              </div>
              {priceImportResult.unmatched.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-bold text-[#0E76AC]">{t("عرض الأسماء غير المطابقة", "Show unmatched names")}</summary><div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{priceImportResult.unmatched.map((name: string) => <span key={name} className="rounded bg-white px-2 py-1 text-slate-600">{name}</span>)}</div></details>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 sticky top-0">
                <tr>
                  <th className="text-start p-2">{t("الوجبة", "Meal")}</th>
                  <th className="text-start p-2">{t("السعر العادي", "Regular price")}</th>
                  <th className="text-start p-2">{t("سعر المنفذ", "Outlet price")}</th>
                  <th className="text-start p-2">{t("سعر الأونلاين", "Online price")}</th>
                  <th className="text-start p-2">{t("لون الزر", "Button color")}</th>
                  <th className="text-start p-2">{t("فئة POS", "POS Category")}</th>
                  <th className="text-center p-2">{t("مخفي", "Hidden")}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => {
                  const d = drafts[m.id] || {};
                  const dirty = Object.keys(d).length > 0;
                  const currColor = d.color !== undefined ? d.color : m.color;
                  return (
                    <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="p-2">
                        <div className="font-bold">{isRtl ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}</div>
                      </td>
                      <td className="p-2 font-bold text-slate-700">{Number(m.menuPrice).toFixed(2)}</td>
                      <td className="p-2 font-bold text-emerald-700">{m.gymPrice == null ? "—" : Number(m.gymPrice).toFixed(2)}</td>
                      <td className="p-2">
                        <input type="number" step="0.01"
                          defaultValue={m.posPrice ?? ""}
                          placeholder={t("مطلوب", "Required")}
                          onChange={(e) => set(m.id, { posPrice: e.target.value })}
                          className="w-20 h-8 text-center border border-slate-200 rounded font-bold" />
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => set(m.id, { color: undefined })}
                            className={cn("w-6 h-6 rounded-full border border-slate-300 bg-white text-xs", !currColor && "ring-2 ring-slate-900")}>×</button>
                          {colors.map((c) => (
                            <button key={c} onClick={() => set(m.id, { color: c })}
                              className={cn("w-6 h-6 rounded-full", currColor === c && "ring-2 ring-offset-1 ring-slate-900")}
                              style={{ background: c }} />
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        <select defaultValue={m.posCategoryId || ""} onChange={(e) => set(m.id, { posCategoryId: e.target.value || undefined })}
                          className="h-8 rounded border border-slate-200 bg-white text-xs px-2">
                          <option value="">— {t("افتراضي", "default")} —</option>
                          {(cats || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <input type="checkbox" defaultChecked={m.isHidden} onChange={(e) => set(m.id, { isHidden: e.target.checked })} className="w-4 h-4" />
                      </td>
                      <td className="p-2 text-end">
                        <button onClick={() => save(m)} disabled={!dirty}
                          className={cn("text-xs font-bold px-3 h-8 rounded-lg", dirty ? "bg-[#0E76AC] text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
                          {t("حفظ", "Save")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ Reports ═══════════════════════════════ */

function EmailReportCard({ t, sessionToken }: any) {
  const cfg = useQuery(api.posReports.getReportSettings, { sessionToken }) as any;
  const save = useMutation(api.posReports.saveReportSettings);
  const sendNow = useAction(api.posReports.sendDailyReport);
  const [enabled, setEnabled] = useState(false);
  const [emails, setEmails] = useState("");
  const [sendTime, setSendTime] = useState("23:00");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (cfg && !loaded.current) {
      loaded.current = true;
      setEnabled(!!cfg.enabled);
      setEmails((cfg.recipients || []).join(", "));
      setSendTime(cfg.sendTime || "23:00");
    }
  }, [cfg]);

  const parseEmails = () => emails.split(/[,\n;]+/).map((e) => e.trim()).filter(Boolean);

  const doSave = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await save({ sessionToken, enabled, recipients: parseEmails(), sendTime });
      setEmails((r.recipients || []).join(", "));
      setMsg(t("تم الحفظ ✓", "Saved ✓"));
    } catch (e: any) {
      setMsg(e?.message?.replace(/^\[CONVEX .*?\]\s*/, "") || t("خطأ", "Error"));
    } finally { setBusy(false); }
  };

  const doTest = async () => {
    setBusy(true); setMsg(null);
    try {
      const r: any = await sendNow({ sessionToken, recipientsOverride: parseEmails() });
      if (r.sent) setMsg(t("تم إرسال تقرير تجريبي ✓", "Test report sent ✓"));
      else if (r.reason === "no_provider") setMsg(t("مفتاح Resend غير مضبوط بعد (RESEND_API_KEY) — التقرير جاهز وسيعمل فور إضافته.", "Resend key not set yet (RESEND_API_KEY) — ready once added."));
      else if (r.reason === "no_recipients") setMsg(t("أضف بريداً واحداً على الأقل.", "Add at least one recipient."));
      else setMsg(t("تعذّر الإرسال — راجع مزوّد البريد.", "Send failed — check email provider."));
    } catch (e: any) {
      setMsg(e?.message?.replace(/^\[CONVEX .*?\]\s*/, "") || t("خطأ", "Error"));
    } finally { setBusy(false); }
  };

  return (
    <Card className="rounded-2xl border-[#cfe7f3]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[#0E2A4A]">📧 {t("تقرير يومي عبر البريد الإلكتروني (Z-report)", "Daily email report (Z-report)")}</h3>
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 accent-[#0E76AC]" />
            {t("مُفعّل", "Enabled")}
          </label>
        </div>
        <div>
          <Label>{t("مستقبلو التقرير (افصل بفاصلة)", "Recipients (comma-separated)")}</Label>
          <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="owner@example.com, manager@example.com" className="h-10" />
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <Label>{t("وقت الإرسال (توقيت قطر)", "Send time (Qatar)")}</Label>
            <Input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} className="h-10" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={doSave} disabled={busy} className="h-10 bg-[#0E76AC] hover:bg-[#0c6698]">{t("حفظ", "Save")}</Button>
            <Button onClick={doTest} disabled={busy} variant="outline" className="h-10">{t("إرسال تجريبي", "Test send")}</Button>
          </div>
        </div>
        {msg && <p className="text-xs font-bold text-[#0E76AC] bg-[#eef7fb] rounded-lg p-2">{msg}</p>}
        {cfg?.lastSentDate && <p className="text-[11px] text-slate-400">{t("آخر إرسال:", "Last sent:")} {cfg.lastSentDate}</p>}
      </CardContent>
    </Card>
  );
}

function ReportsTab({ t, sessionToken }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const branches = useQuery(api.posBranches.list, { sessionToken, includeInactive: true }) as any[] | undefined;
  const [branchId, setBranchId] = useState<string>("");
  const bArg = branchId ? { branchId: branchId as any } : {};
  const top = useQuery(api.posAdmin.topItems, { from, to, ...bArg, sessionToken }) as any[] | undefined;
  const receipts = useQuery(api.posAdmin.listReceipts, { from, to, ...bArg, sessionToken }) as any[] | undefined;
  const hasBranches = (branches?.length || 0) > 0;

  return (
    <div className="space-y-3">
      <EmailReportCard t={t} sessionToken={sessionToken} />
      {hasBranches && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">{t("الفرع:", "Branch:")}</span>
          <button onClick={() => setBranchId("")} className={cn("h-9 px-3 rounded-xl text-sm font-bold border", !branchId ? "bg-[#0E76AC] text-white border-transparent" : "bg-white border-slate-200 text-slate-600")}>{t("الكل", "All")}</button>
          {(branches || []).map((b: any) => (
            <button key={b.id} onClick={() => setBranchId(b.id)} className={cn("h-9 px-3 rounded-xl text-sm font-bold border", branchId === b.id ? "bg-[#0E76AC] text-white border-transparent" : "bg-white border-slate-200 text-slate-600")}>{b.name}</button>
          ))}
        </div>
      )}
      <Card className="rounded-2xl">
        <CardContent className="p-4 grid grid-cols-2 gap-3">
          <div><Label>{t("من", "From")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" /></div>
          <div><Label>{t("إلى", "To")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-black mb-3">{t("أكثر الأصناف مبيعاً", "Top Items")}</h3>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>
              <th className="text-start p-2">{t("الوجبة", "Item")}</th>
              <th className="text-center p-2">{t("الكمية", "Qty")}</th>
              <th className="text-end p-2">{t("الإيراد", "Revenue")}</th>
            </tr></thead>
            <tbody>
              {(top || []).map((r: any, i: number) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-2 font-bold">{r.name}</td>
                  <td className="p-2 text-center font-black">{r.qty}</td>
                  <td className="p-2 text-end font-black text-[#0E76AC]">{r.revenue.toFixed(2)}</td>
                </tr>
              ))}
              {top && top.length === 0 && <tr><td colSpan={3} className="text-center text-slate-400 py-6">{t("لا توجد مبيعات", "No sales")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h3 className="font-black mb-3">{t("سجل الفواتير", "Receipts log")}</h3>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 sticky top-0"><tr>
                <th className="text-start p-2">#</th>
                <th className="text-start p-2">{t("الوقت", "Time")}</th>
                <th className="text-start p-2">{t("الكاشير", "Cashier")}</th>
                <th className="text-start p-2">{t("طريقة الدفع", "Method")}</th>
                <th className="text-end p-2">{t("الإجمالي", "Total")}</th>
              </tr></thead>
              <tbody>
                {(receipts || []).map((r: any) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-2 font-black">#{r.ticketNumber}</td>
                    <td className="p-2 text-xs">{r.paidAt ? new Date(r.paidAt).toLocaleString() : "—"}</td>
                    <td className="p-2">{r.cashierName}</td>
                    <td className="p-2 text-xs">{r.paymentMethod || "—"}</td>
                    <td className={cn("p-2 text-end font-black", r.status === "REFUNDED" ? "text-red-500 line-through" : "text-[#0E76AC]")}>{r.total.toFixed(2)}</td>
                  </tr>
                ))}
                {receipts && receipts.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">{t("لا توجد فواتير", "No receipts")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ Shifts ═══════════════════════════════ */

function ShiftsTab({ t, sessionToken }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const rows = useQuery(api.posAdmin.listShifts, { from, to, sessionToken }) as any[] | undefined;
  return (
    <div className="space-y-3">
      <Card className="rounded-2xl">
        <CardContent className="p-4 grid grid-cols-2 gap-3">
          <div><Label>{t("من", "From")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" /></div>
          <div><Label>{t("إلى", "To")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" /></div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr>
              <th className="text-start p-3">{t("الكاشير", "Cashier")}</th>
              <th className="text-start p-3">{t("الحالة", "Status")}</th>
              <th className="text-start p-3">{t("فُتحت", "Opened")}</th>
              <th className="text-center p-3">{t("افتتاح", "Opening")}</th>
              <th className="text-center p-3">{t("مبيعات", "Sales")}</th>
              <th className="text-center p-3">{t("فرق الكاش", "Cash diff")}</th>
            </tr></thead>
            <tbody>
              {(rows || []).map((s: any) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="p-3 font-bold">{s.cashierName}</td>
                  <td className="p-3"><span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", s.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{s.status}</span></td>
                  <td className="p-3 text-xs">{new Date(s.openedAt).toLocaleString()}</td>
                  <td className="p-3 text-center font-bold">{s.openingCash.toFixed(2)}</td>
                  <td className="p-3 text-center font-black text-[#0E76AC]">{s.totalSales.toFixed(2)}</td>
                  <td className={cn("p-3 text-center font-black", s.cashDiff == null ? "text-slate-300" : s.cashDiff === 0 ? "text-emerald-700" : s.cashDiff > 0 ? "text-amber-700" : "text-red-700")}>
                    {s.cashDiff == null ? "—" : s.cashDiff.toFixed(2)}
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">{t("لا توجد ورديات", "No shifts")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════ Profitability + Menu Engineering ═══════════════════════════════ */

const CAT_META: Record<string, { label: string; color: string; emoji: string; desc: string }> = {
  star:      { label: "Star",       color: "#16a34a", emoji: "⭐", desc: "مبيعات مرتفعة وهامش مرتفع — عزّز الترويج له"       },
  puzzle:    { label: "Puzzle",     color: "#7c3aed", emoji: "🧩", desc: "هامش مرتفع ومبيعات منخفضة — حسّن تسويقه"    },
  plowhorse: { label: "Plowhorse",  color: "#f59e0b", emoji: "🐴", desc: "مبيعات مرتفعة وهامش منخفض — راجع السعر"  },
  dog:       { label: "Dog",        color: "#dc2626", emoji: "🐕", desc: "مبيعات منخفضة وهامش منخفض — راجع جدوى استمراره"       },
  "no-cost": { label: "No cost",    color: "#94a3b8", emoji: "❓", desc: "لم تُدخل التكلفة — أدخلها أولًا"     },
};

function ProfitTab({ t, sessionToken, isRtl }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [filterCat, setFilterCat] = useState<string>("all");
  const report = useQuery(api.posAdmin.profitabilityReport, { from, to, sessionToken }) as any;

  const items = useMemo(() => {
    if (!report?.items) return [];
    return filterCat === "all" ? report.items : report.items.filter((i: any) => i.category === filterCat);
  }, [report, filterCat]);

  // ✅ تصدير CSV — يفتح في Excel مباشرة
  const exportCsv = () => {
    if (!items?.length) return;
    const header = ["Item", "Qty", "Revenue", "Cost", "Profit", "Margin %", "Class"];
    const rows = items.map((i: any) => [
      i.name.replace(/"/g, "'"), i.qty, i.revenue.toFixed(2), i.hasCost ? i.cost.toFixed(2) : "",
      i.hasCost ? i.profit.toFixed(2) : "", i.hasCost ? `${i.marginPct.toFixed(1)}%` : "", i.category,
    ]);
    const csv = "﻿" + [header, ...rows].map((r: any[]) => r.map((c: any) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `profit-${from}_${to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("من", "From")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("إلى", "To")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("التصنيف", "Category")}</Label>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="all">{t("الكل", "All")}</option>
              {Object.entries(CAT_META).map(([k, m]) => (
                <option key={k} value={k}>{m.emoji} {m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={exportCsv} disabled={!items?.length} className="w-full h-10 text-white font-bold" style={{ background: "#16a34a" }}>
              {t("تنزيل CSV", "Download CSV")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickCard title={t("الإيراد", "Revenue")}   value={report?.totals?.revenue?.toFixed(2) ?? "—"} color="#0E76AC" icon={BarChart3} />
        <QuickCard title={t("التكلفة", "Cost")}     value={report?.totals?.cost?.toFixed(2) ?? "—"}    color="#f59e0b" icon={BarChart3} />
        <QuickCard title={t("الربح", "Profit")}     value={report?.totals?.profit?.toFixed(2) ?? "—"}  color="#16a34a" icon={TrendingUp} />
        <QuickCard title={t("الهامش %", "Margin %")} value={report?.totals ? `${report.totals.marginPct}%` : "—"} color="#7c3aed" icon={TrendingUp} />
      </div>

      {/* Menu engineering counts */}
      {report?.totals?.counts && (
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="p-4">
            <h3 className="font-black text-slate-800 mb-3">{t("هندسة القائمة (Menu Engineering)", "Menu Engineering")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(["star", "puzzle", "plowhorse", "dog"] as const).map((k) => {
                const m = CAT_META[k];
                const n = report.totals.counts[k];
                return (
                  <button
                    key={k}
                    onClick={() => setFilterCat(k)}
                    className={cn(
                      "rounded-xl p-4 text-start transition-all border-2",
                      filterCat === k ? "shadow-lg scale-[1.02]" : "hover:shadow-md"
                    )}
                    style={{ background: m.color + "15", borderColor: filterCat === k ? m.color : m.color + "40" }}
                  >
                    <div className="text-2xl mb-1">{m.emoji}</div>
                    <div className="text-xs font-black uppercase" style={{ color: m.color }}>{m.label}</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{n}</div>
                    <div className="text-[10px] text-slate-600 mt-1 leading-tight">{m.desc}</div>
                  </button>
                );
              })}
            </div>
            {report.totals.itemsWithoutCost > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                ⚠ {report.totals.itemsWithoutCost} {t("صنف من دون تكلفة مُدخلة، ولذلك قد يكون التصنيف غير دقيق. أضف التكلفة من", "items without cost — categorization is inaccurate. Add cost via")} <b>{t("إدارة القائمة → تعديل الوجبة", "Menu → edit meal")}</b>.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 sticky top-0">
                <tr>
                  <th className="text-start p-3">{t("الصنف", "Item")}</th>
                  <th className="text-center p-3">{t("الكمية", "Qty")}</th>
                  <th className="text-end p-3">{t("الإيراد", "Revenue")}</th>
                  <th className="text-end p-3">{t("التكلفة", "Cost")}</th>
                  <th className="text-end p-3">{t("الربح", "Profit")}</th>
                  <th className="text-center p-3">{t("الهامش %", "Margin %")}</th>
                  <th className="text-center p-3">{t("التصنيف", "Class")}</th>
                </tr>
              </thead>
              <tbody>
                {(!report) && <tr><td colSpan={7} className="text-center py-8 text-slate-400">{t("جاري التحميل…", "Loading…")}</td></tr>}
                {report && items.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">{t("لا توجد بيانات", "No data")}</td></tr>}
                {items.map((i: any) => {
                  const cat = CAT_META[i.category as keyof typeof CAT_META];
                  return (
                    <tr key={i.mealId} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-bold">{i.name}</td>
                      <td className="p-3 text-center font-black">{i.qty}</td>
                      <td className="p-3 text-end font-black text-[#0E76AC]">{i.revenue.toFixed(2)}</td>
                      <td className={cn("p-3 text-end font-bold", !i.hasCost && "text-red-500")}>
                        {i.hasCost ? i.cost.toFixed(2) : "—"}
                      </td>
                      <td className={cn("p-3 text-end font-black", i.profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                        {i.hasCost ? i.profit.toFixed(2) : "—"}
                      </td>
                      <td className="p-3 text-center font-bold">
                        {i.hasCost ? `${i.marginPct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: cat.color + "20", color: cat.color }}>
                          {cat.emoji} {cat.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {void isRtl}
    </div>
  );
}

/* ═══════════════════════════════ Audit Trail ═══════════════════════════════ */

const ACTION_META: Record<string, { color: string; label: string }> = {
  VOID_TICKET:   { color: "#f59e0b", label: "إلغاء فاتورة" },
  REFUND_TICKET: { color: "#dc2626", label: "استرجاع فاتورة" },
};

function AuditTab({ t, sessionToken }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [action, setAction] = useState<string>("");

  const rows = useQuery(api.posAdmin.auditTrail, {
    from, to,
    action: action || undefined,
    sessionToken,
  }) as any[] | undefined;

  const exportCsv = () => {
    if (!rows?.length) return;
    const header = ["When", "Action", "Actor", "Role", "Ticket", "Amount", "Reason"];
    const data = rows.map((r: any) => [
      new Date(r.createdAt).toISOString(), r.action, r.actorName || "", r.actorRole || "",
      r.details?.ticketNumber || "", r.details?.total != null ? Number(r.details.total).toFixed(2) : "",
      (r.details?.reason || "").replace(/"/g, "'"),
    ]);
    const csv = "﻿" + [header, ...data].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-${from}_${to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("من", "From")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-500">{t("إلى", "To")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs font-bold text-slate-500">{t("نوع الحدث", "Action")}</Label>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="">{t("الكل", "All")}</option>
              <option value="VOID_TICKET">{t("إلغاء فاتورة", "Void")}</option>
              <option value="REFUND_TICKET">{t("استرجاع فاتورة", "Refund")}</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={exportCsv} disabled={!rows?.length} className="w-full h-10 text-white font-bold" style={{ background: "#16a34a" }}>
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-start p-3">{t("الوقت", "When")}</th>
                <th className="text-start p-3">{t("الحدث", "Action")}</th>
                <th className="text-start p-3">{t("الفاعل", "Actor")}</th>
                <th className="text-start p-3">{t("الفاتورة", "Ticket")}</th>
                <th className="text-end p-3">{t("المبلغ", "Amount")}</th>
                <th className="text-start p-3">{t("السبب/الملاحظة", "Reason")}</th>
              </tr>
            </thead>
            <tbody>
              {(!rows) && <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t("جاري التحميل…", "Loading…")}</td></tr>}
              {rows && rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t("لا توجد أحداث في هذه الفترة", "No events in this period")}</td></tr>}
              {(rows || []).map((r: any) => {
                const meta = ACTION_META[r.action] || { color: "#64748b", label: r.action };
                const d = r.details || {};
                return (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-xs text-slate-600 font-mono whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: meta.color + "20", color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold">{r.actorName || "—"}</div>
                      <div className="text-[10px] text-slate-500">{r.actorRole || ""}</div>
                    </td>
                    <td className="p-3 font-bold">#{d.ticketNumber || "—"}</td>
                    <td className="p-3 text-end font-black text-[#0E76AC]">
                      {d.total != null ? Number(d.total).toFixed(2) : "—"}
                    </td>
                    <td className="p-3 text-xs text-slate-600">{d.reason || d.paymentMethod || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
