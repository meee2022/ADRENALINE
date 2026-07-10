/**
 * @file client/src/lib/customerIdentity.ts
 * @description هوية العميل على الموقع العام (بدون تسجيل دخول).
 *
 * يدخل العميل رقمه مرة واحدة في المنيو، فنحفظه هنا وتقرأه بقية الصفحات
 * (الخطة الذكية مثلاً) بدل أن تسأله من جديد.
 *
 * ⚠️ هذه ليست مصادقة — مجرد تذكّر للرقم لتسهيل التصفّح. أي بيانات حسّاسة
 *    تُحمى على السيرفر (انظر convex/sessions.ts).
 */

const KEY_PHONE = "menu_phone";
const KEY_CUSTOMER_ID = "menu_customer_id";
const KEY_BROWSE = "menu_browse";

const hasWindow = () => typeof window !== "undefined";

export function getVerifiedPhone(): string {
  return hasWindow() ? localStorage.getItem(KEY_PHONE) || "" : "";
}

export function getVerifiedCustomerId(): string {
  return hasWindow() ? localStorage.getItem(KEY_CUSTOMER_ID) || "" : "";
}

export function isBrowseOnly(): boolean {
  return hasWindow() ? localStorage.getItem(KEY_BROWSE) === "1" : false;
}

/** يحفظ الرقم بعد التحقق منه (أرقام فقط). */
export function saveVerifiedPhone(phone: string): void {
  if (!hasWindow()) return;
  localStorage.setItem(KEY_PHONE, phone.replace(/\D/g, ""));
}

/** يحفظ المشترك المختار (العائلات قد تتشارك رقماً واحداً). */
export function saveVerifiedCustomerId(customerId: string): void {
  if (!hasWindow()) return;
  localStorage.setItem(KEY_CUSTOMER_ID, String(customerId));
}

export function setBrowseOnly(): void {
  if (!hasWindow()) return;
  localStorage.setItem(KEY_BROWSE, "1");
}

/** ينسى العميل تماماً (زر "تغيير الرقم"). */
export function clearIdentity(): void {
  if (!hasWindow()) return;
  localStorage.removeItem(KEY_PHONE);
  localStorage.removeItem(KEY_CUSTOMER_ID);
  localStorage.removeItem(KEY_BROWSE);
}
