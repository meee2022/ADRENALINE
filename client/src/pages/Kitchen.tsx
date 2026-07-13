/**
 * @file client/src/pages/Kitchen.tsx
 * @description نظام عرض المطبخ (KDS) - تصميم احترافي للشيف
 * @convex convex/dailyPlans.ts, convex/customers.ts, convex/menuItems.ts, convex/mealCategories.ts, convex/modifiers.ts
 */
import { useMemo, useState } from "react";
import {
  useDailyPlans,
  useUpdateDailyPlan,
  usePrepareAndConsume,
  useCustomers,
  useMenuItems,
  useCategories,
  useModifiers,
} from "@/lib/api";

import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { useStore } from "@/lib/store";

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
  const todayIngredients = useQuery(api.dailyPlans.todayIngredients, { date: formattedDate, sessionToken: sessionTok }) as any[] | undefined;
  // ✅ وجبات العملاء المخصّصين لهذا اليوم (من قوالبهم) — منفصلة لأنها لكل شخص بكمياته
  const customized = useQuery(api.customizedPlans.forDate, { date: formattedDate, sessionToken: sessionTok }) as any[] | undefined;
  // ✅ وجبات المنيو العام (مصدر أطباق الأساس للمخصّص) — لترجمة اسم الطبق للإنجليزي في الكشف
  const publicMealsList = useQuery(api.publicMeals.listMeals, {}) as any[] | undefined;
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
  const mealNameInLang = (mealId: any, item?: any): string => {
    const meal: any = (mealId && (getMenuItem(mealId) || mealById.get(String(mealId)))) || null;
    if (meal) return String(meal.nameEn || meal.name || meal.nameAr).trim();
    return String(item?.mealNameEn || item?.mealNameAr || "Unspecified meal").trim();
  };
  // ✅ تركيب سطر الوجبة المخصّصة — إنجليزي دائماً للمطبخ (أساس nameEn + بروتين/كارب مترجَمان + جرامات g)
  const composeCustItem = (it: any): string => {
    const gUnit = "g";
    const m: any = it.baseMealId ? mealById.get(String(it.baseMealId)) : null;
    const base = m ? String(m.nameEn || m.nameAr || m.name).trim() : String(it.baseName || "").trim();
    const bits: string[] = [];
    if (base) bits.push(base);
    if (it.type === "MAIN") {
      const inner: string[] = [];
      if (it.proteinG) inner.push(`${trName(it.proteinName || "", PROTEIN_TR, false) || "Protein"} ${it.proteinG}${gUnit}`);
      const carbTr = trName(it.carbName || "", CARB_TR, false);
      if (it.carbName && carbTr !== "None" && it.carbG) inner.push(`${carbTr} ${it.carbG}${gUnit}`);
      if (inner.length) bits.push(bits.length ? `— ${inner.join(" + ")}` : inner.join(" + "));
    }
    return bits.join(" ").trim() || String(it.text || it.baseName || "—").trim();
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
    const SIDE_KEYS = ["CRAB SALAD", "LAVA CAKE", "COOKIES", "FRUIT SALAD", "VEGETABLES SOUP", "CINNAMON APPLE", "BROWNIES", "LAZY CAKE", "CEASAR SALAD", "GREEK YOGURT", "TIRAMISU"];
    const isStandardSide = (nm: string) => { const u = nm.toUpperCase(); return SIDE_KEYS.some((k) => u.includes(k)); };

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
    const isPlainMeal = (item: any, customer: any): boolean => {
      // فحص بيانات الـ item نفسها
      if (String(item.avoid || "").trim()) return false;
      if (String(item.preferences || "").trim()) return false;
      if (String(item.portions || "").trim()) return false;
      if (String(item.specialNotes || "").trim()) return false;
      if ((item.modifierIds || []).length > 0) return false;
      // فحص بيانات العميل (الحساسية والممنوعات تطبق على كل وجباته)
      if (String(customer?.allergies || "").trim()) return false;
      if (String(customer?.avoid || "").trim()) return false;
      if (String(customer?.preferences || "").trim()) return false;
      if (String(customer?.portions || "").trim()) return false;
      return true;
    };

    allPlansToday.forEach((plan: any) => {
      const customer: any = getCustomer(plan.customerId);
      const customerName = customer?.fullName || plan.customerName || (isRtl ? "عميل جديد" : "New Customer");
      const program = (customer?.program || plan.program || "STANDARD").toUpperCase();

      // ✅ المخصّصون لا يدخلون الإجمالي — لكل واحد بوكس باسمه (وجباته مختلفة تماماً)
      const isCustomPlan = program.includes("CUSTOM");
      // ✅ قاعدة الإكسيل: نطوي فقط الأصناف القياسية للمخصّصين في الإجمالي؛ وجباتهم المخصّصة تبقى في بوكس الشخص.

      (plan.items || [])
        .filter((item: any) => !item.isOff)
        .forEach((item: any) => {
          const mealId = item.menuItemId || item.mealId;
          const meal: any = getMenuItem(mealId) || (mealId ? pubById.get(String(mealId)) : null);
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

          const plain = isPlainMeal(item, customer) && nameMods.length === 0 && !sideNote && !qtyNote;
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
            allergies: joinUniq([customer?.allergies]),
            avoid: joinUniq([item.avoid, customer?.avoid, ...av, ...nameMods.map((m: string) => m.replace(/^NO\s+/i, ""))]),
            preferences: joinUniq([item.preferences, customer?.preferences, ...pr]),
            portions: joinUniq([item.portions, customer?.portions, ...po, qtyNote || undefined, sideNote || undefined]),
            specialNotes: joinUniq([item.specialNotes]),
            isPlain: plain,
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
  }, [dailyPlans, formattedDate, customers, menuItems, publicMealsList, categories, modifiers, isRtl]);

  // ✅ المشتركون المخصّصون مجمّعون باسم كل عميل (بوكس كامل للشخص) — زي كشف الأخصائية
  const customizedByPerson = useMemo(() => {
    const allPlansToday = dailyPlans.filter(
      (p: any) => p.date === formattedDate && (p.status === "CONFIRMED" || p.status === "PREPARED")
    );
    const byPerson: Record<string, { name: string; deliveryTime: string; allergies: string; items: Array<{ meal: string; note: string }> }> = {};
    allPlansToday.forEach((plan: any) => {
      const customer: any = getCustomer(plan.customerId);
      const program = (customer?.program || plan.program || "").toUpperCase();
      if (!program.includes("CUSTOM")) return;
      const name = customer?.fullName || plan.customerName || (isRtl ? "عميل" : "Customer");
      const key = name + "|" + plan.deliveryTime;
      if (!byPerson[key]) byPerson[key] = {
        name, deliveryTime: plan.deliveryTime,
        // ✅ الممنوعات/الحساسية مرّة واحدة على مستوى البوكس (مش مكرّرة مع كل وجبة)
        allergies: [customer?.allergies, customer?.avoid].map((x: any) => String(x || "").trim()).filter(Boolean).join(" • "),
        items: [],
      };
      (plan.items || []).filter((it: any) => !it.isOff).forEach((item: any) => {
        const mealName = mealNameInLang(item.menuItemId || item.mealId, item);
        const note = String(item.specialNotes || "").trim(); // ملاحظة خاصة بالوجبة فقط
        byPerson[key].items.push({ meal: mealName, note });
      });
    });
    return Object.values(byPerson).sort((a, b) => a.name.localeCompare(b.name));
  }, [dailyPlans, formattedDate, customers, menuItems, publicMealsList, isRtl]);

  // ✅ مصدر موحّد للمخصّصين (شاشة + كشف): من خطط اليوم الفعلية، + أصحاب القوالب
  //    اللي مالهمش خطة اليوم. كل عميل: {name, deliveryTime, allergies, meals[]}.
  const customizedAll = useMemo(() => {
    const list: { name: string; deliveryTime: string; allergies: string; meals: string[] }[] = [];
    const seen = new Set<string>();
    for (const p of customizedByPerson) {
      seen.add(p.name);
      list.push({
        name: p.name, deliveryTime: p.deliveryTime, allergies: p.allergies,
        meals: p.items.map((it: any) => (it.note ? `${it.meal} — ${it.note}` : it.meal)).filter(Boolean),
      });
    }
    for (const c of (customized || [])) {
      if (seen.has(c.customerName)) continue;
      list.push({
        name: c.customerName, deliveryTime: c.deliveryTime,
        allergies: [c.allergies, c.avoid].map((x: any) => String(x || "").trim()).filter(Boolean).join(" • "),
        meals: (c.items || []).map((it: any) => composeCustItem(it)).filter(Boolean),
      });
    }
    return list.filter((p) => p.meals.length).sort((a, b) => a.name.localeCompare(b.name));
  }, [customizedByPerson, customized]); // eslint-disable-line react-hooks/exhaustive-deps

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
    let no = 0;

    allPlansToday.forEach((plan: any) => {
      const customer: any = getCustomer(plan.customerId);
      const program = (customer?.program || plan.program || "STANDARD").toUpperCase();
      const slots = { breakfast: [] as string[], snack: [] as string[], lunch: [] as string[], dinner: [] as string[], other: [] as string[] };

      (plan.items || []).filter((it: any) => !it.isOff).forEach((item: any) => {
        const meal: any = getMenuItem(item.menuItemId || item.mealId);
        const mealName = meal
          ? (isRtl ? (meal.nameAr || meal.name || meal.nameEn) : (meal.nameEn || meal.name || meal.nameAr))
          : ((isRtl ? (item.mealNameAr || item.mealNameEn) : (item.mealNameEn || item.mealNameAr)) || "—");
        const cat: any = item.menuItemId ? getCategory(meal?.categoryId) : null;
        const label = getCategoryLabel(cat?.name || item.category || "");
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

      no += 1;
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

    return rows;
  }, [dailyPlans, formattedDate, customers, menuItems, categories, isRtl]);

  const [exporting, setExporting] = useState<null | "xlsx" | "pdf">(null);
  const exportSheet = async (kind: "xlsx" | "pdf") => {
    if (!kitchenPeople.length) {
      alert(isRtl ? "لا توجد وجبات لهذا اليوم" : "No meals for this day");
      return;
    }
    setExporting(kind);
    try {
      const lang = isRtl ? "ar" : "en";
      if (kind === "xlsx") await downloadKitchenXlsx(formattedDate, kitchenPeople, lang);
      else await downloadKitchenPdf(formattedDate, kitchenPeople, lang);
    } catch (e: any) {
      alert((isRtl ? "تعذّر التحميل: " : "Download failed: ") + String(e?.message || e));
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
    // ✅ كشف زي الإكسيل: الأطباق الرئيسية (رز+بروتين) تعرض عمودَي Rice/Protein مع تقسيم DIET/FITNESS/BULK.
    //    باقي الأطباق (سلطات/سناك/حلو) تعرض صف "عادي" فقط. عمود واحد بعرض الصفحة عشان يتقري.
    const pp: any = programPortions;
    const MAIN_KEYS = ["CRISPY CHICKEN", "BEEF STROGANOF", "BEEF LASAGNA", "SOUTHWEST", "IRANIAN CHICKEN", "GRILLED CHICKEN", "GRILLED STEAK", "GRILLED SALMON", "GRILLED SHRIMP", "DYNAMITE SHRIMP", "CHICKEN CURRY", "GARLIC BUTTER", "CHICKEN FAJITA", "LEMON CHICKEN", "SHISHTAWOOK", "STEAK SANDWICH", "CHICKEN CUTLETS", "SHAWARMA"];
    const isMain = (nm: string) => { const u = nm.toUpperCase(); return MAIN_KEYS.some((k) => u.includes(k)); };
    const pgRow = (label: string, count: number, port: any) => count > 0
      ? `<tr class="pg"><td class="lb"><b>${label}</b></td><td class="gc">${port?.carb ?? "-"}g</td><td class="gc">${port?.protein ?? "-"}g</td><td class="ct">${count}</td></tr>`
      : "";
    const dishTable = (m: any) => {
      const main = isMain(m.name) && (m.dietCount + m.fitnessCount + m.bulkCount) > 0;
      const head = main
        ? `<tr class="chh"><td class="lb">${isRtl ? "البرنامج" : "Program"}</td><td class="gc">${isRtl ? "رز/كارب" : "Rice/Carb"}</td><td class="gc">${isRtl ? "بروتين" : "Protein"}</td><td class="ct">${isRtl ? "عدد" : "Qty"}</td></tr>`
          + pgRow("DIET", m.dietCount, pp.DIET) + pgRow("FITNESS", m.fitnessCount, pp.FITNESS) + pgRow("BULK", m.bulkCount, pp.BULK)
          + (m.standardCount > 0 ? `<tr class="plain"><td class="lb" colspan="3">STANDARD</td><td class="ct">${m.standardCount}</td></tr>` : "")
        : `<tr class="plain"><td class="lb" colspan="3">${isRtl ? "عادي — بدون تعديلات" : "Plain — no changes"}</td><td class="ct">${m.plainCount}</td></tr>`;
      return `
      <div class="dishbox"><table class="dish">
        <tr class="dh"><td class="dn" colspan="3">${esc(m.name)}</td><td class="dc">${m.count}</td></tr>
        ${head}
        ${m.modGroups.map((g: any) => `
        <tr><td class="lb" colspan="3">${esc(g.label || (isRtl ? "تعديل — راجع الطلب" : "Modified — check order"))}<div class="cst">${esc(g.customers.map((c: any) => c.name).join(isRtl ? "، " : ", "))}</div></td><td class="ct">${g.count}</td></tr>`).join("")}
        <tr class="tp"><td class="lb" colspan="3">Total Portions</td><td class="ct">${m.count}</td></tr>
      </table></div>`;
    };
    // ✅ الأطباق الرئيسية (بأعمدة جرامات) بعرض الصفحة كامل عشان تتقري؛ والسلطات/السناكات القياسية في عمودين
    const isMainDish = (m: any) => isMain(m.name) && (m.dietCount + m.fitnessCount + m.bulkCount) > 0;
    const mainDishes = mealSummary.filter(isMainDish);
    const sideDishes = mealSummary.filter((m: any) => !isMainDish(m));
    const dishWeight = (m: any) => 2 + m.modGroups.length + m.modGroups.reduce((s: number, g: any) => s + Math.floor(String(g.customers.map((c: any) => c.name).join(", ")).length / 42), 0);
    const dishHtml = mainDishes.map(dishTable).join("") + (sideDishes.length ? colsTable(sideDishes, 2, dishWeight, dishTable) : "");
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
    const personBox = (p: any) => `
      <div class="person"><div class="ph"><b>${esc(p.name)}</b><span>${p.deliveryTime === "MORNING" ? "Morning ☀" : "Evening 🌙"}</span></div>
      ${p.allergies ? `<div class="alg">🚫 ${esc(p.allergies)}</div>` : ""}
      <ul>${p.meals.map((m: string) => `<li>${esc(m)}</li>`).join("")}</ul></div>`;
    const personWeight = (p: any) => 1.5 + (p.allergies ? 1 : 0) + (p.meals?.length || 0);
    const custHtml = customizedAll.length ? `
      <h2 class="sec">Customized meals — one box per customer (${customizedAll.length})</h2>
      ${colsTable(customizedAll, 3, personWeight, personBox)}` : "";
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
        .dishbox{break-inside:avoid;page-break-inside:avoid;margin:0 0 8px}
        table.dish{width:100%;border-collapse:collapse;font-size:10.5px}
        table.dish td{border:1px solid #6d8aa3;padding:2.5px 6px;vertical-align:top}
        tr.dh td{background:#0E76AC;color:#fff;border-color:#0E76AC}
        .dn{font-size:12.5px;font-weight:900}
        .dc{font-size:13px;font-weight:900;text-align:center;width:44px}
        .lb{font-weight:700;line-height:1.35}
        .ct{font-weight:900;text-align:center;width:44px;font-size:11.5px}
        .gc{text-align:center;width:66px;font-weight:700;font-size:9.5px;color:#0E76AC}
        tr.chh td{background:#dceaf4;font-size:8px;color:#47759c;font-weight:800;text-transform:uppercase}
        tr.chh .gc{color:#47759c}
        tr.pg td{background:#f2f8fc} tr.pg .lb b{color:#0E76AC;font-weight:900}
        tr.plain td{background:#e8f4fb}
        tr:nth-child(even):not(.dh):not(.tp):not(.plain):not(.chh):not(.pg) td{background:#f6fafd}
        .cst{color:#7d90a2;font-size:8.5px;font-weight:400;line-height:1.3;margin-top:1px}
        tr.tp td{background:#dcebf5;color:#0E76AC;font-weight:900;border-top:1.5px solid #0E76AC}
        .sec{font-size:13px;margin:14px 0 6px;border-top:2px solid #0E76AC;padding-top:6px;break-before:auto;break-after:avoid}
        .person{border:1px solid #cdd9e4;border-radius:8px;padding:5px 7px;margin:0 0 6px;break-inside:avoid;page-break-inside:avoid;font-size:10px}
        .ph{display:flex;justify-content:space-between;border-bottom:1px solid #e3ebf2;padding-bottom:2px;margin-bottom:2px;font-size:10.5px}
        .person ul{margin:0;padding-inline-start:12px} .person li{font-size:9.5px;margin:1px 0;line-height:1.35}
        .alg{color:#b91c1c;font-size:8.5px;font-weight:700;margin:1px 0 2px}
        .nt{color:#c2410c}
        @page{size:A4;margin:8mm}
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
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) { alert(isRtl ? "اسمح بالنوافذ المنبثقة للطباعة" : "Allow pop-ups to print"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { w.print(); }, 300);
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
        alert(isRtl ? "❌ فشل تحديث الحالة. حاول مرة أخرى." : "❌ Failed to update status. Please try again.");
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
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {custShown.map((c, ci) => (
                    <div key={ci} className="rounded-xl bg-white border border-slate-100 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-black text-sm text-[#0E2A4A]">{c.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">{c.deliveryTime === "EVENING" ? (isRtl ? "مسائي" : "Eve") : (isRtl ? "صباحي" : "Morn")}</span>
                      </div>
                      {c.allergies && (
                        <p className="text-[10.5px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mb-1.5">⚠ {c.allergies}</p>
                      )}
                      <ul className="space-y-1">
                        {c.meals.map((meal, i) => (
                          <li key={i} className="text-[12.5px] font-bold text-slate-700 flex items-start gap-1.5">
                            <span className="text-[#0E76AC] shrink-0">•</span>
                            <span>{meal}</span>
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
                        <Printer className="h-4 w-4" />
                        {isRtl ? "طباعة كشف الشيف" : "Print Chef Sheet"}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {customizedAll.map((p, i) => (
                          <div key={i} className="bg-white rounded-2xl p-4" style={{ border: "1px solid #e8eef4", boxShadow: "0 1px 2px rgba(15,21,22,.04), 0 10px 24px -14px rgba(14,42,74,.16)" }}>
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                              <span className="font-black text-gray-900">{p.name}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: p.deliveryTime === "MORNING" ? "#fffbeb" : "#eff6ff", color: p.deliveryTime === "MORNING" ? "#92400e" : "#1e40af" }}>
                                {p.deliveryTime === "MORNING" ? (isRtl ? "☀ صباحي" : "☀ Morning") : (isRtl ? "🌙 مسائي" : "🌙 Evening")}
                              </span>
                            </div>
                            {p.allergies && (
                              <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 mb-2 font-semibold">⚠ {p.allergies}</p>
                            )}
                            <ul className="space-y-1.5">
                              {p.meals.map((meal, j) => (
                                <li key={j} className="text-sm">
                                  <span className="font-bold text-[#0f1516]">• {meal}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
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
                        return [...(plan.items || [])].filter((item: any) => !item.isOff).sort((a: any, b: any) => courseRank(a) - courseRank(b));
                      })()
                        .map((item: any, idx: number) => {
                          // ✅ دعم كلا النوعين: menuItemId (خطط يدوية) و mealId (طلبات عملاء)
                          const mealId = item.menuItemId || item.mealId;
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
            (sum: number, p: any) => sum + (p.items || []).filter((i: any) => !i.isOff).length,
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
