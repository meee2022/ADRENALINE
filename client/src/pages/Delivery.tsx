/**
 * @file client/src/pages/Delivery.tsx
 * @description شاشة التوصيل - تتبع وتسليم الطلبات
 * @convex convex/dailyPlans.ts, convex/customers.ts
 */
import { useState, useMemo } from "react";
import { useDailyPlans, useUpdateDailyPlan, useCustomers } from "@/lib/api";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MapPin, Phone, Map, Bell, Sun, Moon, Check, Printer, Truck, MapPinned, Loader2, UserCog, Link2, Clock, Radio, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { confirmDialog } from "@/lib/dialogs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DeliveryMap } from "@/components/DeliveryMap";
import { useStore } from "@/lib/store";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";

export default function Delivery() {
  const { language, dir } = useLanguage();
  const isRtl = language === "ar" || dir === "rtl";
  const dateLocale = language === "ar" ? ar : enUS;
  const { toast } = useToast();

  const [date, setDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"MORNING" | "EVENING">("MORNING");

  const formattedDate = format(date, "yyyy-MM-dd");

  const { data: dailyPlans = [] } = useDailyPlans();
  const { data: customers = [] } = useCustomers();
  const updatePlanMutation = useUpdateDailyPlan();

  const sessionTok = useStore((s) => s.sessionToken) || undefined;
  // ✅ لوحة التوصيل الحيّة: سائقون + إسناد + تحليلات + روابط تتبع
  const drivers = useQuery(api.delivery.listDrivers, { sessionToken: sessionTok }) as any[] | undefined;
  const board = useQuery(api.delivery.supervisorBoard, { date: formattedDate, deliveryTime: activeTab, sessionToken: sessionTok }) as any;
  const assignShift = useMutation(api.delivery.assignShift);
  const assignMany = useMutation(api.delivery.assignMany);
  const [areaDriver, setAreaDriver] = useState<Record<string, string>>({});
  const [assigningArea, setAssigningArea] = useState(false);
  const markDeliveredMut = useMutation(api.delivery.markDelivered);
  const rescheduleMut = useMutation(api.delivery.reschedule);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [assigning, setAssigning] = useState(false);
  const trackBase = typeof window !== "undefined" ? window.location.origin : "";

  // ✅ الطلبات النشطة: جاهزة/في الطريق/فشلت (لا تختفي، والفاشلة تظهر لإعادة الجدولة)
  const plans = dailyPlans.filter(
    (p: any) =>
      p.date === formattedDate &&
      p.deliveryTime === activeTab &&
      (p.status === "PREPARED" || p.status === "OUT_FOR_DELIVERY" || p.status === "FAILED")
  );

  const handleReschedule = async (planId: string) => {
    try {
      await rescheduleMut({ planId: planId as any, sessionToken: sessionTok });
      toast({ title: isRtl ? "أُعيدت الجدولة — جاهزة للتوصيل" : "Rescheduled — ready to deliver" });
    } catch (e: any) {
      toast({ title: String(e?.message || e), variant: "destructive" });
    }
  };

  const boardByPlan: Record<string, any> = {};
  for (const s of (board?.stops || [])) boardByPlan[String(s.planId)] = s;
  const exceptions = (board?.stops || []).filter((s: any) =>
    s.status === "FAILED"
    || !s.driverId
    || (s.status === "OUT_FOR_DELIVERY" && s.outForDeliveryAt && Date.now() - s.outForDeliveryAt > 90 * 60 * 1000)
  );

  const handleAssign = async () => {
    if (!selectedDriver) { toast({ title: isRtl ? "اختر سائقاً أولاً" : "Pick a driver", variant: "destructive" }); return; }
    setAssigning(true);
    try {
      const r: any = await assignShift({ date: formattedDate, deliveryTime: activeTab, driverId: selectedDriver as any, sessionToken: sessionTok });
      toast({ title: isRtl ? "تم الإسناد وترتيب المسار" : "Assigned & routed", description: isRtl ? `${r.assigned} محطة` : `${r.assigned} stops` });
    } catch (e: any) {
      toast({ title: String(e?.message || e), variant: "destructive" });
    } finally { setAssigning(false); }
  };

  const copyTrack = (token?: string) => {
    if (!token) return;
    const url = `${trackBase}/track/${token}`;
    navigator.clipboard?.writeText(url).then(
      () => toast({ title: isRtl ? "تم نسخ رابط التتبع" : "Tracking link copied" }),
      () => window.prompt(isRtl ? "انسخ الرابط:" : "Copy link:", url),
    );
  };

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

      // ✅ عبر النظام الموحّد (يضبط deliveredAt + التحليلات + الصلاحية)
      await markDeliveredMut({ planId: planId as any, sessionToken: sessionTok });
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
          if (await confirmDialog({ message: isRtl ? "إرسال رسالة شكر للعميل عبر واتساب؟" : "Send thank-you WhatsApp message?" })) {
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

  // ✅ محطات اليوم مرتّبة حسب المنطقة + رابط المسار الكامل للسائق
  const sortedPlans = [...plans].sort((a: any, b: any) =>
    getArea(getCustomer(a.customerId)?.address).localeCompare(getArea(getCustomer(b.customerId)?.address), "ar"));
  const routeUrl = buildRouteUrl(sortedPlans.map((p: any) => getCustomer(p.customerId)?.address).filter(Boolean) as string[]);

  // ✅ مناطق شيفت اليوم (من العناوين) + عدد المحطات لكل منطقة — للإسناد بالمنطقة
  const areaGroups = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of sortedPlans) {
      const a = getArea(getCustomer(p.customerId)?.address);
      counts[a] = (counts[a] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count);
  }, [sortedPlans]);

  const handleAssignByArea = async () => {
    const assignments = sortedPlans
      .map((p: any) => {
        const area = getArea(getCustomer(p.customerId)?.address);
        const driverId = areaDriver[area];
        return driverId ? { planId: p._id, driverId } : null;
      })
      .filter(Boolean) as { planId: string; driverId: string }[];
    if (!assignments.length) { toast({ title: isRtl ? "اختر سائقاً لمنطقة واحدة على الأقل" : "Pick a driver for at least one area", variant: "destructive" }); return; }
    setAssigningArea(true);
    try {
      const r: any = await assignMany({ assignments: assignments as any, sessionToken: sessionTok });
      toast({ title: isRtl ? "تم الإسناد بالمنطقة" : "Assigned by area", description: isRtl ? `${r.assigned} محطة على ${r.drivers} سائق` : `${r.assigned} stops across ${r.drivers} drivers` });
    } catch (e: any) {
      toast({ title: isRtl ? "تعذّر الإسناد" : "Assign failed", description: String(e?.message || e), variant: "destructive" });
    } finally { setAssigningArea(false); }
  };

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
          {...(() => {
            // 🚚 التاريخ وحده يُربك: الخطط تفتح على الغد والمطبخ على الغد
            //    والتوصيل على اليوم — والثلاثة تعني **يوم التوصيل**. نُسمّي
            //    الموقع بالاسم كما تفعل الصفحتان الأخريان، فلا يظن السائق
            //    أنه ينظر إلى يوم غير الذي يوصّل فيه.
            const isTodayDate = formattedDate === format(new Date(), "yyyy-MM-dd");
            const d = format(date, "EEEE, d MMMM yyyy", { locale: dateLocale });
            return {
              subtitleAr: isTodayDate ? `🚚 توصيل اليوم — ${d}` : `توصيل — ${d}`,
              subtitleEn: isTodayDate ? `🚚 Today's delivery — ${d}` : `Delivery — ${d}`,
            };
          })()}
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

      {/* ── إسناد السائق + تحليلات الجولة ── */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <UserCog className="h-5 w-5 text-[#0E76AC]" />
            <span className="text-sm font-black text-gray-800">{isRtl ? "إسناد الجولة لسائق" : "Assign shift to driver"}</span>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="h-10 rounded-xl border border-gray-200 px-3 text-sm font-bold text-gray-700 bg-white"
            >
              <option value="">{isRtl ? "اختر السائق…" : "Pick driver…"}</option>
              {(drivers || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            <button onClick={handleAssign} disabled={assigning || !selectedDriver}
              className="h-10 px-4 rounded-xl text-white text-sm font-black disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              {assigning ? "…" : (isRtl ? "أسند ورتّب المسار" : "Assign & route")}
            </button>
            {(!drivers || drivers.length === 0) && (
              <span className="text-[11px] text-amber-600 font-bold">{isRtl ? "لا يوجد سائقون — أضف مستخدماً بدور DELIVERY" : "No drivers — add a DELIVERY user"}</span>
            )}
          </div>

          {/* ── إسناد بالمنطقة: كل منطقة لسائق (تقسيم على أكتر من سائق) ── */}
          {drivers && drivers.length > 0 && areaGroups.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <UserCog className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-black text-gray-800">{isRtl ? "أو: قسّم بالمنطقة على السواقين" : "Or: split by area across drivers"}</span>
                <span className="text-[11px] text-slate-400 font-bold">{areaGroups.length} {isRtl ? "منطقة" : "areas"}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {areaGroups.map(({ area, count }) => (
                  <div key={area} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{area}</p>
                      <p className="text-[10px] font-bold text-slate-400">{count} {isRtl ? "محطة" : "stops"}</p>
                    </div>
                    <select
                      value={areaDriver[area] || ""}
                      onChange={(e) => setAreaDriver((prev) => ({ ...prev, [area]: e.target.value }))}
                      className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-bold text-gray-700 bg-white shrink-0 max-w-[45%]"
                    >
                      <option value="">{isRtl ? "سائق…" : "Driver…"}</option>
                      {(drivers || []).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={handleAssignByArea} disabled={assigningArea}
                className="mt-2 h-10 px-4 rounded-xl text-white text-sm font-black disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#10b981,#0E766E)" }}>
                {assigningArea ? "…" : (isRtl ? "أسند المناطق ورتّب مسار كل سائق" : "Assign areas & route each driver")}
              </button>
            </div>
          )}

          {/* تحليلات مباشرة */}
          {board?.analytics && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
              {[
                { l: isRtl ? "قيد الانتظار" : "Pending", v: board.analytics.pending, c: "#64748b" },
                { l: isRtl ? "في الطريق" : "On the way", v: board.analytics.outForDelivery, c: "#0E76AC" },
                { l: isRtl ? "تم التسليم" : "Delivered", v: board.analytics.delivered, c: "#10b981" },
                { l: isRtl ? "تعذّر" : "Failed", v: board.analytics.failed ?? 0, c: "#ef4444" },
                { l: isRtl ? "متوسط التوصيل" : "Avg time", v: board.analytics.avgDeliveryMinutes != null ? `${board.analytics.avgDeliveryMinutes}د` : "—", c: "#47759c" },
              ].map((x, i) => (
                <div key={i} className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-center">
                  <div className="text-xl font-black tabular-nums" style={{ color: x.c }}>{x.v}</div>
                  <div className="text-[10px] font-bold text-slate-400">{x.l}</div>
                </div>
              ))}
            </div>
          )}

          {exceptions.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                  <div>
                    <p className="text-sm font-black text-amber-950">{isRtl ? "تحتاج تدخل المسؤول" : "Needs supervisor attention"}</p>
                    <p className="text-[11px] font-bold text-amber-700">{isRtl ? "ابدأ بهذه الحالات قبل مراجعة القائمة كاملة" : "Handle these before reviewing the full list"}</p>
                  </div>
                </div>
                <span className="min-w-8 h-8 px-2 rounded-full bg-amber-200 text-amber-950 grid place-items-center text-xs font-black tabular-nums">{exceptions.length}</span>
              </div>
              <div className="divide-y divide-amber-200">
                {exceptions.slice(0, 8).map((s: any) => {
                  const reason = s.status === "FAILED"
                    ? (isRtl ? `تعذّر: ${s.failReason || "بدون سبب"}` : `Failed: ${s.failReason || "No reason"}`)
                    : !s.driverId
                      ? (isRtl ? "لم يتم إسناد سائق" : "No driver assigned")
                      : (isRtl ? "في الطريق منذ أكثر من 90 دقيقة" : "On the way for over 90 minutes");
                  return (
                    <div key={s.planId} className="px-4 py-3 flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${s.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {s.status === "FAILED" ? "!" : <Clock className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{s.customerName}</p>
                        <p className="text-[11px] font-bold text-slate-600">{reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.phone && <a href={`tel:${s.phone}`} className="h-10 px-3 rounded-xl bg-white border border-amber-200 text-[#0E76AC] text-xs font-black flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{isRtl ? "اتصال" : "Call"}</a>}
                        {s.status === "FAILED" && <button onClick={() => handleReschedule(String(s.planId))} className="h-10 px-3 rounded-xl bg-[#0E76AC] text-white text-xs font-black">{isRtl ? "إعادة جدولة" : "Reschedule"}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* تقدّم كل سائق */}
          {board?.analytics?.perDriver?.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {board.analytics.perDriver.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 w-24 truncate">{d.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.total ? (d.delivered / d.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[11px] font-black text-slate-500 tabular-nums">{d.delivered}/{d.total}</span>
                </div>
              ))}
            </div>
          )}
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
                        {(() => {
                          const bs = boardByPlan[String(plan._id)];
                          const onWay = plan.status === "OUT_FOR_DELIVERY";
                          const failed = plan.status === "FAILED";
                          return (
                            <div className="flex flex-col items-end gap-1">
                              <Badge className={cn("border-0 text-xs px-3 py-1 rounded-full font-semibold",
                                failed ? "bg-red-500 text-white" : onWay ? "bg-[#0E76AC] text-white" : "bg-[#e8f8fd] text-[#0E76AC]")}>
                                {failed ? (isRtl ? "✕ تعذّر" : "✕ Failed") : onWay ? (isRtl ? "🚚 في الطريق" : "🚚 On the way") : (isRtl ? "جاهز" : "Ready")}
                              </Badge>
                              {failed && bs?.failReason && (
                                <span className="text-[10px] text-red-600 font-bold max-w-[220px] text-left">
                                  {bs.failReason}
                                  {bs.retryAction ? ` · ${bs.retryAction === "RETRY_TODAY" ? (isRtl ? "إعادة اليوم" : "Retry today") : bs.retryAction === "MOVE_EVENING" ? (isRtl ? "تحويل للمسائي" : "Move to evening") : bs.retryAction === "RESCHEDULE_TOMORROW" ? (isRtl ? "جدولة للغد" : "Tomorrow") : (isRtl ? "تواصل المشرف" : "Supervisor contact")}` : ""}
                                </span>
                              )}
                              {bs?.driverName && (
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                  <Truck className="h-3 w-3" />{bs.driverName}
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
                          className="h-12 px-4 rounded-xl border border-gray-200 text-[#0E76AC] hover:bg-[#f7fbfe] font-bold"
                          onClick={() => window.open(`tel:${customer.phone}`)}
                        >
                          <Phone className="h-5 w-5" />
                        </Button>
                        {(() => {
                          const bs = boardByPlan[String(plan._id)];
                          return bs?.trackToken ? (
                            <Button
                              variant="outline"
                              className="h-12 px-4 rounded-xl border border-cyan-200 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 font-bold"
                              title={isRtl ? "نسخ رابط تتبع العميل" : "Copy customer tracking link"}
                              onClick={() => copyTrack(bs.trackToken)}
                            >
                              <Link2 className="h-5 w-5" />
                            </Button>
                          ) : null;
                        })()}
                        {plan.status === "FAILED" ? (
                          <Button
                            className="flex-1 h-12 rounded-xl text-white font-bold shadow-md bg-amber-500 hover:bg-amber-600"
                            onClick={() => handleReschedule(plan._id)}
                          >
                            {isRtl ? "♻ إعادة جدولة" : "♻ Reschedule"}
                          </Button>
                        ) : (
                          <Button
                            className="flex-1 h-12 rounded-xl text-white font-bold shadow-md" style={{background:"linear-gradient(135deg,#3cc4f0,#0E76AC)"}}
                            onClick={() => handleDeliver(plan._id)}
                          >
                            <Check className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                            {isRtl ? "إتمام التسليم" : "Complete"}
                          </Button>
                        )}
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
                              {isRtl ? "تم التوصيل" : "Delivered"}{(() => {
                                const d = plan.deliveredAt ? new Date(plan.deliveredAt) : null;
                                return d && !isNaN(d.getTime()) ? " • " + format(d, "HH:mm", { locale: dateLocale }) : "";
                              })()}
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
