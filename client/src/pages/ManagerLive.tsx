/**
 * @file client/src/pages/ManagerLive.tsx
 * @description لوحة تحكم المدير اللحظية — بهوية أدرينالين (تدرّج فاتح + كروت بيضا).
 *   تُحدَّث تلقائياً عبر Convex reactive queries. المدير يفتحها من موبايله أو تابلته
 *   ويشوف كل شيء يحدث في المطعم فوراً. تستخدم اهتزاز الجهاز + إشعارات المتصفح.
 * @convex convex/manager.ts
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { alertDialog } from "@/lib/dialogs";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Activity, AlertTriangle, Bell, BellOff, Clock, Package, Receipt, ShieldAlert, TrendingUp, Users, Wifi, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const PAY_METHOD_META: Record<string, { color: string; ar: string; en: string }> = {
  cash:     { color: "#16a34a", ar: "كاش",   en: "Cash"     },
  card:     { color: "#0E76AC", ar: "بطاقة", en: "Card"     },
  talabat:  { color: "#ff6b1a", ar: "طلبات", en: "Talabat"  },
  snoonu:   { color: "#e91d63", ar: "سنونو", en: "Snoonu"   },
  rafeeq:   { color: "#8b5cf6", ar: "رفيق",  en: "Rafeeq"   },
  keeta:    { color: "#facc15", ar: "كيتا",  en: "Keeta"    },
  transfer: { color: "#0891b2", ar: "تحويل", en: "Transfer" },
  staff:    { color: "#475569", ar: "موظف",  en: "Staff"    },
  other:    { color: "#64748b", ar: "أخرى",  en: "Other"    },
};

const ACTION_META: Record<string, { color: string; ar: string; en: string; icon: string }> = {
  VOID_TICKET:   { color: "#f59e0b", ar: "إلغاء فاتورة",  en: "Ticket void",   icon: "⚠️" },
  REFUND_TICKET: { color: "#dc2626", ar: "استرجاع فاتورة", en: "Ticket refund", icon: "↩️" },
};

const timeAgo = (ts: number, isRtl: boolean) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  const t = (a: string, e: string) => (isRtl ? a : e);
  if (s < 60) return t(`${s}ث`, `${s}s`);
  const m = Math.floor(s / 60);
  if (m < 60) return t(`${m}د`, `${m}m`);
  const h = Math.floor(m / 60);
  if (h < 24) return t(`${h}س`, `${h}h`);
  return t(`${Math.floor(h / 24)}ي`, `${Math.floor(h / 24)}d`);
};

export default function ManagerLive() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const snap = useQuery(api.manager.liveSnapshot, { sessionToken }) as any;

  const [notifOn, setNotifOn] = useState<boolean>(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(i); }, []);
  void tick;

  // ✅ إشعارات + اهتزاز عند حدث جديد
  const lastRecentIds = useRef<Set<string>>(new Set());
  const lastAuditIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  useEffect(() => {
    if (!snap) return;
    if (!initialized.current) {
      snap.recent?.forEach((r: any) => lastRecentIds.current.add(r.id));
      snap.audit?.forEach((r: any) => lastAuditIds.current.add(r.id));
      initialized.current = true;
      return;
    }
    const notify = (title: string, body: string) => {
      if (!notifOn) return;
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification(title, { body, tag: `mgr_${Date.now()}`, silent: false }); } catch { /* silent */ }
      }
      if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
    };
    snap.recent?.forEach((r: any) => {
      if (!lastRecentIds.current.has(r.id)) {
        lastRecentIds.current.add(r.id);
        const method = PAY_METHOD_META[r.paymentMethod || "other"];
        notify(t(`فاتورة جديدة #${r.ticketNumber}`, `New ticket #${r.ticketNumber}`),
               `${r.total.toFixed(2)} QAR · ${isRtl ? method?.ar : method?.en}`);
      }
    });
    snap.audit?.forEach((r: any) => {
      if (!lastAuditIds.current.has(r.id)) {
        lastAuditIds.current.add(r.id);
        const m = ACTION_META[r.action];
        if (m) notify(`${m.icon} ${isRtl ? m.ar : m.en}`, `${r.actorName || ""} · #${r.details?.ticketNumber || "—"}`);
      }
    });
  }, [snap, notifOn, isRtl, t]);

  const requestNotif = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") { setNotifOn(true); return; }
    if (Notification.permission === "denied") { void alertDialog({ message: t("مرفوض — فعّلها من إعدادات المتصفح", "Denied — enable from browser settings") }); return; }
    const r = await Notification.requestPermission();
    setNotifOn(r === "granted");
  };

  const isConnected = !!snap;
  const activeCashiers = snap?.openShifts?.length || 0;
  const alerts = snap?.alerts || {};

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<Activity className="h-6 w-6" />}
          titleAr="لوحة المدير اللحظية"
          titleEn="Manager Live"
          subtitleAr="مبيعات · كاشيرون · فواتير · أحداث · مخزون — كلها في الوقت الفعلي"
          subtitleEn="Sales · cashiers · tickets · events · stock — all live"
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={requestNotif}
                variant="outline"
                className={cn("h-10 gap-2 font-bold", notifOn ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "")}
              >
                {notifOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                {notifOn ? t("إشعارات مفعّلة", "Notifications on") : t("فعّل الإشعارات", "Enable notifications")}
              </Button>
              <div className={cn("h-10 px-3 rounded-lg flex items-center gap-1.5 text-xs font-black uppercase border",
                isConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200")}>
                <Wifi className={cn("h-3.5 w-3.5", isConnected && "animate-pulse")} />
                {isConnected ? "LIVE" : "OFF"}
              </div>
            </div>
          }
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-10 mt-4 space-y-4">
        {/* ═══════ Hero: مبيعات اليوم ═══════ */}
        <Card className="rounded-2xl border-0 text-white overflow-hidden shadow-xl"
              style={{ background: "linear-gradient(135deg,#0E2A4A 0%,#0E76AC 55%,#3AC7F4 100%)" }}>
          <CardContent className="p-6 relative">
            <div className="absolute -top-8 -end-8 w-40 h-40 rounded-full opacity-15" style={{ background: "#fff" }} />
            <p className="text-[11px] font-black uppercase tracking-widest text-cyan-100">{t("مبيعات اليوم", "Today's Sales")}</p>
            <p className="text-5xl sm:text-6xl font-black mt-1">
              {snap?.today?.totalSales?.toFixed(2) ?? "—"}
              <span className="text-xl text-cyan-100 ms-2">QAR</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur">
                <Receipt className="h-4 w-4" />
                <b>{snap?.today?.ticketsCount ?? 0}</b>
                <span className="text-cyan-100">{t("فاتورة", "tickets")}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur">
                <TrendingUp className="h-4 w-4" />
                <b>{snap?.today?.avgTicket?.toFixed(2) ?? "—"}</b>
                <span className="text-cyan-100">{t("متوسط", "avg")}</span>
              </div>
              {snap?.lastHour?.ticketsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-lg backdrop-blur">
                  <Clock className="h-4 w-4" />
                  <span className="text-cyan-100">{t("آخر ساعة", "Last hour")}:</span>
                  <b>{snap.lastHour.totalSales.toFixed(2)}</b>
                  <span className="text-cyan-100">· {snap.lastHour.ticketsCount} {t("فاتورة", "tix")}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═══════ Alert Tiles ═══════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AlertCard icon={AlertTriangle} label={t("فواتير كبيرة", "Big tickets")} value={alerts.bigTickets ?? 0} color="#f59e0b" />
          <AlertCard icon={ShieldAlert}   label={t("إلغاءات اليوم", "Voids today")} value={alerts.voidsToday ?? 0} color="#eab308" />
          <AlertCard icon={ShieldAlert}   label={t("استرجاعات", "Refunds")}         value={alerts.refundsToday ?? 0} color="#dc2626" />
          <AlertCard icon={Package}       label={t("مخزون منخفض", "Low stock")}     value={alerts.lowStock ?? 0} color="#0891b2" />
        </div>

        {/* ═══════ Two-col: Cashiers + Payment methods ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Cashiers */}
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black text-slate-900 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: "#0E76AC20", color: "#0E76AC" }}>
                    <Users className="h-4 w-4" />
                  </div>
                  {t("كاشيرون نشطون", "Active cashiers")}
                </h2>
                <span className="text-2xl font-black text-[#0E76AC]">{activeCashiers}</span>
              </div>
              {activeCashiers === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8 font-bold">{t("لا توجد ورديات مفتوحة حاليًا", "No open shifts")}</p>
              ) : (
                <div className="space-y-2">
                  {snap.openShifts.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="h-11 w-11 rounded-full grid place-items-center font-black text-white shadow-md" style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}>
                        {s.cashierName?.[0] || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-slate-900 truncate">{s.cashierName}</p>
                        <p className="text-[11px] text-slate-500 font-bold">
                          {t("منذ", "since")} {timeAgo(s.openedAt, isRtl)} · {s.ticketsCount} {t("فاتورة", "tix")}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-black text-emerald-700 text-xl">{s.totalSales.toFixed(2)}</p>
                        <p className="text-[9px] text-slate-400 font-bold">QAR</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment methods */}
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="p-4">
              <h2 className="font-black text-slate-900 flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: "#16a34a20", color: "#16a34a" }}>
                  <Receipt className="h-4 w-4" />
                </div>
                {t("حسب طريقة الدفع", "By payment method")}
              </h2>
              {(!snap?.byMethod || snap.byMethod.length === 0) ? (
                <p className="text-sm text-slate-400 text-center py-8 font-bold">{t("لا توجد مبيعات اليوم بعد", "No sales yet today")}</p>
              ) : (
                <div className="space-y-3">
                  {snap.byMethod.map((m: any) => {
                    const meta = PAY_METHOD_META[m.method] || PAY_METHOD_META.other;
                    const pct = snap.today.totalSales > 0 ? (m.total / snap.today.totalSales) * 100 : 0;
                    return (
                      <div key={m.method}>
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span className="font-black" style={{ color: meta.color }}>{isRtl ? meta.ar : meta.en}</span>
                          <span className="text-slate-600">{m.total.toFixed(2)} <span className="text-slate-400">· {m.count}</span></span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═══════ Two-col: Activity + Audit ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Live activity */}
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="p-4">
              <h2 className="font-black text-slate-900 flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: "#3AC7F420", color: "#0E76AC" }}>
                  <Activity className="h-4 w-4" />
                </div>
                {t("النشاط اللحظي", "Live activity")}
              </h2>
              {(!snap?.recent || snap.recent.length === 0) ? (
                <p className="text-sm text-slate-400 text-center py-8 font-bold">{t("لا فواتير جديدة", "No recent tickets")}</p>
              ) : (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
                  {snap.recent.map((r: any) => {
                    const meta = PAY_METHOD_META[r.paymentMethod || "other"] || PAY_METHOD_META.other;
                    return (
                      <div key={r.id}
                           className={cn("flex items-center gap-3 p-2.5 rounded-xl border",
                             r.isBig ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100")}>
                        <div className="h-9 w-9 rounded-lg grid place-items-center shrink-0 text-white text-[10px] font-black shadow" style={{ background: meta.color }}>
                          {(isRtl ? meta.ar : meta.en)[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                            #{r.ticketNumber}
                            {r.isNonRevenue && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase">Staff</span>}
                            {r.isBig && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-white uppercase">BIG</span>}
                          </p>
                          <p className="text-[11px] text-slate-500 font-bold truncate">
                            {r.cashierName} · {timeAgo(r.paidAt, isRtl)}
                            {r.customerName && ` · ${r.customerName}`}
                          </p>
                        </div>
                        <p className="font-black text-sm shrink-0" style={{ color: meta.color }}>{r.total.toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit events */}
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="p-4">
              <h2 className="font-black text-slate-900 flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: "#dc262620", color: "#dc2626" }}>
                  <ShieldAlert className="h-4 w-4" />
                </div>
                {t("أحداث حساسة", "Sensitive events")}
              </h2>
              {(!snap?.audit || snap.audit.length === 0) ? (
                <p className="text-sm text-slate-400 text-center py-8 font-bold">{t("لا أحداث اليوم", "No events today")}</p>
              ) : (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
                  {snap.audit.map((r: any) => {
                    const m = ACTION_META[r.action] || { color: "#64748b", ar: r.action, en: r.action, icon: "•" };
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-xl w-9 h-9 grid place-items-center rounded-lg" style={{ background: m.color + "18" }}>{m.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black">
                            <span style={{ color: m.color }}>{isRtl ? m.ar : m.en}</span>
                            {r.details?.ticketNumber && <span className="text-slate-500 font-bold"> · #{r.details.ticketNumber}</span>}
                          </p>
                          <p className="text-[11px] text-slate-500 font-bold truncate">
                            {r.actorName || "—"} · {timeAgo(r.createdAt, isRtl)}
                            {r.details?.reason && ` · ${r.details.reason}`}
                          </p>
                        </div>
                        {r.details?.total != null && (
                          <p className="font-black text-sm text-slate-700 shrink-0">{Number(r.details.total).toFixed(2)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═══════ Low stock ═══════ */}
        {alerts.lowStock > 0 && alerts.lowStockItems?.length > 0 && (
          <Card className="rounded-2xl border-orange-200 bg-orange-50/50">
            <CardContent className="p-4">
              <h2 className="font-black text-orange-800 flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg grid place-items-center bg-orange-100 text-orange-700">
                  <Package className="h-4 w-4" />
                </div>
                {t("مخزون منخفض", "Low stock")}
                <span className="ms-auto text-2xl font-black text-orange-700">{alerts.lowStock}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {alerts.lowStockItems.map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-orange-100">
                    <span className="font-bold text-slate-800 text-sm">{i.name}</span>
                    <span className="font-black text-orange-700 text-sm">{i.currentStock} / {i.minStock} <span className="text-[10px] text-slate-500">{i.unit}</span></span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => location.reload()}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            <RefreshCw className="h-3 w-3 me-1" />
            {t("آخر تحديث", "Last update")}: {snap ? timeAgo(snap.generatedAt, isRtl) : "—"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl grid place-items-center shrink-0" style={{ background: color + "18", color }}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">{label}</p>
            <p className="text-3xl font-black leading-tight" style={{ color }}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
