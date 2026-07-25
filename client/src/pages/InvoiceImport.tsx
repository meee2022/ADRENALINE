/**
 * @file client/src/pages/InvoiceImport.tsx
 * @description استلام فاتورة شراء — تُبنى الأصناف والموردون والأسعار من الفاتورة
 *              نفسها، بدل إدخال آلاف الأصناف يدوياً.
 * @convex convex/purchaseInvoices.ts
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { alertDialog } from "@/lib/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Trash2, Check, Package, Wand2 } from "lucide-react";

type Line = {
  name: string;
  nameAr: string;
  supplierSku: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  packSize: string;
};

const emptyLine = (): Line => ({
  name: "", nameAr: "", supplierSku: "", quantity: "", unit: "PCS", unitPrice: "", packSize: "",
});

/**
 * لصق أسطر الفاتورة: كل سطر صنف، والأعمدة مفصولة بتاب (نسخ من إكسل) أو بفواصل.
 * الترتيب المتوقّع: الاسم · الكمية · الوحدة · السعر — والباقي اختياري.
 */
function parsePaste(text: string): Line[] {
  return String(text || "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const cols = row.split(/\t|\s*[|;]\s*|,(?=\s*\S)/).map((c) => c.trim());
      const [name = "", quantity = "", unit = "", unitPrice = "", packSize = ""] = cols;
      return { ...emptyLine(), name, quantity, unit: unit || "PCS", unitPrice, packSize };
    })
    .filter((l) => l.name);
}

export default function InvoiceImport() {
  const { language, dir } = useLanguage();
  const isRtl = dir === "rtl" || language === "ar";
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState("");
  const [receiveStock, setReceiveStock] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);

  const importInvoice = useMutation(api.purchaseInvoices.importInvoice);
  const invoices = useQuery(api.purchaseInvoices.listInvoices, { limit: 15, sessionToken }) as any[] | undefined;

  const validLines = useMemo(
    () => lines.filter((l) => l.name.trim() && Number(l.quantity) > 0),
    [lines],
  );

  // مجموع الأسطر — يُقارَن بإجمالي الفاتورة المكتوب فيها لكشف أي سطر ناقص
  const computed = useMemo(
    () => validLines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice || 0), 0),
    [validLines],
  );
  const stated = Number(total) || 0;
  const mismatch = stated > 0 && Math.abs(stated - computed) > 1;

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const applyPaste = () => {
    const parsed = parsePaste(paste);
    if (!parsed.length) {
      void alertDialog({ message: isRtl ? "لم أتعرّف على أي سطر" : "No lines recognised" });
      return;
    }
    setLines(parsed);
    setPaste("");
    setPasteOpen(false);
  };

  const submit = async () => {
    if (!supplierName.trim() || !invoiceNo.trim() || !validLines.length) {
      void alertDialog({
        message: isRtl ? "اكتب المورّد ورقم الفاتورة وسطراً واحداً على الأقل" : "Supplier, invoice number and at least one line are required",
      });
      return;
    }
    setBusy(true);
    try {
      const res: any = await importInvoice({
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim() || undefined,
        invoiceNo: invoiceNo.trim(),
        invoiceDate,
        total: stated || undefined,
        receiveStock,
        lines: validLines.map((l) => ({
          name: l.name.trim(),
          nameAr: l.nameAr.trim() || undefined,
          supplierSku: l.supplierSku.trim() || undefined,
          quantity: Number(l.quantity),
          unit: l.unit.trim() || "PCS",
          unitPrice: Number(l.unitPrice) || 0,
          packSize: l.packSize.trim() || undefined,
        })),
        sessionToken,
      });
      if (!res?.ok) {
        void alertDialog({ message: res?.message || (isRtl ? "تعذّر الاستيراد" : "Import failed") });
        return;
      }
      void alertDialog({
        message: isRtl
          ? `تم. ${res.itemsCreated} صنف جديد، ${res.itemsMatched} صنف موجود، ${res.linksCreated + res.linksUpdated} ربط بالمورّد${res.received ? `، و${res.received} سطر دخل المخزن` : ""}.`
          : `Done. ${res.itemsCreated} new items, ${res.itemsMatched} matched, ${res.linksCreated + res.linksUpdated} supplier links${res.received ? `, ${res.received} lines received` : ""}.`,
      });
      setInvoiceNo(""); setTotal(""); setLines([emptyLine()]);
    } catch (e: any) {
      void alertDialog({ message: e?.message || (isRtl ? "تعذّر الاستيراد" : "Import failed") });
    } finally {
      setBusy(false);
    }
  };

  const th = "px-2 py-2 text-[11px] font-black text-slate-500 uppercase tracking-wide";

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="p-4 sm:p-6 space-y-5 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-[#0E76AC]/10 border-2 border-[#0E76AC]/25 flex items-center justify-center">
          <FileText className="h-5 w-5 text-[#0E76AC]" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">
            {isRtl ? "استلام فاتورة شراء" : "Import Purchase Invoice"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {isRtl
              ? "الأصناف والموردون والأسعار تُبنى من الفاتورة — الصنف الموجود يُطابَق ولا يتكرّر."
              : "Items, suppliers and prices are built from the invoice — existing items are matched, not duplicated."}
          </p>
        </div>
      </div>

      {/* رأس الفاتورة */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="space-y-1.5 lg:col-span-2">
          <Label>{isRtl ? "المورّد" : "Supplier"}</Label>
          <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)}
            placeholder={isRtl ? "مثال: Bradma Qatar Food" : "e.g. Bradma Qatar Food"} />
        </div>
        <div className="space-y-1.5">
          <Label>{isRtl ? "هاتف المورّد" : "Supplier phone"}</Label>
          <Input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="—" />
        </div>
        <div className="space-y-1.5">
          <Label>{isRtl ? "رقم الفاتورة" : "Invoice no."}</Label>
          <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="BQF01CR-…" />
        </div>
        <div className="space-y-1.5">
          <Label>{isRtl ? "تاريخ الفاتورة" : "Invoice date"}</Label>
          <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
      </div>

      {/* الأسطر */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-slate-200 bg-slate-50">
          <p className="font-black text-slate-700 text-sm">
            {isRtl ? `أصناف الفاتورة (${validLines.length})` : `Invoice lines (${validLines.length})`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPasteOpen((o) => !o)}>
              <Wand2 className={cn("h-3.5 w-3.5", isRtl ? "ml-1.5" : "mr-1.5")} />
              {isRtl ? "لصق دفعة واحدة" : "Paste rows"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
              <Plus className={cn("h-3.5 w-3.5", isRtl ? "ml-1.5" : "mr-1.5")} />
              {isRtl ? "سطر" : "Row"}
            </Button>
          </div>
        </div>

        {pasteOpen && (
          <div className="p-3 border-b border-slate-200 bg-[#0E76AC]/5 space-y-2">
            <p className="text-[11px] text-slate-600 font-bold">
              {isRtl
                ? "سطر لكل صنف بالترتيب: الاسم · الكمية · الوحدة · السعر · العبوة — مفصولة بتاب أو فاصلة."
                : "One line per item: name · qty · unit · price · pack — separated by tab or comma."}
            </p>
            <Textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} dir="ltr"
              placeholder={"EGG QATARI 1 X 30 X 12, 1, CTN, 210\nTURMERIC POWDER 88, 2, KG, 15"} />
            <Button size="sm" onClick={applyPaste}>{isRtl ? "حوّلها لأسطر" : "Convert to rows"}</Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={cn(th, "text-start min-w-[220px]")}>{isRtl ? "الصنف (كما في الفاتورة)" : "Item"}</th>
                <th className={cn(th, "text-start min-w-[150px]")}>{isRtl ? "الاسم بالعربي" : "Arabic name"}</th>
                <th className={cn(th, "text-start w-24")}>{isRtl ? "كود المورّد" : "SKU"}</th>
                <th className={cn(th, "text-center w-20")}>{isRtl ? "الكمية" : "Qty"}</th>
                <th className={cn(th, "text-center w-20")}>{isRtl ? "الوحدة" : "Unit"}</th>
                <th className={cn(th, "text-center w-24")}>{isRtl ? "السعر" : "Price"}</th>
                <th className={cn(th, "text-center w-24")}>{isRtl ? "الإجمالي" : "Total"}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-2 py-1.5">
                    <Input dir="ltr" className="h-9" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input className="h-9" value={l.nameAr} onChange={(e) => setLine(i, { nameAr: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input dir="ltr" className="h-9" value={l.supplierSku} onChange={(e) => setLine(i, { supplierSku: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input dir="ltr" className="h-9 text-center" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input dir="ltr" className="h-9 text-center" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input dir="ltr" className="h-9 text-center" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5 text-center font-black text-slate-700 tabular-nums">
                    {(Number(l.quantity) * Number(l.unitPrice || 0) || 0).toFixed(2)}
                  </td>
                  <td className="px-1">
                    <button onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">{isRtl ? "إجمالي الفاتورة (للمطابقة)" : "Stated total"}</Label>
              <Input dir="ltr" className="h-9 w-32" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" />
            </div>
            <div className="text-sm">
              <p className="text-[11px] text-slate-500 font-bold">{isRtl ? "مجموع الأسطر" : "Lines total"}</p>
              <p className={cn("font-black tabular-nums", mismatch ? "text-red-600" : "text-slate-700")}>
                {computed.toFixed(2)} QAR
              </p>
            </div>
            {mismatch && (
              <p className="text-[11px] font-black text-red-600 max-w-[220px]">
                {isRtl ? `فرق ${Math.abs(stated - computed).toFixed(2)} — راجع الأسطر قبل الحفظ` : `Off by ${Math.abs(stated - computed).toFixed(2)} — check the lines`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={receiveStock} onChange={(e) => setReceiveStock(e.target.checked)} className="h-4 w-4" />
              {isRtl ? "أدخل الكميات للمخزن" : "Receive into stock"}
            </label>
            <Button onClick={submit} disabled={busy || !validLines.length} className="bg-[#0E76AC] hover:bg-[#0b5f8c]">
              <Check className={cn("h-4 w-4", isRtl ? "ml-1.5" : "mr-1.5")} />
              {busy ? (isRtl ? "جارٍ…" : "Working…") : (isRtl ? "استيراد الفاتورة" : "Import invoice")}
            </Button>
          </div>
        </div>
      </div>

      {/* آخر الفواتير */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-500" />
          <p className="font-black text-slate-700 text-sm">{isRtl ? "آخر الفواتير المستوردة" : "Recent invoices"}</p>
        </div>
        <div className="divide-y divide-slate-100">
          {(invoices || []).map((inv: any) => (
            <div key={String(inv._id)} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="font-bold text-slate-800 truncate">{inv.supplierName}</p>
                <p className="text-[11px] text-slate-500 font-mono">{inv.invoiceNo} · {inv.invoiceDate}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-slate-500">{inv.lineCount} {isRtl ? "صنف" : "lines"}</span>
                <span className="font-black text-slate-700 tabular-nums">{Number(inv.total).toFixed(2)} QAR</span>
              </div>
            </div>
          ))}
          {invoices && invoices.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">{isRtl ? "لا توجد فواتير بعد" : "No invoices yet"}</p>
          )}
        </div>
      </div>
    </div>
  );
}
