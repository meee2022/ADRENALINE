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
  setSession: (token: string, cashier: Cashier) => void;
  clearSession: () => void;
  setCart: (cart: any[]) => void;
  clearCart: () => void;
};

export const usePosStore = create<State>()(
  persist(
    (set) => ({
      token: null,
      cashier: null,
      cart: [],
      setSession: (token, cashier) => set({ token, cashier }),
      clearSession: () => set({ token: null, cashier: null, cart: [] }),
      setCart: (cart) => set({ cart }),
      clearCart: () => set({ cart: [] }),
    }),
    { name: "adrenaline-pos-storage" }
  )
);
