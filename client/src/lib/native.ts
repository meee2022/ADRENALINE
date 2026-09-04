/**
 * @file client/src/lib/native.ts
 * @description ما يختلف داخل تطبيق المتجر (Capacitor / WKWebView) عن المتصفح — في مكان واحد.
 *
 *   داخل التطبيق الأصلي على iOS:
 *   - window.location.origin = "capacitor://localhost" → أي رابط يُبنى منه ويُرسل
 *     لعميل (جدول الخطة، تتبّع السائق، عودة الدفع) يكون مكسوراً. نستخدم publicOrigin().
 *   - <a download> و createObjectURL لا ينزّلان شيئاً → downloadBlob تكتب الملف
 *     في ذاكرة التطبيق وتفتح ورقة المشاركة (حفظ في الملفات / واتساب…).
 *   - window.print() لا يعمل إطلاقاً → printCurrentPage تستخدم حوار الطباعة الأصلي.
 *   - location.href = "https://wa.me/…" يبدّل واجهة التطبيق بصفحة الويب بلا زر رجوع
 *     → openExternal تفتحه في المتصفح/التطبيق الخارجي.
 */

const SITE_ORIGIN = "https://adrenalinehealthy.com";

/** هل نعمل داخل تطبيق المتجر (Capacitor) لا متصفح عادي؟ */
export function isNativeShell(): boolean {
  try {
    return Boolean((window as any).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/** أصل الروابط العامة: دومين الموقع داخل التطبيق، وعنوان المتصفح خارجه. */
export function publicOrigin(): string {
  if (typeof window === "undefined") return SITE_ORIGIN;
  return isNativeShell() ? SITE_ORIGIN : window.location.origin;
}

/** فتح رابط خارجي (واتساب، خرائط…) بلا مغادرة واجهة التطبيق. */
export function openExternal(url: string): void {
  if (isNativeShell()) {
    // Capacitor يفتح _blank في المتصفح/التطبيق الخارجي (سفاري → واتساب)
    window.open(url, "_blank");
  } else {
    window.location.href = url;
  }
}

/** طباعة الصفحة الحالية — حوار iOS الأصلي داخل التطبيق، window.print خارجه. */
export async function printCurrentPage(): Promise<void> {
  if (!isNativeShell()) {
    window.print();
    return;
  }
  try {
    const { Printer } = await import("@capgo/capacitor-printer");
    await Printer.printWebView({});
  } catch {
    try { window.print(); } catch { /* لا شيء */ }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.readAsDataURL(blob);
  });
}

/**
 * تنزيل ملف (CSV/صورة…) — في المتصفح رابط download عادي؛ داخل التطبيق يُكتب
 * الملف في ذاكرة التطبيق المؤقتة ثم تُفتح ورقة المشاركة ليحفظه المستخدم أو يرسله.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isNativeShell()) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import("@capacitor/filesystem"),
        import("@capacitor/share"),
      ]);
      const data = await blobToBase64(blob);
      const written = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
      await Share.share({ title: filename, url: written.uri });
      return;
    } catch (e: any) {
      if (e?.message && /cancel/i.test(String(e.message))) return;
      // نكمل بالطريقة العادية — قد تعمل على أندرويد
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
