import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronRight, ChevronDown, Package, Calendar, Trash2, Pencil } from "lucide-react";
import { useCartStore } from "@/lib/cartStore";
import { useLanguage } from "@/lib/i18n";
import { getVerifiedPhone } from "@/lib/customerIdentity";
import { subscriptionShortfall, orderedSubscriptionSlots } from "@/lib/subscription";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

const dayNameAr: Record<string, string> = {
  saturday: "السبت",
  sunday: "الأحد",
  monday: "الإثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  // ⚠️ الخميس والجمعة: أيام إجازة
};
const dayNameEn: Record<string, string> = {
  saturday: "Saturday", sunday: "Sunday", monday: "Monday",
  tuesday: "Tuesday", wednesday: "Wednesday",
};

const categoryNameAr: Record<string, string> = {
  breakfast: "الإفطار",
  lunch: "الغداء",
  dinner: "العشاء",
  snack: "سناك",
  salad: "سلطة",
};
const categoryNameEn: Record<string, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", salad: "Salad",
};

export default function OrderReview() {
  const [, setLocation] = useLocation();
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const dayName = (d: string) => isRtl ? (dayNameAr[d] || d) : (dayNameEn[d] || d);
  const catName = (c: string) => isRtl ? (categoryNameAr[c] || c) : (categoryNameEn[c] || c);
  
  // Cart Store
  const {
    items: selectedMeals,
    getTotalMeals,
    getTotalCalories,
    getWeeks,
    clearCart,
    removeItem,
    preferredStartDate,
  } = useCartStore();
  
  // بيانات العميل — نملأ الرقم تلقائياً من الذي أدخله في المنيو
  const [customerName, setCustomerName] = useState("");
  // ✅ الرقم يُملأ تلقائياً من الرقم الذي أكّده العميل في المنيو. كان يُقرأ من
  //    localStorage مباشرةً، لكن المنيو يحفظه في sessionStorage (getVerifiedPhone)
  //    — نفس المفتاح، تخزين مختلف، فلم يُملأ. نقرأ من نفس المصدر الآن.
  const [customerPhone, setCustomerPhone] = useState<string>(() => getVerifiedPhone());
  // الرقم المتحقق من المنيو (ثابت) — لو موجود يُعبّأ تلقائياً ولا يُطلب من العميل كتابته.
  const verifiedPhone = getVerifiedPhone();
  const [customerEmail, setCustomerEmail] = useState("");
  
  // Convex Mutation & Query (بعد تعريف customerPhone)
  const createOrder = useMutation(api.customerOrders.create);
  // ✅ استعلام عام بحقول محدودة (بلا عنوان/سعر/ملاحظات).
  //    العائلات قد تتشارك رقماً واحداً، فنأخذ أول مطابق كما كان السلوك سابقاً.
  const matchesByPhone = useQuery(
    api.customers.findPublicByPhone,
    customerPhone ? { phone: customerPhone } : "skip"
  );
  const findCustomerByPhone = matchesByPhone?.[0] ?? null;
  const settings = useQuery(api.restaurantSettings.get);
  const [expandedWeeks, setExpandedWeeks] = useState<number[]>([1]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🔒 بوابة مطابقة الاشتراك — المصدر الوحيد (lib/subscription.subscriptionShortfall).
  //    القاعدة (صارمة، طلب المستخدم): العميل يجب أن يُكمل **كل أيام اشتراكه** (كل يوم
  //    = mealsPerDay رئيسية + snacksPerDay سناك) قبل الإرسال. يومٌ ناقص أو غائب → نقص
  //    ويُمنع الإرسال مع «أكمل وجباتك». نفس سلوتات المنيو (orderedSubscriptionSlots +
  //    نفس أسبوع الدورة من rotationWeekAt) فلا يفترقان. لا يغيّر أي قيد قائم — فحص فقط.
  const subStartDate = (findCustomerByPhone as any)?.startDate as string | undefined;
  const subEndDate = (findCustomerByPhone as any)?.endDate as string | undefined;
  const rotationInfo = useQuery(
    api.restaurantSettings.rotationWeekAt,
    subStartDate ? { targetDate: subStartDate } : "skip",
  ) as any;
  const startRotForSub = Number(rotationInfo?.rotationWeek) || 1;
  const subSlots = orderedSubscriptionSlots(subStartDate, subEndDate, startRotForSub);
  const shortfall = subscriptionShortfall(
    selectedMeals,
    subSlots,
    Number(findCustomerByPhone?.mealsPerDay) || 0,
    Number(findCustomerByPhone?.snacksPerDay) || 0,
  );
  const isShort = shortfall.mealsShort > 0 || shortfall.snacksShort > 0;
  const specialistPhone = (settings?.phone || "+97412345678").replace(/\D/g, "");
  const specialistLink = () => {
    const parts: string[] = [];
    if (shortfall.mealsShort) parts.push(`${shortfall.mealsShort} ${t("وجبة رئيسية", "main meals")}`);
    if (shortfall.snacksShort) parts.push(`${shortfall.snacksShort} ${t("سناك", "snacks")}`);
    const who = findCustomerByPhone?.fullName || customerName || customerPhone;
    const msg = t(
      `مرحباً، معي اشتراك باسم ${who} والخطة التي اخترتها ناقصة ${parts.join(" و ")} عن اشتراكي. أرجو المساعدة في مطابقة الوجبات.`,
      `Hi, my subscription is under ${who} and my selected plan is short by ${parts.join(" and ")} versus my subscription. Please help me match the meals.`,
    );
    return `https://wa.me/${specialistPhone}?text=${encodeURIComponent(msg)}`;
  };
  
  // 🔒 لا نملأ الاسم تلقائياً — سرية: قد يكون جهازاً/رقماً مشتركاً بين عائلة،
  //    فإظهار اسم صاحب الحساب يكشف هويته لغيره. الرقم يكفي: الطلب يُربط بالحساب
  //    عبر customerId، والاسم يُرسَل للطاقم عند التأكيد (لا يظهر في شاشة العميل).

  // Computed values from cart
  const totalMeals = getTotalMeals();
  const totalCalories = getTotalCalories();
  const weeks = getWeeks();
  const totalWeeks = weeks.length;

  // تنظيم الوجبات حسب الأسبوع واليوم
  const organizedMeals = selectedMeals.reduce((acc, meal) => {
    if (!acc[meal.week]) acc[meal.week] = {};
    if (!acc[meal.week][meal.day]) acc[meal.week][meal.day] = [];
    acc[meal.week][meal.day].push(meal);
    return acc;
  }, {} as Record<number, Record<string, typeof selectedMeals>>);

  const toggleWeek = (week: number) => {
    setExpandedWeeks((prev) =>
      prev.includes(week) ? prev.filter((w) => w !== week) : [...prev, week]
    );
  };

  const handleSubmit = async () => {
    if (!customerPhone) {
      alert(t("يرجى إدخال رقم الجوال", "Please enter your phone number"));
      return;
    }
    // الاسم مطلوب فقط لو لا حساب مربوط بالرقم؛ المربوط يكفيه customerId.
    if (!customerName && !findCustomerByPhone) {
      alert(t("يرجى إدخال الاسم", "Please enter your name"));
      return;
    }

    if (selectedMeals.length === 0) {
      alert(t("يرجى اختيار وجبات أولاً", "Please select meals first"));
      return;
    }

    // 🔒 مطابقة الاشتراك: لازم يُكمل كل أيام اشتراكه قبل الإرسال.
    if (isShort) {
      alert(t(
        "خطتك غير مكتملة. أكمل باقي وجبات أيام اشتراكك أولاً لتأكيد الخطة وإرسالها.",
        "Your plan is incomplete. Please complete the rest of your subscription days before confirming and sending.",
      ));
      return;
    }

    setIsSubmitting(true);
    // 🔒 مفتاح idempotency فريد لكل محاولة (لو الفورم اتضغط مرتين مايبقاش طلبين)
    const idem = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      // ✅ نبعت فقط IDs + الجدولة. الأسعار والسعرات وأسماء الوجبات تُحسب على الخادم من قاعدة البيانات.
      const result = await createOrder({
        // الاسم للطاقم فقط: لو تركه العميل فارغاً واسمه معروف بالحساب، نبعث اسم
        // الحساب حتى يراه الطاقم — دون أن يظهر في شاشة العميل (سرية).
        customerName: customerName || findCustomerByPhone?.fullName || "",
        customerPhone,
        customerEmail,
        customerId: findCustomerByPhone?._id,
        preferredStartDate: preferredStartDate || undefined,
        items: selectedMeals.map((meal) => ({
          mealId: meal._id as any,
          week: meal.week,
          day: meal.day,
        })),
        idempotencyKey: idem,
      });

      alert(t(`✅ تم إرسال طلبك بنجاح!\nرقم الطلب: ${result.orderNumber}\nسنتواصل معك قريباً.`, `✅ Your order was sent successfully!\nOrder number: ${result.orderNumber}\nWe'll contact you soon.`));
      clearCart();
      setLocation("/");
    } catch (error) {
      console.error("Error submitting order:", error);
      alert(t("❌ حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.", "❌ An error occurred while sending the order. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Redirect if cart is empty
  if (selectedMeals.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 flex items-center justify-center" dir={isRtl ? "rtl" : "ltr"}>
        <div className="text-center">
          <Package className="h-20 w-20 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{t("السلة فارغة", "Your cart is empty")}</h2>
          <p className="text-slate-500 mb-6">{t("لم تقم باختيار أي وجبات بعد", "You haven't selected any meals yet")}</p>
          <button
            onClick={() => setLocation("/public/menu")}
            className="px-6 py-3 bg-gradient-to-l from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-bold rounded-xl transition-all"
          >
            {t("تصفح المنيو", "Browse Menu")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            // 🔙 صفحة عميل — الرجوع للمنيو العام (/public/menu) لا لإدارة القائمة
            //    (/menu) وهي شاشة طاقم. باقي روابط هذه الصفحة تستخدم /public/menu.
            onClick={() => setLocation("/public/menu")}
            className="text-slate-600 hover:text-slate-900 flex items-center gap-2"
          >
            <ChevronRight className="h-5 w-5" />
            <span>{t("رجوع", "Back")}</span>
          </button>
          <h1 className="text-xl font-bold text-slate-900">{t("مراجعة وتأكيد الطلب", "Review & Confirm Order")}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 pb-10">
        {/* ملخص الاختيارات */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-cyan-50 rounded-xl">
              <Package className="h-6 w-6 text-cyan-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900 mb-1">{t("ملخص اختياراتك", "Your Selection Summary")}</h2>
              <p className="text-sm text-slate-500">{t(`خطة وجبات مخصصة لمدة ${totalWeeks} أسابيع`, `Custom meal plan for ${totalWeeks} weeks`)}</p>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{totalMeals} {t("وجبة", "meals")}</div>
                  <div className="text-xs text-slate-500">{t("إجمالي الوجبات", "Total meals")}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{totalWeeks} {t("أسابيع", "weeks")}</div>
                  <div className="text-xs text-slate-500">{t("الفترة الزمنية", "Duration")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* تفاصيل الوجبات المختارة حسب الأسابيع */}
        <div className="space-y-4">
          {Object.entries(organizedMeals)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([week, days]) => (
              <div key={week} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                {/* عنوان الأسبوع */}
                <button
                  onClick={() => toggleWeek(Number(week))}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold">
                      {week}
                    </div>
                    <div className={isRtl ? "text-right" : "text-left"}>
                      <div className="font-bold text-slate-900">{t("الأسبوع", "Week")} {week}</div>
                      <div className="text-sm text-slate-500">
                        {Object.keys(days).length} {t("أيام", "days")} • {Object.values(days).flat().length} {t("وجبات", "meals")}
                      </div>
                    </div>
                  </div>
                  {expandedWeeks.includes(Number(week)) ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                </button>

                {/* محتوى الأسبوع */}
                {expandedWeeks.includes(Number(week)) && (
                  <div className="border-t">
                    {Object.entries(days)
                      .sort(
                        ([a], [b]) =>
                          ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"].indexOf(a) -
                          ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"].indexOf(b)
                      )
                      .map(([day, meals]) => (
                        <div key={day} className="border-b last:border-b-0 p-4 bg-slate-50/50">
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold text-slate-700">{dayName(day)}</span>
                          </div>

                          <div className="space-y-2">
                            {meals.map((meal) => (
                              <div
                                key={meal._id}
                                className="flex items-center gap-3 bg-white rounded-xl p-3 border"
                              >
                                {meal.imageUrl ? (
                                  <img
                                    src={meal.imageUrl}
                                    alt={meal.nameAr}
                                    className="w-12 h-12 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                    <Package className="h-5 w-5 text-slate-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">{isRtl ? meal.nameAr : (meal.nameEn || meal.nameAr)}</div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="text-cyan-600 font-medium">
                                      {catName(meal.category)}
                                    </span>
                                    <span>•</span>
                                    <span>{meal.calories} {t("سعرة", "kcal")}</span>
                                  </div>
                                </div>
                                {/* حذف/تغيير الوجبة */}
                                <button
                                  onClick={() => removeItem(meal._id, meal.week, meal.day)}
                                  title={t("حذف الوجبة", "Remove meal")}
                                  className="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            {/* تغيير وجبات اليوم — يرجّع للمنيو على نفس اليوم */}
                            <button
                              onClick={() => setLocation("/public/menu")}
                              className="w-full text-xs font-bold text-[#0E76AC] hover:bg-[#f2fbff] rounded-lg py-2 flex items-center justify-center gap-1.5 border border-dashed border-[#cfe4f3]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("تعديل / إضافة وجبات لهذا اليوم", "Edit / add meals for this day")}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* معلومات العميل */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h3 className="font-bold text-slate-900 mb-4">{t("معلومات التواصل", "Contact Information")}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t("الاسم الكامل", "Full name")}{" "}
                {findCustomerByPhone
                  ? <span className="text-slate-400 text-xs">({t("اختياري", "optional")})</span>
                  : <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                placeholder={findCustomerByPhone
                  ? t("مربوط بحسابك — لا حاجة لكتابته", "Linked to your account — no need")
                  : t("أدخل اسمك الكامل", "Enter your full name")}
                required={!findCustomerByPhone}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t("رقم الجوال", "Phone number")}
                {verifiedPhone
                  ? <span className="text-green-600 text-xs font-bold mr-1">{t("· معبّأ تلقائياً", "· auto-filled")}</span>
                  : <span className="text-red-500">*</span>}
              </label>
              <input
                type="tel"
                value={customerPhone}
                // 🔒 الرقم متحقّق من المنيو ويُعبّأ تلقائياً — لا يُطلب من العميل كتابته،
                //    ويُقفل للقراءة فقط (تغييره على جهاز عائلي مشترك يكسر السرية).
                onChange={(e) => { if (!verifiedPhone) setCustomerPhone(e.target.value); }}
                readOnly={!!verifiedPhone}
                className={`w-full px-4 py-3 rounded-xl border border-slate-200 outline-none transition-all ${
                  verifiedPhone
                    ? "bg-slate-50 text-slate-600 cursor-default"
                    : "focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                }`}
                placeholder={t("مثال: +974 1234 5678", "e.g. +974 1234 5678")}
                required
              />
              {/* ✅ مؤشر الربط التلقائي */}
              {findCustomerByPhone && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-800 flex items-center gap-1">
                    <span className="font-bold">{t("✅ تم العثور على حساب:", "✅ Account found:")}</span>
                    <span className="font-semibold">{findCustomerByPhone.fullName}</span>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {t("سيتم ربط الطلب تلقائياً بحسابك (مع مراعاة الحساسيات والتفضيلات المسجلة)", "The order will be linked automatically to your account (allergies and preferences considered)")}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {t("البريد الإلكتروني", "Email")} <span className="text-slate-400">{t("(اختياري)", "(optional)")}</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                placeholder="example@email.com"
              />
            </div>
          </div>
        </div>

        {/* ملخص الطلب وزر التأكيد — في نهاية الصفحة (بدون sticky حتى لا يطفو فوق ما قبله على الموبايل) */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-cyan-100 p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`${isRtl ? "text-right" : "text-left"} p-3 rounded-xl bg-cyan-50 border border-cyan-100`}>
              <div className="text-xs text-slate-500 font-semibold mb-1">{t("إجمالي الوجبات", "Total meals")}</div>
              <div className="text-2xl font-black text-cyan-700 tabular-nums">
                {totalMeals}{" "}
                <span className="text-sm font-normal text-slate-500">{t("وجبة", "meals")}</span>
              </div>
            </div>
            <div className={`${isRtl ? "text-left" : "text-right"} p-3 rounded-xl bg-emerald-50 border border-emerald-100`}>
              <div className="text-xs text-slate-500 font-semibold mb-1">{t("إجمالي السعرات", "Total calories")}</div>
              <div className="text-2xl font-black text-emerald-700 tabular-nums">
                {totalCalories.toLocaleString()}{" "}
                <span className="text-sm font-normal text-slate-500">{t("سعرة", "kcal")}</span>
              </div>
            </div>
          </div>

          {/* 🔒 تنبيه عدم اكتمال الخطة — يمنع الإرسال حتى يُكمل كل أيام اشتراكه */}
          {isShort && (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900 mb-1">
                    {t("خطتك غير مكتملة", "Your plan is incomplete")}
                  </h3>
                  <p className="text-sm text-amber-800 mb-2">
                    {t(
                      "أكمل باقي وجبات أيام اشتراكك لتأكيد الخطة وإرسالها. المتبقّي:",
                      "Complete the rest of your subscription days to confirm and send. Remaining:",
                    )}
                  </p>
                  <ul className="text-sm text-amber-900 font-semibold space-y-0.5 mb-3">
                    {shortfall.mealsShort > 0 && (
                      <li>• {t(`ناقص ${shortfall.mealsShort} وجبة رئيسية`, `${shortfall.mealsShort} main meal(s) short`)}</li>
                    )}
                    {shortfall.snacksShort > 0 && (
                      <li>• {t(`ناقص ${shortfall.snacksShort} سناك`, `${shortfall.snacksShort} snack(s) short`)}</li>
                    )}
                    {shortfall.incompleteDays > 0 && (
                      <li className="text-amber-700 font-normal">
                        {t(`(${shortfall.incompleteDays} يوم غير مكتمل)`, `(${shortfall.incompleteDays} incomplete day(s))`)}
                      </li>
                    )}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setLocation("/public/menu")}
                      className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-lg transition-all"
                    >
                      <ChevronRight className="h-5 w-5" />
                      {t("أكمل وجباتك", "Complete your meals")}
                    </button>
                    <a
                      href={specialistLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold px-4 py-2.5 rounded-lg transition-all"
                    >
                      <MessageCircle className="h-5 w-5" />
                      {t("تواصل مع الأخصائية", "Contact the specialist")}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isShort || !customerPhone || (!customerName && !findCustomerByPhone)}
            className="w-full bg-gradient-to-l from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("جارٍ الإرسال…", "Sending...")}</span>
              </>
            ) : (
              <>
                <span>{t("تأكيد وإرسال الطلب", "Confirm & Send Order")}</span>
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>

          <p className="text-xs text-slate-500 text-center mt-3">
            {t('بالضغط على "تأكيد"، أنت توافق على ', 'By clicking "Confirm", you agree to the ')}
            <button className="text-cyan-600 underline">{t("الشروط والأحكام", "Terms & Conditions")}</button>
          </p>
        </div>
      </div>
    </div>
  );
}
