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
    return {
      todayPlans, active, expiring, expired, lowStock, prepared, delivered, morning,
      evening: todayPlans.length - morning,
      paused: customers.filter((c: any) => Boolean(c.pausedFrom)).length,
      prepRate: todayPlans.length ? Math.round((prepared / todayPlans.length) * 100) : 0,
      deliveryRate: todayPlans.length ? Math.round((delivered / todayPlans.length) * 100) : 0,
    };
  }, [customers, dailyPlans, inventoryItems, dateKey]);

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
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: tr("وجبات اليوم", "Today's meals"), value: metrics.todayPlans.length,
            note: `${metrics.morning} ${tr("صباحي", "morning")} · ${metrics.evening} ${tr("مسائي", "evening")}`,
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
          <button key={item.label} onClick={item.action} className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 text-start shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white transition-all duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-[0_14px_32px_-12px_rgba(14,118,172,0.25)]">
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: item.color }} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#47759c]">{item.label}</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-[#17324d]">{loading ? "—" : item.value}</p>
                <p className="mt-1 text-[11px] text-[#6d8295]">{item.note}</p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105" style={{ background: item.color + "22", color: item.color }}>
                <item.icon className="h-5 w-5" />
              </div>
            </div>
            {i === 0 && metrics.todayPlans.length > 0 && (
              <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${metrics.deliveryRate}%`, background: "linear-gradient(90deg,#3cc4f0,#10b981)" }} />
              </div>
            )}
          </button>
        ))}
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
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* POS today */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white transition-all duration-200 hover:border-cyan-200 hover:shadow-[0_10px_24px_-8px_rgba(14,118,172,0.18)]">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Receipt className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#47759c]">{tr("مبيعات POS اليوم", "POS sales today")}</p>
              <p className="text-2xl font-black text-[#17324d]">{posToday.revenue.toFixed(2)} <span className="text-xs text-slate-400">QAR</span></p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{posToday.tickets} {tr("فاتورة · متوسط", "tix · avg")} {Number(posToday.avg).toFixed(2)}</p>
          <button onClick={() => navigate("/pos-admin")} className="mt-3 flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-[11px] font-black text-emerald-700 hover:bg-emerald-50">
            {tr("لوحة POS", "POS admin")} <ArrowIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Gym sales today */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white transition-all duration-200 hover:border-cyan-200 hover:shadow-[0_10px_24px_-8px_rgba(14,118,172,0.18)]">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-100 text-[#0E76AC]"><Dumbbell className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#47759c]">{tr("مبيعات الجم اليوم", "Gym sales today")}</p>
              <p className="text-2xl font-black text-[#17324d]">{gymToday.revenue.toFixed(2)} <span className="text-xs text-slate-400">QAR</span></p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{gymToday.orders} {tr("طلبية", "orders")} · {gymToday.meals} {tr("وجبة", "meals")}</p>
          <button onClick={() => navigate("/gym-sales")} className="mt-3 flex w-full items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50/50 px-3 py-2 text-[11px] font-black text-[#0E76AC] hover:bg-cyan-50">
            {tr("لوحة الجم", "Gym POS")} <ArrowIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Active cashiers */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white transition-all duration-200 hover:border-cyan-200 hover:shadow-[0_10px_24px_-8px_rgba(14,118,172,0.18)]">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-100 text-cyan-700"><Store className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#47759c]">{tr("كاشيرون نشطون الآن", "Active cashiers now")}</p>
              <p className="text-2xl font-black text-[#17324d]">{activeCashiers}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {(posToday.staff ?? 0) > 0
              ? `${posToday.staff} ${tr("وجبة موظفين", "staff meals")} · ${Number(posToday.staffValue).toFixed(2)}`
              : tr("لا وجبات موظفين اليوم", "No staff meals today")}
          </p>
          <button onClick={() => navigate("/manager")} className="mt-3 flex w-full items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50/50 px-3 py-2 text-[11px] font-black text-cyan-700 hover:bg-cyan-50">
            {tr("لوحة المدير اللحظية", "Manager Live")} <ArrowIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Big tickets / audit */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_4px_18px_-6px_rgba(14,42,74,0.08),0_1px_3px_rgba(14,42,74,0.04)] ring-1 ring-inset ring-white transition-all duration-200 hover:border-cyan-200 hover:shadow-[0_10px_24px_-8px_rgba(14,118,172,0.18)]">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-red-100 text-red-700"><Coins className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#47759c]">{tr("أحداث حساسة اليوم", "Sensitive events today")}</p>
              <p className="text-2xl font-black text-[#17324d]">
                {(managerSnap?.alerts?.voidsToday ?? 0) + (managerSnap?.alerts?.refundsToday ?? 0)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {managerSnap?.alerts?.voidsToday ?? 0} {tr("إلغاء", "voids")} · {managerSnap?.alerts?.refundsToday ?? 0} {tr("استرجاع", "refunds")}
          </p>
          <button onClick={() => navigate("/pos-admin")} className="mt-3 flex w-full items-center justify-between rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-[11px] font-black text-red-700 hover:bg-red-50">
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
