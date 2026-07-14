/**
 * @file client/src/pages/pos/PosCharge.tsx
 * @description Modal الدفع — شبكة طرق الدفع الكاملة زي Loyverse.
 *   Cash / Card / Talabat / Snoonu / Rafeeq / Keeta / Transfer / Staff (خارج الإيراد).
 */
import { useState } from "react";
import { Banknote, CreditCard, ArrowLeftRight, X, Loader2, UserCircle2 } from "lucide-react";

type Props = {
  total: number;
  busy: boolean;
  onCancel: () => void;
  onCharge: (paymentMethod: string, cashReceived?: number) => void;
};

// طرق الدفع — كل واحدة أيقونة/لون. Cash فقط اللي محتاج شاشة كاش استلام.
const METHODS: {
  key: string; label: string; sub?: string; color: string; textOnColor?: string; icon?: any;
}[] = [
  { key: "cash",     label: "CASH",     color: "#16a34a", icon: Banknote },
  { key: "card",     label: "CARD",     color: "#0E76AC", icon: CreditCard },
  { key: "talabat",  label: "TALABAT",  color: "#ff6b1a" },
  { key: "snoonu",   label: "SNOONU",   color: "#e91d63" },
  { key: "rafeeq",   label: "RAFEEQ",   color: "#8b5cf6" },
  { key: "keeta",    label: "KEETA",    color: "#facc15", textOnColor: "#0f1516" },
  { key: "transfer", label: "TRANSFER", color: "#0891b2", icon: ArrowLeftRight },
  { key: "staff",    label: "STAFF",    sub: "لا يُحسب في الإيراد", color: "#475569", icon: UserCircle2 },
];

const CASH_PRESETS = [10, 20, 50, 100, 200, 500];

export default function ChargeModal({ total, busy, onCancel, onCharge }: Props) {
  const [method, setMethod] = useState<string | null>(null);
  const [cashInput, setCashInput] = useState<string>("");

  const cashReceived = Number(cashInput) || 0;
  const change = cashReceived - total;
  const canPayCash = cashReceived >= total;

  const submit = () => {
    if (!method) return;
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

        {/* Method grid — اختيار أول قبل ما نفتح خطوة تانية */}
        {!method && (
          <div className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Select payment method</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  className="rounded-xl p-4 flex flex-col items-center justify-center gap-1 text-center font-black transition-all shadow-md hover:shadow-xl active:scale-95 min-h-[90px]"
                  style={{ background: m.color, color: m.textOnColor || "#fff" }}
                >
                  {m.icon && <m.icon className="h-6 w-6 opacity-90" />}
                  <span className="text-sm tracking-wide">{m.label}</span>
                  {m.sub && <span className="text-[10px] font-bold opacity-80">{m.sub}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cash step */}
        {method === "cash" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 mb-2">
              <Banknote className="h-4 w-4" /> CASH
              <button onClick={() => setMethod(null)} className="ms-auto text-slate-400 hover:text-slate-700 text-[11px] font-bold uppercase">← Change method</button>
            </div>
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

        {/* Other methods confirmation */}
        {method && method !== "cash" && (() => {
          const m = METHODS.find((x) => x.key === method)!;
          const Icon = m.icon;
          return (
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-500 mb-4">
                <button onClick={() => setMethod(null)} className="hover:text-slate-800">← Change</button>
              </div>
              <div className="w-24 h-24 mx-auto rounded-2xl grid place-items-center shadow-lg mb-3" style={{ background: m.color, color: m.textOnColor || "#fff" }}>
                {Icon ? <Icon className="h-12 w-12" /> : <span className="text-2xl font-black">{m.label[0]}</span>}
              </div>
              <p className="text-slate-900 font-black text-2xl">{m.label}</p>
              {method === "staff" && (
                <p className="text-amber-700 bg-amber-50 border-2 border-amber-200 rounded-xl p-3 mt-4 text-sm font-bold">
                  ⚠ فاتورة موظف — سيصدر إيصال بالمبلغ لكن <b>لن يُحسب في إيراد الوردية</b>.
                </p>
              )}
              {method !== "staff" && (
                <p className="text-slate-500 mt-2 text-sm font-bold">
                  {method === "card"     ? "Complete the payment on the card terminal, then press Confirm." :
                   method === "transfer" ? "Confirm the transfer was received, then press Confirm." :
                   "Confirm the order was received on the platform, then press Confirm."}
                </p>
              )}
            </div>
          );
        })()}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border-t border-slate-200">
          <button onClick={onCancel} className="h-14 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-black hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !method || (method === "cash" && !canPayCash)}
            className="h-14 rounded-xl text-white font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: method === "staff"
              ? "linear-gradient(135deg,#475569,#334155)"
              : "linear-gradient(135deg,#16a34a,#15803d)" }}
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            {busy ? "Processing..." : `Confirm · ${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
