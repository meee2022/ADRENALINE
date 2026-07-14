/**
 * @file client/src/pages/pos/PosSales.tsx
 * @description شاشة البيع الرئيسية — Loyverse-style. تعمل باللمس، ألوان قوية.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { Search, X, Minus, Plus, CreditCard, Banknote, ArrowLeftRight, MoreHorizontal, ChefHat, Coffee, Utensils, Salad, Cookie, Grid3x3, Truck } from "lucide-react";
import ChargeModal from "./PosCharge";
import ReceiptModal from "./PosReceipt";

type CartLine = { mealId: string | null; name: string; qty: number; unitPrice: number };

const MENU_CAT_META: Record<string, { label: string; icon: any; color: string }> = {
  all:       { label: "All",       icon: Grid3x3,  color: "#0E76AC" },
  breakfast: { label: "Breakfast", icon: Coffee,   color: "#f59e0b" },
  lunch:     { label: "Lunch",     icon: ChefHat,  color: "#16a34a" },
  dinner:    { label: "Dinner",    icon: Utensils, color: "#7c3aed" },
  salad:     { label: "Salad",     icon: Salad,    color: "#0891b2" },
  snack:     { label: "Snack",     icon: Cookie,   color: "#dc2626" },
};

export default function PosSales() {
  const { token, cart, setCart, clearCart, cashier } = usePosStore();
  const items = useQuery(api.pos.listItems, { token: token || undefined }) as any[] | undefined;
  const posCats = useQuery(api.pos.listCategories, { token: token || undefined }) as any[] | undefined;
  const shift = useQuery(api.pos.currentShift, token ? { token } : "skip") as any;
  const quickSale = useMutation(api.pos.quickSale);

  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");        // "all" | menuCategory | posCategoryId
  const [showCharge, setShowCharge] = useState(false);
  const [showReceiptId, setShowReceiptId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ✅ فئات فعلية: لو الأدمن ضاف POS categories → استخدمها، غير كده fallback على categories المنيو
  const usePosCategories = (posCats?.length ?? 0) > 0;
  const catButtons = usePosCategories
    ? [{ id: "all", name: "All", color: "#0E76AC", icon: null }, ...(posCats || [])]
    : Object.entries(MENU_CAT_META).map(([id, m]) => ({ id, name: m.label, color: m.color, icon: null }));

  const filtered = useMemo(() => {
    if (!items) return [];
    const qq = q.trim().toLowerCase();
    return items.filter((m: any) => {
      if (activeCat !== "all") {
        if (usePosCategories) {
          if (m.posCategoryId !== activeCat) return false;
        } else {
          if (m.menuCategory !== activeCat) return false;
        }
      }
      if (!qq) return true;
      return String(m.name).toLowerCase().includes(qq)
          || String(m.nameEn).toLowerCase().includes(qq)
          || String(m.nameAr).toLowerCase().includes(qq);
    });
  }, [items, activeCat, q, usePosCategories]);

  const totals = useMemo(() => {
    let subtotal = 0, count = 0;
    for (const l of cart as CartLine[]) { subtotal += l.qty * l.unitPrice; count += l.qty; }
    return { subtotal: Math.round(subtotal * 100) / 100, count };
  }, [cart]);

  const addToCart = (m: any) => {
    if (!shift) { alert("افتح وردية أول من تبويب Shift"); return; }
    const idx = cart.findIndex((l: any) => l.mealId === m.id);
    if (idx >= 0) {
      const cp = [...cart];
      cp[idx] = { ...cp[idx], qty: cp[idx].qty + 1 };
      setCart(cp);
    } else {
      setCart([...cart, { mealId: m.id, name: m.name, qty: 1, unitPrice: m.price }]);
    }
  };
  const setQty = (i: number, qty: number) => {
    const cp = [...cart];
    if (qty <= 0) { setCart(cp.filter((_, k) => k !== i)); return; }
    cp[i] = { ...cp[i], qty };
    setCart(cp);
  };
  const removeLine = (i: number) => setCart(cart.filter((_, k) => k !== i));

  const doQuickCharge = async (paymentMethod: string, cashReceived?: number) => {
    if (!token || cart.length === 0) return;
    setBusy(true);
    try {
      const r: any = await quickSale({
        token,
        lines: cart.map((l: any) => ({ mealId: l.mealId as any, name: l.name, qty: l.qty, unitPrice: l.unitPrice })),
        paymentMethod,
        cashReceived,
      });
      clearCart();
      setShowCharge(false);
      setShowReceiptId(r.id);
    } catch (e: any) {
      alert(e?.message?.replace(/^\[CONVEX .*?\]\s*/, "") || "خطأ");
    } finally { setBusy(false); }
  };

  return (
    <div className="h-full flex bg-slate-100">
      {/* Left: items */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search + categories */}
        <div className="p-3 bg-white border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="absolute h-4 w-4 top-3 left-3 text-slate-400 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items…"
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {catButtons.map((c: any) => {
              const M = MENU_CAT_META[c.id];
              const Icon = M?.icon;
              const active = activeCat === c.id;
              const color = c.color || "#0E76AC";
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`h-10 px-4 rounded-xl text-sm font-bold border-2 transition-all flex items-center gap-1.5 ${active ? "text-white shadow-md" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}
                  style={active ? { background: color, borderColor: color } : {}}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {(!items) && <p className="text-center text-slate-500 py-12 font-bold">Loading…</p>}
          {items && filtered.length === 0 && (
            <p className="text-center text-slate-500 py-12 font-bold">No items match</p>
          )}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((m: any) => {
              const bg = m.color || "#e2e8f0";
              const isDark = m.color != null;
              return (
                <button
                  key={m.id}
                  onClick={() => addToCart(m)}
                  className={`aspect-square rounded-xl p-2 flex flex-col items-center justify-center text-center shadow-md hover:shadow-xl active:scale-95 transition-all border-2 ${isDark ? "border-transparent" : "border-slate-200"}`}
                  style={{ background: bg }}
                >
                  <span className={`text-xs font-black leading-tight line-clamp-3 ${isDark ? "text-white drop-shadow" : "text-slate-800"}`}>
                    {m.name}
                  </span>
                  <span className={`text-xs font-black mt-1 ${isDark ? "text-white/90" : "text-slate-600"}`}>
                    {Number(m.price).toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: ticket */}
      <aside className="w-[360px] shrink-0 bg-white border-l border-slate-200 flex flex-col">
        {/* Header */}
        <div className="h-14 px-4 flex items-center gap-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="font-black text-slate-900">Ticket</div>
          <div className="text-xs font-bold text-slate-500 ms-auto">
            {totals.count} item{totals.count !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Shift warning */}
        {shift === null && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-bold text-center">
            ⚠ افتح وردية من تبويب Shift عشان تبدأ البيع
          </div>
        )}

        {/* Quick actions — Delivery fee + Custom item */}
        <div className="p-2 grid grid-cols-2 gap-2 border-b border-slate-100">
          <button
            onClick={() => setCart([...cart, { mealId: null, name: "Delivery", qty: 1, unitPrice: 10 }])}
            disabled={!shift}
            className="h-9 rounded-lg bg-orange-50 hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed text-orange-700 border border-orange-200 font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <Truck className="h-3.5 w-3.5" /> + Delivery 10
          </button>
          <button
            onClick={() => {
              const nm = prompt("Item name?"); if (!nm) return;
              const p = Number(prompt("Price?") || "0");
              setCart([...cart, { mealId: null, name: nm, qty: 1, unitPrice: p }]);
            }}
            disabled={!shift}
            className="h-9 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 border border-slate-200 font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Custom item
          </button>
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm font-bold">
              Tap an item to add it to the ticket
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {cart.map((l: any, i: number) => (
              <div key={i} className="p-3">
                <div className="flex items-start gap-2 mb-1.5">
                  <p className="flex-1 min-w-0 font-bold text-sm text-slate-900 truncate">{l.name}</p>
                  <button onClick={() => removeLine(i)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded p-0.5">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border-2 border-slate-200 rounded-lg overflow-hidden">
                    <button onClick={() => setQty(i, l.qty - 1)} className="w-8 h-8 hover:bg-slate-100 grid place-items-center text-slate-600">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 h-8 text-center font-black text-slate-900 grid place-items-center bg-slate-50 text-sm">{l.qty}</span>
                    <button onClick={() => setQty(i, l.qty + 1)} className="w-8 h-8 hover:bg-slate-100 grid place-items-center text-slate-600">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">× {Number(l.unitPrice).toFixed(2)}</span>
                  <span className="ms-auto font-black text-cyan-700 text-sm">{(l.qty * l.unitPrice).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals + Actions */}
        <div className="border-t-2 border-slate-200 p-4 shrink-0 bg-white">
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-slate-500 text-sm font-bold">Total</span>
            <span className="text-3xl font-black text-slate-900">
              {totals.subtotal.toFixed(2)}
              <span className="text-sm font-bold text-slate-500 ms-1">QAR</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => clearCart()}
              disabled={cart.length === 0}
              className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-black transition-all"
            >
              Clear
            </button>
            <button
              onClick={() => setShowCharge(true)}
              disabled={cart.length === 0 || !shift}
              className="h-14 rounded-xl text-white font-black text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-lg"
              style={{ background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" }}
            >
              Charge {totals.subtotal.toFixed(2)}
            </button>
          </div>
        </div>
      </aside>

      {/* Charge modal */}
      {showCharge && (
        <ChargeModal
          total={totals.subtotal}
          busy={busy}
          onCancel={() => setShowCharge(false)}
          onCharge={doQuickCharge}
        />
      )}

      {/* Receipt after charge */}
      {showReceiptId && (
        <ReceiptModal
          ticketId={showReceiptId}
          onClose={() => setShowReceiptId(null)}
        />
      )}
    </div>
  );
}
