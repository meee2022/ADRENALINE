/**
 * @file client/src/lib/permissions.ts
 * @description نظام الصلاحيات — كل دور وما يقدر يوصل له
 *
 * Roles:
 *   - ADMIN              المسؤول الكامل (كل الصلاحيات)
 *   - NUTRITIONIST       أخصائي تغذية (العملاء + الخطط + مراجعة الطلبات)
 *   - KITCHEN            المطبخ (شاشة المطبخ + طباعة الستيكرات)
 *   - DELIVERY           التوصيل (شاشة التوصيل)
 *   - INVENTORY_MANAGER  مدير مخزون (المخزون + الموردين + التقارير)
 */

export type Role = "ADMIN" | "NUTRITIONIST" | "KITCHEN" | "DELIVERY" | "INVENTORY_MANAGER";

export const ALL_ROLES: Role[] = [
  "ADMIN",
  "NUTRITIONIST",
  "KITCHEN",
  "DELIVERY",
  "INVENTORY_MANAGER",
];

/** الصفحة الافتراضية اللي يتوجّه لها كل دور بعد تسجيل الدخول */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/dashboard",
  NUTRITIONIST: "/customers",
  KITCHEN: "/kitchen",
  DELIVERY: "/delivery",
  INVENTORY_MANAGER: "/inventory",
};

/**
 * أنماط الـ paths المسموحة لكل دور.
 * يدعم matching بالـ prefix باستخدام `*` في النهاية.
 * الـ ADMIN عنده "*" يعني كل حاجة.
 */
const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  ADMIN: ["*"],

  NUTRITIONIST: [
    "/",
    "/customers",
    "/plans",
    "/plans-management",
    "/plans-review/*",
    "/menu",
    "/menu-management",
    "/public-meals-management",
    "/orders/pending",
    "/orders/review/*",
    "/analytics",
    "/reports",
  ],

  KITCHEN: [
    "/",
    "/kitchen",
    "/stickers",
    "/plans",            // قراءة الخطط لمعرفة الوجبات
    "/plans-review/*",
  ],

  DELIVERY: [
    "/",
    "/delivery",
    "/plans",            // قراءة الخطط لمعرفة العملاء
    "/plans-review/*",
  ],

  INVENTORY_MANAGER: [
    "/",
    "/inventory",
    "/inventory/*",
    "/inventory-reports",
    "/suppliers",
  ],
};

/** يفحص لو الدور مسموح له بالـ path ده */
export function canAccess(role: Role | undefined | null, pathname: string): boolean {
  if (!role) return false;
  const allowed = ROLE_ALLOWED_PATHS[role] || [];
  if (allowed.includes("*")) return true;

  return allowed.some((pattern) => {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      return pathname === prefix || pathname.startsWith(prefix + "/");
    }
    return pattern === pathname;
  });
}

/**
 * عناصر القائمة الجانبية المنظمة في أقسام
 * كل عنصر له href + label + roles مسموح لها بالظهور
 */
export interface MenuItemDef {
  href: string;
  iconKey:
    | "home"
    | "dashboard"
    | "customers"
    | "users"
    | "menu"
    | "menuManagement"
    | "publicMenu"
    | "banners"
    | "stickers"
    | "plansManagement"
    | "plans"
    | "ordersPending"
    | "inventory"
    | "inventoryReports"
    | "suppliers"
    | "settings"
    | "kitchen"
    | "delivery"
    | "audit"
    | "reports"
    | "analytics"
    | "coupons"
    | "ratings";
  labelAr: string;
  labelEn: string;
  roles: Role[];
}

export interface MenuSection {
  titleAr: string;
  titleEn: string;
  items: MenuItemDef[];
}

/** قائمة موحدة منظمة في أقسام */
export const MENU_SECTIONS: MenuSection[] = [
  {
    titleAr: "عام",
    titleEn: "General",
    items: [
      { href: "/", iconKey: "home", labelAr: "الرئيسية", labelEn: "Home",
        roles: ["ADMIN", "NUTRITIONIST", "KITCHEN", "DELIVERY", "INVENTORY_MANAGER"] },
      { href: "/dashboard", iconKey: "dashboard", labelAr: "لوحة التحكم", labelEn: "Dashboard",
        roles: ["ADMIN"] },
    ],
  },
  {
    titleAr: "العملاء والخطط",
    titleEn: "Customers & Plans",
    items: [
      { href: "/customers", iconKey: "customers", labelAr: "المشتركين", labelEn: "Customers",
        roles: ["ADMIN", "NUTRITIONIST"] },
      { href: "/plans", iconKey: "plans", labelAr: "الخطط اليومية", labelEn: "Daily Plans",
        roles: ["ADMIN", "NUTRITIONIST", "KITCHEN", "DELIVERY"] },
      { href: "/plans-management", iconKey: "plansManagement", labelAr: "إدارة الخطط", labelEn: "Plans Management",
        roles: ["ADMIN", "NUTRITIONIST"] },
      { href: "/orders/pending", iconKey: "ordersPending", labelAr: "مراجعة الطلبات", labelEn: "Review Orders",
        roles: ["ADMIN", "NUTRITIONIST"] },
    ],
  },
  {
    titleAr: "القائمة والمنيو",
    titleEn: "Menu",
    items: [
      { href: "/menu", iconKey: "menu", labelAr: "قائمة الطعام", labelEn: "Menu",
        roles: ["ADMIN", "NUTRITIONIST"] },
      { href: "/menu-management", iconKey: "menuManagement", labelAr: "إدارة القائمة", labelEn: "Menu Management",
        roles: ["ADMIN"] },
      { href: "/public-meals-management", iconKey: "publicMenu", labelAr: "منيو الموقع العام", labelEn: "Public Menu",
        roles: ["ADMIN"] },
    ],
  },
  {
    titleAr: "العمليات اليومية",
    titleEn: "Operations",
    items: [
      { href: "/kitchen", iconKey: "kitchen", labelAr: "المطبخ", labelEn: "Kitchen",
        roles: ["ADMIN", "KITCHEN"] },
      { href: "/stickers", iconKey: "stickers", labelAr: "طباعة الستيكرات", labelEn: "Stickers Print",
        roles: ["ADMIN", "KITCHEN"] },
      { href: "/delivery", iconKey: "delivery", labelAr: "التوصيل", labelEn: "Delivery",
        roles: ["ADMIN", "DELIVERY"] },
    ],
  },
  {
    titleAr: "المخزون والموردين",
    titleEn: "Inventory & Suppliers",
    items: [
      { href: "/inventory", iconKey: "inventory", labelAr: "المخزون", labelEn: "Inventory",
        roles: ["ADMIN", "INVENTORY_MANAGER"] },
      { href: "/suppliers", iconKey: "suppliers", labelAr: "الموردين", labelEn: "Suppliers",
        roles: ["ADMIN", "INVENTORY_MANAGER"] },
    ],
  },
  {
    titleAr: "التسويق والمحتوى",
    titleEn: "Marketing",
    items: [
      { href: "/banners", iconKey: "banners", labelAr: "السلايدر (البانرات)", labelEn: "Banners",
        roles: ["ADMIN"] },
      { href: "/coupons", iconKey: "coupons", labelAr: "كوبونات الخصم", labelEn: "Coupons",
        roles: ["ADMIN"] },
    ],
  },
  {
    titleAr: "التقارير والتحليلات",
    titleEn: "Analytics & Reports",
    items: [
      { href: "/analytics", iconKey: "analytics", labelAr: "لوحة التحليلات", labelEn: "Analytics",
        roles: ["ADMIN", "NUTRITIONIST"] },
      { href: "/reports", iconKey: "reports", labelAr: "التقارير", labelEn: "Reports",
        roles: ["ADMIN", "NUTRITIONIST"] },
    ],
  },
  {
    titleAr: "إدارة النظام",
    titleEn: "System",
    items: [
      { href: "/users", iconKey: "users", labelAr: "إدارة الحسابات", labelEn: "User Management",
        roles: ["ADMIN"] },
      { href: "/audit-log", iconKey: "audit", labelAr: "سجل النشاطات", labelEn: "Audit Log",
        roles: ["ADMIN"] },
      { href: "/settings/restaurant", iconKey: "settings", labelAr: "إعدادات المطعم", labelEn: "Restaurant Settings",
        roles: ["ADMIN"] },
    ],
  },
];

/** نص الدور للعرض */
export const ROLE_LABEL: Record<Role, { ar: string; en: string }> = {
  ADMIN: { ar: "مسؤول", en: "Admin" },
  NUTRITIONIST: { ar: "أخصائي تغذية", en: "Nutritionist" },
  KITCHEN: { ar: "مطبخ", en: "Kitchen" },
  DELIVERY: { ar: "توصيل", en: "Delivery" },
  INVENTORY_MANAGER: { ar: "مدير مخزون", en: "Inventory Manager" },
};

/** لون الدور (للـ badge) */
// Brand palette: #3cc4f0 / #47759c / #0f1516 / #bcbebf / #fff
export const ROLE_COLOR: Record<Role, { bg: string; text: string; border: string }> = {
  ADMIN:             { bg: "#e8f8fd", text: "#0f1516",  border: "#3cc4f0" },  // سيان فاتح
  NUTRITIONIST:      { bg: "#eaf1f7", text: "#47759c",  border: "#47759c" },  // أزرق فولاذي فاتح
  KITCHEN:           { bg: "#f0f4f7", text: "#47759c",  border: "#bcbebf" },  // رصاصي/فولاذي
  DELIVERY:          { bg: "#e8f8fd", text: "#3cc4f0",  border: "#3cc4f0" },  // سيان
  INVENTORY_MANAGER: { bg: "#f5f6f7", text: "#0f1516",  border: "#bcbebf" },  // رمادي داكن
};
