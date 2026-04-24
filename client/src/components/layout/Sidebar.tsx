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
  LogOut,
  Dumbbell,
  Sticker,
  Package,
  FileText,
  Building2,
  Home,
  Shield,
  Image as ImageIcon,
  ClipboardCheck,
  Settings,
  Printer,
} from "lucide-react";
import { LanguageSwitcher } from "../LanguageSwitcher";

export function Sidebar() {
  const [location] = useLocation();
  const { logout, currentUser } = useStore();
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
      label: t("nav.dashboard"),
      roles: ["ADMIN"],
    },
    {
      href: "/customers",
      icon: Users,
      label: t("nav.customers"),
      roles: ["ADMIN"],
    },
    {
      href: "/users",
      icon: Shield,
      label: t("users.title"),
      roles: ["ADMIN"],
    },
    {
      href: "/menu",
      icon: UtensilsCrossed,
      label: t("nav.menu"),
      roles: ["ADMIN"],
    },
    {
      href: "/menu-management",
      icon: Sticker,
      label: t("menu_management.title"),
      roles: ["ADMIN"],
    },
    {
      href: "/public-meals-management",
      icon: UtensilsCrossed,
      label: isRtl ? "منيو الموقع العام" : "Public Menu",
      roles: ["ADMIN"],
    },
    {
      href: "/banners",
      icon: ImageIcon,
      label: isRtl ? "السلايدر (البانرات)" : "Banners (Slider)",
      roles: ["ADMIN"],
    },
    {
      href: "/stickers",
      icon: Printer,
      label: isRtl ? "طباعة الستيكرات" : "Stickers Print",
      roles: ["ADMIN"],
    },
    {
      href: "/plans-management",
      icon: CalendarDays,
      label: t("plans_management.title"),
      roles: ["ADMIN"],
    },
    {
      href: "/plans",
      icon: Dumbbell,
      label: t("nav.plans"),
      roles: ["ADMIN"],
    },

    {
      href: "/orders/pending",
      icon: ClipboardCheck,
      label: isRtl ? "مراجعة الطلبات" : "Review Orders",
      roles: ["ADMIN"],
    },

    {
      href: "/inventory",
      icon: Package,
      label: isRtl ? "المخزون" : "Inventory",
      roles: ["ADMIN"],
    },

    {
      href: "/suppliers",
      icon: Building2,
      label: isRtl ? "الموردين" : "Suppliers",
      roles: ["ADMIN"],
    },

    // ✅ NEW: Stickers
    {
      href: "/stickers",
      icon: Sticker,
      label: isRtl ? "الستيكرات" : "Stickers",
      roles: ["ADMIN", "KITCHEN"],
    },

    {
      href: "/settings/restaurant",
      icon: Settings,
      label: isRtl ? "إعدادات المطعم" : "Restaurant Settings",
      roles: ["ADMIN"],
    },

    {
      href: "/kitchen",
      icon: ChefHat,
      label: t("nav.kitchen"),
      roles: ["ADMIN", "KITCHEN"],
    },
    {
      href: "/delivery",
      icon: Truck,
      label: t("nav.delivery"),
      roles: ["ADMIN", "DELIVERY"],
    },
  ];

  const filteredItems = menuItems.filter(
    (item) => currentUser && item.roles.includes(currentUser.role),
  );

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "h-full w-full flex flex-col bg-sidebar text-sidebar-foreground",
        "overflow-hidden",
      )}
    >
      {/* Header */}
      <div className="p-5 sm:p-6 flex items-center gap-3 min-w-0">
        <img 
          src="/heart-icon.png" 
          alt="Adrenaline Heart" 
          className="h-10 w-10 shrink-0"
        />

        <div className="flex flex-col min-w-0">
          <img 
            src="/adrenaline-logo.png" 
            alt="Adrenaline Healthy Food" 
            className="h-6 w-auto"
          />
        </div>
      </div>

      <div className="px-4 pb-2">
        <LanguageSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 sm:px-4 space-y-2 overflow-y-auto overflow-x-hidden min-w-0">
        {filteredItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer",
                  "flex items-center gap-3 min-w-0",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive
                      ? "text-sidebar-primary-foreground"
                      : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
                  )}
                />
                <span className="truncate min-w-0">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-3 mb-4 px-1 min-w-0">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
            {currentUser?.name?.charAt(0) ?? "?"}
          </div>

          <div className="flex flex-col overflow-hidden min-w-0">
            <span className="text-sm font-medium truncate">
              {currentUser?.name}
            </span>
            <span className="text-xs text-muted-foreground truncate capitalize">
              {currentUser?.role?.toLowerCase()}
            </span>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="w-full px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("nav.logout")}</span>
        </button>
      </div>
    </div>
  );
}
