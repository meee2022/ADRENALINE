/**
 * @file client/src/lib/customerIdentity.ts
 * @description هوية العميل على الموقع العام (بدون تسجيل دخول).
 *
 * يدخل العميل رقمه مرة واحدة في المنيو، فنحفظه هنا وتقرأه بقية الصفحات
 * (الخطة الذكية مثلاً) بدل أن تسأله من جديد.
 *
 * ═══ لماذا sessionStorage وليس localStorage؟ ═══
 * كان الرقم يُخزَّن في localStorage فيبقى بعد إغلاق التطبيق — يرجع العميل
 * فيلاقي نفسه "داخلاً" برقم قديم بلا أن يطلبه، وقد يكون:
 *   - جهازاً مشتركاً، أو
 *   - رقماً تتشارك فيه عائلة (والمشترك المختار محفوظ معه) ⇒ يشوف اشتراك
 *     فرد آخر ويفتكره اشتراكه.
 * وهذه ليست مصادقة أصلاً (لا تحقق من ملكية الرقم)، فبقاؤها للأبد بلا مقابل.
 * sessionStorage يعيش داخل الجلسة فقط: التنقّل بين المنيو والخطة الذكية
 * وإعادة تحميل الصفحة تحتفظ بالرقم، وإغلاق التطبيق/التبويب يمسحه —
 * فيُسأل من جديد عند العودة.
 *
 * ⚠️ ليست مصادقة — مجرد تذكّر للرقم داخل الجلسة. أي بيانات حسّاسة تُحمى
 *    على السيرفر (انظر convex/sessions.ts).
 */

const KEY_PHONE = "menu_phone";
const KEY_CUSTOMER_ID = "menu_customer_id";
const KEY_BROWSE = "menu_browse";

const hasWindow = () => typeof window !== "undefined";

/** التخزين المعتمد — جلسة واحدة فقط. */
const store = (): Storage | null => (hasWindow() ? window.sessionStorage : null);

export function getVerifiedPhone(): string {
  return store()?.getItem(KEY_PHONE) || "";
}

export function getVerifiedCustomerId(): string {
  return store()?.getItem(KEY_CUSTOMER_ID) || "";
}

export function isBrowseOnly(): boolean {
  return store()?.getItem(KEY_BROWSE) === "1";
}

/** يحفظ الرقم بعد التحقق منه (أرقام فقط). */
export function saveVerifiedPhone(phone: string): void {
  store()?.setItem(KEY_PHONE, phone.replace(/\D/g, ""));
}

/** يحفظ المشترك المختار (العائلات قد تتشارك رقماً واحداً). */
export function saveVerifiedCustomerId(customerId: string): void {
  store()?.setItem(KEY_CUSTOMER_ID, String(customerId));
}

export function setBrowseOnly(): void {
  store()?.setItem(KEY_BROWSE, "1");
}

/** ينسى العميل تماماً (زر "تغيير الرقم"). */
export function clearIdentity(): void {
  const s = store();
  if (!s) return;
  s.removeItem(KEY_PHONE);
  s.removeItem(KEY_CUSTOMER_ID);
  s.removeItem(KEY_BROWSE);
  // 🧹 تنظيف مخلّفات النسخة القديمة (localStorage) — بدونه يفضل الرقم
  //    القديم محفوظاً على أجهزة العملاء الحاليين إلى الأبد.
  try {
    localStorage.removeItem(KEY_PHONE);
    localStorage.removeItem(KEY_CUSTOMER_ID);
    localStorage.removeItem(KEY_BROWSE);
  } catch { /* التخزين محجوب — لا شيء نمسحه */ }
}

/**
 * 🧹 يمسح هوية النسخة القديمة من localStorage مرة واحدة عند الإقلاع.
 *    العملاء الحاليون عندهم الرقم محفوظاً هناك؛ لولا هذا لظلّ موجوداً
 *    (وإن كنا لم نعد نقرأه) بلا طريقة لمسحه.
 */
export function purgeLegacyIdentity(): void {
  if (!hasWindow()) return;
  try {
    localStorage.removeItem(KEY_PHONE);
    localStorage.removeItem(KEY_CUSTOMER_ID);
    localStorage.removeItem(KEY_BROWSE);
  } catch { /* التخزين محجوب */ }
}
