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
  // ✅ تواريخ يدوية لـ (week, day) — اختيارية، تطغى على التاريخ المحسوب
  const [dateOverrides, setDateOverrides] = useState<Record<string, Date | undefined>>({});

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
    
    // ✅ تحويل تواريخ الـ overrides لصيغة { "week-day": "YYYY-MM-DD" }
    const overridesPayload: Record<string, string> = {};
    Object.entries(dateOverrides).forEach(([key, d]) => {
      if (d) overridesPayload[key] = d.toISOString().split("T")[0];
    });

    try {
      await approveMutation({
        orderId,
        customerId: selectedCustomerId || undefined, // ✅ ربط بالمشترك
        startDate: startDate.toISOString().split("T")[0], // ✅ إرسال تاريخ البداية (YYYY-MM-DD)
        notes: approveNotes || undefined,
        dateOverrides: Object.keys(overridesPayload).length > 0 ? overridesPayload : undefined,
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
                  const overrideKey = `${weekNum}-${day}`;
                  const overrideDate = dateOverrides[overrideKey];

                  // احسب التاريخ التلقائي (لو كان فيه startDate)
                  const dayOffsetMap: Record<string, number> = {
                    saturday: 0, sunday: 1, monday: 2, tuesday: 3, wednesday: 4,
                  };
                  let autoDate: Date | null = null;
                  if (startDate) {
                    autoDate = new Date(startDate);
                    autoDate.setDate(autoDate.getDate() + (weekNum - 1) * 6 + (dayOffsetMap[day] ?? 0));
                  }
                  const effectiveDate = overrideDate || autoDate;

                  return (
                    <div
                      key={day}
                      className="p-4 bg-gray-50 rounded-lg border-r-4 border-r-primary"
                    >
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <h5 className="text-lg font-bold text-gray-900">
                            {dayNameAr[day] || day}
                          </h5>
                          <span className="text-sm font-semibold text-gray-600">
                            {dayCalories} سعرة
                          </span>
                        </div>

                        {/* ✅ Date override picker for this specific day */}
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={overrideDate ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "h-8 text-xs gap-1.5",
                                  overrideDate
                                    ? "bg-[#3CC4F0] hover:bg-[#2bb0dc] text-white"
                                    : "border-dashed border-gray-300 text-gray-600 hover:border-[#3CC4F0]"
                                )}
                              >
                                <CalendarIcon className="h-3 w-3" />
                                {effectiveDate
                                  ? format(effectiveDate, "d MMM", { locale: ar })
                                  : "تحديد تاريخ"}
                                {overrideDate && (
                                  <span className="text-[9px] bg-white/25 px-1 rounded">يدوي</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <div className="p-3 border-b border-gray-100">
                                <p className="text-xs font-bold text-gray-700">
                                  تاريخ هذا اليوم
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  {autoDate ? `الافتراضي: ${format(autoDate, "d MMM yyyy", { locale: ar })}` : "حدّد تاريخ البداية أولاً"}
                                </p>
                              </div>
                              <Calendar
                                mode="single"
                                selected={overrideDate}
                                onSelect={(d) =>
                                  setDateOverrides((prev) => ({ ...prev, [overrideKey]: d }))
                                }
                                locale={ar}
                                initialFocus
                              />
                              {overrideDate && (
                                <div className="p-2 border-t border-gray-100">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setDateOverrides((prev) => {
                                        const next = { ...prev };
                                        delete next[overrideKey];
                                        return next;
                                      })
                                    }
                                    className="w-full h-7 text-[11px] text-gray-500 hover:text-red-600"
                                  >
                                    مسح التاريخ اليدوي (استخدم التلقائي)
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
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

          {/* ✅ ربط الطلب بمشترك */}
          {(() => {
            // الربط الفعلي: إما من الطلب نفسه (auto-link) أو اختيار يدوي
            const linkedId = (order as any).customerId || selectedCustomerId;
            const linkedCustomer = linkedId
              ? customers.find((c) => c._id === linkedId)
              : null;

            // الحالة 1: الطلب مربوط تلقائياً بمشترك موجود
            if (linkedCustomer) {
              return (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🔗 المشترك المربوط
                  </label>
                  <div className="rounded-xl p-4 flex items-start gap-3"
                    style={{
                      background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
                      border: "1.5px solid #a7f3d0",
                    }}>
                    <div className="h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black"
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                      {linkedCustomer.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-black text-emerald-900 truncate">{linkedCustomer.fullName}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                          ✓ مربوط تلقائياً
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800" dir="ltr">📞 {linkedCustomer.phone}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        {linkedCustomer.program && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-700">
                            {linkedCustomer.program}
                          </span>
                        )}
                        {linkedCustomer.mealsPerDay != null && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-700">
                            {linkedCustomer.mealsPerDay} وجبات/يوم
                          </span>
                        )}
                        {linkedCustomer.allergies && (
                          <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 font-bold">
                            ⚠ حساسية: {linkedCustomer.allergies}
                          </span>
                        )}
                        {linkedCustomer.avoid && (
                          <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 font-bold">
                            ✕ ممنوع: {linkedCustomer.avoid}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCustomerId(null)}
                      className="text-xs text-gray-500 hover:text-red-600 hover:underline whitespace-nowrap"
                      title="إلغاء الربط واختيار يدوي"
                    >
                      تغيير
                    </button>
                  </div>
                </div>
              );
            }

            // الحالة 2: الطلب غير مربوط — اعرض dropdown يدوي
            return (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🔗 ربط بمشترك (اختياري)
                </label>
                <select
                  value={selectedCustomerId || ""}
                  onChange={(e) => setSelectedCustomerId(e.target.value as Id<"customers"> | "" || null)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="">-- عميل جديد (بدون ربط) --</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.fullName} ({customer.phone})
                      {customer.allergies ? ` - ⚠️ ${customer.allergies}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  💡 لم يتم العثور على مشترك مطابق برقم الهاتف. يمكنك اختياره يدوياً.
                </p>
              </div>
            );
          })()}

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
