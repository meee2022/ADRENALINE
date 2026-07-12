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
import { DashboardHeader } from "@/components/DashboardHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Save, UtensilsCrossed, Check, Copy } from "lucide-react";
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
  { ar: "باستا", en: "Pasta" },
  { ar: "بطاطس", en: "Potato" },
  { ar: "بطاطا حلوة", en: "Sweet potato" },
  { ar: "خبز", en: "Bread" },
  { ar: "برغل", en: "Bulgur" },
  { ar: "كينوا", en: "Quinoa" },
];
const GRAM_PRESETS = [80, 100, 120, 150, 170, 200, 250];

/** النص المركّب الذي يراه المطبخ/الاستيكر. */
function composeText(s: Slot, isRtl: boolean): string {
  if (s.type === "OFF") return "";
  const parts: string[] = [];
  if (s.baseName) parts.push(s.baseName);
  if (s.type === "MAIN") {
    const g = (n?: number) => (n && n > 0 ? `${n}${isRtl ? "جم" : "g"}` : "");
    const bits: string[] = [];
    if (s.proteinG) bits.push(`${isRtl ? "بروتين" : "Protein"} ${g(s.proteinG)}`);
    if (s.carbName && s.carbName !== (isRtl ? "بدون" : "None") && s.carbG)
      bits.push(`${s.carbName} ${g(s.carbG)}`);
    if (bits.length) parts.push(bits.join(" + "));
  }
  let text = parts.join(" — ");
  if (s.notes && s.notes.trim()) text += ` / ${s.notes.trim()}`;
  return text;
}

/** اختيار طبق بالبحث بالاسم — يفتح قائمة نتائج مفلترة بدل dropdown طويل. */
function MealPicker({ meals, value, valueName, isRtl, onPick }: {
  meals: any[]; value?: string; valueName?: string; isRtl: boolean; onPick: (m: any | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const nameOf = (m: any) => (isRtl ? m.nameAr : (m.nameEn || m.nameAr)) || "";
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? meals.filter((m) => `${m.nameAr || ""} ${m.nameEn || ""}`.toLowerCase().includes(s))
      : meals;
    return list.slice(0, 40);
  }, [q, meals]);

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
            <div className="p-2 border-b border-slate-100">
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={isRtl ? "ابحث باسم الطبق…" : "Search dish name…"} className="h-9 text-sm" />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {value && (
                <button type="button" onClick={() => { onPick(null); setOpen(false); }}
                  className="w-full text-start px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50">
                  ✕ {isRtl ? "إلغاء الاختيار" : "Clear selection"}
                </button>
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

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const template = useQuery(
    api.customizedPlans.getTemplate,
    selectedId ? { customerId: selectedId as any, sessionToken } : "skip",
  ) as any;

  const selected = customers.find((c) => c._id === selectedId);
  const mainMeals = useMemo(() => meals.filter((m) => ["lunch", "dinner"].includes(String(m.category))), [meals]);
  const snackMeals = useMemo(() => meals.filter((m) => ["snack", "salad"].includes(String(m.category))), [meals]);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // بناء الخانات الافتراضية من عدد وجبات/سناكات العميل، أو تحميل القالب المحفوظ
  useEffect(() => {
    if (!selected) { setSlots([]); return; }
    if (template?.slots && Array.isArray(template.slots) && template.slots.length) {
      setSlots(template.slots);
      return;
    }
    // ✅ عدد الخانات = بالظبط ما هو مكتوب في سجل المشترك (لا أرقام افتراضية).
    const nMeals = Math.max(0, Math.floor(Number(selected.mealsPerDay) || 0));
    const nSnacks = Math.max(0, Math.floor(Number(selected.snacksPerDay) || 0));
    const s: Slot[] = [];
    for (let i = 1; i <= nMeals; i++)
      s.push({ key: `MEAL ${i}`, label: `${t("وجبة", "Meal")} ${i}`, type: "MAIN", proteinG: 150, carbName: t("رز أبيض", "White rice"), carbG: 150 });
    for (let i = 1; i <= nSnacks; i++)
      s.push({ key: `SNACK ${i}`, label: `${t("سناك", "Snack")} ${i}`, type: "SNACK" });
    setSlots(s);
  }, [selectedId, template]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchSlot = (i: number, p: Partial<Slot>) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  const filtered = customers.filter((c) =>
    !search.trim() || String(c.fullName).includes(search) || String(c.phone || "").includes(search),
  );

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true); setSaved(false);
    try {
      const withText = slots.map((s) => ({ ...s, text: composeText(s, isRtl) }));
      await saveTemplate({ customerId: selectedId as any, slots: withText, sessionToken });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      alert(t("تعذّر الحفظ: ", "Save failed: ") + String(e?.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="p-3 sm:p-6 max-w-7xl mx-auto overflow-x-clip">
      <DashboardHeader
        icon={<UtensilsCrossed />}
        titleAr="الوجبات المخصّصة" titleEn="Customized Meals"
        subtitleAr="قالب وجبات ثابت لكل عميل مخصّص — يُبنى بالضغط بدل الكتابة"
        subtitleEn="A fixed daily meal template per customized customer — built by tapping, not typing"
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
                <Button onClick={handleSave} disabled={saving}
                  className="bg-white text-[#0E76AC] hover:bg-cyan-50 font-black rounded-xl">
                  {saved ? <><Check className="h-4 w-4 ml-1" /> {t("اتحفظ", "Saved")}</> : <><Save className="h-4 w-4 ml-1" /> {saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ القالب", "Save template")}</>}
                </Button>
              </div>

              {/* الخانات */}
              {slots.map((s, i) => (
                <div key={s.key} className="rounded-2xl border border-slate-100 bg-white p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-black text-[#0E2A4A]">{s.label}</span>
                    <div className="flex gap-1">
                      {(["MAIN", "SNACK", "OFF"] as const).map((tp) => (
                        <button key={tp} onClick={() => patchSlot(i, { type: tp })}
                          className={cn("text-[10px] font-black px-2 py-1 rounded-lg border",
                            s.type === tp ? "border-[#0E76AC] bg-[#0E76AC] text-white" : "border-slate-200 text-slate-500")}>
                          {tp === "MAIN" ? t("رئيسية", "Main") : tp === "SNACK" ? t("سناك", "Snack") : t("موقوفة", "Off")}
                        </button>
                      ))}
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
                        onPick={(m) => patchSlot(i, { baseMealId: m?._id, baseName: m ? (isRtl ? m.nameAr : (m.nameEn || m.nameAr)) : undefined })}
                      />

                      {s.type === "MAIN" && (
                        <div className="grid sm:grid-cols-2 gap-2.5">
                          {/* بروتين */}
                          <div className="rounded-xl bg-slate-50 p-2.5">
                            <label className="text-[11px] font-black text-slate-500 block mb-1">🥩 {t("بروتين (جم)", "Protein (g)")}</label>
                            <div className="flex items-center gap-1.5">
                              <Input type="number" value={s.proteinG ?? ""} onChange={(e) => patchSlot(i, { proteinG: Number(e.target.value) || 0 })}
                                className="h-9 w-20 text-center font-black" />
                              <div className="flex gap-1 flex-wrap">
                                {GRAM_PRESETS.map((g) => (
                                  <button key={g} onClick={() => patchSlot(i, { proteinG: g })}
                                    className="text-[10px] font-bold px-1.5 py-1 rounded bg-white border border-slate-200 hover:border-[#0E76AC]">{g}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                          {/* كارب */}
                          <div className="rounded-xl bg-slate-50 p-2.5">
                            <label className="text-[11px] font-black text-slate-500 block mb-1">🍚 {t("كارب", "Carb")}</label>
                            <div className="flex items-center gap-1.5">
                              <select value={s.carbName || ""} onChange={(e) => patchSlot(i, { carbName: e.target.value })}
                                className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-bold bg-white flex-1 min-w-0">
                                {CARB_OPTIONS.map((c) => <option key={c.en} value={isRtl ? c.ar : c.en}>{isRtl ? c.ar : c.en}</option>)}
                              </select>
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
