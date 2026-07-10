/**
 * @file client/src/lib/kitchenSheet.ts
 * @description تصدير كشف المطبخ اليومي — مصفوفة صف لكل عميل بوجباته في أعمدة،
 *   بنفس فكرة ملف الإكسيل اليومي (SHEET + CUSTOMIZED).
 *
 *   صيغتان (المطبخ يختار):
 *     - Excel (.xlsx) عبر SheetJS — الأوثق، قابل للتعديل، عربي مضبوط.
 *     - PDF مصمّم يتحمّل مباشرةً (لا نافذة طباعة) عبر html2pdf (تحميل ديناميكي).
 *
 *   لا صور هنا عمداً: كشف المطبخ نصّي كثيف — الصور تُبطئه وتشتّت الشيف.
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

const STD_HEADERS = [
  "NO.", "Phone", "Customer Name", "START/LAST Day", "Remarks",
  "Allergies & Dislikes", "Breakfast", "SNACK 1", "LUNCH", "SNACK 2",
  "DINNER", "MEAL 4", "Time",
];

const rowArray = (p: KitchenPerson): (string | number)[] => [
  p.no, p.phone, p.name, p.dates, p.remarks, p.allergies,
  p.breakfast, p.snack1, p.lunch, p.snack2, p.dinner, p.meal4, p.time,
];

/* ───────────────────────── Excel ───────────────────────── */

export async function downloadKitchenXlsx(dateStr: string, people: KitchenPerson[]): Promise<void> {
  const XLSX = await import("xlsx");
  const std = people.filter((p) => !p.customized);
  const cust = people.filter((p) => p.customized);

  const wb = XLSX.utils.book_new();

  const mkSheet = (title: string, rows: KitchenPerson[]) => {
    const aoa: (string | number)[][] = [
      [`FOOD FOR DATE ${dateStr}${title === "CUSTOMIZED" ? " — CUSTOMIZED" : ""}`],
      STD_HEADERS,
      ...rows.map(rowArray),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 26 },
      { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 10 },
    ];
    return ws;
  };

  XLSX.utils.book_append_sheet(wb, mkSheet("SHEET", std), "SHEET");
  if (cust.length) XLSX.utils.book_append_sheet(wb, mkSheet("CUSTOMIZED", cust), "CUSTOMIZED");

  XLSX.writeFile(wb, `ADRENALINE-kitchen-${dateStr}.xlsx`);
}

/* ───────────────────────── PDF ───────────────────────── */

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));

function tableHtml(title: string, rows: KitchenPerson[]): string {
  if (!rows.length) return "";
  const head = STD_HEADERS.map((h) => `<th>${esc(h)}</th>`).join("");
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
      <td class="c sm">${p.time === "MORNING" ? "صباحي" : "مسائي"}</td>
    </tr>`,
    )
    .join("");
  return `<section class="sec">
    <div class="sec-t">${esc(title)} <span>${rows.length} عميل</span></div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </section>`;
}

export async function downloadKitchenPdf(dateStr: string, people: KitchenPerson[]): Promise<void> {
  const std = people.filter((p) => !p.customized);
  const cust = people.filter((p) => p.customized);

  const el = document.createElement("div");
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
      .sec-t span{float:left;color:#0E76AC;font-size:11px}
      table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}
      th{background:#0E76AC;color:#fff;padding:4px 3px;font-weight:800;border:1px solid #0b5f8a;font-size:8.5px}
      td{padding:3px 4px;border:1px solid #dbe6ef;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere}
      tr:nth-child(even) td{background:#f7fbfe}
      .c{text-align:center} .nm{font-weight:800} .sm{font-size:8px;color:#47759c}
      .al{color:#b45309;font-size:8px;font-weight:700}
      .foot{margin:6px 16px 12px;font-size:9px;color:#94a3b8;text-align:center}
    </style>
    <div class="kp-doc">
      <div class="kp-hero">
        <div class="brand">ADRENALINE<small>HEALTHY FOOD</small></div>
        <div style="text-align:end">
          <h1>كشف المطبخ اليومي</h1>
          <div class="sub">تاريخ: ${esc(dateStr)} · ${people.length} عميل</div>
        </div>
      </div>
      <div class="kp-wrap">
        ${tableHtml("الخطط القياسية", std)}
        ${tableHtml("الخطط المخصّصة", cust)}
      </div>
      <div class="foot">ADRENALINE Healthy Food — كشف المطبخ ${esc(dateStr)}</div>
    </div>`;

  const html2pdf = (await import("html2pdf.js")).default as any;
  await html2pdf()
    .set({
      margin: 6,
      filename: `ADRENALINE-kitchen-${dateStr}.pdf`,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(el)
    .save();
}
