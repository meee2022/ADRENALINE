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

import { openPrintDoc } from "./printDoc";

export type MealRow = {
  /** العمود الأول: التاريخ أو اليوم أو رقم الوجبة */
  label: string;
  category?: string;
  meal: string;
  /** ممنوعات/تفضيلات/كميات — كل ما يحتاج الشيف رؤيته */
  notes?: string;
  calories?: number | string;
  price?: number | string;
  /** صورة الوجبة — تُستخدم في تصميم الكروت (printMealPlanCards) */
  imageUrl?: string;
  protein?: number | string;
};

/** قسم داخل المجموعة — مثلاً يوم واحد داخل الأسبوع. */
export type MealSection = {
  /** يُطبع كسطر عنوان يمتد على عرض الجدول (اسم اليوم مثلاً) */
  title: string;
  rows: MealRow[];
};

export type MealGroup = {
  title: string;
  subtitle?: string;
  /** إمّا صفوف مباشرة… */
  rows?: MealRow[];
  /** …أو أقسام (يوم ثم وجباته تحته) — أوضح للشيف من تكرار اسم اليوم كل سطر */
  sections?: MealSection[];
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

/** كل صفوف المجموعة، سواء كانت مباشرة أو موزّعة على أقسام. */
function groupRows(g: MealGroup): MealRow[] {
  return g.sections ? g.sections.flatMap((s) => s.rows) : g.rows ?? [];
}

export function printMealPlan(input: PrintMealPlanInput): void {
  const groups = input.groups.filter((g) => groupRows(g).length > 0);
  if (groups.length === 0) {
    alert("لا توجد وجبات لطباعتها");
    return;
  }

  const allRows = groups.flatMap(groupRows);
  const showCal = input.showCalories ?? allRows.some((r) => r.calories != null && r.calories !== "");
  const showPrice = input.showPrice ?? allRows.some((r) => r.price != null && r.price !== "");
  const hasNotes = allRows.some((r) => (r.notes || "").trim());
  const hasCategory = allRows.some((r) => (r.category || "").trim());

  const cols = 1 + (hasCategory ? 1 : 0) + 1 + (hasNotes ? 1 : 0) + (showCal ? 1 : 0) + (showPrice ? 1 : 0);

  const headCells = [
    "<th style='width:44px'>#</th>",
    hasCategory ? "<th style='width:90px'>الصنف</th>" : "",
    "<th>الوجبة</th>",
    hasNotes ? "<th>ملاحظات / تعديلات</th>" : "",
    showCal ? "<th style='width:70px'>سعرات</th>" : "",
    showPrice ? "<th style='width:80px'>السعر</th>" : "",
  ].join("");

  const rowHtml = (r: MealRow) => `<tr>
    <td class="c b">${esc(r.label)}</td>
    ${hasCategory ? `<td class="c cat">${esc(r.category || "-")}</td>` : ""}
    <td class="meal">${esc(r.meal)}</td>
    ${hasNotes ? `<td class="note">${esc(r.notes || "")}</td>` : ""}
    ${showCal ? `<td class="c">${esc(r.calories ?? "")}</td>` : ""}
    ${showPrice ? `<td class="c">${esc(r.price ?? "")}</td>` : ""}
  </tr>`;

  /** سطر عنوان يمتد على الجدول: اسم اليوم، ووجباته تحته مباشرةً. */
  const sectionHeadHtml = (s: MealSection) =>
    `<tr class="day"><td colspan="${cols}">${esc(s.title)}
      <span class="day-n">${s.rows.length} وجبة</span></td></tr>`;

  const groupsHtml = groups
    .map((g) => {
      const body = g.sections
        ? g.sections
            .filter((s) => s.rows.length > 0)
            .map((s) => sectionHeadHtml(s) + s.rows.map(rowHtml).join(""))
            .join("")
        : (g.rows ?? []).map(rowHtml).join("");

      return `<section class="grp">
        <div class="grp-h">
          <span class="grp-t">${esc(g.title)}</span>
          ${g.subtitle ? `<span class="grp-s">${esc(g.subtitle)}</span>` : ""}
          <span class="grp-n">${groupRows(g).length} وجبة</span>
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
    <meta name="viewport" content="width=800">
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

      /* سطر اليوم: يمتد على الجدول، ووجباته تحته */
      tr.day td{background:#eaf3fb !important;color:#0E2A4A;font-weight:900;
                font-size:13px;padding:6px 10px;border:1px solid #cfe4f3}
      tr.day .day-n{float:left;font-size:11px;font-weight:800;color:#0E76AC}
      tr.day{break-inside:avoid;break-after:avoid}

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

  openPrintWindow(html, true, input.title);
}

/** يفتح نافذة الطباعة ويطبع — يفوّض للهيلبر المشترك في printDoc.ts.
 *  autoPrint=false لو الـ HTML يتكفّل بالطباعة بنفسه (مثلاً بعد تحميل الصور). */
function openPrintWindow(html: string, autoPrint = true, fileName?: string): void {
  openPrintDoc(html, { autoPrint, fileName, width: 980, height: 1000 });
}

/* ══════════════════════════════════════════════════════════════════════
   التقرير الأسبوعي — مصفوفة: الأيام صفوف، والأصناف أعمدة.
   هذا ما يُرسل للعميل، فهو مقروء من نظرة واحدة بلا تكرار.
   ══════════════════════════════════════════════════════════════════════ */

/** خانة واحدة قد تحتوي أكثر من وجبة (يوم بغداءين مثلاً) — لا نُسقط شيئاً بصمت. */
export type WeeklyCell = string[];

export type WeeklyDay = {
  /** Saturday / السبت */
  day: string;
  breakfast: WeeklyCell;
  snack1: WeeklyCell;
  lunch: WeeklyCell;
  snack2: WeeklyCell;
  dinner: WeeklyCell;
  /** أي وجبة لم تجد عموداً (سلطة، سناك ثالث…) — يظهر العمود فقط عند وجود محتوى */
  extra: WeeklyCell;
};

export type WeeklyReportInput = {
  customerName: string;
  phone?: string;
  dateText: string;
  weeks: { title: string; days: WeeklyDay[] }[];
  /** الممنوعات/الحساسية — تُطبع تحت الجدول */
  note?: string;
};

export function printWeeklyReport(input: WeeklyReportInput): void {
  const weeks = input.weeks.filter((w) => w.days.length > 0);
  if (weeks.length === 0) {
    alert("لا توجد وجبات لطباعتها");
    return;
  }

  const anyExtra = weeks.some((w) => w.days.some((d) => d.extra.length > 0));

  const cell = (c: WeeklyCell) =>
    `<td>${c.length ? c.map((m) => `<span class="m">${esc(m)}</span>`).join("") : ""}</td>`;

  const weeksHtml = weeks
    .map(
      (w) => `<section class="wk">
        <div class="wk-t">${esc(w.title)}</div>
        <table>
          <thead><tr>
            <th class="dayh">Day</th>
            <th>Breakfast</th><th>Snack 1</th><th>Lunch</th><th>Snack 2</th><th>Dinner</th>
            ${anyExtra ? "<th>Extra</th>" : ""}
          </tr></thead>
          <tbody>
            ${w.days
              .map(
                (d) => `<tr>
              <td class="dayc">${esc(d.day)}</td>
              ${cell(d.breakfast)}${cell(d.snack1)}${cell(d.lunch)}${cell(d.snack2)}${cell(d.dinner)}
              ${anyExtra ? cell(d.extra) : ""}
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>`,
    )
    .join("");

  const html = `<!doctype html><html dir="ltr" lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=800">
    <title>${esc(input.customerName)} — Weekly Report</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;padding:22px;color:#1f2937;font-family:Cairo,Tahoma,Arial,sans-serif;background:#fff}
      h1{font-size:26px;font-weight:900;text-align:center;margin:0 0 18px;color:#111827}

      .card{border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:18px;
            display:flex;gap:40px;flex-wrap:wrap}
      .card .k{font-size:9.5px;letter-spacing:.06em;color:#6b7280;font-weight:800;text-transform:uppercase}
      .card .v{font-size:13px;font-weight:800;color:#111827;margin-top:3px}

      .wk{margin-bottom:20px;break-inside:avoid}
      .wk-t{background:#eef1fd;border:1px solid #e0e4fa;border-bottom:none;border-radius:8px 8px 0 0;
            text-align:center;font-weight:900;color:#3b5bdb;padding:9px;font-size:14px}

      table{width:100%;border-collapse:collapse;table-layout:fixed}
      th{background:#f9fafb;color:#374151;font-size:10.5px;font-weight:800;padding:9px 6px;
         border:1px solid #e5e7eb;text-align:center}
      td{border:1px solid #e5e7eb;padding:8px 6px;font-size:9.5px;color:#374151;vertical-align:middle;
         word-wrap:break-word}
      td.dayc{font-weight:800;color:#111827;text-align:center;font-size:11px;background:#fff}
      th.dayh,td.dayc{width:78px}
      .m{display:block}
      .m + .m{margin-top:3px;padding-top:3px;border-top:1px dashed #e5e7eb}

      .note{margin-top:6px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;
            border-radius:8px;padding:9px 12px;font-size:11px;font-weight:700}
      .foot{margin-top:16px;font-size:10px;color:#9ca3af;text-align:center}
      @page{size:A4;margin:12mm}
      @media print{.wk{break-inside:avoid}thead{display:table-header-group}}
    </style></head><body>
    <h1>Weekly Report</h1>
    <div class="card">
      <div><div class="k">Name</div><div class="v">${esc(input.customerName)}</div></div>
      ${input.phone ? `<div><div class="k">Phone Number</div><div class="v">${esc(input.phone)}</div></div>` : ""}
      <div><div class="k">Date &amp; Time</div><div class="v">${esc(input.dateText)}</div></div>
    </div>
    ${weeksHtml}
    ${input.note ? `<div class="note">⚠ ${esc(input.note)}</div>` : ""}
    <div class="foot">ADRENALINE Healthy Food</div>
    </body></html>`;

  openPrintWindow(html, true, `${input.customerName} - Weekly Report`);
}

/* ══════════════════════════════════════════════════════════════════════
   تصميم الكروت بالصور — النسخة الفخمة التي تُرسل للعميل كـ PDF.
   نفس شكل المنيو/الخطة الذكية: يوم بعنوان غامق، ووجباته كروت بالصور.
   ══════════════════════════════════════════════════════════════════════ */

export async function printMealPlanCards(input: PrintMealPlanInput): Promise<void> {
  const groups = input.groups.filter((g) => groupRows(g).length > 0);
  if (groups.length === 0) {
    alert("لا توجد وجبات لطباعتها");
    return;
  }

  const cardHtml = (r: MealRow) => `<div class="card">
    <div class="ph">
      ${r.imageUrl ? `<img src="${esc(r.imageUrl)}" alt="${esc(r.meal)}" loading="eager">` : `<div class="noimg">🍽️</div>`}
      ${r.category ? `<span class="cat">${esc(r.category)}</span>` : ""}
    </div>
    <div class="body">
      <div class="name">${esc(r.meal)}</div>
      <div class="macros">
        ${r.calories != null && r.calories !== "" ? `<span>${esc(r.calories)} سعرة</span>` : ""}
        ${r.protein != null && r.protein !== "" ? `<span>🥩 ${esc(r.protein)}g</span>` : ""}
      </div>
      ${r.notes ? `<div class="note">${esc(r.notes)}</div>` : ""}
    </div>
  </div>`;

  const sectionHtml = (title: string, rows: MealRow[]) => `<section class="day">
    <div class="day-h">
      <span class="day-t">${esc(title)}</span>
      <span class="day-n">${rows.length} وجبة</span>
    </div>
    <div class="cards">${rows.map(cardHtml).join("")}</div>
  </section>`;

  const groupsHtml = groups
    .map((g) => {
      const inner = g.sections
        ? g.sections.filter((s) => s.rows.length > 0).map((s) => sectionHtml(s.title, s.rows)).join("")
        : sectionHtml(g.title, g.rows ?? []);
      // لو المجموعة فيها أقسام، اعرض عنوان المجموعة (الأسبوع) كبانر فوقها.
      const banner = g.sections
        ? `<div class="wk-banner">🗓️ ${esc(g.title)}${g.subtitle ? ` · ${esc(g.subtitle)}` : ""}</div>`
        : "";
      return `<div class="grp">${banner}${inner}</div>`;
    })
    .join("");

  const kpisHtml = (input.kpis || []).length
    ? `<div class="kpis">${(input.kpis || [])
        .map((k) => `<div class="kpi"><div class="v">${esc(k.value)}</div><div class="l">${esc(k.label)}</div></div>`)
        .join("")}</div>`
    : "";

  const safeName = String(input.title).replace(/[\\/:*?"<>|]+/g, " ").trim() || "meal-plan";

  // 🅐 الاسم اللاتيني (اسم العميل) نعزله باتجاه LTR داخل العنوان العربي حتى لا
  //    يختلّ ترتيب الحروف عند مزج العربي باللاتيني (bidi). نلفّ أي مقطع
  //    لاتيني/أرقام بـ <bdi dir="ltr"> فيبقى العربي متّصلاً سليماً.
  const isolateLatin = (s: string) =>
    esc(s).replace(/([A-Za-z0-9@._+\-]+(?:\s+[A-Za-z0-9@._+\-]+)*)/g, '<bdi dir="ltr">$1</bdi>');

  // ✅ نرسم عبر طباعة المتصفح الأصلية (لا html2canvas): محرك المتصفح يشكّل
  //    العربي والاتجاهين ويحاذي الشارات صحيحاً 100%، ويعرض الصور بلا قيود CORS.
  //    ننتظر تحميل كل الصور ثم نطبع تلقائياً (المستخدم يحفظ كـ PDF).
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <!-- ✅ عرض تخطيط ثابت (لا device-width): يمنع الجوال من إعادة تخطيط الكروت
         بعرض الشاشة الصغير فتتضخّم وتتفجّر لمئات الصفحات. الآن الجوال = الديسكتوب. -->
    <meta name="viewport" content="width=800">
    <title>${esc(safeName)}</title>
    <style>
      *{box-sizing:border-box;font-family:Cairo,Tahoma,Arial,sans-serif}
      html,body{margin:0;padding:0}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
      /* عرض المحتوى يملأ عرض الصفحة القابل للطباعة، بحدّ أقصى قريب من عرض A4 */
      .mp-doc{color:#0E2A4A;background:#fff;width:100%;max-width:780px;margin:0 auto}
      .mp-doc .hero{background:linear-gradient(120deg,#0E2A4A,#0E76AC);color:#fff;padding:16px 20px;
            display:flex;justify-content:space-between;align-items:center;gap:12px}
      .mp-doc .brand{font-size:17px;font-weight:900;letter-spacing:.12em;white-space:nowrap}
      .mp-doc .brand small{display:block;font-size:7.5px;letter-spacing:.35em;opacity:.8;font-weight:700}
      .mp-doc h1{font-size:16px;margin:0;font-weight:900;line-height:1.3}
      .mp-doc .sub{font-size:11px;opacity:.9;font-weight:700;margin-top:2px}
      .mp-doc .wrap{padding:12px 16px}
      .mp-doc .kpis{display:flex;gap:8px;margin-bottom:10px}
      .mp-doc .kpi{flex:1;border:1px solid #e8eef4;border-radius:10px;padding:6px;text-align:center;background:#f7fbfe}
      .mp-doc .kpi .v{font-size:17px;font-weight:900;color:#0E76AC}
      .mp-doc .kpi .l{font-size:10px;color:#47759c;font-weight:700}
      .mp-doc .grp{margin-bottom:8px}
      .mp-doc .wk-banner{background:#eaf3fb;border:1px solid #cfe4f3;border-radius:10px;padding:6px 12px;
                 font-weight:900;font-size:12.5px;color:#0E2A4A;margin-bottom:8px}
      /* اليوم كتلة واحدة لا تُقسَّم بين صفحتين — فيظهر مرتباً كما في الخطة الذكية */
      .mp-doc .day{border:1px solid #e5e9ef;border-radius:12px;overflow:hidden;margin-bottom:8px;
                   page-break-inside:avoid;break-inside:avoid}
      .mp-doc .day-h{background:#0E2A4A;color:#fff;padding:6px 12px;display:flex;justify-content:space-between;align-items:center}
      .mp-doc .day-t{font-weight:800;font-size:13px}
      .mp-doc .day-n{font-size:10px;background:rgba(255,255,255,.16);border-radius:50px;padding:2px 8px}
      /* كروت مُصغّرة — ~5-6 كروت في الصف، مضغوطة وأنضف */
      .mp-doc .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:7px;padding:9px}
      .mp-doc .card{border:1px solid #eef1f4;border-radius:9px;overflow:hidden;background:#f7fbfe;break-inside:avoid}
      .mp-doc .ph{position:relative;height:66px;background:#eaf3fb}
      .mp-doc .ph img{width:100%;height:100%;object-fit:cover;display:block}
      .mp-doc .ph .noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px}
      .mp-doc .ph .cat{position:absolute;top:4px;inset-inline-start:4px;background:rgba(255,255,255,.92);
               color:#0E76AC;font-size:8.5px;font-weight:800;padding:2px 6px;border-radius:6px;
               line-height:1.2;display:inline-block}
      .mp-doc .body{padding:6px 7px}
      .mp-doc .name{font-weight:800;font-size:10.5px;line-height:1.28;color:#0E2A4A}
      .mp-doc .macros{display:flex;gap:6px;flex-wrap:wrap;font-size:9px;color:#47759c;font-weight:700;margin-top:3px}
      .mp-doc .note{margin-top:4px;font-size:8.5px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;
            border-radius:6px;padding:3px 5px;font-weight:700}
      .mp-doc .foot{margin:6px 18px 16px;font-size:9.5px;color:#94a3b8;text-align:center}
      @page{size:A4;margin:8mm}
      @media print{.mp-doc{max-width:none}.day,.card{break-inside:avoid}}
    </style></head><body>
    <div class="mp-doc" dir="rtl">
      <div class="hero">
        <div style="text-align:start"><h1>${isolateLatin(input.title)}</h1>${input.subtitle ? `<div class="sub">${isolateLatin(input.subtitle)}</div>` : ""}</div>
        <div class="brand">ADRENALINE<small>HEALTHY FOOD</small></div>
      </div>
      <div class="wrap">
        ${kpisHtml}
        ${groupsHtml}
      </div>
      <div class="foot">ADRENALINE Healthy Food</div>
    </div>
    <script>
      (function(){
        var imgs = Array.prototype.slice.call(document.images);
        var pending = imgs.filter(function(i){ return !i.complete; });
        var printed = false;
        function go(){ if(printed) return; printed = true; setTimeout(function(){ try{ window.focus(); window.print(); }catch(e){} }, 200); }
        if (pending.length === 0){ go(); return; }
        var left = pending.length;
        function dec(){ left--; if(left <= 0) go(); }
        pending.forEach(function(i){ i.addEventListener('load', dec); i.addEventListener('error', dec); });
        setTimeout(go, 3500); // احتياطي لو تأخّرت صورة
      })();
    <\/script>
    </body></html>`;

  // autoPrint=false: صفحة الطباعة تطبع نفسها بعد اكتمال الصور.
  openPrintWindow(html, false, safeName);
}
