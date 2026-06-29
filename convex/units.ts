// convex/units.ts
// تحويل الوحدات بين وحدة الرسيبي ووحدة المخزون (جرام↔كيلو، مل↔لتر)
// حتى يُخصم رسيبي بالجرام بشكل صحيح من مخزون محفوظ بالكيلو.

const TO_BASE: Record<string, { base: string; factor: number }> = {
  mg: { base: "mass", factor: 0.001 },
  g: { base: "mass", factor: 1 },
  gram: { base: "mass", factor: 1 },
  grams: { base: "mass", factor: 1 },
  kg: { base: "mass", factor: 1000 },
  ml: { base: "vol", factor: 1 },
  l: { base: "vol", factor: 1000 },
  liter: { base: "vol", factor: 1000 },
  litre: { base: "vol", factor: 1000 },
};

/**
 * حوّل `qty` من وحدة `from` إلى وحدة `to`. لو إحدى الوحدتين مجهولة أو الأبعاد
 * مختلفة (كتلة مقابل قطعة)، تُعاد الكمية كما هي (يُفترض تطابق الوحدات).
 */
export function convertUnit(qty: number, from?: string, to?: string): number {
  const q = Number(qty) || 0;
  if (!from || !to) return q;
  const f = TO_BASE[String(from).toLowerCase().trim()];
  const t = TO_BASE[String(to).toLowerCase().trim()];
  if (!f || !t || f.base !== t.base) return q;
  return (q * f.factor) / t.factor;
}
