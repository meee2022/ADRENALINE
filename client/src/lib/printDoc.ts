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
    alert(
      isRtl
        ? "المتصفح منع النافذة المنبثقة — اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة."
        : "Pop-up blocked — allow pop-ups for this site, then try again.",
    );
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
  // مهلة بسيطة تسمح للخطوط والتخطيط يستقروا قبل ما تتفتح شاشة الطباعة.
  if (autoPrint) setTimeout(() => { try { w.print(); } catch { /* المستخدم يطبع يدوياً */ } }, 350);
  return true;
}
