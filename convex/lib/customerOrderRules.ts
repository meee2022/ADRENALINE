import { DELIVERY_DAYS, fmtDate } from "./dates";
/* ✅ القواعد نفسها التي تستخدمها شاشة المنيو والخطة الذكية — مصدر واحد (shared/rules):
   التصنيفات، الجدولة، ومشي خانات الاشتراك. الخادم يمرّر «يوم قطر» بدل ساعة الجهاز. */
import {
  isMainCategory as sharedIsMain, isSnackCategory as sharedIsSnack, mealScheduledFor as sharedScheduledFor,
  orderedSubscriptionSlots, countPicks, BREAKFAST_MAX_PER_DAY as SHARED_BREAKFAST_MAX,
} from "../../shared/rules";

export const BREAKFAST_MAX_PER_DAY = SHARED_BREAKFAST_MAX;

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

export function isMainCategory(category: unknown): boolean { return sharedIsMain(category); }
export function isSnackCategory(category: unknown): boolean { return sharedIsSnack(category); }

/** جدولة الوجبة في (دورة، يوم) — مع رفض دورة خارج 1..4 أو يوم ليس يوم توصيل. */
export function mealScheduledFor(meal: any, week: number, day: string): boolean {
  const normalizedDay = norm(day);
  if (!Number.isInteger(week) || week < 1 || week > 4 || !DELIVERY_DAY_SET.has(normalizedDay)) return false;
  return sharedScheduledFor(meal, week, normalizedDay);
}

/** خانات الاشتراك القابلة للطلب: نفس مشي المنيو (من بكرة، تخطّي الجمعة، تقدّم الدورة كل جمعة) بيوم قطر. */
export function orderableSubscriptionSlots(
  customer: SubscriptionCustomer,
  startRotationWeek: number,
  todayISO: string,
): Array<{ week: number; day: string }> {
  return orderedSubscriptionSlots(String(customer.startDate || ""), String(customer.endDate || ""), startRotationWeek, todayISO);
}

function fail(code: string, details?: Record<string, unknown>): never {
  // تفاصيل آمنة ومحدودة تساعد العميل على العثور على الاختيار المخالف وسط خطة
  // كبيرة. لا نرسل حقول الوجبة كاملة ولا أي بيانات اشتراك حساسة.
  const suffix = details ? `:${JSON.stringify(details)}` : "";
  throw new Error(`ORDER_VALIDATION:${code}${suffix}`);
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
    if (!mealScheduledFor(meal, week, day)) {
      fail("MEAL_NOT_SCHEDULED", {
        mealNameAr: String(meal?.nameAr || meal?.nameEn || "").slice(0, 120),
        mealNameEn: String(meal?.nameEn || meal?.nameAr || "").slice(0, 120),
        week,
        day,
      });
    }

    const category = norm(meal.category);
    if (!isMainCategory(category) && !isSnackCategory(category)) fail("INVALID_CATEGORY");
    const key = `${week}:${day}`;
    const count = counts.get(key) || { mains: 0, snacks: 0, breakfast: 0 };
    const c = countPicks([{ category }]);
    count.snacks += c.snacks; count.mains += c.meals; count.breakfast += c.breakfasts;
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
