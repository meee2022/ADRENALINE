import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function OrdersPending() {
  const [, navigate] = useLocation();
  const pendingOrders = useQuery(api.customerOrders.list, { status: "pending" });
  const pendingCount = useQuery(api.customerOrders.countPending);

  if (!pendingOrders) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalPending = pendingCount || pendingOrders.length;
  const progressPercentage = totalPending > 0 ? ((totalPending - pendingOrders.length) / totalPending) * 100 : 0;

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        icon={<ClipboardList className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="مراجعة الطلبات المعلقة" titleEn="Pending Orders Review"
        subtitleAr="قائمة المشتركين الذين أرسلوا جداولهم الأسبوعية وينتظرون الاعتماد"
        subtitleEn="Subscribers who submitted their weekly plans awaiting approval"
        kpis={[
          { value: pendingOrders.length, labelAr: "قيد المراجعة", labelEn: "Pending" },
          { value: `${Math.round(progressPercentage)}%`, labelAr: "التقدم", labelEn: "Progress" },
        ]}
      />

      {/* Progress Bar */}
      <Card
        className="p-6 bg-white rounded-2xl"
        style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              التقدم اليومي
            </h3>
            <p className="text-sm text-gray-500">
              {pendingOrders.length} طلب ينتظر المراجعة
            </p>
          </div>
          <div className="text-3xl font-black tabular-nums text-[#0E76AC]">
            {Math.round(progressPercentage)}%
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%`, background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}
          />
        </div>
      </Card>

      {/* Orders List */}
      {pendingOrders.length === 0 ? (
        <Card
          className="p-12 text-center bg-white rounded-2xl"
          style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}
        >
          <div className="h-16 w-16 mx-auto rounded-2xl bg-[#e8f8fd] flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-[#3cc4f0]" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            رائع! لا توجد طلبات معلقة
          </h3>
          <p className="text-gray-500">
            تم مراجعة جميع الطلبات
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingOrders.map((order) => {
            const createdDate = (() => {
              const d = order.createdAt ? new Date(order.createdAt) : null;
              return d && !isNaN(d.getTime())
                ? format(d, "dd MMMM yyyy - hh:mm a", { locale: ar })
                : "غير محدد";
            })();

            return (
              <Card
                key={order._id}
                className="p-6 bg-white rounded-2xl cursor-pointer hover:-translate-y-0.5 transition-all"
                style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}
                onClick={() => navigate(`/orders/review/${order._id}`)}
              >
                <div className="flex items-start justify-between">
                  {/* Right Side - Customer Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
                        {order.customerName?.[0]?.toUpperCase() || "؟"}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          {order.customerName}
                          {order.notes?.includes("مولّد الوجبات الذكي") && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ background: "linear-gradient(135deg,#3AC7F4,#0E76AC)" }}>
                              ✨ خطة ذكية — راجِع
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {order.customerPhone}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">رقم الطلب</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {order.orderNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">عدد الوجبات</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {order.totalMeals} وجبة
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">السعرات الكلية</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {order.totalCalories.toLocaleString()} سعرة
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">تاريخ الإرسال</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {createdDate}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Left Side - Status Badge */}
                  <div className="mr-4">
                    <div className="bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full font-semibold text-sm whitespace-nowrap">
                      قيد المراجعة
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">ملاحظات العميل:</p>
                    <p className="text-sm text-gray-700">{order.notes}</p>
                  </div>
                )}

                {/* Action Hint */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-[#47759c] font-semibold text-center">
                    اضغط للمراجعة التفصيلية
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
