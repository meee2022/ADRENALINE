import { addDays, DELIVERY_DAYS, fmtDate, parseDate } from "./dates";

export const BREAKFAST_MAX_PER_DAY = 1;

const MAIN_CATEGORIES = new Set(["breakfast", "lunch", "dinner"]);
const SNACK_CATEGORIES = new Set(["snack", "salad"]);
const DELIVERY_DAY_SET = new Set<string>(DELIVERY_DAYS);

const norm = (value: unknown) => String(value || "").trim().toLowerCase();

export type OrderSelectionItem = {
  mealId: unknown;
  week: number;
  day: string;
  meal: any;
};

export type SubscriptionCustomer = {
  isActive?: boolean;
  pausedFrom?: string;
  startDate?: string;
  endDate?: string;
  mealsPerDay?: number;
  snacksPerDay?: number;
};

export function isMainCategory(category: unknown): boolean {
  return MAIN_CATEGORIES.has(norm(category));
}

export function isSnackCategory(category: unknown): boolean {
  return SNACK_CATEGORIES.has(norm(category));
}

export function mealScheduledFor(meal: any, week: number, day: string): boolean {
  const normalizedDay = norm(day);
  if (!Number.isInteger(week) || week < 1 || week > 4 || !DELIVERY_DAY_SET.has(normalizedDay)) {
    return false;
  }

  if (Array.isArray(meal?.schedule) && meal.schedule.length > 0) {
    return meal.schedule.some(
      (slot: any) => Number(slot?.week) === week && norm(slot?.day) === normalizedDay,
    );
  }

  const weeks = Array.isArray(meal?.weeks) ? meal.weeks.map(Number) : [];
  const days = Array.isArray(meal?.days) ? meal.days.map(norm) : [];
  if (weeks.length > 0 || days.length > 0) {
    return weeks.includes(week) && days.includes(normalizedDay);
  }

  return false;
}

/** Same subscription walk used by the customer menu: tomorrow onward, Friday excluded. */
export function orderableSubscriptionSlots(
  customer: SubscriptionCustomer,
  startRotationWeek: number,
  todayISO: string,
): Array<{ week: number; day: string }> {
  const startDate = String(customer.startDate || "");
  const endDate = String(customer.endDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return [];

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (end.getTime() < start.getTime()) return [];

  const tomorrow = addDays(parseDate(todayISO), 1);
  const effectiveStart = start.getTime() > parseDate(todayISO).getTime() ? start : tomorrow;
  let rotationWeek = startRotationWeek >= 1 && startRotationWeek <= 4 ? startRotationWeek : 1;
  const slots: Array<{ week: number; day: string }> = [];
  let cursor = start;

  for (let guard = 0; guard < 400 && cursor.getTime() <= end.getTime(); guard++) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 5 && cursor.getTime() >= effectiveStart.getTime()) {
      const names: Record<number, string> = {
        6: "saturday", 0: "sunday", 1: "monday", 2: "tuesday",
        3: "wednesday", 4: "thursday",
      };
      const day = names[dayOfWeek];
      if (day) slots.push({ week: rotationWeek, day });
    }
    if (dayOfWeek === 5) rotationWeek = (rotationWeek % 4) + 1;
    cursor = addDays(cursor, 1);
  }

  return slots;
}

function fail(code: string): never {
  throw new Error(`ORDER_VALIDATION:${code}`);
}

/**
 * Server-side mirror of the customer UI guards. It validates only a new order;
 * it does not alter dates, plans, approval, or stored meal nutrition.
 */
export function validateCustomerOrderSelection(args: {
  items: OrderSelectionItem[];
  customer?: SubscriptionCustomer | null;
  startRotationWeek?: number;
  todayISO: string;
}): void {
  const { items, customer, todayISO } = args;
  const counts = new Map<string, { mains: number; snacks: number; breakfast: number }>();

  for (const item of items) {
    const week = Number(item.week);
    const day = norm(item.day);
    const meal = item.meal;
    if (!Number.isInteger(week) || week < 1 || week > 4 || !DELIVERY_DAY_SET.has(day)) fail("INVALID_SLOT");
    if (!meal?.isActive || meal?.isGymOnly || meal?.isOnlineOnly) fail("INVALID_MEAL_CHANNEL");
    if (!mealScheduledFor(meal, week, day)) fail("MEAL_NOT_SCHEDULED");

    const category = norm(meal.category);
    if (!isMainCategory(category) && !isSnackCategory(category)) fail("INVALID_CATEGORY");
    const key = `${week}:${day}`;
    const count = counts.get(key) || { mains: 0, snacks: 0, breakfast: 0 };
    if (isSnackCategory(category)) count.snacks += 1;
    else count.mains += 1;
    if (category === "breakfast") count.breakfast += 1;
    // ☕ لا نرفض فطاراً ثانياً: المشترك حرّ فيه بعد تأكيد صريح في المنيو
    //    (BREAKFAST_MAX_PER_DAY يبقى سقفاً للاختيار **التلقائي** فقط).
    //    العدد الكلي للوجبات الرئيسية يظل مفروضاً أدناه، فلا يزيد أحد حصّته.
    counts.set(key, count);
  }

  // Preserve guest ordering behavior while still enforcing catalog/schedule rules.
  if (!customer) return;
  /* «لم يبدأ بعد» ليس «موقوفاً». المجدِّد يُسجَّل ببداية مستقبلية وحسابه
     isActive=false حتى يوم البداية — وهذه بالضبط فترة إرسال خطته كي يطبخ له
     المطبخ من أول يوم. فاطمة الورثان (تبدأ 29-7) بنت 120 وجبة ورُفض الإرسال
     هنا. يُحجب الإرسال فقط عن الموقوف فعلاً: pausedFrom مثبَّت، أو معطَّل
     وبدايته ليست أمامه. */
  const startISO = String(customer.startDate || "");
  const startsAhead = /^\d{4}-\d{2}-\d{2}$/.test(startISO) && startISO > todayISO;
  if (customer.pausedFrom || (customer.isActive === false && !startsAhead)) fail("SUBSCRIPTION_PAUSED");
  const endDate = String(customer.endDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < todayISO) fail("SUBSCRIPTION_EXPIRED");

  const mealsPerDay = Number.isFinite(Number(customer.mealsPerDay)) && Number(customer.mealsPerDay) > 0
    ? Math.floor(Number(customer.mealsPerDay)) : 0;
  const snacksPerDay = Number.isFinite(Number(customer.snacksPerDay)) && Number(customer.snacksPerDay) > 0
    ? Math.floor(Number(customer.snacksPerDay)) : 0;
  if (!mealsPerDay && !snacksPerDay) fail("SUBSCRIPTION_COUNTS_MISSING");

  const slots = orderableSubscriptionSlots(customer, Number(args.startRotationWeek) || 1, todayISO);
  const required = new Set(slots.map((slot) => `${slot.week}:${slot.day}`));
  if (required.size === 0) fail("SUBSCRIPTION_NO_ORDERABLE_DAYS");
  for (const key of counts.keys()) if (!required.has(key)) fail("SLOT_OUTSIDE_SUBSCRIPTION");

  for (const key of required) {
    const count = counts.get(key) || { mains: 0, snacks: 0, breakfast: 0 };
    if (count.mains !== mealsPerDay || count.snacks !== snacksPerDay) fail("SUBSCRIPTION_COUNT_MISMATCH");
  }
}

export function qatarTodayISO(now = Date.now()): string {
  return fmtDate(new Date(now + 3 * 60 * 60 * 1000));
}
