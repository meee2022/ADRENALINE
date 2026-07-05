/**
 * @file client/src/pages/AnalyticsDashboard.tsx
 * @description لوحة التحليلات - رسوم بيانية تفاعلية
 */
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
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

export default function AnalyticsDashboard() {
  const overview = useQuery(api.analytics.overview);
  const sales30 = useQuery(api.analytics.salesLast30Days) || [];
  const statusDist = useQuery(api.analytics.orderStatusDistribution) || [];
  const topMeals = useQuery(api.analytics.topMeals, { limit: 10 }) || [];
  const growth = useQuery(api.analytics.customerGrowth) || [];
  const kitchen = useQuery(api.analytics.kitchenPerformance, { days: 7 }) || [];

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={<BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="لوحة التحليلات" titleEn="Analytics Dashboard"
        subtitleAr="نظرة شاملة على أداء العمل" subtitleEn="A complete view of business performance"
        kpis={overview ? [
          { value: overview.totalCustomers, labelAr: "إجمالي العملاء", labelEn: "Total Customers" },
          { value: overview.totalOrders, labelAr: "الطلبات", labelEn: "Orders" },
          { value: `${overview.totalRevenue.toLocaleString()} ر.ق`, labelAr: "الإيرادات الكلية", labelEn: "Total Revenue" },
          { value: overview.todayMeals, labelAr: "وجبات اليوم", labelEn: "Today's Meals" },
        ] : undefined}
      />

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="إجمالي العملاء"
            value={overview.totalCustomers}
            sub={`${overview.activeCustomers} نشط`}
            icon={Users}
            color="#3CC4F0"
          />
          <KpiCard
            label="الطلبات"
            value={overview.totalOrders}
            sub={`${overview.pendingOrders} قيد المراجعة`}
            icon={ShoppingCart}
            color="#10b981"
          />
          <KpiCard
            label="الإيرادات الكلية"
            value={`${overview.totalRevenue.toLocaleString()} ر.ق`}
            sub={`${overview.completedOrders} طلب مكتمل`}
            icon={DollarSign}
            color="#f59e0b"
          />
          <KpiCard
            label="وجبات اليوم"
            value={overview.todayMeals}
            sub={`${overview.todayPlans} خطة`}
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
            المبيعات - آخر 30 يوم
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
                name="الإيرادات (ر.ق)"
                stroke="#3CC4F0"
                fill="url(#revenueGrad)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="عدد الطلبات"
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
              توزيع حالات الطلبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusDist.map((s: any) => ({ ...s, name: STATUS_AR[s.status] || s.status }))}
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
              نمو العملاء
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
                <Bar dataKey="count" name="جديد" fill="#3CC4F0" />
                <Bar dataKey="cumulative" name="الإجمالي" fill="#47759C" />
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
            أكثر الوجبات طلباً
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topMeals.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">لا توجد بيانات</p>
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
                    <p className="text-[10px] text-slate-500">{meal.revenue} ر.ق</p>
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
            أداء المطبخ - آخر 7 أيام
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
              <Bar dataKey="confirmed" name="مؤكد" stackId="a" fill="#3CC4F0" />
              <Bar dataKey="prepared" name="جاهز" stackId="a" fill="#f59e0b" />
              <Bar dataKey="delivered" name="تم التوصيل" stackId="a" fill="#10b981" />
              <Bar dataKey="cancelled" name="ملغي" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
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
