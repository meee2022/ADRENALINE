import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
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

  const dash = useQuery(api.financeReports.financeDashboard, { fromDate: from, toDate: to });
  const accounts = useQuery(api.finance.listAccounts, { activeOnly: true });
  const status = useQuery(api.finance.financeStatus, {});

  return (
    <div className="p-4 md:p-6 space-y-5" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-lg">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">{t("المالية والمحاسبة", "Finance & Accounting")}</h1>
            <p className="text-sm text-slate-500">{t("قيد مزدوج كامل — ترحيل تلقائي وتقارير لحظية", "Full double-entry — auto-posting & live reports")}</p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">{t("من", "From")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">{t("إلى", "To")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="h-9 w-40" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="dashboard">{t("لوحة المؤشرات", "Dashboard")}</TabsTrigger>
          <TabsTrigger value="journal">{t("القيود اليومية", "Journal")}</TabsTrigger>
          <TabsTrigger value="accounts">{t("شجرة الحسابات", "Chart of Accounts")}</TabsTrigger>
          <TabsTrigger value="reports">{t("التقارير المالية", "Financial Reports")}</TabsTrigger>
        </TabsList>

        {/* ===== Dashboard ===== */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={<TrendingUp className="h-5 w-5" />} color="emerald" label={t("الإيرادات", "Revenue")} value={money(dash?.revenue ?? 0)} />
            <Kpi icon={<Wallet className="h-5 w-5" />} color={((dash?.netProfit ?? 0) >= 0 ? "teal" : "rose")} label={t("صافي الربح", "Net Profit")} value={money(dash?.netProfit ?? 0)} sub={t(`هامش ${Math.round(dash?.netMarginPct ?? 0)}%`, `Margin ${Math.round(dash?.netMarginPct ?? 0)}%`)} />
            <Kpi icon={<ReceiptText className="h-5 w-5" />} color="amber" label={t("تكلفة المبيعات", "Cost of Sales")} value={money(dash?.cogs ?? 0)} />
            <Kpi icon={<Wallet className="h-5 w-5" />} color="sky" label={t("النقدية والبنك", "Cash & Bank")} value={money(dash?.cashOnHand ?? 0)} />
            <Kpi icon={<ArrowDownLeft className="h-5 w-5" />} color="indigo" label={t("ذمم مدينة (لنا)", "Receivables")} value={money(dash?.receivable ?? 0)} />
            <Kpi icon={<ArrowUpRight className="h-5 w-5" />} color="rose" label={t("ذمم دائنة (علينا)", "Payables")} value={money(dash?.payable ?? 0)} />
            <Kpi icon={<TrendingUp className="h-5 w-5" />} color="emerald" label={t("مجمل الربح", "Gross Profit")} value={money(dash?.grossProfit ?? 0)} />
            <Kpi icon={<FileText className="h-5 w-5" />} color="slate" label={t("عدد القيود", "Journal Entries")} value={String(status?.postedEntries ?? 0)} />
          </div>
          <Card className="p-4 text-sm text-slate-500 flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            {t(
              `شجرة الحسابات: ${status?.accounts ?? 0} حساب (${status?.postableAccounts ?? 0} قابل للترحيل). كل فاتورة POS مدفوعة تُرحَّل محاسبيًا تلقائيًا.`,
              `Chart of accounts: ${status?.accounts ?? 0} accounts (${status?.postableAccounts ?? 0} postable). Every paid POS ticket auto-posts to the ledger.`,
            )}
          </Card>
        </TabsContent>

        {/* ===== Journal ===== */}
        <TabsContent value="journal" className="mt-4">
          <JournalTab isRtl={isRtl} t={t} money={money} accounts={accounts || []} from={from} to={to} />
        </TabsContent>

        {/* ===== Chart of Accounts ===== */}
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab isRtl={isRtl} t={t} accounts={accounts || []} />
        </TabsContent>

        {/* ===== Reports ===== */}
        <TabsContent value="reports" className="mt-4">
          <ReportsTab isRtl={isRtl} t={t} money={money} from={from} to={to} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const COLORS: Record<string, string> = {
  emerald: "from-emerald-500 to-emerald-600", teal: "from-teal-500 to-teal-600",
  amber: "from-amber-500 to-amber-600", sky: "from-sky-500 to-sky-600",
  indigo: "from-indigo-500 to-indigo-600", rose: "from-rose-500 to-rose-600",
  slate: "from-slate-500 to-slate-600",
};
function Kpi({ icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className="p-4 relative overflow-hidden">
      <div className={`absolute top-3 ${"end-3"} h-9 w-9 rounded-xl bg-gradient-to-br ${COLORS[color]} text-white flex items-center justify-center`} style={{ insetInlineEnd: 12 }}>{icon}</div>
      <p className="text-xs text-slate-500 font-semibold">{label}</p>
      <p className="text-xl font-black text-slate-800 mt-2 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </Card>
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
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
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
                <tr key={a._id} className={`border-t border-slate-100 ${isGroup ? "bg-slate-50/60 font-bold" : ""}`}>
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
function JournalTab({ isRtl, t, money, accounts, from, to }: any) {
  const entries = useQuery(api.financePost.listJournalEntries, { fromDate: from, toDate: to, limit: 200 });
  const reverse = useMutation(api.financePost.reverseEntry);
  const postable = accounts.filter((a: any) => a.isPostable);

  const doReverse = async (id: string) => {
    const reason = window.prompt(t("سبب العكس:", "Reversal reason:"));
    if (!reason) return;
    try { await reverse({ entryId: id as any, reason }); }
    catch (e: any) { alert(e.message || String(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <NewEntryDialog t={t} isRtl={isRtl} accounts={postable} />
        <ExpenseDialog t={t} isRtl={isRtl} accounts={postable} />
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
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
                <tr key={e._id} className="border-t border-slate-100 align-top">
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
function NewEntryDialog({ t, isRtl, accounts }: any) {
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
      });
      setOpen(false); setDesc(""); setLines([{ accountId: "", debit: "", credit: "" }, { accountId: "", debit: "", credit: "" }]);
    } catch (e: any) { alert(e.message || String(e)); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />{t("قيد يدوي", "New Entry")}</Button></DialogTrigger>
      <DialogContent className="max-w-2xl" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader><DialogTitle>{t("قيد يومية جديد", "New Journal Entry")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">{t("التاريخ", "Date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" /></div>
            <div className="space-y-1"><Label className="text-xs">{t("البيان", "Description")}</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("وصف القيد", "Entry description")} /></div>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select value={l.accountId} onValueChange={(v) => setLine(i, "accountId", v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={t("اختر الحساب", "Select account")} /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a: any) => <SelectItem key={a._id} value={a._id}>{a.code} — {isRtl ? a.nameAr : (a.nameEn || a.nameAr)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="w-28" type="number" placeholder={t("مدين", "Debit")} value={l.debit} onChange={(e) => setLine(i, "debit", e.target.value)} dir="ltr" />
                <Input className="w-28" type="number" placeholder={t("دائن", "Credit")} value={l.credit} onChange={(e) => setLine(i, "credit", e.target.value)} dir="ltr" />
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
function ExpenseDialog({ t, isRtl, accounts }: any) {
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
      await record({ entryDate: date, expenseAccountId: exp as any, paidFromAccountId: paid as any, amount: Number(amount), description: desc || t("مصروف", "Expense") });
      setOpen(false); setAmount(""); setDesc(""); setExp(""); setPaid("");
    } catch (e: any) { alert(e.message || String(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="gap-2"><ReceiptText className="h-4 w-4" />{t("تسجيل مصروف", "Record Expense")}</Button></DialogTrigger>
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
function ReportsTab({ isRtl, t, money, from, to }: any) {
  const [report, setReport] = useState("trial");
  const trial = useQuery(api.financeReports.trialBalance, report === "trial" ? { fromDate: from, toDate: to } : "skip");
  const pnl = useQuery(api.financeReports.incomeStatement, report === "pnl" ? { fromDate: from, toDate: to } : "skip");
  const bs = useQuery(api.financeReports.balanceSheet, report === "bs" ? { asOfDate: to } : "skip");

  return (
    <div className="space-y-4">
      <Select value={report} onValueChange={setReport}>
        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="trial">{t("ميزان المراجعة", "Trial Balance")}</SelectItem>
          <SelectItem value="pnl">{t("قائمة الدخل (الأرباح والخسائر)", "Income Statement (P&L)")}</SelectItem>
          <SelectItem value="bs">{t("الميزانية العمومية", "Balance Sheet")}</SelectItem>
        </SelectContent>
      </Select>

      {report === "trial" && trial && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-start p-3">{t("الكود", "Code")}</th><th className="text-start p-3">{t("الحساب", "Account")}</th>
              <th className="text-end p-3">{t("مدين", "Debit")}</th><th className="text-end p-3">{t("دائن", "Credit")}</th>
            </tr></thead>
            <tbody>
              {trial.rows.map((r: any) => (
                <tr key={r.accountId} className="border-t border-slate-100">
                  <td className="p-3 tabular-nums text-slate-400">{r.code}</td>
                  <td className="p-3">{isRtl ? r.nameAr : (r.nameEn || r.nameAr)}</td>
                  <td className="p-3 text-end tabular-nums">{r.balanceDebit ? money(r.balanceDebit) : "—"}</td>
                  <td className="p-3 text-end tabular-nums">{r.balanceCredit ? money(r.balanceCredit) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-slate-300 font-black bg-slate-50">
              <td className="p-3" colSpan={2}>{t("الإجمالي", "Total")} {trial.balanced ? "✓" : "✗"}</td>
              <td className="p-3 text-end tabular-nums">{money(trial.totalDebit)}</td>
              <td className="p-3 text-end tabular-nums">{money(trial.totalCredit)}</td>
            </tr></tfoot>
          </table></div>
        </Card>
      )}

      {report === "pnl" && pnl && (
        <Card className="p-5 space-y-4 max-w-2xl">
          <PnlSection title={t("الإيرادات", "Revenue")} rows={pnl.revenue} money={money} isRtl={isRtl} total={pnl.totalRevenue} totalLabel={t("إجمالي الإيرادات", "Total Revenue")} />
          <PnlSection title={t("تكلفة المبيعات", "Cost of Sales")} rows={pnl.cogs} money={money} isRtl={isRtl} total={pnl.totalCogs} totalLabel={t("إجمالي التكلفة", "Total COGS")} neg />
          <div className="flex justify-between font-bold text-emerald-700 border-t pt-2"><span>{t("مجمل الربح", "Gross Profit")}</span><span className="tabular-nums">{money(pnl.grossProfit)}</span></div>
          <PnlSection title={t("المصروفات التشغيلية", "Operating Expenses")} rows={pnl.opex} money={money} isRtl={isRtl} total={pnl.totalOpex} totalLabel={t("إجمالي المصروفات", "Total Opex")} neg />
          <div className={`flex justify-between font-black text-lg border-t-2 border-slate-300 pt-3 ${pnl.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
            <span>{t("صافي الربح", "Net Profit")} ({Math.round(pnl.netMarginPct)}%)</span><span className="tabular-nums">{money(pnl.netProfit)}</span>
          </div>
        </Card>
      )}

      {report === "bs" && bs && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-2">
            <h3 className="font-black text-sky-700 mb-2">{t("الأصول", "Assets")}</h3>
            {bs.assets.map((r: any) => <Row key={r.code} label={isRtl ? r.nameAr : (r.nameEn || r.nameAr)} val={money(r.amount)} />)}
            <div className="flex justify-between font-black border-t-2 border-slate-300 pt-2"><span>{t("إجمالي الأصول", "Total Assets")}</span><span className="tabular-nums">{money(bs.totalAssets)}</span></div>
          </Card>
          <Card className="p-5 space-y-2">
            <h3 className="font-black text-rose-700 mb-2">{t("الخصوم", "Liabilities")}</h3>
            {bs.liabilities.map((r: any) => <Row key={r.code} label={isRtl ? r.nameAr : (r.nameEn || r.nameAr)} val={money(r.amount)} />)}
            <h3 className="font-black text-violet-700 mb-2 mt-4">{t("حقوق الملكية", "Equity")}</h3>
            {bs.equity.map((r: any) => <Row key={r.code} label={isRtl ? r.nameAr : (r.nameEn || r.nameAr)} val={money(r.amount)} />)}
            <Row label={t("صافي ربح الفترة", "Net Profit")} val={money(bs.netProfit)} />
            <div className="flex justify-between font-black border-t-2 border-slate-300 pt-2"><span>{t("إجمالي الخصوم وحقوق الملكية", "Total Liab. & Equity")}</span><span className="tabular-nums">{money(bs.totalLiabAndEquity)}</span></div>
            <div className={`text-xs text-center ${bs.balanced ? "text-emerald-600" : "text-rose-600"}`}>{bs.balanced ? t("✓ الميزانية متوازنة", "✓ Balanced") : t("✗ غير متوازنة", "✗ Not balanced")}</div>
          </Card>
        </div>
      )}
    </div>
  );
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
