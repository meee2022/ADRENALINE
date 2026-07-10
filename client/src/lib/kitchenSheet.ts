/**
 * @file client/src/lib/kitchenSheet.ts
 * @description تصدير كشف المطبخ اليومي — مصفوفة صف لكل عميل بوجباته في أعمدة،
 *   بنفس فكرة ملف الإكسيل اليومي (SHEET + CUSTOMIZED).
 *
 *   صيغتان (المطبخ يختار):
 *     - Excel (.xlsx) عبر xlsx-js-style — بحدود وتنسيق (SheetJS المجاني بلا حدود).
 *     - PDF مصمّم يتحمّل مباشرةً (لا نافذة طباعة) عبر html2pdf (تحميل ديناميكي).
 *
 *   يدعم لغتين: عند الإنجليزية تخرج كل اللافتات إنجليزية (أسماء الوجبات تُبنى
 *   بلغة العرض في Kitchen.tsx قبل تمريرها هنا).
 */

export type KitchenPerson = {
  no: number;
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
  "NO.", "Phone", "Customer Name", "START/LAST Day", "Remarks",
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
  p.no, p.phone, p.name, p.dates, p.remarks, p.allergies,
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
    { wch: 5 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 24 },
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

function tableHtml(title: string, rows: KitchenPerson[], lang: Lang): string {
  if (!rows.length) return "";
  const head = HEADERS.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map(
      (p) => `<tr>
      <td class="c">${p.no}</td>
      <td class="c" dir="ltr">${esc(p.phone)}</td>
      <td class="nm">${esc(p.name)}</td>
      <td class="c sm">${esc(p.dates)}</td>
      <td class="sm">${esc(p.remarks)}</td>
      <td class="al">${esc(p.allergies)}</td>
      <td>${esc(p.breakfast)}</td>
      <td>${esc(p.snack1)}</td>
      <td>${esc(p.lunch)}</td>
      <td>${esc(p.snack2)}</td>
      <td>${esc(p.dinner)}</td>
      <td>${esc(p.meal4)}</td>
      <td class="c sm">${esc(timeLabel(p.time, lang))}</td>
    </tr>`,
    )
    .join("");
  return `<section class="sec">
    <div class="sec-t">${esc(title)} <span>${rows.length} ${esc(T(lang).customers)}</span></div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </section>`;
}

export async function downloadKitchenPdf(dateStr: string, people: KitchenPerson[], lang: Lang = "ar"): Promise<void> {
  const std = people.filter((p) => !p.customized);
  const cust = people.filter((p) => p.customized);
  const tr = T(lang);
  const dir = lang === "ar" ? "rtl" : "ltr";

  // ⚠️ عنصر مفصول (لا يُلحَق بالصفحة) — html2pdf يُلحقه داخلياً في موضع محايد
  //    فيصوّره html2canvas صحيحاً. إلحاقه على left:-10000px كان ينتج PDF فارغاً.
  const el = document.createElement("div");
  el.style.width = "1120px";
  el.style.background = "#ffffff";
  el.innerHTML = `
    <style>
      .kp-doc *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
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
      table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}
      th{background:#0E76AC;color:#fff;padding:4px 3px;font-weight:800;border:1px solid #0b5f8a;font-size:8.5px}
      td{padding:3px 4px;border:1px solid #cfd9e4;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere}
      tr:nth-child(even) td{background:#f7fbfe}
      .c{text-align:center} .nm{font-weight:800} .sm{font-size:8px;color:#47759c}
      .al{color:#b45309;font-size:8px;font-weight:700}
      .foot{margin:6px 16px 12px;font-size:9px;color:#94a3b8;text-align:center}
    </style>
    <div class="kp-doc" dir="${dir}">
      <div class="kp-hero">
        <div class="brand">ADRENALINE<small>HEALTHY FOOD</small></div>
        <div style="text-align:${lang === "ar" ? "end" : "start"}">
          <h1>${esc(tr.title)}</h1>
          <div class="sub">${esc(tr.date)}: ${esc(dateStr)} · ${people.length} ${esc(tr.customers)}</div>
        </div>
      </div>
      <div class="kp-wrap">
        ${tableHtml(tr.standard, std, lang)}
        ${tableHtml(tr.customizedSec, cust, lang)}
      </div>
      <div class="foot">ADRENALINE Healthy Food — ${esc(tr.title)} ${esc(dateStr)}</div>
    </div>`;

  const html2pdf = (await import("html2pdf.js")).default as any;
  await html2pdf()
    .set({
      margin: 5,
      filename: `ADRENALINE-kitchen-${dateStr}.pdf`,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(el)
    .save();
}
