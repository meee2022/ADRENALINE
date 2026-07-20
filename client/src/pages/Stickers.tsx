// client/src/pages/Stickers.tsx
import React, { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Printer, RotateCcw, Sun, Moon, Package, UtensilsCrossed, Layers } from "lucide-react";
import { useStickers } from "@/lib/api";

type DeliveryTime = "MORNING" | "EVENING" | "ALL";
type TabKey = "MEALS" | "BOX";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function toSafeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function scaleStickerMacros(sticker: any, calories: number) {
  const originalCalories = toSafeNumber(sticker?.calories);
  const protein = toSafeNumber(sticker?.protein);
  const carbs = toSafeNumber(sticker?.carbs);
  const fats = toSafeNumber(sticker?.fats);
  const hasMacros = protein > 0 || carbs > 0 || fats > 0;
  const baseCalories = originalCalories > 0 ? originalCalories : protein * 4 + carbs * 4 + fats * 9;
  if (!hasMacros || baseCalories <= 0 || calories < 0) {
    return { ...sticker, calories, caloriesText: `${calories} CAL` };
  }

  const factor = calories / baseCalories;
  const scaled = (value: number) => Math.round(value * factor * 10) / 10;
  return {
    ...sticker,
    calories,
    caloriesText: `${calories} CAL`,
    macros: undefined,
    protein: protein > 0 ? scaled(protein) : sticker.protein,
    carbs: carbs > 0 ? scaled(carbs) : sticker.carbs,
    fats: fats > 0 ? scaled(fats) : sticker.fats,
  };
}

export default function Stickers() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  // ✅ الاستيكرات تُطبع اليوم لتوصيل الغد — الافتراضي "بكرة" (زي المطبخ)
  const [date, setDate] = useState<string>(format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
  const [deliveryTime, setDeliveryTime] = useState<DeliveryTime>("MORNING");
  const [activeTab, setActiveTab] = useState<TabKey>("MEALS");
  // وضع الطباعة: "label" = طابعة استيكرات (كل استيكر صفحة بمقاسه) · "sheet" = ورقة A4 شبكة
  const [printerMode, setPrinterMode] = useState<"label" | "sheet">("label");

  // مقاس ليبل الطابعة الفعلي: 58×39 مم (Direct Thermal)
  const DEFAULTS = useMemo(() => ({ w: 58, h: 39, gap: 3, pad: 3 }), []);
  const [labelW, setLabelW] = useState(DEFAULTS.w);
  const [labelH, setLabelH] = useState(DEFAULTS.h);
  const [gap, setGap] = useState(DEFAULTS.gap);
  const [pad, setPad] = useState(DEFAULTS.pad);

  const styleVars = useMemo(
    () =>
      ({
        "--label-w": `${clamp(labelW, 20, 120)}mm`,
        "--label-h": `${clamp(labelH, 15, 120)}mm`,
        "--gap": `${clamp(gap, 0, 20)}mm`,
        "--pad": `${clamp(pad, 0, 12)}mm`,
      }) as React.CSSProperties,
    [labelW, labelH, gap, pad],
  );

  // ✅ أسماء الوجبات على الاستيكر إنجليزي دائماً (المطبخ/التغليف يقرأ إنجليزي)
  const data = useStickers({ date, deliveryTime, lang: "en" });
  const boxStickers = data?.boxStickers ?? [];
  const mealStickers = data?.mealStickers ?? [];
  const activeStickers = activeTab === "MEALS" ? mealStickers : boxStickers;

  // ✅ تحديد استيكرات لطباعتها لوحدها (لو الطابعة وقفت في نص الطباعة، تعيد المتبقّي فقط)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  // طباعة مؤجّلة: نضبط النطاق قبل ما نفتح مربّع الطباعة
  const [pendingPrint, setPendingPrint] = useState<null | "all" | "selected">(null);

  // ✅ تعديل لحظي للسعرات وقت الطباعة (لا يُحفظ) — مفتاحه فهرس الاستيكر
  const [calOverride, setCalOverride] = useState<Record<number, number>>({});
  // امسح التحديد والتعديلات لما يتغيّر التبويب/التاريخ/الوقت (تتبدّل القائمة)
  useEffect(() => { setSelected(new Set()); setRangeFrom(""); setRangeTo(""); setCalOverride({}); }, [activeTab, date, deliveryTime]);

  useEffect(() => {
    if (!pendingPrint) return;
    // الـclass اتطبّق في هذا الرندر، نطبع ثم نصفّر
    window.print();
    const id = setTimeout(() => setPendingPrint(null), 300);
    return () => clearTimeout(id);
  }, [pendingPrint]);

  const toggleOne = (idx: number) =>
    setSelected((s) => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  const selectAll = () => setSelected(new Set(activeStickers.map((_: any, i: number) => i)));
  const clearSel = () => setSelected(new Set());
  const applyRange = () => {
    const a = Math.max(1, parseInt(rangeFrom, 10) || 1);
    const b = Math.min(activeStickers.length, parseInt(rangeTo, 10) || activeStickers.length);
    const n = new Set(selected);
    for (let i = a; i <= b; i++) n.add(i - 1); // 1-based → 0-based
    setSelected(n);
  };

  function resetSizes() {
    setLabelW(DEFAULTS.w);
    setLabelH(DEFAULTS.h);
    setGap(DEFAULTS.gap);
    setPad(DEFAULTS.pad);
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", ...styleVars }}>

      {/* ── Controls (hidden on print) ── */}
      <div className="print:hidden space-y-4">

        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              {isRtl ? "طباعة الستيكرات" : "Stickers Print"}
            </h1>
            <p className="text-sm mt-0.5 font-medium" style={{ color: "#3cc4f0" }}>
              {isRtl ? "معاينة وطباعة ستيكرات الوجبات والبوكس" : "Preview and print meal & box stickers"}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            {/* Printer mode toggle */}
            <div className="flex min-h-11 flex-1 rounded-xl border border-gray-200 overflow-hidden sm:flex-none">
              {([
                { key: "label", ar: "طابعة استيكرات", en: "Label Printer" },
                { key: "sheet", ar: "ورقة A4", en: "A4 Sheet" },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPrinterMode(m.key)}
                  className={cn(
                    "min-h-11 flex-1 px-3 text-xs font-bold transition-colors sm:flex-none",
                    printerMode === m.key ? "text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                  )}
                  style={printerMode === m.key ? { background: "#0E76AC" } : {}}
                >
                  {isRtl ? m.ar : m.en}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingPrint("all")}
              className="min-h-11 flex-1 px-5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 sm:flex-none"
              style={{ background: "linear-gradient(135deg, #3cc4f0, #2bb0dc)", boxShadow: "0 4px 14px #3cc4f040" }}
            >
              <Printer className="h-4 w-4" />
              {isRtl ? "طباعة الكل" : "Print All"}
            </button>
          </div>
        </div>

        {/* Filters card */}
        <div className="bg-white rounded-2xl p-5 space-y-5"
          style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.06)" }}>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Date */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {isRtl ? "التاريخ" : "Date"}
              </p>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl border-gray-200 focus:border-[#3cc4f0] text-sm"
              />
            </div>

            {/* Delivery time */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {isRtl ? "وقت التوصيل" : "Delivery Time"}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "ALL" as DeliveryTime, ar: "الكل", en: "All", Icon: Layers, grad: "linear-gradient(135deg, #3cc4f0, #0E76AC)", shadow: "#3cc4f040" },
                  { key: "MORNING" as DeliveryTime, ar: "صباحي", en: "Morning", Icon: Sun, grad: "linear-gradient(135deg, #f59e0b, #fcd34d)", shadow: "#f59e0b40" },
                  { key: "EVENING" as DeliveryTime, ar: "مسائي", en: "Evening", Icon: Moon, grad: "linear-gradient(135deg, #47759c, #5a8ab5)", shadow: "#47759c40" },
                ]).map(({ key, ar, en, Icon, grad, shadow }) => {
                  const active = deliveryTime === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setDeliveryTime(key)}
                      className={cn(
                        "h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all border",
                        active ? "text-white border-transparent" : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
                      )}
                      style={active ? { background: grad, boxShadow: `0 3px 10px ${shadow}` } : {}}
                    >
                      <Icon className="h-4 w-4" />
                      {isRtl ? ar : en}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticker dimensions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {isRtl ? "مقاس الستيكر (مم)" : "Sticker Size (mm)"}
              </p>
              <button
                onClick={resetSizes}
                className="text-xs font-semibold flex items-center gap-1.5 px-3 h-7 rounded-lg transition-colors hover:opacity-80"
                style={{ color: "#3cc4f0", background: "#3cc4f010" }}
              >
                <RotateCcw className="h-3 w-3" />
                {isRtl ? "إعادة ضبط" : "Reset"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: isRtl ? "العرض" : "Width",    value: labelW, onChange: setLabelW },
                { label: isRtl ? "الطول" : "Length",   value: labelH, onChange: setLabelH },
                { label: isRtl ? "الوجبة" : "Meals",   value: gap,    onChange: setGap },
                { label: isRtl ? "الحلاسة" : "Pad",    value: pad,    onChange: setPad, step: "0.1" },
              ].map(({ label, value, onChange, step }) => (
                <div key={label} className="text-center">
                  <Input
                    type="number"
                    step={step}
                    value={value}
                    onChange={(e) => onChange(toSafeNumber(e.target.value))}
                    className="h-12 text-center text-lg font-bold rounded-xl border-gray-200 focus:border-[#3cc4f0] mb-1.5"
                  />
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab selector */}
        <div className="bg-white rounded-2xl p-1.5 flex gap-1.5"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)" }}>
          {([
            { key: "MEALS" as TabKey, label: isRtl ? "ستيكرات الوجبات" : "Meal Stickers", icon: UtensilsCrossed },
            { key: "BOX"   as TabKey, label: isRtl ? "ستيكرات البوكس"  : "Box Stickers",  icon: Package },
          ]).map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                style={active
                  ? { background: "#3cc4f0", color: "#fff", boxShadow: "0 3px 10px #3cc4f040" }
                  : { color: "#64748b" }
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Count badge */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-400">
            {isRtl ? "المعاينة المباشرة" : "Live Preview"}
          </p>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: "#3cc4f015", color: "#3cc4f0" }}>
            {activeStickers.length} {isRtl ? "ستيكر" : "stickers"}
          </span>
        </div>

        {/* ✅ تحديد استيكرات معيّنة لطباعتها لوحدها (لو الطابعة وقفت في النص) */}
        {activeStickers.length > 0 && (
          <div className="rounded-xl border border-[#3cc4f0]/30 bg-[#f2fbff] p-3 flex flex-wrap items-end gap-2">
            <div className="flex items-end gap-1.5">
              <div>
                <label className="text-[11px] font-bold text-[#47759c] block mb-0.5">{isRtl ? "من رقم" : "From #"}</label>
                <Input value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} type="number" min={1} max={activeStickers.length}
                  className="h-9 w-20 text-center font-bold" placeholder="1" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#47759c] block mb-0.5">{isRtl ? "إلى رقم" : "To #"}</label>
                <Input value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} type="number" min={1} max={activeStickers.length}
                  className="h-9 w-20 text-center font-bold" placeholder={String(activeStickers.length)} />
              </div>
              <button onClick={applyRange} className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-[#0E76AC] hover:opacity-90">
                {isRtl ? "حدّد النطاق" : "Select range"}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={selectAll} className="h-9 px-3 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:border-[#0E76AC]">
                {isRtl ? "تحديد الكل" : "Select all"}
              </button>
              <button onClick={clearSel} className="h-9 px-3 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:border-red-400 text-red-500">
                {isRtl ? "مسح التحديد" : "Clear"}
              </button>
            </div>
            <button
              onClick={() => setPendingPrint("selected")}
              disabled={selected.size === 0}
              className="h-9 px-4 rounded-lg text-xs font-black text-white flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}
            >
              <Printer className="h-3.5 w-3.5" />
              {isRtl ? `طباعة المحدَّد (${selected.size})` : `Print selected (${selected.size})`}
            </button>
            <p className="text-[11px] text-[#47759c] w-full">
              {isRtl
                ? "💡 لو الطابعة وقفت، اكتب من رقم الاستيكر اللي وقف لآخر رقم، «حدّد النطاق»، ثم «طباعة المحدَّد» — يطبع المتبقّي بس."
                : "💡 If the printer stopped, enter the range from where it stopped, Select range, then Print selected — reprints only those."}
            </p>
          </div>
        )}
      </div>

      {/* ── Sticker grid (visible on screen + print) ── */}
      {activeStickers.length === 0 ? (
        <div className="print:hidden flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "#3cc4f012", border: "1.5px solid #3cc4f025" }}>
            <Printer className="h-7 w-7" style={{ color: "#3cc4f0" }} />
          </div>
          <p className="text-sm font-semibold text-gray-400">
            {isRtl ? "لا توجد ستيكرات لهذا التاريخ والوقت" : "No stickers for this date and time"}
          </p>
          <p className="text-xs text-gray-300">
            {isRtl ? "تأكد من وجود خطط مؤكدة للتاريخ المختار" : "Make sure there are confirmed plans for the selected date"}
          </p>
        </div>
      ) : (
        <div className={cn("print-grid mt-4", pendingPrint === "selected" && "scope-selected")}>
          {activeStickers.map((s0: any, idx: number) => {
            const isSel = selected.has(idx);
            // التعديل لحظي لهذه الطباعة فقط: السعرات والماكروز تتغير بنسبة واحدة.
            const ov = calOverride[idx];
            const s = (activeTab === "MEALS" && ov != null)
              ? scaleStickerMacros(s0, ov)
              : s0;
            const hasBaseMacros = toSafeNumber(s0.protein) > 0 || toSafeNumber(s0.carbs) > 0 || toSafeNumber(s0.fats) > 0;
            return (
              <div key={idx} className={cn("st-item", !isSel && "st-not-selected")}>
                {/* رأس التحديد + تعديل السعرات — على الشاشة فقط، يختفي في الطباعة */}
                <div className="print:hidden flex items-center gap-1.5 mb-1">
                  <label className={cn(
                    "flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-black rounded-md px-1.5 py-0.5 w-fit",
                    isSel ? "bg-[#0E76AC] text-white" : "bg-slate-100 text-slate-500",
                  )}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleOne(idx)} className="h-3 w-3" />
                    #{idx + 1}
                  </label>
                  {activeTab === "MEALS" && (
                    <div className={cn("flex items-center gap-1 text-[11px] rounded-md px-1.5 py-0.5",
                      ov != null ? "bg-amber-100 text-amber-700 font-bold" : "bg-slate-50 text-slate-400")}>
                      <span>cal</span>
                      <input
                        type="number" min={0} step={1} dir="ltr"
                        className="w-14 h-5 text-center rounded border border-slate-200 bg-white text-slate-700"
                        value={ov != null ? String(ov) : (s0.calories ?? "")}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCalOverride((prev) => {
                            const next = { ...prev };
                            if (v === "" ) { delete next[idx]; return next; }
                            next[idx] = Math.max(0, Number(v));
                            return next;
                          });
                        }}
                        title={isRtl ? "عدّل السعرات لهذه الطباعة فقط" : "Edit calories for this print only"}
                      />
                      {ov != null && (
                        <span className={cn("whitespace-nowrap text-[9px] font-black", hasBaseMacros ? "text-emerald-700" : "text-rose-600")}
                          title={hasBaseMacros
                            ? (isRtl ? "تم تحديث البروتين والكربوهيدرات والدهون بنفس النسبة" : "Protein, carbs and fats were scaled proportionally")
                            : (isRtl ? "لا توجد ماكروز أصلية لإعادة حسابها" : "No base macros available to recalculate")}>
                          {hasBaseMacros ? "P/C/F ✓" : (isRtl ? "بلا ماكروز" : "No macros")}
                        </span>
                      )}
                      {ov != null && (
                        <button type="button" onClick={() => setCalOverride((p) => { const n = { ...p }; delete n[idx]; return n; })}
                          className="text-amber-600 hover:text-amber-800" title={isRtl ? "رجوع للأصلي" : "Reset"}>↺</button>
                      )}
                    </div>
                  )}
                </div>
                {activeTab === "MEALS" ? <MealSticker s={s} /> : <BoxSticker s={s} />}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        /* ── Grid ── */
        .print-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, var(--label-w));
          gap: var(--gap);
        }

        /* ── Base label — premium feel ── */
        .label {
          width: var(--label-w);
          height: var(--label-h);
          padding: 0.3mm 2.5mm 1.2mm;
          border: 0.5px solid #000;
          border-radius: 1.5mm;
          background: #fff;
          font-family: 'Cairo', 'Tahoma', 'Segoe UI', 'Helvetica Neue', sans-serif;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .label, .label * {
          opacity: 1 !important;
          text-shadow: none !important;
          filter: none !important;
        }

        /* Default text color is black, except brand and macros which keep their colors */
        .cust-line, .meal-line, .date-label, .date-value, .cust-num-inline,
        .cust-sub, .goal-badge, .cust-phone {
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
        }

        /* Customer sub-line: goal + phone */
        .cust-sub {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2mm;
          margin-top: 0.2mm;
          line-height: 1;
        }
        .goal-badge {
          font-size: 9px;
          font-weight: 900;
          border: 0.5px solid #000;
          border-radius: 1mm;
          padding: 0.3mm 1.4mm;
          white-space: nowrap;
        }
        .cust-phone {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.3px;
          direction: ltr;
        }

        /* Force black on print (thermal printer safety) */
        @media print {
          .brand-name, .brand-tag, .macros-cal, .macros-text, .macros-val, .macros-unit {
            color: #000 !important;
            -webkit-text-fill-color: #000 !important;
          }
        }

        /* ── Thermal print hardening — solid black, no dithering ── */
        @media print {
          /* أعلى تخصيص لتغلب على لون العلامة السماوي */
          .label .brand-name, .label .brand-tag,
          .label .goal-badge, .label .cust-phone, .label .warn-line,
          .label .macros-text, .label .cust-num-inline {
            color: #000 !important;
            -webkit-text-fill-color: #000 !important;
          }
          /* Calorie pill + category tag: solid black fill + white text (knockout) */
          .label .macros-cal, .label .meal-cat {
            background: #000 !important;
            border: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .label .macros-val, .label .macros-unit, .label .meal-cat {
            color: #fff !important;
            -webkit-text-fill-color: #fff !important;
          }
          /* القلب: نحوّله لأسود صلب (بدل السماوي الذي يتبعثر) مع الحفاظ على شكله */
          .label .brand-heart {
            display: inline-block !important;
            filter: brightness(0) !important;
            -webkit-filter: brightness(0) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* خط اللوجو أثقل وأوضح للطباعة الحرارية */
          .label .brand-name {
            font-weight: 900 !important;
            letter-spacing: 1.2px !important;
          }
          /* الشارات الأخرى: خلفية بيضاء + حدود سوداء صلبة + نص أسود */
          .label .goal-badge,
          .label .warn-line {
            background: #fff !important;
            border: 0.5px solid #000 !important;
            font-weight: 900 !important;
          }
          /* إطار الباقة: خلفية بيضاء + حدود ونص أسود للطباعة الحرارية */
          .label .plan-box { background: #fff !important; border: 0.6px solid #000 !important; }
          .label .plan-txt { color: #000 !important; -webkit-text-fill-color: #000 !important; }
          /* كل الحدود الرفيعة تبقى أسود صلب */
          .label, .label .date-divider, .label .date-row {
            border-color: #000 !important;
            background: #fff !important;
          }
          /* الخط الفاصل تحت اللوجو خلفيته سوداء — لا تبيّضه وإلا يختفي */
          .label .brand-rule {
            background: #000 !important;
            opacity: 1 !important;
          }
        }

        /* Brand block — heart icon + text, centered top */
        .brand-block {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.8mm;
          line-height: 1;
        }
        .brand-heart {
          width: 5.6mm;
          height: 5.6mm;
          object-fit: contain;
          flex-shrink: 0;
          /* keep heart visible in print */
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .brand-text {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .brand-name {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 1.5px;
          line-height: 1.02;
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          -webkit-text-stroke: 0.2px #000;
        }
        .brand-tag {
          font-size: 7px;
          font-weight: 900;
          letter-spacing: 3px;
          margin-top: 0.2mm;
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
        }
        .brand-rule {
          height: 0.5mm;
          width: 100%;
          background: #000 !important;
          margin: 0.6mm 0 0.3mm;
          opacity: 1;
        }

        /* Center content area — strictly centered, with breathing room */
        .content-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0.2mm 0 0.3mm;
          gap: 0.6mm;
          min-height: 0;
          overflow: hidden;
          text-align: center;
          width: 100%;
        }
        .content-center > * {
          text-align: center !important;
        }

        /* Customer name — main title, heavy black, centered */
        .cust-line {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.2px;
          text-align: center !important;
          line-height: 1.12;
          width: 100%;
          margin: 0 auto;
          overflow: visible;
          padding: 0.1mm 1mm;
          text-transform: uppercase;
        }

        /* Meal category tag — نوع الوجبة (LUNCH / BREAKFAST / SNACK …) */
        .meal-cat {
          display: inline-block;
          font-size: 7.5px;
          font-weight: 900;
          letter-spacing: 0.8px;
          line-height: 1;
          color: #fff !important;
          -webkit-text-fill-color: #fff !important;
          background: #000 !important;
          border-radius: 1mm;
          padding: 0.5mm 1.8mm;
          text-transform: uppercase;
          flex-shrink: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Meal name — under customer, biggest info after the name */
        .meal-line {
          font-size: 10.5px;
          font-weight: 900;
          letter-spacing: 0.3px;
          text-align: center !important;
          line-height: 1.12;
          overflow: visible;
          margin: 0 auto;
          width: 100%;
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          text-transform: uppercase;
          padding: 0.15mm 1mm;
        }

        /* Macros + Calories row — سطر واحد (nowrap) حتى لا يلتفّ فيزقّ الممنوعات
           خارج منطقة العرض. المحتوى قصير (فئة + سعرات + P/C/F) فيتّسع. */
        .macros-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.4mm;
          margin-top: 0;
          flex-wrap: nowrap;
          white-space: nowrap;
          line-height: 1;
          max-width: 100%;
        }
        /* Calories — solid black pill with white knockout text (crisp on thermal) */
        .macros-cal {
          display: inline-flex;
          align-items: baseline;
          gap: 0.6mm;
          padding: 0.35mm 2mm;
          border-radius: 1mm;
          background: #000 !important;
          border: none;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .macros-val {
          font-size: 10px;
          font-weight: 900;
          color: #fff !important;
          -webkit-text-fill-color: #fff !important;
        }
        .macros-unit {
          font-size: 6.5px;
          font-weight: 900;
          color: #fff !important;
          -webkit-text-fill-color: #fff !important;
          letter-spacing: 0.5px;
        }
        .macros-text {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.3px;
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          border: 0.5px solid #000;
          border-radius: 1mm;
          padding: 0.4mm 1.8mm;
          white-space: nowrap;
        }

        /* Box sticker — إطار أنيق حول الباقة (بديل النص العاري) */
        .plan-box {
          margin: 0.7mm auto 0;
          border: 0.6px solid #0E2A4A;
          border-radius: 1.6mm;
          padding: 1mm 2.2mm;
          background: #f2fbff;
          max-width: 95%;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .plan-txt {
          font-size: 8.5px;
          font-weight: 900;
          color: #0E2A4A !important;
          -webkit-text-fill-color: #0E2A4A !important;
          line-height: 1.18;
          text-align: center;
          direction: ltr;
        }

        /* Warnings — red pill, centered. يلتفّ لسطرين مضغوطين (بدل سطر عريض
           ينزل تحت ويلامس الفوتر)، وباتجاه LTR حتى لا يختلّ الاقتصاص. */
        .warn-line {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          font-size: 6.5px;
          font-weight: 900;
          color: #b91c1c !important;
          -webkit-text-fill-color: #b91c1c !important;
          text-align: center !important;
          line-height: 1.05;
          margin: 0.35mm auto 0;
          padding: 0.25mm 1mm;
          border-radius: 1mm;
          background: rgba(220,38,38,0.08) !important;
          border: 0.5px solid rgba(220,38,38,0.5);
          max-width: 96%;
          overflow: hidden;
          white-space: normal;
          overflow-wrap: anywhere;
          direction: ltr;
          align-self: center;
          letter-spacing: 0.2px;
        }

        /* Footer — لا يُسمح للمحتوى بالطغيان عليه */
        .date-row {
          display: flex;
          align-items: stretch;
          flex-shrink: 0;
          border-top: 0.5px solid #000;
          padding-top: 0.7mm;
          gap: 0;
        }
        .date-cell {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1;
          min-width: 0;
        }
        .date-divider {
          width: 0.5px;
          background: #000 !important;
          flex-shrink: 0;
          margin: 0 0.5mm;
        }
        .date-label {
          font-size: 6.5px;
          font-weight: 900;
          letter-spacing: 0.6px;
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          margin-bottom: 0.4mm;
          text-transform: uppercase;
        }
        .date-value {
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: 0.2px;
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          -webkit-text-stroke: 0.15px #000;
        }
        .cust-num-inline {
          font-size: 12px;
          letter-spacing: 0;
        }

        @media print {
          .print\\:hidden { display: none !important; }
          body { margin: 0; }
          .print-grid { margin: 0 !important; }
          /* ✅ عند «طباعة المحدَّد»: نخفي غير المحدد فلا يُطبع */
          .print-grid.scope-selected .st-not-selected { display: none !important; }
          ${printerMode === "label" ? `
          /* ── وضع طابعة الاستيكرات: كل استيكر = صفحة مستقلة بمقاس الليبل بالظبط ── */
          @page {
            size: ${clamp(labelW, 20, 120)}mm ${clamp(labelH, 15, 120)}mm;
            margin: 0;
          }
          html, body { width: ${clamp(labelW, 20, 120)}mm; }
          .print-grid { display: block !important; gap: 0 !important; }
          /* فاصل الصفحة على الغلاف (st-item) لا على .label — لأن كل .label صار
             آخر عنصر داخل غلافه؛ ونستخدم break-before حتى لا تخرج صفحة فاضية
             في نهاية «طباعة المحدَّد». */
          .st-item {
            page-break-before: always;
            break-before: page;
            page-break-inside: avoid;
            break-inside: avoid;
            margin: 0 !important;
          }
          .st-item:first-child { page-break-before: auto; break-before: auto; }
          .label {
            width: ${clamp(labelW, 20, 120)}mm !important;
            height: ${clamp(labelH, 15, 120)}mm !important;
            margin: 0 !important;
            border: none !important;        /* حافة الورقة هي حدود الاستيكر */
            border-radius: 0 !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          ` : `
          /* ── وضع ورقة A4: شبكة مع منع قصّ الاستيكر بين صفحتين ── */
          @page { size: A4 portrait; margin: 6mm; }
          .st-item, .label { page-break-inside: avoid; break-inside: avoid; }
          `}
        }
      `}</style>
    </div>
  );
}

// Helper to extract clean meal name and warnings from possibly-injected data
function parseMealData(s: any) {
  const raw = String(s.mealName || s.mealTitle || "").trim();
  // Strip the legacy injected pattern "MEAL — [warnings] | [warnings]"
  let mealName = raw;
  let extraWarnings: string[] = [];

  if (raw.includes("—")) {
    const [nameSide, ...rest] = raw.split("—");
    mealName = nameSide.trim();
    const restText = rest.join("—");
    // Extract any "NO X, NO Y" or "[ITEMS]" patterns
    const cleanedRest = restText
      .replace(/\[(?:⚠|✕|⚖|★)[^\]]*\]/g, "")
      .replace(/[\[\]]/g, "")
      .replace(/ممنوع:/g, "")
      .replace(/[✕⚠⚖★|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanedRest) extraWarnings.push(cleanedRest);
  } else {
    // Try removing leading bracketed warnings if any
    mealName = raw.replace(/^\[.*?\]\s*/, "").trim();
  }

  // Combine with explicit warnings field ثم **إزالة التكرار**: مصادر الممنوعات
  // (حساسية العميل + ممنوعاته + المُعدِّلات) كثيراً ما تتداخل فيتكرر نفس العنصر
  // ("No onion, No onion"). نفصل على • و، ونوحّد بلا حساسية لحالة الأحرف.
  const combined = [s.warnings, ...extraWarnings].filter(Boolean).join(" • ");
  const seen = new Set<string>();
  const uniq: string[] = [];
  combined.split(/[•,،]/).forEach((tok) => {
    const t = tok.replace(/\s+/g, " ").trim();
    const k = t.toLowerCase();
    if (t && !seen.has(k)) { seen.add(k); uniq.push(t); }
  });
  const warnings = uniq.join(", ");
  return { mealName: mealName || raw, warnings };
}

function MealSticker({ s }: any) {
  const { mealName, warnings } = parseMealData(s);

  // ✅ ابني سطر الماكروز
  const macrosLine = (() => {
    if (s.protein || s.carbs || s.fats) {
      const parts = [];
      if (s.protein) parts.push(`P ${s.protein}`);
      if (s.carbs)   parts.push(`C ${s.carbs}`);
      if (s.fats)    parts.push(`F ${s.fats}`);
      return parts.join("  •  ");
    }
    if (s.macros) return String(s.macros);
    return "";
  })();

  return (
    <div className="label">
      {/* Brand header — heart icon + ADRENALINE logo + HEALTHY FOOD tag */}
      <div className="brand-block">
        <img src="/heart-logo.png" alt="" className="brand-heart" />
        <div className="brand-text">
          <div className="brand-name">ADRENALINE</div>
          <div className="brand-tag">HEALTHY FOOD</div>
        </div>
      </div>
      <div className="brand-rule" />

      {/* Center content */}
      <div className="content-center">
        <div className="cust-line">{s.customerName}</div>
        {(s.goal || s.customerNumber) && (
          <div className="cust-sub">
            {s.goal ? <span className="goal-badge">{s.goal}</span> : null}
            {s.customerNumber ? <span className="cust-phone">{s.customerNumber}</span> : null}
          </div>
        )}
        <div className="meal-line">{mealName}</div>

        {/* التصنيف + السعرات + الماكروز في صف واحد */}
        {(macrosLine || s.calories || s.category) && (
          <div className="macros-row">
            {s.category ? <span className="meal-cat">{s.category}</span> : null}
            {s.calories ? (
              <span className="macros-cal">
                <span className="macros-val">{s.calories}</span>
                <span className="macros-unit">kcal</span>
              </span>
            ) : null}
            {macrosLine ? <span className="macros-text">{macrosLine}</span> : null}
          </div>
        )}

        {warnings ? <div className="warn-line">{warnings}</div> : null}
      </div>

      {/* Footer */}
      <div className="date-row">
        <div className="date-cell">
          <div className="date-label">No.</div>
          <div className="date-value cust-num-inline">{s.customerNo}</div>
        </div>
        <div className="date-divider" />
        <div className="date-cell">
          <div className="date-label">EXP</div>
          <div className="date-value">{s.expDate || s.dateText}</div>
        </div>
        <div className="date-divider" />
        <div className="date-cell">
          <div className="date-label">PROD</div>
          <div className="date-value">{s.prodDate || s.dateText}</div>
        </div>
      </div>
    </div>
  );
}

function BoxSticker({ s }: any) {
  return (
    <div className="label">
      <div className="brand-block">
        <img src="/heart-logo.png" alt="" className="brand-heart" />
        <div className="brand-text">
          <div className="brand-name">ADRENALINE</div>
          <div className="brand-tag">HEALTHY FOOD</div>
        </div>
      </div>
      <div className="brand-rule" />

      <div className="content-center">
        <div className="cust-line">{s.customerName}</div>
        {s.customerNumber && (
          <div className="cust-sub">
            <span className="cust-phone">{s.customerNumber}</span>
          </div>
        )}
        <div className="plan-box"><div className="plan-txt">{s.planLabel}</div></div>
      </div>

      <div className="date-row">
        <div className="date-cell">
          <div className="date-label">No.</div>
          <div className="date-value cust-num-inline">{s.customerNo}</div>
        </div>
        <div className="date-divider" />
        <div className="date-cell">
          <div className="date-label">SHIFT</div>
          <div className="date-value">{s.deliveryTime === "MORNING" ? "Morning" : "Evening"}</div>
        </div>
        <div className="date-divider" />
        <div className="date-cell">
          <div className="date-label">GOAL</div>
          <div className="date-value">{(s.program || s.goal || "—").toString().toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
}
