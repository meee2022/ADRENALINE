import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Landmark, TrendingUp, Wallet, ArrowDownLeft, ArrowUpRight, Plus, Trash2,
  FileText, BookOpen, RotateCcw, ReceiptText,
  CalendarRange, LockKeyhole,
  RefreshCw, LayoutDashboard, Scale, BarChart3, CircleDollarSign, Boxes,
} from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStartISO = () => { const d = todayISO(); return d.slice(0, 8) + "01"; };

export default function Finance() {
  const { dir, language } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const money = (n: number) =>
    (Math.round((n || 0) * 100) / 100).toLocaleString(isRtl ? "ar-EG" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + t("ر.ق", "QAR");

  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const dash = useQuery(api.financeReports.financeDashboard, { fromDate: from, toDate: to, sessionToken });
  const accounts = useQuery(api.finance.listAccounts, { activeOnly: true, sessionToken });
  const status = useQuery(api.finance.financeStatus, { sessionToken });
  const reconcile = useMutation(api.financePost.reconcileOperationalLedger);
  const [reconciling, setReconciling] = useState(false);
  const runReconciliation = async () => {
    setReconciling(true);
    try {
      const r: any = await reconcile({ sessionToken });
      alert(t(`اكتملت المطابقة: ${r.posPosted} POS، ${r.outletsPosted} منافذ، ${r.outletReturnsPosted} مرتجعات`, `Reconciled: ${r.posPosted} POS, ${r.outletsPosted} outlets, ${r.outletReturnsPosted} returns`));
    } catch (e: any) { alert(e.message || String(e)); }
    finally { setReconciling(false); }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-3 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-[1480px] space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[#3cc4f0]/20 bg-[#123f5c] text-white shadow-[0_14px_34px_rgba(18,63,92,0.16)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(300px,1fr)_auto] lg:items-end md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-[#3cc4f0] text-[#123f5c] shadow-[0_8px_20px_rgba(60,196,240,0.25)]">
              <Landmark className="h-6 w-6" strokeWidth={2.1} />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black md:text-2xl">{t("المالية والمحاسبة", "Finance & Accounting")}</h1>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold text-emerald-100">
                  {t("الدفاتر متصلة", "Ledger connected")}
                </span>
              </div>
              <p className="max-w-2xl text-xs font-medium leading-6 text-sky-100/75 md:text-sm">
                {t("مركز واحد لمتابعة الربحية والسيولة والالتزامات وحركة المطبخ", "One workspace for profitability, cash, liabilities and kitchen cost")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[160px_160px_auto]">
            <DateField label={t("بداية الفترة", "Period start")} value={from} onChange={setFrom} />
            <DateField label={t("نهاية الفترة", "Period end")} value={to} onChange={setTo} />
            <Button className="col-span-2 h-11 gap-2 rounded-xl bg-[#3cc4f0] px-5 font-bold text-[#123f5c] shadow-none hover:bg-[#52cef3] sm:col-span-1 sm:self-end" onClick={runReconciliation} disabled={reconciling} title={t("مطابقة العمليات غير المرحلة بأمان", "Safely post missing operations")}>
              <RefreshCw className={`h-4 w-4 ${reconciling ? "animate-spin" : ""}`} />{t("مطابقة الدفاتر", "Reconcile")}
            </Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] sm:grid-cols-5">
          <TabsTrigger className="min-h-10 gap-2 rounded-xl text-xs font-bold data-[state=active]:bg-[#e8f8fd] data-[state=active]:text-[#12698c] data-[state=active]:shadow-none" value="dashboard"><LayoutDashboard className="h-4 w-4" />{t("نظرة عامة", "Overview")}</TabsTrigger>
          <TabsTrigger className="min-h-10 gap-2 rounded-xl text-xs font-bold data-[state=active]:bg-[#e8f8fd] data-[state=active]:text-[#12698c] data-[state=active]:shadow-none" value="journal"><BookOpen className="h-4 w-4" />{t("القيود اليومية", "Journal")}</TabsTrigger>
          <TabsTrigger className="min-h-10 gap-2 rounded-xl text-xs font-bold data-[state=active]:bg-[#e8f8fd] data-[state=active]:text-[#12698c] data-[state=active]:shadow-none" value="accounts"><Scale className="h-4 w-4" />{t("دليل الحسابات", "Accounts")}</TabsTrigger>
          <TabsTrigger className="min-h-10 gap-2 rounded-xl text-xs font-bold data-[state=active]:bg-[#e8f8fd] data-[state=active]:text-[#12698c] data-[state=active]:shadow-none" value="reports"><BarChart3 className="h-4 w-4" />{t("التقارير", "Reports")}</TabsTrigger>
          <TabsTrigger className="col-span-2 min-h-10 gap-2 rounded-xl text-xs font-bold data-[state=active]:bg-[#e8f8fd] data-[state=active]:text-[#12698c] data-[state=active]:shadow-none sm:col-span-1" value="periods"><CalendarRange className="h-4 w-4" />{t("الفترات", "Periods")}</TabsTrigger>
        </TabsList>

        {/* ===== Dashboard ===== */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={<TrendingUp className="h-5 w-5" />} color="emerald" label={t("الإيرادات", "Revenue")} value={money(dash?.revenue ?? 0)} />
            <Kpi icon={<Wallet className="h-5 w-5" />} color={((dash?.netProfit ?? 0) >= 0 ? "teal" : "rose")} label={t("صافي الربح", "Net Profit")} value={money(dash?.netProfit ?? 0)} sub={t(`هامش ${Math.round(dash?.netMarginPct ?? 0)}%`, `Margin ${Math.round(dash?.netMarginPct ?? 0)}%`)} />
            <Kpi icon={<ReceiptText className="h-5 w-5" />} color="amber" label={t("تكلفة المبيعات", "Cost of Sales")} value={money(dash?.cogs ?? 0)} />
            <Kpi icon={<Wallet className="h-5 w-5" />} color="sky" label={t("النقدية والبنك", "Cash & Bank")} value={money(dash?.cashOnHand ?? 0)} />
          </div>
          <div className="grid overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)] sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell icon={<ArrowDownLeft />} label={t("ذمم لنا", "Receivables")} value={money(dash?.receivable ?? 0)} tone="blue" />
            <MetricCell icon={<ArrowUpRight />} label={t("التزامات علينا", "Payables")} value={money(dash?.payable ?? 0)} tone="rose" />
            <MetricCell icon={<CircleDollarSign />} label={t("مجمل الربح", "Gross profit")} value={money(dash?.grossProfit ?? 0)} tone="green" />
            <MetricCell icon={<FileText />} label={t("قيود مُرحّلة", "Posted entries")} value={String(status?.postedEntries ?? 0)} tone="slate" />
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-[#3cc4f0]/20 bg-[#ecfeff] px-4 py-3 text-sm text-[#315f77] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><Boxes className="h-5 w-5 shrink-0 text-[#1598c4]" /><span>{t("البيع والمنافذ والمخزون والهالك والرواتب مرتبطة بالدفتر تلقائياً", "Sales, outlets, inventory, waste and payroll post automatically")}</span></div>
            <span className="whitespace-nowrap text-xs font-bold text-[#12698c]">{status?.accounts ?? 0} {t("حساب", "accounts")} · {status?.postableAccounts ?? 0} {t("ترحيلي", "postable")}</span>
          </div>
        </TabsContent>

        {/* ===== Journal ===== */}
        <TabsContent value="journal" className="mt-4">
          <JournalTab isRtl={isRtl} t={t} money={money} accounts={accounts || []} from={from} to={to} sessionToken={sessionToken} />
        </TabsContent>

        {/* ===== Chart of Accounts ===== */}
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab isRtl={isRtl} t={t} accounts={accounts || []} />
        </TabsContent>

        {/* ===== Reports ===== */}
        <TabsContent value="reports" className="mt-4">
          <ReportsTab isRtl={isRtl} t={t} money={money} from={from} to={to} sessionToken={sessionToken} />
        </TabsContent>
        <TabsContent value="periods" className="mt-4">
          <PeriodsTab isRtl={isRtl} t={t} sessionToken={sessionToken} />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-bold text-sky-100/70">{label}</span><Input type="date" value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" className="h-11 rounded-xl border-white/15 bg-white/10 text-center text-xs font-bold text-white shadow-none [color-scheme:dark] focus-visible:ring-[#3cc4f0]" /></label>;
}

const COLORS: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100", teal: "bg-cyan-50 text-cyan-800 border-cyan-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100", sky: "bg-sky-50 text-sky-700 border-sky-100",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-100", rose: "bg-rose-50 text-rose-700 border-rose-100",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};
function Kpi({ icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${COLORS[color]}`}>{icon}</div>
      </div>
      <p className="text-xl font-black tabular-nums text-[#0f2738] md:text-2xl" dir="ltr">{value}</p>
      {sub && <p className="mt-1 text-[11px] font-semibold text-slate-400">{sub}</p>}
    </div>
  );
}

function MetricCell({ icon, label, value, tone }: { icon: any; label: string; value: string; tone: "blue" | "rose" | "green" | "slate" }) {
  const tones = { blue: "text-[#168fb8] bg-[#e8f8fd]", rose: "text-rose-600 bg-rose-50", green: "text-emerald-700 bg-emerald-50", slate: "text-slate-600 bg-slate-100" };
  return (
    <div className="flex min-h-[92px] items-center gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:[&:nth-child(odd)]:border-e lg:border-b-0 lg:border-e lg:last:border-e-0">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]} [&_svg]:h-4 [&_svg]:w-4`}>{icon}</span>
      <div className="min-w-0"><p className="text-[11px] font-bold text-slate-400">{label}</p><p className="mt-1 truncate text-base font-black tabular-nums text-[#0f2738]" dir="ltr">{value}</p></div>
    </div>
  );
}

// ================= Chart of Accounts =================
function AccountsTab({ isRtl, t, accounts }: any) {
  const typeLabel: Record<string, string> = {
    asset: t("أصول", "Assets"), liability: t("خصوم", "Liabilities"),
    equity: t("حقوق ملكية", "Equity"), revenue: t("إيرادات", "Revenue"), expense: t("مصروفات", "Expenses"),
  };
  const typeColor: Record<string, string> = {
    asset: "bg-sky-100 text-sky-700", liability: "bg-rose-100 text-rose-700",
    equity: "bg-violet-100 text-violet-700", revenue: "bg-emerald-100 text-emerald-700", expense: "bg-amber-100 text-amber-700",
  };
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7fafc] text-[11px] font-bold text-slate-500">
            <tr>
              <th className="text-start p-3 font-semibold">{t("الكود", "Code")}</th>
              <th className="text-start p-3 font-semibold">{t("اسم الحساب", "Account")}</th>
              <th className="text-start p-3 font-semibold">{t("النوع", "Type")}</th>
              <th className="text-start p-3 font-semibold">{t("الطبيعة", "Normal")}</th>
              <th className="text-center p-3 font-semibold">{t("قابل للترحيل", "Postable")}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a: any) => {
              const depth = (a.code.length <= 1 ? 0 : a.code.length === 2 ? 1 : 2);
              const isGroup = !a.isPostable;
              return (
                <tr key={a._id} className={`border-t border-slate-100 transition-colors ${isGroup ? "bg-[#f3f8fb] font-bold text-[#315f77]" : "hover:bg-sky-50/35"}`}>
                  <td className="p-3 tabular-nums text-slate-400">{a.code}</td>
                  <td className="p-3" style={{ paddingInlineStart: 12 + depth * 20 }}>
                    {isRtl ? a.nameAr : (a.nameEn || a.nameAr)}
                  </td>
                  <td className="p-3"><span className={`text-[11px] px-2 py-0.5 rounded-full ${typeColor[a.accountType]}`}>{typeLabel[a.accountType]}</span></td>
                  <td className="p-3 text-slate-500">{a.normalBalance === "debit" ? t("مدين", "Debit") : t("دائن", "Credit")}</td>
                  <td className="p-3 text-center">{a.isPostable ? "✓" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ================= Journal =================
function JournalTab({ isRtl, t, money, accounts, from, to, sessionToken }: any) {
  const entries = useQuery(api.financePost.listJournalEntries, { fromDate: from, toDate: to, limit: 200, sessionToken });
  const reverse = useMutation(api.financePost.reverseEntry);
  const postable = accounts.filter((a: any) => a.isPostable);

  const doReverse = async (id: string) => {
    const reason = window.prompt(t("سبب العكس:", "Reversal reason:"));
    if (!reason) return;
    try { await reverse({ entryId: id as any, reason, sessionToken }); }
    catch (e: any) { alert(e.message || String(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <NewEntryDialog t={t} isRtl={isRtl} accounts={postable} sessionToken={sessionToken} />
        <ExpenseDialog t={t} isRtl={isRtl} accounts={postable} sessionToken={sessionToken} />
      </div>
      <Card className="overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7fafc] text-[11px] font-bold text-slate-500">
              <tr>
                <th className="text-start p-3 font-semibold">{t("رقم", "No.")}</th>
                <th className="text-start p-3 font-semibold">{t("التاريخ", "Date")}</th>
                <th className="text-start p-3 font-semibold">{t("البيان", "Description")}</th>
                <th className="text-end p-3 font-semibold">{t("مدين", "Debit")}</th>
                <th className="text-end p-3 font-semibold">{t("دائن", "Credit")}</th>
                <th className="text-center p-3 font-semibold">{t("الحالة", "Status")}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(entries || []).length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t("لا توجد قيود في هذه الفترة", "No entries in this period")}</td></tr>
              )}
              {(entries || []).map((e: any) => (
                <tr key={e._id} className="border-t border-slate-100 align-top transition-colors hover:bg-sky-50/35">
                  <td className="p-3 tabular-nums text-slate-400">{e.entryNumber}</td>
                  <td className="p-3 tabular-nums" dir="ltr">{e.entryDate}</td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-700">{e.description}</div>
                    <div className="mt-1 space-y-0.5">
                      {e.lines?.map((l: any) => (
                        <div key={l._id} className="text-[11px] text-slate-500 flex gap-2">
                          <span className="tabular-nums text-slate-400">{accByIdCode(accounts, l.accountId)}</span>
                          <span>{accByIdName(accounts, l.accountId, isRtl)}</span>
                          <span className="tabular-nums">{l.debit ? "Dr " + money(l.debit) : "Cr " + money(l.credit)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-end tabular-nums">{money(e.totalDebit)}</td>
                  <td className="p-3 text-end tabular-nums">{money(e.totalCredit)}</td>
                  <td className="p-3 text-center">
                    <Badge variant={e.postingStatus === "posted" ? "default" : "secondary"} className={e.postingStatus === "reversed" ? "bg-rose-100 text-rose-700" : e.postingStatus === "posted" ? "bg-emerald-100 text-emerald-700" : ""}>
                      {e.postingStatus === "posted" ? t("مُرحَّل", "Posted") : e.postingStatus === "reversed" ? t("معكوس", "Reversed") : t("مسودة", "Draft")}
                    </Badge>
                    {e.isAutoGenerated && <div className="text-[10px] text-slate-400 mt-1">{t("تلقائي", "Auto")}</div>}
                  </td>
                  <td className="p-3">
                    {e.postingStatus === "posted" && !e.reversalEntryId && (
                      <Button variant="ghost" size="sm" onClick={() => doReverse(e._id)} title={t("عكس", "Reverse")}>
                        <RotateCcw className="h-4 w-4 text-rose-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function accByIdCode(accounts: any[], id: string) { return accounts.find((a) => a._id === id)?.code || ""; }
function accByIdName(accounts: any[], id: string, isRtl: boolean) { const a = accounts.find((x) => x._id === id); return a ? (isRtl ? a.nameAr : (a.nameEn || a.nameAr)) : ""; }

// ---- New manual entry dialog ----
function NewEntryDialog({ t, isRtl, accounts, sessionToken }: any) {
  const create = useMutation(api.financePost.createManualEntry);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [desc, setDesc] = useState("");
  const [lines, setLines] = useState<Array<{ accountId: string; debit: string; credit: string }>>([
    { accountId: "", debit: "", credit: "" }, { accountId: "", debit: "", credit: "" },
  ]);
  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

  const setLine = (i: number, k: string, v: string) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const submit = async () => {
    try {
      await create({
        entryDate: date, description: desc || t("قيد يدوي", "Manual entry"),
        lines: lines.filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
          .map((l) => ({ accountId: l.accountId as any, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
        sessionToken,
      });
      setOpen(false); setDesc(""); setLines([{ accountId: "", debit: "", credit: "" }, { accountId: "", debit: "", credit: "" }]);
    } catch (e: any) { alert(e.message || String(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-11 gap-2 rounded-xl bg-[#1598c4] font-bold hover:bg-[#1288af]"><Plus className="h-4 w-4" />{t("قيد يدوي", "New Entry")}</Button></DialogTrigger>
      <DialogContent className="max-w-2xl" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader><DialogTitle>{t("قيد يومية جديد", "New Journal Entry")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">{t("التاريخ", "Date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("البيان", "Description")}</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("وصف القيد", "Entry description")} /></div>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_40px] gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2 sm:grid-cols-[1fr_112px_112px_40px] sm:items-center">
                <Select value={l.accountId} onValueChange={(v) => setLine(i, "accountId", v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={t("اختر الحساب", "Select account")} /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a: any) => <SelectItem key={a._id} value={a._id}>{a.code} — {isRtl ? a.nameAr : (a.nameEn || a.nameAr)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="w-full" type="number" placeholder={t("مدين", "Debit")} value={l.debit} onChange={(e) => setLine(i, "debit", e.target.value)} dir="ltr" />
                <Input className="w-full" type="number" placeholder={t("دائن", "Credit")} value={l.credit} onChange={(e) => setLine(i, "credit", e.target.value)} dir="ltr" />
                <Button variant="ghost" size="sm" onClick={() => setLines((ls) => ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls)}><Trash2 className="h-4 w-4 text-slate-400" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setLines((ls) => [...ls, { accountId: "", debit: "", credit: "" }])}><Plus className="h-3 w-3" />{t("سطر", "Line")}</Button>
          </div>
          <div className={`flex justify-between text-sm font-bold p-2 rounded-lg ${balanced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            <span>{t("مدين", "Debit")}: {totalDr.toFixed(2)}</span>
            <span>{t("دائن", "Credit")}: {totalCr.toFixed(2)}</span>
            <span>{balanced ? t("✓ متوازن", "✓ Balanced") : t("✗ غير متوازن", "✗ Unbalanced")}</span>
          </div>
        </div>
        <DialogFooter><Button disabled={!balanced} onClick={submit}>{t("ترحيل القيد", "Post Entry")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Quick expense dialog ----
function ExpenseDialog({ t, isRtl, accounts, sessionToken }: any) {
  const record = useMutation(api.financePost.recordExpense);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [exp, setExp] = useState("");
  const [paid, setPaid] = useState("");
  const expenseAccts = accounts.filter((a: any) => a.accountType === "expense");
  const cashAccts = accounts.filter((a: any) => a.operationalType === "cash" || a.operationalType === "bank");

  const submit = async () => {
    try {
      await record({ entryDate: date, expenseAccountId: exp as any, paidFromAccountId: paid as any, amount: Number(amount), description: desc || t("مصروف", "Expense"), sessionToken });
      setOpen(false); setAmount(""); setDesc(""); setExp(""); setPaid("");
    } catch (e: any) { alert(e.message || String(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="h-11 gap-2 rounded-xl border-slate-300 bg-white font-bold text-slate-700"><ReceiptText className="h-4 w-4" />{t("تسجيل مصروف", "Record Expense")}</Button></DialogTrigger>
      <DialogContent className="max-w-md" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader><DialogTitle>{t("تسجيل مصروف سريع", "Quick Expense")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">{t("التاريخ", "Date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("المبلغ", "Amount")}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t("نوع المصروف", "Expense type")}</Label>
            <Select value={exp} onValueChange={setExp}><SelectTrigger><SelectValue placeholder={t("اختر", "Select")} /></SelectTrigger>
              <SelectContent>{expenseAccts.map((a: any) => <SelectItem key={a._id} value={a._id}>{isRtl ? a.nameAr : (a.nameEn || a.nameAr)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t("مدفوع من", "Paid from")}</Label>
            <Select value={paid} onValueChange={setPaid}><SelectTrigger><SelectValue placeholder={t("كاش / بنك", "Cash / Bank")} /></SelectTrigger>
              <SelectContent>{cashAccts.map((a: any) => <SelectItem key={a._id} value={a._id}>{isRtl ? a.nameAr : (a.nameEn || a.nameAr)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t("البيان", "Description")}</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={!exp || !paid || !(Number(amount) > 0)} onClick={submit}>{t("حفظ المصروف", "Save Expense")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================= Reports =================
function ReportsTab({ isRtl, t, money, from, to, sessionToken }: any) {
  const [report, setReport] = useState("trial");
  const trial = useQuery(api.financeReports.trialBalance, report === "trial" ? { fromDate: from, toDate: to, sessionToken } : "skip");
  const pnl = useQuery(api.financeReports.incomeStatement, report === "pnl" ? { fromDate: from, toDate: to, sessionToken } : "skip");
  const bs = useQuery(api.financeReports.balanceSheet, report === "bs" ? { asOfDate: to, sessionToken } : "skip");
  const cash = useQuery(api.financeReports.cashFlow, report === "cash" ? { fromDate: from, toDate: to, sessionToken } : "skip");
  const channels = useQuery(api.financeReports.channelProfitability, report === "channels" ? { fromDate: from, toDate: to, sessionToken } : "skip");
  const performance = useQuery(api.financeReports.itemAndMaterialPerformance, report === "items" ? { fromDate: from, toDate: to, sessionToken } : "skip");
  const reportOptions = [
    { value: "trial", label: t("ميزان المراجعة", "Trial Balance"), icon: Scale },
    { value: "pnl", label: t("قائمة الدخل", "Income Statement"), icon: TrendingUp },
    { value: "bs", label: t("المركز المالي", "Balance Sheet"), icon: Landmark },
    { value: "cash", label: t("حركة النقدية", "Cash Movement"), icon: Wallet },
    { value: "channels", label: t("قنوات البيع", "Sales Channels"), icon: BarChart3 },
    { value: "items", label: t("الأصناف والمواد", "Items & Materials"), icon: Boxes },
  ];
  const currentReport = reportOptions.find((option) => option.value === report)!;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div><h2 className="text-sm font-black text-[#0f2738]">{t("التقارير المالية", "Financial reports")}</h2><p className="mt-0.5 text-[11px] text-slate-400">{t("اختر التقرير المطلوب للفترة المحددة", "Choose a report for the selected period")}</p></div>
          <span className="hidden rounded-lg bg-[#e8f8fd] px-2.5 py-1 text-[10px] font-bold text-[#12698c] sm:block">{from} · {to}</span>
        </div>
        <div className="hidden grid-cols-3 gap-1.5 sm:grid lg:grid-cols-6">
          {reportOptions.map((option) => { const Icon = option.icon; const active = report === option.value; return <button key={option.value} type="button" onClick={() => setReport(option.value)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors ${active ? "border-[#3cc4f0]/40 bg-[#e8f8fd] text-[#12698c]" : "border-transparent bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-white"}`}><Icon className="h-4 w-4" />{option.label}</button>; })}
        </div>
        <Select value={report} onValueChange={setReport}>
        <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-slate-50 sm:hidden"><currentReport.icon className="h-4 w-4" /><SelectValue /></SelectTrigger>
        <SelectContent>
          {reportOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
      </div>

      {report === "trial" && trial && (
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-[#f7fafc] text-[11px] font-bold uppercase text-slate-500"><tr>
              <th className="text-start p-3">{t("الكود", "Code")}</th><th className="text-start p-3">{t("الحساب", "Account")}</th>
              <th className="text-end p-3">{t("مدين", "Debit")}</th><th className="text-end p-3">{t("دائن", "Credit")}</th>
            </tr></thead>
            <tbody>
              {trial.rows.map((r: any) => (
                <tr key={r.accountId} className="border-t border-slate-100 transition-colors hover:bg-sky-50/35">
                  <td className="p-3 tabular-nums text-slate-400">{r.code}</td>
                  <td className="p-3">{isRtl ? r.nameAr : (r.nameEn || r.nameAr)}</td>
                  <td className="p-3 text-end tabular-nums">{r.balanceDebit ? money(r.balanceDebit) : "—"}</td>
                  <td className="p-3 text-end tabular-nums">{r.balanceCredit ? money(r.balanceCredit) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-[#3cc4f0]/25 bg-[#ecfeff] font-black text-[#123f5c]">
              <td className="p-3" colSpan={2}>{t("الإجمالي", "Total")} {trial.balanced ? "✓" : "✗"}</td>
              <td className="p-3 text-end tabular-nums">{money(trial.totalDebit)}</td>
              <td className="p-3 text-end tabular-nums">{money(trial.totalCredit)}</td>
            </tr></tfoot>
          </table></div>
        </Card>
      )}

      {report === "pnl" && pnl && (
        <Card className="mx-auto max-w-3xl space-y-5 rounded-2xl border-slate-200/80 p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] md:p-6">
          <PnlSection title={t("الإيرادات", "Revenue")} rows={pnl.revenue} money={money} isRtl={isRtl} total={pnl.totalRevenue} totalLabel={t("إجمالي الإيرادات", "Total Revenue")} />
          <PnlSection title={t("تكلفة المبيعات", "Cost of Sales")} rows={pnl.cogs} money={money} isRtl={isRtl} total={pnl.totalCogs} totalLabel={t("إجمالي التكلفة", "Total COGS")} neg />
          <div className="flex justify-between font-bold text-emerald-700 border-t pt-2"><span>{t("مجمل الربح", "Gross Profit")}</span><span className="tabular-nums">{money(pnl.grossProfit)}</span></div>
          <PnlSection title={t("المصروفات التشغيلية", "Operating Expenses")} rows={pnl.opex} money={money} isRtl={isRtl} total={pnl.totalOpex} totalLabel={t("إجمالي المصروفات", "Total Opex")} neg />
          <div className={`flex justify-between rounded-xl border px-4 py-3 text-base font-black ${pnl.netProfit >= 0 ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-600"}`}>
            <span>{t("صافي الربح", "Net Profit")} ({Math.round(pnl.netMarginPct)}%)</span><span className="tabular-nums">{money(pnl.netProfit)}</span>
          </div>
        </Card>
      )}

      {report === "bs" && bs && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="space-y-2 rounded-2xl border-slate-200/80 p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
            <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 font-black text-[#12698c]"><Landmark className="h-4 w-4" />{t("الأصول", "Assets")}</h3>
            {bs.assets.map((r: any) => <Row key={r.code} label={isRtl ? r.nameAr : (r.nameEn || r.nameAr)} val={money(r.amount)} />)}
            <div className="flex justify-between font-black border-t-2 border-slate-300 pt-2"><span>{t("إجمالي الأصول", "Total Assets")}</span><span className="tabular-nums">{money(bs.totalAssets)}</span></div>
          </Card>
          <Card className="space-y-2 rounded-2xl border-slate-200/80 p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
            <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 font-black text-rose-700"><ArrowUpRight className="h-4 w-4" />{t("الخصوم", "Liabilities")}</h3>
            {bs.liabilities.map((r: any) => <Row key={r.code} label={isRtl ? r.nameAr : (r.nameEn || r.nameAr)} val={money(r.amount)} />)}
            <h3 className="font-black text-violet-700 mb-2 mt-4">{t("حقوق الملكية", "Equity")}</h3>
            {bs.equity.map((r: any) => <Row key={r.code} label={isRtl ? r.nameAr : (r.nameEn || r.nameAr)} val={money(r.amount)} />)}
            <Row label={t("صافي ربح الفترة", "Net Profit")} val={money(bs.netProfit)} />
            <div className="flex justify-between font-black border-t-2 border-slate-300 pt-2"><span>{t("إجمالي الخصوم وحقوق الملكية", "Total Liab. & Equity")}</span><span className="tabular-nums">{money(bs.totalLiabAndEquity)}</span></div>
            <div className={`text-xs text-center ${bs.balanced ? "text-emerald-600" : "text-rose-600"}`}>{bs.balanced ? t("✓ الميزانية متوازنة", "✓ Balanced") : t("✗ غير متوازنة", "✗ Not balanced")}</div>
          </Card>
        </div>
      )}

      {report === "cash" && cash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi icon={<Wallet className="h-5 w-5" />} color="slate" label={t("رصيد أول الفترة", "Opening")} value={money(cash.openingBalance)} />
            <Kpi icon={<ArrowDownLeft className="h-5 w-5" />} color="emerald" label={t("المقبوضات", "Inflows")} value={money(cash.inflows)} />
            <Kpi icon={<ArrowUpRight className="h-5 w-5" />} color="rose" label={t("المدفوعات", "Outflows")} value={money(cash.outflows)} />
            <Kpi icon={<TrendingUp className="h-5 w-5" />} color={cash.netChange >= 0 ? "teal" : "rose"} label={t("صافي الحركة", "Net change")} value={money(cash.netChange)} />
            <Kpi icon={<Landmark className="h-5 w-5" />} color="sky" label={t("رصيد آخر الفترة", "Closing")} value={money(cash.closingBalance)} />
          </div>
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-[#f7fafc] text-[11px] font-bold text-slate-500"><tr><th className="p-3 text-start">{t("المصدر", "Source")}</th><th className="p-3 text-end">{t("داخل", "In")}</th><th className="p-3 text-end">{t("خارج", "Out")}</th><th className="p-3 text-end">{t("الصافي", "Net")}</th></tr></thead>
            <tbody>{cash.bySource.map((r: any) => <tr key={r.source} className="border-t border-slate-100 transition-colors hover:bg-sky-50/35"><td className="p-3 font-semibold">{r.source}</td><td className="p-3 text-end text-emerald-700">{money(r.inflow)}</td><td className="p-3 text-end text-rose-600">{money(r.outflow)}</td><td className="p-3 text-end font-bold">{money(r.net)}</td></tr>)}</tbody>
          </table></div></Card>
        </div>
      )}

      {report === "channels" && channels && (
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-[#f7fafc] text-[11px] font-bold text-slate-500"><tr><th className="p-3 text-start">{t("القناة", "Channel")}</th><th className="p-3 text-end">{t("العمليات", "Transactions")}</th><th className="p-3 text-end">{t("الإيراد", "Revenue")}</th><th className="p-3 text-end">{t("المرتجعات", "Returns")}</th><th className="p-3 text-end">{t("المصروفات", "Expenses")}</th><th className="p-3 text-end">{t("الصافي", "Net")}</th></tr></thead>
          <tbody>{channels.map((r: any) => <tr key={r.channel} className="border-t border-slate-100 transition-colors hover:bg-sky-50/35"><td className="p-3 font-bold">{r.channel === "pos" ? t("نقطة البيع", "POS") : r.channel === "outlets" ? t("المنافذ", "Outlets") : r.channel === "purchases" ? t("المشتريات", "Purchases") : t("أخرى", "Other")}</td><td className="p-3 text-end">{r.transactions}</td><td className="p-3 text-end text-emerald-700">{money(r.revenue)}</td><td className="p-3 text-end text-rose-600">{money(r.returns)}</td><td className="p-3 text-end">{money(r.expenses)}</td><td className={`p-3 text-end font-black ${r.net >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{money(r.net)}</td></tr>)}</tbody>
        </table></div></Card>
      )}

      {report === "items" && performance && (
        <div className="grid xl:grid-cols-2 gap-4">
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"><div className="flex items-center gap-3 border-b border-slate-100 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f8fd] text-[#1598c4]"><ReceiptText className="h-4 w-4" /></span><div><h3 className="font-black text-[#0f2738]">{t("أداء أصناف البيع", "Menu Item Performance")}</h3><p className="text-xs text-slate-500">{t("يشمل نقطة البيع والمنافذ والمرتجعات", "POS, outlets and returns")}</p></div></div><div className="max-h-[560px] overflow-x-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-[#f7fafc] text-[11px] font-bold text-slate-500"><tr><th className="p-3 text-start">{t("الصنف", "Item")}</th><th className="p-3 text-end">{t("مباع", "Sold")}</th><th className="p-3 text-end">{t("مرتجع", "Returned")}</th><th className="p-3 text-end">{t("الإيراد", "Revenue")}</th><th className="p-3 text-end">{t("الهامش", "Margin")}</th></tr></thead><tbody>{performance.menuItems.map((r: any) => <tr key={r.key} className="border-t border-slate-100 transition-colors hover:bg-sky-50/35"><td className="p-3 font-semibold">{isRtl ? (r.nameAr || r.nameEn) : (r.nameEn || r.nameAr)}</td><td className="p-3 text-end">{r.soldQty}</td><td className={`p-3 text-end ${r.returnedQty ? "text-rose-600 font-bold" : "text-slate-400"}`}>{r.returnedQty} <span className="text-[10px]">({r.returnRate}%)</span></td><td className="p-3 text-end">{money(r.revenue)}</td><td className={`p-3 text-end font-bold ${r.marginPct == null ? "text-amber-600 text-xs" : r.marginPct >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{r.marginPct == null ? t("التكلفة غير محددة", "Cost missing") : `${r.marginPct}%`}</td></tr>)}</tbody></table></div></Card>
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"><div className="flex items-center gap-3 border-b border-slate-100 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Boxes className="h-4 w-4" /></span><div><h3 className="font-black text-[#0f2738]">{t("استهلاك وهالك المواد", "Material Usage & Waste")}</h3><p className="text-xs text-slate-500">{t("يساعد المطبخ في الشراء وتقليل الهدر", "For kitchen purchasing and waste control")}</p></div></div><div className="max-h-[560px] overflow-x-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-[#f7fafc] text-[11px] font-bold text-slate-500"><tr><th className="p-3 text-start">{t("المادة", "Material")}</th><th className="p-3 text-end">{t("مستهلك", "Used")}</th><th className="p-3 text-end">{t("هالك", "Waste")}</th><th className="p-3 text-end">{t("قيمة الهالك", "Waste value")}</th><th className="p-3 text-end">{t("النسبة", "Rate")}</th></tr></thead><tbody>{performance.materials.map((r: any) => <tr key={r.itemId} className="border-t border-slate-100 transition-colors hover:bg-amber-50/30"><td className="p-3 font-semibold">{isRtl ? r.nameAr : (r.nameEn || r.nameAr)}</td><td className="p-3 text-end">{r.consumedQty.toFixed(2)} {r.unit}</td><td className="p-3 text-end text-rose-600">{r.wasteQty.toFixed(2)}</td><td className="p-3 text-end">{money(r.wasteValue)}</td><td className={`p-3 text-end font-bold ${r.wasteRate > 5 ? "text-rose-600" : "text-emerald-700"}`}>{r.wasteRate}%</td></tr>)}</tbody></table></div></Card>
        </div>
      )}
    </div>
  );
}

function PeriodsTab({ t, sessionToken }: any) {
  const periods = useQuery(api.finance.listPeriods, { sessionToken }) || [];
  const setStatus = useMutation(api.finance.setPeriodStatus);
  const change = async (periodId: string, status: "open" | "locked" | "closed") => {
    const warning = status === "closed" ? t("الإقفال النهائي لا يمكن التراجع عنه. هل أنت متأكد؟", "Final close cannot be undone. Continue?") : t("تأكيد تغيير حالة الفترة؟", "Change period status?");
    if (!window.confirm(warning)) return;
    try { await setStatus({ periodId: periodId as any, status, sessionToken }); }
    catch (e: any) { alert(e.message || String(e)); }
  };
  return <Card className="overflow-hidden rounded-2xl border-slate-200/80 p-0 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-black text-[#0f2738]">{t("إدارة الفترات المحاسبية", "Accounting periods")}</h2><p className="mt-1 text-xs text-slate-400">{t("أغلق الفترات بعد اكتمال المراجعة لمنع أي ترحيل لاحق", "Close reviewed periods to prevent later posting")}</p></div><div className="overflow-x-auto"><table className="w-full text-sm">
    <thead className="bg-[#f7fafc] text-[11px] font-bold text-slate-500"><tr><th className="p-3 text-start">{t("الفترة", "Period")}</th><th className="p-3 text-start">{t("من", "From")}</th><th className="p-3 text-start">{t("إلى", "To")}</th><th className="p-3 text-center">{t("الحالة", "Status")}</th><th className="p-3 text-end">{t("الإجراء", "Action")}</th></tr></thead>
    <tbody>{periods.map((p: any) => <tr key={p._id} className="border-t border-slate-100 transition-colors hover:bg-sky-50/35"><td className="flex items-center gap-2 p-3 font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f8fd]"><CalendarRange className="h-4 w-4 text-[#1598c4]" /></span>{p.name}</td><td className="p-3" dir="ltr">{p.startDate}</td><td className="p-3" dir="ltr">{p.endDate}</td><td className="p-3 text-center"><Badge className={p.status === "open" ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : p.status === "locked" ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-slate-200 bg-slate-100 text-slate-700"}>{p.status === "open" ? t("مفتوحة", "Open") : p.status === "locked" ? t("مقفلة مؤقتًا", "Locked") : t("مقفلة نهائيًا", "Closed")}</Badge></td><td className="p-3"><div className="flex justify-end gap-2">{p.status === "open" && <Button className="rounded-lg" size="sm" variant="outline" onClick={() => change(p._id, "locked")}><LockKeyhole className="h-4 w-4 me-1" />{t("قفل مؤقت", "Lock")}</Button>}{p.status === "locked" && <><Button className="rounded-lg" size="sm" variant="outline" onClick={() => change(p._id, "open")}>{t("إعادة فتح", "Reopen")}</Button><Button className="rounded-lg bg-[#1598c4] hover:bg-[#1288af]" size="sm" onClick={() => change(p._id, "closed")}>{t("إقفال نهائي", "Final close")}</Button></>}</div></td></tr>)}</tbody>
  </table></div></Card>;
}
function Row({ label, val }: any) { return <div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className="tabular-nums">{val}</span></div>; }
function PnlSection({ title, rows, money, isRtl, total, totalLabel, neg }: any) {
  return (
    <div>
      <h4 className="font-bold text-slate-700 mb-1">{title}</h4>
      {rows.map((r: any) => <div key={r.code} className="flex justify-between text-sm text-slate-600"><span>{isRtl ? r.nameAr : (r.nameEn || r.nameAr)}</span><span className="tabular-nums">{neg ? "(" + money(r.amount) + ")" : money(r.amount)}</span></div>)}
      <div className="flex justify-between text-sm font-semibold border-t mt-1 pt-1"><span>{totalLabel}</span><span className="tabular-nums">{money(total)}</span></div>
    </div>
  );
}
