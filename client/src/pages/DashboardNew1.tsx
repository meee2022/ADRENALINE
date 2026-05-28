// client/src/pages/DashboardNew1.tsx
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useCustomers, useDailyPlans, useInventorySummary } from "@/lib/api";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { format, parseISO, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import { useLanguage } from "@/lib/i18n";
import {
  Users, CalendarCheck, Sun, Moon, TrendingUp,
  Package, AlertCircle, ArrowUpRight, ChevronLeft,
  Clock, Utensils, AlertTriangle,
} from "lucide-react";

type ModalType = "customers"|"meals"|"morning"|"evening"|"expiring"|"expired"|"inventory"|"monthly"|null;

export default function DashboardNew() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const { data: customers = [] } = useCustomers();
  const { data: dailyPlans = [] } = useDailyPlans();
  const inventorySummary = useInventorySummary();
  const inventoryItems = useQuery(api.inventory.list, {}) || [];

  const stats = useMemo(() => {
    const today = format(selectedDate, "yyyy-MM-dd");
    const todayPlans   = dailyPlans.filter(p => p.date === today);
    const morningPlans = todayPlans.filter(p => p.deliveryTime === "MORNING");
    const eveningPlans = todayPlans.filter(p => p.deliveryTime === "EVENING");
    const now = new Date();

    const activeCustomers   = customers.filter(c => differenceInDays(parseISO(c.endDate), now) >= 0);
    const expiredCustomers  = customers.filter(c => differenceInDays(parseISO(c.endDate), now) < 0);
    const expiringCustomers = customers.filter(c => { const d = differenceInDays(parseISO(c.endDate), now); return d >= 0 && d <= 3; });
    const expiringToday     = customers.filter(c => format(parseISO(c.endDate), "yyyy-MM-dd") === format(now, "yyyy-MM-dd"));
    const lowStockItems     = inventoryItems.filter((i:any) => i.current_stock <= i.min_stock);
    const cm = now.getMonth(), cy = now.getFullYear();
    const newThisMonth = customers.filter(c => { const s = parseISO(c.startDate); return s.getMonth()===cm && s.getFullYear()===cy; });

    const morningRate = todayPlans.length > 0 ? Math.round((morningPlans.length / todayPlans.length) * 100) : 0;

    return {
      activeCustomers, activeCustomersCount: activeCustomers.length,
      todayPlans, todayMeals: todayPlans.length,
      morningPlans, morningDelivery: morningPlans.length,
      eveningPlans, eveningDelivery: eveningPlans.length,
      expiredCustomers, expiredCustomersCount: expiredCustomers.length,
      expiringCustomers, expiringCustomersCount: expiringCustomers.length,
      expiringTodayCount: expiringToday.length,
      lowStockItems, lowStockCount: lowStockItems.length,
      newThisMonth: newThisMonth.length, newThisMonthList: newThisMonth,
      totalCustomers: customers.length,
      morningRate,
    };
  }, [customers, dailyPlans, selectedDate, inventorySummary, inventoryItems]);

  const weeklyData = useMemo(() => {
    const days = ["سبت","أحد","اثن","ثلا","أرب","خمس","جمع"];
    return days.map((day, idx) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - idx));
      return { name: day, value: dailyPlans.filter(p => p.date === format(d,"yyyy-MM-dd")).length };
    });
  }, [dailyPlans]);

  // برامج المشتركين
  const programData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of customers as any[]) {
      const p = (c.program || "أخرى").toUpperCase();
      counts[p] = (counts[p] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [customers]);

  const PROG_COLORS: Record<string,string> = {
    FITNESS:    "#3cc4f0",  // سيان - اللون الرئيسي
    DIET:       "#47759c",  // أزرق فولاذي
    BULK:       "#0f1516",  // داكن
    CUSTOMIZED: "#5a8aad",  // أزرق فاتح
    STANDARD:   "#bcbebf",  // رصاصي
  };

  /* ─── Sub-components ─── */
  const CustomerRow = ({ customer, badge }: { customer:any; badge:React.ReactNode }) => (
    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors">
      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center text-cyan-700 font-bold text-sm flex-shrink-0">
        {(customer.fullName||"?").substring(0,1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{customer.fullName||"بدون اسم"}</p>
        <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{customer.phone||"-"}</p>
      </div>
      <p className="text-xs text-gray-400 shrink-0">{customer.program||"-"}</p>
      <div className="shrink-0">{badge}</div>
    </div>
  );

  const PlanRow = ({ plan }:{ plan:any }) => {
    const cust = customers.find((c:any) => c._id === plan.customerId);
    return (
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{cust?.fullName||plan.customerName||"عميل"}</p>
          <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{cust?.phone||"-"}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${plan.deliveryTime==="MORNING" ? "bg-sky-100 text-sky-700" : "bg-indigo-100 text-indigo-700"}`}>
          {plan.deliveryTime==="MORNING" ? "☀ صباحي" : "🌙 مسائي"}
        </span>
      </div>
    );
  };

  return (
    <div dir="rtl" className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">لوحة التحكم</h1>
          <p className="text-sm mt-0.5 font-medium text-cyan-500">
            {format(selectedDate, "EEEE، d MMMM yyyy", { locale: ar })}
          </p>
        </div>
        {/* Date switcher */}
        <div className="flex gap-1.5 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          {[{label:"أمس",offset:-1},{label:"اليوم",offset:0},{label:"غداً",offset:1}].map(({label,offset})=>{
            const d = new Date(); d.setDate(d.getDate()+offset);
            const active = format(selectedDate,"yyyy-MM-dd")===format(d,"yyyy-MM-dd");
            return (
              <button key={label} onClick={()=>setSelectedDate(d)}
                className="h-8 px-4 rounded-lg text-xs font-semibold transition-all"
                style={active ? {background:"#3cc4f0",color:"#fff",boxShadow:"0 2px 8px #3cc4f055"} : {color:"#64748b"}}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Row 1: 4 KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* المشتركين النشطين */}
        <button onClick={()=>setOpenModal("customers")}
          className="group relative rounded-3xl p-6 text-right overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl active:scale-[0.98] bg-white border border-gray-100/80"
          style={{ boxShadow: "0 10px 30px -5px rgba(60,196,240,0.12)" }}>
          <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full opacity-5 bg-[#3cc4f0] blur-2xl group-hover:opacity-10 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                style={{ background: "rgba(60,196,240,0.1)", border: "1.5px solid rgba(60,196,240,0.2)" }}>
                <Users className="h-6 w-6 text-[#3cc4f0]" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-0.5">
                <span>+{stats.newThisMonth}</span>
                <span>هذا الشهر</span>
              </span>
            </div>
            <p className="text-4.5xl font-black text-[#0f1516] tabular-nums leading-none tracking-tight">{stats.activeCustomersCount}</p>
            <p className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">{t("customer.active") || "مشترك نشط"}</p>
            <div className="mt-4 pt-3.5 border-t border-gray-50 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">إجمالي المشتركين</span>
              <strong className="text-xs text-[#47759c] font-black">{stats.totalCustomers}</strong>
            </div>
          </div>
        </button>

        {/* خطط اليوم */}
        <button onClick={()=>setOpenModal("meals")}
          className="group relative rounded-3xl p-6 text-right overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl active:scale-[0.98] bg-white border border-gray-100/80"
          style={{ boxShadow: "0 10px 30px -5px rgba(71,117,156,0.12)" }}>
          <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full opacity-5 bg-[#47759c] blur-2xl group-hover:opacity-10 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                style={{ background: "rgba(71,117,156,0.1)", border: "1.5px solid rgba(71,117,156,0.2)" }}>
                <CalendarCheck className="h-6 w-6 text-[#47759c]" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-[#47759c] transition-colors" />
            </div>
            <p className="text-4.5xl font-black text-[#0f1516] tabular-nums leading-none tracking-tight">{stats.todayMeals}</p>
            <p className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">خطة اليوم</p>
            <div className="mt-4 pt-3.5 border-t border-gray-50 flex justify-between gap-1 text-[10px]">
              <span className="bg-sky-50 text-sky-700 px-2 py-0.5 rounded-lg font-bold border border-sky-100/50">☀ {stats.morningDelivery} صباحي</span>
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-bold border border-indigo-100/50">🌙 {stats.eveningDelivery} مسائي</span>
            </div>
          </div>
        </button>

        {/* توصيل صباحي */}
        <button onClick={()=>setOpenModal("morning")}
          className="group relative rounded-3xl p-6 text-right overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl active:scale-[0.98] bg-white border border-gray-100/80"
          style={{ boxShadow: "0 10px 30px -5px rgba(60,196,240,0.12)" }}>
          <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full opacity-5 bg-[#3cc4f0] blur-2xl group-hover:opacity-10 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                style={{ background: "rgba(60,196,240,0.1)", border: "1.5px solid rgba(60,196,240,0.2)" }}>
                <Sun className="h-6 w-6 text-[#3cc4f0]" />
              </div>
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                {stats.morningRate}%
              </span>
            </div>
            <p className="text-4.5xl font-black text-[#0f1516] tabular-nums leading-none tracking-tight">{stats.morningDelivery}</p>
            <p className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">توصيل صباحي</p>
            <div className="mt-4 pt-3.5 border-t border-gray-50">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{width:`${stats.morningRate}%`, background:"linear-gradient(90deg, #3cc4f0, #47759c)"}} />
              </div>
            </div>
          </div>
        </button>

        {/* توصيل مسائي */}
        <button onClick={()=>setOpenModal("evening")}
          className="group relative rounded-3xl p-6 text-right overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl active:scale-[0.98] bg-white border border-gray-100/80"
          style={{ boxShadow: "0 10px 30px -5px rgba(15,21,22,0.12)" }}>
          <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full opacity-5 bg-[#0f1516] blur-2xl group-hover:opacity-10 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                style={{ background: "rgba(15,21,22,0.08)", border: "1.5px solid rgba(15,21,22,0.15)" }}>
                <Moon className="h-6 w-6 text-[#0f1516]" />
              </div>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                {100-stats.morningRate}%
              </span>
            </div>
            <p className="text-4.5xl font-black text-[#0f1516] tabular-nums leading-none tracking-tight">{stats.eveningDelivery}</p>
            <p className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">توصيل مسائي</p>
            <div className="mt-4 pt-3.5 border-t border-gray-50">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{width:`${100-stats.morningRate}%`, background:"linear-gradient(90deg, #0f1516, #47759c)"}} />
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* ── Row 2: alerts + programs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* حالة الاشتراكات */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col justify-between"
          style={{ boxShadow: "0 10px 30px -5px rgba(0,0,0,0.03)" }}>
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-50">
            <button onClick={()=>setLocation("/customers")}
              className="text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 hover:scale-[1.02] active:scale-[0.98] transition-all">
              عرض الكل <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4.5 w-4.5 text-amber-500" />
              <span className="text-sm font-black text-gray-800 tracking-tight">حالة الاشتراكات</span>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label:"اشتراكات منتهية",   count:stats.expiredCustomersCount,  glowColor: "rgba(239,68,68,0.15)",   textColor: "#ef4444", bg:"bg-red-50/50",   border:"rgba(239,68,68,0.2)",  modal:"expired"  as ModalType, icon:"🔴" },
              { label:"تنتهي اليوم",       count:stats.expiringTodayCount,     glowColor: "rgba(249,115,22,0.15)",  textColor: "#f97316", bg:"bg-orange-50/50",border:"rgba(249,115,22,0.2)", modal:"expiring" as ModalType, icon:"🟠" },
              { label:"تنتهي خلال 3 أيام", count:stats.expiringCustomersCount, glowColor: "rgba(234,179,8,0.15)",   textColor: "#ca8a04", bg:"bg-yellow-50/50",border:"rgba(234,179,8,0.2)",  modal:"expiring" as ModalType, icon:"🟡" },
            ].map(({label,count,glowColor,textColor,bg,border,modal,icon})=>(
              <button key={label} onClick={()=>setOpenModal(modal)}
                className={`group relative rounded-2.5xl p-5 text-right border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] ${bg}`}
                style={{ borderColor: border, boxShadow: `0 8px 24px -5px ${glowColor}` }}>
                <p className="text-4.5xl font-black tabular-nums leading-none tracking-tight" style={{ color: textColor }}>
                  {count}
                </p>
                <p className="text-xs font-bold mt-3 flex items-center gap-1.5" style={{ color: textColor }}>
                  <span>{icon}</span>
                  <span>{label}</span>
                </p>
                <ChevronLeft className="absolute bottom-5 left-5 h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" style={{ color: textColor }} />
              </button>
            ))}
          </div>
        </div>

        {/* توزيع البرامج */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <TrendingUp className="h-4 w-4 text-gray-300" />
            <span className="text-sm font-bold text-gray-800">توزيع البرامج</span>
          </div>
          <div className="p-4 space-y-2.5">
            {programData.map(({name, value}) => {
              const pct = stats.totalCustomers > 0 ? Math.round((value/stats.totalCustomers)*100) : 0;
              const color = PROG_COLORS[name] || "#64748b";
              return (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold tabular-nums" style={{color}}>{value}</span>
                    <span className="text-xs font-semibold text-gray-600">{name}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{width:`${pct}%`, background:color}} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 3: inventory + charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ملخص المخزون */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <button onClick={()=>setLocation("/inventory")}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors">
              إدارة <ArrowUpRight className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-bold text-gray-800">ملخص المخزون</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <button onClick={()=>setOpenModal("inventory")}
              className="w-full rounded-xl p-4 text-center bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 hover:shadow-md transition-all active:scale-[0.98]">
              <p className="text-4xl font-black text-red-500 tabular-nums">{stats.lowStockCount}</p>
              <p className="text-xs font-semibold text-red-400 mt-1">⚠ مخزون منخفض</p>
            </button>
            <div className="rounded-xl p-4 text-center bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100">
              <p className="text-4xl font-black text-emerald-600 tabular-nums">{(inventorySummary as any)?.totalItems||0}</p>
              <p className="text-xs font-semibold text-emerald-500 mt-1">✓ إجمالي الأصناف</p>
            </div>
          </div>
        </div>

        {/* نظرة أسبوعية */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">آخر 7 أيام</span>
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-bold text-gray-800">الخطط الأسبوعية</span>
            </div>
          </div>
          <div className="p-5">
            {weeklyData.every(d => d.value === 0) ? (
              <div className="flex flex-col items-center justify-center h-[180px] gap-3">
                <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center">
                  <CalendarCheck className="h-7 w-7 text-cyan-300" />
                </div>
                <p className="text-sm font-semibold text-gray-300">لا توجد خطط هذا الأسبوع</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyData} barCategoryGap="40%">
                  <XAxis dataKey="name" tick={{fill:"#94a3b8",fontSize:11}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:"#94a3b8",fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                  <Tooltip contentStyle={{borderRadius:"12px",border:"1px solid #e2e8f0",fontSize:12,boxShadow:"0 8px 30px rgba(0,0,0,0.1)"}} cursor={{fill:"#f8fafc",radius:6}} />
                  <Bar dataKey="value" radius={[8,8,0,0]}>
                    {weeklyData.map((_,i) => <Cell key={i} fill={i===6?"#3cc4f0":"#47759c"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {([
        { key:"customers", title:"المشتركين النشطين", count:stats.activeCustomersCount, badge:"#3cc4f0",
          rows: stats.activeCustomers.map((c:any,i:number) => {
            const d = differenceInDays(parseISO(c.endDate), new Date());
            return <CustomerRow key={c._id??i} customer={c} badge={
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={d<=1?{background:"#fee2e2",color:"#dc2626"}:d<=7?{background:"#fef3c7",color:"#d97706"}:{background:"#d1fae5",color:"#059669"}}>
                {d<=0?"منتهي":`${d} يوم`}
              </span>
            } />;
          }),
        },
        { key:"meals", title:`خطط اليوم — ${format(selectedDate,"d MMMM",{locale:ar})}`, count:stats.todayMeals, badge:"#10b981",
          rows: stats.todayPlans.map((p:any,i:number) => <PlanRow key={p._id??i} plan={p} />),
        },
        { key:"morning", title:"توصيل صباحي", count:stats.morningDelivery, badge:"#f59e0b",
          rows: stats.morningPlans.map((p:any,i:number) => <PlanRow key={p._id??i} plan={p} />),
        },
        { key:"evening", title:"توصيل مسائي", count:stats.eveningDelivery, badge:"#8b5cf6",
          rows: stats.eveningPlans.map((p:any,i:number) => <PlanRow key={p._id??i} plan={p} />),
        },
        { key:"expiring", title:"تنتهي قريباً", count:stats.expiringCustomersCount, badge:"#f59e0b",
          rows: stats.expiringCustomers.map((c:any,i:number) => {
            const d = differenceInDays(parseISO(c.endDate), new Date());
            return <CustomerRow key={c._id??i} customer={c} badge={
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={d===0?{background:"#fff7ed",color:"#ea580c"}:d===1?{background:"#fef3c7",color:"#d97706"}:{background:"#dbeafe",color:"#2563eb"}}>
                {d===0?"اليوم":d===1?"غدًا":`${d} أيام`}
              </span>
            } />;
          }),
        },
        { key:"expired", title:"اشتراكات منتهية", count:stats.expiredCustomersCount, badge:"#ef4444",
          rows: stats.expiredCustomers.map((c:any,i:number) => {
            const d = Math.abs(differenceInDays(parseISO(c.endDate), new Date()));
            return <CustomerRow key={c._id??i} customer={c} badge={
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">منذ {d} يوم</span>
            } />;
          }),
        },
        { key:"monthly", title:"العملاء الجدد هذا الشهر", count:stats.newThisMonth, badge:"#3cc4f0",
          rows: stats.newThisMonthList.map((c:any,i:number) => (
            <CustomerRow key={c._id??i} customer={c} badge={
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700">
                {format(parseISO(c.startDate),"d MMM",{locale:ar})}
              </span>
            } />
          )),
        },
      ] as Array<{key:string,title:string,count:number,badge:string,rows:React.ReactNode[]}>).map(({key,title,count,badge,rows})=>(
        <Dialog key={key} open={openModal===key as ModalType} onOpenChange={()=>setOpenModal(null)}>
          <DialogContent className="max-w-2xl" aria-describedby={`${key}-desc`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="text-gray-900">{title}</span>
                <span className="text-sm font-normal px-2.5 py-1 rounded-full" style={{background:`${badge}15`,color:badge}}>{count}</span>
              </DialogTitle>
            </DialogHeader>
            <div id={`${key}-desc`} className="max-h-[60vh] overflow-auto space-y-2 pt-1">
              {rows.length===0 ? <p className="text-center py-10 text-gray-400">لا يوجد بيانات</p> : rows}
            </div>
          </DialogContent>
        </Dialog>
      ))}

      <Dialog open={openModal==="inventory"} onOpenChange={()=>setOpenModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby="inv-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-gray-900">
              مخزون منخفض
              <span className="text-sm font-normal px-2.5 py-1 rounded-full bg-red-100 text-red-600">{stats.lowStockCount}</span>
            </DialogTitle>
          </DialogHeader>
          <div id="inv-desc" className="space-y-2">
            {stats.lowStockItems.map((item:any)=>(
              <div key={item._id} className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
                <div><p className="text-sm font-semibold text-gray-800">{item.name_ar}</p><p className="text-xs text-gray-400">{item.category}</p></div>
                <div className="text-right"><p className="text-lg font-black text-red-500">{item.current_stock} {item.unit}</p><p className="text-xs text-gray-400">الحد الأدنى: {item.min_stock}</p></div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
