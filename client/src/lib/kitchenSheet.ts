/**
 * @file client/src/lib/kitchenSheet.ts
 * @description تصدير كشف المطبخ اليومي — مصفوفة صف لكل عميل بوجباته في أعمدة،
 *   بنفس فكرة ملف الإكسيل اليومي (SHEET + CUSTOMIZED).
 *
 *   صيغتان (المطبخ يختار):
 *     - Excel (.xlsx) عبر xlsx-js-style — بحدود وتنسيق (SheetJS المجاني بلا حدود).
 *     - PDF عبر طباعة المتصفح الأصلية (نافذة طباعة) — عربي سليم بلا html2canvas.
 *
 *   يدعم لغتين: عند الإنجليزية تخرج كل اللافتات إنجليزية (أسماء الوجبات تُبنى
 *   بلغة العرض في Kitchen.tsx قبل تمريرها هنا).
 */

import { openPrintDoc } from "./printDoc";

export type KitchenPerson = {
  no: number;
  restaurantKey: "ADRENALINE" | "NUTRI_RESET";
  phone: string;
  name: string;
  /** "28-6 END 25-7" */
  dates: string;
  /** الهدف/البرنامج: BULK / FITNESS / DIET / CUSTOM… */
  remarks: string;
  allergies: string;
  breakfast: string;
  snack1: string;
  lunch: string;
  snack2: string;
  dinner: string;
  meal4: string;
  /** MORNING / EVENING */
  time: string;
  /** خطة مخصّصة → تذهب لشيت CUSTOMIZED */
  customized: boolean;
};

export type Lang = "ar" | "en";

const HEADERS = [
  "NO.", "Phone", "Customer Name", "Restaurant", "START/LAST Day", "Remarks",
  "Allergies & Dislikes", "Breakfast", "SNACK 1", "LUNCH", "SNACK 2",
  "DINNER", "MEAL 4", "Time",
];

const T = (lang: Lang) => ({
  title: lang === "ar" ? "كشف المطبخ اليومي" : "Daily Kitchen Sheet",
  date: lang === "ar" ? "تاريخ" : "Date",
  customers: lang === "ar" ? "عميل" : "customers",
  standard: lang === "ar" ? "الخطط القياسية" : "Standard Plans",
  customizedSec: lang === "ar" ? "الخطط المخصّصة" : "Customized Plans",
  morning: lang === "ar" ? "صباحي" : "Morning",
  evening: lang === "ar" ? "مسائي" : "Evening",
});

const timeLabel = (t: string, lang: Lang) =>
  t === "MORNING" ? T(lang).morning : T(lang).evening;

const rowArray = (p: KitchenPerson, lang: Lang): (string | number)[] => [
  p.no, p.phone, p.name, p.restaurantKey === "NUTRI_RESET" ? "NUTRI RESET" : "ADRENALINE", p.dates, p.remarks, p.allergies,
  p.breakfast, p.snack1, p.lunch, p.snack2, p.dinner, p.meal4, timeLabel(p.time, lang),
];

/* ───────────────────────── Excel (بحدود وتنسيق) ───────────────────────── */

export async function downloadKitchenXlsx(dateStr: string, people: KitchenPerson[], lang: Lang = "ar"): Promise<void> {
  const XLSX = (await import("xlsx-js-style")).default as any;
  const std = people.filter((p) => !p.customized);
  const cust = people.filter((p) => p.customized);

  const border = {
    top: { style: "thin", color: { rgb: "B9C7D6" } },
    bottom: { style: "thin", color: { rgb: "B9C7D6" } },
    left: { style: "thin", color: { rgb: "B9C7D6" } },
    right: { style: "thin", color: { rgb: "B9C7D6" } },
  };
  const headerStyle = {
    fill: { fgColor: { rgb: "0E76AC" } },
    font: { color: { rgb: "FFFFFF" }, bold: true, sz: 10 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border,
  };
  const titleStyle = { font: { bold: true, sz: 13, color: { rgb: "0E2A4A" } } };
  const cellStyle = { alignment: { vertical: "top", wrapText: true }, border, font: { sz: 10 } };
  const altStyle = { ...cellStyle, fill: { fgColor: { rgb: "F5F9FC" } } };

  const cols = [
    { wch: 5 }, { wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 16 }, { wch: 12 }, { wch: 24 },
    { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 10 },
  ];

  const mkSheet = (rows: KitchenPerson[], sectionTitle: string) => {
    const aoa: (string | number)[][] = [
      [`${T(lang).title} — ${dateStr}${sectionTitle ? ` — ${sectionTitle}` : ""}`],
      HEADERS,
      ...rows.map((p) => rowArray(p, lang)),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = cols;
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } }];

    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { t: "s", v: "" };
        if (r === 0) ws[ref].s = titleStyle;
        else if (r === 1) ws[ref].s = headerStyle;
        else ws[ref].s = (r % 2 === 0) ? cellStyle : altStyle;
      }
      if (r >= 2) {
        const restaurantRef = XLSX.utils.encode_cell({ r, c: 3 });
        const isNutriReset = ws[restaurantRef]?.v === "NUTRI RESET";
        ws[restaurantRef].s = {
          ...ws[restaurantRef].s,
          fill: { fgColor: { rgb: isNutriReset ? "E8F8F7" : "EAF8FD" } },
          font: { bold: true, sz: 9, color: { rgb: isNutriReset ? "087E87" : "0E76AC" } },
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border,
        };
      }
    }
    ws["!rows"] = [{ hpt: 22 }, { hpt: 20 }];
    return ws;
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, mkSheet(std, T(lang).standard), "SHEET");
  if (cust.length) XLSX.utils.book_append_sheet(wb, mkSheet(cust, T(lang).customizedSec), "CUSTOMIZED");

  XLSX.writeFile(wb, `ADRENALINE-kitchen-${dateStr}.xlsx`);
}

/* ───────────────────────── PDF ───────────────────────── */

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));

/* أعمدة الورقة المطبوعة (A4 بالطول): الهاتف والتواريخ والبرنامج والوردية
   أسطرٌ صغيرة تحت الاسم في خانة واحدة — أربعة أعمدة وفّرناها لأعمدة الوجبات.
   الإكسل يحتفظ بأعمدته الثلاثة عشر كاملة (HEADERS) — الفرز هناك يحتاجها. */
const PRINT_HEADERS = [
  "NO.", "Customer", "Restaurant", "Allergies & Dislikes",
  "Breakfast", "SNACK 1", "LUNCH", "SNACK 2", "DINNER", "MEAL 4",
];

function tableHtml(title: string, rows: KitchenPerson[], lang: Lang): string {
  if (!rows.length) return "";
  const head = PRINT_HEADERS.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map(
      (p) => `<tr>
      <td class="c">${p.no}</td>
      <td class="cust"><b>${esc(p.name)}</b><span class="ph" dir="ltr">${esc(p.phone)}</span><span class="dt">${esc(p.dates)}</span><span class="tg">${esc(p.remarks)}${p.remarks ? " · " : ""}${esc(timeLabel(p.time, lang))}</span></td>
      <td class="restaurant"><span class="restaurant-tag ${p.restaurantKey === "NUTRI_RESET" ? "nutri" : "adrenaline"}">${p.restaurantKey === "NUTRI_RESET" ? "NUTRI RESET" : "ADRENALINE"}</span></td>
      <td class="al">${esc(p.allergies)}</td>
      <td>${esc(p.breakfast)}</td>
      <td>${esc(p.snack1)}</td>
      <td>${esc(p.lunch)}</td>
      <td>${esc(p.snack2)}</td>
      <td>${esc(p.dinner)}</td>
      <td class="m4">${esc(p.meal4)}</td>
    </tr>`,
    )
    .join("");
  return `<section class="sec">
    <div class="sec-t">${esc(title)} <span>${rows.length} ${esc(T(lang).customers)}</span></div>
    <table><colgroup><col style="width:6mm"><col style="width:27mm"><col style="width:18mm"><col style="width:23mm"><col><col><col><col><col><col style="width:16mm"></colgroup>
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </section>`;
}

export async function downloadKitchenPdf(
  dateStr: string,
  people: KitchenPerson[],
  lang: Lang = "ar",
  /** أسطر تحذير التطابق مع الاستيكرات — تُطبع أعلى الورقة قبل أي شيء. */
  auditLines: string[] = [],
): Promise<void> {
  const std = people.filter((p) => !p.customized);
  const cust = people.filter((p) => p.customized);
  const tr = T(lang);
  const dir = lang === "ar" ? "rtl" : "ltr";

  // ✅ نطبع عبر محرك المتصفح (لا html2canvas): يشكّل العربي صحيحاً بلا تقطيع
  //    ولا فقدان نص — نفس التصميم تماماً، والمستخدم يحفظ كـ PDF (أفقي A4).
  const html = `<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8">
    <meta name="viewport" content="width=1120">
    <title>ADRENALINE-kitchen-${esc(dateStr)}</title>
    <style>
      *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
      html,body{margin:0;padding:0}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
      .kp-doc{color:#0E2A4A;background:#fff}
      .kp-hero{background:linear-gradient(120deg,#0E2A4A,#0E76AC);color:#fff;padding:16px 20px;
               display:flex;justify-content:space-between;align-items:flex-end}
      .kp-hero .brand{font-size:19px;font-weight:900;letter-spacing:.12em}
      .kp-hero .brand small{display:block;font-size:8px;letter-spacing:.35em;opacity:.85;font-weight:700}
      .kp-hero h1{font-size:16px;margin:0;font-weight:900}
      .kp-hero .sub{font-size:11px;opacity:.9;font-weight:700;margin-top:2px}
      .kp-wrap{padding:12px 16px}
      .sec{margin-bottom:14px}
      .sec-t{font-weight:900;font-size:13px;color:#0E2A4A;background:#eaf3fb;border:1px solid #cfe4f3;
             border-radius:8px;padding:6px 10px;margin-bottom:6px}
      .sec-t span{float:${lang === "ar" ? "left" : "right"};color:#0E76AC;font-size:11px}
      table{width:100%;border-collapse:collapse;font-size:9.5px;table-layout:fixed}
      th{background:#0E76AC;color:#fff;padding:4px 2px;font-weight:800;border:1px solid #0b5f8a;font-size:8.5px}
      td{padding:3.5px 4px;border:1px solid #cfd9e4;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;line-height:1.3}
      tr:nth-child(even) td{background:#f7fbfe}
      .c{text-align:center;font-weight:900;color:#0E76AC}
      .cust b{display:block;font-size:10px}
      .cust .ph{display:block;font-size:8.5px;color:#475569}
      .cust .dt{display:block;font-size:8px;color:#0E76AC;font-weight:700}
      .cust .tg{display:block;font-size:8px;font-weight:900;color:#7c3aed}
      .restaurant{text-align:center;vertical-align:middle;padding:3px 2px}
      .restaurant-tag{display:inline-block;border-radius:4px;padding:3px 4px;font-size:7.5px;font-weight:900;line-height:1.15}
      .restaurant-tag.nutri{background:#e8f8f7;color:#087e87;border:1px solid #8ed8d5}
      .restaurant-tag.adrenaline{background:#eaf8fd;color:#0e76ac;border:1px solid #b9e6f5}
      .al{color:#b45309;font-size:9px;font-weight:800}
      .m4{font-size:9px}
      .foot{margin:6px 16px 12px;font-size:11px;color:#94a3b8;text-align:center}
      .audit-warn{background:#fff1f2;border:2px solid #e11d48;border-radius:8px;padding:7px 11px;
        margin:0 0 9px;font-size:11px;font-weight:800;color:#9f1239;line-height:1.7}
      /* ✅ ترقيم الصفحات داخل نفس قاعدة @page — كروم لا يدمج قاعدتَي @page منفصلتين،
             فالاعتماد على حقن openPrintDoc (قاعدة ثانية) كان يُتجاهَل فلا يظهر رقم. */
      @page{ size:A4 portrait; margin:6mm 6mm 12mm 6mm;
        @bottom-center{content:"${lang === "ar" ? "صفحة" : "Page"} " counter(page);
          font-family:'Cairo','Segoe UI',Tahoma,sans-serif;font-size:9px;font-weight:700;color:#64748b;} }
      /* fallback للمتصفحات اللي مش بتدعم @page counters — سطر ثابت في الفوتر */
      @media print{
        /* ✅ الجدول الكبير يتدفّق عبر الصفحات بدءاً من الصفحة الأولى مباشرة —
           break-inside:avoid على القسم كله كان يزقّه لصفحة جديدة ويترك الأولى فاضية.
           نمنع الكسر داخل الصف الواحد فقط، والرأس يتكرر أعلى كل صفحة تلقائياً. */
        .sec{break-inside:auto}
        .sec-t{break-after:avoid;break-inside:avoid}
        tr{break-inside:avoid}
        thead{display:table-header-group}
        .page-num{display:block}
      }
      .page-num{display:none;font-size:9px;color:#94a3b8;text-align:center;margin-top:6px}
    </style></head><body>
    <div class="kp-doc" dir="${dir}">
      <div class="kp-hero">
        <div class="brand">ADRENALINE<small>HEALTHY FOOD</small></div>
        <div style="text-align:${lang === "ar" ? "end" : "start"}">
          <h1>${esc(tr.title)}</h1>
          <div class="sub">${esc(tr.date)}: ${esc(dateStr)} · ${people.length} ${esc(tr.customers)}</div>
        </div>
      </div>
      <div class="kp-wrap">
        ${auditLines.length ? `<div class="audit-warn">${auditLines.map(esc).join("<br/>")}</div>` : ""}
        ${tableHtml(tr.standard, std, lang)}
        ${tableHtml(tr.customizedSec, cust, lang)}
      </div>
      <div class="foot">ADRENALINE Healthy Food — ${esc(tr.title)} ${esc(dateStr)}</div>
    </div>
    </body></html>`;

  openPrintDoc(html, {
    fileName: `ADRENALINE-kitchen-${dateStr}`,
    isRtl: lang === "ar",
    width: 860,
    height: 980,
    // الترقيم مُعرّف داخل @page الخاصة بالكشف — نوقف الحقن كي لا تتضارب قاعدتا @page
    pageNumbers: false,
  });
}

/* ─────────────── كشف الشيف (Chef Production Sheet) — Excel بنفس ألوانه ─────────────── */

/**
 * صف واحد في كشف الشيف. `kind` يحدّد التنسيق فقط، والألوان مطابقة لألوان
 * الطباعة حرفياً حتى يقرأ المطبخ الورقة والملف بنفس العين.
 */
export type ChefRow = {
  kind: "section" | "head" | "dish" | "standard" | "modified" | "total" | "customer" | "allergy" | "meal" | "notset";
  cells: (string | number)[];
};

const CHEF_BODY_FONT_SIZE = 10;
const CHEF_TEXT_WIDTH_CHARS = 73;

/**
 * Excel does not automatically expand wrapped rows written by SheetJS,
 * especially when the description cell is merged. Estimate the rendered
 * line count so long allergy/modification notes never overlap the next row.
 */
export function chefRowHeight(kind: ChefRow["kind"], value: string | number): number {
  const minimum = kind === "modified" ? 29
    : kind === "section" ? 22
    : kind === "dish" || kind === "customer" ? 21
    : kind === "head" || kind === "total" ? 20
    : 18;

  if (kind === "section" || kind === "head" || kind === "total") return minimum;

  const text = String(value ?? "");
  const lines = text.split(/\r?\n/).reduce((count, line) => {
    // Wide Latin capitals occupy slightly more space than the nominal Excel
    // character width, so keep a conservative allowance for kitchen notes.
    const visualLength = Array.from(line).reduce(
      (length, char) => length + (/[A-Z]/.test(char) ? 1.08 : 1),
      0,
    );
    return count + Math.max(1, Math.ceil(visualLength / CHEF_TEXT_WIDTH_CHARS));
  }, 0);

  const wrappedHeight = 8 + lines * (CHEF_BODY_FONT_SIZE + 5);
  return Math.max(minimum, Math.min(92, wrappedHeight));
}

const CHEF_COLORS: Record<ChefRow["kind"], { bg?: string; fg: string; bold: boolean }> = {
  section:  { bg: "0D3B5F", fg: "FFFFFF", bold: true },   // كحلي — رأس القسم
  head:     { bg: "E9F2F7", fg: "54738A", bold: true },   // رمادي فاتح — أسماء الأعمدة
  dish:     { bg: "ACD5EC", fg: "10283F", bold: true },   // سماوي — اسم الطبق
  standard: { fg: "10283F", bold: false },
  modified: { bg: "FFF9EB", fg: "B45309", bold: true },   // برتقالي — تعديل
  total:    { bg: "FFE082", fg: "10283F", bold: true },
  customer: { bg: "D8EDF8", fg: "10283F", bold: true },
  allergy:  { bg: "FFF0F0", fg: "B91C1C", bold: true },   // أحمر — حساسية
  meal:     { fg: "10283F", bold: false },
  notset:   { bg: "FFF7ED", fg: "C2410C", bold: true },
};

/** كشف الشيف كملف Excel — نفس الصفوف والألوان، وقابل للفرز والملاحظات. */
export async function downloadChefSheetXlsx(
  dateStr: string,
  rows: ChefRow[],
  kpis: Array<{ label: string; value: number }>,
  restaurantSources?: { adrenaline: number; nutriReset: number },
): Promise<void> {
  const XLSX = (await import("xlsx-js-style")).default as any;
  const thin = { style: "thin", color: { rgb: "9CB2C2" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  const baseStyle = (kind: ChefRow["kind"]): any => {
    const c = CHEF_COLORS[kind];
    return {
      font: { name: "Arial", bold: c.bold, color: { rgb: c.fg }, sz: kind === "section" ? 12 : CHEF_BODY_FONT_SIZE },
      border,
      alignment: {
        vertical: kind === "section" || kind === "head" ? "center" : "top",
        wrapText: true,
      },
      fill: { patternType: "solid", fgColor: { rgb: c.bg || "FFFFFF" } },
    };
  };
  const cell = (v: string | number, s: any) => ({ v, s });
  const centered = (s: any) => ({ ...s, alignment: { ...s.alignment, horizontal: "center", vertical: "center" } });
  const qtyStyle = (s: any, dish = false) => ({
    ...centered(s),
    font: { ...s.font, bold: true, sz: 11, color: { rgb: dish ? "10283F" : "DC2626" } },
  });

  // Six physical columns let the three KPI cards remain equal while preserving
  // the PDF's four logical table columns.
  const aoa: any[][] = Array.from({ length: 7 }, () => Array(6).fill(null));
  const merges: any[] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
    { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
    { s: { r: 4, c: 2 }, e: { r: 4, c: 3 } },
    { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
    { s: { r: 5, c: 2 }, e: { r: 5, c: 3 } },
    { s: { r: 5, c: 4 }, e: { r: 5, c: 5 } },
  ];
  const titleStyle = {
    font: { name: "Arial", bold: true, sz: 16, color: { rgb: "0D3B5F" } },
    fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
    alignment: { vertical: "center" },
    border: { bottom: { style: "medium", color: { rgb: "28B7E1" } } },
  };
  const metaStyle = {
    font: { name: "Arial", bold: true, sz: 10, color: { rgb: "54738A" } },
    fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
    alignment: { horizontal: "right", vertical: "center", wrapText: true },
    border: { bottom: { style: "medium", color: { rgb: "28B7E1" } } },
  };
  aoa[0][0] = cell("ADRENALINE · CHEF PRODUCTION SHEET", titleStyle);
  aoa[0][4] = cell("Production date", metaStyle);
  aoa[1][4] = cell(dateStr, { ...metaStyle, font: { ...metaStyle.font, sz: 11 } });
  kpis.slice(0, 3).forEach((k, i) => {
    const col = i * 2;
    const card = { fill: { patternType: "solid", fgColor: { rgb: "F7FBFD" } }, border };
    aoa[3][col] = cell(k.value, { ...card, font: { name: "Arial", bold: true, sz: 17, color: { rgb: "0E76AC" } }, alignment: { vertical: "center" } });
    aoa[4][col] = cell(k.label.toUpperCase(), { ...card, font: { name: "Arial", bold: true, sz: 9, color: { rgb: "54738A" } }, alignment: { vertical: "center" } });
  });
  const sourceBase = {
    border,
    alignment: { horizontal: "center", vertical: "center" },
  };
  aoa[5][0] = cell("ORDER SOURCE", {
    ...sourceBase,
    fill: { patternType: "solid", fgColor: { rgb: "F1F6F9" } },
    font: { name: "Arial", bold: true, sz: 9, color: { rgb: "54738A" } },
  });
  if (restaurantSources?.adrenaline) {
    aoa[5][2] = cell(`ADRENALINE  ·  ${restaurantSources.adrenaline} ${restaurantSources.adrenaline === 1 ? "ORDER" : "ORDERS"}`, {
      ...sourceBase,
      fill: { patternType: "solid", fgColor: { rgb: "E8F6FC" } },
      font: { name: "Arial", bold: true, sz: 9, color: { rgb: "075F8E" } },
    });
  }
  if (restaurantSources?.nutriReset) {
    aoa[5][4] = cell(`NUTRI RESET  ·  ${restaurantSources.nutriReset} ${restaurantSources.nutriReset === 1 ? "ORDER" : "ORDERS"}`, {
      ...sourceBase,
      fill: { patternType: "solid", fgColor: { rgb: "FFF2E7" } },
      font: { name: "Arial", bold: true, sz: 9, color: { rgb: "A84708" } },
    });
  }

  const rowHeights = [22, 22, 7, 25, 19, 20, 7];
  let currentSection = "";
  for (const r of rows) {
    const out = Array(6).fill(null);
    const rowIndex = aoa.length;
    const style = baseStyle(r.kind);
    const isMain = currentSection === "MAIN MEALS";
    const isCustomized = currentSection.startsWith("CUSTOMIZED ORDERS");
    if (r.kind === "section") {
      currentSection = String(r.cells[0] || "");
      out[0] = cell(currentSection, style);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 5 } });
    } else if (r.kind === "head") {
      if (isMain) {
        out[0] = cell(String(r.cells[0] || ""), style);
        out[3] = cell(String(r.cells[1] || "Qty"), centered(style));
        out[4] = cell(String(r.cells[2] || "Carb g"), centered(style));
        out[5] = cell(String(r.cells[3] || "Protein g"), centered(style));
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 2 } });
      } else {
        out[0] = cell(String(r.cells[0] || ""), style);
        out[5] = cell(isCustomized ? "Qty / status" : "Qty", centered(style));
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 4 } });
      }
    } else if (r.kind === "allergy") {
      out[0] = cell(String(r.cells[0] || ""), style);
      if (isCustomized) {
        // Customer-level allergy notice: informational row with no quantity.
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 5 } });
      } else if (isMain) {
        // Aggregated main-meal allergy rows still carry their real quantity
        // and portion columns; never merge over those values.
        out[3] = cell(r.cells[1] ?? "", qtyStyle(style));
        out[4] = cell(r.cells[2] ?? "", centered({ ...style, font: { ...style.font, color: { rgb: "0E76AC" } } }));
        out[5] = cell(r.cells[3] ?? "", centered({ ...style, font: { ...style.font, color: { rgb: "0E76AC" } } }));
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 2 } });
      } else {
        // Breakfast/snack allergy rows use the same quantity column as every
        // other preparation row. The previous full-row merge hid this number.
        out[5] = cell(r.cells[1] ?? "", qtyStyle(style));
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 4 } });
      }
    } else if (r.kind === "customer") {
      out[0] = cell(String(r.cells[0] || ""), style);
      out[5] = cell(String(r.cells[1] || ""), { ...centered(style), font: { ...style.font, color: { rgb: "0E76AC" } } });
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 4 } });
    } else {
      const text = String(r.cells[0] || "").replace(/\s+—\s+/, "\n");
      out[0] = cell(text, style);
      if (isMain && !isCustomized) {
        out[3] = cell(r.cells[1] ?? "", qtyStyle(style, r.kind === "dish" || r.kind === "total"));
        out[4] = cell(r.cells[2] ?? "", centered({ ...style, font: { ...style.font, color: { rgb: "0E76AC" } } }));
        out[5] = cell(r.cells[3] ?? "", centered({ ...style, font: { ...style.font, color: { rgb: "0E76AC" } } }));
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 2 } });
      } else {
        out[5] = cell(r.cells[1] ?? "", qtyStyle(style, r.kind === "dish" || r.kind === "total"));
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 4 } });
      }
    }
    aoa.push(out);
    rowHeights.push(chefRowHeight(r.kind, out[0]?.v ?? r.cells[0] ?? ""));
  }

  const blankStyle = { fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } } };
  for (let ri = 0; ri < aoa.length; ri++) {
    for (let ci = 0; ci < 6; ci++) if (aoa[ri][ci] == null) aoa[ri][ci] = cell("", blankStyle);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  // The first five physical columns form the wide preparation/notes field.
  // Widen it slightly before wrapping to keep the production sheet compact.
  ws["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 11 }, { wch: 11 }, { wch: 13 }];
  ws["!rows"] = rowHeights.map((hpt) => ({ hpt }));

  // Propagate the style through every physical cell of the merged title/date
  // and KPI cards. Excel otherwise renders only part of their border/fill.
  for (const merge of merges.filter((m) => m.e.r <= 4)) {
    const anchorRef = XLSX.utils.encode_cell(merge.s);
    const anchorStyle = ws[anchorRef]?.s;
    if (!anchorStyle) continue;
    for (let ri = merge.s.r; ri <= merge.e.r; ri++) {
      for (let ci = merge.s.c; ci <= merge.e.c; ci++) {
        const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
        ws[ref] = { ...(ws[ref] || { t: "s", v: "" }), s: anchorStyle };
      }
    }
  }

  // xlsx-js-style stores formatting per physical cell. Merged cells therefore
  // need the same fill/border on every cell, not only on their top-left value.
  for (let ri = 7; ri < aoa.length; ri++) {
    const rowKind = rows[ri - 7]?.kind;
    if (!rowKind) continue;
    const rowStyle = baseStyle(rowKind);
    for (let ci = 0; ci < 6; ci++) {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
      const existing = ws[ref] || { t: "s", v: "" };
      ws[ref] = {
        ...existing,
        s: existing.s && existing.v !== ""
          ? { ...rowStyle, ...existing.s, border }
          : rowStyle,
      };
    }
  }
  ws["!freeze"] = { xSplit: 0, ySplit: 7 };
  ws["!margins"] = { left: 0.25, right: 0.25, top: 0.35, bottom: 0.45, header: 0.15, footer: 0.2 };
  ws["!pageSetup"] = { paperSize: 9, orientation: "portrait", fitToWidth: 1, fitToHeight: 0 };
  ws["!printHeader"] = [0, 6];
  ws["!headerFooter"] = { oddFooter: `&LADRENALINE&RPage &P of &N` };
  ws["!sheetViews"] = [{ showGridLines: false }];
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: `Chef production sheet - ${dateStr}`, Subject: "Kitchen production", Author: "ADRENALINE" };
  XLSX.utils.book_append_sheet(wb, ws, "CHEF SHEET");
  XLSX.writeFile(wb, `Chef production sheet - ADRENALINE - ${dateStr}.xlsx`);
}
