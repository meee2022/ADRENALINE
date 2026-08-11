import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { ClipboardList, CheckCircle2, ChefHat } from "lucide-react";
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
            const createdDate = (() => {
              const d = order.createdAt ? new Date(order.createdAt) : null;
              return d && !isNaN(d.getTime())
                ? format(d, "dd MMMM yyyy - hh:mm a", { locale: isRtl ? ar : enUS })
                : t("غير محدد", "Not specified");
            })();

            return (
              <Card
                key={order._id}
                className="p-6 bg-white rounded-2xl cursor-pointer hover:-translate-y-0.5 transition-all"
                style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}
                onClick={() => navigate(`/orders/review/${order._id}`)}
              >
                <div className="flex items-start justify-between">
                  {/* Right Side - Customer Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
                        {order.customerName?.[0]?.toUpperCase() || "؟"}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          {order.customerName}
                          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black",
                            (order as any).restaurantKey === "NUTRI_RESET"
                              ? "bg-[#E9F9FB] text-[#16899A]"
                              : "bg-sky-50 text-[#0E76AC]")}
                          >{(order as any).restaurantKey === "NUTRI_RESET" ? "Nutri Reset" : "Adrenaline"}</span>
                          {order.notes?.includes("مولّد الوجبات الذكي") && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ background: "linear-gradient(135deg,#3AC7F4,#0E76AC)" }}>
                              {t("✨ خطة ذكية — راجِع", "✨ Smart plan — review")}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {order.customerPhone}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("رقم الطلب", "Order No.")}</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {order.orderNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("عدد الوجبات", "Meals count")}</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {order.totalMeals} {t("وجبة", "meals")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("السعرات الكلية", "Total calories")}</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {order.totalCalories.toLocaleString()} {t("سعرة", "kcal")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("تاريخ الإرسال", "Submitted on")}</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {createdDate}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Left Side - Status Badge */}
                  <div className="mr-4">
                    <div className={cn(
                      "px-4 py-1.5 rounded-full font-semibold text-sm whitespace-nowrap",
                      STATUS_LABEL[order.status]?.cls || "bg-slate-100 text-slate-700",
                    )}>
                      {(isRtl ? STATUS_LABEL[order.status]?.ar : STATUS_LABEL[order.status]?.en) || order.status}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{t("ملاحظات العميل:", "Customer notes:")}</p>
                    <p className="text-sm text-gray-700">{order.notes}</p>
                  </div>
                )}

                {/* Action Hint */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-[#47759c] font-semibold text-center">
                    {order.status === "pending" ? t("اضغط للمراجعة التفصيلية", "Tap for detailed review") : t("اضغط لعرض التفاصيل", "Tap to view details")}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
