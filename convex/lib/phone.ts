/**
 * @file convex/lib/phone.ts
 * @description تطبيع رقم الهاتف — المصدر الوحيد.
 *
 * الهاتف هو مفتاح هوية المشترك (البحث، الربط، تتبّع الطلب). كانت هذه الدالة
 * منسوخة حرفياً في customers.ts و stickers.ts؛ أي تغيير في إحداهما دون الأخرى
 * يعني أن نفس العميل يُطابَق في صفحة ولا يُطابَق في أخرى.
 */
export function normalizePhone(input: unknown): string {
  const s = String(input ?? "").trim();
  return s.replace(/\D/g, "");
}
