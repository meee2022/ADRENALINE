/**
 * @file client/src/pages/AnalyticsDashboard.tsx
 * @description لوحة التحليلات - رسوم بيانية تفاعلية
 */
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import {
  Users,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  Activity,
  BarChart3,
} from "lucide-react";

const COLORS = ["#3CC4F0", "#47759C", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const STATUS_AR: Record<string, string> = {
  pending: "قيد المراجعة",
  confirmed: "مؤكد",
  active: "نشط",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const STATUS_EN: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function AnalyticsDashboard() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const overview = useQuery(api.analytics.overview, { sessionToken });
  const sales30 = useQuery(api.analytics.salesLast30Days, { sessionToken }) || [];
  const statusDist = useQuery(api.analytics.orderStatusDistribution, { sessionToken }) || [];
  const topMeals = useQuery(api.analytics.topMeals, { limit: 10, sessionToken }) || [];
  const growth = useQuery(api.analytics.customerGrowth, { sessionToken }) || [];
  const kitchen = useQuery(api.analytics.kitchenPerformance, { days: 7, sessionToken }) || [];
  const online = useQuery(api.analytics.onlinePlatforms, { sessionToken }) as any;
  const drivers = useQuery(api.analytics.driverStats, { days: 7, sessionToken }) as any[] | undefined;
  const PCOLOR: Record<string, string> = { TALABAT: "#FF5A00", SNOONU: "#6D28D9", RAFEEQ: "#2563eb", DELIVEROO: "#00CCBC", KEETA: "#f59e0b", OTHER: "#64748b" };

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={<BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="لوحة التحليلات" titleEn="Analytics Dashboard"
        subtitleAr="نظرة شاملة على أداء العمل" subtitleEn="A complete view of business performance"
        kpis={overview ? [
          { value: overview.totalCustomers, labelAr: "إجمالي العملاء", labelEn: "Total Customers" },
          { value: overview.totalOrders, labelAr: "الطلبات", labelEn: "Orders" },
          { value: `${overview.totalRevenue.toLocaleString()} ${t("ر.ق", "QAR")}`, labelAr: "الإيرادات الكلية", labelEn: "Total Revenue" },
          { value: overview.todayMeals, labelAr: "وجبات اليوم", labelEn: "Today's Meals" },
        ] : undefined}
      />

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label={t("إجمالي العملاء", "Total Customers")}
            value={overview.totalCustomers}
            sub={isRtl ? `${overview.activeCustomers} نشط` : `${overview.activeCustomers} active`}
            icon={Users}
            color="#3CC4F0"
          />
          <KpiCard
            label={t("الطلبات", "Orders")}
            value={overview.totalOrders}
            sub={isRtl ? `${overview.pendingOrders} قيد المراجعة` : `${overview.pendingOrders} pending`}
            icon={ShoppingCart}
            color="#10b981"
          />
          <KpiCard
            label={t("الإيرادات الكلية", "Total Revenue")}
            value={`${overview.totalRevenue.toLocaleString()} ${t("ر.ق", "QAR")}`}
            sub={isRtl ? `${overview.completedOrders} طلب مكتمل` : `${overview.completedOrders} completed orders`}
            icon={DollarSign}
            color="#f59e0b"
          />
          <KpiCard
            label={t("وجبات اليوم", "Today's Meals")}
            value={overview.todayMeals}
            sub={isRtl ? `${overview.todayPlans} خطة` : `${overview.todayPlans} plans`}
            icon={UtensilsCrossed}
            color="#8b5cf6"
          />
        </div>
      )}

      {/* Sales chart */}
      <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-600" />
            {t("المبيعات - آخر 30 يوم", "Sales - Last 30 Days")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={sales30}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3CC4F0" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3CC4F0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                name={t("الإيرادات (ر.ق)", "Revenue (QAR)")}
                stroke="#3CC4F0"
                fill="url(#revenueGrad)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="count"
                name={t("عدد الطلبات", "Order Count")}
                stroke="#47759C"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status distribution */}
        <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-600" />
              {t("توزيع حالات الطلبات", "Order Status Distribution")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusDist.map((s: any) => ({ ...s, name: (isRtl ? STATUS_AR[s.status] : STATUS_EN[s.status]) || s.status }))}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry: any) => `${entry.name}: ${entry.count}`}
                >
                  {statusDist.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Customer growth */}
        <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-600" />
              {t("نمو العملاء", "Customer Growth")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name={t("جديد", "New")} fill="#3CC4F0" />
                <Bar dataKey="cumulative" name={t("الإجمالي", "Total")} fill="#47759C" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top meals */}
      <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-cyan-600" />
            {t("أكثر الوجبات طلباً", "Most Ordered Meals")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topMeals.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t("لا توجد بيانات", "No data available")}</p>
          ) : (
            <div className="space-y-2">
              {topMeals.map((meal: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-sm text-white"
                    style={{ background: COLORS[idx % COLORS.length] }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{meal.name}</p>
                    <div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(meal.count / (topMeals[0]?.count || 1)) * 100}%`,
                          background: COLORS[idx % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">{meal.count}</p>
                    <p className="text-[10px] text-slate-500">{meal.revenue} {t("ر.ق", "QAR")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kitchen performance */}
      <Card className="rounded-2xl border-0" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-600" />
            {t("أداء المطبخ - آخر 7 أيام", "Kitchen Performance - Last 7 Days")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={kitchen}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="confirmed" name={t("مؤكد", "Confirmed")} stackId="a" fill="#3CC4F0" />
              <Bar dataKey="prepared" name={t("جاهز", "Prepared")} stackId="a" fill="#f59e0b" />
              <Bar dataKey="delivered" name={t("تم التوصيل", "Delivered")} stackId="a" fill="#10b981" />
              <Bar dataKey="cancelled" name={t("ملغي", "Cancelled")} stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ✅ إيراد منصّات الأونلاين هذا الشهر */}
      <Card>
        <CardHeader><CardTitle>💳 {t("إيراد منصّات الأونلاين", "Online Platforms Revenue")} — {online?.month || t("الشهر", "This Month")}</CardTitle></CardHeader>
        <CardContent>
          {!online || online.platforms.length === 0 ? (
            <p className="text-center text-slate-400 py-8">{t("لا توجد طلبات أونلاين مسجّلة هذا الشهر", "No online orders recorded this month")}</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="rounded-xl bg-slate-50 p-3 text-center"><div className="text-2xl font-black text-[#0E76AC]">{online.totals.orders}</div><div className="text-xs text-slate-500">{t("طلبات", "Orders")}</div></div>
                <div className="rounded-xl bg-slate-50 p-3 text-center"><div className="text-2xl font-black text-[#0E76AC]">{online.totals.meals}</div><div className="text-xs text-slate-500">{t("وجبات", "Meals")}</div></div>
                <div className="rounded-xl bg-emerald-50 p-3 text-center"><div className="text-2xl font-black text-emerald-600">{Math.round(online.totals.revenue).toLocaleString()}</div><div className="text-xs text-slate-500">{t("إيراد (ر.ق)", "Revenue (QAR)")}</div></div>
              </div>
              {online.platforms.map((p: any) => {
                const pct = online.totals.revenue ? (p.revenue / online.totals.revenue) * 100 : 0;
                return (
                  <div key={p.platform}>
                    <div className="flex items-center justify-between text-sm font-bold mb-1">
                      <span style={{ color: PCOLOR[p.platform] || "#64748b" }}>{p.platform}</span>
                      <span className="text-slate-600">{Math.round(p.revenue).toLocaleString()} {t("ر.ق", "QAR")} · {p.orders} {t("طلب", "orders")}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PCOLOR[p.platform] || "#64748b" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ أداء السائقين آخر 7 أيام */}
      <Card>
        <CardHeader><CardTitle>🚚 {t("أداء السائقين (آخر 7 أيام)", "Driver Performance (Last 7 Days)")}</CardTitle></CardHeader>
        <CardContent>
          {!drivers || drivers.length === 0 ? (
            <p className="text-center text-slate-400 py-8">{t("لا توجد توصيلات مسجّلة", "No deliveries recorded")}</p>
          ) : (
            <div className="space-y-2">
              {drivers.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-full bg-[#0E76AC] text-white grid place-items-center font-black text-sm">{i + 1}</span>
                    <span className="font-bold text-slate-800">{d.driver}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-black text-emerald-600">{d.delivered} <span className="text-xs font-normal text-slate-400">{t("توصيلة", "deliveries")}</span></span>
                    {d.avgMinutes != null && <span className="font-bold text-[#0E76AC]">~{d.avgMinutes} <span className="text-xs font-normal text-slate-400">{t("دقيقة", "min")}</span></span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: any;
  sub?: string;
  icon: any;
  color: string;
}) {
  return (
    <Card className="rounded-2xl border-0 transition-shadow" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-semibold mb-1">{label}</p>
            <p className="text-2xl font-black tabular-nums" style={{ color: "#0E76AC" }}>{value}</p>
            {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
          </div>
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, color }}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
