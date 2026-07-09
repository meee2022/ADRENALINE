import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from './types';

export interface CustomerAccount {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  customerId?: string;
}

interface AppState {
  currentUser: User | null;
  currentCustomer: CustomerAccount | null;
  /** توكن جلسة السيرفر — يُرسل مع العمليات الحسّاسة لفرض الصلاحيات */
  sessionToken: string | null;
  login: (email: string, role: User['role'], id?: string, name?: string, sessionToken?: string, permissions?: string[]) => void;
  logout: () => void;
  customerLogin: (account: CustomerAccount, sessionToken?: string) => void;
  customerLogout: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentCustomer: null,
      sessionToken: null,

      login: (email, role, id, name, sessionToken, permissions) => set({
        currentUser: {
          id: id || 'user_' + Math.random(),
          name: name || email.split('@')[0],
          email,
          role,
          permissions,
        },
        ...(sessionToken ? { sessionToken } : {}),
      }),

      logout: () => set({ currentUser: null, sessionToken: null }),

      customerLogin: (account, sessionToken) => set({ currentCustomer: account, ...(sessionToken ? { sessionToken } : {}) }),

      customerLogout: () => set({ currentCustomer: null, sessionToken: null }),
    }),
    {
      name: 'adrenaline-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentCustomer: state.currentCustomer,
        sessionToken: state.sessionToken,
      }),
    }
  )
);

/** مساعد: قراءة توكن الجلسة الحالي خارج React */
export const getSessionToken = (): string | null => useStore.getState().sessionToken;
