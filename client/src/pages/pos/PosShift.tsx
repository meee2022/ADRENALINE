/**
 * @file client/src/pages/pos/PosShift.tsx
 * @description إدارة وردية الكاشير: فتح/إغلاق + مقارنة الكاش المتوقع.
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { Clock, Play, Square, Banknote, TrendingUp, Receipt } from "lucide-react";

export default function PosShift() {
  const token = usePosStore((s) => s.token) as string;
  const shift = useQuery(api.pos.currentShift, { token }) as any;
  const openShift = useMutation(api.pos.openShift);
  const closeShift = useMutation(api.pos.closeShift);
  const [opening, setOpening] = useState<string>("0");
  const [closing, setClosing] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [closeResult, setCloseResult] = useState<any>(null);

  if (shift === undefined) return <Center>Loading…</Center>;

  const doOpen = async () => {
    setBusy(true);
    try { await openShift({ token, openingCash: Number(opening) || 0 }); }
    catch (e: any) { alert(e?.message || "خطأ"); }
    finally { setBusy(false); }
  };
  const doClose = async () => {
    if (!confirm("إغلاق الوردية دلوقتي؟")) return;
    setBusy(true);
    try {
      const r = await closeShift({ token, closingCash: Number(closing) || 0, notes: notes || undefined });
      setCloseResult(r);
    } catch (e: any) { alert(e?.message || "خطأ"); }
    finally { setBusy(false); }
  };

  // No shift → open form
  if (!shift) {
    return (
      <div className="h-full grid place-items-center p-4 bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-cyan-500 grid place-items-center mx-auto mb-3">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Open Shift</h2>
            <p className="text-slate-500 text-sm mt-1">ابدأ وردية جديدة</p>
          </div>

          <label className="text-xs font-bold text-slate-500 uppercase">Opening Cash (QAR)</label>
          <input
            type="number"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="0.00"
            className="w-full h-16 mt-1 rounded-xl border-2 border-slate-200 focus:border-cyan-500 focus:outline-none px-4 text-3xl font-black text-slate-900 text-center"
          />
          <p className="text-xs text-slate-400 mt-1 text-center">المبلغ اللي في الدرج قبل ما تبدأ البيع</p>

          <button
            onClick={doOpen}
            disabled={busy}
            className="w-full mt-6 h-14 rounded-xl text-white font-black text-lg transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
          >
            <Play className="h-5 w-5" /> Start Shift
          </button>
        </div>
      </div>
    );
  }

  // Shift closed → summary
  if (closeResult) {
    return (
      <div className="h-full grid place-items-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500 grid place-items-center mx-auto mb-3">
            <Square className="h-8 w-8 text-white" fill="white" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Shift Closed</h2>
          <div className="mt-6 space-y-2 text-start">
            <Row label="Expected Cash" value={`${closeResult.expectedCash.toFixed(2)} QAR`} />
            <Row label="Cash Difference" value={`${closeResult.cashDiff.toFixed(2)} QAR`}
              color={closeResult.cashDiff === 0 ? "text-emerald-600" : closeResult.cashDiff > 0 ? "text-amber-600" : "text-red-600"} />
          </div>
          <button onClick={() => window.location.href = "/pos"}
            className="w-full mt-6 h-12 rounded-xl bg-slate-900 text-white font-black">Done</button>
        </div>
      </div>
    );
  }

  // Active shift → summary + close
  return (
    <div className="h-full overflow-y-auto p-4 bg-slate-100">
      <div className="max-w-2xl mx-auto space-y-3">
        {/* Current shift card */}
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-700 text-white rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-bold text-cyan-100 uppercase mb-1">
            <div className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" /> Shift Open
          </div>
          <div className="text-4xl font-black">{shift.totalSales.toFixed(2)} <span className="text-lg text-cyan-200">QAR</span></div>
          <div className="text-sm text-cyan-100 mt-1">{shift.ticketsCount} ticket{shift.ticketsCount !== 1 ? "s" : ""} so far</div>
          <div className="text-xs text-cyan-200 mt-2">Started: {new Date(shift.openedAt).toLocaleString()}</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Banknote} label="Opening Cash" value={`${shift.openingCash.toFixed(2)}`} color="#0E76AC" />
          <Stat icon={Receipt}  label="Tickets"      value={String(shift.ticketsCount)}         color="#f59e0b" />
        </div>

        {/* Close shift */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="font-black text-slate-900 mb-3">Close Shift</h3>
          <label className="text-xs font-bold text-slate-500 uppercase">Closing Cash Count (QAR)</label>
          <input
            type="number"
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            placeholder="Count the cash in your drawer"
            className="w-full h-14 mt-1 rounded-xl border-2 border-slate-200 focus:border-cyan-500 focus:outline-none px-4 text-2xl font-black text-slate-900 text-center"
          />

          <label className="text-xs font-bold text-slate-500 uppercase mt-4 block">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="…"
            className="w-full h-11 mt-1 rounded-xl border-2 border-slate-200 focus:border-cyan-500 focus:outline-none px-4 text-sm font-bold"
          />

          <button
            onClick={doClose}
            disabled={busy || closing === ""}
            className="w-full mt-4 h-14 rounded-xl text-white font-black text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}
          >
            <Square className="h-5 w-5" fill="white" /> Close Shift
          </button>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: any) { return <div className="h-full grid place-items-center text-slate-500 font-bold">{children}</div>; }
function Row({ label, value, color }: any) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100">
      <span className="text-slate-500 text-sm font-bold">{label}</span>
      <span className={`font-black text-lg ${color || "text-slate-900"}`}>{value}</span>
    </div>
  );
}
function Stat({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-md">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: `${color}20`, color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase">{label}</div>
          <div className="text-xl font-black text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  );
}
