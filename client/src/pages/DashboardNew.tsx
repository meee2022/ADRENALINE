// client/src/pages/DashboardNew.tsx
/**
 * @file client/src/pages/DashboardNew.tsx
 * @description لوحة التحكم المحسّنة - تصميم نظيف واحترافي + تفاعلي
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useCustomers,
  useDailyPlans,
  useInventorySummary,
} from "@/lib/api";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  CalendarCheck,
  Sun,
  Moon,
  Package,
  AlertTriangle,
  TrendingUp,
  Clock,
  DollarSign,
  ChevronRight,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { format, parseISO, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import { useLanguage } from "@/lib/i18n";

const COLORS = {
  primary: "#3CC4F0",
  secondary: "#47759C",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#8B5CF6",
  pink: "#EC4899",
};

type ModalType = "customers" | "meals" | "morning" | "evening" | "expiring" | "expired" | "inventory" | "monthly" | null;

export default function DashboardNew() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const { data: customers = [] } = useCustomers();
  const { data: dailyPlans = [] } = useDailyPlans();
  const inventorySummary = useInventorySummary();
  const inventoryItems = useQuery(api.inventory.list, {}) || [];

  // Calculate stats
  const stats = useMemo(() => {
    const today = format(selectedDate, "yyyy-MM-dd");
    const todayPlans = dailyPlans.filter((p) => p.date === today);
    
    const morningPlans = todayPlans.filter((p) => p.deliveryTime === "MORNING");
    const eveningPlans = todayPlans.filter((p) => p.deliveryTime === "EVENING");
    
    const activeCustomers = customers.filter((c) => {
      const endDate = parseISO(c.endDate);
      return endDate >= new Date();
    });

    // ✅ الاشتراكات المنتهية (daysLeft < 0)
    const expiredCustomers = customers.filter((c) => {
      const endDate = parseISO(c.endDate);
      const daysLeft = differenceInDays(endDate, new Date());
      return daysLeft < 0;
    });

    // ✅ الاشتراكات القريبة من الانتهاء (0 <= daysLeft <= 3)
    const expiringCustomers = customers.filter((c) => {
      const endDate = parseISO(c.endDate);
      const daysLeft = differenceInDays(endDate, new Date());
      return daysLeft >= 0 && daysLeft <= 3;
    });

    const lowStockItems = inventoryItems.filter(
      (item: any) => item.current_stock <= item.min_stock
    );

    // ✅ إحصائيات الشهر الحالي
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // العملاء الجدد هذا الشهر
    const newCustomersThisMonth = customers.filter((c) => {
      const startDate = parseISO(c.startDate);
      return startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
    });

    // إجمالي الإيرادات المتوقعة (من الأسعار في customers إذا موجودة)
    const monthlyRevenue = customers.reduce((total, c) => {
      // لو في حقل price أو subscription_price
      const price = c.price || c.subscriptionPrice || 0;
      return total + price;
    }, 0);

    return {
      activeCustomers,
      activeCustomersCount: activeCustomers.length,
      todayPlans,
      todayMeals: todayPlans.length,
      morningPlans,
      morningDelivery: morningPlans.length,
      eveningPlans,
      eveningDelivery: eveningPlans.length,
      expiredCustomers,
      expiredCustomersCount: expiredCustomers.length,
      expiringCustomers,
      expiringCustomersCount: expiringCustomers.length,
      inventoryValue: inventorySummary?.stockValueQAR || 0,
      lowStockItems,
      lowStockCount: lowStockItems.length,
      newCustomersThisMonth: newCustomersThisMonth.length,
      monthlyRevenue,
      totalCustomers: customers.length,
    };
  }, [customers, dailyPlans, selectedDate, inventorySummary, inventoryItems]);

  // Weekly data for chart
  const weeklyData = useMemo(() => {
    const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
    return days.map((day, idx) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - idx));
      const dateStr = format(date, "yyyy-MM-dd");
      const count = dailyPlans.filter((p) => p.date === dateStr).length;
      return { name: day, value: count };
    });
  }, [dailyPlans]);

  // Delivery time pie chart data
  const deliveryData = [
    { name: "صباحي", value: stats.morningDelivery, color: COLORS.warning },
    { name: "مسائي", value: stats.eveningDelivery, color: COLORS.purple },
  ];

  // Group meals by name for today
  const mealsSummary = useMemo(() => {
    const mealsCount: Record<string, number> = {};
    stats.todayPlans.forEach((plan) => {
      ["breakfast", "lunch", "dinner", "snack1", "snack2"].forEach((mealType) => {
        const meal = (plan as any)[mealType];
        if (meal) {
          mealsCount[meal] = (mealsCount[meal] || 0) + 1;
        }
      });
    });
    return Object.entries(mealsCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [stats.todayPlans]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">لوحة التحكم</h1>
            <p className="text-sm text-gray-500 mt-1">
              {format(selectedDate, "EEEE، d MMMM yyyy", { locale: ar })}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedDate(newDate);
              }}
            >
              أمس
            </Button>
            <Button
              className="rounded-full bg-[#3CC4F0] hover:bg-[#2ab3df]"
              onClick={() => setSelectedDate(new Date())}
            >
              اليوم
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() + 1);
                setSelectedDate(newDate);
              }}
            >
              غداً
            </Button>
          </div>
        </div>

        {/* Stats Grid - Interactive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Customers */}
          <Card 
            className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-blue-50 to-white"
            onClick={() => setOpenModal("customers")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">المشتركين النشطين</p>
                  <p className="text-3xl font-black text-gray-900 mt-2">{stats.activeCustomersCount}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-blue-500 flex items-center justify-center">
                  <Users className="h-7 w-7 text-white" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-blue-600">
                <span>اضغط للتفاصيل</span>
                <ChevronRight className="h-4 w-4 mr-1" />
              </div>
            </CardContent>
          </Card>

          {/* Today's Meals */}
          <Card 
            className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-green-50 to-white"
            onClick={() => setOpenModal("meals")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">خطط اليوم</p>
                  <p className="text-3xl font-black text-gray-900 mt-2">{stats.todayMeals}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-green-500 flex items-center justify-center">
                  <CalendarCheck className="h-7 w-7 text-white" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-green-600">
                <span>اضغط لعرض الوجبات</span>
                <ChevronRight className="h-4 w-4 mr-1" />
              </div>
            </CardContent>
          </Card>

          {/* Morning Delivery */}
          <Card 
            className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-yellow-50 to-white"
            onClick={() => setOpenModal("morning")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">توصيل صباحي</p>
                  <p className="text-3xl font-black text-gray-900 mt-2">{stats.morningDelivery}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-yellow-500 flex items-center justify-center">
                  <Sun className="h-7 w-7 text-white" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-yellow-700">
                <span>اضغط للتفاصيل</span>
                <ChevronRight className="h-4 w-4 mr-1" />
              </div>
            </CardContent>
          </Card>

          {/* Evening Delivery */}
          <Card 
            className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-purple-50 to-white"
            onClick={() => setOpenModal("evening")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">توصيل مسائي</p>
                  <p className="text-3xl font-black text-gray-900 mt-2">{stats.eveningDelivery}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-purple-500 flex items-center justify-center">
                  <Moon className="h-7 w-7 text-white" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-purple-600">
                <span>اضغط للتفاصيل</span>
                <ChevronRight className="h-4 w-4 mr-1" />
              </div>
            </CardContent>
          </Card>

          {/* Total Customers This Month */}
          <Card 
            className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer bg-gradient-to-br from-teal-50 to-white"
            onClick={() => setOpenModal("monthly")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">عملاء جدد هذا الشهر</p>
                  <p className="text-3xl font-black text-gray-900 mt-2">{stats.newCustomersThisMonth}</p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-teal-500 flex items-center justify-center">
                  <Users className="h-7 w-7 text-white" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-teal-600">
                <span>إجمالي العملاء: {stats.totalCustomers}</span>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card 
            className="border-0 shadow-md hover:shadow-xl transition-all bg-gradient-to-br from-emerald-50 to-white"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">الإيرادات الشهرية</p>
                  <p className="text-3xl font-black text-gray-900 mt-2">
                    {stats.monthlyRevenue.toLocaleString()} ر.ق
                  </p>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">₪</span>
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-emerald-600">
                <span>من {stats.activeCustomersCount} مشترك نشط</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Row: Alerts + Inventory */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscription Status */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                حالة الاشتراكات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div 
                className="flex items-center justify-between p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
                onClick={() => setOpenModal("expired")}
              >
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <span className="text-sm font-medium text-gray-700">اشتراكات منتهية</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-red-600">
                    {stats.expiredCustomersCount}
                  </span>
                  <ChevronRight className="h-4 w-4 text-red-500" />
                </div>
              </div>
              
              <div 
                className="flex items-center justify-between p-4 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors cursor-pointer"
                onClick={() => setOpenModal("expiring")}
              >
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm font-medium text-gray-700">تنتهي اليوم</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-orange-600">
                    {customers.filter(c => {
                      const endDate = parseISO(c.endDate);
                      return format(endDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                    }).length}
                  </span>
                  <ChevronRight className="h-4 w-4 text-orange-500" />
                </div>
              </div>

              <div 
                className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl hover:bg-yellow-100 transition-colors cursor-pointer"
                onClick={() => setOpenModal("expiring")}
              >
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm font-medium text-gray-700">تنتهي خلال 3 أيام</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-yellow-600">{stats.expiringCustomersCount}</span>
                  <ChevronRight className="h-4 w-4 text-yellow-600" />
                </div>
              </div>

              <Button
                onClick={() => setLocation("/customers")}
                className="w-full mt-2 bg-gray-900 hover:bg-gray-800 rounded-xl"
              >
                عرض الكل
              </Button>
            </CardContent>
          </Card>

          {/* Inventory Summary */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-cyan-500" />
                ملخص المخزون
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-cyan-50 rounded-xl">
                <div>
                  <p className="text-xs text-gray-600 mb-1">قيمة المخزون الإجمالية</p>
                  <p className="text-2xl font-black text-cyan-600">
                    {stats.inventoryValue.toFixed(0)} <span className="text-sm">QAR</span>
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-cyan-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div 
                  className="p-4 bg-red-50 rounded-xl text-center hover:bg-red-100 transition-colors cursor-pointer"
                  onClick={() => setOpenModal("inventory")}
                >
                  <p className="text-xs text-gray-600 mb-1">مخزون منخفض</p>
                  <p className="text-2xl font-black text-red-600">{stats.lowStockCount}</p>
                  <ChevronRight className="h-4 w-4 text-red-500 mx-auto mt-1" />
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <p className="text-xs text-gray-600 mb-1">إجمالي الأصناف</p>
                  <p className="text-2xl font-black text-green-600">{inventorySummary?.totalItems || 0}</p>
                </div>
              </div>

              <Button
                onClick={() => setLocation("/inventory")}
                variant="outline"
                className="w-full rounded-xl"
              >
                إدارة المخزون
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Overview */}
          <Card className="border-0 shadow-md lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                نظرة عامة أسبوعية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Delivery Distribution */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                توزيع وجبات اليوم
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={deliveryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {deliveryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-3xl font-black text-gray-900">{stats.todayMeals}</p>
                  <p className="text-xs text-gray-500">اليوم</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {/* Active Customers Modal */}
      <Dialog open={openModal === "customers"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent 
          className="max-w-5xl bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200" 
          aria-describedby="customers-dialog-description"
        >
          <DialogHeader className="border-b-2 border-blue-300 pb-4">
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-between">
              <span className="text-blue-700">المشتركين النشطين</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-2 rounded-xl shadow-lg">
                <span className="text-2xl font-bold">{stats.activeCustomersCount}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div id="customers-dialog-description" className="max-h-[70vh] overflow-auto space-y-3 p-4">
            {stats.activeCustomers.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl font-bold text-gray-500">لا يوجد عملاء نشطين</p>
              </div>
            ) : (
              stats.activeCustomers.map((customer: any, idx: number) => {
                const daysLeft = differenceInDays(parseISO(customer.endDate), new Date());
                return (
                  <div
                    key={customer._id ?? idx}
                    className="bg-white rounded-xl px-5 py-4 shadow-sm border border-blue-100
                               flex items-center justify-between gap-4 hover:shadow-md transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1 font-medium">العميل</p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {customer.fullName || customer.name || "بدون اسم"}
                      </p>
                    </div>
                    <div className="w-40">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الهاتف</p>
                      <p className="text-sm font-semibold text-blue-700" dir="ltr">
                        {customer.phone || "-"}
                      </p>
                    </div>
                    <div className="w-40">
                      <p className="text-xs text-gray-500 mb-1 font-medium">البرنامج</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {customer.program || "-"}
                      </p>
                    </div>
                    <div className="w-32 text-center">
                      <p className="text-xs text-gray-500 mb-1 font-medium">ينتهي بعد</p>
                      <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-green-500 to-green-600">
                        {daysLeft} {daysLeft === 1 ? "يوم" : "أيام"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Meals Summary Modal */}
      <Dialog open={openModal === "meals"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent 
          className="max-w-5xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200" 
          aria-describedby="meals-dialog-description"
        >
          <DialogHeader className="border-b-2 border-green-300 pb-4">
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-between">
              <span className="text-green-700">خطط اليوم ({format(selectedDate, "yyyy-MM-dd")})</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-2 rounded-xl shadow-lg">
                <span className="text-2xl font-bold">{stats.todayMeals}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div id="meals-dialog-description" className="max-h-[70vh] overflow-auto space-y-3 p-4">
            {stats.todayPlans.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl font-bold text-gray-500">لا توجد خطط لهذا اليوم</p>
              </div>
            ) : (
              stats.todayPlans.map((plan: any, idx: number) => {
                const customer = customers.find((c: any) => c._id === plan.customerId);
                return (
                  <div
                    key={plan._id ?? idx}
                    className="bg-white rounded-xl px-5 py-4 shadow-sm border border-green-100
                               flex items-center justify-between gap-4 hover:shadow-md transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1 font-medium">العميل</p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {customer?.fullName || plan.customerName || "عميل جديد"}
                      </p>
                    </div>
                    <div className="w-32">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الهاتف</p>
                      <p className="text-sm font-semibold text-green-700" dir="ltr">
                        {customer?.phone || "-"}
                      </p>
                    </div>
                    <div className="w-32 text-center">
                      <p className="text-xs text-gray-500 mb-1 font-medium">وقت التوصيل</p>
                      <div className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold text-white ${
                        plan.deliveryTime === "MORNING" 
                          ? "bg-gradient-to-r from-amber-500 to-orange-500" 
                          : "bg-gradient-to-r from-indigo-500 to-purple-500"
                      }`}>
                        {plan.deliveryTime === "MORNING" ? "صباحي" : "مسائي"}
                      </div>
                    </div>
                    <div className="w-24 text-center">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الحالة</p>
                      <div className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold ${
                        plan.status === "CONFIRMED" 
                          ? "bg-blue-100 text-blue-700" 
                          : plan.status === "PREPARED" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {plan.status === "CONFIRMED" ? "مؤكد" : plan.status === "PREPARED" ? "جاهز" : plan.status}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Morning Delivery Modal */}
      <Dialog open={openModal === "morning"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent 
          className="max-w-5xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200" 
          aria-describedby="morning-dialog-description"
        >
          <DialogHeader className="border-b-2 border-amber-300 pb-4">
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-between">
              <span className="text-amber-700">توصيل صباحي</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-2 rounded-xl shadow-lg">
                <span className="text-2xl font-bold">{stats.morningDelivery}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div id="morning-dialog-description" className="max-h-[70vh] overflow-auto space-y-3 p-4">
            {stats.morningPlans.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl font-bold text-gray-500">لا توجد خطط صباحية</p>
              </div>
            ) : (
              stats.morningPlans.map((plan: any, idx: number) => {
                const customer = customers.find((c: any) => c._id === plan.customerId);
                return (
                  <div
                    key={plan._id ?? idx}
                    className="bg-white rounded-xl px-5 py-4 shadow-sm border border-amber-100
                               flex items-center justify-between gap-4 hover:shadow-md transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1 font-medium">العميل</p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {customer?.fullName || customer?.name || plan.customerName || "عميل جديد"}
                      </p>
                    </div>
                    <div className="w-40">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الهاتف</p>
                      <p className="text-sm font-semibold text-amber-700" dir="ltr">
                        {customer?.phone || "-"}
                      </p>
                    </div>
                    <div className="w-48">
                      <p className="text-xs text-gray-500 mb-1 font-medium">العنوان</p>
                      <p className="text-sm text-gray-700 truncate">
                        {customer?.address || "-"}
                      </p>
                    </div>
                    <div className="w-24 text-center">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الحالة</p>
                      <div className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold ${
                        plan.status === "CONFIRMED" 
                          ? "bg-blue-100 text-blue-700" 
                          : plan.status === "PREPARED" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {plan.status === "CONFIRMED" ? "مؤكد" : plan.status === "PREPARED" ? "جاهز" : plan.status}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Evening Delivery Modal */}
      <Dialog open={openModal === "evening"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent 
          className="max-w-5xl bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200" 
          aria-describedby="evening-dialog-description"
        >
          <DialogHeader className="border-b-2 border-indigo-300 pb-4">
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-between">
              <span className="text-indigo-700">توصيل مسائي</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-2 rounded-xl shadow-lg">
                <span className="text-2xl font-bold">{stats.eveningDelivery}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div id="evening-dialog-description" className="max-h-[70vh] overflow-auto space-y-3 p-4">
            {stats.eveningPlans.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl font-bold text-gray-500">لا توجد خطط مسائية</p>
              </div>
            ) : (
              stats.eveningPlans.map((plan: any, idx: number) => {
                const customer = customers.find((c: any) => c._id === plan.customerId);
                return (
                  <div
                    key={plan._id ?? idx}
                    className="bg-white rounded-xl px-5 py-4 shadow-sm border border-indigo-100
                               flex items-center justify-between gap-4 hover:shadow-md transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1 font-medium">العميل</p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {customer?.fullName || customer?.name || plan.customerName || "عميل جديد"}
                      </p>
                    </div>
                    <div className="w-40">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الهاتف</p>
                      <p className="text-sm font-semibold text-indigo-700" dir="ltr">
                        {customer?.phone || "-"}
                      </p>
                    </div>
                    <div className="w-48">
                      <p className="text-xs text-gray-500 mb-1 font-medium">العنوان</p>
                      <p className="text-sm text-gray-700 truncate">
                        {customer?.address || "-"}
                      </p>
                    </div>
                    <div className="w-24 text-center">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الحالة</p>
                      <div className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold ${
                        plan.status === "CONFIRMED" 
                          ? "bg-blue-100 text-blue-700" 
                          : plan.status === "PREPARED" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {plan.status === "CONFIRMED" ? "مؤكد" : plan.status === "PREPARED" ? "جاهز" : plan.status}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expiring Customers Modal */}
      <Dialog open={openModal === "expiring"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent 
          className="max-w-5xl bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200" 
          aria-describedby="expiring-dialog-description"
        >
          <DialogHeader className="border-b-2 border-cyan-300 pb-4">
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-between">
              <span className="text-cyan-700">اشتراكات تنتهي قريباً</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-2 rounded-xl shadow-lg">
                <span className="text-2xl font-bold">{stats.expiringCustomersCount}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div id="expiring-dialog-description" className="max-h-[70vh] overflow-auto space-y-3 p-4">
            {stats.expiringCustomers.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl font-bold text-gray-500">
                  لا يوجد عملاء في هذه الفئة
                </p>
              </div>
            ) : (
              stats.expiringCustomers.map((customer: any, idx: number) => {
                const daysLeft = differenceInDays(parseISO(customer.endDate), new Date());
                return (
                  <div
                    key={customer._id ?? idx}
                    className="bg-white rounded-xl px-5 py-4 shadow-sm border border-cyan-100
                               flex items-center justify-between gap-4 hover:shadow-md
                               transition-all"
                  >
                    {/* الاسم */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1 font-medium">العميل</p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {customer.fullName || customer.name || "بدون اسم"}
                      </p>
                    </div>

                    {/* الجوال */}
                    <div className="w-40">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الهاتف</p>
                      <p className="text-sm font-semibold text-cyan-700" dir="ltr">
                        {customer.phone || "-"}
                      </p>
                    </div>

                    {/* تاريخ الانتهاء */}
                    <div className="w-40">
                      <p className="text-xs text-gray-500 mb-1 font-medium">تاريخ الانتهاء</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {format(parseISO(customer.endDate), "yyyy-MM-dd")}
                      </p>
                    </div>

                    {/* المتبقي */}
                    <div className="w-32 text-center">
                      <p className="text-xs text-gray-500 mb-1 font-medium">المتبقي</p>
                      <div
                        className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold text-white ${
                          daysLeft < 0
                            ? "bg-gradient-to-r from-red-500 to-red-600"
                            : daysLeft === 0
                            ? "bg-gradient-to-r from-orange-500 to-orange-600"
                            : daysLeft === 1
                            ? "bg-gradient-to-r from-amber-500 to-amber-600"
                            : "bg-gradient-to-r from-green-500 to-green-600"
                        }`}
                      >
                        {daysLeft < 0
                          ? "منتهي"
                          : daysLeft === 0
                          ? "اليوم"
                          : daysLeft === 1
                          ? "غدًا"
                          : `${daysLeft} يوم`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expired Customers Modal (الاشتراكات المنتهية) */}
      <Dialog open={openModal === "expired"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent 
          className="max-w-5xl bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200" 
          aria-describedby="expired-dialog-description"
        >
          <DialogHeader className="border-b-2 border-red-300 pb-4">
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-between">
              <span className="text-red-700">اشتراكات منتهية</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-2 rounded-xl shadow-lg">
                <span className="text-2xl font-bold">{stats.expiredCustomersCount}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div id="expired-dialog-description" className="max-h-[70vh] overflow-auto space-y-3 p-4">
            {stats.expiredCustomers.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl font-bold text-gray-500">
                  لا يوجد عملاء في هذه الفئة
                </p>
              </div>
            ) : (
              stats.expiredCustomers.map((customer: any, idx: number) => {
                const daysLeft = differenceInDays(parseISO(customer.endDate), new Date());
                return (
                  <div
                    key={customer._id ?? idx}
                    className="bg-white rounded-xl px-5 py-4 shadow-sm border border-red-100
                               flex items-center justify-between gap-4 hover:shadow-md
                               transition-all"
                  >
                    {/* الاسم */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1 font-medium">العميل</p>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {customer.fullName || customer.name || "بدون اسم"}
                      </p>
                    </div>

                    {/* الجوال */}
                    <div className="w-40">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الهاتف</p>
                      <p className="text-sm font-semibold text-red-700" dir="ltr">
                        {customer.phone || "-"}
                      </p>
                    </div>

                    {/* تاريخ الانتهاء */}
                    <div className="w-40">
                      <p className="text-xs text-gray-500 mb-1 font-medium">تاريخ الانتهاء</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {format(parseISO(customer.endDate), "yyyy-MM-dd")}
                      </p>
                    </div>

                    {/* المتبقي */}
                    <div className="w-32 text-center">
                      <p className="text-xs text-gray-500 mb-1 font-medium">الحالة</p>
                      <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-red-500 to-red-600">
                        منتهي منذ {Math.abs(daysLeft)} {Math.abs(daysLeft) === 1 ? "يوم" : "أيام"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Low Stock Inventory Modal */}
      <Dialog open={openModal === "inventory"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>مخزون منخفض ({stats.lowStockCount})</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {stats.lowStockItems.map((item: any) => (
              <div key={item._id} className="p-4 bg-red-50 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">{item.name_ar}</p>
                  <p className="text-sm text-gray-600">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-red-600">{item.current_stock} {item.unit}</p>
                  <p className="text-xs text-gray-500">الحد الأدنى: {item.min_stock}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Customers This Month Modal */}
      <Dialog open={openModal === "monthly"} onOpenChange={() => setOpenModal(null)}>
        <DialogContent 
          className="max-w-5xl bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-teal-200" 
          aria-describedby="monthly-dialog-description"
        >
          <DialogHeader className="border-b-2 border-teal-300 pb-4">
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-between">
              <span className="text-teal-700">العملاء الجدد هذا الشهر</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-2 rounded-xl shadow-lg">
                <span className="text-2xl font-bold">{stats.newCustomersThisMonth}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div id="monthly-dialog-description" className="max-h-[70vh] overflow-auto space-y-3 p-4">
            {customers.filter((c: any) => {
              const startDate = parseISO(c.startDate);
              const currentMonth = new Date().getMonth();
              const currentYear = new Date().getFullYear();
              return startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
            }).length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl font-bold text-gray-500">لا يوجد عملاء جدد هذا الشهر</p>
              </div>
            ) : (
              customers.filter((c: any) => {
                const startDate = parseISO(c.startDate);
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                return startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
              }).map((customer: any, idx: number) => (
                <div
                  key={customer._id ?? idx}
                  className="bg-white rounded-xl px-5 py-4 shadow-sm border border-teal-100
                             flex items-center justify-between gap-4 hover:shadow-md transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1 font-medium">العميل</p>
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {customer.fullName || customer.name || "بدون اسم"}
                    </p>
                  </div>
                  <div className="w-40">
                    <p className="text-xs text-gray-500 mb-1 font-medium">الهاتف</p>
                    <p className="text-sm font-semibold text-teal-700" dir="ltr">
                      {customer.phone || "-"}
                    </p>
                  </div>
                  <div className="w-40">
                    <p className="text-xs text-gray-500 mb-1 font-medium">تاريخ الاشتراك</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {format(parseISO(customer.startDate), "yyyy-MM-dd")}
                    </p>
                  </div>
                  <div className="w-32 text-center">
                    <p className="text-xs text-gray-500 mb-1 font-medium">البرنامج</p>
                    <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-500">
                      {customer.program || "غير محدد"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
