/**
 * @file client/src/pages/Plans.tsx
 * @description إدارة الخطط اليومية - تعيين الوجبات للعملاء
 * @convex convex/dailyPlans.ts, convex/customers.ts, convex/mealCategories.ts, convex/menuItems.ts, convex/modifiers.ts
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Save,
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
} from "lucide-react";
import { format, subDays } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

/* =========================
   Helpers
========================= */
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

/* =========================
   Meal Picker
========================= */
function MealPicker({
  value,
  onChange,
  items,
  placeholder,
  isRtl,
}: {
  value: string | null;
  onChange: (id: string) => void;
  items: any[];
  placeholder: string;
  isRtl: boolean;
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
            "w-full justify-between h-11 rounded-lg border-gray-200 hover:border-cyan-400 bg-white",
            !selected && "text-gray-400"
          )}
        >
          <span className={cn(isRtl ? "text-right" : "text-left", "truncate flex items-center gap-2")}>
            <span className="text-xl">🍽️</span>
            {selected?.name || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0" align={isRtl ? "end" : "start"}>
        <Command>
          <CommandInput
            placeholder={placeholder}
            className={isRtl ? "text-right" : "text-left"}
          />
          <CommandList>
            <CommandEmpty>
              {isRtl ? "لا توجد نتائج" : "No results"}
            </CommandEmpty>
            <CommandGroup>
              {items.map((m) => (
                <CommandItem
                  key={m._id}
                  value={`${m.name}`}
                  onSelect={() => {
                    onChange(m._id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between",
                    isRtl ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <span className="font-medium">{m.name}</span>
                  {value === m._id && <Check className="h-4 w-4 text-cyan-500" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* =========================
   Modifiers Picker
========================= */
type ModifierGroup = "AVOID" | "PREF" | "PORTION";

function ModifiersPicker({
  value,
  onChange,
  modifiers,
  isRtl,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  modifiers: any[];
  isRtl: boolean;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<ModifierGroup>("AVOID");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (modifiers || [])
      .filter((m: any) => m?.isActive !== false)
      .filter((m: any) => m?.group === group)
      .filter((m: any) =>
        !query
          ? true
          : String(m?.name || "")
              .toLowerCase()
              .includes(query),
      )
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [modifiers, group, q]);

  const toggle = (id: string) => {
    const exists = (value || []).includes(id);
    onChange(
      exists ? (value || []).filter((x) => x !== id) : [...(value || []), id],
    );
  };

  const groupLabel = (g: ModifierGroup) => {
    if (g === "AVOID") return isRtl ? "ممنوع" : "Avoid";
    if (g === "PREF") return isRtl ? "تفضيلات" : "Prefs";
    return isRtl ? "كمية/نظام" : "Portion";
  };

  const selectedMods = useMemo(() => {
    const sel = modifiers.filter((m: any) => (value || []).includes(m._id));
    return sel;
  }, [modifiers, value]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-auto min-h-[44px] rounded-lg border-gray-200 hover:border-cyan-400 bg-white"
        >
          <div className="flex flex-wrap gap-1.5 items-center py-1">
            {selectedMods.length === 0 ? (
              <span className="text-gray-400 text-sm">
                {isRtl ? "اختر التفضيلات والممنوعات" : "Select preferences"}
              </span>
            ) : (
              selectedMods.map((m: any) => (
                <Badge
                  key={m._id}
                  variant="secondary"
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    m.group === "AVOID" && "bg-red-100 text-red-700 border-red-200",
                    m.group === "PREF" && "bg-cyan-100 text-cyan-700 border-cyan-200",
                    m.group === "PORTION" && "bg-gray-100 text-gray-700 border-gray-200"
                  )}
                >
                  {m.name}
                </Badge>
              ))
            )}
          </div>
          <Plus className="h-4 w-4 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align={isRtl ? "end" : "start"}>
        <div className="p-3 space-y-3">
          <div className="flex gap-1 border-b pb-2">
            {(["AVOID", "PREF", "PORTION"] as ModifierGroup[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={cn(
                  "flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors",
                  group === g
                    ? "bg-cyan-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
            className="h-9 text-sm"
          />

          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {filtered.map((m: any) => {
              const selected = (value || []).includes(m._id);
              return (
                <Badge
                  key={m._id}
                  onClick={() => toggle(m._id)}
                  className={cn(
                    "cursor-pointer text-xs px-2.5 py-1 rounded-full transition-all",
                    selected
                      ? m.group === "AVOID"
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : m.group === "PREF"
                        ? "bg-cyan-500 text-white hover:bg-cyan-600"
                        : "bg-gray-700 text-white hover:bg-gray-800"
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

/* =========================
   Main Component
========================= */
export default function PlansPage() {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [date, setDate] = useState<Date>(new Date());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Partial<DailyPlan> | null>(null);

  const { data: customers = [] } = useCustomers();
  const { data: categories = [] } = useCategories();
  const { data: menuItems = [] } = useMenuItems();
  const { data: modifiers = [] } = useModifiers();

  const formattedDate = format(date, "yyyy-MM-dd");
  const { data: dailyPlans = [] } = useDailyPlans(formattedDate);

  const yesterdayDate = subDays(date, 1);
  const yesterdayDateStr = format(yesterdayDate, "yyyy-MM-dd");
  const { data: yesterdayPlans = [] } = useDailyPlans(yesterdayDateStr);

  const createPlanMutation = useCreateDailyPlan();
  const updatePlanMutation = useUpdateDailyPlan();

  const dateLocale = isRtl ? ar : enUS;

  const selectedCustomer = useMemo(() => {
    return customers.find((c: any) => c._id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const activeCustomers = useMemo(() => {
    return (customers || [])
      .filter((c: any) => c?.status === "ACTIVE")
      .sort((a: any, b: any) => {
        const aName = String(a?.fullName || "").toLowerCase();
        const bName = String(b?.fullName || "").toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [customers]);

  const sortedCategories = useMemo(() => {
    return [...(categories || [])].sort(
      (a: any, b: any) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0)
    );
  }, [categories]);

  useEffect(() => {
    if (!selectedCustomerId || !formattedDate) {
      setCurrentPlan(null);
      return;
    }

    const existingPlan = dailyPlans.find(
      (p: any) => p.customerId === selectedCustomerId && p.date === formattedDate
    );

    if (existingPlan) {
      setCurrentPlan(existingPlan);
    } else {
      const customer = customers.find((c: any) => c._id === selectedCustomerId);
      const snacksPerDay = customer?.snacksPerDay ?? 0;

      const newItems: any[] = [];
      sortedCategories.forEach((cat: any) => {
        const isSnack = isSnackCategoryName(cat.name);
        const count = isSnack ? snacksPerDay : 1;
        for (let i = 0; i < count; i++) {
          newItems.push({
            id: makeId(),
            categoryId: cat._id,
            menuItemId: null,
            modifierIds: [],
            specialNotes: "",
            isOff: false,
            meta: { index: i + 1 },
          });
        }
      });

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

    const yesterdayPlan = yesterdayPlans.find(
      (p: any) => p.customerId === selectedCustomerId
    );

    if (!yesterdayPlan) {
      toast({
        title: isRtl ? "لا توجد خطة" : "No plan found",
        description: isRtl
          ? "لا توجد خطة للأمس لهذا العميل"
          : "No plan found for yesterday",
        variant: "destructive",
      });
      return;
    }

    const copiedItems = (yesterdayPlan.items || []).map((item: any) => ({
      ...item,
      id: makeId(),
    }));

    setCurrentPlan({
      ...currentPlan,
      deliveryTime: yesterdayPlan.deliveryTime || (selectedCustomer as any)?.deliveryTime || "MORNING",
      items: copiedItems,
      notes: yesterdayPlan.notes || "",
    });

    toast({
      title: isRtl ? "تم النسخ" : "Copied",
      description: isRtl ? "تم نسخ خطة الأمس" : "Yesterday's plan copied",
    });
  };

  const updateItemById = (itemId: string, updates: Partial<DailyPlanItem>) => {
    if (!currentPlan) return;
    const updated = (currentPlan.items as any[])?.map((item: any) =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    setCurrentPlan({ ...currentPlan, items: updated });
  };

  const addCategorySlot = (categoryId: string) => {
    if (!currentPlan) return;
    const items = currentPlan.items as any[];
    const categoryItems = items.filter((i: any) => i.categoryId === categoryId);
    const nextIndex = categoryItems.length + 1;

    const newItem = {
      id: makeId(),
      categoryId,
      menuItemId: null,
      modifierIds: [],
      specialNotes: "",
      isOff: false,
      meta: { index: nextIndex },
    };

    setCurrentPlan({ ...currentPlan, items: [...items, newItem] });
  };

  const removeCategorySlot = (itemId: string) => {
    if (!currentPlan) return;
    const updated = (currentPlan.items as any[])?.filter(
      (item: any) => item.id !== itemId
    );
    setCurrentPlan({ ...currentPlan, items: updated });
  };

  const handleSave = async (status: "DRAFT" | "CONFIRMED") => {
    if (!currentPlan || !selectedCustomerId) return;

    if (status === "CONFIRMED") {
      const hasAtLeastOneMeal = (currentPlan.items as any[])?.some(
        (item: any) => !item.isOff && item.menuItemId
      );
      if (!hasAtLeastOneMeal) {
        toast({
          title: isRtl ? "خطأ" : "Error",
          description: isRtl
            ? "يجب اختيار وجبة واحدة على الأقل"
            : "Please select at least one meal",
          variant: "destructive",
        });
        return;
      }
    }

    const payload = stripSystemFields({
      ...currentPlan,
      customerId: selectedCustomerId,
      status,
    });

    try {
      if ((currentPlan as any)._id) {
        await updatePlanMutation.mutateAsync({
          id: (currentPlan as any)._id,
          ...payload,
        });
      } else {
        const created = await createPlanMutation.mutateAsync(payload as any);
        setCurrentPlan({ ...currentPlan, _id: created } as any);
      }

      toast({
        title: isRtl ? "تم الحفظ" : "Saved",
        description:
          status === "CONFIRMED"
            ? isRtl
              ? "تم تأكيد الخطة بنجاح"
              : "Plan confirmed successfully"
            : isRtl
            ? "تم حفظ المسودة"
            : "Draft saved",
      });
    } catch (error: any) {
      toast({
        title: isRtl ? "خطأ" : "Error",
        description: error?.message || (isRtl ? "فشل الحفظ" : "Failed to save"),
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = () => {
    if (!dailyPlans || dailyPlans.length === 0) {
      toast({
        title: isRtl ? "لا توجد بيانات" : "No data",
        description: isRtl ? "لا توجد خطط لتصديرها" : "No plans to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Date",
      "Customer Name",
      "Phone",
      "Delivery Time",
      ...sortedCategories.map((c: any) => c.name),
      "Notes",
    ];

    const rows = dailyPlans.map((plan: any) => {
      const customer = customers.find((c: any) => c._id === plan.customerId);
      const rowData: any[] = [
        plan.date,
        customer?.fullName || "Unknown",
        customer?.phone || "",
        customer?.deliveryTime || "",
      ];

      for (const category of sortedCategories) {
        const items = (plan.items || []).filter(
          (i: any) => i.categoryId === category._id
        );
        const parts = [];
        for (const item of items) {
          if (item?.menuItemId) {
            const meal = menuItems.find((m: any) => m._id === item.menuItemId);
            const mods = (item.modifierIds || [])
              .map((mid: string) => modifiers.find((m: any) => m._id === mid)?.name)
              .filter(Boolean);
            parts.push(
              [meal?.name, mods.length > 0 ? `(${mods.join(", ")})` : ""]
                .filter(Boolean)
                .join(" ")
            );
          } else {
            parts.push(item?.isOff ? "OFF" : "Not Selected");
          }
        }

        rowData.push(parts.join(" | "));
      }

      rowData.push(plan.notes || "");
      return rowData
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `plans_${formattedDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryIcon = (categoryName: string) => {
    const n = categoryName.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) return "☀️";
    if (n.includes("LUNCH") || n.includes("غداء")) return "🍽️";
    if (n.includes("DINNER") || n.includes("عشاء")) return "🌙";
    if (n.includes("SNACK") || n.includes("سناك")) return "🥗";
    return "🍴";
  };

  const getCategoryBorderColor = (categoryName: string) => {
    const n = categoryName.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) return "border-orange-400";
    if (n.includes("LUNCH") || n.includes("غداء")) return "border-cyan-400";
    if (n.includes("DINNER") || n.includes("عشاء")) return "border-indigo-400";
    if (n.includes("SNACK") || n.includes("سناك")) return "border-green-400";
    return "border-gray-300";
  };

  const getCategoryBgColor = (categoryName: string) => {
    const n = categoryName.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) return "bg-orange-50 border-orange-100";
    if (n.includes("LUNCH") || n.includes("غداء")) return "bg-cyan-50 border-cyan-100";
    if (n.includes("DINNER") || n.includes("عشاء")) return "bg-indigo-50 border-indigo-100";
    if (n.includes("SNACK") || n.includes("سناك")) return "bg-green-50 border-green-100";
    return "bg-gray-50 border-gray-100";
  };

  const getCategoryIconBg = (categoryName: string) => {
    const n = categoryName.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) return "bg-orange-100";
    if (n.includes("LUNCH") || n.includes("غداء")) return "bg-cyan-100";
    if (n.includes("DINNER") || n.includes("عشاء")) return "bg-indigo-100";
    if (n.includes("SNACK") || n.includes("سناك")) return "bg-green-100";
    return "bg-gray-100";
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Search className="h-5 w-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Copy className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-800">
              {isRtl ? "الخطط اليومية" : "Daily Plans"}
            </h1>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="text-sm text-gray-500 hover:text-cyan-600 flex items-center gap-1">
                  {format(date, "d MMMM yyyy", { locale: dateLocale })}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) setDate(d);
                    setIsCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportCSV}
              className="h-9 w-9 rounded-lg"
            >
              <Download className="h-5 w-5 text-gray-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation(`/plans-review/${formattedDate}`)}
              className="h-9 w-9 rounded-lg"
            >
              <Eye className="h-5 w-5 text-cyan-600" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-cyan-500 bg-cyan-50"
                >
                  <CalendarIcon className="h-5 w-5 text-cyan-600" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align={isRtl ? "start" : "end"}>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) setDate(d);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Empty State - Show when no customer selected */}
        {!selectedCustomerId ? (
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 mt-8">
            {/* Header Section */}
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {isRtl ? "البداية" : "Start"}
              </h2>
              <div className="h-1 w-16 bg-cyan-400 rounded-full mx-auto"></div>
            </div>

            {/* Search Section */}
            <div className="mb-8">
              <Popover open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full h-14 rounded-2xl border-2 border-gray-200 hover:border-cyan-400 text-base",
                      "focus:ring-2 focus:ring-cyan-200 transition-all"
                    )}
                  >
                    <Search className={cn("h-5 w-5 text-gray-400", isRtl ? "ml-3" : "mr-3")} />
                    <span className="text-gray-500 flex-1 text-center">
                      {isRtl ? "ابحث عن مشترك في البدء في إعداد الخطة..." : "Search for customer to start planning..."}
                    </span>
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-full p-0" align="center">
                  <Command>
                    <CommandInput
                      placeholder={isRtl ? "ابحث عن مشترك" : "Search customer"}
                      className={isRtl ? "text-right" : "text-left"}
                    />
                    <CommandList>
                      <CommandEmpty>{isRtl ? "لا يوجد عميل" : "No customer found"}</CommandEmpty>
                      <CommandGroup>
                        {activeCustomers.map((customer: any) => (
                          <CommandItem
                            key={customer._id}
                            value={`${customer.fullName} ${customer.phone}`}
                            onSelect={() => {
                              setSelectedCustomerId(customer._id);
                              setIsCustomerOpen(false);
                            }}
                            className={cn("flex", isRtl ? "flex-row-reverse" : "")}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                isRtl ? "ml-2" : "mr-2",
                                selectedCustomerId === customer._id ? "opacity-100 text-cyan-500" : "opacity-0"
                              )}
                            />
                            <div className={cn("flex flex-col w-full", isRtl ? "text-right" : "text-left")}>
                              <span className="font-medium">{customer.fullName}</span>
                              <span className="text-xs text-gray-500">{customer.phone}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Illustration */}
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="relative">
                <div className="h-32 w-32 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-6xl">🥗</span>
                </div>
                <div className="absolute -bottom-2 -right-2 h-12 w-12 rounded-full bg-cyan-400 flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🔥</span>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 mt-6 mb-2">
                {isRtl ? "ابدأ بتخطيط الوجبات" : "Start Planning Meals"}
              </h3>
              <p className="text-sm text-gray-600 text-center max-w-md leading-relaxed">
                {isRtl
                  ? "اختر أحد المشتركين النشطين من القائمة أدناه أو ابحث بالاسم في جدولة وجبات اليوم."
                  : "Select one of the active subscribers from the list below or search by name to schedule today's meals."}
              </p>
            </div>

            {/* Active Customers Quick Access */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-700">
                  {isRtl ? "مشتركون متكررون" : "Recent Subscribers"}
                </p>
                <button className="text-xs text-cyan-500 hover:text-cyan-600 font-medium">
                  {isRtl ? "عرض الكل" : "View All"}
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-3">
                {activeCustomers.slice(0, 4).map((customer: any) => (
                  <button
                    key={customer._id}
                    onClick={() => setSelectedCustomerId(customer._id)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-gray-50 border-2 border-transparent hover:border-cyan-400 transition-all group"
                  >
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white text-xl font-bold shadow-md group-hover:shadow-lg transition-shadow">
                      {customer.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-gray-700 truncate w-full text-center">
                      {customer.fullName.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Customer Search - when customer is selected */}
            <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-4">
              <Popover open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between h-12 rounded-xl border-2 border-cyan-400 hover:border-cyan-500 bg-cyan-50",
                      "font-medium"
                    )}
                  >
                    <span className={cn("truncate", isRtl ? "text-right" : "text-left")}>
                      {customers.find((c: any) => c._id === selectedCustomerId)?.fullName}
                    </span>
                    <Search className="h-4 w-4 text-cyan-600" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-full p-0" align="center">
                  <Command>
                    <CommandInput
                      placeholder={isRtl ? "ابحث عن مشترك" : "Search customer"}
                      className={isRtl ? "text-right" : "text-left"}
                    />
                    <CommandList>
                      <CommandEmpty>{isRtl ? "لا يوجد عميل" : "No customer found"}</CommandEmpty>
                      <CommandGroup>
                        {activeCustomers.map((customer: any) => (
                          <CommandItem
                            key={customer._id}
                            value={`${customer.fullName} ${customer.phone}`}
                            onSelect={() => {
                              setSelectedCustomerId(customer._id);
                              setIsCustomerOpen(false);
                            }}
                            className={cn("flex", isRtl ? "flex-row-reverse" : "")}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                isRtl ? "ml-2" : "mr-2",
                                selectedCustomerId === customer._id ? "opacity-100 text-cyan-500" : "opacity-0"
                              )}
                            />
                            <div className={cn("flex flex-col w-full", isRtl ? "text-right" : "text-left")}>
                              <span className="font-medium">{customer.fullName}</span>
                              <span className="text-xs text-gray-500">{customer.phone}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                className="w-full mt-3 h-10 rounded-xl hover:bg-cyan-50 hover:border-cyan-400 text-sm border-2"
                onClick={handleCopyYesterday}
              >
                <Copy className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
                {isRtl ? "نسخ خطة أمس" : "Copy Yesterday"}
              </Button>
            </div>

        {/* Customer Info Card */}
        {selectedCustomer && (
          <div className="bg-white rounded-2xl shadow-lg border-2 border-cyan-400 overflow-hidden">
            <div className="flex items-start justify-between p-5 pb-4 bg-gradient-to-r from-cyan-50 to-blue-50">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg ring-4 ring-cyan-100">
                  {(selectedCustomer as any).fullName?.charAt(0).toUpperCase() || "A"}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg mb-1">
                    {(selectedCustomer as any).fullName}
                  </h3>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="font-medium">#{(selectedCustomer as any).phone || ""}</span>
                  </p>
                </div>
              </div>
              <Badge className="bg-green-500 text-white border-0 text-xs font-bold px-3 py-1.5 shadow-md">
                {isRtl ? "مخصص" : "CUSTOMIZED"}
              </Badge>
            </div>

            <div className="p-5 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-xs font-bold text-orange-900">{isRtl ? "وقت التوصيل" : "Delivery Time"}</p>
                  </div>
                  <p className="font-bold text-gray-900 text-base">
                    {(selectedCustomer as any).deliveryTime || (isRtl ? "مساءً" : "EVENING")}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 border-2 border-cyan-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <p className="text-xs font-bold text-cyan-900">{isRtl ? "نوع الحمية" : "Diet Type"}</p>
                  </div>
                  <p className="font-bold text-gray-900 text-base">
                    {(selectedCustomer as any).program || (isRtl ? "كيتو" : "Keto")}
                  </p>
                </div>
              </div>
            </div>

            {(selectedCustomer as any).allergies && (
              <div className="bg-gradient-to-br from-red-50 to-red-100 border-t-2 border-red-300 p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0 shadow-md">
                    <AlertTriangle className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-red-900 mb-2 uppercase tracking-wide">
                      {isRtl ? "⚠️ الحساسية والممنوعات" : "⚠️ Allergies & Restrictions"}
                    </p>
                    <p className="text-sm font-bold text-red-950 leading-relaxed">
                      {(selectedCustomer as any).allergies}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(selectedCustomer as any).notes && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-t-2 border-blue-300 p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-md">
                    <StickyNote className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-blue-900 mb-2 uppercase tracking-wide">
                      {isRtl ? "📝 ملاحظات التوصيل" : "📝 Delivery Notes"}
                    </p>
                    <p className="text-sm font-medium text-blue-950 italic leading-relaxed">
                      {(selectedCustomer as any).notes}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Plan Content */}
        {selectedCustomerId && currentPlan ? (
          <div className="space-y-3">
            {/* Delivery Notes */}
            <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <StickyNote className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-bold text-gray-700">
                  {isRtl ? "أضف تعليمات خاصة للتوصيل هنا..." : "Add special delivery instructions..."}
                </p>
              </div>
              <Textarea
                placeholder={isRtl ? "مثال: الطلب بدون ملح، استبدل الأرز بقرنبيط..." : "Example: No salt, replace rice with cauliflower..."}
                value={currentPlan.notes || ""}
                onChange={(e) => setCurrentPlan({ ...currentPlan, notes: e.target.value })}
                className={cn("rounded-xl resize-none h-24 text-sm border-2 border-gray-200 focus:border-cyan-400", isRtl ? "text-right" : "text-left")}
              />
            </div>

            {/* Meal Cards */}
            {sortedCategories.map((category: any) => {
              const itemsForCategory = (currentPlan.items as any[])?.filter(
                (i: any) => i.categoryId === category._id
              );

              if (!itemsForCategory || itemsForCategory.length === 0) return null;

              const categoryItems = menuItems.filter(
                (m: any) => m.categoryId === category._id && m.isActive
              );

              return (
                <div key={category._id} className="space-y-3">
                  {itemsForCategory.map((item: any, idx: number) => {
                    const labelSuffix =
                      itemsForCategory.length > 1 ? ` #${item?.meta?.index ?? idx + 1}` : "";
                    const canRemove = itemsForCategory.length > 1;
                    const selectedMeal = categoryItems.find((m: any) => m._id === item.menuItemId);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "bg-white rounded-2xl shadow-md border-2 overflow-hidden transition-all hover:shadow-lg",
                          item.isOff ? "border-gray-200 opacity-60" : getCategoryBorderColor(category.name)
                        )}
                      >
                        {/* Card Header */}
                        <div className={cn(
                          "flex items-center justify-between p-4 border-b",
                          getCategoryBgColor(category.name)
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center text-2xl shadow-sm",
                              getCategoryIconBg(category.name)
                            )}>
                              {getCategoryIcon(category.name)}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-gray-900">
                                {isRtl ? category.nameAr || category.name : category.name}{labelSuffix}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {selectedMeal?.nameAr || selectedMeal?.name || (isRtl ? "اختر وجبة" : "Select meal")}
                              </p>
                            </div>
                          </div>

                          <div className={cn("flex items-center gap-2", isRtl ? "flex-row-reverse" : "flex-row")}>
                            {canRemove && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCategorySlot(item.id)}
                                className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Switch
                              checked={!item.isOff}
                              onCheckedChange={(checked) =>
                                updateItemById(item.id, {
                                  isOff: !checked,
                                  menuItemId: checked ? item.menuItemId : null,
                                })
                              }
                            />
                          </div>
                        </div>

                        {/* Card Body */}
                        {!item.isOff && (
                          <div className="p-4 space-y-4">
                            {/* Meal Picker Section */}
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-gray-700">
                                {isRtl ? "اختر الوجبة" : "Choose meal"}
                              </Label>
                              <MealPicker
                                value={item.menuItemId || null}
                                onChange={(val) => updateItemById(item.id, { menuItemId: val })}
                                items={categoryItems}
                                placeholder={isRtl ? "ابحث عن وجبة..." : "Search for meal..."}
                                isRtl={isRtl}
                              />
                            </div>

                            {/* Selected Meal Display */}
                            {selectedMeal && (
                              <div className={cn(
                                "rounded-xl p-3 border-2",
                                getCategoryBorderColor(category.name),
                                "bg-white"
                              )}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "h-12 w-12 rounded-xl flex items-center justify-center text-2xl shadow-sm",
                                    getCategoryIconBg(category.name)
                                  )}>
                                    {getCategoryIcon(category.name)}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-bold text-gray-900 text-sm">
                                      {isRtl ? selectedMeal.nameAr || selectedMeal.name : selectedMeal.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {isRtl ? category.nameAr || category.name : category.name}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Modifiers Section */}
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-gray-700">
                                {isRtl ? "الإضافات والتعديلات" : "Additions & Modifiers"}
                              </Label>
                              <ModifiersPicker
                                value={item.modifierIds || []}
                                onChange={(next) =>
                                  updateItemById(item.id, { modifierIds: next } as any)
                                }
                                modifiers={modifiers || []}
                                isRtl={isRtl}
                              />
                            </div>

                            {/* Show Selected Modifiers */}
                            {item.modifierIds && item.modifierIds.length > 0 && (
                              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 border border-gray-200">
                                <p className="text-xs font-medium text-gray-700 mb-2">
                                  {isRtl ? "التعديلات المختارة:" : "Selected Modifiers:"}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {item.modifierIds.map((modId: string) => {
                                    const mod = modifiers.find((m: any) => m._id === modId);
                                    if (!mod) return null;
                                    return (
                                      <Badge
                                        key={modId}
                                        className={cn(
                                          "text-xs px-3 py-1 rounded-full font-medium border-2",
                                          mod.group === "AVOID" && "bg-red-50 text-red-700 border-red-300",
                                          mod.group === "PREF" && "bg-cyan-50 text-cyan-700 border-cyan-300",
                                          mod.group === "PORTION" && "bg-amber-50 text-amber-700 border-amber-300"
                                        )}
                                      >
                                        {isRtl ? mod.nameAr || mod.name : mod.name}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Special Notes */}
                            <div>
                              <p className="text-xs text-gray-500 mb-2">
                                {isRtl ? "ملاحظات خاصة للوجبة..." : "Special notes for meal..."}
                              </p>
                              <Input
                                placeholder={isRtl ? "ملاحظات خاصة..." : "Special notes..."}
                                className={cn("h-10 rounded-lg text-sm border-gray-200", isRtl ? "text-right" : "text-left")}
                                value={item.specialNotes || ""}
                                onChange={(e: any) =>
                                  updateItemById(item.id, { specialNotes: e.target.value })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add More Button */}
                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-lg border-2 border-dashed border-gray-300 hover:bg-cyan-50 hover:border-cyan-400 text-sm"
                    onClick={() => addCategorySlot(category._id)}
                  >
                    <Plus className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
                    {isRtl ? `إضافة ${category.name} آخر` : `+ Add More`}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
        </>
      )}
      </div>

      {/* Fixed Bottom Actions */}
      {selectedCustomerId && currentPlan && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-40">
          <div className="max-w-2xl mx-auto space-y-2">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl hover:bg-gray-50 border-gray-300"
                onClick={() => handleSave("DRAFT")}
              >
                {isRtl ? "حفظ كمسودة" : "Save as Draft"}
              </Button>
              <Button
                onClick={() => handleSave("CONFIRMED")}
                className="flex-1 h-12 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white shadow-md"
              >
                <Check className={cn("h-5 w-5", isRtl ? "ml-2" : "mr-2")} />
                {isRtl ? "تأكيد وحفظ الخطة" : "Confirm & Save Plan"}
              </Button>
            </div>
            
            <button
              onClick={() => setLocation(`/plans-review/${formattedDate}`)}
              className="w-full text-center text-sm text-cyan-600 hover:text-cyan-700 font-medium py-2 flex items-center justify-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {isRtl ? "الانتقال للمراجعة النهائية والاعتماد" : "Go to Final Review & Approval"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
