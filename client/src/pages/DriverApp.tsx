/**
 * @file client/src/pages/DriverApp.tsx
 * @description تطبيق السائق (موبايل) — جولة اليوم، بدء التوصيل، تسليم، وبثّ الموقع الحي.
 * @convex convex/delivery.ts
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { format } from "date-fns";
import {
  Truck, MapPin, Phone, Navigation, CheckCircle2, Radio, RadioTower,
  Sun, Moon, Package, MessageCircle, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openWhatsApp, WhatsAppTemplates } from "@/lib/whatsapp";
import { useLanguage } from "@/lib/i18n";
import { confirmDialog } from "@/lib/dialogs";

const B = { brand: "#3cc4f0", deep: "#0E76AC", ink: "#0E2A4A" };

export default function DriverApp() {
  const { toast } = useToast();
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const currentUser = useStore((s) => s.currentUser);
  const today = format(new Date(), "yyyy-MM-dd");
  const [shift, setShift] = useState<"MORNING" | "EVENING">(new Date().getHours() < 15 ? "MORNING" : "EVENING");
  const [busy, setBusy] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastSent = useRef(0);

  const stops = useQuery(api.delivery.myStops, { date: today, deliveryTime: shift, sessionToken }) as any[] | undefined;
  const startDelivery = useMutation(api.delivery.startDelivery);
  const markDelivered = useMutation(api.delivery.markDelivered);
  const markFailed = useMutation(api.delivery.markFailed);
  const updateMyLocation = useMutation(api.delivery.updateMyLocation);
  const genPodUpload = useMutation(api.delivery.generatePodUploadUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingPhoto = useRef<any>(null);

  const trackBase = typeof window !== "undefined" ? window.location.origin : "";

  const counts = useMemo(() => {
    const s = stops || [];
    return {
      total: s.length,
      delivered: s.filter((x) => x.status === "DELIVERED").length,
      onWay: s.filter((x) => x.status === "OUT_FOR_DELIVERY").length,
    };
  }, [stops]);

  /* ── بثّ الموقع الحي أثناء الجولة (watchPosition) ── */
  const startBroadcast = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: t("المتصفح لا يدعم تحديد الموقع", "Browser doesn't support location"), variant: "destructive" });
      return;
    }
    if (watchRef.current != null) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 12000) return; // كل ~12ث لتوفير البطارية والشبكة
        lastSent.current = now;
        updateMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, sessionToken }).catch(() => {});
      },
      (err) => {
        toast({ title: t("تعذّر الوصول للموقع", "Couldn't access location"), description: String(err.message || ""), variant: "destructive" });
        stopBroadcast();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    setBroadcasting(true);
  };
  const stopBroadcast = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setBroadcasting(false);
  };
  // نظّف عند مغادرة الصفحة
  useEffect(() => () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); }, []);

  const handleStart = async (stop: any) => {
    setBusy(stop.planId);
    try {
      const r: any = await startDelivery({ planId: stop.planId, sessionToken });
      if (!r?.success) { toast({ title: r?.error || t("فشل", "Failed"), variant: "destructive" }); return; }
      if (!broadcasting) startBroadcast(); // ابدأ البثّ تلقائياً مع أول توصيل
      // أرسل رابط التتبع للعميل عبر واتساب
      if (stop.phone && r.trackToken) {
        const url = `${trackBase}/track/${r.trackToken}`;
        openWhatsApp(stop.phone, WhatsAppTemplates.outForDelivery(String(stop.customerName).split(" ")[0], url));
      }
    } catch (e: any) {
      toast({ title: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const handleDeliver = async (stop: any) => {
    const note = prompt(t("إثبات تسليم (اختياري) — مثال: سُلّم للحارس / تُرك عند الباب:", "Proof of delivery (optional) — e.g. left with guard / at the door:"), "") ?? undefined;
    setBusy(stop.planId);
    try {
      const r: any = await markDelivered({ planId: stop.planId, podNote: note || undefined, sessionToken });
      if (!r?.success) { toast({ title: r?.error || t("فشل", "Failed"), variant: "destructive" }); return; }
      toast({ title: t("تم التسليم ✅", "Delivered ✅"), description: stop.customerName });
      if (stop.phone) {
        setTimeout(async () => {
          if (await confirmDialog({ message: t("إرسال رسالة شكر للعميل؟", "Send a thank-you message to the customer?") })) openWhatsApp(stop.phone, WhatsAppTemplates.delivered(String(stop.customerName).split(" ")[0]));
        }, 300);
      }
    } catch (e: any) {
      toast({ title: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  // ✅ تسليم مع صورة إثبات — يفتح الكاميرا؛ الرفع والتسليم في onChange
  const handlePhotoDeliver = (stop: any) => {
    pendingPhoto.current = stop;
    fileRef.current?.click();
  };
  const onPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // اسمح بإعادة الاختيار لاحقاً
    const stop = pendingPhoto.current;
    pendingPhoto.current = null;
    if (!file || !stop) return;
    setBusy(stop.planId);
    try {
      const url: string = await genPodUpload({ sessionToken });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await res.json();
      const r: any = await markDelivered({ planId: stop.planId, podStorageId: storageId, sessionToken });
      if (!r?.success) { toast({ title: r?.error || t("فشل", "Failed"), variant: "destructive" }); return; }
      toast({ title: t("تم التسليم مع صورة ✅", "Delivered with photo ✅"), description: stop.customerName });
      if (stop.phone) setTimeout(async () => { if (await confirmDialog({ message: t("إرسال رسالة شكر للعميل؟", "Send a thank-you message?") })) openWhatsApp(stop.phone, WhatsAppTemplates.delivered(String(stop.customerName).split(" ")[0])); }, 300);
    } catch (e: any) {
      toast({ title: t("فشل رفع الصورة", "Photo upload failed"), description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const handleFail = async (stop: any) => {
    const reason = prompt(t("سبب تعذّر التوصيل — مثال: العميل غير موجود / لا يرد / عنوان خاطئ:", "Reason delivery failed — e.g. customer not home / no answer / wrong address:"), "") ?? undefined;
    if (reason === undefined) return;
    setBusy(stop.planId);
    try {
      const r: any = await markFailed({ planId: stop.planId, reason: reason || t("تعذّر التوصيل", "Delivery failed"), sessionToken });
      if (!r?.success) { toast({ title: r?.error || t("فشل", "Failed"), variant: "destructive" }); return; }
      toast({ title: t("سُجّل تعذّر التوصيل", "Marked as failed"), description: stop.customerName });
    } catch (e: any) {
      toast({ title: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const navUrl = (s: any) => s.lat != null && s.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address || "Doha")}&travelmode=driving`;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50" style={{ fontFamily: "Cairo, sans-serif" }}>
      {/* مدخل الكاميرا لصورة إثبات التسليم */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoPicked} />
      {/* Sticky header */}
      <div className="sticky top-0 z-20 text-white px-4 pt-5 pb-4"
        style={{ background: `linear-gradient(135deg, ${B.deep}, ${B.ink})`, paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/15 grid place-items-center"><Truck className="h-6 w-6" /></div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black leading-tight">{t("جولة التوصيل", "Delivery Route")}</h1>
            <p className="text-[11px] text-cyan-100/90 font-bold">{currentUser?.name || t("السائق", "Driver")} · {format(new Date(), "EEEE d MMMM")}</p>
          </div>
          {/* زر البث الحي */}
          <button onClick={() => (broadcasting ? stopBroadcast() : startBroadcast())}
            className={`h-11 px-3 rounded-2xl text-xs font-black flex items-center gap-1.5 border ${broadcasting ? "bg-emerald-500/90 border-emerald-300" : "bg-white/10 border-white/25"}`}>
            {broadcasting ? <RadioTower className="h-4 w-4 animate-pulse" /> : <Radio className="h-4 w-4" />}
            {broadcasting ? t("البث يعمل", "Broadcasting") : t("بدء البث", "Start GPS")}
          </button>
        </div>

        {/* Shift toggle */}
        <div className="flex gap-2 mt-4 bg-white/10 rounded-2xl p-1.5">
          {([["MORNING", t("صباحي", "Morning"), Sun], ["EVENING", t("مسائي", "Evening"), Moon]] as const).map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => setShift(k as any)}
              className={`flex-1 h-10 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all ${shift === k ? "bg-white text-[#0E2A4A]" : "text-white/80"}`}>
              <Icon className="h-4 w-4" /> {lbl}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all"
              style={{ width: `${counts.total ? (counts.delivered / counts.total) * 100 : 0}%` }} />
          </div>
          <span className="text-xs font-black tabular-nums">{counts.delivered}/{counts.total} {t("تم", "done")}</span>
        </div>
      </div>

      {/* Broadcast hint */}
      {!broadcasting && counts.onWay > 0 && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold p-3 flex items-center gap-2">
          <Radio className="h-4 w-4 shrink-0" /> {t('فعّل "بدء البث" ليتتبعك العملاء على الخريطة أثناء الطريق.', 'Turn on "Start GPS" so customers can track you on the map while en route.')}
        </div>
      )}

      {/* Stops */}
      <div className="p-4 space-y-3 pb-24">
        {stops === undefined ? (
          <div className="py-20 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : stops.length === 0 ? (
          <div className="py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-cyan-50 grid place-items-center mx-auto mb-3"><Package className="h-8 w-8 text-cyan-300" /></div>
            <p className="text-slate-500 font-bold">{t("لا توجد محطات مسندة لك في هذه الجولة", "No stops assigned to you this shift")}</p>
            <p className="text-slate-400 text-xs mt-1">{t("المشرف يسند لك المحطات من صفحة التوصيل", "The supervisor assigns stops from the Delivery page")}</p>
          </div>
        ) : (
          stops.map((s: any, i: number) => {
            const done = s.status === "DELIVERED";
            const onWay = s.status === "OUT_FOR_DELIVERY";
            const failed = s.status === "FAILED";
            return (
              <div key={s.planId} className={`rounded-2xl border bg-white overflow-hidden transition-all ${done ? "opacity-60 border-slate-100" : failed ? "border-red-200 bg-red-50/40" : onWay ? "border-[#3cc4f0] shadow-[0_8px_25px_rgba(60,196,240,.15)]" : "border-slate-100 shadow-sm"}`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl grid place-items-center font-black shrink-0 text-white ${done ? "bg-emerald-500" : failed ? "bg-red-500" : "bg-gradient-to-br from-[#3cc4f0] to-[#0E76AC]"}`}>
                      {done ? <CheckCircle2 className="h-5 w-5" /> : failed ? "!" : (s.seq === 999 ? i + 1 : s.seq)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-black text-slate-900 ${done ? "line-through text-slate-500" : ""}`}>{s.customerName}</h3>
                        {onWay && <span className="text-[10px] font-black text-white bg-[#0E76AC] rounded-full px-2 py-0.5">{t("في الطريق", "On the way")}</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{s.mealsCount} {t("وجبة", "meals")}{s.address ? ` · ${s.address}` : ""}</p>
                      {s.notes && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-1.5">📝 {s.notes}</p>}
                    </div>
                  </div>

                  {!done && (
                    <div className="flex gap-2 mt-3">
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[#0E76AC] font-bold text-sm flex items-center gap-1.5">
                          <Phone className="h-4 w-4" /> {t("اتصال", "Call")}
                        </a>
                      )}
                      <a href={navUrl(s)} target="_blank" rel="noreferrer" className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm flex items-center gap-1.5">
                        <Navigation className="h-4 w-4" /> {t("توجيه", "Navigate")}
                      </a>
                      {!onWay ? (
                        <button disabled={busy === s.planId} onClick={() => handleStart(s)}
                          className="flex-1 h-11 rounded-xl text-white font-black text-sm disabled:opacity-60"
                          style={{ background: `linear-gradient(135deg, ${B.brand}, ${B.deep})` }}>
                          {busy === s.planId ? "…" : t("🚚 خرجت للتوصيل", "🚚 Out for delivery")}
                        </button>
                      ) : (
                        <>
                          <button disabled={busy === s.planId} onClick={() => handleDeliver(s)}
                            className="flex-1 h-11 rounded-xl bg-emerald-500 text-white font-black text-sm disabled:opacity-60">
                            {busy === s.planId ? "…" : t("✓ تم التسليم", "✓ Delivered")}
                          </button>
                          <button disabled={busy === s.planId} onClick={() => handlePhotoDeliver(s)}
                            title={t("تسليم مع صورة إثبات", "Deliver with proof photo")}
                            className="h-11 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 font-black text-sm disabled:opacity-60">
                            📷
                          </button>
                          <button disabled={busy === s.planId} onClick={() => handleFail(s)}
                            title={t("تعذّر التوصيل", "Couldn't deliver")}
                            className="h-11 px-3 rounded-xl border border-red-200 bg-red-50 text-red-600 font-black text-sm disabled:opacity-60">
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {done && s.deliveredAt && (
                    <p className="text-[11px] text-emerald-600 font-bold mt-2">✅ {t("سُلّم", "Delivered")} {format(new Date(s.deliveredAt), "hh:mm a")}</p>
                  )}
                  {failed && (
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-[11px] text-red-600 font-bold flex-1">✕ {t("تعذّر التوصيل", "Delivery failed")}{s.failReason ? ` — ${s.failReason}` : ""}</p>
                      <button disabled={busy === s.planId} onClick={() => handleStart(s)}
                        className="text-[11px] font-black text-[#0E76AC] underline">{t("إعادة المحاولة", "Retry")}</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
