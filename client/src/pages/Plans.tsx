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
  value, onChange, items, placeholder, isRtl,
}: {
  value: string | null; onChange: (id: string) => void;
  items: any[]; placeholder: string; isRtl: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((m) => m._id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "w-full justify-between h-10 rounded-xl text-sm",
            "border-gray-200 hover:border-[#3cc4f0] bg-white transition-colors",
            !selected && "text-gray-400"
          )}
        >
          <span className="truncate flex items-center gap-2">
            {selected ? (
              <>
                <span className="text-base">🍽️</span>
                <span className="text-gray-800 font-medium">{selected.name}</span>
              </>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align={isRtl ? "end" : "start"}>
        <Command>
          <CommandInput placeholder={placeholder} className={isRtl ? "text-right" : "text-left"} />
          <CommandList>
            <CommandEmpty>{isRtl ? "لا توجد نتائج" : "No results"}</CommandEmpty>
            <CommandGroup>
              {items.map((m) => (
                <CommandItem
                  key={m._id}
                  value={`${m.name}`}
                  onSelect={() => { onChange(m._id); setOpen(false); }}
                  className={cn("flex items-center justify-between", isRtl ? "flex-row-reverse" : "")}
                >
                  <span className="font-medium text-sm">{m.name}</span>
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
          className="w-full justify-between h-auto min-h-[40px] rounded-xl border-gray-200 hover:border-[#3cc4f0] bg-white text-sm transition-colors"
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
          <Plus className="h-3.5 w-3.5 flex-shrink-0 opacity-40 ml-2" />
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

/* ─── Main Component ──────────────────────────────────── */
export default function PlansPage() {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [date, setDate] = useState<Date>(new Date());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<"ALL" | "MORNING" | "EVENING">("ALL");
  // ✅ فلتر الحالة: عرض الكل، أو اللي لسه محتاجين خطة، أو اللي خلصوا
  const [planFilter, setPlanFilter] = useState<"ALL" | "PENDING" | "DONE">("ALL");
  // ✅ فلتر البرنامج: مثل (FITNESS, DIET, BULK, CUSTOMIZED, etc.)
  const [programFilter, setProgramFilter] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Partial<DailyPlan> | null>(null);

  const { data: customers = [] } = useCustomers();
  const { data: categories = [] } = useCategories();
  const { data: menuItems = [] } = useMenuItems();
  const { data: modifiers = [] } = useModifiers();

  const formattedDate = format(date, "yyyy-MM-dd");
  const { data: dailyPlans = [] } = useDailyPlans(formattedDate);

  const yesterdayDate = subDays(date, 1);
  const { data: yesterdayPlans = [] } = useDailyPlans(format(yesterdayDate, "yyyy-MM-dd"));

  const createPlanMutation = useCreateDailyPlan();
  const updatePlanMutation = useUpdateDailyPlan();
  const dateLocale = isRtl ? ar : enUS;

  const selectedCustomer = useMemo(
    () => customers.find((c: any) => c._id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const activeCustomers = useMemo(
    () =>
      (customers || [])
        .filter((c: any) => c?.status === "ACTIVE" || c?.isActive === true || c?.isActive === undefined)
        .sort((a: any, b: any) =>
          String(a?.fullName || "").toLowerCase().localeCompare(String(b?.fullName || "").toLowerCase())
        ),
    [customers]
  );

  const sortedCategories = useMemo(
    () => [...(categories || [])].sort((a: any, b: any) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0)),
    [categories]
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
        setTimeout(() => {
          const goNext = window.confirm(
            isRtl
              ? "تم تأكيد الخطة بنجاح ✓\n\nهل تريد العودة لاختيار عميل آخر؟"
              : "Plan confirmed ✓\n\nGo back to select another customer?"
          );
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

  const getCategoryAccent = (name: string) => {
    const n = name.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) return { color: "#f59e0b", bg: "#fffbeb", light: "#fef3c7", icon: "☀️" };
    if (n.includes("LUNCH") || n.includes("غداء"))    return { color: "#3cc4f0", bg: "#ecfeff", light: "#cffafe", icon: "🍽️" };
    if (n.includes("DINNER") || n.includes("عشاء"))   return { color: "#47759c", bg: "#eff6ff", light: "#dbeafe", icon: "🌙" };
    if (n.includes("SNACK") || n.includes("سناك"))    return { color: "#10b981", bg: "#f0fdf4", light: "#d1fae5", icon: "🥗" };
    return { color: "#3cc4f0", bg: "#f8fafc", light: "#f1f5f9", icon: "🍴" };
  };

  const isToday = formattedDate === format(new Date(), "yyyy-MM-dd");

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="pb-32">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3"
        style={{ boxShadow: "0 1px 12px rgba(0,0,0,0.07)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">

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
                  <span className="text-sm font-semibold text-gray-700">
                    {isToday ? (isRtl ? "اليوم" : "Today") : format(date, "d MMM", { locale: dateLocale })}
                  </span>
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

          {/* Center: title */}
          <h1 className="text-base font-bold text-gray-800 absolute left-1/2 -translate-x-1/2">
            {isRtl ? "الخطط اليومية" : "Daily Plans"}
          </h1>

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
      <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">

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
                className="rounded-3xl overflow-hidden relative p-7"
                style={{
                  background: "linear-gradient(135deg, #3cc4f0 0%, #2bb0dc 50%, #47759c 100%)",
                  boxShadow: "0 8px 32px rgba(60,196,240,0.25)",
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

              {/* ─── Search + Filters ─── */}
              <div className="bg-white rounded-2xl p-4 space-y-3"
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
                    { key: null, label: isRtl ? "الكل" : "All", color: "#47759c" },
                    { key: "CUSTOMIZED", label: isRtl ? "مخصص (Customized)" : "Customized", color: "#8b5cf6" },
                    { key: "FITNESS", label: "Fitness", color: "#06b6d4" },
                    { key: "DIET", label: "Diet", color: "#3cc4f0" },
                    { key: "BULK", label: "Bulk", color: "#f59e0b" },
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
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
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
                          "group rounded-2xl overflow-hidden text-right transition-all hover:-translate-y-1 active:scale-[0.98] relative",
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
                          className="h-1.5"
                          style={{
                            background: hasPlan
                              ? "linear-gradient(90deg, #10b981, #34d399)"
                              : "linear-gradient(90deg, #3cc4f0, #2bb0dc)",
                          }}
                        />

                        {/* Top section: avatar + name + status */}
                        <div className="p-4 flex items-start gap-3">
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
                            <p className="text-sm font-bold text-gray-900 truncate">{customer.fullName}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5" dir="ltr">{customer.phone}</p>
                          </div>

                          {/* Avatar */}
                          <div
                            className="h-12 w-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-base font-black text-white shadow-md transition-transform duration-200 group-hover:scale-105"
                            style={{ background: getAvatarGradient(customer.fullName) }}
                          >
                            {customer.fullName?.charAt(0).toUpperCase()}
                          </div>
                        </div>

                        {/* Stats row */}
                        <div className="px-4 pb-3">
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="rounded-lg py-1.5"
                              style={{ background: isMorn ? "linear-gradient(135deg, #fffbeb, #fef9c3)" : "linear-gradient(135deg, #eff6ff, #e0e7ff)" }}>
                              <div className="flex items-center justify-center gap-1">
                                {isMorn ? <Sun className="h-3 w-3 text-amber-500" /> : <Moon className="h-3 w-3 text-indigo-500" />}
                                <p className={cn("text-[10px] font-black", isMorn ? "text-amber-700" : "text-indigo-700")}>
                                  {isMorn ? (isRtl ? "صباحي" : "AM") : (isRtl ? "مسائي" : "PM")}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-lg py-1.5"
                              style={{ background: "linear-gradient(135deg, #ecfeff, #cffafe)" }}>
                              <p className="text-sm font-black text-cyan-700 tabular-nums leading-none">{meals}</p>
                              <p className="text-[9px] text-cyan-600 font-semibold mt-0.5">{isRtl ? "وجبات" : "Meals"}</p>
                            </div>
                            <div className="rounded-lg py-1.5"
                              style={{ background: "linear-gradient(135deg, #f0fdf4, #d1fae5)" }}>
                              <p className="text-sm font-black text-emerald-700 tabular-nums leading-none">{snacks}</p>
                              <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">{isRtl ? "سناك" : "Snack"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: program + days left */}
                        <div className="px-4 pb-3 pt-2 border-t border-gray-50 flex items-center justify-between">
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
            <div className="bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #3cc4f0, #47759c)" }}>
                  {(selectedCustomer as any)?.fullName?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{(selectedCustomer as any)?.fullName}</p>
                  <p className="text-xs text-gray-400" dir="ltr">{(selectedCustomer as any)?.phone}</p>
                </div>
                <Popover open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
                  <PopoverTrigger asChild>
                    <button className="text-xs font-semibold px-3 h-8 rounded-lg transition-colors flex-shrink-0"
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
              <div className="px-4 pb-4">
                <button
                  onClick={handleCopyYesterday}
                  className="w-full h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80"
                  style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", color: "#64748b" }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {isRtl ? "نسخ خطة أمس" : "Copy Yesterday's Plan"}
                </button>
              </div>
            </div>

            {/* ── Customer info card ── */}
            {selectedCustomer && (() => {
              const c: any = selectedCustomer;
              const mealsCount = c.mealsPerDay ?? 0;
              const snacksCount = c.snacksPerDay ?? 0;
              const totalMeals = c.totalMealsPerDay ?? (mealsCount + snacksCount);

              return (
                <div className="bg-white rounded-2xl overflow-hidden"
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
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl p-2.5 text-center"
                          style={{ background: "linear-gradient(135deg, #ecfeff, #f0fdff)", border: "1px solid #a5f3fc" }}>
                          <p className="text-2xl font-black tabular-nums" style={{ color: "#0891b2" }}>{mealsCount}</p>
                          <p className="text-[10px] text-gray-500 font-medium mt-0.5">{isRtl ? "وجبات" : "Meals"}</p>
                        </div>
                        <div className="rounded-xl p-2.5 text-center"
                          style={{ background: "linear-gradient(135deg, #f0fdf4, #f7fef9)", border: "1px solid #bbf7d0" }}>
                          <p className="text-2xl font-black tabular-nums text-emerald-600">{snacksCount}</p>
                          <p className="text-[10px] text-gray-500 font-medium mt-0.5">{isRtl ? "سناكات" : "Snacks"}</p>
                        </div>
                        <div className="rounded-xl p-2.5 text-center"
                          style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "1px solid #e2e8f0" }}>
                          <p className="text-2xl font-black tabular-nums text-gray-700">{totalMeals}</p>
                          <p className="text-[10px] text-gray-500 font-medium mt-0.5">{isRtl ? "الإجمالي" : "Total"}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Allergies (high priority — red) */}
                  {c.allergies && (
                    <div className="mx-4 mb-3 rounded-xl p-3 flex items-start gap-2.5"
                      style={{ background: "linear-gradient(135deg, #fef2f2, #fff5f5)", border: "1.5px solid #fca5a5" }}>
                      <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-red-500">
                        <AlertTriangle className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1">
                          {isRtl ? "⚠ حساسية" : "⚠ Allergies"}
                        </p>
                        <p className="text-xs font-semibold text-red-800 leading-relaxed">{c.allergies}</p>
                      </div>
                    </div>
                  )}

                  {/* Avoid / Forbidden items */}
                  {c.avoid && (
                    <div className="mx-4 mb-3 rounded-xl p-3 flex items-start gap-2.5"
                      style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                      <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                        style={{ background: "#f97316" }}>
                        <span className="text-white text-xs font-black">✕</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-1">
                          {isRtl ? "ممنوعات" : "Avoid"}
                        </p>
                        <p className="text-xs font-semibold text-orange-800 leading-relaxed">{c.avoid}</p>
                      </div>
                    </div>
                  )}

                  {/* Preferences */}
                  {c.preferences && (
                    <div className="mx-4 mb-3 rounded-xl p-3 flex items-start gap-2.5"
                      style={{ background: "#ecfeff", border: "1px solid #a5f3fc" }}>
                      <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                        style={{ background: "#3cc4f0" }}>
                        <span className="text-white text-xs font-black">★</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#0891b2" }}>
                          {isRtl ? "تفضيلات" : "Preferences"}
                        </p>
                        <p className="text-xs font-semibold leading-relaxed" style={{ color: "#155e75" }}>{c.preferences}</p>
                      </div>
                    </div>
                  )}

                  {/* Portions */}
                  {c.portions && (
                    <div className="mx-4 mb-3 rounded-xl p-3 flex items-start gap-2.5"
                      style={{ background: "#fefce8", border: "1px solid #fde68a" }}>
                      <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                        style={{ background: "#eab308" }}>
                        <span className="text-white text-xs font-black">⚖</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide mb-1 text-yellow-700">
                          {isRtl ? "الكميات" : "Portions"}
                        </p>
                        <p className="text-xs font-semibold leading-relaxed text-yellow-900">{c.portions}</p>
                      </div>
                    </div>
                  )}

                  {/* General delivery notes */}
                  {c.notes && (
                    <div className="mx-4 mb-3 rounded-xl p-3 flex items-start gap-2.5"
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                      <StickyNote className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-blue-600 mb-0.5">{isRtl ? "ملاحظات التوصيل" : "Delivery Notes"}</p>
                        <p className="text-xs text-blue-700 leading-relaxed">{c.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Plan content ── */}
            {currentPlan && (
              <div className="space-y-3">

                {/* Plan notes */}
                <div className="bg-white rounded-2xl p-4"
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

                      <div
                        className="grid gap-3"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
                      >
                        {orderedItems.map((item: any) => {
                          const category = sortedCategories.find((c: any) => c._id === item.categoryId);
                          if (!category) return null;
                          const accent = getCategoryAccent(category.name);
                          const categoryItems = menuItems.filter(
                            (m: any) => m.categoryId === category._id && m.isActive
                          );
                          const showIndex = (catCounts[item.categoryId] || 0) > 1;
                          const canRemove = (catCounts[item.categoryId] || 0) > 1;
                          const hasMods = (item.modifierIds || []).length > 0;
                          const activeMods = (item.modifierIds || []).map((id: string) =>
                            modifiers.find((m: any) => m._id === id)
                          ).filter(Boolean);

                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "bg-white rounded-2xl overflow-hidden transition-all flex flex-col group",
                                item.isOff ? "opacity-50" : "hover:-translate-y-0.5"
                              )}
                              style={{
                                boxShadow: item.isOff
                                  ? "0 1px 4px rgba(0,0,0,0.04)"
                                  : "0 2px 14px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)",
                                border: "1px solid rgba(0,0,0,0.06)",
                              }}
                            >
                              {/* Top accent line — brand cyan */}
                              <div className="h-1" style={{ background: item.isOff ? "#e5e7eb" : accent.color }} />

                              {/* Card header */}
                              <div className="flex items-center justify-between px-3 pt-3 pb-2">
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
                                  <span className="text-[11px] font-bold px-2 h-6 rounded-full flex items-center gap-1.5"
                                    style={{ color: accent.color, background: accent.color + "12" }}>
                                    <span className="text-sm leading-none">{accent.icon}</span>
                                    {isRtl ? category.nameAr || category.name : category.name}
                                  </span>
                                </div>
                              </div>

                              {/* Body */}
                              {!item.isOff && (
                                <div className="p-3 pt-1 space-y-2.5 flex-1 flex flex-col">
                                  {/* Meal picker */}
                                  <MealPicker
                                    value={item.menuItemId || null}
                                    onChange={(val) => updateItemById(item.id, { menuItemId: val })}
                                    items={categoryItems}
                                    placeholder={isRtl ? "اختر الوجبة" : "Choose meal"}
                                    isRtl={isRtl}
                                  />

                                  {/* Customer warnings — clean single-line strip */}
                                  {(cust?.allergies || cust?.avoid) && (
                                    <div className="rounded-xl overflow-hidden"
                                      style={{ border: "1px solid #fecaca" }}>
                                      {cust?.allergies && (
                                        <div className="flex items-stretch text-[10px]"
                                          style={{ background: "#fef2f2" }}>
                                          <div className="px-2 py-1.5 flex items-center justify-center font-black text-white"
                                            style={{ background: "#ef4444", minWidth: "26px" }}>⚠</div>
                                          <div className="flex-1 px-2 py-1.5 flex items-center min-w-0">
                                            <span className="font-bold text-red-700 flex-shrink-0">{isRtl ? "حساسية:" : "Allergy:"}&nbsp;</span>
                                            <span className="text-red-800 truncate">{cust.allergies}</span>
                                          </div>
                                        </div>
                                      )}
                                      {cust?.avoid && (
                                        <div className="flex items-stretch text-[10px]"
                                          style={{ background: "#fff7ed", borderTop: cust?.allergies ? "1px solid #fecaca" : "none" }}>
                                          <div className="px-2 py-1.5 flex items-center justify-center font-black text-white"
                                            style={{ background: "#f97316", minWidth: "26px" }}>✕</div>
                                          <div className="flex-1 px-2 py-1.5 flex items-center min-w-0">
                                            <span className="font-bold text-orange-700 flex-shrink-0">{isRtl ? "ممنوع:" : "Avoid:"}&nbsp;</span>
                                            <span className="text-orange-800 truncate">{cust.avoid}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Modifiers picker */}
                                  <ModifiersPicker
                                    value={item.modifierIds || []}
                                    onChange={(next) => updateItemById(item.id, { modifierIds: next } as any)}
                                    modifiers={modifiers || []}
                                    isRtl={isRtl}
                                  />

                                  {/* Active modifiers preview */}
                                  {hasMods && (
                                    <div className="flex flex-wrap gap-1">
                                      {activeMods.map((mod: any) => (
                                        <span
                                          key={mod._id}
                                          className={cn(
                                            "text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md border",
                                            mod.group === "AVOID" && "bg-red-50 text-red-700 border-red-200",
                                            mod.group === "PREF" && "bg-cyan-50 text-cyan-700 border-cyan-200",
                                            mod.group === "PORTION" && "bg-amber-50 text-amber-700 border-amber-200"
                                          )}
                                        >
                                          {mod.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}

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
                              className="h-9 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-white"
                              style={{
                                border: `1.5px dashed ${accent.color}40`,
                                color: accent.color,
                                background: "transparent",
                              }}
                            >
                              <Plus className="h-3 w-3" />
                              <span>{accent.icon}</span>
                              {isRtl ? `إضافة ${cat.nameAr || cat.name}` : `Add ${cat.name}`}
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
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-3"
          style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
          <div className="max-w-6xl mx-auto space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleSave("DRAFT")}
                className="h-11 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {isRtl ? "حفظ مسودة" : "Save Draft"}
              </button>
              <button
                onClick={() => handleSave("CONFIRMED")}
                className="h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #3cc4f0, #2bb0dc)", boxShadow: "0 4px 14px #3cc4f040" }}
              >
                <Check className="h-4 w-4" />
                {isRtl ? "تأكيد الخطة" : "Confirm Plan"}
              </button>
            </div>
            <button
              onClick={() => setLocation(`/plans-review/${formattedDate}`)}
              className="w-full text-center text-xs font-medium text-gray-400 flex items-center justify-center gap-1.5 py-1 hover:text-[#3cc4f0] transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              {isRtl ? "الانتقال للمراجعة النهائية" : "Go to Final Review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
