// client/src/pages/Dashboard.tsx
/**
 * @file client/src/pages/Dashboard.tsx
 * @description لوحة التحكم الرئيسية - إحصائيات وتقارير (مع اختيار تاريخ + Drilldown) + Expiry Alerts
 * @convex convex/customers.ts, convex/dailyPlans.ts, convex/menuItems.ts, convex/mealCategories.ts, convex/modifiers.ts
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useCustomers,
  useDailyPlans,
  useMenuItems,
  useCategories,
  useModifiers,
  useInventorySummary,
} from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  CalendarCheck,
  Sun,
  Moon,
  Calendar as CalendarIcon,
  Package,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  addDays,
  format,
  subDays,
  isSameDay,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import { ar, enUS } from "date-fns/locale";

import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DrillRow = {
  date: string;
  customerName: string;
  customerPhone?: string;
  customerEndDate?: string;

  deliveryTime: string;
  categoryName: string;
  mealName: string;

  portionText: string;
  avoidText: string;
  prefsText: string;

  specialNotes: string;
};

function safeParseDate(dateStr: string) {
  try {
    return parseISO(dateStr);
  } catch {
    return null;
  }
}

function idsToText(ids: any[] | undefined, all: any[]) {
  const names = (ids ?? [])
    .map((id) => all.find((x: any) => String(x._id) === String(id))?.name)
    .filter(Boolean);
  return names.length ? names.join(" + ") : "";
}

/**
 * ✅ نحاول نقرأ نفس شكل "المطبخ" من plan.items
 * لو عندك أسماء حقول مختلفة داخل it، غيّرها هنا فقط.
 */
function getPortionText(it: any, modifiers: any[]) {
  if (it?.portion) return String(it.portion);
  if (it?.portionId) return idsToText([it.portionId], modifiers);
  if (Array.isArray(it?.portionIds)) return idsToText(it.portionIds, modifiers);

  if (Array.isArray(it?.modifierIds)) {
    const portion = (it.modifierIds as any[])
      .map((id) => modifiers.find((m: any) => String(m._id) === String(id)))
      .filter((m: any) => m && m.group === "PORTION")
      .map((m: any) => m.name);
    return portion.length ? portion.join(" + ") : "";
  }

  return "";
}

function getAvoidText(it: any, modifiers: any[]) {
  if (Array.isArray(it?.avoidIds)) return idsToText(it.avoidIds, modifiers);

  if (Array.isArray(it?.avoid)) {
    const arr = (it.avoid as any[])
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? arr.join(" + ") : "";
  }

  if (Array.isArray(it?.modifierIds)) {
    const avoid = (it.modifierIds as any[])
      .map((id) => modifiers.find((m: any) => String(m._id) === String(id)))
      .filter((m: any) => m && m.group === "AVOID")
      .map((m: any) => m.name);
    return avoid.length ? avoid.join(" + ") : "";
  }

  return "";
}

function getPrefsText(it: any, modifiers: any[]) {
  if (Array.isArray(it?.prefIds)) return idsToText(it.prefIds, modifiers);

  if (Array.isArray(it?.prefs)) {
    const arr = (it.prefs as any[])
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? arr.join(" + ") : "";
  }

  if (Array.isArray(it?.modifierIds)) {
    const pref = (it.modifierIds as any[])
      .map((id) => modifiers.find((m: any) => String(m._id) === String(id)))
      .filter((m: any) => m && m.group === "PREF")
      .map((m: any) => m.name);
    return pref.length ? pref.join(" + ") : "";
  }

  return "";
}

// ✅ Chip ملون (بديل Badge الأبيض)
function Chip({
  text,
  tone,
}: {
  text: string;
  tone: "portion" | "avoid" | "pref" | "standard";
}) {
  const cls =
    tone === "portion"
      ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
      : tone === "avoid"
        ? "bg-red-500/15 text-red-200 border-red-500/40"
        : tone === "pref"
          ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
          : "bg-muted/40 text-muted-foreground border-border/60";

  return (
    <span className={`px-2 py-1 rounded-full border text-xs ${cls}`}>
      {text}
    </span>
  );
}

/* =========================
   Expiry helpers (Dashboard)
========================= */
function daysLeftISO(endISO: string) {
  try {
    const end = parseISO(endISO);
    const today = new Date();
    return differenceInCalendarDays(end, today);
  } catch {
    return 9999;
  }
}
function expiryBucket(daysLeft: number) {
  if (daysLeft < 0) return "expired";
  if (daysLeft === 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  if (daysLeft <= 3) return "3days";
  if (daysLeft <= 7) return "7days";
  return "ok";
}

export default function Dashboard() {
  const { data: customers = [] } = useCustomers();
  const { data: dailyPlans = [] } = useDailyPlans();;
  const { data: menuItems = [] } = useMenuItems();
  const { data: categories = [] } = useCategories();
  const { data: modifiers = [] } = useModifiers();
  const { data: inventorySummary } = useInventorySummary();
  const [, setLocation] = useLocation();

  const { t, language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const dateLocale = language === "ar" ? ar : enUS;

  // =========================
  // ✅ Date selection
  // =========================
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // =========================
  // ✅ Plans for selected date
  // =========================
  const plansForSelectedDate = useMemo(() => {
    return dailyPlans.filter((p: any) => {
      const d = safeParseDate(p.date);
      if (!d) return false;
      return isSameDay(d, selectedDate);
    });
  }, [dailyPlans, selectedDate]);

  const activeCustomers = useMemo(
    () => customers.filter((c: any) => c.isActive).length,
    [customers],
  );

  const morningPlans = useMemo(
    () =>
      plansForSelectedDate.filter((p: any) => p.deliveryTime === "MORNING")
        .length,
    [plansForSelectedDate],
  );

  const eveningPlans = useMemo(
    () =>
      plansForSelectedDate.filter((p: any) => p.deliveryTime === "EVENING")
        .length,
    [plansForSelectedDate],
  );

  // =========================
  // ✅ helper: count meals for a given day (عدد الوجبات الفعلية)
  // =========================
  const countMealsForDate = (d: Date) => {
    let total = 0;
    for (const plan of dailyPlans as any[]) {
      const pd = safeParseDate(plan.date);
      if (!pd) continue;
      if (!isSameDay(pd, d)) continue;

      const items = (plan.items || []) as any[];
      for (const it of items) {
        if (!it) continue;
        if (it.isOff) continue;
        if (!it.menuItemId) continue;
        total += 1;
      }
    }
    return total;
  };

  // =========================
  // ✅ Weekly chart
  // =========================
  const baseChartData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(today, 6 - i);
      const count = dailyPlans.filter((p: any) => {
        const pd = safeParseDate(p.date);
        if (!pd) return false;
        return isSameDay(pd, d);
      }).length;

      return {
        name: format(d, "EEE", { locale: dateLocale }),
        plans: count,
      };
    });
  }, [dailyPlans, dateLocale]);

  const chartData = isRtl ? [...baseChartData].reverse() : baseChartData;

  // =========================
  //   ✅ Drill-down Dialog state
  // =========================
  const [openDrill, setOpenDrill] = useState(false);
  const [drillTitle, setDrillTitle] = useState("");
  const [drillRows, setDrillRows] = useState<DrillRow[]>([]);
  
  // =========================
  //   ✅ Stats Card Dialog state
  // =========================
  const [openStats, setOpenStats] = useState(false);
  const [statsTitle, setStatsTitle] = useState("");
  const [statsCustomers, setStatsCustomers] = useState<any[]>([]);

  // =========================
  // ✅ Expiry Dialog state
  // =========================
  const [openExp, setOpenExp] = useState(false);
  const [expTitle, setExpTitle] = useState("");
  const [expRows, setExpRows] = useState<any[]>([]);

  const COLORS = [
    "#1DC2F7",
    "#5DD5FA",
    "#8FE3FC",
    "#1DA8D8",
    "#1890BD",
    "#147DA3",
  ];

  // =========================
  // ✅ Meal stats FOR selected date
  // =========================
  const mealStats = useMemo(() => {
    const counts = new Map<string, number>();

    for (const plan of plansForSelectedDate as any[]) {
      const items = (plan.items || []) as any[];
      for (const it of items) {
        if (!it) continue;
        if (it.isOff) continue;
        if (!it.menuItemId) continue;

        const key = String(it.menuItemId);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([menuItemId, count]) => {
        const meal = menuItems.find(
          (m: any) => String(m._id) === String(menuItemId),
        );
        return { menuItemId, name: meal?.name || "UNKNOWN", count };
      })
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [plansForSelectedDate, menuItems]);

  // =========================
  // ✅ Drill: details for a meal on selected date
  // =========================
  const openMealDetails = (menuItemId: string) => {
    const meal = menuItems.find(
      (m: any) => String(m._id) === String(menuItemId),
    );
    const mealName = meal?.name || "UNKNOWN";

    const rows: DrillRow[] = [];

    for (const plan of plansForSelectedDate as any[]) {
      const cust = customers.find(
        (c: any) => String(c._id) === String(plan.customerId),
      );
      const custName = cust?.fullName || "UNKNOWN";

      const items = (plan.items || []) as any[];
      for (const it of items) {
        if (!it || it.isOff) continue;
        if (!it.menuItemId) continue;
        if (String(it.menuItemId) !== String(menuItemId)) continue;

        const catName =
          categories.find((c: any) => String(c._id) === String(it.categoryId))
            ?.name || (isRtl ? "غير محدد" : "Unknown");

        const portionText = getPortionText(it, modifiers);
        const avoidText = getAvoidText(it, modifiers);
        const prefsText = getPrefsText(it, modifiers);

        rows.push({
          date: plan.date,
          customerName: custName,
          customerPhone: cust?.phone,
          customerEndDate: cust?.endDate,

          deliveryTime: plan.deliveryTime,
          categoryName: catName,
          mealName,

          portionText,
          avoidText,
          prefsText,

          specialNotes: it.specialNotes || "",
        });
      }
    }

    rows.sort((a, b) => {
      if (a.deliveryTime !== b.deliveryTime)
        return a.deliveryTime.localeCompare(b.deliveryTime);
      if (a.categoryName !== b.categoryName)
        return a.categoryName.localeCompare(b.categoryName);
      return a.customerName.localeCompare(b.customerName);
    });

    setDrillTitle(`${mealName} — ${rows.length}`);
    setDrillRows(rows);
    setOpenDrill(true);
  };

  const stats = [
    {
      title: t("stats.active_customers"),
      value: activeCustomers,
      icon: Users,
      color: "text-cyan-500",
      bgColor: "bg-gradient-to-br from-cyan-50 to-cyan-100",
      iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-500",
      onClick: () => openStatsDetails("active"),
    },
    {
      title: t("stats.plans_today"),
      value: plansForSelectedDate.length,
      icon: CalendarCheck,
      color: "text-emerald-500",
      bgColor: "bg-gradient-to-br from-emerald-50 to-emerald-100",
      iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-500",
      onClick: () => openStatsDetails("plansToday"),
    },
    {
      title: t("stats.morning_delivery"),
      value: morningPlans,
      icon: Sun,
      color: "text-amber-500",
      bgColor: "bg-gradient-to-br from-amber-50 to-amber-100",
      iconBg: "bg-gradient-to-br from-amber-400 to-amber-500",
      onClick: () => openStatsDetails("morning"),
    },
    {
      title: t("stats.evening_delivery"),
      value: eveningPlans,
      icon: Moon,
      color: "text-indigo-500",
      bgColor: "bg-gradient-to-br from-indigo-50 to-indigo-100",
      iconBg: "bg-gradient-to-br from-indigo-400 to-indigo-500",
      onClick: () => openStatsDetails("evening"),
    },
  ];

  const todayMealsCount = countMealsForDate(new Date());
  const tomorrowMealsCount = countMealsForDate(addDays(new Date(), 1));
  const nextDayMealsCount = countMealsForDate(addDays(new Date(), 2));

  // ✅ تفاصيل: لو مفيش كمية/ممنوع/تفضيل => Standard
  const renderDetails = (r: DrillRow) => {
    const parts: { label: string; text: string; tone: any }[] = [];

    if (r.portionText)
      parts.push({
        label: isRtl ? "كمية" : "Portion",
        text: r.portionText,
        tone: "portion",
      });
    if (r.avoidText)
      parts.push({
        label: isRtl ? "ممنوع" : "Avoid",
        text: r.avoidText,
        tone: "avoid",
      });
    if (r.prefsText)
      parts.push({
        label: isRtl ? "تفضيل" : "Prefs",
        text: r.prefsText,
        tone: "pref",
      });

    if (!parts.length) return <Chip text="Standard" tone="standard" />;

    return (
      <div className="flex flex-wrap gap-2">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{p.label}:</span>
            <Chip text={p.text} tone={p.tone} />
          </div>
        ))}
      </div>
    );
  };

  // =========================
  // ✅ Expiry stats + open list
  // =========================
  const customersWithExpiry = useMemo(() => {
    return (customers as any[]).map((c) => {
      const endISO = String(c.endDate || "");
      const left = endISO ? daysLeftISO(endISO) : 9999;
      return { ...c, endISO, daysLeft: left, bucket: expiryBucket(left) };
    });
  }, [customers]);

  const expCounts = useMemo(() => {
    const x = { expired: 0, today: 0, tomorrow: 0, d3: 0, d7: 0 };
    for (const c of customersWithExpiry as any[]) {
      // ✅ نحسب الـ expired حتى لو isActive: false
      if (c.bucket === "expired") x.expired++;
      // ✅ باقي الفئات نحسبها فقط للنشطين
      else if (c.isActive) {
        if (c.bucket === "today") x.today++;
        else if (c.bucket === "tomorrow") x.tomorrow++;
        else if (c.bucket === "3days") x.d3++;
        else if (c.bucket === "7days") x.d7++;
      }
    }
    return x;
  }, [customersWithExpiry]);

  const openExpiryList = (
    bucket: "expired" | "today" | "tomorrow" | "3days" | "7days",
  ) => {
    const title =
      bucket === "expired"
        ? isRtl
          ? "اشتراكات منتهية"
          : "Expired subscriptions"
        : bucket === "today"
          ? isRtl
            ? "تنتهي اليوم"
            : "Ends today"
          : bucket === "tomorrow"
            ? isRtl
              ? "تنتهي بكرة"
              : "Ends tomorrow"
            : bucket === "3days"
              ? isRtl
                ? "تنتهي خلال 3 أيام"
                : "Ends in 3 days"
              : isRtl
                ? "تنتهي خلال 7 أيام"
                : "Ends in 7 days";

    const rows = (customersWithExpiry as any[])
      .filter((c) => {
        // ✅ للـ expired: نعرض الكل سواء نشط أو لا
        if (bucket === "expired") return c.bucket === bucket;
        // ✅ باقي الفئات: نعرض فقط النشطين
        return c.isActive && c.bucket === bucket;
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    console.log("=== openExpiryList Debug ===");
    console.log("Bucket:", bucket);
    console.log("Total customersWithExpiry:", customersWithExpiry.length);
    console.log("Filtered rows:", rows.length);
    console.log("Sample row:", rows[0]);
    console.log("===========================");

    setExpTitle(title);
    setExpRows(rows);
    setOpenExp(true);
  };

  // =========================
  // ✅ Open Stats Card Details
  // =========================
  const openStatsDetails = (type: "active" | "plansToday" | "morning" | "evening") => {
    let title = "";
    let customersList: any[] = [];

    if (type === "active") {
      title = isRtl ? "المشتركين النشطين" : "Active Customers";
      customersList = customers.filter((c: any) => c.isActive);
    } else if (type === "plansToday") {
      title = isRtl ? `خطط اليوم - ${format(selectedDate, "yyyy-MM-dd")}` : `Plans for ${format(selectedDate, "yyyy-MM-dd")}`;
      
      // ✅ نجمع الـ customers من الـ plans (سواء customerId أو customerName)
      const customerMap = new Map();
      
      plansForSelectedDate.forEach((p: any) => {
        if (p.customerId) {
          // لو عنده customerId، نجيب الـ customer من القاعدة
          const customer = customers.find((c: any) => c._id === p.customerId);
          if (customer) {
            customerMap.set(customer._id, customer);
          }
        } else if (p.customerName) {
          // لو عنده customerName بس (عميل جديد)، نعمله fake customer object
          const fakeId = `temp_${p.customerName}_${p.date}`;
          if (!customerMap.has(fakeId)) {
            customerMap.set(fakeId, {
              _id: fakeId,
              fullName: p.customerName,
              phone: "-",
              program: "-",
              endDate: "-",
              isActive: true,
            });
          }
        }
      });
      
      customersList = Array.from(customerMap.values());
      
    } else if (type === "morning") {
      title = isRtl ? `توصيل صباحي - ${format(selectedDate, "yyyy-MM-dd")}` : `Morning Delivery - ${format(selectedDate, "yyyy-MM-dd")}`;
      
      const customerMap = new Map();
      
      plansForSelectedDate
        .filter((p: any) => p.deliveryTime === "MORNING")
        .forEach((p: any) => {
          if (p.customerId) {
            const customer = customers.find((c: any) => c._id === p.customerId);
            if (customer) {
              customerMap.set(customer._id, customer);
            }
          } else if (p.customerName) {
            const fakeId = `temp_${p.customerName}_${p.date}`;
            if (!customerMap.has(fakeId)) {
              customerMap.set(fakeId, {
                _id: fakeId,
                fullName: p.customerName,
                phone: "-",
                program: "-",
                endDate: "-",
                isActive: true,
              });
            }
          }
        });
      
      customersList = Array.from(customerMap.values());
      
    } else if (type === "evening") {
      title = isRtl ? `توصيل مسائي - ${format(selectedDate, "yyyy-MM-dd")}` : `Evening Delivery - ${format(selectedDate, "yyyy-MM-dd")}`;
      
      const customerMap = new Map();
      
      plansForSelectedDate
        .filter((p: any) => p.deliveryTime === "EVENING")
        .forEach((p: any) => {
          if (p.customerId) {
            const customer = customers.find((c: any) => c._id === p.customerId);
            if (customer) {
              customerMap.set(customer._id, customer);
            }
          } else if (p.customerName) {
            const fakeId = `temp_${p.customerName}_${p.date}`;
            if (!customerMap.has(fakeId)) {
              customerMap.set(fakeId, {
                _id: fakeId,
                fullName: p.customerName,
                phone: "-",
                program: "-",
                endDate: "-",
                isActive: true,
              });
            }
          }
        });
      
      customersList = Array.from(customerMap.values());
    }

    setStatsTitle(title);
    setStatsCustomers(customersList);
    setOpenStats(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight font-heading">
          {t("dashboard.title")}
        </h2>

        <div
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto",
            isRtl ? "flex-row-reverse" : "flex-row",
          )}
        >
          {/* Quick buttons */}
          <div
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none",
              isRtl ? "flex-row-reverse" : "flex-row",
            )}
          >
            <Button
              variant={
                isSameDay(selectedDate, new Date()) ? "default" : "outline"
              }
              size="sm"
              className="text-xs sm:text-sm flex-1 sm:flex-none"
              onClick={() => setSelectedDate(new Date())}
            >
              {isRtl
                ? `اليوم (${todayMealsCount})`
                : `Today (${todayMealsCount})`}
            </Button>

            <Button
              variant={
                isSameDay(selectedDate, addDays(new Date(), 1))
                  ? "default"
                  : "outline"
              }
              size="sm"
              className="text-xs sm:text-sm flex-1 sm:flex-none"
              onClick={() => setSelectedDate(addDays(new Date(), 1))}
            >
              {isRtl
                ? `بكرة (${tomorrowMealsCount})`
                : `Tomorrow (${tomorrowMealsCount})`}
            </Button>

            <Button
              variant={
                isSameDay(selectedDate, addDays(new Date(), 2))
                  ? "default"
                  : "outline"
              }
              size="sm"
              className="text-xs sm:text-sm flex-1 sm:flex-none"
              onClick={() => setSelectedDate(addDays(new Date(), 2))}
            >
              {isRtl
                ? `بعده (${nextDayMealsCount})`
                : `Next day (${nextDayMealsCount})`}
            </Button>
          </div>

          {/* Calendar */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start">
                <CalendarIcon
                  className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")}
                />
                {format(selectedDate, "EEEE, d MMMM yyyy", {
                  locale: dateLocale,
                })}
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-auto p-0"
              align={isRtl ? "end" : "start"}
            >
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  if (d) setSelectedDate(d);
                  setIsCalendarOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 active:scale-95 md:hover:scale-105 cursor-pointer"
            onClick={stat.onClick}
          >
            <div className={cn("p-3 sm:p-4 md:p-6", stat.bgColor)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-2 md:pb-3">
                <CardTitle className="text-xs sm:text-sm font-semibold text-gray-700 leading-tight">
                  {stat.title}
                </CardTitle>
                <div className={cn("h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shrink-0", stat.iconBg)}>
                  <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{stat.value}</div>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>

      {/* Inventory Widget */}
      {inventorySummary && (
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-cyan-600" />
              {isRtl ? "ملخص المخزون" : "Inventory Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-gray-600">{isRtl ? "إجمالي المواد" : "Total Items"}</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">{inventorySummary.totalItems}</p>
              </div>
              
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <p className="text-xs text-gray-600">{isRtl ? "نقص مخزون" : "Low Stock"}</p>
                </div>
                <p className="text-2xl font-bold text-orange-600">{inventorySummary.lowStockCount}</p>
              </div>

              <div className="bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarIcon className="h-4 w-4 text-red-600" />
                  <p className="text-xs text-gray-600">{isRtl ? "تنتهي قريباً" : "Expiring"}</p>
                </div>
                <p className="text-2xl font-bold text-red-600">{inventorySummary.expiringSoonCount}</p>
              </div>

              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-gray-600">{isRtl ? "قيمة المخزون" : "Stock Value"}</p>
                </div>
                <p className="text-xl font-bold text-green-600">{inventorySummary.stockValue.toLocaleString()} QAR</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => setLocation("/inventory")}
            >
              {isRtl ? "عرض المخزون الكامل" : "View Full Inventory"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Expiry cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card
          className="cursor-pointer transition-all duration-300 active:scale-95 md:hover:scale-105 overflow-hidden border-0 bg-gradient-to-br from-red-50 to-red-100 shadow-md hover:shadow-xl"
          onClick={() => openExpiryList("expired")}
        >
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-semibold text-red-700 flex items-center gap-1 sm:gap-2">
              <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-red-500 animate-pulse" />
              {isRtl ? "منتهي" : "Expired"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-red-600">{expCounts.expired}</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all duration-300 active:scale-95 md:hover:scale-105 overflow-hidden border-0 bg-gradient-to-br from-orange-50 to-orange-100 shadow-md hover:shadow-xl"
          onClick={() => openExpiryList("today")}
        >
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-semibold text-orange-700 flex items-center gap-1 sm:gap-2">
              <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-orange-500 animate-pulse" />
              {isRtl ? "ينتهي اليوم" : "Ends today"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-orange-600">{expCounts.today}</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all duration-300 active:scale-95 md:hover:scale-105 overflow-hidden border-0 bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-md hover:shadow-xl"
          onClick={() => openExpiryList("tomorrow")}
        >
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-semibold text-yellow-700 flex items-center gap-1 sm:gap-2">
              <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-yellow-500 animate-pulse" />
              {isRtl ? "ينتهي بكرة" : "Ends tomorrow"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-yellow-700">{expCounts.tomorrow}</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all duration-300 active:scale-95 md:hover:scale-105 overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md hover:shadow-xl"
          onClick={() => openExpiryList("3days")}
        >
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-semibold text-blue-700 flex items-center gap-1 sm:gap-2">
              <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-blue-500" />
              {isRtl ? "خلال 3 أيام" : "Next 3 days"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">{expCounts.d3}</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-all duration-300 active:scale-95 md:hover:scale-105 overflow-hidden border-0 bg-gradient-to-br from-green-50 to-green-100 shadow-md hover:shadow-xl"
          onClick={() => openExpiryList("7days")}
        >
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-semibold text-green-700 flex items-center gap-1 sm:gap-2">
              <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500" />
              {isRtl ? "خلال 7 أيام" : "Next 7 days"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">{expCounts.d7}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts + meals breakdown */}
      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-lg border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 border-b">
            <CardTitle className="text-lg font-bold text-gray-800">{t("chart.weekly_overview")}</CardTitle>
          </CardHeader>

          <CardContent className={cn("pr-2 pt-6", isRtl ? "pr-2" : "pl-2")}>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    reversed={isRtl}
                    tick={{ textAnchor: isRtl ? "end" : "start" }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                    orientation={isRtl ? "right" : "left"}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(29, 194, 247, 0.1)" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      backgroundColor: "white",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
                      textAlign: isRtl ? "right" : "left",
                      direction: isRtl ? "rtl" : "ltr",
                      unicodeBidi: "plaintext",
                    }}
                  />
                  <Bar
                    dataKey="plans"
                    fill="url(#colorGradient)"
                    radius={[8, 8, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1DC2F7" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#5DD5FA" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-lg border-0 overflow-hidden flex flex-col">
          <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 border-b p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg font-bold text-gray-800">
              {isRtl
                ? "تفاصيل وجبات اليوم المحدد"
                : "Meals breakdown (selected date)"}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 overflow-auto pt-3 sm:pt-6 p-3 sm:p-6">
            {mealStats.length > 0 ? (
              <div className="space-y-2 sm:space-y-4">
                {mealStats.map((item, index) => (
                  <div
                    key={item.menuItemId}
                    className={cn(
                      "flex items-center justify-between p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-all active:scale-95",
                      isRtl ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2 sm:gap-3 min-w-0 flex-1",
                        isRtl ? "flex-row-reverse" : "flex-row",
                      )}
                    >
                      <div
                        className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full shadow-sm shrink-0"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                      <span className="text-xs sm:text-sm font-semibold text-gray-700 truncate">{item.name}</span>
                    </div>

                    <button
                      className="font-bold text-sm sm:text-base text-cyan-600 hover:text-cyan-700 underline underline-offset-2 sm:underline-offset-4 hover:opacity-80 transition-all shrink-0"
                      onClick={() => openMealDetails(item.menuItemId)}
                      title={isRtl ? "عرض تفاصيل الوجبات" : "View meal details"}
                    >
                      {item.count}
                    </button>
                  </div>
                ))}

                <div className="h-[200px] mt-4 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mealStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {mealStats.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: "hsl(var(--card))",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                          textAlign: isRtl ? "right" : "left",
                          direction: isRtl ? "rtl" : "ltr",
                          unicodeBidi: "plaintext",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                {isRtl
                  ? "لا توجد وجبات لهذا التاريخ."
                  : "No meals for this date."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drill-down Dialog */}
      <Dialog open={openDrill} onOpenChange={setOpenDrill}>
        <DialogContent className="max-w-6xl" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className={isRtl ? "text-right" : "text-left"}>
              {drillTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRtl ? "الوقت" : "Time"}</TableHead>
                  <TableHead>{isRtl ? "التصنيف" : "Category"}</TableHead>
                  <TableHead>{isRtl ? "العميل" : "Customer"}</TableHead>
                  <TableHead>{isRtl ? "التفاصيل" : "Details"}</TableHead>
                  <TableHead>{isRtl ? "ملاحظات" : "Notes"}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {drillRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-10"
                    >
                      {isRtl ? "لا توجد تفاصيل." : "No details."}
                    </TableCell>
                  </TableRow>
                ) : (
                  drillRows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Badge variant="outline">
                          {r.deliveryTime === "MORNING"
                            ? isRtl
                              ? "صباحي"
                              : "Morning"
                            : isRtl
                              ? "مسائي"
                              : "Evening"}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-medium">
                        {r.categoryName}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.customerName}
                      </TableCell>
                      <TableCell>{renderDetails(r)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.specialNotes || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-xs text-muted-foreground">
            {isRtl
              ? `ملاحظة: هذه التفاصيل تخص التاريخ المحدد: ${format(selectedDate, "yyyy-MM-dd")}`
              : `Note: Details are for selected date: ${format(selectedDate, "yyyy-MM-dd")}`}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expiry Dialog */}
      <Dialog open={openExp} onOpenChange={setOpenExp}>
        <DialogContent 
          className="max-w-5xl bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200" 
          dir={isRtl ? "rtl" : "ltr"}
          aria-describedby="expiry-dialog-description"
        >
          <DialogHeader className="border-b-2 border-cyan-300 pb-4">
            <DialogTitle className={cn(
              "text-2xl font-bold text-center flex items-center justify-between",
              isRtl ? "flex-row-reverse" : "flex-row"
            )}>
              <span className="text-cyan-700">{expTitle}</span>
              <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-2 rounded-xl shadow-lg">
                <span className="text-2xl font-bold">{expRows.length}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div
            id="expiry-dialog-description"
            className="max-h-[70vh] overflow-auto space-y-3 p-4"
          >
            {expRows.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-xl font-bold text-gray-500">
                  {isRtl ? "لا يوجد عملاء في هذه الفئة" : "No customers in this group"}
                </p>
              </div>
            ) : (
              expRows.map((c: any, idx: number) => (
                <div
                  key={c._id ?? idx}
                  className="bg-white rounded-xl px-5 py-4 shadow-sm border border-cyan-100
                             flex items-center justify-between gap-4 hover:shadow-md
                             transition-all"
                >
                  {/* الاسم */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1 font-medium">
                      {isRtl ? "العميل" : "Customer"}
                    </p>
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {c.fullName || c.customerName || c.name || (isRtl ? "بدون اسم" : "Unknown")}
                    </p>
                  </div>

                  {/* الجوال */}
                  <div className="w-40">
                    <p className="text-xs text-gray-500 mb-1 font-medium">
                      {isRtl ? "الهاتف" : "Phone"}
                    </p>
                    <p className="text-sm font-semibold text-cyan-700" dir="ltr">
                      {c.phone || "-"}
                    </p>
                  </div>

                  {/* تاريخ الانتهاء */}
                  <div className="w-40">
                    <p className="text-xs text-gray-500 mb-1 font-medium">
                      {isRtl ? "تاريخ الانتهاء" : "End date"}
                    </p>
                    <p className="text-sm font-semibold text-gray-700">
                      {c.endISO || "-"}
                    </p>
                  </div>

                  {/* المتبقي / منتهي */}
                  <div className="w-32 text-center">
                    <p className="text-xs text-gray-500 mb-1 font-medium">
                      {isRtl ? "المتبقي" : "Days left"}
                    </p>
                    <div
                      className={cn(
                        "inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-bold text-white",
                        c.daysLeft < 0
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : c.daysLeft === 0
                          ? "bg-gradient-to-r from-orange-500 to-orange-600"
                          : c.daysLeft === 1
                          ? "bg-gradient-to-r from-amber-500 to-amber-600"
                          : "bg-gradient-to-r from-green-500 to-green-600"
                      )}
                    >
                      {c.daysLeft < 0
                        ? isRtl
                          ? "منتهي"
                          : "Expired"
                        : c.daysLeft === 0
                        ? (isRtl ? "اليوم" : "Today")
                        : c.daysLeft === 1
                        ? (isRtl ? "غدًا" : "Tomorrow")
                        : isRtl
                        ? `${c.daysLeft} يوم`
                        : `${c.daysLeft} days`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Card Dialog */}
      <Dialog open={openStats} onOpenChange={setOpenStats}>
        <DialogContent 
          className="max-w-4xl" 
          dir={isRtl ? "rtl" : "ltr"}
          aria-describedby="stats-dialog-description"
        >
          <DialogHeader>
            <DialogTitle className={isRtl ? "text-right" : "text-left"}>
              {statsTitle} — {statsCustomers.length}
            </DialogTitle>
          </DialogHeader>

          <div id="stats-dialog-description" className="max-h-[65vh] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRtl ? "العميل" : "Customer"}</TableHead>
                  <TableHead>{isRtl ? "الهاتف" : "Phone"}</TableHead>
                  <TableHead>{isRtl ? "البرنامج" : "Program"}</TableHead>
                  <TableHead>{isRtl ? "تاريخ الانتهاء" : "End date"}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {statsCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-10"
                    >
                      <div className="space-y-3">
                        <p className="text-xl font-bold text-gray-700">
                          {isRtl ? "لا توجد بيانات" : "No data available"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {isRtl 
                            ? "لا يوجد مشتركين مطابقين للفلتر المحدد" 
                            : "No customers match the selected filter"}
                        </p>
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                          <p className="font-medium mb-1">
                            {isRtl ? "ملاحظة:" : "Note:"}
                          </p>
                          <p>
                            {isRtl 
                              ? "تأكد من وجود عملاء في قاعدة البيانات، أو جرب إضافة عملاء جدد من صفحة 'العملاء'" 
                              : "Make sure there are customers in the database, or try adding new customers from the 'Customers' page"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  statsCustomers.map((c: any) => (
                    <TableRow key={c._id}>
                      <TableCell className="font-medium">
                        {c.fullName || "UNKNOWN"}
                      </TableCell>
                      <TableCell dir="ltr">{c.phone || "-"}</TableCell>
                      <TableCell>{c.program || "-"}</TableCell>
                      <TableCell>{c.endDate || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <div className="text-[10px] text-muted-foreground/50 mt-8">
        Dashboard.tsx
      </div>
    </div>
  );
}
