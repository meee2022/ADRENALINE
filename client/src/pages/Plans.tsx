/**
 * @file client/src/pages/Plans.tsx
 * @description إدارة الخطط اليومية - تعيين الوجبات للعملاء
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useCustomers,
  useCategories,
  useMenuItems,
  useModifiers,
  useDailyPlans,
  useCreateDailyPlan,
  useUpdateDailyPlan,
} from "@/lib/api";
import type { DailyPlan } from "@/lib/api";
import { DailyPlanItem } from "@/lib/types";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { restrictionWords, mealIsRestricted } from "@/lib/mealRestrictions";
import { confirmDialog } from "@/lib/dialogs";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

import {
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Copy,
  Search,
  Sparkles,
  Download,
  Plus,
  Trash2,
  Clock,
  User,
  AlertTriangle,
  ChevronDown,
  StickyNote,
  Eye,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  Sun,
  Moon,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { format, subDays, addDays } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

/* ─── helpers ─────────────────────────────────────────── */
function makeId() {
  return Math.random().toString(36).slice(2, 11);
}

function isSnackCategoryName(name: string) {
  const s = String(name || "").toLowerCase();
  return s.includes("snack") || s.includes("سناك") || s.includes("سناكات");
}

function stripSystemFields<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripSystemFields) as any;
  if (typeof obj !== "object") return obj;
  const out: any = {};
  for (const [k, v] of Object.entries(obj as any)) {
    if (k.startsWith("_")) continue;
    out[k] = stripSystemFields(v);
  }
  return out as T;
}

/* ─── MealPicker ──────────────────────────────────────── */
function MealPicker({
  value, onChange, items, placeholder, isRtl, suggestedIds = [], infoById,
}: {
  value: string | null; onChange: (id: string) => void;
  items: any[]; placeholder: string; isRtl: boolean; suggestedIds?: string[];
  infoById?: Map<string, any>;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((m) => m._id === value);
  const selectedInfo = selected ? infoById?.get(String(selected._id)) : null;
  const sugSet = new Set(suggestedIds);
  const suggested = items.filter((m) => sugSet.has(m._id));
  const rest = items.filter((m) => !sugSet.has(m._id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "meal-picker-trigger w-full justify-between h-11 rounded-lg text-sm",
            "border-slate-200 hover:border-[#3cc4f0] bg-white transition-colors",
            !selected && "text-gray-400"
          )}
        >
          <span className="truncate flex items-center gap-2">
            {selected ? (
              <>
                {selectedInfo?.imageUrl ? (
                  <img src={selectedInfo.imageUrl} alt="" className="h-7 w-7 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <span className="meal-picker-fallback text-base">🍽️</span>
                )}
                <span className="text-gray-800 font-medium">{selected.name}</span>
              </>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="meal-picker-popover w-[min(22rem,calc(100vw-2rem))] p-0" align={isRtl ? "end" : "start"}>
        <Command>
          <CommandInput placeholder={placeholder} className={isRtl ? "text-right" : "text-left"} />
          <CommandList>
            <CommandEmpty>{isRtl ? "لا توجد نتائج" : "No results"}</CommandEmpty>
            {suggested.length > 0 && (
              <CommandGroup heading={isRtl ? "⭐ وجبات اليوم" : "⭐ Today's meals"}>
                {suggested.map((m) => (
                  <CommandItem
                    key={m._id}
                    value={`${m.name}`}
                    onSelect={() => { onChange(m._id); setOpen(false); }}
                    className={cn("flex items-center justify-between", isRtl ? "flex-row-reverse" : "")}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {infoById?.get(String(m._id))?.imageUrl ? (
                        <img src={infoById.get(String(m._id)).imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <span className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">🍽️</span>
                      )}
                      <span className="font-bold text-sm text-[#0E76AC] truncate">{m.name}</span>
                    </span>
                    {value === m._id && <Check className="h-4 w-4 text-[#3cc4f0]" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={suggested.length > 0 ? (isRtl ? "كل الأصناف" : "All items") : undefined}>
              {rest.map((m) => (
                <CommandItem
                  key={m._id}
                  value={`${m.name}`}
                  onSelect={() => { onChange(m._id); setOpen(false); }}
                  className={cn("flex items-center justify-between", isRtl ? "flex-row-reverse" : "")}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {infoById?.get(String(m._id))?.imageUrl ? (
                      <img src={infoById.get(String(m._id)).imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <span className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">🍽️</span>
                    )}
                    <span className="font-medium text-sm truncate">{m.name}</span>
                  </span>
                  {value === m._id && <Check className="h-4 w-4 text-[#3cc4f0]" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─── ModifiersPicker ─────────────────────────────────── */
type ModifierGroup = "AVOID" | "PREF" | "PORTION";

function ModifiersPicker({
  value, onChange, modifiers, isRtl,
}: {
  value: string[]; onChange: (next: string[]) => void;
  modifiers: any[]; isRtl: boolean;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<ModifierGroup>("AVOID");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (modifiers || [])
      .filter((m: any) => m?.isActive !== false && m?.group === group)
      .filter((m: any) => !query || String(m?.name || "").toLowerCase().includes(query))
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [modifiers, group, q]);

  const toggle = (id: string) => {
    const exists = (value || []).includes(id);
    onChange(exists ? (value || []).filter((x) => x !== id) : [...(value || []), id]);
  };

  const groupLabel = (g: ModifierGroup) => {
    if (g === "AVOID") return isRtl ? "ممنوع" : "Avoid";
    if (g === "PREF") return isRtl ? "تفضيلات" : "Prefs";
    return isRtl ? "كمية" : "Portion";
  };

  const selectedMods = useMemo(
    () => modifiers.filter((m: any) => (value || []).includes(m._id)),
    [modifiers, value]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="meal-modifier-trigger w-full justify-between h-auto min-h-[40px] rounded-lg border-slate-200 hover:border-[#3cc4f0] bg-white text-sm transition-colors"
        >
          <div className="flex flex-wrap gap-1.5 items-center py-1">
            {selectedMods.length === 0 ? (
              <span className="text-gray-400">{isRtl ? "إضافة تفضيلات وممنوعات" : "Add preferences"}</span>
            ) : (
              selectedMods.map((m: any) => (
                <Badge
                  key={m._id}
                  variant="secondary"
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full border",
                    m.group === "AVOID" && "bg-red-50 text-red-700 border-red-200",
                    m.group === "PREF" && "bg-[#3cc4f0]/10 text-[#0891b2] border-[#3cc4f0]/30",
                    m.group === "PORTION" && "bg-gray-100 text-gray-700 border-gray-200"
                  )}
                >
                  {m.name}
                </Badge>
              ))
            )}
          </div>
          <SlidersHorizontal className="h-3.5 w-3.5 flex-shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align={isRtl ? "end" : "start"}>
        <div className="p-3 space-y-3">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            {(["AVOID", "PREF", "PORTION"] as ModifierGroup[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={cn(
                  "flex-1 px-2 py-1.5 text-xs font-semibold rounded-md transition-all",
                  group === g ? "bg-white text-[#3cc4f0] shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {groupLabel(g)}
              </button>
            ))}
          </div>
          <Input
            placeholder={isRtl ? "بحث..." : "Search..."}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 text-sm rounded-lg"
          />
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {filtered.map((m: any) => {
              const sel = (value || []).includes(m._id);
              return (
                <Badge
                  key={m._id}
                  onClick={() => toggle(m._id)}
                  className={cn(
                    "cursor-pointer text-xs px-2.5 py-1 rounded-full transition-all select-none",
                    sel
                      ? m.group === "AVOID" ? "bg-red-500 text-white hover:bg-red-600"
                        : m.group === "PREF" ? "bg-[#3cc4f0] text-white hover:bg-[#2bb0dc]"
                        : "bg-[#47759c] text-white hover:bg-[#3a638a]"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  {m.name}
                </Badge>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 w-full text-center py-4">
                {isRtl ? "لا توجد نتائج" : "No results"}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * تاريخ فتح الصفحة.
 *
 * 🍳 المطبخ يطبخ اليوم لتوصيل الغد — فالأخصائية تخطّط **توصيل الغد**، لا اليوم
 *    (الذي طُبخ أمس وخرج للتوصيل). هذا نفس افتراضي صفحة المطبخ بالضبط.
 *    والجمعة الحالة الفارقة: يوم عمل كامل يُطبخ فيه لتوصيل السبت، ولا توصيل
 *    فيه — فالفتح على «اليوم» كان يُظهر للأخصائية جمعةً فارغة أبداً.
 *    (الخميس هو الإجازة الوحيدة: لا توصيل الجمعة ⇒ لا طبخ الخميس.)
 *
 * ونحترم ?date= القادم من صفحة المراجعة — كان يُهمَل فيقفز المستخدم لليوم.
 */
function initialPlanDate(): Date {
  const p = new URLSearchParams(window.location.search).get("date");
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) {
    // ⚠️ لا new Date("2026-07-18"): تُقرأ منتصف ليل UTC فيزحف اليوم حسب المنطقة
    const [y, m, d] = p.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const t = new Date();
  t.setDate(t.getDate() + 1);
  // 🚫 الجمعة لا توصيل — لو صادف الغد جمعةً نقفز للسبت (أول يوم توصيل تالٍ).
  if (t.getDay() === 5) t.setDate(t.getDate() + 1);
  return t;
}

/** ?customer= القادم من «تعديل» في صفحة المراجعة — كان يُهمَل فتُفتح بلا مشترك. */
function initialCustomerId(): string | null {
  return new URLSearchParams(window.location.search).get("customer");
}

/**
 * مرجع فارغ ثابت.
 *
 * ⚠️ `const { data: x = [] } = useQuery()` يُنشئ مصفوفة **جديدة كل رندر** ما دام
 *    data غير مُحمَّل. وهذه المصفوفة في اعتماديات useEffect الذي يستدعي
 *    setCurrentPlan بكائن جديد ⇒ رندر ⇒ مصفوفة جديدة ⇒ حلقة لا نهائية
 *    («Maximum update depth exceeded») تُسقِط الصفحة على شاشة الخطأ.
 *    لم تكن تظهر لأن المشترك لا يُفتح إلا بعد اكتمال التحميل؛ وفتحُه من
 *    ?customer= يقع في أول رندر — أي في قلب فترة التحميل. مرجع ثابت واحد
 *    يقطع الحلقة من جذرها.
 */
const EMPTY: any[] = [];

/* ─── Main Component ──────────────────────────────────── */
export default function PlansPage() {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [date, setDate] = useState<Date>(initialPlanDate);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<"ALL" | "MORNING" | "EVENING">("ALL");
  // ✅ فلتر الحالة: عرض الكل، أو اللي لسه محتاجين خطة، أو اللي خلصوا
  const [planFilter, setPlanFilter] = useState<"ALL" | "PENDING" | "DONE">("ALL");
  // ✅ فلتر البرنامج: مثل (FITNESS, DIET, BULK, CUSTOMIZED, etc.)
  const [programFilter, setProgramFilter] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Partial<DailyPlan> | null>(null);

  const { data: customers = EMPTY } = useCustomers();
  const { data: categories = EMPTY } = useCategories();
  const { data: menuItems = [] } = useMenuItems();
  const { data: modifiers = [] } = useModifiers();
  // ✅ منيو العميل (مصدر الجدول الأسبوعي الوحيد) — للتعبئة التلقائية واقتراحات اليوم
  const sessionToken = useStore((s: any) => s.sessionToken) || undefined;
  const publicMeals = (useQuery(api.publicMeals.list, { sessionToken }) as any[] | undefined) || [];
  const [weekOverride, setWeekOverride] = useState<number | null>(null);

  const formattedDate = format(date, "yyyy-MM-dd");
  const { data: dailyPlans = EMPTY } = useDailyPlans(formattedDate);

  const yesterdayDate = subDays(date, 1);
  const { data: yesterdayPlans = EMPTY } = useDailyPlans(format(yesterdayDate, "yyyy-MM-dd"));

  const createPlanMutation = useCreateDailyPlan();
  const updatePlanMutation = useUpdateDailyPlan();
  const dateLocale = isRtl ? ar : enUS;

  const selectedCustomer = useMemo(
    () => customers.find((c: any) => c._id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  /**
   * ✅ المشترك المخصّص — وجباته تُبنى في صفحة «الوجبات المخصّصة» من قالب واحد
   *    (بنّاء جرامات) يتكرر تلقائياً، لا من خطة يومية لكل يوم. ظهوره هنا كان
   *    يخلق مصدرين للمطبخ لنفس العميل (ازدواج في الأكل والاستيكر).
   *    القاعدة الآن: المخصّص مصدره القالب فقط.
   */
  const isCustomizedCustomer = (c: any) =>
    String(c?.program || c?.goalType || c?.goals || "").toUpperCase().includes("CUSTOM");

  // ✅ نصفّي المشتركين اللي اشتراكهم يشمل التاريخ المختار — كل يوم يعرض
  //   بس اللي فعلاً هيوصلهم فيه، مش كل المشتركين النشطين.
  const activeCustomers = useMemo(
    () => {
      const targetISO = formattedDate;
      return (customers || [])
        .filter((c: any) => c?.status === "ACTIVE" || c?.isActive === true || c?.isActive === undefined)
        // 🔀 المخصّصون لهم صفحتهم — نستبعدهم هنا لمنع ازدواج مصدر المطبخ
        .filter((c: any) => !isCustomizedCustomer(c))
        .filter((c: any) => {
          // لو مفيش startDate/endDate نعرضه (fallback)
          if (!c?.startDate && !c?.endDate) return true;
          if (c?.startDate && targetISO < String(c.startDate).slice(0, 10)) return false;
          if (c?.endDate && targetISO > String(c.endDate).slice(0, 10)) return false;
          return true;
        })
        .sort((a: any, b: any) =>
          String(a?.fullName || "").toLowerCase().localeCompare(String(b?.fullName || "").toLowerCase())
        );
    },
    [customers, formattedDate]
  );

  /** عدد المخصّصين المستبعدين — نعرض لافتة إرشاد للأخصائية بدل إخفاء صامت. */
  const customizedCount = useMemo(
    () => (customers || []).filter(
      (c: any) => (c?.isActive !== false) && isCustomizedCustomer(c),
    ).length,
    [customers],
  );

  const sortedCategories = useMemo(
    () => [...(categories || [])].sort((a: any, b: any) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0)),
    [categories]
  );

  // ✅ اسم يوم الأسبوع من التاريخ (JS: 0=أحد..6=سبت)
  const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const planDayName = DAY_NAMES[date.getDay()];
  const DAY_AR: Record<string, string> = { saturday: "السبت", sunday: "الأحد", monday: "الإثنين", tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة" };

  // ✅ أسبوع الدورة (1-4) = دورة المطعم الفعلية في التاريخ المختار.
  //   نستخدم rotationWeekAt من السيرفر — نفس المنطق اللي بيستخدمه المطبخ والعميل،
  //   عشان يكون كل الشاشات متسقة. لو الأخصائية عايزة تجرب أسبوع آخر → weekOverride.
  const rotationInfo = useQuery(
    api.restaurantSettings.rotationWeekAt,
    formattedDate ? { targetDate: formattedDate } : "skip",
  ) as { rotationWeek: number; currentCookingWeek: number; fridaysAhead: number } | undefined;
  const restaurantRotationWeek = rotationInfo?.rotationWeek || 1;
  const rotationWeek = weekOverride || restaurantRotationWeek;

  /**
   * ✅ ربط تصنيف المنيو العام (publicMeals.category) بخانات الأخصائية (mealCategories).
   *    publicMeals.category هو مصدر الحقيقة — نفس الحقل اللي بيفلتر بيه العميل في
   *    المنيو. أما menuItems.categoryId فبيانات داخلية قديمة وغير موثوقة
   *    (فيه أصناف بتشاور على تصنيفات محذوفة، وسناكات متصنّفة فطور).
   */
  const PUBLIC_CAT_ALIASES: Record<string, string[]> = {
    breakfast: ["breakfast", "فطور", "فطار", "الفطور", "الفطار"],
    lunch:     ["lunch", "غداء", "الغداء"],
    dinner:    ["dinner", "عشاء", "العشاء"],
    snack:     ["snacks", "snack", "سناك", "سناكس", "سناكات"],
    salad:     ["salad", "salads", "سلطات", "سلطة"],
  };

  /** publicMeals.category → [mealCategories._id] (قد يطابق أكثر من خانة: "Snacks" و"سناك") */
  const slotIdsForPublicCat = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [pubCat, aliases] of Object.entries(PUBLIC_CAT_ALIASES)) {
      const ids = (categories as any[])
        .filter((c) => aliases.includes(String(c?.name || "").trim().toLowerCase()))
        .map((c) => String(c._id));
      if (ids.length) map[pubCat] = ids;
    }
    return map;
  }, [categories]);

  // ✅ خريطة وجبات اليوم: mealCategoryId → [menuItemId]
  //
  // 🔗 الربط بالـID المخزَّن (menuItems.publicMealId)، لا بمطابقة الاسم.
  //    المطابقة بالاسم كانت تُسقِط 15 وجبة مجدولة من 139 **بصمت**: أي فرق
  //    إملائي (BEEF SHAWERMA / Beef Shawarma) يترك الخانة فاضية بلا خطأ،
  //    فتظن الأخصائية أن لا وجبة مقرّرة. والأسوأ: كل تصحيح إملائي لاحق
  //    يكسر المزيد. الرابط يُحسم مرة واحدة في convex/menuLink.ts.
  const scheduledByCategory = useMemo(() => {
    const miByMeal = new Map<string, any>();
    (menuItems as any[]).forEach((m) => {
      if (m.publicMealId && !miByMeal.has(String(m.publicMealId))) miByMeal.set(String(m.publicMealId), m);
    });
    const map: Record<string, string[]> = {};
    (publicMeals as any[]).forEach((pm) => {
      if (!Array.isArray(pm.schedule)) return;
      if (!pm.schedule.some((x: any) => x.week === rotationWeek && x.day === planDayName)) return;
      const mi = miByMeal.get(String(pm._id));
      if (!mi) return;
      // 🔑 الخانة تُشتقّ من تصنيف المنيو العام، لا من menuItem.categoryId
      for (const slotId of slotIdsForPublicCat[String(pm.category)] || []) {
        (map[slotId] ||= []);
        if (!map[slotId].includes(mi._id)) map[slotId].push(mi._id);
      }
    });
    return map;
  }, [publicMeals, menuItems, rotationWeek, planDayName, slotIdsForPublicCat]);

  const scheduledCount = useMemo(() => Object.values(scheduledByCategory).reduce((s, a) => s + a.length, 0), [scheduledByCategory]);

  // 🔗 خريطة معلومات الحجب لكل menuItem: اسم + مكوّنات + وسوم من الوجبة العامة —
  //    عشان الملء التلقائي يفحص ممنوعات المشترك بنفس منطق الخادم (مصدر واحد).
  const mealInfoByMenuItem = useMemo(() => {
    const pmById = new Map<string, any>();
    (publicMeals as any[]).forEach((pm) => pmById.set(String(pm._id), pm));
    const map = new Map<string, any>();
    (menuItems as any[]).forEach((mi) => {
      const pm = mi.publicMealId ? pmById.get(String(mi.publicMealId)) : null;
      map.set(String(mi._id), {
        nameAr: pm?.nameAr || mi.nameAr || mi.name,
        nameEn: pm?.nameEn || mi.nameEn,
        ingredients: pm?.ingredients || [],
        tags: pm?.tags || [],
        imageUrl: pm?.imageUrl || (mi as any).imageUrl || "",   // للعرض فقط
        calories: pm?.calories ?? (mi as any).calories,          // للعرض فقط
      });
    });
    return map;
  }, [menuItems, publicMeals]);

  // ممنوعات/حساسية المشترك المختار — كلمات المنع (المصدر الوحيد lib/mealRestrictions).
  const restrictWords = useMemo(
    () => restrictionWords((selectedCustomer as any)?.avoid, (selectedCustomer as any)?.allergies),
    [selectedCustomer],
  );

  useEffect(() => {
    if (!selectedCustomerId || !formattedDate) { setCurrentPlan(null); return; }

    const existingPlan = dailyPlans.find(
      (p: any) => p.customerId === selectedCustomerId && p.date === formattedDate
    );

    if (existingPlan) {
      setCurrentPlan(existingPlan);
    } else {
      const customer = customers.find((c: any) => c._id === selectedCustomerId);
      const mealsPerDay = customer?.mealsPerDay ?? 0;
      const snacksPerDay = customer?.snacksPerDay ?? 0;

      const mainCategories = sortedCategories.filter((c: any) => !isSnackCategoryName(c.name));
      const snackCategory = sortedCategories.find((c: any) => isSnackCategoryName(c.name));

      const newItems: any[] = [];

      // وزّع الوجبات الرئيسية على التصنيفات (Breakfast/Lunch/Dinner)
      // كل تصنيف ياخد على الأقل 1 لو `mealsPerDay` يكفي، والباقي يروح آخر تصنيف
      if (mainCategories.length > 0 && mealsPerDay > 0) {
        const slotsPerCat = Math.floor(mealsPerDay / mainCategories.length);
        const remainder = mealsPerDay % mainCategories.length;

        mainCategories.forEach((cat: any, idx: number) => {
          const count = slotsPerCat + (idx < remainder ? 1 : 0);
          for (let i = 0; i < count; i++) {
            newItems.push({ id: makeId(), categoryId: cat._id, menuItemId: null, modifierIds: [], specialNotes: "", isOff: false, meta: { index: i + 1 } });
          }
        });
      }

      // ولّد خانات السناك حسب اشتراكه
      if (snackCategory && snacksPerDay > 0) {
        for (let i = 0; i < snacksPerDay; i++) {
          newItems.push({ id: makeId(), categoryId: snackCategory._id, menuItemId: null, modifierIds: [], specialNotes: "", isOff: false, meta: { index: i + 1 } });
        }
      }
      setCurrentPlan({
        customerId: selectedCustomerId,
        date: formattedDate,
        deliveryTime: (selectedCustomer as any)?.deliveryTime || "MORNING",
        items: newItems,
        notes: "",
        status: "DRAFT",
      });
    }
  }, [selectedCustomerId, formattedDate, dailyPlans, customers, sortedCategories]);

  const handleCopyYesterday = () => {
    if (!selectedCustomerId) return;
    const yesterdayPlan = yesterdayPlans.find((p: any) => p.customerId === selectedCustomerId);
    if (!yesterdayPlan) {
      toast({ title: isRtl ? "لا توجد خطة أمس" : "No plan found", variant: "destructive" });
      return;
    }
    setCurrentPlan({
      ...currentPlan,
      deliveryTime: yesterdayPlan.deliveryTime || (selectedCustomer as any)?.deliveryTime || "MORNING",
      items: (yesterdayPlan.items || []).map((item: any) => ({ ...item, id: makeId() })),
      notes: yesterdayPlan.notes || "",
    });
    toast({ title: isRtl ? "✓ تم نسخ خطة الأمس" : "Copied" });
  };

  /** يبني خانات يوم فارغة لعميلٍ من اشتراكه (وجبات/سناك) — نفس منطق الـuseEffect،
   *  مُستخرَج ليستخدمه الملء الفردي والجماعي معاً. */
  const buildEmptyItemsFor = (customer: any): any[] => {
    const mealsPerDay = customer?.mealsPerDay ?? 0;
    const snacksPerDay = customer?.snacksPerDay ?? 0;
    const mainCategories = sortedCategories.filter((c: any) => !isSnackCategoryName(c.name));
    const snackCategory = sortedCategories.find((c: any) => isSnackCategoryName(c.name));
    const items: any[] = [];
    if (mainCategories.length > 0 && mealsPerDay > 0) {
      const slotsPerCat = Math.floor(mealsPerDay / mainCategories.length);
      const remainder = mealsPerDay % mainCategories.length;
      mainCategories.forEach((cat: any, idx: number) => {
        const count = slotsPerCat + (idx < remainder ? 1 : 0);
        for (let i = 0; i < count; i++) items.push({ id: makeId(), categoryId: cat._id, menuItemId: null, modifierIds: [], specialNotes: "", isOff: false, meta: { index: i + 1 } });
      });
    }
    if (snackCategory && snacksPerDay > 0) {
      for (let i = 0; i < snacksPerDay; i++) items.push({ id: makeId(), categoryId: snackCategory._id, menuItemId: null, modifierIds: [], specialNotes: "", isOff: false, meta: { index: i + 1 } });
    }
    return items;
  };

  /** يملأ الخانات الفارغة من جدول اليوم محترماً ممنوعات المشترك (words). المصدر
   *  الوحيد للملء — يستخدمه الفردي والجماعي فلا يفترقا. */
  const fillItemsWith = (items: any[], words: string[]): { items: any[]; filled: number; blocked: number } => {
    let filled = 0, blocked = 0;
    const isRestricted = (id: string) => mealIsRestricted(mealInfoByMenuItem.get(String(id)), words);
    const out = items.map((it: any) => {
      if (it.isOff || it.menuItemId) return it;
      const candidates = scheduledByCategory[String(it.categoryId)] || [];
      if (!candidates.length) return it;
      const start = (((it?.meta?.index ?? 1) - 1) % candidates.length + candidates.length) % candidates.length;
      let pick: string | null = null;
      for (let k = 0; k < candidates.length; k++) {
        const cand = candidates[(start + k) % candidates.length];
        if (!isRestricted(cand)) { pick = cand; break; }
      }
      if (!pick) { blocked++; return it; }
      filled++;
      return { ...it, menuItemId: pick };
    });
    return { items: out, filled, blocked };
  };

  // ✅ ملء الخانات الفارغة تلقائياً بوجبات اليوم (لا يستبدل المُختار، ويحترم الممنوعات)
  const handleAutoFillDay = () => {
    if (!currentPlan) return;
    const { items, filled, blocked } = fillItemsWith(currentPlan.items as any[], restrictWords);
    if (!filled && !blocked) {
      toast({ title: isRtl ? "لا توجد وجبات مجدولة لهذا اليوم" : "No scheduled meals for this day", variant: "destructive" });
      return;
    }
    setCurrentPlan({ ...currentPlan, items });
    toast({
      title: isRtl ? `✓ تم ملء ${filled} وجبة من منيو اليوم` : `Filled ${filled} meals from today's menu`,
      description: blocked
        ? (isRtl
            ? `⚠ تُركت ${blocked} خانة: كل وجباتها ضمن ممنوعات المشترك — اخترها يدوياً`
            : `⚠ ${blocked} slot(s) left empty: all their meals are within the customer's restrictions`)
        : (restrictWords.length ? (isRtl ? "روعيت ممنوعات المشترك" : "Customer restrictions respected") : undefined),
    });
  };

  // ✅ الملء الجماعي: ينشئ مسودّات لكل مشترك نشط بلا خطة لهذا اليوم — بنفس الفلتر
  //    (يحترم الممنوعات وحدود اليوم). القرار يبقى للأخصائية (مسودّة لا اعتماد).
  const [bulkFilling, setBulkFilling] = useState(false);
  const handleFillAllPlanless = async () => {
    const planned = new Set(dailyPlans.map((p: any) => String(p.customerId)));
    const planless = activeCustomers.filter((c: any) => !planned.has(String(c._id)));
    if (!planless.length) { toast({ title: isRtl ? "كل المشتركين لديهم خطة اليوم ✓" : "All customers already have a plan today" }); return; }
    const ok = await confirmDialog({
      title: isRtl ? "ملء كل من بلا خطة" : "Fill all without a plan",
      message: isRtl
        ? `سيتم إنشاء مسودّة خطة لـ${planless.length} مشترك بوجبات ${planDayName ? "اليوم" : "اليوم"} — محترمةً ممنوعاتهم وحدود اشتراكهم. تراجعها وتعتمدها بعدين. متابعة؟`
        : `Draft plans will be created for ${planless.length} customers with today's meals — respecting their restrictions and limits. You review and confirm later. Continue?`,
      confirmText: isRtl ? "نعم، املأ الكل" : "Yes, fill all",
      cancelText: isRtl ? "إلغاء" : "Cancel",
    });
    if (!ok) return;
    setBulkFilling(true);
    let created = 0, empty = 0, failed = 0;
    for (const c of planless) {
      const words = restrictionWords((c as any).avoid, (c as any).allergies);
      const { items, filled } = fillItemsWith(buildEmptyItemsFor(c), words);
      if (!filled) { empty++; continue; } // بلا وجبات مجدولة مناسبة — نتركه للأخصائية
      try {
        await createPlanMutation.mutateAsync(stripSystemFields({
          customerId: c._id, date: formattedDate,
          deliveryTime: (c as any).deliveryTime || "MORNING",
          items, notes: "", status: "DRAFT",
        }) as any);
        created++;
      } catch { failed++; }
    }
    setBulkFilling(false);
    toast({
      title: isRtl ? `✓ أُنشئت ${created} مسودّة` : `✓ Created ${created} drafts`,
      description: [
        empty ? (isRtl ? `${empty} بلا وجبات مناسبة` : `${empty} had no suitable meals`) : "",
        failed ? (isRtl ? `${failed} فشلوا` : `${failed} failed`) : "",
      ].filter(Boolean).join(" · ") || (isRtl ? "روعيت الممنوعات وحدود الاشتراك" : "Restrictions and limits respected"),
    });
  };

  const updateItemById = (itemId: string, updates: Partial<DailyPlanItem>) => {
    if (!currentPlan) return;
    setCurrentPlan({
      ...currentPlan,
      items: (currentPlan.items as any[])?.map((item: any) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    });
  };

  const addCategorySlot = (categoryId: string) => {
    if (!currentPlan) return;
    const items = currentPlan.items as any[];
    const nextIndex = items.filter((i: any) => i.categoryId === categoryId).length + 1;
    setCurrentPlan({
      ...currentPlan,
      items: [...items, { id: makeId(), categoryId, menuItemId: null, modifierIds: [], specialNotes: "", isOff: false, meta: { index: nextIndex } }],
    });
  };

  const removeCategorySlot = (itemId: string) => {
    if (!currentPlan) return;
    setCurrentPlan({ ...currentPlan, items: (currentPlan.items as any[])?.filter((i: any) => i.id !== itemId) });
  };

  const handleSave = async (status: "DRAFT" | "CONFIRMED") => {
    if (!currentPlan || !selectedCustomerId) return;
    if (status === "CONFIRMED") {
      const hasMeal = (currentPlan.items as any[])?.some((i: any) => !i.isOff && i.menuItemId);
      if (!hasMeal) {
        toast({ title: isRtl ? "يجب اختيار وجبة واحدة على الأقل" : "Select at least one meal", variant: "destructive" });
        return;
      }
    }

    // تنظيف أي تحذيرات قديمة كانت محقونة في specialNotes (لو خطة قديمة)
    // الـ Kitchen صار يقرأ بيانات العميل مباشرة فمش محتاجين الحقن
    const cleanedItems = (currentPlan.items as any[] || []).map((it: any) => {
      const original = String(it.specialNotes || "").trim();
      const cleaned = original
        .replace(/\[(?:⚠|✕|⚖|★)[^\]]*\]/g, "")
        .replace(/^\s*\|\s*/, "")
        .replace(/\s*\|\s*$/, "")
        .replace(/\s*\|\s*\|/g, " | ")
        .trim();
      return { ...it, specialNotes: cleaned };
    });

    const payload = stripSystemFields({
      ...currentPlan,
      items: cleanedItems,
      customerId: selectedCustomerId,
      status,
    });
    try {
      if ((currentPlan as any)._id) {
        await updatePlanMutation.mutateAsync({ id: (currentPlan as any)._id, data: payload });
      } else {
        const created = await createPlanMutation.mutateAsync(payload as any);
        setCurrentPlan({ ...currentPlan, _id: created } as any);
      }
      toast({ title: status === "CONFIRMED" ? (isRtl ? "✓ تم تأكيد الخطة" : "Plan confirmed") : (isRtl ? "✓ تم حفظ المسودة" : "Draft saved") });

      // ✅ بعد تأكيد الخطة، اسأل لو عاوز ينتقل لعميل آخر
      if (status === "CONFIRMED") {
        setTimeout(async () => {
          const goNext = await confirmDialog({ message:
            isRtl
              ? "تم تأكيد الخطة بنجاح ✓\n\nهل تريد العودة لاختيار عميل آخر؟"
              : "Plan confirmed ✓\n\nGo back to select another customer?"
          });
          if (goNext) {
            setSelectedCustomerId(null);
            setCurrentPlan(null);
          }
        }, 300);
      }
    } catch (error: any) {
      toast({ title: isRtl ? "فشل الحفظ" : "Failed to save", description: error?.message, variant: "destructive" });
    }
  };

  // ✅ زرار العودة لقائمة العملاء
  const handleBackToCustomers = () => {
    setSelectedCustomerId(null);
    setCurrentPlan(null);
  };

  const handleExportCSV = () => {
    if (!dailyPlans || dailyPlans.length === 0) {
      toast({ title: isRtl ? "لا توجد بيانات للتصدير" : "No data", variant: "destructive" });
      return;
    }
    const headers = ["Date", "Customer Name", "Phone", "Delivery Time", ...sortedCategories.map((c: any) => c.name), "Notes"];
    const rows = dailyPlans.map((plan: any) => {
      const customer = customers.find((c: any) => c._id === plan.customerId);
      const rowData: any[] = [plan.date, customer?.fullName || "Unknown", customer?.phone || "", customer?.deliveryTime || ""];
      for (const category of sortedCategories) {
        const items = (plan.items || []).filter((i: any) => i.categoryId === category._id);
        rowData.push(items.map((item: any) => {
          if (!item?.menuItemId) return item?.isOff ? "OFF" : "Not Selected";
          const meal = menuItems.find((m: any) => m._id === item.menuItemId);
          const mods = (item.modifierIds || []).map((mid: string) => modifiers.find((m: any) => m._id === mid)?.name).filter(Boolean);
          return [meal?.name, mods.length ? `(${mods.join(", ")})` : ""].filter(Boolean).join(" ");
        }).join(" | "));
      }
      rowData.push(plan.notes || "");
      return rowData.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `plans_${formattedDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * ✅ ألوان التصنيفات — مشتقّة من هوية أدرينالين فقط:
   *    سماوي #3cc4f0 · أزرق فولاذي #47759c · أزرق عميق #0E76AC · كحلي #0E2A4A
   *    (بدل الأصفر/الأخضر اللي كانوا خارج الهوية)
   */
  const getCategoryAccent = (name: string) => {
    const n = name.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) return { color: "#3cc4f0", bg: "#f2fbfe", light: "#d7f2fc", icon: "☀️" };
    if (n.includes("LUNCH") || n.includes("غداء"))    return { color: "#0E76AC", bg: "#f0f8fc", light: "#cfe8f5", icon: "🍽️" };
    if (n.includes("DINNER") || n.includes("عشاء"))   return { color: "#47759c", bg: "#f3f6f9", light: "#dbe5ee", icon: "🌙" };
    if (n.includes("SNACK") || n.includes("سناك"))    return { color: "#0E2A4A", bg: "#f2f5f8", light: "#d6dee7", icon: "🥗" };
    return { color: "#47759c", bg: "#f8fafc", light: "#f1f5f9", icon: "🍴" };
  };

  const getCategoryLabel = (category: any) => {
    if (!isRtl) return category.name;
    if (category.nameAr) return category.nameAr;
    const name = String(category.name || "").toUpperCase();
    if (name.includes("BREAKFAST")) return "فطور";
    if (name.includes("LUNCH")) return "غداء";
    if (name.includes("DINNER")) return "عشاء";
    if (name.includes("SNACK")) return "سناك";
    if (name.includes("OTHER")) return "أخرى";
    return category.name;
  };

  const isToday = formattedDate === format(new Date(), "yyyy-MM-dd");
  // «بكرة» هو الافتراضي — نسمّيه باسمه بدل تاريخ مجرّد، وإلا بدا الفتح عشوائياً
  const isTomorrowDate = formattedDate === format(addDays(new Date(), 1), "yyyy-MM-dd");

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="daily-plans-page pb-32">

      {/* ── Sticky Header ── */}
      <div className="plans-sticky-header sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3"
        style={{ boxShadow: "0 1px 12px rgba(0,0,0,0.07)" }}>
        <div className="plans-header-inner max-w-[1400px] mx-auto flex items-center justify-between gap-3">

          {/* Left: date navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDate(d => subDays(d, 1))}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg hover:bg-gray-50 transition-colors group">
                  <CalendarIcon className="h-3.5 w-3.5 text-[#3cc4f0]" />
                  {/* ✅ اسم اليوم + التاريخ واضحين (يعرف أي يوم يملأ) + شارة نسبية */}
                  <span className="plans-date-label text-sm font-semibold whitespace-nowrap">
                    {format(date, "EEEE، d MMM", { locale: dateLocale })}
                  </span>
                  {(isTomorrowDate || isToday) && (
                    <span className="plans-date-badge text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: "#eaf6fd", color: "#0E76AC" }}>
                      {isTomorrowDate ? (isRtl ? "توصيل بكرة" : "Tomorrow") : (isRtl ? "اليوم" : "Today")}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align={isRtl ? "end" : "start"}>
                <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setIsCalendarOpen(false); } }} initialFocus />
              </PopoverContent>
            </Popover>
            <button
              onClick={() => setDate(d => addDays(d, 1))}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* Center: title + rotation badge */}
          <div className="plans-header-title flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-800">
              {isRtl ? "الخطط اليومية" : "Daily Plans"}
            </h1>
            {/* ✅ دورة المطبخ لهذا اليوم — نفس المنطق اللي يستخدمه العميل والمطبخ */}
            {rotationInfo && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-black"
                style={{ background: "#eaf6fd", color: "#0E76AC", border: "1px solid #bfe6f7" }}
                title={isRtl
                  ? `المطبخ الآن على أسبوع ${rotationInfo.currentCookingWeek} — في هذا التاريخ سيكون على أسبوع ${rotationInfo.rotationWeek}`
                  : `Kitchen now on week ${rotationInfo.currentCookingWeek} — on this date it will be on week ${rotationInfo.rotationWeek}`}
              >
                <Sparkles className="h-3 w-3" />
                {isRtl
                  ? `المطعم في دورة ${rotationInfo.rotationWeek}`
                  : `Restaurant · Week ${rotationInfo.rotationWeek}`}
              </span>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportCSV}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title={isRtl ? "تصدير CSV" : "Export CSV"}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLocation(`/plans-review/${formattedDate}`)}
              className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-colors"
              style={{ background: "#3cc4f010", color: "#3cc4f0" }}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{isRtl ? "مراجعة" : "Review"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={cn("mx-auto px-4 py-5 space-y-4", selectedCustomerId ? "max-w-[1400px]" : "max-w-6xl")}>

        {/* ── No customer selected: Premium empty state ── */}
        {!selectedCustomerId ? (() => {
          // Compute stats
          const customersWithPlans = new Set(dailyPlans.map((p: any) => String(p.customerId)));
          const plannedCount = activeCustomers.filter((c: any) => customersWithPlans.has(String(c._id))).length;
          const pendingCount = activeCustomers.length - plannedCount;
          const morningCount = activeCustomers.filter((c: any) => c.deliveryTime === "MORNING").length;
          const eveningCount = activeCustomers.filter((c: any) => c.deliveryTime === "EVENING").length;

          // Filter
          const [filterTime, setFilterTime] = [deliveryFilter, setDeliveryFilter];
          const [searchQ, setSearchQ] = [searchQuery, setSearchQuery];

          let filtered = activeCustomers;
          if (filterTime !== "ALL") {
            filtered = filtered.filter((c: any) => c.deliveryTime === filterTime);
          }
          if (programFilter) {
            filtered = filtered.filter((c: any) => (c.program || "STANDARD").toUpperCase() === programFilter);
          }
          if (searchQ.trim()) {
            const q = searchQ.trim().toLowerCase();
            filtered = filtered.filter((c: any) =>
              String(c.fullName || "").toLowerCase().includes(q) ||
              String(c.phone || "").includes(q)
            );
          }
          // ✅ فلتر حالة الخطة
          if (planFilter === "PENDING") {
            filtered = filtered.filter((c: any) => !customersWithPlans.has(String(c._id)));
          } else if (planFilter === "DONE") {
            filtered = filtered.filter((c: any) => customersWithPlans.has(String(c._id)));
          }
          // ✅ ترتيب: العملاء بدون خطة أولاً، ثم اللي خلصوا
          filtered = [...filtered].sort((a: any, b: any) => {
            const aDone = customersWithPlans.has(String(a._id)) ? 1 : 0;
            const bDone = customersWithPlans.has(String(b._id)) ? 1 : 0;
            return aDone - bDone;
          });

          // Avatar gradient based on first letter
          const getAvatarGradient = (name: string) => {
            const palettes = [
              ["#3cc4f0", "#2bb0dc"],
              ["#47759c", "#5a8ab5"],
              ["#10b981", "#34d399"],
              ["#f59e0b", "#fcd34d"],
              ["#8b5cf6", "#a78bfa"],
              ["#ec4899", "#f472b6"],
              ["#06b6d4", "#22d3ee"],
            ];
            const code = (name || "?").charCodeAt(0) || 0;
            const p = palettes[code % palettes.length];
            return `linear-gradient(135deg, ${p[0]}, ${p[1]})`;
          };

          return (
            <div className="space-y-5">
              {/* ─── Hero gradient banner ─── */}
              <div
                className="plans-overview rounded-3xl overflow-hidden relative p-7"
                style={{
                  background: "linear-gradient(135deg,#0E2A4A 0%,#0E76AC 55%,#3AC7F4 100%)",
                  boxShadow: "0 8px 32px rgba(14,42,74,0.25)",
                }}
              >
                {/* Decorative glow */}
                <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-30"
                  style={{ background: "radial-gradient(circle, #ffffff60, transparent 70%)" }} />
                <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-20"
                  style={{ background: "radial-gradient(circle, #ffffff80, transparent 70%)" }} />

                <div className="relative flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center backdrop-blur-sm"
                      style={{ background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.3)" }}>
                      <UtensilsCrossed className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white tracking-tight">
                        {isRtl ? "تخطيط الوجبات" : "Meal Planning"}
                      </h2>
                      <p className="text-sm text-white/80 mt-1">
                        {isRtl ? "اختر مشتركاً لتعيين وجبات اليوم" : "Select a subscriber to assign today's meals"}
                      </p>
                    </div>
                  </div>

                  {/* Stats inline pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="rounded-xl px-3 py-2 backdrop-blur-sm flex items-center gap-2"
                      style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}>
                      <div className="h-7 w-7 rounded-lg bg-white/25 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-white tabular-nums leading-none">{plannedCount}</p>
                        <p className="text-[10px] text-white/80 mt-0.5">{isRtl ? "خطط جاهزة" : "Planned"}</p>
                      </div>
                    </div>
                    <div className="rounded-xl px-3 py-2 backdrop-blur-sm flex items-center gap-2"
                      style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}>
                      <div className="h-7 w-7 rounded-lg bg-white/25 flex items-center justify-center">
                        <Clock className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-white tabular-nums leading-none">{pendingCount}</p>
                        <p className="text-[10px] text-white/80 mt-0.5">{isRtl ? "معلقة" : "Pending"}</p>
                      </div>
                    </div>
                    <div className="rounded-xl px-3 py-2 backdrop-blur-sm flex items-center gap-2"
                      style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}>
                      <div className="h-7 w-7 rounded-lg bg-white/25 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-white tabular-nums leading-none">{activeCustomers.length}</p>
                        <p className="text-[10px] text-white/80 mt-0.5">{isRtl ? "إجمالي" : "Total"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🚫 الجمعة لا توصيل — لا خطط ولا ملء */}
              {planDayName === "friday" && (
                <div className="w-full rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-bold text-amber-800 bg-amber-50 border border-amber-200 text-sm">
                  {isRtl ? "🚫 الجمعة يوم عمل بلا توصيل — لا خطط توصيل لهذا اليوم (المطبخ يطبخ للسبت)" : "Friday is a work day with no delivery — no delivery plans"}
                </div>
              )}

              {/* ─── ملء جماعي: مسودّات لكل من بلا خطة (يحترم الممنوعات والحدود) ─── */}
              {/*    يظهر فقط عند وجود وجبات مجدولة لليوم — فلا يُعرض على الجمعة (0 مجدول) */}
              {pendingCount > 0 && scheduledCount > 0 && (
                <button
                  onClick={handleFillAllPlanless}
                  disabled={bulkFilling}
                  className="w-full rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-black text-white transition-all disabled:opacity-70 disabled:cursor-wait hover:brightness-110 active:scale-[0.99]"
                  style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)", boxShadow: "0 4px 14px rgba(14,118,172,0.25)" }}
                >
                  <Sparkles className="h-4 w-4" />
                  {bulkFilling
                    ? (isRtl ? "يملأ المسودّات…" : "Creating drafts…")
                    : (isRtl ? `املأ ${pendingCount} مشترك بلا خطة (مسودّات)` : `Fill ${pendingCount} without a plan (drafts)`)}
                </button>
              )}

              {/* ─── Search + Filters ─── */}
              <div className="plans-filter-panel bg-white rounded-2xl p-4 space-y-3"
                style={{ boxShadow: "0 2px 14px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)" }}>
                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isRtl ? "ابحث بالاسم أو رقم الهاتف..." : "Search by name or phone..."}
                    className={cn(
                      "w-full h-11 rounded-xl text-sm font-medium pl-4 pr-10 transition-all outline-none",
                      isRtl ? "text-right" : "text-left"
                    )}
                    style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }}
                    onFocus={(e) => (e.target.style.borderColor = "#3cc4f0")}
                    onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { key: "ALL",     label: isRtl ? "الكل" : "All",     icon: null,                       count: activeCustomers.length },
                    { key: "MORNING", label: isRtl ? "صباحي" : "Morning", icon: <Sun className="h-3.5 w-3.5" />,  count: morningCount },
                    { key: "EVENING", label: isRtl ? "مسائي" : "Evening", icon: <Moon className="h-3.5 w-3.5" />, count: eveningCount },
                  ].map((f) => {
                    const active = filterTime === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setFilterTime(f.key as any)}
                        className={cn(
                          "h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all",
                          active ? "text-white" : "text-gray-500 hover:bg-gray-50"
                        )}
                        style={active
                          ? { background: "linear-gradient(135deg, #3cc4f0, #2bb0dc)", boxShadow: "0 3px 10px #3cc4f040" }
                          : { background: "#f8fafc", border: "1px solid #e2e8f0" }
                        }
                      >
                        {f.icon}
                        <span>{f.label}</span>
                        <span className={cn(
                          "text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums",
                          active ? "bg-white/25" : "bg-white"
                        )}>
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ─── Plan status filter chips ─── */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[11px] font-semibold text-gray-400 mr-1">{isRtl ? "الحالة:" : "Status:"}</span>
                  {[
                    { key: "PENDING", label: isRtl ? "محتاج خطة" : "Pending", color: "#f59e0b", count: pendingCount, icon: <Clock className="h-3 w-3" /> },
                    { key: "DONE",    label: isRtl ? "خلصت"      : "Done",    color: "#10b981", count: plannedCount, icon: <Check className="h-3 w-3" /> },
                    { key: "ALL",     label: isRtl ? "الكل"      : "All",     color: "#47759c", count: activeCustomers.length, icon: null },
                  ].map((f) => {
                    const active = planFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setPlanFilter(f.key as any)}
                        className={cn(
                          "h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all",
                          active ? "text-white" : "text-gray-500 hover:bg-gray-50"
                        )}
                        style={active
                          ? { background: f.color, boxShadow: `0 3px 8px ${f.color}40` }
                          : { background: "#f8fafc", border: "1px solid #e2e8f0" }
                        }
                      >
                        {f.icon}
                        <span>{f.label}</span>
                        <span className={cn(
                          "text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums",
                          active ? "bg-white/25" : "bg-white"
                        )}>
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ─── Program Filter Chips ─── */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[11px] font-semibold text-gray-400 mr-1">{isRtl ? "البرنامج:" : "Program:"}</span>
                  {[
                    // ℹ️ «مخصص» اتشال — المخصّصون لهم صفحتهم (الوجبات المخصّصة)
                    { key: null, label: isRtl ? "الكل" : "All", color: "#47759c" },
                    { key: "FITNESS", label: "Fitness", color: "#06b6d4" },
                    { key: "DIET", label: "Diet", color: "#3cc4f0" },
                    { key: "BULK", label: "Bulk", color: "#0E76AC" },
                    { key: "STANDARD", label: "Standard", color: "#64748b" },
                  ].map((f) => {
                    const active = programFilter === f.key;
                    // Calculate count for this program in activeCustomers list
                    const count = f.key === null 
                      ? activeCustomers.length 
                      : activeCustomers.filter((c: any) => (c.program || "STANDARD").toUpperCase() === f.key).length;

                    if (f.key !== null && count === 0) return null; // skip if no customers have this program

                    return (
                      <button
                        key={String(f.key)}
                        onClick={() => setProgramFilter(f.key)}
                        className={cn(
                          "h-8 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all",
                          active ? "text-white" : "text-gray-500 hover:bg-gray-50"
                        )}
                        style={active
                          ? { background: f.color, boxShadow: `0 3px 8px ${f.color}40` }
                          : { background: "#f8fafc", border: "1px solid #e2e8f0" }
                        }
                      >
                        <span>{f.label}</span>
                        <span className={cn(
                          "text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums",
                          active ? "bg-white/25" : "bg-white"
                        )}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── لافتة المخصّصين — إرشاد بدل إخفاء صامت ─── */}
              {customizedCount > 0 && (
                <button
                  onClick={() => setLocation("/customized")}
                  className="w-full rounded-2xl p-3 flex items-center gap-3 text-start transition-all hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg, #f2fbfe, #ffffff)",
                    border: "1px solid #bfe9f8",
                    boxShadow: "0 2px 10px rgba(60,196,240,0.10)",
                  }}
                >
                  <div className="h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white"
                    style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}>
                    <UtensilsCrossed className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black" style={{ color: "#0E2A4A" }}>
                      {isRtl
                        ? `${customizedCount} مشترك مخصّص — وجباتهم في صفحة «الوجبات المخصّصة»`
                        : `${customizedCount} customized subscribers — managed in «Customized Meals»`}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#47759c" }}>
                      {isRtl
                        ? "وجباتهم تُبنى من قالب واحد يتكرر — لا تُملأ يوم بيوم هنا."
                        : "Their meals come from one repeating template — not filled day-by-day here."}
                    </p>
                  </div>
                  <span className="text-[11px] font-black flex-shrink-0 px-3 h-8 rounded-lg flex items-center gap-1"
                    style={{ background: "#3cc4f0", color: "#fff" }}>
                    {isRtl ? "افتح ←" : "Open →"}
                  </span>
                </button>
              )}

              {/* ─── Customer cards grid ─── */}
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl py-16 flex flex-col items-center gap-3"
                  style={{ boxShadow: "0 2px 14px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "#f1f5f9" }}>
                    <Search className="h-6 w-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-400">
                    {isRtl ? "لا توجد نتائج" : "No results"}
                  </p>
                </div>
              ) : (
                <div className="plans-customer-grid grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" }}>
                  {filtered.map((customer: any) => {
                    const hasPlan = customersWithPlans.has(String(customer._id));
                    const meals = customer.mealsPerDay ?? 0;
                    const snacks = customer.snacksPerDay ?? 0;
                    const isMorn = customer.deliveryTime === "MORNING";
                    const daysLeft = customer.endDate
                      ? Math.max(0, Math.ceil((new Date(customer.endDate).getTime() - Date.now()) / 86400000))
                      : null;
                    const hasAllergy = !!String(customer.allergies || "").trim();

                    return (
                      <button
                        key={customer._id}
                        onClick={() => setSelectedCustomerId(customer._id)}
                        className={cn(
                          "plan-customer-card group rounded-2xl overflow-hidden text-right transition-all hover:-translate-y-1 active:scale-[0.98] relative",
                          hasPlan ? "opacity-70 hover:opacity-100" : ""
                        )}
                        style={{
                          boxShadow: hasPlan
                            ? "0 2px 10px rgba(16,185,129,0.12)"
                            : "0 2px 14px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)",
                          border: hasPlan
                            ? "1.5px solid #a7f3d0"
                            : "1px solid rgba(0,0,0,0.06)",
                          background: hasPlan
                            ? "linear-gradient(135deg, #f0fdf4, #ffffff)"
                            : "#ffffff",
                        }}
                      >
                        {/* ✅ Large "DONE" overlay watermark for completed customers */}
                        {hasPlan && (
                          <div className="absolute top-3 left-3 z-10">
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-white shadow-lg"
                              style={{
                                background: "linear-gradient(135deg, #10b981, #059669)",
                                boxShadow: "0 4px 12px rgba(16,185,129,0.4)",
                              }}
                            >
                              <Check className="h-5 w-5" strokeWidth={3} />
                            </div>
                          </div>
                        )}

                        {/* Status indicator strip */}
                        <div
                          className="plan-customer-status-strip h-1.5"
                          style={{
                            background: hasPlan
                              ? "linear-gradient(90deg, #10b981, #34d399)"
                              : "linear-gradient(90deg, #3cc4f0, #2bb0dc)",
                          }}
                        />

                        {/* Top section: avatar + name + status */}
                        <div className="plan-customer-identity p-4 flex items-start gap-3">
                          <div className="flex-1 min-w-0 text-right">
                            <div className="flex items-center gap-1.5 justify-end mb-1 flex-wrap">
                              {hasAllergy && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1"
                                  style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {isRtl ? "حساسية" : "Allergy"}
                                </span>
                              )}
                              {hasPlan ? (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1"
                                  style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                                  <Check className="h-2.5 w-2.5" />
                                  {isRtl ? "جاهز" : "Ready"}
                                </span>
                              ) : (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1"
                                  style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }}>
                                  <Clock className="h-2.5 w-2.5" />
                                  {isRtl ? "معلق" : "Pending"}
                                </span>
                              )}
                            </div>
                            <p className="plan-customer-name text-sm font-bold truncate">{customer.fullName}</p>
                            <p className="plan-customer-phone text-[11px] mt-0.5" dir="ltr">{customer.phone}</p>
                          </div>

                          {/* Avatar */}
                          <div
                            className="plan-customer-avatar h-12 w-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-base font-black text-white shadow-md transition-transform duration-200 group-hover:scale-105"
                            style={{ background: getAvatarGradient(customer.fullName) }}
                          >
                            {customer.fullName?.charAt(0).toUpperCase()}
                          </div>
                        </div>

                        {/* Stats row */}
                        <div className="plan-customer-stats px-4 pb-3">
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="plan-customer-stat rounded-lg py-1.5"
                              style={{ background: isMorn ? "linear-gradient(135deg, #fffbeb, #fef9c3)" : "linear-gradient(135deg, #eff6ff, #e0e7ff)" }}>
                              <div className="flex items-center justify-center gap-1">
                                {isMorn ? <Sun className="h-3 w-3 text-amber-500" /> : <Moon className="h-3 w-3 text-indigo-500" />}
                                <p className={cn("text-[10px] font-black", isMorn ? "text-amber-700" : "text-indigo-700")}>
                                  {isMorn ? (isRtl ? "صباحي" : "AM") : (isRtl ? "مسائي" : "PM")}
                                </p>
                              </div>
                            </div>
                            <div className="plan-customer-stat rounded-lg py-1.5"
                              style={{ background: "linear-gradient(135deg, #ecfeff, #cffafe)" }}>
                              <p className="text-sm font-black text-cyan-700 tabular-nums leading-none">{meals}</p>
                              <p className="text-[9px] text-cyan-600 font-semibold mt-0.5">{isRtl ? "وجبات" : "Meals"}</p>
                            </div>
                            <div className="plan-customer-stat rounded-lg py-1.5"
                              style={{ background: "linear-gradient(135deg, #f0fdf4, #d1fae5)" }}>
                              <p className="text-sm font-black text-emerald-700 tabular-nums leading-none">{snacks}</p>
                              <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">{isRtl ? "سناك" : "Snack"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: program + days left */}
                        <div className="plan-customer-footer px-4 pb-3 pt-2 border-t border-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {daysLeft !== null && (
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                daysLeft <= 3 ? "text-red-600 bg-red-50" : daysLeft <= 7 ? "text-amber-600 bg-amber-50" : "text-gray-500 bg-gray-50"
                              )}>
                                {daysLeft} {isRtl ? "يوم" : "d"}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-gray-500 truncate max-w-[120px]">
                            {customer.program || "—"}
                          </span>
                        </div>

                        {/* Hover CTA */}
                        <div className="absolute inset-x-0 bottom-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: "linear-gradient(90deg, #3cc4f0, #47759c)" }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })() : (
          <>
            {/* ── Back to customers button (above selector bar) ── */}
            <button
              onClick={handleBackToCustomers}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-colors hover:bg-white"
              style={{ color: "#47759c" }}
            >
              {isRtl ? (
                <>
                  <ChevronRight className="h-4 w-4" />
                  <span>العودة لقائمة العملاء</span>
                </>
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span>Back to Customers</span>
                </>
              )}
            </button>

            {/* ── Customer selector bar ── */}
            <div className="plans-customer-toolbar bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="plans-customer-toolbar-head flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #3cc4f0, #47759c)" }}>
                  {(selectedCustomer as any)?.fullName?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="plans-selected-name text-sm font-bold truncate">{(selectedCustomer as any)?.fullName}</p>
                  <p className="plans-selected-phone text-xs" dir="ltr">{(selectedCustomer as any)?.phone}</p>
                </div>
                <Popover open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
                  <PopoverTrigger asChild>
                    <button className="plans-change-customer text-xs font-semibold px-3 h-8 rounded-lg transition-colors flex-shrink-0"
                      style={{ background: "#3cc4f010", color: "#3cc4f0" }}>
                      {isRtl ? "تغيير" : "Change"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align={isRtl ? "end" : "start"}>
                    <Command>
                      <CommandInput placeholder={isRtl ? "ابحث عن مشترك" : "Search customer"} />
                      <CommandList>
                        <CommandEmpty>{isRtl ? "لا يوجد عميل" : "No customer found"}</CommandEmpty>
                        <CommandGroup>
                          {activeCustomers.map((customer: any) => (
                            <CommandItem
                              key={customer._id}
                              value={`${customer.fullName} ${customer.phone}`}
                              onSelect={() => { setSelectedCustomerId(customer._id); setIsCustomerOpen(false); }}
                              className={cn("flex gap-3", isRtl ? "flex-row-reverse" : "")}
                            >
                              <div className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
                                style={{ background: "#3cc4f0" }}>
                                {customer.fullName?.charAt(0).toUpperCase()}
                              </div>
                              <div className={cn("flex flex-col flex-1", isRtl ? "text-right" : "text-left")}>
                                <span className="font-medium text-sm">{customer.fullName}</span>
                                <span className="text-xs text-gray-400" dir="ltr">{customer.phone}</span>
                              </div>
                              {selectedCustomerId === customer._id && <Check className="h-4 w-4 text-[#3cc4f0]" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Copy yesterday */}
              <div className="plans-customer-toolbar-controls px-4 pb-4">
                <button
                  onClick={handleCopyYesterday}
                  className="w-full h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80"
                  style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", color: "#64748b" }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {isRtl ? "نسخ خطة أمس" : "Copy Yesterday's Plan"}
                </button>

                {/* ✅ التعبئة التلقائية من منيو اليوم (الجدول الأسبوعي) */}
                {selectedCustomer && (
                  <div className="mt-2 rounded-xl p-2.5" style={{ background: "#eaf6fd", border: "1px solid #bfe6f7" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#0E76AC]">
                        {isRtl ? `منيو ${DAY_AR[planDayName] || planDayName} · أسبوع ${rotationWeek}` : `${planDayName} · Week ${rotationWeek}`}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4].map((w) => (
                          <button key={w} onClick={() => setWeekOverride(w === rotationWeek && weekOverride ? null : w)}
                            className={cn("h-6 w-6 rounded-md text-[10px] font-bold transition-all",
                              rotationWeek === w ? "text-white" : "bg-white text-gray-400 border border-gray-200")}
                            style={rotationWeek === w ? { background: "#0E76AC" } : {}}>
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleAutoFillDay}
                      disabled={scheduledCount === 0}
                      className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-white transition-all hover:opacity-90 disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {isRtl ? `املأ من منيو اليوم (${scheduledCount})` : `Fill from today's menu (${scheduledCount})`}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Customer info card ── */}
            {selectedCustomer && (() => {
              const c: any = selectedCustomer;
              const mealsCount = c.mealsPerDay ?? 0;
              const snacksCount = c.snacksPerDay ?? 0;
              const totalMeals = c.totalMealsPerDay ?? (mealsCount + snacksCount);

              return (
                <div className="selected-customer-summary bg-white rounded-2xl overflow-hidden"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.06)" }}>

                  {/* Top row: delivery + program */}
                  <div className="grid grid-cols-2 divide-x divide-gray-100" style={isRtl ? { direction: "rtl" } : {}}>
                    <div className="p-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                        style={{ background: "#3cc4f012" }}>
                        <Clock className="h-4 w-4" style={{ color: "#3cc4f0" }} />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 font-medium">{isRtl ? "وقت التوصيل" : "Delivery Time"}</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">
                          {c.deliveryTime === "MORNING" ? (isRtl ? "صباحي" : "Morning")
                            : c.deliveryTime === "EVENING" ? (isRtl ? "مسائي" : "Evening")
                            : c.deliveryTime || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                        style={{ background: "#47759c12" }}>
                        <User className="h-4 w-4" style={{ color: "#47759c" }} />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 font-medium">{isRtl ? "نوع الحمية" : "Program"}</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">{c.program || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Subscription details — meals/snacks counts */}
                  {(mealsCount > 0 || snacksCount > 0) && (
                    <div className="px-4 pb-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {isRtl ? "تفاصيل الاشتراك" : "Subscription"}
                      </p>
                      {/* ✅ ثلاث بطاقات بتدرّج واحد من الهوية — سماوي → فولاذي → كحلي */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: mealsCount, label: isRtl ? "وجبات" : "Meals", tone: "#3cc4f0", tint: "#f2fbfe", edge: "#bfe9f8" },
                          { value: snacksCount, label: isRtl ? "سناكات" : "Snacks", tone: "#0E76AC", tint: "#f0f8fc", edge: "#c4e2f1" },
                          { value: totalMeals, label: isRtl ? "الإجمالي" : "Total", tone: "#0E2A4A", tint: "#f4f6f9", edge: "#d3dbe4" },
                        ].map((s) => (
                          <div key={s.label} className="rounded-xl p-2.5 text-center"
                            style={{ background: s.tint, border: `1px solid ${s.edge}` }}>
                            <p className="text-2xl font-black tabular-nums" style={{ color: s.tone }}>{s.value}</p>
                            <p className="text-[10px] font-medium mt-0.5" style={{ color: "#47759c" }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ✅ لوحة واحدة لكل قيود/تفضيلات العميل — بدل 5 صناديق ملوّنة مرصوصة.
                      الأحمر محجوز للحساسية فقط (سلامة). الباقي بهوية أدرينالين. */}
                  {(c.allergies || c.avoid || c.preferences || c.portions || c.notes) && (
                    <div className="mx-4 mb-4 rounded-xl overflow-hidden"
                      style={{ border: "1px solid #e6ebf0" }}>
                      {[
                        c.allergies && {
                          key: "allergies", label: isRtl ? "حساسية" : "Allergy", value: c.allergies,
                          icon: "⚠", tone: "#dc2626", tint: "#fef2f2", critical: true,
                        },
                        c.avoid && {
                          key: "avoid", label: isRtl ? "ممنوعات" : "Avoid", value: c.avoid,
                          icon: "✕", tone: "#0E2A4A", tint: "#f5f7f9",
                        },
                        c.preferences && {
                          key: "prefs", label: isRtl ? "تفضيلات" : "Prefers", value: c.preferences,
                          icon: "★", tone: "#3cc4f0", tint: "#f5fcfe",
                        },
                        c.portions && {
                          key: "portions", label: isRtl ? "الكميات" : "Portions", value: c.portions,
                          icon: "⚖", tone: "#0E76AC", tint: "#f5fafd",
                        },
                        c.notes && {
                          key: "notes", label: isRtl ? "ملاحظات" : "Notes", value: c.notes,
                          icon: "✎", tone: "#47759c", tint: "#f7f9fb",
                        },
                      ].filter(Boolean).map((row: any, i: number) => (
                        <div key={row.key}
                          className="flex items-stretch text-xs"
                          style={{
                            background: row.tint,
                            borderTop: i === 0 ? "none" : "1px solid #e6ebf0",
                          }}>
                          <div className="w-1 flex-shrink-0" style={{ background: row.tone }} />
                          <div className="w-8 flex-shrink-0 flex items-center justify-center font-black"
                            style={{ color: row.tone }}>{row.icon}</div>
                          <div className="flex-1 min-w-0 py-2.5 pe-3 flex items-baseline gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wide flex-shrink-0"
                              style={{ color: row.tone }}>{row.label}</span>
                            <span className={cn("leading-relaxed", row.critical ? "font-bold" : "font-medium")}
                              style={{ color: row.critical ? "#991b1b" : "#0f1516" }}>{row.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Plan content ── */}
            {currentPlan && (
              <div className="space-y-3">

                {/* Plan notes */}
                <div className="plan-notes-card bg-white rounded-2xl p-4"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <p className="text-xs font-semibold text-gray-500 mb-2.5 flex items-center gap-1.5">
                    <StickyNote className="h-3.5 w-3.5" />
                    {isRtl ? "ملاحظات الخطة" : "Plan Notes"}
                  </p>
                  <Textarea
                    placeholder={isRtl ? "مثال: بدون ملح، استبدل الأرز بقرنبيط..." : "Example: No salt, replace rice with cauliflower..."}
                    value={currentPlan.notes || ""}
                    onChange={(e) => setCurrentPlan({ ...currentPlan, notes: e.target.value })}
                    className={cn("rounded-xl resize-none h-20 text-sm border-gray-200 focus:border-[#3cc4f0] focus:ring-[#3cc4f0]/20", isRtl ? "text-right" : "text-left")}
                  />
                </div>

                {/* ── Unified meal grid: clean brand-only design ── */}
                {(() => {
                  const cust: any = selectedCustomer;
                  const allItems = (currentPlan.items as any[]) || [];

                  const orderedItems = [...allItems].sort((a, b) => {
                    const catA = sortedCategories.findIndex((c: any) => c._id === a.categoryId);
                    const catB = sortedCategories.findIndex((c: any) => c._id === b.categoryId);
                    if (catA !== catB) return catA - catB;
                    return (a?.meta?.index ?? 0) - (b?.meta?.index ?? 0);
                  });

                  const catCounts: Record<string, number> = {};
                  allItems.forEach((it: any) => {
                    catCounts[it.categoryId] = (catCounts[it.categoryId] || 0) + 1;
                  });

                  // Section header summarizing total meals
                  const totalActive = allItems.filter((i: any) => !i.isOff).length;

                  return (
                    <>
                      {/* Section title */}
                      <div className="flex items-center justify-between px-1 mb-1">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: "#3cc4f015", color: "#3cc4f0" }}>
                          {totalActive} {isRtl ? "وجبة" : "meals"}
                        </span>
                        <h3 className="text-sm font-bold text-gray-800">
                          {isRtl ? "وجبات اليوم" : "Today's Meals"}
                        </h3>
                      </div>

                      {/* ✅ شريط تحذير واحد ثابت — بدل تكراره داخل كل بطاقة وجبة.
                          يفضل ظاهر أثناء التمرير فالأخصائية بتشوفه وهي بتختار. */}
                      {(cust?.allergies || cust?.avoid) && (
                        <div className="plan-safety-strip sticky top-[57px] z-20 mb-3 rounded-xl overflow-hidden"
                          style={{
                            border: cust?.allergies ? "1.5px solid #fca5a5" : "1px solid #d6dee7",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          }}>
                          {cust?.allergies && (
                            <div className="flex items-stretch text-xs" style={{ background: "#fef2f2" }}>
                              <div className="w-9 flex-shrink-0 flex items-center justify-center text-white font-black"
                                style={{ background: "#dc2626" }}>⚠</div>
                              <div className="flex-1 min-w-0 px-3 py-2 flex items-baseline gap-2 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wide text-red-600 flex-shrink-0">
                                  {isRtl ? "حساسية" : "Allergy"}
                                </span>
                                <span className="font-bold text-red-900">{cust.allergies}</span>
                              </div>
                            </div>
                          )}
                          {cust?.avoid && (
                            <div className="flex items-stretch text-xs"
                              style={{ background: "#f5f7f9", borderTop: cust?.allergies ? "1px solid #fca5a5" : "none" }}>
                              <div className="w-9 flex-shrink-0 flex items-center justify-center text-white font-black"
                                style={{ background: "#0E2A4A" }}>✕</div>
                              <div className="flex-1 min-w-0 px-3 py-2 flex items-baseline gap-2 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wide flex-shrink-0"
                                  style={{ color: "#0E2A4A" }}>
                                  {isRtl ? "ممنوعات" : "Avoid"}
                                </span>
                                <span className="font-semibold" style={{ color: "#0f1516" }}>{cust.avoid}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="daily-meals-grid grid gap-4">
                        {orderedItems.map((item: any) => {
                          const category = sortedCategories.find((c: any) => c._id === item.categoryId);
                          if (!category) return null;
                          const accent = getCategoryAccent(category.name);
                          // ✅ قائمة الاختيار = أصناف الخانة + أي صنف مجدول اليوم لها.
                          //    بدون الشق الثاني كان المقترح يُفلتر ويختفي، لأن
                          //    menuItem.categoryId قديم/محذوف لكثير من الأصناف.
                          const slotSuggestedIds = scheduledByCategory[String(item.categoryId)] || [];
                          const slotSugSet = new Set(slotSuggestedIds);
                          const categoryItems = menuItems.filter(
                            (m: any) => m.isActive && (m.categoryId === category._id || slotSugSet.has(m._id))
                          );
                          const showIndex = (catCounts[item.categoryId] || 0) > 1;
                          const canRemove = (catCounts[item.categoryId] || 0) > 1;
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "daily-meal-card bg-white rounded-2xl overflow-hidden transition-all flex flex-col group",
                                item.isOff ? "opacity-50" : "hover:-translate-y-0.5"
                              )}
                              style={{
                                boxShadow: item.isOff
                                  ? "0 1px 4px rgba(0,0,0,0.04)"
                                  : "0 2px 14px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)",
                                border: "1px solid rgba(0,0,0,0.06)",
                              }}
                            >
                              {/* Card header */}
                              <div className="meal-card-header flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <Switch
                                    checked={!item.isOff}
                                    onCheckedChange={(checked) =>
                                      updateItemById(item.id, { isOff: !checked, menuItemId: checked ? item.menuItemId : null })
                                    }
                                  />
                                  {canRemove && (
                                    <button
                                      onClick={() => removeCategorySlot(item.id)}
                                      className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {showIndex && (
                                    <span className="text-[10px] font-black tabular-nums px-1.5 h-5 rounded-md flex items-center text-gray-400 bg-gray-100">
                                      #{item?.meta?.index ?? 1}
                                    </span>
                                  )}
                                  <span className="meal-category-label text-[11px] font-bold px-2 h-6 rounded-md flex items-center gap-1.5"
                                    style={{ color: accent.color, background: accent.color + "12", borderInlineStart: `3px solid ${accent.color}` }}>
                                    <span className="text-sm leading-none">{accent.icon}</span>
                                    {getCategoryLabel(category)}
                                  </span>
                                </div>
                              </div>

                              {/* Body */}
                              {!item.isOff && (
                                <div className="meal-card-body p-4 pt-3 space-y-3 flex-1 flex flex-col">
                                  {/* 🖼️ كارت الوجبة المختارة (صورة + اسم + سعرات) — زي منيو العميل،
                                      ليرى الأخصائي ما اختاره بوضوح. عرض فقط — لا يمسّ أي منطق. */}
                                  {(() => {
                                    const info = item.menuItemId ? mealInfoByMenuItem.get(String(item.menuItemId)) : null;
                                    return (
                                      <div className="meal-card-visual relative w-full h-24 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                                        {info?.imageUrl ? (
                                          <img src={info.imageUrl} alt={info.nameAr || ""} className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-3xl opacity-40">{accent.icon}</span>
                                        )}
                                        {info ? (
                                          <div className="absolute inset-x-0 bottom-0 px-2.5 py-1.5"
                                            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0))" }}>
                                            <div className="text-[13px] font-black text-white leading-tight line-clamp-1">
                                              {isRtl ? info.nameAr : (info.nameEn || info.nameAr)}
                                            </div>
                                            {info.calories != null && (
                                              <div className="text-[10.5px] font-bold text-white/85 mt-0.5">{info.calories} {isRtl ? "سعرة" : "kcal"}</div>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="absolute bottom-1.5 inset-x-0 text-center text-[11px] font-bold text-slate-400">
                                            {isRtl ? "لم تُختَر وجبة بعد" : "No meal selected yet"}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  {/* Meal picker */}
                                  <MealPicker
                                    value={item.menuItemId || null}
                                    onChange={(val) => updateItemById(item.id, { menuItemId: val })}
                                    items={categoryItems}
                                    placeholder={isRtl ? "اختر الوجبة" : "Choose meal"}
                                    isRtl={isRtl}
                                    suggestedIds={slotSuggestedIds}
                                    infoById={mealInfoByMenuItem}
                                  />

                                  {/* ℹ️ تحذيرات العميل (حساسية/ممنوعات) لم تعد تتكرّر في كل بطاقة —
                                      تظهر مرة واحدة في شريط ثابت أعلى قسم الوجبات. */}

                                  {/* Modifiers picker */}
                                  <ModifiersPicker
                                    value={item.modifierIds || []}
                                    onChange={(next) => updateItemById(item.id, { modifierIds: next } as any)}
                                    modifiers={modifiers || []}
                                    isRtl={isRtl}
                                  />

                                  <Input
                                    placeholder={isRtl ? "ملاحظة..." : "Note..."}
                                    className={cn("h-8 rounded-lg text-[11px] border-gray-200 focus:border-[#3cc4f0] mt-auto", isRtl ? "text-right" : "text-left")}
                                    value={item.specialNotes || ""}
                                    onChange={(e: any) => updateItemById(item.id, { specialNotes: e.target.value })}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add buttons — minimal, brand-styled */}
                      <div
                        className="grid gap-2 mt-3"
                        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
                      >
                        {sortedCategories.map((cat: any) => {
                          const accent = getCategoryAccent(cat.name);
                          return (
                            <button
                              key={cat._id}
                              onClick={() => addCategorySlot(cat._id)}
                              className="add-meal-slot h-9 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                              style={{
                                border: `1.5px dashed ${accent.color}40`,
                                color: accent.color,
                                background: "transparent",
                              }}
                            >
                              <Plus className="h-3 w-3" />
                              <span>{accent.icon}</span>
                              {isRtl ? `إضافة ${getCategoryLabel(cat)}` : `Add ${cat.name}`}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Fixed bottom actions ── */}
      {selectedCustomerId && currentPlan && (
        <div className="plans-action-bar fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-3"
          style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
          <div className="plans-action-inner max-w-[1400px] mx-auto">
            <div className="plans-action-secondary flex items-center gap-2">
              <button
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: isRtl ? "إلغاء" : "Cancel",
                    message: isRtl ? "تجاهل التعديلات غير المحفوظة والرجوع لاختيار عميل؟" : "Discard unsaved changes and go back to customer selection?",
                    variant: "danger",
                    confirmText: isRtl ? "نعم، إلغاء" : "Yes, cancel",
                  });
                  if (!ok) return;
                  setSelectedCustomerId(null);
                  setCurrentPlan(null);
                }}
                className="plans-cancel-action h-10 px-3 rounded-lg text-xs font-bold text-red-600 flex items-center justify-center gap-1.5 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                {isRtl ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={() => setLocation(`/plans-review/${formattedDate}`)}
                className="plans-review-action h-10 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                {isRtl ? "المراجعة النهائية" : "Final Review"}
              </button>
            </div>
            <div className="plans-action-primary grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleSave("DRAFT")}
                className="plans-draft-action h-11 rounded-lg text-sm font-semibold transition-colors"
              >
                {isRtl ? "حفظ مسودة" : "Save Draft"}
              </button>
              <button
                onClick={() => handleSave("CONFIRMED")}
                className="plans-confirm-action h-11 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #3cc4f0, #2bb0dc)", boxShadow: "0 4px 14px #3cc4f040" }}
              >
                <Check className="h-4 w-4" />
                {isRtl ? "تأكيد الخطة" : "Confirm Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
