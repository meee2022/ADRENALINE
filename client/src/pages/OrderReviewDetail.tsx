import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "@/../../convex/_generated/dataModel";

const dayNameAr: Record<string, string> = {
  saturday: "السبت",
  sunday: "الأحد",
  monday: "الإثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
};

const categoryNameAr: Record<string, string> = {
  breakfast: "فطور",
  lunch: "غداء",
  dinner: "عشاء",
  snack: "سناك",
  salad: "سلطة",
};

export default function OrderReviewDetail() {
  const [, params] = useRoute("/orders/review/:orderId");
  const [, navigate] = useLocation();
  const orderId = params?.orderId as Id<"customerOrders"> | undefined;

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<Id<"customers"> | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined); // ✅ تاريخ بداية التوصيل

  const orderData = useQuery(
    api.customerOrders.getById,
    orderId ? { orderId } : "skip"
  );
  
  // ✅ جلب قائمة المشتركين للربط
  const customers = useQuery(api.customers.list) || [];

  const approveMutation = useMutation(api.customerOrders.approve);
  const rejectMutation = useMutation(api.customerOrders.reject);

  if (!orderData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const order = orderData;
  const items = orderData.items || [];

  // Group items by week and day
  const groupedByWeek: Record<number, Record<string, typeof items>> = {};
  items.forEach((item) => {
    if (!groupedByWeek[item.week]) {
      groupedByWeek[item.week] = {};
    }
    if (!groupedByWeek[item.week][item.day]) {
      groupedByWeek[item.week][item.day] = [];
    }
    groupedByWeek[item.week][item.day].push(item);
  });

  const weeks = Object.keys(groupedByWeek)
    .map(Number)
    .sort((a, b) => a - b);

  const handleApprove = async () => {
    if (!orderId) return;
    
    // ✅ التحقق من أن تاريخ البداية محدد
    if (!startDate) {
      alert("⚠️ يرجى تحديد تاريخ بداية التوصيل أولاً");
      return;
    }
    
    try {
      await approveMutation({
        orderId,
        customerId: selectedCustomerId || undefined, // ✅ ربط بالمشترك
        startDate: startDate.toISOString().split("T")[0], // ✅ إرسال تاريخ البداية (YYYY-MM-DD)
        notes: approveNotes || undefined,
      });
      alert("✅ تم اعتماد الخطة بنجاح!");
      navigate("/orders/pending");
    } catch (error) {
      console.error(error);
      alert("❌ حدث خطأ أثناء الاعتماد");
    }
  };

  const handleReject = async () => {
    if (!orderId || !rejectReason.trim()) {
      alert("⚠️ يرجى كتابة سبب الرفض");
      return;
    }
    try {
      await rejectMutation({
        orderId,
        reason: rejectReason,
      });
      alert("✅ تم رفض الخطة");
      navigate("/orders/pending");
    } catch (error) {
      console.error(error);
      alert("❌ حدث خطأ أثناء الرفض");
    }
  };

  const createdDate = order.createdAt
    ? format(new Date(order.createdAt), "dd MMMM yyyy - hh:mm a", { locale: ar })
    : "غير محدد";

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Back Button */}
      <Button
        variant="outline"
        onClick={() => navigate("/orders/pending")}
        className="mb-4"
      >
        ← العودة للقائمة
      </Button>

      {/* Subscriber Header Card */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-primary/20">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-white font-bold text-2xl">
              {order.customerName?.[0]?.toUpperCase() || "؟"}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {order.customerName}
              </h2>
              <p className="text-gray-600">{order.customerPhone}</p>
              {order.customerEmail && (
                <p className="text-sm text-gray-500">{order.customerEmail}</p>
              )}
            </div>
          </div>

          <div className="bg-orange-100 text-orange-700 px-6 py-3 rounded-lg font-semibold">
            ⏳ قيد المراجعة
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">رقم الطلب</p>
            <p className="font-bold text-gray-900">{order.orderNumber}</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">إجمالي الوجبات</p>
            <p className="font-bold text-gray-900">{order.totalMeals} وجبة</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">السعرات الكلية</p>
            <p className="font-bold text-gray-900">
              {order.totalCalories.toLocaleString()} سعرة
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">تاريخ الإرسال</p>
            <p className="font-bold text-gray-900 text-sm">{createdDate}</p>
          </div>
        </div>

        {order.notes && (
          <div className="mt-4 p-4 bg-white rounded-lg">
            <p className="text-xs text-gray-500 mb-2">📝 ملاحظات العميل:</p>
            <p className="text-gray-700">{order.notes}</p>
          </div>
        )}
      </Card>

      {/* Weekly Meals Grid */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-900">
          📅 جدول الوجبات المختارة
        </h3>

        {weeks.map((weekNum) => {
          const weekData = groupedByWeek[weekNum];
          const days = Object.keys(weekData);

          return (
            <Card key={weekNum} className="p-6">
              <h4 className="text-xl font-bold text-primary mb-4">
                الأسبوع {weekNum}
              </h4>

              <div className="grid gap-4">
                {days.map((day) => {
                  const dayMeals = weekData[day];
                  const dayCalories = dayMeals.reduce((sum, m) => sum + m.calories, 0);

                  return (
                    <div
                      key={day}
                      className="p-4 bg-gray-50 rounded-lg border-r-4 border-r-primary"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-lg font-bold text-gray-900">
                          {dayNameAr[day] || day}
                        </h5>
                        <span className="text-sm font-semibold text-gray-600">
                          {dayCalories} سعرة
                        </span>
                      </div>

                      <div className="grid md:grid-cols-3 gap-3">
                        {dayMeals.map((meal) => (
                          <div
                            key={meal._id}
                            className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                          >
                            {meal.imageUrl && (
                              <img
                                src={meal.imageUrl}
                                alt={meal.mealNameAr}
                                className="w-full h-32 object-cover"
                              />
                            )}
                            <div className="p-3">
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                                  {categoryNameAr[meal.category] || meal.category}
                                </span>
                                <button
                                  className="text-gray-400 hover:text-primary transition-colors"
                                  title="تعديل الوجبة"
                                >
                                  ✏️
                                </button>
                              </div>
                              <h6 className="font-bold text-gray-900 text-sm mb-1">
                                {meal.mealNameAr}
                              </h6>
                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>{meal.calories} سعرة</span>
                                {meal.protein && (
                                  <span className="text-xs">
                                    🥩 {meal.protein}g بروتين
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Admin Actions */}
      <Card className="p-6 bg-gray-50">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          🔧 إجراءات المراجعة
        </h3>

        <div className="space-y-4">
          {/* ✅ تحديد تاريخ بداية التوصيل (مطلوب) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📅 تاريخ بداية التوصيل <span className="text-red-600">*</span>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {startDate ? (
                    format(startDate, "EEEE، d MMMM yyyy", { locale: ar })
                  ) : (
                    <span>اختر تاريخ البداية...</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  disabled={(date) => date < new Date()}
                  locale={ar}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="mt-2 text-xs text-gray-500">
              💡 حدد اليوم الذي تريد أن يبدأ فيه التوصيل (الأسبوع الأول، اليوم الأول)
            </p>
          </div>

          {/* ✅ ربط الطلب بمشترك موجود */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🔗 ربط بمشترك موجود (اختياري)
            </label>
            <select
              value={selectedCustomerId || ""}
              onChange={(e) => setSelectedCustomerId(e.target.value as Id<"customers"> | "" || null)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              <option value="">-- لا يوجد (عميل جديد) --</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.fullName} ({customer.phone})
                  {customer.allergies ? ` - ⚠️ حساسية: ${customer.allergies}` : ""}
                </option>
              ))}
            </select>
            {selectedCustomerId && customers.find(c => c._id === selectedCustomerId)?.allergies && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800 flex items-center gap-1">
                  <span className="font-bold">⚠️ تنبيه:</span>
                  هذا المشترك لديه حساسية من:{" "}
                  <span className="font-semibold">
                    {customers.find(c => c._id === selectedCustomerId)?.allergies}
                  </span>
                </p>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              💡 يساعد الربط بمشترك موجود في مراعاة الحساسيات والتفضيلات المسجلة مسبقاً
            </p>
          </div>

          {/* Approval Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ملاحظات الاعتماد (اختياري)
            </label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="مثال: تم اعتماد الخطة بعد مراجعة دقيقة من أخصائي التغذية..."
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleApprove}
              className="flex-1 bg-primary hover:bg-primary/90 text-white py-4 text-lg font-bold"
            >
              ✅ اعتماد الخطة
            </Button>

            <Button
              onClick={() => setShowRejectDialog(true)}
              variant="outline"
              className="flex-1 border-red-500 text-red-600 hover:bg-red-50 py-4 text-lg font-bold"
            >
              ❌ رفض الخطة
            </Button>

            <Button
              variant="outline"
              className="px-8 py-4 text-lg font-bold"
            >
              💬 تواصل مع العميل
            </Button>
          </div>
        </div>
      </Card>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              ⚠️ رفض الخطة
            </h3>
            <p className="text-gray-600 mb-4">
              يرجى كتابة سبب الرفض ليتم إرساله للعميل
            </p>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              rows={4}
              placeholder="مثال: الوجبات المختارة تتجاوز السعرات المسموحة..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                onClick={handleReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                تأكيد الرفض
              </Button>
              <Button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectReason("");
                }}
                variant="outline"
                className="flex-1"
              >
                إلغاء
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
