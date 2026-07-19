/**
 * @file client/src/pages/pos/PosReceipt.tsx
 * @description معاينة الإيصال بعد الدفع — قابلة للطباعة (58/80mm) أو التنزيل.
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { Printer, X, CheckCircle2, Tags, Undo2, Loader2 } from "lucide-react";
import { openPrintDoc } from "@/lib/printDoc";
import { alertDialog } from "@/lib/dialogs";

type Props = { ticketId: string; onClose: () => void };

// مدة صلاحية استيكر المطبخ (تاريخ الإنتاج + STICKER_EXPIRY_DAYS)
const STICKER_EXPIRY_DAYS = 2;

export default function ReceiptModal({ ticketId, onClose }: Props) {
  const token = usePosStore((s) => s.token);
  const cashier = usePosStore((s) => s.cashier);
  const t = useQuery(api.pos.getTicket, token ? { token, ticketId: ticketId as any } : "skip") as any;
  const refundMut = useMutation(api.pos.refundTicket);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const isAdmin = String(cashier?.role || "").toUpperCase() === "ADMIN";
  const canRefund = isAdmin && t && t.status === "PAID";

  const doRefund = async () => {
    if (!token || !t) return;
    if (refundReason.trim().length < 3) { void alertDialog({ message: "سبب الاسترجاع مطلوب (3 أحرف أو أكثر)" }); return; }
    setRefundBusy(true);
    try {
      await refundMut({ token, ticketId: ticketId as any, reason: refundReason.trim() });
      setRefundOpen(false);
      void alertDialog({ message: `تم استرجاع الفاتورة #${t.ticketNumber} وإرجاع المخزون.` });
    } catch (e: any) {
      void alertDialog({ message: e?.message?.replace(/^\[CONVEX .*?\]\s*/, "") || "تعذّر الاسترجاع" });
    } finally { setRefundBusy(false); }
  };

  // الطباعة والحفظ كـPDF نفس المسار — شاشة الطباعة فيها الاتنين
  // (طابعة حرارية أو "حفظ كـPDF")، فلا داعي لتنزيل HTML منفصل.
  const printReceipt = () => {
    if (!t) return;
    openPrintDoc(buildReceiptHtml(t), {
      fileName: `ADRENALINE receipt ${t.ticketNumber}`,
      isRtl: false,
      width: 400,
      height: 700,
    });
  };

  // استيكرات المطبخ: استيكر لكل وحدة صنف
  const printLabels = () => {
    if (!t) return;
    openPrintDoc(buildLabelsHtml(t), {
      fileName: `ADRENALINE labels ${t.ticketNumber}`,
      isRtl: false,
      width: 400,
      height: 700,
    });
  };
  const labelCount = t ? t.lines.reduce((s: number, l: any) => s + Math.max(1, Math.round(l.qty)), 0) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Success header */}
        <div className="bg-emerald-500 text-white px-6 py-5 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-2" />
          <h2 className="font-black text-2xl">Payment Received</h2>
          {t && <p className="text-emerald-100 mt-1 font-bold">Receipt #{t.ticketNumber}</p>}
        </div>

        {/* Receipt preview */}
        <div className="p-4 bg-slate-50 max-h-[50vh] overflow-y-auto">
          {!t ? (
            <div className="text-center py-8 text-slate-500">Loading…</div>
          ) : (
            <div className="bg-white p-4 rounded-lg shadow-sm font-mono text-sm">
              <div className="text-center border-b border-dashed border-slate-300 pb-2 mb-2">
                <img src="/adrenaline-logo-full.png" alt="ADRENALINE" className="h-8 mx-auto object-contain" />
                {t.branchName && <div className="text-[11px] font-black text-slate-800 mt-1">{t.branchName}</div>}
                {t.branchAddress && <div className="text-[9px] text-slate-500">{t.branchAddress}</div>}
                {t.branchPhone && <div className="text-[9px] text-slate-500" dir="ltr">{t.branchPhone}</div>}
              </div>
              <div className="text-[11px] text-slate-600 mb-2">
                <div>Receipt: #{t.ticketNumber}</div>
                <div>Cashier: {t.cashierName}</div>
                <div>Date: {new Date(t.paidAt || t.createdAt).toLocaleString()}</div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                {t.lines.map((l: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="flex-1 pr-2">{l.qty}× {l.name}</span>
                    <span className="font-bold">{l.lineTotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-slate-300 mt-2 pt-2 space-y-0.5 text-xs">
                <div className="flex justify-between"><span>Subtotal</span><span>{t.subtotal.toFixed(2)}</span></div>
                {t.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span>-{t.discount.toFixed(2)}</span></div>}
                <div className="flex justify-between font-black text-base pt-1"><span>TOTAL</span><span>{t.total.toFixed(2)} QAR</span></div>
                {Array.isArray((t as any).payments) && (t as any).payments.length
                  ? (t as any).payments.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between pt-1 text-slate-600"><span>Paid ({p.method})</span><span>{Number(p.amount).toFixed(2)}</span></div>
                    ))
                  : t.paymentMethod && <div className="flex justify-between pt-1 text-slate-600"><span>Paid ({t.paymentMethod})</span><span>{(t.cashReceived || t.total).toFixed(2)}</span></div>}
                {t.changeAmount != null && t.changeAmount > 0 && <div className="flex justify-between text-slate-600"><span>Change</span><span>{t.changeAmount.toFixed(2)}</span></div>}
              </div>
              <div className="text-center text-[10px] text-slate-500 mt-3 pt-2 border-t border-dashed border-slate-300">
                Thank you!
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-3 bg-white border-t border-slate-200 space-y-2">
          {t && t.status === "REFUNDED" && (
            <div className="rounded-xl bg-red-50 border-2 border-red-200 text-red-700 font-black text-center py-2 text-sm">مسترجعة — REFUNDED</div>
          )}
          {t && t.status === "VOID" && (
            <div className="rounded-xl bg-slate-100 border-2 border-slate-200 text-slate-500 font-black text-center py-2 text-sm">ملغاة — VOID</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {/* زر واحد: شاشة الطباعة نفسها فيها الطابعة الحرارية و"حفظ كـPDF" */}
            <button onClick={printReceipt} className="h-12 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-sm flex items-center justify-center gap-1">
              <Printer className="h-4 w-4" /> Print / PDF
            </button>
            <button onClick={printLabels} disabled={!t || labelCount === 0} className="h-12 rounded-xl bg-[#0E76AC] hover:bg-[#0c6698] disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-1">
              <Tags className="h-4 w-4" /> استيكر المطبخ {labelCount > 0 ? `(${labelCount})` : ""}
            </button>
          </div>

          {/* استرجاع — ADMIN فقط، فاتورة مدفوعة */}
          {canRefund && !refundOpen && (
            <button onClick={() => { setRefundOpen(true); setRefundReason(""); }} className="w-full h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200 font-bold text-sm flex items-center justify-center gap-1">
              <Undo2 className="h-4 w-4" /> استرجاع الفاتورة
            </button>
          )}
          {canRefund && refundOpen && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 space-y-2">
              <div className="text-xs font-black text-red-700">سبب الاسترجاع (سيُرجَّع المخزون وتُعكس النقاط)</div>
              <input
                autoFocus
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="مثال: العميل غيّر رأيه / خطأ في الطلب"
                className="w-full h-11 rounded-lg border-2 border-red-200 focus:border-red-400 focus:outline-none px-3 text-sm font-bold text-slate-900"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setRefundOpen(false)} disabled={refundBusy} className="h-11 rounded-lg bg-white border-2 border-slate-200 text-slate-700 font-bold text-sm">إلغاء</button>
                <button onClick={doRefund} disabled={refundBusy || refundReason.trim().length < 3} className="h-11 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black text-sm flex items-center justify-center gap-1">
                  {refundBusy && <Loader2 className="h-4 w-4 animate-spin" />} تأكيد الاسترجاع
                </button>
              </div>
            </div>
          )}

          <button onClick={onClose} className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm">
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}

function buildReceiptHtml(t: any): string {
  const lines = t.lines.map((l: any) => `
    <tr><td>${l.qty}× ${escapeHtml(l.name)}</td><td class="r">${l.lineTotal.toFixed(2)}</td></tr>
  `).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${t.ticketNumber}</title>
    <style>
      *{box-sizing:border-box;font-family:'Courier New',monospace}
      body{margin:0;padding:8px;font-size:12px;color:#000;width:80mm}
      h1{text-align:center;margin:0 0 4px;font-size:16px}
      .logo{display:block;max-width:60mm;height:auto;margin:0 auto 8px}
      .sub{text-align:center;font-size:10px;color:#555;margin-bottom:8px}
      .info{font-size:11px;margin-bottom:6px}
      .dash{border-top:1px dashed #999;margin:4px 0}
      table{width:100%;border-collapse:collapse}
      td{padding:2px 0;font-size:11px}
      .r{text-align:right;font-weight:bold}
      .tot{font-size:14px;font-weight:900;padding-top:6px;border-top:1px dashed #999;margin-top:4px}
      .center{text-align:center;font-size:10px;color:#555;margin-top:8px;padding-top:6px;border-top:1px dashed #999}
      @page{size:80mm auto;margin:0}
      @media print{body{margin:0;padding:4mm 4mm 8mm}}
    </style></head><body>
    <img class="logo" src="${window.location.origin}/adrenaline-logo-full.png" alt="ADRENALINE">
    ${t.branchName ? `<div class="sub" style="font-weight:900;color:#000;font-size:12px">${escapeHtml(t.branchName)}</div>` : ""}
    ${t.branchAddress ? `<div class="sub" style="margin-bottom:2px">${escapeHtml(t.branchAddress)}</div>` : ""}
    ${t.branchPhone ? `<div class="sub" style="margin-bottom:6px">${escapeHtml(t.branchPhone)}</div>` : ""}
    <div class="info">
      Receipt: #${t.ticketNumber}<br>
      Cashier: ${escapeHtml(t.cashierName)}<br>
      Date: ${new Date(t.paidAt || t.createdAt).toLocaleString()}
    </div>
    <div class="dash"></div>
    <table>${lines}</table>
    <div class="dash"></div>
    <table>
      <tr><td>Subtotal</td><td class="r">${t.subtotal.toFixed(2)}</td></tr>
      ${t.discount > 0 ? `<tr><td>Discount</td><td class="r">-${t.discount.toFixed(2)}</td></tr>` : ""}
      <tr class="tot"><td>TOTAL</td><td class="r">${t.total.toFixed(2)} QAR</td></tr>
      ${Array.isArray((t as any).payments) && (t as any).payments.length
        ? (t as any).payments.map((p: any) => `<tr><td>Paid (${escapeHtml(String(p.method))})</td><td class="r">${Number(p.amount).toFixed(2)}</td></tr>`).join("")
        : (t.paymentMethod ? `<tr><td>Paid (${escapeHtml(t.paymentMethod)})</td><td class="r">${(t.cashReceived || t.total).toFixed(2)}</td></tr>` : "")}
      ${t.changeAmount != null && t.changeAmount > 0 ? `<tr><td>Change</td><td class="r">${t.changeAmount.toFixed(2)}</td></tr>` : ""}
    </table>
    <div class="center">Thank you!</div>
    </body></html>`;
}

/** استيكرات المطبخ — استيكر لكل وحدة صنف: اسم كبير + رقم الفاتورة + إنتاج + انتهاء. */
function buildLabelsHtml(t: any): string {
  const prod = new Date(t.paidAt || t.createdAt);
  const exp = new Date(prod.getTime() + STICKER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const orderType = t.orderType ? String(t.orderType).replace(/_/g, " ") : "";
  const labels: string[] = [];
  for (const l of t.lines) {
    const units = Math.max(1, Math.round(l.qty));
    for (let k = 0; k < units; k++) {
      labels.push(`
        <div class="lbl">
          <img class="brandlogo" src="${window.location.origin}/adrenaline-logo-full.png" alt="ADRENALINE">
          <div class="name">${escapeHtml(l.name)}</div>
          ${l.notes ? `<div class="note">${escapeHtml(l.notes)}</div>` : ""}
          <div class="meta">
            <span>#${t.ticketNumber}${orderType ? " · " + escapeHtml(orderType) : ""}</span>
            ${units > 1 ? `<span>${k + 1}/${units}</span>` : ""}
          </div>
          <div class="dates">
            <span>إنتاج: ${fmt(prod)}</span>
            <span>انتهاء: ${fmt(exp)}</span>
          </div>
        </div>`);
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels #${t.ticketNumber}</title>
    <style>
      *{box-sizing:border-box;font-family:'Segoe UI',Tahoma,Arial,sans-serif}
      body{margin:0;padding:0;color:#000}
      .lbl{width:80mm;padding:4mm 4mm 5mm;border-bottom:1px dashed #bbb;page-break-inside:avoid}
      .brand{font-size:10px;letter-spacing:2px;color:#0E76AC;font-weight:800}
      .brandlogo{height:22px;width:auto;object-fit:contain}
      .name{font-size:20px;font-weight:900;margin:2px 0 4px;line-height:1.15}
      .note{font-size:11px;color:#444;margin-bottom:3px}
      .meta{display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#222}
      .dates{display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-top:4px;border-top:1px solid #000;padding-top:3px}
      @page{size:80mm auto;margin:0}
      @media print{.lbl{page-break-after:always;border-bottom:none}}
    </style></head><body>
    ${labels.join("")}
    </body></html>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}
