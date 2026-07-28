/**
 * @file client/src/pages/public/TrackOrder.tsx
 * @description صفحة تتبع الطلب للعميل (عامة برابط سرّي) — خط زمني + خريطة حيّة
 *   يتحرّك عليها السائق + ETA + إشارة "السائق قرّب". تتحدّث لحظياً عبر Convex.
 * @convex convex/delivery.ts (tracking)
 */
import { useRoute } from "wouter";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { DeliveryMap } from "@/components/DeliveryMap";
import { CheckCircle2, ChefHat, Truck, Home, Clock, MapPin, Loader2, Radio } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/lib/i18n";

const ORDER: Record<string, number> = { PREPARED: 0, OUT_FOR_DELIVERY: 1, DELIVERED: 2 };

export default function TrackOrder() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const locale = isRtl ? ar : enUS;
  const [, params] = useRoute("/track/:token");
  const token = params?.token || "";
  const info = useQuery(api.delivery.tracking, token ? { token } : "skip") as any;

  const STEPS = [
    { key: "PREPARED", label: t("تجهّزت وجباتك", "Meals prepared"), icon: ChefHat },
    { key: "OUT_FOR_DELIVERY", label: t("السائق في الطريق", "Driver on the way"), icon: Truck },
    { key: "DELIVERED", label: t("تم التوصيل", "Delivered"), icon: Home },
  ];

  if (info === undefined) {
    return <div className="min-h-screen grid place-items-center bg-slate-50"><Loader2 className="h-7 w-7 animate-spin text-cyan-500" /></div>;
  }
  if (info === null) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center" style={{ fontFamily: "Cairo, sans-serif" }}>
        <div>
          <div className="h-16 w-16 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3"><MapPin className="h-8 w-8 text-slate-300" /></div>
          <p className="font-black text-slate-700">{t("رابط التتبع غير صالح", "Invalid tracking link")}</p>
          <p className="text-sm text-slate-400 mt-1">{t("تأكّد من الرابط المُرسل إليك", "Please check the link sent to you")}</p>
        </div>
      </div>
    );
  }

  const stepIdx = ORDER[info.status] ?? 0;
  const stops = info.dest ? [{ id: "home", name: t("منزلك", "Your home"), lat: info.dest.lat, lng: info.dest.lng }] : [];
  const driver = info.driver && info.driver.lat != null ? { lat: info.driver.lat, lng: info.driver.lng } : null;
  const locationAgeMinutes = info.driver?.updatedAt ? Math.max(0, Math.floor((Date.now() - info.driver.updatedAt) / 60000)) : null;
  const locationIsStale = locationAgeMinutes != null && locationAgeMinutes >= 3;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50" style={{ fontFamily: "Cairo, sans-serif" }}>
      {/* Header */}
      <div className="text-white px-5 pb-6" style={{ background: "linear-gradient(135deg, #0E76AC, #0E2A4A)", paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
        <div className="text-[11px] font-black tracking-widest opacity-80">ADRENALINE · {t("تتبّع طلبك", "Track your order")}</div>
        <h1 className="text-2xl font-black mt-1">{t("أهلاً", "Hi")} {info.firstName} 👋</h1>
        <p className="text-sm text-cyan-100/90 font-bold mt-1">
          {info.status === "DELIVERED" ? t("تم توصيل وجباتك 🎉", "Your meals were delivered 🎉") : info.status === "FAILED" ? t("تعذّر توصيل طلبك — سنتواصل معك", "We couldn't deliver — we'll contact you") : info.status === "OUT_FOR_DELIVERY" ? t("سائقنا في الطريق إليك 🚚", "Our driver is on the way 🚚") : t("نجهّز وجباتك الآن 👨‍🍳", "We're preparing your meals 👨‍🍳")}
        </p>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* ETA / Near banner */}
        {info.status === "OUT_FOR_DELIVERY" && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 ${info.isNear ? "bg-emerald-500 text-white" : "bg-white border border-cyan-100"}`}>
            <div className={`h-12 w-12 rounded-2xl grid place-items-center shrink-0 ${info.isNear ? "bg-white/20" : "bg-cyan-50"}`}>
              <Clock className={`h-6 w-6 ${info.isNear ? "text-white" : "text-[#0E76AC]"}`} />
            </div>
            <div>
              {info.isNear ? (
                <><p className="font-black text-lg">{t("السائق اقترب منك! 🎉", "Your driver is near! 🎉")}</p><p className="text-xs opacity-90">{t("استعد لاستلام وجباتك", "Get ready to receive your meals")}</p></>
              ) : info.etaMin != null ? (
                <><p className="text-xs text-slate-400 font-bold">{t("الوصول خلال", "Arriving in")}</p><p className="font-black text-2xl text-[#0E2A4A]">{info.etaMin} <span className="text-sm">{t("دقيقة تقريباً", "min approx.")}</span></p></>
              ) : (
                <><p className="font-black text-[#0E2A4A]">{t("السائق في الطريق", "Driver on the way")}</p><p className="text-xs text-slate-400">{t("جارٍ تحديد الموقع…", "Locating…")}</p></>
              )}
            </div>
          </div>
        )}

        {info.status === "OUT_FOR_DELIVERY" && (
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-2 text-xs font-bold ${
            locationIsStale ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-white border-slate-100 text-slate-500"
          }`}>
            <Radio className={`h-4 w-4 shrink-0 ${locationIsStale ? "text-amber-600" : "text-emerald-500"}`} />
            {locationAgeMinutes == null
              ? t("لم يصل تحديث موقع من السائق بعد", "No driver location update yet")
              : locationIsStale
                ? t(`آخر تحديث للموقع منذ ${locationAgeMinutes} دقيقة`, `Location last updated ${locationAgeMinutes} min ago`)
                : t("موقع السائق يتحدّث مباشرة", "Driver location is updating live")}
          </div>
        )}

        {/* ✅ بطاقة السائق — اسم + اتصال + واتساب (زي تطبيقات التوصيل) */}
        {info.status === "OUT_FOR_DELIVERY" && info.driver?.name && (
          <div className="rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full grid place-items-center shrink-0 text-white font-black text-lg"
              style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              {String(info.driver.name)[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-400 font-bold">{t("سائق أدرينالين", "Adrenaline driver")}</p>
              <p className="font-black text-slate-900 truncate">{info.driver.name}</p>
            </div>
            {info.driverPhone && (
              <div className="flex gap-2 shrink-0">
                <a href={`tel:${info.driverPhone}`}
                  className="h-11 px-4 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 text-sm font-black text-slate-800">
                  📞 {t("اتصل", "Call")}
                </a>
                <a href={`https://wa.me/${String(info.driverPhone).replace(/\D/g, "").replace(/^0+/, "").replace(/^(?!974)/, "974")}`}
                  target="_blank" rel="noreferrer"
                  className="h-11 px-4 rounded-full flex items-center gap-1.5 text-sm font-black text-white"
                  style={{ background: "#25D366" }}>
                  WhatsApp
                </a>
              </div>
            )}
          </div>
        )}

        {/* Failed banner */}
        {info.status === "FAILED" && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-red-100 grid place-items-center shrink-0"><MapPin className="h-6 w-6 text-red-500" /></div>
            <div>
              <p className="font-black text-red-700">{t("تعذّر توصيل طلبك", "Delivery couldn't be completed")}</p>
              <p className="text-xs text-red-500">{t("سيتواصل معك فريقنا لإعادة الجدولة", "Our team will contact you to reschedule")}</p>
            </div>
          </div>
        )}

        {/* Timeline */}
        {info.status !== "FAILED" && (
        <div className="rounded-2xl bg-white border border-slate-100 p-5">
          <div className="relative">
            {STEPS.map((step, i) => {
              const active = i <= stepIdx;
              const current = i === stepIdx;
              const Icon = step.icon;
              const stamp = step.key === "OUT_FOR_DELIVERY" ? info.outForDeliveryAt : step.key === "DELIVERED" ? info.deliveredAt : info.preparedAt;
              return (
                <div key={step.key} className="flex items-start gap-3 pb-6 last:pb-0 relative">
                  {i < STEPS.length - 1 && (
                    <div className="absolute right-[19px] top-10 bottom-0 w-0.5" style={{ background: i < stepIdx ? "#10b981" : "#e2e8f0" }} />
                  )}
                  <div className={`h-10 w-10 rounded-full grid place-items-center shrink-0 z-10 transition-all ${active ? (current && info.status !== "DELIVERED" ? "bg-[#0E76AC] text-white animate-pulse" : "bg-emerald-500 text-white") : "bg-slate-100 text-slate-300"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="pt-1.5">
                    <p className={`font-black text-sm ${active ? "text-slate-900" : "text-slate-300"}`}>{step.label}</p>
                    {active && stamp && <p className="text-[11px] text-slate-400 font-bold mt-0.5">{format(new Date(stamp), "hh:mm a", { locale })}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Live map */}
        {(stops.length > 0 || driver) && info.status !== "PREPARED" && (
          <div className="rounded-2xl bg-white border border-slate-100 p-2 overflow-hidden">
            <DeliveryMap stops={stops} origin={info.store} driver={driver} height={300} />
            {info.driver?.name && info.status === "OUT_FOR_DELIVERY" && (
              <div className="flex items-center gap-2 p-3">
                <div className="h-9 w-9 rounded-full bg-[#0E76AC]/10 grid place-items-center"><Truck className="h-4 w-4 text-[#0E76AC]" /></div>
                <p className="text-sm font-bold text-slate-700">{t("سائقك:", "Your driver:")} <span className="text-[#0E76AC]">{info.driver.name}</span></p>
              </div>
            )}
          </div>
        )}

        {/* Delivered card */}
        {info.status === "DELIVERED" && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
            <p className="font-black text-emerald-700">{t("تم توصيل وجباتك بنجاح 💚", "Your meals were delivered 💚")}</p>
            {info.podPhotoUrl && (
              <img src={info.podPhotoUrl} alt={t("إثبات التسليم", "Delivery proof")} className="mt-3 mx-auto rounded-xl max-h-56 object-cover border border-emerald-200" />
            )}
            {info.podNote && <p className="text-xs text-emerald-600 mt-2">📝 {info.podNote}</p>}
            {info.recipientName && <p className="text-xs text-emerald-700 mt-2">{t("استلمها:", "Received by:")} <strong>{info.recipientName}</strong></p>}
            <p className="text-xs text-slate-400 mt-2">{t("شكراً لاختيارك Adrenaline Healthy Food", "Thank you for choosing Adrenaline Healthy Food")}</p>
          </div>
        )}

        <p className="text-center text-[11px] text-slate-300 pt-2">Adrenaline Healthy Food · {info.mealsCount} {t("وجبة", "meals")}</p>
      </div>
    </div>
  );
}
