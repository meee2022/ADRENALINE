import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import {
  LayoutDashboard,
  Users as UsersIcon,
  UtensilsCrossed,
  CalendarDays,
  ChefHat,
  Truck,
  LogOut,
  Dumbbell,
  Sticker,
  Package,
  Building2,
  Home,
  Shield,
  Image as ImageIcon,
  ClipboardCheck,
  Settings,
  Printer,
  BarChart3,
  FileText,
  ScrollText,
  Tag,
  Star,
} from "lucide-react";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { NotificationBell } from "../NotificationBell";
import { MENU_SECTIONS, ROLE_LABEL, ROLE_COLOR, type Role, type MenuItemDef } from "@/lib/permissions";

/** Map iconKey → lucide component */
const ICON_MAP: Record<MenuItemDef["iconKey"], React.ComponentType<any>> = {
  home: Home,
  dashboard: LayoutDashboard,
  customers: UsersIcon,
  users: Shield,
  menu: UtensilsCrossed,
  menuManagement: Sticker,
  publicMenu: UtensilsCrossed,
  banners: ImageIcon,
  stickers: Printer,
  plansManagement: CalendarDays,
  plans: Dumbbell,
  ordersPending: ClipboardCheck,
  inventory: Package,
  inventoryReports: Package,
  suppliers: Building2,
  settings: Settings,
  kitchen: ChefHat,
  delivery: Truck,
  audit: ScrollText,
  reports: FileText,
  analytics: BarChart3,
  coupons: Tag,
  ratings: Star,
};

export function Sidebar() {
  const [location] = useLocation();
  const { logout, currentUser } = useStore();
  const { t, dir, language } = useLanguage();

  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const role = (currentUser?.role as Role | undefined);
  const roleLabel = role ? (isRtl ? ROLE_LABEL[role]?.ar : ROLE_LABEL[role]?.en) : "";
  const roleColor = role ? ROLE_COLOR[role] : null;

  // Filter sections based on user role — only include items the user can access,
  // and only include sections that have at least one accessible item
  const visibleSections = MENU_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => role && item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

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

      <div className="px-4 pb-2 flex items-center gap-2">
        <div className="flex-1">
          <LanguageSwitcher />
        </div>
        <NotificationBell />
      </div>

      {/* Role badge (if not admin) */}
      {role && roleColor && (
        <div className="px-4 pb-3">
          <div
            className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{
              background: roleColor.bg,
              border: `1px solid ${roleColor.border}`,
            }}
          >
            <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: roleColor.text }} />
            <span className="text-xs font-bold truncate" style={{ color: roleColor.text }}>
              {roleLabel}
            </span>
          </div>
        </div>
      )}

      {/* Nav — Sectioned */}
      <nav className="flex-1 px-3 sm:px-4 overflow-y-auto overflow-x-hidden min-w-0 pb-3">
        {visibleSections.map((section, sIdx) => (
          <div key={sIdx} className="mb-4">
            {/* Section title */}
            <p className="text-[10px] font-bold uppercase tracking-wider px-3 mb-1.5"
              style={{ color: "#94a3b8" }}>
              {isRtl ? section.titleAr : section.titleEn}
            </p>

            {/* Section items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = location === item.href;
                const Icon = ICON_MAP[item.iconKey];
                const label = isRtl ? item.labelAr : item.labelEn;

                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer",
                        "flex items-center gap-3 min-w-0",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-muted-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive
                            ? "text-sidebar-primary-foreground"
                            : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate min-w-0">{label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-3 mb-3 px-1 min-w-0">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
            {currentUser?.name?.charAt(0) ?? "?"}
          </div>
          <div className="flex flex-col overflow-hidden min-w-0">
            <span className="text-sm font-medium truncate">
              {currentUser?.name}
            </span>
            <span className="text-[11px] truncate" style={{ color: roleColor?.text || "#94a3b8" }}>
              {roleLabel}
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
