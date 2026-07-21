import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronRight, Package } from "lucide-react";
import { useCartStore } from "@/lib/cartStore";
import { useLanguage } from "@/lib/i18n";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { getVerifiedPhone } from "@/lib/customerIdentity";
import { subscriptionShortfall, orderedSubscriptionSlots, slotToDate } from "@/lib/subscription";
import { mealScheduledFor } from "@/lib/mealSchedule";
import { restrictionWords, mealIsRestricted } from "@/lib/mealRestrictions";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

const dayNameAr: Record<string, string> = {
  saturday: "السبت",
  sunday: "الأحد",
  monday: "الإثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  // ✅ الخميس يوم **توصيل** عادي (إجازة الطاقم فقط)، والجمعة يوم عمل بلا توصيل
  //    (المطبخ يطبخ فيها للسبت). كان الخميس ناقصاً هنا بفهمٍ خاطئ («الخميس إجازة»)
  //    فيظهر «thursday» بالإنجليزي في المراجعة العربية (شكوى سلطان).
  thursday: "الخميس",
};
const dayNameEn: Record<string, string> = {
  saturday: "Saturday", sunday: "Sunday", monday: "Monday",
  tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
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

// 🎨 نفس لوحة ألوان الخطة الذكية (SmartPlan) — للتطابق البصري
const B = {
  brand: "#3AC7F4", accent: "#0E76AC", ink: "#0E2A4A",
  ink2: "#2D4A67", line: "#D9E6F1", surf: "#F7FBFE", bg2: "#EAF3FB",
};
const DAY_ORDER = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

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
    addItem,
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
  // تاريخ عرض اليوم — **تاريخ التوصيل الفعلي** (slotToDate: أقرب ظهور ≥ بكرة)،
  //    نفس مصدر المنيو والاعتماد. عرض فقط — لا يمسّ أي منطق.
  //    ⚠️ slotBlockDate (أول ظهور مطلق) كان يرجع تواريخ **ماضية** لأسبوع دورة
  //       يتكرّر داخل الاشتراك (27-06 بدل 25-07 عند سلطان) — لخبطة أمام العميل.
  const dateForSlot = (week: number, day: string) => slotToDate(subStartDate, startRotForSub, week, day);

  // 🔁 تبديل الوجبة في المكان (بدل الرجوع للمنيو) — نفس فكرة الخطة الذكية:
  //    بدائل نفس (الصنف + اليوم + الدورة) فقط، بلا الممنوعات. استبدال 1↔1 يحافظ
  //    على العدد فلا يمسّ أي قيد (السقف/الاكتمال/الفطار).
  const allMeals = (useQuery(api.publicMeals.listMeals, {}) as any[]) || [];
  const [swap, setSwap] = useState<any>(null); // {_id, week, day, category, nameAr,...}
  const restrictWords = restrictionWords((findCustomerByPhone as any)?.avoid, (findCustomerByPhone as any)?.allergies);
  const swapCandidates = (): any[] => {
    if (!swap) return [];
    return allMeals.filter((m: any) =>
      mealScheduledFor(m, Number(swap.week), swap.day) &&
      String(m.category) === String(swap.category) &&
      String(m._id) !== String(swap._id) &&
      !mealIsRestricted(m, restrictWords));
  };
  const applySwap = (m: any) => {
    if (!swap) return;
    removeItem(swap._id, swap.week, swap.day);
    addItem({
      _id: m._id, nameAr: m.nameAr, nameEn: m.nameEn || "", category: m.category,
      calories: m.calories, protein: m.protein, carbs: m.carbs, fats: m.fats,
      imageUrl: m.imageUrl, priceQAR: m.priceQAR || 0, week: swap.week, day: swap.day,
    });
    setSwap(null);
  };
  const cancelOrder = async () => {
    const ok = await confirmDialog({
      title: t("إلغاء الطلب", "Cancel order"),
      message: t("سيتم مسح كل الوجبات التي اخترتها. متأكد؟", "This will clear all the meals you selected. Are you sure?"),
      variant: "danger",
      confirmText: t("نعم، امسح الكل", "Yes, clear all"),
    });
    if (!ok) return;
    clearCart();
    setLocation("/public/menu");
  };
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

  const handleSubmit = async () => {
    if (!customerPhone) {
      void alertDialog({ message: t("يرجى إدخال رقم الجوال", "Please enter your phone number") });
      return;
    }
    // الاسم مطلوب فقط لو لا حساب مربوط بالرقم؛ المربوط يكفيه customerId.
    if (!customerName && !findCustomerByPhone) {
      void alertDialog({ message: t("يرجى إدخال الاسم", "Please enter your name") });
      return;
    }

    if (selectedMeals.length === 0) {
      void alertDialog({ message: t("يرجى اختيار وجبات أولاً", "Please select meals first") });
      return;
    }

    // 🔒 مطابقة الاشتراك: لازم يُكمل كل أيام اشتراكه قبل الإرسال.
    if (isShort) {
      void alertDialog({ message: t(
        "خطتك غير مكتملة. أكمل باقي وجبات أيام اشتراكك أولاً لتأكيد الخطة وإرسالها.",
        "Your plan is incomplete. Please complete the rest of your subscription days before confirming and sending.",
      ) });
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

      void alertDialog({ message: t(`✅ تم إرسال طلبك بنجاح!\nرقم الطلب: ${result.orderNumber}\nسنتواصل معك قريباً.`, `✅ Your order was sent successfully!\nOrder number: ${result.orderNumber}\nWe'll contact you soon.`) });
      clearCart();
      setLocation("/");
    } catch (error) {
      console.error("Error submitting order:", error);
      void alertDialog({ message: t("❌ حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.", "❌ An error occurred while sending the order. Please try again.") });
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

        {/* تفاصيل الوجبات — نفس تصميم الخطة الذكية (SmartPlan). الشكل فقط، لا منطق */}
        <div className="space-y-4">
          {Object.entries(organizedMeals)
            // ✅ ترتيب الأسابيع **زمنياً** بأول تاريخ توصيل فعلي — الترتيب الرقمي يعرض
            //    دورة 1 أولاً حتى لو كانت آخر أسبوع للعميل (الدورات تلفّ 3→4→1→2).
            .sort(([a, da], [b, db]) => {
              const fa = Object.keys(da).map((d) => dateForSlot(Number(a), d)).filter(Boolean).sort()[0] || "9999";
              const fb = Object.keys(db).map((d) => dateForSlot(Number(b), d)).filter(Boolean).sort()[0] || "9999";
              return fa < fb ? -1 : fa > fb ? 1 : Number(a) - Number(b);
            })
            .map(([week, days]) => (
              <div key={week}>
                {/* بانر الدورة */}
                <div style={{
                  margin: "0 0 10px", padding: "8px 14px", borderRadius: 10,
                  background: B.bg2, border: "1px solid #CFE4F3", color: B.ink, fontWeight: 900, fontSize: 14,
                }}>
                  {t(`الأسبوع (دورة ${week})`, `Week (rotation ${week})`)}
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  {Object.entries(days)
                    .sort(([a], [b]) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
                    .map(([day, meals]) => {
                      const date = dateForSlot(Number(week), day);
                      return (
                        <div key={day} style={{ background: "#fff", border: `1px solid ${B.line}`, borderRadius: 16, overflow: "hidden" }}>
                          {/* ترويسة اليوم الغامقة */}
                          <div style={{
                            background: B.ink, color: "#fff", padding: "10px 16px",
                            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6,
                          }}>
                            <span style={{ fontWeight: 800, fontSize: 15 }}>{dayName(day)}{date ? ` · ${date}` : ""}</span>
                            <span style={{ fontSize: 12, opacity: 0.85 }}>{meals.length} {t("وجبة", "meals")}</span>
                          </div>
                          {/* شبكة الكروت */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, padding: 12 }}>
                            {meals.map((meal, mi) => (
                              <div key={`${meal._id}-${mi}`} style={{ border: `1px solid ${B.line}`, borderRadius: 12, overflow: "hidden", background: B.surf }}>
                                <div style={{ height: 84, background: B.bg2, overflow: "hidden" }}>
                                  {meal.imageUrl
                                    ? <img src={meal.imageUrl} alt={meal.nameAr} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><Package className="h-6 w-6 text-slate-400" /></div>}
                                </div>
                                <div style={{ padding: "7px 9px" }}>
                                  <div className="line-clamp-1" style={{ fontFamily: "'Cairo',sans-serif", fontSize: 12.5, fontWeight: 800, color: B.ink, lineHeight: 1.3 }}>{isRtl ? meal.nameAr : (meal.nameEn || meal.nameAr)}</div>
                                  <div style={{ fontSize: 11, color: B.ink2, marginTop: 2 }}>{catName(meal.category)} · {meal.calories} {t("سعرة", "kcal")}</div>
                                  {/* تبديل في المكان — بدائل نفس الصنف/اليوم بلا الرجوع للمنيو */}
                                  <button
                                    onClick={() => setSwap(meal)}
                                    style={{
                                      marginTop: 6, width: "100%", padding: "4px 8px", borderRadius: 8, cursor: "pointer",
                                      border: "1px solid #CFE4F3", background: "#F2FBFF", color: "#0E76AC",
                                      fontFamily: "'Cairo',sans-serif", fontSize: 11, fontWeight: 800,
                                    }}
                                  >
                                    🔁 {t("تبديل", "Swap")}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
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

          {/* إلغاء الطلب — يمسح كل الوجبات ويرجّع للمنيو */}
          <button
            onClick={cancelOrder}
            className="w-full mt-3 text-sm font-bold text-red-600 hover:bg-red-50 py-2.5 rounded-xl transition-colors"
          >
            {t("إلغاء الطلب ومسح الكل", "Cancel order & clear all")}
          </button>

          <p className="text-xs text-slate-500 text-center mt-3">
            {t('بالضغط على "تأكيد"، أنت توافق على ', 'By clicking "Confirm", you agree to the ')}
            <button className="text-cyan-600 underline">{t("الشروط والأحكام", "Terms & Conditions")}</button>
          </p>
        </div>
      </div>

      {/* 🔁 نافذة التبديل في المكان — بدائل نفس الصنف/اليوم/الدورة (نفس الخطة الذكية) */}
      {swap && (
        <div
          onClick={() => setSwap(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 680, maxHeight: "82vh", overflowY: "auto", padding: 20 }} dir={isRtl ? "rtl" : "ltr"}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ fontFamily: "'Cairo',sans-serif", fontSize: 17, fontWeight: 800, color: B.ink, margin: 0 }}>
                🔁 {t("تبديل:", "Swap:")} <span style={{ color: "#0E76AC" }}>{isRtl ? swap.nameAr : (swap.nameEn || swap.nameAr)}</span>
              </h3>
              <button onClick={() => setSwap(null)} style={{ border: "none", background: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 12.5, color: B.ink2, margin: "0 0 14px" }}>
              📅 {t(
                `بدائل ${catName(swap.category)} ${dayName(swap.day)} — أسبوع الدورة ${swap.week}`,
                `${dayName(swap.day)} ${swap.category} alternatives — rotation week ${swap.week}`,
              )}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,240px),1fr))", gap: 10 }}>
              {swapCandidates().map((m: any) => (
                <button
                  key={m._id}
                  onClick={() => applySwap(m)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, cursor: "pointer", background: B.surf, border: `1px solid ${B.line}`, borderRadius: 12, textAlign: "start" }}
                >
                  {m.imageUrl && <img src={m.imageUrl} alt={m.nameAr} style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: "'Cairo',sans-serif", fontSize: 13, fontWeight: 800, color: B.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {isRtl ? m.nameAr : (m.nameEn || m.nameAr)}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: B.ink2, marginTop: 2 }}>{m.calories} {t("سعرة", "kcal")}</span>
                  </span>
                </button>
              ))}
            </div>
            {swapCandidates().length === 0 && (
              <p style={{ textAlign: "center", color: "#94a3b8", padding: "24px 0", fontSize: 13.5 }}>
                {t("لا توجد بدائل من نفس التصنيف مجدولة لهذا اليوم.", "No same-category alternatives scheduled for this day.")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
