/**
 * @file client/src/pages/pos/PosSales.tsx
 * @description شاشة البيع الرئيسية — Dark theme بهوية أدرينالين (كحلي + سماوي + أحمر للـcharge).
 *   Grid كبير بصور حقيقية على شمال الشاشة (RTL) وتذكرة على يمين مع Order type toggle
 *   ورقم طلب وخصم % وزر Charge كبير أحمر — زي POS المطاعم الاحترافي.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { Search, X, Minus, Plus, Truck, Package, UtensilsCrossed, Trash2, MessageSquare, Percent, User2, ChefHat, Coffee, Utensils, Salad, Cookie, Grid3x3 } from "lucide-react";
import ChargeModal from "./PosCharge";
import ReceiptModal from "./PosReceipt";

type CartLine = { mealId: string | null; name: string; qty: number; unitPrice: number; note?: string };
type OrderType = "dine_in" | "pickup" | "delivery";

const MENU_CAT_META: Record<string, { label: string; labelAr: string; icon: any }> = {
  all:       { label: "All",       labelAr: "الكل",  icon: Grid3x3  },
  breakfast: { label: "Breakfast", labelAr: "فطور",  icon: Coffee   },
  lunch:     { label: "Lunch",     labelAr: "غداء",  icon: ChefHat  },
  dinner:    { label: "Dinner",    labelAr: "عشاء",  icon: Utensils },
  salad:     { label: "Salad",     labelAr: "سلطات", icon: Salad    },
  snack:     { label: "Snack",     labelAr: "سناك",  icon: Cookie   },
};

// ✅ توليد رقم طلب مؤقّت لعرض الواجهة (الرقم الفعلي يجيه من السيرفر بعد الحفظ)
const genLocalOrderNo = () => Math.floor(1000 + Math.random() * 9000);

export default function PosSales() {
  const { token, cart, setCart, clearCart } = usePosStore();
  const items = useQuery(api.pos.listItems, { token: token || undefined }) as any[] | undefined;
  const posCats = useQuery(api.pos.listCategories, { token: token || undefined }) as any[] | undefined;
  const shift = useQuery(api.pos.currentShift, token ? { token } : "skip") as any;
  const quickSale = useMutation(api.pos.quickSale);

  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [customerName, setCustomerName] = useState("");
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [showCharge, setShowCharge] = useState(false);
  const [showReceiptId, setShowReceiptId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localOrderNo] = useState(genLocalOrderNo);

  const usePosCategories = (posCats?.length ?? 0) > 0;
  const catButtons: any[] = usePosCategories
    ? [{ id: "all", name: "الكل", nameEn: "All", color: null }, ...(posCats || [])]
    : Object.entries(MENU_CAT_META).map(([id, m]) => ({ id, name: m.labelAr, nameEn: m.label, color: null }));

  const filtered = useMemo(() => {
    if (!items) return [];
    const qq = q.trim().toLowerCase();
    return items.filter((m: any) => {
      if (activeCat !== "all") {
        if (usePosCategories) { if (m.posCategoryId !== activeCat) return false; }
        else                  { if (m.menuCategory !== activeCat) return false; }
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
    subtotal = Math.round(subtotal * 100) / 100;
    const discount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
    const total = Math.round((subtotal - discount) * 100) / 100;
    return { subtotal, discount, total, count };
  }, [cart, discountPct]);

  const addToCart = (m: any) => {
    if (!shift) { alert("افتح وردية أول من تبويب Shift"); return; }
    const idx = cart.findIndex((l: any) => l.mealId === m.id);
    if (idx >= 0) {
      const cp = [...cart]; cp[idx] = { ...cp[idx], qty: cp[idx].qty + 1 }; setCart(cp);
    } else {
      setCart([...cart, { mealId: m.id, name: m.name, qty: 1, unitPrice: m.price }]);
    }
  };
  const setQty = (i: number, qty: number) => {
    const cp = [...cart];
    if (qty <= 0) { setCart(cp.filter((_, k) => k !== i)); return; }
    cp[i] = { ...cp[i], qty }; setCart(cp);
  };
  const removeLine = (i: number) => setCart(cart.filter((_, k) => k !== i));

  const doQuickCharge = async (paymentMethod: string, cashReceived?: number) => {
    if (!token || cart.length === 0) return;
    setBusy(true);
    try {
      const r: any = await quickSale({
        token,
        lines: cart.map((l: any) => ({
          ...(l.mealId ? { mealId: l.mealId as any } : {}),
          name: l.name, qty: l.qty, unitPrice: l.unitPrice, notes: l.note,
        })),
        paymentMethod, cashReceived,
        orderType,
        customerName: customerName.trim() || undefined,
        discount: totals.discount || undefined,
      });
      clearCart();
      setShowCharge(false);
      setCustomerName("");
      setDiscountPct(0);
      setShowReceiptId(r.id);
    } catch (e: any) {
      alert(e?.message?.replace(/^\[CONVEX .*?\]\s*/, "") || "خطأ");
    } finally { setBusy(false); }
  };

  const ORDER_TYPES: { key: OrderType; ar: string; en: string; icon: any }[] = [
    { key: "delivery", ar: "توصيل", en: "Delivery", icon: Truck             },
    { key: "pickup",   ar: "استلام", en: "Pickup",   icon: Package           },
    { key: "dine_in",  ar: "محلي",  en: "Dine-in",  icon: UtensilsCrossed },
  ];

  return (
    <div dir="rtl" className="h-full flex text-white" style={{ background: "#0B1220" }}>
      {/* ═══════════ Ticket (يمين في RTL) ═══════════ */}
      <aside className="w-[380px] shrink-0 flex flex-col border-l" style={{ background: "#101A2E", borderColor: "#1B2A48" }}>
        {/* Header: order type + order # */}
        <div className="p-4 shrink-0" style={{ borderBottom: "1px solid #1B2A48" }}>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => { if (cart.length && confirm("مسح الطلب الحالي؟")) { clearCart(); setCustomerName(""); setDiscountPct(0); } }}
              className="text-slate-400 hover:text-red-400 transition-colors"
              title="مسح الطلب"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="text-end">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">الطلب الحالي</p>
              <p className="text-lg font-black text-cyan-400">#{localOrderNo}</p>
            </div>
          </div>

          {/* Order type toggle */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl" style={{ background: "#0B1220" }}>
            {ORDER_TYPES.map((o) => {
              const Icon = o.icon;
              const active = orderType === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setOrderType(o.key)}
                  className={`h-16 rounded-lg text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                    active ? "text-white shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                  style={active ? { background: "linear-gradient(135deg,#0E76AC,#0E2A4A)" } : {}}
                >
                  <Icon className="h-4 w-4" />
                  {o.ar}
                </button>
              );
            })}
          </div>

          {/* Customer name */}
          <div className="relative mt-3">
            <User2 className="absolute h-4 w-4 top-3 start-3 text-slate-500 pointer-events-none" />
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="اسم أو رقم العميل (اختياري)"
              className="w-full h-10 ps-9 pe-3 rounded-lg text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none"
              style={{ background: "#0B1220", border: "1px solid #1B2A48" }}
            />
          </div>
        </div>

        {/* Shift warning */}
        {shift === null && (
          <div className="p-3 bg-amber-500/10 border-b text-amber-300 text-xs font-bold text-center" style={{ borderColor: "#3d3013" }}>
            ⚠ افتح وردية أوّل من تبويب Shift
          </div>
        )}

        {/* Cart lines */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full grid place-items-center" style={{ background: "#1B2A48" }}>
                <ChefHat className="h-7 w-7 text-slate-500" />
              </div>
              <p className="text-slate-500 text-sm font-bold">اضغط على وجبة لإضافتها للطلب</p>
            </div>
          )}
          <div className="divide-y" style={{ borderColor: "#1B2A48" }}>
            {cart.map((l: any, i: number) => (
              <div key={i} className="p-3 hover:bg-white/5 transition-colors">
                <div className="flex items-start gap-2 mb-2">
                  <p className="flex-1 min-w-0 font-black text-sm text-white truncate">{l.name}</p>
                  <span className="text-sm font-black text-white">{(l.qty * l.unitPrice).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg overflow-hidden" style={{ background: "#0B1220", border: "1px solid #1B2A48" }}>
                    <button onClick={() => setQty(i, l.qty - 1)} className="w-8 h-8 hover:bg-white/5 grid place-items-center text-slate-300">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-9 h-8 text-center font-black text-white grid place-items-center text-sm">{l.qty}</span>
                    <button onClick={() => setQty(i, l.qty + 1)} className="w-8 h-8 hover:bg-white/5 grid place-items-center text-slate-300">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500 font-bold">× {Number(l.unitPrice).toFixed(2)}</span>
                  <button onClick={() => removeLine(i)} className="ms-auto text-slate-500 hover:text-red-400 rounded p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Quick add — Delivery + Custom */}
            {cart.length > 0 && (
              <div className="p-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCart([...cart, { mealId: null, name: "توصيل", qty: 1, unitPrice: 10 }])}
                  className="h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 text-orange-300 hover:bg-orange-500/10 transition-colors"
                  style={{ border: "1px solid #3d2818" }}
                >
                  <Truck className="h-3.5 w-3.5" /> + توصيل 10
                </button>
                <button
                  onClick={() => {
                    const nm = prompt("اسم الصنف؟"); if (!nm) return;
                    const p = Number(prompt("السعر؟") || "0");
                    setCart([...cart, { mealId: null, name: nm, qty: 1, unitPrice: p }]);
                  }}
                  className="h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 text-slate-300 hover:bg-white/5 transition-colors"
                  style={{ border: "1px solid #1B2A48" }}
                >
                  <Plus className="h-3.5 w-3.5" /> صنف مخصّص
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="p-4 shrink-0" style={{ borderTop: "1px solid #1B2A48" }}>
          {/* Discount + comment mini bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center rounded-lg" style={{ background: "#0B1220", border: "1px solid #1B2A48" }}>
              <span className="ps-3 text-slate-500"><Percent className="h-3.5 w-3.5" /></span>
              <input
                type="number" min={0} max={100}
                value={discountPct || ""}
                onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                placeholder="خصم %"
                className="w-full h-9 px-2 bg-transparent text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => {
                const note = prompt("ملاحظة على الطلب:");
                if (note != null) alert("الملاحظة: " + note); // placeholder — يمكن تخزينها لاحقاً
              }}
              className="h-9 px-3 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-1.5 hover:bg-white/5"
              style={{ border: "1px solid #1B2A48" }}
              title="ملاحظة على الطلب"
            >
              <MessageSquare className="h-3.5 w-3.5" /> تعليق
            </button>
          </div>

          {/* Amounts */}
          <div className="space-y-1 mb-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold">المجموع الفرعي</span>
              <span className="font-black text-white">{totals.subtotal.toFixed(2)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="font-bold">الخصم</span>
                <span className="font-black">- {totals.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t" style={{ borderColor: "#1B2A48" }}>
              <span className="text-slate-300 font-bold text-xs uppercase">الإجمالي</span>
              <span className="text-3xl font-black text-white">
                {totals.total.toFixed(2)}
                <span className="text-sm text-slate-400 ms-1">ر.ق</span>
              </span>
            </div>
          </div>

          {/* Big Charge button (red like the reference) */}
          <button
            onClick={() => setShowCharge(true)}
            disabled={cart.length === 0 || !shift}
            className="w-full h-14 rounded-xl text-white font-black text-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-xl"
            style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}
          >
            دفع {totals.total.toFixed(2)} ر.ق
          </button>
        </div>
      </aside>

      {/* ═══════════ Items area (شمال في RTL) ═══════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header: label + search + categories */}
        <div className="p-4 shrink-0" style={{ borderBottom: "1px solid #1B2A48" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-end">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Point of Sale</p>
              <h1 className="text-2xl font-black text-white leading-tight">طلب جديد</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-300 uppercase">متصل</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute h-4 w-4 top-3 start-3 text-slate-500 pointer-events-none" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن صنف…"
              className="w-full h-11 ps-9 pe-3 rounded-xl text-sm font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              style={{ background: "#101A2E", border: "1px solid #1B2A48" }}
            />
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {catButtons.map((c: any) => {
              const M = MENU_CAT_META[c.id];
              const Icon = M?.icon;
              const active = activeCat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`shrink-0 h-10 px-4 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all ${
                    active ? "text-white shadow-lg" : "text-slate-400 hover:text-white"
                  }`}
                  style={active
                    ? { background: "linear-gradient(135deg,#dc2626,#991b1b)" }
                    : { background: "#101A2E", border: "1px solid #1B2A48" }}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {c.name || c.nameEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {(!items) && <p className="text-center text-slate-500 py-16 font-bold">جاري التحميل…</p>}
          {items && filtered.length === 0 && (
            <p className="text-center text-slate-500 py-16 font-bold">لا توجد أصناف مطابقة</p>
          )}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((m: any) => {
              const hasImage = !!m.imageUrl;
              return (
                <button
                  key={m.id}
                  onClick={() => addToCart(m)}
                  className="group aspect-square rounded-xl relative overflow-hidden shadow-lg hover:shadow-2xl active:scale-95 transition-all"
                  style={{ background: "#101A2E", border: "1px solid #1B2A48" }}
                >
                  {hasImage ? (
                    <>
                      <img
                        src={m.imageUrl}
                        alt={m.name}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <ChefHat className="h-10 w-10 text-slate-600" />
                    </div>
                  )}

                  {/* Add badge — أعلى شمال (RTL: end = left) */}
                  <div className="absolute top-2 end-2 h-7 w-7 rounded-full bg-white/95 text-slate-900 grid place-items-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </div>

                  {/* Name — أسفل */}
                  <div className="absolute inset-x-0 bottom-0 p-2.5 text-start">
                    <p className="font-black text-white text-sm leading-tight line-clamp-2 drop-shadow-lg">{m.name}</p>
                    <p className="mt-1 text-xs font-black text-red-400 drop-shadow-lg">
                      {Number(m.price).toFixed(2)} <span className="text-[10px] text-white/70">ر.ق</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charge modal */}
      {showCharge && (
        <ChargeModal
          total={totals.total}
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
