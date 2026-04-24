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
  login: (email: string, role: User['role'], id?: string, name?: string) => void;
  logout: () => void;
  customerLogin: (account: CustomerAccount) => void;
  customerLogout: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentCustomer: null,

      login: (email, role, id, name) => set({ 
        currentUser: { 
          id: id || 'user_' + Math.random(), 
          name: name || email.split('@')[0], 
          email, 
          role 
        } 
      }),
      
      logout: () => set({ currentUser: null }),

      customerLogin: (account) => set({ currentCustomer: account }),
      
      customerLogout: () => set({ currentCustomer: null }),
    }),
    {
      name: 'adrenaline-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentCustomer: state.currentCustomer,
      }),
    }
  )
);
