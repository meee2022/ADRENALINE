/**
 * @file client/src/lib/printMealPlan.ts
 * @description طباعة/تصدير PDF لجدول وجبات المشترك — منطق مشترك بين:
 *   - مراجعة الطلب (OrderReviewDetail): جدول 4 أسابيع لعميل واحد
 *   - المراجعة النهائية لليوم (PlansReview): كل العملاء ليوم واحد
 *   - صفحة المشتركين (Customers): جدول مشترك واحد عبر الفترة
 *
 * لا مكتبة PDF: نفتح نافذة طباعة بهوية أدرينالين ونترك المتصفح يحفظ PDF.
 * (نفس أسلوب تقرير الحضور الشهري في Attendance.tsx)
 */

export type MealRow = {
  /** العمود الأول: التاريخ أو اليوم أو رقم الوجبة */
  label: string;
  category?: string;
  meal: string;
  /** ممنوعات/تفضيلات/كميات — كل ما يحتاج الشيف رؤيته */
  notes?: string;
  calories?: number | string;
  price?: number | string;
};

export type MealGroup = {
  title: string;
  subtitle?: string;
  rows: MealRow[];
};

export type PrintMealPlanInput = {
  /** عنوان المستند، مثل "جدول وجبات — محمد إبراهيم" */
  title: string;
  /** سطر تحت العنوان: الهاتف/الباقة/التاريخ */
  subtitle?: string;
  /** بطاقات أرقام أعلى الجدول */
  kpis?: { label: string; value: string | number }[];
  groups: MealGroup[];
  /** إظهار عمودي السعرات/السعر (يُخفيان تلقائياً لو لا توجد بيانات) */
  showCalories?: boolean;
  showPrice?: boolean;
};

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m] as string));

export function printMealPlan(input: PrintMealPlanInput): void {
  const groups = input.groups.filter((g) => g.rows.length > 0);
  if (groups.length === 0) {
    alert("لا توجد وجبات لطباعتها");
    return;
  }

  const showCal = input.showCalories ?? groups.some((g) => g.rows.some((r) => r.calories != null && r.calories !== ""));
  const showPrice = input.showPrice ?? groups.some((g) => g.rows.some((r) => r.price != null && r.price !== ""));
  const hasNotes = groups.some((g) => g.rows.some((r) => (r.notes || "").trim()));
  const hasCategory = groups.some((g) => g.rows.some((r) => (r.category || "").trim()));

  const headCells = [
    "<th style='width:88px'>#</th>",
    hasCategory ? "<th style='width:90px'>الصنف</th>" : "",
    "<th>الوجبة</th>",
    hasNotes ? "<th>ملاحظات / تعديلات</th>" : "",
    showCal ? "<th style='width:70px'>سعرات</th>" : "",
    showPrice ? "<th style='width:80px'>السعر</th>" : "",
  ].join("");

  const groupsHtml = groups
    .map((g) => {
      const body = g.rows
        .map(
          (r) => `<tr>
            <td class="c b">${esc(r.label)}</td>
            ${hasCategory ? `<td class="c cat">${esc(r.category || "-")}</td>` : ""}
            <td class="meal">${esc(r.meal)}</td>
            ${hasNotes ? `<td class="note">${esc(r.notes || "")}</td>` : ""}
            ${showCal ? `<td class="c">${esc(r.calories ?? "")}</td>` : ""}
            ${showPrice ? `<td class="c">${esc(r.price ?? "")}</td>` : ""}
          </tr>`,
        )
        .join("");

      return `<section class="grp">
        <div class="grp-h">
          <span class="grp-t">${esc(g.title)}</span>
          ${g.subtitle ? `<span class="grp-s">${esc(g.subtitle)}</span>` : ""}
          <span class="grp-n">${g.rows.length} وجبة</span>
        </div>
        <table><thead><tr>${headCells}</tr></thead><tbody>${body}</tbody></table>
      </section>`;
    })
    .join("");

  const kpisHtml = (input.kpis || []).length
    ? `<div class="kpis">${(input.kpis || [])
        .map((k) => `<div class="kpi"><div class="v">${esc(k.value)}</div><div class="l">${esc(k.label)}</div></div>`)
        .join("")}</div>`
    : "";

  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>${esc(input.title)}</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;padding:18px;color:#0f1516;font-family:Cairo,Tahoma,Arial,sans-serif}
      h1{font-size:20px;margin:0}
      .sub{color:#47759c;font-weight:700;font-size:13px;margin:2px 0 12px}
      .kpis{display:flex;gap:10px;margin-bottom:14px}
      .kpi{flex:1;border:1px solid #e8eef4;border-radius:10px;padding:8px;text-align:center}
      .kpi .v{font-size:22px;font-weight:900;color:#0E76AC}
      .kpi .l{font-size:11px;color:#47759c;font-weight:700}

      .grp{margin-bottom:16px;break-inside:avoid}
      .grp-h{display:flex;align-items:center;gap:10px;background:#eaf3fb;border:1px solid #cfe4f3;
             border-bottom:none;border-radius:10px 10px 0 0;padding:7px 10px}
      .grp-t{font-weight:900;font-size:14px;color:#0E2A4A}
      .grp-s{font-size:12px;color:#47759c;font-weight:700}
      .grp-n{margin-inline-start:auto;font-size:11px;font-weight:800;color:#0E76AC}

      table{width:100%;border-collapse:collapse;font-size:12.5px}
      th{background:#0E76AC;color:#fff;padding:7px 6px;font-weight:800;border:1px solid #0b5f8a}
      td{padding:6px;border:1px solid #dbe6ef;vertical-align:top}
      tr:nth-child(even) td{background:#f7fbfe}
      .c{text-align:center}
      .b{font-weight:900}
      .meal{font-weight:700}
      .cat{color:#47759c;font-weight:700;font-size:11.5px}
      .note{color:#b45309;font-size:11.5px}

      .foot{margin-top:14px;font-size:10.5px;color:#94a3b8;text-align:center}
      @page{size:A4;margin:12mm}
      @media print{.grp{break-inside:avoid}thead{display:table-header-group}}
    </style></head><body>
    <h1>${esc(input.title)}</h1>
    ${input.subtitle ? `<div class="sub">${esc(input.subtitle)}</div>` : ""}
    ${kpisHtml}
    ${groupsHtml}
    <div class="foot">ADRENALINE Healthy Food — طُبع في ${new Date().toLocaleString("ar-EG")}</div>
    </body></html>`;

  const w = window.open("", "_blank", "width=980,height=1000");
  if (!w) {
    alert("اسمح بالنوافذ المنبثقة (pop-ups) للطباعة");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}
