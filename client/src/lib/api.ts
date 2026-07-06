// client/src/lib/api.ts
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from "convex/react";
import { api } from "../../../convex/_generated/api";

// =========================
// Types
// =========================

export interface Customer {
  _id: string;
  fullName: string;
  phone: string;

  gender?: "MALE" | "FEMALE";
  deliveryTime: "MORNING" | "EVENING";
  startDate: string;
  endDate: string;

  address?: string;
  goals?: string;
  allergies?: string;
  notes?: string;

  isActive: boolean;

  durationWeeks?: number;
  mealsPerDay?: number;
  snacksPerDay?: number;
  totalMealsPerDay?: number;
  goalType?: string;

  program?: string;
  packageLabel?: string;
  paymentMethod?: string;
  price?: number;
  discount?: number;
  finalPrice?: number;
  birthdayDate?: string;
  status?: string;

  createdAt: number;
  updatedAt?: number;
}

export interface MealCategory {
  _id: string;
  name: string;
  sortOrder: number;
}

export interface MenuItem {
  _id: string;
  name: string;
  categoryId: string;
  calories?: number;
  macros?: string;
  isActive: boolean;
  tags?: string[];
}

export interface DailyPlan {
  _id: string;
  date: string;
  customerId: string;
  deliveryTime: string;
  status: string;
  notes?: string;
  items: any;
  createdAt: number;
}

// =========================
// Stickers (NEW)
// =========================

export type StickerQuery = {
  date: string; // yyyy-MM-dd
  deliveryTime: "MORNING" | "EVENING" | "ALL";
};

export type StickerMealRow = {
  customerName: string;
  mealTitle: string;
  dateText: string;
  caloriesText?: string;
  mealIndexText?: string;
};

export type StickerBoxRow = {
  slNo: string;
  customerName: string;
  customerNumber: string;
  deliveryTime: string;
  planLabel: string;
};

export type StickersResult = {
  mealStickers: StickerMealRow[];
  boxStickers: StickerBoxRow[];
};

// =========================
// Customers
// =========================

export function useCustomers() {
  const data = useConvexQuery(api.customers.list);
  return {
    data: data as Customer[] | undefined,
    isLoading: data === undefined,
    error: null,
  };
}

export function useCreateCustomer() {
  const mutation = useConvexMutation(api.customers.create);
  return {
    mutate: (data: any) => mutation(data),
    mutateAsync: (data: any) => mutation(data),
    isLoading: false,
  };
}

export function useUpdateCustomer() {
  const mutation = useConvexMutation(api.customers.update);
  return {
    mutate: ({ id, data }: { id: string; data: any }) =>
      mutation({ id: id as any, data }),
    mutateAsync: ({ id, data }: { id: string; data: any }) =>
      mutation({ id: id as any, data }),
    isLoading: false,
  };
}

export function useDeleteCustomer() {
  const mutation = useConvexMutation(api.customers.remove);
  return {
    mutate: (id: string) => mutation({ id: id as any }),
    mutateAsync: (id: string) => mutation({ id: id as any }),
    isLoading: false,
  };
}

/** ✅ Bulk import (upsert by phone) */
export function useImportCustomers() {
  const mutation = useConvexMutation(api.customers.importMany);
  return {
    mutate: (rows: any[]) => mutation({ rows }),
    mutateAsync: (rows: any[]) => mutation({ rows }),
    isLoading: false,
  };
}

/** ✅ Fix/Migrate old dates */
export function useMigrateCustomerDates() {
  const mutation = useConvexMutation(api.customers.migrateDates);
  return {
    mutate: () => mutation({}),
    mutateAsync: () => mutation({}),
    isLoading: false,
  };
}

/** ✅ Activate all customers */
export function useActivateAllCustomers() {
  const mutation = useConvexMutation(api.customers.activateAll);
  return {
    mutate: () => mutation({}),
    mutateAsync: () => mutation({}),
    isLoading: false,
  };
}

/** ✅ Delete all customers (+ optionally dailyPlans) */
export function useDeleteAllCustomers() {
  const mutation = useConvexMutation(api.customers.deleteAll);
  return {
    mutate: (deleteDailyPlans = true) => mutation({ deleteDailyPlans }),
    mutateAsync: (deleteDailyPlans = true) => mutation({ deleteDailyPlans }),
    isLoading: false,
  };
}

// =========================
// Categories
// =========================

export function useCategories() {
  const data = useConvexQuery(api.mealCategories.list);
  return {
    data: data as MealCategory[] | undefined,
    isLoading: data === undefined,
    error: null,
  };
}

export function useCreateCategory() {
  const mutation = useConvexMutation(api.mealCategories.create);
  return {
    mutate: (data: any) => mutation(data),
    mutateAsync: (data: any) => mutation(data),
    isLoading: false,
  };
}

export function useUpdateCategory() {
  const mutation = useConvexMutation(api.mealCategories.update);
  return {
    mutate: ({ id, data }: { id: string; data: any }) =>
      mutation({ id: id as any, data }),
    mutateAsync: ({ id, data }: { id: string; data: any }) =>
      mutation({ id: id as any, data }),
    isLoading: false,
  };
}

export function useReorderCategories() {
  const mutation = useConvexMutation(api.mealCategories.reorder);
  return {
    mutate: (categories: Array<{ id: string; sortOrder: number }>) =>
      mutation({ categories: categories as any }),
    mutateAsync: (categories: Array<{ id: string; sortOrder: number }>) =>
      mutation({ categories: categories as any }),
    isLoading: false,
  };
}

export function useDeleteCategory() {
  const mutation = useConvexMutation(api.mealCategories.remove);
  return {
    mutate: (id: string) => mutation({ id: id as any }),
    mutateAsync: (id: string) => mutation({ id: id as any }),
    isLoading: false,
  };
}

// =========================
// Menu Items
// =========================

export function useMenuItems() {
  const data = useConvexQuery(api.menuItems.list);
  return {
    data: data as MenuItem[] | undefined,
    isLoading: data === undefined,
    error: null,
  };
}

export function useCreateMenuItem() {
  const mutation = useConvexMutation(api.menuItems.create);
  return {
    mutate: (data: any) =>
      mutation({ ...data, categoryId: data.categoryId as any }),
    mutateAsync: (data: any) =>
      mutation({ ...data, categoryId: data.categoryId as any }),
    isLoading: false,
  };
}

export function useUpdateMenuItem() {
  const mutation = useConvexMutation(api.menuItems.update);
  return {
    mutate: ({ id, data }: { id: string; data: any }) =>
      mutation({
        ...data,
        id: id as any,
        ...(data.categoryId ? { categoryId: data.categoryId as any } : {}),
      }),
    mutateAsync: ({ id, data }: { id: string; data: any }) =>
      mutation({
        ...data,
        id: id as any,
        ...(data.categoryId ? { categoryId: data.categoryId as any } : {}),
      }),
    isLoading: false,
  };
}

export function useDeleteMenuItem() {
  const mutation = useConvexMutation(api.menuItems.remove);
  return {
    mutate: (id: string) => mutation({ id: id as any }),
    mutateAsync: (id: string) => mutation({ id: id as any }),
    isLoading: false,
  };
}

// =========================
// Modifiers
// =========================

export type Modifier = {
  _id: string;
  name: string;
  group: "AVOID" | "PREF" | "PORTION";
  isActive: boolean;
  sortOrder: number;
};

export function useModifiers() {
  const data = useConvexQuery(api.modifiers.list);
  return {
    data: data as Modifier[] | undefined,
    isLoading: data === undefined,
    error: null,
  };
}

export function useCreateModifier() {
  const mutation = useConvexMutation(api.modifiers.create);
  return {
    mutate: (data: any) => mutation(data),
    mutateAsync: (data: any) => mutation(data),
    isLoading: false,
  };
}

export function useUpdateModifier() {
  const mutation = useConvexMutation(api.modifiers.update);
  return {
    mutate: ({ id, data }: { id: string; data: any }) =>
      mutation({ id: id as any, data }),
    mutateAsync: ({ id, data }: { id: string; data: any }) =>
      mutation({ id: id as any, data }),
    isLoading: false,
  };
}

export function useDeleteModifier() {
  const mutation = useConvexMutation(api.modifiers.remove);
  return {
    mutate: (id: string) => mutation({ id: id as any }),
    mutateAsync: (id: string) => mutation({ id: id as any }),
    isLoading: false,
  };
}

// =========================
// Daily Plans
// =========================

/**
 * ✅ إصلاح مهم:
 * لو date = undefined ما نبعتش args أصلاً (عشان Convex ما يضربش)
 */
export function useDailyPlans(date?: string) {
  const data = useConvexQuery(
    api.dailyPlans.list,
    date ? ({ date } as any) : ({} as any),
  );
  return {
    data: data as DailyPlan[] | undefined,
    isLoading: data === undefined,
    error: null,
  };
}

export function useCreateDailyPlan() {
  const mutation = useConvexMutation(api.dailyPlans.create);
  return {
    mutate: (data: any) =>
      mutation({ ...data, customerId: data.customerId as any }),
    mutateAsync: (data: any) =>
      mutation({ ...data, customerId: data.customerId as any }),
    isLoading: false,
  };
}

export function useUpdateDailyPlan() {
  const mutation = useConvexMutation(api.dailyPlans.update);
  return {
    mutate: ({ id, data }: { id: string; data: any }) =>
      mutation({
        id: id as any,
        data: data.customerId
          ? { ...data, customerId: data.customerId as any }
          : data,
      }),
    mutateAsync: ({ id, data }: { id: string; data: any }) =>
      mutation({
        id: id as any,
        data: data.customerId
          ? { ...data, customerId: data.customerId as any }
          : data,
      }),
    isLoading: false,
  };
}

// تحضير خطة + خصم المخزون تلقائياً حسب الرسيبي
export function usePrepareAndConsume() {
  const mutation = useConvexMutation(api.inventory.prepareAndConsume);
  return {
    mutateAsync: (planId: string) => mutation({ planId: planId as any }),
  };
}

export function useDeleteDailyPlan() {
  const mutation = useConvexMutation(api.dailyPlans.remove);
  return {
    mutate: (id: string) => mutation({ id: id as any }),
    mutateAsync: (id: string) => mutation({ id: id as any }),
    isLoading: false,
  };
}

// =========================
// Inventory API
// =========================

export interface InventoryItem {
  _id: string;
  barcode?: string;
  nameAr: string;
  nameEn?: string;
  category: "vegetables" | "proteins" | "dairy" | "dry_goods" | "other";
  unit: "kg" | "piece" | "liter" | "pack" | "box";
  supplierId?: string;
  minStock: number;
  targetStock: number;
  currentStock: number;
  avgWeeklyUsage: number;
  createdAt: number;
  updatedAt: number;
}

export interface InventoryBatch {
  _id: string;
  itemId: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  supplierId?: string;
  expiryDate?: string;
  receivedAt: string;
  notes?: string;
}

export interface InventoryMovement {
  _id: string;
  itemId: string;
  type: "receive" | "consume" | "adjust";
  quantity: number;
  unitCost?: number;
  supplierId?: string;
  batchId?: string;
  note?: string;
  createdAt: number;
}

export interface Supplier {
  _id: string;
  name: string;
  phone?: string;
  createdAt: number;
}

export interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  expiringSoonCount: number;
  stockValue: number;
}

// Queries
export function useInventoryItems(args?: {
  search?: string;
  category?: string;
  lowStock?: boolean;
}) {
  const data = useConvexQuery(api.inventory.listItems, args || {});
  return {
    data: data as InventoryItem[] | undefined,
    isLoading: data === undefined,
  };
}

export function useInventoryItem(id?: string) {
  const data = useConvexQuery(
    api.inventory.getItemById,
    id ? { id: id as any } : "skip"
  );
  return {
    data: data as InventoryItem | undefined,
    isLoading: data === undefined,
  };
}

export function useInventoryByBarcode(barcode?: string) {
  const data = useConvexQuery(
    api.inventory.getItemByBarcode,
    barcode ? { barcode } : "skip"
  );
  return {
    data: data as any,
    isLoading: data === undefined,
  };
}

export function useInventorySummary() {
  const data = useConvexQuery(api.inventory.getSummary, {});
  return {
    data: data as InventorySummary | undefined,
    isLoading: data === undefined,
  };
}

export function useInventoryBatches(itemId?: string) {
  const data = useConvexQuery(
    api.inventory.getBatchesByItem,
    itemId ? { itemId: itemId as any } : "skip"
  );
  return {
    data: data as InventoryBatch[] | undefined,
    isLoading: data === undefined,
  };
}

export function useInventoryMovements(itemId?: string, limit?: number) {
  const data = useConvexQuery(
    api.inventory.getMovementsByItem,
    itemId ? { itemId: itemId as any, limit } : "skip"
  );
  return {
    data: data as InventoryMovement[] | undefined,
    isLoading: data === undefined,
  };
}

export function useSuppliers() {
  const data = useConvexQuery(api.inventory.getSuppliers, {});
  return {
    data: data as Supplier[] | undefined,
    isLoading: data === undefined,
  };
}

// Mutations
export function useCreateInventoryItem() {
  const mutation = useConvexMutation(api.inventory.createItem);
  return {
    mutateAsync: (data: any) => mutation(data),
    isLoading: false,
  };
}

export function useUpdateInventoryItem() {
  const mutation = useConvexMutation(api.inventory.updateItem);
  return {
    mutateAsync: (data: any) => mutation({ ...data, id: data.id as any }),
    isLoading: false,
  };
}

export function useReceiveStock() {
  const mutation = useConvexMutation(api.inventory.receiveStock);
  return {
    mutateAsync: (data: any) => mutation({ ...data, itemId: data.itemId as any, supplierId: data.supplierId as any }),
    isLoading: false,
  };
}

export function useConsumeStock() {
  const mutation = useConvexMutation(api.inventory.consumeStock);
  return {
    mutateAsync: (data: any) => mutation({ ...data, itemId: data.itemId as any }),
    isLoading: false,
  };
}

export function useAdjustStock() {
  const mutation = useConvexMutation(api.inventory.adjustStock);
  return {
    mutateAsync: (data: any) => mutation({ ...data, itemId: data.itemId as any }),
    isLoading: false,
  };
}

export function useCreateSupplier() {
  const mutation = useConvexMutation(api.inventory.createSupplier);
  return {
    mutateAsync: (data: any) => mutation(data),
    isLoading: false,
  };
}

export function useSeedInventory() {
  const mutation = useConvexMutation(api.seedInventory.seedInventoryData);
  return {
    mutateAsync: () => mutation({}),
    isLoading: false,
  };
}

// =========================
// Public Website Hooks
// =========================

export function useBanners() {
  const data = useConvexQuery(api.banners.listActiveBanners, {});
  return { data: data ?? [] };
}

export function usePublicPlans(duration?: "week" | "two_weeks" | "month") {
  const data = useConvexQuery(
    duration ? api.publicPlans.listByDuration : api.publicPlans.list,
    duration ? { duration } : {}
  );
  return { data: data ?? [] };
}

// أُزيل usePublicPlanBySlug: كان ينادي api.publicPlans.getBySlug غير الموجودة، ولم يكن مستخدماً.

export function usePublicMeals(options?: {
  category?: "breakfast" | "lunch" | "dinner" | "salad" | "snack" | "all";
  search?: string;
}) {
  const data = useConvexQuery(api.publicMeals.listMeals, {
    category: options?.category === "all" ? undefined : options?.category,
    search: options?.search,
  });
  return { data: data ?? [] };
}

export function usePublicMealBySlug(slug: string) {
  const data = useConvexQuery(api.publicMeals.getBySlug, { slug });
  return { data };
}

export function useSeedPublicWebsite() {
  const mutation = useConvexMutation(api.seedPublicWebsite.seedPublicWebsite);
  return {
    mutateAsync: () => mutation({}),
    isLoading: false,
  };
}

// =========================
// Stickers (NEW Hook)
// =========================

/**
 * ✅ ملاحظة:
 * لازم يكون عندك convex query اسمها: api.stickers.get
 * لو اسمها مختلف، غيره هنا فقط.
 */
export function useStickers(args: StickerQuery) {
  const data = useConvexQuery(api.stickers.get, args as any);
  return data as StickersResult | undefined;
}
