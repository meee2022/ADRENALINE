import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

interface MenuItemCardProps {
  item: any;
  categoryName: string;
  onEdit: (item: any) => void;
  onDelete: (itemId: string, itemName: string) => void;
}

export function MenuItemCard({ item, categoryName, onEdit, onDelete }: MenuItemCardProps) {
  const { t, dir, language } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  // Get category icon and color
  const getCategoryStyle = (cat: string) => {
    const c = cat.toUpperCase();
    if (c.includes("BREAKFAST") || c.includes("فطور")) {
      return { 
        icon: "☀️", 
        bg: "from-orange-400 to-orange-500",
        label: isRtl ? "فطور" : "Breakfast",
        lightBg: "bg-orange-50"
      };
    }
    if (c.includes("LUNCH") || c.includes("غداء")) {
      return { 
        icon: "🍽️", 
        bg: "from-blue-400 to-blue-500",
        label: isRtl ? "غداء" : "Lunch",
        lightBg: "bg-blue-50"
      };
    }
    if (c.includes("DINNER") || c.includes("عشاء")) {
      return { 
        icon: "🌙", 
        bg: "from-purple-400 to-purple-500",
        label: isRtl ? "عشاء" : "Dinner",
        lightBg: "bg-purple-50"
      };
    }
    if (c.includes("SNACK") || c.includes("سناك")) {
      return { 
        icon: "🥗", 
        bg: "from-green-400 to-green-500",
        label: isRtl ? "سناك" : "Snacks",
        lightBg: "bg-green-50"
      };
    }
    return { 
      icon: "•••", 
      bg: "from-gray-400 to-gray-500",
      label: isRtl ? "أخرى" : "Other",
      lightBg: "bg-gray-50"
    };
  };

  const categoryStyle = getCategoryStyle(categoryName);

  return (
    <Card className={cn(
      "overflow-hidden border shadow-md hover:shadow-xl transition-all duration-300 active:scale-98",
      categoryStyle.lightBg
    )}>
      <div className="p-4 sm:p-5 space-y-3" dir={isRtl ? "rtl" : "ltr"}>
        {/* Header: Category Badge & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-lg bg-gradient-to-r",
            categoryStyle.bg
          )}>
            <span className="text-base">{categoryStyle.icon}</span>
            <span>{categoryStyle.label}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-white/80"
              onClick={() => onEdit(item)}
            >
              <Edit2 className="h-4 w-4 text-gray-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-red-50"
              onClick={() => onDelete(item._id, item.name)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>

        {/* Meal Name */}
        <div className="bg-white/80 rounded-xl p-3 border border-white/50">
          <h3 className="font-bold text-base sm:text-lg text-gray-900 line-clamp-2">
            {item.name}
          </h3>
        </div>

        {/* Calories & Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-white/80 rounded-lg px-3 py-2 flex-1 border border-white/50">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-xs text-gray-500">
                {isRtl ? "السعرات" : "Calories"}
              </p>
              <p className="text-lg font-bold text-gray-900">
                {item.calories || 0}
              </p>
            </div>
          </div>

          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm",
            item.isActive 
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md" 
              : "bg-gray-200 text-gray-500"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              item.isActive ? "bg-white animate-pulse" : "bg-gray-400"
            )} />
            <span>{item.isActive ? (isRtl ? "نشط" : "Active") : (isRtl ? "غير نشط" : "Inactive")}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
