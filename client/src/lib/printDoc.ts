/**
 * @file client/src/lib/printDoc.ts
 * @description فتح مستند للطباعة/الحفظ كـ PDF — المصدر الوحيد لكل تقارير النظام.
 *
 *   ═══ ليه طباعة المتصفح وليس html2pdf؟ ═══
 *   html2pdf/html2canvas بيرسم النص كصورة فبيكسّر تشكيل العربي ويقطّع الحروف
 *   (اتشال في 5cc82ba و10e931b لنفس السبب). محرك المتصفح بيشكّل العربي والاتجاهين
 *   صح 100% وبيدي PDF نصّي قابل للبحث والنسخ — أنضف للمدير.
 *
 *   ═══ اسم ملف الـPDF ═══
 *   المتصفح بياخد اسم ملف الـPDF الافتراضي من <title> المستند، فبنمرّر fileName
 *   وبنحقنه كـ<title> — كده المدير يلاقي "تقرير-مبيعات-المنافذ-…" مش "document".
 */

import { alertDialog } from "./dialogs";

/** ينظّف اسم الملف من المحارف الممنوعة في ويندوز/ماك. */
export function safeFileName(s: string): string {
  return String(s || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "report";
}

export type PrintDocOptions = {
  /** اسم ملف الـPDF المقترح — يُحقن كـ<title> (المتصفح يستخدمه كاسم افتراضي). */
  fileName?: string;
  /** false لو الـHTML بيطبع نفسه (مثلاً بعد تحميل الصور). */
  autoPrint?: boolean;
  /** مقاس نافذة المعاينة — التقارير العريضة تحتاج أوسع. */
  width?: number;
  height?: number;
  isRtl?: boolean;
  /** ترقيم صفحات «صفحة N» أسفل كل ورقة (افتراضي: مفعّل). */
  pageNumbers?: boolean;
};

/**
 * ✅ ترقيم موحّد لكل التقارير عبر صندوق هامش @page (كروم 131+).
 *    نستخدم counter(page) فقط — counter(pages) «من N» غير مدعوم بثبات في كروم،
 *    ووجوده داخل content يُبطل السطر كله فلا يظهر أي ترقيم (سبب الشكوى الأصلي).
 */
function pageNumberStyle(isRtl: boolean): string {
  const label = isRtl ? "صفحة" : "Page";
  return `<style>@page{@bottom-center{content:"${label} " counter(page);` +
    `font-family:'Tajawal','Cairo','Segoe UI',Tahoma,sans-serif;font-size:10px;font-weight:700;color:#64748b;}}</style>`;
}

/**
 * يفتح المستند في نافذة ويشغّل الطباعة → المستخدم يختار "حفظ كـPDF".
 * يرجّع false لو الـpop-up اتمنع (المُنادي يقدر يتصرّف).
 */
export function openPrintDoc(html: string, opts: PrintDocOptions = {}): boolean {
  const { fileName, autoPrint = true, width = 1000, height = 900, isRtl = true, pageNumbers = true } = opts;

  // اسم ملف الـPDF = <title>. نستبدل العنوان الموجود بدل ما نضيف تاني.
  let doc = html;
  if (fileName) {
    const safe = safeFileName(fileName);
    const esc = safe.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    doc = /<title>[\s\S]*?<\/title>/i.test(doc)
      ? doc.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc}</title>`)
      : doc.replace(/<head>/i, `<head><title>${esc}</title>`);
  }

  // ✅ ترقيم الصفحات — يُحقن آخر <head> فيتغلّب على أي @bottom-center سابق في المستند.
  if (pageNumbers) {
    const st = pageNumberStyle(isRtl);
    doc = /<\/head>/i.test(doc) ? doc.replace(/<\/head>/i, `${st}</head>`) : st + doc;
  }

  /* ═══ تطبيق المتجر (Capacitor/WKWebView) ═══
     window.open("") بيرجّع null جوّه التطبيق الأصلي — مفيش نوافذ منبثقة أصلاً —
     فكان بيطلع «المتصفح منع النافذة المنبثقة» على الآيفون. الحل: نرسم المستند في
     iframe مخفي داخل الصفحة نفسها ونطبع منه؛ نفس الحيلة تنقذ المتصفح العادي لو
     المستخدم مانع النوافذ المنبثقة. */
  if (isNativeShell()) {
    void printNative(doc, fileName, autoPrint);
    return true;
  }

  const w = window.open("", "_blank", `width=${width},height=${height}`);
  if (!w) {
    if (printViaIframe(doc, autoPrint)) return true;
    void alertDialog({
      message: isRtl
        ? "المتصفح منع النافذة المنبثقة — اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة."
        : "Pop-up blocked — allow pop-ups for this site, then try again.",
    });
    return false;
  }

  w.document.write(doc);
  w.document.close();
  w.focus();
  if (autoPrint) waitForImagesThenPrint(w);
  return true;
}

/**
 * داخل تطبيق المتجر: window.print() لا يعمل إطلاقاً في WKWebView على iOS، فنستخدم
 * حوار الطباعة الأصلي (@capgo/capacitor-printer) — منه يطبع أو يحفظ PDF ويشاركه.
 * لو الإضافة غير متاحة (نسخة قديمة من التطبيق) نرجع لطريقة الإطار.
 */
async function printNative(doc: string, fileName: string | undefined, autoPrint: boolean): Promise<void> {
  try {
    const { Printer } = await import("@capgo/capacitor-printer");
    await Printer.printHtml({ html: doc, name: fileName ? safeFileName(fileName) : undefined });
  } catch {
    if (!printViaIframe(doc, autoPrint)) {
      void alertDialog({ message: "تعذّر فتح الطباعة داخل التطبيق — افتح الصفحة من المتصفح وأعد المحاولة." });
    }
  }
}

/** هل نعمل داخل تطبيق المتجر (Capacitor) لا متصفح عادي؟ */
function isNativeShell(): boolean {
  try {
    return Boolean((window as any).Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/**
 * طباعة من iframe مخفي في الصفحة الحالية — بديل النافذة المنبثقة.
 * المستند نفسه (بعنوانه وترقيمه) يُكتب داخل الإطار؛ لو المستند بيطبع نفسه
 * (autoPrint=false) فسكربته بيشتغل داخل الإطار عادي. الإطار يُزال بعد الطباعة.
 */
function printViaIframe(doc: string, autoPrint: boolean): boolean {
  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);
    const fw = iframe.contentWindow;
    const fd = fw?.document;
    if (!fw || !fd) { iframe.remove(); return false; }
    fd.open();
    fd.write(doc);
    fd.close();
    const cleanup = () => setTimeout(() => iframe.remove(), 1000);
    fw.addEventListener("afterprint", cleanup);
    setTimeout(cleanup, 5 * 60 * 1000); // احتياطي لو ما وصلش afterprint
    if (autoPrint) waitForImagesThenPrint(fw);
    return true;
  } catch {
    return false;
  }
}

/**
 * ⚠️ لازم ننتظر الصور (الشعار في ترويسة التقارير) قبل الطباعة — لو اتفتحت
 *    شاشة الطباعة والصورة لسه بتحمّل بيطلع الـPDF بشعار ناقص.
 *    مهلة احتياطية 3ث لو صورة اتعلّقت، عشان ما نستناش للأبد.
 */
function waitForImagesThenPrint(w: Window): void {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    // مهلة بسيطة كمان تسمح للخطوط والتخطيط يستقروا بعد آخر صورة.
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* المستخدم يطبع يدوياً */ } }, 250);
  };

  const start = () => {
    const imgs = Array.from(w.document.images || []);
    const pending = imgs.filter((i) => !i.complete);
    if (pending.length === 0) { go(); return; }
    let left = pending.length;
    const dec = () => { if (--left <= 0) go(); };
    pending.forEach((i) => { i.addEventListener("load", dec); i.addEventListener("error", dec); });
    setTimeout(go, 3000); // احتياطي
  };

  // document.write متزامن، فالصور موجودة في الـDOM دلوقتي.
  start();
}
