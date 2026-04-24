import { format, parseISO } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { Edit2, Trash2, Phone, Calendar, Utensils, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

interface CustomerCardProps {
  customer: any;
  onEdit: (customer: any) => void;
  onDelete: (customerId: string, customerName: string) => void;
}

export function CustomerCard({ customer, onEdit, onDelete }: CustomerCardProps) {
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

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get goal color
  const getGoalColor = (goal: string) => {
    const g = (goal || "").toUpperCase();
    if (g.includes("DIET")) return { bg: "from-orange-50 to-orange-100", text: "text-orange-600", icon: "🍴" };
    if (g.includes("FITNESS")) return { bg: "from-green-50 to-green-100", text: "text-green-600", icon: "💪" };
    if (g.includes("CUSTOMIZED")) return { bg: "from-purple-50 to-purple-100", text: "text-purple-600", icon: "⭐" };
    return { bg: "from-gray-50 to-gray-100", text: "text-gray-600", icon: "🎯" };
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
              ? "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700"
              : "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700"
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
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold shadow-sm bg-gradient-to-r",
              goalStyle.bg,
              goalStyle.text
            )}>
              <span>{goalStyle.icon}</span>
              <span className="truncate">{customer.goals || customer.program}</span>
            </div>
          )}
        </div>

        {/* Date Range & Meals */}
        <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 flex-1">
            <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <span>
              {format(parseISO(sISO), "d MMM", { locale: dateLocale })}
              {" - "}
              {format(parseISO(eISO), "d MMM", { locale: dateLocale })}
            </span>
          </div>
          
          {/* Meals Badge - Highlighted */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm shadow-md">
            <Utensils className="h-4 w-4" />
            <span>
              {customer.mealsPerDay ?? 0}/{customer.snacksPerDay ?? 0}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
