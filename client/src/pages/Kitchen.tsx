/**
 * @file client/src/pages/Kitchen.tsx
 * @description نظام عرض المطبخ (KDS) - تصميم احترافي للشيف
 * @convex convex/dailyPlans.ts, convex/customers.ts, convex/menuItems.ts, convex/mealCategories.ts, convex/modifiers.ts
 */
import { useMemo, useState } from "react";
import {
  useDailyPlans,
  useUpdateDailyPlan,
  useCustomers,
  useMenuItems,
  useCategories,
  useModifiers,
} from "@/lib/api";

import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Calendar as CalendarIcon,
  Printer,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ModifierGroup = "AVOID" | "PREF" | "PORTION";

export default function Kitchen() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const dateLocale = language === "ar" ? ar : enUS;

  const [date, setDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"MORNING" | "EVENING" | "SUMMARY">("MORNING");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // ✅ Dialog state for meal details
  const [openMealDialog, setOpenMealDialog] = useState(false);
  const [selectedMealName, setSelectedMealName] = useState("");
  const [selectedMealDetails, setSelectedMealDetails] = useState<any[]>([]);

  const formattedDate = format(date, "yyyy-MM-dd");

  const { data: dailyPlans = [] } = useDailyPlans();
  const { data: customers = [] } = useCustomers();
  const { data: menuItems = [] } = useMenuItems();
  const { data: categories = [] } = useCategories();
  const { data: modifiers = [] } = useModifiers();
  const updatePlanMutation = useUpdateDailyPlan();

  const plans = useMemo(() => {
    return dailyPlans
      .filter(
        (p: any) =>
          p.date === formattedDate &&
          p.deliveryTime === activeTab &&
          (p.status === "CONFIRMED" || p.status === "PREPARED")
      )
      .sort((a: any, b: any) => {
        if (a.status === "CONFIRMED" && b.status === "PREPARED") return -1;
        if (a.status === "PREPARED" && b.status === "CONFIRMED") return 1;
        return 0;
      });
  }, [dailyPlans, formattedDate, activeTab]);

  const stats = useMemo(() => {
    const today = plans.filter((p: any) => p.status === "CONFIRMED").length;
    const prepared = plans.filter((p: any) => p.status === "PREPARED").length;
    return { today, prepared };
  }, [plans]);

  const getCustomer = (id: string) => customers.find((c: any) => c._id === id);
  const getMenuItem = (id: string) => menuItems.find((m: any) => m._id === id);
  const getCategory = (id: string) => categories.find((c: any) => c._id === id);

  // ✅ حساب إجمالي الوجبات لليوم (كل فترات التوصيل)
  const mealSummary = useMemo(() => {
    const allPlansToday = dailyPlans.filter(
      (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED")
    );

    const summary: Record<string, {
      count: number;
      plainCount: number;     // ✅ عادي بدون تعديلات
      modifiedCount: number;  // ✅ معدّل (فيه ممنوعات أو تفضيلات)
      details: Array<{
        customerName: string;
        deliveryTime: string;
        categoryName: string;
        avoid?: string;
        preferences?: string;
        portions?: string;
        specialNotes?: string;
        isPlain: boolean;     // ✅ هل عادية؟
      }>
    }> = {};

    // helper: يحدد لو الوجبة عادية (مفيش أي تعديلات)
    const isPlainMeal = (item: any, customer: any): boolean => {
      // فحص بيانات الـ item نفسها
      if (String(item.avoid || "").trim()) return false;
      if (String(item.preferences || "").trim()) return false;
      if (String(item.portions || "").trim()) return false;
      if (String(item.specialNotes || "").trim()) return false;
      if ((item.modifierIds || []).length > 0) return false;
      // فحص بيانات العميل (الحساسية والممنوعات تطبق على كل وجباته)
      if (String(customer?.allergies || "").trim()) return false;
      if (String(customer?.avoid || "").trim()) return false;
      if (String(customer?.preferences || "").trim()) return false;
      if (String(customer?.portions || "").trim()) return false;
      return true;
    };

    allPlansToday.forEach((plan: any) => {
      const customer = getCustomer(plan.customerId);
      const customerName = customer?.fullName || plan.customerName || (isRtl ? "عميل جديد" : "New Customer");

      (plan.items || [])
        .filter((item: any) => !item.isOff)
        .forEach((item: any) => {
          const mealId = item.menuItemId || item.mealId;
          const meal = getMenuItem(mealId);
          const mealName = meal
            ? (isRtl ? meal.nameAr || meal.name : meal.name)
            : (item.mealNameAr || item.mealNameEn || (isRtl ? "وجبة غير محددة" : "Unknown Meal"));

          const category = getCategory(item.categoryId);
          const categoryName = category?.name || item.category || (isRtl ? "غير محدد" : "Unknown");

          if (!summary[mealName]) {
            summary[mealName] = { count: 0, plainCount: 0, modifiedCount: 0, details: [] };
          }

          const plain = isPlainMeal(item, customer);
          summary[mealName].count += 1;
          if (plain) summary[mealName].plainCount += 1;
          else summary[mealName].modifiedCount += 1;

          summary[mealName].details.push({
            customerName,
            deliveryTime: plan.deliveryTime,
            categoryName,
            avoid: item.avoid || customer?.avoid || undefined,
            preferences: item.preferences || customer?.preferences || undefined,
            portions: item.portions || customer?.portions || undefined,
            specialNotes: item.specialNotes || undefined,
            isPlain: plain,
          });
        });
    });

    return Object.entries(summary)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [dailyPlans, formattedDate, customers, menuItems, categories, isRtl]);

  const handleMarkPrepared = async (planId: string) => {
    try {
      await updatePlanMutation.mutateAsync({
        id: planId,
        data: { status: "PREPARED" },
      });
    } catch (error) {
      console.error("Failed to mark as prepared:", error);
      alert("❌ فشل تحديث الحالة. حاول مرة أخرى.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getCategoryLabel = (categoryName: string) => {
    const n = categoryName.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) return isRtl ? "فطور" : "BREAKFAST";
    if (n.includes("LUNCH") || n.includes("غداء")) return isRtl ? "غداء" : "LUNCH";
    if (n.includes("DINNER") || n.includes("عشاء")) return isRtl ? "عشاء" : "DINNER";
    if (n.includes("SNACK") || n.includes("سناك")) return isRtl ? "سناك" : "SNACKS";
    return categoryName.toUpperCase();
  };

  const getModifiersByGroup = (modifierIds: string[] = []) => {
    const avoid: string[] = [];
    const pref: string[] = [];
    const portion: string[] = [];

    modifierIds.forEach((id) => {
      const mod = modifiers.find((m: any) => m._id === id);
      if (!mod) return;
      const name = isRtl ? mod.nameAr || mod.name : mod.name;
      if (mod.group === "AVOID") avoid.push(name);
      else if (mod.group === "PREF") pref.push(name);
      else if (mod.group === "PORTION") portion.push(name);
    });

    return { avoid, pref, portion };
  };

  const openMealDetailsDialog = (mealName: string, details: any[]) => {
    setSelectedMealName(mealName);
    setSelectedMealDetails(details);
    setOpenMealDialog(true);
  };

  return (
    <>
      {/* Screen Version */}
      <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24 print:hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-6 shadow-sm">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {isRtl ? "عرض المطبخ" : "Kitchen Display"}
              </h1>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  className="h-11 rounded-xl border-gray-300 hover:bg-gray-50"
                >
                  <Printer className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                  {isRtl ? "طباعة" : "Print"}
                </Button>

                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-xl border-gray-300">
                      <CalendarIcon className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                      {format(date, "EEEE, d MMMM", { locale: dateLocale })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        if (d) {
                          setDate(d);
                          setIsCalendarOpen(false);
                        }
                      }}
                      locale={dateLocale}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-3 mb-4">
              <div className="flex items-center gap-2 bg-cyan-50 px-4 py-2 rounded-xl border border-cyan-200">
                <span className="text-2xl font-bold text-cyan-600">{stats.today}</span>
                <span className="text-sm text-cyan-700 font-medium">
                  {isRtl ? "اليوم" : "Today"}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl border border-gray-200">
                <span className="text-2xl font-bold text-gray-600">{stats.prepared}</span>
                <span className="text-sm text-gray-700 font-medium">
                  {isRtl ? "بكرة" : "Tomorrow"}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl border border-gray-200">
                <span className="text-2xl font-bold text-gray-600">0</span>
                <span className="text-sm text-gray-700 font-medium">
                  {isRtl ? "بعده" : "After"}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab("MORNING")}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base transition-all",
                  activeTab === "MORNING"
                    ? "bg-cyan-500 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                )}
              >
                {isRtl ? "توصيل صباحي" : "Morning Delivery"}
              </button>
              <button
                onClick={() => setActiveTab("EVENING")}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base transition-all",
                  activeTab === "EVENING"
                    ? "bg-gray-700 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                )}
              >
                {isRtl ? "توصيل مسائي" : "Evening Delivery"}
              </button>
              <button
                onClick={() => setActiveTab("SUMMARY")}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base transition-all",
                  activeTab === "SUMMARY"
                    ? "bg-[#47759c] text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                )}
              >
                {isRtl ? "إجمالي الوجبات" : "Meal Summary"}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
          {activeTab === "SUMMARY" ? (
            /* ✅ تاب إجمالي الوجبات - تصميم مبسط للشيف */
            <>
              {mealSummary.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-lg text-gray-500">
                      {isRtl ? "لا توجد وجبات" : "No meals"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                    {isRtl ? "تفاصيل وجبات اليوم المحدد" : "Today's Meal Details"}
                  </h2>
                  
                  {mealSummary.map((meal, index) => {
                    const colors = [
                      "bg-[#3cc4f0]",
                      "bg-[#47759c]",
                      "bg-[#0f1516]",
                      "bg-[#5a8aad]",
                      "bg-[#7ba8c4]",
                      "bg-[#2d5c82]",
                      "bg-[#3cc4f0]/70",
                      "bg-[#47759c]/70",
                      "bg-[#0f1516]/70",
                    ];
                    const color = colors[index % colors.length];

                    return (
                      <div
                        key={index}
                        className="bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-all border-2 border-gray-200"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className={cn("w-3 h-3 rounded-full", color)} />
                            <span className="text-xl font-bold text-gray-900">
                              {meal.name}
                            </span>
                          </div>

                          <button
                            onClick={() => openMealDetailsDialog(meal.name, meal.details)}
                            className={cn(
                              "text-3xl font-bold text-white px-8 py-3 rounded-xl shadow-md hover:shadow-xl transition-all active:scale-95",
                              color
                            )}
                          >
                            {meal.count}
                          </button>
                        </div>

                        {/* ✅ Breakdown: عادي vs معدّل */}
                        {meal.count > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                              style={{ background: "#e8f8fd", border: "1px solid #3cc4f040" }}>
                              <div>
                                <p className="text-[10px] font-bold text-[#47759c] uppercase tracking-wide">
                                  {isRtl ? "عادي" : "Plain"}
                                </p>
                                <p className="text-[10px] text-[#3cc4f0] mt-0.5">
                                  {isRtl ? "بدون تعديلات" : "No modifications"}
                                </p>
                              </div>
                              <span className="text-2xl font-black tabular-nums text-[#3cc4f0]">
                                {meal.plainCount}
                              </span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                              style={{ background: "#eaf1f7", border: "1px solid #47759c40" }}>
                              <div>
                                <p className="text-[10px] font-bold text-[#47759c] uppercase tracking-wide">
                                  {isRtl ? "معدّل" : "Modified"}
                                </p>
                                <p className="text-[10px] text-[#47759c]/70 mt-0.5">
                                  {isRtl ? "ممنوعات/تفضيلات" : "Avoid/Prefs"}
                                </p>
                              </div>
                              <span className="text-2xl font-black tabular-nums text-[#47759c]">
                                {meal.modifiedCount}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          ) : (
            /* ✅ تابات التوصيل (MORNING / EVENING) */
            <>
              {plans.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-200">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-lg text-gray-500">
                    {isRtl ? "لا توجد طلبات" : "No orders"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              plans.map((plan: any) => {
              const customer = getCustomer(plan.customerId);
              // ✅ إذا لم يوجد customer مربوط، نعرض الطلب بدون بيانات العميل المفصلة
              
              const hasAllergy = customer?.allergies && customer.allergies.trim().length > 0;
              const isPrepared = plan.status === "PREPARED";
              
              // ✅ استخدام اسم احتياطي إذا لم يوجد customer
              const customerName = customer?.fullName || plan.customerName || "عميل جديد";
              const customerProgram = customer?.program || (isRtl ? "طلب من الموقع" : "Website Order");

              return (
                <Card
                  key={plan._id}
                  className={cn(
                    "overflow-hidden transition-all",
                    isPrepared
                      ? "bg-cyan-50 border-2 border-cyan-300 opacity-75"
                      : "bg-white border-2 border-gray-200 shadow-md"
                  )}
                >
                  {/* Allergy Warning Banner */}
                  {hasAllergy && !isPrepared && (
                    <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 font-bold">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="uppercase tracking-wide">
                        {isRtl ? "⚠️ تنبيه: حساسية مفرطة (ALLERGY)" : "⚠️ ALLERGY WARNING"}
                      </span>
                    </div>
                  )}

                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">
                          {customerName}
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>ID: #{plan._id.slice(-4)}</span>
                          <span>•</span>
                          <span>{customerProgram}</span>
                        </div>
                      </div>

                      {isPrepared ? (
                        <Badge className="bg-cyan-500 text-white border-0 text-sm px-4 py-2 rounded-xl">
                          {isRtl ? "جاهز للتوصيل" : "Ready to Deliver"}
                        </Badge>
                      ) : (
                        <Badge className="bg-[#47759c] text-white border-0 text-sm px-4 py-2 rounded-xl">
                          {isRtl ? "جاهز للتحضير" : "Ready to Prepare"}
                        </Badge>
                      )}
                    </div>

                    {/* Meals */}
                    <div className="space-y-4 mb-4">
                      {(plan.items || [])
                        .filter((item: any) => !item.isOff)
                        .map((item: any, idx: number) => {
                          // ✅ دعم كلا النوعين: menuItemId (خطط يدوية) و mealId (طلبات عملاء)
                          const mealId = item.menuItemId || item.mealId;
                          const meal = getMenuItem(mealId);
                          const category = getCategory(item.categoryId);
                          
                          // ✅ إذا لم يوجد meal في menuItems، استخدم البيانات من item نفسه
                          const mealName = meal ? (isRtl ? meal.nameAr || meal.name : meal.name) 
                                                : (item.mealNameAr || item.mealNameEn || "وجبة غير محددة");
                          
                          const { avoid, pref, portion } = getModifiersByGroup(item.modifierIds);

                          // ✅ دمج modifiers من 3 مصادر:
                          // 1) modifierIds (المختارة من الـ picker)
                          // 2) item نفسه (بيانات مضمنة من الطلب الإلكتروني)
                          // 3) customer (الحساسية والممنوعات والتفضيلات والكميات من بيانات الاشتراك)
                          const allAvoid = [...avoid];
                          const allPref = [...pref];
                          const allPortions = [...portion];

                          if (item.avoid) allAvoid.push(item.avoid);
                          if (item.preferences) allPref.push(item.preferences);
                          if (item.portions) allPortions.push(item.portions);

                          // من بيانات العميل (تنطبق على كل وجباته)
                          if (customer?.avoid && String(customer.avoid).trim()) allAvoid.push(String(customer.avoid).trim());
                          if (customer?.preferences && String(customer.preferences).trim()) allPref.push(String(customer.preferences).trim());
                          if (customer?.portions && String(customer.portions).trim()) allPortions.push(String(customer.portions).trim());

                          // ملاحظة خاصة بالوجبة (من Plans.tsx)
                          const itemNote = String(item.specialNotes || "").trim();
                          // الحساسية على مستوى العميل
                          const custAllergy = String(customer?.allergies || "").trim();

                          return (
                            <div
                              key={idx}
                              className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200"
                            >
                              {/* Meal Category Badge */}
                              <div className="flex items-start justify-between mb-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs font-bold px-3 py-1 border-0",
                                    // ✅ استخدام category من item أو من lookup
                                    getCategoryLabel(category?.name || item.category || "").includes("BREAKFAST") &&
                                      "bg-[#e8f8fd] text-[#3cc4f0]",
                                    getCategoryLabel(category?.name || item.category || "").includes("LUNCH") &&
                                      "bg-cyan-100 text-cyan-700",
                                    getCategoryLabel(category?.name || item.category || "").includes("DINNER") &&
                                      "bg-[#eaf1f7] text-[#47759c]",
                                    getCategoryLabel(category?.name || item.category || "").includes("SNACK") &&
                                      "bg-[#e8f8fd] text-[#3cc4f0]"
                                  )}
                                >
                                  {getCategoryLabel(category?.name || item.category || "")}
                                </Badge>

                                {item.specialInstructions && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">
                                    {item.specialInstructions}
                                  </span>
                                )}
                              </div>

                              {/* Meal Name */}
                              <h3 className="text-xl font-bold text-gray-900 mb-3">
                                {mealName}
                              </h3>

                              {/* Allergy banner — per meal (chef sees it inline) */}
                              {custAllergy && (
                                <div className="mb-2 rounded-lg overflow-hidden flex items-stretch"
                                  style={{ background: "#fef2f2", border: "1.5px solid #ef4444" }}>
                                  <div className="px-3 flex items-center justify-center text-white font-black text-base"
                                    style={{ background: "#ef4444", minWidth: "40px" }}>⚠</div>
                                  <div className="flex-1 px-3 py-2 min-w-0">
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-wider leading-none">
                                      {isRtl ? "حساسية" : "ALLERGY"}
                                    </p>
                                    <p className="text-sm font-bold text-red-800 mt-0.5 leading-tight">{custAllergy}</p>
                                  </div>
                                </div>
                              )}

                              {/* Modifiers + customer dietary data */}
                              {(allAvoid.length > 0 || allPref.length > 0 || allPortions.length > 0) && (
                                <div className="space-y-1.5">
                                  {/* AVOID - Red boxes */}
                                  {allAvoid.length > 0 && (
                                    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                                      style={{ background: "#fef2f2", border: "1px solid #ef444440" }}>
                                      <span className="text-red-500 font-black text-sm flex-shrink-0">✕</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-wide">{isRtl ? "ممنوع" : "Avoid"}</p>
                                        <p className="text-sm font-bold text-red-800 leading-tight mt-0.5">{allAvoid.join(isRtl ? "، " : ", ")}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* PREF - Cyan */}
                                  {allPref.length > 0 && (
                                    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                                      style={{ background: "#ecfeff", border: "1px solid #a5f3fc" }}>
                                      <span className="font-black text-sm flex-shrink-0" style={{ color: "#0891b2" }}>★</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: "#0891b2" }}>{isRtl ? "تفضيلات" : "Prefs"}</p>
                                        <p className="text-sm font-semibold leading-tight mt-0.5" style={{ color: "#155e75" }}>{allPref.join(isRtl ? "، " : ", ")}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* PORTION - Yellow */}
                                  {allPortions.length > 0 && (
                                    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                                      style={{ background: "#eaf1f7", border: "1px solid #47759c40" }}>
                                      <span className="text-[#47759c] font-black text-sm flex-shrink-0">⚖</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-[#47759c] uppercase tracking-wide">{isRtl ? "الكمية" : "Portion"}</p>
                                        <p className="text-sm font-semibold text-[#0f1516] leading-tight mt-0.5">{allPortions.join(isRtl ? "، " : ", ")}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Special note for this specific meal */}
                              {itemNote && (
                                <div className="mt-2 rounded-lg px-3 py-2 flex items-start gap-2"
                                  style={{ background: "#eaf1f7", border: "1px solid #47759c50" }}>
                                  <span className="font-black text-sm flex-shrink-0 text-[#47759c]">📝</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-[#47759c] uppercase tracking-wide">{isRtl ? "ملاحظة الوجبة" : "Note"}</p>
                                    <p className="text-sm font-semibold text-[#0f1516] leading-tight mt-0.5">{itemNote}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Special Notes */}
                    {plan.notes && plan.notes.trim().length > 0 && (
                      <div className="bg-[#eaf1f7] rounded-xl p-4 border-2 border-[#47759c]/30 mb-4">
                        <div className="flex items-start gap-2">
                          <span className="text-2xl">💬</span>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-[#0f1516] mb-1 uppercase">
                              {isRtl
                                ? "الرجاء التأكد من تشريح اللحم جيداً وعدم إضافة أي نوع من المكسرات."
                                : "Please ensure meat is well-cooked and do not add any nuts."}
                            </p>
                            <p className="text-sm text-[#47759c] font-medium italic">
                              {plan.notes}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Customer Allergies */}
                    {hasAllergy && customer && (
                      <div className="bg-red-50 rounded-xl p-4 border-2 border-red-300 mb-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-red-900 mb-1 uppercase">
                              {isRtl ? "⚠️ حساسية مفرطة" : "⚠️ Allergy Warning"}
                            </p>
                            <p className="text-sm font-bold text-red-900">{customer.allergies}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    {!isPrepared && (
                      <Button
                        onClick={() => handleMarkPrepared(plan._id)}
                        className="w-full h-14 rounded-xl text-white font-bold text-lg shadow-md" style={{background:"linear-gradient(135deg,#3cc4f0,#47759c)"}}
                      >
                        {isRtl ? 'تحديد ك "تم التحضير"' : 'Mark as "Prepared"'}
                      </Button>
                    )}

                    {isPrepared && (
                      <div className="flex items-center justify-center gap-2 text-cyan-700 font-bold">
                        <Truck className="h-5 w-5" />
                        {isRtl ? "بانتظار التوصيل" : "Awaiting Delivery"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
            )}
          </>
          )}
        </div>
      </div>

      {/* Print Version */}
      <div className="hidden print:block bg-white" dir={isRtl ? "rtl" : "ltr"}>
        {(() => {
          // ✅ في الطباعة: استخدم كل خطط اليوم (مش بس النشطة)
          const allPlansToday = dailyPlans.filter(
            (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED")
          );
          const totalMeals = allPlansToday.reduce(
            (sum: number, p: any) => sum + (p.items || []).filter((i: any) => !i.isOff).length,
            0
          );
          return (
            <div className="p-6 space-y-6">
              {/* Print Header */}
              <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-black">
                    {isRtl ? "عرض المطبخ" : "Kitchen Display"}
                  </h1>
                  <p className="text-base text-black mt-1">
                    {format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-black">
                    {totalMeals} {isRtl ? "وجبة" : "meals"}
                  </p>
                  <p className="text-sm text-black">
                    {allPlansToday.length} {isRtl ? "عميل" : "customers"}
                  </p>
                </div>
              </div>

              {/* ✅ Meal Summary Table (Aggregated by meal name) */}
              {mealSummary.length > 0 && (
                <div className="mb-6 page-break-inside-avoid">
                  <h2 className="text-lg font-bold text-black mb-3 border-b border-black pb-1">
                    {isRtl ? "ملخص الوجبات الإجمالي" : "Meal Summary"}
                  </h2>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr style={{ background: "#f3f4f6" }}>
                        <th className="border border-black px-3 py-2 text-right font-bold">{isRtl ? "الوجبة" : "Meal"}</th>
                        <th className="border border-black px-3 py-2 text-center font-bold w-20">{isRtl ? "إجمالي" : "Total"}</th>
                        <th className="border border-black px-3 py-2 text-center font-bold w-20">{isRtl ? "عادي" : "Plain"}</th>
                        <th className="border border-black px-3 py-2 text-center font-bold w-24">{isRtl ? "معدّل" : "Modified"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mealSummary.map((m: any, i: number) => (
                        <tr key={i}>
                          <td className="border border-black px-3 py-2 font-bold">{m.name}</td>
                          <td className="border border-black px-3 py-2 text-center text-xl font-black">{m.count}</td>
                          <td className="border border-black px-3 py-2 text-center font-bold">{m.plainCount}</td>
                          <td className="border border-black px-3 py-2 text-center font-bold">{m.modifiedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Print Header for Per-Customer section */}
              <h2 className="text-lg font-bold text-black mb-3 border-b border-black pb-1">
                {isRtl ? "تفاصيل العملاء" : "Per-Customer Details"}
              </h2>
              <div className="space-y-4">

              {/* Print Orders */}
              {allPlansToday.map((plan: any, planIdx: number) => {
            const customer = getCustomer(plan.customerId);
            // ✅ دعم الطلبات بدون ربط
            const customerName = customer?.fullName || plan.customerName || "عميل جديد";
            const customerProgram = customer?.program || (isRtl ? "طلب من الموقع" : "Website Order");
            const hasAllergy = customer?.allergies && customer.allergies.trim().length > 0;

            return (
              <div
                key={plan._id}
                className="border-2 border-black rounded-lg p-6 page-break-inside-avoid mb-6"
              >
                {/* Customer Info */}
                <div className="border-b-2 border-gray-400 pb-4 mb-4">
                  <h2 className="text-2xl font-bold text-black mb-2">{customerName}</h2>
                  <p className="text-base text-black">
                    ID: #{plan._id.slice(-6)} • {customerProgram}
                  </p>
                </div>

                {/* Allergy Warning */}
                {hasAllergy && customer && (
                  <div className="border-4 border-black bg-gray-100 p-4 mb-4">
                    <p className="text-lg font-bold text-black mb-2 uppercase">
                      ⚠️ {isRtl ? "حساسية مفرطة (ALLERGY)" : "ALLERGY WARNING"}
                    </p>
                    <p className="text-base font-bold text-black">{customer.allergies}</p>
                  </div>
                )}

                {/* Meals */}
                <div className="space-y-4">
                  {(plan.items || [])
                    .filter((item: any) => !item.isOff)
                    .map((item: any, idx: number) => {
                      // ✅ دعم كلا النوعين: menuItemId و mealId
                      const mealId = item.menuItemId || item.mealId;
                      const meal = getMenuItem(mealId);
                      const category = getCategory(item.categoryId);
                      
                      // ✅ fallback للبيانات المضمنة في item
                      const mealName = meal ? (isRtl ? meal.nameAr || meal.name : meal.name) 
                                            : (item.mealNameAr || item.mealNameEn || "Meal");

                      const { avoid, pref, portion } = getModifiersByGroup(item.modifierIds);

                      return (
                        <div key={idx} className="border border-gray-400 rounded p-4">
                          {/* Category */}
                          <p className="text-sm font-bold text-black mb-2 uppercase">
                            {getCategoryLabel(category?.name || item.category || "")}
                          </p>

                          {/* Meal Name */}
                          <h3 className="text-xl font-bold text-black mb-3">
                            {mealName}
                          </h3>

                          {/* Modifiers */}
                          {avoid.length > 0 && (
                            <p className="text-base font-bold text-black mb-1">
                              ▲ {isRtl ? "ممنوع:" : "Avoid:"} {avoid.join(isRtl ? "، " : ", ")}
                            </p>
                          )}
                          {pref.length > 0 && (
                            <p className="text-base text-black mb-1">
                              {isRtl ? "تفضيلات:" : "Prefs:"} {pref.join(isRtl ? "، " : ", ")}
                            </p>
                          )}
                          {portion.length > 0 && (
                            <p className="text-base text-black">
                              {isRtl ? "الكمية:" : "Portion:"} {portion.join(isRtl ? "، " : ", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Notes */}
                {plan.notes && plan.notes.trim().length > 0 && (
                  <div className="border-2 border-gray-600 bg-gray-100 p-4 mt-4">
                    <p className="text-sm font-bold text-black mb-1 uppercase">
                      💬 {isRtl ? "ملاحظات خاصة" : "Special Notes"}
                    </p>
                    <p className="text-base text-black font-medium italic">{plan.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
              </div>

              {/* Print Footer */}
              <div className="border-t-2 border-black mt-6 pt-3 text-center">
                <p className="text-xs text-black">
                  Adrenaline Healthy Food Kitchen Management System — {format(new Date(), "yyyy/MM/dd HH:mm")}
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ✅ Meal Details Dialog — Premium Light Theme */}
      <Dialog open={openMealDialog} onOpenChange={setOpenMealDialog}>
        <DialogContent
          className="max-w-4xl max-h-[85vh] overflow-hidden p-0 bg-white"
          dir={isRtl ? "rtl" : "ltr"}
          style={{
            border: "1px solid rgba(60,196,240,0.15)",
            boxShadow: "0 20px 60px rgba(60,196,240,0.15), 0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          {/* Header — Brand gradient */}
          <div className="relative px-6 py-5 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #3CC4F0 0%, #2bb0dc 50%, #47759C 100%)" }}>
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #ffffff60, transparent 70%)" }} />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-15"
              style={{ background: "radial-gradient(circle, #ffffff80, transparent 70%)" }} />

            <div className="relative flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">
                  {isRtl ? "تفاصيل الوجبة" : "Meal Details"}
                </p>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight truncate">
                  {selectedMealName}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl backdrop-blur-md px-5 py-3 text-center"
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  <p className="text-3xl font-black text-white tabular-nums leading-none">
                    {selectedMealDetails.length}
                  </p>
                  <p className="text-[10px] text-white/80 mt-1 uppercase tracking-wider">
                    {isRtl ? "عميل" : "Orders"}
                  </p>
                </div>
              </div>
            </div>

            {/* Plain vs Modified split */}
            {selectedMealDetails.length > 0 && (() => {
              const plainCount = selectedMealDetails.filter((d) => d.isPlain).length;
              const modifiedCount = selectedMealDetails.length - plainCount;
              return (
                <div className="relative grid grid-cols-2 gap-2 mt-4">
                  <div className="rounded-xl px-3 py-2 backdrop-blur-md flex items-center justify-between"
                    style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
                    <div>
                      <p className="text-[10px] font-bold text-white/90 uppercase tracking-wide">
                        {isRtl ? "عادي" : "Plain"}
                      </p>
                      <p className="text-[10px] text-white/70 mt-0.5">{isRtl ? "بدون تعديلات" : "No mods"}</p>
                    </div>
                    <span className="text-2xl font-black text-white tabular-nums">{plainCount}</span>
                  </div>
                  <div className="rounded-xl px-3 py-2 backdrop-blur-md flex items-center justify-between"
                    style={{ background: "rgba(252,165,15,0.25)", border: "1px solid rgba(252,165,15,0.4)" }}>
                    <div>
                      <p className="text-[10px] font-bold text-white uppercase tracking-wide">
                        {isRtl ? "معدّل" : "Modified"}
                      </p>
                      <p className="text-[10px] text-white/80 mt-0.5">{isRtl ? "احذر التحضير" : "Special prep"}</p>
                    </div>
                    <span className="text-2xl font-black text-white tabular-nums">{modifiedCount}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Visually hidden title for accessibility */}
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedMealName}</DialogTitle>
          </DialogHeader>

          {/* Customer list — sorted: Modified first, then Plain */}
          <div className="overflow-auto px-5 py-5 max-h-[60vh]"
            style={{ background: "#f8fafc" }}>
          {(() => {
            // Sort: المعدّل أولاً (isPlain=false) ثم العادي (isPlain=true)
            const sorted = [...selectedMealDetails].sort((a, b) => {
              const aPlain = a.isPlain ? 1 : 0;
              const bPlain = b.isPlain ? 1 : 0;
              if (aPlain !== bPlain) return aPlain - bPlain; // معدّل قبل عادي
              // ثم ترتيب بالوقت: صباحي قبل مسائي
              const aTime = a.deliveryTime === "MORNING" ? 0 : 1;
              const bTime = b.deliveryTime === "MORNING" ? 0 : 1;
              return aTime - bTime;
            });

            // Group with visual section dividers
            const modifiedMeals = sorted.filter((d) => !d.isPlain);
            const plainMeals = sorted.filter((d) => d.isPlain);

            const renderItem = (detail: any, idx: number) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 transition-all hover:-translate-y-0.5"
                style={{
                  boxShadow: detail.isPlain
                    ? "0 2px 12px rgba(0,0,0,0.05)"
                    : "0 2px 12px rgba(245,158,11,0.12), 0 0 0 1.5px #fde68a inset",
                  border: detail.isPlain ? "1px solid rgba(0,0,0,0.05)" : "1px solid #fde68a",
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Right: Customer + Category */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-black text-white"
                      style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)" }}>
                      {(detail.customerName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm md:text-base font-black text-[#0F1516] truncate">
                        {detail.customerName}
                      </p>
                      <p className="text-[11px] text-[#47759C] font-semibold mt-0.5">
                        {detail.categoryName || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Left: Delivery time + Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {detail.isPlain ? (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                        ✓ {isRtl ? "عادي" : "Plain"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                        ⚠ {isRtl ? "معدّل" : "Modified"}
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{
                        background: detail.deliveryTime === "MORNING" ? "#fffbeb" : "#eff6ff",
                        color: detail.deliveryTime === "MORNING" ? "#92400e" : "#1e40af",
                        border: `1px solid ${detail.deliveryTime === "MORNING" ? "#fde68a" : "#bfdbfe"}`,
                      }}>
                      {detail.deliveryTime === "MORNING" ? "☀ " : "🌙 "}
                      {isRtl ? (detail.deliveryTime === "MORNING" ? "صباحي" : "مسائي") : detail.deliveryTime}
                    </span>
                  </div>
                </div>

                {/* Modifications */}
                {!detail.isPlain && (
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {detail.avoid && (
                      <div className="rounded-lg px-3 py-2"
                        style={{ background: "#fef2f2", border: "1px solid #ef444440" }}>
                        <p className="text-[10px] font-black text-orange-700 uppercase tracking-wide">
                          ✕ {isRtl ? "ممنوع" : "Avoid"}
                        </p>
                        <p className="text-xs font-bold text-orange-800 mt-0.5 leading-tight">
                          {detail.avoid}
                        </p>
                      </div>
                    )}
                    {detail.preferences && (
                      <div className="rounded-lg px-3 py-2"
                        style={{ background: "#ecfeff", border: "1px solid #a5f3fc" }}>
                        <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: "#0891b2" }}>
                          ★ {isRtl ? "تفضيلات" : "Prefs"}
                        </p>
                        <p className="text-xs font-semibold mt-0.5 leading-tight" style={{ color: "#155e75" }}>
                          {detail.preferences}
                        </p>
                      </div>
                    )}
                    {detail.portions && (
                      <div className="rounded-lg px-3 py-2"
                        style={{ background: "#eaf1f7", border: "1px solid #47759c40" }}>
                        <p className="text-[10px] font-black text-[#47759c] uppercase tracking-wide">
                          ⚖ {isRtl ? "الكمية" : "Portion"}
                        </p>
                        <p className="text-xs font-semibold text-yellow-900 mt-0.5 leading-tight">
                          {detail.portions}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Special notes */}
                {detail.specialNotes && (
                  <div className="mt-2 rounded-lg px-3 py-2 flex items-start gap-2"
                    style={{ background: "#eaf1f7", border: "1px solid #47759c50" }}>
                    <span className="text-blue-500 flex-shrink-0">📝</span>
                    <p className="text-xs font-semibold text-blue-900 leading-tight">
                      {detail.specialNotes}
                    </p>
                  </div>
                )}
              </div>
            );

            return (
              <>
                {/* قسم المعدّل */}
                {modifiedMeals.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />
                      <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full"
                        style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                        ⚠ {isRtl ? `معدّل (${modifiedMeals.length})` : `Modified (${modifiedMeals.length})`}
                      </span>
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />
                    </div>
                    <div className="space-y-2.5 mb-5">
                      {modifiedMeals.map((d, i) => renderItem(d, i))}
                    </div>
                  </>
                )}

                {/* قسم العادي */}
                {plainMeals.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #10b981, transparent)" }} />
                      <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full"
                        style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                        ✓ {isRtl ? `عادي (${plainMeals.length})` : `Plain (${plainMeals.length})`}
                      </span>
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #10b981, transparent)" }} />
                    </div>
                    <div className="space-y-2.5">
                      {plainMeals.map((d, i) => renderItem(d, i + modifiedMeals.length))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
