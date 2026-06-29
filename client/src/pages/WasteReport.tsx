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
  const report: any = useQuery(api.inventory.getConsumptionReport, { days });
  const r = report || { totalWasted: 0, totalWasteValue: 0, totalConsumed: 0, totalConsumedValue: 0, wastePct: 0, byReason: [], perItem: [] };

  const kpis = [
    { label: isRtl ? "تكلفة الهالك" : "Waste Cost", value: `${fmt(r.totalWasteValue)} ${isRtl ? "ر.ق" : "QAR"}`, sub: isRtl ? "إجمالي الخسارة" : "Total loss", icon: Coins, danger: true },
    { label: isRtl ? "كمية الهالك" : "Waste Qty", value: fmt(r.totalWasted), sub: isRtl ? "وحدات مهدرة" : "units wasted", icon: Trash2, danger: true },
    { label: isRtl ? "نسبة الهدر" : "Waste %", value: `${r.wastePct}%`, sub: isRtl ? "من الاستهلاك" : "of consumption", icon: Percent, danger: false },
    { label: isRtl ? "استهلاك المطبخ" : "Kitchen Used", value: `${fmt(r.totalConsumedValue)} ${isRtl ? "ر.ق" : "QAR"}`, sub: `${fmt(r.totalConsumed)} ${isRtl ? "وحدة" : "units"}`, icon: ChefHat, danger: false },
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-l from-cyan-500 to-blue-600 px-4 py-6 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center"><TrendingDown className="h-6 w-6 text-white" /></div>
            <div>
              <h1 className="text-xl font-black text-white">{isRtl ? "تقرير الهالك والاستهلاك" : "Waste & Consumption Report"}</h1>
              <p className="text-sm text-white/85">{isRtl ? "تكلفة الهدر وتحليل الاستهلاك" : "Waste cost & consumption analysis"}</p>
            </div>
          </div>
          <button onClick={() => setLocation("/inventory")} className="flex items-center gap-2 text-sm font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2">
            <ArrowRight className="h-4 w-4" /> {isRtl ? "المخزون" : "Inventory"}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        <div className="flex items-center gap-2">
          {RANGES.map((rng) => (
            <button key={rng.days} onClick={() => setDays(rng.days)}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-colors",
                days === rng.days ? "bg-cyan-500 text-white shadow" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}>
              {isRtl ? rng.ar : rng.en}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", k.danger ? "bg-red-50" : "bg-cyan-50")}>
                  <k.icon className={cn("h-5 w-5", k.danger ? "text-red-500" : "text-cyan-600")} />
                </div>
                <p className="text-sm text-slate-500">{k.label}</p>
              </div>
              <p className={cn("text-2xl font-black", k.danger ? "text-red-600" : "text-slate-900")}>{k.value}</p>
              <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
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

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 p-5 pb-3"><TrendingDown className="h-5 w-5 text-cyan-600" />{isRtl ? "التفصيل لكل صنف" : "Per-Item Breakdown"}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-200 text-slate-500 text-xs bg-slate-50">
                  <th className="text-start font-medium px-5 py-2.5">{isRtl ? "الصنف" : "Item"}</th>
                  <th className="text-center font-medium px-3 py-2.5">{isRtl ? "استُهلك" : "Consumed"}</th>
                  <th className="text-center font-medium px-3 py-2.5">{isRtl ? "هالك" : "Wasted"}</th>
                  <th className="text-center font-medium px-3 py-2.5">{isRtl ? "تكلفة الوحدة" : "Unit Cost"}</th>
                  <th className="text-center font-medium px-5 py-2.5">{isRtl ? "تكلفة الهالك" : "Waste Cost"}</th>
                </tr>
              </thead>
              <tbody>
                {(!r.perItem || r.perItem.length === 0) ? (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-8">{isRtl ? "لا توجد بيانات" : "No data"}</td></tr>
                ) : (
                  r.perItem.map((it: any) => (
                    <tr key={it.itemId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{it.nameAr}</td>
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
