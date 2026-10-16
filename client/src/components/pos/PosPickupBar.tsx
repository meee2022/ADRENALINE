/**
 * Waiter ↔ counter hand-over strip (only shows when there is something to show).
 * Counter: waiter sales to prepare → "جاهز". Waiter: his sales' status + unsent sales.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { readOutbox, removeFromOutbox } from "@/lib/posOutbox";
import { alertDialog } from "@/lib/dialogs";
import { usePosStore } from "@/lib/posStore";
import { useLocation } from "wouter";

function beep() {
  try {
    const ac = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.frequency.value = 880; g.gain.value = 0.25;
      o.connect(g); g.connect(ac.destination);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.15);
    });
  } catch { /* no audio */ }
}

export default function PosPickupBar({ token, waiter, t }: { token: string; waiter: boolean; t: (a: string, e: string) => string }) {
  const orders = useQuery(api.pos.pickupOrders, { token }) as any[] | undefined;
  const setStatus = useMutation(api.pos.setPickupStatus);
  const quickSale = useMutation(api.pos.quickSale);
  const parkTicket = useMutation(api.pos.parkTicket);
  const resume = useMutation(api.pos.resumeOpenTicket);
  const { setCart, setActiveTicketId, setResumedMeta } = usePosStore();
  const [, go] = useLocation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(readOutbox().length);
  const inFlight = useRef(new Set<string>());

  // Counter: ring when a new waiter sale arrives.
  const newCount = (orders || []).filter((o) => o.status === "NEW").length;
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (orders === undefined) return;
    if (!waiter && prev.current !== null && newCount > prev.current) { beep(); setOpen(true); }
    prev.current = newCount;
  }, [newCount, orders === undefined, waiter]);

  // Waiter: re-send sales saved while offline (e.g. after the page was reopened).
  useEffect(() => {
    if (!waiter) return;
    const flush = () => {
      setPending(readOutbox().length);
      for (const e of readOutbox()) {
        if (inFlight.current.has(e.idem)) continue;
        inFlight.current.add(e.idem);
        (e.kind === "park" ? parkTicket(e.args) : quickSale(e.args)).then(() => removeFromOutbox(e.idem), (err: any) => {
          // The server refused it (e.g. shift closed): drop it and tell the waiter.
          removeFromOutbox(e.idem);
          void alertDialog({ message: `${t("طلب لم يُسجَّل", "A sale was not recorded")}: ${err?.data || err?.message || ""}` });
        }).finally(() => inFlight.current.delete(e.idem));
      }
    };
    flush();
    const onChange = () => setPending(readOutbox().length);
    window.addEventListener("pos-outbox", onChange);
    window.addEventListener("online", flush);
    const id = setInterval(flush, 20000);
    return () => { window.removeEventListener("pos-outbox", onChange); window.removeEventListener("online", flush); clearInterval(id); };
  }, [waiter, token]);

  const list = orders || [];
  if (!list.length && !pending) return null;
  const mark = (id: string, status: "READY" | "DONE") =>
    setStatus({ token, ticketId: id as any, status }).catch((e: any) => alertDialog({ message: e?.data || e?.message || "" }));
  // Waiter handed it over: close it here, and if not paid yet open it for payment.
  const delivered = async (o: any) => {
    await mark(o.id, "DONE");
    if (o.paid) return;
    try {
      const tk: any = await resume({ token, ticketId: o.id as any });
      setCart(tk.lines);
      setResumedMeta({ orderType: tk.orderType, customerName: tk.customerName, discount: tk.discount });
      setActiveTicketId(tk.id);
      setOpen(false);
      go("/pos");
    } catch (e: any) { void alertDialog({ message: e?.data || e?.message || "" }); }
  };

  return (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm" dir="rtl">
      {waiter && pending > 0 && (
        <div className="mb-2 rounded-xl bg-red-600 px-3 py-2 font-black text-white">
          {t(`${pending} طلب لم يصل للكاونتر بعد — بلّغ الكاونتر بنفسك. سيُرسل تلقائياً عند عودة النت، ولا تُحدّث الصفحة.`,
             `${pending} sale(s) not sent yet — tell the counter yourself. They send automatically when the signal returns; don't reload.`)}
        </div>
      )}
      {list.length > 0 && (
        <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 font-black text-amber-900">
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-white">{list.length}</span>
          {waiter ? t("طلباتي عند الكاونتر", "My orders at the counter") : t("طلبات الويتر للتجهيز", "Waiter orders to prepare")}
          {newCount > 0 && !waiter && <span className="animate-pulse text-red-600">● {t("جديد", "new")}</span>}
          <span className="ms-auto text-xs">{open ? "▲" : "▼"}</span>
        </button>
      )}
      {open && list.length > 0 && (
        <div className="mt-2 grid max-h-[45vh] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {list.map((o) => (
            <div key={o.id} className={`rounded-xl border bg-white p-3 ${o.status === "READY" ? "border-emerald-400" : "border-amber-300"}`}>
              <div className="flex items-center gap-2 font-black">
                <span>#{o.ticketNumber}</span>
                {!waiter && <span className="text-xs text-slate-500">{o.waiter}</span>}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${o.paid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{o.paid ? t("مدفوع", "Paid") : t("غير مدفوع", "Unpaid")}</span>
                <span className="ms-auto text-xs text-slate-500">{new Date(o.paidAt).toLocaleTimeString("ar-QA", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {(o.customerName || o.notes) && <p className="text-xs font-bold text-slate-600">{[o.customerName, o.notes].filter(Boolean).join(" · ")}</p>}
              <ul className="my-2 space-y-0.5 text-sm">
                {o.lines.map((l: any, i: number) => <li key={i}><b>{l.qty}×</b> {l.name}{l.note ? ` — ${l.note}` : ""}</li>)}
              </ul>
              {o.status === "NEW"
                ? (waiter
                    ? <p className="text-xs font-black text-amber-700">{t("قيد التجهيز…", "Being prepared…")}</p>
                    : <button type="button" onClick={() => mark(o.id, "READY")} className="h-10 w-full rounded-lg bg-emerald-600 font-black text-white">{t("جاهز ✓", "Ready ✓")}</button>)
                : waiter
                  ? <button type="button" onClick={() => void delivered(o)} className="h-10 w-full rounded-lg bg-emerald-600 font-black text-white">
                      {o.paid ? t("جاهز — سلّمته ✓", "Ready — delivered ✓") : t(`جاهز — سلّمته وحصّل ${o.total.toFixed(2)}`, `Ready — delivered, collect ${o.total.toFixed(2)}`)}
                    </button>
                  : <button type="button" onClick={() => mark(o.id, "DONE")} className="h-10 w-full rounded-lg border border-emerald-500 font-black text-emerald-700">
                      {t("بانتظار الويتر · اضغط لو استلمه", "Waiting for waiter · tap when collected")}
                    </button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
