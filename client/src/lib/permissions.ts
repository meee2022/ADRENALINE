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

export type Role = "ADMIN" | "NUTRITIONIST" | "KITCHEN" | "DELIVERY" | "INVENTORY_MANAGER" | "ACCOUNTANT" | "FINANCE_MANAGER" | "CASHIER";

export const ALL_ROLES: Role[] = [
  "ADMIN",
  "NUTRITIONIST",
  "KITCHEN",
  "DELIVERY",
  "INVENTORY_MANAGER",
  "ACCOUNTANT",
  "FINANCE_MANAGER",
  "CASHIER",
];

/** الصفحة الافتراضية اللي يتوجّه لها كل دور بعد تسجيل الدخول */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/dashboard",
  NUTRITIONIST: "/orders/pending",
  KITCHEN: "/kitchen",
  DELIVERY: "/delivery",
  INVENTORY_MANAGER: "/inventory",
  ACCOUNTANT: "/reports",
  FINANCE_MANAGER: "/reports",
  CASHIER: "/pos",         // الكاشير: يروح لشل POS مباشرةً — لكنه غالباً بيدخل بـPIN مش email
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
    "/outlet-labels",
    "/meal-issuance",    // حصر الوجبات الصادرة
    "/online-orders",    // حصر طلبات المنصّات
    "/plans",            // قراءة الخطط لمعرفة الوجبات
    "/plans-review/*",
  ],

  DELIVERY: [
    "/",
    "/delivery",
    "/drivers",          // لوحة السواقين + ربط العملاء
    "/driver",           // تطبيق السائق (جولة اليوم + التتبع الحي)
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

  ACCOUNTANT: [
    "/",
    "/reports",
    "/finance",
    "/payroll",
  ],

  FINANCE_MANAGER: [
    "/",
    "/reports",
    "/finance",
    "/analytics",
    "/payroll",
  ],

  CASHIER: [
    "/pos",
    "/pos/*",
  ],
};

/** صفحات فرعية غير ظاهرة في القائمة تُمنح تلقائيًا مع صفحة أساسية */
const PAGE_EXTRA: Record<string, string[]> = {
  "/plans": ["/plans-review/*"],
  "/plans-management": ["/plans-review/*"],
  "/orders/pending": ["/orders/review/*"],
};
function expandPerms(perms: string[]): string[] {
  const out = [...perms];
  for (const p of perms) if (PAGE_EXTRA[p]) out.push(...PAGE_EXTRA[p]);
  return out;
}

/** يطابق مسار مع قايمة أنماط (يدعم * و prefix — منح قسم يمنح صفحاته الفرعية) */
function matchPaths(list: string[], pathname: string): boolean {
  if (list.includes("*")) return true;
  return list.some((p) => {
    if (p === "/") return pathname === "/";
    if (p.endsWith("/*")) { const pre = p.slice(0, -2); return pathname === pre || pathname.startsWith(pre + "/"); }
    return pathname === p || pathname.startsWith(p + "/");
  });
}

/** يفحص لو الدور (القالب الافتراضي) مسموح له بالـ path */
export function canAccess(role: Role | undefined | null, pathname: string): boolean {
  if (!role) return false;
  return matchPaths(ROLE_ALLOWED_PATHS[role] || [], pathname);
}

/**
 * ✅ الفحص الأساسي: صلاحيات الشخص أولًا، وإلا قالب الدور.
 * ADMIN دايمًا كامل. الرئيسية "/" مسموحة لأي موظف مسجّل دخول.
 */
export function canAccessUser(
  user: { role?: Role | null; permissions?: string[] | null } | null | undefined,
  pathname: string,
): boolean {
  if (!user?.role) return false;
  if (user.role === "ADMIN") return true;
  if (pathname === "/") return true;
  const perms = user.permissions;
  if (perms && perms.length) return matchPaths(expandPerms(perms), pathname);
  return canAccess(user.role, pathname);
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
    | "outletLabels"
    | "mealIssuance"
    | "gymSales"
    | "posAdmin"
    | "managerLive"
    | "onlineOrders"
    | "plansManagement"
    | "plans"
    | "customized"
    | "ordersPending"
    | "inventory"
    | "inventoryReports"
    | "suppliers"
    | "settings"
    | "kitchen"
    | "delivery"
    | "drivers"
    | "driver"
    | "audit"
    | "reports"
    | "analytics"
    | "coupons"
    | "payroll"
    | "leaves"
    | "attendance"
    | "finance"
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
      { href: "/customized", iconKey: "customized", labelAr: "الوجبات المخصّصة", labelEn: "Customized Meals",
        roles: ["ADMIN", "NUTRITIONIST", "KITCHEN"] },
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
      { href: "/menu-management", iconKey: "menuManagement", labelAr: "المنيو والوصفات", labelEn: "Menu & Recipes",
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
      { href: "/outlet-labels", iconKey: "outletLabels", labelAr: "استيكرات المنافذ", labelEn: "Outlet Labels",
        roles: ["ADMIN", "KITCHEN"] },
      { href: "/meal-issuance", iconKey: "mealIssuance", labelAr: "حصر الصادر", labelEn: "Meal Issuance",
        roles: ["ADMIN", "KITCHEN"] },
      { href: "/gym-sales", iconKey: "gymSales", labelAr: "مبيعات المنافذ", labelEn: "Outlet Sales",
        roles: ["ADMIN", "KITCHEN"] },
      { href: "/pos-admin", iconKey: "posAdmin", labelAr: "نقطة البيع (POS)", labelEn: "Point of Sale (POS)",
        roles: ["ADMIN"] },
      { href: "/manager", iconKey: "managerLive", labelAr: "لوحة المدير اللحظية", labelEn: "Manager Live",
        roles: ["ADMIN"] },
      { href: "/online-orders", iconKey: "onlineOrders", labelAr: "طلبات أونلاين", labelEn: "Online Orders",
        roles: ["ADMIN", "KITCHEN"] },
      { href: "/delivery", iconKey: "delivery", labelAr: "التوصيل والتتبع", labelEn: "Delivery & Tracking",
        roles: ["ADMIN", "DELIVERY"] },
      { href: "/drivers", iconKey: "drivers", labelAr: "سواقين التوصيل", labelEn: "Delivery Drivers",
        roles: ["ADMIN", "DELIVERY"] },
      { href: "/driver", iconKey: "driver", labelAr: "تطبيق السائق", labelEn: "Driver App",
        roles: ["ADMIN", "DELIVERY"] },
    ],
  },
  {
    titleAr: "المخزون والموردين",
    titleEn: "Inventory & Suppliers",
    items: [
      { href: "/inventory", iconKey: "inventory", labelAr: "المخزون", labelEn: "Inventory",
        roles: ["ADMIN", "INVENTORY_MANAGER"] },
      { href: "/inventory-reports", iconKey: "inventoryReports", labelAr: "تقارير المخزون", labelEn: "Inventory Reports",
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
    titleAr: "المالية والمحاسبة",
    titleEn: "Finance & Accounting",
    items: [
      { href: "/finance", iconKey: "finance", labelAr: "المالية والمحاسبة", labelEn: "Finance & Accounting",
        roles: ["ADMIN", "ACCOUNTANT", "FINANCE_MANAGER"] },
    ],
  },
  {
    titleAr: "إدارة النظام",
    titleEn: "System",
    items: [
      { href: "/payroll", iconKey: "payroll", labelAr: "الرواتب", labelEn: "Payroll",
        roles: ["ADMIN"] },
      { href: "/attendance", iconKey: "attendance", labelAr: "الحضور اليومي", labelEn: "Attendance",
        roles: ["ADMIN"] },
      { href: "/leaves", iconKey: "leaves", labelAr: "الإجازات", labelEn: "Leaves",
        roles: ["ADMIN"] },
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
  ACCOUNTANT: { ar: "محاسب", en: "Accountant" },
  FINANCE_MANAGER: { ar: "مدير مالي", en: "Finance Manager" },
  CASHIER: { ar: "كاشير", en: "Cashier" },
};

/** لون الدور (للـ badge) */
// Brand palette: #3cc4f0 / #47759c / #0f1516 / #bcbebf / #fff
export const ROLE_COLOR: Record<Role, { bg: string; text: string; border: string }> = {
  ADMIN:             { bg: "#e8f8fd", text: "#0f1516",  border: "#3cc4f0" },  // سيان فاتح
  NUTRITIONIST:      { bg: "#eaf1f7", text: "#47759c",  border: "#47759c" },  // أزرق فولاذي فاتح
  KITCHEN:           { bg: "#f0f4f7", text: "#47759c",  border: "#bcbebf" },  // رصاصي/فولاذي
  DELIVERY:          { bg: "#e8f8fd", text: "#3cc4f0",  border: "#3cc4f0" },  // سيان
  INVENTORY_MANAGER: { bg: "#f5f6f7", text: "#0f1516",  border: "#bcbebf" },  // رمادي داكن
  ACCOUNTANT:        { bg: "#eef7ee", text: "#166534",  border: "#16a34a" },  // أخضر
  FINANCE_MANAGER:   { bg: "#eef2ff", text: "#3730a3",  border: "#6366f1" },  // بنفسجي
  CASHIER:           { bg: "#ecfeff", text: "#0e7490",  border: "#06b6d4" },  // سماوي/كاشير
};

/** كل الصفحات القابلة للتخصيص (مسطّحة من أقسام القائمة) — للـchecklist في إدارة الحسابات */
export const ALL_PAGES = MENU_SECTIONS.flatMap((s) =>
  s.items
    .filter((i) => i.href !== "/") // الرئيسية دايمًا مسموحة
    .map((i) => ({ href: i.href, labelAr: i.labelAr, labelEn: i.labelEn, sectionAr: s.titleAr, sectionEn: s.titleEn })),
);

/** الصفحات الافتراضية لدور — لتعبئة الـcheckboxes عند اختيار الدور */
export function defaultPermsForRole(role: Role): string[] {
  const paths = ROLE_ALLOWED_PATHS[role] || [];
  if (paths.includes("*")) return ALL_PAGES.map((p) => p.href); // ADMIN = كل الصفحات
  return ALL_PAGES.filter((p) => matchPaths(paths, p.href)).map((p) => p.href);
}
