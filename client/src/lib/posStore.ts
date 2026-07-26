/**
 * @file client/src/lib/posStore.ts
 * @description حالة جلسة الكاشير (PIN-based) — منفصلة عن جلسة الأدمن.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Cashier = { id: string; name: string; role: string };

type State = {
  token: string | null;
  cashier: Cashier | null;
  cart: any[];              // سلة الشراء الحالية
  activeTicketId: string | null;
  /** بيانات الفاتورة المستأنَفة (نوع الطلب/العميل/الخصم) — تُسلَّم لشاشة البيع
   *  مرة واحدة ثم تُمسح. بدونها كانت الفاتورة تعود بالأصناف فقط فيتحوّل
   *  طلب التوصيل إلى «صالة» ويضيع اسم العميل والخصم. */
  resumedMeta: { orderType?: string; customerName?: string; discount?: number } | null;
  setSession: (token: string, cashier: Cashier) => void;
  clearSession: () => void;
  setCart: (cart: any[]) => void;
  clearCart: () => void;
  setActiveTicketId: (id: string | null) => void;
  setResumedMeta: (m: { orderType?: string; customerName?: string; discount?: number } | null) => void;
};

export const usePosStore = create<State>()(
  persist(
    (set) => ({
      token: null,
      cashier: null,
      cart: [],
      activeTicketId: null,
      resumedMeta: null,
      setSession: (token, cashier) => set({ token, cashier }),
      clearSession: () => set({ token: null, cashier: null, cart: [], activeTicketId: null, resumedMeta: null }),
      setCart: (cart) => set({ cart }),
      clearCart: () => set({ cart: [] }),
      setActiveTicketId: (activeTicketId) => set({ activeTicketId }),
      setResumedMeta: (resumedMeta) => set({ resumedMeta }),
    }),
    { name: "adrenaline-pos-storage" }
  )
);
