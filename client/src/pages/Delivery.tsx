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
import { CheckCircle2, MapPin, Phone, Map, Bell, Sun, Moon, Check, Printer, Truck, MapPinned, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DeliveryMap } from "@/components/DeliveryMap";
import { useStore } from "@/lib/store";
import { useQuery, useAction } from "convex/react";
import { api } from "@/../../convex/_generated/api";

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

  // تحسين المسار: تجميع/ترتيب المحطات حسب المنطقة + فتح كل عنوان في الخرائط
  const getArea = (addr?: string) =>
    !addr ? (isRtl ? "غير محدّد" : "Unknown") : String(addr).split(/[,،\-|]/)[0].trim() || (isRtl ? "غير محدّد" : "Unknown");
  // ✅ توجيه فعلي (turn-by-turn) من موقع السائق الحالي إلى العنوان
  const mapsUrl = (addr?: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr || "Doha Qatar")}&travelmode=driving`;
  // ✅ رابط المسار الكامل: كل المحطات بالترتيب (آخر عنوان = الوجهة، الباقي waypoints)
  const buildRouteUrl = (addresses: string[]) => {
    const list = addresses.map((a) => String(a || "").trim()).filter(Boolean);
    if (list.length === 0) return null;
    const destination = list[list.length - 1];
    const waypoints = list.slice(0, -1).slice(0, 9); // خرائط جوجل تدعم حتى ~9 محطات وسطية
    const wp = waypoints.length ? `&waypoints=${waypoints.map(encodeURIComponent).join("|")}` : "";
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${wp}&travelmode=driving`;
  };

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
        const phone = customer?.phone || (plan as any)?.customerPhone;
        const name = customer?.fullName || (plan as any)?.customerName;
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

  // ✅ محطات اليوم مرتّبة حسب المنطقة + رابط المسار الكامل للسائق
  const sortedPlans = [...plans].sort((a: any, b: any) =>
    getArea(getCustomer(a.customerId)?.address).localeCompare(getArea(getCustomer(b.customerId)?.address), "ar"));
  const routeUrl = buildRouteUrl(sortedPlans.map((p: any) => getCustomer(p.customerId)?.address).filter(Boolean) as string[]);

  // ─── الخريطة ───
  const [showMap, setShowMap] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const settings = useQuery(api.restaurantSettings.get);
  const geocodeAll = useAction(api.geo.geocodeAllCustomers);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const mapStops = sortedPlans
    .map((p: any, idx: number) => {
      const c: any = getCustomer(p.customerId);
      if (!c || c.lat == null || c.lng == null) return null;
      return { id: p._id, name: c.fullName, lat: c.lat, lng: c.lng, address: c.address, phone: c.phone, order: idx + 1 };
    })
    .filter(Boolean) as any[];
  const missingCoords = sortedPlans.filter((p: any) => {
    const c: any = getCustomer(p.customerId);
    return c && c.address && (c.lat == null || c.lng == null);
  }).length;
  const storeOrigin = settings?.storeLat != null && settings?.storeLng != null
    ? { lat: settings.storeLat as number, lng: settings.storeLng as number } : null;

  const handleGeocodeAll = async () => {
    setGeocoding(true);
    try {
      const res: any = await geocodeAll({ sessionToken });
      toast({
        title: isRtl ? "تم تحديد المواقع" : "Locations updated",
        description: isRtl
          ? `تم تحديد ${res.updated} موقع${res.remaining ? ` — متبقٍ ${res.remaining}` : ""}`
          : `Geocoded ${res.updated}${res.remaining ? ` — ${res.remaining} remaining` : ""}`,
      });
    } catch {
      toast({ title: isRtl ? "خطأ" : "Error", description: isRtl ? "تعذّر تحديد المواقع" : "Geocoding failed", variant: "destructive" });
    } finally { setGeocoding(false); }
  };

  return (
    <>
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24 print:hidden">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <DashboardHeader
          icon={<Truck className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="توصيل الطلبات" titleEn="Delivery Orders"
          subtitleAr={format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
          subtitleEn={format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
          kpis={[
            { value: plans.length, labelAr: "للتوصيل", labelEn: "To Deliver" },
            { value: deliveredPlans.length, labelAr: "تم التسليم", labelEn: "Delivered" },
          ]}
          actions={
            <>
              {routeUrl && (
                <Button
                  onClick={() => window.open(routeUrl, "_blank")}
                  className="h-11 rounded-xl font-bold text-white shadow-lg text-sm backdrop-blur-md"
                  style={{ background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)" }}
                  title={isRtl ? "افتح مسار اليوم كامل في خرائط جوجل" : "Open full route in Google Maps"}
                >
                  <Map className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
                  {isRtl ? "المسار الكامل" : "Full Route"}
                </Button>
              )}
              <Button
                onClick={() => window.print()}
                className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm"
                title={isRtl ? "طباعة قائمة التوصيل" : "Print delivery list"}
              >
                <Printer className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
                {isRtl ? "طباعة" : "Print"}
              </Button>
            </>
          }
        />
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 shadow-sm mt-4">
        <div className="max-w-4xl mx-auto">
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

          {/* Map controls */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={() => setShowMap((v) => !v)}
              className={cn(
                "h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all",
                showMap ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              style={showMap ? { background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" } : {}}
            >
              <MapPinned className="h-4 w-4" />
              {showMap ? (isRtl ? "إخفاء الخريطة" : "Hide Map") : (isRtl ? "عرض الخريطة" : "Show Map")}
            </button>
            {missingCoords > 0 && (
              <button
                onClick={handleGeocodeAll}
                disabled={geocoding}
                className="h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-60"
              >
                {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                {isRtl ? `تحديد مواقع ${missingCoords} عنوان` : `Locate ${missingCoords} addresses`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Map panel */}
      {showMap && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          {mapStops.length === 0 ? (
            <div className="rounded-2xl p-8 text-center bg-white" style={{ border: "1px solid #e8eef4" }}>
              <MapPinned className="h-10 w-10 mx-auto mb-3 text-[#3cc4f0]" />
              <p className="text-sm font-semibold text-gray-600">
                {isRtl ? "لا توجد مواقع محدّدة لهذه الجولة بعد" : "No pinned locations for this shift yet"}
              </p>
              {missingCoords > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {isRtl ? "اضغط \"تحديد المواقع\" لتحويل العناوين تلقائياً" : "Use \"Locate addresses\" to geocode them"}
                </p>
              )}
            </div>
          ) : (
            <DeliveryMap stops={mapStops} origin={storeOrigin} height={380} />
          )}
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Ready for Delivery */}
        {plans.length === 0 ? (
          <Card className="rounded-2xl border-dashed" style={{ border: "1.5px dashed #e8eef4" }}>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-20 w-20 rounded-2xl bg-[#f4f8fb] flex items-center justify-center mb-4">
                <Map className="h-10 w-10 text-[#3cc4f0]" />
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
            {sortedPlans
              .map((plan: any, idx: number, arr: any[]) => {
              const customer = getCustomer(plan.customerId);
              if (!customer) return null;
              const area = getArea(customer.address);
              const prevArea = idx > 0 ? getArea(getCustomer(arr[idx - 1].customerId)?.address) : null;
              const newZone = area !== prevArea;

              return (
                <div key={plan._id}>
                  {newZone && (
                    <div className="flex items-center gap-2 mt-4 mb-2 px-1">
                      <MapPin className="h-4 w-4 text-cyan-600" />
                      <span className="text-sm font-bold text-gray-900">{area}</span>
                      <span className="h-px flex-1 bg-gray-200" />
                    </div>
                  )}
                <Card
                  className="bg-white rounded-2xl hover:-translate-y-0.5 transition-all overflow-hidden"
                  style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}
                >
                  <CardContent className="p-0">
                    {/* Header */}
                    <div className="bg-[#f4f8fb] p-4 border-b border-[#e8eef4]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md relative" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
                            {customer.fullName?.charAt(0).toUpperCase()}
                            <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white text-cyan-700 text-[10px] font-black flex items-center justify-center border border-cyan-400 shadow">{idx + 1}</span>
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">
                              {customer.fullName}
                            </h3>
                            <p className="text-xs text-gray-600">
                              {plan.items?.filter((i: any) => !i.isOff).length || 0} {isRtl ? "وجبة" : "meals"} - {customer.program || (isRtl ? "كيتو دايت" : "Keto")}
                            </p>
                            {customer.phone && (
                              <a href={`tel:${customer.phone}`} dir="ltr" className="text-xs font-bold text-[#0E76AC] hover:underline">
                                {customer.phone}
                              </a>
                            )}
                          </div>
                        </div>
                        <Badge className="bg-[#e8f8fd] text-[#0E76AC] border-0 text-xs px-3 py-1 rounded-full font-semibold">
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
                          title={isRtl ? "افتح في الخرائط" : "Open in Maps"}
                          className="h-10 w-10 rounded-lg bg-[#e8f8fd] hover:bg-[#3cc4f0]/20"
                          onClick={() => window.open(mapsUrl(customer.address), "_blank")}
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
                          className="flex-1 h-12 rounded-xl border border-gray-200 text-[#0E76AC] hover:bg-[#f7fbfe] font-bold"
                          onClick={() => window.open(`tel:${customer.phone}`)}
                        >
                          <Phone className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                          {isRtl ? "اتصال" : "Call"}
                        </Button>
                        <Button
                          className="flex-1 h-12 rounded-xl text-white font-bold shadow-md" style={{background:"linear-gradient(135deg,#3cc4f0,#0E76AC)"}}
                          onClick={() => handleDeliver(plan._id)}
                        >
                          <Check className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                          {isRtl ? "إتمام" : "Complete"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </div>
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
                    className="bg-white rounded-2xl opacity-70"
                    style={{ border: "1px solid #e8eef4" }}
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
                              {isRtl ? "تم التوصيل" : "Delivered"}{plan.deliveredAt ? " • " + format(new Date(plan.deliveredAt), "HH:mm", { locale: dateLocale }) : ""}
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
        <div className="overflow-x-auto">
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
        </div>

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
