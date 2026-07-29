/**
 * هل يقع تاريخٌ داخل اشتراك المشترك — الحالي أو أيّ فترة جدّدها؟
 *
 * التجديد يدفع البداية للأمام، وكانت الفترة المنتهية تُمحى، فبدت خططٌ أكلها
 * العميل فعلاً كأنها «خارج الاشتراك» — ستة مشتركين انتهت فترتهم 30-7 وجدّدوا
 * من 1-8، فكادت خططهم الصحيحة تُحذف. الفترات السابقة محفوظة في
 * `subscriptionHistory`، وكل فحص يجب أن يشملها.
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type SubPeriod = { startDate?: string; endDate?: string };

export function subscriptionPeriodsOf(customer: any): Array<{ start: string; end: string }> {
  const out: Array<{ start: string; end: string }> = [];
  const push = (s: any, e: any) => {
    const a = String(s || "").slice(0, 10);
    const b = String(e || "").slice(0, 10);
    if (ISO.test(a) && ISO.test(b) && b >= a) out.push({ start: a, end: b });
  };
  push(customer?.startDate, customer?.endDate);
  for (const h of Array.isArray(customer?.subscriptionHistory) ? customer.subscriptionHistory : []) {
    push(h?.startDate, h?.endDate);
  }
  return out;
}

/** التاريخ داخل الاشتراك؟ بلا تواريخ صالحة نتساهل (لا نمنع عملاً بسبب بيانات ناقصة). */
export function isWithinSubscription(customer: any, dateISO: string): boolean {
  const d = String(dateISO || "").slice(0, 10);
  if (!ISO.test(d)) return true;
  const periods = subscriptionPeriodsOf(customer);
  if (!periods.length) return true;
  return periods.some((p) => d >= p.start && d <= p.end);
}
