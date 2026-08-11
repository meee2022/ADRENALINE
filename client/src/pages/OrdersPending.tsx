import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { ClipboardList, CheckCircle2, ChefHat, Store, Sparkles, UtensilsCrossed, Hash, Flame, Clock3, Phone, ChevronLeft } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

/** التبويبات: قيد المراجعة / المعتمدة / الكل */
type Tab = "pending" | "confirmed" | "all";
type RestaurantFilter = "ALL" | "ADRENALINE" | "NUTRI_RESET";

const STATUS_LABEL: Record<string, { ar: string; en: string; cls: string }> = {
  pending:   { ar: "قيد المراجعة", en: "Pending",   cls: "bg-amber-50 text-amber-700" },
  confirmed: { ar: "معتمد",        en: "Approved",  cls: "bg-emerald-50 text-emerald-700" },
  active:    { ar: "نشط",          en: "Active",    cls: "bg-emerald-50 text-emerald-700" },
  completed: { ar: "مكتمل",        en: "Completed", cls: "bg-slate-100 text-slate-700" },
  cancelled: { ar: "ملغي",         en: "Cancelled", cls: "bg-red-50 text-red-700" },
};

const isSmartPlanOrder = (notes: unknown) =>
  /smart meal generator|smart plan|مول[ّ]?د الوجبات الذكي|الخطة الذكية/i.test(String(notes || ""));

const isSmartPlanSystemNote = (notes: unknown) =>
  /^(weekly plan from the smart meal generator|order from the smart meal generator)$/i.test(String(notes || "").trim());

export default function OrdersPending() {
  const [, navigate] = useLocation();
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const [tab, setTab] = useState<Tab>("pending");
  const [restaurantFilter, setRestaurantFilter] = useState<RestaurantFilter>("ALL");

  // status: undefined = كل الطلبات؛ وإلا يفلتر على السيرفر
  const orders = useQuery(api.customerOrders.list, {
    status: tab === "all" ? undefined : tab,
    restaurantKey: restaurantFilter === "ALL" ? undefined : restaurantFilter,
    limit: 200,
    sessionToken,
  });
  const pendingCount = useQuery(api.customerOrders.countPending);

  // ✅ أسبوع الدورة الذي يطبخه المطبخ حالياً — يوجّه اختيار العميل والخطة الذكية
  const settings = useQuery(api.restaurantSettings.get);
  const setCookingWeek = useMutation(api.restaurantSettings.setCookingWeek);
  const { toast } = useToast();
  const { dir, language } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const cookingWeek = Number((settings as any)?.currentCookingWeek) || 0;

  if (!orders) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "pending", label: t("قيد المراجعة", "Pending") },
    { key: "confirmed", label: t("المعتمدة", "Approved") },
    { key: "all", label: t("الكل", "All") },
  ];

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        icon={<ClipboardList className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="الطلبات" titleEn="Orders"
        subtitleAr="مراجعة الطلبات المعلقة والرجوع إلى المعتمدة في أي وقت"
        subtitleEn="Review pending orders and revisit approved ones anytime"
        kpis={[
          { value: pendingCount ?? 0, labelAr: "قيد المراجعة", labelEn: "Pending" },
          { value: orders.length, labelAr: "معروض", labelEn: "Showing" },
        ]}
      />

      {/* تبويبات الفلتر */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-5 py-2 rounded-full font-bold text-sm transition-all",
              tab === t.key
                ? "bg-[#0E76AC] text-white shadow-sm"
                : "bg-white text-[#47759C] border border-gray-200 hover:border-[#3CC4F0]",
            )}
          >
            {t.label}
            {t.key === "pending" && (pendingCount ?? 0) > 0 && (
              <span className="mr-1.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-black bg-amber-400 text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label={t("تصفية الطلبات حسب المطعم", "Filter orders by restaurant")}>
        {([
          ["ALL", t("كل المطاعم", "All restaurants")],
          ["ADRENALINE", "Adrenaline"],
          ["NUTRI_RESET", "Nutri Reset"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setRestaurantFilter(key)}
            className={cn("rounded-xl border px-4 py-2 text-xs font-black transition-colors",
              restaurantFilter === key
                ? key === "NUTRI_RESET" ? "border-[#22AEC0] bg-[#22AEC0] text-white" : "border-[#0E76AC] bg-[#0E76AC] text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-sky-300")}
          >{label}</button>
        ))}
      </div>

      {/* ✅ أسبوع المطبخ الحالي — يوجّه المنيو والخطة الذكية */}
      <Card
        className="p-4 bg-white rounded-2xl flex items-center gap-4 flex-wrap"
        style={{ border: "1px solid #cfe4f3", boxShadow: "0 1px 2px rgba(15,21,22,.04)" }}
      >
        <div className="flex items-center gap-2 text-[#0E2A4A] font-bold">
          <ChefHat className="h-5 w-5 text-[#0E76AC]" />
          {isRtl ? "أسبوع الدورة الذي يطبخه المطبخ الآن:" : "Kitchen is cooking rotation week:"}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((w) => (
            <button
              key={w}
              onClick={async () => {
                await setCookingWeek({ week: w, sessionToken });
                toast({ title: isRtl ? `تم ضبط المطبخ على الأسبوع ${w}` : `Kitchen set to week ${w}` });
              }}
              className={cn(
                "w-10 h-10 rounded-full font-black transition-all",
                cookingWeek === w
                  ? "bg-[#0E76AC] text-white shadow-md scale-105"
                  : "bg-white text-[#47759C] border border-gray-200 hover:border-[#0E76AC]",
              )}
            >
              {w}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#47759C] w-full">
          {isRtl
            ? "العميل يختار وجبات هذا الأسبوع تلقائياً، فيصل للمطبخ ما يُطبخ فعلاً — بلا لخبطة."
            : "Customers default to this week, so the kitchen gets what it actually cooks."}
        </p>
        {(settings as any)?.cookingWeekAdvancedOn && (
          <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 w-full">
            {isRtl
              ? `يتقدّم تلقائياً كل جمعة (يجهّز المطبخ للسبت). آخر تقدّم/ضبط: ${(settings as any).cookingWeekAdvancedOn}. لو المطبخ متأخّر، اضبط الرقم يدوياً.`
              : `Auto-advances every Friday (kitchen preps for Saturday). Last change: ${(settings as any).cookingWeekAdvancedOn}. If the kitchen is behind, set it manually.`}
          </p>
        )}
      </Card>

      {/* Orders List */}
      {orders.length === 0 ? (
        <Card
          className="p-12 text-center bg-white rounded-2xl"
          style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}
        >
          <div className="h-16 w-16 mx-auto rounded-2xl bg-[#e8f8fd] flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-[#3cc4f0]" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {t("رائع! لا توجد طلبات معلقة", "Great! No pending orders")}
          </h3>
          <p className="text-gray-500">
            {tab === "pending" ? t("تم مراجعة جميع الطلبات", "All orders have been reviewed") : t("لا توجد طلبات في هذا التصنيف", "No orders in this category")}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => {
            const isNutriResetOrder = (order as any).restaurantKey === "NUTRI_RESET";
            const isSmartOrder = isSmartPlanOrder(order.notes);
            const createdDate = (() => {
              const d = order.createdAt ? new Date(order.createdAt) : null;
              return d && !isNaN(d.getTime())
                ? format(d, "dd MMMM yyyy - hh:mm a", { locale: isRtl ? ar : enUS })
                : t("غير محدد", "Not specified");
            })();
            const orderStats = [
              { label: t("رقم الطلب", "Order number"), value: order.orderNumber, icon: Hash },
              { label: t("إجمالي الوجبات", "Total meals"), value: `${order.totalMeals} ${t("وجبة", "meals")}`, icon: UtensilsCrossed },
              { label: t("إجمالي السعرات", "Total calories"), value: `${order.totalCalories.toLocaleString()} ${t("سعرة", "kcal")}`, icon: Flame },
              { label: t("وقت إرسال الطلب", "Submitted on"), value: createdDate, icon: Clock3 },
            ];

            return (
              <Card
                key={order._id}
                className="p-6 bg-white rounded-2xl cursor-pointer hover:-translate-y-0.5 transition-all"
                style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}
                onClick={() => navigate(`/orders/review/${order._id}`)}
              >
                <div className={cn(
                  "-mx-6 -mt-6 mb-5 flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-t-2xl px-5 py-3 text-white",
                  isNutriResetOrder ? "bg-[#079AA5]" : "bg-[#0E76AC]",
                )}>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      isNutriResetOrder ? "bg-[#F47721]" : "bg-[#3AC7F4]",
                    )}>
                      <Store className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold leading-none text-white/80">
                        {t("مصدر الطلب", "Order restaurant")}
                      </p>
                      <p className="mt-1 text-lg font-black leading-none tracking-wide">
                        {isNutriResetOrder ? "NUTRI RESET" : "ADRENALINE"}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black",
                    isSmartOrder ? "border-violet-200 bg-violet-50 text-violet-800" : "border-emerald-200 bg-emerald-50 text-emerald-800",
                  )}>
                    {isSmartOrder ? <Sparkles className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
                    {isSmartOrder
                      ? t("خطة ذكية مولّدة تلقائيًا", "AI-generated smart plan")
                      : t("خطة باختيار يدوي من المشترك", "Customer-selected manual plan")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn(
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white",
                      isNutriResetOrder ? "bg-[#079AA5]" : "bg-[#0E76AC]",
                    )}>
                      {order.customerName?.[0]?.toUpperCase() || "؟"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-black text-slate-900">{order.customerName}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-500" dir="ltr">
                        <Phone className="h-3.5 w-3.5" />
                        {order.customerPhone}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "rounded-full border px-4 py-2 text-sm font-black whitespace-nowrap",
                    STATUS_LABEL[order.status]?.cls || "border-slate-200 bg-slate-100 text-slate-700",
                  )}>
                    {(isRtl ? STATUS_LABEL[order.status]?.ar : STATUS_LABEL[order.status]?.en) || order.status}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {orderStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3.5">
                        <span className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          isNutriResetOrder ? "bg-[#E6F7F6] text-[#087E87]" : "bg-sky-100 text-[#0E76AC]",
                        )}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-500">{stat.label}</p>
                          <p className="mt-0.5 truncate text-sm font-black text-slate-900" title={String(stat.value)}>{stat.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Notes */}
                {order.notes && !isSmartPlanSystemNote(order.notes) && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{t("ملاحظات العميل:", "Customer notes:")}</p>
                    <p className="text-sm text-gray-700">{order.notes}</p>
                  </div>
                )}

                {/* Action Hint */}
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <p className="text-sm font-black text-[#47759c]">
                    {order.status === "pending" ? t("اضغط للمراجعة التفصيلية", "Tap for detailed review") : t("اضغط لعرض التفاصيل", "Tap to view details")}
                  </p>
                  <ChevronLeft className={cn("h-4 w-4 text-[#47759c]", !isRtl && "rotate-180")} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
