/**
 * @file client/src/pages/Delivery.tsx
 * @description شاشة التوصيل - تتبع وتسليم الطلبات
 * @convex convex/dailyPlans.ts, convex/customers.ts
 */
import { useState } from "react";
import { useDailyPlans, useUpdateDailyPlan, useCustomers } from "@/lib/api";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MapPin, Phone, Map, Bell, Sun, Moon, Check, Printer } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Delivery() {
  const { language, dir } = useLanguage();
  const dateLocale = language === "ar" ? ar : enUS;
  const { toast } = useToast();

  const [date, setDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"MORNING" | "EVENING">("MORNING");

  const formattedDate = format(date, "yyyy-MM-dd");

  const { data: dailyPlans = [] } = useDailyPlans();
  const { data: customers = [] } = useCustomers();
  const updatePlanMutation = useUpdateDailyPlan();

  // ✅ Delivery يعرض بس الطلبات اللي خلصها المطبخ (PREPARED)
  const plans = dailyPlans.filter(
    (p: any) =>
      p.date === formattedDate &&
      p.deliveryTime === activeTab &&
      p.status === "PREPARED"
  );

  const deliveredPlans = dailyPlans.filter(
    (p: any) =>
      p.date === formattedDate &&
      p.deliveryTime === activeTab &&
      p.status === "DELIVERED"
  );

  const getCustomer = (id: string) => customers.find((c: any) => c._id === id);

  const handleDeliver = async (planId: string) => {
    try {
      // ابحث عن plan + customer قبل التحديث للحصول على بيانات الاتصال
      const plan = plans.find((p: any) => p._id === planId);
      const customer = plan?.customerId ? getCustomer(plan.customerId) : null;

      await updatePlanMutation.mutateAsync({
        id: planId,
        data: { status: "DELIVERED" },
      });
      toast({
        title: isRtl ? "تم التسليم" : "Delivered",
        description: isRtl ? "تم تسليم الطلب بنجاح" : "Order delivered successfully",
      });

      // ✅ رسالة واتساب تلقائية للعميل
      try {
        const { openWhatsApp, WhatsAppTemplates } = await import("@/lib/whatsapp");
        const phone = customer?.phone || plan?.customerPhone;
        const name = customer?.fullName || plan?.customerName;
        if (phone && name) {
          if (confirm(isRtl ? "إرسال رسالة شكر للعميل عبر واتساب؟" : "Send thank-you WhatsApp message?")) {
            openWhatsApp(phone, WhatsAppTemplates.delivered(name));
          }
        }
      } catch {
        // ignore
      }
    } catch (error) {
      console.error("Failed to update plan status:", error);
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: isRtl ? "فشل تحديث الحالة" : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const isRtl = language === "ar" || dir === "rtl";

  return (
    <>
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24 print:hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-6 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isRtl ? "توصيل الطلبات" : "Delivery Orders"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-[#e8f8fd] text-[#3cc4f0] border-[#3cc4f0]/30">
                  {isRtl ? "مراقبة مباشرة" : "Live Tracking"}
                </Badge>
                <p className="text-sm text-gray-600">
                  {format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => window.print()}
                variant="outline"
                size="sm"
                className="h-10 gap-1.5 border-[#3CC4F0] text-[#3CC4F0] hover:bg-[#3CC4F0] hover:text-white"
                title={isRtl ? "طباعة قائمة التوصيل" : "Print delivery list"}
              >
                <Printer className="h-4 w-4" />
                <span className="text-xs">{isRtl ? "طباعة" : "Print"}</span>
              </Button>
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full">
                <Bell className="h-5 w-5 text-gray-600" />
              </Button>
            </div>
          </div>

          {/* Tab Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab("MORNING")}
              className={cn(
                "flex-1 h-14 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-3",
                activeTab === "MORNING"
                  ? "bg-gradient-to-r from-[#3cc4f0] to-[#0ea5e9] text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <Sun className="h-5 w-5" />
              {isRtl ? "الجولة الصباحية" : "Morning Shift"}
            </button>
            <button
              onClick={() => setActiveTab("EVENING")}
              className={cn(
                "flex-1 h-14 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-3",
                activeTab === "EVENING"
                  ? "bg-gradient-to-r from-[#0f1516] to-[#47759c] text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <Moon className="h-5 w-5" />
              {isRtl ? "الجولة المسائية" : "Evening Shift"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Ready for Delivery */}
        {plans.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-200">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Map className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-700 mb-1">
                {isRtl ? "لا توجد طلبات للتوصيل" : "No Orders for Delivery"}
              </p>
              <p className="text-sm text-gray-500">
                {isRtl ? "جميع الطلبات تم توصيلها" : "All orders have been delivered"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {plans.map((plan: any) => {
              const customer = getCustomer(plan.customerId);
              if (!customer) return null;

              return (
                <Card
                  key={plan._id}
                  className="bg-white border-2 border-cyan-400 shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                >
                  <CardContent className="p-0">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 border-b-2 border-cyan-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                            {customer.fullName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">
                              {customer.fullName}
                            </h3>
                            <p className="text-xs text-gray-600">
                              {plan.items?.filter((i: any) => !i.isOff).length || 0} {isRtl ? "وجبة" : "meals"} - {customer.program || (isRtl ? "كيتو دايت" : "Keto")}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-cyan-500 text-white border-0 text-xs px-3 py-1 shadow-md">
                          {isRtl ? "جاهز للتوصيل" : "Ready"}
                        </Badge>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3">
                      {/* Address */}
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            {isRtl ? "العنوان" : "Address"}
                          </p>
                          <p className="text-sm font-bold text-gray-900 leading-relaxed">
                            {customer.address || (isRtl ? "حي الريان، شارع 24، فيلا 22" : "Al-Rayyan District, St. 24, Villa 22")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-lg bg-[#e8f8fd] hover:bg-[#3cc4f0]/20"
                        >
                          <Map className="h-5 w-5 text-[#47759c]" />
                        </Button>
                      </div>

                      {/* Delivery Notes */}
                      {plan.notes && (
                        <div className="p-3 bg-[#eaf1f7] rounded-xl border-2 border-[#47759c]/30">
                          <p className="text-xs font-bold text-[#47759c] mb-1">
                            {isRtl ? "📝 ملاحظات خاصة" : "📝 Special Notes"}
                          </p>
                          <p className="text-sm text-[#0f1516] font-medium">
                            {plan.notes}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          className="flex-1 h-12 rounded-xl border-2 border-cyan-400 text-cyan-600 hover:bg-cyan-50 font-bold"
                          onClick={() => window.open(`tel:${customer.phone}`)}
                        >
                          <Phone className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                          {isRtl ? "اتصال" : "Call"}
                        </Button>
                        <Button
                          className="flex-1 h-12 rounded-xl text-white font-bold shadow-md" style={{background:"linear-gradient(135deg,#3cc4f0,#47759c)"}}
                          onClick={() => handleDeliver(plan._id)}
                        >
                          <Check className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                          {isRtl ? "إتمام" : "Complete"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Delivered Section */}
        {deliveredPlans.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-xl bg-[#e8f8fd] flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-[#3cc4f0]" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {isRtl ? "تم التسليم" : "Delivered"}
              </h2>
              <Badge variant="secondary" className="bg-[#e8f8fd] text-[#3cc4f0] border-0">
                {deliveredPlans.length}
              </Badge>
            </div>
            
            <div className="space-y-2">
              {deliveredPlans.map((plan: any) => {
                const customer = getCustomer(plan.customerId);
                if (!customer) return null;

                return (
                  <Card
                    key={plan._id}
                    className="bg-white border border-gray-200 opacity-60"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-[#e8f8fd] flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-[#3cc4f0]" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-700 text-sm line-through">
                              {customer.fullName}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {isRtl ? "تم التوصيل" : "Delivered"} • {format(new Date(), "HH:mm", { locale: dateLocale })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ─── Print version ─── */}
    <div className="hidden print:block bg-white" dir={isRtl ? "rtl" : "ltr"}>
      <div className="p-6 space-y-5">
        {/* Print header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-black">
              {isRtl ? "قائمة التوصيل" : "Delivery List"}
              {" — "}
              {activeTab === "MORNING" ? (isRtl ? "صباحي" : "Morning") : (isRtl ? "مسائي" : "Evening")}
            </h1>
            <p className="text-base text-black mt-1">
              {format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-black">{plans.length + deliveredPlans.length}</p>
            <p className="text-xs text-black">{isRtl ? "إجمالي العملاء" : "Total customers"}</p>
          </div>
        </div>

        {/* Stats inline */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="font-bold">{isRtl ? "للتوصيل:" : "Pending:"} <span className="text-base">{plans.length}</span></span>
          <span className="font-bold">{isRtl ? "تم التوصيل:" : "Delivered:"} <span className="text-base">{deliveredPlans.length}</span></span>
        </div>

        {/* Delivery table */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th className="border border-black px-2 py-2 w-10 text-center font-bold">#</th>
              <th className="border border-black px-3 py-2 text-right font-bold">{isRtl ? "العميل" : "Customer"}</th>
              <th className="border border-black px-3 py-2 text-right font-bold">{isRtl ? "الهاتف" : "Phone"}</th>
              <th className="border border-black px-3 py-2 text-right font-bold">{isRtl ? "العنوان" : "Address"}</th>
              <th className="border border-black px-3 py-2 text-center font-bold w-20">{isRtl ? "وجبات" : "Meals"}</th>
              <th className="border border-black px-3 py-2 text-center font-bold w-24">{isRtl ? "الحالة" : "Status"}</th>
              <th className="border border-black px-3 py-2 text-center font-bold w-24">{isRtl ? "توقيع" : "Signature"}</th>
            </tr>
          </thead>
          <tbody>
            {[...plans, ...deliveredPlans].map((plan: any, i: number) => {
              const customer = getCustomer(plan.customerId);
              const customerName = customer?.fullName || plan.customerName || (isRtl ? "عميل جديد" : "New customer");
              const phone = customer?.phone || (plan as any).customerPhone || "—";
              const address = customer?.address || "—";
              const mealsCount = (plan.items || []).filter((it: any) => !it.isOff).length;
              const delivered = plan.status === "DELIVERED";
              return (
                <tr key={plan._id} style={{ background: delivered ? "#f9fafb" : "#ffffff" }}>
                  <td className="border border-black px-2 py-2 text-center font-bold">{i + 1}</td>
                  <td className="border border-black px-3 py-2 font-bold">{customerName}</td>
                  <td className="border border-black px-3 py-2 tabular-nums" dir="ltr">{phone}</td>
                  <td className="border border-black px-3 py-2 text-xs">{address}</td>
                  <td className="border border-black px-3 py-2 text-center font-bold">{mealsCount}</td>
                  <td className="border border-black px-3 py-2 text-center text-xs">
                    {delivered ? (isRtl ? "✓ تم التوصيل" : "✓ Delivered") : (isRtl ? "في الانتظار" : "Pending")}
                  </td>
                  <td className="border border-black px-3 py-2"></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div className="border-t border-black mt-6 pt-3 text-center">
          <p className="text-xs text-black">
            Adrenaline Healthy Food — Delivery List — {format(new Date(), "yyyy/MM/dd HH:mm")}
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
