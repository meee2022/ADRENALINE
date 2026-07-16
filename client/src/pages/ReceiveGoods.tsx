/**
 * @file client/src/pages/ReceiveGoods.tsx
 * @description استلام بضاعة (فاتورة شراء) — إدخال عدة أصناف للمخزون دفعة واحدة (هوية أدرينالين)
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Plus, Trash2, PackagePlus, Truck, ClipboardPaste } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";

const CATEGORIES = [
  { v: "vegetables", ar: "خضروات", en: "Vegetables" }, { v: "proteins", ar: "بروتينات", en: "Proteins" },
  { v: "dairy", ar: "ألبان", en: "Dairy" }, { v: "dry_goods", ar: "مواد جافة", en: "Dry Goods" }, { v: "other", ar: "أخرى", en: "Other" },
];
const UNITS = [
  { v: "kg", ar: "كجم", en: "kg" }, { v: "piece", ar: "قطعة", en: "Piece" }, { v: "liter", ar: "لتر", en: "Liter" },
  { v: "pack", ar: "عبوة", en: "Pack" }, { v: "box", ar: "صندوق", en: "Box" },
];

type Line = { mode: "existing" | "new"; itemId: string; nameAr: string; category: string; unit: string; quantity: string; unitCost: string; expiryDate: string; lotNumber: string; locationId: string; quantityInPurchaseUnit: boolean; };
const emptyLine = (): Line => ({ mode: "existing", itemId: "", nameAr: "", category: "proteins", unit: "kg", quantity: "", unitCost: "", expiryDate: "", lotNumber: "", locationId: "", quantityInPurchaseUnit: false });

export default function ReceiveGoods() {
  const { isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const items: any[] = useQuery(api.inventory.listItems, { sessionToken }) || [];
  const suppliers: any[] = useQuery(api.inventory.getSuppliers, { sessionToken }) || [];
  const setup: any = useQuery(api.inventorySetup.getSetupData, sessionToken ? { sessionToken } : "skip");
  const receiveMany = useMutation(api.inventory.receiveMany);
  const createSupplier = useMutation(api.inventory.createSupplier);

  const today = new Date().toISOString().slice(0, 10);
  const [supplierId, setSupplierId] = useState("");
  const [receivedAt, setReceivedAt] = useState(today);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [newSupplier, setNewSupplier] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // Parse pasted rows from Excel/CSV: "name <tab|,|;> qty <..> unitCost <..> [expiry]"
  const parsePaste = () => {
    const rows = pasteText.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    const parsed: Line[] = [];
    for (const row of rows) {
      const cols = row.split(/\t|,|;|\|/).map((c) => c.trim());
      if (cols.length < 2) continue;
      const name = cols[0];
      const qty = (cols[1] || "").replace(/[^\d.]/g, "");
      const cost = (cols[2] || "").replace(/[^\d.]/g, "");
      const expiry = (cols[3] || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
      const lotNumber = cols[4] || "";
      const locationCode = cols[5] || "";
      const locationId = setup?.locations?.find((l: any) => l.code.toLowerCase() === locationCode.toLowerCase())?._id || "";
      if (!name || !qty) continue; // skips header rows (qty non-numeric)
      const existing = items.find((it) =>
        (it.nameAr || "").trim().toLowerCase() === name.toLowerCase() ||
        (it.nameEn || "").trim().toLowerCase() === name.toLowerCase(),
      );
      parsed.push(
        existing
          ? { ...emptyLine(), mode: "existing", itemId: existing._id, unit: existing.unit, quantity: qty, unitCost: cost, expiryDate: expiry, lotNumber, locationId }
          : { ...emptyLine(), mode: "new", nameAr: name, quantity: qty, unitCost: cost, expiryDate: expiry, lotNumber, locationId },
      );
    }
    if (parsed.length) {
      setLines(parsed); setShowImport(false); setPasteText("");
      toast({ title: isRtl ? `تم تحويل ${parsed.length} صنف` : `${parsed.length} items parsed` });
    } else {
      toast({ title: isRtl ? "صيغة غير صحيحة" : "Invalid format", description: isRtl ? "كل سطر: الاسم، الكمية، السعر" : "Each row: name, qty, unitCost", variant: "destructive" });
    }
  };

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, emptyLine()]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const lineTotal = (l: Line) => (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const totalQty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  const handleAddSupplier = async () => {
    if (!newSupplier.trim()) return;
    try {
      const id = await createSupplier({ name: newSupplier.trim(), sessionToken });
      setSupplierId(id as string); setNewSupplier("");
      toast({ title: isRtl ? "تم إضافة المورّد" : "Supplier added" });
    } catch (e: any) { toast({ title: isRtl ? "خطأ" : "Error", description: e?.message, variant: "destructive" }); }
  };

  const handleSubmit = async () => {
    const valid = lines.filter((l) => Number(l.quantity) > 0 && (l.mode === "existing" ? l.itemId : l.nameAr.trim()));
    if (valid.length === 0) { toast({ title: isRtl ? "لا توجد أصناف" : "No items", description: isRtl ? "أضف صنفاً وكمية صحيحة" : "Add at least one item", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res: any = await receiveMany({
        sessionToken,
        supplierId: (supplierId || undefined) as any,
        receivedAt,
        invoiceNo: invoiceNo || undefined,
        lines: valid.map((l) => l.mode === "existing"
          ? { itemId: l.itemId as any, quantity: Number(l.quantity), unitCost: Number(l.unitCost) || 0, quantityInPurchaseUnit: l.quantityInPurchaseUnit, expiryDate: l.expiryDate || undefined, lotNumber: l.lotNumber || undefined, locationId: (l.locationId || undefined) as any }
          : { newItem: { nameAr: l.nameAr.trim(), category: l.category as any, unit: l.unit as any, targetStock: Number(l.quantity) }, quantity: Number(l.quantity), unitCost: Number(l.unitCost) || 0, expiryDate: l.expiryDate || undefined, lotNumber: l.lotNumber || undefined, locationId: (l.locationId || undefined) as any }),
      });
      toast({ title: isRtl ? "تم استلام البضاعة ✅" : "Goods received ✅", description: isRtl ? `${res.count} صنف · ${res.totalCost.toLocaleString()} ر.ق أُضيفت للمخزون` : `${res.count} items · ${res.totalCost.toLocaleString()} QAR added` });
      setLocation("/inventory");
    } catch (e: any) { toast({ title: isRtl ? "خطأ" : "Error", description: e?.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const selCls = "w-full rounded-md border border-slate-300 bg-white text-slate-900 px-2 py-2 text-sm";

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-28">
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <DashboardHeader
          icon={<PackagePlus className="h-6 w-6 sm:h-7 sm:w-7" />}
          titleAr="استلام بضاعة" titleEn="Receive Goods"
          subtitleAr="أدخل أصناف الفاتورة دفعة واحدة" subtitleEn="Enter a purchase invoice — many items at once"
          actions={
            <button onClick={() => setLocation("/inventory")} className="flex items-center gap-2 text-sm font-bold text-white bg-white/20 hover:bg-white/30 rounded-xl px-4 py-2"><ArrowRight className="h-4 w-4" /> {isRtl ? "المخزون" : "Inventory"}</button>
          }
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        <div className="bg-white rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">{isRtl ? "المورّد" : "Supplier"}</Label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selCls}>
              <option value="">{isRtl ? "بدون مورّد" : "No supplier"}</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            <div className="flex gap-1.5 pt-1">
              <Input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} placeholder={isRtl ? "مورّد جديد..." : "New supplier..."} className="h-8 text-xs" />
              <Button size="sm" variant="outline" onClick={handleAddSupplier} className="h-8 px-2"><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">{isRtl ? "تاريخ الاستلام" : "Received date"}</Label>
            <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">{isRtl ? "رقم الفاتورة (اختياري)" : "Invoice no. (optional)"}</Label>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-..." />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">{isRtl ? "الأصناف" : "Items"}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowImport((s) => !s)}
                className="flex items-center gap-1.5 text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg px-3 py-1.5">
                <ClipboardPaste className="h-3.5 w-3.5" /> {isRtl ? "لصق من Excel" : "Paste from Excel"}
              </button>
              <span className="text-xs text-slate-500">{lines.length} {isRtl ? "سطر" : "lines"}</span>
            </div>
          </div>

          {showImport && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs text-slate-500">
                {isRtl
                  ? "انسخ الأعمدة من Excel والصقها هنا — كل سطر: الاسم، الكمية، سعر الوحدة، (الصلاحية اختياري yyyy-MM-dd)."
                  : "Copy columns from Excel and paste here — each row: name, qty, unit cost, (optional expiry yyyy-MM-dd)."}
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                placeholder={isRtl ? "صدر دجاج\t20\t18\nأرز بني\t50\t8\nسلمون,10,55" : "Chicken\t20\t18\nRice\t50\t8\nSalmon,10,55"}
                className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm font-mono"
                dir="ltr"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowImport(false); setPasteText(""); }}>{isRtl ? "إلغاء" : "Cancel"}</Button>
                <Button size="sm" onClick={parsePaste} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5">
                  <ClipboardPaste className="h-4 w-4" /> {isRtl ? "تحويل لأسطر" : "Convert to lines"}
                </Button>
              </div>
            </div>
          )}

          {lines.map((l, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-4 space-y-1">
                  <Label className="text-[10px] text-slate-400">{isRtl ? "الصنف" : "Item"}</Label>
                  <select value={l.mode === "new" ? "__new__" : l.itemId}
                    onChange={(e) => { if (e.target.value === "__new__") setLine(i, { mode: "new", itemId: "", quantityInPurchaseUnit: false }); else { const it = items.find((x) => x._id === e.target.value); setLine(i, { mode: "existing", itemId: e.target.value, unit: it?.unit || l.unit, quantityInPurchaseUnit: Number(it?.purchaseToBaseFactor || 1) !== 1 }); } }}
                    className={selCls}>
                    <option value="">{isRtl ? "اختر صنف" : "Select item"}</option>
                    {items.map((it) => <option key={it._id} value={it._id}>{isRtl ? it.nameAr : (it.nameEn || it.nameAr)} ({it.currentStock} {it.unit})</option>)}
                    <option value="__new__">➕ {isRtl ? "صنف جديد" : "New item"}</option>
                  </select>
                </div>
                {l.mode === "new" && (<>
                  <div className="col-span-6 sm:col-span-2 space-y-1"><Label className="text-[10px] text-slate-400">{isRtl ? "الاسم" : "Name"}</Label><Input value={l.nameAr} onChange={(e) => setLine(i, { nameAr: e.target.value })} className="h-9 text-sm" /></div>
                  <div className="col-span-3 sm:col-span-1 space-y-1"><Label className="text-[10px] text-slate-400">{isRtl ? "النوع" : "Cat"}</Label><select value={l.category} onChange={(e) => setLine(i, { category: e.target.value })} className={selCls}>{CATEGORIES.map((c) => <option key={c.v} value={c.v}>{isRtl ? c.ar : c.en}</option>)}</select></div>
                </>)}
                <div className="col-span-4 sm:col-span-1 space-y-1"><Label className="text-[10px] text-slate-400">{isRtl ? "الكمية" : "Qty"}</Label><Input type="number" step="0.01" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="h-9 text-sm" /></div>
                {l.mode === "existing" && Number(items.find((x)=>x._id===l.itemId)?.purchaseToBaseFactor || 1) !== 1 && <label className="col-span-6 sm:col-span-2 flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-2 text-[11px] font-bold text-cyan-800"><input type="checkbox" checked={l.quantityInPurchaseUnit} onChange={(e)=>setLine(i,{quantityInPurchaseUnit:e.target.checked})}/>{isRtl ? `الكمية بوحدة الشراء (${items.find((x)=>x._id===l.itemId)?.purchaseUnit})` : `Use purchase unit (${items.find((x)=>x._id===l.itemId)?.purchaseUnit})`}</label>}
                {l.mode === "new" && (<div className="col-span-4 sm:col-span-1 space-y-1"><Label className="text-[10px] text-slate-400">{isRtl ? "الوحدة" : "Unit"}</Label><select value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className={selCls}>{UNITS.map((u) => <option key={u.v} value={u.v}>{isRtl ? u.ar : u.en}</option>)}</select></div>)}
                <div className="col-span-4 sm:col-span-2 space-y-1"><Label className="text-[10px] text-slate-400">{isRtl ? "سعر الوحدة" : "Unit cost"}</Label><Input type="number" step="0.01" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} className="h-9 text-sm" /></div>
                <div className="col-span-6 sm:col-span-2 space-y-1"><Label className="text-[10px] text-slate-400">{isRtl ? "الصلاحية" : "Expiry"}</Label><Input type="date" value={l.expiryDate} onChange={(e) => setLine(i, { expiryDate: e.target.value })} className="h-9 text-sm" /></div>
                <div className="col-span-6 sm:col-span-2 space-y-1"><Label className="text-[10px] text-slate-400">{isRtl ? "رقم التشغيلة" : "Lot no."}</Label><Input value={l.lotNumber} onChange={(e) => setLine(i, { lotNumber: e.target.value })} className="h-9 text-sm" /></div>
                <div className="col-span-6 sm:col-span-2 space-y-1"><Label className="text-[10px] text-slate-400">{isRtl ? "موقع التخزين" : "Location"}</Label><select value={l.locationId} onChange={(e) => setLine(i, { locationId: e.target.value })} className={selCls}><option value="">{isRtl ? "الموقع الافتراضي" : "Default location"}</option>{(setup?.locations || []).map((x:any)=><option key={x._id} value={x._id}>{isRtl?x.nameAr:x.nameEn}</option>)}</select></div>
                <div className="col-span-6 sm:col-span-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-cyan-700 tabular-nums">{lineTotal(l).toLocaleString()}</span>
                  {lines.length > 1 && <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>}
                </div>
              </div>
            </div>
          ))}
          <button onClick={addLine} className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:text-cyan-600 hover:border-cyan-300 py-2.5 text-sm font-medium transition-colors"><Plus className="h-4 w-4" /> {isRtl ? "إضافة سطر" : "Add line"}</button>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,.08)] z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 text-sm">
            <div><span className="text-slate-500">{isRtl ? "الكمية:" : "Qty:"}</span> <span className="font-bold text-slate-900">{totalQty.toLocaleString()}</span></div>
            <div><span className="text-slate-500">{isRtl ? "الإجمالي:" : "Total:"}</span> <span className="font-black text-cyan-600 text-lg">{grandTotal.toLocaleString()} {isRtl ? "ر.ق" : "QAR"}</span></div>
          </div>
          <Button onClick={handleSubmit} disabled={saving} className="text-white font-bold gap-2 h-11 px-6 rounded-xl shadow-lg" style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}><Truck className="h-5 w-5" />{saving ? (isRtl ? "جارٍ الحفظ..." : "Saving...") : (isRtl ? "تأكيد الاستلام" : "Confirm receipt")}</Button>
        </div>
      </div>
    </div>
  );
}
