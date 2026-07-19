/**
 * @file client/src/pages/pos/PosCharge.tsx
 * @description Modal الدفع — شبكة طرق الدفع الكاملة زي Loyverse.
 *   Cash / Card / Talabat / Snoonu / Rafeeq / Keeta / Transfer / Staff (خارج الإيراد).
 */
import { useState } from "react";
import { Banknote, CreditCard, ArrowLeftRight, X, Loader2, UserCircle2, SplitSquareHorizontal, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type SplitEntry = { method: string; amount: number };
type Props = {
  total: number;
  busy: boolean;
  onCancel: () => void;
  onCharge: (paymentMethod: string, cashReceived?: number, payments?: SplitEntry[]) => void;
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
  const { language, dir } = useLanguage();
  const isAr = language === "ar";
  const t = (ar: string, en: string) => isAr ? ar : en;
  const [method, setMethod] = useState<string | null>(null);
  const [cashInput, setCashInput] = useState<string>("");

  // ── دفع مقسوم ──
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const allocated = round2(splits.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const remaining = round2(total - allocated);
  const splitBalanced = Math.abs(remaining) < 0.01 && splits.length >= 2;
  const SPLIT_METHODS = METHODS.filter((m) => m.key !== "staff");
  const addSplit = (mkey: string) => {
    setSplits((prev) => [...prev, { method: mkey, amount: remaining > 0 ? remaining : 0 }]);
  };
  const setSplitAmount = (i: number, val: string) => {
    setSplits((prev) => prev.map((p, k) => (k === i ? { ...p, amount: Number(val) || 0 } : p)));
  };
  const removeSplit = (i: number) => setSplits((prev) => prev.filter((_, k) => k !== i));

  const cashReceived = Number(cashInput) || 0;
  const change = cashReceived - total;
  const canPayCash = cashReceived >= total;

  const submit = () => {
    if (splitMode) {
      if (!splitBalanced) return;
      onCharge("mixed", undefined, splits.map((p) => ({ method: p.method, amount: round2(p.amount) })));
      return;
    }
    if (!method) return;
    if (method === "cash") onCharge("cash", cashReceived);
    else onCharge(method);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onCancel}>
      <div dir={dir}
        className="bg-white rounded-3xl shadow-[0_28px_70px_rgba(15,21,22,0.22)] w-full max-w-2xl overflow-hidden border border-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[linear-gradient(105deg,#173b55,#47759C,#2BB0DC)] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="font-black text-lg">{t("الدفع", "Charge")}</h2>
          <button onClick={onCancel} className="hover:bg-white/15 rounded-xl p-2"><X className="h-5 w-5" /></button>
        </div>

        {/* Total */}
        <div className="bg-[#f1f8fa] py-6 border-b border-[#dce9ee] text-center">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1">{t("الإجمالي المطلوب", "Total Due")}</div>
          <div className="text-5xl font-black text-[#0E76AC]">
            {total.toFixed(2)}
            <span className="text-lg text-slate-500 ms-2">QAR</span>
          </div>
        </div>

        {/* Method grid — اختيار أول قبل ما نفتح خطوة تانية */}
        {!method && !splitMode && (
          <div className="p-4">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">{t("اختر طريقة الدفع", "Select payment method")}</div>
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
                  {m.sub && <span className="text-[10px] font-bold opacity-80">{t("لا يُحسب في الإيراد", "Not counted as revenue")}</span>}
                </button>
              ))}
            </div>
            {/* دفع مقسوم */}
            <button
              onClick={() => { setSplitMode(true); setSplits([]); }}
              className="mt-2 w-full rounded-xl p-4 flex items-center justify-center gap-2 font-black text-[#0E76AC] bg-[#eef7fb] border-2 border-[#cfe7f3] hover:bg-[#e0f0f8] transition-all active:scale-95"
            >
              <SplitSquareHorizontal className="h-5 w-5" />
              {t("دفع مقسوم (أكثر من طريقة)", "Split payment (multiple methods)")}
            </button>
          </div>
        )}

        {/* Split payment panel */}
        {splitMode && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0E76AC] uppercase">
              <SplitSquareHorizontal className="h-4 w-4" /> {t("دفع مقسوم", "Split payment")}
              <button onClick={() => { setSplitMode(false); setSplits([]); }} className="ms-auto text-slate-400 hover:text-slate-700 text-[11px] font-bold uppercase">{t("رجوع", "Back")}</button>
            </div>

            {/* الأجزاء المضافة */}
            {splits.length > 0 && (
              <div className="space-y-2">
                {splits.map((p, i) => {
                  const m = SPLIT_METHODS.find((x) => x.key === p.method);
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-xl border-2 border-slate-200 p-2">
                      <span className="w-24 text-sm font-black text-center rounded-lg py-2 text-white" style={{ background: m?.color || "#64748b", color: m?.textOnColor || "#fff" }}>{m?.label || p.method}</span>
                      <input
                        type="number"
                        value={p.amount || ""}
                        onChange={(e) => setSplitAmount(i, e.target.value)}
                        placeholder="0.00"
                        className="flex-1 h-12 rounded-lg border-2 border-slate-200 focus:border-cyan-500 focus:outline-none px-3 text-xl font-black text-slate-900"
                      />
                      <button onClick={() => removeSplit(i)} className="text-red-500 hover:bg-red-50 rounded-lg p-2"><Trash2 className="h-5 w-5" /></button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* أزرار إضافة طريقة */}
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Plus className="h-3 w-3" />{t("أضف طريقة", "Add method")}</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {SPLIT_METHODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => addSplit(m.key)}
                    className="rounded-lg py-2 text-xs font-black text-white shadow active:scale-95"
                    style={{ background: m.color, color: m.textOnColor || "#fff" }}
                  >{m.label}</button>
                ))}
              </div>
            </div>

            {/* المتبقّي */}
            <div className={`rounded-xl p-4 flex justify-between items-center ${splitBalanced ? "bg-emerald-50 border-2 border-emerald-200" : "bg-amber-50 border-2 border-amber-200"}`}>
              <span className={`font-bold ${splitBalanced ? "text-emerald-700" : "text-amber-700"}`}>
                {remaining > 0.005 ? t("المتبقّي", "Remaining") : remaining < -0.005 ? t("زيادة", "Over") : t("مكتمل", "Balanced")}
              </span>
              <span className={`text-2xl font-black ${splitBalanced ? "text-emerald-700" : "text-amber-700"}`}>
                {Math.abs(remaining).toFixed(2)} <span className="text-sm">QAR</span>
              </span>
            </div>
            {splits.length < 2 && (
              <p className="text-[11px] font-bold text-slate-400 text-center">{t("أضف طريقتين على الأقل للدفع المقسوم", "Add at least two methods for a split payment")}</p>
            )}
          </div>
        )}

        {/* Cash step */}
        {method === "cash" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 mb-2">
              <Banknote className="h-4 w-4" /> CASH
              <button onClick={() => setMethod(null)} className="ms-auto text-slate-400 hover:text-slate-700 text-[11px] font-bold uppercase">{t("تغيير الطريقة", "Change method")}</button>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">{t("النقد المستلم", "Cash Received")}</label>
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
              <label className="text-xs font-bold text-slate-500 uppercase">{t("مبالغ سريعة", "Quick Amounts")}</label>
              <div className="grid grid-cols-6 gap-2 mt-1">
                <button onClick={() => setCashInput(String(total))} className="h-12 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-black text-sm border border-cyan-200">{t("بالضبط", "Exact")}</button>
                {CASH_PRESETS.map((v) => (
                  <button key={v} onClick={() => setCashInput(String(v))} className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm">
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {cashInput !== "" && (
              <div className={`rounded-xl p-4 flex justify-between items-center ${change < 0 ? "bg-red-50 border-2 border-red-200" : "bg-emerald-50 border-2 border-emerald-200"}`}>
                <span className={`font-bold ${change < 0 ? "text-red-700" : "text-emerald-700"}`}>{t("الباقي", "Change")}</span>
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
                <button onClick={() => setMethod(null)} className="hover:text-slate-800">{t("تغيير الطريقة", "Change")}</button>
              </div>
              <div className="w-24 h-24 mx-auto rounded-2xl grid place-items-center shadow-lg mb-3" style={{ background: m.color, color: m.textOnColor || "#fff" }}>
                {Icon ? <Icon className="h-12 w-12" /> : <span className="text-2xl font-black">{m.label[0]}</span>}
              </div>
              <p className="text-slate-900 font-black text-2xl">{m.label}</p>
              {method === "staff" && (
                <p className="text-amber-700 bg-amber-50 border-2 border-amber-200 rounded-xl p-3 mt-4 text-sm font-bold">
                  {t("فاتورة موظف: سيصدر إيصال بالمبلغ لكنه لن يُحسب في إيراد الوردية.", "Staff ticket: a receipt will be issued, but it will not count toward shift revenue.")}
                </p>
              )}
              {method !== "staff" && (
                <p className="text-slate-500 mt-2 text-sm font-bold">
                  {method === "card"     ? t("أكمل الدفع على جهاز البطاقة ثم اضغط تأكيد.", "Complete the payment on the card terminal, then press Confirm.") :
                   method === "transfer" ? t("تأكد من استلام التحويل ثم اضغط تأكيد.", "Confirm the transfer was received, then press Confirm.") :
                   t("تأكد من استلام الطلب على المنصة ثم اضغط تأكيد.", "Confirm the order was received on the platform, then press Confirm.")}
                </p>
              )}
            </div>
          );
        })()}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border-t border-slate-200">
          <button onClick={onCancel} className="h-14 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-black hover:bg-slate-100">
            {t("إلغاء", "Cancel")}
          </button>
          <button
            onClick={submit}
            disabled={busy || (splitMode ? !splitBalanced : (!method || (method === "cash" && !canPayCash)))}
            className="h-14 rounded-xl text-white font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: method === "staff"
              ? "linear-gradient(135deg,#475569,#334155)"
              : "linear-gradient(135deg,#16a34a,#15803d)" }}
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            {busy ? t("جاري التنفيذ...", "Processing...") : `${t("تأكيد", "Confirm")} · ${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
