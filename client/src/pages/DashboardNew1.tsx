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
import { useStore } from "@/lib/store";
import {
  Users, CalendarCheck, Sun, Moon, TrendingUp,
  Package, AlertCircle, ArrowUpRight, ChevronLeft,
  Clock, Utensils, AlertTriangle,
} from "lucide-react";

type ModalType = "customers"|"meals"|"morning"|"evening"|"expiring"|"expired"|"inventory"|"monthly"|null;

export default function DashboardNew() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { currentUser } = useStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const { data: customers = [] } = useCustomers();
  const { data: dailyPlans = [] } = useDailyPlans();
  const inventorySummary = useInventorySummary();
  const inventoryItems = useQuery(api.inventory.list, {}) || [];
  // ✅ حضور وإجازات اليوم للوحة التحكم
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const dashDate = format(selectedDate, "yyyy-MM-dd");
  const attToday = useQuery(api.attendance.todayCounts, { date: dashDate, sessionToken }) as any;
  const leaveToday = useQuery(api.leaves.onLeaveToday, { date: dashDate, sessionToken }) as any;

  const stats = useMemo(() => {
    const today = format(selectedDate, "yyyy-MM-dd");
    const todayPlans   = dailyPlans.filter(p => p.date === today);
    const morningPlans = todayPlans.filter(p => p.deliveryTime === "MORNING");
    const eveningPlans = todayPlans.filter(p => p.deliveryTime === "EVENING");
    const now = new Date();

    // ✅ تحويل آمن للتاريخ — يرجّع null لو التاريخ فاضي أو غير صالح (يمنع Invalid time value)
    const safeDate = (s?: string) => {
      if (!s) return null;
      const d = parseISO(s);
      return isNaN(d.getTime()) ? null : d;
    };
    const endDaysLeft = (c: any) => { const d = safeDate(c.endDate); return d ? differenceInDays(d, now) : null; };

    const activeCustomers   = customers.filter(c => { const d = endDaysLeft(c); return d !== null && d >= 0; });
    const expiredCustomers  = customers.filter(c => { const d = endDaysLeft(c); return d !== null && d < 0; });
    const expiringCustomers = customers.filter(c => { const d = endDaysLeft(c); return d !== null && d >= 0 && d <= 3; });
    const todayStr = format(now, "yyyy-MM-dd");
    const expiringToday     = customers.filter(c => { const d = safeDate(c.endDate); return d ? format(d, "yyyy-MM-dd") === todayStr : false; });
    const lowStockItems     = inventoryItems.filter((i:any) => i.current_stock <= i.min_stock);
    const cm = now.getMonth(), cy = now.getFullYear();
    const newThisMonth = customers.filter(c => { const s = safeDate(c.startDate); return s ? (s.getMonth()===cm && s.getFullYear()===cy) : false; });

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

  const topProgram = useMemo(() => {
    if (programData.length === 0) return "DIET";
    const sorted = [...programData].sort((a,b) => b.value - a.value);
    return sorted[0]?.name || "DIET";
  }, [programData]);

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
    <div dir="rtl" className="space-y-8 pb-10 bg-[#fafafa]/50 p-2 sm:p-4 rounded-[2.5rem]">

      {/* ── 🌟 Premium Welcome Brand Banner (Adrenaline Cyan-Blue Gradient) ── */}
      <div className="relative rounded-[2rem] p-6 sm:p-8 text-white overflow-hidden shadow-[0_15px_35px_rgba(60,196,240,0.15)] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
        style={{ background: "linear-gradient(135deg, #2ebbf0 0%, #22517d 50%, #173757 100%)" }}>
        
        {/* Repeating luxury geometric background pattern */}
        <div className="absolute inset-0 z-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.15) 1px, transparent 0), radial-gradient(rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: "24px 24px",
            backgroundPosition: "0 0, 12px 12px"
          }} />
          
        {/* Glow ambient spots matching official palette */}
        <div className="absolute -left-12 -top-12 h-44 w-44 rounded-full opacity-40 bg-[#3cc4f0] blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-32 w-32 rounded-full opacity-20 bg-[#47759c] blur-2xl" />

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-1.5 rounded-full border border-white/20 shadow-inner">
            <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
            <span className="text-[11px] font-black tracking-wider uppercase">نظام أدرينالين لإدارة الوجبات الصحية 🥗</span>
          </div>
          
          <h1 className="text-3xl sm:text-4.5xl font-black tracking-tight leading-tight" style={{ fontFamily: "Outfit, Inter, system-ui" }}>
            صباح الخير والنشاط المميز ☀️ ، {currentUser?.name?.split(" ")[0] || "مسؤول أدرينالين"}
          </h1>
          <p className="text-xs sm:text-sm text-cyan-100/90 font-bold max-w-xl leading-relaxed">
            نظرة عامة وشاملة على أداء الاشتراكات، وجبات اليوم، وعمليات المطبخ والمخزون
          </p>
        </div>

        {/* Top-performing badge (Real Data topProgram Card) */}
        <div className="relative z-10 shrink-0 bg-white/10 backdrop-blur-xl rounded-2xl p-4.5 border border-white/20 flex items-center gap-4 shadow-2xl transition-all duration-300 hover:scale-[1.03]">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400 to-[#47759c] flex items-center justify-center text-white font-extrabold shrink-0 shadow-[0_4px_15px_rgba(60,196,240,0.3)] text-lg">
            🥗
          </div>
          <div>
            <p className="text-[10px] text-cyan-200 font-black uppercase tracking-wider">البرنامج الأكثر طلباً</p>
            <p className="text-sm sm:text-base font-black text-white mt-0.5">{topProgram}</p>
          </div>
        </div>
      </div>

      {/* ── Controls Row ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border border-gray-100">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block">التاريخ المعروض</span>
          <span className="text-base sm:text-lg font-black text-[#47759c] block">
            {format(selectedDate, "EEEE، d MMMM yyyy", { locale: ar })}
          </span>
        </div>
        
        {/* Date switcher */}
        <div className="flex gap-1.5 bg-slate-50 rounded-2xl p-1.5 border border-slate-100">
          {[{label:"أمس",offset:-1},{label:"اليوم",offset:0},{label:"غداً",offset:1}].map(({label,offset})=>{
            const d = new Date(); d.setDate(d.getDate()+offset);
            const active = format(selectedDate,"yyyy-MM-dd")===format(d,"yyyy-MM-dd");
            return (
              <button key={label} onClick={()=>setSelectedDate(d)}
                className="h-9 px-6 rounded-xl text-xs font-black transition-all duration-300"
                style={active ? {background:"#3cc4f0",color:"#fff",boxShadow:"0 4px 14px rgba(60,196,240,0.4)"} : {color:"#64748b"}}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── الموظفين اليوم (حضور/إجازات) ── */}
      {(attToday || leaveToday) && (
        <button onClick={() => setLocation("/attendance")}
          className="w-full bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-wrap items-center gap-3 sm:gap-5 text-right hover:border-[#3cc4f0]/40 transition-colors shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
          <span className="text-[11px] sm:text-xs font-black text-gray-400 uppercase tracking-wider ml-auto sm:ml-0">الموظفون اليوم</span>
          {[
            { l: "حاضر", v: attToday?.present ?? 0, c: "#10b981" },
            { l: "غائب", v: attToday?.absent ?? 0, c: "#ef4444" },
            { l: "إجازة", v: leaveToday?.count ?? 0, c: "#3cc4f0" },
            { l: "متأخر", v: attToday?.late ?? 0, c: "#f59e0b" },
          ].map((x, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: x.c }} />
              <span className="text-lg sm:text-2xl font-black tabular-nums" style={{ color: x.c }}>{x.v}</span>
              <span className="text-[11px] sm:text-xs font-bold text-gray-500">{x.l}</span>
            </div>
          ))}
          <span className="text-[10px] text-gray-300 mr-auto hidden sm:inline">اضغط لإدارة الحضور ←</span>
        </button>
      )}

      {/* ── Row 1: 4 Gorgeous top-accented KPI cards with real operational micro-metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* المشتركين النشطين */}
        <button onClick={()=>setOpenModal("customers")}
          className="group relative bg-white rounded-[2rem] p-6 text-right transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] active:scale-[0.98] border border-gray-100 flex flex-col justify-between overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.015)] min-h-[240px]">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-[#3cc4f0] rounded-t-3xl" />
          
          <div className="w-full">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">المشتركين النشطين</span>
              <div className="h-12 w-12 rounded-2xl bg-[#3cc4f0]/10 flex items-center justify-center shrink-0 border border-[#3cc4f0]/10 shadow-sm transition-all duration-300 group-hover:scale-105">
                <Users className="h-6 w-6 text-[#3cc4f0]" />
              </div>
            </div>
            
            <div className="mt-1">
              <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tight leading-none">
                {stats.activeCustomersCount}
              </p>
              <p className="text-xs text-gray-400 font-bold mt-2">
                إجمالي المشتركين: {stats.totalCustomers}
              </p>
            </div>
          </div>

          {/* Operational Micro-Metric */}
          <div className="w-full mt-2 space-y-2 text-right">
            <div className="flex justify-between items-center text-[10px] font-bold text-[#3cc4f0]">
              <span>{stats.totalCustomers > 0 ? Math.round((stats.activeCustomersCount / stats.totalCustomers) * 100) : 0}% من الإجمالي</span>
              <span>نشط حالياً</span>
            </div>
            <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
              <div className="h-full rounded-full bg-[#3cc4f0] transition-all duration-500" 
                style={{ width: `${stats.totalCustomers > 0 ? Math.round((stats.activeCustomersCount / stats.totalCustomers) * 100) : 0}%` }} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-50 w-full flex items-center justify-between text-xs text-slate-400 group-hover:text-[#3cc4f0] transition-colors">
            <span className="font-extrabold">عرض التفاصيل</span>
            <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </button>

        {/* خطط اليوم */}
        <button onClick={()=>setOpenModal("meals")}
          className="group relative bg-white rounded-[2rem] p-6 text-right transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] active:scale-[0.98] border border-gray-100 flex flex-col justify-between overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.015)] min-h-[240px]">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-[#47759c] rounded-t-3xl" />
          
          <div className="w-full">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">خطط وجبات اليوم</span>
              <div className="h-12 w-12 rounded-2xl bg-[#47759c]/10 flex items-center justify-center shrink-0 border border-[#47759c]/10 shadow-sm transition-all duration-300 group-hover:scale-105">
                <CalendarCheck className="h-6 w-6 text-[#47759c]" />
              </div>
            </div>
            
            <div className="mt-1">
              <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tight leading-none">
                {stats.todayMeals}
              </p>
              <p className="text-xs text-gray-400 font-bold mt-2">
                إجمالي خطط اليوم
              </p>
            </div>
          </div>

          {/* Operational Micro-Metric Split Columns */}
          <div className="w-full mt-2 grid grid-cols-2 gap-2 border-t border-slate-50 pt-2 text-right">
            <div>
              <span className="text-[10px] text-gray-400 font-bold block">☀ صباحي</span>
              <span className="text-sm font-black text-amber-500">{stats.morningDelivery} وجبة</span>
            </div>
            <div className="border-r border-slate-100 pr-2">
              <span className="text-[10px] text-gray-400 font-bold block">🌙 مسائي</span>
              <span className="text-sm font-black text-indigo-500">{stats.eveningDelivery} وجبة</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-50 w-full flex items-center justify-between text-xs text-slate-400 group-hover:text-[#47759c] transition-colors">
            <span className="font-extrabold">عرض التفاصيل</span>
            <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </button>

        {/* توصيل صباحي */}
        <button onClick={()=>setOpenModal("morning")}
          className="group relative bg-white rounded-[2rem] p-6 text-right transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] active:scale-[0.98] border border-gray-100 flex flex-col justify-between overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.015)] min-h-[240px]">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-500 rounded-t-3xl" />
          
          <div className="w-full">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">توصيل صباحي</span>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/10 shadow-sm transition-all duration-300 group-hover:scale-105">
                <Sun className="h-6 w-6 text-amber-500" />
              </div>
            </div>
            
            <div className="mt-1">
              <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tight leading-none">
                {stats.morningDelivery}
              </p>
              <p className="text-xs text-gray-400 font-bold mt-2">
                وجبات الفوج الصباحي
              </p>
            </div>
          </div>

          {/* Operational Micro-Metric Progress Bar */}
          <div className="w-full mt-2 space-y-2 text-right">
            <div className="flex justify-between items-center text-[10px] font-bold text-amber-500">
              <span>{stats.morningRate}% من التوصيل</span>
              <span>طلب صباحي</span>
            </div>
            <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
              <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${stats.morningRate}%` }} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-50 w-full flex items-center justify-between text-xs text-slate-400 group-hover:text-amber-500 transition-colors">
            <span className="font-extrabold">عرض التفاصيل</span>
            <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </button>

        {/* توصيل مسائي */}
        <button onClick={()=>setOpenModal("evening")}
          className="group relative bg-white rounded-[2rem] p-6 text-right transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(0,0,0,0.03)] active:scale-[0.98] border border-gray-100 flex flex-col justify-between overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.015)] min-h-[240px]">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-[#0f1516] rounded-t-3xl" />
          
          <div className="w-full">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">توصيل مسائي</span>
              <div className="h-12 w-12 rounded-2xl bg-[#0f1516]/10 flex items-center justify-center shrink-0 border border-[#0f1516]/10 shadow-sm transition-all duration-300 group-hover:scale-105">
                <Moon className="h-6 w-6 text-[#0f1516]" />
              </div>
            </div>
            
            <div className="mt-1">
              <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tight leading-none">
                {stats.eveningDelivery}
              </p>
              <p className="text-xs text-gray-400 font-bold mt-2">
                وجبات الفوج المسائي
              </p>
            </div>
          </div>

          {/* Operational Micro-Metric Progress Bar */}
          <div className="w-full mt-2 space-y-2 text-right">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
              <span>{100 - stats.morningRate}% من التوصيل</span>
              <span>طلب مسائي</span>
            </div>
            <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
              <div className="h-full rounded-full bg-[#0f1516] transition-all duration-500" style={{ width: `${100 - stats.morningRate}%` }} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-50 w-full flex items-center justify-between text-xs text-slate-400 group-hover:text-[#0f1516] transition-colors">
            <span className="font-extrabold">عرض التفاصيل</span>
            <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </div>
        </button>
      </div>

      {/* ── Row 2: alerts + programs (Spacious & Clean Layout) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* حالة الاشتراكات */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-gray-100 overflow-hidden flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 bg-slate-50/20">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span className="text-base font-black text-slate-800 tracking-tight">حالة الاشتراكات</span>
            </div>
            <button onClick={()=>setLocation("/customers")}
              className="text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 hover:scale-[1.02] active:scale-[0.98] transition-all">
              عرض الكل <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6 flex-1 items-center">
            {/* Right side: Detailed Progress Lines (3 cols) */}
            <div className="md:col-span-3 space-y-3.5">
              {[
                { label: "نشطة ومستمرة", count: Math.max(0, stats.activeCustomersCount - stats.expiringCustomersCount - stats.expiringTodayCount), color: "#2ebbf0", modal: "customers" as ModalType },
                { label: "تنتهي خلال 3 أيام", count: stats.expiringCustomersCount, color: "#ca8a04", modal: "expiring" as ModalType },
                { label: "تنتهي اليوم", count: stats.expiringTodayCount, color: "#f97316", modal: "expiring" as ModalType },
                { label: "اشتراكات منتهية", count: stats.expiredCustomersCount, color: "#ef4444", modal: "expired" as ModalType },
              ].map(({ label, count, color, modal }) => {
                const pct = stats.totalCustomers > 0 ? Math.round((count / stats.totalCustomers) * 100) : 0;
                return (
                  <button
                    key={label}
                    onClick={() => setOpenModal(modal)}
                    className="w-full text-right group p-3.5 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50/80 hover:border-slate-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.015)] transition-all duration-300 flex flex-col gap-2 relative overflow-hidden active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between w-full relative z-10">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-bold text-slate-500">{label}</span>
                      </div>
                      <span className="text-xs font-black tabular-nums" style={{ color }}>
                        {count} ({pct}%)
                      </span>
                    </div>
                    
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden relative z-10 border border-slate-200/30">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Left side: Premium Donut Chart (2 cols) */}
            <div className="md:col-span-2 flex flex-col items-center justify-center relative min-h-[200px]">
              <div className="w-full h-[180px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(() => {
                        const chartData = [
                          { name: "نشطة ومستمرة", value: Math.max(0, stats.activeCustomersCount - stats.expiringCustomersCount - stats.expiringTodayCount), color: "#2ebbf0" },
                          { name: "تنتهي خلال 3 أيام", value: stats.expiringCustomersCount, color: "#ca8a04" },
                          { name: "تنتهي اليوم", value: stats.expiringTodayCount, color: "#f97316" },
                          { name: "اشتراكات منتهية", value: stats.expiredCustomersCount, color: "#ef4444" },
                        ].filter(d => d.value > 0);
                        return chartData.length > 0 ? chartData : [{ name: "لا يوجد", value: 1, color: "#e2e8f0" }];
                      })()}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {(() => {
                        const chartData = [
                          { name: "نشطة ومستمرة", value: Math.max(0, stats.activeCustomersCount - stats.expiringCustomersCount - stats.expiringTodayCount), color: "#2ebbf0" },
                          { name: "تنتهي خلال 3 أيام", value: stats.expiringCustomersCount, color: "#ca8a04" },
                          { name: "تنتهي اليوم", value: stats.expiringTodayCount, color: "#f97316" },
                          { name: "اشتراكات منتهية", value: stats.expiredCustomersCount, color: "#ef4444" },
                        ].filter(d => d.value > 0);
                        const finalData = chartData.length > 0 ? chartData : [{ name: "لا يوجد", value: 1, color: "#e2e8f0" }];
                        return finalData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ));
                      })()}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text indicating total subscribers */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-800 tracking-tight leading-none">{stats.totalCustomers}</span>
                  <span className="text-[10px] font-bold text-slate-400 mt-1">إجمالي المشتركين</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* توزيع البرامج */}
        <div className="bg-white rounded-[2rem] shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-gray-100 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 bg-slate-50/20">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="h-5 w-5 text-slate-400" />
              <span className="text-base font-black text-slate-800">توزيع البرامج</span>
            </div>
            <div className="w-5 h-5" />
          </div>
          
          <div className="p-6 space-y-4">
            {programData.map(({name, value}) => {
              const pct = stats.totalCustomers > 0 ? Math.round((value/stats.totalCustomers)*100) : 0;
              const color = PROG_COLORS[name] || "#64748b";
              return (
                <div key={name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">{name}</span>
                    <span className="text-xs font-black tabular-nums" style={{color}}>{value} ({pct}%)</span>
                  </div>
                  <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ملخص المخزون */}
        <div className="bg-white rounded-[2rem] shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-gray-100 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 bg-slate-50/20">
            <div className="flex items-center gap-2.5">
              <Package className="h-5 w-5 text-slate-400" />
              <span className="text-base font-black text-slate-800">ملخص المخزون</span>
            </div>
            <button onClick={()=>setLocation("/inventory")}
              className="text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1 text-slate-600 bg-slate-50 hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all">
              إدارة <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          
          <div className="p-6 grid grid-cols-1 gap-4">
            <button onClick={()=>setOpenModal("inventory")}
              className="w-full rounded-[1.5rem] p-5 text-center bg-gradient-to-br from-red-50 to-rose-50/30 border border-red-100 hover:shadow-lg transition-all duration-300 active:scale-[0.98] group">
              <p className="text-5xl font-black text-red-500 tabular-nums tracking-tight leading-none group-hover:scale-105 transition-transform">{stats.lowStockCount}</p>
              <p className="text-xs font-black text-red-400 mt-2">⚠ أصناف مخزون منخفض</p>
            </button>
            <button onClick={()=>setLocation("/inventory")}
              className="w-full rounded-[1.5rem] p-5 text-center bg-gradient-to-br from-emerald-50 to-green-50/30 border border-emerald-100 hover:shadow-lg transition-all duration-300 active:scale-[0.98] group">
              <p className="text-5xl font-black text-emerald-600 tabular-nums tracking-tight leading-none group-hover:scale-105 transition-transform">{(inventorySummary as any)?.totalItems||0}</p>
              <p className="text-xs font-black text-emerald-500 mt-2">✓ إجمالي الأصناف</p>
            </button>
          </div>
        </div>

        {/* نظرة أسبوعية */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-gray-100 overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 bg-slate-50/20">
            <span className="text-xs font-extrabold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">آخر 7 أيام</span>
            <div className="flex items-center gap-2.5">
              <Utensils className="h-5 w-5 text-cyan-500" />
              <span className="text-base font-black text-slate-800">الخطط الأسبوعية</span>
            </div>
          </div>
          
          <div className="p-6">
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
                  <Tooltip contentStyle={{borderRadius:"16px",border:"1px solid #f1f5f9",fontSize:12,boxShadow:"0 12px 35px rgba(0,0,0,0.06)"}} cursor={{fill:"#f8fafc",radius:8}} />
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
