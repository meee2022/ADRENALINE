import { format, parseISO, differenceInDays } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { Edit2, Trash2, Phone, CalendarDays, Utensils, Moon, Sun, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

interface CustomerCardProps {
  customer: any;
  onEdit: (customer: any) => void;
  onDelete: (customerId: string, customerName: string) => void;
  /** فتح نافذة تجميد/استئناف الاشتراك */
  onPause?: (customer: any) => void;
}

export function CustomerCard({ customer, onEdit, onDelete, onPause }: CustomerCardProps) {
  const { t, dir, language } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const dateLocale = language === "ar" ? ar : enUS;

  const safeISOOrToday = (x: any) => {
    if (!x) return format(new Date(), "yyyy-MM-dd");
    try {
      if (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
      return format(new Date(x), "yyyy-MM-dd");
    } catch {
      return format(new Date(), "yyyy-MM-dd");
    }
  };

  const sISO = safeISOOrToday(customer.startDate);
  const eISO = safeISOOrToday(customer.endDate);

  // حساب تقدم الاشتراك
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startD = parseISO(sISO);
  const endD   = parseISO(eISO);
  const totalDays   = Math.max(differenceInDays(endD, startD), 1);
  const passedDays  = Math.max(0, differenceInDays(today, startD));
  const remainDays  = Math.max(0, differenceInDays(endD, today));
  const progress    = Math.min(100, Math.round((passedDays / totalDays) * 100));
  const isExpired   = today > endD;
  const isNotStarted = today < startD;

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get goal color — using brand palette only
  const getGoalColor = (goal: string) => {
    const g = (goal || "").toUpperCase();
    if (g.includes("FITNESS"))    return { bg: "from-cyan-50 to-sky-100",   text: "text-cyan-700",   border: "border-cyan-200",   hex: "#3cc4f0", icon: "💪" };
    if (g.includes("DIET"))       return { bg: "from-blue-50 to-blue-100",   text: "text-blue-700",   border: "border-blue-200",   hex: "#47759c", icon: "🍴" };
    if (g.includes("BULK"))       return { bg: "from-slate-100 to-slate-200",text: "text-slate-800",  border: "border-slate-300",  hex: "#0f1516", icon: "🏋" };
    if (g.includes("CUSTOMIZED")) return { bg: "from-sky-50 to-sky-100",     text: "text-sky-700",    border: "border-sky-200",    hex: "#5a8aad", icon: "⭐" };
    return                               { bg: "from-gray-50 to-gray-100",   text: "text-gray-500",   border: "border-gray-200",   hex: "#bcbebf", icon: "🎯" };
  };

  const goalStyle = getGoalColor(customer.goals || customer.program || "");

  return (
    <Card className="overflow-hidden border shadow-md hover:shadow-xl transition-all duration-300 active:scale-98 bg-gray-50/80">
      {/* Header Section */}
      <div className="p-4 sm:p-5 space-y-3" dir={isRtl ? "rtl" : "ltr"}>
        {/* Top Row: Avatar, Name, Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 text-gray-600 font-bold text-sm sm:text-base shadow-sm">
              {getInitials(customer.fullName)}
            </div>

            {/* Name & Phone */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">
                {customer.fullName}
              </h3>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span dir="ltr" className="truncate">{customer.phone}</span>
              </div>
            </div>

            {/* Active Status Indicator */}
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "h-2 w-2 rounded-full",
                customer.isActive ? "bg-cyan-500 animate-pulse" : "bg-gray-300"
              )} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {onPause && (
              <Button
                variant="ghost"
                size="icon"
                title={isRtl ? "تجميد / استئناف الاشتراك" : "Pause / resume subscription"}
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg hover:bg-amber-50"
                onClick={() => onPause(customer)}
              >
                <PauseCircle
                  className={cn(
                    "h-4 w-4",
                    customer.pausedFrom ? "text-amber-600" : "text-gray-600"
                  )}
                />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg hover:bg-gray-100"
              onClick={() => onEdit(customer)}
            >
              <Edit2 className="h-4 w-4 text-gray-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg hover:bg-red-50"
              onClick={() => onDelete(customer._id, customer.fullName)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>

        {/* Delivery Time & Goal */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Delivery Time Badge */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold shadow-sm",
            customer.deliveryTime === "MORNING"
              ? "bg-gradient-to-r from-cyan-50 to-sky-100 text-cyan-700 border border-cyan-200"
              : "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border border-slate-300"
          )}>
            {customer.deliveryTime === "MORNING" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            <span>
              {isRtl ? (customer.deliveryTime === "MORNING" ? "صباحي" : "مسائي") : (customer.deliveryTime === "MORNING" ? "Morning" : "Evening")}
            </span>
          </div>

          {/* Goal Badge */}
          {(customer.goals || customer.program) && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold shadow-sm bg-gradient-to-r border",
              goalStyle.bg,
              goalStyle.text,
              goalStyle.border
            )}>
              <span>{goalStyle.icon}</span>
              <span className="truncate">{customer.goals || customer.program}</span>
            </div>
          )}
        </div>

        {/* Date Range — prominent */}
        <div className={cn(
          "rounded-xl border p-3 space-y-2",
          isExpired    ? "bg-red-50 border-red-200"
          : isNotStarted ? "bg-blue-50 border-blue-200"
          : "bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200"
        )}>
          {/* Row: icon + dates + meals badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <CalendarDays className={cn(
                "h-4 w-4 flex-shrink-0",
                isExpired ? "text-red-500" : isNotStarted ? "text-blue-500" : "text-cyan-600"
              )} />
              <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold flex-wrap">
                <span className={isExpired ? "text-red-700" : "text-gray-800"}>
                  {format(parseISO(sISO), "d MMM", { locale: dateLocale })}
                </span>
                <span className="text-gray-400 mx-0.5">←</span>
                <span className={isExpired ? "text-red-700" : "text-gray-800"}>
                  {format(parseISO(eISO), "d MMM yyyy", { locale: dateLocale })}
                </span>
              </div>
            </div>

            {/* Meals Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm shadow-sm flex-shrink-0">
              <Utensils className="h-3.5 w-3.5" />
              <span>{customer.mealsPerDay ?? 0}/{customer.snacksPerDay ?? 0}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-white/60 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isExpired    ? "bg-red-400"
                  : isNotStarted ? "bg-[#47759c]"
                  : progress > 80 ? "bg-[#47759c]"
                  : "bg-gradient-to-r from-[#3cc4f0] to-[#47759c]"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-medium">
              <span className="text-gray-500">{progress}%</span>
              <span className={cn(
                "font-bold",
                isExpired    ? "text-red-600"
                : isNotStarted ? "text-[#47759c]"
                : remainDays <= 5 ? "text-[#47759c] font-black"
                : "text-[#3cc4f0]"
              )}>
                {isExpired
                  ? (isRtl ? "منتهي" : "Expired")
                  : isNotStarted
                  ? (isRtl ? `يبدأ بعد ${Math.abs(remainDays - totalDays)} يوم` : `Starts in ${differenceInDays(startD, today)}d`)
                  : isRtl ? `متبقي ${remainDays} يوم` : `${remainDays}d left`
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
