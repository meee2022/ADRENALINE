/**
 * @file client/src/pages/OutletScan.tsx
 * @description تأكيد استلام طلبية المنفذ بالماسح — الفرع يمسح ما وصل، والفرق
 *              يظهر لحظياً بدل أن يكتشفه أحد بعد أيام.
 * @convex convex/outletScan.ts
 *
 * الماسح يعمل كلوحة مفاتيح: يكتب الرقم ثم Enter. لذلك المطابقة تتم على الجهاز
 * من نسخة الطلبية المحمّلة مسبقاً — لا استعلام لكل مسحة، فالماسح أسرع من الشبكة.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine, Check, AlertTriangle, RotateCcw, Package, Minus, Plus } from "lucide-react";

export default function OutletScan() {
  const { language, dir } = useLanguage();
  const isRtl = dir === "rtl" || language === "ar";
  const sessionToken = useStore((s) => s.sessionToken) || undefined;

  const [orderId, setOrderId] = useState<string>("");
  const [scanned, setScanned] = useState<Record<string, number>>({}); // lineId → عدد
  const [unknown, setUnknown] = useState<string[]>([]);
  const [lastHit, setLastHit] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ordersRes = useQuery(api.gymSales.listOrders, { sessionToken }) as any;
  const order = useQuery(
    api.outletScan.orderForScan,
    orderId ? ({ orderId: orderId as any, sessionToken } as any) : "skip",
  ) as any;
  const confirmReceipt = useMutation(api.outletScan.confirmReceipt);

  /** باركود → سطر الطلبية. يُبنى مرة عند تحميل الطلبية. */
  const lineByBarcode = useMemo(() => {
    const m = new Map<string, any>();
    (order?.lines || []).forEach((l: any) => { if (l.barcode) m.set(String(l.barcode), l); });
    return m;
  }, [order]);

  // الماسح يكتب في الحقل المركَّز — نبقيه مركَّزاً دائماً بعد اختيار الطلبية
  useEffect(() => { if (order) inputRef.current?.focus(); }, [order]);

  const handleScan = (raw: string) => {
    const code = raw.replace(/\s+/g, "").trim();
    if (!code) return;
    const line = lineByBarcode.get(code);
    if (!line) {
      setUnknown((u) => (u.includes(code) ? u : [...u, code]));
      setLastHit(isRtl ? `⚠ ${code} — ليس في هذه الطلبية` : `⚠ ${code} — not in this order`);
      return;
    }
    setScanned((s) => ({ ...s, [line.lineId]: (s[line.lineId] || 0) + 1 }));
    setLastHit(`✓ ${line.nameEn}`);
  };

  const nudge = (lineId: string, delta: number) =>
    setScanned((s) => ({ ...s, [lineId]: Math.max(0, (s[lineId] || 0) + delta) }));

  const stats = useMemo(() => {
    const lines = order?.lines || [];
    let sent = 0, got = 0, missingValue = 0, extra = 0;
    lines.forEach((l: any) => {
      const n = scanned[l.lineId] || 0;
      sent += l.qty;
      got += Math.min(n, l.qty);
      if (n > l.qty) extra += n - l.qty;
      missingValue += Math.max(0, l.qty - n) * Number(l.unitPrice || 0);
    });
    return { sent, got, extra, missingValue: Math.round(missingValue * 100) / 100 };
  }, [order, scanned]);

  const submit = async () => {
    if (!order) return;
    const missing = stats.sent - stats.got;
    if (missing > 0) {
      const ok = await confirmDialog({
        variant: "danger",
        title: isRtl ? "⚠ الطلبية وصلت ناقصة" : "⚠ Delivery is short",
        confirmText: isRtl ? "أؤكد الاستلام بالناقص" : "Confirm as received",
        cancelText: isRtl ? "أكمل المسح" : "Keep scanning",
        message: isRtl
          ? `أُرسل ${stats.sent} وجبة ووصل ${stats.got} — ناقص ${missing}.\n\nستُحتسب الفاتورة على ما وصل فقط، ويُخصم ${stats.missingValue.toFixed(2)} ر.ق. والنقص سيظهر للمطبخ الرئيسي.\n\nهل تؤكد؟`
          : `${stats.sent} sent, ${stats.got} received — ${missing} short.\n\nThe invoice will be charged on what arrived; ${stats.missingValue.toFixed(2)} QAR is deducted and the shortage is shown to the main kitchen.\n\nConfirm?`,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res: any = await confirmReceipt({
        orderId: orderId as any,
        received: (order.lines || []).map((l: any) => ({
          lineId: l.lineId as any, qty: scanned[l.lineId] || 0,
        })),
        unknownBarcodes: unknown.length ? unknown : undefined,
        sessionToken,
      });
      void alertDialog({
        title: isRtl ? "✅ تم تأكيد الاستلام" : "✅ Receipt confirmed",
        message: isRtl
          ? `وصل ${res.receivedCount} وجبة.${res.shortageQty ? `\nناقص ${res.shortageQty} بقيمة ${res.shortageValue} ر.ق.` : ""}\nصافي الفاتورة: ${res.netTotal} ر.ق`
          : `${res.receivedCount} received.${res.shortageQty ? `\nShort ${res.shortageQty} worth ${res.shortageValue} QAR.` : ""}\nNet invoice: ${res.netTotal} QAR`,
      });
      setScanned({}); setUnknown([]); setLastHit("");
    } catch (e: any) {
      void alertDialog({ message: e?.message || (isRtl ? "تعذّر التأكيد" : "Could not confirm") });
    } finally { setBusy(false); }
  };

  // أحدث 40 طلبية تكفي للاستلام اليومي؛ القائمة مرتّبة تنازلياً بالتاريخ من الخادم
  const openOrders = ((ordersRes?.rows || []) as any[]).slice(0, 40);

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[#0E76AC]/25 bg-[#0E76AC]/10 text-[#0E76AC]">
          <ScanLine className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-black text-slate-800 sm:text-2xl">
            {isRtl ? "تأكيد استلام طلبية المنفذ" : "Confirm outlet delivery"}
          </h1>
          <p className="text-xs text-slate-500 sm:text-sm">
            {isRtl
              ? "امسح كل صنف وصل — الفرق يظهر فوراً، والفاتورة تُحتسب على ما وصل فعلاً."
              : "Scan what arrived — the difference shows immediately and the invoice follows what was received."}
          </p>
        </div>
      </div>

      {/* اختيار الطلبية */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
        <label className="mb-2 block text-xs font-black text-slate-600">
          {isRtl ? "اختر الطلبية" : "Pick the order"}
        </label>
        <select
          value={orderId}
          onChange={(e) => { setOrderId(e.target.value); setScanned({}); setUnknown([]); setLastHit(""); }}
          className="h-11 w-full rounded-xl border-2 border-slate-200 px-3 text-sm font-bold text-slate-700"
        >
          <option value="">{isRtl ? "— اختر —" : "— select —"}</option>
          {openOrders.map((o: any) => (
            <option key={o.id} value={o.id}>
              {o.date} · {o.gymName} · {o.mealsCount} {isRtl ? "وجبة" : "meals"}
              {o.receiptConfirmedAt ? (isRtl ? " · مؤكَّدة" : " · confirmed") : ""}
            </option>
          ))}
        </select>
      </div>

      {order && (
        <>
          {/* حقل المسح */}
          <div className="rounded-2xl border-2 border-[#0E76AC]/30 bg-[#0E76AC]/[0.04] p-4">
            <label className="mb-2 block text-xs font-black text-[#0E2A4A]">
              {isRtl ? "امسح الباركود هنا" : "Scan barcode here"}
            </label>
            <Input
              ref={inputRef}
              dir="ltr"
              autoFocus
              className="h-14 text-center text-lg font-black tracking-widest"
              placeholder={isRtl ? "وجّه الماسح واقرأ…" : "Point the scanner…"}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                handleScan((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = "";
              }}
              onBlur={(e) => setTimeout(() => e.target.focus(), 0)}
            />
            {lastHit && (
              <p className={cn("mt-2 text-center text-sm font-black",
                lastHit.startsWith("⚠") ? "text-rose-600" : "text-emerald-600")}>
                {lastHit}
              </p>
            )}
          </div>

          {/* المقارنة الحيّة */}
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-black text-slate-700">
                {order.date} · {order.gymName}
              </p>
              <div className="flex items-center gap-3 text-xs font-black">
                <span className="text-slate-600">{isRtl ? "أُرسل" : "Sent"} {stats.sent}</span>
                <span className="text-emerald-700">{isRtl ? "وصل" : "Received"} {stats.got}</span>
                {stats.sent - stats.got > 0 && (
                  <span className="rounded-lg bg-rose-100 px-2 py-1 text-rose-700">
                    {isRtl ? "ناقص" : "Short"} {stats.sent - stats.got} · {stats.missingValue.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {(order.lines || []).map((l: any) => {
                const n = scanned[l.lineId] || 0;
                const done = n >= l.qty;
                const over = n > l.qty;
                return (
                  <div key={l.lineId} className={cn("flex items-center gap-3 p-3",
                    over ? "bg-amber-50" : done ? "bg-emerald-50/50" : n > 0 ? "bg-white" : "")}>
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                      done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400")}>
                      {done ? <Check className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-800">{l.nameEn}</p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {l.barcode || (isRtl ? "بلا باركود — أدخل يدوياً" : "no barcode — enter manually")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => nudge(l.lineId, -1)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className={cn("min-w-[62px] text-center text-sm font-black tabular-nums",
                        over ? "text-amber-700" : done ? "text-emerald-700" : "text-slate-700")}>
                        {n} / {l.qty}
                      </span>
                      <button onClick={() => nudge(l.lineId, 1)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {unknown.length > 0 && (
              <div className="border-t-2 border-amber-300 bg-amber-50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {isRtl ? "باركودات مُسحت وليست في هذه الطلبية" : "Scanned but not in this order"}
                </p>
                <p className="mt-1 font-mono text-xs text-amber-800">{unknown.join(" · ")}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-3">
              <button onClick={() => { setScanned({}); setUnknown([]); setLastHit(""); inputRef.current?.focus(); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                <RotateCcw className="h-3.5 w-3.5" />{isRtl ? "ابدأ من جديد" : "Reset"}
              </button>
              <Button onClick={submit} disabled={busy || !stats.got} className="bg-[#0E76AC] hover:bg-[#0b5f8c]">
                <Check className={cn("h-4 w-4", isRtl ? "ml-1.5" : "mr-1.5")} />
                {busy ? (isRtl ? "جارٍ…" : "Working…") : (isRtl ? "تأكيد الاستلام" : "Confirm receipt")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
