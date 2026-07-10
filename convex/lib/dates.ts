/**
 * @file convex/lib/dates.ts
 * @description المصدر الوحيد لقاعدة أيام التوصيل وحساب التواريخ.
 *
 * كانت القاعدة (السبت→الأربعاء، والخميس والجمعة إجازة) مكرّرة بثلاث صيغ
 * مختلفة في subscriptionPause.ts و ai.ts و customerOrders.ts. أي اختلاف
 * بينها يعني أن العميل يخسر أياماً دفع ثمنها، أو يأخذ أياماً مجاناً.
 *
 * كل الحسابات بالـUTC حتى لا ينزلق اليوم مع المنطقة الزمنية.
 */

/** أرقام أيام الأسبوع في JS: الأحد 0 … السبت 6 */
export const FRIDAY = 5;

/**
 * أيام التوصيل: السبت → الخميس (6 أيام). الجمعة فقط لا توصيل فيها.
 *
 * ⚠️ آلية عمل المطعم: التوصيل 6 أيام أسبوعياً، الجمعة وحدها بلا توصيل
 *    (المطبخ يعمل فيها عادةً للتحضير). إجازة *الموظفين* يوم الخميس شيء
 *    منفصل تماماً يخصّ الحضور — لا علاقة له بجدول التوصيل هذا.
 */
export const DELIVERY_DAYS = [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
] as const;

export type DeliveryDay = (typeof DELIVERY_DAYS)[number];

/** yyyy-MM-dd → Date عند منتصف ليل UTC */
export function parseDate(s: string): Date {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date → yyyy-MM-dd */
export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/** عدد الأيام منذ حقبة يونكس — لمقارنة التواريخ كأعداد صحيحة. */
export function dateToDays(date: string): number {
  return Math.floor(parseDate(date).getTime() / 86400000);
}

/** هل هذا يوم توصيل؟ الجمعة وحدها لا توصيل فيها (السبت→الخميس = 6 أيام). */
export function isDeliveryDay(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow !== FRIDAY;
}

/**
 * عدد أيام التوصيل في المدى [from, toExclusive)،
 * مع استبعاد أيام تخطّاها العميل مسبقاً.
 */
export function countDeliveryDays(
  from: string,
  toExclusive: string,
  skipped: string[] = [],
): number {
  const skip = new Set(skipped);
  let n = 0;
  let cur = parseDate(from);
  const end = parseDate(toExclusive);
  for (let i = 0; i < 400 && cur.getTime() < end.getTime(); i++) {
    if (isDeliveryDay(cur) && !skip.has(fmtDate(cur))) n++;
    cur = addDays(cur, 1);
  }
  return n;
}

/** يمدّ تاريخاً إلى الأمام بعدد `n` من أيام التوصيل، ويرجّع آخر يوم توصيل مضاف. */
export function addDeliveryDays(fromDate: string, n: number): string {
  let cur = parseDate(fromDate);
  let added = 0;
  for (let i = 0; i < 800 && added < n; i++) {
    cur = addDays(cur, 1);
    if (isDeliveryDay(cur)) added++;
  }
  return fmtDate(cur);
}

/**
 * ترتيب يوم التوصيل داخل الأسبوع (السبت = 0 … الخميس = 5).
 * الجمعة وحدها ليست يوم توصيل، فنُرجّع لها أقرب يوم (الخميس) بدل رمي خطأ
 * يعطّل اعتماد الطلب كله.
 */
export function getDayOffset(day: string): number {
  const idx = DELIVERY_DAYS.indexOf(String(day).toLowerCase() as DeliveryDay);
  return idx >= 0 ? idx : DELIVERY_DAYS.length - 1; // thursday
}
