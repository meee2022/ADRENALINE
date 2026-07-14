/**
 * @file client/src/pages/pos/PosCharge.tsx
 * @description Modal الدفع — Cash / Card / Transfer.
 */
import { useState } from "react";
import { Banknote, CreditCard, ArrowLeftRight, X, Loader2 } from "lucide-react";

type Props = {
  total: number;
  busy: boolean;
  onCancel: () => void;
  onCharge: (paymentMethod: string, cashReceived?: number) => void;
};

const CASH_PRESETS = [10, 20, 50, 100, 200, 500];

export default function ChargeModal({ total, busy, onCancel, onCharge }: Props) {
  const [method, setMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [cashInput, setCashInput] = useState<string>("");

  const cashReceived = Number(cashInput) || 0;
  const change = cashReceived - total;
  const canPayCash = cashReceived >= total;

  const submit = () => {
    if (method === "cash") onCharge("cash", cashReceived);
    else onCharge(method);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="font-black text-lg">Charge</h2>
          <button onClick={onCancel} className="hover:bg-slate-700 rounded-lg p-1"><X className="h-5 w-5" /></button>
        </div>

        {/* Total */}
        <div className="bg-slate-50 py-6 border-b-2 border-slate-200 text-center">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1">Total Due</div>
          <div className="text-5xl font-black text-slate-900">
            {total.toFixed(2)}
            <span className="text-lg text-slate-500 ms-2">QAR</span>
          </div>
        </div>

        {/* Method tabs */}
        <div className="grid grid-cols-3 border-b border-slate-200">
          {(["cash","card","transfer"] as const).map((m) => {
            const active = method === m;
            const Icon = m === "cash" ? Banknote : m === "card" ? CreditCard : ArrowLeftRight;
            const label = m === "cash" ? "Cash" : m === "card" ? "Card" : "Transfer";
            return (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`h-16 flex items-center justify-center gap-2 font-black text-sm transition-all ${active ? "bg-cyan-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                <Icon className="h-5 w-5" /> {label}
              </button>
            );
          })}
        </div>

        {/* Method-specific */}
        <div className="p-6">
          {method === "cash" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Cash Received</label>
                <input
                  type="number"
                  autoFocus
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-16 mt-1 rounded-xl border-2 border-slate-200 focus:border-cyan-500 focus:outline-none px-4 text-3xl font-black text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Quick Amounts</label>
                <div className="grid grid-cols-6 gap-2 mt-1">
                  <button onClick={() => setCashInput(String(total))} className="h-12 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-black text-sm border border-cyan-200">Exact</button>
                  {CASH_PRESETS.map((v) => (
                    <button key={v} onClick={() => setCashInput(String(v))} className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm">
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {cashInput !== "" && (
                <div className={`rounded-xl p-4 flex justify-between items-center ${change < 0 ? "bg-red-50 border-2 border-red-200" : "bg-emerald-50 border-2 border-emerald-200"}`}>
                  <span className={`font-bold ${change < 0 ? "text-red-700" : "text-emerald-700"}`}>Change</span>
                  <span className={`text-3xl font-black ${change < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {change < 0 ? `-${Math.abs(change).toFixed(2)}` : change.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {method === "card" && (
            <div className="py-8 text-center">
              <CreditCard className="h-16 w-16 text-cyan-500 mx-auto mb-3" />
              <p className="text-slate-700 font-bold">Complete the payment on the card terminal, then press Confirm.</p>
            </div>
          )}

          {method === "transfer" && (
            <div className="py-8 text-center">
              <ArrowLeftRight className="h-16 w-16 text-cyan-500 mx-auto mb-3" />
              <p className="text-slate-700 font-bold">Confirm the transfer was received, then press Confirm.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border-t border-slate-200">
          <button onClick={onCancel} className="h-14 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-black hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || (method === "cash" && !canPayCash)}
            className="h-14 rounded-xl text-white font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            {busy ? "Processing..." : `Confirm · ${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
