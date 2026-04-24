import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

type Language = "en" | "ar";

export const translations = {
  // Sidebar
  "app.name": { en: "ADRENALINE", ar: "ADRENALINE" },
  "app.subtitle": { en: "Meals Manager", ar: "Meals Manager" },
  "nav.dashboard": { en: "Dashboard", ar: "لوحة التحكم" },
  "nav.customers": { en: "Customers", ar: "المشتركين" },
  "nav.menu": { en: "Menu", ar: "قائمة الطعام" },
  "nav.plans": { en: "Daily Plans", ar: "الخطط اليومية" },
  "nav.kitchen": { en: "Kitchen", ar: "المطبخ" },
  "nav.delivery": { en: "Delivery", ar: "التوصيل" },
  "nav.logout": { en: "Sign Out", ar: "تسجيل الخروج" },

  // Login
  "login.welcome": { en: "Welcome Back", ar: "أهلاً بك مجدداً" },
  "login.subtitle": {
    en: "Sign in to Adrenaline Meals Manager",
    ar: "سجل الدخول إلى نظام إدارة وجبات أدرينالين",
  },
  "login.email": { en: "Email", ar: "البريد الإلكتروني" },
  "login.email_placeholder": {
    en: "Enter your email",
    ar: "أدخل بريدك الإلكتروني",
  },
  "login.password": { en: "Password", ar: "كلمة المرور" },
  "login.password_placeholder": {
    en: "Enter your password",
    ar: "أدخل كلمة المرور",
  },
  "login.loading": { en: "Signing in...", ar: "جارٍ تسجيل الدخول..." },
  "login.role": { en: "Role", ar: "الدور الوظيفي" },
  "login.role_placeholder": { en: "Select role", ar: "اختر الدور" },
  "role.admin": { en: "Admin", ar: "مدير النظام" },
  "role.kitchen": { en: "Kitchen Staff", ar: "موظف المطبخ" },
  "role.delivery": { en: "Delivery Driver", ar: "سائق التوصيل" },
  "role.nutritionist": { en: "Nutritionist", ar: "أخصائي تغذية" },
  "role.inventory_manager": { en: "Inventory Manager", ar: "مسؤول المخزن" },
  "login.submit": { en: "Sign In", ar: "تسجيل الدخول" },

  // Users Management
  "users.title": { en: "Users Management", ar: "إدارة الحسابات" },
  "users.subtitle": { en: "Manage system users and permissions", ar: "إدارة مستخدمي النظام والصلاحيات" },
  "users.add": { en: "Add User", ar: "إضافة مستخدم" },
  "users.name": { en: "Full Name", ar: "الاسم الكامل" },
  "users.email": { en: "Email", ar: "البريد الإلكتروني" },
  "users.role": { en: "Role", ar: "الصلاحية" },
  "users.status": { en: "Status", ar: "الحالة" },
  "users.active": { en: "Active", ar: "نشط" },
  "users.inactive": { en: "Inactive", ar: "غير نشط" },
  "users.created_at": { en: "Created", ar: "تاريخ الإنشاء" },
  "users.actions": { en: "Actions", ar: "الإجراءات" },
  "users.edit": { en: "Edit", ar: "تعديل" },
  "users.delete": { en: "Delete", ar: "حذف" },
  "users.delete_confirm": { en: "Are you sure you want to delete this user?", ar: "هل أنت متأكد من حذف هذا المستخدم؟" },
  "users.add_title": { en: "Add New User", ar: "إضافة مستخدم جديد" },
  "users.edit_title": { en: "Edit User", ar: "تعديل المستخدم" },
  "users.password": { en: "Password", ar: "كلمة المرور" },
  "users.password_note": { en: "Leave blank to keep current password", ar: "اتركه فارغاً للإبقاء على كلمة المرور الحالية" },
  "users.save": { en: "Save", ar: "حفظ" },
  "users.cancel": { en: "Cancel", ar: "إلغاء" },

  // Customer Authentication & Profile
  "customer.login": { en: "Customer Login", ar: "تسجيل دخول العميل" },
  "customer.register": { en: "Create Account", ar: "إنشاء حساب" },
  "customer.register_title": { en: "Create Your Account", ar: "إنشاء حسابك" },
  "customer.login_title": { en: "Welcome Back", ar: "أهلاً بعودتك" },
  "customer.fullname": { en: "Full Name", ar: "الاسم الكامل" },
  "customer.phone": { en: "Phone Number", ar: "رقم الهاتف" },
  "customer.email": { en: "Email", ar: "البريد الإلكتروني" },
  "customer.password": { en: "Password", ar: "كلمة المرور" },
  "customer.confirm_password": { en: "Confirm Password", ar: "تأكيد كلمة المرور" },
  "customer.have_account": { en: "Already have an account?", ar: "لديك حساب؟" },
  "customer.no_account": { en: "Don't have an account?", ar: "ليس لديك حساب؟" },
  "customer.sign_in": { en: "Sign In", ar: "تسجيل الدخول" },
  "customer.sign_up": { en: "Sign Up", ar: "إنشاء حساب" },
  "customer.profile": { en: "My Profile", ar: "حسابي" },
  "customer.logout": { en: "Logout", ar: "تسجيل الخروج" },
  "customer.my_subscription": { en: "My Subscription", ar: "اشتراكي" },
  "customer.subscription_active": { en: "Active Subscription", ar: "اشتراك نشط" },
  "customer.subscription_inactive": { en: "No Active Subscription", ar: "لا يوجد اشتراك نشط" },
  "customer.subscription_start": { en: "Start Date", ar: "تاريخ البدء" },
  "customer.subscription_end": { en: "End Date", ar: "تاريخ الانتهاء" },
  "customer.subscription_remaining": { en: "Days Remaining", ar: "الأيام المتبقية" },
  "customer.subscription_details": { en: "Subscription Details", ar: "تفاصيل الاشتراك" },
  "customer.delivery_time": { en: "Delivery Time", ar: "وقت التوصيل" },
  "customer.meals_per_day": { en: "Meals Per Day", ar: "وجبات يومياً" },
  "customer.snacks_per_day": { en: "Snacks Per Day", ar: "سناكات يومياً" },
  "customer.program": { en: "Program", ar: "البرنامج" },
  "customer.package": { en: "Package", ar: "الباقة" },
  "customer.price": { en: "Price", ar: "السعر" },
  "customer.address": { en: "Delivery Address", ar: "عنوان التوصيل" },
  "customer.goals": { en: "Goals", ar: "الأهداف" },
  "customer.allergies": { en: "Allergies", ar: "الحساسية" },
  "customer.subscribe_now": { en: "Subscribe Now", ar: "اشترك الآن" },
  "customer.contact_us": { en: "Contact us to subscribe", ar: "تواصل معنا للاشتراك" },
  "customer.days": { en: "days", ar: "يوم" },

  // Menu Management
  "menu_management.title": { en: "Menu Management", ar: "إدارة القائمة" },
  "menu_management.subtitle": { en: "Manage meals, categories and ingredients", ar: "إدارة الوجبات والفئات والمكونات" },
  "menu_management.add_meal": { en: "Add Meal", ar: "إضافة وجبة" },
  "menu_management.edit_meal": { en: "Edit Meal", ar: "تعديل وجبة" },
  "menu_management.delete_meal": { en: "Delete Meal", ar: "حذف وجبة" },
  "menu_management.meal_name": { en: "Meal Name", ar: "اسم الوجبة" },
  "menu_management.category": { en: "Category", ar: "الفئة" },
  "menu_management.calories": { en: "Calories", ar: "السعرات" },
  "menu_management.macros": { en: "Macros", ar: "المغذيات الكبرى" },
  "menu_management.tags": { en: "Tags", ar: "الوسوم" },
  "menu_management.status": { en: "Status", ar: "الحالة" },
  "menu_management.active": { en: "Active", ar: "نشط" },
  "menu_management.inactive": { en: "Inactive", ar: "غير نشط" },
  "menu_management.add_title": { en: "Add New Meal", ar: "إضافة وجبة جديدة" },
  "menu_management.edit_title": { en: "Edit Meal", ar: "تعديل الوجبة" },
  "menu_management.delete_confirm": { en: "Are you sure you want to delete this meal?", ar: "هل أنت متأكد من حذف هذه الوجبة؟" },

  // Plans Management
  "plans_management.title": { en: "Plans Management", ar: "إدارة الخطط" },
  "plans_management.subtitle": { en: "Manage subscription plans and packages", ar: "إدارة خطط الاشتراكات والباقات" },
  "plans_management.add_plan": { en: "Add Plan", ar: "إضافة خطة" },
  "plans_management.edit_plan": { en: "Edit Plan", ar: "تعديل خطة" },
  "plans_management.delete_plan": { en: "Delete Plan", ar: "حذف خطة" },
  "plans_management.plan_name_ar": { en: "Plan Name (Arabic)", ar: "اسم الخطة (عربي)" },
  "plans_management.plan_name_en": { en: "Plan Name (English)", ar: "اسم الخطة (إنجليزي)" },
  "plans_management.duration": { en: "Duration", ar: "المدة" },
  "plans_management.options": { en: "Options", ar: "الخيارات" },
  "plans_management.meals": { en: "Meals", ar: "وجبات" },
  "plans_management.snacks": { en: "Snacks", ar: "سناكات" },
  "plans_management.price_qar": { en: "Price (QAR)", ar: "السعر (ريال)" },
  "plans_management.add_option": { en: "Add Option", ar: "إضافة خيار" },
  "plans_management.features": { en: "Features", ar: "المميزات" },
  "plans_management.add_feature": { en: "Add Feature", ar: "إضافة ميزة" },
  "plans_management.image_url": { en: "Image URL", ar: "رابط الصورة" },
  "plans_management.slug": { en: "Slug", ar: "المعرف" },
  "plans_management.description_ar": { en: "Description (Arabic)", ar: "الوصف (عربي)" },
  "plans_management.description_en": { en: "Description (English)", ar: "الوصف (إنجليزي)" },
  "plans_management.delete_confirm": { en: "Are you sure you want to delete this plan?", ar: "هل أنت متأكد من حذف هذه الخطة؟" },

  // Dashboard
  "dashboard.title": { en: "Dashboard", ar: "لوحة التحكم" },
  "stats.active_customers": { en: "Active Customers", ar: "المشتركين النشطين" },
  "stats.plans_today": { en: "Plans Today", ar: "خطط اليوم" },
  "stats.morning_delivery": { en: "Morning Delivery", ar: "توصيل صباحي" },
  "stats.evening_delivery": { en: "Evening Delivery", ar: "توصيل مسائي" },
  "chart.weekly_overview": { en: "Weekly Overview", ar: "نظرة عامة أسبوعية" },
  "chart.recent_activity": { en: "Recent Activity", ar: "النشاط الأخير" },
  "dashboard.update_msg": { en: "Plan updated for", ar: "تم تحديث خطة" },
  "dashboard.just_now": { en: "Just now", ar: "الآن" },

  "dashboard.meal_stats": { en: "Meal Statistics", ar: "إحصائيات الوجبات" },
  "dashboard.meal_name": { en: "Meal Name", ar: "اسم الوجبة" },
  "dashboard.count": { en: "Count", ar: "العدد" },
  "dashboard.today_meals_breakdown": {
    en: "Today's Meals Breakdown",
    ar: "تفصيل وجبات اليوم",
  },

  // Customers
  "customers.title": { en: "Customers", ar: "المشتركين" },
  "customers.subtitle": {
    en: "Manage your subscriber base",
    ar: "إدارة قاعدة المشتركين",
  },
  "customers.add": { en: "Add Customer", ar: "إضافة مشترك" },
  "customers.edit_title": { en: "Edit Customer", ar: "تعديل بيانات مشترك" },
  "customers.add_title": { en: "Add New Customer", ar: "إضافة مشترك جديد" },
  "customers.fullname": { en: "Full Name", ar: "الاسم الكامل" },
  "customers.phone": {
    en: "Phone (Primary Key)",
    ar: "رقم الهاتف (مفتاح البحث)",
  },
  "customers.gender": { en: "Gender", ar: "الجنس" },
  "customers.delivery_time": { en: "Delivery Preference", ar: "وقت التوصيل" },
  "customers.start_date": { en: "Start Date", ar: "تاريخ البدء" },
  "customers.end_date": { en: "End Date", ar: "تاريخ الانتهاء" },
  "customers.address": { en: "Address (Optional)", ar: "العنوان (اختياري)" },
  "customers.goals": { en: "Goals", ar: "الأهداف" },
  "customers.allergies": { en: "Allergies", ar: "الحساسية" },
  "customers.notes": { en: "Notes", ar: "ملاحظات" },
  "customers.active": { en: "Active Subscription", ar: "اشتراك نشط" },
  "customers.search_placeholder": {
    en: "Search by name or phone...",
    ar: "بحث بالاسم أو الهاتف...",
  },
  "customers.no_data": { en: "No customers found.", ar: "لا يوجد مشتركين." },
  "customers.duration": { en: "Duration", ar: "المدة" },

  // Menu
  "menu.title": { en: "Menu Management", ar: "إدارة القائمة" },
  "menu.subtitle": {
    en: "Configure your meal offerings",
    ar: "تكوين وجباتك والعروض",
  },
  "menu.tab.categories": { en: "Categories", ar: "الأصناف (Categories)" },
  "menu.tab.items": { en: "Menu Items", ar: "عناصر القائمة" },
  "menu.tab.addons": { en: "Addons", ar: "الإضافات" },
  "menu.add_category": { en: "Add Category", ar: "إضافة صنف" },
  "menu.edit_category": { en: "Edit Category", ar: "تعديل صنف" },
  "menu.name": { en: "Name", ar: "الاسم" },
  "menu.order": { en: "Order", ar: "الترتيب" },
  "menu.add_item": { en: "Add Item", ar: "إضافة عنصر" },
  "menu.edit_item": { en: "Edit Item", ar: "تعديل عنصر" },
  "menu.category": { en: "Category", ar: "الصنف" },
  "menu.calories": { en: "Calories", ar: "السعرات الحرارية" },
  "menu.active": { en: "Active", ar: "نشط" },
  "menu.add_addon": { en: "Add Addon", ar: "إضافة عنصر" },
  "menu.edit_addon": { en: "Edit Addon", ar: "تعديل إضافة" },
  "menu.price": { en: "Price ($)", ar: "السعر ($)" },

  // Plans
  "plans.title": { en: "Daily Plans", ar: "الخطط اليومية" },
  "plans.subtitle": {
    en: "Manage meal assignments for",
    ar: "إدارة الوجبات ليوم",
  },
  "plans.export": { en: "Export CSV", ar: "تصدير CSV" },
  "plans.pick_date": { en: "Pick a date", ar: "اختر تاريخاً" },
  "plans.select_customer": { en: "Select Customer", ar: "اختيار المشترك" },
  "plans.search_customer": { en: "Search customer...", ar: "ابحث عن مشترك..." },
  "plans.no_customer_found": {
    en: "No customer found.",
    ar: "لم يتم العثور على مشترك.",
  },
  "plans.copy_yesterday": { en: "Copy Yesterday's Plan", ar: "نسخ خطة الأمس" },
  "plans.delivery_note": { en: "Delivery Note", ar: "ملاحظات التوصيل" },
  "plans.delivery_note_placeholder": {
    en: "Special instructions for delivery...",
    ar: "تعليمات خاصة للتوصيل...",
  },
  "plans.off": { en: "OFF", ar: "إيقاف" },
  "plans.on": { en: "ON", ar: "تشغيل" },
  "plans.select_meal": { en: "Select Meal", ar: "اختر الوجبة" },
  "plans.select_meal_placeholder": {
    en: "Select a meal...",
    ar: "اختر وجبة...",
  },
  "plans.addons": { en: "Add-ons", ar: "الإضافات" },
  "plans.special_request": {
    en: "Special request for this meal...",
    ar: "طلبات خاصة لهذه الوجبة...",
  },
  "plans.status": { en: "Status", ar: "الحالة" },
  "plans.save_draft": { en: "Save Draft", ar: "حفظ كمسودة" },
  "plans.confirm_plan": { en: "Confirm Plan", ar: "تأكيد الخطة" },
  "plans.no_customer_selected": {
    en: "No Customer Selected",
    ar: "لم يتم اختيار مشترك",
  },
  "plans.select_to_start": {
    en: "Select a customer to start planning meals.",
    ar: "اختر مشتركاً للبدء في تخطيط الوجبات.",
  },
  "plans.copied": { en: "Copied!", ar: "تم النسخ!" },
  "plans.copied_desc": {
    en: "Plan copied from yesterday.",
    ar: "تم نسخ الخطة من يوم أمس.",
  },
  "plans.no_plan": { en: "No plan found", ar: "لا توجد خطة" },
  "plans.no_plan_desc": {
    en: "There is no plan for yesterday to copy.",
    ar: "لا توجد خطة ليوم أمس لنسخها.",
  },
  "plans.cannot_confirm": { en: "Cannot Confirm", ar: "لا يمكن التأكيد" },
  "plans.cannot_confirm_desc": {
    en: "Please select at least one meal item before confirming.",
    ar: "يرجى اختيار وجبة واحدة على الأقل قبل التأكيد.",
  },
  "plans.plan_updated": { en: "Plan Updated", ar: "تم تحديث الخطة" },
  "plans.plan_created": { en: "Plan Created", ar: "تم إنشاء الخطة" },

  // Kitchen
  "kitchen.title": { en: "Kitchen View", ar: "عرض المطبخ" },
  "kitchen.print": { en: "Print", ar: "طباعة" },
  "kitchen.morning_delivery": { en: "Morning Delivery", ar: "توصيل صباحي" },
  "kitchen.evening_delivery": { en: "Evening Delivery", ar: "توصيل مسائي" },
  "kitchen.no_plans": {
    en: "No confirmed plans for this shift yet.",
    ar: "لا توجد خطط مؤكدة لهذه الوردية بعد.",
  },
  "kitchen.prepared": { en: "PREPARED", ar: "جاهز" },
  "kitchen.mark_done": { en: "Mark Done", ar: "تم التحضير" },
  "kitchen.note": { en: "Note", ar: "ملاحظة" },

  // Delivery
  "delivery.title": { en: "Delivery Run", ar: "جدول التوصيل" },
  "delivery.morning_run": { en: "Morning Run", ar: "جولة صباحية" },
  "delivery.evening_run": { en: "Evening Run", ar: "جولة مسائية" },
  "delivery.no_plans": {
    en: "No prepared plans ready for delivery.",
    ar: "لا توجد خطط جاهزة للتوصيل.",
  },
  "delivery.no_address": { en: "No address provided", ar: "لا يوجد عنوان" },
  "delivery.delivered": { en: "Delivered", ar: "تم التوصيل" },
  "delivery.mark_delivered": { en: "Mark Delivered", ar: "تحديد كموصل" },

  // Common
  "common.search": { en: "Search...", ar: "بحث..." },
  "common.save": { en: "Save", ar: "حفظ" },
  "common.cancel": { en: "Cancel", ar: "إلغاء" },
  "common.edit": { en: "Edit", ar: "تعديل" },
  "common.delete": { en: "Delete", ar: "حذف" },
  "common.add": { en: "Add", ar: "إضافة" },
  "common.morning": { en: "Morning", ar: "صباحي" },
  "common.evening": { en: "Evening", ar: "مسائي" },
  "common.male": { en: "Male", ar: "ذكر" },
  "common.female": { en: "Female", ar: "أنثى" },
  "common.draft": { en: "Draft", ar: "مسودة" },
  "common.confirmed": { en: "Confirmed", ar: "مؤكدة" },
  "common.unknown": { en: "Unknown", ar: "غير معروف" },
  "common.status": { en: "Status", ar: "الحالة" },
  "common.actions": { en: "Actions", ar: "إجراءات" },
} as const;

type TranslationKey = keyof typeof translations;

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  dir: "ltr" | "rtl";
  isRtl: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "app_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved =
      typeof window !== "undefined"
        ? (localStorage.getItem(STORAGE_KEY) as Language | null)
        : null;
    return saved === "en" || saved === "ar" ? saved : "ar";
  });

  const isRtl = language === "ar";
  const dir: "rtl" | "ltr" = isRtl ? "rtl" : "ltr";

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {}

    // ✅ Source of truth
    document.documentElement.lang = isRtl ? "ar" : "en";
    document.documentElement.dir = dir;

    document.body.dir = dir;
    document.body.style.direction = dir;
    document.body.style.unicodeBidi = "isolate";

    // ✅ for tailwind rtl: / ltr:
    document.documentElement.classList.toggle("rtl", isRtl);
    document.documentElement.classList.toggle("ltr", !isRtl);
  }, [dir, isRtl, language]);

  const t = useMemo(() => {
    return (key: TranslationKey) => {
      const entry = translations[key];
      return entry ? entry[language] : String(key);
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRtl }}>
      <div
        dir={dir}
        className={isRtl ? "rtl" : "ltr"}
        style={{ direction: dir }}
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}
