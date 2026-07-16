/**
 * @file client/src/pages/PurchaseOrders.tsx
 * @description أوامر الشراء — توليد من النواقص، متابعة الحالة، واستلامها في المخزون (هوية أدرينالين)
 */
import { useLocation } from "wouter";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ClipboardList, ArrowRight, Sparkles, Send, Truck, XCircle, Trash2, PackageCheck } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";

const fmt = (n: number) => (Math.round((n || 0) * 100) / 100).toLocaleString();

const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft", cls: "bg-slate-100 text-slate-600" },
  SENT: { ar: "مُرسل للمورّد", en: "Sent", cls: "bg-amber-50 text-amber-600" },
  RECEIVED: { ar: "مُستلم", en: "Received", cls: "bg-emerald-50 text-emerald-600" },
  CANCELLED: { ar: "ملغي", en: "Cancelled", cls: "bg-red-50 text-red-600" },
};

export default function PurchaseOrders() {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const orders: any[] = useQuery(
    api.purchaseOrders.list,
    sessionToken ? { sessionToken } : "skip",
  ) || [];
  const generate = useMutation(api.purchaseOrders.generateFromLowStock);
  const updateStatus = useMutation(api.purchaseOrders.updateStatus);
  const remove = useMutation(api.purchaseOrders.remove);

  const handleGenerate = async () => {
    try {
      const res: any = await generate({ sessionToken });
      toast(
        res?.count > 0
          ? { title: isRtl ? `تم إنشاء ${res.count} أمر شراء` : `${res.count} purchase orders created`, description: isRtl ? "من الأصناف الناقصة، مجمّعة حسب المورّد" : "From low-stock items, grouped by supplier" }
          : { title: isRtl ? "لا توجد نواقص" : "Nothing to reorder", description: isRtl ? "كل الأصناف فوق الحد الأدنى" : "All items above minimum" }
      );
    } catch (e: any) {
      toast({ title: isRtl ? "خطأ" : "Error", description: e?.message, variant: "destructive" });
    }
  };
  const setStatus = async (id: string, status: string) => {
    try { await updateStatus({ id: id as any, status: status as any, sessionToken }); }
    catch (e: any) { toast({ title: isRtl ? "خطأ" : "Error", description: e?.message, variant: "destructive" }); }
  };
  const del = async (id: string) => {
    try { await remove({ id: id as any, sessionToken }); }
    catch (e: any) { toast({ title: isRtl ? "خطأ" : "Error", description: e?.message, variant: "destructive" }); }
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<ClipboardList className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="أوامر الشراء" titleEn="Purchase Orders"
          subtitleAr="اطلب الناقص من موردينك وتابِع حالته" subtitleEn="Reorder shortages and track their status"
          kpis={[
            { value: orders.length, labelAr: "أوامر الشراء", labelEn: "Orders" },
          ]}
          actions={
            <button onClick={() => setLocation("/inventory/alerts")} className="flex items-center gap-2 text-sm font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2">
              <ArrowRight className="h-4 w-4" /> {isRtl ? "التنبيهات" : "Alerts"}
            </button>
          }
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        <div className="flex justify-end">
          <button onClick={handleGenerate} className="flex items-center gap-2 text-sm font-bold text-white rounded-xl px-4 py-2.5 shadow-lg" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
            <Sparkles className="h-4 w-4" /> {isRtl ? "توليد من النواقص" : "Generate from shortages"}
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">{isRtl ? "لا توجد أوامر شراء بعد" : "No purchase orders yet"}</p>
            <p className="text-xs text-slate-400 mt-1">{isRtl ? "اضغط «توليد من النواقص» لإنشاء أوامر تلقائياً" : "Click ‘Generate from shortages’ to create them"}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((po) => {
              const st = STATUS[po.status] || STATUS.DRAFT;
              return (
                <div key={po._id} className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
                  <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0"><Truck className="h-5 w-5 text-cyan-600" /></div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">{po.supplierName || (isRtl ? "بدون مورّد محدّد" : "No supplier")}</h3>
                        <p className="text-xs text-slate-400">
                          {(po.items?.length || 0)} {isRtl ? "صنف" : "items"} · <span className="text-slate-700 font-bold">{fmt(po.totalEst)} {isRtl ? "ر.ق" : "QAR"}</span> {isRtl ? "تقديري" : "est."}
                        </p>
                      </div>
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold shrink-0", st.cls)}>{isRtl ? st.ar : st.en}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#f4f8fb] text-[#47759c] font-bold text-xs uppercase border-b border-slate-100">
                          <th className="text-start px-4 py-2">{isRtl ? "الصنف" : "Item"}</th>
                          <th className="text-center px-3 py-2">{isRtl ? "الكمية" : "Qty"}</th>
                          <th className="text-center px-3 py-2">{isRtl ? "سعر تقديري" : "Est. cost"}</th>
                          <th className="text-center px-4 py-2">{isRtl ? "الإجمالي" : "Line"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(po.items || []).map((it: any, i: number) => (
                          <tr key={i} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                            <td className="px-4 py-2 text-slate-700">{isRtl ? it.nameAr : (it.nameEn || it.nameAr)}</td>
                            <td className="text-center px-3 py-2 text-slate-900 font-bold tabular-nums">{fmt(it.quantity)} {it.unit}</td>
                            <td className="text-center px-3 py-2 text-slate-500 tabular-nums">{it.estUnitCost ? fmt(it.estUnitCost) : "—"}</td>
                            <td className="text-center px-4 py-2 text-slate-700 tabular-nums">{it.estLineCost ? fmt(it.estLineCost) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 p-3 bg-slate-50">
                    {po.status === "DRAFT" && (
                      <button onClick={() => setStatus(po._id, "SENT")} className="flex items-center gap-1.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg px-3 py-1.5">
                        <Send className="h-3.5 w-3.5" /> {isRtl ? "إرسال للمورّد" : "Send"}
                      </button>
                    )}
                    {(po.status === "DRAFT" || po.status === "SENT") && (
                      <>
                        <button onClick={() => { setStatus(po._id, "RECEIVED"); setLocation("/inventory/receive"); }} className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5">
                          <PackageCheck className="h-3.5 w-3.5" /> {isRtl ? "استلام في المخزون" : "Receive"}
                        </button>
                        <button onClick={() => setStatus(po._id, "CANCELLED")} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-1.5">
                          <XCircle className="h-3.5 w-3.5" /> {isRtl ? "إلغاء" : "Cancel"}
                        </button>
                      </>
                    )}
                    {(po.status === "RECEIVED" || po.status === "CANCELLED") && (
                      <button onClick={() => del(po._id)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-600 px-3 py-1.5">
                        <Trash2 className="h-3.5 w-3.5" /> {isRtl ? "حذف" : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
