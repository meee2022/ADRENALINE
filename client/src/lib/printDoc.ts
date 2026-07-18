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
};

/**
 * يفتح المستند في نافذة ويشغّل الطباعة → المستخدم يختار "حفظ كـPDF".
 * يرجّع false لو الـpop-up اتمنع (المُنادي يقدر يتصرّف).
 */
export function openPrintDoc(html: string, opts: PrintDocOptions = {}): boolean {
  const { fileName, autoPrint = true, width = 1000, height = 900, isRtl = true } = opts;

  const w = window.open("", "_blank", `width=${width},height=${height}`);
  if (!w) {
    void alertDialog({
      message: isRtl
        ? "المتصفح منع النافذة المنبثقة — اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة."
        : "Pop-up blocked — allow pop-ups for this site, then try again.",
    });
    return false;
  }

  // اسم ملف الـPDF = <title>. نستبدل العنوان الموجود بدل ما نضيف تاني.
  let doc = html;
  if (fileName) {
    const safe = safeFileName(fileName);
    const esc = safe.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    doc = /<title>[\s\S]*?<\/title>/i.test(doc)
      ? doc.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc}</title>`)
      : doc.replace(/<head>/i, `<head><title>${esc}</title>`);
  }

  w.document.write(doc);
  w.document.close();
  w.focus();
  if (autoPrint) waitForImagesThenPrint(w);
  return true;
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
