/**
 * @file client/src/pages/Customized.tsx
 * @description شاشة الوجبات المخصّصة — قالب وجبات لكل عميل مخصّص يُبنى بالضغط
 *   (اختيار الطبق + جرامات البروتين/الكارب) بدل الكتابة الحرة. يُحفظ كقالب
 *   يومي ثابت للعميل، ويغذّي المطبخ/الاستيكر عبر النص المركّب.
 * @convex convex/customizedPlans.ts
 */
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { alertDialog, confirmDialog } from "@/lib/dialogs";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Save, UtensilsCrossed, Check, Copy, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Slot = {
  key: string;
  label: string;
  type: "MAIN" | "SNACK" | "OFF";
  baseMealId?: string;
  baseName?: string;
  proteinName?: string;
  proteinG?: number;
  carbName?: string;
  carbG?: number;
  notes?: string;
};

const CARB_OPTIONS = [
  { ar: "بدون", en: "None" },
  { ar: "رز أبيض", en: "White rice" },
  { ar: "رز بني", en: "Brown rice" },
  { ar: "رز بسمتي", en: "Basmati rice" },
  { ar: "رز مصري", en: "Egyptian rice" },
  { ar: "باستا", en: "Pasta" },
  { ar: "بطاطس", en: "Potato" },
  { ar: "بطاطس مهروسة", en: "Mashed potato" },
  { ar: "بطاطا حلوة", en: "Sweet potato" },
  { ar: "خبز", en: "Bread" },
  { ar: "خبز أسمر", en: "Brown bread" },
  { ar: "برغل", en: "Bulgur" },
  { ar: "كينوا", en: "Quinoa" },
  { ar: "شوفان", en: "Oats" },
];
const GRAM_PRESETS = [80, 100, 120, 150, 170, 200, 250];
// أيام التوصيل (السبت → الخميس، الجمعة إجازة)
const DAYS: { key: string; ar: string; en: string }[] = [
  { key: "saturday", ar: "السبت", en: "Sat" },
  { key: "sunday", ar: "الأحد", en: "Sun" },
  { key: "monday", ar: "الإثنين", en: "Mon" },
  { key: "tuesday", ar: "الثلاثاء", en: "Tue" },
  { key: "wednesday", ar: "الأربعاء", en: "Wed" },
  { key: "thursday", ar: "الخميس", en: "Thu" },
];
const PROTEIN_OPTIONS = [
  { ar: "دجاج", en: "Chicken" },
  { ar: "دجاج مشوي", en: "Grilled chicken" },
  { ar: "دجاج بانيه", en: "Crispy chicken" },
  { ar: "شيش طاووق", en: "Shish tawook" },
  { ar: "سمك", en: "Fish" },
  { ar: "سمك مشوي", en: "Grilled fish" },
  { ar: "سلمون", en: "Salmon" },
  { ar: "ستيك", en: "Steak" },
  { ar: "لحم بقري", en: "Beef" },
  { ar: "لحم مفروم", en: "Minced beef" },
  { ar: "كفتة", en: "Kofta" },
  { ar: "جمبري", en: "Shrimp" },
  { ar: "ديك رومي", en: "Turkey" },
  { ar: "تونة", en: "Tuna" },
  { ar: "بيض", en: "Eggs" },
  { ar: "بياض بيض", en: "Egg whites" },
];

/** النص المركّب الذي يراه المطبخ/الاستيكر. */
function composeText(s: Slot, isRtl: boolean): string {
  if (s.type === "OFF") return "";
  const parts: string[] = [];
  if (s.baseName) parts.push(s.baseName);
  if (s.type === "MAIN") {
    const g = (n?: number) => (n && n > 0 ? `${n}${isRtl ? "جم" : "g"}` : "");
    const bits: string[] = [];
    if (s.proteinG) bits.push(`${s.proteinName || (isRtl ? "بروتين" : "Protein")} ${g(s.proteinG)}`);
    if (s.carbName && s.carbName !== (isRtl ? "بدون" : "None") && s.carbG)
      bits.push(`${s.carbName} ${g(s.carbG)}`);
    if (bits.length) parts.push(bits.join(" + "));
  }
  let text = parts.join(" — ");
  if (s.notes && s.notes.trim()) text += ` / ${s.notes.trim()}`;
  return text;
}

/** هل الطبق مجدول لهذا (الأسبوع + اليوم)؟ — نفس منطق الخطة الذكية. */
function mealScheduledFor(m: any, week: number, day: string): boolean {
  if (!week || !day) return true;
  const d = String(day).toLowerCase();
  if (Array.isArray(m.schedule) && m.schedule.length)
    return m.schedule.some((s: any) => Number(s.week) === week && String(s.day).toLowerCase() === d);
  const weeks = Array.isArray(m.weeks) ? m.weeks.map(Number) : [];
  const days = Array.isArray(m.days) ? m.days.map((x: any) => String(x).toLowerCase()) : [];
  if (weeks.length || days.length) return weeks.includes(week) && days.includes(d);
  return false; // بلا جدولة → لا يظهر في وضع "وجبات اليوم"
}

/** اختيار طبق بالبحث — افتراضياً وجبات يوم التبويب في دورة المطبخ، مع زر «كل المنيو» وطبق مخصّص. */
function MealPicker({ meals, value, valueName, isRtl, onPick, filterWeek, filterDay, presets = [], onPickPreset }: {
  meals: any[]; value?: string; valueName?: string; isRtl: boolean; onPick: (m: any | null) => void;
  filterWeek?: number; filterDay?: string;
  presets?: any[]; onPickPreset?: (p: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const nameOf = (m: any) => (isRtl ? m.nameAr : (m.nameEn || m.nameAr)) || "";
  // اسم عرض التركيبة السابقة = نصّها المركّب بلغة الواجهة
  const presetName = (p: any) => composeText({ type: p.type, baseName: p.baseName, proteinName: p.proteinName, proteinG: p.proteinG, carbName: p.carbName, carbG: p.carbG } as any, isRtl) || p.baseName || "";
  const presetResults = useMemo(() => {
    if (!onPickPreset || !presets.length) return [];
    const s = q.trim().toLowerCase();
    const list = s ? presets.filter((p) => presetName(p).toLowerCase().includes(s)) : presets;
    return list.slice(0, 60);
  }, [q, presets, onPickPreset, isRtl]);
  const dayMeals = useMemo(
    () => (showAll || !filterWeek || !filterDay) ? meals : meals.filter((m) => mealScheduledFor(m, filterWeek, filterDay)),
    [meals, showAll, filterWeek, filterDay],
  );
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? dayMeals.filter((m) => `${m.nameAr || ""} ${m.nameEn || ""}`.toLowerCase().includes(s))
      : dayMeals;
    return list.slice(0, 40);
  }, [q, dayMeals]);

  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); setQ(""); }}
        className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white flex items-center justify-between gap-2">
        <span className={cn("truncate", value ? "text-slate-900" : "text-slate-400")}>
          {value && valueName ? valueName : (isRtl ? "اختر الطبق…" : "Pick a dish…")}
        </span>
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="p-2 border-b border-slate-100 space-y-1.5">
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={isRtl ? "ابحث باسم الطبق…" : "Search dish name…"} className="h-9 text-sm" />
              {filterWeek && filterDay && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-bold text-[#47759c]">
                    {showAll ? (isRtl ? "كل المنيو" : "Full menu") : (isRtl ? `وجبات اليوم · دورة ${filterWeek}` : `Today's meals · cycle ${filterWeek}`)}
                  </span>
                  <button type="button" onClick={() => setShowAll((v) => !v)}
                    className="text-[10.5px] font-black text-[#0E76AC] underline">
                    {showAll ? (isRtl ? "اعرض وجبات اليوم فقط" : "Show today only") : (isRtl ? "اعرض كل المنيو" : "Show full menu")}
                  </button>
                </div>
              )}
            </div>
            {/* ➕ طبق مخصّص (مش في المنيو) — تكتب اسمه بنفسك مثل "رز وفراخ مشوية" */}
            {q.trim() && !results.some((m) => nameOf(m).trim() === q.trim()) && (
              <button type="button" onClick={() => { onPick({ _id: `custom:${q.trim()}`, nameAr: q.trim(), nameEn: q.trim(), custom: true }); setOpen(false); }}
                className="w-full text-start px-3 py-2.5 text-sm font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-2 border-b border-slate-100">
                ➕ {isRtl ? `طبق مخصّص: «${q.trim()}»` : `Custom dish: “${q.trim()}”`}
              </button>
            )}
            <div className="max-h-64 overflow-y-auto">
              {value && (
                <button type="button" onClick={() => { onPick(null); setOpen(false); }}
                  className="w-full text-start px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50">
                  ✕ {isRtl ? "إلغاء الاختيار" : "Clear selection"}
                </button>
              )}
              {/* ♻️ تركيبات/أطباق سابقة — تملأ الخانة كاملة بضغطة */}
              {presetResults.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-black text-emerald-700 uppercase tracking-wide bg-emerald-50/60">
                    ♻️ {isRtl ? "تركيبات سابقة (تملأ الكمية والبروتين تلقائياً)" : "Reusable presets (fills grams & protein)"}
                  </p>
                  {presetResults.map((p, i) => (
                    <button key={"pr" + i} type="button" onClick={() => { onPickPreset?.(p); setOpen(false); }}
                      className="w-full text-start px-3 py-2 text-sm hover:bg-emerald-50 flex items-center gap-2 font-bold text-emerald-800 border-b border-emerald-50">
                      <span className="text-emerald-500 shrink-0">♻️</span>
                      <span className="truncate">{presetName(p)}</span>
                      {p.count > 1 && <span className="ms-auto text-[10px] text-emerald-500 shrink-0">×{p.count}</span>}
                    </button>
                  ))}
                  <p className="px-3 pt-2 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wide">{isRtl ? "المنيو" : "Menu"}</p>
                </>
              )}
              {results.map((m) => (
                <button key={m._id} type="button" onClick={() => { onPick(m); setOpen(false); }}
                  className={cn("w-full text-start px-3 py-2 text-sm hover:bg-[#f2fbff] flex items-center gap-2",
                    value === m._id ? "bg-[#f2fbff] font-black text-[#0E76AC]" : "font-semibold text-slate-700")}>
                  {m.imageUrl && <img src={m.imageUrl} alt="" className="h-7 w-7 rounded object-cover shrink-0" />}
                  <span className="truncate">{nameOf(m)}</span>
                </button>
              ))}
              {results.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-6">{isRtl ? "لا نتائج" : "No results"}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Customized() {
  const sessionToken = useStore((s) => s.sessionToken) || undefined;
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (a: string, e: string) => (isRtl ? a : e);

  const customers = (useQuery(api.customizedPlans.listCustomized, { sessionToken }) as any[] | undefined) || [];
  const meals = (useQuery(api.publicMeals.listMeals, {}) as any[] | undefined) || [];
  const saveTemplate = useMutation(api.customizedPlans.saveTemplate);
  const saveTemplateDay = useMutation(api.customizedPlans.saveTemplateDay);
  // ✅ دورة المطبخ الحالية — البحث يعرض وجبات يوم التبويب في هذه الدورة
  const restSettings = useQuery(api.restaurantSettings.get) as any;
  const currentWeek = Math.min(4, Math.max(1, Number(restSettings?.currentCookingWeek) || 1));

  // ✅ التاريخ الفعلي لأي (أسبوع دورة + يوم) — يطابق منطق convex/stickers.forDate تمامًا
  //    (يوم قطر +3، وعدّ الجُمَع). فالأخصائية تعرف إنها بتملّي لأي تاريخ فعليًا وما تغلطش اليوم.
  const DOW_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dateForWeekDay = (week: number, dayKey: string): Date | null => {
    const todayISO = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
    for (let i = 0; i < 28; i++) {
      const d = new Date(todayISO + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      let fridays = 0;
      const cc = new Date(todayISO + "T00:00:00Z");
      for (let j = 0; j < i; j++) { cc.setUTCDate(cc.getUTCDate() + 1); if (cc.getUTCDay() === 5) fridays++; }
      const rot = ((currentWeek - 1 + fridays) % 4) + 1;
      if (rot === week && DOW_KEYS[d.getUTCDay()] === dayKey) return d;
    }
    return null;
  };
  const fmtDM = (d: Date | null) => d ? `${d.getUTCDate()}/${d.getUTCMonth() + 1}` : "";

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const template = useQuery(
    api.customizedPlans.getTemplate,
    selectedId ? { customerId: selectedId as any, sessionToken } : "skip",
  ) as any;

  const selected = customers.find((c) => c._id === selectedId);
  const mainMeals = useMemo(() => meals.filter((m) => ["lunch", "dinner"].includes(String(m.category))), [meals]);
  const snackMeals = useMemo(() => meals.filter((m) => ["snack", "salad"].includes(String(m.category))), [meals]);

  // ✅ مكتبة الأطباق/التركيبات السابقة (لإعادة الاستخدام بضغطة)
  const presets = (useQuery(api.customizedPlans.presets, { sessionToken }) as any[] | undefined) || [];
  const mainPresets = useMemo(() => presets.filter((p) => p.type === "MAIN"), [presets]);
  const snackPresets = useMemo(() => presets.filter((p) => p.type !== "MAIN"), [presets]);

  // ✅ قالب بالأسابيع×الأيام: 4 أسابيع دورة، كل أسبوع له أيامه، كل يوم خاناته
  const [weekSlots, setWeekSlots] = useState<Record<number, Record<string, Slot[]>>>({});
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [activeDay, setActiveDay] = useState<string>("saturday");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // خانات افتراضية فارغة من عدد وجبات/سناكات المشترك
  const blankSlots = (): Slot[] => {
    const nMeals = Math.max(0, Math.floor(Number(selected?.mealsPerDay) || 0));
    const nSnacks = Math.max(0, Math.floor(Number(selected?.snacksPerDay) || 0));
    const s: Slot[] = [];
    for (let i = 1; i <= nMeals; i++)
      s.push({ key: `MEAL ${i}`, label: `${t("وجبة", "Meal")} ${i}`, type: "MAIN", proteinG: 150, carbName: t("رز أبيض", "White rice"), carbG: 150 });
    for (let i = 1; i <= nSnacks; i++)
      s.push({ key: `SNACK ${i}`, label: `${t("سناك", "Snack")} ${i}`, type: "SNACK" });
    return s;
  };

  // تحميل القالب المحفوظ (أسابيع×أيام) أو بناء افتراضي.
  //   يدعم القديم: days (أسبوع واحد يُطبّق على الأربعة) أو مصفوفة واحدة.
  useEffect(() => {
    if (!selected) { setWeekSlots({}); return; }
    const saved = template?.slots;
    // يبني خريطة أيام من مصدر اختياري (base list أو daysObj) — نسخة مستقلة في كل استدعاء
    const daysFrom = (daysObj?: Record<string, Slot[]>, base?: Slot[]): Record<string, Slot[]> => {
      const d: Record<string, Slot[]> = {};
      DAYS.forEach((dy) => {
        const src = daysObj && Array.isArray(daysObj[dy.key]) && daysObj[dy.key].length
          ? daysObj[dy.key]
          : (base && base.length ? base : blankSlots());
        d[dy.key] = src.map((s) => ({ ...s }));
      });
      return d;
    };
    const ws: Record<number, Record<string, Slot[]>> = {};
    if (saved && saved.weeks && typeof saved.weeks === "object") {
      for (let w = 1; w <= 4; w++) {
        const wkDays = (saved.weeks[w] || saved.weeks[String(w)])?.days;
        ws[w] = daysFrom(wkDays);
      }
    } else if (saved && saved.days && typeof saved.days === "object") {
      for (let w = 1; w <= 4; w++) ws[w] = daysFrom(saved.days); // أسبوع واحد قديم → لكل الأسابيع
    } else if (Array.isArray(saved) && saved.length) {
      for (let w = 1; w <= 4; w++) ws[w] = daysFrom(undefined, saved);
    } else {
      for (let w = 1; w <= 4; w++) ws[w] = daysFrom();
    }
    setWeekSlots(ws);
    setActiveWeek(currentWeek);
    setActiveDay("saturday");
  }, [selectedId, template]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = weekSlots[activeWeek]?.[activeDay] || [];
  const patchSlot = (i: number, p: Partial<Slot>) =>
    setWeekSlots((prev) => ({
      ...prev,
      [activeWeek]: {
        ...(prev[activeWeek] || {}),
        [activeDay]: (prev[activeWeek]?.[activeDay] || []).map((s, idx) => (idx === i ? { ...s, ...p } : s)),
      },
    }));

  // ➕ إضافة خانة وجبة/سناك **زيادة** لهذا اليوم (فوق عدد الاشتراك) — للأخصائية.
  const addSlot = (type: "MAIN" | "SNACK") =>
    setWeekSlots((prev) => {
      const cur = prev[activeWeek]?.[activeDay] || [];
      const n = cur.filter((s) => s.type === type).length + 1;
      const newSlot: Slot = type === "MAIN"
        ? { key: `EXTRA-MEAL-${cur.length}`, label: `${t("وجبة زيادة", "Extra meal")} ${n}`, type: "MAIN", proteinG: 150, carbName: t("رز أبيض", "White rice"), carbG: 150 }
        : { key: `EXTRA-SNACK-${cur.length}`, label: `${t("سناك زيادة", "Extra snack")} ${n}`, type: "SNACK" };
      return { ...prev, [activeWeek]: { ...(prev[activeWeek] || {}), [activeDay]: [...cur, newSlot] } };
    });
  const removeSlot = (i: number) =>
    setWeekSlots((prev) => ({
      ...prev,
      [activeWeek]: {
        ...(prev[activeWeek] || {}),
        [activeDay]: (prev[activeWeek]?.[activeDay] || []).filter((_, idx) => idx !== i),
      },
    }));

  // نسخ وجبات اليوم الحالي لكل أيام هذا الأسبوع (لعميل يأكل نفس الشيء كل يوم في الأسبوع)
  const applyToAllDays = async () => {
    if (!(await confirmDialog({ message: t("نسخ وجبات هذا اليوم لكل أيام هذا الأسبوع؟", "Copy this day's meals to all days of this week?") }))) return;
    setWeekSlots((prev) => {
      const src = (prev[activeWeek]?.[activeDay] || []).map((s) => ({ ...s }));
      const d: Record<string, Slot[]> = {};
      DAYS.forEach((dy) => { d[dy.key] = src.map((s) => ({ ...s })); });
      return { ...prev, [activeWeek]: d };
    });
  };

  // نسخ هذا الأسبوع بالكامل لباقي أسابيع الدورة (لعميل يأكل نفس الشيء كل أسبوع)
  const applyWeekToAll = async () => {
    if (!(await confirmDialog({ message: t("نسخ هذا الأسبوع لكل أسابيع الدورة (1–4)؟", "Copy this week to all cycle weeks (1–4)?") }))) return;
    setWeekSlots((prev) => {
      const srcDays = prev[activeWeek] || {};
      const next: Record<number, Record<string, Slot[]>> = {};
      for (let w = 1; w <= 4; w++) {
        const d: Record<string, Slot[]> = {};
        DAYS.forEach((dy) => { d[dy.key] = (srcDays[dy.key] || []).map((s) => ({ ...s })); });
        next[w] = d;
      }
      return next;
    });
  };

  // عدّاد الأيام المكتملة في الأسبوع النشط (كل خاناتها غير OFF فيها طبق)
  const dayFilled = (key: string) => {
    const s = weekSlots[activeWeek]?.[key] || [];
    return s.length > 0 && s.every((x) => x.type === "OFF" || x.baseName);
  };

  const filtered = customers.filter((c) =>
    !search.trim() || String(c.fullName).includes(search) || String(c.phone || "").includes(search),
  );

  // ✅ حفظ اليوم الحالي فقط — لا يمسّ باقي أيام الأسبوع
  const [savingDay, setSavingDay] = useState(false);
  const [savedDay, setSavedDay] = useState(false);
  const handleSaveDay = async () => {
    if (!selectedId) return;
    setSavingDay(true); setSavedDay(false);
    try {
      const daySlots = (weekSlots[activeWeek]?.[activeDay] || []).map((s) => ({ ...s, text: composeText(s, isRtl) }));
      await saveTemplateDay({ customerId: selectedId as any, week: activeWeek, day: activeDay, slots: daySlots, sessionToken });
      setSavedDay(true); setTimeout(() => setSavedDay(false), 2500);
    } catch (e: any) {
      void alertDialog({ message: t("تعذّر حفظ اليوم: ", "Day save failed: ") + String(e?.message || e) });
    } finally { setSavingDay(false); }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true); setSaved(false);
    try {
      const weeks: Record<number, { days: Record<string, Slot[]> }> = {};
      for (let w = 1; w <= 4; w++) {
        const days: Record<string, Slot[]> = {};
        DAYS.forEach((dy) => { days[dy.key] = (weekSlots[w]?.[dy.key] || []).map((s) => ({ ...s, text: composeText(s, isRtl) })); });
        weeks[w] = { days };
      }
      await saveTemplate({ customerId: selectedId as any, slots: { weeks }, sessionToken });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      void alertDialog({ message: t("تعذّر الحفظ: ", "Save failed: ") + String(e?.message || e) });
    } finally { setSaving(false); }
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="p-3 sm:p-6 max-w-7xl mx-auto overflow-x-clip">
      <DashboardHeader
        icon={<UtensilsCrossed />}
        titleAr="الوجبات المخصّصة" titleEn="Customized Meals"
        subtitleAr="قالب وجبات لكل عميل مخصّص — لكل يوم وجباته وكمياته (أطباق المنيو أو مخصّصة)"
        subtitleEn="Per-customer customized plan — each day's meals and quantities (menu or custom dishes)"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 mt-4">
        {/* قائمة العملاء المخصّصين */}
        <div className="rounded-2xl border border-slate-100 bg-white p-3 h-fit">
          <div className="relative mb-3">
            <Search className={cn("absolute top-2.5 h-4 w-4 text-slate-400", isRtl ? "right-2.5" : "left-2.5")} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t("ابحث بالاسم أو الرقم", "Search name or phone")}
              className={isRtl ? "pr-9" : "pl-9"} />
          </div>
          <p className="text-[11px] font-bold text-slate-400 mb-2">{filtered.length} {t("عميل مخصّص", "customized")}</p>
          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
            {filtered.map((c) => (
              <button key={c._id} onClick={() => setSelectedId(c._id)}
                className={cn("w-full text-start p-2.5 rounded-xl border transition-colors",
                  selectedId === c._id ? "border-[#0E76AC] bg-[#f2fbff]" : "border-slate-100 hover:border-slate-200")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-slate-800 truncate">{c.fullName}</span>
                  {c.hasTemplate
                    ? <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5 shrink-0">✓ {c.slotCount}</span>
                    : <span className="text-[9px] font-black text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 shrink-0">{t("جديد", "new")}</span>}
                </div>
                <span className="text-[11px] text-slate-400" dir="ltr">{c.phone}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-8">{t("لا يوجد عملاء مخصّصون", "No customized customers")}</p>}
          </div>
        </div>

        {/* محرّر القالب */}
        <div>
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 grid place-items-center py-24 text-center">
              <div>
                <UtensilsCrossed className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-500">{t("اختر عميلاً مخصّصاً لبناء قالب وجباته", "Pick a customized customer to build their template")}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* رأس العميل */}
              <div className="rounded-2xl bg-gradient-to-l from-[#0E2A4A] to-[#0E76AC] text-white p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-black">{selected.fullName}</h2>
                  <p className="text-xs text-cyan-100/90" dir="ltr">{selected.phone} · {selected.deliveryTime === "EVENING" ? t("مسائي", "Evening") : t("صباحي", "Morning")}</p>
                  <p className="text-[11px] text-cyan-100/80 font-bold mt-0.5">
                    {t("من الاشتراك:", "From subscription:")} {Math.max(0, Math.floor(Number(selected.mealsPerDay) || 0))} {t("وجبة", "meals")} + {Math.max(0, Math.floor(Number(selected.snacksPerDay) || 0))} {t("سناك", "snacks")}
                  </p>
                  {(selected.allergies || selected.avoid) && (
                    <p className="text-[11px] text-amber-200 mt-1">⚠ {[selected.allergies, selected.avoid].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* ✅ حفظ اليوم الحالي فقط — لا يمسّ باقي الأسبوع */}
                  <Button onClick={handleSaveDay} disabled={savingDay || saving} variant="outline"
                    className="bg-white/10 text-white border-white/40 hover:bg-white/20 font-black rounded-xl backdrop-blur-sm">
                    {savedDay ? <><Check className="h-4 w-4 ml-1" /> {t("اتحفظ اليوم", "Day saved")}</> : <><Save className="h-4 w-4 ml-1" /> {savingDay ? t("جارٍ…", "Saving…") : t("حفظ اليوم فقط", "Save this day")}</>}
                  </Button>
                  <Button onClick={handleSave} disabled={saving || savingDay}
                    className="bg-white text-[#0E76AC] hover:bg-cyan-50 font-black rounded-xl">
                    {saved ? <><Check className="h-4 w-4 ml-1" /> {t("اتحفظ", "Saved")}</> : <><Save className="h-4 w-4 ml-1" /> {saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ القالب كامل", "Save full template")}</>}
                  </Button>
                </div>
              </div>

              {/* منتقي أسبوع الدورة (1–4) — كل أسبوع وجباته المستقلة */}
              <div className="rounded-2xl border border-slate-100 bg-white p-2.5 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black text-white bg-[#0E2A4A] rounded-lg px-2.5 py-1.5 shrink-0">
                  🍳 {t("أسبوع الدورة", "Cycle week")}
                </span>
                <div className="flex gap-1 flex-wrap flex-1">
                  {[1, 2, 3, 4].map((w) => (
                    <button key={w} onClick={() => setActiveWeek(w)}
                      className={cn("px-3.5 py-1.5 rounded-lg text-xs font-black border transition-colors relative",
                        activeWeek === w ? "bg-[#0E2A4A] text-white border-[#0E2A4A]" : "bg-white text-slate-600 border-slate-200 hover:border-[#0E2A4A]")}>
                      {t("أسبوع", "Week")} {w}
                      {w === currentWeek && (
                        <span className={cn("absolute -top-1.5 -end-1.5 text-[7px] font-black rounded-full px-1 py-0.5 leading-none",
                          activeWeek === w ? "bg-emerald-300 text-[#0E2A4A]" : "bg-emerald-500 text-white")}>
                          {t("الآن", "now")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button onClick={applyWeekToAll}
                  className="px-3 py-1.5 rounded-lg text-xs font-black text-emerald-700 border border-dashed border-emerald-400 hover:bg-emerald-50 flex items-center gap-1">
                  <Copy className="h-3.5 w-3.5" /> {t("انسخ هذا الأسبوع لكل الأسابيع", "Copy week to all weeks")}
                </button>
              </div>

              {/* تبويبات الأيام + نسخ لكل الأيام */}
              <div className="rounded-2xl border border-slate-100 bg-white p-2.5 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black text-[#0E2A4A] bg-[#e8f8fd] rounded-lg px-2.5 py-1.5 shrink-0">
                  📅 {t("أسبوع", "Week")} {activeWeek}
                </span>
                <div className="flex gap-1 flex-wrap flex-1">
                  {DAYS.map((d) => {
                    const dm = fmtDM(dateForWeekDay(activeWeek, d.key));
                    return (
                    <button key={d.key} onClick={() => setActiveDay(d.key)}
                      className={cn("px-3 py-1 rounded-lg text-xs font-black border transition-colors relative flex flex-col items-center leading-tight",
                        activeDay === d.key ? "bg-[#0E76AC] text-white border-[#0E76AC]" : "bg-white text-slate-600 border-slate-200 hover:border-[#0E76AC]")}>
                      <span>{isRtl ? d.ar : d.en}</span>
                      {dm && <span className={cn("text-[9px] font-bold tabular-nums", activeDay === d.key ? "text-sky-100" : "text-slate-400")} dir="ltr">{dm}</span>}
                      {dayFilled(d.key) && <span className={cn("absolute -top-1 -end-1 h-2.5 w-2.5 rounded-full", activeDay === d.key ? "bg-emerald-300" : "bg-emerald-500")} />}
                    </button>
                    );
                  })}
                </div>
                <button onClick={applyToAllDays}
                  className="px-3 py-1.5 rounded-lg text-xs font-black text-[#0E76AC] border border-dashed border-[#0E76AC]/40 hover:bg-[#f2fbff] flex items-center gap-1">
                  <Copy className="h-3.5 w-3.5" /> {t("طبّق هذا اليوم على أيام الأسبوع", "Apply day to week")}
                </button>
              </div>

              {/* ✅ بانر واضح: بتملّي وجبات أي يوم فعليًا (يمنع غلط ملء اليوم الخطأ) */}
              {(() => {
                const dObj = dateForWeekDay(activeWeek, activeDay);
                const dayLabel = (DAYS.find((x) => x.key === activeDay) || {}) as any;
                return (
                  <div className="rounded-2xl border-2 border-[#0E76AC]/25 bg-gradient-to-l from-[#e8f8fd] to-white px-4 py-2.5 flex items-center gap-2.5 flex-wrap">
                    <span className="text-lg">📌</span>
                    <span className="text-[13px] font-black text-[#0E2A4A]">
                      {isRtl ? "بتملّي وجبات:" : "You are filling meals for:"}
                    </span>
                    <span className="text-[13px] font-black text-[#0E76AC]">
                      {isRtl ? dayLabel.ar : dayLabel.en} · {t("أسبوع", "Week")} {activeWeek}
                    </span>
                    {dObj && (
                      <span className="text-[12px] font-black text-white bg-[#0E76AC] rounded-lg px-2.5 py-1 tabular-nums" dir="ltr">
                        {dObj.getUTCDate()}/{dObj.getUTCMonth() + 1}/{dObj.getUTCFullYear()}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* قوائم اقتراحات قابلة للكتابة (تقدر تختار أو تكتب نوع جديد مثل «دجاج مشوي») */}
              <datalist id="cz-proteins">{PROTEIN_OPTIONS.map((p) => <option key={p.en} value={isRtl ? p.ar : p.en} />)}</datalist>
              <datalist id="cz-carbs">{CARB_OPTIONS.map((c) => <option key={c.en} value={isRtl ? c.ar : c.en} />)}</datalist>

              {/* الخانات (لليوم المختار) */}
              {slots.map((s, i) => (
                <div key={s.key} className="rounded-2xl border border-slate-100 bg-white p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-black text-[#0E2A4A]">{s.label}</span>
                    <div className="flex gap-1 items-center">
                      {(["MAIN", "SNACK", "OFF"] as const).map((tp) => (
                        <button key={tp} onClick={() => patchSlot(i, { type: tp })}
                          className={cn("text-[10px] font-black px-2 py-1 rounded-lg border",
                            s.type === tp ? "border-[#0E76AC] bg-[#0E76AC] text-white" : "border-slate-200 text-slate-500")}>
                          {tp === "MAIN" ? t("رئيسية", "Main") : tp === "SNACK" ? t("سناك", "Snack") : t("موقوفة", "Off")}
                        </button>
                      ))}
                      {/* حذف الخانة (للزيادات أو أي خانة) */}
                      <button onClick={() => removeSlot(i)} title={t("حذف الخانة", "Remove slot")}
                        className="h-6 w-6 grid place-items-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {s.type !== "OFF" && (
                    <div className="space-y-2.5">
                      {/* اختيار الطبق — بحث بالاسم بدل قائمة بـ 200 طبق */}
                      <MealPicker
                        meals={s.type === "MAIN" ? mainMeals : snackMeals}
                        value={s.baseMealId}
                        valueName={s.baseName}
                        isRtl={isRtl}
                        filterWeek={activeWeek}
                        filterDay={activeDay}
                        presets={s.type === "MAIN" ? mainPresets : snackPresets}
                        onPickPreset={(p) => patchSlot(i, {
                          baseMealId: p.baseMealId || undefined,
                          baseName: p.baseName || undefined,
                          proteinName: p.proteinName || undefined,
                          proteinG: p.proteinG || undefined,
                          carbName: p.carbName || undefined,
                          carbG: p.carbG || undefined,
                        })}
                        onPick={(m) => patchSlot(i, { baseMealId: m?._id, baseName: m ? (isRtl ? m.nameAr : (m.nameEn || m.nameAr)) : undefined })}
                      />

                      {s.type === "MAIN" && (
                        <div className="grid sm:grid-cols-2 gap-2.5">
                          {/* بروتين — النوع + الجرامات */}
                          <div className="rounded-xl bg-slate-50 p-2.5">
                            <label className="text-[11px] font-black text-slate-500 block mb-1">🥩 {t("البروتين (النوع + جم)", "Protein (type + g)")}</label>
                            <div className="flex items-center gap-1.5">
                              <input list="cz-proteins" value={s.proteinName || ""} onChange={(e) => patchSlot(i, { proteinName: e.target.value })}
                                placeholder={t("النوع (اكتب أو اختر)", "Type or pick")}
                                className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-bold bg-white flex-1 min-w-0" />
                              <Input type="number" value={s.proteinG ?? ""} onChange={(e) => patchSlot(i, { proteinG: Number(e.target.value) || 0 })}
                                className="h-9 w-16 text-center font-black" placeholder={t("جم", "g")} />
                            </div>
                            <div className="flex gap-1 flex-wrap mt-1.5">
                              {GRAM_PRESETS.map((g) => (
                                <button key={g} onClick={() => patchSlot(i, { proteinG: g })}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:border-[#0E76AC]">{g}</button>
                              ))}
                            </div>
                          </div>
                          {/* كارب */}
                          <div className="rounded-xl bg-slate-50 p-2.5">
                            <label className="text-[11px] font-black text-slate-500 block mb-1">🍚 {t("كارب", "Carb")}</label>
                            <div className="flex items-center gap-1.5">
                              <input list="cz-carbs" value={s.carbName || ""} onChange={(e) => patchSlot(i, { carbName: e.target.value })}
                                placeholder={t("اكتب أو اختر", "Type or pick")}
                                className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-bold bg-white flex-1 min-w-0" />
                              <Input type="number" value={s.carbG ?? ""} onChange={(e) => patchSlot(i, { carbG: Number(e.target.value) || 0 })}
                                className="h-9 w-16 text-center font-black" placeholder={t("جم", "g")} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ملاحظات/ممنوعات */}
                      <Input value={s.notes ?? ""} onChange={(e) => patchSlot(i, { notes: e.target.value })}
                        placeholder={t("ملاحظات / ممنوعات (مثال: بدون بصل، صوص جانب)", "Notes / avoid (e.g. no onion, sauce on side)")}
                        className="h-9 text-sm" />

                      {/* المعاينة المركّبة */}
                      {composeText(s, isRtl) && (
                        <div className="rounded-lg bg-[#0E2A4A] text-white text-[12.5px] font-bold px-3 py-2 flex items-center gap-2">
                          <span className="text-cyan-300 shrink-0">↳</span>
                          <span dir={isRtl ? "rtl" : "ltr"}>{composeText(s, isRtl)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* ➕ إضافة وجبة/سناك زيادة فوق عدد الاشتراك (لهذا اليوم) */}
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => addSlot("MAIN")}
                  className="h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border-2 border-dashed border-[#0E76AC]/40 text-[#0E76AC] hover:bg-[#0E76AC]/5 transition-colors">
                  <Plus className="h-4 w-4" /> {t("أضف وجبة زيادة", "Add extra meal")}
                </button>
                <button onClick={() => addSlot("SNACK")}
                  className="h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border-2 border-dashed border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 transition-colors">
                  <Plus className="h-4 w-4" /> {t("أضف سناك زيادة", "Add extra snack")}
                </button>
              </div>

              {selected.snacksPerDay >= 0 && (
                <p className="text-[11px] text-slate-400 text-center pt-1">
                  {t("السناكات والسلطات تُختار كطبق مباشرةً — الجرامات للرئيسية فقط (غداء/عشاء).",
                    "Snacks and salads are picked as a dish — grams apply to mains only (lunch/dinner).")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
