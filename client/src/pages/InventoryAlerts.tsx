/**
 * @file client/src/pages/InventoryAlerts.tsx
 * @description تنبيهات المخزون — نواقص (إعادة طلب) + قرب انتهاء الصلاحية + منتهي (هوية أدرينالين)
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bell,
  ArrowRight,
  PackageMinus,
  Clock,
  CalendarX,
  Truck,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";

const HORIZONS = [
  { days: 7, ar: "٧ أيام", en: "7 days" },
  { days: 14, ar: "١٤ يوم", en: "14 days" },
  { days: 30, ar: "٣٠ يوم", en: "30 days" },
];
const fmt = (n: number) => (Math.round((n || 0) * 100) / 100).toLocaleString();

export default function InventoryAlerts() {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [days, setDays] = useState(7);
  const data: any = useQuery(
    api.inventory.getAlerts,
    sessionToken ? { days, sessionToken } : "skip",
  );
  const generatePO = useMutation(api.purchaseOrders.generateFromLowStock);

  const a = data || {
    lowStock: [], expiring: [], expired: [],
    counts: { lowStock: 0, outOfStock: 0, expiring: 0, expired: 0, total: 0 },
    atRiskValue: 0,
  };

  const handleReorder = async () => {
    try {
      const res: any = await generatePO({ sessionToken });
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

  const allClear = a.counts.total === 0 && data !== undefined;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<Bell className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="تنبيهات المخزون" titleEn="Inventory Alerts"
          subtitleAr="ما يحتاج تصرّفاً الآن — نواقص وصلاحيات" subtitleEn="What needs action now — shortages & expiry"
          kpis={[
            { value: a.counts.outOfStock, labelAr: "نفد المخزون", labelEn: "Out of Stock" },
            { value: a.counts.lowStock, labelAr: "مخزون منخفض", labelEn: "Low Stock" },
            { value: a.counts.expiring, labelAr: "قرب الانتهاء", labelEn: "Expiring Soon" },
            { value: fmt(a.atRiskValue), labelAr: "قيمة معرّضة للخطر", labelEn: "At-Risk Value" },
          ]}
          actions={
            <button onClick={() => setLocation("/inventory")} className="flex items-center gap-2 text-sm font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2">
              <ArrowRight className="h-4 w-4" /> {isRtl ? "المخزون" : "Inventory"}
            </button>
          }
        />
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
              className="flex items-center gap-2 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-4 py-2 shadow-lg" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
              <ClipboardList className="h-4 w-4" /> {isRtl ? "اطلب من المورّد" : "Reorder"}
            </button>
            <button onClick={() => setLocation("/inventory/purchase-orders")}
              className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg px-4 py-2">
              <Truck className="h-4 w-4" /> {isRtl ? "أوامر الشراء" : "Orders"}
            </button>
          </div>
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
                  <tr className="bg-[#f4f8fb] text-[#47759c] font-bold text-xs uppercase border-y border-slate-100">
                    <th className="text-start font-medium px-5 py-2.5">{isRtl ? "الصنف" : "Item"}</th>
                    <th className="text-center font-medium px-3 py-2.5">{isRtl ? "الرصيد" : "Stock"}</th>
                    <th className="text-center font-medium px-3 py-2.5">{isRtl ? "حد الطلب" : "Min"}</th>
                    <th className="text-center font-medium px-3 py-2.5">{isRtl ? "اطلب" : "Reorder"}</th>
                    <th className="text-center font-medium px-5 py-2.5">{isRtl ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.lowStock.map((it: any) => (
                    <tr key={it.itemId} className="border-t border-gray-100 hover:bg-[#f7fbfe] cursor-pointer" onClick={() => setLocation(`/inventory/${it.itemId}`)}>
                      <td className="px-5 py-3 font-medium text-slate-900">{isRtl ? it.nameAr : (it.nameEn || it.nameAr)}</td>
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
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: danger ? "1px solid #fecaca" : "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
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
            <tr key={b.batchId} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
              <td className="px-5 py-3 font-medium text-slate-900">{isRtl ? b.nameAr : (b.nameEn || b.nameAr)}</td>
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
