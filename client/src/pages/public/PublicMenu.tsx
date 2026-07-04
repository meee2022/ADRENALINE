/**
 * @file client/src/pages/public/PublicMenu.tsx
 * @description صفحة المنيو للموقع العام - مع نظام جدولة الأسابيع والأيام
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { usePublicMeals } from "@/lib/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PageHeader } from "@/components/public/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Flame, X, Clock, Lock, ShoppingCart, Plus, Check, Phone, AlertTriangle, MessageCircle, User, Sparkles, UtensilsCrossed } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCartStore } from "@/lib/cartStore";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";

const DAY_LABEL_AR: Record<string, string> = {
  saturday: "السبت", sunday: "الأحد", monday: "الإثنين",
  tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس",
};

type Category = "all" | "breakfast" | "lunch" | "dinner" | "salad" | "snack";
type DayOfWeek = "saturday" | "sunday" | "monday" | "tuesday" | "wednesday" | "thursday";

export default function PublicMenuPage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const [, setLocation] = useLocation();
  
  // Cart State
  const { items, addItem, getTotalMeals } = useCartStore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [selectedMeal, setSelectedMeal] = useState<any>(null);

  // ─── Phone gate ───
  const [phoneInput, setPhoneInput] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<string>(() => {
    return typeof window !== "undefined" ? (localStorage.getItem("menu_phone") || "") : "";
  });
  const [verifiedCustomerId, setVerifiedCustomerId] = useState<string>(() => {
    return typeof window !== "undefined" ? (localStorage.getItem("menu_customer_id") || "") : "";
  });
  const [browseMode, setBrowseMode] = useState<boolean>(() => {
    return typeof window !== "undefined" ? localStorage.getItem("menu_browse") === "1" : false;
  });
  const [phoneError, setPhoneError] = useState("");

  // Query: use existing `list` query (deployed) and filter client-side
  // This avoids dependency on a Convex function that may not be deployed yet
  const allCustomersList = useQuery(api.customers.list);

  const matchingCustomers = useMemo(() => {
    if (!verifiedPhone) return undefined; // skip state
    if (!allCustomersList) return undefined; // loading
    const normalized = verifiedPhone.replace(/\D/g, "");
    return allCustomersList.filter((c: any) => {
      const cPhone = String(c.phone || "").replace(/\D/g, "");
      return cPhone === normalized;
    });
  }, [allCustomersList, verifiedPhone]);

  const verifiedCustomer = useMemo(() => {
    if (!matchingCustomers || !verifiedCustomerId) return null;
    return matchingCustomers.find((c: any) => String(c._id) === verifiedCustomerId) || null;
  }, [matchingCustomers, verifiedCustomerId]);

  // Restaurant settings (for WhatsApp)
  const settings = useQuery(api.restaurantSettings.get);
  const phoneRaw = (settings?.phone || "+97412345678").replace(/\D/g, "");
  const whatsappLink = (msg: string) =>
    `https://wa.me/${phoneRaw}?text=${encodeURIComponent(msg)}`;

  const handleVerifyPhone = () => {
    setPhoneError("");
    const normalized = phoneInput.replace(/\D/g, "");
    if (normalized.length < 8) {
      setPhoneError(isRtl ? "رقم غير صحيح" : "Invalid phone number");
      return;
    }
    setVerifiedPhone(normalized);
    localStorage.setItem("menu_phone", normalized);
    // customer will be picked from results below
  };

  const handlePickCustomer = (customer: any) => {
    setVerifiedCustomerId(String(customer._id));
    localStorage.setItem("menu_customer_id", String(customer._id));
  };

  const handleResetPhone = () => {
    setVerifiedPhone("");
    setVerifiedCustomerId("");
    setPhoneInput("");
    setBrowseMode(false);
    localStorage.removeItem("menu_phone");
    localStorage.removeItem("menu_customer_id");
    localStorage.removeItem("menu_browse");
  };

  const handleBrowseOnly = () => {
    setBrowseMode(true);
    localStorage.setItem("menu_browse", "1");
  };

  const handleSignupViaWhatsApp = () => {
    const msg = isRtl
      ? `مرحباً 👋\nأرغب في الاشتراك في خطط أدرينالين الصحية.\nرقمي: ${phoneInput || verifiedPhone}`
      : `Hello 👋\nI'd like to subscribe to Adrenaline plans.\nMy phone: ${phoneInput || verifiedPhone}`;
    window.open(whatsappLink(msg), "_blank");
  };

  // NEW: Week & Day selection
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // ─── Subscription limits + warnings ───
  const mealsPerDay = verifiedCustomer?.mealsPerDay ?? 0;
  const snacksPerDay = verifiedCustomer?.snacksPerDay ?? 0;

  // Count what's selected for current day
  const selectedToday = items.filter(
    (i: any) => i.week === selectedWeek && i.day === selectedDay
  );
  const mainMealsToday = selectedToday.filter((i: any) =>
    ["breakfast", "lunch", "dinner"].includes(String(i.category).toLowerCase())
  ).length;
  const snacksToday = selectedToday.filter((i: any) =>
    String(i.category).toLowerCase() === "snack"
  ).length;

  // Avoid keywords from customer (lowercase tokens)
  const avoidTokens = useMemo(() => {
    const text = [verifiedCustomer?.allergies, verifiedCustomer?.avoid]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text
      .split(/[,،|/·•·\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
  }, [verifiedCustomer]);

  const mealHasAvoidConflict = (meal: any) => {
    if (avoidTokens.length === 0) return false;
    const hay = [meal.nameAr, meal.nameEn, meal.descriptionAr, meal.descriptionEn]
      .filter(Boolean).join(" ").toLowerCase();
    return avoidTokens.some((t) => hay.includes(t));
  };
  
  // Handle adding meal to cart
  const handleAddToCart = (meal: any, e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (!selectedDay) {
      alert(isRtl ? "يرجى اختيار اليوم أولاً" : "Please select a day first");
      return;
    }

    // ✅ Check subscription limits
    const isSnack = String(meal.category).toLowerCase() === "snack";
    if (isSnack) {
      if (snacksToday >= snacksPerDay) {
        alert(isRtl
          ? `وصلت للحد الأقصى من السناكات (${snacksPerDay}) لهذا اليوم`
          : `Reached daily snack limit (${snacksPerDay})`);
        return;
      }
    } else {
      if (mainMealsToday >= mealsPerDay) {
        alert(isRtl
          ? `وصلت للحد الأقصى من الوجبات (${mealsPerDay}) لهذا اليوم`
          : `Reached daily meal limit (${mealsPerDay})`);
        return;
      }
    }

    // ⚠ Warn about avoid conflict
    if (mealHasAvoidConflict(meal)) {
      const ok = window.confirm(isRtl
        ? `⚠ تنبيه: هذه الوجبة قد تحتوي على شيء من ممنوعاتك (${[verifiedCustomer?.allergies, verifiedCustomer?.avoid].filter(Boolean).join(" / ")}). هل تريد المتابعة؟`
        : `⚠ Warning: This meal may contain items you avoid. Continue anyway?`);
      if (!ok) return;
    }

    addItem({
      _id: meal._id,
      nameAr: meal.nameAr,
      nameEn: meal.nameEn || "",
      category: meal.category,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fats: meal.fats,
      imageUrl: meal.imageUrl,
      priceQAR: meal.priceQAR || 0,
      week: selectedWeek,
      day: selectedDay,
    });

    // ✅ تأكيد فوري للإضافة
    const dayLbl = isRtl ? (DAY_LABEL_AR[selectedDay] || selectedDay) : selectedDay;
    toast({
      title: isRtl ? "✓ أُضيفت للخطة" : "✓ Added to plan",
      description: `${isRtl ? meal.nameAr : (meal.nameEn || meal.nameAr)} — ${isRtl ? "أسبوع" : "Week"} ${selectedWeek} · ${dayLbl}`,
    });
  };
  
  // Check if meal is already in cart
  const isInCart = (mealId: string) => {
    if (!selectedDay) return false;
    return items.some(
      (item) => item._id === mealId && item.week === selectedWeek && item.day === selectedDay
    );
  };

  const { data: allMeals = [] } = usePublicMeals({
    category: activeCategory,
    search: searchQuery,
  });

  const menuHeaderImage = (allMeals.find((m: any) => m.imageUrl)?.imageUrl) || undefined;

  // Filter meals by selected week and day using exact schedule pairs
  const filteredMeals = allMeals.filter((meal: any) => {
    // Use precise schedule pairs if available
    if (meal.schedule && meal.schedule.length > 0) {
      if (selectedDay) {
        return meal.schedule.some((s: any) => s.week === selectedWeek && s.day === selectedDay);
      }
      return meal.schedule.some((s: any) => s.week === selectedWeek);
    }
    // Fallback: legacy weeks/days arrays
    const hasSchedule = meal.weeks && meal.weeks.length > 0;
    if (!hasSchedule) return false;
    if (selectedDay) {
      return meal.weeks.includes(selectedWeek) && meal.days && meal.days.includes(selectedDay);
    }
    return meal.weeks.includes(selectedWeek);
  });

  const meals = filteredMeals;

  // Countdown timer logic - DISABLED (always allow ordering)
  useEffect(() => {
    // ✅ تعطيل نظام قفل الوقت بالكامل - الطلبات مفتوحة دائماً
    setIsLocked(false);
    setTimeRemaining("");
    
    // الكود القديم (معطل):
    // if (!selectedDay) {
    //   setIsLocked(false);
    //   setTimeRemaining("");
    //   return;
    // }
    // const cutoffTime = "18:00";
    // const updateCountdown = () => { ... }
  }, [selectedDay]);

  const categories = [
    { id: "all" as Category, labelAr: "الكل", labelEn: "All" },
    { id: "breakfast" as Category, labelAr: "الإفطار", labelEn: "Breakfast" },
    { id: "lunch" as Category, labelAr: "الغداء", labelEn: "Lunch" },
    { id: "dinner" as Category, labelAr: "العشاء", labelEn: "Dinner" },
    { id: "salad" as Category, labelAr: "سلطات", labelEn: "Salads" },
    { id: "snack" as Category, labelAr: "سناكس", labelEn: "Snacks" },
  ];

  const weeks = [
    { value: 1, label: "الأسبوع 1" },
    { value: 2, label: "الأسبوع 2" },
    { value: 3, label: "الأسبوع 3" },
    { value: 4, label: "الأسبوع 4" },
  ];

  const days: { value: DayOfWeek; label: string }[] = [
    { value: "saturday", label: "السبت" },
    { value: "sunday", label: "الأحد" },
    { value: "monday", label: "الإثنين" },
    { value: "tuesday", label: "الثلاثاء" },
    { value: "wednesday", label: "الأربعاء" },
    { value: "thursday", label: "الخميس" },
  ];

  // ─── Phone gate state determination ───
  const isPhoneVerified = !!verifiedPhone && !!verifiedCustomer;
  const canViewMenu = isPhoneVerified || browseMode;
  const showPhonePrompt = !verifiedPhone;
  const showCustomerPicker = verifiedPhone && matchingCustomers && matchingCustomers.length > 1 && !verifiedCustomerId;
  const showNotRegistered = verifiedPhone && matchingCustomers !== undefined && matchingCustomers.length === 0;
  const showAutoSelect = verifiedPhone && matchingCustomers && matchingCustomers.length === 1 && !verifiedCustomerId;

  // Auto-select if only one match
  useEffect(() => {
    if (showAutoSelect && matchingCustomers && matchingCustomers[0]) {
      setVerifiedCustomerId(String(matchingCustomers[0]._id));
      localStorage.setItem("menu_customer_id", String(matchingCustomers[0]._id));
    }
  }, [showAutoSelect, matchingCustomers]);

  // ─── Phone Gate Screen (blocks menu) ───
  if (!canViewMenu) {
    return (
      <PublicLayout>
        <div className="min-h-[80vh] flex items-center justify-center px-4 py-12"
          style={{ background: "linear-gradient(135deg, #f8fafc, #ecfeff, #f0f9ff)" }}>
          <div className="w-full max-w-md">
            {/* Hero card */}
            <div className="bg-white rounded-3xl p-8 relative overflow-hidden"
              style={{
                boxShadow: "0 20px 60px rgba(60,196,240,0.15), 0 4px 20px rgba(0,0,0,0.06)",
                border: "1px solid rgba(60,196,240,0.15)",
              }}>
              {/* Decorative glow */}
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 blur-2xl"
                style={{ background: "radial-gradient(circle, #3CC4F0, transparent)" }} />

              {/* Reset button — always visible, fixed top corner */}
              {verifiedPhone && (
                <button
                  onClick={handleResetPhone}
                  aria-label="رجوع"
                  className="absolute top-4 left-4 z-20 h-9 w-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}

              <div className="relative">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #3CC4F0, #47759C)",
                    boxShadow: "0 8px 24px rgba(60,196,240,0.4)",
                  }}>
                  <Phone className="h-7 w-7 text-white" />
                </div>

                <h2 className="text-2xl font-black text-[#0F1516] text-center mb-2 tracking-tight">
                  {showPhonePrompt && (isRtl ? "أهلاً بك في أدرينالين" : "Welcome to Adrenaline")}
                  {showNotRegistered && (isRtl ? "رقمك غير مسجل" : "Phone Not Registered")}
                  {showCustomerPicker && (isRtl ? "من المستلم؟" : "Who's the recipient?")}
                </h2>
                <p className="text-sm text-[#47759C] text-center mb-6 leading-relaxed">
                  {showPhonePrompt && (isRtl ? "أدخل رقم هاتفك للوصول لخطتك واختيار وجباتك" : "Enter your phone to access your plan and pick meals")}
                  {showNotRegistered && (isRtl ? "هذا الرقم غير مسجل لدينا. تواصل عبر واتساب للاشتراك" : "This number isn't registered. Contact us via WhatsApp to subscribe")}
                  {showCustomerPicker && (isRtl ? "هذا الرقم مسجل لأكثر من مشترك. اختر اسمك للمتابعة" : "This number has multiple subscribers. Pick your name to continue")}
                </p>

                {/* Phone input */}
                {showPhonePrompt && (
                  <>
                    <div className="space-y-3">
                      <div
                        className="flex items-stretch rounded-xl overflow-hidden transition-all"
                        style={{
                          background: "#f8fafc",
                          border: `1.5px solid ${phoneError ? "#fca5a5" : "#e2e8f0"}`,
                        }}
                      >
                        {/* Country code prefix block */}
                        <div className="flex items-center justify-center px-4 gap-2 border-l"
                          style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)", borderColor: "#e2e8f0", minWidth: "90px" }}>
                          <Phone className="h-5 w-5 text-white" />
                          <span className="text-base font-black text-white tabular-nums">+974</span>
                        </div>
                        {/* Input */}
                        <input
                          type="tel"
                          inputMode="numeric"
                          dir="ltr"
                          autoFocus
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleVerifyPhone()}
                          placeholder="74XXXXXX"
                          className="flex-1 h-12 px-4 text-center text-base font-bold tabular-nums tracking-widest bg-transparent outline-none"
                        />
                      </div>
                      {phoneError && (
                        <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {phoneError}
                        </p>
                      )}
                      <button
                        onClick={handleVerifyPhone}
                        className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: "linear-gradient(135deg, #3CC4F0, #2bb0dc)",
                          boxShadow: "0 6px 20px rgba(60,196,240,0.4)",
                        }}
                      >
                        {isRtl ? "متابعة" : "Continue"}
                      </button>
                    </div>

                    {/* Browse without account */}
                    <button
                      onClick={handleBrowseOnly}
                      className="w-full mt-3 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-gray-50"
                      style={{ background: "transparent", border: "1.5px solid #e2e8f0", color: "#47759C" }}
                    >
                      {isRtl ? "تصفح المنيو فقط" : "Just Browse Menu"}
                    </button>

                    <div className="mt-5 pt-5 border-t border-gray-100 text-center">
                      <p className="text-xs text-gray-400 mb-2">
                        {isRtl ? "لست مشتركاً بعد؟" : "Not subscribed yet?"}
                      </p>
                      <button
                        onClick={handleSignupViaWhatsApp}
                        className="text-sm font-bold inline-flex items-center gap-1.5 hover:underline"
                        style={{ color: "#25D366" }}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {isRtl ? "اشترك عبر واتساب" : "Subscribe via WhatsApp"}
                      </button>
                    </div>
                  </>
                )}

                {/* Loading */}
                {verifiedPhone && matchingCustomers === undefined && (
                  <div className="space-y-4">
                    <div className="text-center py-6">
                      <div className="inline-block h-8 w-8 rounded-full border-2 border-gray-200 border-t-[#3CC4F0] animate-spin" />
                      <p className="text-xs text-gray-400 mt-3">{isRtl ? "جاري التحقق..." : "Verifying..."}</p>
                    </div>
                    <button
                      onClick={handleResetPhone}
                      className="w-full h-10 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                      style={{ border: "1.5px solid #e2e8f0" }}
                    >
                      {isRtl ? "إلغاء" : "Cancel"}
                    </button>
                  </div>
                )}

                {/* Not registered */}
                {showNotRegistered && (
                  <div className="space-y-3">
                    <div className="rounded-xl p-3 flex items-start gap-2.5"
                      style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-orange-800">
                        {isRtl
                          ? `الرقم ${verifiedPhone} غير موجود في قاعدة بياناتنا.`
                          : `Number ${verifiedPhone} not found in our records.`}
                      </p>
                    </div>
                    <button
                      onClick={handleSignupViaWhatsApp}
                      className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #25D366, #128C7E)",
                        boxShadow: "0 6px 20px rgba(37,211,102,0.4)",
                      }}
                    >
                      <MessageCircle className="h-5 w-5" />
                      {isRtl ? "اشترك عبر واتساب" : "Subscribe via WhatsApp"}
                    </button>
                    <button
                      onClick={handleBrowseOnly}
                      className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-gray-50"
                      style={{ background: "transparent", border: "1.5px solid #e2e8f0", color: "#47759C" }}
                    >
                      {isRtl ? "تصفح المنيو فقط" : "Just Browse Menu"}
                    </button>
                    <button
                      onClick={handleResetPhone}
                      className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                      style={{ background: "#f1f5f9", border: "1.5px solid #cbd5e1", color: "#475569" }}
                    >
                      ← {isRtl ? "أدخل رقم آخر" : "Use different number"}
                    </button>
                  </div>
                )}

                {/* Customer picker (multiple matches) */}
                {showCustomerPicker && (
                  <div className="space-y-2">
                    <div className="rounded-xl p-3 flex items-start gap-2.5 mb-3"
                      style={{ background: "#ecfeff", border: "1px solid #a5f3fc" }}>
                      <User className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#0891b2" }} />
                      <p className="text-xs leading-relaxed" style={{ color: "#155e75" }}>
                        {isRtl
                          ? `هذا الرقم مسجل لـ ${matchingCustomers.length} مشتركين. اختر المستلم الصحيح:`
                          : `This number has ${matchingCustomers.length} subscribers. Pick the right recipient:`}
                      </p>
                    </div>
                    {matchingCustomers.map((c: any) => (
                      <button
                        key={c._id}
                        onClick={() => handlePickCustomer(c)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-gray-50 hover:scale-[1.01] text-right"
                        style={{ border: "1.5px solid #e2e8f0" }}
                      >
                        <div className="h-11 w-11 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-black text-white"
                          style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)" }}>
                          {c.fullName?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-sm font-bold text-[#0F1516] truncate">{c.fullName}</p>
                          <p className="text-[11px] text-[#47759C] mt-0.5">
                            {c.program || "—"} • {c.mealsPerDay ?? 0} {isRtl ? "وجبات" : "meals"}
                          </p>
                        </div>
                        <Check className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      </button>
                    ))}
                    <button
                      onClick={handleResetPhone}
                      className="w-full h-10 mt-3 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {isRtl ? "أدخل رقم آخر" : "Use different number"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // ─── Customer Info Banner data ───
  const cust: any = verifiedCustomer;
  const hasWarnings = cust?.allergies || cust?.avoid;

  return (
    <PublicLayout>
      {/* ═══ Browse Mode Banner ═══ */}
      {browseMode && !isPhoneVerified && (
        <div className="sticky top-[73px] z-50 px-4 py-3"
          style={{
            background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
            boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
          }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-white/25 backdrop-blur-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-black text-white leading-tight">
                  {isRtl ? "وضع التصفح" : "Preview Mode"}
                </p>
                <p className="text-[11px] text-white/90 leading-tight">
                  {isRtl ? "اشترك للحجز والاستلام" : "Subscribe to order & get delivered"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSignupViaWhatsApp}
                className="text-xs font-bold px-4 h-9 rounded-full flex items-center gap-1.5 transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #25D366, #128C7E)",
                  color: "#fff",
                  boxShadow: "0 3px 10px rgba(37,211,102,0.4)",
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {isRtl ? "اشترك الآن" : "Subscribe Now"}
              </button>
              <button
                onClick={handleResetPhone}
                className="text-[11px] font-bold text-white px-3 h-9 rounded-full hover:bg-white/30 transition-colors flex items-center"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                {isRtl ? "تسجيل دخول" : "Login"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Customer Info Banner (Sticky top) ═══ */}
      {isPhoneVerified && (
        <div className="sticky top-[73px] z-50 px-4 py-3"
          style={{
            background: "linear-gradient(135deg, #3CC4F0 0%, #47759C 100%)",
            boxShadow: "0 4px 14px rgba(60,196,240,0.3)",
          }}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-black text-[#3CC4F0] bg-white">
                {cust?.fullName?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-black text-white leading-tight">
                  {isRtl ? "أهلاً" : "Hi"} {cust?.fullName?.split(" ")[0]}
                </p>
                <p className="text-[11px] text-white/80 leading-tight" dir="ltr">
                  {verifiedPhone}
                </p>
              </div>
            </div>

            {/* Plan info */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-white px-3 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
                {mealsPerDay} {isRtl ? "وجبات" : "meals"} + {snacksPerDay} {isRtl ? "سناك" : "snacks"} {isRtl ? "يومياً" : "/day"}
              </span>
              {cust?.program && (
                <span className="text-[11px] font-bold text-white px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  {cust.program}
                </span>
              )}
              <button
                onClick={handleResetPhone}
                className="text-[11px] font-bold text-white px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                {isRtl ? "تغيير" : "Switch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Allergies / Avoid warning banner (if any) ═══ */}
      {hasWarnings && isPhoneVerified && (
        <div className="px-4 pt-3 -mt-1">
          <div className="max-w-7xl mx-auto rounded-2xl p-3 flex items-start gap-3"
            style={{ background: "linear-gradient(135deg, #fef2f2, #fff5f5)", border: "1.5px solid #fecaca" }}>
            <div className="h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-red-500">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-red-600 uppercase tracking-wide mb-1">
                {isRtl ? "تنبيه: ممنوعات وحساسية" : "Allergies & Restrictions"}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {cust?.allergies && (
                  <span className="font-semibold text-red-800">
                    <span className="font-black">{isRtl ? "حساسية: " : "Allergy: "}</span>{cust.allergies}
                  </span>
                )}
                {cust?.avoid && (
                  <span className="font-semibold text-orange-800">
                    <span className="font-black">{isRtl ? "ممنوع: " : "Avoid: "}</span>{cust.avoid}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified compact header */}
      <PageHeader
        eyebrowAr="قائمتنا" eyebrowEn="OUR MENU"
        titleAr="قائمة الوجبات" titleEn="Our Menu"
        subtitleAr="اكتشف مجموعتنا المتنوعة من الوجبات الصحية واللذيذة"
        subtitleEn="Discover our diverse collection of healthy and delicious meals"
        image={menuHeaderImage}
      />

      {/* Choose: manual selection vs AI smart plan */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-5" dir={isRtl ? "rtl" : "ltr"}>
          <p className="text-center text-sm font-bold text-[#47759C] mb-3">
            {isRtl ? "اختر طريقتك:" : "Choose how to order:"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Manual */}
            <div className="rounded-2xl border-2 border-[#3CC4F0] bg-[#3CC4F0]/5 p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-[#3CC4F0]/15 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="h-5 w-5 text-[#0E76AC]" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-[#0E2A4A]">{isRtl ? "اختيار يدوي" : "Manual Pick"}</div>
                <div className="text-xs text-[#47759C]">{isRtl ? "تصفّح القائمة واختر وجباتك بنفسك (أنت هنا)" : "Browse and pick your meals (you're here)"}</div>
              </div>
            </div>
            {/* Smart */}
            <button
              onClick={() => setLocation("/customer/smart-plan")}
              className="rounded-2xl border border-[#D9E6F1] hover:border-[#0E76AC] hover:shadow-md transition-all p-4 flex items-center gap-3 text-start"
            >
              <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(145deg,#3AC7F4,#0E76AC)" }}>
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-[#0E2A4A]">{isRtl ? "خطة ذكية ✨" : "Smart Plan ✨"}</div>
                <div className="text-xs text-[#47759C]">{isRtl ? "سيبها علينا — الذكاء الاصطناعي يختار (يوم أو أسبوع)" : "Let AI pick for you (day or week)"}</div>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Browse-mode notice: cart is saved locally but ordering needs a subscription */}
      {browseMode && (
        <div className="bg-amber-50 border-b border-amber-200" dir={isRtl ? "rtl" : "ltr"}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              {isRtl
                ? "أنت في وضع التصفّح — اختياراتك تُحفظ على جهازك، لكن لإتمام الطلب تحتاج اشتراكًا نشطًا. "
                : "You're browsing — your picks are saved on this device, but completing an order needs an active subscription. "}
              <button onClick={handleResetPhone} className="font-bold underline text-amber-900">
                {isRtl ? "أدخل رقمك للتحقق" : "Enter your phone to verify"}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* NEW: Week & Day Scheduling Section */}
      <section className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Week Tabs */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#47759C] mb-3">اختر الأسبوع</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {weeks.map((week) => (
                <button
                  key={week.value}
                  onClick={() => setSelectedWeek(week.value)}
                  className={cn(
                    "px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all",
                    selectedWeek === week.value
                      ? "bg-[#3CC4F0] text-white shadow-md scale-105"
                      : "bg-white text-[#47759C] border border-gray-200 hover:border-[#3CC4F0] hover:bg-[#3CC4F0]/5"
                  )}
                >
                  {week.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day Chips */}
          <div className="mb-4">
            <h3 className="text-sm font-bold text-[#47759C] mb-3">اختر اليوم</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {days.map((day) => (
                <button
                  key={day.value}
                  onClick={() => setSelectedDay(selectedDay === day.value ? null : day.value)}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
                    selectedDay === day.value
                      ? "bg-[#3CC4F0] text-white shadow-md"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-[#3CC4F0] hover:bg-[#3CC4F0]/5"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Selection Counters */}
          {selectedDay && (
            <div className="rounded-2xl p-4"
              style={{
                background: "linear-gradient(135deg, #ecfeff, #f0f9ff)",
                border: "1.5px solid #a5f3fc",
              }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)" }}>
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#0891b2" }}>
                      {isRtl ? "اختياراتك لهذا اليوم" : "Today's Selection"}
                    </p>
                    <p className="text-[11px] text-[#47759C] mt-0.5">
                      {isRtl
                        ? `${days.find((d) => d.value === selectedDay)?.label} - الأسبوع ${selectedWeek}`
                        : `${days.find((d) => d.value === selectedDay)?.label} - Week ${selectedWeek}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Meals counter */}
                  <div className="rounded-xl px-3 py-2 bg-white"
                    style={{ border: `2px solid ${mainMealsToday >= mealsPerDay ? "#10b981" : "#3CC4F0"}` }}>
                    <p className="text-[10px] text-[#47759C] font-bold leading-none">{isRtl ? "الوجبات" : "Meals"}</p>
                    <p className="text-lg font-black tabular-nums leading-none mt-1"
                      style={{ color: mainMealsToday >= mealsPerDay ? "#10b981" : "#3CC4F0" }}>
                      {mainMealsToday}<span className="text-xs text-gray-400">/{mealsPerDay}</span>
                    </p>
                  </div>
                  {/* Snacks counter */}
                  <div className="rounded-xl px-3 py-2 bg-white"
                    style={{ border: `2px solid ${snacksToday >= snacksPerDay ? "#10b981" : "#10b981"}` }}>
                    <p className="text-[10px] text-[#47759C] font-bold leading-none">{isRtl ? "السناك" : "Snacks"}</p>
                    <p className="text-lg font-black tabular-nums leading-none mt-1 text-emerald-600">
                      {snacksToday}<span className="text-xs text-gray-400">/{snacksPerDay}</span>
                    </p>
                  </div>
                  {/* Status pill */}
                  {mainMealsToday >= mealsPerDay && snacksToday >= snacksPerDay && (
                    <span className="text-[11px] font-black px-3 py-1.5 rounded-full bg-emerald-500 text-white flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      {isRtl ? "مكتمل" : "Done"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Search & Filters */}
      <section className="bg-white border-b border-gray-100 sticky top-[73px] z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#47759C]" />
            <Input
              type="text"
              placeholder={isRtl ? "ابحث عن وجبة..." : "Search for a meal..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-14 pl-12 pr-4 rounded-full border-2 border-gray-200 focus:border-[#3CC4F0] text-base"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-6 py-2 rounded-full font-medium transition-all",
                  activeCategory === cat.id
                    ? "bg-[#3CC4F0] text-white shadow-md"
                    : "bg-gray-100 text-[#47759C] hover:bg-gray-200"
                )}
              >
                {isRtl ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Meals Grid */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          {meals.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl text-[#47759C]">
                {isRtl ? "لا توجد وجبات متاحة" : "No meals available"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {meals.map((meal: any) => {
                const hasConflict = mealHasAvoidConflict(meal);
                const isSnackMeal = String(meal.category).toLowerCase() === "snack";
                const atLimit = isSnackMeal
                  ? snacksToday >= snacksPerDay
                  : mainMealsToday >= mealsPerDay;
                return (
                <Card
                  key={meal._id}
                  className={cn(
                    "group transition-all duration-300 overflow-hidden cursor-pointer bg-white relative rounded-3xl",
                    hasConflict
                      ? "border-2 border-red-300 hover:border-red-500 hover:shadow-lg"
                      : "border-2 border-gray-100 hover:border-[#3CC4F0] hover:shadow-xl"
                  )}
                  onClick={() => setSelectedMeal(meal)}
                >
                  {/* Avoid conflict ribbon */}
                  {hasConflict && (
                    <div className="absolute top-0 inset-x-0 z-20 px-3 py-1.5 flex items-center justify-center gap-1.5 text-[10px] font-black text-white"
                      style={{ background: "linear-gradient(90deg, #ef4444, #f97316)" }}>
                      <AlertTriangle className="h-3 w-3" />
                      {isRtl ? "تحذير: قد تحتوي على ممنوعاتك" : "Warning: May contain restricted items"}
                    </div>
                  )}

                  {/* Meal Image */}
                  <div className={cn("relative h-48 overflow-hidden", hasConflict && "mt-7")}>
                    <img
                      src={meal.imageUrl}
                      alt={isRtl ? meal.nameAr : meal.nameEn || meal.nameAr}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    
                    {/* Calories Badge */}
                    <div className="absolute top-3 right-3">
                      <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-bold text-[#0F1516]">
                          {meal.calories}
                        </span>
                      </div>
                    </div>

                    {/* Category Badge */}
                    <div className="absolute bottom-3 left-3">
                      <Badge
                        className={cn(
                          "text-xs font-bold px-3 py-1 border-0",
                          meal.category === "breakfast" && "bg-orange-500 text-white",
                          meal.category === "lunch" && "bg-cyan-500 text-white",
                          meal.category === "dinner" && "bg-indigo-500 text-white",
                          meal.category === "salad" && "bg-green-500 text-white",
                          meal.category === "snack" && "bg-amber-500 text-white"
                        )}
                      >
                        {meal.category === "breakfast" && (isRtl ? "فطور" : "Breakfast")}
                        {meal.category === "lunch" && (isRtl ? "غداء" : "Lunch")}
                        {meal.category === "dinner" && (isRtl ? "عشاء" : "Dinner")}
                        {meal.category === "salad" && (isRtl ? "سلطة" : "Salad")}
                        {meal.category === "snack" && (isRtl ? "سناك" : "Snack")}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-5">
                    {/* Meal Name */}
                    <h3 className="text-xl font-bold text-[#0F1516] mb-2 line-clamp-1">
                      {isRtl ? meal.nameAr : meal.nameEn || meal.nameAr}
                    </h3>

                    {/* Subtitle (if exists) */}
                    {meal.nameEn && isRtl && (
                      <p className="text-sm text-[#47759C] mb-3">{meal.nameEn}</p>
                    )}

                    {/* Description */}
                    <p className="text-sm text-[#47759C] mb-4 line-clamp-2">
                      {isRtl ? meal.descriptionAr : meal.descriptionEn || meal.descriptionAr}
                    </p>

                    {/* Macros */}
                    <div className="flex items-center gap-3 mb-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-[#47759C]">
                          {isRtl ? "بروتين" : "P"}: {meal.protein}g
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span className="text-[#47759C]">
                          {isRtl ? "كارب" : "C"}: {meal.carbs}g
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-[#47759C]">
                          {isRtl ? "دهون" : "F"}: {meal.fats}g
                        </span>
                      </div>
                    </div>

                    {/* Tags */}
                    {meal.tags && meal.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {meal.tags.slice(0, 3).map((tag: string, idx: number) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs bg-[#3CC4F0]/10 text-[#3CC4F0] border-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Calories & Button (no price — included in subscription) */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ background: "#3cc4f015", color: "#3cc4f0" }}>
                          {meal.calories} {isRtl ? "كالوري" : "kcal"}
                        </span>
                      </div>
                      {browseMode && !isPhoneVerified ? (
                        // Browse mode: replace add button with subscribe CTA
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e?.stopPropagation();
                            const msg = isRtl
                              ? `مرحباً 👋\nأرغب في الاشتراك في أدرينالين.\nأعجبتني وجبة: ${meal.nameAr}`
                              : `Hello 👋\nI'd like to subscribe to Adrenaline.\nI like this meal: ${meal.nameEn || meal.nameAr}`;
                            window.open(whatsappLink(msg), "_blank");
                          }}
                          className="h-9 px-4 rounded-full font-bold text-white flex items-center gap-1.5"
                          style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {isRtl ? "اشترك" : "Subscribe"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => handleAddToCart(meal, e)}
                          disabled={isInCart(meal._id) || !selectedDay || (atLimit && !isInCart(meal._id))}
                          className={cn(
                            "h-9 px-5 rounded-full font-bold transition-all",
                            isInCart(meal._id)
                              ? "bg-green-500 hover:bg-green-600 text-white"
                              : atLimit
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : hasConflict
                                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                                  : "bg-[#3CC4F0] hover:bg-[#47759C] text-white"
                          )}
                        >
                          {isInCart(meal._id) ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              {isRtl ? "مضافة" : "Added"}
                            </>
                          ) : atLimit ? (
                            <>{isRtl ? "ممتلئ" : "Full"}</>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" />
                              {isRtl ? "أضف" : "Add"}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          )}
        </div>
      </section>

      {/* Meal Details Modal */}
      <Dialog open={!!selectedMeal} onOpenChange={() => setSelectedMeal(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={dir}>
          {selectedMeal && (
            <div className="space-y-6">
              {/* Header */}
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-[#0F1516]">
                  {isRtl ? selectedMeal.nameAr : selectedMeal.nameEn || selectedMeal.nameAr}
                </DialogTitle>
                {selectedMeal.nameEn && isRtl && (
                  <p className="text-sm text-[#47759C]">{selectedMeal.nameEn}</p>
                )}
              </DialogHeader>

              {/* Image */}
              <div className="relative w-full h-64 rounded-lg overflow-hidden">
                <img
                  src={selectedMeal.imageUrl}
                  alt={isRtl ? selectedMeal.nameAr : selectedMeal.nameEn}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-bold">{selectedMeal.calories}</span>
                </div>
              </div>

              {/* Category & Tags */}
              <div className="flex flex-wrap gap-2">
                <Badge
                  className={cn(
                    "text-xs font-bold px-3 py-1 border-0",
                    selectedMeal.category === "breakfast" && "bg-orange-500 text-white",
                    selectedMeal.category === "lunch" && "bg-cyan-500 text-white",
                    selectedMeal.category === "dinner" && "bg-indigo-500 text-white",
                    selectedMeal.category === "salad" && "bg-green-500 text-white",
                    selectedMeal.category === "snack" && "bg-amber-500 text-white"
                  )}
                >
                  {selectedMeal.category === "breakfast" && (isRtl ? "فطور" : "Breakfast")}
                  {selectedMeal.category === "lunch" && (isRtl ? "غداء" : "Lunch")}
                  {selectedMeal.category === "dinner" && (isRtl ? "عشاء" : "Dinner")}
                  {selectedMeal.category === "salad" && (isRtl ? "سلطة" : "Salad")}
                  {selectedMeal.category === "snack" && (isRtl ? "سناك" : "Snack")}
                </Badge>
                {selectedMeal.tags?.map((tag: string, idx: number) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs bg-[#3CC4F0]/10 text-[#3CC4F0] border-0"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Description */}
              {(selectedMeal.aboutAr || selectedMeal.aboutEn) && (
                <div>
                  <h3 className="font-bold text-[#0F1516] mb-2">
                    {isRtl ? "الوصف" : "Description"}
                  </h3>
                  <p className="text-[#47759C] leading-relaxed">
                    {isRtl ? selectedMeal.aboutAr : selectedMeal.aboutEn || selectedMeal.aboutAr}
                  </p>
                </div>
              )}

              {/* Macros */}
              <div>
                <h3 className="font-bold text-[#0F1516] mb-3">
                  {isRtl ? "القيم الغذائية" : "Nutrition Facts"}
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#0F1516]">{selectedMeal.calories}</p>
                    <p className="text-xs text-[#47759C]">{isRtl ? "سعرة" : "Calories"}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="h-6 w-6 rounded-full bg-red-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#0F1516]">{selectedMeal.protein}g</p>
                    <p className="text-xs text-[#47759C]">{isRtl ? "بروتين" : "Protein"}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <div className="h-6 w-6 rounded-full bg-yellow-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#0F1516]">{selectedMeal.carbs}g</p>
                    <p className="text-xs text-[#47759C]">{isRtl ? "كربوهيدرات" : "Carbs"}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="h-6 w-6 rounded-full bg-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-[#0F1516]">{selectedMeal.fats}g</p>
                    <p className="text-xs text-[#47759C]">{isRtl ? "دهون" : "Fats"}</p>
                  </div>
                </div>
              </div>

              {/* Ingredients */}
              {selectedMeal.ingredients && selectedMeal.ingredients.length > 0 && (
                <div>
                  <h3 className="font-bold text-[#0F1516] mb-2">
                    {isRtl ? "المكونات" : "Ingredients"}
                  </h3>
                  <ul className="space-y-1">
                    {selectedMeal.ingredients.map((ingredient: string, idx: number) => (
                      <li key={idx} className="text-[#47759C] flex items-start gap-2">
                        <span className="text-[#3CC4F0] mt-1">•</span>
                        <span>{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Info & CTA (no price — included in subscription) */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold px-3 py-1.5 rounded-full"
                    style={{ background: "#3cc4f015", color: "#3cc4f0" }}>
                    {selectedMeal.calories} {isRtl ? "كالوري" : "kcal"}
                  </span>
                  <span className="text-xs font-semibold text-[#47759C]">
                    {isRtl ? "ضمن اشتراكك" : "Included in your plan"}
                  </span>
                </div>
                <Button
                  onClick={(e) => {
                    handleAddToCart(selectedMeal, e);
                    setSelectedMeal(null);
                  }}
                  disabled={isInCart(selectedMeal._id) || !selectedDay}
                  className={cn(
                    "h-11 px-8 rounded-full font-bold",
                    isInCart(selectedMeal._id)
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-[#3CC4F0] hover:bg-[#47759C] text-white"
                  )}
                >
                  {isInCart(selectedMeal._id) ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      {isRtl ? "تم الإضافة" : "Already Added"}
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      {isRtl ? "إضافة للسلة" : "Add to Cart"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Floating Cart Button */}
      {getTotalMeals() > 0 && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
          <Button
            onClick={() => setLocation("/public/order-review")}
            className="h-14 px-8 rounded-full bg-gradient-to-l from-[#3CC4F0] to-[#47759C] hover:from-[#47759C] hover:to-[#3CC4F0] text-white font-bold shadow-2xl flex items-center gap-3"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>{isRtl ? "مراجعة الطلب" : "Review Order"}</span>
            <div className="bg-white text-[#3CC4F0] rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold">
              {getTotalMeals()}
            </div>
          </Button>
        </div>
      )}
    </PublicLayout>
  );
}
