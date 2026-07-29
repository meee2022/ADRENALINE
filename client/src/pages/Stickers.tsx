// client/src/pages/Stickers.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Printer, RotateCcw, Sun, Moon, Package, UtensilsCrossed, Layers, Search, AlertTriangle } from "lucide-react";
import { useStickers } from "@/lib/api";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { Link } from "wouter";

type DeliveryTime = "MORNING" | "EVENING" | "ALL";
type TabKey = "MEALS" | "BOX" | "CUSTOM";

/** استيكر مشترك مخصّص؟ الباك إند يضع goal="CUSTOMIZED" لاستيكرات القوالب. */
const isCustomizedSticker = (s: any) =>
  String(s?.goal || "").trim().toUpperCase() === "CUSTOMIZED";
type MealCategoryFilter = "ALL" | "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
type CalorieOverrides = Record<string, number>;

const CALORIE_OVERRIDES_STORAGE_KEY = "adrenaline:sticker-calorie-overrides:v1";

function stickerOverrideKey(sticker: any, index: number) {
  return [
    sticker?.stickerKey || "sticker",
    sticker?.customerId || sticker?.customerNumber || sticker?.customerNo || "customer",
    sticker?.prodDate || sticker?.dateText || "date",
    sticker?.mealIndexText || `meal-${index + 1}`,
    sticker?.mealName || sticker?.mealTitle || "meal",
    sticker?.category || "category",
  ].map((part) => String(part).trim().toLowerCase()).join("|");
}

function readCalorieOverrides(): CalorieOverrides {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(CALORIE_OVERRIDES_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value) && value >= 0),
    ) as CalorieOverrides;
  } catch {
    return {};
  }
}

function stickerCategory(value: unknown): Exclude<MealCategoryFilter, "ALL"> | "OTHER" {
  const category = String(value || "").trim().toUpperCase();
  if (category.includes("BREAKFAST")) return "BREAKFAST";
  if (category.includes("LUNCH")) return "LUNCH";
  if (category.includes("DINNER")) return "DINNER";
  // Salads use the subscriber snack allowance, so they belong under the same filter.
  if (category.includes("SNACK") || category.includes("SALAD")) return "SNACK";
  return "OTHER";
}

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
  const [date, setDate] = useState<string>(() =>
    typeof window === "undefined"
      ? format(new Date(Date.now() + 86400000), "yyyy-MM-dd")
      : new URLSearchParams(window.location.search).get("date")
        || format(new Date(Date.now() + 86400000), "yyyy-MM-dd"),
  );
  // «الكل» هو الافتراضي: الطباعة تتم لليوم كاملاً، والبدء على «صباحي» كان يُخفي
  // نصف الرزمة حتى ينتبه أحد لتبديلها.
  const [deliveryTime, setDeliveryTime] = useState<DeliveryTime>("ALL");
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
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const productionAudit = useQuery(api.productionAudit.forDate, { date, sessionToken }) as any;
  const data = useStickers({ date, deliveryTime, lang: "en" });
  const boxStickers = data?.boxStickers ?? [];
  /* تدقيق الخادم: من يُطبع له استيكر وليس في كشف المطبخ (أو العكس). فارقٌ
     واحد يعني بوكساً بلا أكل أو أكلاً بلا بوكس — يُرى قبل الطباعة لا بعد الطبخ. */
  const audit = (data as any)?.audit as { onlyStickers: string[]; onlyKitchen: string[] } | undefined;
  const mismatchCount = (audit?.onlyStickers?.length || 0) + (audit?.onlyKitchen?.length || 0);
  const allMealStickers = data?.mealStickers ?? [];
  const renderedDuplicateCount = useMemo(() => {
    const duplicateCount = (values: string[]) => values.length - new Set(values).size;
    const boxKeys = boxStickers.map((row: any) => String(row.customerId || "")).filter(Boolean);
    const mealKeys = allMealStickers.map((row: any) => String(row.stickerKey || "")).filter(Boolean);
    return duplicateCount(boxKeys) + duplicateCount(mealKeys);
  }, [boxStickers, allMealStickers]);
  const printAllowed =
    productionAudit?.canPrint === true &&
    mismatchCount === 0 &&
    renderedDuplicateCount === 0;
  // ✅ فصل المخصّصين في تبويب مستقل (طلب المستخدم): تبويب «الوجبات» للعاديين فقط،
  //    وتبويب «المخصّصون» يعرضهم **مجمّعين بالعميل** — كل وجبات الشخص ورا بعض
  //    بترتيب رقم البوكس، فالطباعة تطلع اسم ورا اسم بلا تشتيت.
  const mealStickers = useMemo(
    () => allMealStickers.filter((s: any) => !isCustomizedSticker(s)),
    [allMealStickers],
  );
  const customStickers = useMemo(() => {
    const rows = allMealStickers.filter((s: any) => isCustomizedSticker(s));
    return rows
      .map((s: any, i: number) => ({ s, i }))
      .sort((a, b) => {
        // نفس ترتيب كشف الشيف حرفياً — المطبخ يمشي بالكشف، والتغليف يمشي بالاستيكرات،
        // فلو اختلف الترتيبان تاه من يطابق بينهما. الكشف يرتّب المخصّصين بالاسم:
        //   list.sort((a, b) => a.name.localeCompare(b.name))   (Kitchen.tsx)
        // فنستخدم نفس المقارنة بلا وسيط لغة — الترتيب برقم البوكس كان يخالفه.
        const cmp = String(a.s.customerName || "").localeCompare(String(b.s.customerName || ""));
        if (cmp !== 0) return cmp;
        return a.i - b.i;                                     // ثم وجبات نفس الشخص بترتيبها
      })
      .map(({ s }) => s);
  }, [allMealStickers]);
  const activeStickers = activeTab === "MEALS" ? mealStickers
    : activeTab === "CUSTOM" ? customStickers
    : boxStickers;
  const isMealLike = activeTab === "MEALS" || activeTab === "CUSTOM";

  // ✅ تحديد استيكرات لطباعتها لوحدها (لو الطابعة وقفت في نص الطباعة، تعيد المتبقّي فقط)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  // طباعة مؤجّلة: نضبط النطاق قبل ما نفتح مربّع الطباعة
  const [pendingPrint, setPendingPrint] = useState<null | "all" | "selected">(null);

  // تعديل خاص باستيكر هذا اليوم. يُحفظ منفصلًا عن بيانات الوجبة وخطة المشترك.
  const [calOverride, setCalOverride] = useState<CalorieOverrides>(readCalorieOverrides);
  // ✅ بحث بالاسم/الرقم للوصول السريع لستيكر شخص معيّن (بدل تصفّح المئات)
  const [search, setSearch] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("search") || "",
  );
  const [mealCategory, setMealCategory] = useState<MealCategoryFilter>("ALL");
  const initialFiltersRef = useRef(true);
  // امسح أدوات العرض عند تبدّل القائمة، مع إبقاء تعديلات السعرات حتى انتهاء جلسة الطباعة.
  useEffect(() => {
    if (initialFiltersRef.current) {
      initialFiltersRef.current = false;
      return;
    }
    setSelected(new Set());
    setRangeFrom("");
    setRangeTo("");
    setSearch("");
    setMealCategory("ALL");
  }, [activeTab, date, deliveryTime]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CALORIE_OVERRIDES_STORAGE_KEY, JSON.stringify(calOverride));
    } catch {
      // الطباعة تظل تعمل حتى إذا منع المتصفح التخزين المؤقت.
    }
  }, [calOverride]);

  // ✅ تجميد أرقام البوكس لهذا اليوم عند فتحه — فيبقى رقم كل مشترك ثابتاً طوال اليوم
  //    حتى لو أُضيف/عُدّل مشتركون بعد الطباعة (الجديد ياخد رقماً مُلحقاً فقط).
  const ensureBoxNumbers = useMutation(api.stickers.ensureBoxNumbers);
  const saveCalorieOverride = useMutation(api.stickers.setCalorieOverride);
  const clearSavedCalorieOverrides = useMutation(api.stickers.clearCalorieOverrides);
  const [overrideSaveStatus, setOverrideSaveStatus] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [overrideActionError, setOverrideActionError] = useState("");
  useEffect(() => {
    if (!date || !sessionToken) return;
    ensureBoxNumbers({ date, sessionToken }).catch(() => { /* لا نُعطّل العرض */ });
  }, [date, sessionToken, ensureBoxNumbers]);

  const persistCalorieOverride = async (sticker: any, index: number, calories?: number) => {
    const localKey = stickerOverrideKey(sticker, index);
    if (!sessionToken || !sticker?.stickerKey || !sticker?.customerId) {
      setOverrideSaveStatus((prev) => ({ ...prev, [localKey]: "error" }));
      setOverrideActionError(isRtl ? "تعذّر حفظ التعديل في قاعدة البيانات" : "Could not save this change");
      return;
    }
    setOverrideActionError("");
    setOverrideSaveStatus((prev) => ({ ...prev, [localKey]: "saving" }));
    try {
      await saveCalorieOverride({
        date,
        customerId: sticker.customerId as any,
        stickerKey: sticker.stickerKey,
        calories,
        sessionToken,
      });
      setOverrideSaveStatus((prev) => ({ ...prev, [localKey]: "saved" }));
    } catch {
      setOverrideSaveStatus((prev) => ({ ...prev, [localKey]: "error" }));
      setOverrideActionError(isRtl ? "لم يُحفظ تعديل السعرات. أعد المحاولة." : "Calories were not saved. Please retry.");
    }
  };

  const resetCalorieOverride = async (sticker: any, index: number) => {
    const localKey = stickerOverrideKey(sticker, index);
    setCalOverride((prev) => {
      const next = { ...prev };
      delete next[localKey];
      return next;
    });
    await persistCalorieOverride(sticker, index, undefined);
  };

  const clearAllCalorieOverrides = async () => {
    setCalOverride({});
    if (!sessionToken) return;
    setOverrideActionError("");
    try {
      await clearSavedCalorieOverrides({ date, sessionToken });
      setOverrideSaveStatus({});
    } catch {
      setOverrideActionError(isRtl ? "تعذّر مسح التعديلات المحفوظة" : "Could not clear saved changes");
    }
  };

  // الستيكرات الظاهرة: مفلترة بالبحث لكن بأرقامها الأصلية (للتعديل والطباعة).
  //    وقت الطباعة نتجاهل الفلتر تمامًا حتى تُطبع كل الستيكرات.
  const searchQ = pendingPrint ? "" : search.trim().toLowerCase();
  const categoryQ: MealCategoryFilter = pendingPrint ? "ALL" : mealCategory;
  const categoryCounts = useMemo(() => {
    const counts: Record<MealCategoryFilter, number> = {
      ALL: mealStickers.length,
      BREAKFAST: 0,
      LUNCH: 0,
      DINNER: 0,
      SNACK: 0,
    };
    mealStickers.forEach((sticker: any) => {
      const category = stickerCategory(sticker.category);
      if (category !== "OTHER") counts[category] += 1;
    });
    return counts;
  }, [mealStickers]);
  const visibleStickers = useMemo(
    () => activeStickers
      .map((s0: any, idx: number) => ({ s0, idx }))
      .filter(({ s0 }: any) => {
        if (activeTab === "MEALS" && categoryQ !== "ALL" && stickerCategory(s0.category) !== categoryQ) {
          return false;
        }
        if (!searchQ) return true;
        const hay = [
          s0.customerName,
          s0.customerNumber,
          s0.customerNo,
          s0.mealName,
          s0.mealTitle,
          s0.category,
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(searchQ);
      }),
    [activeStickers, activeTab, categoryQ, searchQ],
  );
  const activeOverrideCount = useMemo(
    () => isMealLike
      ? activeStickers.reduce(
          (count: number, sticker: any, index: number) => count + (
            calOverride[stickerOverrideKey(sticker, index)] != null || sticker?.calorieOverrideSaved ? 1 : 0
          ),
          0,
        )
      : 0,
    [activeStickers, activeTab, calOverride],
  );

  useEffect(() => {
    if (!pendingPrint) return;
    if (!printAllowed) {
      setPendingPrint(null);
      return;
    }
    // الـclass اتطبّق في هذا الرندر، نطبع ثم نصفّر
    window.print();
    const id = setTimeout(() => setPendingPrint(null), 300);
    return () => clearTimeout(id);
  }, [pendingPrint, printAllowed]);

  const toggleOne = (idx: number) =>
    setSelected((s) => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  const selectAll = () => setSelected(new Set(activeStickers.map((_: any, i: number) => i)));
  const clearSel = () => setSelected(new Set());
  /** يبني مجموعة النطاق (1-based من المستخدم → 0-based للمصفوفة). */
  const rangeSet = () => {
    const a = Math.max(1, parseInt(rangeFrom, 10) || 1);
    const b = Math.min(activeStickers.length, parseInt(rangeTo, 10) || activeStickers.length);
    const n = new Set<number>();
    for (let i = a; i <= b; i++) n.add(i - 1);
    return n;
  };
  /* زرّان للطباعة كانا متباعدين، فمن يحدّد نطاقاً ثم يضغط «طباعة الكل» الكبير
     يطبع الرزمة كلها. هذا الزر يفعل الاثنين معاً: التحديد ثم الطباعة — والتحديث
     يقع في نفس الدفعة فيكون الوسم على العناصر قبل أن يفتح مربع الطباعة. */
  const printRange = () => {
    if (!printAllowed) return;
    const n = rangeSet();
    if (!n.size) return;
    setSelected(n);
    setPendingPrint("selected");
  };
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

        {/* تحذير التطابق مع المطبخ — يظهر فقط عند وجود فارق فعلي */}
        {productionAudit && (!productionAudit.canPrint || renderedDuplicateCount > 0) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-black">
                    {isRtl ? "الطباعة متوقفة بسبب أخطاء في خطط اليوم" : "Printing is blocked by daily plan errors"}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {isRtl
                      ? `${productionAudit.blockerCount + renderedDuplicateCount} خطأ مانع. افتح التدقيق اليومي لمعرفة المشتركين والتفاصيل.`
                      : `${productionAudit.blockerCount + renderedDuplicateCount} blocking issue(s). Open the daily audit for customer details.`}
                  </p>
                </div>
              </div>
              <Link href="/production-audit" className="shrink-0 rounded-xl bg-red-700 px-4 py-2.5 text-center text-sm font-black text-white">
                {isRtl ? "فتح التدقيق" : "Open audit"}
              </Link>
            </div>
          </div>
        )}

        {audit && (audit.onlyStickers.length > 0 || audit.onlyKitchen.length > 0) && (
          <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4">
            <p className="text-sm font-black text-rose-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {isRtl ? "الاستيكرات لا تطابق كشف المطبخ لهذا اليوم"
                     : "Stickers don't match the kitchen sheet for this day"}
            </p>
            {audit.onlyStickers.length > 0 && (
              <p className="text-[12px] font-bold text-rose-700 mt-2">
                {isRtl
                  ? `⛔ ${audit.onlyStickers.length} سيُطبع لهم استيكر والمطبخ لا يطبخ لهم — لا تطبع قبل المراجعة: `
                  : `⛔ ${audit.onlyStickers.length} would get stickers but the kitchen isn't cooking for them — check before printing: `}
                <span className="font-black">{audit.onlyStickers.join(" · ")}</span>
              </p>
            )}
            {audit.onlyKitchen.length > 0 && (
              <p className="text-[12px] font-bold text-amber-800 mt-1.5">
                {isRtl
                  ? `⚠ ${audit.onlyKitchen.length} المطبخ يطبخ لهم بلا استيكر: `
                  : `⚠ ${audit.onlyKitchen.length} are cooked for but get no sticker: `}
                <span className="font-black">{audit.onlyKitchen.join(" · ")}</span>
              </p>
            )}
          </div>
        )}

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
              onClick={() => printAllowed && setPendingPrint("all")}
              disabled={!printAllowed}
              className="min-h-11 flex-1 px-5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
              style={{ background: "linear-gradient(135deg, #3cc4f0, #2bb0dc)", boxShadow: "0 4px 14px #3cc4f040" }}
            >
              <Printer className="h-4 w-4" />
              {isRtl ? `طباعة الكل (${activeStickers.length})` : `Print All (${activeStickers.length})`}
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
            { key: "MEALS"  as TabKey, label: isRtl ? "ستيكرات الوجبات" : "Meal Stickers", icon: UtensilsCrossed },
            { key: "CUSTOM" as TabKey, label: isRtl ? "المخصّصون"       : "Customized",    icon: Layers },
            { key: "BOX"    as TabKey, label: isRtl ? "ستيكرات البوكس"  : "Box Stickers",  icon: Package },
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
              <button onClick={applyRange} className="h-9 px-3 rounded-lg text-xs font-bold border border-[#0E76AC] text-[#0E76AC] bg-white hover:bg-[#0E76AC]/5">
                {isRtl ? "حدّد النطاق" : "Select range"}
              </button>
              <button onClick={printRange} disabled={!printAllowed} className="h-9 px-3 rounded-lg text-xs font-black text-white flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
                <Printer className="h-3.5 w-3.5" />
                {isRtl ? "اطبع النطاق" : "Print range"}
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
              onClick={() => printAllowed && setPendingPrint("selected")}
              disabled={selected.size === 0 || !printAllowed}
              className="h-9 px-4 rounded-lg text-xs font-black text-white flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}
            >
              <Printer className="h-3.5 w-3.5" />
              {isRtl ? `طباعة المحدَّد (${selected.size})` : `Print selected (${selected.size})`}
            </button>
            <p className="text-[11px] text-[#47759c] w-full">
              {isRtl
                ? "إذا توقفت الطابعة، فأدخل نطاق أرقام الملصقات بدءًا من الرقم الذي توقفت عنده، ثم اختر «تحديد النطاق» و«طباعة المحدد» لطباعة الملصقات المتبقية فقط."
                : "💡 If the printer stopped, enter the range from where it stopped, Select range, then Print selected — reprints only those."}
            </p>
          </div>
        )}
      </div>

      {/* ── بحث سريع بالاسم/الرقم (لا يظهر في الطباعة) ── */}
      {activeStickers.length > 0 && (
        <div className="print:hidden mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isRtl ? "ابحث باسم المشترك، رقمه أو الوجبة…" : "Search customer, number or meal…"}
                className="w-full h-11 ps-9 pe-8 rounded-xl text-sm bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#3CC4F0] focus:outline-none focus:ring-2 focus:ring-[#3CC4F0]/20 text-slate-700"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-400 hover:text-slate-600" aria-label={isRtl ? "مسح" : "Clear"}>
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
            {(search || mealCategory !== "ALL") && (
              <span className="text-xs font-black text-[#0E76AC] bg-[#e9f6fd] rounded-lg px-3 py-2">
                {isRtl ? `${visibleStickers.length} نتيجة` : `${visibleStickers.length} result(s)`}
              </span>
            )}
            {activeOverrideCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                <span>
                  {isRtl
                    ? `${activeOverrideCount} تعديل محفوظ للطباعة`
                    : `${activeOverrideCount} saved for printing`}
                </span>
                <button
                  type="button"
                  onClick={() => void clearAllCalorieOverrides()}
                  className="rounded-md bg-white px-2 py-1 text-[10px] text-amber-700 shadow-sm hover:bg-amber-100"
                >
                  {isRtl ? "مسح التعديلات" : "Clear"}
                </button>
              </div>
            )}
            {overrideActionError && (
              <span className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {overrideActionError}
              </span>
            )}
          </div>

          {activeTab === "MEALS" && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={isRtl ? "تصفية الاستيكرات حسب نوع الوجبة" : "Filter stickers by meal category"}>
              {([
                { key: "ALL", ar: "الكل", en: "All" },
                { key: "BREAKFAST", ar: "فطور", en: "Breakfast" },
                { key: "LUNCH", ar: "غداء", en: "Lunch" },
                { key: "DINNER", ar: "عشاء", en: "Dinner" },
                { key: "SNACK", ar: "سناك", en: "Snack" },
              ] as const).map(({ key, ar, en }) => {
                const active = mealCategory === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMealCategory(key)}
                    aria-pressed={active}
                    className={cn(
                      "h-10 shrink-0 rounded-xl border px-3.5 text-xs font-black transition-all",
                      active
                        ? "border-[#0E76AC] bg-[#0E76AC] text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-[#3CC4F0] hover:text-[#0E76AC]",
                    )}
                  >
                    {isRtl ? ar : en}
                    <span className={cn(
                      "ms-2 inline-flex min-w-5 justify-center rounded-md px-1.5 py-0.5 tabular-nums",
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                    )}>
                      {categoryCounts[key]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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
      ) : visibleStickers.length === 0 ? (
        <div className="print:hidden flex flex-col items-center justify-center py-16 gap-2">
          <Search className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-gray-400">
            {isRtl ? "لا توجد استيكرات مطابقة للبحث أو التصفية" : "No stickers match the search or filter"}
          </p>
          <button onClick={() => { setSearch(""); setMealCategory("ALL"); }} className="text-xs font-bold text-[#0E76AC] hover:underline">
            {isRtl ? "مسح البحث والتصفية" : "Clear search and filter"}
          </button>
        </div>
      ) : (
        <div className={cn("print-grid mt-4", pendingPrint === "selected" && "scope-selected")}>
          {visibleStickers.map(({ s0, idx }: any, vi: number) => {
            const isSel = selected.has(idx);
            // ✅ في تبويب المخصّصين: فاصل باسم العميل قبل أول وجبة له (على الشاشة فقط)
            //    عشان يبان إن وجباته مجمّعة ورا بعض قبل ما نطبع.
            const prevCust = vi > 0 ? visibleStickers[vi - 1].s0 : null;
            const newCustomer = activeTab === "CUSTOM"
              && String(s0.customerId || s0.customerName) !== String(prevCust?.customerId || prevCust?.customerName || "");
            // تعديل اليوم المحفوظ: السعرات والماكروز تتغير بنسبة واحدة.
            const overrideKey = stickerOverrideKey(s0, idx);
            const ov = calOverride[overrideKey];
            const hasSavedOverride = Boolean(s0.calorieOverrideSaved);
            const hasOverride = ov != null || hasSavedOverride;
            const saveStatus = overrideSaveStatus[overrideKey];
            const s = (isMealLike && ov != null)
              ? scaleStickerMacros(s0, ov)
              : s0;
            const hasBaseMacros = toSafeNumber(s0.protein) > 0 || toSafeNumber(s0.carbs) > 0 || toSafeNumber(s0.fats) > 0;
            return (
              <div key={idx} className={cn("st-item", !isSel && "st-not-selected")}>
                {newCustomer && (
                  <div className="print:hidden st-cust-head mb-1 rounded-lg px-2 py-1 text-[11px] font-black text-white truncate"
                    style={{ background: "linear-gradient(120deg,#0E2A4A,#0E76AC)" }}
                    title={s0.customerName}>
                    #{s0.customerNo || "—"} · {s0.customerName}
                  </div>
                )}
                {/* رأس التحديد + تعديل السعرات — على الشاشة فقط، يختفي في الطباعة */}
                <div className="print:hidden flex items-center gap-1.5 mb-1">
                  <label className={cn(
                    "flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-black rounded-md px-1.5 py-0.5 w-fit",
                    isSel ? "bg-[#0E76AC] text-white" : "bg-slate-100 text-slate-500",
                  )}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleOne(idx)} className="h-3 w-3" />
                    #{idx + 1}
                  </label>
                  {isMealLike && (
                    <div className={cn("flex items-center gap-1 text-[11px] rounded-md px-1.5 py-0.5",
                      hasOverride ? "bg-amber-100 text-amber-700 font-bold" : "bg-slate-50 text-slate-400")}>
                      <span>cal</span>
                      <input
                        type="number" min={1} max={3000} step={1} dir="ltr"
                        className="w-14 h-5 text-center rounded border border-slate-200 bg-white text-slate-700"
                        value={ov != null ? String(ov) : (s0.calories ?? "")}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            setCalOverride((prev) => {
                              const next = { ...prev };
                              delete next[overrideKey];
                              return next;
                            });
                            return;
                          }
                          const calories = Math.max(1, Math.round(Number(v)));
                          if (!Number.isFinite(calories)) return;
                          setCalOverride((prev) => ({ ...prev, [overrideKey]: calories }));
                          void persistCalorieOverride(s0, idx, calories);
                        }}
                        onBlur={(e) => {
                          const calories = Number(e.currentTarget.value);
                          if (Number.isFinite(calories) && calories >= 1) {
                            void persistCalorieOverride(s0, idx, calories);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        title={isRtl ? "تُحفظ السعرات لهذا الاستيكر في هذا اليوم" : "Saved for this sticker on this date"}
                      />
                      {hasOverride && (
                        <span className={cn("whitespace-nowrap text-[9px] font-black", hasBaseMacros ? "text-emerald-700" : "text-rose-600")}
                          title={hasBaseMacros
                            ? (isRtl ? "تم تحديث البروتين والكربوهيدرات والدهون بنفس النسبة" : "Protein, carbs and fats were scaled proportionally")
                            : (isRtl ? "لا توجد ماكروز أصلية لإعادة حسابها" : "No base macros available to recalculate")}>
                          {saveStatus === "saving"
                            ? (isRtl ? "جارٍ الحفظ…" : "Saving…")
                            : saveStatus === "error"
                              ? (isRtl ? "فشل الحفظ" : "Save failed")
                              : (isRtl ? "محفوظ ✓" : "Saved ✓")}
                        </span>
                      )}
                      {hasOverride && (
                        <button type="button" onClick={() => void resetCalorieOverride(s0, idx)}
                          className="text-amber-600 hover:text-amber-800" title={isRtl ? "رجوع للأصلي" : "Reset"}>↺</button>
                      )}
                    </div>
                  )}
                </div>
                {isMealLike ? <MealSticker s={s} seq={idx + 1} /> : <BoxSticker s={s} seq={idx + 1} />}
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
          /* ⬆️ هامش سفلي أوسع: سطر التواريخ كان يلامس حافة الاستيكر عند الطباعة.
             content-center (flex:1 + overflow:hidden) يمتصّ الفرق، فلا يركب شيء
             على شيء. مقيس: أضيق استيكر يملك 8.7px فراغاً، ونأخذ ~4.9px فقط. */
          padding: 0.3mm 2.5mm 2.5mm;
          border: 0.5px solid #000;
          border-radius: 1.5mm;
          background: #fff;
          font-family: 'Cairo', 'Tahoma', 'Segoe UI', 'Helvetica Neue', sans-serif;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .label { position: relative; }
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
          /* ملصق البوكس وحده يحمل الرقم الآن، والتوصيل يقرؤه من مسافة — فكبّر */
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.4px;
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
          .label .macros-text, .label .cust-num-inline, .label .box-no-top {
            color: #000 !important;
            -webkit-text-fill-color: #000 !important;
          }
          .label .box-no-top { border-color: #000 !important; background: #fff !important; }
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
          .label .warn-line { border-width: 1px !important; color: #000 !important; -webkit-text-fill-color: #000 !important; }
          .label .warn-tag {
            background: #000 !important;
            color: #fff !important;
            -webkit-text-fill-color: #fff !important;
            border: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
        .box-no-top {
          /* مثبَّت على أقصى يسار الملصق — لا داخل صفّ الشعار — فيبقى الشعار
             في منتصفه تماماً ويُلتقط الرقم من الطرف بنظرة. */
          position: absolute;
          top: 1mm;
          left: 1.2mm;
          min-width: 5.6mm;
          height: 5.6mm;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0.9px solid #000;
          border-radius: 1mm;
          padding: 0 0.8mm;
          font-size: 13px;
          font-weight: 900;
          -webkit-text-stroke: 0.35px #000; /* الوزن 900 وحده يخرج رفيعاً على الرأس الحراري */
          color: #000;
          box-sizing: border-box;
        }
        .goal-cell { font-size: 6.5px; letter-spacing: 0; }
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
        /* ملصق البوكس أخفّ محتوى من ملصق الوجبة، ففيه متّسع لرقمٍ أكبر —
           وهو الرقم الذي يُنادى به عند التسليم. الوجبة تبقى على 16px. */
        .label-box .cust-num-inline { font-size: 18px; }
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
        .goal-inline {
          font-size: 7px;
          padding: 0.15mm 1mm;
          margin-inline-start: 1.4mm;
          vertical-align: middle;
        }
        .warn-tag {
          display: inline-block;
          background: #b91c1c;
          color: #fff;
          -webkit-text-fill-color: #fff;
          font-size: 5.5px;
          font-weight: 900;
          border-radius: 0.8mm;
          padding: 0.1mm 1mm;
          margin-inline-end: 1mm;
          vertical-align: middle;
          letter-spacing: 0.3px;
        }
        .warn-line {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          font-size: 8.5px;
          font-weight: 900;
          color: #b91c1c !important;
          -webkit-text-fill-color: #b91c1c !important;
          text-align: center !important;
          line-height: 1.05;
          margin: 0.35mm auto 0;
          padding: 0.25mm 1mm;
          border-radius: 1mm;
          background: rgba(220,38,38,0.08) !important;
          border: 1px solid #b91c1c;
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
        /* رقم الترتيب في رزمة الطباعة. حين ينفد الورق يقرأ الطاقم آخر ملصق
           خرج ويكمل من الرقم التالي بدل البحث بالاسم في مئات الملصقات.
           صغير جداً عمداً (5.5px): على ملصق البوكس رقم العميل الكبير أسفل الملصق،
           فلو تقاربا في الحجم اختلطا على من يفرز. أسود صلب لا
           رمادي: الطابعة الحرارية تُبقّع التدرّج، وقاعدة الشفافية على الملصق
           تلغي أي شفافية هنا أصلاً. */
        .seq-mark {
          position: absolute;
          top: 0.4mm;
          inset-inline-end: 0.8mm;
          font-size: 5.5px;
          font-weight: 700;
          letter-spacing: 0;
          color: #000;
          line-height: 1;
        }

        .cust-num-inline {
          /* رقم العميل هو ما يُنادى به عند الفرز والتسليم — أبرز رقم على الملصق.
             الملصق 39مم والخانة تتمدّد، فالزيادة محسوبة: 12px → 16px (+4) بينما
             يمتصّها القسم الأوسط المرن، ولا تُزاح خانتا الوردية والهدف. */
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0;
          line-height: 1.05;
          -webkit-text-stroke: 0.3px #000;
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

function MealSticker({ s, seq }: any) {
  const { mealName, warnings } = parseMealData(s);
  /* أسماء المخصّصين وصفات كاملة («220 G PERI PERI CHICKEN /NO SPICIES…») لا
     أسماء أطباق — على 10.5px تأخذ أربعة أسطر فتدفع التحذير فوق صفّ التواريخ.
     الخط يتدرّج مع الطول فيظل كل شيء داخل حدوده، والأسماء العادية كما هي. */
  const mealLen = String(mealName || "").length;
  const mealFont = mealLen > 100 ? 7 : mealLen > 70 ? 7.5 : mealLen > 45 ? 8.5 : 10.5;

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
      <div className="seq-mark">{seq}</div>
      {/* Brand header — heart icon + ADRENALINE logo + HEALTHY FOOD tag */}
      {/* القلب يمين الاسم (كالاستيكر القديم)، ورقم البوكس شمالَه في إطار —
          التغليف يلتقطه من أعلى الملصق دون قلب البوكس لقراءة السطر السفلي. */}
      <div className="brand-block">
        <span className="box-no-top">{s.customerNo}</span>
        <div className="brand-text">
          <div className="brand-name">ADRENALINE</div>
          <div className="brand-tag">HEALTHY FOOD</div>
        </div>
        <img src="/heart-logo.png" alt="" className="brand-heart" />
      </div>
      <div className="brand-rule" />

      {/* Center content */}
      <div className="content-center">
        {/* لا رقم هاتف على ملصق الوجبة (يبقى على ملصق البوكس). وشارة الهدف
            نزلت لصفّ التواريخ أسفل الملصق — كخانة GOAL في ملصق البوكس تماماً —
            فيصفو الوسط للاسم والوجبة والتحذير الكبير. */}
        <div className="cust-line">{s.customerName}</div>
        <div className="meal-line" style={{ fontSize: `${mealFont}px` }}>{mealName}</div>

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

        {warnings ? (
          <div className="warn-line">
            <span className="warn-tag">AVOID</span>
            {warnings}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      {/* الرقم صعد للركن العلوي وحده، فخانته السفلية صارت للهدف —
          الصف: GOAL | PROD | EXP، والإنتاج قبل الانتهاء (البداية ثم النهاية). */}
      <div className="date-row">
        <div className="date-cell">
          <div className="date-label">GOAL</div>
          <div className="date-value goal-cell">{s.goal || "—"}</div>
        </div>
        <div className="date-divider" />
        <div className="date-cell">
          <div className="date-label">PROD</div>
          <div className="date-value">{s.prodDate || s.dateText}</div>
        </div>
        <div className="date-divider" />
        <div className="date-cell">
          <div className="date-label">EXP</div>
          <div className="date-value">{s.expDate || s.dateText}</div>
        </div>
      </div>
    </div>
  );
}

function BoxSticker({ s, seq }: any) {
  return (
    <div className="label label-box">
      <div className="seq-mark">{seq}</div>
      {/* القلب يمين الاسم (كالاستيكر القديم)، ورقم البوكس شمالَه في إطار —
          التغليف يلتقطه من أعلى الملصق دون قلب البوكس لقراءة السطر السفلي. */}
      <div className="brand-block">
        <span className="box-no-top">{s.customerNo}</span>
        <div className="brand-text">
          <div className="brand-name">ADRENALINE</div>
          <div className="brand-tag">HEALTHY FOOD</div>
        </div>
        <img src="/heart-logo.png" alt="" className="brand-heart" />
      </div>
      <div className="brand-rule" />

      <div className="content-center">
        <div className="cust-line">{s.customerName}</div>
        {s.customerNumber && (
          <div className="cust-sub">
            <span className="cust-phone">{s.customerNumber}</span>
          </div>
        )}
        {s.planLabel ? (
          <div className="plan-box"><div className="plan-txt">{s.planLabel}</div></div>
        ) : null}
      </div>

      {/* الرقم صعد لركن الملصق العلوي (كملصق الوجبة) فخانته السفلية صارت
          لتاريخ التوصيل — كان ملصق البوكس الوحيد الذي يخرج بلا تاريخ. */}
      <div className="date-row">
        <div className="date-cell">
          <div className="date-label">DATE</div>
          <div className="date-value">{s.prodDate || s.dateText}</div>
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
