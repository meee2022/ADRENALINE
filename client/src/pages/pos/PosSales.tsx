/**
 * @file client/src/pages/pos/PosSales.tsx
 * @description شاشة البيع الرئيسية بهوية أدرينالين المضيئة، محسّنة للكاشير والشاشات الصغيرة.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { usePosStore } from "@/lib/posStore";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getPosMealImage } from "@/lib/posMealImages";
import { Search, X, Minus, Plus, Truck, Package, UtensilsCrossed, Trash2, MessageSquare, Percent, User2, ChefHat, Coffee, Utensils, Salad, Cookie, Grid3x3, ShoppingCart, ChevronDown } from "lucide-react";
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
  const { language } = useLanguage();
  const isAr = language === "ar";
  const tt = (a: string, e: string) => (isAr ? a : e);
  const { token, cart, setCart, clearCart } = usePosStore();
  const items = useQuery(api.pos.listItems, { token: token || undefined }) as any[] | undefined;
  const posCats = useQuery(api.pos.listCategories, { token: token || undefined }) as any[] | undefined;
  const shift = useQuery(api.pos.currentShift, token ? { token } : "skip") as any;
  const posCfg = useQuery(api.pos.posSettings, { token: token || undefined }) as any;
  const deliveryFee = Number(posCfg?.deliveryFee ?? 10);
  const quickSale = useMutation(api.pos.quickSale);

  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [customerName, setCustomerName] = useState("");
  const [linkedCustomer, setLinkedCustomer] = useState<any | null>(null);
  const [discountPct, setDiscountPct] = useState<number>(0);

  // ✅ لو المستخدم كتب رقم هاتف (6+ أرقام)، نبحث عن مشترك ونربطه تلقائياً
  const phoneQ = customerName.replace(/\D/g, "");
  const foundCustomer = useQuery(
    api.pos.findCustomerByPhone,
    token && phoneQ.length >= 6 ? { token, phone: phoneQ } : "skip"
  ) as any;
  const [showCharge, setShowCharge] = useState(false);
  const [showReceiptId, setShowReceiptId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
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
    if (!shift) { void alertDialog({ message: tt("افتح وردية أولاً من تبويب الوردية", "Open a shift first") }); return; }
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

  const doQuickCharge = async (paymentMethod: string, cashReceived?: number, payments?: { method: string; amount: number }[]) => {
    if (!token || cart.length === 0) return;
    setBusy(true);
    // ✅ Idempotency key: يمنع تكرار الدفع لو الزرار اتضغط مرتين أو الشبكة قطعت وأعادت المحاولة.
    //    نولّده مرة واحدة لكل محاولة دفع من نفس السلة.
    const idem = `t_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      const r: any = await quickSale({
        token,
        lines: cart.map((l: any) => ({
          ...(l.mealId ? { mealId: l.mealId as any } : {}),
          ...(l.kind ? { kind: l.kind } : {}),
          name: l.name, qty: l.qty, unitPrice: l.unitPrice, notes: l.note,
        })),
        paymentMethod, cashReceived,
        ...(payments && payments.length ? { payments } : {}),
        orderType,
        customerName: (linkedCustomer?.fullName || customerName.trim()) || undefined,
        customerId: linkedCustomer?.id as any,
        discount: totals.discount || undefined,
        idempotencyKey: idem,
      });
      clearCart();
      setShowCharge(false);
      setCustomerName("");
      setLinkedCustomer(null);
      setDiscountPct(0);
      setShowReceiptId(r.id);
    } catch (e: any) {
      void alertDialog({ message: e?.message?.replace(/^\[CONVEX .*?\]\s*/, "") || tt("حدث خطأ", "Something went wrong") });
    } finally { setBusy(false); }
  };

  const ORDER_TYPES: { key: OrderType; ar: string; en: string; icon: any }[] = [
    { key: "delivery", ar: "توصيل", en: "Delivery", icon: Truck             },
    { key: "pickup",   ar: "استلام", en: "Pickup",   icon: Package           },
    { key: "dine_in",  ar: "محلي",  en: "Dine-in",  icon: UtensilsCrossed },
  ];

  return (
    <div className="pos-sales-screen h-full flex min-w-0 bg-[#edf5f8] text-[#0F1516]">
      {mobileCartOpen && (
        <button
          type="button"
          aria-label={tt("إغلاق السلة", "Close cart")}
          className="pos-mobile-cart-backdrop"
          onClick={() => setMobileCartOpen(false)}
        />
      )}
      <button
        type="button"
        className="pos-mobile-cart-toggle"
        onClick={() => setMobileCartOpen(true)}
        aria-expanded={mobileCartOpen}
      >
        <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />{tt("السلة", "Cart")} ({totals.count})</span>
        <strong>{totals.total.toFixed(2)} {tt("ر.ق", "QAR")}</strong>
      </button>
      {/* ═══════════ Ticket (يمين في RTL) ═══════════ */}
      <aside className={cn("pos-ticket-panel w-[clamp(290px,31vw,390px)] shrink-0 flex flex-col border-s border-[#d8e6ec] bg-[#f8fbfc] shadow-[8px_0_30px_rgba(71,117,156,0.08)]", mobileCartOpen && "is-mobile-open")}>
        {/* Header: order type + order # */}
        <div className="shrink-0 border-b border-[#dce9ee] bg-white p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setMobileCartOpen(false)} className="pos-mobile-cart-close" aria-label={tt("إغلاق السلة", "Close cart")}>
              <ChevronDown className="h-5 w-5" />
            </button>
            <button
              aria-label={tt("مسح الطلب", "Clear order")}
              onClick={async () => { if (cart.length && await confirmDialog({ title: tt("مسح الطلب", "Clear order"), message: tt("هل تريد مسح الطلب الحالي؟", "Clear the current order?"), variant: "danger", confirmText: tt("مسح", "Clear") })) { clearCart(); setCustomerName(""); setDiscountPct(0); } }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-100 bg-red-50 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
              title={tt("مسح الطلب", "Clear order")}
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="text-end">
              <p className="text-[10px] font-bold uppercase text-[#6f8795]">{tt("الطلب الحالي", "Current order")}</p>
              <p className="text-lg font-black text-[#0E76AC]">#{localOrderNo}</p>
            </div>
          </div>

          {/* Order type toggle */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#d9e7ed] bg-[#edf5f8] p-1">
            {ORDER_TYPES.map((o) => {
              const Icon = o.icon;
              const active = orderType === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setOrderType(o.key)}
                  className={`h-16 rounded-lg text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                    active ? "text-white shadow-[0_5px_16px_rgba(60,196,240,0.26)]" : "text-[#607987] hover:bg-white hover:text-[#173b55]"
                  }`}
                  style={active ? { background: "linear-gradient(135deg,#3CC4F0,#47759C)" } : {}}
                >
                  <Icon className="h-4 w-4" />
                  {isAr ? o.ar : o.en}
                </button>
              );
            })}
          </div>

          {/* Customer name + auto-link by phone */}
          <div className="relative mt-3">
            <User2 className="absolute h-4 w-4 top-3 start-3 text-[#78909c] pointer-events-none" />
            <input
              value={linkedCustomer ? linkedCustomer.fullName : customerName}
              onChange={(e) => { setCustomerName(e.target.value); if (linkedCustomer) setLinkedCustomer(null); }}
              placeholder={tt("اسم أو رقم العميل (اختياري)", "Customer name or phone (optional)")}
              className="w-full h-10 ps-9 pe-16 rounded-xl bg-[#f7fafb] text-xs font-bold text-[#0F1516] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3CC4F0]/20"
              style={{ border: linkedCustomer ? "1px solid #10b981" : "1px solid #d8e4e9" }}
            />
            {linkedCustomer && (
              <button onClick={() => { setLinkedCustomer(null); setCustomerName(""); }} className="absolute top-2 end-2 text-[10px] font-bold text-red-400 hover:bg-white/5 rounded px-1.5 py-1">
                {tt("إلغاء الربط", "Unlink")}
              </button>
            )}
            {/* لو لقى مشترك بنفس الرقم يعرض bar لربطه */}
            {foundCustomer && !linkedCustomer && (
              <button
                onClick={() => setLinkedCustomer(foundCustomer)}
                className="mt-2 w-full rounded-lg p-2 flex items-center justify-between text-[11px] font-bold hover:bg-emerald-500/10 transition-colors"
                style={{ background: "#0d1f30", border: "1px solid #065f46" }}
              >
                <span className="text-emerald-300">✓ {foundCustomer.fullName}</span>
                <span className="text-amber-300">{foundCustomer.loyaltyPoints} {tt("نقطة · اضغط للربط", "points · tap to link")}</span>
              </button>
            )}
            {linkedCustomer && (
              <div className="mt-2 rounded-lg p-2 flex items-center justify-between text-[11px] font-bold"
                   style={{ background: "#0a1d17", border: "1px solid #065f46" }}>
                <span className="text-emerald-300">{tt("سيحصل على نقاط الولاء تلقائياً", "Loyalty points will be earned automatically")}</span>
                <span className="text-amber-300">{linkedCustomer.loyaltyPoints} {tt("نقطة حالياً", "current points")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Shift warning */}
        {shift === null && (
          <div className="p-3 bg-amber-500/10 border-b text-amber-300 text-xs font-bold text-center" style={{ borderColor: "#3d3013" }}>
            {tt("افتح وردية أولاً من تبويب الوردية", "Open a shift first")}
          </div>
        )}

        {/* Cart lines */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 && (
            <div className="p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl grid place-items-center border border-[#cfe8f1] bg-[#eaf8fc]">
                <ChefHat className="h-7 w-7 text-[#3aaed5]" />
              </div>
              <p className="text-[#708693] text-sm font-bold">{tt("اضغط على وجبة لإضافتها للطلب", "Select an item to add it")}</p>
            </div>
          )}
          <div className="divide-y divide-[#e3edf1]">
            {cart.map((l: any, i: number) => (
              <div key={i} className="p-3 hover:bg-[#eef9fc] transition-colors">
                <div className="flex items-start gap-2 mb-2">
                  <p className="flex-1 min-w-0 font-black text-sm text-[#17324d] truncate">{l.name}</p>
                  <span className="text-sm font-black text-[#0E76AC]">{(l.qty * l.unitPrice).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg overflow-hidden border border-[#d8e5ea] bg-white">
                    <button aria-label={tt("تقليل الكمية", "Decrease quantity")} onClick={() => setQty(i, l.qty - 1)} className="h-10 w-10 shrink-0 hover:bg-[#eef8fb] grid place-items-center text-[#607987]">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="h-10 w-9 text-center font-black text-[#17324d] grid place-items-center text-sm">{l.qty}</span>
                    <button aria-label={tt("زيادة الكمية", "Increase quantity")} onClick={() => setQty(i, l.qty + 1)} className="h-10 w-10 shrink-0 hover:bg-[#eef8fb] grid place-items-center text-[#607987]">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500 font-bold">× {Number(l.unitPrice).toFixed(2)}</span>
                  <button aria-label={tt("حذف الصنف", "Remove item")} onClick={() => removeLine(i)} className="ms-auto grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Quick add — Delivery + Custom */}
            {cart.length > 0 && (
              <div className="p-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCart([...cart, { mealId: null, kind: "delivery", name: tt("توصيل", "Delivery"), qty: 1, unitPrice: deliveryFee }])}
                  className="h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 text-orange-300 hover:bg-orange-500/10 transition-colors"
                  style={{ border: "1px solid #3d2818" }}
                >
                  <Truck className="h-3.5 w-3.5" /> + {tt("توصيل", "Delivery")} {deliveryFee}
                </button>
                <button
                  onClick={() => {
                    const nm = prompt(tt("اسم الصنف؟", "Item name?")); if (!nm) return;
                    const p = Number(prompt(tt("السعر؟", "Price?")) || "0");
                    setCart([...cart, { mealId: null, name: nm, qty: 1, unitPrice: p }]);
                  }}
                  className="h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 text-slate-300 hover:bg-white/5 transition-colors"
                  style={{ border: "1px solid #1B2A48" }}
                >
                  <Plus className="h-3.5 w-3.5" /> {tt("صنف مخصّص", "Custom item")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="shrink-0 border-t border-[#d8e6ec] bg-white p-3.5 sm:p-4 shadow-[0_-10px_28px_rgba(71,117,156,0.06)]">
          {/* Discount + comment mini bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center rounded-xl border border-[#d8e5ea] bg-[#f7fafb]">
              <span className="ps-3 text-[#78909c]"><Percent className="h-3.5 w-3.5" /></span>
              <input
                type="number" min={0} max={100}
                value={discountPct || ""}
                onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                placeholder={tt("خصم %", "Discount %")}
                className="w-full h-9 px-2 bg-transparent text-xs font-bold text-[#17324d] placeholder:text-[#94a3b8] focus:outline-none"
              />
            </div>
            <button
              onClick={() => {
                const note = prompt(tt("ملاحظة على الطلب:", "Order note:"));
                if (note != null) void alertDialog({ message: tt("الملاحظة: ", "Note: ") + note }); // placeholder — يمكن تخزينها لاحقاً
              }}
              className="h-9 px-3 rounded-xl border border-[#d8e5ea] bg-white text-xs font-bold text-[#607987] flex items-center gap-1.5 hover:bg-[#eef8fb]"
              title={tt("ملاحظة على الطلب", "Order note")}
            >
              <MessageSquare className="h-3.5 w-3.5" /> {tt("تعليق", "Note")}
            </button>
          </div>

          {/* Amounts */}
          <div className="space-y-1 mb-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#708693] font-bold">{tt("المجموع الفرعي", "Subtotal")}</span>
              <span className="font-black text-[#17324d]">{totals.subtotal.toFixed(2)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="font-bold">{tt("الخصم", "Discount")}</span>
                <span className="font-black">- {totals.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-[#e1eaee]">
              <span className="text-[#526f7e] font-bold text-xs uppercase">{tt("الإجمالي", "Total")}</span>
              <span className="text-3xl font-black text-[#0E76AC]">
                {totals.total.toFixed(2)}
                <span className="text-sm text-[#78909c] ms-1">{tt("ر.ق", "QAR")}</span>
              </span>
            </div>
          </div>

          {/* Big Charge button (red like the reference) */}
          <button
            onClick={() => setShowCharge(true)}
            disabled={cart.length === 0 || !shift}
            className="w-full h-14 rounded-xl text-white font-black text-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-xl"
            style={{ background: "linear-gradient(135deg,#3CC4F0,#2BB0DC 55%,#47759C)" }}
          >
            {tt("دفع", "Charge")} {totals.total.toFixed(2)} {tt("ر.ق", "QAR")}
          </button>
        </div>
      </aside>

      {/* ═══════════ Items area (شمال في RTL) ═══════════ */}
      <div className="pos-items-panel flex-1 flex flex-col min-w-0">
        {/* Header: label + search + categories */}
        <div className="shrink-0 border-b border-[#d8e6ec] bg-white px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-end">
              <p className="text-[10px] font-bold uppercase text-[#78909c]">{tt("نقطة البيع", "Point of Sale")}</p>
              <h1 className="text-xl sm:text-2xl font-black text-[#17324d] leading-tight">{tt("طلب جديد", "New Order")}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 uppercase">{tt("متصل", "Online")}</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute h-4 w-4 top-3.5 start-3 text-[#78909c] pointer-events-none" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={tt("ابحث عن صنف…", "Search items...")}
              className="w-full h-11 ps-9 pe-3 rounded-xl border border-[#d5e3e9] bg-[#f7fafb] text-sm font-bold text-[#17324d] placeholder:text-[#94a3b8] focus:border-[#3CC4F0] focus:outline-none focus:ring-2 focus:ring-[#3CC4F0]/15"
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
                    active ? "text-white shadow-[0_4px_14px_rgba(60,196,240,0.24)]" : "text-[#607987] hover:border-[#b9d9e5] hover:bg-[#f1fafc] hover:text-[#173b55]"
                  }`}
                  style={active
                    ? { background: "linear-gradient(135deg,#3CC4F0,#47759C)" }
                    : { background: "#fff", border: "1px solid #d8e5ea" }}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {c.name || c.nameEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="pos-items-canvas flex-1 overflow-y-auto p-3 sm:p-4">
          {(!items) && <p className="text-center text-slate-500 py-16 font-bold">{tt("جاري التحميل…", "Loading...")}</p>}
          {items && filtered.length === 0 && (
            <p className="text-center text-slate-500 py-16 font-bold">{tt("لا توجد أصناف مطابقة", "No matching items")}</p>
          )}
          <div className="pos-items-grid grid gap-2.5 sm:gap-3">
            {filtered.map((m: any) => {
              const imageUrl = m.imageUrl || getPosMealImage(m.nameEn, m.name, m.nameAr);
              const hasImage = !!imageUrl;
              return (
                <button
                  key={m.id}
                  onClick={() => addToCart(m)}
                  className="pos-item-card group aspect-[1.08/1] rounded-2xl relative overflow-hidden border border-[#d8e6ec] bg-white shadow-[0_5px_16px_rgba(71,117,156,0.09)] hover:-translate-y-0.5 hover:border-[#9edcf0] hover:shadow-[0_12px_28px_rgba(71,117,156,0.16)] active:scale-[0.98] transition-all"
                >
                  {hasImage ? (
                    <>
                      <img
                        src={imageUrl}
                        alt={m.name}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#f8fbfc,#eaf6fa)]">
                      <ChefHat className="h-10 w-10 text-[#b1dce9]" />
                    </div>
                  )}

                  {/* Add badge — أعلى شمال (RTL: end = left) */}
                  <div className="absolute top-2 end-2 h-8 w-8 rounded-xl bg-[#3CC4F0] text-white grid place-items-center shadow-lg opacity-90 group-hover:opacity-100 transition-opacity">
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </div>

                  {/* Name — أسفل */}
                  <div className={cn("absolute inset-x-0 bottom-0 p-2.5 text-start", !hasImage && "border-t border-[#e2edf1] bg-white/95")}>
                    <p className={cn("font-black text-sm leading-tight line-clamp-2", hasImage ? "text-white drop-shadow-lg" : "text-[#17324d]")}>{m.name}</p>
                    <p className={cn("mt-1 text-xs font-black", hasImage ? "text-[#6ee1ff] drop-shadow-lg" : "text-[#0E76AC]")}>
                  {Number(m.price).toFixed(2)} <span className={cn("text-[10px]", hasImage ? "text-white/70" : "text-[#78909c]")}>{tt("ر.ق", "QAR")}</span>
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
