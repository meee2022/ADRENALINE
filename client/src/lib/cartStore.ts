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
  // Cart Items
  items: CartMeal[];
  
  // Customer Info
  customerInfo: CustomerInfo | null;
  
  // Actions
  addItem: (meal: CartMeal) => void;
  removeItem: (mealId: string, week: number, day: string) => void;
  clearCart: () => void;
  updateCustomerInfo: (info: CustomerInfo) => void;
  
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
      customerInfo: null,

      addItem: (meal) =>
        set((state) => {
          // تحقق إذا كانت الوجبة موجودة بالفعل في نفس الأسبوع واليوم
          const exists = state.items.some(
            (item) =>
              item._id === meal._id &&
              item.week === meal.week &&
              item.day === meal.day
          );

          if (exists) {
            return state; // لا تضيف نفس الوجبة مرتين
          }

          return {
            items: [...state.items, meal],
          };
        }),

      removeItem: (mealId, week, day) =>
        set((state) => ({
          items: state.items.filter(
            (item) =>
              !(item._id === mealId && item.week === week && item.day === day)
          ),
        })),

      clearCart: () =>
        set({
          items: [],
          customerInfo: null,
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
        const weeks = [...new Set(get().items.map((item) => item.week))];
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
