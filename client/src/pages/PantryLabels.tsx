// client/src/pages/PantryLabels.tsx
//
// استيكرات المخزن والبهارات — نسخة رقمية من ملصق الميزان (Bradma) الذي
// تخرج به أكياس البهارات من المورّد: الاسم، سعر الوحدة، الوزن، الإجمالي،
// إنتاج/انتهاء، وباركود. الملصق الورقي الأصلي يبهت بالحرارة في المخزن
// فتضيع بياناته — هنا يُعاد طبعه على طابعة الاستيكرات الحرارية متى شاء
// المخزن، وكل خانة قابلة للتحرير.
//
// آخر عناصر مطبوعة تُحفظ محلياً (localStorage) فلا يعيد أمين المخزن كتابة
// نفس البهارات كل مرة — يختار من «المطبوعة سابقاً» ويعدّل التاريخ فقط.
import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { useLanguage } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Printer, Plus, Trash2, PackageOpen } from "lucide-react";

type PantryLabel = {
  name: string;
  unitPrice: string;   // نصوص خام: نطبع ما كُتب حرفياً (45.00 تبقى 45.00)
  grossWeight: string;
  totalPrice: string;
  prodDate: string;    // yyyy-mm-dd من <input type=date>
  expDate: string;
  barcode: string;
  /** أول سبعة أرقام: البادئة وكود الصنف. الباقي يُبنى من الوزن. */
  barcodePrefix?: string;
  footer: string;
  copies: number;
};

const STORAGE_KEY = "adrenaline:pantry-labels:v1";

/* سريال ملصق الميزان الأصلي (Bradma) — يُملأ جاهزاً فيعدّل المخزن الأرقام
   المميِّزة للصنف وحدها بدل كتابة ثلاثة عشر رقماً كل مرة. الصنف الذي سبقت
   طباعته يستعيد سرياله هو من «المطبوعة سابقاً». */
const BASE_BARCODE = "9912539010102";
/* أول سبعة أرقام من ملصق المورّد: بادئة الميزان وكود الصنف. */
const BASE_PREFIX = BASE_BARCODE.slice(0, 7);

/** خانة تحقق EAN-13 لأول اثني عشر رقماً. */
function eanCheckDigit(d12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d12[i] || 0) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

/**
 * باركود الميزان: البادئة (7) + الوزن بالجرام (5) + خانة تحقق.
 * الملصق الأصلي يشفّر الوزن في الأرقام الأخيرة — 1.010 كجم تظهر 01010 —
 * فنسخ رقم كيسٍ على كيسٍ آخر كان يعطي وزناً كاذباً. يُبنى تلقائياً من الوزن
 * المكتوب، وتبقى البادئة بيد المخزن ليميّز الصنف.
 */
function buildBarcode(prefix: string, weightKg: string): string {
  const p = String(prefix || BASE_PREFIX).replace(/\D/g, "").slice(0, 7).padEnd(7, "0");
  const grams = Math.round((Number(weightKg) || 0) * 1000);
  if (!grams) return "";
  const w = String(Math.min(99999, grams)).padStart(5, "0");
  const base = p + w;
  return base + String(eanCheckDigit(base));
}

/* أصناف المخزن الثابتة — يختار منها أمين المخزن بدل كتابة الاسم حرفاً حرفاً،
   وتبقى الخانة حرّة فأي صنف جديد يُكتب مباشرةً ويُحفظ في «المطبوعة سابقاً»
   فيظهر في القائمة بعدها. الأسماء إنجليزية كما تُطبع على الملصق. */
const PANTRY_ITEMS = [
  "Ajinomoto Salt", "Almond Nut", "Bay Leaves", "Biryani Powder",
  "Black Pepper Powder", "Black Pepper Whole", "Cajun Powder", "Cashew Nut",
  "Chili Powder", "Cinnamon Powder", "Cinnamon Stick", "Coriander Powder",
  "Coriander Seeds", "Cumin Powder", "Cumin Seeds", "Curry Powder",
  "Garlic Powder", "Kabsa Powder", "Lumi", "Majbos Powder", "Onion Powder",
  "Oregano", "Paprika Powder", "Peanut", "Pistachio Slice", "Pumpkin Seeds",
  "Quinoa", "Raisins", "Rosemary", "Salt", "Seven Spices", "Star Anise",
  "Sunflower Seeds", "Sweet Paprika", "Thyme", "Turmeric Powder", "Walnut",
  "White Pepper Powder", "White Sugar",
];
const todayISO = () => new Date().toISOString().slice(0, 10);
const plusYearISO = () => {
  const d = new Date(); d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const EMPTY: PantryLabel = {
  name: "", unitPrice: "", grossWeight: "", totalPrice: "",
  prodDate: todayISO(), expDate: plusYearISO(),
  barcode: "", barcodePrefix: BASE_PREFIX, footer: "ADRENALINE HEALTHY FOOD", copies: 1,
};

// dd-mm-yy كما على ملصق المورّد (25-07-26)
const fmtDate = (iso: string) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1].slice(2)}` : iso;
};

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value || " ", {
        format: "CODE128", displayValue: false, margin: 0,
        height: 62, width: 1.9, background: "transparent", lineColor: "#050505",
      });
    } catch { /* باركود فارغ/غير صالح: نترك المكان فارغاً بدل كسر الصفحة */ }
  }, [value]);
  return <svg ref={ref} aria-label={`Barcode ${value}`} />;
}

/** الملصق نفسه — شاشة وطباعة. المقاس 58×39مم كطابعة الاستيكرات الحالية. */
function SpiceLabel({ l }: { l: PantryLabel }) {
  return (
    <div className="sp-label">
      <div className="sp-name">{l.name || "—"}</div>
      <div className="sp-body">
        <div className="sp-facts">
          <div className="sp-fact">
            <span className="sp-k">UNIT<br />PRICE</span>
            <span className="sp-box">{l.unitPrice || "—"}</span>
          </div>
          <div className="sp-fact">
            <span className="sp-k">GROSS<br />WEIGHT</span>
            <span className="sp-box">{l.grossWeight || "—"}</span>
          </div>
          <div className="sp-fact">
            <span className="sp-k">TOTAL<br />PRICE</span>
            <span className="sp-box sp-box-lg"><i>QR</i>{l.totalPrice || "—"}</span>
          </div>
        </div>
        <div className="sp-side">
          <div className="sp-dates">
            <div><b>PRD</b><span>{fmtDate(l.prodDate)}</span></div>
            <div><b>EXP</b><span>{fmtDate(l.expDate)}</span></div>
          </div>
          {l.barcode ? (
            <div className="sp-bc"><Barcode value={l.barcode} /><span>{l.barcode}</span></div>
          ) : null}
        </div>
      </div>
      <div className="sp-footer">{l.footer}</div>
    </div>
  );
}

export default function PantryLabels() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (ar: string, en: string) => (isRtl ? ar : en);

  const [form, setForm] = useState<PantryLabel>(EMPTY);
  const [saved, setSaved] = useState<PantryLabel[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const set = (k: keyof PantryLabel) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === "copies" ? Math.max(1, Number(e.target.value) || 1) : e.target.value }));

  // الإجمالي = سعر الوحدة × الوزن ما لم يكتبه المستخدم بيده (الميزان قد يقرّب غير حسابنا)
  const autoTotal = useMemo(() => {
    const u = Number(form.unitPrice), w = Number(form.grossWeight);
    return Number.isFinite(u) && Number.isFinite(w) && u > 0 && w > 0
      ? (Math.round(u * w * 100) / 100).toFixed(2) : "";
  }, [form.unitPrice, form.grossWeight]);
  // الباركود يتبع الوزن دائماً ما لم يكتبه المخزن بيده صراحةً
  const autoBarcode = useMemo(
    () => buildBarcode(form.barcodePrefix || BASE_PREFIX, form.grossWeight),
    [form.barcodePrefix, form.grossWeight],
  );
  const effective: PantryLabel = {
    ...form,
    totalPrice: form.totalPrice || autoTotal,
    barcode: form.barcode || autoBarcode,
  };

  /* القائمة المعروضة = الأصناف الثابتة + ما أضافه المخزن بالكتابة، بلا تكرار. */
  const nameOptions = useMemo(() => {
    const seen = new Set(PANTRY_ITEMS.map((x) => x.toLowerCase()));
    const extra = saved.map((x) => x.name).filter((n) => n && !seen.has(n.toLowerCase()));
    return [...PANTRY_ITEMS, ...Array.from(new Set(extra))].sort((a, b) => a.localeCompare(b));
  }, [saved]);

  const persist = (rows: PantryLabel[]) => {
    setSaved(rows);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch { /* مساحة ممتلئة: نتجاهل */ }
  };
  const doPrint = () => {
    if (!effective.name.trim()) return;
    // احفظ/حدّث حسب الاسم ليعاد استعماله لاحقاً بتعديل التاريخ فقط
    const rest = saved.filter((s) => s.name.trim().toLowerCase() !== effective.name.trim().toLowerCase());
    persist([{ ...effective }, ...rest].slice(0, 60));
    window.print();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4" dir={dir}>
      <div className="flex items-center gap-3 print:hidden">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
          <PackageOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-black">{t("استيكرات المخزن", "Pantry Labels")}</h1>
          <p className="text-xs text-muted-foreground font-semibold">
            {t("ملصق وزن للبهارات والمواد — كل الخانات بيدك ويُعاد طبعه متى بهت الأصلي.",
               "Weight label for spices & supplies — every field editable, reprint whenever the original fades.")}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 print:hidden">
        {/* ── النموذج ── */}
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <Field label={t("اسم الصنف — اختر من القائمة أو اكتب", "Item name — pick or type")}>
            <div className="flex gap-2">
              <Input dir="ltr" list="pantry-items" value={form.name} onChange={set("name")}
                placeholder="Curry Powder" className="font-black uppercase flex-1" />
              <select
                value=""
                onChange={(e) => { if (e.target.value) setForm((f) => ({ ...f, name: e.target.value })); }}
                aria-label={t("اختر صنفاً", "Pick an item")}
                className="h-10 w-11 shrink-0 rounded-md border bg-white text-center text-sm font-black">
                <option value="">▾</option>
                {nameOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {/* datalist للكتابة السريعة، والقائمة جنبها لمن يتصفّح */}
            <datalist id="pantry-items">
              {nameOptions.map((n) => <option key={n} value={n} />)}
            </datalist>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("سعر الوحدة", "Unit price")}>
              <Input dir="ltr" value={form.unitPrice} onChange={set("unitPrice")} placeholder="45.00" />
            </Field>
            <Field label={t("الوزن (كجم)", "Gross weight")}>
              <Input dir="ltr" value={form.grossWeight} onChange={set("grossWeight")} placeholder="1.010" />
            </Field>
            <Field label={t("الإجمالي (تلقائي)", "Total (auto)")}>
              <Input dir="ltr" value={form.totalPrice} onChange={set("totalPrice")} placeholder={autoTotal || "45.45"} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("تاريخ الإنتاج", "PRD date")}>
              <Input type="date" dir="ltr" value={form.prodDate} onChange={set("prodDate")} />
            </Field>
            <Field label={t("تاريخ الانتهاء", "EXP date")}>
              <Input type="date" dir="ltr" value={form.expDate} onChange={set("expDate")} />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Field label={t("كود الصنف (7 أرقام)", "Item code (7 digits)")}>
              <Input dir="ltr" value={form.barcodePrefix ?? BASE_PREFIX}
                onChange={(e) => setForm((f) => ({ ...f, barcodePrefix: e.target.value.replace(/\D/g, "").slice(0, 7), barcode: "" }))}
                placeholder={BASE_PREFIX} className="tabular-nums font-bold" />
            </Field>
            <Field label={t("عدد النسخ", "Copies")}>
              <Input type="number" min={1} dir="ltr" value={String(form.copies)} onChange={set("copies")} />
            </Field>
          </div>
          <div className="rounded-lg bg-slate-50 border px-3 py-2 flex items-center gap-2">
            <span className="text-[11px] font-black text-muted-foreground shrink-0">
              {t("الباركود", "Barcode")}
            </span>
            <code className="flex-1 text-sm font-black tabular-nums" dir="ltr">
              {effective.barcode || t("اكتب الوزن أولاً", "enter a weight first")}
            </code>
            {form.barcode ? (
              <button type="button" onClick={() => setForm((f) => ({ ...f, barcode: "" }))}
                className="text-[11px] font-black text-[#0E76AC]">{t("تلقائي", "Auto")}</button>
            ) : (
              <span className="text-[10px] font-bold text-emerald-600">
                {t("يتولّد من الوزن", "from weight")}
              </span>
            )}
          </div>

          <Field label={t("سطر أسفل الملصق", "Footer line")}>
            <Input dir="ltr" value={form.footer} onChange={set("footer")} />
          </Field>
          <div className="flex gap-2 pt-1">
            <button onClick={doPrint} disabled={!effective.name.trim()}
              className="h-11 flex-1 rounded-xl text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
              <Printer className="h-4 w-4" />
              {t(`طباعة (${effective.copies})`, `Print (${effective.copies})`)}
            </button>
            <button onClick={() => setForm({ ...EMPTY, prodDate: todayISO(), expDate: plusYearISO() })}
              className="h-11 px-4 rounded-xl border font-black text-sm">
              <Plus className="h-4 w-4 inline me-1" />{t("جديد", "New")}
            </button>
          </div>
        </div>

        {/* ── معاينة + المطبوعة سابقاً ── */}
        <div className="space-y-3">
          <div className="rounded-2xl border bg-slate-50 p-4 flex items-center justify-center">
            <div className="sp-preview"><SpiceLabel l={effective} /></div>
          </div>
          {saved.length > 0 && (
            <div className="rounded-2xl border bg-white p-3">
              <p className="text-xs font-black text-muted-foreground mb-2">
                {t("المطبوعة سابقاً — اضغط لاستعادتها ثم عدّل التاريخ فقط", "Previously printed — click to reload, then just fix the dates")}
              </p>
              <div className="max-h-56 overflow-y-auto divide-y">
                {saved.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 py-1.5">
                    <button onClick={() => setForm({ ...s, prodDate: todayISO() })}
                      className="flex-1 text-start text-sm font-bold hover:text-[#0E76AC] truncate" dir="ltr">
                      {s.name}
                      <span className="ms-2 text-[11px] text-muted-foreground font-semibold">
                        {s.unitPrice && `QR ${s.unitPrice}`}{s.barcode && ` · ${s.barcode}`}
                      </span>
                    </button>
                    <button onClick={() => persist(saved.filter((x) => x.name !== s.name))}
                      aria-label={t("حذف", "Delete")}
                      className="h-7 w-7 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── نسخ الطباعة: كل نسخة صفحة 58×39مم ── */}
      <div className="sp-print-run hidden print:block">
        {Array.from({ length: effective.copies }, (_, i) => (
          <div className="sp-page" key={i}><SpiceLabel l={effective} /></div>
        ))}
      </div>

      <style>{`
        .sp-label {
          width: 58mm; height: 39mm; box-sizing: border-box;
          background: #fff; color: #000;
          border: 0.5px solid #cbd5e1; border-radius: 1.5mm;
          padding: 1.6mm 2.4mm 1.2mm;
          display: flex; flex-direction: column;
          font-family: 'Courier New', 'Cairo', monospace; /* روح ملصق الميزان الأصلي */
          overflow: hidden;
        }
        .sp-name {
          text-align: center; font-weight: 900; font-size: 11px;
          letter-spacing: 1px; text-transform: uppercase;
          white-space: nowrap; overflow: hidden;
        }
        .sp-body { flex: 1; display: flex; gap: 1.6mm; margin-top: 1mm; min-height: 0; }
        .sp-facts { display: flex; flex-direction: column; justify-content: space-between; }
        .sp-fact { display: flex; align-items: center; gap: 1.2mm; }
        .sp-k { font-size: 5.5px; font-weight: 900; line-height: 1.1; width: 8mm; }
        .sp-box {
          border: 0.5px solid #000; padding: 0.4mm 1.4mm; min-width: 13mm;
          font-size: 11px; font-weight: 900; text-align: center; letter-spacing: 0.5px;
        }
        .sp-box-lg { font-size: 12.5px; min-width: 15mm; }
        .sp-box i { font-style: normal; font-size: 6px; vertical-align: top; margin-inline-end: 0.6mm; }
        .sp-side { flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
        .sp-dates { font-size: 8.5px; font-weight: 900; display: flex; flex-direction: column; gap: 0.6mm; }
        .sp-dates div { display: flex; gap: 1.6mm; justify-content: flex-end; }
        .sp-dates b { font-size: 7px; }
        .sp-bc { text-align: center; }
        .sp-bc svg { max-width: 100%; height: 12.5mm; }
        .sp-bc span { display: block; font-size: 8px; font-weight: 900; letter-spacing: 1.5px; }
        .sp-footer {
          text-align: center; font-weight: 900; font-size: 8px;
          letter-spacing: 2px; text-transform: uppercase; margin-top: 0.6mm;
        }
        .sp-preview .sp-label { transform: scale(1.6); transform-origin: center; margin: 12mm 0; box-shadow: 0 4px 14px rgba(0,0,0,.15); }

        @media print {
          body * { visibility: hidden; }
          .sp-print-run, .sp-print-run * { visibility: visible; }
          .sp-print-run { position: absolute; inset: 0; }
          @page { size: 58mm 39mm; margin: 0; }
          .sp-page { page-break-after: always; width: 58mm; height: 39mm; }
          .sp-page:last-child { page-break-after: auto; }
          .sp-page .sp-label { border: none; border-radius: 0; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
