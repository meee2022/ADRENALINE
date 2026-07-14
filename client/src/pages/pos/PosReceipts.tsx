/**
 * @file client/src/pages/pos/PosReceipts.tsx
 * @description فواتير اليوم للكاشير.
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { Receipt, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import ReceiptModal from "./PosReceipt";

export default function PosReceipts() {
  const token = usePosStore((s) => s.token) as string;
  const rows = useQuery(api.pos.myTodayReceipts, { token }) as any[] | undefined;
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto p-4 bg-slate-100">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white grid place-items-center">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Today's Receipts</h1>
            <p className="text-slate-500 text-sm font-bold">{rows?.length || 0} ticket{(rows?.length || 0) !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          {!rows && <div className="p-8 text-center text-slate-500">Loading…</div>}
          {rows && rows.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No receipts yet today</div>}
          <div className="divide-y divide-slate-100">
            {rows?.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setOpen(r.id)}
                className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-start"
              >
                <StatusIcon status={r.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-black text-slate-900 flex items-center gap-2">
                    #{r.ticketNumber}
                    {r.paymentMethod === "staff" && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 uppercase">Staff · non-rev</span>
                    )}
                    {r.customerName && <span className="text-slate-500 font-bold">· {r.customerName}</span>}
                  </div>
                  <div className="text-xs text-slate-500 font-bold">
                    {r.paidAt ? new Date(r.paidAt).toLocaleTimeString() : "—"}
                    {r.paymentMethod && ` · ${r.paymentMethod}`}
                  </div>
                </div>
                <div className={`text-xl font-black ${r.status === "REFUNDED" ? "text-red-500 line-through" : "text-slate-900"}`}>
                  {r.total.toFixed(2)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {open && <ReceiptModal ticketId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "PAID")     return <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 grid place-items-center shrink-0"><CheckCircle2 className="h-5 w-5" /></div>;
  if (status === "REFUNDED") return <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 grid place-items-center shrink-0"><RotateCcw className="h-5 w-5" /></div>;
  if (status === "VOID")     return <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 grid place-items-center shrink-0"><XCircle className="h-5 w-5" /></div>;
  return <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 grid place-items-center shrink-0"><Receipt className="h-5 w-5" /></div>;
}
