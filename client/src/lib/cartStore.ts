import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartMeal {
  _id: string;
  nameAr: string;
  nameEn: string;
  category: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  imageUrl?: string;
  priceQAR: number;
  week: number;
  day: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
}

interface CartState {
  restaurantKey: "ADRENALINE" | "NUTRI_RESET";
  // Cart Items
  items: CartMeal[];

  // Customer Info
  customerInfo: CustomerInfo | null;

  // ✅ تاريخ بداية التوصيل الذي اختاره العميل (yyyy-MM-dd)
  preferredStartDate: string | null;

  // Actions
  addItem: (meal: CartMeal) => void;
  removeItem: (mealId: string, week: number, day: string) => void;
  clearCart: () => void;
  updateCustomerInfo: (info: CustomerInfo) => void;
  setPreferredStartDate: (date: string) => void;
  setRestaurantContext: (restaurantKey: "ADRENALINE" | "NUTRI_RESET") => void;
  
  // Computed
  getTotalMeals: () => number;
  getTotalPrice: () => number;
  getTotalCalories: () => number;
  getWeeks: () => number[];
  getMealsByWeek: (week: number) => Record<string, CartMeal[]>;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantKey: "ADRENALINE",
      customerInfo: null,
      preferredStartDate: null,

      setPreferredStartDate: (date) => set({ preferredStartDate: date }),
      setRestaurantContext: (restaurantKey) => set((state) => state.restaurantKey === restaurantKey
        ? state
        : { restaurantKey, items: [], customerInfo: null, preferredStartDate: null }),

      // ✅ يُسمح بتكرار نفس الوجبة في نفس اليوم (يختارها المشترك مرتين) — السقف
      //    اليومي محسوب في المنيو (handleAddToCart) فلا يتجاوز عدد الاشتراك.
      addItem: (meal) =>
        set((state) => ({
          items: [...state.items, meal],
        })),

      // يزيل **نسخة واحدة** فقط (آخر نسخة مطابقة) — كي يعمل خفض العدد مع التكرار.
      removeItem: (mealId, week, day) =>
        set((state) => {
          const idx = [...state.items]
            .map((it, i) => ({ it, i }))
            .reverse()
            .find(({ it }) => it._id === mealId && it.week === week && it.day === day)?.i;
          if (idx === undefined) return state;
          const items = state.items.slice();
          items.splice(idx, 1);
          return { items };
        }),

      clearCart: () =>
        set({
          items: [],
          customerInfo: null,
          preferredStartDate: null,
        }),

      updateCustomerInfo: (info) =>
        set({
          customerInfo: info,
        }),

      getTotalMeals: () => get().items.length,

      getTotalPrice: () =>
        get().items.reduce((sum, item) => sum + item.priceQAR, 0),

      getTotalCalories: () =>
        get().items.reduce((sum, item) => sum + item.calories, 0),

      getWeeks: () => {
        const weeks = Array.from(new Set(get().items.map((item) => item.week)));
        return weeks.sort((a, b) => a - b);
      },

      getMealsByWeek: (week) => {
        const meals = get().items.filter((item) => item.week === week);
        return meals.reduce((acc, meal) => {
          if (!acc[meal.day]) acc[meal.day] = [];
          acc[meal.day].push(meal);
          return acc;
        }, {} as Record<string, CartMeal[]>);
      },
    }),
    {
      name: "adrenaline-cart-storage",
    }
  )
);
