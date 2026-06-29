/**
 * @file client/src/pages/InventoryAlerts.tsx
 * @description تنبيهات المخزون — نواقص (إعادة طلب) + قرب انتهاء الصلاحية + منتهي (هوية أدرينالين)
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bell,
  ArrowRight,
  PackageX,
  PackageMinus,
  Clock,
  CalendarX,
  Coins,
  Truck,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";

const HORIZONS = [
  { days: 7, ar: "٧ أيام", en: "7 days" },
  { days: 14, ar: "١٤ يوم", en: "14 days" },
  { days: 30, ar: "٣٠ يوم", en: "30 days" },
];
const fmt = (n: number) => (Math.round((n || 0) * 100) / 100).toLocaleString();

export default function InventoryAlerts() {
  const { isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [days, setDays] = useState(7);
  const data: any = useQuery(api.inventory.getAlerts, { days });
  const generatePO = useMutation(api.purchaseOrders.generateFromLowStock);

  const a = data || {
    lowStock: [], expiring: [], expired: [],
    counts: { lowStock: 0, outOfStock: 0, expiring: 0, expired: 0, total: 0 },
    atRiskValue: 0,
  };

  const handleReorder = async () => {
    try {
      const res: any = await generatePO({});
      if (res?.count > 0) {
        toast({ title: isRtl ? `تم إنشاء ${res.count} أمر شراء` : `${res.count} purchase orders created`, description: isRtl ? "من الأصناف الناقصة، مجمّعة حسب المورّد" : "From low-stock items, grouped by supplier" });
        setLocation("/inventory/purchase-orders");
      } else {
        toast({ title: isRtl ? "لا توجد نواقص للطلب" : "Nothing to reorder" });
      }
    } catch (e: any) {
      toast({ title: isRtl ? "خطأ" : "Error", description: e?.message, variant: "destructive" });
    }
  };

  const kpis = [
    { label: isRtl ? "نفد المخزون" : "Out of Stock", value: a.counts.outOfStock, sub: isRtl ? "صنف بدون رصيد" : "items at zero", icon: PackageX, danger: true },
    { label: isRtl ? "مخزون منخفض" : "Low Stock", value: a.counts.lowStock, sub: isRtl ? "يحتاج إعادة طلب" : "need reorder", icon: PackageMinus, danger: false },
    { label: isRtl ? "قرب الانتهاء" : "Expiring Soon", value: a.counts.expiring, sub: `${isRtl ? "خلال" : "within"} ${days} ${isRtl ? "يوم" : "days"}`, icon: Clock, danger: false },
    { label: isRtl ? "قيمة معرّضة للخطر" : "At-Risk Value", value: `${fmt(a.atRiskValue)}`, sub: isRtl ? "ر.ق (صلاحية)" : "QAR (expiry)", icon: Coins, danger: true },
  ];

  const allClear = a.counts.total === 0 && data !== undefined;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-l from-cyan-500 to-blue-600 px-4 py-6 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center"><Bell className="h-6 w-6 text-white" /></div>
            <div>
              <h1 className="text-xl font-black text-white">{isRtl ? "تنبيهات المخزون" : "Inventory Alerts"}</h1>
              <p className="text-sm text-white/85">{isRtl ? "ما يحتاج تصرّفاً الآن — نواقص وصلاحيات" : "What needs action now — shortages & expiry"}</p>
            </div>
          </div>
          <button onClick={() => setLocation("/inventory")} className="flex items-center gap-2 text-sm font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2">
            <ArrowRight className="h-4 w-4" /> {isRtl ? "المخزون" : "Inventory"}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Horizon + actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{isRtl ? "أفق الصلاحية:" : "Expiry horizon:"}</span>
            {HORIZONS.map((h) => (
              <button key={h.days} onClick={() => setDays(h.days)}
                className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-colors",
                  days === h.days ? "bg-cyan-500 text-white shadow" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}>
                {isRtl ? h.ar : h.en}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReorder} disabled={!a.lowStock.length}
              className="flex items-center gap-2 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-2">
              <ClipboardList className="h-4 w-4" /> {isRtl ? "اطلب من المورّد" : "Reorder"}
            </button>
            <button onClick={() => setLocation("/inventory/purchase-orders")}
              className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg px-4 py-2">
              <Truck className="h-4 w-4" /> {isRtl ? "أوامر الشراء" : "Orders"}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", k.danger ? "bg-red-50" : "bg-cyan-50")}>
                  <k.icon className={cn("h-5 w-5", k.danger ? "text-red-500" : "text-cyan-600")} />
                </div>
                <p className="text-sm text-slate-500">{k.label}</p>
              </div>
              <p className="text-2xl font-black text-slate-900">{k.value}</p>
              <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        {allClear && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-lg font-bold text-slate-900">{isRtl ? "كل شيء على ما يرام ✅" : "All clear ✅"}</p>
            <p className="text-sm text-slate-500">{isRtl ? "لا نواقص ولا أصناف قاربت على الانتهاء" : "No shortages and nothing expiring soon"}</p>
          </div>
        )}

        {/* Expired */}
        {a.expired.length > 0 && (
          <Section icon={CalendarX} title={isRtl ? "منتهي الصلاحية — أزِلها" : "Expired — remove now"} danger>
            <BatchTable rows={a.expired} isRtl={isRtl} expired />
          </Section>
        )}

        {/* Low stock */}
        {a.lowStock.length > 0 && (
          <Section icon={PackageMinus} title={isRtl ? "نواقص المخزون — أعد الطلب" : "Stock shortages — reorder"}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-200 text-slate-500 text-xs bg-slate-50">
                    <th className="text-start font-medium px-5 py-2.5">{isRtl ? "الصنف" : "Item"}</th>
                    <th className="text-center font-medium px-3 py-2.5">{isRtl ? "الرصيد" : "Stock"}</th>
                    <th className="text-center font-medium px-3 py-2.5">{isRtl ? "حد الطلب" : "Min"}</th>
                    <th className="text-center font-medium px-3 py-2.5">{isRtl ? "اطلب" : "Reorder"}</th>
                    <th className="text-center font-medium px-5 py-2.5">{isRtl ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.lowStock.map((it: any) => (
                    <tr key={it.itemId} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setLocation(`/inventory/${it.itemId}`)}>
                      <td className="px-5 py-3 font-medium text-slate-900">{it.nameAr}</td>
                      <td className="text-center px-3 py-3 text-slate-500 tabular-nums">{fmt(it.currentStock)} {it.unit}</td>
                      <td className="text-center px-3 py-3 text-slate-400 tabular-nums">{fmt(it.minStock)} {it.unit}</td>
                      <td className="text-center px-3 py-3 font-bold text-slate-900 tabular-nums">+{fmt(it.reorderQty)} {it.unit}</td>
                      <td className="text-center px-5 py-3">
                        {it.isOut ? (
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600">{isRtl ? "نفد" : "Out"}</span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600">{isRtl ? "منخفض" : "Low"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Expiring */}
        {a.expiring.length > 0 && (
          <Section icon={Clock} title={isRtl ? "قرب انتهاء الصلاحية" : "Expiring soon"}>
            <BatchTable rows={a.expiring} isRtl={isRtl} />
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, danger, children }: { icon: any; title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("bg-white rounded-xl border overflow-hidden shadow-sm", danger ? "border-red-200" : "border-slate-200")}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 p-5 pb-3"><Icon className="h-5 w-5 text-cyan-600" />{title}</h2>
      {children}
    </div>
  );
}

function BatchTable({ rows, isRtl, expired }: { rows: any[]; isRtl: boolean; expired?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-slate-200 text-slate-500 text-xs bg-slate-50">
            <th className="text-start font-medium px-5 py-2.5">{isRtl ? "الصنف" : "Item"}</th>
            <th className="text-center font-medium px-3 py-2.5">{isRtl ? "الكمية" : "Qty"}</th>
            <th className="text-center font-medium px-3 py-2.5">{isRtl ? "تاريخ الانتهاء" : "Expiry"}</th>
            <th className="text-center font-medium px-3 py-2.5">{isRtl ? "المتبقي" : "Days left"}</th>
            <th className="text-center font-medium px-5 py-2.5">{isRtl ? "القيمة" : "Value"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b: any) => (
            <tr key={b.batchId} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-900">{b.nameAr}</td>
              <td className="text-center px-3 py-3 text-slate-500 tabular-nums">{fmt(b.quantity)} {b.unit}</td>
              <td className="text-center px-3 py-3 text-slate-500 tabular-nums" dir="ltr">{b.expiryDate}</td>
              <td className="text-center px-3 py-3 font-bold tabular-nums">
                {expired ? (
                  <span className="text-red-600">{isRtl ? `منذ ${Math.abs(b.daysLeft)} يوم` : `${Math.abs(b.daysLeft)}d ago`}</span>
                ) : (
                  <span className={b.daysLeft <= 2 ? "text-amber-600" : "text-slate-700"}>{b.daysLeft} {isRtl ? "يوم" : "d"}</span>
                )}
              </td>
              <td className="text-center px-5 py-3 font-bold text-slate-900 tabular-nums">{fmt(b.value)} {isRtl ? "ر.ق" : "QAR"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
