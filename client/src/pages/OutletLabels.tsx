import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Search, Printer, Plus, Minus, Trash2, Barcode, AlertTriangle, Pencil, X, Save } from "lucide-react";
import { confirmDialog, alertDialog } from "@/lib/dialogs";

type LabelRow = {
  _id: string;
  sequence: number;
  barcode: string;
  nameEn: string;
  price?: number;
  calories?: number;
  carbs?: number;
  protein?: number;
  fats?: number;
  isActive: boolean;
  source?: "gym" | "online";
  publicMealId?: string;
};

function ProductBarcode({ value, compact = false }: { value: string; compact?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      height: compact ? 24 : 34,
      width: compact ? 1.25 : 1.5,
      background: "transparent",
      lineColor: "#050505",
    });
  }, [value, compact]);
  return <svg ref={ref} aria-label={`Barcode ${value}`} />;
}

function ThermalLabel({ item }: { item: LabelRow }) {
  return (
    <div className="outlet-thermal-label">
      <div className="outlet-label-brand">
        <div className="outlet-brand-word"><b>ADRENALINE</b><span>HEALTHY FOOD</span></div>
        <img src="/heart-logo.png" alt="" />
      </div>
      <div className="outlet-label-name"><span>{item.nameEn}</span></div>
      <div className="outlet-label-mid">
        <div className="outlet-label-facts">
          <div><b>QR.</b><strong>{item.price ?? "--"}</strong></div>
          <div><span className="cal">Calories</span><strong>{item.calories ?? "--"}</strong><span className="cal">kcal</span></div>
        </div>
        <div className="outlet-label-barcode"><ProductBarcode value={item.barcode} compact /><span>{item.barcode}</span></div>
      </div>
      <div className="outlet-label-macros">
        <span>Pro : <b>{item.protein ?? "--"}</b></span>
        <span>Fat : <b>{item.fats ?? "--"}</b></span>
        <span>Carb : <b>{item.carbs ?? "--"}</b></span>
      </div>
    </div>
  );
}

function optionalNumber(value: string) {
  if (value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export default function OutletLabels() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const sessionToken = useStore(s => s.sessionToken) || undefined;
  const rows = (useQuery(api.outletLabels.list, { sessionToken }) || []) as LabelRow[];
  const seed = useMutation(api.outletLabels.seed);
  const update = useMutation(api.outletLabels.update);
  const create = useMutation(api.outletLabels.create);
  const remove = useMutation(api.outletLabels.remove);
  const importFromPos = useMutation(api.outletLabels.importFromPos);
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<"online" | "gym">("gym");
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<LabelRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const runImportOnline = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const r: any = await importFromPos({ sessionToken });
      setTab("online");
      void alertDialog({ message: isRtl
        ? `تم الاستيراد من الأونلاين ✓\nجديد: ${r.added} · مُحدَّث: ${r.updated}${r.skipped ? ` · متخطّى: ${r.skipped}` : ""} (إجمالي أصناف POS المسعّرة: ${r.total})`
        : `Imported from online ✓\nNew: ${r.added} · Updated: ${r.updated}${r.skipped ? ` · Skipped: ${r.skipped}` : ""} (priced POS items: ${r.total})` });
    } catch (e: any) {
      void alertDialog({ message: e?.message?.replace(/^\[CONVEX .*?\]\s*/, "") || (isRtl ? "فشل الاستيراد" : "Import failed") });
    } finally { setImporting(false); }
  };

  // كتالوجان منفصلان: "online" (مستورد من POS، مربوط بوجبة) و "gym" (القائمة الأصلية)
  const rowSource = (row: any): "online" | "gym" => row.source ?? (row.publicMealId ? "online" : "gym");
  const gymRows = useMemo(() => rows.filter(r => rowSource(r) === "gym"), [rows]);
  const onlineRows = useMemo(() => rows.filter(r => rowSource(r) === "online"), [rows]);
  const tabRows = tab === "online" ? onlineRows : gymRows;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tabRows.filter(row => !q || row.nameEn.toLowerCase().includes(q) || row.barcode.includes(q));
  }, [tabRows, search]);
  const queuedRows = useMemo(() => rows.filter(row => (queue[row._id] || 0) > 0), [rows, queue]);
  const totalCopies = queuedRows.reduce((sum, row) => sum + (queue[row._id] || 0), 0);
  const incomplete = tabRows.filter(row => row.price == null || row.calories == null || row.carbs == null || row.protein == null || row.fats == null).length;

  const changeQty = (id: string, delta: number) => setQueue(current => {
    const next = Math.max(0, (current[id] || 0) + delta);
    return { ...current, [id]: next };
  });

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await update({
        id: editing._id as any,
        nameEn: String(form.get("nameEn") || ""),
        price: optionalNumber(String(form.get("price") || "")),
        calories: optionalNumber(String(form.get("calories") || "")),
        carbs: optionalNumber(String(form.get("carbs") || "")),
        protein: optionalNumber(String(form.get("protein") || "")),
        fats: optionalNumber(String(form.get("fats") || "")),
        sessionToken,
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function saveNew(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await create({
        nameEn: String(form.get("nameEn") || ""),
        price: Number(form.get("price")),
        calories: Number(form.get("calories")),
        carbs: Number(form.get("carbs")),
        protein: Number(form.get("protein")),
        fats: Number(form.get("fats")),
        source: tab,
        sessionToken,
      });
      setCreating(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(item: LabelRow) {
    const ok = await confirmDialog({
      title: isRtl ? "حذف صنف الاستيكر" : "Delete label product",
      message: isRtl ? `سيُحذف «${item.nameEn}» نهائياً من قائمة الاستيكرات. متابعة؟` : `"${item.nameEn}" will be permanently removed from the label list. Continue?`,
      confirmText: isRtl ? "حذف" : "Delete",
      cancelText: isRtl ? "إلغاء" : "Cancel",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await remove({ id: item._id as any, sessionToken });
      setQueue((q) => { const cp = { ...q }; delete cp[item._id]; return cp; }); // أزِلها من قائمة الطباعة
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="outlet-label-page min-h-screen pb-10">
      <div className="print:hidden mx-auto max-w-[1500px] space-y-5">
        <header className="rounded-lg overflow-hidden shadow-[0_18px_45px_rgba(14,118,172,.16)]">
          <div className="bg-[linear-gradient(110deg,#103a5f,#0E76AC_58%,#3cc4f0)] px-6 py-6 text-white flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg border border-white/25 bg-white/10 flex items-center justify-center"><Barcode className="h-6 w-6" /></div>
              <div><h1 className="text-2xl font-black">{isRtl ? "استيكرات أصناف المنافذ" : "Outlet Product Labels"}</h1><p className="text-sm text-cyan-100 mt-1">{isRtl ? "طباعة مستقلة عن الطلبات والفواتير" : "Print independently from orders and invoices"}</p></div>
            </div>
            <div className="flex gap-3 text-center">
              <div className="min-w-24 rounded-lg bg-white/10 border border-white/15 px-4 py-2"><b className="block text-xl">{tabRows.length}</b><span className="text-[11px] text-cyan-100">{tab === "online" ? (isRtl ? "أونلاين" : "Online") : (isRtl ? "جم" : "Gym")}</span></div>
              <div className="min-w-24 rounded-lg bg-white/10 border border-white/15 px-4 py-2"><b className="block text-xl">{totalCopies}</b><span className="text-[11px] text-cyan-100">{isRtl ? "نسخة" : "Copies"}</span></div>
            </div>
          </div>
        </header>

        {rows.length === 0 && <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-5 flex items-center justify-between gap-4"><p className="font-bold text-slate-700">{isRtl ? "كتالوج الاستيكرات لم يُجهز بعد." : "The label catalogue has not been prepared yet."}</p><button onClick={() => seed({ sessionToken })} className="rounded-md bg-[#0E76AC] px-5 py-2.5 text-white font-bold">{isRtl ? "تجهيز قائمة الـ66 صنفًا" : "Prepare 66 products"}</button></div>}

        {incomplete > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-3 text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0" /><p className="text-sm font-bold">{isRtl ? `${incomplete} أصناف بها خانات غير واضحة في الورقة الأصلية. يمكن تعديلها من زر القلم قبل الطباعة.` : `${incomplete} products contain unclear cells in the source sheet. Use Edit before printing.`}</p></div>}

        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
          <section className="rounded-lg border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,55,85,.08)] overflow-hidden">
            {/* تابين منفصلين: الأونلاين (POS) · الجم */}
            <div className="flex border-b border-slate-200">
              {([["gym", isRtl ? "الجم" : "Gym", gymRows.length], ["online", isRtl ? "الأونلاين (POS)" : "Online (POS)", onlineRows.length]] as const).map(([k, label, count]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`flex-1 h-12 font-black text-sm flex items-center justify-center gap-2 border-b-2 transition-colors ${tab === k ? "border-[#0E76AC] text-[#0E76AC] bg-[#eef7fb]" : "border-transparent text-slate-500 hover:bg-slate-50"}`}>
                  {label} <span className={`text-[11px] rounded-full px-2 py-0.5 ${tab === k ? "bg-[#0E76AC] text-white" : "bg-slate-200 text-slate-600"}`}>{count}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center gap-3">
              <div className="relative flex-1"><Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRtl ? "ابحث بالاسم أو رقم الباركود..." : "Search name or barcode..."} className="h-11 ps-10 bg-white" /></div>
              {tab === "online" && <button onClick={runImportOnline} disabled={importing} className="h-11 px-4 rounded-md border border-[#0E76AC] text-[#0E76AC] bg-white font-black flex items-center gap-2 shadow-sm disabled:opacity-50"><Barcode className="h-4 w-4" />{importing ? (isRtl ? "جارٍ الاستيراد…" : "Importing…") : (isRtl ? "استيراد من الأونلاين (POS)" : "Import from online (POS)")}</button>}
              <button onClick={() => setCreating(true)} className="h-11 px-4 rounded-md bg-[#0E76AC] text-white font-black flex items-center gap-2 shadow-sm"><Plus className="h-4 w-4" />{isRtl ? "صنف استيكر جديد" : "New label product"}</button>
            </div>
            <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="py-16 text-center text-slate-400">
                  <Barcode className="h-9 w-9 mx-auto mb-3 opacity-50" />
                  <p className="font-bold">{tab === "online"
                    ? (isRtl ? "لا أصناف أونلاين بعد — اضغط «استيراد من الأونلاين (POS)»" : "No online items yet — click Import from online (POS)")
                    : (isRtl ? "لا أصناف في قائمة الجم" : "No gym items")}</p>
                </div>
              )}
              {filtered.map(item => {
                const qty = queue[item._id] || 0;
                const missing = item.price == null || item.calories == null || item.carbs == null || item.protein == null || item.fats == null;
                return <div key={item._id} className={`grid grid-cols-[52px_minmax(0,1fr)_auto] gap-3 items-center p-3 ${qty ? "bg-cyan-50/60" : "hover:bg-slate-50"}`}>
                  <span className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">{item.sequence}</span>
                  <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="font-black text-slate-900 truncate" dir="ltr">{item.nameEn}</h3>{missing && <span title={isRtl ? "بيانات ناقصة" : "Missing data"} className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />}</div><div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-1" dir="ltr"><b className="text-[#0E76AC]">{item.barcode}</b><span>{item.price ?? "--"} QAR</span><span>{item.calories ?? "--"} kcal</span><span>P {item.protein ?? "--"}</span><span>C {item.carbs ?? "--"}</span><span>F {item.fats ?? "--"}</span></div></div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setEditing(item)} title={isRtl ? "تعديل" : "Edit"} className="h-9 w-9 rounded-md border border-slate-200 text-slate-500 hover:text-[#0E76AC] flex items-center justify-center"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => changeQty(item._id, -1)} disabled={!qty} className="h-9 w-9 rounded-md border border-slate-200 flex items-center justify-center disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                    <span className="w-8 text-center font-black text-slate-900">{qty}</span>
                    <button onClick={() => changeQty(item._id, 1)} className="h-9 w-9 rounded-md bg-[#0E76AC] text-white flex items-center justify-center"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>;
              })}
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,55,85,.08)] overflow-hidden xl:sticky xl:top-4">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2"><div><h2 className="font-black text-slate-900">{isRtl ? "قائمة الطباعة" : "Print queue"}</h2><p className="text-xs text-slate-500 mt-0.5">58 × 39 mm · Code 128</p></div>{queuedRows.length > 0 && <button onClick={() => setQueue({})} className="h-8 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-600 flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" />{isRtl ? "مسح الكل" : "Clear all"}</button>}</div>
            <div className="p-4">
              {queuedRows.length ? <>
                <div className="mx-auto w-fit overflow-hidden border border-slate-300 shadow-md"><ThermalLabel item={queuedRows[0]} /></div>
                <div className="mt-4 max-h-44 overflow-y-auto divide-y divide-slate-100">{queuedRows.map(item => <div key={item._id} className="py-2 flex items-center justify-between gap-3 text-xs"><span className="font-bold truncate" dir="ltr">{item.nameEn}</span><div className="flex items-center gap-2 shrink-0"><b>× {queue[item._id]}</b><button onClick={() => setQueue(q => ({ ...q, [item._id]: 0 }))} className="text-red-500"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
                <button onClick={() => window.print()} className="mt-4 h-12 w-full rounded-md bg-[linear-gradient(110deg,#0E76AC,#3cc4f0)] text-white font-black flex items-center justify-center gap-2 shadow-lg"><Printer className="h-5 w-5" />{isRtl ? `طباعة ${totalCopies} استيكر` : `Print ${totalCopies} labels`}</button>
              </> : <div className="py-16 text-center text-slate-400"><Barcode className="h-10 w-10 mx-auto mb-3 opacity-50" /><p className="font-bold">{isRtl ? "أضف صنفًا لعرض الاستيكر" : "Add a product to preview its label"}</p></div>}
            </div>
          </aside>
        </div>
      </div>

      <div className="outlet-print-root hidden print:block" dir="ltr">
        {queuedRows.flatMap(item => Array.from({ length: queue[item._id] || 0 }, (_, index) => <div className="outlet-print-sheet" key={`${item._id}-${index}`}><ThermalLabel item={item} /></div>))}
      </div>

      {editing && <div className="print:hidden fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e => e.target === e.currentTarget && setEditing(null)}><form onSubmit={saveEdit} className="w-full max-w-xl rounded-lg bg-white shadow-2xl overflow-hidden"><div className="px-5 py-4 bg-slate-50 border-b flex items-center justify-between"><div><h2 className="font-black text-slate-900">{isRtl ? "تعديل بيانات الاستيكر" : "Edit label data"}</h2><p className="text-xs text-[#0E76AC] font-bold mt-1">{editing.barcode}</p></div><button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button></div><div className="p-5 grid grid-cols-2 gap-4"><label className="col-span-2 text-xs font-bold text-slate-600">{isRtl ? "اسم الصنف" : "Product name"}<Input name="nameEn" defaultValue={editing.nameEn} className="mt-1" dir="ltr" required /></label>{(["price", "calories", "carbs", "protein", "fats"] as const).map(key => <label key={key} className="text-xs font-bold text-slate-600 capitalize">{key}<Input name={key} type="number" step="any" min="0" defaultValue={editing[key] ?? ""} className="mt-1" dir="ltr" /></label>)}</div><div className="px-5 py-4 border-t bg-slate-50 flex justify-between gap-2"><button type="button" onClick={() => editing && deleteProduct(editing)} disabled={saving} className="h-10 px-4 rounded-md border border-red-200 bg-red-50 text-red-600 font-bold flex items-center gap-2"><Trash2 className="h-4 w-4" />{isRtl ? "حذف الصنف" : "Delete"}</button><div className="flex gap-2"><button type="button" onClick={() => setEditing(null)} className="h-10 px-4 rounded-md border font-bold">{isRtl ? "إلغاء" : "Cancel"}</button><button disabled={saving} className="h-10 px-5 rounded-md bg-[#0E76AC] text-white font-bold flex items-center gap-2"><Save className="h-4 w-4" />{isRtl ? "حفظ" : "Save"}</button></div></div></form></div>}

      {creating && <div className="print:hidden fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e => e.target === e.currentTarget && setCreating(false)}><form onSubmit={saveNew} className="w-full max-w-xl rounded-lg bg-white shadow-2xl overflow-hidden"><div className="px-5 py-4 bg-slate-50 border-b flex items-center justify-between"><div><h2 className="font-black text-slate-900">{isRtl ? "إضافة صنف استيكر جديد" : "Add new label product"}</h2><p className="text-xs text-[#0E76AC] font-bold mt-1">{isRtl ? "سيُنشأ رقم الباركود التالي تلقائيًا" : "The next barcode will be generated automatically"}</p></div><button type="button" onClick={() => setCreating(false)}><X className="h-5 w-5" /></button></div><div className="p-5 grid grid-cols-2 gap-4"><label className="col-span-2 text-xs font-bold text-slate-600">{isRtl ? "اسم الصنف بالإنجليزي" : "English product name"}<Input name="nameEn" className="mt-1" dir="ltr" required autoFocus /></label>{(["price", "calories", "carbs", "protein", "fats"] as const).map(key => <label key={key} className="text-xs font-bold text-slate-600 capitalize">{key}<Input name={key} type="number" step="any" min="0" className="mt-1" dir="ltr" required /></label>)}</div><div className="px-5 py-4 border-t bg-slate-50 flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="h-10 px-4 rounded-md border font-bold">{isRtl ? "إلغاء" : "Cancel"}</button><button disabled={saving} className="h-10 px-5 rounded-md bg-[#0E76AC] text-white font-bold flex items-center gap-2"><Plus className="h-4 w-4" />{isRtl ? "إضافة الصنف" : "Add product"}</button></div></form></div>}

      <style>{`
        .outlet-label-page{background:linear-gradient(180deg,#e9f6fb 0,#f4f8fb 260px,#eef3f7 100%)}
        .outlet-thermal-label{width:58mm;height:39mm;background:#fff;color:#050505;padding:2.2mm 3mm 1.6mm;box-sizing:border-box;display:flex;flex-direction:column;font-family:Arial,Helvetica,sans-serif;overflow:hidden}
        .outlet-label-brand{height:8mm;display:flex;align-items:center;justify-content:center;gap:2mm;border-bottom:.45mm solid #000;padding-bottom:.8mm}
        .outlet-label-brand img{width:7.8mm;height:7.8mm;object-fit:contain;filter:grayscale(1) brightness(0)}
        .outlet-brand-word{display:flex;flex-direction:column;align-items:center;line-height:.82}.outlet-brand-word b{font-size:5.6mm;font-weight:900;letter-spacing:-.2mm}.outlet-brand-word span{font-size:1.5mm;font-weight:800;letter-spacing:.9mm;margin-top:1mm}
        .outlet-label-name{height:7mm;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;line-height:1.02;overflow:hidden;padding-top:.3mm}.outlet-label-name span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:3.4mm}
        .outlet-label-mid{height:10.8mm;display:grid;grid-template-columns:1fr 24mm;align-items:center}.outlet-label-facts{font-size:3.1mm;line-height:1.5}.outlet-label-facts div{display:flex;gap:2mm;align-items:baseline}.outlet-label-facts .cal{font-size:2.8mm;color:#222}.outlet-label-facts strong{font-size:4.4mm;font-weight:900}.outlet-label-barcode{display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}.outlet-label-barcode svg{max-width:23mm;height:7mm}.outlet-label-barcode span{font-size:3.4mm;letter-spacing:.8mm;line-height:1}
        .outlet-label-macros{margin-top:1.6mm;border:.35mm solid #000;border-radius:1.4mm;padding:.9mm .6mm;display:flex;font-size:3.2mm;font-weight:800;white-space:nowrap}.outlet-label-macros span{flex:1;text-align:center}.outlet-label-macros span+span{border-left:.25mm solid #000}.outlet-label-macros b{font-size:4mm;font-weight:900}
        @media print{@page{size:58mm 39mm;margin:0}html,body{width:58mm!important;margin:0!important;background:#fff!important}.outlet-print-root{display:block!important}.outlet-print-sheet{width:58mm;height:39mm;break-before:page;page-break-before:always;break-inside:avoid;margin:0}.outlet-print-sheet:first-child{break-before:auto;page-break-before:auto}.outlet-thermal-label{border:0!important;margin:0!important}}
      `}</style>
    </div>
  );
}
