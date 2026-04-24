// client/src/pages/Stickers.tsx
import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, RotateCcw } from "lucide-react";
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

  const DEFAULTS = useMemo(
    () => ({
      w: 70,
      h: 35,
      gap: 4,
      pad: 3.2,
    }),
    [],
  );

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

  function resetSizes() {
    setLabelW(DEFAULTS.w);
    setLabelH(DEFAULTS.h);
    setGap(DEFAULTS.gap);
    setPad(DEFAULTS.pad);
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="space-y-6 p-6"
      style={{
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        ...styleVars,
      }}
    >
      {/* Controls */}
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="space-y-1">
              <div className="text-sm font-semibold">
                {isRtl ? "التاريخ" : "Date"}
              </div>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-semibold">
                {isRtl ? "وقت التوصيل" : "Delivery Time"}
              </div>
              <Tabs
                value={deliveryTime}
                onValueChange={(v) => setDeliveryTime(v as DeliveryTime)}
              >
                <TabsList>
                  <TabsTrigger value="MORNING">
                    {isRtl ? "صباحي" : "MORNING"}
                  </TabsTrigger>
                  <TabsTrigger value="EVENING">
                    {isRtl ? "مسائي" : "EVENING"}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
            {isRtl ? "طباعة" : "Print"}
          </Button>
        </div>

        {/* Sticker size controls */}
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">
              {isRtl ? "مقاس الستيكر (مم)" : "Sticker Size (mm)"}
            </div>
            <Button size="sm" variant="outline" onClick={resetSizes}>
              <RotateCcw className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
              {isRtl ? "إعادة ضبط" : "Reset"}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              type="number"
              value={labelW}
              onChange={(e) => setLabelW(toSafeNumber(e.target.value))}
            />
            <Input
              type="number"
              value={labelH}
              onChange={(e) => setLabelH(toSafeNumber(e.target.value))}
            />
            <Input
              type="number"
              value={gap}
              onChange={(e) => setGap(toSafeNumber(e.target.value))}
            />
            <Input
              type="number"
              value={pad}
              onChange={(e) => setPad(toSafeNumber(e.target.value))}
            />
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
        >
          <TabsList>
            <TabsTrigger value="MEALS">
              {isRtl ? "ستيكرات الوجبات" : "Meal Stickers"}
            </TabsTrigger>
            <TabsTrigger value="BOX">
              {isRtl ? "ستيكرات البوكس" : "Box Stickers"}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* PRINT */}
      <div>
        <div className="print-grid">
          {(activeTab === "MEALS" ? mealStickers : boxStickers).map(
            (s: any, idx: number) =>
              activeTab === "MEALS" ? (
                <MealSticker key={idx} s={s} idx={idx} />
              ) : (
                <BoxSticker key={idx} s={s} idx={idx} />
              ),
          )}
        </div>
      </div>

      <style>{`
        .print-grid{
          display: grid;
          grid-template-columns: repeat(auto-fill, var(--label-w));
          gap: var(--gap);
        }

        .label{
          width: var(--label-w);
          height: var(--label-h);
          padding: var(--pad);
          border: 1px solid #00000022;
          border-radius: 6px;
          position: relative;
          background: #fff;
          font-family: Arial, sans-serif;
          overflow: hidden;
        }

        /* ✅ خلي أي نص جوّا الستيكر أسود/واضح (عشان الثيم الداكن) */
        .label, .label *{
          color: #000 !important;
          opacity: 1 !important;
          text-shadow: none !important;
          filter: none !important;
          -webkit-text-fill-color: #000 !important;
        }

        /* 🔵 رقم العميل داخل دائرة */
        .slNo{
          position: absolute;
          top: 2.5mm;
          left: 2.5mm;
          z-index: 999;

          width: 7mm;
          height: 7mm;

          border-radius: 50%;
          background: #000 !important;

          /* أهم سطرين عشان الرقم يظهر */
          color: #fff !important;
          -webkit-text-fill-color: #fff !important;

          font-weight: 900;
          font-size: 12px;

          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .brand{
          font-size: 14px;
          font-weight: 900;
          text-align: center;
          margin-top: 1mm;
        }

        .name{
          margin-top: 2mm;
          font-size: 13px;
          font-weight: 800;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meal{
          margin-top: 2mm;
          font-size: 10px;
          text-align: center;
          height: 12mm;
          overflow: hidden;
        }

        .row{
          display:flex;
          justify-content: space-between;
          font-size: 11px;
          margin-top: 2mm;
          font-weight: 700;
        }

        @media print {
          .print\\:hidden { display:none }
          body { margin: 0 }
        }
      `}</style>
    </div>
  );
}

function MealSticker({ s }: any) {
  return (
    <div className="label">
      <div className="slNo">{s.customerNo}</div>
      <div className="brand">ADRENALINE</div>
      <div className="name">{s.customerName}</div>
      <div className="meal">{s.mealTitle}</div>
      <div className="row">
        <span>{s.dateText}</span>
        <span>{s.caloriesText}</span>
      </div>
    </div>
  );
}

function BoxSticker({ s }: any) {
  return (
    <div className="label">
      <div className="slNo">{s.customerNo}</div>
      <div className="brand">ADRENALINE</div>
      <div className="name">{s.customerName}</div>
      <div className="meal">{s.customerNumber}</div>
      <div className="row">
        <span>{s.deliveryTime}</span>
        <span>{s.planLabel}</span>
      </div>
    </div>
  );
}
