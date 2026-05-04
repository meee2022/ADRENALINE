// client/src/pages/DashboardNew.tsx
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useCustomers, useDailyPlans, useInventorySummary } from "@/lib/api";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Users, CalendarCheck, Sun, Moon, DollarSign, ChevronRight, TrendingUp, Package, AlertCircle, Clock, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { format, parseISO, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import { useLanguage } from "@/lib/i18n";

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
    const monthlyRevenue = customers.reduce((t,c) => t + ((c as any).price||(c as any).subscriptionPrice||0), 0);

    return {
      activeCustomers, activeCustomersCount: activeCustomers.length,
      todayPlans, todayMeals: todayPlans.length,
      morningPlans, morningDelivery: morningPlans.length,
      eveningPlans, eveningDelivery: eveningPlans.length,
      expiredCustomers, expiredCustomersCount: expiredCustomers.length,
      expiringCustomers, expiringCustomersCount: expiringCustomers.length,
      expiringTodayCount: expiringToday.length,
      inventoryValue: inventorySummary?.stockValueQAR || 0,
      lowStockItems, lowStockCount: lowStockItems.length,
      newThisMonth: newThisMonth.length, newThisMonthList: newThisMonth,
      monthlyRevenue, totalCustomers: customers.length,
    };
  }, [customers, dailyPlans, selectedDate, inventorySummary, inventoryItems]);

  const weeklyData = useMemo(() => {
    const days = ["سبت","أحد","اثن","ثلا","أرب","خمس","جمع"];
    return days.map((day, idx) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - idx));
      return { name: day, value: dailyPlans.filter(p => p.date === format(d,"yyyy-MM-dd")).length };
    });
  }, [dailyPlans]);

  const deliveryData = [
    { name: "صباحي", value: stats.morningDelivery, color: "#3cc4f0" },
    { name: "مسائي", value: stats.eveningDelivery,  color: "#47759c" },
  ];

  const activeRate  = stats.totalCustomers > 0 ? Math.round((stats.activeCustomersCount / stats.totalCustomers) * 100) : 0;
  const morningRate = stats.todayMeals > 0 ? Math.round((stats.morningDelivery / stats.todayMeals) * 100) : 0;

  const CustomerRow = ({ customer, badge }: { customer:any; badge:React.ReactNode }) => (
    <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{customer.fullName||customer.name||"بدون اسم"}</p>
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
        <p className="text-xs text-gray-400 truncate max-w-[100px]">{cust?.address||"-"}</p>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${plan.deliveryTime==="MORNING" ? "bg-sky-100 text-sky-700" : "bg-indigo-100 text-indigo-700"}`}>
          {plan.deliveryTime==="MORNING" ? "صباحي" : "مسائي"}
        </span>
      </div>
    );
  };

  // Reusable premium KPI card
  const KpiCard = ({
    label, value, icon: Icon, accent, modal, sub, onClick
  }: {
    label: string; value: string|number; icon: any; accent: string;
    modal?: ModalType; sub: React.ReactNode; onClick?: () => void;
  }) => (
    <button
      onClick={onClick ?? (modal ? () => setOpenModal(modal) : undefined)}
      className="group relative bg-white rounded-2xl overflow-hidden text-right transition-all duration-200 hover:-translate-y-1 active:scale-[0.98] w-full"
      style={{
        boxShadow: "0 2px 16px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {/* Top accent gradient bar */}
      <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />

      {/* Hover glow overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(ellipse at top left, ${accent}08 0%, transparent 70%)` }} />

      <div className="relative p-5">
        {/* Icon + value row */}
        <div className="flex items-start justify-between mb-5">
          {/* Icon */}
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${accent}20, ${accent}0a)`,
              border: `1.5px solid ${accent}35`,
            }}>
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>

          {/* Value + label */}
          <div className="text-right">
            <div className="text-[2.6rem] font-black leading-none text-gray-900 tabular-nums tracking-tight">{value}</div>
            <div className="text-[11px] font-medium text-gray-400 mt-1.5 leading-none">{label}</div>
          </div>
        </div>

        {/* Sub-section */}
        <div className="pt-3.5 border-t border-gray-100">
          {sub}
        </div>
      </div>
    </button>
  );

  return (
    <div dir="rtl" className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">لوحة التحكم</h1>
          <p className="text-sm mt-1 font-medium" style={{ color:"#3cc4f0" }}>
            {format(selectedDate, "EEEE، d MMMM yyyy", { locale: ar })}
          </p>
        </div>
        <div className="flex gap-1.5 bg-white rounded-xl p-1" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.06)" }}>
          {[{label:"أمس",offset:-1},{label:"اليوم",offset:0},{label:"غداً",offset:1}].map(({label,offset})=>{
            const d = new Date(); d.setDate(d.getDate()+offset);
            const active = format(selectedDate,"yyyy-MM-dd")===format(d,"yyyy-MM-dd");
            return (
              <button key={label} onClick={()=>setSelectedDate(d)}
                className="h-8 px-4 rounded-lg text-xs font-semibold transition-all"
                style={ active
                  ? { background:"#3cc4f0", color:"#fff", boxShadow:"0 2px 8px #3cc4f055" }
                  : { color:"#64748b" }
                }>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Primary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="مشترك نشط" value={stats.activeCustomersCount}
          icon={Users} accent="#3cc4f0" modal="customers"
          sub={
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background:"#3cc4f012", color:"#3cc4f0" }}>{activeRate}% نشطين</span>
              <span className="text-[11px] text-gray-400">من {stats.totalCustomers}</span>
            </div>
          }
        />
        <KpiCard
          label="خطة اليوم" value={stats.todayMeals}
          icon={CalendarCheck} accent="#10b981" modal="meals"
          sub={
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-amber-500 font-semibold flex items-center gap-1">
                <span>☀</span><span>{stats.morningDelivery} صباحي</span>
              </span>
              <span className="text-[11px] text-indigo-500 font-semibold flex items-center gap-1">
                <span>{stats.eveningDelivery} مسائي</span><span>🌙</span>
              </span>
            </div>
          }
        />
        <KpiCard
          label="توصيل صباحي" value={stats.morningDelivery}
          icon={Sun} accent="#f59e0b" modal="morning"
          sub={
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[11px] text-gray-400">{morningRate}% من الإجمالي</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width:`${morningRate}%`, background:"linear-gradient(90deg, #f59e0b, #fcd34d)" }} />
              </div>
            </div>
          }
        />
        <KpiCard
          label="توصيل مسائي" value={stats.eveningDelivery}
          icon={Moon} accent="#8b5cf6" modal="evening"
          sub={
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[11px] text-gray-400">{100-morningRate}% من الإجمالي</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width:`${100-morningRate}%`, background:"linear-gradient(90deg, #8b5cf6, #c4b5fd)" }} />
              </div>
            </div>
          }
        />
      </div>

      {/* 2 Secondary cards */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="عميل جديد هذا الشهر" value={stats.newThisMonth}
          icon={TrendingUp} accent="#3cc4f0" modal="monthly"
          sub={
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background:"#3cc4f012", color:"#3cc4f0" }}>هذا الشهر</span>
              <span className="text-[11px] text-gray-400">إجمالي {stats.totalCustomers}</span>
            </div>
          }
        />
        <KpiCard
          label="الإيرادات (ر.ق)" value={stats.monthlyRevenue.toLocaleString()}
          icon={DollarSign} accent="#47759c"
          sub={<span className="text-[11px] text-gray-400">من {stats.activeCustomersCount} مشترك نشط</span>}
        />
      </div>

      {/* Alerts + Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Subscription alerts */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow:"0 2px 16px rgba(0,0,0,0.07)", border:"1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <button className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color:"#3cc4f0", background:"#3cc4f010" }}
              onClick={()=>setLocation("/customers")}>
              <span>عرض الكل</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" style={{ color:"#3cc4f0" }} />
              <span className="text-sm font-bold text-gray-800">حالة الاشتراكات</span>
            </div>
          </div>
          <div className="p-4 space-y-2.5">
            {[
              { label:"اشتراكات منتهية",   count:stats.expiredCustomersCount,  bg:"#fef2f2", border:"#fecaca", dot:"#ef4444", num:"#dc2626", modal:"expired"  as ModalType },
              { label:"تنتهي اليوم",       count:stats.expiringTodayCount,     bg:"#fff7ed", border:"#fed7aa", dot:"#f97316", num:"#ea580c", modal:"expiring" as ModalType },
              { label:"تنتهي خلال 3 أيام", count:stats.expiringCustomersCount, bg:"#fffbeb", border:"#fde68a", dot:"#f59e0b", num:"#d97706", modal:"expiring" as ModalType },
            ].map(({ label, count, bg, border, dot, num, modal }) => (
              <button key={label} onClick={()=>setOpenModal(modal)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:brightness-95 active:scale-[0.99]"
                style={{ background:bg, border:`1px solid ${border}` }}>
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background:dot }} />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tabular-nums" style={{ color:num }}>{count}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Inventory summary */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow:"0 2px 16px rgba(0,0,0,0.07)", border:"1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <button className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color:"#47759c", background:"#47759c10" }}
              onClick={()=>setLocation("/inventory")}>
              <span>إدارة</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color:"#47759c" }} />
              <span className="text-sm font-bold text-gray-800">ملخص المخزون</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {/* Total value */}
            <div className="rounded-xl px-4 py-3.5 flex items-center justify-between"
              style={{ background:"linear-gradient(135deg, #f8fafc, #f1f5f9)", border:"1px solid #e2e8f0" }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">ريال قطري</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-gray-900 tabular-nums">{stats.inventoryValue.toFixed(0)}</span>
                <span className="text-xs font-semibold text-gray-400">القيمة الإجمالية</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={()=>setOpenModal("inventory")}
                className="p-4 rounded-xl text-center transition-all hover:brightness-95 active:scale-[0.98]"
                style={{ background:"linear-gradient(135deg, #fef2f2, #fff5f5)", border:"1.5px solid #fecaca" }}>
                <p className="text-3xl font-black text-red-500 tabular-nums">{stats.lowStockCount}</p>
                <p className="text-xs font-medium text-gray-400 mt-1.5">مخزون منخفض</p>
              </button>
              <div className="p-4 rounded-xl text-center"
                style={{ background:"linear-gradient(135deg, #f0fdf4, #f7fef9)", border:"1.5px solid #bbf7d0" }}>
                <p className="text-3xl font-black text-emerald-600 tabular-nums">{inventorySummary?.totalItems||0}</p>
                <p className="text-xs font-medium text-gray-400 mt-1.5">إجمالي الأصناف</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow:"0 2px 16px rgba(0,0,0,0.07)", border:"1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">آخر 7 أيام</span>
            <span className="text-sm font-bold text-gray-800">نظرة عامة أسبوعية</span>
          </div>
          <div className="p-5">
            {weeklyData.every(d => d.value === 0) ? (
              <div className="flex flex-col items-center justify-center h-[200px] gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background:"#3cc4f012", border:"1.5px solid #3cc4f025" }}>
                  <CalendarCheck className="h-7 w-7" style={{ color:"#3cc4f0" }} />
                </div>
                <p className="text-sm font-semibold text-gray-400">لا توجد خطط وجبات هذا الأسبوع</p>
                <p className="text-xs text-gray-300">ستظهر البيانات هنا عند إضافة خطط يومية</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData} barCategoryGap="40%">
                  <XAxis dataKey="name" tick={{ fill:"#94a3b8", fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:"#94a3b8", fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                  <Tooltip
                    contentStyle={{ borderRadius:"12px", border:"1px solid #e2e8f0", fontSize:12, boxShadow:"0 8px 30px rgba(0,0,0,0.1)" }}
                    cursor={{ fill:"#f8fafc", radius: 6 }}
                  />
                  <Bar dataKey="value" fill="#3cc4f0" radius={[7,7,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow:"0 2px 16px rgba(0,0,0,0.07)", border:"1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <Clock className="h-4 w-4 text-gray-300" />
            <span className="text-sm font-bold text-gray-800">توزيع التوصيل</span>
          </div>
          <div className="p-4">
            {/* Legend */}
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background:"#3cc4f0" }} />
                <span className="text-xs text-gray-500">صباحي</span>
                <strong className="text-xs font-black mr-0.5" style={{ color:"#3cc4f0" }}>{stats.morningDelivery}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <strong className="text-xs font-black ml-0.5" style={{ color:"#47759c" }}>{stats.eveningDelivery}</strong>
                <span className="text-xs text-gray-500">مسائي</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background:"#47759c" }} />
              </span>
            </div>

            {stats.todayMeals === 0 ? (
              <div className="flex flex-col items-center justify-center h-[160px] gap-3">
                <div className="w-[110px] h-[110px] rounded-full flex items-center justify-center"
                  style={{ border:"10px solid #f1f5f9" }}>
                  <div className="text-center">
                    <p className="text-2xl font-black text-gray-300 tabular-nums">0</p>
                    <p className="text-[10px] text-gray-300">اليوم</p>
                  </div>
                </div>
                <p className="text-xs text-gray-300">لا توجد خطط اليوم</p>
              </div>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={deliveryData} cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                      paddingAngle={4} dataKey="value" strokeWidth={0}>
                      {deliveryData.map((e,i) => <Cell key={i} fill={e.color} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius:"10px", border:"1px solid #e2e8f0", fontSize:12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-3xl font-black text-gray-900 tabular-nums">{stats.todayMeals}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">إجمالي<br/>اليوم</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
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
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{background:"#fee2e2",color:"#dc2626"}}>
                منذ {d} يوم
              </span>
            } />;
          }),
        },
        { key:"monthly", title:"العملاء الجدد هذا الشهر", count:stats.newThisMonth, badge:"#3cc4f0",
          rows: stats.newThisMonthList.map((c:any,i:number) => (
            <CustomerRow key={c._id??i} customer={c} badge={
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{background:"#ecfeff",color:"#0891b2"}}>
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
            <div id={`${key}-desc`} className="max-h-[60vh] overflow-auto space-y-2">
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
