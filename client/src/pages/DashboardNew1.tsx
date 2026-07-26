/**
 * @file client/src/pages/DashboardNew1.tsx
 * @description لوحة تحكم Adrenaline — بهوية سماوي/كحلي فاتحة، شاملة كل المستحدثات:
 *   الحضور فوق، أولويات، تقدم اليوم، مبيعات POS + الجم + الولاء، أحداث حساسة،
 *   خرائط المطبخ والتوصيل، ورسم آخر 7 أيام. تعتمد على reactive queries لتحديث لحظي.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "convex/react";
import { format, parseISO, differenceInCalendarDays, addDays } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, ChefHat,
  ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, Package, Receipt, Route,
  ShieldAlert, Sparkles, Store, Sun, Sunset, TrendingUp, Users, UserCheck, Dumbbell, Coins,
  Wallet, Truck, Boxes, Bug, FileText, ArrowDownRight, ArrowUpRight,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { api } from "@/../../convex/_generated/api";
import { useCustomers, useDailyPlans } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type DetailView = "active" | "expiring" | "expired" | "meals" | "inventory" | null;

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PREPARED: "bg-emerald-50 text-emerald-700",
  DELIVERED: "bg-teal-50 text-teal-700",
};

/** صف صافي الربح — أخضر للربح وأحمر للخسارة، فيُقرأ الاتجاه قبل الرقم. */
const cnRow = (positive: boolean) =>
  `mt-2 flex items-center justify-between rounded-xl border-2 px-3 py-2.5 ${
    positive ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-800"
  }`;

export default function DashboardNew() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const tr = (a: string, e: string) => (isRtl ? a : e);
  const locale = isRtl ? ar : enUS;
  const [, navigate] = useLocation();
  const currentUser = useStore((s) => s.currentUser);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [detailView, setDetailView] = useState<DetailView>(null);

  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const { data: dailyPlans = [], isLoading: plansLoading } = useDailyPlans();
  const inventoryItems = useQuery(api.inventory.list, {}) || [];
  const pendingOrders = useQuery(api.customerOrders.countPending) as number | undefined;
  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const attendance = useQuery(api.attendance.todayCounts, { date: dateKey, sessionToken }) as any;
  const leave = useQuery(api.leaves.onLeaveToday, { date: dateKey, sessionToken }) as any;
  const managerSnap = useQuery(api.manager.liveSnapshot, { sessionToken }) as any;
  const posDaily = useQuery(api.posAdmin.dailySummary, { date: dateKey, sessionToken }) as any;
  /* ⚠️ المخصّصون مصدرهم القالب (customizedTemplates) لا الخطة اليومية، فلا صفّ
     لهم في dailyPlans إطلاقاً. كانت اللوحة تعدّ الخطط وحدها فتُسقطهم بالكامل:
     يوم 26-7 كان 110 خطة بينما هناك 29 مخصّصاً نشطاً — صفر منهم في العدّ. */
  const customizedToday = useQuery(
    api.customizedPlans.forDate, { date: dateKey, sessionToken },
  ) as any[] | undefined;

  /* ═══ الحجم التشغيلي: أقسام كانت شغّالة في التطبيق وغائبة عن اللوحة ═══
     المالية والمخزون والمشتريات وصحة النظام. لا نعرض قسماً بلا بيانات
     حقيقية (العُهد والتقييمات فارغتان بعد) حتى لا تُقرأ الأصفار كأرقام. */
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
  const fin = useQuery(api.financeReports.financeDashboard,
    { fromDate: monthStart, toDate: dateKey, sessionToken }) as any;
  const invSummary = useQuery(api.inventory.getSummary, { sessionToken }) as any;
  const invoices = useQuery(api.purchaseInvoices.listInvoices, { limit: 100, sessionToken }) as any[] | undefined;
  const suppliers = useQuery(api.inventory.getSuppliers, { sessionToken }) as any[] | undefined;
  const clientErrors = useQuery(api.clientErrors.recent, { limit: 50, sessionToken }) as any[] | undefined;
  const gymList = useQuery(api.gymSales.listOrders, { from: dateKey, to: dateKey, sessionToken }) as any;
  const loading = customersLoading || plansLoading;

  /* ═══════ Metrics ═══════ */
  const metrics = useMemo(() => {
    const todayPlans = dailyPlans.filter((p) => p.date === dateKey);
    const daysRemaining = (endDate?: string) => {
      if (!endDate) return null;
      const d = parseISO(endDate);
      return Number.isNaN(d.getTime()) ? null : differenceInCalendarDays(d, new Date());
    };
    const active = customers.filter((c) => { const d = daysRemaining(c.endDate); return d !== null && d >= 0; });
    const expiring = customers.filter((c) => { const d = daysRemaining(c.endDate); return d !== null && d >= 0 && d <= 3; });
    const expired = customers.filter((c) => { const d = daysRemaining(c.endDate); return d !== null && d < 0; });
    const lowStock = inventoryItems.filter((i: any) => Number(i.currentStock ?? 0) <= Number(i.minStock ?? 0));
    const prepared = todayPlans.filter((p) => ["PREPARED", "DELIVERED"].includes(p.status)).length;
    const delivered = todayPlans.filter((p) => p.status === "DELIVERED").length;
    const morning = todayPlans.filter((p) => p.deliveryTime === "MORNING").length;
    // المخصّصون يُطبخون ويُوصَّلون مثل الجميع، فيدخلون العدّ والتوزيع الصباحي/المسائي.
    const custList = customizedToday || [];
    const custMorning = custList.filter((c: any) => c.deliveryTime !== "EVENING").length;
    const totalToday = todayPlans.length + custList.length;
    return {
      todayPlans, active, expiring, expired, lowStock, prepared, delivered,
      customized: custList.length,
      totalToday,
      morning: morning + custMorning,
      evening: totalToday - (morning + custMorning),
      paused: customers.filter((c: any) => Boolean(c.pausedFrom)).length,
      // ⚠️ نسبتا المطبخ والتوصيل تُحسبان على الخطط القابلة للتتبّع فقط —
      //    المخصّص بلا حالة (لا PREPARED ولا DELIVERED) فإدخاله يخفض النسبة زوراً.
      prepRate: todayPlans.length ? Math.round((prepared / todayPlans.length) * 100) : 0,
      deliveryRate: todayPlans.length ? Math.round((delivered / todayPlans.length) * 100) : 0,
    };
  }, [customers, dailyPlans, inventoryItems, dateKey, customizedToday]);

  /** ملخّص المشتريات: فواتير الشهر الجاري وقيمتها — من رؤوس الفواتير المستوردة. */
  const purchases = useMemo(() => {
    const rows = (invoices || []).filter((i: any) => String(i.invoiceDate) >= monthStart);
    return {
      count: rows.length,
      total: rows.reduce((s: number, i: any) => s + Number(i.total || 0), 0),
      lastDate: rows.map((i: any) => i.invoiceDate).sort().pop() || null,
    };
  }, [invoices, monthStart]);

  /** أخطاء الواجهة: إجمالي المسجَّل وكم منها خلال 24 ساعة. */
  const errors = useMemo(() => {
    const rows = clientErrors || [];
    const dayAgo = Date.now() - 86400000;
    return { total: rows.length, last24h: rows.filter((e: any) => Number(e.at) >= dayAgo).length };
  }, [clientErrors]);

  const weeklyData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const day = addDays(new Date(), i - 6);
    return {
      day: format(day, "EEE", { locale }),
      meals: dailyPlans.filter((p) => p.date === format(day, "yyyy-MM-dd")).length,
    };
  }), [dailyPlans, locale]);

  const statusLabel = (s: string) => ({
    DRAFT: tr("مسودة", "Draft"), CONFIRMED: tr("مؤكدة", "Confirmed"),
    PREPARED: tr("جاهزة", "Prepared"), DELIVERED: tr("تم التوصيل", "Delivered"),
  }[s] || s);

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const firstName = currentUser?.name?.trim().split(" ")[0] || tr("فريق أدرينالين", "Adrenaline team");
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return tr("صباح الخير", "Good morning");
    if (h < 18) return tr("مساء الخير", "Good afternoon");
    return tr("مساء النور", "Good evening");
  })();

  /* ═══════ Alerts (priorities) ═══════ */
  const alerts = [
    { show: (pendingOrders ?? 0) > 0, icon: ClipboardCheck, count: pendingOrders ?? 0,
      title: tr("طلبات تنتظر المراجعة", "Orders awaiting review"),
      detail: tr("تحتاج قرار قبل التحضير", "Approve before kitchen prep"),
      tone: "amber", action: () => navigate("/orders/pending") },
    { show: metrics.expiring.length > 0, icon: CircleAlert, count: metrics.expiring.length,
      title: tr("اشتراكات تنتهي خلال 3 أيام", "Subscriptions ending in 3 days"),
      detail: tr("فرصة تواصل وتجديد", "Renewal opportunity"),
      tone: "rose", action: () => setDetailView("expiring") },
    { show: metrics.lowStock.length > 0, icon: Package, count: metrics.lowStock.length,
      title: tr("تنبيهات المخزون", "Inventory alerts"),
      detail: tr("أصناف بلغت الحد الأدنى", "Items at min stock"),
      tone: "blue", action: () => setDetailView("inventory") },
    { show: (managerSnap?.alerts?.voidsToday ?? 0) + (managerSnap?.alerts?.refundsToday ?? 0) > 0,
      icon: ShieldAlert, count: (managerSnap?.alerts?.voidsToday ?? 0) + (managerSnap?.alerts?.refundsToday ?? 0),
      title: tr("أحداث حساسة اليوم", "Sensitive events today"),
      detail: tr("إلغاءات/استرجاعات في POS", "POS voids / refunds"),
      tone: "rose", action: () => navigate("/pos-admin") },
    { show: (managerSnap?.alerts?.bigTickets ?? 0) > 0, icon: TrendingUp,
      count: managerSnap?.alerts?.bigTickets ?? 0,
      title: tr("فواتير كبيرة", "Big tickets"),
      detail: tr("فواتير ≥ 100 ر.ق للمتابعة", "Tickets ≥ 100 QAR to review"),
      tone: "amber", action: () => navigate("/manager") },
  ].filter((a) => a.show);

  const detailCustomers = detailView === "active" ? metrics.active
    : detailView === "expiring" ? metrics.expiring : metrics.expired;

  /* ═══════ POS + Gym rollups ═══════ */
  const posToday = {
    revenue: posDaily?.totalSales ?? 0,
    tickets: posDaily?.ticketsCount ?? 0,
    avg: posDaily?.avgTicket ?? 0,
    staff: posDaily?.staffMealsCount ?? 0,
    staffValue: posDaily?.staffMealsValue ?? 0,
  };
  const gymToday = {
    revenue: gymList?.totalRevenue ?? 0,
    meals: gymList?.totalMeals ?? 0,
    orders: gymList?.count ?? 0,
  };
  const activeCashiers = managerSnap?.openShifts?.length ?? 0;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto w-full max-w-[1600px] space-y-5 pb-10 text-[#17324d]">

      {/* ═══════ 1. Header hero ═══════ */}
      <header className="relative overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#3cc4f0_0%,#2bb0dc_48%,#47759c_100%)] px-6 py-6 text-white shadow-[0_22px_55px_-28px_rgba(14,118,172,.7)]">
        <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rotate-12 rounded-[44px] border border-white/20 bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 end-40 h-48 w-72 -rotate-12 rounded-[44px] border border-white/10 bg-[#315f83]/20" />
        <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              {tr("أدرينالين يعمل الآن", "Adrenaline live now")}
            </div>
            <h1 className="text-2xl font-black leading-tight sm:text-3xl">
              {greeting}، {firstName}
            </h1>
            <p className="mt-1.5 text-sm text-white/85">
              {tr("هذه الصورة التشغيلية اليوم. ابدأ بما يحتاج قرارك.", "Today's operational picture. Start with what needs your decision.")}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-white/25 bg-white/15 p-1.5 shadow-sm">
            <button className="grid h-10 w-10 place-items-center rounded-lg transition-colors hover:bg-white/15" onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label={tr("السابق", "Prev")}>
              <PrevIcon className="h-4 w-4" />
            </button>
            <button className="min-w-[164px] px-3 text-center" onClick={() => setSelectedDate(new Date())}>
              <span className="block text-[10px] font-bold uppercase text-white/65">{format(selectedDate, "yyyy")}</span>
              <span className="block text-sm font-bold">{format(selectedDate, "EEEE، d MMMM", { locale })}</span>
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-lg transition-colors hover:bg-white/15" onClick={() => setSelectedDate(addDays(selectedDate, 1))} aria-label={tr("التالي", "Next")}>
              <NextIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══════ 2. Attendance strip (طلب المستخدم: فوق) ═══════ */}
      <section className="rounded-2xl border border-cyan-200/60 bg-gradient-to-br from-white to-cyan-50/60 p-4 shadow-[0_6px_20px_-8px_rgba(14,118,172,0.15),0_1px_3px_rgba(14,42,74,0.05)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-100 text-[#0e76ac]">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black">{tr("الفريق اليوم", "Team today")}</h2>
              <p className="text-[11px] text-slate-500">{format(selectedDate, "EEEE، d MMMM", { locale })}</p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: tr("حاضر", "Present"),  value: attendance?.present ?? 0, color: "#10b981", bg: "#ecfdf5" },
              { label: tr("متأخر", "Late"),    value: attendance?.late ?? 0,    color: "#0E76AC", bg: "#e0f2fe" },
              { label: tr("غائب", "Absent"),   value: attendance?.absent ?? 0,  color: "#dc2626", bg: "#fef2f2" },
              { label: tr("إجازة", "On leave"),value: leave?.count ?? 0,        color: "#47759c", bg: "#f1f5f9" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border p-3 text-center" style={{ background: s.bg, borderColor: s.color + "30" }}>
                <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>

          <button onClick={() => navigate("/attendance")} className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-200 bg-white px-4 py-2.5 text-xs font-black text-[#0e76ac] hover:bg-cyan-50 sm:whitespace-nowrap">
            {tr("إدارة الحضور", "Manage attendance")} <ArrowIcon className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ═══════ 3. KPI row (Today at a glance) ═══════ */}
      <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {[
          { label: tr("وجبات اليوم", "Today's meals"), value: metrics.totalToday,
            note: `${metrics.morning} ${tr("صباحي", "morning")} · ${metrics.evening} ${tr("مسائي", "evening")}${metrics.customized ? ` · ${metrics.customized} ${tr("مخصّص", "customized")}` : ""}`,
            icon: CalendarDays, color: "#3cc4f0", action: () => setDetailView("meals") },
          { label: tr("تقدم المطبخ", "Kitchen progress"), value: `${metrics.prepRate}%`,
            note: `${metrics.prepared}/${metrics.todayPlans.length} ${tr("جاهزة", "ready")}`,
            icon: ChefHat, color: "#10b981", action: () => navigate("/kitchen") },
          { label: tr("تم التوصيل", "Delivered"), value: `${metrics.deliveryRate}%`,
            note: `${metrics.delivered}/${metrics.todayPlans.length} ${tr("طلب", "orders")}`,
            icon: Route, color: "#47759c", action: () => navigate("/delivery") },
          { label: tr("مشتركون نشطون", "Active subscribers"), value: metrics.active.length,
            note: `${metrics.paused} ${tr("مجمّد", "paused")} · ${metrics.expiring.length} ${tr("للتجديد", "renewal")}`,
            icon: Users, color: "#0E2A4A", action: () => setDetailView("active") },
        ].map((item, i) => (
          <button key={item.label} onClick={item.action} className="group relative min-h-[126px] overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 text-start shadow-[0_4px_16px_-8px_rgba(14,42,74,0.12)] transition-all duration-200 hover:border-cyan-300 hover:shadow-[0_10px_24px_-12px_rgba(14,118,172,0.24)] sm:min-h-[148px] sm:rounded-2xl sm:p-4">
            <div className="absolute inset-x-0 top-0 h-0.5 sm:h-1" style={{ background: item.color }} />
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold leading-4 text-[#47759c] sm:text-xs">{item.label}</p>
                <p className="mt-1 text-2xl font-black leading-none tabular-nums text-[#17324d] sm:mt-2 sm:text-3xl">{loading ? "—" : item.value}</p>
                <p className="mt-1.5 text-[9px] leading-4 text-[#6d8295] sm:mt-1 sm:text-[11px]">{item.note}</p>
              </div>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-11 sm:w-11 sm:rounded-xl" style={{ background: item.color + "1A", color: item.color }}>
                <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
            {i === 0 && metrics.todayPlans.length > 0 && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100 sm:mt-3 sm:h-1.5">
                <div className="h-full rounded-full transition-all" style={{ width: `${metrics.deliveryRate}%`, background: "linear-gradient(90deg,#3cc4f0,#10b981)" }} />
              </div>
            )}
          </button>
        ))}
      </section>

      {/* ═══════ 3-ب. الحجم التشغيلي — المالية · المخزون والمشتريات · صحة النظام ═══════
           أقسام شغّالة في التطبيق وكانت غائبة تماماً عن اللوحة. كل رقم من مصدره
           الحقيقي، ولا يُعرض قسم بلا بيانات فعلية (العُهد والتقييمات فارغتان بعد). */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1.5 rounded-full bg-[#0E76AC]" />
          <h2 className="text-base font-black text-[#0E2A4A]">{tr("الحجم التشغيلي", "Operational scale")}</h2>
          <span className="text-[11px] font-bold text-slate-400">
            {tr(`من ${monthStart} حتى اليوم`, `${monthStart} to today`)}
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {/* ── المالية ── */}
          <div className="rounded-2xl border-2 border-[#0E2A4A]/10 bg-white p-4 shadow-[0_10px_28px_-22px_rgba(14,42,74,.55)]">
            <button onClick={() => navigate("/finance")} className="mb-3 flex w-full items-center gap-2 text-start">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0E2A4A] text-white"><Wallet className="h-4 w-4" /></span>
              <span className="flex-1">
                <span className="block text-sm font-black text-[#0E2A4A]">{tr("المالية — هذا الشهر", "Finance — this month")}</span>
                <span className="block text-[11px] font-bold text-slate-400">{tr("من القيود المُرحَّلة", "From posted entries")}</span>
              </span>
              <ArrowIcon className="h-4 w-4 text-slate-300" />
            </button>
            {fin ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                    <p className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700"><ArrowUpRight className="h-3 w-3" />{tr("إيراد", "Revenue")}</p>
                    <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-800">{Math.round(fin.revenue).toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5">
                    <p className="flex items-center gap-1 text-[10px] font-black uppercase text-rose-700"><ArrowDownRight className="h-3 w-3" />{tr("مصروف", "Expense")}</p>
                    <p className="mt-0.5 text-lg font-black tabular-nums text-rose-800">{Math.round(fin.expense).toLocaleString()}</p>
                  </div>
                </div>
                <div className={cnRow(fin.netProfit >= 0)}>
                  <span className="text-xs font-black">{tr("صافي الربح", "Net profit")}</span>
                  <span className="text-xl font-black tabular-nums">
                    {Math.round(fin.netProfit).toLocaleString()} <span className="text-[10px] font-bold opacity-70">{tr("ر.ق", "QAR")}</span>
                  </span>
                </div>
                {purchases.total > 0 && fin.expense === 0 && (
                  <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] font-black leading-relaxed text-amber-900">
                    {tr(
                      `⚠️ المصروف صفر لأن فواتير الشراء (${Math.round(purchases.total).toLocaleString()} ر.ق) لم تُرحَّل محاسبياً بعد — الإيراد أعلاه من المبيعات فقط.`,
                      `⚠️ Expense reads zero because purchase invoices (${Math.round(purchases.total).toLocaleString()} QAR) are not posted to the ledger yet — revenue above is sales only.`,
                    )}
                  </p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold">
                  <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                    {tr("نقدية وبنك", "Cash & bank")}
                    <b className="block text-sm tabular-nums text-[#0E2A4A]">{Math.round(fin.cashOnHand).toLocaleString()}</b>
                  </p>
                  <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                    {tr("مستحق للموردين", "Owed to suppliers")}
                    <b className="block text-sm tabular-nums text-[#0E2A4A]">{Math.round(fin.payable).toLocaleString()}</b>
                  </p>
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-xs font-bold text-slate-400">{tr("جارٍ التحميل…", "Loading…")}</p>
            )}
          </div>

          {/* ── المخزون والمشتريات ── */}
          <div className="rounded-2xl border-2 border-[#0E2A4A]/10 bg-white p-4 shadow-[0_10px_28px_-22px_rgba(14,42,74,.55)]">
            <button onClick={() => navigate("/inventory")} className="mb-3 flex w-full items-center gap-2 text-start">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0E76AC] text-white"><Boxes className="h-4 w-4" /></span>
              <span className="flex-1">
                <span className="block text-sm font-black text-[#0E2A4A]">{tr("المخزون والمشتريات", "Stock & purchasing")}</span>
                <span className="block text-[11px] font-bold text-slate-400">
                  {purchases.lastDate
                    ? tr(`آخر فاتورة ${purchases.lastDate}`, `Last invoice ${purchases.lastDate}`)
                    : tr("لا فواتير هذا الشهر", "No invoices this month")}
                </span>
              </span>
              <ArrowIcon className="h-4 w-4 text-slate-300" />
            </button>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: tr("أصناف المخزن", "Items"), value: invSummary ? invSummary.totalItems : "—", tone: "border-slate-200 bg-slate-50 text-[#0E2A4A]" },
                { label: tr("قيمة المخزون", "Stock value"), value: invSummary ? Math.round(invSummary.stockValue).toLocaleString() : "—", tone: "border-slate-200 bg-slate-50 text-[#0E2A4A]" },
                { label: tr("فواتير الشهر", "Invoices"), value: purchases.count, tone: "border-cyan-200 bg-cyan-50 text-[#0E76AC]" },
                { label: tr("قيمة المشتريات", "Purchases"), value: Math.round(purchases.total).toLocaleString(), tone: "border-cyan-200 bg-cyan-50 text-[#0E76AC]" },
              ].map((c) => (
                <div key={c.label} className={`rounded-xl border p-2.5 ${c.tone}`}>
                  <p className="text-lg font-black tabular-nums">{c.value}</p>
                  <p className="text-[11px] font-bold opacity-70">{c.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-600">
                <Truck className="me-1 inline h-3 w-3" />{suppliers ? suppliers.length : 0} {tr("مورّد", "suppliers")}
              </span>
              {Number(invSummary?.lowStockCount) > 0 && (
                <span className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-800">
                  {invSummary.lowStockCount} {tr("تحت الحد الأدنى", "below minimum")}
                </span>
              )}
              {Number(invSummary?.expiringSoonCount) > 0 && (
                <span className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-800">
                  {invSummary.expiringSoonCount} {tr("قرب الانتهاء", "expiring")}
                </span>
              )}
              <button onClick={() => navigate("/invoice-import")} className="ms-auto rounded-lg border border-cyan-200 px-2.5 py-1.5 text-[11px] font-black text-[#0E76AC] hover:bg-cyan-50">
                <FileText className="me-1 inline h-3 w-3" />{tr("استلام فاتورة", "Import invoice")}
              </button>
            </div>
          </div>

          {/* ── صحة النظام ── */}
          <div className="rounded-2xl border-2 border-[#0E2A4A]/10 bg-white p-4 shadow-[0_10px_28px_-22px_rgba(14,42,74,.55)]">
            <button onClick={() => navigate("/client-errors")} className="mb-3 flex w-full items-center gap-2 text-start">
              <span className={`grid h-9 w-9 place-items-center rounded-xl text-white ${errors.last24h ? "bg-rose-600" : "bg-emerald-600"}`}>
                {errors.last24h ? <Bug className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-black text-[#0E2A4A]">{tr("صحة النظام", "System health")}</span>
                <span className="block text-[11px] font-bold text-slate-400">{tr("أخطاء تظهر للطاقم", "Errors staff hit")}</span>
              </span>
              <ArrowIcon className="h-4 w-4 text-slate-300" />
            </button>
            <div className={`rounded-xl border-2 p-3 text-center ${errors.last24h ? "border-rose-300 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
              <p className={`text-3xl font-black tabular-nums ${errors.last24h ? "text-rose-700" : "text-emerald-700"}`}>{errors.last24h}</p>
              <p className={`text-[11px] font-black ${errors.last24h ? "text-rose-700" : "text-emerald-700"}`}>
                {errors.last24h ? tr("انهيار خلال 24 ساعة", "crashes in 24h") : tr("لا انهيارات خلال 24 ساعة", "no crashes in 24h")}
              </p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold">
              <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                {tr("إجمالي مسجَّل", "Logged total")}
                <b className="block text-sm tabular-nums text-[#0E2A4A]">{errors.total}</b>
              </p>
              <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                {tr("طلبات تنتظر مراجعة", "Orders to review")}
                <b className="block text-sm tabular-nums text-[#0E2A4A]">{pendingOrders ?? 0}</b>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 4. Today ops flow + Needs attention ═══════ */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.75fr)]">
        {/* Operation flow */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-black">{tr("سير عمليات اليوم", "Today's operation flow")}</h2>
              <p className="mt-1 text-xs text-slate-500">{tr("من التأكيد حتى التسليم", "From confirmation to handoff")}</p>
            </div>
            <button onClick={() => navigate("/plans")} className="flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-2 text-xs font-bold text-[#0e76ac] hover:bg-cyan-100">
              {tr("عرض الخطط", "View plans")} <ArrowIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              {[
                { label: tr("تم التأكيد", "Confirmed"), value: metrics.todayPlans.filter((p) => p.status !== "DRAFT").length, color: "bg-blue-500" },
                { label: tr("جاهز من المطبخ", "Kitchen ready"), value: metrics.prepared, color: "bg-emerald-500" },
                { label: tr("تم التسليم", "Delivered"), value: metrics.delivered, color: "bg-cyan-500" },
              ].map((row) => {
                const pct = metrics.todayPlans.length ? Math.round((row.value / metrics.todayPlans.length) * 100) : 0;
                return (
                  <div key={row.label}>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
                      <span>{row.label}</span>
                      <span className="tabular-nums text-slate-500">{row.value}/{metrics.todayPlans.length} · {pct}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#e9f4f8]">
                      <div className={`h-full rounded-full ${row.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}

              {/* ⚠️ المخصّصون يُطبخون من قالبهم لا من dailyPlans، فلا حالة لهم
                   (لا PREPARED ولا DELIVERED). كانوا يغيبون عن هذا السطر تماماً
                   فيبدو حجم يوم المطبخ أقل مما هو. نعرضهم صراحةً بدل إخفائهم،
                   وخارج النِسَب أعلاه حتى لا تُظهر تأخيراً كاذباً. */}
              {metrics.customized > 0 && (
                <div className="rounded-xl border-2 border-[#0E2A4A]/15 bg-[#0E2A4A]/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-black text-[#0E2A4A]">
                      <Sparkles className="h-3.5 w-3.5" />
                      {tr("وجبات مخصّصة اليوم", "Customized meals today")}
                    </span>
                    <span className="text-lg font-black tabular-nums text-[#0E2A4A]">{metrics.customized}</span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">
                    {tr(
                      `تُطبخ من قوالبها لا من الخطط اليومية، فلا تحمل حالة تتبّع — لذلك هي خارج النِسَب أعلاه. إجمالي يوم المطبخ ${metrics.totalToday}.`,
                      `Cooked from their templates, not daily plans, so they carry no tracking status and sit outside the bars above. Kitchen total today ${metrics.totalToday}.`,
                    )}
                  </p>
                  <button onClick={() => navigate("/customized")} className="mt-2 text-[11px] font-black text-[#0E76AC] hover:underline">
                    {tr("عرض الوجبات المخصّصة", "View customized meals")} ←
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 border-slate-100 lg:border-s lg:ps-5">
              <button onClick={() => navigate("/kitchen")} className="rounded-xl bg-[linear-gradient(145deg,#47759c,#315f83)] p-3 text-start text-white shadow-[0_10px_24px_-16px_rgba(49,95,131,.8)] hover:brightness-110">
                <ChefHat className="mb-3 h-5 w-5 text-cyan-200" />
                <span className="block text-sm font-black">{tr("المطبخ", "Kitchen")}</span>
                <span className="mt-0.5 block text-[10px] text-blue-100/80">{tr("قائمة التحضير", "Prep queue")}</span>
              </button>
              <button onClick={() => navigate("/delivery")} className="rounded-xl bg-[linear-gradient(145deg,#3cc4f0,#24a9d6)] p-3 text-start text-[#17324d] shadow-[0_10px_24px_-16px_rgba(60,196,240,.9)] hover:brightness-105">
                <Route className="mb-3 h-5 w-5" />
                <span className="block text-sm font-black">{tr("التوصيل", "Delivery")}</span>
                <span className="mt-0.5 block text-[10px] text-cyan-950/70">{tr("المسارات والسائقون", "Routes & drivers")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Needs attention */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#0E76AC]" />
              <h2 className="text-base font-black">{tr("يحتاج انتباهك", "Needs attention")}</h2>
              {alerts.length > 0 && <span className="ms-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">{alerts.length}</span>}
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-5 w-5" /></div>
                <p className="mt-3 text-sm font-black">{tr("كل شيء تحت السيطرة", "Everything under control")}</p>
                <p className="mt-1 text-xs text-slate-500">{tr("لا تنبيهات عاجلة الآن", "No urgent alerts now")}</p>
              </div>
            ) : alerts.map((a) => {
              const tones: Record<string, string> = { amber: "bg-red-50 text-red-700", rose: "bg-red-50 text-red-700", blue: "bg-cyan-50 text-[#0E76AC]" };
              return (
                <button key={a.title} onClick={a.action} className="flex w-full items-center gap-3 p-4 text-start hover:bg-slate-50 transition-colors">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tones[a.tone]}`}><a.icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black"><span className="me-1 tabular-nums">{a.count}</span>{a.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{a.detail}</p>
                  </div>
                  <ArrowIcon className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════ 5. POS + Gym + Loyalty rollups ═══════ */}
      <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {/* POS today */}
        <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_4px_16px_-8px_rgba(14,42,74,0.12)] transition-all duration-200 hover:border-cyan-200 sm:rounded-2xl sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 sm:h-11 sm:w-11 sm:rounded-xl"><Receipt className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold leading-4 text-[#47759c] sm:text-xs">{tr("مبيعات POS اليوم", "POS sales today")}</p>
              <p className="text-xl font-black leading-tight tabular-nums text-[#17324d] sm:text-2xl">{posToday.revenue.toFixed(2)} <span className="text-[9px] text-slate-400 sm:text-xs">QAR</span></p>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-4 text-slate-500 sm:text-[11px]">{posToday.tickets} {tr("فاتورة · متوسط", "tix · avg")} {Number(posToday.avg).toFixed(2)}</p>
          <button onClick={() => navigate("/pos-admin")} className="mt-2 flex min-h-9 w-full items-center justify-between gap-1 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2 py-1.5 text-[9px] font-black leading-4 text-emerald-700 hover:bg-emerald-50 sm:mt-3 sm:px-3 sm:py-2 sm:text-[11px]">
            {tr("لوحة POS", "POS admin")} <ArrowIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Gym sales today */}
        <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_4px_16px_-8px_rgba(14,42,74,0.12)] transition-all duration-200 hover:border-cyan-200 sm:rounded-2xl sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-100 text-[#0E76AC] sm:h-11 sm:w-11 sm:rounded-xl"><Dumbbell className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold leading-4 text-[#47759c] sm:text-xs">{tr("مبيعات المنافذ اليوم", "Outlet sales today")}</p>
              <p className="text-xl font-black leading-tight tabular-nums text-[#17324d] sm:text-2xl">{gymToday.revenue.toFixed(2)} <span className="text-[9px] text-slate-400 sm:text-xs">QAR</span></p>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-4 text-slate-500 sm:text-[11px]">{gymToday.orders} {tr("طلبية", "orders")} · {gymToday.meals} {tr("وجبة", "meals")}</p>
          <button onClick={() => navigate("/gym-sales")} className="mt-2 flex min-h-9 w-full items-center justify-between gap-1 rounded-lg border border-cyan-200 bg-cyan-50/50 px-2 py-1.5 text-[9px] font-black leading-4 text-[#0E76AC] hover:bg-cyan-50 sm:mt-3 sm:px-3 sm:py-2 sm:text-[11px]">
            {tr("لوحة المنافذ", "Outlet sales")} <ArrowIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Active cashiers */}
        <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_4px_16px_-8px_rgba(14,42,74,0.12)] transition-all duration-200 hover:border-cyan-200 sm:rounded-2xl sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-100 text-cyan-700 sm:h-11 sm:w-11 sm:rounded-xl"><Store className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold leading-4 text-[#47759c] sm:text-xs">{tr("كاشيرون نشطون الآن", "Active cashiers now")}</p>
              <p className="text-xl font-black leading-tight tabular-nums text-[#17324d] sm:text-2xl">{activeCashiers}</p>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-4 text-slate-500 sm:text-[11px]">
            {(posToday.staff ?? 0) > 0
              ? `${posToday.staff} ${tr("وجبة موظفين", "staff meals")} · ${Number(posToday.staffValue).toFixed(2)}`
              : tr("لا وجبات موظفين اليوم", "No staff meals today")}
          </p>
          <button onClick={() => navigate("/manager")} className="mt-2 flex min-h-9 w-full items-center justify-between gap-1 rounded-lg border border-cyan-200 bg-cyan-50/50 px-2 py-1.5 text-[9px] font-black leading-4 text-cyan-700 hover:bg-cyan-50 sm:mt-3 sm:px-3 sm:py-2 sm:text-[11px]">
            {tr("لوحة المدير اللحظية", "Manager Live")} <ArrowIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Big tickets / audit */}
        <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_4px_16px_-8px_rgba(14,42,74,0.12)] transition-all duration-200 hover:border-cyan-200 sm:rounded-2xl sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-100 text-red-700 sm:h-11 sm:w-11 sm:rounded-xl"><Coins className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold leading-4 text-[#47759c] sm:text-xs">{tr("أحداث حساسة اليوم", "Sensitive events today")}</p>
              <p className="text-xl font-black leading-tight tabular-nums text-[#17324d] sm:text-2xl">
                {(managerSnap?.alerts?.voidsToday ?? 0) + (managerSnap?.alerts?.refundsToday ?? 0)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-4 text-slate-500 sm:text-[11px]">
            {managerSnap?.alerts?.voidsToday ?? 0} {tr("إلغاء", "voids")} · {managerSnap?.alerts?.refundsToday ?? 0} {tr("استرجاع", "refunds")}
          </p>
          <button onClick={() => navigate("/pos-admin")} className="mt-2 flex min-h-9 w-full items-center justify-between gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2 py-1.5 text-[9px] font-black leading-4 text-red-700 hover:bg-red-50 sm:mt-3 sm:px-3 sm:py-2 sm:text-[11px]">
            {tr("سجل التدقيق", "Audit trail")} <ArrowIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* ═══════ 6. Weekly chart + Delivery windows + Subs health ═══════ */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)_minmax(0,.7fr)]">
        {/* Weekly chart */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-base font-black">{tr("حجم الوجبات", "Meal volume")}</h2>
              <p className="mt-1 text-xs text-slate-500">{tr("آخر 7 أيام", "Last 7 days")}</p>
            </div>
            <Sparkles className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#dcebf2" strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#47759c", fontSize: 11 }} />
                <Tooltip cursor={{ fill: "#ecfeff" }} contentStyle={{ borderRadius: 12, borderColor: "#bae6fd", fontSize: 12 }} />
                <Bar dataKey="meals" fill="#3cc4f0" radius={[8, 8, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delivery windows */}
        <div className="rounded-2xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50/40 to-white p-5 shadow-[0_4px_18px_-6px_rgba(14,118,172,0.10),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white">
          <div className="mb-4 flex items-center gap-2">
            <Route className="h-4 w-4 text-[#0E76AC]" />
            <h2 className="text-base font-black">{tr("توزيع اليوم", "Today distribution")}</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: tr("الصباحية", "Morning"), value: metrics.morning, icon: Sun, color: "#0E76AC", bg: "#e0f2fe" },
              { label: tr("المسائية", "Evening"), value: metrics.evening, icon: Sunset, color: "#0E2A4A", bg: "#e2e8f0" },
            ].map((w) => {
              const pct = metrics.todayPlans.length ? Math.round((w.value / metrics.todayPlans.length) * 100) : 0;
              return (
                <div key={w.label} className="rounded-xl border p-3" style={{ background: w.bg, borderColor: w.color + "30" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <w.icon className="h-4 w-4" style={{ color: w.color }} />
                      <span className="text-xs font-black" style={{ color: w.color }}>{w.label}</span>
                    </div>
                    <span className="text-lg font-black tabular-nums" style={{ color: w.color }}>{w.value}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/60 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: w.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subscribers health */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-[#0e76ac]" />
            <h2 className="text-base font-black">{tr("صحة الاشتراكات", "Subscribers health")}</h2>
          </div>
          <div className="space-y-2.5">
            <button onClick={() => setDetailView("active")} className="w-full flex items-center justify-between rounded-xl border border-cyan-200/50 bg-cyan-50/40 p-3 hover:bg-cyan-50">
              <span className="text-xs font-bold text-cyan-800">{tr("نشطون", "Active")}</span>
              <span className="text-xl font-black text-[#0e76ac] tabular-nums">{metrics.active.length}</span>
            </button>
            <button onClick={() => setDetailView("expiring")} className="w-full flex items-center justify-between rounded-xl border border-red-200/50 bg-red-50/40 p-3 hover:bg-red-50">
              <span className="text-xs font-bold text-red-700">{tr("ينتهون قريباً", "Ending soon")}</span>
              <span className="text-xl font-black text-red-600 tabular-nums">{metrics.expiring.length}</span>
            </button>
            <div className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <span className="text-xs font-bold text-slate-600">{tr("مجمّدون", "Paused")}</span>
              <span className="text-xl font-black text-slate-600 tabular-nums">{metrics.paused}</span>
            </div>
            <button onClick={() => setDetailView("expired")} className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 hover:bg-slate-100">
              <span className="text-xs font-bold text-slate-600">{tr("منتهون", "Expired")}</span>
              <span className="text-xl font-black text-slate-500 tabular-nums">{metrics.expired.length}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ═══════ 7. Recent activity + Kitchen readiness ═══════ */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)]">
        {/* Recent POS tickets */}
        <div className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white">
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-500" />
              <h2 className="text-base font-black">{tr("آخر فواتير POS", "Recent POS tickets")}</h2>
            </div>
            <button onClick={() => navigate("/manager")} className="text-[11px] font-black text-[#0e76ac] hover:underline">
              {tr("عرض الكل", "See all")} →
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
            {(!managerSnap?.recent || managerSnap.recent.length === 0) ? (
              <p className="p-8 text-center text-sm text-slate-400 font-bold">{tr("لا فواتير حديثة", "No recent tickets")}</p>
            ) : managerSnap.recent.slice(0, 8).map((r: any) => (
              <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-black text-white ${r.isBig ? "bg-red-500" : "bg-[#0E76AC]"}`}>
                  #{String(r.ticketNumber).slice(-2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black truncate">
                    #{r.ticketNumber}
                    {r.isNonRevenue && <span className="ms-2 text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase">Staff</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 font-bold truncate">
                    {r.cashierName} · {r.paymentMethod}{r.customerName ? ` · ${r.customerName}` : ""}
                  </p>
                </div>
                <p className="text-sm font-black text-[#0e76ac] tabular-nums">{Number(r.total).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Kitchen readiness / inventory */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white">
          <div className="mb-4 flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-black">{tr("جاهزية المطبخ", "Kitchen readiness")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center">
              <p className="text-3xl font-black text-emerald-600 tabular-nums">{inventoryItems.length}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-600">{tr("صنف مخزون", "inventory items")}</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50/40 p-3 text-center">
              <p className="text-3xl font-black text-red-600 tabular-nums">{metrics.lowStock.length}</p>
              <p className="mt-1 text-[11px] font-bold text-red-700">{tr("تحت الحد الأدنى", "below min stock")}</p>
            </div>
          </div>
          <button onClick={() => navigate("/inventory")} className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-700 hover:border-cyan-300 hover:bg-cyan-50">
            {tr("افتح إدارة المخزون", "Open inventory")} <ArrowIcon className="h-4 w-4" />
          </button>
          {metrics.lowStock.length > 0 && (
            <div className="mt-3 space-y-1">
              {metrics.lowStock.slice(0, 3).map((i: any) => (
                <div key={i._id} className="flex items-center justify-between text-[11px] font-bold">
                  <span className="truncate text-slate-700">{isRtl ? i.nameAr : (i.nameEn || i.nameAr)}</span>
                  <span className="text-red-700 tabular-nums shrink-0 ms-2">{i.currentStock}/{i.minStock} {i.unit}</span>
                </div>
              ))}
              {metrics.lowStock.length > 3 && (
                <button onClick={() => setDetailView("inventory")} className="text-[10px] font-black text-red-700 hover:underline mt-1">
                  +{metrics.lowStock.length - 3} {tr("أخرى", "more")}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ═══════ Detail dialog ═══════ */}
      <Dialog open={detailView !== null} onOpenChange={(open) => !open && setDetailView(null)}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-h-[82vh] max-w-2xl overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {detailView === "meals" ? tr("وجبات اليوم", "Today's meals")
               : detailView === "inventory" ? tr("تنبيهات المخزون", "Inventory alerts")
               : detailView === "active" ? tr("المشتركون النشطون", "Active subscribers")
               : detailView === "expiring" ? tr("اشتراكات تنتهي قريباً", "Subscriptions ending soon")
               : tr("اشتراكات منتهية", "Expired subscriptions")}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
            {detailView === "meals" && metrics.todayPlans.map((plan: any) => {
              const customer = customers.find((c: any) => c._id === plan.customerId);
              return (
                <div key={plan._id} className="flex items-center gap-3 p-4">
                  <div className={`grid h-9 w-9 place-items-center rounded-md ${plan.deliveryTime === "MORNING" ? "bg-cyan-50 text-[#0E76AC]" : "bg-slate-100 text-[#0E2A4A]"}`}>
                    {plan.deliveryTime === "MORNING" ? <Sun className="h-4 w-4" /> : <Sunset className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{customer?.fullName || plan.customerName || tr("عميل", "Customer")}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{plan.deliveryTime === "MORNING" ? tr("توصيل صباحي", "Morning") : tr("توصيل مسائي", "Evening")}</p>
                  </div>
                  <span className={`rounded px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[plan.status] || STATUS_STYLES.DRAFT}`}>{statusLabel(plan.status)}</span>
                </div>
              );
            })}
            {detailView === "inventory" && metrics.lowStock.map((i: any) => (
              <div key={i._id} className="flex items-center gap-3 p-4">
                <Package className="h-5 w-5 text-red-500" />
                <div className="flex-1">
                  <p className="text-sm font-black">{isRtl ? i.nameAr : i.nameEn || i.nameAr}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{tr("الحد الأدنى", "Minimum")}: {i.minStock} {i.unit}</p>
                </div>
                <span className="text-sm font-black tabular-nums text-red-600">{i.currentStock} {i.unit}</span>
              </div>
            ))}
            {detailView !== "meals" && detailView !== "inventory" && detailCustomers.map((c: any) => (
              <div key={c._id} className="flex items-center gap-3 p-4">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-sm font-black text-slate-600">{(c.fullName || "?").slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{c.fullName || tr("بدون اسم", "No name")}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500" dir="ltr">{c.phone || "—"}</p>
                </div>
                <span className="text-xs font-bold text-slate-500">{c.endDate || "—"}</span>
              </div>
            ))}
            {((detailView === "meals" && !metrics.todayPlans.length)
              || (detailView === "inventory" && !metrics.lowStock.length)
              || (!["meals", "inventory"].includes(detailView || "") && !detailCustomers.length)) && (
              <div className="p-10 text-center text-sm text-slate-500">{tr("لا توجد بيانات للعرض", "No data to display")}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
