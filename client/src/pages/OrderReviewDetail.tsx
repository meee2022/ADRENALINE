import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/lib/i18n";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Printer } from "lucide-react";
import { printMealPlanCards } from "@/lib/printMealPlan";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
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
const dayNameEn: Record<string, string> = {
  saturday: "Saturday", sunday: "Sunday", monday: "Monday", tuesday: "Tuesday",
  wednesday: "Wednesday", thursday: "Thursday", friday: "Friday",
};
const categoryNameEn: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", salad: "Salad",
};

export default function OrderReviewDetail() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const locale = isRtl ? ar : enUS;
  const dayName = (d: string) => (isRtl ? dayNameAr[d] : dayNameEn[d]) || d;
  const catName = (c: string) => (isRtl ? categoryNameAr[c] : categoryNameEn[c]) || c;
  const [, params] = useRoute("/orders/review/:orderId");
  const [, navigate] = useLocation();
  const orderId = params?.orderId as Id<"customerOrders"> | undefined;

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<Id<"customers"> | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined); // ✅ تاريخ بداية التوصيل
  const [downloadingPlan, setDownloadingPlan] = useState(false);
  // ✅ تواريخ يدوية لـ (week, day) — اختيارية، تطغى على التاريخ المحسوب
  const [dateOverrides, setDateOverrides] = useState<Record<string, Date | undefined>>({});

  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const isAdmin = useStore((s) => s.currentUser?.role) === "ADMIN";

  const orderData = useQuery(
    api.customerOrders.getById,
    orderId ? { orderId, sessionToken } : "skip"
  );

  // ✅ جلب قائمة المشتركين للربط
  const customers = useQuery(api.customers.list, { sessionToken }) || [];

  // ✅ الأسبوع الذي يصادفه تاريخ البداية المختار في دورة المطبخ.
  //    يساعد الأخصائية: تحدد التاريخ فيعرف النظام هيصادف أي أسبوع دورة.
  const startISO = startDate ? startDate.toISOString().split("T")[0] : undefined;
  const rotationInfo = useQuery(
    api.restaurantSettings.rotationWeekAt,
    startISO ? { targetDate: startISO } : "skip"
  ) as { rotationWeek: number; currentCookingWeek: number; fridaysAhead: number } | undefined;

  const approveMutation = useMutation(api.customerOrders.approve);
  const rejectMutation = useMutation(api.customerOrders.reject);
  const swapMealMutation = useMutation(api.customerOrders.updateOrderItemMeal);
  const removeItemMutation = useMutation(api.customerOrders.removeOrderItem);
  const deleteOrderMutation = useMutation(api.customerOrders.deleteOrder);

  // ✅ حذف الطلب نهائياً (أدمن فقط) — لتنظيف التجارب، غير الرفض.
  const handleDeleteOrder = async () => {
    if (!orderId) return;
    const ok = confirm(
      t("⚠️ حذف نهائي للخطة كلها (وأصنافها وأي خطط مطبخ منها). لا يمكن التراجع.\nمتأكد؟",
        "⚠️ Permanently delete the whole plan (its items and any kitchen plans). This can't be undone.\nSure?")
    );
    if (!ok) return;
    try {
      const r: any = await deleteOrderMutation({ orderId: orderId as any, sessionToken });
      if (r?.success) {
        navigate("/orders/pending");
      } else {
        alert(r?.error || t("❌ تعذّر الحذف","❌ Delete failed"));
      }
    } catch (e: any) {
      alert(String(e?.message || e));
    }
  };

  // ✅ املأ تاريخ البداية تلقائياً بما اختاره العميل (الأخصائية تقدر تعدّله)
  useEffect(() => {
    const pref = (orderData as any)?.preferredStartDate;
    if (pref && !startDate) {
      const d = new Date(pref + "T00:00:00");
      if (!isNaN(d.getTime())) setStartDate(d);
    }
  }, [orderData]);

  // تبديل وجبة اقترحها الـAI قبل الاعتماد
  const allMeals: any[] = useQuery(api.publicMeals.listMeals, {}) || [];
  const [swapTarget, setSwapTarget] = useState<any>(null);
  const [swapping, setSwapping] = useState(false);
  const doSwap = async (m: any) => {
    if (!swapTarget) return;
    setSwapping(true);
    try {
      await swapMealMutation({
        sessionToken,
        itemId: swapTarget._id,
        newMealId: m._id,
        newMealNameAr: m.nameAr,
        newMealNameEn: m.nameEn,
        newCalories: m.calories ?? 0,
        newProtein: m.protein ?? 0,
        newCarbs: m.carbs ?? 0,
        newFats: m.fats ?? 0,
        newCategory: m.category ?? swapTarget.category,
        newImageUrl: m.imageUrl,
        newPriceQAR: m.priceQAR ?? m.price ?? swapTarget.priceQAR ?? 0,
      });
      setSwapTarget(null);
    } catch (e) { console.error("swap failed", e); } finally { setSwapping(false); }
  };

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

  // ✅ كل (week, day) من الطلب مرتبة كرونولوجياً (الأسبوع الأول السبت ← الأسبوع 4 الأربعاء)
  const dayOrder: Record<string, number> = {
    saturday: 0, sunday: 1, monday: 2, tuesday: 3, wednesday: 4,
  };
  const allWeekDayKeys: string[] = Array.from(
    new Set(items.map((i) => `${i.week}-${i.day}`))
  ).sort((a, b) => {
    const [wa, da] = a.split("-");
    const [wb, db] = b.split("-");
    const weekDiff = Number(wa) - Number(wb);
    if (weekDiff !== 0) return weekDiff;
    return (dayOrder[da] ?? 99) - (dayOrder[db] ?? 99);
  });

  const handleApprove = async () => {
    if (!orderId) return;

    // ✅ تحويل تواريخ الـ overrides لصيغة { "week-day": "YYYY-MM-DD" }
    const overridesPayload: Record<string, string> = {};
    Object.entries(dateOverrides).forEach(([key, d]) => {
      if (d) overridesPayload[key] = d.toISOString().split("T")[0];
    });

    // ✅ المنطق الجديد:
    //   - الأول يوم في الطلب (week 1, أول يوم) هو "نقطة البداية" (anchor)
    //   - لو الأخصائية حددت تاريخ للأول يوم → ده الـ startDate تلقائياً
    //   - لو startDate الـ explicit موجود → يستخدمه
    //   - لو ولا واحد → تنبيه
    const firstKey = allWeekDayKeys[0];
    const firstDayOverride = overridesPayload[firstKey];

    let effectiveStartDate: string | undefined;
    if (startDate) {
      effectiveStartDate = startDate.toISOString().split("T")[0];
    } else if (firstDayOverride) {
      effectiveStartDate = firstDayOverride;
    }

    if (!effectiveStartDate) {
      alert(
        (isRtl ? `⚠️ يرجى تحديد تاريخ ليوم البداية على الأقل (${firstKey}) أو تحديد تاريخ بداية التوصيل في الأعلى.` : `⚠️ Set a date for at least the first day (${firstKey}) or set the delivery start date above.`)
      );
      return;
    }

    try {
      await approveMutation({
        sessionToken,
        orderId,
        customerId: selectedCustomerId || undefined,
        startDate: effectiveStartDate,
        notes: approveNotes || undefined,
        dateOverrides: Object.keys(overridesPayload).length > 0 ? overridesPayload : undefined,
      });
      // ✅ إرسال رسالة واتساب تلقائية للعميل بعد الاعتماد
      try {
        const { openWhatsApp, WhatsAppTemplates } = await import("@/lib/whatsapp");
        if (order?.customerPhone) {
          const msg = WhatsAppTemplates.orderApproved(
            order.customerName || "عميلنا الكريم",
            order.orderNumber || "",
            effectiveStartDate,
          );
          if (confirm("✅ تم الاعتماد! هل تريد إرسال رسالة واتساب للعميل بالتأكيد؟")) {
            openWhatsApp(order.customerPhone, msg);
          }
        }
      } catch {
        // ignore
      }
      navigate("/orders/pending");
    } catch (error) {
      console.error(error);
      alert("❌ حدث خطأ أثناء الاعتماد");
    }
  };

  const handleReject = async () => {
    if (!orderId || !rejectReason.trim()) {
      alert(t("⚠️ يرجى كتابة سبب الرفض","⚠️ Please write a rejection reason"));
      return;
    }
    try {
      await rejectMutation({
        sessionToken,
        orderId,
        reason: rejectReason,
      });
      // ✅ إرسال رسالة اعتذار للعميل
      try {
        const { openWhatsApp, WhatsAppTemplates } = await import("@/lib/whatsapp");
        if (order?.customerPhone) {
          const msg = WhatsAppTemplates.orderRejected(
            order.customerName || "عميلنا الكريم",
            rejectReason,
          );
          if (confirm(t("هل تريد إرسال رسالة الاعتذار للعميل عبر واتساب؟","Send the apology message to the customer via WhatsApp?"))) {
            openWhatsApp(order.customerPhone, msg);
          }
        }
      } catch {
        // ignore
      }
      navigate("/orders/pending");
    } catch (error) {
      console.error(error);
      alert("❌ حدث خطأ أثناء الرفض");
    }
  };

  const createdDate = (() => {
    const d = order.createdAt ? new Date(order.createdAt) : null;
    return d && !isNaN(d.getTime())
      ? format(d, "dd MMMM yyyy - hh:mm a", { locale })
      : "غير محدد";
  })();

  /** التقرير المرسل للعميل — التصميم الفخم بالصور (نفس شكل المنيو/الخطة الذكية). */
  const handlePrintPlan = async () => {
    if (downloadingPlan) return;
    const linked = customers.find((c: any) => String(c._id) === String(selectedCustomerId));
    const note = [
      linked?.allergies ? `الحساسية: ${linked.allergies}` : "",
      linked?.avoid ? `ممنوعات: ${linked.avoid}` : "",
      linked?.preferences ? `تفضيلات: ${linked.preferences}` : "",
      linked?.portions ? `كميات: ${linked.portions}` : "",
    ]
      .filter(Boolean)
      .join("  •  ");

    const groups = weeks.map((w) => {
      const days = Object.keys(groupedByWeek[w]).sort(
        (a, b) => (dayOrder[a] ?? 99) - (dayOrder[b] ?? 99),
      );
      return {
        title: `${t("الأسبوع (دورة", "Week (cycle")} ${w})`,
        sections: days.map((d) => ({
          title: dayName(d),
          rows: groupedByWeek[w][d].map((it: any, i: number) => ({
            label: String(i + 1),
            category: catName(it.category),
            meal: it.mealNameAr || it.mealNameEn || "-",
            notes: [it.avoid, it.preferences, it.portions, it.specialNotes]
              .map((x) => String(x || "").trim()).filter(Boolean).join(" • "),
            calories: it.calories ?? "",
            protein: it.protein ?? "",
            imageUrl: it.imageUrl || undefined,
          })),
        })),
      };
    });

    const totalMeals = weeks.reduce(
      (s, w) => s + Object.values(groupedByWeek[w]).reduce((a: number, arr: any) => a + arr.length, 0),
      0,
    );

    setDownloadingPlan(true);
    try {
      await printMealPlanCards({
        title: `جدول وجبات — ${order.customerName || "—"}`,
        subtitle: [order.customerPhone, note].filter(Boolean).join("  ·  ") || undefined,
        kpis: [
          { label: "عدد الأسابيع", value: weeks.length },
          { label: "إجمالي الوجبات", value: totalMeals },
        ],
        groups,
      });
    } catch (e: any) {
      alert(t("تعذّر التحميل: ","Download failed: ") + String(e?.message || e));
    } finally {
      setDownloadingPlan(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Back + Print */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button variant="outline" onClick={() => navigate("/orders/pending")}>
          {t("← العودة للقائمة","← Back to list")}
        </Button>
        <Button
          variant="outline"
          onClick={handlePrintPlan}
          disabled={downloadingPlan}
          className="font-bold border-[#3cc4f0] text-[#0E76AC]"
        >
          <Printer className="h-4 w-4 ml-2" />
          {downloadingPlan ? t("جاري تجهيز الملف…","Preparing file…") : t("تنزيل جدول الوجبات PDF","Download meal plan PDF")}
        </Button>
      </div>

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
            <p className="text-xs text-gray-500 mb-1">{t("رقم الطلب","Order No.")}</p>
            <p className="font-bold text-gray-900">{order.orderNumber}</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">{t("إجمالي الوجبات","Total meals")}</p>
            <p className="font-bold text-gray-900">{order.totalMeals} {t("وجبة","meals")}</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">{t("السعرات الكلية","Total calories")}</p>
            <p className="font-bold text-gray-900">
              {order.totalCalories.toLocaleString()} {t("سعرة","kcal")}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">{t("تاريخ الإرسال","Submitted")}</p>
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
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-[#EAF3FB] border border-[#CFE4F3] text-[#0E2A4A] font-black text-lg">
                🗓️ {t("الأسبوع (دورة","Week (cycle")} {weekNum})
              </div>

              <div className="grid gap-5">
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
                      className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2 bg-[#0E2A4A] text-white">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-base font-bold">
                            {dayName(day)}
                          </h5>
                          {effectiveDate && (
                            <span className="text-sm font-semibold opacity-80">
                              · {format(effectiveDate, "d MMM yyyy", { locale })}
                            </span>
                          )}
                          <span className="text-xs bg-white/15 rounded-full px-2.5 py-0.5">
                            {dayMeals.length} وجبة · {dayCalories} سعرة
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
                                    ? "bg-[#3CC4F0] hover:bg-[#2bb0dc] text-white border-transparent"
                                    : "bg-white/10 border-dashed border-white/40 text-white hover:bg-white/20"
                                )}
                              >
                                <CalendarIcon className="h-3 w-3" />
                                {effectiveDate
                                  ? format(effectiveDate, "d MMM", { locale })
                                  : t("تحديد تاريخ","Set date")}
                                {overrideDate && (
                                  <span className="text-[9px] bg-white/25 px-1 rounded">{t("يدوي","manual")}</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <div className="p-3 border-b border-gray-100">
                                <p className="text-xs font-bold text-gray-700">
                                  {t("تاريخ هذا اليوم","Date for this day")}
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  {autoDate ? `${t("الافتراضي","Default")}: ${format(autoDate, "d MMM yyyy", { locale })}` : t("حدّد تاريخ البداية أولاً","Set the start date first")}
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
                                    {t("مسح التاريخ اليدوي (استخدم التلقائي)","Clear manual date (use auto)")}
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div
                        className="grid gap-2.5 p-3"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
                      >
                        {dayMeals.map((meal) => (
                          <div
                            key={meal._id}
                            className="bg-[#F7FBFE] border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                          >
                            <div className="relative">
                              {meal.imageUrl && (
                                <img
                                  src={meal.imageUrl}
                                  alt={meal.mealNameAr}
                                  className="w-full h-24 object-cover"
                                />
                              )}
                              <span className="absolute top-1.5 start-1.5 text-[10px] font-bold text-primary bg-white/90 px-1.5 py-0.5 rounded-md">
                                {catName(meal.category)}
                              </span>
                            </div>
                            <div className="p-2.5 flex flex-col flex-1">
                              <h6 className="font-bold text-gray-900 text-[12.5px] leading-snug mb-1 line-clamp-2">
                                {meal.mealNameAr}
                              </h6>
                              <div className="flex items-center justify-between text-[11px] text-gray-600 mb-2">
                                <span>{meal.calories} سعرة</span>
                                {meal.protein ? <span>🥩 {meal.protein}g</span> : null}
                              </div>
                              <div className="flex items-center justify-end gap-3 mt-auto pt-1.5 border-t border-gray-100">
                                <button
                                  onClick={() => setSwapTarget(meal)}
                                  className="text-gray-400 hover:text-primary transition-colors text-sm"
                                  title="تبديل الوجبة"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`حذف "${meal.mealNameAr}" من الطلب؟`)) return;
                                    try {
                                      await removeItemMutation({ itemId: meal._id, sessionToken });
                                    } catch (e: any) {
                                      alert(e?.message || "تعذّر الحذف");
                                    }
                                  }}
                                  className="text-gray-400 hover:text-red-600 transition-colors text-sm"
                                  title="حذف الوجبة من الطلب"
                                >
                                  🗑️
                                </button>
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
          {/* ✅ ملء سريع — اختياري */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              📅 ملء سريع: تاريخ بداية التوصيل
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {t("اختياري","Optional")}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate ? (
                      format(startDate, "EEEE، d MMMM yyyy", { locale })
                    ) : (
                      <span>{t("اختر تاريخ ابتدائي (يملأ الأيام الفارغة فقط)...","Pick a start date (fills empty days only)...")}</span>
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
              {startDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStartDate(undefined)}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  {t("مسح","Clear")}
                </Button>
              )}
            </div>

            {/* ✅ الأسبوع الذي يصادفه هذا التاريخ في دورة المطبخ */}
            {startDate && rotationInfo && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-center gap-2">
                <span className="text-lg">🗓️</span>
                <span>
                  {t("هذا التاريخ يصادف","This date falls on")} <b>{t("الأسبوع","week")} {rotationInfo.rotationWeek}</b> {t("من دورة المطبخ","of the kitchen cycle")}
                  {rotationInfo.fridaysAhead > 0 && (
                    <span className="text-amber-600">
                      {" "}(المطبخ الآن على الأسبوع {rotationInfo.currentCookingWeek})
                    </span>
                  )}
                  . سيتلقّى العميل وجبات هذا الأسبوع عند بدء توصيله.
                </span>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              💡 <b>{t("طريقة سهلة:","Easy way:")}</b> {t("سيب الحقل ده فاضي وحدد بس تاريخ أول يوم تحت — هيمشي بالترتيب تلقائياً.","Leave this empty and just set the first day's date below — it flows in order automatically.")}
              <br />
              💡 <b>{t("أو:","Or:")}</b> {t("حدد التاريخ هنا ليكون نقطة بداية للأيام بدون تاريخ يدوي.","Set the date here as the starting point for days without a manual date.")}
              <br />
              💡 {t("الأيام اللي حددت ليها تاريخ يدوي تحت بتبقى","Days you set a manual date for below stay")} <b>{t("مستقلة تماماً","fully independent")}</b>.
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
                      title={t("إلغاء الربط واختيار يدوي","Unlink and pick manually")}
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
                  🔗 {t("ربط بمشترك (اختياري)","Link to subscriber (optional)")}
                </label>
                <select
                  value={selectedCustomerId || ""}
                  onChange={(e) => setSelectedCustomerId(e.target.value as Id<"customers"> | "" || null)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="">{t("-- عميل جديد (بدون ربط) --","-- New customer (no link) --")}</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.fullName} ({customer.phone})
                      {customer.allergies ? ` - ⚠️ ${customer.allergies}` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  💡 {t("لم يتم العثور على مشترك مطابق برقم الهاتف. يمكنك اختياره يدوياً.","No subscriber matched this phone. You can pick one manually.")}
                </p>
              </div>
            );
          })()}

          {/* Approval Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t("ملاحظات الاعتماد (اختياري)","Approval notes (optional)")}
            </label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder={t("مثال: تم اعتماد الخطة بعد مراجعة دقيقة من أخصائي التغذية...","e.g. Plan approved after careful nutritionist review...")}
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
              {t("✅ اعتماد الخطة","✅ Approve plan")}
            </Button>

            <Button
              onClick={() => setShowRejectDialog(true)}
              variant="outline"
              className="flex-1 border-red-500 text-red-600 hover:bg-red-50 py-4 text-lg font-bold"
            >
              {t("❌ رفض الخطة","❌ Reject plan")}
            </Button>

            {isAdmin && (
              <Button
                onClick={handleDeleteOrder}
                variant="outline"
                title="حذف نهائي للخطة (للتجربة) — غير الرفض"
                className="px-6 py-4 text-lg font-bold gap-2 border-red-700 text-red-700 bg-red-50 hover:bg-red-100"
              >
                🗑️ حذف نهائي
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                // ✅ استخدم رقم العميل المربوط لو موجود، وإلا من بيانات الطلب
                const linkedCust = ((order as any).customerId || selectedCustomerId)
                  ? customers.find((c) => c._id === ((order as any).customerId || selectedCustomerId))
                  : null;
                const rawPhone = linkedCust?.phone || (order as any).customerPhone || "";
                const phone = String(rawPhone).replace(/\D/g, "");
                if (!phone) {
                  alert("⚠️ رقم الهاتف غير متوفر لهذا العميل");
                  return;
                }
                // تأكد إن الرقم بصيغة دولية (لو رقم قطر بدون code، ضيف 974)
                const fullPhone = phone.startsWith("974") || phone.length > 8 ? phone : `974${phone}`;
                const customerName = linkedCust?.fullName || (order as any).customerName || "";
                const msg = `مرحباً ${customerName} 👋\n\nبخصوص طلبك رقم ${(order as any).orderNumber || ""} في أدرينالين، نود التواصل معك للمراجعة.`;
                const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
                window.open(url, "_blank");
              }}
              className="px-8 py-4 text-lg font-bold gap-2"
            >
              <span style={{ color: "#25D366" }}>●</span>
              {t("💬 تواصل مع العميل","💬 Contact customer")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {t("⚠️ رفض الخطة","⚠️ Reject plan")}
            </h3>
            <p className="text-gray-600 mb-4">
              {t("يرجى كتابة سبب الرفض ليتم إرساله للعميل","Write a rejection reason to send to the customer")}
            </p>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              rows={4}
              placeholder={t("مثال: الوجبات المختارة تتجاوز السعرات المسموحة...","e.g. Selected meals exceed the allowed calories...")}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                onClick={handleReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {t("تأكيد الرفض","Confirm rejection")}
              </Button>
              <Button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectReason("");
                }}
                variant="outline"
                className="flex-1"
              >
                {t("إلغاء","Cancel")}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Meal Swap Dialog */}
      {swapTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSwapTarget(null)}>
          <Card className="p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">🔁 تبديل: <span className="text-primary">{swapTarget.mealNameAr}</span></h3>
              <button onClick={() => setSwapTarget(null)} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{t("اختر وجبة بديلة — ستُحدَّث السعرات والسعر تلقائياً.","Pick a replacement meal — calories and price update automatically.")}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {allMeals
                .slice()
                .sort((a: any, b: any) => (a.category === swapTarget.category ? -1 : 0) - (b.category === swapTarget.category ? -1 : 0))
                .map((m: any) => (
                  <button key={m._id} onClick={() => doSwap(m)} disabled={swapping}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary transition-colors text-right disabled:opacity-50">
                    {m.imageUrl && <img src={m.imageUrl} alt={m.nameAr} className="w-14 h-14 rounded-lg object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-sm truncate">{isRtl ? m.nameAr : (m.nameEn || m.nameAr)}</p>
                      <p className="text-xs text-gray-500">{catName(m.category)} · {m.calories || 0} {t("سعرة","kcal")}{m.priceQAR ? ` · ${m.priceQAR} ${t("ر.ق","QAR")}` : ""}</p>
                    </div>
                  </button>
                ))}
            </div>
            {allMeals.length === 0 && <p className="text-center text-gray-400 py-8">{t("لا توجد وجبات متاحة للتبديل","No meals available to swap")}</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
