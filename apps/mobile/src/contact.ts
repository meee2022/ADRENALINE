/** Same approved fallback as the official website; never use a placeholder number. */
export function restaurantPhone(settings?: { phone?: string | null } | null): string {
  const digits = String(settings?.phone || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : '97451144366';
}
