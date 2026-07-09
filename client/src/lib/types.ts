export type Role = 'ADMIN' | 'KITCHEN' | 'DELIVERY' | 'NUTRITIONIST' | 'INVENTORY_MANAGER' | 'ACCOUNTANT' | 'FINANCE_MANAGER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** صلاحيات صفحات مخصّصة (لو موجودة تتجاوز قالب الدور) */
  permissions?: string[];
}

export type DeliveryTime = 'MORNING' | 'EVENING';
export type Gender = 'MALE' | 'FEMALE';
export type PlanStatus = 'DRAFT' | 'CONFIRMED' | 'PREPARED' | 'DELIVERED' | 'CANCELLED';

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  gender: Gender;
  goals?: string;
  notes?: string;
  deliveryTime: DeliveryTime;
  address?: string;
  allergies?: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  isActive: boolean;
  createdAt: string;
}

export interface MealCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  calories?: number;
  macros?: string;
  isActive: boolean;
  tags?: string[];
}

export interface Addon {
  id: string;
  name: string;
  price?: number;
  isActive: boolean;
}

export interface DailyPlanItem {
  id: string;
  categoryId: string;
  menuItemId?: string | null; // Nullable if OFF
  isOff: boolean;
  addonIds: string[];
  specialNotes?: string;
}

export interface DailyPlan {
  id: string;
  date: string; // YYYY-MM-DD
  customerId: string;
  deliveryTime: DeliveryTime;
  status: PlanStatus;
  notes?: string;
  items: DailyPlanItem[]; // Using embedded array for simplicity in mock
  createdAt: string;
}
