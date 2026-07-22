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
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-200/90 bg-[#f9fdfe]/[0.98] shadow-[0_-6px_22px_rgba(14,42,74,0.10)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <nav className="flex items-stretch justify-around min-h-16 px-1 max-w-screen-xl mx-auto">
        {filteredItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href} className="flex min-w-0 flex-1 sm:flex-none">
              <button
                className={cn(
                  "flex min-h-16 min-w-0 w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-xl transition-[color,background-color] duration-150 sm:min-w-[60px] sm:gap-1 sm:px-3 sm:py-2",
                  isActive
                    ? "text-cyan-700"
                    : "text-gray-500 hover:text-cyan-500"
                )}
              >
                <div
                  className={cn(
                    "relative p-1.5 rounded-xl transition-[color,background-color,box-shadow] duration-150 sm:p-2",
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
                    <div className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-cyan-600" />
                  )}
                </div>
                <span
                  className={cn(
                    "w-full truncate text-center text-[11px] font-semibold leading-tight transition-all",
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
