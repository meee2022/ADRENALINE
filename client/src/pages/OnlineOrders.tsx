/**
 * @file client/src/pages/OnlineOrders.tsx
 * @description حصر طلبات المنصّات الأونلاين بالأسعار (طلبات/سنونو/رفيق/ديليفرو/كيتا) + تقرير شهري.
 * @convex convex/onlineOrders.ts
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ShoppingBag, Trash2, Printer, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = () => new Date().toISOString().slice(0, 7);

const PLATFORMS = [
  { key: "TALABAT", ar: "طلبات", en: "Talabat", icon: "/app-talabat.png", color: "#FF5A00" },
  { key: "SNOONU", ar: "سنونو", en: "Snoonu", icon: "/app-snoonu.png", color: "#6D28D9" },
  { key: "RAFEEQ", ar: "رفيق", en: "Rafeeq", icon: "/app-rafeeq.png", color: "#0EA5A0" },
  { key: "DELIVEROO", ar: "ديليفرو", en: "Deliveroo", icon: "/app-deliveroo.png", color: "#00A99D" },
  { key: "KEETA", ar: "كيتا", en: "Keeta", icon: "/app-keeta.png", color: "#F59E0B" },
  { key: "OTHER", ar: "أخرى", en: "Other", icon: null, color: "#64748b" },
] as const;
const pInfo = (k: string) => PLATFORMS.find((p) => p.key === k) || PLATFORMS[5];

export default function OnlineOrders() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);
  const qr = (n: number) => `${Math.round(n)} ${t("ر.ق", "QAR")}`;
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const isAdmin = useStore((s) => s.currentUser?.role) === "ADMIN";

  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(monthStr());

  const rows = (useQuery(api.onlineOrders.listByDate, { date, sessionToken }) as any[] | undefined) || [];
  const summary = useQuery(api.onlineOrders.summary, { date, month, sessionToken }) as any;
  const logM = useMutation(api.onlineOrders.log);
  const removeM = useMutation(api.onlineOrders.remove);

  // quick add form
  const [platform, setPlatform] = useState<string>("TALABAT");
  const [meals, setMeals] = useState(1);
  const [amount, setAmount] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const amt = Number(amount);
    if (isNaN(amt) || amt < 0) { alert(t("اكتب قيمة الطلب صح", "Enter a valid amount")); return; }
    setSaving(true);
    try {
      await logM({ date, platform: platform as any, mealsCount: meals, amount: amt, orderRef: orderRef.trim() || undefined, sessionToken });
      setMeals(1); setAmount(""); setOrderRef("");
    } catch (e: any) { alert(e?.message || t("فشل التسجيل", "Failed")); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm(t("حذف الطلب ده؟", "Delete this order?"))) return;
    try { await removeM({ id: id as any, sessionToken }); } catch (e: any) { alert(e?.message || "err"); }
  };

  const dayT = summary?.day?.totals || { orders: 0, meals: 0, revenue: 0 };
  const monthT = summary?.month?.totals || { orders: 0, meals: 0, revenue: 0 };

  const handlePrint = () => {
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    const bp = summary?.month?.byPlatform || {};
    const rowsHtml = PLATFORMS.map((p) => {
      const d = bp[p.key] || { orders: 0, meals: 0, revenue: 0 };
      if (!d.orders) return "";
      return `<tr><td class="r">${isRtl ? p.ar : p.en}</td><td class="c b">${d.orders}</td><td class="c b">${d.meals}</td><td class="c b" style="color:#0E76AC">${Math.round(d.revenue)} ${t("ر.ق", "QAR")}</td></tr>`;
    }).join("");
    const html = `<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}" lang="${isRtl ? "ar" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=800"><title>${t("طلبات أونلاين", "Online Orders")} ${esc(month)}</title>
      <style>*{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}body{margin:0;padding:16px;color:#0f1516}
      h1{font-size:20px;margin:0}.sub{color:#47759c;font-weight:700;font-size:13px;margin:2px 0 12px}
      table{width:100%;border-collapse:collapse;font-size:14px}th{background:#0E76AC;color:#fff;padding:8px 6px;font-weight:800}td{padding:8px 6px;border:1px solid #e3ebf2}
      .c{text-align:center}.r{text-align:right;font-weight:700}.b{font-weight:900}
      tfoot td{background:#eaf3fb;font-weight:900}
      @page{size:A4;margin:12mm}</style></head><body>
      <h1>${t("حصر طلبات المنصّات الأونلاين", "Online Platforms Orders Report")} — ADRENALINE</h1><div class="sub">${t("الشهر", "Month")}: ${esc(month)}</div>
      <table><thead><tr><th>${t("المنصّة", "Platform")}</th><th>${t("عدد الطلبات", "Orders")}</th><th>${t("عدد الوجبات", "Meals")}</th><th>${t("الإيراد", "Revenue")}</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan=4 class=c>—</td></tr>'}</tbody>
      <tfoot><tr><td class="r">${t("الإجمالي", "Total")}</td><td class="c">${monthT.orders}</td><td class="c">${monthT.meals}</td><td class="c" style="color:#0E76AC">${Math.round(monthT.revenue)} ${t("ر.ق", "QAR")}</td></tr></tfoot>
      </table></body></html>`;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) { alert(t("اسمح بالنوافذ المنبثقة", "Allow pop-ups")); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  };

  // 🖥️ شاشة المتابعة الموحّدة: يفتح لوحات المنصّات الثلاث كنوافذ مرتّبة تلقائياً
  //    جنب بعض (طلبات يمنع التضمين iframe، فالنوافذ المرتّبة أقرب حل ممكن).
  //    الجلسات محفوظة في المتصفح — تسجّل دخولك أول مرة فقط.
  const PORTALS = [
    { key: "SNOONU", url: "https://merchant.snoonu.com/dashboard/order" },
    { key: "TALABAT", url: "https://partner-app.talabat.com/live-orders" },
    { key: "RAFEEQ", url: "https://partner.gorafeeq.com/#/dashboard" },
  ];
  const openWallboard = () => {
    const W = window.screen.availWidth, H = window.screen.availHeight;
    const colW = Math.floor(W / PORTALS.length);
    PORTALS.forEach((p, i) => {
      window.open(
        p.url,
        `wb_${p.key}`,
        `left=${i * colW},top=0,width=${colW},height=${H - 40},noopener`,
      );
    });
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6">
      <DashboardHeader
        icon={<ShoppingBag className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="طلبات أونلاين" titleEn="Online Orders"
        subtitleAr="حصر طلبات المنصّات (طلبات/سنونو/رفيق/ديليفرو/كيتا) بالأسعار"
        subtitleEn="Track delivery-platform orders (Talabat/Snoonu/Rafeeq/Deliveroo/Keeta)"
        kpis={summary ? [
          { value: dayT.orders, labelAr: "طلبات اليوم", labelEn: "Orders today" },
          { value: dayT.meals, labelAr: "وجبات اليوم", labelEn: "Meals today" },
          { value: Math.round(monthT.revenue), labelAr: "إيراد الشهر (ر.ق)", labelEn: "Month revenue" },
        ] : undefined}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={openWallboard} className="h-11 rounded-xl font-black text-white shadow-lg text-sm"
              style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
              <ShoppingBag className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
              {t("🖥️ شاشة المتابعة (المنصّات الثلاث)", "🖥️ Wallboard (3 platforms)")}
            </Button>
            <Button onClick={handlePrint} className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm">
              <Printer className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} /> {t("تقرير شهري", "Monthly Report")}
            </Button>
          </div>
        }
      />

      {/* date + month */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">{t("اليوم", "Day")}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full sm:w-[160px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">{t("شهر التقرير", "Report month")}</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 w-full sm:w-[150px]" />
        </div>
      </div>

      {/* quick add */}
      <div className="bg-white rounded-2xl p-4 space-y-4" style={{ border: "1px solid #e8eef4" }}>
        <div className="text-sm font-bold text-[#47759c]">{t("تسجيل طلب جديد", "Log a new order")}</div>
        {/* platform */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {PLATFORMS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPlatform(p.key)}
              className={cn("h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all", platform === p.key ? "ring-2" : "bg-white")}
              style={platform === p.key ? { borderColor: p.color, boxShadow: `0 0 0 2px ${p.color}40` } : { borderColor: "#e8eef4" }}>
              {p.icon ? <img src={p.icon} alt="" className="h-7 w-7 object-contain rounded" /> : <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-black" style={{ background: p.color }}>؟</div>}
              <span className="text-[11px] font-bold" style={{ color: platform === p.key ? p.color : "#64748b" }}>{isRtl ? p.ar : p.en}</span>
            </button>
          ))}
        </div>
        {/* meals + amount + ref */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">{t("عدد الوجبات", "Meals")}</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setMeals((n) => Math.max(0, n - 1))}><Minus className="h-4 w-4" /></Button>
              <span className="text-xl font-black w-8 text-center tabular-nums">{meals}</span>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setMeals((n) => n + 1)}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">{t("قيمة الطلب (ر.ق)", "Amount (QAR)")}</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-10" dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">{t("رقم الطلب (اختياري)", "Order ref (optional)")}</Label>
            <Input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} className="h-10" />
          </div>
          <Button onClick={add} disabled={saving} className="h-10 rounded-xl font-bold text-white px-6" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
            {saving ? "..." : t("تسجيل", "Add")}
          </Button>
        </div>
      </div>

      {/* per-platform totals (today) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {PLATFORMS.map((p) => {
          const d = summary?.day?.byPlatform?.[p.key] || { orders: 0, meals: 0, revenue: 0 };
          return (
            <div key={p.key} className="rounded-xl bg-white p-2.5 text-center" style={{ border: `1px solid ${p.color}30` }}>
              <div className="flex items-center justify-center gap-1 mb-1">
                {p.icon && <img src={p.icon} alt="" className="h-4 w-4 object-contain rounded" />}
                <span className="text-[11px] font-bold" style={{ color: p.color }}>{isRtl ? p.ar : p.en}</span>
              </div>
              <div className="text-lg font-black text-[#0f1516] tabular-nums">{qr(d.revenue)}</div>
              <div className="text-[10px] text-gray-400">{d.orders} {t("طلب", "ord")} · {d.meals} {t("وجبة", "meal")}</div>
            </div>
          );
        })}
      </div>

      {/* today's orders list */}
      <div>
        <h3 className="text-sm font-bold text-[#47759c] mb-2">{t(`طلبات ${date}`, `Orders ${date}`)} ({rows.length})</h3>
        {rows.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400" style={{ border: "1px solid #e8eef4" }}>{t("لسه مفيش طلبات مسجّلة اليوم", "No orders logged today")}</div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #e8eef4" }}>
            {rows.map((r: any) => {
              const p = pInfo(r.platform);
              return (
                <div key={r._id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 border-gray-100">
                  <div className="flex items-center gap-1.5 w-24 shrink-0">
                    {p.icon && <img src={p.icon} alt="" className="h-5 w-5 object-contain rounded" />}
                    <span className="text-xs font-bold" style={{ color: p.color }}>{isRtl ? p.ar : p.en}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#0f1516]">{r.mealsCount} {t("وجبة", "meals")} · <span className="text-[#0E76AC]">{qr(r.amount)}</span></div>
                    {r.orderRef && <div className="text-[11px] text-gray-400 truncate">{t("رقم", "Ref")}: {r.orderRef}</div>}
                  </div>
                  {isAdmin && <button onClick={() => del(r._id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
