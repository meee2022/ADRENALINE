/**
 * @file client/src/pages/public/OrderTracking.tsx
 * @description صفحة تتبع الطلب للعميل - بدون تسجيل دخول، بحث برقم الطلب أو الموبايل
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, CheckCircle2, Clock, ChefHat, Truck, XCircle, Phone } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const STATUS_STEPS = [
  { key: "pending", labelAr: "قيد المراجعة", icon: Clock, color: "#f59e0b" },
  { key: "confirmed", labelAr: "تم التأكيد", icon: CheckCircle2, color: "#3CC4F0" },
  { key: "active", labelAr: "قيد التحضير", icon: ChefHat, color: "#8b5cf6" },
  { key: "completed", labelAr: "تم التوصيل", icon: Truck, color: "#10b981" },
];

export default function OrderTracking() {
  const [searchValue, setSearchValue] = useState("");
  const [searchType, setSearchType] = useState<"phone" | "order">("phone");
  const [submitted, setSubmitted] = useState(false);

  const ordersByPhone = useQuery(
    api.customerOrders.getByPhone,
    submitted && searchType === "phone" && searchValue ? { phone: searchValue } : "skip",
  );
  const orderByNumber = useQuery(
    api.customerOrders.getByOrderNumber,
    submitted && searchType === "order" && searchValue ? { orderNumber: searchValue } : "skip",
  );

  const orders = searchType === "phone"
    ? (ordersByPhone || [])
    : (orderByNumber ? [orderByNumber] : []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    setSubmitted(true);
  };

  return (
    <PublicLayout>
      <div dir="rtl" className="min-h-screen py-10 px-4 bg-gradient-to-br from-cyan-50 via-white to-blue-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Package className="h-14 w-14 text-cyan-600 mx-auto mb-3" />
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800">تتبع طلبك</h1>
            <p className="text-slate-600 mt-2">تابع حالة طلبك بإدخال رقم الجوال أو رقم الطلب</p>
          </div>

          {/* Search form */}
          <Card className="mb-6 shadow-lg">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={searchType === "phone" ? "default" : "outline"}
                    onClick={() => setSearchType("phone")}
                    className="flex-1 gap-2"
                  >
                    <Phone className="h-4 w-4" />
                    رقم الجوال
                  </Button>
                  <Button
                    type="button"
                    variant={searchType === "order" ? "default" : "outline"}
                    onClick={() => setSearchType("order")}
                    className="flex-1 gap-2"
                  >
                    <Package className="h-4 w-4" />
                    رقم الطلب
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={searchType === "phone" ? "مثال: 55123456" : "مثال: ORD-260515-1234"}
                    value={searchValue}
                    onChange={(e) => {
                      setSearchValue(e.target.value);
                      setSubmitted(false);
                    }}
                    className="flex-1"
                    dir="ltr"
                  />
                  <Button type="submit" className="gap-2">
                    <Search className="h-4 w-4" />
                    بحث
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {submitted && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center py-12">
                    <XCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">لم يتم العثور على طلبات</p>
                  </CardContent>
                </Card>
              ) : (
                orders.map((order: any) => (
                  <OrderCard key={order._id} order={order} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

function OrderCard({ order }: { order: any }) {
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {format(new Date(order.createdAt), "dd MMMM yyyy", { locale: ar })}
            </p>
          </div>
          <Badge className={isCancelled ? "bg-red-100 text-red-700" : "bg-cyan-100 text-cyan-700"}>
            {STATUS_STEPS.find((s) => s.key === order.status)?.labelAr || order.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Stepper */}
        {!isCancelled ? (
          <div className="flex items-center justify-between mb-6 relative">
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200 -z-10" />
            {STATUS_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx <= currentStepIdx;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1 z-10 bg-white px-1">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: isActive ? step.color : "#e2e8f0",
                      color: isActive ? "white" : "#94a3b8",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-[10px] font-medium text-center ${
                      isActive ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {step.labelAr}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center mb-4">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="font-bold text-red-700">تم إلغاء الطلب</p>
            {order.rejectionReason && (
              <p className="text-xs text-red-600 mt-1">{order.rejectionReason}</p>
            )}
          </div>
        )}

        {/* Order info */}
        <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t">
          <div>
            <p className="text-xs text-slate-500">عدد الوجبات</p>
            <p className="text-lg font-bold">{order.totalMeals}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">السعرات</p>
            <p className="text-lg font-bold">{order.totalCalories}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">السعر</p>
            <p className="text-lg font-bold text-cyan-600">{order.totalPrice} ر.ق</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
