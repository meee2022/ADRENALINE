/**
 * @file client/src/pages/PlansReview.tsx
 * @description المراجعة النهائية والاعتماد - مراجعة جميع الخطط قبل الإرسال للمطبخ
 */
import { useState, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import {
  useCustomers,
  useCategories,
  useMenuItems,
  useModifiers,
  useDailyPlans,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Utensils,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Send,
  MoreVertical,
  Truck,
  Bell,
  CheckCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

export default function PlansReviewPage() {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Get date from URL params
  const [, params] = useRoute("/plans-review/:date");
  const dateStr = params?.date || format(new Date(), "yyyy-MM-dd");
  const date = new Date(dateStr);

  const { data: customers = [] } = useCustomers();
  const { data: categories = [] } = useCategories();
  const { data: menuItems = [] } = useMenuItems();
  const { data: modifiers = [] } = useModifiers();
  const { data: dailyPlans = [] } = useDailyPlans(dateStr);

  const dateLocale = isRtl ? ar : enUS;

  // Statistics
  const stats = useMemo(() => {
    const confirmed = dailyPlans.filter((p: any) => p.status === "CONFIRMED").length;
    const total = dailyPlans.length;
    
    // Count special requests and delivery times
    const specialRequests = dailyPlans.filter((p: any) => {
      const customer = customers.find((c: any) => c._id === p.customerId);
      return customer?.allergies || p.notes;
    }).length;

    const deliveryGroups = dailyPlans.reduce((acc: any, p: any) => {
      const customer = customers.find((c: any) => c._id === p.customerId);
      const time = customer?.deliveryTime || "Unknown";
      acc[time] = (acc[time] || 0) + 1;
      return acc;
    }, {});

    // Count total meals
    const totalMeals = dailyPlans.reduce((sum: number, p: any) => {
      return sum + (p.items || []).filter((i: any) => !i.isOff && i.menuItemId).length;
    }, 0);

    return {
      confirmed,
      total,
      specialRequests,
      totalMeals,
      deliveryGroups,
    };
  }, [dailyPlans, customers]);

  // Group plans by customer
  const plansList = useMemo(() => {
    return dailyPlans
      .filter((p: any) => p.status === "CONFIRMED")
      .map((plan: any) => {
        const customer = customers.find((c: any) => c._id === plan.customerId);
        return { ...plan, customer };
      })
      .sort((a: any, b: any) => {
        const aName = a.customer?.fullName || "";
        const bName = b.customer?.fullName || "";
        return aName.localeCompare(bName);
      });
  }, [dailyPlans, customers]);

  const handleSendToKitchen = () => {
    toast({
      title: isRtl ? "تم الإرسال للمطبخ" : "Sent to Kitchen",
      description: isRtl
        ? `تم إرسال ${stats.confirmed} خطة للمطبخ بنجاح`
        : `${stats.confirmed} plans sent to kitchen successfully`,
    });
    
    // In a real app, this would trigger an API call
    setTimeout(() => {
      setLocation("/plans");
    }, 1500);
  };

  const getPlanIcons = (plan: any) => {
    const icons = {
      hasAllergies: false,
      hasNotes: false,
      hasModifiers: false,
      allMealsSelected: true,
    };

    if (plan.customer?.allergies) icons.hasAllergies = true;
    if (plan.notes) icons.hasNotes = true;

    (plan.items || []).forEach((item: any) => {
      if (!item.isOff && !item.menuItemId) {
        icons.allMealsSelected = false;
      }
      if (item.modifierIds && item.modifierIds.length > 0) {
        icons.hasModifiers = true;
      }
    });

    return icons;
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setLocation("/plans")}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <MoreVertical className="h-5 w-5 text-gray-600" />
            </button>
            
            <div className="text-center flex-1">
              <h1 className="text-lg font-bold text-gray-900">
                {isRtl ? "المراجعة النهائية والاعتماد" : "Final Review & Approval"}
              </h1>
              <p className="text-sm text-gray-500">
                {stats.confirmed} {isRtl ? "خطة جاهزة للإرسال" : "plans ready to send"}
              </p>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <Utensils className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 mb-1">
              {isRtl ? "إجمالي الوجبات" : "Total Meals"}
            </p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalMeals}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-full bg-orange-100 flex items-center justify-center mb-2">
              <Bell className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-xs text-gray-500 mb-1">
              {isRtl ? "طلبات خاصة" : "Special Requests"}
            </p>
            <p className="text-2xl font-bold text-gray-900">{stats.specialRequests}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-2">
              <Truck className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mb-1">
              {isRtl ? "توصيل (6-9)" : "Delivery (9-6)"}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.deliveryGroups["AM 8-6"] || stats.deliveryGroups["صباحاً (6-8)"] || 0}
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">
                {isRtl ? "مكتمل" : "Complete"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <span className="text-gray-600">
                {isRtl ? "تنبيه حساسية" : "Allergy Alert"}
              </span>
            </div>
          </div>
        </div>

        {/* Plans List Title */}
        <div className="pt-2">
          <h2 className="text-base font-bold text-gray-900">
            {isRtl ? "قائمة المشتركين اليومية" : "Daily Subscribers List"}
          </h2>
        </div>

        {/* Plans List */}
        <div className="space-y-3">
          {plansList.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">
                {isRtl ? "لا توجد خطط مؤكدة لهذا اليوم" : "No confirmed plans for this day"}
              </p>
            </div>
          ) : (
            plansList.map((plan: any, index: number) => {
              const icons = getPlanIcons(plan);
              const mealsCount = (plan.items || []).filter(
                (i: any) => !i.isOff && i.menuItemId
              ).length;

              // Get initials for avatar
              const initials = plan.customer?.fullName
                ?.split(" ")
                .slice(0, 2)
                .map((n: string) => n[0])
                .join("")
                .toUpperCase() || "?";

              return (
                <div
                  key={plan._id}
                  className={cn(
                    "bg-white rounded-xl shadow-sm border overflow-hidden transition-all hover:shadow-md",
                    icons.hasAllergies ? "border-l-4 border-l-red-500" : "border-gray-200"
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={cn(
                            "h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0",
                            icons.hasAllergies
                              ? "bg-gradient-to-br from-red-400 to-red-600"
                              : "bg-gradient-to-br from-cyan-400 to-cyan-600"
                          )}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {icons.hasAllergies && (
                              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                            )}
                            <h3 className="font-bold text-gray-900 truncate">
                              {plan.customer?.fullName || "Unknown"}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500">
                            {plan.customer?.program || "Standard"} • {plan.customer?.deliveryTime || "AM"}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/plans?customer=${plan.customerId}&date=${dateStr}`)}
                        className="text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 text-xs"
                      >
                        {isRtl ? "التفاصيل" : "Details"}
                      </Button>
                    </div>

                    {/* Allergy Warning */}
                    {icons.hasAllergies && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
                        <p className="text-xs font-bold text-red-700 mb-1">
                          {isRtl ? "حساسية شديدة: مكسرات" : "Severe Allergy: Nuts"}
                        </p>
                        <p className="text-xs text-red-800">
                          {plan.customer?.allergies || (isRtl ? "المكسرات، الفول السوداني، الفلفل، البصل" : "Nuts, Peanuts, Pepper, Onion")}
                        </p>
                      </div>
                    )}

                    {/* Delivery Notes */}
                    {plan.notes && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
                        <p className="text-xs font-medium text-blue-700 mb-0.5">
                          {isRtl ? "ملاحظات التوصيل" : "Delivery Notes"}
                        </p>
                        <p className="text-xs text-blue-800">
                          {plan.notes || (isRtl ? "توصيل: صباحي (8 مساءً)" : "Delivery: Morning (8 PM)")}
                        </p>
                      </div>
                    )}

                    {/* Status Icons */}
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center",
                            icons.allMealsSelected ? "bg-green-100" : "bg-gray-100"
                          )}
                        >
                          {icons.allMealsSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                          <CheckCheck className="h-5 w-5 text-green-600" />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center",
                            icons.hasModifiers ? "bg-cyan-100" : "bg-gray-100"
                          )}
                        >
                          <Utensils className={cn("h-5 w-5", icons.hasModifiers ? "text-cyan-600" : "text-gray-400")} />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-40">
        <div className="max-w-3xl mx-auto space-y-3">
          <Button
            onClick={handleSendToKitchen}
            disabled={plansList.length === 0}
            className="w-full h-14 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-base shadow-lg"
          >
            {isRtl ? (
              <>
                <ArrowLeft className="h-5 w-5 ml-2" />
                إرسال للمطبخ الآن
              </>
            ) : (
              <>
                Send to Kitchen Now
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>

          <button
            onClick={() => setLocation("/plans")}
            className="w-full text-center text-sm text-gray-600 hover:text-gray-900 py-2"
          >
            {isRtl ? (
              <>
                <ArrowRight className="h-4 w-4 inline ml-1" />
                رجوع للتعديل والمراجعة
              </>
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 inline mr-1" />
                Back to Edit & Review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
