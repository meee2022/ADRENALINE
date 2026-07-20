import { useState, useEffect, useMemo } from "react";
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
  Banknote,
  CalendarCheck,
  ClipboardList,
  ShoppingBag,
  Store,
  ChevronDown,
  Receipt,
  Activity,
  Barcode,
  Landmark,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { NotificationBell } from "../NotificationBell";
import { MENU_SECTIONS, ROLE_LABEL, ROLE_COLOR, canAccessUser, type Role, type MenuItemDef } from "@/lib/permissions";

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
  outletLabels: Barcode,
  payroll: Banknote,
  attendance: CalendarCheck,
  leaves: CalendarDays,
  plansManagement: CalendarDays,
  plans: Dumbbell,
  customized: ChefHat,
  ordersPending: ClipboardCheck,
  inventory: Package,
  inventoryReports: Package,
  suppliers: Building2,
  settings: Settings,
  kitchen: ChefHat,
  driver: Truck,
  mealIssuance: ClipboardList,
  gymSales: Store,
  posAdmin: Receipt,
  managerLive: Activity,
  onlineOrders: ShoppingBag,
  delivery: Truck,
  drivers: UsersIcon,
  audit: ScrollText,
  reports: FileText,
  analytics: BarChart3,
  coupons: Tag,
  finance: Landmark,
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
      // ✅ يظهر بند القائمة لو الشخص عنده صلاحية دخوله (صلاحياته الخاصة أو قالب دوره)
      items: section.items.filter((item) => canAccessUser(currentUser, item.href)),
    }))
    .filter((section) => section.items.length > 0);

  // ✅ أكورديون: قسم واحد فقط مفتوح في أي لحظة — القائمة تظل قصيرة بلا scroll.
  //    المفتاح titleEn (ثابت مع اللغة). الافتراضي: قسم الصفحة الحالية.
  const activeSectionKey = useMemo(() => {
    const s = visibleSections.find((sec) => sec.items.some((i) => i.href === location));
    return (s || visibleSections[0])?.titleEn || null;
  }, [location, visibleSections]);

  // "__none__" = كل الأقسام مطوية. null = اتبع القسم النشط.
  const [openKey, setOpenKey] = useState<string | null>(null);

  // عند التنقّل لصفحة جديدة: افتح قسمها واقفل الباقي (سلوك أكورديون طبيعي)
  useEffect(() => { setOpenKey(null); }, [location]);

  const effectiveOpen = openKey ?? activeSectionKey;
  const isOpen = (key: string) => key === effectiveOpen;
  const toggleSection = (key: string) => setOpenKey(isOpen(key) ? "__none__" : key);

  // ✅ بحث سريع: يكتب حرفين فيلاقي أي صفحة فورًا (بالعربي أو الإنجليزي)
  const [q, setQ] = useState("");
  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    return visibleSections.flatMap((sec) =>
      sec.items.filter((i) =>
        i.labelAr.toLowerCase().includes(needle) || i.labelEn.toLowerCase().includes(needle),
      ),
    );
  }, [q, visibleSections]);

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

      {/* ✅ بحث سريع — اكتب حرفين توصل لأي صفحة بدون scroll */}
      <div className="px-4 pb-2">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 -translate-y-1/2 start-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isRtl ? "ابحث عن صفحة…" : "Find a page…"}
            className="w-full h-8 ps-8 pe-7 rounded-lg text-[12.5px] bg-slate-100/80 border border-transparent
                       focus:bg-white focus:border-[#3CC4F0]/60 focus:outline-none placeholder:text-slate-400 text-slate-700"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-400 hover:text-slate-600"
              aria-label={isRtl ? "مسح" : "Clear"}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Nav — نتائج البحث (مسطّحة) أو الأقسام (أكورديون) */}
      <nav className="flex-1 px-3 sm:px-4 overflow-y-auto overflow-x-hidden min-w-0 pb-3">
        {searchResults ? (
          <div className="space-y-0.5 mt-1">
            {searchResults.length === 0 && (
              <p className="text-[12px] text-slate-400 text-center py-6">
                {isRtl ? "لا توجد صفحة بهذا الاسم" : "No matching page"}
              </p>
            )}
            {searchResults.map((item) => {
              const isActive = location === item.href;
              const Icon = ICON_MAP[item.iconKey];
              const label = isRtl ? item.labelAr : item.labelEn;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={() => setQ("")}
                    className={cn(
                      "group px-3 py-2 rounded-lg text-[13px] transition-all duration-200 cursor-pointer",
                      "flex items-center gap-2.5 min-w-0 relative",
                      isActive
                        ? "bg-gradient-to-l from-[#3CC4F0] to-[#0E9ED6] text-white font-bold shadow-[0_6px_16px_-6px_rgba(60,196,240,0.55)]"
                        : "text-slate-600 font-semibold hover:bg-[#3CC4F0]/10 hover:text-[#0E76AC]",
                    )}
                  >
                    <span className={cn(
                      "h-7 w-7 rounded-md grid place-items-center shrink-0",
                      isActive ? "bg-white/20" : "bg-slate-100/80 group-hover:bg-[#3CC4F0]/15",
                    )}>
                      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-[#0E76AC]/70")} />
                    </span>
                    <span className="truncate min-w-0">{label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
        <>
        {visibleSections.map((section, sIdx) => {
          const key = section.titleEn;
          const open = isOpen(key);
          return (
          <div key={sIdx} className={cn("mb-1", sIdx > 0 && "mt-1.5 pt-1.5 border-t border-slate-100")}>
            {/* عنوان القسم — زر قابل للطي (أكبر شوية + سهم يدور) */}
            <button
              onClick={() => toggleSection(key)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                "hover:bg-[#3CC4F0]/10 group",
              )}
            >
              <span className="h-3.5 w-1 rounded-full bg-[#3CC4F0]/70 shrink-0" />
              <p className="text-[12px] font-extrabold tracking-wide text-[#4a6b86] flex-1 text-start truncate">
                {isRtl ? section.titleAr : section.titleEn}
              </p>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[#9db4c9] shrink-0 transition-transform duration-200",
                  open ? "rotate-180" : "",
                )}
              />
            </button>

            {/* Section items — تظهر فقط عند فتح القسم */}
            {open && (
            <div className="space-y-0.5 mt-1">
              {section.items.map((item) => {
                const isActive = location === item.href;
                const Icon = ICON_MAP[item.iconKey];
                const label = isRtl ? item.labelAr : item.labelEn;

                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "group px-3 py-2 rounded-lg text-[13px] transition-all duration-200 cursor-pointer",
                        "flex items-center gap-2.5 min-w-0 relative",
                        isActive
                          ? "bg-gradient-to-l from-[#3CC4F0] to-[#0E9ED6] text-white font-bold shadow-[0_6px_16px_-6px_rgba(60,196,240,0.55)]"
                          : "text-slate-600 font-semibold hover:bg-[#3CC4F0]/10 hover:text-[#0E76AC] hover:shadow-[0_4px_14px_-8px_rgba(14,118,172,0.25)]",
                      )}
                    >
                      <span
                        className={cn(
                          "h-7 w-7 rounded-md grid place-items-center shrink-0 transition-colors",
                          isActive
                            ? "bg-white/20"
                            : "bg-slate-100/80 group-hover:bg-[#3CC4F0]/15",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-white" : "text-[#0E76AC]/70 group-hover:text-[#0E76AC]",
                          )}
                        />
                      </span>
                      <span className="truncate min-w-0">{label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            )}
          </div>
          );
        })}
        </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-3 mb-3 px-1 min-w-0">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-[0_4px_12px_-4px_rgba(60,196,240,0.5)]"
            style={{ background: "linear-gradient(135deg,#3CC4F0,#0E76AC)" }}
          >
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
