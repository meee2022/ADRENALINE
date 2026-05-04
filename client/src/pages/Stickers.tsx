// client/src/pages/Stickers.tsx
import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Printer, RotateCcw, Sun, Moon, Package, UtensilsCrossed } from "lucide-react";
import { useStickers } from "@/lib/api";

type DeliveryTime = "MORNING" | "EVENING";
type TabKey = "MEALS" | "BOX";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function toSafeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function Stickers() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [deliveryTime, setDeliveryTime] = useState<DeliveryTime>("MORNING");
  const [activeTab, setActiveTab] = useState<TabKey>("MEALS");

  const DEFAULTS = useMemo(() => ({ w: 70, h: 35, gap: 4, pad: 3.2 }), []);
  const [labelW, setLabelW] = useState(DEFAULTS.w);
  const [labelH, setLabelH] = useState(DEFAULTS.h);
  const [gap, setGap] = useState(DEFAULTS.gap);
  const [pad, setPad] = useState(DEFAULTS.pad);

  const styleVars = useMemo(
    () =>
      ({
        // @ts-expect-error css vars
        "--label-w": `${clamp(labelW, 20, 120)}mm`,
        "--label-h": `${clamp(labelH, 15, 120)}mm`,
        "--gap": `${clamp(gap, 0, 20)}mm`,
        "--pad": `${clamp(pad, 0, 12)}mm`,
      }) as React.CSSProperties,
    [labelW, labelH, gap, pad],
  );

  const data = useStickers({ date, deliveryTime });
  const boxStickers = data?.boxStickers ?? [];
  const mealStickers = data?.mealStickers ?? [];
  const activeStickers = activeTab === "MEALS" ? mealStickers : boxStickers;

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              {isRtl ? "طباعة الستيكرات" : "Stickers Print"}
            </h1>
            <p className="text-sm mt-0.5 font-medium" style={{ color: "#3cc4f0" }}>
              {isRtl ? "معاينة وطباعة ستيكرات الوجبات والبوكس" : "Preview and print meal & box stickers"}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="h-10 px-5 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg, #3cc4f0, #2bb0dc)", boxShadow: "0 4px 14px #3cc4f040" }}
          >
            <Printer className="h-4 w-4" />
            {isRtl ? "طباعة الكل" : "Print All"}
          </button>
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
              <div className="grid grid-cols-2 gap-2">
                {(["MORNING", "EVENING"] as DeliveryTime[]).map((t) => {
                  const active = deliveryTime === t;
                  const isMorn = t === "MORNING";
                  return (
                    <button
                      key={t}
                      onClick={() => setDeliveryTime(t)}
                      className={cn(
                        "h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all border",
                        active
                          ? isMorn
                            ? "text-white border-transparent"
                            : "text-white border-transparent"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
                      )}
                      style={active ? {
                        background: isMorn
                          ? "linear-gradient(135deg, #f59e0b, #fcd34d)"
                          : "linear-gradient(135deg, #47759c, #5a8ab5)",
                        boxShadow: `0 3px 10px ${isMorn ? "#f59e0b40" : "#47759c40"}`,
                      } : {}}
                    >
                      {isMorn ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {isRtl ? (isMorn ? "صباحي" : "مسائي") : (isMorn ? "Morning" : "Evening")}
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
            <div className="grid grid-cols-4 gap-3">
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
        <div className="print-grid mt-4">
          {activeStickers.map((s: any, idx: number) =>
            activeTab === "MEALS"
              ? <MealSticker key={idx} s={s} />
              : <BoxSticker key={idx} s={s} />
          )}
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
          padding: 1.5mm 2.5mm 1.2mm;
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
          color: #000 !important;
          opacity: 1 !important;
          text-shadow: none !important;
          filter: none !important;
          -webkit-text-fill-color: #000 !important;
        }

        /* Brand block — centered top */
        .brand-block {
          text-align: center;
          line-height: 1;
        }
        .brand-name {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 2.5px;
          line-height: 1;
        }
        .brand-tag {
          font-size: 4.5px;
          font-weight: 700;
          letter-spacing: 2.5px;
          margin-top: 0.5mm;
          color: #555 !important;
          -webkit-text-fill-color: #555 !important;
        }
        .brand-rule {
          height: 0.5px;
          background: #000 !important;
          margin: 1mm 0 0;
          opacity: 0.5;
        }

        /* Center content area */
        .content-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0.5mm 0;
          gap: 0.3mm;
          min-height: 0;
        }

        /* Customer name — main focus, italic bold */
        .cust-line {
          font-size: 11.5px;
          font-weight: 900;
          font-style: italic;
          letter-spacing: 0.3px;
          text-align: center;
          line-height: 1.15;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }

        /* Meal name — under customer */
        .meal-line {
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-align: center;
          line-height: 1.2;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          margin-top: 0.4mm;
          color: #1a1a1a !important;
          -webkit-text-fill-color: #1a1a1a !important;
        }

        /* Warnings — red bold, no icons */
        .warn-line {
          font-size: 7px;
          font-weight: 800;
          color: #b91c1c !important;
          -webkit-text-fill-color: #b91c1c !important;
          text-align: center;
          line-height: 1.15;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          margin-top: 0.5mm;
          width: 100%;
        }

        /* Footer */
        .date-row {
          display: flex;
          align-items: stretch;
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
          font-size: 4.5px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #666 !important;
          -webkit-text-fill-color: #666 !important;
          margin-bottom: 0.3mm;
          text-transform: uppercase;
        }
        .date-value {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.2px;
        }
        .cust-num-inline {
          font-size: 12px;
          letter-spacing: 0;
        }

        @media print {
          .print\\:hidden { display: none !important; }
          body { margin: 0; }
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

  // Combine with explicit warnings field
  const warnings = [s.warnings, ...extraWarnings].filter(Boolean).join(" • ");
  return { mealName: mealName || raw, warnings };
}

function MealSticker({ s }: any) {
  const { mealName, warnings } = parseMealData(s);
  return (
    <div className="label">
      {/* Brand */}
      <div className="brand-block">
        <div className="brand-name">ADRENALINE</div>
        <div className="brand-tag">HEALTHY FOOD</div>
      </div>
      <div className="brand-rule" />

      {/* Center content */}
      <div className="content-center">
        <div className="cust-line">{s.customerName}</div>
        <div className="meal-line">{mealName}</div>
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
        <div className="brand-name">ADRENALINE</div>
        <div className="brand-tag">HEALTHY FOOD</div>
      </div>
      <div className="brand-rule" />

      <div className="content-center">
        <div className="cust-line">{s.customerName}</div>
        <div className="meal-line">{s.planLabel}</div>
      </div>

      <div className="date-row">
        <div className="date-cell">
          <div className="date-label">No.</div>
          <div className="date-value cust-num-inline">{s.customerNo}</div>
        </div>
        <div className="date-divider" />
        <div className="date-cell">
          <div className="date-label">{s.deliveryTime === "MORNING" ? "AM" : "PM"}</div>
          <div className="date-value">{s.deliveryTime === "MORNING" ? "صباحي" : "مسائي"}</div>
        </div>
        <div className="date-divider" />
        <div className="date-cell">
          <div className="date-label">DATE</div>
          <div className="date-value">{s.dateText}</div>
        </div>
      </div>
    </div>
  );
}
