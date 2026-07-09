/**
 * @file client/src/pages/StockTake.tsx
 * @description الجرد الفعلي — إدخال الكميات المعدودة، حساب الفروقات، وتطبيق التسويات (هوية أدرينالين)
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ClipboardCheck, ArrowRight, Search, Check, AlertTriangle } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";

const CATS: Record<string, string> = {
  vegetables: "خضروات", proteins: "بروتينات", dairy: "ألبان", dry_goods: "مواد جافة", other: "أخرى",
};
const fmt = (n: number) => (Math.round((n || 0) * 100) / 100).toLocaleString();

export default function StockTake() {
  const { isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const items: any[] = useQuery(api.inventory.listItems, {}) || [];
  const adjustStock = useMutation(api.inventory.adjustStock);
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const [counts, setCounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => !q || (it.nameAr || "").toLowerCase().includes(q) || (it.nameEn || "").toLowerCase().includes(q));
  }, [items, search]);

  const byCat = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const it of filtered) {
      const c = it.category || "other";
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(it);
    }
    return Array.from(m.entries());
  }, [filtered]);

  const changes = useMemo(() => {
    return items
      .filter((it) => { const v = counts[it._id]; return v !== undefined && v !== "" && Number(v) !== Number(it.currentStock); })
      .map((it) => ({ it, actual: Number(counts[it._id]), variance: Number(counts[it._id]) - Number(it.currentStock) }));
  }, [items, counts]);

  const countedTotal = Object.values(counts).filter((v) => v !== "").length;

  const apply = async () => {
    if (!changes.length) { toast({ title: isRtl ? "لا توجد فروقات" : "No discrepancies" }); return; }
    setSaving(true);
    let ok = 0;
    try {
      for (const c of changes) {
        await adjustStock({ itemId: c.it._id, newQuantity: c.actual, note: isRtl ? "جرد فعلي" : "Stock take", sessionToken });
        ok++;
      }
      toast({ title: isRtl ? `تم تطبيق الجرد على ${ok} صنف` : `Stock take applied to ${ok} items`, description: isRtl ? "تم تسجيل التسويات في حركات المخزون" : "Adjustments logged as inventory movements" });
      setCounts({});
    } catch (e: any) {
      toast({ title: isRtl ? "خطأ" : "Error", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-28">
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<ClipboardCheck className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="الجرد الفعلي" titleEn="Stock Take"
          subtitleAr="عُدّ الكميات الفعلية وطابِقها مع النظام" subtitleEn="Count actual quantities and reconcile"
          kpis={[
            { value: `${countedTotal}/${items.length}`, labelAr: "تم عدّ", labelEn: "Counted" },
            { value: changes.length, labelAr: "فروقات", labelEn: "Discrepancies" },
          ]}
          actions={
            <button onClick={() => setLocation("/inventory")} className="flex items-center gap-2 text-sm font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2">
              <ArrowRight className="h-4 w-4" /> {isRtl ? "المخزون" : "Inventory"}
            </button>
          }
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        <div className="relative">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400", isRtl ? "right-3" : "left-3")} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isRtl ? "ابحث عن صنف..." : "Search item..."}
            className={cn("w-full h-11 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm shadow-sm", isRtl ? "pr-10 pl-3" : "pl-10 pr-3")} />
        </div>

        {byCat.map(([cat, list]) => (
          <div key={cat} className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
            <h2 className="text-sm font-bold text-slate-700 px-4 py-2.5 bg-[#f4f8fb] border-b border-slate-100">{CATS[cat] || cat}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f4f8fb] text-[#47759c] font-bold text-xs uppercase border-b border-slate-100">
                    <th className="text-start px-4 py-2">{isRtl ? "الصنف" : "Item"}</th>
                    <th className="text-center px-3 py-2">{isRtl ? "النظام" : "System"}</th>
                    <th className="text-center px-3 py-2">{isRtl ? "المعدود فعليًا" : "Counted"}</th>
                    <th className="text-center px-4 py-2">{isRtl ? "الفرق" : "Variance"}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((it) => {
                    const v = counts[it._id];
                    const has = v !== undefined && v !== "";
                    const variance = has ? Number(v) - Number(it.currentStock) : 0;
                    return (
                      <tr key={it._id} className="border-t border-gray-100 hover:bg-[#f7fbfe]">
                        <td className="px-4 py-2.5 text-slate-900 font-medium">{it.nameAr}</td>
                        <td className="text-center px-3 py-2.5 text-slate-500 tabular-nums">{fmt(it.currentStock)} {it.unit}</td>
                        <td className="text-center px-3 py-2.5">
                          <input type="number" step="0.01" inputMode="decimal" value={v ?? ""}
                            onChange={(e) => setCounts((c) => ({ ...c, [it._id]: e.target.value }))} placeholder={fmt(it.currentStock)}
                            className="w-24 h-9 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-center text-sm tabular-nums focus:border-cyan-500" />
                        </td>
                        <td className="text-center px-4 py-2.5 tabular-nums font-bold">
                          {!has ? (
                            <span className="text-slate-300">—</span>
                          ) : variance === 0 ? (
                            <span className="text-emerald-600">{isRtl ? "مطابق" : "match"}</span>
                          ) : (
                            <span className={variance > 0 ? "text-cyan-600" : "text-red-600"}>{variance > 0 ? "+" : ""}{fmt(variance)} {it.unit}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>{isRtl ? "لا توجد أصناف" : "No items"}</div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{isRtl ? "تم عدّ" : "Counted"}: <b className="text-slate-900">{countedTotal}</b>/{items.length}</span>
            <span className={cn("flex items-center gap-1.5", changes.length ? "text-amber-600" : "text-slate-400")}>
              <AlertTriangle className="h-4 w-4" />{isRtl ? "فروقات" : "Discrepancies"}: <b>{changes.length}</b>
            </span>
          </div>
          <button onClick={apply} disabled={saving || !changes.length}
            className="flex items-center gap-2 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-5 py-2.5 shadow-lg" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
            <Check className="h-4 w-4" />{saving ? (isRtl ? "جارٍ التطبيق..." : "Applying...") : isRtl ? "تطبيق الجرد" : "Apply stock take"}
          </button>
        </div>
      </div>
    </div>
  );
}
