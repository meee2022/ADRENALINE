/**
 * @file client/src/pages/ManagerLive.tsx
 * @description لوحة تحكم المدير اللحظية — mobile-first، تُحدَّث تلقائياً عبر
 *   Convex reactive queries. المدير يفتحها من موبايله أو تابلته ويشوف كل شيء
 *   يحدث في المطعم فوراً: مبيعات، كاشيرون نشطون، فواتير جديدة، أحداث Void/Refund،
 *   تنبيهات مخزون. تستخدم اهتزاز الجهاز + إشعارات المتصفح للأحداث الهامة.
 * @convex convex/manager.ts
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, Bell, BellOff, Clock, Package, Receipt, ShieldAlert, TrendingUp, Users, Wifi, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const PAY_METHOD_META: Record<string, { color: string; ar: string }> = {
  cash:     { color: "#16a34a", ar: "كاش"    },
  card:     { color: "#0E76AC", ar: "بطاقة"  },
  talabat:  { color: "#ff6b1a", ar: "طلبات"  },
  snoonu:   { color: "#e91d63", ar: "سنونو"  },
  rafeeq:   { color: "#8b5cf6", ar: "رفيق"   },
  keeta:    { color: "#facc15", ar: "كيتا"   },
  transfer: { color: "#0891b2", ar: "تحويل"  },
  staff:    { color: "#475569", ar: "موظف"   },
  other:    { color: "#64748b", ar: "أخرى"  },
};

const ACTION_META: Record<string, { color: string; ar: string; icon: string }> = {
  VOID_TICKET:   { color: "#f59e0b", ar: "إلغاء فاتورة",  icon: "⚠️" },
  REFUND_TICKET: { color: "#dc2626", ar: "استرجاع فاتورة", icon: "↩️" },
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
  // ✅ يعيد رسم الوقت النسبي كل ثانية (حتى بدون تغيير في الداتا)
  useEffect(() => { const i = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(i); }, []);
  void tick;

  // ✅ إشعارات + اهتزاز عند حدث جديد
  const lastRecentIds = useRef<Set<string>>(new Set());
  const lastAuditIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!snap) return;
    // في أول تحميل، سجّل ما هو موجود بدون إشعار
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
    // فواتير جديدة
    snap.recent?.forEach((r: any) => {
      if (!lastRecentIds.current.has(r.id)) {
        lastRecentIds.current.add(r.id);
        const method = PAY_METHOD_META[r.paymentMethod || "other"]?.ar || r.paymentMethod;
        notify(t(`فاتورة جديدة #${r.ticketNumber}`, `New ticket #${r.ticketNumber}`), `${r.total.toFixed(2)} QAR · ${method}`);
      }
    });
    // Audit
    snap.audit?.forEach((r: any) => {
      if (!lastAuditIds.current.has(r.id)) {
        lastAuditIds.current.add(r.id);
        const m = ACTION_META[r.action];
        if (m) notify(`${m.icon} ${m.ar}`, `${r.actorName || ""} · فاتورة #${r.details?.ticketNumber || "—"}`);
      }
    });
  }, [snap, notifOn, t]);

  const requestNotif = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") { setNotifOn(true); return; }
    if (Notification.permission === "denied") { alert(t("مرفوض — فعّلها من إعدادات المتصفح", "Denied — enable from browser settings")); return; }
    const r = await Notification.requestPermission();
    setNotifOn(r === "granted");
  };

  const isConnected = !!snap;
  const activeCashiers = snap?.openShifts?.length || 0;
  const alerts = snap?.alerts || {};

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-950 text-white pb-24" style={{ fontFamily: "Cairo, sans-serif" }}>
      {/* Header — sticky */}
      <div className="sticky top-0 z-40 px-4 py-3 border-b border-slate-800 backdrop-blur bg-slate-950/95">
        <div className="flex items-center justify-between gap-3 max-w-3xl mx-auto">
          <div>
            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Manager Live</p>
            <h1 className="text-xl font-black">{t("لوحة المدير", "Manager")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={requestNotif}
              className={cn("h-9 w-9 rounded-full grid place-items-center transition-all", notifOn ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500")}
              title={t("تنبيهات", "Notifications")}
            >
              {notifOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </button>
            <div className={cn("h-9 px-3 rounded-full flex items-center gap-1.5 text-[10px] font-black uppercase", isConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
              <Wifi className={cn("h-3 w-3", isConnected && "animate-pulse")} />
              {isConnected ? "LIVE" : "OFF"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Today Sales — hero */}
        <div className="rounded-3xl p-5 text-white relative overflow-hidden shadow-xl"
             style={{ background: "linear-gradient(135deg,#0E76AC 0%,#0E2A4A 100%)" }}>
          <div className="absolute -top-8 -end-8 w-40 h-40 rounded-full opacity-20" style={{ background: "#3cc4f0" }} />
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">{t("مبيعات اليوم", "Today's Sales")}</p>
          <p className="text-5xl font-black mt-1">
            {snap?.today?.totalSales?.toFixed(2) ?? "—"}
            <span className="text-lg text-cyan-200 ms-2">QAR</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5"><Receipt className="h-4 w-4 text-cyan-300" /><b>{snap?.today?.ticketsCount ?? 0}</b> <span className="text-cyan-200">{t("فاتورة", "tickets")}</span></div>
            <div className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-cyan-300" /><b>{snap?.today?.avgTicket?.toFixed(2) ?? "—"}</b> <span className="text-cyan-200">{t("متوسط", "avg")}</span></div>
          </div>
          {snap?.lastHour?.ticketsCount > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-xs font-black">
              <Clock className="h-3.5 w-3.5" />
              {t("آخر ساعة", "Last hour")}: {snap.lastHour.totalSales.toFixed(2)} · {snap.lastHour.ticketsCount} {t("فاتورة", "tix")}
            </div>
          )}
        </div>

        {/* Alerts row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <AlertTile icon={<AlertTriangle className="h-4 w-4" />} label={t("فواتير كبيرة", "Big tickets")}   value={alerts.bigTickets ?? 0}   color="#f59e0b" />
          <AlertTile icon={<ShieldAlert className="h-4 w-4" />}   label={t("إلغاءات اليوم", "Voids today")}   value={alerts.voidsToday ?? 0}   color="#eab308" />
          <AlertTile icon={<ShieldAlert className="h-4 w-4" />}   label={t("استرجاعات", "Refunds")}          value={alerts.refundsToday ?? 0} color="#dc2626" />
          <AlertTile icon={<Package className="h-4 w-4" />}       label={t("مخزون منخفض", "Low stock")}      value={alerts.lowStock ?? 0}     color="#0891b2" />
        </div>

        {/* Active cashiers */}
        <Card className="bg-slate-900 border-slate-800 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-sm flex items-center gap-2"><Users className="h-4 w-4 text-cyan-400" /> {t("كاشيرون نشطون", "Active cashiers")}</h2>
              <span className="text-xs font-black text-slate-500">{activeCashiers}</span>
            </div>
            {activeCashiers === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">{t("مفيش ورديات مفتوحة الآن", "No open shifts")}</p>
            ) : (
              <div className="space-y-2">
                {snap.openShifts.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
                    <div className="h-10 w-10 rounded-full bg-cyan-500/20 text-cyan-400 grid place-items-center font-black">
                      {s.cashierName?.[0] || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate">{s.cashierName}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{t("منذ", "since")} {timeAgo(s.openedAt, isRtl)} · {s.ticketsCount} {t("فاتورة", "tix")}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-black text-emerald-400 text-lg">{s.totalSales.toFixed(2)}</p>
                      <p className="text-[9px] text-slate-500 font-bold">QAR</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment methods breakdown */}
        {snap?.byMethod?.length > 0 && (
          <Card className="bg-slate-900 border-slate-800 rounded-2xl">
            <CardContent className="p-4">
              <h2 className="font-black text-sm mb-3">{t("حسب طريقة الدفع", "By payment method")}</h2>
              <div className="space-y-2">
                {snap.byMethod.map((m: any) => {
                  const meta = PAY_METHOD_META[m.method] || PAY_METHOD_META.other;
                  const pct = snap.today.totalSales > 0 ? (m.total / snap.today.totalSales) * 100 : 0;
                  return (
                    <div key={m.method}>
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span style={{ color: meta.color }}>{meta.ar}</span>
                        <span className="text-slate-300">{m.total.toFixed(2)} · {m.count}</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live activity feed */}
        <Card className="bg-slate-900 border-slate-800 rounded-2xl">
          <CardContent className="p-4">
            <h2 className="font-black text-sm flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-cyan-400" /> {t("النشاط اللحظي", "Live activity")}
            </h2>
            {(!snap?.recent || snap.recent.length === 0) ? (
              <p className="text-xs text-slate-500 text-center py-6">{t("لا فواتير جديدة", "No recent tickets")}</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {snap.recent.map((r: any) => {
                  const meta = PAY_METHOD_META[r.paymentMethod || "other"] || PAY_METHOD_META.other;
                  return (
                    <div key={r.id}
                         className={cn("flex items-center gap-3 p-2 rounded-lg", r.isBig ? "bg-amber-500/10 border border-amber-500/30" : "bg-slate-800/50")}>
                      <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0 text-white text-[10px] font-black" style={{ background: meta.color }}>
                        {meta.ar[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black flex items-center gap-1.5">
                          #{r.ticketNumber}
                          {r.isNonRevenue && <span className="text-[8px] font-black px-1 py-0.5 rounded bg-slate-700 text-slate-300 uppercase">Staff</span>}
                          {r.isBig && <span className="text-[8px] font-black px-1 py-0.5 rounded bg-amber-500/30 text-amber-300 uppercase">Big</span>}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold truncate">
                          {r.cashierName} · {timeAgo(r.paidAt, isRtl)}
                          {r.customerName && ` · ${r.customerName}`}
                        </p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="font-black text-sm" style={{ color: meta.color }}>{r.total.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit events feed */}
        {snap?.audit?.length > 0 && (
          <Card className="bg-slate-900 border-slate-800 rounded-2xl">
            <CardContent className="p-4">
              <h2 className="font-black text-sm flex items-center gap-2 mb-3">
                <ShieldAlert className="h-4 w-4 text-red-400" /> {t("أحداث حساسة", "Sensitive events")}
              </h2>
              <div className="space-y-1.5">
                {snap.audit.map((r: any) => {
                  const m = ACTION_META[r.action] || { color: "#64748b", ar: r.action, icon: "•" };
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
                      <div className="text-xl">{m.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black">
                          <span style={{ color: m.color }}>{m.ar}</span>
                          {r.details?.ticketNumber && <span className="text-slate-400 font-bold"> · #{r.details.ticketNumber}</span>}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold">
                          {r.actorName || "—"} · {timeAgo(r.createdAt, isRtl)}
                          {r.details?.reason && ` · ${r.details.reason}`}
                        </p>
                      </div>
                      {r.details?.total != null && (
                        <p className="font-black text-sm text-slate-300">{Number(r.details.total).toFixed(2)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Low stock */}
        {alerts.lowStock > 0 && alerts.lowStockItems && (
          <Card className="bg-orange-500/10 border-orange-500/30 rounded-2xl">
            <CardContent className="p-4">
              <h2 className="font-black text-sm flex items-center gap-2 mb-3 text-orange-300">
                <Package className="h-4 w-4" /> {t("مخزون منخفض", "Low stock")} ({alerts.lowStock})
              </h2>
              <div className="space-y-1.5">
                {alerts.lowStockItems.map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between text-xs">
                    <span className="font-bold">{i.name}</span>
                    <span className="font-black text-orange-300">{i.currentStock} / {i.minStock} {i.unit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual refresh */}
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            onClick={() => location.reload()}
            className="text-xs text-slate-500 hover:text-white"
          >
            <RefreshCw className="h-3 w-3 me-1" />
            {t("آخر تحديث", "Last update")}: {snap ? timeAgo(snap.generatedAt, isRtl) : "—"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AlertTile({ icon, label, value, color }: any) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase truncate">{label}</span>
      </div>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
    </div>
  );
}
