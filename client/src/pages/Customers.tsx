/**
 * @file client/src/pages/Customers.tsx
 * @description إدارة العملاء (المشتركين) + Import JSON/CSV
 */
import { useEffect, useMemo, useState } from "react";
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useImportCustomers,
  useDeleteCustomer,
  useForceDeleteCustomer,
  type Customer,
  useModifiers,
  type Modifier,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerCard } from "@/components/CustomerCard";
import { SubscriptionPauseDialog } from "@/components/SubscriptionPauseDialog";
import { CustomerMealPlanDialog } from "@/components/CustomerMealPlanDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  Plus,
  Upload,
  Download,
  ChevronDown,
  X,
  Users,
  PauseCircle,
  Trash2,
} from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { format, parseISO } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { useAction, useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { LocationPicker } from "@/components/LocationPicker";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { confirmDialog, alertDialog } from "@/lib/dialogs";
import { getUserError } from "@/lib/userError";

/* =========================
   Date helpers - DD/MM/YYYY format
========================= */
function normalizeDateToISO(input: any): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();

  // already ISO yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY format
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);

    let day = a;
    let month = b;

    month = Math.min(Math.max(month, 1), 12);
    day = Math.min(Math.max(day, 1), 31);

    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  return undefined;
}

function safeISOOrToday(x: any) {
  return normalizeDateToISO(x) ?? format(new Date(), "yyyy-MM-dd");
}

/* =========================
   Helpers for Import
========================= */
function normalizePhone(input: any) {
  const s = String(input ?? "").trim();
  const digits = s.replace(/\D/g, "");
  return digits || "";
}

function parseDurationWeeks(duration: any) {
  const s = String(duration ?? "")
    .toUpperCase()
    .trim();
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : undefined;
}

function parsePackToMealsSnacks(pack: any) {
  const s = String(pack ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
  const mealMatch = s.match(/(\d+)\s*MEAL/);
  const snackMatch = s.match(/(\d+)\s*SNACK/);
  const mealsPerDay = mealMatch ? Number(mealMatch[1]) : undefined;
  const snacksPerDay = snackMatch ? Number(snackMatch[1]) : undefined;
  const totalMealsPerDay =
    (mealsPerDay ?? 0) + (snacksPerDay ?? 0) || undefined;
  return { mealsPerDay, snacksPerDay, totalMealsPerDay };
}

/** مدة الباقة على الموقع → عدد الأسابيع */
const PLAN_DURATION_WEEKS: Record<string, number> = {
  week: 1,
  two_weeks: 2,
  month: 4,
};

const PLAN_DURATION_LABEL: Record<string, { ar: string; en: string }> = {
  week: { ar: "أسبوع", en: "1 week" },
  two_weeks: { ar: "أسبوعان", en: "2 weeks" },
  month: { ar: "شهر", en: "1 month" },
};

/** يشتق الهدف/البرنامج من الباقة (slug/الاسم): diet→DIET، fitness→FITNESS، bulk→BULK */
function planGoal(plan: any): string | undefined {
  const s = `${plan?.slug ?? ""} ${plan?.nameEn ?? ""} ${plan?.nameAr ?? ""}`.toLowerCase();
  if (s.includes("diet") || s.includes("تنحيف")) return "DIET";
  if (s.includes("fitness") || s.includes("لياقة")) return "FITNESS";
  if (s.includes("bulk") || s.includes("تضخيم")) return "BULK";
  return undefined;
}

/** عدد أسابيع الاشتراك من تاريخَي البداية والنهاية (يُقرّب لأقرب أسبوع، وأدناه 1) */
function weeksBetween(startISO?: string, endISO?: string): number | undefined {
  if (!startISO || !endISO) return undefined;
  const a = new Date(startISO + "T00:00:00Z").getTime();
  const b = new Date(endISO + "T00:00:00Z").getTime();
  if (isNaN(a) || isNaN(b) || b < a) return undefined;
  const days = Math.round((b - a) / 86400000) + 1; // شامل يوم النهاية
  return Math.max(1, Math.round(days / 7));
}

/** تاريخ نهاية الاشتراك = بعد **عدد أيام التوصيل** (6 لكل أسبوع) من البداية، شاملاً
 *  الطرفين، مهما كان يوم البداية. لا نفترض أن البداية سبت: نعدّ أيام التوصيل الفعلية
 *  (كل الأيام عدا الجمعة) فيكون كل أسبوع = 6 أيام عمل بالضبط (السبت→الخميس، الجمعة إجازة).
 *  الناتج دائماً يقع على يوم توصيل (لا على جمعة). */
function addWeeksISO(startISO: string, weeks: number): string {
  const target = Math.max(1, Math.round(weeks)) * 6; // أيام توصيل مطلوبة
  const d = new Date(startISO + "T00:00:00Z");
  let count = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (d.getUTCDay() !== 5) { count++; if (count >= target) break; } // الجمعة (5) لا تُعدّ
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function parseNumberish(x: any) {
  if (x === null || x === undefined) return undefined;
  const s = String(x).trim();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

function csvToObjects(csvText: string) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const obj: any = {};
    headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
    return obj;
  });
}

/** ✅ NEW: parse delivery time safely from import rows */
function parseDeliveryTime(input: any): "MORNING" | "EVENING" | undefined {
  if (!input) return undefined;
  const s = String(input).trim().toUpperCase();

  // English
  if (s === "MORNING" || s === "AM" || s.includes("MORN")) return "MORNING";
  if (s === "EVENING" || s === "PM" || s.includes("EVEN")) return "EVENING";

  // Arabic
  if (s.includes("صباح")) return "MORNING";
  if (s.includes("مساء") || s.includes("مسا")) return "EVENING";

  return undefined;
}

/* =========================
   Form Schema
========================= */
const customerSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  phone: z.string().min(8, "Phone is required"),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  deliveryTime: z.enum(["MORNING", "EVENING"]),
  startDate: z.string(),
  endDate: z.string(),

  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  goals: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),

  // ✅ التفضيلات والممنوعات والكميات
  avoid: z.string().optional(),
  preferences: z.string().optional(),
  portions: z.string().optional(),
  // ✅ تخصيص كميات/سعرات الوجبة الرئيسية (اختياري — لمن حُدِّد له فقط)
  carbGrams: z.coerce.number().optional(),
  proteinGrams: z.coerce.number().optional(),
  mainMealCalories: z.coerce.number().optional(),
  mealCalorieOverrides: z.array(z.object({ meal: z.string(), calories: z.coerce.number() })).optional(),

  packageLabel: z.string().optional(),
  durationWeeks: z.coerce.number().optional(),
  mealsPerDay: z.coerce.number().optional(),
  snacksPerDay: z.coerce.number().optional(),
  totalMealsPerDay: z.coerce.number().optional(),
  paymentMethod: z.string().optional(),
  price: z.coerce.number().optional(),
  discount: z.coerce.number().optional(),
  finalPrice: z.coerce.number().optional(),
  birthdayDate: z.string().optional(),
  status: z.string().optional(),

  isActive: z.boolean().default(true),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function Customers() {
  const { data: customers = [] } = useCustomers();
  const [pauseTarget, setPauseTarget] = useState<any | null>(null);
  const [pauseSection, setPauseSection] = useState<"pause" | "skip">("pause");
  const [printTarget, setPrintTarget] = useState<any | null>(null);

  // ✅ باقات الموقع النشطة فقط — المعطّلة (باقات قديمة) لا تظهر في اختيار المشترك.
  const sitePlans = ((useQuery(api.publicPlans.list, {}) as any[] | undefined) ?? []).filter((p: any) => p.isActive !== false);
  const [planId, setPlanId] = useState<string>("");
  const [optionIdx, setOptionIdx] = useState<string>("");
  const createCustomer = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const forceDeleteCustomer = useForceDeleteCustomer();

  const importCustomers = useImportCustomers();
  const { data: modifiers = [] } = useModifiers();

  const [searchTerm, setSearchTerm] = useState("");
  /** فلتر بطاقات الهيدر: الكل / النشطين / المجمّدين */
  const [viewFilter, setViewFilter] = useState<"all" | "active" | "paused">("all");
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // ✅ Multi-select states
  const [selectedAvoid, setSelectedAvoid] = useState<string[]>([]);
  const [selectedPref, setSelectedPref] = useState<string[]>([]);
  const [selectedPortions, setSelectedPortions] = useState<string[]>([]);

  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importStats, setImportStats] = useState<any | null>(null);
  const [importRunning, setImportRunning] = useState(false);

  const { t, language, dir } = useLanguage();
  const isRtl = language === "ar" || dir === "rtl";
  const dateLocale = language === "ar" ? ar : enUS;

  // ✅ تجميع modifiers حسب النوع
  const avoidOptions = useMemo(
    () => (modifiers as Modifier[]).filter((m) => m.group === "AVOID" && m.isActive),
    [modifiers]
  );
  const prefOptions = useMemo(
    () => (modifiers as Modifier[]).filter((m) => m.group === "PREF" && m.isActive),
    [modifiers]
  );
  const portionOptions = useMemo(
    () => (modifiers as Modifier[]).filter((m) => m.group === "PORTION" && m.isActive),
    [modifiers]
  );

  const geocode = useAction(api.geo.geocodeAddress);
  const resolveLink = useAction(api.geo.resolveLocationLink);
  const [geocoding, setGeocoding] = useState(false);
  const [locLink, setLocLink] = useState("");
  const [resolvingLink, setResolvingLink] = useState(false);
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      gender: "MALE",
      deliveryTime: "MORNING",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(
        new Date(new Date().setMonth(new Date().getMonth() + 1)),
        "yyyy-MM-dd",
      ),
      isActive: true,
      address: "",
      goals: "",
      allergies: "",
      notes: "",

      packageLabel: "",
      durationWeeks: undefined,
      mealsPerDay: undefined,
      snacksPerDay: undefined,
      totalMealsPerDay: undefined,
      paymentMethod: "",
      price: undefined,
      discount: undefined,
      finalPrice: undefined,
      birthdayDate: "",
      status: "",
      mealCalorieOverrides: [],
    },
  });

  // ✅ تجاوزات سعرات الوجبات (لكل وجبة بذاتها) — قائمة ديناميكية
  const mealOvrArray = useFieldArray({ control: form.control, name: "mealCalorieOverrides" });
  // أسماء الوجبات للاقتراح (datalist)
  const mealsForPicker = (useQuery(api.publicMeals.list, {}) as any[] | undefined) ?? [];
  const mealNames = useMemo(() => {
    const set = new Set<string>();
    for (const m of mealsForPicker) { if (m?.nameAr) set.add(String(m.nameAr)); if (m?.nameEn) set.add(String(m.nameEn)); }
    return [...set].sort();
  }, [mealsForPicker]);

  // ✅ حساب عدد كل برنامج
  // ✅ المشتركون المجمّدون (سفر) — pausedFrom موجود = مجمّد
  const pausedCustomers = useMemo(
    () => (customers as any[]).filter((c: any) => Boolean(c.pausedFrom)),
    [customers]
  );

  const programCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of customers as any[]) {
      const p = (c.program || "STANDARD").toUpperCase();
      counts[p] = (counts[p] || 0) + 1;
    }
    return counts;
  }, [customers]);

  // brand palette only: #3cc4f0 / #47759c / #0f1516 / #bcbebf
  const PROGRAMS = [
    { key: null,          label: isRtl ? "الكل" : "All",
      color: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300" },
    { key: "FITNESS",     label: "FITNESS",
      color: "bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border-cyan-300" },
    { key: "DIET",        label: "DIET",
      color: "bg-sky-100 text-[#47759c] hover:bg-sky-200 border-sky-300" },
    { key: "BULK",        label: "BULK",
      color: "bg-slate-200 text-[#0f1516] hover:bg-slate-300 border-slate-400" },
    { key: "CUSTOMIZED",  label: "CUSTOMIZED",
      color: "bg-blue-50 text-[#47759c] hover:bg-blue-100 border-blue-200" },
    { key: "STANDARD",    label: isRtl ? "قياسي" : "STANDARD",
      color: "bg-gray-100 text-gray-500 hover:bg-gray-200 border-gray-300" },
  ].filter(p => p.key === null || (programCounts[p.key as string] || 0) > 0);

  // ✅ Active first, then inactive (while preserving search + program filter)
  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    let base = customers as any[];

    // فلتر بطاقات الهيدر
    if (viewFilter === "paused") {
      base = base.filter((c: any) => Boolean(c.pausedFrom));
    } else if (viewFilter === "active") {
      base = base.filter((c: any) => c.isActive);
    }

    // فلتر البرنامج
    if (selectedProgram) {
      base = base.filter((c: any) =>
        (c.program || "STANDARD").toUpperCase() === selectedProgram
      );
    }

    // فلتر البحث
    if (q) {
      base = base.filter((c: any) =>
        String(c.fullName || "").toLowerCase().includes(q) ||
        String(c.phone || "").includes(q)
      );
    }

    return base.slice().sort((a: any, b: any) => {
      // المجمّدون أولاً — يحتاجون متابعة (متى يرجع؟)
      const ap = a.pausedFrom ? 1 : 0;
      const bp = b.pausedFrom ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const aa = a.isActive ? 1 : 0;
      const bb = b.isActive ? 1 : 0;
      if (aa !== bb) return bb - aa;
      const an = String(a.fullName || "").toLowerCase();
      const bn = String(b.fullName || "").toLowerCase();
      return an.localeCompare(bn);
    });
  }, [customers, searchTerm, selectedProgram, viewFilter]);

  const selectedPlan = sitePlans.find((p: any) => String(p._id) === planId);
  const planOptions: any[] = selectedPlan?.options ?? [];

  /**
   * اختيار خيار من باقة الموقع يملأ الحقول تلقائياً:
   * الوجبات/السناكات/الإجمالي/السعر/اسم الباقة + تاريخ النهاية حسب مدة الباقة.
   * الموظّف يقدر يعدّل السعر أو التاريخ بعدها لو حبّ.
   */
  const applyPlanOption = (plan: any, idx: number) => {
    const opt = plan?.options?.[idx];
    if (!plan || !opt) return;

    const meals = Number(opt.mealsCount ?? 0);
    const snacks = Number(opt.snacksCount ?? 0);
    const weeks = PLAN_DURATION_WEEKS[plan.duration] ?? 4;

    form.setValue("packageLabel", `${plan.nameEn ?? plan.nameAr} — ${meals} MEALS/${snacks} SNACKS`, { shouldDirty: true });
    form.setValue("mealsPerDay", meals, { shouldDirty: true });
    form.setValue("snacksPerDay", snacks, { shouldDirty: true });
    form.setValue("totalMealsPerDay", meals + snacks, { shouldDirty: true });
    form.setValue("durationWeeks", weeks, { shouldDirty: true });
    if (opt.priceQAR != null) form.setValue("price", Number(opt.priceQAR), { shouldDirty: true });

    // تاريخ النهاية = البداية + مدة الباقة
    const start = form.getValues("startDate");
    if (start) form.setValue("endDate", addWeeksISO(start, weeks), { shouldDirty: true });
  };

  // مدة الاشتراك تُقرأ من التاريخين — لا تُكتب يدوياً
  const watchedStart = form.watch("startDate");
  const watchedEnd = form.watch("endDate");
  const computedWeeks = weeksBetween(watchedStart, watchedEnd);

  // ✅ الأسبوع الذي يصادفه تاريخ بداية الاشتراك في دورة المطبخ (للأخصائية).
  const startRotation = useQuery(
    api.restaurantSettings.rotationWeekAt,
    watchedStart && /^\d{4}-\d{2}-\d{2}$/.test(watchedStart) ? { targetDate: watchedStart } : "skip"
  ) as { rotationWeek: number; currentCookingWeek: number; fridaysAhead: number } | undefined;

  useEffect(() => {
    if (computedWeeks) form.setValue("durationWeeks", computedWeeks);
  }, [computedWeeks]);

  const resetForm = () => {
    setEditingCustomer(null);
    setPlanId("");
    setOptionIdx("");
    setSelectedAvoid([]);
    setSelectedPref([]);
    setSelectedPortions([]);
    form.reset({
      fullName: "",
      phone: "",
      gender: "MALE",
      deliveryTime: "MORNING",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(
        new Date(new Date().setMonth(new Date().getMonth() + 1)),
        "yyyy-MM-dd",
      ),
      isActive: true,
      address: "",
      goals: "",
      allergies: "",
      notes: "",

      packageLabel: "",
      durationWeeks: undefined,
      mealsPerDay: undefined,
      snacksPerDay: undefined,
      totalMealsPerDay: undefined,
      paymentMethod: "",
      price: undefined,
      discount: undefined,
      finalPrice: undefined,
      birthdayDate: "",
      status: "",
    });
  };

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      const computedTotal = (data.mealsPerDay ?? 0) + (data.snacksPerDay ?? 0);

      const payload: any = {
        ...data,
        startDate: safeISOOrToday(data.startDate),
        endDate: safeISOOrToday(data.endDate),
        birthdayDate: normalizeDateToISO(data.birthdayDate) || undefined,
        totalMealsPerDay:
          computedTotal > 0 ? computedTotal : data.totalMealsPerDay,
        // ✅ تحويل arrays إلى strings مفصولة بفواصل
        avoid: selectedAvoid.join(", "),
        preferences: selectedPref.join(", "),
        portions: selectedPortions.join(", "),
        // ✅ تجاوزات سعرات الوجبات — نُبقي فقط الصفوف المكتملة (اسم + رقم > 0)
        mealCalorieOverrides: (data.mealCalorieOverrides ?? [])
          .map((o) => ({ meal: String(o.meal || "").trim(), calories: Number(o.calories) || 0 }))
          .filter((o) => o.meal && o.calories > 0),
      };

      if (payload.price !== undefined && payload.price !== null) {
        const disc = payload.discount ?? 0;
        payload.finalPrice = payload.price * (1 - disc);
      }

      if (!payload.goals && (editingCustomer as any)?.program) {
        payload.goals = (editingCustomer as any).program;
      }

      if (editingCustomer) {
        await updateCustomerMutation.mutateAsync({
          id: (editingCustomer as any)._id,
          data: payload,
        });
      } else {
        await createCustomer.mutateAsync(payload as any);
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to save customer:", error);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);

    // ✅ حاول مطابقة باقة الموقع الحالية (بعدد الوجبات/السناكات + مدة الاشتراك)
    //    حتى تفتح القائمة على اختياره بدل أن تظهر فارغة.
    const meals = Number(customer.mealsPerDay ?? 0);
    const snacks = Number(customer.snacksPerDay ?? 0);
    const weeks = weeksBetween(customer.startDate, customer.endDate) ?? customer.durationWeeks;
    const findMatch = (requireSameDuration: boolean) => {
      for (const p of sitePlans) {
        if (requireSameDuration && weeks && PLAN_DURATION_WEEKS[p.duration] !== weeks) continue;
        const i = (p.options ?? []).findIndex(
          (o: any) => Number(o.mealsCount) === meals && Number(o.snacksCount) === snacks,
        );
        if (i >= 0) return [String(p._id), String(i)] as const;
      }
      return null;
    };
    // ✅ المشترك المخصّص → افتح على «الباقة المخصّصة» مباشرة (لا نطابقه ببطاقة عادية بعدد وجباته)
    const isCustomer = String(customer.program || customer.goals || "").toUpperCase().includes("CUSTOM")
      || String(customer.packageLabel || "").includes("الباقة المخصّصة");
    if (isCustomer) {
      const customPlan = sitePlans.find((p: any) => !p.options || p.options.length === 0);
      setPlanId(customPlan ? String(customPlan._id) : "");
      setOptionIdx("");
    } else {
      // اشتراك مدته 5 أسابيع مثلاً لا يطابق أي باقة بالضبط — نرجع للمطابقة بالوجبات وحدها
      const match = (meals || snacks) ? (findMatch(true) ?? findMatch(false)) : null;
      setPlanId(match?.[0] ?? "");
      setOptionIdx(match?.[1] ?? "");
    }


    // ✅ تحميل القيم من strings إلى arrays
    const avoidArr = customer.avoid
      ? customer.avoid.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    const prefArr = customer.preferences
      ? customer.preferences.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    const portArr = customer.portions
      ? customer.portions.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    
    setSelectedAvoid(avoidArr);
    setSelectedPref(prefArr);
    setSelectedPortions(portArr);
    
    form.reset({
      fullName: customer.fullName,
      phone: customer.phone,
      gender: customer.gender ?? "MALE",
      deliveryTime: customer.deliveryTime,
      startDate: safeISOOrToday(customer.startDate),
      endDate: safeISOOrToday(customer.endDate),
      isActive: customer.isActive,

      address: customer.address || "",
      lat: customer.lat ?? undefined,
      lng: customer.lng ?? undefined,
      goals: customer.goals || customer.program || "",
      allergies: customer.allergies || "",
      notes: customer.notes || "",

      carbGrams: customer.carbGrams ?? undefined,
      proteinGrams: customer.proteinGrams ?? undefined,
      mainMealCalories: customer.mainMealCalories ?? undefined,
      mealCalorieOverrides: customer.mealCalorieOverrides ?? [],

      packageLabel: customer.packageLabel || "",
      durationWeeks: customer.durationWeeks,
      mealsPerDay: customer.mealsPerDay,
      snacksPerDay: customer.snacksPerDay,
      totalMealsPerDay: customer.totalMealsPerDay,
      paymentMethod: customer.paymentMethod || "",
      price: customer.price,
      discount: customer.discount,
      finalPrice: customer.finalPrice,
      birthdayDate: customer.birthdayDate || "",
      status: customer.status || "",
    } as any);
    setIsDialogOpen(true);
  };

  /* =========================
     IMPORT: mapping rows
  ========================= */
  const mapRowToImport = (row: any) => {
    const fullName = String(row.fullName ?? row.names ?? "").trim();
    const phone = normalizePhone(row.phone ?? row.numbers ?? "");
    if (!fullName || !phone) return null;

    const pack = String(row.packageLabel ?? row.pack ?? "").trim();

    const goals =
      String(
        row.goals ?? row.goal ?? row.program ?? row.calories ?? "",
      ).trim() || undefined;

    const allergies =
      String(row.allergies ?? row.allergy ?? row.sensitivity ?? "").trim() ||
      undefined;

    const durationWeeks =
      parseNumberish(row.durationWeeks) ?? parseDurationWeeks(row.duration);

    const { mealsPerDay, snacksPerDay, totalMealsPerDay } =
      parsePackToMealsSnacks(pack);

    const price = parseNumberish(row.price ?? row.Price);
    const discount = parseNumberish(row.discount ?? row.Discount);
    const finalPrice =
      price !== undefined
        ? price * (1 - (discount ?? 0))
        : parseNumberish(row.finalPrice ?? row["finalPrice"]);

    const startDate = normalizeDateToISO(row.startDate ?? row["Start Date"]);
    const endDate = normalizeDateToISO(row.endDate ?? row["End Date"]);

    const paymentMethod =
      String(row.paymentMethod ?? row["Payment Method"] ?? "").trim() ||
      undefined;
    const remarks =
      String(row.remarks ?? row.REMARKS ?? row.notes ?? "").trim() || undefined;
    const birthdayDate =
      normalizeDateToISO(row.birthdayDate ?? row["BIRTHDAY DATE"]) || undefined;

    const state = String(row.state ?? row.status ?? "")
      .toUpperCase()
      .trim();
    const isActive =
      row.isActive === true ||
      String(row.isActive).toUpperCase() === "TRUE" ||
      state === "ACTIVE";

    /** ✅ NEW: read deliveryTime from row (fallback MORNING) */
    const deliveryTime =
      parseDeliveryTime(
        row.deliveryTime ??
          row["Arrival delivery time"] ??
          row["arrival delivery time"] ??
          row.delivery ??
          row["وقت التوصيل"],
      ) ?? "MORNING";

    return {
      fullName,
      phone,
      deliveryTime,

      startDate: startDate ?? format(new Date(), "yyyy-MM-dd"),
      endDate:
        endDate ??
        format(
          new Date(new Date().setMonth(new Date().getMonth() + 1)),
          "yyyy-MM-dd",
        ),

      goals,
      allergies,

      packageLabel: pack || undefined,
      durationWeeks: durationWeeks ?? undefined,

      mealsPerDay: mealsPerDay ?? undefined,
      snacksPerDay: snacksPerDay ?? undefined,
      totalMealsPerDay: totalMealsPerDay ?? undefined,

      paymentMethod,
      price,
      discount,
      finalPrice,

      notes: remarks,
      birthdayDate,

      isActive,
      status: isActive ? "ACTIVE" : "NOT_ACTIVE",
    };
  };

  const handleFilePick = async (file: File) => {
    setImportStats(null);
    setImportPreview([]);
    setImportOpen(false);

    const text = await file.text();
    let rows: any[] = [];

    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        rows = JSON.parse(text);
      } else {
        rows = csvToObjects(text);
      }
    } catch {
      void alertDialog({ message: isRtl ? "الملف غير صالح" : "Invalid file" });
      return;
    }

    const mapped: any[] = [];
    for (const r of rows) {
      const x = mapRowToImport(r);
      if (x) mapped.push(x);
    }

    if (mapped.length === 0) {
      void alertDialog({
        message: isRtl ? "لا توجد بيانات صالحة للاستيراد" : "No valid rows to import",
      });
      return;
    }

    setImportPreview(mapped);
    setImportOpen(true);
  };

  const runImport = async () => {
    if (!importPreview.length || importRunning) return;
    const ok = await confirmDialog({
      title: isRtl ? "استيراد المشتركين" : "Import Customers",
      message: isRtl ? "تأكيد الاستيراد؟" : "Confirm import?",
      confirmText: isRtl ? "استيراد" : "Import",
    });
    if (!ok) return;

    setImportRunning(true);
    setImportStats(null);

    try {
      const res = await importCustomers.mutateAsync(importPreview);
      setImportStats(res);
      void alertDialog({ message: isRtl ? "تم الاستيراد ✅" : "Imported ✅" });
    } catch (e) {
      console.error(e);
      void alertDialog({ message: isRtl ? "فشل الاستيراد" : "Import failed" });
    } finally {
      setImportRunning(false);
    }
  };

  const downloadTemplateCSV = () => {
    const headers = [
      "fullName",
      "phone",
      "deliveryTime", // ✅ NEW (اختياري، لو مش عايزه احذفه)
      "goals",
      "allergies",
      "pack",
      "durationWeeks",
      "startDate",
      "endDate",
      "paymentMethod",
      "price",
      "discount",
      "remarks",
      "birthdayDate",
      "isActive",
    ];
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 sm:space-y-6">
      {/* ✅ H1 دلالي مخفي بصرياً — لبنية الصفحة وقارئات الشاشة */}
      <h1 className="sr-only">{isRtl ? "المشتركين" : "Subscribers"}</h1>
      {/* Header — unified brand hero */}
      <DashboardHeader
        icon={<Users className="h-6 w-6 sm:h-7 sm:w-7" />}
        titleAr="المشتركين" titleEn="Subscribers"
        subtitleAr="إدارة العملاء والاشتراكات" subtitleEn="Manage customers & subscriptions"
        kpis={[
          {
            value: (customers as any[]).length,
            labelAr: "إجمالي المشتركين", labelEn: "Total Subscribers",
            active: viewFilter === "all",
            onClick: () => setViewFilter("all"),
          },
          {
            value: (customers as any[]).filter((c: any) => c.isActive).length,
            labelAr: "نشط", labelEn: "Active",
            active: viewFilter === "active",
            // ضغطة ثانية على بطاقة مفعّلة تُرجِع "الكل"
            onClick: () => setViewFilter((v) => (v === "active" ? "all" : "active")),
          },
          {
            value: pausedCustomers.length,
            labelAr: "مجمّد (سفر)", labelEn: "Paused",
            color: pausedCustomers.length > 0 ? "#fcd34d" : undefined,
            active: viewFilter === "paused",
            onClick: () => setViewFilter((v) => (v === "paused" ? "all" : "paused")),
          },
        ]}
        actions={
          <Button
            className="h-11 rounded-xl font-bold text-[#0E2A4A] bg-white hover:bg-white/90 shadow-lg text-sm"
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
          >
            <Plus className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
            {isRtl ? "إضافة مشترك" : "Add Customer"}
          </Button>
        }
      />

      {/* Search and Filter Row */}
      <div className="flex flex-col gap-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400", isRtl ? "right-4" : "left-4")} />
          <Input
            type="text"
            placeholder={isRtl ? "البحث بالاسم أو الهاتف..." : "Search by name or phone..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn("h-11 sm:h-12 rounded-xl shadow-sm border-gray-200 bg-white text-sm", isRtl ? "pr-12 text-right" : "pl-12")}
          />
        </div>

        {/* Program Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {PROGRAMS.map((p) => {
            const isActive = selectedProgram === p.key;
            const count = p.key === null
              ? (customers as any[]).length
              : (programCounts[p.key as string] || 0);
            return (
              <button
                key={String(p.key)}
                onClick={() => setSelectedProgram(p.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                  p.color,
                  isActive && "ring-2 ring-offset-1 ring-current shadow-sm scale-105"
                )}
              >
                {p.label}
                <span className={cn(
                  "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
                  isActive ? "bg-white/60" : "bg-white/80"
                )}>
                  {count}
                </span>
              </button>
            );
          })}

        </div>

        {/* شريط الفلتر المفعّل — يوضّح لماذا القائمة أقصر من المتوقّع */}
        {viewFilter !== "all" && (
          <div className="flex items-center gap-2 text-xs">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold border",
              viewFilter === "paused"
                ? "bg-amber-50 text-amber-700 border-amber-300"
                : "bg-cyan-50 text-cyan-700 border-cyan-300"
            )}>
              {viewFilter === "paused" && <PauseCircle className="h-3.5 w-3.5" />}
              {viewFilter === "paused"
                ? (isRtl ? "المجمّدون فقط" : "Paused only")
                : (isRtl ? "النشطون فقط" : "Active only")}
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-white/80">
                {filteredCustomers.length}
              </span>
            </span>
            <button
              onClick={() => setViewFilter("all")}
              className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 font-semibold"
            >
              <X className="h-3.5 w-3.5" />
              {isRtl ? "إلغاء الفلتر" : "Clear filter"}
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-xl text-xs sm:text-sm h-9 sm:h-10" onClick={downloadTemplateCSV}>
          <Download className={cn("h-3 w-3 sm:h-4 sm:w-4", isRtl ? "ml-1.5 sm:ml-2" : "mr-1.5 sm:mr-2")} />
          <span className="hidden sm:inline">{isRtl ? "تحميل CSV" : "CSV Template"}</span>
          <span className="sm:hidden">CSV</span>
        </Button>

        <label className="inline-flex">
          <input
            type="file"
            accept=".json,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFilePick(f);
              e.currentTarget.value = "";
            }}
          />
          <Button variant="outline" size="sm" className="rounded-xl text-xs sm:text-sm h-9 sm:h-10" asChild>
            <span>
              <Upload className={cn("h-3 w-3 sm:h-4 sm:w-4", isRtl ? "ml-1.5 sm:ml-2" : "mr-1.5 sm:mr-2")} />
              <span className="hidden sm:inline">{isRtl ? "استيراد" : "Import"}</span>
              <span className="sm:hidden">{isRtl ? "استيراد" : "Import"}</span>
            </span>
          </Button>
        </label>
      </div>

      {/* Add/Edit Customer Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogTrigger asChild>
          <div className="hidden" />
        </DialogTrigger>

          <DialogContent
            dir={isRtl ? "rtl" : "ltr"}
            className={cn(
              "max-w-3xl max-h-[90vh] overflow-y-auto",
              isRtl ? "text-right" : "text-left",
            )}
          >
            <DialogHeader>
              <DialogTitle className={cn(isRtl ? "text-right" : "text-left")}>
                {editingCustomer
                  ? t("customers.edit_title")
                  : t("customers.add_title")}
              </DialogTitle>
            </DialogHeader>

              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className={cn(
                  "space-y-6 py-4",
                  isRtl ? "text-right" : "text-left",
                )}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("customers.fullname")}</Label>
                    <Input {...form.register("fullName")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("customers.phone")}</Label>
                    <Input {...form.register("phone")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">{t("customers.gender")}</Label>
                    <Controller
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? "MALE"}
                          dir={isRtl ? "rtl" : "ltr"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("common.male")} />
                          </SelectTrigger>
                          <SelectContent dir={isRtl ? "rtl" : "ltr"}>
                            <SelectItem value="MALE">
                              {t("common.male")}
                            </SelectItem>
                            <SelectItem value="FEMALE">
                              {t("common.female")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryTime">
                      {t("customers.delivery_time")}
                    </Label>
                    <Controller
                      control={form.control}
                      name="deliveryTime"
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          dir={isRtl ? "rtl" : "ltr"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("common.morning")} />
                          </SelectTrigger>
                          <SelectContent dir={isRtl ? "rtl" : "ltr"}>
                            <SelectItem value="MORNING">
                              {t("common.morning")}
                            </SelectItem>
                            <SelectItem value="EVENING">
                              {t("common.evening")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">
                      {t("customers.start_date")}
                    </Label>
                    {(() => {
                      const reg = form.register("startDate");
                      return (
                        <Input type="date" {...reg}
                          onChange={(e) => {
                            reg.onChange(e);
                            // ✅ لو الباقة مختارة، تغيير البداية يعيد حساب النهاية بنفس المدة
                            //    (لا تبقى ثابتة). التعديل من onChange فقط فلا يلمس فتح التعديل.
                            const start = e.target.value;
                            const weeks = Number(form.getValues("durationWeeks"));
                            if (planId && weeks > 0 && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
                              form.setValue("endDate", addWeeksISO(start, weeks), { shouldDirty: true });
                            }
                          }}
                        />
                      );
                    })()}
                    {startRotation && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 flex items-center gap-1">
                        🗓️ {isRtl
                          ? `هذا التاريخ يصادف الأسبوع ${startRotation.rotationWeek} من دورة المطبخ`
                          : `Falls on cooking-cycle week ${startRotation.rotationWeek}`}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">{t("customers.end_date")}</Label>
                    <Input type="date" {...form.register("endDate")} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRtl ? "الأهداف" : "Goals"}</Label>
                    <Input
                      {...form.register("goals")}
                      placeholder="DIET / FITNESS / BULK ..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{isRtl ? "الحساسية" : "Allergies"}</Label>
                    <Input
                      {...form.register("allergies")}
                      placeholder={
                        isRtl
                          ? "مثال: لاكتوز / مكسرات..."
                          : "e.g. lactose / nuts..."
                      }
                    />
                  </div>
                </div>

                {/* ✅ التفضيلات والممنوعات والكميات - Multi Select */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* AVOID */}
                  <div className="space-y-2">
                    <Label className="text-red-600 font-bold flex items-center gap-2">
                      🚫 {isRtl ? "الممنوعات" : "Avoid"}
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between text-sm h-auto min-h-10",
                            selectedAvoid.length === 0 && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                            {selectedAvoid.length > 0
                              ? selectedAvoid.join(", ")
                              : (isRtl ? "اختر الممنوعات" : "Select items to avoid")}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-3" align="start">
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {avoidOptions.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-2">
                              {isRtl ? "لا توجد خيارات متاحة" : "No options available"}
                            </p>
                          ) : (
                            avoidOptions.map((opt) => (
                              <div key={opt._id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`avoid-${opt._id}`}
                                  checked={selectedAvoid.includes(opt.name)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedAvoid([...selectedAvoid, opt.name]);
                                    } else {
                                      setSelectedAvoid(selectedAvoid.filter((x) => x !== opt.name));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`avoid-${opt._id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {opt.name}
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                        {selectedAvoid.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 text-xs"
                            onClick={() => setSelectedAvoid([])}
                          >
                            <X className="h-3 w-3 mr-1" />
                            {isRtl ? "إلغاء الكل" : "Clear all"}
                          </Button>
                        )}
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-gray-500">
                      {isRtl 
                        ? "يظهر في المطبخ تلقائياً لكل وجبة"
                        : "Appears in Kitchen for every meal"}
                    </p>
                  </div>

                  {/* PREFERENCES */}
                  <div className="space-y-2">
                    <Label className="text-blue-600 font-bold flex items-center gap-2">
                      ⭐ {isRtl ? "التفضيلات" : "Preferences"}
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between text-sm h-auto min-h-10",
                            selectedPref.length === 0 && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                            {selectedPref.length > 0
                              ? selectedPref.join(", ")
                              : (isRtl ? "اختر التفضيلات" : "Select preferences")}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-3" align="start">
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {prefOptions.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-2">
                              {isRtl ? "لا توجد خيارات متاحة" : "No options available"}
                            </p>
                          ) : (
                            prefOptions.map((opt) => (
                              <div key={opt._id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`pref-${opt._id}`}
                                  checked={selectedPref.includes(opt.name)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedPref([...selectedPref, opt.name]);
                                    } else {
                                      setSelectedPref(selectedPref.filter((x) => x !== opt.name));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`pref-${opt._id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {opt.name}
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                        {selectedPref.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 text-xs"
                            onClick={() => setSelectedPref([])}
                          >
                            <X className="h-3 w-3 mr-1" />
                            {isRtl ? "إلغاء الكل" : "Clear all"}
                          </Button>
                        )}
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-gray-500">
                      {isRtl 
                        ? "طريقة التحضير المفضلة"
                        : "Preferred preparation style"}
                    </p>
                  </div>

                  {/* PORTIONS */}
                  <div className="space-y-2">
                    <Label className="text-green-600 font-bold flex items-center gap-2">
                      📏 {isRtl ? "الكميات" : "Portions"}
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between text-sm h-auto min-h-10",
                            selectedPortions.length === 0 && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                            {selectedPortions.length > 0
                              ? selectedPortions.join(", ")
                              : (isRtl ? "اختر الكميات" : "Select portions")}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-3" align="start">
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {portionOptions.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-2">
                              {isRtl ? "لا توجد خيارات متاحة" : "No options available"}
                            </p>
                          ) : (
                            portionOptions.map((opt) => (
                              <div key={opt._id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`portion-${opt._id}`}
                                  checked={selectedPortions.includes(opt.name)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedPortions([...selectedPortions, opt.name]);
                                    } else {
                                      setSelectedPortions(selectedPortions.filter((x) => x !== opt.name));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`portion-${opt._id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {opt.name}
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                        {selectedPortions.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 text-xs"
                            onClick={() => setSelectedPortions([])}
                          >
                            <X className="h-3 w-3 mr-1" />
                            {isRtl ? "إلغاء الكل" : "Clear all"}
                          </Button>
                        )}
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-gray-500">
                      {isRtl
                        ? "تعديل الكميات حسب الحاجة"
                        : "Adjust portions as needed"}
                    </p>
                  </div>
                </div>

                {/* ===== تخصيص الوجبة الرئيسية (اختياري) — لمن حُدِّد له فقط ===== */}
                <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 space-y-3">
                  <Label className="text-amber-700 font-bold flex items-center gap-2">
                    ⚖️ {isRtl ? "تخصيص الوجبة الرئيسية (اختياري)" : "Main-meal customization (optional)"}
                  </Label>
                  <p className="text-xs text-amber-700/80">
                    {isRtl
                      ? "إذا احتاج المشترك إلى كمية أو سعرات مختلفة للوجبة الرئيسية، فأدخل القيم هنا. وعند ترك الحقول فارغة، تُستخدم القيم الافتراضية لباقته."
                      : "If this subscriber wants different main-meal grams/calories, fill these. Empty = program default."}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">{isRtl ? "كارب (جم)" : "Carb (g)"}</Label>
                      <Input type="number" min="0" step="1" placeholder={isRtl ? "افتراضي" : "default"} {...form.register("carbGrams")} dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">{isRtl ? "بروتين (جم)" : "Protein (g)"}</Label>
                      <Input type="number" min="0" step="1" placeholder={isRtl ? "افتراضي" : "default"} {...form.register("proteinGrams")} dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">{isRtl ? "سعرات الوجبة" : "Calories"}</Label>
                      <Input type="number" min="0" step="1" placeholder={isRtl ? "افتراضي" : "default"} {...form.register("mainMealCalories")} dir="ltr" />
                    </div>
                  </div>

                  {/* سعرات مخصّصة لوجبات معيّنة بذاتها — أعلى أولوية على الستيكر */}
                  <div className="pt-3 border-t border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-amber-700">
                        🎯 {isRtl ? "سعرات وجبات معيّنة (تُطبع كما هي على الستيكر)" : "Per-meal calories (printed as-is)"}
                      </Label>
                      <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
                        onClick={() => mealOvrArray.append({ meal: "", calories: 0 } as any)}>
                        <Plus className="h-3 w-3" />{isRtl ? "وجبة" : "Meal"}
                      </Button>
                    </div>
                    <p className="text-[11px] text-amber-700/70">
                      {isRtl
                        ? "اختر وجبة وأدخل سعراتها. ستُطبع هذه القيمة لهذا المشترك وهذه الوجبة فقط، وستتجاوز الحسابات التلقائية."
                        : "Pick a meal and set its calories — printed exactly for this subscriber, this meal only."}
                    </p>
                    <datalist id="mealNamesList">
                      {mealNames.map((n) => <option key={n} value={n} />)}
                    </datalist>
                    {mealOvrArray.fields.length === 0 && (
                      <p className="text-[11px] text-gray-400">{isRtl ? "لا توجد وجبات مخصّصة" : "No per-meal overrides"}</p>
                    )}
                    {mealOvrArray.fields.map((field, i) => (
                      <div key={field.id} className="flex gap-2 items-center">
                        <Input list="mealNamesList" className="flex-1 h-8 text-sm"
                          placeholder={isRtl ? "اسم الوجبة" : "Meal name"}
                          {...form.register(`mealCalorieOverrides.${i}.meal` as const)} />
                        <Input type="number" min="0" step="1" className="w-24 h-8 text-sm" dir="ltr"
                          placeholder={isRtl ? "سعرات" : "cal"}
                          {...form.register(`mealCalorieOverrides.${i}.calories` as const)} />
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                          onClick={() => mealOvrArray.remove(i)}>
                          <Trash2 className="h-4 w-4 text-gray-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ===== الباقة: تُختار من باقات الموقع فتملأ باقي الحقول ===== */}
                <div className="rounded-xl border border-[#3cc4f0]/40 bg-[#f2fbff] p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isRtl ? "الباقة" : "Package"}</Label>
                      <Select
                        value={planId}
                        onValueChange={(v) => {
                          setPlanId(v);
                          setOptionIdx("");
                          const p = sitePlans.find((x: any) => String(x._id) === v);
                          // ✅ تاريخ النهاية يعتمد على مدة الباقة وحدها — نضبطه فور
                          //    اختيار الباقة (لا ننتظر اختيار عدد الوجبات). السعر
                          //    يُملأ مع اختيار عدد الوجبات لأنه يختلف حسب الخيار.
                          if (p) {
                            const weeks = PLAN_DURATION_WEEKS[p.duration] ?? 4;
                            const start = form.getValues("startDate");
                            if (start) form.setValue("endDate", addWeeksISO(start, weeks), { shouldDirty: true });
                            form.setValue("durationWeeks", weeks, { shouldDirty: true });
                            // ✅ الباقة المخصّصة (بلا خيارات): الهدف مخصّص والأرقام تُدخل يدويًا
                            const isCustomP = !p.options || p.options.length === 0;
                            if (isCustomP) {
                              form.setValue("goals", "CUSTOMIZED", { shouldDirty: true });
                              form.setValue("packageLabel", "الباقة المخصّصة", { shouldDirty: true });
                            } else {
                              // ✅ الهدف/البرنامج يُشتق من نوع الباقة (تنحيف/لياقة/تضخيم)
                              const goal = planGoal(p);
                              if (goal) form.setValue("goals", goal, { shouldDirty: true });
                            }
                          }
                          // لو الباقة لها خيار واحد، طبّقه فوراً (يملأ الوجبات والسعر أيضاً)
                          if (p?.options?.length === 1) {
                            setOptionIdx("0");
                            applyPlanOption(p, 0);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isRtl ? "اختر باقة من الموقع" : "Pick a site plan"} />
                        </SelectTrigger>
                        <SelectContent>
                          {sitePlans.map((p: any) => (
                            <SelectItem key={p._id} value={String(p._id)}>
                              {(isRtl ? p.nameAr : p.nameEn) || p.slug}
                              {" · "}
                              {isRtl
                                ? PLAN_DURATION_LABEL[p.duration]?.ar ?? p.duration
                                : PLAN_DURATION_LABEL[p.duration]?.en ?? p.duration}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{isRtl ? "الوجبات والسعر" : "Meals & price"}</Label>
                      {selectedPlan && planOptions.length === 0 ? (
                        /* ✅ باقة مخصّصة: قائمتان لاختيار عدد الوجبات والسناك — يحدّدهم النظام للخطط اليومية */
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={form.watch("mealsPerDay") != null ? String(form.watch("mealsPerDay")) : ""}
                            onValueChange={(v) => form.setValue("mealsPerDay", Number(v), { shouldDirty: true })}
                          >
                            <SelectTrigger><SelectValue placeholder={isRtl ? "عدد الوجبات" : "Meals"} /></SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6].map((n) => (
                                <SelectItem key={n} value={String(n)}>{isRtl ? `${n} وجبات` : `${n} meals`}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={form.watch("snacksPerDay") != null ? String(form.watch("snacksPerDay")) : ""}
                            onValueChange={(v) => form.setValue("snacksPerDay", Number(v), { shouldDirty: true })}
                          >
                            <SelectTrigger><SelectValue placeholder={isRtl ? "عدد السناك" : "Snacks"} /></SelectTrigger>
                            <SelectContent>
                              {[0, 1, 2, 3, 4].map((n) => (
                                <SelectItem key={n} value={String(n)}>{isRtl ? `${n} سناك` : `${n} snacks`}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <Select
                          value={optionIdx}
                          disabled={!selectedPlan}
                          onValueChange={(v) => {
                            setOptionIdx(v);
                            applyPlanOption(selectedPlan, Number(v));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                selectedPlan
                                  ? isRtl ? "اختر عدد الوجبات" : "Pick meals"
                                  : isRtl ? "اختر الباقة أولاً" : "Pick a plan first"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {planOptions.map((o: any, i: number) => (
                              <SelectItem key={i} value={String(i)}>
                                {isRtl
                                  ? `${o.mealsCount} وجبات + ${o.snacksCount} سناك — ${o.priceQAR} ر.ق`
                                  : `${o.mealsCount} meals + ${o.snacksCount} snacks — ${o.priceQAR} QAR`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* ✅ الوجبات والسناك قابلة للتعديل يدويًا (للمخصّص/أي عدد) — الباقة تملأها كبداية وتقدر تغيّرها */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-white border p-2 text-center">
                      <Input type="number" min="0" step="1"
                        {...form.register("mealsPerDay")}
                        className="text-xl font-black text-[#0E76AC] text-center h-9 border-0 p-0 focus-visible:ring-1" />
                      <div className="text-[10px] text-muted-foreground font-semibold">{isRtl ? "وجبات/يوم" : "Meals/day"}</div>
                    </div>
                    <div className="rounded-lg bg-white border p-2 text-center">
                      <Input type="number" min="0" step="1"
                        {...form.register("snacksPerDay")}
                        className="text-xl font-black text-[#0E76AC] text-center h-9 border-0 p-0 focus-visible:ring-1" />
                      <div className="text-[10px] text-muted-foreground font-semibold">{isRtl ? "سناك/يوم" : "Snacks/day"}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border p-2 text-center">
                      <div className="text-xl font-black text-[#0E76AC]">{(Number(form.watch("mealsPerDay")) || 0) + (Number(form.watch("snacksPerDay")) || 0) || "—"}</div>
                      <div className="text-[10px] text-muted-foreground font-semibold">{isRtl ? "الإجمالي/يوم" : "Total/day"}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border p-2 text-center">
                      <div className="text-xl font-black text-[#0E76AC]">{computedWeeks ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground font-semibold">{isRtl ? "المدة (أسابيع)" : "Weeks"}</div>
                    </div>
                  </div>

                  {/* ✅ محدّد المدة — للباقة المخصّصة فقط (هي الوحيدة مفتوحة المدة). باقي
                      الباقات مدتها ثابتة وتاريخ النهاية يُحسب تلقائيًا فور اختيار الباقة. */}
                  {selectedPlan && planOptions.length === 0 && (
                  <div className="space-y-2">
                    <Label>{isRtl ? "المدة (يحسب تاريخ النهاية تلقائيًا)" : "Duration (auto-sets end date)"}</Label>
                    <Select
                      value={(() => {
                        const w = Number(form.watch("durationWeeks")) || computedWeeks || 0;
                        return ({ 1: "week", 2: "two_weeks", 4: "month", 8: "two_months", 12: "three_months" } as any)[w] || "";
                      })()}
                      onValueChange={(v) => {
                        const weeks = ({ week: 1, two_weeks: 2, month: 4, two_months: 8, three_months: 12 } as any)[v] || 4;
                        form.setValue("durationWeeks", weeks, { shouldDirty: true });
                        const start = form.getValues("startDate");
                        if (start) form.setValue("endDate", addWeeksISO(start, weeks), { shouldDirty: true });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isRtl ? "اختر المدة" : "Pick duration"} />
                      </SelectTrigger>
                      <SelectContent>
                        {[["week", "أسبوع", "1 week"], ["two_weeks", "أسبوعان", "2 weeks"], ["month", "شهر", "1 month"], ["two_months", "شهران", "2 months"], ["three_months", "3 شهور", "3 months"]].map(([k, ar, en]) => (
                          <SelectItem key={k} value={k}>{isRtl ? ar : en}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    {isRtl
                      ? "يؤدي اختيار الباقة إلى تعبئة عدد الوجبات والوجبات الخفيفة والسعر تلقائيًا. وللاشتراك المخصّص، عدّل الأعداد والسعر يدويًا. اختر المدة أعلاه ليُحتسب تاريخ النهاية تلقائيًا؛ وتُطبّق القيود وفق الأعداد التي تدخلها."
                      : "Picking a plan auto-fills meals/snacks/price — for a customized subscriber, edit the numbers/price and pick a duration to auto-set the end date. Constraints follow the numbers you enter."}
                  </p>

                  {/* قيم مخفيّة تُرسل مع النموذج */}
                  <input type="hidden" {...form.register("packageLabel")} />
                  <input type="hidden" {...form.register("durationWeeks")} />
                  <input type="hidden" {...form.register("totalMealsPerDay")} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{isRtl ? "طريقة الدفع" : "Payment Method"}</Label>
                    <Input
                      {...form.register("paymentMethod")}
                      placeholder="CASH / BANK TRANSFER"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRtl ? "السعر" : "Price"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...form.register("price")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRtl ? "الخصم (0.15)" : "Discount (0.15)"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...form.register("discount")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRtl ? "ملاحظات" : "Notes"}</Label>
                    <Textarea {...form.register("notes")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRtl ? "العنوان" : "Address"}</Label>
                    <Textarea {...form.register("address")} />
                  </div>
                </div>

                {/* موقع التوصيل على الخريطة (تلقائي من العنوان أو تحديد يدوي) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label>{isRtl ? "موقع التوصيل على الخريطة" : "Delivery Location"}</Label>
                    <div className="flex items-center gap-2">
                      {(form.watch("lat") != null && form.watch("lng") != null) && (
                        <span className="text-[11px] font-mono text-gray-400" dir="ltr">
                          {Number(form.watch("lat")).toFixed(4)}, {Number(form.watch("lng")).toFixed(4)}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={geocoding}
                        onClick={async () => {
                          const addr = form.getValues("address");
                          if (!addr || !addr.trim()) {
                            void alertDialog({ message: isRtl ? "أدخل العنوان أولاً" : "Enter an address first" });
                            return;
                          }
                          setGeocoding(true);
                          try {
                            const res: any = await geocode({ address: addr });
                            if (res?.lat != null) {
                              form.setValue("lat", res.lat, { shouldDirty: true });
                              form.setValue("lng", res.lng, { shouldDirty: true });
                            } else {
                              void alertDialog({ message: isRtl ? "تعذّر تحديد الموقع — حدّده يدوياً على الخريطة" : "Couldn't locate — pin it manually" });
                            }
                          } finally { setGeocoding(false); }
                        }}
                        className="text-xs font-bold px-3 h-8 rounded-lg flex items-center gap-1.5 bg-[#3cc4f0]/10 text-[#0E76AC] hover:bg-[#3cc4f0]/20 disabled:opacity-60"
                      >
                        {geocoding ? (isRtl ? "جارٍ التحديد…" : "Locating…") : (isRtl ? "📍 تحديد من العنوان" : "📍 Locate from address")}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {isRtl ? "اضغط على الخريطة أو اسحب الدبوس لضبط الموقع بدقة." : "Click the map or drag the pin to set the exact location."}
                  </p>

                  {/* ✅ لصق رابط موقع (Google Maps) أو إحداثيات — الأدق للتوصيل */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={locLink}
                      onChange={(e) => setLocLink(e.target.value)}
                      placeholder={isRtl ? "الصق رابط الموقع من خرائط جوجل أو الإحداثيات" : "Paste Google Maps link or coordinates"}
                      dir="ltr"
                      className="h-9 text-xs"
                    />
                    <button
                      type="button"
                      disabled={resolvingLink || !locLink.trim()}
                      onClick={async () => {
                        setResolvingLink(true);
                        try {
                          const res: any = await resolveLink({ link: locLink.trim() });
                          if (res?.lat != null) {
                            form.setValue("lat", res.lat, { shouldDirty: true });
                            form.setValue("lng", res.lng, { shouldDirty: true });
                            setLocLink("");
                          } else {
                            void alertDialog({ message: isRtl ? "تعذّر قراءة الموقع من الرابط — افتحه وانسخ الرابط الكامل، أو حدّده على الخريطة" : "Couldn't read the link — open it and copy the full URL, or pin it on the map" });
                          }
                        } finally { setResolvingLink(false); }
                      }}
                      className="shrink-0 text-xs font-bold px-3 h-9 rounded-lg flex items-center gap-1.5 bg-[#0E76AC] text-white hover:bg-[#0b5f8a] disabled:opacity-60"
                    >
                      {resolvingLink ? (isRtl ? "جارٍ…" : "…") : (isRtl ? "🔗 من الرابط" : "🔗 From link")}
                    </button>
                  </div>

                  <LocationPicker
                    lat={form.watch("lat")}
                    lng={form.watch("lng")}
                    onChange={(la, ln) => { form.setValue("lat", la, { shouldDirty: true }); form.setValue("lng", ln, { shouldDirty: true }); }}
                    height={220}
                  />
                </div>

                <div
                  className={cn(
                    "flex items-center gap-2",
                    isRtl ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <Controller
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="isActive"
                      />
                    )}
                  />
                  <Label htmlFor="isActive">{t("customers.active")}</Label>
                </div>

                <DialogFooter
                  className={cn(
                    "gap-2",
                    isRtl
                      ? "flex-row-reverse sm:justify-start"
                      : "sm:justify-start",
                  )}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit">
                    {editingCustomer ? t("common.save") : t("common.add")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

      {importOpen && (
        <div className="rounded-md border border-border/50 bg-card/50 backdrop-blur p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">
              {isRtl ? "معاينة الاستيراد" : "Import Preview"} (
              {importPreview.length})
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                {isRtl ? "إغلاق" : "Close"}
              </Button>
              <Button onClick={runImport} disabled={importRunning}>
                {importRunning
                  ? isRtl
                    ? "جاري..."
                    : "Running..."
                  : isRtl
                    ? "تنفيذ الاستيراد"
                    : "Run Import"}
              </Button>
            </div>
          </div>

          {importStats ? (
            <div className="text-sm text-muted-foreground">
              {isRtl ? "النتيجة:" : "Result:"} Added: {importStats.added} |
              Updated: {importStats.updated} | Skipped: {importStats.skipped} |
              Total: {importStats.total}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {isRtl
                ? "سيتم تحديث الموجودين بنفس الهاتف + إضافة الجدد."
                : "Existing phones will be updated, new ones will be added."}
            </div>
          )}

          <div className="max-h-[260px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRtl ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{isRtl ? "الهاتف" : "Phone"}</TableHead>
                  <TableHead>{isRtl ? "الباقة" : "Pack"}</TableHead>
                  <TableHead>{isRtl ? "الأهداف" : "Goals"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importPreview.slice(0, 20).map((c, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{c.fullName}</TableCell>
                    <TableCell className="bidi">{c.phone}</TableCell>
                    <TableCell>{c.packageLabel || "-"}</TableCell>
                    <TableCell>{c.goals || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="text-xs text-muted-foreground">
            {isRtl ? "يعرض أول 20 فقط." : "Showing first 20 only."}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm sm:text-base">{t("customers.no_data")}</p>
          </div>
        ) : (
          filteredCustomers.map((customer: any) => (
            <CustomerCard
              key={customer._id}
              customer={customer}
              onEdit={handleEdit}
              onPause={(c) => { setPauseSection("pause"); setPauseTarget(c); }}
              onSkipDays={(c) => { setPauseSection("skip"); setPauseTarget(c); }}
              onPrintPlan={setPrintTarget}
              onDelete={async (id, name) => {
                const ok = await confirmDialog({
                  title: isRtl ? "تأكيد الحذف" : "Confirm Delete",
                  message: isRtl ? `حذف ${name}؟` : `Delete ${name}?`,
                  variant: "danger",
                  confirmText: isRtl ? "حذف" : "Delete",
                });
                if (!ok) return;
                // ✅ كان الحذف بلا معالجة خطأ: لو رفض السيرفر (مرتبط بطلبات/خطط/حساب)
                //    ما كانت تظهر أي رسالة، فلا يعرف المستخدم سبب عدم الحذف. الآن
                //    نعرض سبب الرفض (رسالة السيرفر) أو تأكيد النجاح.
                try {
                  await deleteCustomer.mutateAsync(id);
                  await alertDialog({
                    title: isRtl ? "تم الحذف" : "Deleted",
                    message: isRtl ? `تم حذف ${name}.` : `${name} has been deleted.`,
                  });
                } catch (e: any) {
                  // نص نظيف للعرض (بلا بادئات Convex التقنية)
                  const reason = getUserError(e, isRtl ? "ar" : "en");
                  // 🔒 لو الرفض بسبب ارتباط بيانات (لا مانع مالي/فني آخر) نعرض خيار
                  //    حذف قسري صريح: يمسح الطلبات/الخطط/الحساب معه. فواتير POS تمنعه.
                  const isLinkBlock = /لا يمكن الحذف — للعميل (خطط|طلبات|حساب)/.test(reason);
                  if (!isLinkBlock) {
                    await alertDialog({ title: isRtl ? "تعذّر الحذف" : "Couldn't delete", message: reason });
                    return;
                  }
                  const force = await confirmDialog({
                    title: isRtl ? "حذف نهائي؟" : "Permanent delete?",
                    message: isRtl
                      ? `${reason}\n\nهل تريد حذف ${name} نهائيًا مع كل طلباته وخططه وحسابه؟ (لا يشمل الفواتير المالية — لو له فواتير سيتوقف).`
                      : `${reason}\n\nDelete ${name} permanently with all orders, plans and account? (Financial invoices are excluded — it will stop if any exist).`,
                    variant: "danger",
                    confirmText: isRtl ? "حذف نهائي" : "Delete permanently",
                  });
                  if (!force) return;
                  try {
                    const res: any = await forceDeleteCustomer.mutateAsync(id);
                    await alertDialog({
                      title: isRtl ? "تم الحذف النهائي" : "Permanently deleted",
                      message: isRtl
                        ? `تم حذف ${name} مع ${res?.ordersDeleted ?? 0} طلب و${res?.plansDeleted ?? 0} خطة.`
                        : `${name} deleted with ${res?.ordersDeleted ?? 0} orders and ${res?.plansDeleted ?? 0} plans.`,
                    });
                  } catch (e2: any) {
                    await alertDialog({
                      title: isRtl ? "تعذّر الحذف النهائي" : "Couldn't force-delete",
                      message: getUserError(e2, isRtl ? "ar" : "en"),
                    });
                  }
                }
              }}
            />
          ))
        )}
      </div>

      <SubscriptionPauseDialog
        customerId={pauseTarget?._id ?? null}
        customerName={pauseTarget?.fullName ?? ""}
        open={Boolean(pauseTarget)}
        initialSection={pauseSection}
        onOpenChange={(v) => !v && setPauseTarget(null)}
      />

      <CustomerMealPlanDialog
        customer={printTarget}
        open={Boolean(printTarget)}
        onOpenChange={(v) => !v && setPrintTarget(null)}
      />

      <div className="text-[10px] text-muted-foreground/50 mt-8">
        Customers.tsx
      </div>
    </div>
  );
}
