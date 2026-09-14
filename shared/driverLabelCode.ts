export function nextDriverLabelCode(existing: readonly string[]): string {
  const highest = existing.reduce((max, code) => /^D\d+$/.test(code) ? Math.max(max, Number(code.slice(1))) : max, 0);
  return `D${String(highest + 1).padStart(2, "0")}`;
}

/** Explicit daily assignment wins. Never guess when same-shift plans conflict. */
export function resolveStickerDriver(
  plans: readonly { customerId?: unknown; deliveryTime?: string; driverId?: unknown; status?: string }[],
  customerId: string, shift: string, defaultDriverId?: unknown,
): string | null {
  const relevant = plans.filter(p => String(p.customerId) === customerId && p.deliveryTime === shift &&
    ["CONFIRMED", "PREPARED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(p.status || ""));
  const effective = new Set(relevant.map(p => String(p.driverId || defaultDriverId || "")));
  if (!relevant.length) return defaultDriverId ? String(defaultDriverId) : null;
  return effective.size === 1 ? [...effective][0] || null : null;
}
