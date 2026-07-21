/**
 * @file client/src/pages/Kitchen.tsx
 * @description نظام عرض المطبخ (KDS) - تصميم احترافي للشيف
 * @convex convex/dailyPlans.ts, convex/customers.ts, convex/menuItems.ts, convex/mealCategories.ts, convex/modifiers.ts
 */
import { useMemo, useState, useEffect } from "react";
import {
  useDailyPlans,
  useUpdateDailyPlan,
  usePrepareAndConsume,
  useCustomers,
  useMenuItems,
  useCategories,
  useModifiers,
  useStickers,
} from "@/lib/api";

import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";
import { alertDialog } from "@/lib/dialogs";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Calendar as CalendarIcon,
  Printer,
  Truck,
  AlertTriangle,
  ChefHat,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/DashboardHeader";
import { downloadKitchenXlsx, downloadKitchenPdf, type KitchenPerson } from "@/lib/kitchenSheet";
import { openPrintDoc } from "@/lib/printDoc";
import { getEffectivePlanItems } from "@/lib/planItems";
import { Download, FileSpreadsheet } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ModifierGroup = "AVOID" | "PREF" | "PORTION";

// ✅ ترجمة أسماء البروتين/الكارب للمخصّص (القالب قد يكون محفوظاً بالعربي) — لعرض
//    كشف الشيف بالكامل بلغة الواجهة. القيم مطابقة لقوائم شاشة الوجبات المخصّصة.
const PROTEIN_TR: Array<{ ar: string; en: string }> = [
  { ar: "دجاج", en: "Chicken" }, { ar: "سمك", en: "Fish" }, { ar: "سلمون", en: "Salmon" },
  { ar: "ستيك", en: "Steak" }, { ar: "لحم بقري", en: "Beef" }, { ar: "لحم مفروم", en: "Minced beef" },
  { ar: "جمبري", en: "Shrimp" }, { ar: "ديك رومي", en: "Turkey" }, { ar: "تونة", en: "Tuna" }, { ar: "بيض", en: "Eggs" },
  // أنواع شائعة (طهي) — تُترجم للمطبخ الإنجليزي تلقائياً
  { ar: "دجاج مشوي", en: "Grilled chicken" }, { ar: "دجاج مقلي", en: "Fried chicken" },
  { ar: "دجاج بانيه", en: "Crispy chicken" }, { ar: "صدر دجاج", en: "Chicken breast" },
  { ar: "شيش طاووق", en: "Shish tawook" }, { ar: "سمك مشوي", en: "Grilled fish" },
  { ar: "سمك أبيض", en: "White fish" }, { ar: "سلمون مشوي", en: "Grilled salmon" },
  { ar: "ستيك مشوي", en: "Grilled steak" }, { ar: "لحم مشوي", en: "Grilled beef" },
  { ar: "كفتة", en: "Kofta" }, { ar: "كباب", en: "Kebab" }, { ar: "جمبري مشوي", en: "Grilled shrimp" },
  { ar: "بيض مسلوق", en: "Boiled eggs" }, { ar: "بياض بيض", en: "Egg whites" },
];
const CARB_TR: Array<{ ar: string; en: string }> = [
  { ar: "بدون", en: "None" }, { ar: "رز أبيض", en: "White rice" }, { ar: "رز بني", en: "Brown rice" },
  { ar: "باستا", en: "Pasta" }, { ar: "بطاطس", en: "Potato" }, { ar: "بطاطا حلوة", en: "Sweet potato" },
  { ar: "خبز", en: "Bread" }, { ar: "برغل", en: "Bulgur" }, { ar: "كينوا", en: "Quinoa" },
  // أنواع شائعة
  { ar: "رز بسمتي", en: "Basmati rice" }, { ar: "رز مصري", en: "Egyptian rice" },
  { ar: "بطاطس مهروسة", en: "Mashed potato" }, { ar: "بطاطس مشوية", en: "Roasted potato" },
  { ar: "مكرونة", en: "Pasta" }, { ar: "شوفان", en: "Oats" }, { ar: "خبز أسمر", en: "Brown bread" },
];
const trName = (name: string, table: Array<{ ar: string; en: string }>, isRtl: boolean): string => {
  const o = table.find((x) => x.ar === name || x.en === name);
  return o ? (isRtl ? o.ar : o.en) : name;
};

// ✅ الأصناف القياسية (سلطة/سناك/شوربة/حلو) — تُطبخ عادي حتى للمخصّصين وتُحسب في الإجمالي (زي الإكسيل)
const STD_SIDE_KEYS = ["CRAB SALAD", "LAVA CAKE", "COOKIES", "FRUIT SALAD", "VEGETABLES SOUP", "CINNAMON APPLE", "BROWNIES", "LAZY CAKE", "CEASAR SALAD", "TIRAMISU"];
const isStdSideName = (nm: string) => { const u = String(nm || "").toUpperCase(); return STD_SIDE_KEYS.some((k) => u.includes(k)); };

// ✅ فلترة الممنوعات حسب الطبق: الممنوع القاطع (سمك/لحمة/فراخ/رومي) يُطبَّق فقط على الأطباق التي
//    يخصّها اسمها؛ الطبق الغامض البروتين لا يُتخطّى أبداً (أماناً). الممنوعات الدقيقة (طماطم/بصل/فطر…)
//    تبقى مطبّقة دائماً لأننا لا نملك مكوّنات كل طبق. تُطبَّق على "الممنوعات" فقط — الحساسية تظل دائماً.
const AVOID_CAT_KEYWORDS: Record<string, string[]> = {
  SEAFOOD: ["fish", "seafood", "sea food", "shellfish", "shrimp", "prawn", "crab", "salmon", "tuna", "سمك", "بحري", "روبيان", "جمبري", "سي فود", "سيفود"],
  BEEF: ["beef", "steak", "kofta", "بقري", "لحم بقري", "عجل", "ستيك", "كفتة"],
  CHICKEN: ["chicken", "دجاج", "فراخ", "poultry", "tawook", "طاووق"],
  TURKEY: ["turkey", "رومي", "ديك رومي", "ديك رومى"],
};
const MEAL_CAT_KEYWORDS: Record<string, string[]> = {
  SEAFOOD: ["fish", "salmon", "slamon", "shrimp", "prawn", "crab", "tuna", "sayadieh", "calamari", "squid", "seafood"],
  BEEF: ["beef", "steak", "kofta", "koofta", "pastrami", "bolognese", "vindal", "dawoud", "meat ball", "meatball", "meat balls"],
  CHICKEN: ["chicken", "tawook", "tawok", "twook", "shish", "shishawook", "cordon blue", "peri peri", "periperi"],
  TURKEY: ["turkey"],
};
// أطباق غامضة البروتين — قد تخبّئ لحمة/فراخ/سمك → لا يُتخطّى لها أي ممنوع قاطع
const PROTEIN_AMBIGUOUS = ["adrenaline healthy majboos", "mangolian noodles", "stuffed pepper", "crispy strips", "oriental breakfast"];
const avoidPhraseCats = (phrase: string): string[] => {
  const p = phrase.toLowerCase();
  return Object.entries(AVOID_CAT_KEYWORDS).filter(([, kws]) => kws.some((k) => p.includes(k))).map(([c]) => c);
};
const mealHasCat = (mealName: string, cat: string): boolean => {
  const m = mealName.toLowerCase();
  return (MEAL_CAT_KEYWORDS[cat] || []).some((k) => m.includes(k));
};
const mealIsProteinAmbiguous = (mealName: string): boolean => {
  const m = mealName.toLowerCase();
  return PROTEIN_AMBIGUOUS.some((a) => m.includes(a));
};
// تُرجع الممنوعات التي تنطبق فعلاً على هذا الطبق (مثلاً تشيل "سمك" من طبق بيض)
const filterAvoidForMeal = (avoidText: string | undefined | null, mealName: string): string => {
  const parts = String(avoidText || "").split(/[,،]/).map((s) => s.trim()).filter(Boolean);
  const kept = parts.filter((part) => {
    const cats = avoidPhraseCats(part);
    if (cats.length === 0) return true;                 // ممنوع دقيق/غير معروف → يظل دائماً
    if (mealIsProteinAmbiguous(mealName)) return true;  // طبق غامض البروتين → لا نتخطّى (أمان)
    return cats.some((c) => mealHasCat(mealName, c));    // يُطبَّق فقط لو الطبق فعلاً من نفس الصنف
  });
  return kept.join("، ");
};

export default function Kitchen() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const dateLocale = language === "ar" ? ar : enUS;

  // ✅ المطبخ يطبخ اليوم لتوصيل الغد — فيفتح افتراضياً على "توصيل بكرة".
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; };
  const [date, setDate] = useState(tomorrow());
  const [activeTab, setActiveTab] = useState<"MORNING" | "EVENING" | "SUMMARY">("MORNING");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // هل التاريخ المختار = بكرة / النهاردة (لعرض العنوان)
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  const isTomorrow = iso(date) === iso(tomorrow());
  const isTodayDate = iso(date) === iso(new Date());
  const jumpTo = (which: "TODAY" | "TOMORROW") => setDate(which === "TODAY" ? new Date() : tomorrow());

  // ✅ Dialog state for meal details
  const [openMealDialog, setOpenMealDialog] = useState(false);
  const [selectedMealName, setSelectedMealName] = useState("");
  const [selectedMealDetails, setSelectedMealDetails] = useState<any[]>([]);

  const formattedDate = format(date, "yyyy-MM-dd");

  const { data: dailyPlans = [] } = useDailyPlans();
  const { data: customers = [] } = useCustomers();
  const { data: menuItems = [] } = useMenuItems();
  const { data: categories = [] } = useCategories();
  const { data: modifiers = [] } = useModifiers();
  const updatePlanMutation = useUpdateDailyPlan();
  const prepareAndConsume = usePrepareAndConsume();
  const sessionTok = useStore((s) => s.sessionToken) || undefined;
  const toggleItemPrepared = useMutation(api.dailyPlans.toggleItemPrepared);
  const bulkTogglePrepared = useMutation(api.dailyPlans.bulkToggleItemsPrepared);
  // ✅ فتح الكشف يجمّد أرقام البوكس لليوم كمان — فالكشف والستيكر يبقوا مطابقين وثابتين
  //    مهما فُتح أيّهما أولاً (نفس مصدر الترقيم convex/stickers).
  const ensureBoxNumbers = useMutation(api.stickers.ensureBoxNumbers);
  useEffect(() => {
    if (!formattedDate || !sessionTok) return;
    ensureBoxNumbers({ date: formattedDate, sessionToken: sessionTok }).catch(() => { /* لا نُعطّل الكشف */ });
  }, [formattedDate, sessionTok, ensureBoxNumbers]);
  const todayIngredients = useQuery(api.dailyPlans.todayIngredients, { date: formattedDate, sessionToken: sessionTok }) as any[] | undefined;
  // ✅ وجبات العملاء المخصّصين لهذا اليوم (من قوالبهم) — منفصلة لأنها لكل شخص بكمياته
  const customized = useQuery(api.customizedPlans.forDate, { date: formattedDate, sessionToken: sessionTok }) as any[] | undefined;
  // ✅ وجبات المنيو العام (مصدر أطباق الأساس للمخصّص) — لترجمة اسم الطبق للإنجليزي في الكشف
  const publicMealsList = useQuery(api.publicMeals.listMeals, { sessionToken: sessionTok }) as any[] | undefined;
  // ✅ حصص البرامج من إعدادات المطعم (كارب جم + مدى البروتين لكل برنامج)
  const restSettings = useQuery(api.restaurantSettings.get) as any;
  const programPortions = restSettings?.programPortions || {
    DIET: { carb: 100, protein: "80-90" },
    FITNESS: { carb: 150, protein: "100-110" },
    BULK: { carb: 170, protein: "150-160" },
  };

  const plans = useMemo(() => {
    return dailyPlans
      .filter(
        (p: any) =>
          p.date === formattedDate &&
          p.deliveryTime === activeTab &&
          (p.status === "CONFIRMED" || p.status === "PREPARED")
      )
      .sort((a: any, b: any) => {
        if (a.status === "CONFIRMED" && b.status === "PREPARED") return -1;
        if (a.status === "PREPARED" && b.status === "CONFIRMED") return 1;
        return 0;
      });
  }, [dailyPlans, formattedDate, activeTab]);

  const stats = useMemo(() => {
    const today = plans.filter((p: any) => p.status === "CONFIRMED").length;
    const prepared = plans.filter((p: any) => p.status === "PREPARED").length;
    return { today, prepared };
  }, [plans]);

  const getCustomer = (id: string) => customers.find((c: any) => c._id === id);
  const getMenuItem = (id: string) => menuItems.find((m: any) => m._id === id);
  const getCategory = (id: string) => categories.find((c: any) => c._id === id);

  // ✅ محتوى وجبات المطبخ إنجليزي دائماً (المطبخ يقرأ إنجليزي) — بغضّ النظر عن لغة الجهاز.
  const mealById = useMemo(() => {
    const m = new Map<string, any>();
    [...(publicMealsList || []), ...(menuItems || [])].forEach((x: any) => { if (x?._id) m.set(String(x._id), x); });
    return m;
  }, [publicMealsList, menuItems]);
  const publicMealById = useMemo(() => {
    const map = new Map<string, any>();
    (publicMealsList || []).forEach((meal: any) => {
      if (meal?._id) map.set(String(meal._id), meal);
    });
    return map;
  }, [publicMealsList]);
  const resolvePlanMeal = (item: any): { meal: any | null; legacyMenu: any | null } => {
    const legacyMenu = item?.menuItemId ? getMenuItem(item.menuItemId) : null;
    const canonicalId = item?.publicMealId || item?.mealId || (legacyMenu as any)?.publicMealId;
    const canonical = canonicalId ? publicMealById.get(String(canonicalId)) : null;
    // Legacy manual plans must keep the exact menuItem name used when they
    // were approved. Canonical data is only the fallback for new plan rows.
    return { meal: legacyMenu || canonical || null, legacyMenu };
  };
  const mealNameInLang = (mealId: any, item?: any): string => {
    const { meal } = item ? resolvePlanMeal(item) : { meal: null };
    const resolved: any = meal || (mealId && (getMenuItem(mealId) || mealById.get(String(mealId)))) || null;
    if (resolved) return String(resolved.nameEn || resolved.name || resolved.nameAr).trim();
    return String(item?.mealNameEn || item?.mealNameAr || "Unspecified meal").trim();
  };
  // ✅ تركيب سطر الوجبة المخصّصة — إنجليزي دائماً للمطبخ (أساس nameEn + بروتين/كارب مترجَمان + جرامات g)
  const NOT_SET = isRtl ? "⚠ لم تُحدَّد الوجبة" : "⚠ MEAL NOT SET";
  const composeCustItem = (it: any): string => {
    const gUnit = "g";
    const m: any = it.baseMealId ? mealById.get(String(it.baseMealId)) : null;
    const base = m ? String(m.nameEn || m.nameAr || m.name).trim() : String(it.baseName || "").trim();
    if (it.type === "MAIN") {
      const protName = trName(it.proteinName || "", PROTEIN_TR, false); // فاضي = غير محدّد
      // ✅ خانة رئيسية غير محدّدة (لا اسم وجبة ولا نوع بروتين) = يوم لم يُملأ.
      //    لا نضع أكلاً وهمياً (Protein 150g) يلخبط الشيف — نعلن أنها غير محدّدة.
      if (!base && !protName) return NOT_SET;
      const bits: string[] = [];
      if (base) bits.push(base);
      const inner: string[] = [];
      if (protName && it.proteinG) inner.push(`${protName} ${it.proteinG}${gUnit}`);
      const carbTr = trName(it.carbName || "", CARB_TR, false);
      if (it.carbName && carbTr !== "None" && it.carbG) inner.push(`${carbTr} ${it.carbG}${gUnit}`);
      if (inner.length) bits.push(bits.length ? `— ${inner.join(" + ")}` : inner.join(" + "));
      return bits.join(" ").trim() || NOT_SET;
    }
    // غير رئيسية (سناك/سلطة): الاسم كما هو
    return base || String(it.text || it.baseName || "—").trim();
  };

  const getCategoryLabel = (categoryName: string) => {
    const n = categoryName.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) return isRtl ? "فطور" : "BREAKFAST";
    if (n.includes("LUNCH") || n.includes("غداء")) return isRtl ? "غداء" : "LUNCH";
    if (n.includes("DINNER") || n.includes("عشاء")) return isRtl ? "عشاء" : "DINNER";
    if (n.includes("SNACK") || n.includes("سناك")) return isRtl ? "سناك" : "SNACKS";
    return categoryName.toUpperCase();
  };

  // ✅ حساب إجمالي الوجبات لليوم (كل فترات التوصيل)
  const mealSummary = useMemo(() => {
    const allPlansToday = dailyPlans.filter(
      (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED")
    );

    // خريطة وجبات المنيو العام بالمعرّف — لحل اسم الطبق (وبالإنجليزي في وضع الإنجليزي)
    const pubById = new Map<string, any>();
    (publicMealsList || []).forEach((m: any) => { if (m?._id) pubById.set(String(m._id), m); });

    // ✅ الأصناف القياسية (سلطة/سناك/شوربة/حلو) التي تُطبخ عادي حتى للمخصّصين → تُحسب في الإجمالي
    const isStandardSide = isStdSideName;

    const summary: Record<string, {
      count: number;
      plainCount: number;     // ✅ عادي بدون تعديلات
      modifiedCount: number;  // ✅ معدّل (فيه ممنوعات أو تفضيلات)
      dietCount: number;
      fitnessCount: number;
      bulkCount: number;
      customizedCount: number;
      standardCount: number;
      category: string;
      locations: Array<{ planId: string; itemIndex: number }>;  // مواقع الحصص لتعليمها دفعة
      preparedCount: number;                                     // كم حصة معلّمة جاهزة
      details: Array<{
        customerName: string;
        deliveryTime: string;
        categoryName: string;
        program: string;       // ✅ البرنامج
        carbGrams?: number;    // ✅ جرامات كارب مخصّصة
        proteinGrams?: number; // ✅ جرامات بروتين مخصّصة
        mainMealCalories?: number;
        allergies?: string;    // ✅ حساسية العميل
        avoid?: string;
        preferences?: string;
        portions?: string;
        specialNotes?: string;
        isPlain: boolean;     // ✅ هل عادية؟
      }>
    }> = {};

    // helper: يحوّل modifierIds المختارة إلى أسماء مجمّعة حسب المجموعة
    const resolveMods = (ids: string[] = []) => {
      const av: string[] = [], pr: string[] = [], po: string[] = [];
      ids.forEach((id) => {
        const mod: any = modifiers.find((m: any) => m._id === id);
        if (!mod) return;
        const nm = isRtl ? (mod.nameAr || mod.name) : mod.name;
        if (mod.group === "AVOID") av.push(nm);
        else if (mod.group === "PREF") pr.push(nm);
        else if (mod.group === "PORTION") po.push(nm);
      });
      return { av, pr, po };
    };

    // helper: يحدد لو الوجبة عادية (مفيش أي تعديلات)
    const isPlainMeal = (item: any, customer: any, custAvoid: string): boolean => {
      // فحص بيانات الـ item نفسها
      if (String(item.avoid || "").trim()) return false;
      if (String(item.preferences || "").trim()) return false;
      if (String(item.portions || "").trim()) return false;
      if (String(item.specialNotes || "").trim()) return false;
      if ((item.modifierIds || []).length > 0) return false;
      // فحص بيانات العميل: الحساسية تطبق دائماً؛ الممنوعات تطبق فقط لو مناسبة للطبق (custAvoid مُفلتَر)
      if (String(customer?.allergies || "").trim()) return false;
      if (String(custAvoid || "").trim()) return false;
      if (String(customer?.preferences || "").trim()) return false;
      if (String(customer?.portions || "").trim()) return false;
      return true;
    };

    allPlansToday.forEach((plan: any) => {
      const customer: any = getCustomer(plan.customerId);
      const customerName = customer?.fullName || plan.customerName || (isRtl ? "عميل جديد" : "New Customer");
      // ✅ الباقة: من حقل program، وإلا نستنتجها من goals/packageLabel (لو الحقل فاضي) — أمان لعدم سقوط مشترك لـSTANDARD بالغلط
      const program = (customer?.program || customer?.goals || customer?.packageLabel || plan.program || "STANDARD").toUpperCase();

      // ✅ المخصّصون لا يدخلون الإجمالي — لكل واحد بوكس باسمه (وجباته مختلفة تماماً)
      const isCustomPlan = program.includes("CUSTOM");
      // ✅ قاعدة الإكسيل: نطوي فقط الأصناف القياسية للمخصّصين في الإجمالي؛ وجباتهم المخصّصة تبقى في بوكس الشخص.

      getEffectivePlanItems(plan)
        .filter((item: any) => !item.isOff)
        .forEach((item: any) => {
          const mealId = item.publicMealId || item.mealId || item.menuItemId;
          const legacyMenu: any = item.menuItemId ? getMenuItem(item.menuItemId) : null;
          const meal: any = legacyMenu
            || (mealId ? pubById.get(String(mealId)) : null)
            || (legacyMenu?.publicMealId ? pubById.get(String(legacyMenu.publicMealId)) : null);
          // ✅ إنجليزي دائماً — كشف/إجمالي المطبخ للطاقم الإنجليزي
          const rawMealName = String(
            meal
              ? (meal.nameEn || meal.name || meal.nameAr)
              : (item.mealNameEn || item.mealNameAr || "Unknown Meal"),
          ).trim();

          // ✅ توحيد الاسم الأساسي (زي كشف الإكسيل): "LEMON CHICKEN + RICE /NO TOMATO"
          //    → الطبق: LEMON CHICKEN، و"+ RICE" و"NO TOMATO" تعديلات تحته بعدّاد
          const slashParts = rawMealName.split("/");
          let mealName = slashParts[0];
          const nameMods = slashParts.slice(1).map((s: string) => s.trim()).filter(Boolean);
          let sideNote = "";
          const plusIdx = mealName.indexOf("+");
          if (plusIdx > -1) { sideNote = mealName.slice(plusIdx).replace(/\s+/g, " ").trim(); mealName = mealName.slice(0, plusIdx); }
          mealName = mealName.replace(/\s+/g, " ").trim() || rawMealName;

          // ✅ كمية/عدد في أول الاسم ("150 G LEMON CHICKEN"، "3 EGG WHITES") → الطبق بدون الكمية،
          //    والكمية تظهر كتعديل تحته عشان الشيف يشوفها
          let qtyNote = "";
          const qm = mealName.match(/^\d+\s*(?:G\b)?\s+(.+)$/i);
          if (qm) { qtyNote = mealName; mealName = qm[1].trim(); }
          // "EGGS (NEW EGG SHAKSHOUKA)" → الطبق الحقيقي هو اللي جوّه الأقواس
          const pm = mealName.match(/^(.*?)\(([^)]+)\)$/);
          if (pm && pm[2].trim().length > 3) {
            if (!qtyNote) qtyNote = pm[1].trim();
            mealName = pm[2].trim();
          }
          qtyNote = qtyNote.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
          mealName = mealName.replace(/IRANAIN/gi, "IRANIAN"); // تصحيح إملائي شائع من الشيتات

          // ✅ تجاهل "الوجبات" غير الحقيقية (ملاحظات دخلت في خانة وجبة): "O"، "RESUME 18-7"، رموز
          if (mealName.length <= 2 || /^(OFF|RESUME)\b/i.test(mealName) || !/[A-Za-z؀-ۿ]{3,}/.test(mealName)) {
            return;
          }

          // ✅ من خطة مخصّص: نحسب فقط الأصناف القياسية (سلطة/سناك/حلو) في الإجمالي؛ وجباته المخصّصة تبقى في بوكسه
          if (isCustomPlan && !isStandardSide(mealName)) return;

          const category = getCategory(item.categoryId);
          const categoryName = category?.name || item.category || (isRtl ? "غير محدد" : "Unknown");

          if (!summary[mealName]) {
            summary[mealName] = {
              count: 0,
              plainCount: 0,
              modifiedCount: 0,
              dietCount: 0,
              fitnessCount: 0,
              bulkCount: 0,
              customizedCount: 0,
              standardCount: 0,
              category: categoryName,
              locations: [],
              preparedCount: 0,
              details: []
            };
          }

          // ✅ موقع هذه الحصة لتعليمها ضمن دفعة الطبق
          const origIdx = (plan.items || []).indexOf(item);
          if (origIdx >= 0) summary[mealName].locations.push({ planId: plan._id, itemIndex: origIdx });
          if (item.prepared) summary[mealName].preparedCount += 1;

          // ✅ ممنوعات العميل مُفلترة حسب الطبق: "no fish" لا يعلّم طبق البيض مثلاً
          const custAvoidForMeal = filterAvoidForMeal(customer?.avoid, mealName);
          const plain = isPlainMeal(item, customer, custAvoidForMeal) && nameMods.length === 0 && !sideNote && !qtyNote;
          summary[mealName].count += 1;
          if (plain) summary[mealName].plainCount += 1;
          else summary[mealName].modifiedCount += 1;

          // ✅ الأصناف المطويّة من المخصّصين تُطبخ عادي → تُعدّ STANDARD (مش حسب برنامج العميل)
          const cntProg = isCustomPlan ? "STANDARD" : program;
          if (cntProg.includes("DIET")) summary[mealName].dietCount += 1;
          else if (cntProg.includes("FITNESS")) summary[mealName].fitnessCount += 1;
          else if (cntProg.includes("BULK")) summary[mealName].bulkCount += 1;
          else summary[mealName].standardCount += 1;

          // ✅ اجمع كل مصادر التعديل: item + بيانات العميل + المُعدِّلات المختارة (بالاسم)
          const { av, pr, po } = resolveMods(item.modifierIds);
          // ✅ دمج بدون تكرار على مستوى العنصر: "MUSHROOM ,BROCOLI" + "MUSHROOM، BROCOLI" = مرة واحدة
          const joinUniq = (arr: (string | undefined)[]) => {
            const seen = new Set<string>();
            const out: string[] = [];
            arr.flatMap((x) => String(x || "").split(/[,،]/)).forEach((tok) => {
              const t = tok.replace(/\s+/g, " ").trim();
              const k = t.toUpperCase();
              if (t && !seen.has(k)) { seen.add(k); out.push(t); }
            });
            return out.join(isRtl ? "، " : ", ") || undefined;
          };

          summary[mealName].details.push({
            customerName,
            deliveryTime: plan.deliveryTime,
            categoryName,
            program: customer?.program || "Standard",
            carbGrams: (customer as any)?.carbGrams,
            proteinGrams: (customer as any)?.proteinGrams,
            mainMealCalories: (customer as any)?.mainMealCalories,
            allergies: joinUniq([customer?.allergies]),
            avoid: joinUniq([item.avoid, custAvoidForMeal, ...av, ...nameMods.map((m: string) => m.replace(/^NO\s+/i, ""))]),
            preferences: joinUniq([item.preferences, customer?.preferences, ...pr]),
            portions: joinUniq([item.portions, customer?.portions, ...po, qtyNote || undefined, sideNote || undefined]),
            specialNotes: joinUniq([item.specialNotes]),
            isPlain: plain,
          });
        });
    });

    // ✅ أصناف المخصّصين غير الرئيسية (سناك/سلطة/شوربة) — تُطبخ عادي بكمية 1 لكل العملاء،
    //    فتُضاف للإجمالي فوق مثل الوجبات العادية. (المخصّص بقالب ليس له خطة يومية، فلا تكرار.)
    const emptySummary = (category: string) => ({
      count: 0, plainCount: 0, modifiedCount: 0, dietCount: 0, fitnessCount: 0, bulkCount: 0,
      customizedCount: 0, standardCount: 0, category, locations: [] as any[], preparedCount: 0, details: [] as any[],
    });
    (customized || []).forEach((c: any) => {
      (c.items || []).forEach((it: any) => {
        if (it?.isOff) return;
        if (String(it?.type || "").toUpperCase() === "MAIN") return; // الرئيسي يبقى في بوكس الشخص
        const raw = String(it?.baseName || it?.text || "").trim();
        if (!raw || raw.length < 3 || /NOT SET|لم تُحدَّد/i.test(raw)) return;
        // طابق مفتاحاً موجوداً بلا حساسية حالة، وإلا أنشئ جديداً (لدمج العدّ مع نفس الطبق العادي)
        const key = Object.keys(summary).find((k) => k.toLowerCase() === raw.toLowerCase()) || raw;
        const catName = /salad|سلط/i.test(raw) ? "Salad" : (/soup|شور/i.test(raw) ? "Soup" : "Snack");
        if (!summary[key]) summary[key] = emptySummary(catName);
        summary[key].count += 1;
        summary[key].plainCount += 1;
        summary[key].standardCount += 1;
        summary[key].details.push({
          customerName: c.customerName || (isRtl ? "مخصّص" : "Customized"),
          deliveryTime: c.deliveryTime || "MORNING",
          categoryName: summary[key].category, program: "STANDARD", isPlain: true,
        });
      });
    });

    // ✅ ترتيب الطبخ حسب نوع الوجبة (فطور → غدا → عشا → سلطة → سناك) زي كشف الأخصائية
    const catRank = (c: string): number => {
      const s = String(c || "").toLowerCase();
      if (/break|فطور|فطار/.test(s)) return 1;
      if (/lunch|غدا|غداء/.test(s)) return 2;
      if (/dinner|عشا|عشاء/.test(s)) return 3;
      if (/salad|سلط/.test(s)) return 4;
      if (/snack|سناك|وجبة خفيفة/.test(s)) return 5;
      return 6;
    };

    // ✅ يجمّع التعديلات المتشابهة في سطر واحد بعدّاد ("بدون فطر ×3") بدل سطر لكل عميل
    const buildModGroups = (details: any[]) => {
      const groups: Record<string, any> = {};
      details.filter((d) => !d.isPlain).forEach((d) => {
        const parts = [
          d.avoid && `${isRtl ? "بدون" : "No"}: ${d.avoid}`,
          d.preferences && `${isRtl ? "تفضيل" : "Pref"}: ${d.preferences}`,
          d.portions && `${isRtl ? "كمية" : "Portion"}: ${d.portions}`,
          d.allergies && `${isRtl ? "حساسية" : "Allergy"}: ${d.allergies}`,
          d.specialNotes && `${isRtl ? "ملاحظة" : "Note"}: ${d.specialNotes}`,
        ].filter(Boolean);
        const label = parts.join(isRtl ? " • " : " • ");
        const key = label.toLowerCase();
        if (!groups[key]) groups[key] = { label, count: 0, customers: [] };
        groups[key].count += 1;
        groups[key].customers.push({ name: d.customerName, program: d.program, deliveryTime: d.deliveryTime });
      });
      return Object.values(groups).sort((a: any, b: any) => b.count - a.count);
    };

    return Object.entries(summary)
      .map(([name, data]) => ({ name, ...data, catRank: catRank(data.category), modGroups: buildModGroups(data.details) }))
      .sort((a, b) => (a.catRank - b.catRank) || (b.count - a.count));
  }, [dailyPlans, formattedDate, customers, menuItems, publicMealsList, categories, modifiers, isRtl, customized]);

  // ✅ المشتركون المخصّصون مجمّعون باسم كل عميل (بوكس كامل للشخص) — زي كشف الأخصائية
  const customizedByPerson = useMemo(() => {
    const allPlansToday = dailyPlans.filter(
      (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED")
    );
    // 🔀 من بُني له قالب مصدره القالب — نستبعد خطته اليومية القديمة هنا
    const tplNames = new Set((customized || []).map((c: any) => c.customerName));
    const byPerson: Record<string, { name: string; deliveryTime: string; allergies: string; items: Array<{ meal: string; note: string }> }> = {};
    allPlansToday.forEach((plan: any) => {
      const customer: any = getCustomer(plan.customerId);
      const program = (customer?.program || plan.program || "").toUpperCase();
      if (!program.includes("CUSTOM")) return;
      if (tplNames.has(customer?.fullName || plan.customerName)) return;
      const name = customer?.fullName || plan.customerName || (isRtl ? "عميل" : "Customer");
      const key = name + "|" + plan.deliveryTime;
      if (!byPerson[key]) byPerson[key] = {
        name, deliveryTime: plan.deliveryTime,
        // ✅ الممنوعات/الحساسية مرّة واحدة على مستوى البوكس (مش مكرّرة مع كل وجبة)
        allergies: [customer?.allergies, customer?.avoid].map((x: any) => String(x || "").trim()).filter(Boolean).join(" • "),
        items: [],
      };
      getEffectivePlanItems(plan).filter((it: any) => !it.isOff).forEach((item: any) => {
        const mealName = mealNameInLang(item.publicMealId || item.mealId || item.menuItemId, item);
        const note = String(item.specialNotes || "").trim(); // ملاحظة خاصة بالوجبة فقط
        byPerson[key].items.push({ meal: mealName, note });
      });
    });
    return Object.values(byPerson).sort((a, b) => a.name.localeCompare(b.name));
  }, [dailyPlans, formattedDate, customers, menuItems, publicMealsList, isRtl, customized]);

  /**
   * ✅ مصدر موحّد للمخصّصين (شاشة + كشف).
   *    🔀 القالب هو المصدر — لا الخطة اليومية. المخصّص وجباته تُبنى مرة واحدة في
   *    صفحة «الوجبات المخصّصة» وتتكرر، فلا يُملأ يوم بيوم. الخطة اليومية تبقى
   *    fallback لسجلات قديمة لمن لم يُبنَ له قالب بعد (تختفي تلقائياً فور بناء قالبه).
   *    قبل هذا كانت الأولوية معكوسة، فمن عنده الاثنان ظهر بخطته لا بقالبه.
   */
  type CustMeal = { text: string; isSide: boolean; notset: boolean };
  const customizedAll = useMemo(() => {
    const list: { name: string; deliveryTime: string; allergies: string; meals: CustMeal[] }[] = [];
    const seen = new Set<string>();
    // ✅ الأصناف القياسية = السناكات/السلطات/الشوربات/الحلو (النوع SNACK أو اسم قياسي معروف).
    //    تُطبخ عادي وتُحسب مع الإجمالي، فتُعرض بكمية مظلّلة (•) لا «1».
    const asMeal = (text: string, type?: any): CustMeal | null => {
      const t = String(text || "").trim();
      if (!t) return null;
      const notset = /NOT SET|لم تُحدَّد/i.test(t);
      const isSide = !notset && (String(type || "").toUpperCase() === "SNACK" || isStdSideName(t));
      return { text: t, isSide, notset };
    };
    // 1) القوالب أولاً — المصدر المعتمد
    for (const c of (customized || [])) {
      seen.add(c.customerName);
      list.push({
        name: c.customerName, deliveryTime: c.deliveryTime,
        allergies: [c.allergies, c.avoid].map((x: any) => String(x || "").trim()).filter(Boolean).join(" • "),
        meals: (c.items || []).map((it: any) => asMeal(composeCustItem(it), it.type)).filter(Boolean) as CustMeal[],
      });
    }
    // 2) خطط قديمة لمن لا قالب له — حتى لا يفقد أحد أكله أثناء الانتقال
    for (const p of customizedByPerson) {
      if (seen.has(p.name)) continue;
      list.push({
        name: p.name, deliveryTime: p.deliveryTime, allergies: p.allergies,
        meals: p.items.map((it: any) => asMeal(it.note ? `${it.meal} — ${it.note}` : it.meal, it.type)).filter(Boolean) as CustMeal[],
      });
    }
    return list.filter((p) => p.meals.length).sort((a, b) => a.name.localeCompare(b.name));
  }, [customizedByPerson, customized]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ رقم البوكس = **نفس رقم استيكر البوكس بالضبط** (المصدر الوحيد convex/stickers)
  //    حتى يطابق الكشفُ الستيكرَ الفيزيائي، فيعرف المطبخ بوكس كل مشترك. deliveryTime
  //    "ALL" يرقّم كل عملاء اليوم أبجدياً 1..N (نفس ما تُطبع به الستيكرات للكل).
  const stickerData = useStickers({ date: formattedDate, deliveryTime: "ALL", lang: isRtl ? "ar" : "en" }) as any;
  const boxNoByCustomerId = useMemo(() => {
    const m = new Map<string, number>();
    (stickerData?.boxStickers || []).forEach((b: any) => {
      if (b?.customerId) m.set(String(b.customerId), Number(b.slNo));
    });
    // ✅ المخصّصون ليس لهم box stickers (فقط meal stickers) — نأخذ رقمهم الثابت من هناك
    //    وإلا كانوا يأخذون رقماً احتياطياً متغيّراً حسب فلتر التوصيل (صباحي/مسائي).
    (stickerData?.mealStickers || []).forEach((b: any) => {
      const id = b?.customerId ? String(b.customerId) : "";
      if (id && !m.has(id) && Number(b.customerNo) > 0) m.set(id, Number(b.customerNo));
    });
    return m;
  }, [stickerData]);

  /**
   * ✅ صفوف كشف المطبخ (مصفوفة زي الإكسيل): صف لكل عميل، وجباته في أعمدة
   *    (فطور/سناك1/غداء/سناك2/عشاء/وجبة4) حسب تصنيف كل صنف.
   */
  const kitchenPeople = useMemo<KitchenPerson[]>(() => {
    const allPlansToday = dailyPlans.filter(
      (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED"),
    );

    // "2026-07-11" → "11-7"
    const shortDate = (iso?: string) => {
      if (!iso) return "";
      const [, m, d] = String(iso).slice(0, 10).split("-");
      return m && d ? `${Number(d)}-${Number(m)}` : "";
    };

    const rows: KitchenPerson[] = [];
    // من ليس له رقم بوكس من الستيكرات (نادر: مخصّص/سجل قديم) يأخذ رقماً بعد آخر رقم بوكس.
    let fallbackNo = boxNoByCustomerId.size;

    allPlansToday.forEach((plan: any) => {
      const customer: any = getCustomer(plan.customerId);
      const program = (customer?.program || plan.program || "STANDARD").toUpperCase();
      const slots = { breakfast: [] as string[], snack: [] as string[], lunch: [] as string[], dinner: [] as string[], other: [] as string[] };

      getEffectivePlanItems(plan).filter((it: any) => !it.isOff).forEach((item: any) => {
        const { meal, legacyMenu } = resolvePlanMeal(item);
        const snapshotName = isRtl
          ? (item.mealNameAr || item.mealNameEn)
          : (item.mealNameEn || item.mealNameAr);
        const mealName = snapshotName || (meal
          ? (isRtl ? (meal.nameAr || meal.name || meal.nameEn) : (meal.nameEn || meal.name || meal.nameAr))
          : "—");
        const cat: any = legacyMenu?.categoryId ? getCategory(legacyMenu.categoryId) : null;
        const label = getCategoryLabel(meal?.category || cat?.name || item.category || "");
        // ملاحظة خاصة بهذه الوجبة فقط — لا نكرّر ممنوعات/برنامج العميل العام
        // (فهي ظاهرة أصلاً في عمودَي Allergies و Remarks).
        const notes = String(item.specialNotes || "").trim();
        const text = notes ? `${mealName} (${notes})` : mealName;

        if (label.includes("فطور") || label.includes("BREAKFAST")) slots.breakfast.push(text);
        else if (label.includes("غداء") || label.includes("LUNCH")) slots.lunch.push(text);
        else if (label.includes("عشاء") || label.includes("DINNER")) slots.dinner.push(text);
        else if (label.includes("سناك") || label.includes("SNACK")) slots.snack.push(text);
        else slots.other.push(text);
      });

      // لا تُنشئ صفاً فارغاً
      const anyMeal = slots.breakfast.length + slots.snack.length + slots.lunch.length + slots.dinner.length + slots.other.length;
      if (!anyMeal) return;

      const no = boxNoByCustomerId.get(String(plan.customerId)) ?? (++fallbackNo);
      rows.push({
        no,
        phone: customer?.phone || plan.customerPhone || "",
        name: customer?.fullName || plan.customerName || (isRtl ? "عميل" : "Customer"),
        dates:
          customer?.startDate || customer?.endDate
            ? `${shortDate(customer?.startDate)} END ${shortDate(customer?.endDate)}`
            : "",
        remarks: program,
        allergies: [customer?.avoid, customer?.allergies].map((x) => String(x || "").trim()).filter(Boolean).join(" • "),
        breakfast: slots.breakfast.join(" + "),
        snack1: slots.snack[0] || "",
        lunch: slots.lunch.join(" + "),
        snack2: slots.snack[1] || "",
        dinner: slots.dinner.join(" + "),
        meal4: [...slots.snack.slice(2), ...slots.other].join(" + "),
        time: plan.deliveryTime,
        customized: program.includes("CUSTOM"),
      });
    });

    // ترتيب الكشف حسب رقم البوكس (نفس ترتيب الستيكرات) — أوضح للمطبخ.
    rows.sort((a, b) => a.no - b.no);
    return rows;
  }, [dailyPlans, formattedDate, customers, menuItems, categories, isRtl, boxNoByCustomerId]);

  /**
   * ✅ صفوف المخصّصين للكشف اليومي المُصدَّر (Excel/PDF).
   *    المخصّصون مصدرهم القالب لا الخطة اليومية، فلا يظهرون في kitchenPeople أعلاه.
   *    نبنيهم من نفس المصدر الموحّد (customizedAll)، ونرقّمهم بنفس رقم البوكس الثابت
   *    (boxNoByCustomerId) الذي يكمّل بعد آخر رقم عادي — فيطابقون الستيكرات تماماً.
   *    وجبات البوكس مسبوقة الترتيب (فطور→غداء→عشاء→سلطة→سناك) تُوزَّع على الأعمدة بالترتيب.
   */
  const customizedPeople = useMemo<KitchenPerson[]>(() => {
    if (!customizedAll.length) return [];
    const shortDate = (iso?: string) => {
      if (!iso) return "";
      const [, m, d] = String(iso).slice(0, 10).split("-");
      return m && d ? `${Number(d)}-${Number(m)}` : "";
    };
    // اسم العميل → أحدث سجل نشِط (لجلب رقم البوكس والهاتف والتواريخ)
    const custByName = new Map<string, any>();
    (customers || []).forEach((c: any) => {
      const nm = String(c.fullName || "").trim();
      if (nm) custByName.set(nm, c);
    });
    const rows: KitchenPerson[] = customizedAll.map((p) => {
      const c = custByName.get(String(p.name).trim());
      const cid = c ? String(c._id) : "";
      const no = (cid && boxNoByCustomerId.get(cid)) || 0;
      const texts = p.meals.map((m) => (m.notset ? (isRtl ? "لم تُحدَّد" : "NOT SET") : m.text));
      const col = (i: number) => texts[i] || "";
      return {
        no,
        phone: c?.phone || "",
        name: p.name,
        dates: c?.startDate || c?.endDate ? `${shortDate(c?.startDate)} END ${shortDate(c?.endDate)}` : "",
        remarks: "CUSTOM",
        allergies: p.allergies,
        breakfast: col(0),
        snack1: col(1),
        lunch: col(2),
        snack2: col(3),
        dinner: col(4),
        meal4: texts.slice(5).join(" + "),
        time: p.deliveryTime,
        customized: true,
      };
    });
    // بلا رقم بوكس (نادر) → للآخر؛ والباقي بترتيب البوكس المطابق للستيكرات.
    return rows.sort((a, b) => (a.no || 1e9) - (b.no || 1e9));
  }, [customizedAll, customers, boxNoByCustomerId, isRtl]);

  const [exporting, setExporting] = useState<null | "xlsx" | "pdf">(null);
  const exportSheet = async (kind: "xlsx" | "pdf") => {
    // ✅ الكشف = العاديون ثم المخصّصون (كلٌّ يذهب لقسمه داخل الملف عبر flag customized)
    const people = [...kitchenPeople, ...customizedPeople];
    if (!people.length) {
      void alertDialog({ message: isRtl ? "لا توجد وجبات لهذا اليوم" : "No meals for this day" });
      return;
    }
    setExporting(kind);
    try {
      const lang = isRtl ? "ar" : "en";
      if (kind === "xlsx") await downloadKitchenXlsx(formattedDate, people, lang);
      else await downloadKitchenPdf(formattedDate, people, lang);
    } catch (e: any) {
      void alertDialog({ message: (isRtl ? "تعذّر التحميل: " : "Download failed: ") + String(e?.message || e) });
    } finally {
      setExporting(null);
    }
  };

  // ✅ طباعة كشف الشيف — نافذة نظيفة A4 (إجمالي + أطباق مرتّبة + تعديلات مجمّعة + مخصّصين)
  const handlePrintChefSheet = () => {
    // ✅ كشف الشيف + الـPDF إنجليزي دائماً (الطاقم يقرأ إنجليزي) — نُظلّل isRtl داخل الدالة.
    const isRtl = false;
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    const tMeals = mealSummary.reduce((s, m) => s + m.count, 0);
    const tPlain = mealSummary.reduce((s, m) => s + m.plainCount, 0);
    const tMod = mealSummary.reduce((s, m) => s + m.modifiedCount, 0);
    // ✅ توزيع العناصر على أعمدة متوازنة داخل جدول واحد — الجداول تُقسَّم على الصفحات بشكل موثوق
    //    في الطباعة (بعكس column-count الذي يترك صفحة أولى فاضية في Chrome).
    const balance = <T,>(items: T[], n: number, wt: (x: T) => number): T[][] => {
      const cols = Array.from({ length: n }, () => ({ h: 0, items: [] as T[] }));
      items.forEach((it) => { const c = cols.reduce((a, b) => (b.h < a.h ? b : a)); c.items.push(it); c.h += wt(it); });
      return cols.map((c) => c.items);
    };
    const colsTable = <T,>(items: T[], n: number, wt: (x: T) => number, render: (x: T) => string): string =>
      `<table class="cols"><tr>${balance(items, n, wt).map((col) => `<td class="col">${col.map(render).join("")}</td>`).join("")}</tr></table>`;
    // ✅ كشف زي الإكسيل حرفياً:
    //    - الطبق الرئيسي (غداء/عشاء برز+بروتين): 4 أعمدة [الاسم | العدد | RICE | PROTEIN]،
    //      والتعديلات مدمجة داخل كل برنامج: "DIET /NO TOMATO | 1 | 100 | 80-90".
    //    - الأطباق العادية (فطور/سلطة/شوربة/حلو/سناك): عمودان فقط [STANDARD /NO X | العدد].
    const pp: any = programPortions;
    const MAIN_KEYS = ["CRISPY CHICKEN", "BEEF STROGANOF", "BEEF LASAGNA", "SOUTHWEST", "IRANIAN CHICKEN", "GRILLED CHICKEN", "GRILLED STEAK", "GRILLED SALMON", "GRILLED SHRIMP", "DYNAMITE SHRIMP", "CHICKEN CURRY", "GARLIC BUTTER", "CHICKEN FAJITA", "LEMON CHICKEN", "SHISHTAWOOK", "STEAK SANDWICH", "CHICKEN CUTLETS", "SHAWARMA"];
    const isMain = (nm: string) => { const u = nm.toUpperCase(); return MAIN_KEYS.some((k) => u.includes(k)); };
    // ✅ الطبق الرئيسي (رز+بروتين) = تصنيفه غداء/عشاء — تلقائي بدل الاعتماد على قائمة أسماء ثابتة
    //    تُطبّق أعمدة RICE/PROTIEN لكل باقة. (عرض الكشف فقط — لا يمسّ أي منطق/قيود مشتركين.)
    const isMainCat = (cat: string) => { const u = String(cat || "").toUpperCase(); return u.includes("LUNCH") || u.includes("غداء") || u.includes("DINNER") || u.includes("عشاء") || u.includes("MAIN") || u.includes("رئيس"); };
    const progOf = (p: string) => {
      const u = String(p || "").toUpperCase();
      if (u.includes("DIET")) return "DIET";
      if (u.includes("FITNESS")) return "FITNESS";
      if (u.includes("BULK")) return "BULK";
      return "STANDARD";
    };
    // تسمية التعديل بأسلوب الإكسيل: "/NO TOMATO ,MUSHROOM"
    const modLabel = (d: any) => [
      d.avoid && `/NO ${d.avoid}`,
      d.preferences && `PREF: ${d.preferences}`,
      d.portions && `${d.portions}`,
      d.specialNotes && `${d.specialNotes}`,
    ].filter(Boolean).join(" · ");
    const dishTable = (m: any) => {
      const main = (isMain(m.name) || isMainCat(m.category)) && (m.dietCount + m.fitnessCount + m.bulkCount) > 0;
      const order = main ? ["DIET", "FITNESS", "BULK", "STANDARD"] : ["STANDARD"];
      // مشترك عنده جرامات مخصّصة للوجبة الرئيسية (كارب/بروتين) — يُفصل في سطر خاص بأرقامه.
      const hasCustomG = (d: any) => main && (Number(d.carbGrams) > 0 || Number(d.proteinGrams) > 0);
      // تجميع تفاصيل الطبق: بكت لكل برنامج { عادي + تعديلات مجمّعة بعدّاد }
      const buckets: Record<string, { plain: number; mods: Map<string, { label: string; count: number; names: string[] }> }> = {};
      // المخصّصون: مجمّعون حسب (البرنامج + كارب + بروتين) — نفس الأرقام تتجمّع بأسماء متعددة
      const customG = new Map<string, { pg: string; carb: any; protein: any; count: number; names: string[] }>();
      (m.details || []).forEach((d: any) => {
        const pg = main ? progOf(d.program) : "STANDARD";
        if (hasCustomG(d)) {
          const carb = Number(d.carbGrams) > 0 ? Number(d.carbGrams) : (pp[pg]?.carb ?? "");
          const protein = Number(d.proteinGrams) > 0 ? Number(d.proteinGrams) : (pp[pg]?.protein ?? "");
          const lbl = modLabel(d);
          const key = `${pg}|${carb}|${protein}|${lbl.toUpperCase()}`;
          if (!customG.has(key)) customG.set(key, { pg, carb, protein, count: 0, names: [] });
          const cg = customG.get(key)!; cg.count += 1;
          cg.names.push(d.customerName + (lbl ? ` ${lbl}` : ""));
          return; // لا يُحسب ضمن سطر البرنامج القياسي
        }
        if (!buckets[pg]) buckets[pg] = { plain: 0, mods: new Map() };
        const b = buckets[pg];
        if (d.isPlain) { b.plain += 1; return; }
        const lbl = modLabel(d) || (isRtl ? "تعديل — راجع الطلب" : "MODIFIED — CHECK ORDER");
        const k = lbl.toUpperCase();
        if (!b.mods.has(k)) b.mods.set(k, { label: lbl, count: 0, names: [] });
        const g = b.mods.get(k)!; g.count += 1; g.names.push(d.customerName);
      });
      // خلايا الجرامات: قياسية ثابتة حسب البرنامج (نفس أرقام الإكسيل) — فاضية لغير الرئيسي/STANDARD
      const gcells = (pg: string) => main
        ? `<td class="gc">${pg !== "STANDARD" && pp[pg]?.carb != null ? pp[pg].carb : ""}</td><td class="gc">${pg !== "STANDARD" && pp[pg]?.protein != null ? pp[pg].protein : ""}</td>`
        : "";
      let rows = "";
      order.forEach((pg) => {
        const b = buckets[pg];
        if (!b || (b.plain === 0 && b.mods.size === 0)) return;
        if (b.plain > 0) rows += `<tr class="pg"><td class="lb"><b>${pg}</b></td><td class="ct">${b.plain}</td>${gcells(pg)}</tr>`;
        [...b.mods.values()].sort((a, b2) => b2.count - a.count).forEach((g) => {
          rows += `<tr><td class="lb"><b>${pg}</b> ${esc(g.label)}<div class="cst">${esc(g.names.join(isRtl ? "، " : ", "))}</div></td><td class="ct">${g.count}</td>${gcells(pg)}</tr>`;
        });
      });
      // أسطر المخصّصين — أرقام كارب/بروتين خاصة بهم (مميّزة بلون)
      [...customG.values()].forEach((cg) => {
        rows += `<tr class="cg"><td class="lb"><b>${cg.pg}</b> ⚖️ <span style="color:#b45309">${isRtl ? "جرامات خاصة" : "CUSTOM GRAMS"}</span><div class="cst">${esc(cg.names.join(isRtl ? "، " : ", "))}</div></td><td class="ct">${cg.count}</td><td class="gc" style="color:#b45309;font-weight:800">${cg.carb}</td><td class="gc" style="color:#b45309;font-weight:800">${cg.protein}</td></tr>`;
      });
      return `
      <div class="dishbox"><table class="dish">
        <tr class="dh"><td class="dn">${esc(m.name)}</td><td class="dc">${m.count}</td>${main ? `<td class="ghd">RICE</td><td class="ghd">${isRtl ? "بروتين" : "PROTEIN"}</td>` : ""}</tr>
        ${rows}
        <tr class="tp"><td class="lb">Total Portions</td><td class="ct">${m.count}</td>${main ? `<td class="gc"></td><td class="gc"></td>` : ""}</tr>
      </table></div>`;
    };
    // ✅ ترتيب كشف الشيف (بطلب المستخدم): الفطور → السناك/الجانبي → الرئيسية → (المخصّصون قسم منفصل).
    //    الرئيسية بعرض الصفحة كامل (أعمدة جرامات)، والفطور والجانبي في عمودين.
    const isMainDish = (m: any) => isMain(m.name) && (m.dietCount + m.fitnessCount + m.bulkCount) > 0;
    const isBreakfastDish = (m: any) => /break|فطور|فطار/.test((String(m.category || "") + " " + String(m.name || "")).toLowerCase());
    const breakfastDishes = mealSummary.filter((m: any) => isBreakfastDish(m) && !isMainDish(m));
    const mainDishes = mealSummary.filter((m: any) => !isBreakfastDish(m) && isMainDish(m));
    const sideDishes = mealSummary.filter((m: any) => !isBreakfastDish(m) && !isMainDish(m));
    const dishWeight = (m: any) => 2 + m.modGroups.length + m.modGroups.reduce((s: number, g: any) => s + Math.floor(String(g.customers.map((c: any) => c.name).join(", ")).length / 42), 0);
    const secHead = (label: string) => `<h3 class="dsec">${label}</h3>`;
    const dishHtml =
      (breakfastDishes.length ? secHead(isRtl ? "الفطور" : "Breakfast") + colsTable(breakfastDishes, 2, dishWeight, dishTable) : "") +
      (sideDishes.length ? secHead(isRtl ? "السناك والجانبي" : "Snacks & sides") + colsTable(sideDishes, 2, dishWeight, dishTable) : "") +
      (mainDishes.length ? secHead(isRtl ? "الوجبات الرئيسية" : "Main meals") + mainDishes.map(dishTable).join("") : "");
    // ✅ المخصّصون — من القالب (بجرامات + نوع بروتين) زي كشف الإكسيل: "دجاج 150جم + رز 200جم".
    //    يُركَّب بلغة الواجهة (الأساس من المنيو، والبروتين/الكارب مترجمان) حتى لا يظهر
    //    عربي في الكشف الإنجليزي. نرجع للنص المحفوظ فقط لو تعذّر التركيب.
    const gUnit = isRtl ? "جم" : "g";
    const basePool = [...(publicMealsList || []), ...(menuItems || [])];
    const baseById = new Map<string, any>();
    const baseByAr = new Map<string, any>();
    basePool.forEach((m: any) => {
      if (m?._id) baseById.set(String(m._id), m);
      if (m?.nameAr) baseByAr.set(String(m.nameAr).trim(), m);
    });
    const baseInLang = (it: any): string => {
      const m: any = (it.baseMealId && baseById.get(String(it.baseMealId))) || baseByAr.get(String(it.baseName || "").trim());
      if (m) return String(isRtl ? (m.nameAr || m.nameEn || m.name) : (m.nameEn || m.nameAr || m.name)).trim();
      return String(it.baseName || "").trim();
    };
    const composeCust = (it: any): string => {
      const base = baseInLang(it);
      const bits: string[] = [];
      if (base) bits.push(base);
      if (it.type === "MAIN") {
        const inner: string[] = [];
        if (it.proteinG) inner.push(`${trName(it.proteinName || "", PROTEIN_TR, isRtl) || (isRtl ? "بروتين" : "Protein")} ${it.proteinG}${gUnit}`);
        const carbTr = trName(it.carbName || "", CARB_TR, isRtl);
        if (it.carbName && carbTr !== (isRtl ? "بدون" : "None") && it.carbG) inner.push(`${carbTr} ${it.carbG}${gUnit}`);
        if (inner.length) bits.push(bits.length ? `— ${inner.join(" + ")}` : inner.join(" + "));
      }
      const composed = bits.join(" ").trim();
      return composed || String(it.text || it.baseName || "—").trim();
    };
    // ✅ المخصّصون من المصدر الموحّد (خطط اليوم الفعلية + القوالب) — إنجليزي دائماً
    void composeCust;
    // ✅ نفس تصميم جداول الوجبات العادية (.dish) بالظبط — رأس ملوّن (اسم العميل +
    //    عدد وجباته) وصفوف مؤطّرة وعمود عدد، جدول لكل مخصّص (طلب المستخدم). يبقى
    //    تحذير الحساسية (صف أحمر) وتمييز «لم تُحدَّد» (nsrow برتقالي).
    const personBox = (p: any) => {
      const dot = p.deliveryTime === "MORNING" ? "☀" : "🌙";
      const rows = (p.meals || []).map((m: any) => {
        const qty = m.notset ? "" : (m.isSide ? "•" : "1");
        return `<tr class="${m.notset ? "nsrow" : ""}"><td class="lb">${esc(m.text)}</td><td class="ct">${qty}</td></tr>`;
      }).join("");
      return `
      <div class="dishbox"><table class="dish">
        <tr class="dh"><td class="dn">${esc(p.name)} ${dot}</td><td class="dc">${(p.meals || []).length}</td></tr>
        ${p.allergies ? `<tr><td class="lb" colspan="2" style="background:#fef2f2;color:#b91c1c;font-weight:800">🚫 ${esc(p.allergies)}</td></tr>` : ""}
        ${rows}
      </table></div>`;
    };
    const personWeight = (p: any) => 1.5 + (p.allergies ? 1 : 0) + (p.meals?.length || 0);
    // 📄 المخصّصون يبدأون في صفحة جديدة عند الطباعة — لا يلتصقون بآخر صفحة العاديين.
    const custHtml = customizedAll.length ? `
      <div class="custpage">
      <h2 class="sec">Customized meals — one box per customer (${customizedAll.length})</h2>
      ${colsTable(customizedAll, 2, personWeight, personBox)}
      </div>` : "";
    const html = `<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}" lang="${isRtl ? "ar" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=800"><title>${isRtl ? "كشف المطبخ" : "Kitchen Sheet"} ${esc(formattedDate)}</title>
      <style>
        *{box-sizing:border-box;font-family:'Cairo','Segoe UI',Tahoma,sans-serif}
        body{margin:0;padding:10px;color:#0f1516;font-size:11px}
        h1{font-size:16px;margin:0 0 1px} .date{color:#47759c;font-weight:700;margin-bottom:8px;font-size:11px}
        .kpis{display:flex;gap:6px;margin-bottom:10px}
        .kpi{flex:1;border:1px solid #cdd9e4;border-radius:8px;padding:5px;text-align:center}
        .kpi .v{font-size:18px;font-weight:900} .kpi .l{font-size:9px;color:#47759c;font-weight:700}
        table.cols{width:100%;border-collapse:collapse;table-layout:fixed}
        td.col{vertical-align:top;padding:0 5px}
        td.col:first-child{padding-inline-start:0} td.col:last-child{padding-inline-end:0}
        /* الجداول الطويلة تُقسَّم على الصفحات بين الصفوف (لا نمنع الكسر داخل الجدول كله وإلا تُدفع
           لصفحة جديدة وتترك صفحة فاضية). نمنع فقط كسر الصف الواحد، ونُبقي العنوان مع أول صف. */
        .dishbox{margin:0 0 8px}
        table.dish{width:100%;border-collapse:collapse;font-size:10.5px}
        table.dish tr{break-inside:avoid;page-break-inside:avoid}
        table.dish tr.dh{break-after:avoid;page-break-after:avoid}
        table.dish td{border:1px solid #6d8aa3;padding:2.5px 6px;vertical-align:top}
        tr.dh td{background:#0E76AC;color:#fff;border-color:#0E76AC}
        .dn{font-size:12.5px;font-weight:900}
        .dc{font-size:13px;font-weight:900;text-align:center;width:44px}
        .lb{font-weight:700;line-height:1.35}
        .ct{font-weight:900;text-align:center;width:44px;font-size:11.5px}
        .gc{text-align:center;width:64px;font-weight:800;font-size:10px;color:#0E76AC}
        .ghd{text-align:center;width:64px;font-size:9px;font-weight:900;letter-spacing:.4px}
        tr.pg td{background:#e8f4fb} tr.pg .lb b{color:#0E76AC;font-weight:900}
        .lb b{color:#47759c;font-weight:800}
        table.dish tr:nth-child(even):not(.dh):not(.tp):not(.pg) td{background:#f6fafd}
        .pt{width:100%;border-collapse:collapse;margin-top:2px}
        .pt td{border:1px solid #dbe6ee;padding:2px 5px;font-size:9.5px;font-weight:700;line-height:1.35}
        .pq{width:26px;text-align:center;font-weight:900}
        .sq{background:#fde68a}
        .cst{color:#7d90a2;font-size:8.5px;font-weight:400;line-height:1.3;margin-top:1px}
        tr.tp td{background:#dcebf5;color:#0E76AC;font-weight:900;border-top:1.5px solid #0E76AC}
        .sec{font-size:13px;margin:14px 0 6px;border-top:2px solid #0E76AC;padding-top:6px;break-before:auto;break-after:avoid}
        /* عنوان قسم داخل الكشف (الفطور/السناك/الرئيسية) — لا يُيتَّم أسفل الصفحة */
        .dsec{font-size:12px;font-weight:900;color:#0E76AC;margin:10px 0 5px;border-bottom:1.5px solid #0E76AC;padding-bottom:3px;break-after:avoid;page-break-after:avoid}
        /* 📄 قسم المخصّصين يبدأ صفحة جديدة — لا يلتصق بآخر صفحة العاديين */
        .custpage{break-before:page;page-break-before:always}
        .custpage .sec{border-top:none;margin-top:0}
        /* ✅ بطاقة المخصّص — رأس ملوّن بالهوية، تحذير حساسية واضح، وجبات مرقّمة نظيفة */
        /* جدولان جنب بعض (بدل 3) → عرض أوسع، فنكبّر الخط والمسافات ليقرأها الشيف بوضوح */
        .person{border:1.5px solid #cdd9e6;border-radius:12px;overflow:hidden;margin:0 0 11px;break-inside:avoid;page-break-inside:avoid;font-size:13px;box-shadow:0 1px 3px rgba(14,42,74,.07)}
        .ph{display:flex;justify-content:space-between;align-items:center;gap:6px;background:linear-gradient(120deg,#0E2A4A,#0E76AC);color:#fff;padding:7px 12px}
        .pn{font-size:15px;font-weight:900;letter-spacing:.2px}
        .pdt{font-size:10px;font-weight:800;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.2);white-space:nowrap}
        .alg{color:#b91c1c;background:#fef2f2;font-size:11px;font-weight:800;padding:5px 12px;border-bottom:1px solid #fee2e2;line-height:1.4}
        .pt{width:100%;border-collapse:collapse}
        .pt td{padding:6px 12px;font-size:13.5px;font-weight:700;line-height:1.4;border-top:1px solid #eef3f7;vertical-align:middle}
        .pt tr:first-child td{border-top:none}
        .pm{color:#0f2438}
        .sq{color:#b45309}
        .nsrow td{background:#fff7ed !important;color:#c2410c;font-weight:900}
        .nt{color:#c2410c}
        /* ترقيم الصفحات داخل نفس قاعدة @page — كروم لا يدمج قاعدتَي @page منفصلتين،
           فلو تركنا الترقيم لِـopenPrintDoc (قاعدة ثانية) يُتجاهَل ولا يظهر رقم.
           الهامش السفلي 13مم ليتّسع لصندوق @bottom-center. */
        @page{size:A4;margin:8mm 8mm 13mm 8mm;
          @bottom-center{content:"${isRtl ? "صفحة" : "Page"} " counter(page);
            font-family:'Cairo','Segoe UI',Tahoma,sans-serif;font-size:10px;font-weight:700;color:#64748b;}}
      </style></head><body>
      <h1>${isRtl ? "كشف المطبخ" : "Kitchen Sheet"} — ADRENALINE</h1><div class="date">${isRtl ? "تاريخ" : "Date"}: ${esc(formattedDate)} · ${isRtl ? "الأرقام تشمل المشتركين المخصّصين" : "totals include customized subscribers"}</div>
      <div class="kpis">
        <div class="kpi"><div class="v" style="color:#0E76AC">${tMeals}</div><div class="l">${isRtl ? "إجمالي الوجبات" : "Total meals"}</div></div>
        <div class="kpi"><div class="v" style="color:#3cc4f0">${tPlain}</div><div class="l">${isRtl ? "عادي" : "Plain"}</div></div>
        <div class="kpi"><div class="v" style="color:#c2410c">${tMod}</div><div class="l">${isRtl ? "معدّل" : "Modified"}</div></div>
        <div class="kpi"><div class="v" style="color:#47759c">${mealSummary.length}</div><div class="l">${isRtl ? "أنواع الأطباق" : "Dish types"}</div></div>
      </div>
      ${dishHtml}
      ${custHtml}
      </body></html>`;
    // 📄 PDF عبر طباعة المتصفح — نفس مسار باقي التقارير (لا ملفات HTML).
    openPrintDoc(html, {
      fileName: `${isRtl ? "كشف المطبخ" : "Kitchen sheet"} - ADRENALINE - ${formattedDate}`,
      isRtl,
      // الترقيم مُعرّف داخل @page الخاصة بالكشف — نوقف حقن openPrintDoc كي لا تتضارب قاعدتا @page
      pageNumbers: false,
    });
  };

  const handleMarkPrepared = async (planId: string) => {
    try {
      // يعلّم الخطة كمحضّرة + يخصم مكوّنات الرسيبي من المخزون تلقائياً (idempotent)
      await prepareAndConsume.mutateAsync(planId);
    } catch (error) {
      console.error("Failed to mark as prepared:", error);
      // fallback: على الأقل حدّث الحالة لو فشل خصم المخزون
      try {
        await updatePlanMutation.mutateAsync({ id: planId, data: { status: "PREPARED" } });
      } catch {
        void alertDialog({ message: isRtl ? "❌ فشل تحديث الحالة. حاول مرة أخرى." : "❌ Failed to update status. Please try again." });
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getModifiersByGroup = (modifierIds: string[] = []) => {
    const avoid: string[] = [];
    const pref: string[] = [];
    const portion: string[] = [];

    modifierIds.forEach((id) => {
      const mod: any = modifiers.find((m: any) => m._id === id);
      if (!mod) return;
      const name = isRtl ? mod.nameAr || mod.name : mod.name;
      if (mod.group === "AVOID") avoid.push(name);
      else if (mod.group === "PREF") pref.push(name);
      else if (mod.group === "PORTION") portion.push(name);
    });

    return { avoid, pref, portion };
  };

  const openMealDetailsDialog = (mealName: string, details: any[]) => {
    setSelectedMealName(mealName);
    setSelectedMealDetails(details);
    setOpenMealDialog(true);
  };

  return (
    <>
      {/* Screen Version */}
      <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-24 print:hidden">
        {/* Header */}
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <DashboardHeader
            icon={<ChefHat className="h-6 w-6 sm:h-7 sm:w-7" />}
            titleAr="عرض المطبخ" titleEn="Kitchen Display"
            {...(() => {
              // ✅ العنوان إنجليزي دائماً — الطاقم يقرأ إنجليزي (بغضّ النظر عن لغة الجهاز)
              const label = `${isTomorrow ? "🍳 Prep for TOMORROW's delivery (cook today) — " : isTodayDate ? "Today's delivery — " : "Delivery — "}${format(date, "EEEE, d MMMM yyyy", { locale: enUS })}`;
              return { subtitleAr: label, subtitleEn: label };
            })()}
            kpis={[
              { value: stats.today, labelAr: "قيد التحضير", labelEn: "To Prepare" },
              { value: stats.prepared, labelAr: "جاهز", labelEn: "Prepared" },
            ]}
            actions={
              <>
                {/* ✅ تبديل سريع: توصيل بكرة (الافتراضي) / اليوم — بدون ما الشيف يفتح التقويم */}
                <div className="flex rounded-xl overflow-hidden border border-white/30 shrink-0">
                  <button onClick={() => jumpTo("TOMORROW")}
                    className={cn("h-11 px-3 text-xs sm:text-sm font-black transition-colors", isTomorrow ? "bg-white text-[#0E2A4A]" : "bg-white/10 text-white hover:bg-white/20")}>
                    Tomorrow
                  </button>
                  <button onClick={() => jumpTo("TODAY")}
                    className={cn("h-11 px-3 text-xs sm:text-sm font-black transition-colors border-s border-white/20", isTodayDate ? "bg-white text-[#0E2A4A]" : "bg-white/10 text-white hover:bg-white/20")}>
                    Today
                  </button>
                </div>

                <Button
                  onClick={handlePrint}
                  className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm"
                >
                  <Printer className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                  {isRtl ? "طباعة" : "Print"}
                </Button>

                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-xl border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                      <CalendarIcon className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                      {format(date, "EEEE, d MMMM", { locale: dateLocale })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        if (d) {
                          setDate(d);
                          setIsCalendarOpen(false);
                        }
                      }}
                      locale={dateLocale}
                    />
                  </PopoverContent>
                </Popover>
              </>
            }
          />
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm mt-4">
          <div className="max-w-6xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab("MORNING")}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base transition-all",
                  activeTab === "MORNING"
                    ? "bg-cyan-500 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                )}
              >
                {isRtl ? "توصيل صباحي" : "Morning Delivery"}
              </button>
              <button
                onClick={() => setActiveTab("EVENING")}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base transition-all",
                  activeTab === "EVENING"
                    ? "bg-gray-700 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                )}
              >
                {isRtl ? "توصيل مسائي" : "Evening Delivery"}
              </button>
              <button
                onClick={() => setActiveTab("SUMMARY")}
                className={cn(
                  "flex-1 h-12 rounded-xl font-bold text-base transition-all",
                  activeTab === "SUMMARY"
                    ? "bg-[#47759c] text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                )}
              >
                {isRtl ? "إجمالي الوجبات" : "Meal Summary"}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
          {/* ✅ قسم الوجبات المخصّصة — يظهر أعلى تبويبات التوصيل فقط؛ في "إجمالي الوجبات" يظهر أسفل القائمة */}
          {(() => {
            const custShown = activeTab === "SUMMARY" ? [] : customizedAll.filter((c) => c.deliveryTime === activeTab);
            return custShown.length > 0 && (
            <Card className="rounded-2xl border-2 border-[#0E76AC]/20 bg-[#f7fbfe]">
              <CardContent className="p-4">
                <h3 className="font-black text-[#0E2A4A] flex items-center gap-2 mb-3">
                  <ChefHat className="h-5 w-5 text-[#0E76AC]" />
                  {isRtl ? "الوجبات المخصّصة" : "Customized meals"}
                  <span className="text-[11px] font-bold text-white bg-[#0E76AC] rounded-full px-2 py-0.5">{custShown.length}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {custShown.map((c, ci) => (
                    <div key={ci} className="rounded-xl bg-white border border-slate-100 p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-[15px] text-[#0E2A4A]">{c.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">{c.deliveryTime === "EVENING" ? (isRtl ? "مسائي" : "Eve") : (isRtl ? "صباحي" : "Morn")}</span>
                      </div>
                      {c.allergies && (
                        <p className="text-[11px] text-red-700 bg-red-50 rounded px-2 py-1 mb-2 font-bold">🚫 {c.allergies}</p>
                      )}
                      <ul className="divide-y divide-slate-100">
                        {c.meals.map((m: any, i: number) => (
                          <li key={i} className={cn("text-[14px] font-bold py-2", m.notset ? "text-amber-700" : "text-[#0f2438]")}>
                            {m.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            );
          })()}

          {activeTab === "SUMMARY" ? (
            /* ✅ تاب إجمالي الوجبات - تصميم مبسط للشيف */
            <>
              {mealSummary.length === 0 ? (
                <Card className="rounded-2xl border-dashed" style={{ border: "1.5px dashed #e8eef4" }}>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-lg text-gray-500">
                      {isRtl ? "لا توجد وجبات" : "No meals"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="hidden sm:block sm:w-[110px]" />
                    <h2 className="text-2xl font-bold text-gray-900 text-center flex-1">
                      {isRtl ? "تفاصيل وجبات اليوم المحدد" : "Today's Meal Details"}
                    </h2>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => exportSheet("xlsx")}
                        disabled={exporting !== null}
                        title={isRtl ? "تحميل كشف اليوم Excel" : "Download today's sheet as Excel"}
                        className="h-11 px-4 rounded-xl font-bold text-white text-sm flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        {exporting === "xlsx" ? "…" : "Excel"}
                      </button>
                      <button
                        onClick={() => exportSheet("pdf")}
                        disabled={exporting !== null}
                        title={isRtl ? "تحميل كشف اليوم PDF" : "Download today's sheet as PDF"}
                        className="h-11 px-4 rounded-xl font-bold text-white text-sm flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}
                      >
                        <Download className="h-4 w-4" />
                        {exporting === "pdf" ? "…" : "PDF"}
                      </button>
                      <button
                        onClick={handlePrintChefSheet}
                        className="h-11 px-5 rounded-xl font-bold text-white text-sm flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all"
                        style={{ background: "linear-gradient(135deg,#3cc4f0,#0E76AC)" }}
                      >
                        <Download className="h-4 w-4" />
                        {isRtl ? "تنزيل كشف الشيف" : "Download Chef Sheet"}
                      </button>
                    </div>
                  </div>

                  {/* ✅ ملخّص إجمالي اليوم للشيف (كل الوجبات · عادي · معدّل) */}
                  {(() => {
                    const tMeals = mealSummary.reduce((s, m) => s + m.count, 0);
                    const tPlain = mealSummary.reduce((s, m) => s + m.plainCount, 0);
                    const tMod = mealSummary.reduce((s, m) => s + m.modifiedCount, 0);
                    const cards = [
                      { label: isRtl ? "إجمالي الوجبات" : "Total Meals", value: tMeals, bg: "linear-gradient(135deg,#3cc4f0,#0E76AC)", text: "#fff" },
                      { label: isRtl ? "عادي" : "Plain", value: tPlain, bg: "#e8f8fd", text: "#0E76AC" },
                      { label: isRtl ? "معدّل" : "Modified", value: tMod, bg: "#fff7ed", text: "#c2410c" },
                      { label: isRtl ? "أنواع الأطباق" : "Dishes", value: mealSummary.length, bg: "#eaf1f7", text: "#47759c" },
                    ];
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                        {cards.map((c, i) => (
                          <div key={i} className="rounded-2xl px-4 py-3 text-center" style={{ background: c.bg, border: "1px solid #e8eef4" }}>
                            <div className="text-3xl font-black tabular-nums" style={{ color: c.text }}>{c.value}</div>
                            <div className="text-[11px] font-bold mt-0.5" style={{ color: c.text, opacity: 0.85 }}>{c.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ✅ مكوّنات اليوم المجمّعة (mise-en-place) — كم كيلو/بيضة يحتاج المطبخ */}
                  {todayIngredients && todayIngredients.length > 0 && (
                    <div className="mb-6 rounded-2xl border border-[#e8eef4] overflow-hidden">
                      <div className="px-4 py-3 bg-[#0E2A4A] text-white flex items-center gap-2">
                        <span className="text-base">🧺</span>
                        <span className="font-black text-sm">{isRtl ? "مكوّنات اليوم (تجهيز مسبق)" : "Today's ingredients (prep list)"}</span>
                        <span className="text-[11px] opacity-75 ms-auto">{todayIngredients.length} {isRtl ? "صنف" : "items"}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[#e8eef4]">
                        {todayIngredients.map((ing: any, i: number) => (
                          <div key={i} className={cn("p-3 bg-white flex items-center justify-between", ing.low && "bg-red-50")}>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">{ing.name}</p>
                              {ing.low && <p className="text-[10px] font-bold text-red-500">{isRtl ? "⚠ المخزون لا يكفي" : "⚠ Not enough stock"}</p>}
                            </div>
                            <span className={cn("text-sm font-black tabular-nums shrink-0", ing.low ? "text-red-600" : "text-[#0E76AC]")}>
                              {ing.qty} {ing.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {mealSummary.map((meal, index) => {
                    const colors = [
                      "bg-[#3cc4f0]",
                      "bg-[#47759c]",
                      "bg-[#0f1516]",
                      "bg-[#5a8aad]",
                      "bg-[#7ba8c4]",
                      "bg-[#2d5c82]",
                      "bg-[#3cc4f0]/70",
                      "bg-[#47759c]/70",
                      "bg-[#0f1516]/70",
                    ];
                    const color = colors[index % colors.length];

                    return (
                      <div
                        key={index}
                        className="bg-white rounded-2xl p-5 hover:-translate-y-0.5 transition-all"
                        style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)" }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={cn("w-3 h-3 rounded-full shrink-0", color)} />
                            <span className={cn("text-xl font-bold truncate", (meal as any).preparedCount >= meal.count ? "text-emerald-600 line-through" : "text-gray-900")}>
                              {meal.name}
                            </span>
                            {/* ✅ عدّاد التقدّم + تعليم كل الحصص جاهزة دفعة واحدة */}
                            {(meal as any).locations?.length > 0 && (() => {
                              const done = (meal as any).preparedCount;
                              const total = meal.count;
                              const allDone = done >= total;
                              return (
                                <button
                                  onClick={() => bulkTogglePrepared({ locations: (meal as any).locations, prepared: !allDone, sessionToken: sessionTok })}
                                  className={cn(
                                    "shrink-0 h-8 px-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all",
                                    allDone ? "bg-emerald-500 text-white" : done > 0 ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50",
                                  )}
                                  title={isRtl ? "علّم كل حصص هذا الطبق جاهزة" : "Mark all servings of this dish done"}
                                >
                                  {allDone ? (isRtl ? "✓ كله جاهز" : "✓ All done") : `${done}/${total} ${isRtl ? "علّم" : "done"}`}
                                </button>
                              );
                            })()}
                          </div>

                          <button
                            onClick={() => openMealDetailsDialog(meal.name, meal.details)}
                            className={cn(
                              "text-3xl font-bold text-white px-8 py-3 rounded-xl shadow-md hover:shadow-xl transition-all active:scale-95 shrink-0",
                              color
                            )}
                          >
                            {meal.count}
                          </button>
                        </div>

                        {/* ✅ Breakdown: عادي vs معدّل */}
                        {meal.count > 0 && (
                          <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                                style={{ background: "#e8f8fd", border: "1px solid #3cc4f040" }}>
                                <div>
                                  <p className="text-[10px] font-bold text-[#47759c] uppercase tracking-wide">
                                    {isRtl ? "عادي" : "Plain"}
                                  </p>
                                  <p className="text-[10px] text-[#3cc4f0] mt-0.5">
                                    {isRtl ? "بدون تعديلات" : "No modifications"}
                                  </p>
                                </div>
                                <span className="text-2xl font-black tabular-nums text-[#3cc4f0]">
                                  {meal.plainCount}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                                style={{ background: "#eaf1f7", border: "1px solid #47759c40" }}>
                                <div>
                                  <p className="text-[10px] font-bold text-[#47759c] uppercase tracking-wide">
                                    {isRtl ? "معدّل" : "Modified"}
                                  </p>
                                  <p className="text-[10px] text-[#47759c]/70 mt-0.5">
                                    {isRtl ? "ممنوعات/تفضيلات" : "Avoid/Prefs"}
                                  </p>
                                </div>
                                <span className="text-2xl font-black tabular-nums text-[#47759c]">
                                  {meal.modifiedCount}
                                </span>
                              </div>
                            </div>

                            {/* Program Breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {meal.dietCount > 0 && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-sky-50/50 border border-sky-100 text-center">
                                  <span className="text-[9px] font-bold text-sky-600 block">DIET</span>
                                  <span className="text-lg font-black text-sky-700">{meal.dietCount}</span>
                                  <span className="text-[8.5px] font-bold text-sky-600/80 block leading-tight" dir="ltr">
                                    C {programPortions.DIET?.carb}g · P {programPortions.DIET?.protein}g
                                  </span>
                                  <span className="text-[8.5px] text-sky-500 block" dir="ltr">
                                    Σ {((meal.dietCount * (programPortions.DIET?.carb || 0)) / 1000).toFixed(1)}kg carb
                                  </span>
                                </div>
                              )}
                              {meal.fitnessCount > 0 && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-cyan-50/50 border border-cyan-100 text-center">
                                  <span className="text-[9px] font-bold text-cyan-600 block">FITNESS</span>
                                  <span className="text-lg font-black text-cyan-700">{meal.fitnessCount}</span>
                                  <span className="text-[8.5px] font-bold text-cyan-600/80 block leading-tight" dir="ltr">
                                    C {programPortions.FITNESS?.carb}g · P {programPortions.FITNESS?.protein}g
                                  </span>
                                  <span className="text-[8.5px] text-cyan-500 block" dir="ltr">
                                    Σ {((meal.fitnessCount * (programPortions.FITNESS?.carb || 0)) / 1000).toFixed(1)}kg carb
                                  </span>
                                </div>
                              )}
                              {meal.bulkCount > 0 && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-amber-50/50 border border-amber-100 text-center">
                                  <span className="text-[9px] font-bold text-amber-600 block">BULK</span>
                                  <span className="text-lg font-black text-amber-700">{meal.bulkCount}</span>
                                  <span className="text-[8.5px] font-bold text-amber-600/80 block leading-tight" dir="ltr">
                                    C {programPortions.BULK?.carb}g · P {programPortions.BULK?.protein}g
                                  </span>
                                  <span className="text-[8.5px] text-amber-500 block" dir="ltr">
                                    Σ {((meal.bulkCount * (programPortions.BULK?.carb || 0)) / 1000).toFixed(1)}kg carb
                                  </span>
                                </div>
                              )}
                              {meal.customizedCount > 0 && (
                                <div className="px-2.5 py-1.5 rounded-lg bg-purple-50/50 border border-purple-100 text-center">
                                  <span className="text-[9px] font-bold text-purple-600 block">CUSTOMIZED</span>
                                  <span className="text-lg font-black text-purple-700">{meal.customizedCount}</span>
                                </div>
                              )}
                            </div>

                            {/* ✅ تعديلات مجمّعة بعدّاد (chef-friendly): "بدون فطر ×3" + أسماء العملاء */}
                            {meal.modGroups.length > 0 && (
                              <div className="mt-3 pt-3 border-t-2 border-dashed border-amber-200/60 bg-amber-50/20 rounded-xl p-3">
                                <h4 className="text-xs font-black text-amber-700 flex items-center gap-1.5 mb-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  {isRtl ? `التعديلات المطلوبة (${meal.modGroups.length} نوع · ${meal.modifiedCount} وجبة)` : `Required Modifications (${meal.modGroups.length} types · ${meal.modifiedCount} meals)`}
                                </h4>
                                <div className="flex flex-col gap-1.5">
                                  {meal.modGroups.map((g: any, gi: number) => (
                                    <div key={gi} className="bg-white rounded-lg px-3 py-2 border border-amber-200/50 shadow-sm">
                                      <div className="flex items-start gap-2">
                                        <span className="shrink-0 text-sm font-black text-white bg-amber-500 rounded-md px-2 py-0.5 tabular-nums">
                                          ×{g.count}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[13px] font-bold text-gray-900 leading-snug break-words">
                                            {g.label || (isRtl ? "تعديل مطلوب — راجع الطلب" : "Modification — check order")}
                                          </p>
                                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                                            {g.customers.map((c: any) => `${c.name}${c.deliveryTime === "MORNING" ? " ☀" : " 🌙"}`).join(isRtl ? "، " : ", ")}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ✅ قسم المشتركين المخصّصين — أسفل الإجمالي؛ بوكس كامل لكل عميل باسمه (نفس المصدر الموحّد) */}
                  {customizedAll.length > 0 && (
                    <div className="mt-8">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">CUSTOMIZED</span>
                        <h3 className="text-lg font-bold text-gray-900">
                          {isRtl ? `الوجبات المخصّصة (${customizedAll.length} عميل)` : `Customized Orders (${customizedAll.length})`}
                        </h3>
                      </div>
                      {/* ✅ نفس تصميم جداول الوجبات العادية: رأس ملوّن (اسم + عدد) وصفوف
                          مؤطّرة وعمود كمية — جدول لكل مخصّص (طلب المستخدم). */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customizedAll.map((p, i) => (
                          <table key={i} className="w-full border-collapse text-[13px]" style={{ boxShadow: "0 10px 24px -16px rgba(14,42,74,.18)" }}>
                            <tbody>
                              <tr>
                                <td className="font-black text-white px-3 py-2" style={{ background: "#0E76AC", border: "1px solid #0E76AC" }}>
                                  {p.name} {p.deliveryTime === "MORNING" ? "☀" : "🌙"}
                                </td>
                                <td className="font-black text-white text-center px-2 py-2 w-11" style={{ background: "#0E76AC", border: "1px solid #0E76AC" }}>
                                  {p.meals.length}
                                </td>
                              </tr>
                              {p.allergies && (
                                <tr><td colSpan={2} className="text-red-700 bg-red-50 px-3 py-1.5 font-bold text-[12px]" style={{ border: "1px solid #6d8aa3" }}>🚫 {p.allergies}</td></tr>
                              )}
                              {p.meals.map((m: any, j: number) => (
                                <tr key={j} className={cn(m.notset ? "bg-amber-50" : (j % 2 === 1 ? "bg-[#f6fafd]" : ""))}>
                                  <td className={cn("px-3 py-1.5 font-bold", m.notset && "text-amber-700")} style={{ border: "1px solid #6d8aa3" }}>{m.text}</td>
                                  <td className="text-center font-black px-2 py-1.5 text-[#0E76AC]" style={{ border: "1px solid #6d8aa3" }}>{m.notset ? "" : (m.isSide ? "•" : "1")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* ✅ تابات التوصيل (MORNING / EVENING) */
            <>
              {plans.length === 0 ? (
              <Card className="rounded-2xl border-dashed" style={{ border: "1.5px dashed #e8eef4" }}>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-lg text-gray-500">
                    {isRtl ? "لا توجد طلبات" : "No orders"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              plans.map((plan: any) => {
              const customer: any = getCustomer(plan.customerId);
              // ✅ إذا لم يوجد customer مربوط، نعرض الطلب بدون بيانات العميل المفصلة
              
              const hasAllergy = customer?.allergies && customer.allergies.trim().length > 0;
              const isPrepared = plan.status === "PREPARED";
              
              // ✅ استخدام اسم احتياطي إذا لم يوجد customer
              const customerName = customer?.fullName || plan.customerName || (isRtl ? "عميل جديد" : "New Customer");
              const customerProgram = customer?.program || (isRtl ? "طلب من الموقع" : "Website Order");

              return (
                <Card
                  key={plan._id}
                  className={cn(
                    "overflow-hidden rounded-2xl transition-all",
                    isPrepared ? "bg-[#f4f8fb] opacity-80" : "bg-white hover:-translate-y-0.5"
                  )}
                  style={{
                    border: isPrepared ? "1px solid #cbe8f5" : "1px solid #e8eef4",
                    boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 12px 28px -14px rgba(14,42,74,.16)",
                  }}
                >
                  {/* شريط الحساسية — مرّة واحدة أعلى الكرت، مع نص الحساسية الفعلي */}
                  {hasAllergy && (
                    <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2.5 font-bold">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      <span className="text-[11px] uppercase tracking-wider bg-white/20 rounded px-1.5 py-0.5 shrink-0">
                        {isRtl ? "حساسية" : "Allergy"}
                      </span>
                      <span className="text-sm font-extrabold truncate">{customer?.allergies}</span>
                    </div>
                  )}

                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">
                          {customerName}
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>ID: #{plan._id.slice(-4)}</span>
                          <span>•</span>
                          <span>{customerProgram}</span>
                        </div>
                      </div>

                      {isPrepared ? (
                        <Badge className="bg-[#e8f8fd] text-[#0E76AC] border-0 text-sm px-4 py-1.5 rounded-full font-semibold">
                          {isRtl ? "جاهز للتوصيل" : "Ready to Deliver"}
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700 border-0 text-sm px-4 py-1.5 rounded-full font-semibold">
                          {isRtl ? "جاهز للتحضير" : "Ready to Prepare"}
                        </Badge>
                      )}
                    </div>

                    {/* Meals — مرتّبة حسب ترتيب الوجبة (فطور ← غداء ← عشاء ← سناك) لسهولة التحضير */}
                    <div className="space-y-4 mb-4">
                      {(() => {
                        const courseRank = (item: any) => {
                          const c = String(getCategory(item.categoryId)?.name || item.category || "").toUpperCase();
                          if (c.includes("BREAKFAST") || c.includes("فطور")) return 0;
                          if (c.includes("LUNCH") || c.includes("غداء")) return 1;
                          if (c.includes("DINNER") || c.includes("عشاء")) return 2;
                          if (c.includes("SNACK") || c.includes("سناك")) return 3;
                          return 4;
                        };
                        return [...getEffectivePlanItems(plan)].filter((item: any) => !item.isOff).sort((a: any, b: any) => courseRank(a) - courseRank(b));
                      })()
                        .map((item: any, idx: number) => {
                          // ✅ دعم كلا النوعين: menuItemId (خطط يدوية) و mealId (طلبات عملاء)
                          const mealId = item.publicMealId || item.mealId || item.menuItemId;
                          const category = getCategory(item.categoryId);

                          // ✅ اسم الوجبة بلغة الواجهة (منيو عام + داخلي، إنجليزي في الوضع الإنجليزي)
                          const mealName = mealNameInLang(mealId, item);
                          
                          const { avoid, pref, portion } = getModifiersByGroup(item.modifierIds);

                          // ✅ دمج modifiers من 3 مصادر:
                          // 1) modifierIds (المختارة من الـ picker)
                          // 2) item نفسه (بيانات مضمنة من الطلب الإلكتروني)
                          // 3) customer (الحساسية والممنوعات والتفضيلات والكميات من بيانات الاشتراك)
                          const allAvoid = [...avoid];
                          const allPref = [...pref];
                          const allPortions = [...portion];

                          if (item.avoid) allAvoid.push(item.avoid);
                          if (item.preferences) allPref.push(item.preferences);
                          if (item.portions) allPortions.push(item.portions);

                          // من بيانات العميل (تنطبق على كل وجباته)
                          if (customer?.avoid && String(customer.avoid).trim()) allAvoid.push(String(customer.avoid).trim());
                          if (customer?.preferences && String(customer.preferences).trim()) allPref.push(String(customer.preferences).trim());
                          if (customer?.portions && String(customer.portions).trim()) allPortions.push(String(customer.portions).trim());

                          // ملاحظة خاصة بالوجبة (من Plans.tsx)
                          const itemNote = String(item.specialNotes || "").trim();

                          // ✅ الفهرس الأصلي في plan.items (الترتيب هنا مفروز)
                          const origIdx = (plan.items || []).indexOf(item);
                          const itemDone = Boolean(item.prepared);

                          return (
                            <div
                              key={idx}
                              className={cn("rounded-xl p-4 transition-all", itemDone ? "bg-emerald-50/60" : "bg-[#f7fbfe]")}
                              style={{ border: itemDone ? "1px solid #a7f3d0" : "1px solid #e8eef4" }}
                            >
                              {/* رأس الوجبة: التصنيف يسارًا + زر التعليم كجاهزة يمينًا */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[11px] font-bold px-2.5 py-0.5 border-0 tracking-wide",
                                      getCategoryLabel(category?.name || item.category || "").includes("BREAKFAST") && "bg-[#e8f8fd] text-[#0E76AC]",
                                      getCategoryLabel(category?.name || item.category || "").includes("LUNCH") && "bg-cyan-100 text-cyan-700",
                                      getCategoryLabel(category?.name || item.category || "").includes("DINNER") && "bg-[#eaf1f7] text-[#47759c]",
                                      getCategoryLabel(category?.name || item.category || "").includes("SNACK") && "bg-[#e8f8fd] text-[#0E76AC]"
                                    )}
                                  >
                                    {getCategoryLabel(category?.name || item.category || "")}
                                  </Badge>
                                  {item.specialInstructions && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">
                                      {item.specialInstructions}
                                    </span>
                                  )}
                                </div>
                                {!isPrepared && (
                                  <button
                                    onClick={() => toggleItemPrepared({ id: plan._id, itemIndex: origIdx, prepared: !itemDone, sessionToken: sessionTok })}
                                    className={cn(
                                      "shrink-0 h-8 px-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all",
                                      itemDone ? "bg-emerald-500 text-white" : "bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                    )}
                                  >
                                    {itemDone ? "✓ " + (isRtl ? "جاهزة" : "Done") : (isRtl ? "علّم جاهزة" : "Mark done")}
                                  </button>
                                )}
                              </div>

                              {/* اسم الوجبة */}
                              <h3 className={cn("text-lg font-black mb-2 leading-snug", itemDone ? "text-emerald-600 line-through" : "text-[#0f1516]")}>
                                {mealName}
                              </h3>

                              {/* Modifiers + customer dietary data */}
                              {(allAvoid.length > 0 || allPref.length > 0 || allPortions.length > 0) && (
                                <div className="space-y-1.5">
                                  {/* AVOID - Red boxes */}
                                  {allAvoid.length > 0 && (
                                    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                                      style={{ background: "#fef2f2", border: "1px solid #ef444440" }}>
                                      <span className="text-red-500 font-black text-sm flex-shrink-0">✕</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-wide">{isRtl ? "ممنوع" : "Avoid"}</p>
                                        <p className="text-sm font-bold text-red-800 leading-tight mt-0.5">{allAvoid.join(isRtl ? "، " : ", ")}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* PREF - Cyan */}
                                  {allPref.length > 0 && (
                                    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                                      style={{ background: "#ecfeff", border: "1px solid #a5f3fc" }}>
                                      <span className="font-black text-sm flex-shrink-0" style={{ color: "#0891b2" }}>★</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: "#0891b2" }}>{isRtl ? "تفضيلات" : "Prefs"}</p>
                                        <p className="text-sm font-semibold leading-tight mt-0.5" style={{ color: "#155e75" }}>{allPref.join(isRtl ? "، " : ", ")}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* PORTION - Yellow */}
                                  {allPortions.length > 0 && (
                                    <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                                      style={{ background: "#eaf1f7", border: "1px solid #47759c40" }}>
                                      <span className="text-[#47759c] font-black text-sm flex-shrink-0">⚖</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-[#47759c] uppercase tracking-wide">{isRtl ? "الكمية" : "Portion"}</p>
                                        <p className="text-sm font-semibold text-[#0f1516] leading-tight mt-0.5">{allPortions.join(isRtl ? "، " : ", ")}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Special note for this specific meal */}
                              {itemNote && (
                                <div className="mt-2 rounded-lg px-3 py-2 flex items-start gap-2"
                                  style={{ background: "#eaf1f7", border: "1px solid #47759c50" }}>
                                  <span className="font-black text-sm flex-shrink-0 text-[#47759c]">📝</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-[#47759c] uppercase tracking-wide">{isRtl ? "ملاحظة الوجبة" : "Note"}</p>
                                    <p className="text-sm font-semibold text-[#0f1516] leading-tight mt-0.5">{itemNote}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Special Notes */}
                    {plan.notes && plan.notes.trim().length > 0 && (
                      <div className="bg-[#eaf1f7] rounded-xl p-4 border-2 border-[#47759c]/30 mb-4">
                        <div className="flex items-start gap-2">
                          <span className="text-2xl">💬</span>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-[#0f1516] mb-1 uppercase">
                              {isRtl ? "ملاحظة الطلب" : "Order Note"}
                            </p>
                            <p className="text-sm text-[#47759c] font-medium italic">
                              {plan.notes}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    {!isPrepared && (
                      <Button
                        onClick={() => handleMarkPrepared(plan._id)}
                        className="w-full h-14 rounded-xl text-white font-bold text-lg shadow-md" style={{background:"linear-gradient(135deg,#3cc4f0,#0E76AC)"}}
                      >
                        {isRtl ? 'تحديد ك "تم التحضير"' : 'Mark as "Prepared"'}
                      </Button>
                    )}

                    {isPrepared && (
                      <div className="flex items-center justify-center gap-2 text-cyan-700 font-bold">
                        <Truck className="h-5 w-5" />
                        {isRtl ? "بانتظار التوصيل" : "Awaiting Delivery"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
            )}
          </>
          )}
        </div>
      </div>

      {/* Print Version */}
      <div className="hidden print:block bg-white text-slate-900" dir={isRtl ? "rtl" : "ltr"}>
        {(() => {
          // ✅ في الطباعة: استخدم كل خطط اليوم
          const allPlansToday = dailyPlans.filter(
            (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED")
          );
          const totalMeals = allPlansToday.reduce(
            (sum: number, p: any) => sum + getEffectivePlanItems(p).filter((i: any) => !i.isOff).length,
            0
          );
          return (
            <div className="p-6 space-y-6">
              {/* Print Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-300 pb-4 mb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-800">
                    {isRtl ? "عرض تحضير المطبخ الكلي" : "Kitchen Display Summary"}
                  </h1>
                  <p className="text-base text-slate-500 mt-1 font-bold">
                    {format(date, "EEEE, d MMMM yyyy", { locale: dateLocale })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-cyan-600">
                    {totalMeals} {isRtl ? "وجبة" : "meals"}
                  </p>
                  <p className="text-sm font-bold text-slate-500 mt-1">
                    {allPlansToday.length} {isRtl ? "عميل مشترك" : "customers"}
                  </p>
                </div>
              </div>

              {/* ✅ Unified Meal-First Print Section */}
              <div className="space-y-6">
                {mealSummary.map((m: any, mIdx: number) => {
                  const modifiedDetails = m.details.filter((d: any) => !d.isPlain);
                  
                  // ✅ ترتيب التعديلات حسب نوع البرنامج: DIET ثم FITNESS ثم BULK ثم CUSTOMIZED لسهولة التحضير
                  const programOrder = ["DIET", "FITNESS", "BULK", "CUSTOMIZED"];
                  const sortedDetails = [...modifiedDetails].sort((a: any, b: any) => {
                    const progA = (a.program || "").toUpperCase();
                    const progB = (b.program || "").toUpperCase();
                    const indexA = programOrder.findIndex(p => progA.includes(p));
                    const indexB = programOrder.findIndex(p => progB.includes(p));
                    const valA = indexA === -1 ? 999 : indexA;
                    const valB = indexB === -1 ? 999 : indexB;
                    return valA - valB;
                  });

                  return (
                    <div key={mIdx} className="border border-slate-300 rounded-xl overflow-hidden page-break-inside-avoid shadow-sm">
                      {/* Meal Header Panel */}
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-100/80 border-b border-slate-300">
                        <div>
                          <h3 className="text-lg font-black text-slate-800">{m.name}</h3>
                          {/* Program breakdown badges in header */}
                          <div className="flex gap-2.5 mt-1.5 flex-wrap">
                            {m.dietCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800">DIET ×{m.dietCount}</span>
                            )}
                            {m.fitnessCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-800">FITNESS ×{m.fitnessCount}</span>
                            )}
                            {m.bulkCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">BULK ×{m.bulkCount}</span>
                            )}
                            {m.customizedCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800">CUSTOM ×{m.customizedCount}</span>
                            )}
                          </div>
                        </div>

                        {/* Counts badges */}
                        <div className="flex items-center gap-2">
                          <div className="text-center bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-sm">
                            <span className="text-xl font-black text-slate-800 leading-none block">{m.count}</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">{isRtl ? "إجمالي" : "Total"}</span>
                          </div>
                          <div className="text-center bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                            <span className="text-base font-black text-emerald-700 leading-none block">{m.plainCount}</span>
                            <span className="text-[9px] font-bold text-emerald-600 uppercase">{isRtl ? "عادي" : "Plain"}</span>
                          </div>
                           <div className="text-center bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                            <span className="text-base font-black text-amber-700 leading-none block">{m.modifiedCount}</span>
                            <span className="text-[9px] font-bold text-amber-600 uppercase">{isRtl ? "معدّل" : "Mod"}</span>
                          </div>
                        </div>
                      </div>

                      {/* ✅ Chef Portion & Program Breakdown Grid */}
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-center">
                        <div className="px-2 py-1.5 rounded bg-sky-50/70 border border-sky-200">
                          <span className="text-[9px] font-black text-sky-600 block">DIET ({isRtl ? "تنشيف" : "Cut"})</span>
                          <span className="text-sm font-black text-sky-800">{m.dietCount || 0}</span>
                        </div>
                        <div className="px-2 py-1.5 rounded bg-cyan-50/70 border border-cyan-200">
                          <span className="text-[9px] font-black text-cyan-600 block">FITNESS ({isRtl ? "لياقة" : "Fitness"})</span>
                          <span className="text-sm font-black text-cyan-800">{m.fitnessCount || 0}</span>
                        </div>
                        <div className="px-2 py-1.5 rounded bg-amber-50/70 border border-amber-200">
                          <span className="text-[9px] font-black text-amber-600 block">BULK ({isRtl ? "تضخيم" : "Bulk"})</span>
                          <span className="text-sm font-black text-amber-800">{m.bulkCount || 0}</span>
                        </div>
                        <div className="px-2 py-1.5 rounded bg-purple-50/70 border border-purple-200">
                          <span className="text-[9px] font-black text-purple-600 block">CUSTOMIZED ({isRtl ? "مخصص" : "Custom"})</span>
                          <span className="text-sm font-black text-purple-800">{m.customizedCount || 0}</span>
                        </div>
                        <div className="px-2 py-1.5 rounded bg-slate-100 border border-slate-300">
                          <span className="text-[9px] font-black text-slate-600 block">STANDARD ({isRtl ? "قياسي" : "Standard"})</span>
                          <span className="text-sm font-black text-slate-800">{m.standardCount || 0}</span>
                        </div>
                      </div>

                      {/* Details of modified meals */}
                      {modifiedDetails.length > 0 ? (
                        <div className="p-3 bg-white">
                          <p className="text-xs font-black text-amber-700 mb-2 flex items-center gap-1">
                            ⚠️ {isRtl ? "تنبيهات وتعديلات تحضير المشتركين:" : "Special Customer Modifications:"}
                          </p>
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700">
                                <th className="border border-slate-200 px-3 py-2 text-right font-bold w-1/4">{isRtl ? "اسم المشترك" : "Customer"}</th>
                                <th className="border border-slate-200 px-2 py-2 text-center font-bold w-20">{isRtl ? "البرنامج" : "Program"}</th>
                                <th className="border border-slate-200 px-2 py-2 text-center font-bold w-16">{isRtl ? "التوصيل" : "Delivery"}</th>
                                <th className="border border-slate-200 px-3 py-2 text-right font-bold text-amber-800 bg-amber-50/50">{isRtl ? "🚫 الممنوع / التعديل المطلوب" : "🚫 Modifications Required"}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedDetails.map((d: any, dIdx: number) => {
                                const progLower = (d.program || "").toLowerCase();
                                let progColor = "bg-white";
                                if (dIdx % 2 === 1) progColor = "bg-slate-50/50";

                                const modifications = [
                                  d.allergies ? `${isRtl ? "⚠ حساسية: " : "⚠ Allergy: "}${d.allergies}` : null,
                                  d.avoid ? `${isRtl ? "ممنوع: " : "Avoid: "}${d.avoid}` : null,
                                  d.preferences ? `${isRtl ? "تفضيل: " : "Pref: "}${d.preferences}` : null,
                                  d.portions ? `${isRtl ? "الكمية: " : "Portion: "}${d.portions}` : null,
                                  d.specialNotes ? `${isRtl ? "ملاحظة: " : "Note: "}${d.specialNotes}` : null,
                                ].filter(Boolean).join(" | ") || (isRtl ? "تعديل مطلوب — راجع الطلب" : "Modification required");

                                return (
                                  <tr key={dIdx} className={progColor}>
                                    <td className="border border-slate-200 px-3 py-2.5 font-bold text-slate-800">{d.customerName}</td>
                                    <td className="border border-slate-200 px-2 py-2.5 text-center font-semibold text-slate-600 uppercase text-[10px]">
                                      {d.program || "—"}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-2.5 text-center font-bold text-slate-700 text-[10px]">
                                      {d.deliveryTime === "MORNING" ? (isRtl ? "صباحي ☀" : "Morning ☀") : (isRtl ? "مسائي 🌙" : "Evening 🌙")}
                                    </td>
                                    <td className="border border-slate-200 px-3 py-2.5 font-bold text-amber-800 bg-amber-50/20 text-sm">
                                      {modifications || "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-emerald-50/30 border-t border-slate-200">
                          <p className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                            ✓ {isRtl ? `جميع الـ ${m.count} وجبات عادية تماماً — تُحضّر بالوصفة القياسية بدون أي تعديلات.` : `All ${m.count} meals are standard — prepare following standard recipe.`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Print Footer */}
              <div className="border-t border-slate-300 mt-8 pt-4 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Adrenaline Healthy Food Kitchen Management System — {format(new Date(), "yyyy/MM/dd HH:mm")}
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ✅ Meal Details Dialog — Premium Light Theme */}
      <Dialog open={openMealDialog} onOpenChange={setOpenMealDialog}>
        <DialogContent
          className="max-w-4xl max-h-[85vh] overflow-hidden p-0 bg-white"
          dir={isRtl ? "rtl" : "ltr"}
          style={{
            border: "1px solid rgba(60,196,240,0.15)",
            boxShadow: "0 20px 60px rgba(60,196,240,0.15), 0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          {/* Header — Brand gradient */}
          <div className="relative px-6 py-5 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #3CC4F0 0%, #2bb0dc 50%, #47759C 100%)" }}>
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #ffffff60, transparent 70%)" }} />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-15"
              style={{ background: "radial-gradient(circle, #ffffff80, transparent 70%)" }} />

            <div className="relative flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">
                  {isRtl ? "تفاصيل الوجبة" : "Meal Details"}
                </p>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight truncate">
                  {selectedMealName}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl backdrop-blur-md px-5 py-3 text-center"
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  <p className="text-3xl font-black text-white tabular-nums leading-none">
                    {selectedMealDetails.length}
                  </p>
                  <p className="text-[10px] text-white/80 mt-1 uppercase tracking-wider">
                    {isRtl ? "عميل" : "Orders"}
                  </p>
                </div>
              </div>
            </div>

            {/* Plain vs Modified split */}
            {selectedMealDetails.length > 0 && (() => {
              const plainCount = selectedMealDetails.filter((d) => d.isPlain).length;
              const modifiedCount = selectedMealDetails.length - plainCount;
              return (
                <div className="relative grid grid-cols-2 gap-2 mt-4">
                  <div className="rounded-xl px-3 py-2 backdrop-blur-md flex items-center justify-between"
                    style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
                    <div>
                      <p className="text-[10px] font-bold text-white/90 uppercase tracking-wide">
                        {isRtl ? "عادي" : "Plain"}
                      </p>
                      <p className="text-[10px] text-white/70 mt-0.5">{isRtl ? "بدون تعديلات" : "No mods"}</p>
                    </div>
                    <span className="text-2xl font-black text-white tabular-nums">{plainCount}</span>
                  </div>
                  <div className="rounded-xl px-3 py-2 backdrop-blur-md flex items-center justify-between"
                    style={{ background: "rgba(252,165,15,0.25)", border: "1px solid rgba(252,165,15,0.4)" }}>
                    <div>
                      <p className="text-[10px] font-bold text-white uppercase tracking-wide">
                        {isRtl ? "معدّل" : "Modified"}
                      </p>
                      <p className="text-[10px] text-white/80 mt-0.5">{isRtl ? "احذر التحضير" : "Special prep"}</p>
                    </div>
                    <span className="text-2xl font-black text-white tabular-nums">{modifiedCount}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Visually hidden title for accessibility */}
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedMealName}</DialogTitle>
          </DialogHeader>

          {/* Customer list — sorted: Modified first, then Plain */}
          <div className="overflow-auto px-5 py-5 max-h-[60vh]"
            style={{ background: "#f8fafc" }}>
          {(() => {
            // Sort: المعدّل أولاً (isPlain=false) ثم العادي (isPlain=true)
            const sorted = [...selectedMealDetails].sort((a, b) => {
              const aPlain = a.isPlain ? 1 : 0;
              const bPlain = b.isPlain ? 1 : 0;
              if (aPlain !== bPlain) return aPlain - bPlain; // معدّل قبل عادي
              // ثم ترتيب بالوقت: صباحي قبل مسائي
              const aTime = a.deliveryTime === "MORNING" ? 0 : 1;
              const bTime = b.deliveryTime === "MORNING" ? 0 : 1;
              return aTime - bTime;
            });

            // Group with visual section dividers
            const modifiedMeals = sorted.filter((d) => !d.isPlain);
            const plainMeals = sorted.filter((d) => d.isPlain);

            const renderItem = (detail: any, idx: number) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 transition-all hover:-translate-y-0.5"
                style={{
                  boxShadow: detail.isPlain
                    ? "0 2px 12px rgba(0,0,0,0.05)"
                    : "0 2px 12px rgba(245,158,11,0.12), 0 0 0 1.5px #fde68a inset",
                  border: detail.isPlain ? "1px solid rgba(0,0,0,0.05)" : "1px solid #fde68a",
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  {/* Right: Customer + Category */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-black text-white"
                      style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)" }}>
                      {(detail.customerName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm md:text-base font-black text-[#0F1516] truncate">
                        {detail.customerName}
                      </p>
                      <p className="text-[11px] text-[#47759C] font-semibold mt-0.5">
                        {detail.categoryName || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Left: Delivery time + Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {detail.isPlain ? (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                        ✓ {isRtl ? "عادي" : "Plain"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
                        style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                        ⚠ {isRtl ? "معدّل" : "Modified"}
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{
                        background: detail.deliveryTime === "MORNING" ? "#fffbeb" : "#eff6ff",
                        color: detail.deliveryTime === "MORNING" ? "#92400e" : "#1e40af",
                        border: `1px solid ${detail.deliveryTime === "MORNING" ? "#fde68a" : "#bfdbfe"}`,
                      }}>
                      {detail.deliveryTime === "MORNING" ? "☀ " : "🌙 "}
                      {isRtl ? (detail.deliveryTime === "MORNING" ? "صباحي" : "مسائي") : detail.deliveryTime}
                    </span>
                  </div>
                </div>

                {/* Allergy — prominent full-width bar */}
                {detail.allergies && (
                  <div className="mt-3 rounded-lg overflow-hidden flex items-stretch"
                    style={{ background: "#fef2f2", border: "1.5px solid #ef4444" }}>
                    <div className="px-3 flex items-center justify-center text-white font-black"
                      style={{ background: "#ef4444", minWidth: "38px" }}>⚠</div>
                    <div className="flex-1 px-3 py-2 min-w-0">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-wider leading-none">
                        {isRtl ? "حساسية" : "Allergy"}
                      </p>
                      <p className="text-sm font-bold text-red-800 mt-0.5 leading-tight">{detail.allergies}</p>
                    </div>
                  </div>
                )}

                {/* Fallback when modified but no textual detail */}
                {!detail.isPlain && !detail.allergies && !detail.avoid && !detail.preferences && !detail.portions && !detail.specialNotes && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-xs font-bold text-amber-800"
                    style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                    {isRtl ? "⚠ تعديل مطلوب — راجع تفاصيل الطلب" : "⚠ Modification required — check order"}
                  </div>
                )}

                {/* Modifications */}
                {!detail.isPlain && (detail.avoid || detail.preferences || detail.portions) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {detail.avoid && (
                      <div className="rounded-lg px-3 py-2"
                        style={{ background: "#fef2f2", border: "1px solid #ef444440" }}>
                        <p className="text-[10px] font-black text-orange-700 uppercase tracking-wide">
                          ✕ {isRtl ? "ممنوع" : "Avoid"}
                        </p>
                        <p className="text-xs font-bold text-orange-800 mt-0.5 leading-tight">
                          {detail.avoid}
                        </p>
                      </div>
                    )}
                    {detail.preferences && (
                      <div className="rounded-lg px-3 py-2"
                        style={{ background: "#ecfeff", border: "1px solid #a5f3fc" }}>
                        <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: "#0891b2" }}>
                          ★ {isRtl ? "تفضيلات" : "Prefs"}
                        </p>
                        <p className="text-xs font-semibold mt-0.5 leading-tight" style={{ color: "#155e75" }}>
                          {detail.preferences}
                        </p>
                      </div>
                    )}
                    {detail.portions && (
                      <div className="rounded-lg px-3 py-2"
                        style={{ background: "#eaf1f7", border: "1px solid #47759c40" }}>
                        <p className="text-[10px] font-black text-[#47759c] uppercase tracking-wide">
                          ⚖ {isRtl ? "الكمية" : "Portion"}
                        </p>
                        <p className="text-xs font-semibold text-yellow-900 mt-0.5 leading-tight">
                          {detail.portions}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Special notes */}
                {detail.specialNotes && (
                  <div className="mt-2 rounded-lg px-3 py-2 flex items-start gap-2"
                    style={{ background: "#eaf1f7", border: "1px solid #47759c50" }}>
                    <span className="text-blue-500 flex-shrink-0">📝</span>
                    <p className="text-xs font-semibold text-blue-900 leading-tight">
                      {detail.specialNotes}
                    </p>
                  </div>
                )}
              </div>
            );

            return (
              <>
                {/* قسم المعدّل */}
                {modifiedMeals.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />
                      <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full"
                        style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                        ⚠ {isRtl ? `معدّل (${modifiedMeals.length})` : `Modified (${modifiedMeals.length})`}
                      </span>
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />
                    </div>
                    <div className="space-y-2.5 mb-5">
                      {modifiedMeals.map((d, i) => renderItem(d, i))}
                    </div>
                  </>
                )}

                {/* قسم العادي */}
                {plainMeals.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #10b981, transparent)" }} />
                      <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full"
                        style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                        ✓ {isRtl ? `عادي (${plainMeals.length})` : `Plain (${plainMeals.length})`}
                      </span>
                      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #10b981, transparent)" }} />
                    </div>
                    <div className="space-y-2.5">
                      {plainMeals.map((d, i) => renderItem(d, i + modifiedMeals.length))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
