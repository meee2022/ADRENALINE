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
      details: Array<{ 
        customerName: string; 
        deliveryTime: string;
        categoryName: string;
        avoid?: string; 
        preferences?: string; 
        portions?: string;
        specialNotes?: string;
      }> 
    }> = {};

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
            summary[mealName] = { count: 0, details: [] };
          }

          summary[mealName].count += 1;
          summary[mealName].details.push({
            customerName,
            deliveryTime: plan.deliveryTime,
            categoryName,
            avoid: item.avoid || undefined,
            preferences: item.preferences || undefined,
            portions: item.portions || undefined,
            specialNotes: item.specialNotes || undefined,
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
        status: "PREPARED" as any,
      });
    } catch (error) {
      console.error("Failed to mark as prepared:", error);
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
                    ? "bg-green-500 text-white shadow-md"
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
                      "bg-green-500",
                      "bg-cyan-500",
                      "bg-teal-500",
                      "bg-amber-500",
                      "bg-orange-500",
                      "bg-indigo-500",
                      "bg-blue-500",
                      "bg-emerald-500",
                      "bg-lime-500",
                    ];
                    const color = colors[index % colors.length];

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white rounded-xl p-5 shadow-md hover:shadow-lg transition-all border-2 border-gray-200"
                      >
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
                        <Badge className="bg-green-500 text-white border-0 text-sm px-4 py-2 rounded-xl">
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
                          
                          // ✅ دمج modifiers من modifierIds + البيانات المباشرة من customer
                          const allAvoid = [...avoid];
                          const allPref = [...pref];
                          const allPortions = [...portion];
                          
                          if (item.avoid) allAvoid.push(item.avoid);
                          if (item.preferences) allPref.push(item.preferences);
                          if (item.portions) allPortions.push(item.portions);

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
                                      "bg-orange-100 text-orange-700",
                                    getCategoryLabel(category?.name || item.category || "").includes("LUNCH") &&
                                      "bg-cyan-100 text-cyan-700",
                                    getCategoryLabel(category?.name || item.category || "").includes("DINNER") &&
                                      "bg-indigo-100 text-indigo-700",
                                    getCategoryLabel(category?.name || item.category || "").includes("SNACK") &&
                                      "bg-green-100 text-green-700"
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

                              {/* Modifiers */}
                              {(allAvoid.length > 0 || allPref.length > 0 || allPortions.length > 0) && (
                                <div className="space-y-2">
                                  {/* AVOID - Red and Bold */}
                                  {allAvoid.length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-sm font-bold text-red-700 whitespace-nowrap">
                                        {isRtl ? "ممنوع:" : "Avoid:"} ▲
                                      </span>
                                      <span className="text-sm font-bold text-red-700 flex-1">
                                        {allAvoid.join(isRtl ? "، " : ", ")}
                                      </span>
                                    </div>
                                  )}

                                  {/* PREF - Blue */}
                                  {allPref.length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-sm font-medium text-cyan-700 whitespace-nowrap">
                                        {isRtl ? "تفضيلات:" : "Prefs:"}
                                      </span>
                                      <span className="text-sm text-cyan-700 flex-1">
                                        {allPref.join(isRtl ? "، " : ", ")}
                                      </span>
                                    </div>
                                  )}

                                  {/* PORTION - Green */}
                                  {allPortions.length > 0 && (
                                    <div className="flex items-start gap-2">
                                      <span className="text-sm font-medium text-green-700 whitespace-nowrap">
                                        {isRtl ? "الكمية:" : "Portion:"}
                                      </span>
                                      <span className="text-sm text-green-700 flex-1">
                                        {allPortions.join(isRtl ? "، " : ", ")}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Special Notes */}
                    {plan.notes && plan.notes.trim().length > 0 && (
                      <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-300 mb-4">
                        <div className="flex items-start gap-2">
                          <span className="text-2xl">💬</span>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-amber-900 mb-1 uppercase">
                              {isRtl
                                ? "الرجاء التأكد من تشريح اللحم جيداً وعدم إضافة أي نوع من المكسرات."
                                : "Please ensure meat is well-cooked and do not add any nuts."}
                            </p>
                            <p className="text-sm text-amber-900 font-medium italic">
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
                        className="w-full h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-lg shadow-md"
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
        <div className="p-8 space-y-8">
          {/* Print Header */}
          <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-black">
                {isRtl ? "عرض المطبخ" : "Kitchen Display"}
              </h1>
              <p className="text-lg text-black mt-1">
                {format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-black">
                {isRtl ? "ملخص الوجبات لهذا اليوم" : "Today's Meal Summary"}
              </p>
              <p className="text-base text-black">
                {isRtl ? "إجمالي:" : "Total:"} {plans.length} {isRtl ? "وجبة" : "meals"}
              </p>
            </div>
          </div>

          {/* Print Orders */}
          {plans.map((plan: any, planIdx: number) => {
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
        <div className="fixed bottom-0 left-0 right-0 border-t-2 border-black bg-white p-4 text-center">
          <p className="text-sm text-black">
            Adrenaline Healthy Food Kitchen Management System
          </p>
        </div>
      </div>

      {/* ✅ Meal Details Dialog */}
      <Dialog open={openMealDialog} onOpenChange={setOpenMealDialog}>
        <DialogContent 
          className="max-w-4xl max-h-[85vh] overflow-auto bg-gray-900 text-white border-2 border-gray-700"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <DialogHeader className="border-b border-gray-700 pb-4">
            <DialogTitle className="text-3xl font-bold text-center flex items-center justify-between">
              <span>{selectedMealName}</span>
              <Badge className="bg-green-500 text-white text-2xl px-6 py-2 rounded-xl">
                {selectedMealDetails.length}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-6">
            {/* Header Row */}
            <div className="grid grid-cols-5 gap-3 text-sm font-bold text-gray-400 px-4 pb-2 border-b border-gray-700">
              <div>{isRtl ? "الوقت" : "Time"}</div>
              <div>{isRtl ? "العميل" : "Customer"}</div>
              <div>{isRtl ? "التصنيف" : "Category"}</div>
              <div>{isRtl ? "التفاصيل" : "Details"}</div>
              <div>{isRtl ? "ملاحظات" : "Notes"}</div>
            </div>

            {/* Data Rows */}
            {selectedMealDetails.map((detail, idx) => (
              <div
                key={idx}
                className="grid grid-cols-5 gap-3 items-start bg-gray-800 rounded-xl p-4 border border-gray-700 hover:bg-gray-750 transition-all"
              >
                {/* Time */}
                <div className="flex items-center">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs px-3 py-1.5 border-2",
                      detail.deliveryTime === "MORNING" 
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50" 
                        : "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                    )}
                  >
                    {isRtl ? (detail.deliveryTime === "MORNING" ? "صباحي" : "مسائي") : detail.deliveryTime}
                  </Badge>
                </div>

                {/* Customer Name */}
                <div className="font-bold text-white">
                  {detail.customerName}
                </div>

                {/* Category */}
                <div className="text-gray-300 text-sm">
                  {detail.categoryName || "-"}
                </div>

                {/* Details (Avoid, Prefs, Portions) */}
                <div className="space-y-1.5">
                  {detail.avoid && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-red-400 whitespace-nowrap">
                        {isRtl ? "ممنوع:" : "Avoid:"}
                      </span>
                      <span className="text-xs text-red-300 font-semibold">
                        {detail.avoid}
                      </span>
                    </div>
                  )}
                  {detail.preferences && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-blue-400 whitespace-nowrap">
                        {isRtl ? "تفضيلات:" : "Prefs:"}
                      </span>
                      <span className="text-xs text-blue-300">
                        {detail.preferences}
                      </span>
                    </div>
                  )}
                  {detail.portions && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-green-400 whitespace-nowrap">
                        {isRtl ? "الكمية:" : "Portion:"}
                      </span>
                      <span className="text-xs text-green-300">
                        {detail.portions}
                      </span>
                    </div>
                  )}
                  {!detail.avoid && !detail.preferences && !detail.portions && (
                    <Badge variant="outline" className="text-xs bg-gray-700 text-gray-400 border-gray-600">
                      Standard
                    </Badge>
                  )}
                </div>

                {/* Special Notes */}
                <div className="text-gray-400 text-xs italic">
                  {detail.specialNotes || "-"}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
