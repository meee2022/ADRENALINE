import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import {
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  CalendarDays,
  ChefHat,
  Truck,
  Sticker,
  Package,
  Home,
  Shield,
} from "lucide-react";

export function MobileBottomNav() {
  const [location] = useLocation();
  const { currentUser } = useStore();
  const { t, dir, language } = useLanguage();

  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  const menuItems = [
    {
      href: "/",
      icon: Home,
      label: isRtl ? "الرئيسية" : "Home",
      roles: ["ADMIN", "KITCHEN", "DELIVERY"],
    },
    {
      href: "/dashboard",
      icon: LayoutDashboard,
      label: isRtl ? "لوحة التحكم" : "Dashboard",
      roles: ["ADMIN"],
    },
    {
      href: "/customers",
      icon: Users,
      label: isRtl ? "العملاء" : "Customers",
      roles: ["ADMIN"],
    },
    {
      href: "/users",
      icon: Shield,
      label: isRtl ? "الحسابات" : "Users",
      roles: ["ADMIN"],
    },
    {
      href: "/menu",
      icon: UtensilsCrossed,
      label: isRtl ? "القائمة" : "Menu",
      roles: ["ADMIN"],
    },
    {
      href: "/plans",
      icon: CalendarDays,
      label: isRtl ? "الخطط" : "Plans",
      roles: ["ADMIN"],
    },
    {
      href: "/inventory",
      icon: Package,
      label: isRtl ? "المخزون" : "Inventory",
      roles: ["ADMIN"],
    },
    {
      href: "/kitchen",
      icon: ChefHat,
      label: isRtl ? "المطبخ" : "Kitchen",
      roles: ["ADMIN", "KITCHEN"],
    },
    {
      href: "/delivery",
      icon: Truck,
      label: isRtl ? "التوصيل" : "Delivery",
      roles: ["ADMIN", "DELIVERY"],
    },
    {
      href: "/stickers",
      icon: Sticker,
      label: isRtl ? "الستيكرات" : "Stickers",
      roles: ["ADMIN", "KITCHEN"],
    },
  ];

  const filteredItems = menuItems
    .filter((item) => currentUser && item.roles.includes(currentUser.role))
    .slice(0, 5); // Show max 5 items in bottom nav

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white to-cyan-50 border-t-2 border-cyan-300 shadow-[0_-4px_20px_rgba(6,182,212,0.15)]"
    >
      <nav className="flex items-center justify-around h-16 px-2 max-w-screen-xl mx-auto">
        {filteredItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 min-w-[60px]",
                  isActive
                    ? "text-cyan-600 scale-110"
                    : "text-gray-500 hover:text-cyan-500"
                )}
              >
                <div
                  className={cn(
                    "relative p-2 rounded-xl transition-all duration-300",
                    isActive
                      ? "bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-500/50"
                      : "bg-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-all",
                      isActive ? "text-white" : "text-gray-600"
                    )}
                  />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-cyan-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold transition-all truncate max-w-full",
                    isActive ? "text-cyan-600" : "text-gray-600"
                  )}
                >
                  {item.label}
                </span>
              </button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
