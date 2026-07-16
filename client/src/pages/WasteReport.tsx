/**
 * @file client/src/pages/WasteReport.tsx
 * @description تقرير الهالك والاستهلاك — تكلفة الهدر + تفصيل حسب الصنف والسبب (هوية أدرينالين)
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TrendingDown, Coins, Percent, ChefHat, ArrowRight, Trash2, PieChart } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

const RANGES = [
  { days: 7, ar: "٧ أيام", en: "7 days" },
  { days: 30, ar: "٣٠ يوم", en: "30 days" },
  { days: 90, ar: "٩٠ يوم", en: "90 days" },
];
const fmt = (n: number) => (Math.round((n || 0) * 100) / 100).toLocaleString();

export default function WasteReport() {
  const { isRtl } = useLanguage();
  const [, setLocation] = useLocation();
  const [days, setDays] = useState(30);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const report: any = useQuery(
    api.inventory.getConsumptionReport,
    sessionToken ? { days, sessionToken } : "skip",
  );
  const r = report || { totalWasted: 0, totalWasteValue: 0, totalConsumed: 0, totalConsumedValue: 0, wastePct: 0, byReason: [], perItem: [] };

  const kpis = [
    { label: isRtl ? "تكلفة الهالك" : "Waste Cost", value: `${fmt(r.totalWasteValue)} ${isRtl ? "ر.ق" : "QAR"}`, sub: isRtl ? "إجمالي الخسارة" : "Total loss", icon: Coins, danger: true },
    { label: isRtl ? "كمية الهالك" : "Waste Qty", value: fmt(r.totalWasted), sub: isRtl ? "وحدات مهدرة" : "units wasted", icon: Trash2, danger: true },
    { label: isRtl ? "نسبة الهدر" : "Waste %", value: `${r.wastePct}%`, sub: isRtl ? "من الاستهلاك" : "of consumption", icon: Percent, danger: false },
    { label: isRtl ? "استهلاك المطبخ" : "Kitchen Used", value: `${fmt(r.totalConsumedValue)} ${isRtl ? "ر.ق" : "QAR"}`, sub: `${fmt(r.totalConsumed)} ${isRtl ? "وحدة" : "units"}`, icon: ChefHat, danger: false },
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-5">
        <DashboardHeader
          icon={<TrendingDown className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="تقرير الهالك والاستهلاك" titleEn="Waste & Consumption Report"
          subtitleAr="تكلفة الهدر وتحليل الاستهلاك" subtitleEn="Waste cost & consumption analysis"
          actions={
            <Button
              onClick={() => setLocation("/inventory")}
              className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm gap-2"
            >
              <ArrowRight className="h-4 w-4" /> {isRtl ? "المخزون" : "Inventory"}
            </Button>
          }
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        <div className="flex items-center gap-2">
          {RANGES.map((rng) => (
            <button key={rng.days} onClick={() => setDays(rng.days)}
              style={days === rng.days ? { background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" } : undefined}
              className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-colors",
                days === rng.days ? "text-white shadow" : "bg-white text-slate-600 border border-gray-200 hover:bg-[#f7fbfe]")}>
              {isRtl ? rng.ar : rng.en}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <div key={i} className="bg-white rounded-2xl p-4" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", k.danger ? "bg-red-50" : "bg-cyan-50")}>
                  <k.icon className={cn("h-5 w-5", k.danger ? "text-red-500" : "text-cyan-600")} />
                </div>
                <p className="text-sm text-gray-400 font-semibold">{k.label}</p>
              </div>
              <p className={cn("text-2xl font-black tabular-nums", k.danger ? "text-red-600" : "text-[#0E76AC]")}>{k.value}</p>
              <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-4"><PieChart className="h-5 w-5 text-cyan-600" />{isRtl ? "الهالك حسب السبب" : "Waste by Reason"}</h2>
          {(!r.byReason || r.byReason.length === 0) ? (
            <p className="text-sm text-slate-400 py-4 text-center">{isRtl ? "لا يوجد هالك مسجّل في هذه الفترة" : "No waste recorded in this period"}</p>
          ) : (
            <div className="space-y-3">
              {r.byReason.map((br: any) => {
                const pct = r.totalWasteValue > 0 ? Math.round((br.value / r.totalWasteValue) * 100) : 0;
                return (
                  <div key={br.reason}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-700 font-medium">{br.reason}</span>
                      <span className="text-slate-900 font-bold">{fmt(br.value)} {isRtl ? "ر.ق" : "QAR"}<span className="text-slate-400 font-normal"> · {fmt(br.qty)}</span></span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-l from-red-500 to-rose-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 p-5 pb-3"><TrendingDown className="h-5 w-5 text-cyan-600" />{isRtl ? "التفصيل لكل صنف" : "Per-Item Breakdown"}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-[#e8eef4] text-[#47759c] text-xs uppercase bg-[#f4f8fb]">
                  <th className="text-start font-bold px-5 py-2.5">{isRtl ? "الصنف" : "Item"}</th>
                  <th className="text-center font-bold px-3 py-2.5">{isRtl ? "استُهلك" : "Consumed"}</th>
                  <th className="text-center font-bold px-3 py-2.5">{isRtl ? "هالك" : "Wasted"}</th>
                  <th className="text-center font-bold px-3 py-2.5">{isRtl ? "تكلفة الوحدة" : "Unit Cost"}</th>
                  <th className="text-center font-bold px-5 py-2.5">{isRtl ? "تكلفة الهالك" : "Waste Cost"}</th>
                </tr>
              </thead>
              <tbody>
                {(!r.perItem || r.perItem.length === 0) ? (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-8">{isRtl ? "لا توجد بيانات" : "No data"}</td></tr>
                ) : (
                  r.perItem.map((it: any) => (
                    <tr key={it.itemId} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                      <td className="px-5 py-3 font-medium text-slate-900">{isRtl ? it.nameAr : (it.nameEn || it.nameAr)}</td>
                      <td className="text-center px-3 py-3 text-slate-500">{fmt(it.consumed)} {it.unit}</td>
                      <td className="text-center px-3 py-3 font-bold text-red-600">{fmt(it.wasted)} {it.unit}</td>
                      <td className="text-center px-3 py-3 text-slate-500">{fmt(it.unitCost)} {isRtl ? "ر.ق" : ""}</td>
                      <td className="text-center px-5 py-3 font-bold text-slate-900">{fmt(it.wastedCost)} {isRtl ? "ر.ق" : "QAR"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
