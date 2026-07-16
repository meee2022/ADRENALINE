/**
 * @file client/src/pages/pos/PosReceipt.tsx
 * @description معاينة الإيصال بعد الدفع — قابلة للطباعة (58/80mm) أو التنزيل.
 */
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { Printer, X, CheckCircle2 } from "lucide-react";
import { openPrintDoc } from "@/lib/printDoc";

type Props = { ticketId: string; onClose: () => void };

export default function ReceiptModal({ ticketId, onClose }: Props) {
  const token = usePosStore((s) => s.token);
  const t = useQuery(api.pos.getTicket, token ? { token, ticketId: ticketId as any } : "skip") as any;

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
                <div className="font-black text-slate-900">ADRENALINE</div>
                <div className="text-[10px] text-slate-500">Healthy Food</div>
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
                {t.paymentMethod && <div className="flex justify-between pt-1 text-slate-600"><span>Paid ({t.paymentMethod})</span><span>{(t.cashReceived || t.total).toFixed(2)}</span></div>}
                {t.changeAmount != null && t.changeAmount > 0 && <div className="flex justify-between text-slate-600"><span>Change</span><span>{t.changeAmount.toFixed(2)}</span></div>}
              </div>
              <div className="text-center text-[10px] text-slate-500 mt-3 pt-2 border-t border-dashed border-slate-300">
                Thank you!
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-white border-t border-slate-200">
          {/* زر واحد: شاشة الطباعة نفسها فيها الطابعة الحرارية و"حفظ كـPDF" */}
          <button onClick={printReceipt} className="h-12 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-sm flex items-center justify-center gap-1">
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
          <button onClick={onClose} className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm">
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
    <h1>ADRENALINE</h1>
    <div class="sub">Healthy Food</div>
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
      ${t.paymentMethod ? `<tr><td>Paid (${escapeHtml(t.paymentMethod)})</td><td class="r">${(t.cashReceived || t.total).toFixed(2)}</td></tr>` : ""}
      ${t.changeAmount != null && t.changeAmount > 0 ? `<tr><td>Change</td><td class="r">${t.changeAmount.toFixed(2)}</td></tr>` : ""}
    </table>
    <div class="center">Thank you!</div>
    </body></html>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}
