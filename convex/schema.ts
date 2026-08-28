// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ===== Users & Authentication =====
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    phone: v.optional(v.string()), // ✅ هاتف الموظف — للسائقين يظهر للعميل أثناء التوصيل (اتصال/واتساب)
    role: v.union(
      v.literal("ADMIN"),
      v.literal("KITCHEN"),
      v.literal("DELIVERY"),
      v.literal("NUTRITIONIST"),
      v.literal("INVENTORY_MANAGER"),
      v.literal("ACCOUNTANT"),
      v.literal("FINANCE_MANAGER"),
      v.literal("CASHIER")
    ),
    // ✅ صلاحيات صفحات مخصّصة لكل حساب (قايمة مسارات). لو موجودة تتجاوز صلاحيات الدور.
    //    الدور بيفضل قالب افتراضي. ADMIN دايمًا كامل الصلاحيات.
    permissions: v.optional(v.array(v.string())),
    // ✅ PIN للكاشير (4-6 أرقام مشفّرة). يستخدم للدخول السريع على شل POS بدون كتابة إيميل/باسورد.
    pinHash: v.optional(v.string()),
    // POS access is independent from the staff role, avoiding duplicate user accounts.
    posEnabled: v.optional(v.boolean()),
    // ✅ فرع الكاشير المُعيَّن عليه (POS متعدّد الفروع). الأدمن يقدر يغيّره لتغطية فرع آخر.
    posBranchId: v.optional(v.id("posBranches")),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // ===== POS: الفروع (متعدّد الفروع) =====
  posBranches: defineTable({
    name: v.string(),
    code: v.optional(v.string()),        // اختصار قصير يظهر على الفاتورة (مثلاً "LUS")
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_active", ["isActive"]),

  /**
   * سجل تعديل الحقول الحسّاسة في حساب المشترك (الوردية، التواريخ، عدد
   * الوجبات، الباقة). `updatedAt` وحده لا يكفي: يُكتب فوقه في كل تعديل — حتى
   * إضافة نقاط الولاء تدوس عليه — فلم نعرف من حوّل خمسة مشتركين من صباحي
   * لمسائي ولا متى، واستغرق التحقيق ساعة. هنا: من، ماذا، من قيمة إلى قيمة.
   */
  customerFieldChanges: defineTable({
    customerId: v.id("customers"),
    customerName: v.optional(v.string()),
    field: v.string(),          // deliveryTime | startDate | endDate | mealsPerDay …
    fromValue: v.optional(v.string()),
    toValue: v.optional(v.string()),
    byUserId: v.optional(v.id("users")),
    byName: v.optional(v.string()),
    /** أثر جانبي طُبّق تلقائياً بسبب التعديل (مثل مزامنة خطط مستقبلية). */
    effect: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_customer", ["customerId"])
    .index("by_at", ["at"]),

  // ===== POS: sessions (PIN-based, للكاشير على شل POS المنفصل) =====
  posSessions: defineTable({
    token: v.string(),
    cashierId: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]).index("by_cashier", ["cashierId"]),

  // ✅ محاولات دخول POS الفاشلة — للـrate limiting ضد تخمين الـPIN
  posLoginAttempts: defineTable({
    key: v.string(),   // مفتاح تعريف (device fingerprint أو IP hash — حالياً "global" لبساطة)
    at: v.number(),
  }).index("by_key", ["key"]),

  // ===== POS: فئات مخصّصة (تسمح بترتيب Loyverse-style: Beef/Chicken/Wraps بدل تصنيف المنيو) =====
  posCategories: defineTable({
    name: v.string(),
    color: v.string(),                  // hex
    icon: v.optional(v.string()),       // lucide icon key
    sortOrder: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_active", ["isActive"]),

  // ===== POS: بيانات عرض الأصناف (لون الزر، اسم مختصر، فئة POS، ترتيب، اخفاء) =====
  //   Meta لكل publicMeal. لو مفيش صف هنا، تُستخدم القيم الافتراضية (اسم الوجبة، تصنيف المنيو).
  posItems: defineTable({
    mealId: v.id("publicMeals"),
    displayName: v.optional(v.string()),      // اسم مختصر لزر POS
    color: v.optional(v.string()),            // hex
    posCategoryId: v.optional(v.id("posCategories")),
    sortOrder: v.optional(v.number()),
    isHidden: v.optional(v.boolean()),
    posPrice: v.optional(v.number()),          // سعر POS مخصص (اختياري)
    updatedAt: v.optional(v.number()),
  }).index("by_meal", ["mealId"]).index("by_pos_category", ["posCategoryId"]),

  // ===== POS: الورديات =====
  posShifts: defineTable({
    cashierId: v.id("users"),
    cashierName: v.string(),
    branchId: v.optional(v.id("posBranches")),   // فرع الوردية
    openedAt: v.number(),
    closedAt: v.optional(v.number()),
    openingCash: v.number(),
    closingCash: v.optional(v.number()),
    expectedCash: v.optional(v.number()),   // openingCash + مبيعات كاش - refunds
    cashDiff: v.optional(v.number()),        // closingCash - expectedCash (سالب = عجز)
    totalSales: v.number(),
    ticketsCount: v.number(),
    notes: v.optional(v.string()),
    status: v.union(v.literal("OPEN"), v.literal("CLOSED")),
  }).index("by_cashier", ["cashierId"]).index("by_status", ["status"]),

  // ===== POS: الفواتير =====
  posTickets: defineTable({
    ticketNumber: v.number(),                 // متسلسل (عام لكل الفروع)
    cashierId: v.id("users"),
    cashierName: v.string(),
    branchId: v.optional(v.id("posBranches")),   // فرع الفاتورة
    shiftId: v.optional(v.id("posShifts")),
    status: v.union(
      v.literal("OPEN"),                      // معلّقة (parked)
      v.literal("PAID"),                      // مدفوعة
      v.literal("REFUNDED"),                  // مرتجعة
      v.literal("VOID")                       // ملغاة
    ),
    orderType: v.optional(v.string()),        // dine-in / takeaway / delivery
    subtotal: v.number(),
    discount: v.number(),
    tax: v.number(),
    total: v.number(),
    paymentMethod: v.optional(v.string()),    // cash / card / talabat / snoonu / rafeeq / keeta / transfer / staff / mixed
    // ✅ دفع مقسوم/مختلط: أكثر من طريقة على نفس الفاتورة (مثلاً 60 كارت + 40 كاش).
    //    لو موجود، paymentMethod = "mixed" والمجموع يساوي total. الفواتير القديمة بدون الحقل.
    payments: v.optional(v.array(v.object({ method: v.string(), amount: v.number() }))),
    cashReceived: v.optional(v.number()),
    changeAmount: v.optional(v.number()),
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
    // ✅ فاتورة خارج الإيراد (وجبة موظف/ضيافة/تجربة). تطلع فاتورة عادية بمبلغ،
    //    لكن ما تدخلش إجمالي المبيعات ولا مبيعات الوردية. تظهر منفصلة في التقارير.
    isNonRevenue: v.optional(v.boolean()),
    // ✅ مفتاح Idempotency لمنع تكرار الدفع (double-click / retry / انقطاع الشبكة)
    idempotencyKey: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_shift", ["shiftId"])
    .index("by_paidAt", ["paidAt"])
    .index("by_cashier", ["cashierId"])
    .index("by_branch", ["branchId"])
    .index("by_idem", ["idempotencyKey"]),

  // ===== POS: أسطر الفواتير =====
  posTicketLines: defineTable({
    ticketId: v.id("posTickets"),
    mealId: v.optional(v.id("publicMeals")),
    name: v.string(),
    qty: v.number(),
    unitPrice: v.number(),
    lineTotal: v.number(),
    notes: v.optional(v.string()),
  }).index("by_ticket", ["ticketId"]),

  // ===== POS: عدّاد رقم الفاتورة (global counter) =====
  posCounters: defineTable({
    key: v.string(),                          // "ticket_number"
    value: v.number(),
  }).index("by_key", ["key"]),

  // ===== OT approvals (أوفرتايم معتمد يدويًا يتجاوز المحسوب من البصمة) =====
  otApprovals: defineTable({
    name: v.string(),      // اسم الموظف
    month: v.string(),     // yyyy-MM
    otHours: v.number(),   // الأوفرتايم المعتمد (ساعات)
    updatedAt: v.number(),
  }).index("by_month", ["month"]).index("by_name_month", ["name", "month"]),

  // ===== Meal Issuances (حصر الوجبات الصادرة داخليًا: مدير/موظفين/تجربة/ضيافة/هدر) =====
  mealIssuances: defineTable({
    date: v.string(),                 // yyyy-MM-dd
    month: v.string(),                // yyyy-MM (للتقارير الشهرية)
    mealName: v.string(),             // اسم الوجبة (نصي)
    publicMealId: v.optional(v.id("publicMeals")),
    menuItemId: v.optional(v.id("menuItems")), // للخصم من المخزون لاحقًا لو فيه وصفة
    quantity: v.number(),
    category: v.union(
      v.literal("MANAGER"),           // مدير الفرع
      v.literal("STAFF"),             // موظفين
      v.literal("TASTING"),           // تجربة وتذوق
      v.literal("GUEST"),             // ضيافة
      v.literal("WASTE"),             // هدر/تالف
      v.literal("OTHER"),
    ),
    recipient: v.optional(v.string()),// اسم المستلم (للموظفين مثلاً)
    note: v.optional(v.string()),
    loggedBy: v.optional(v.string()), // مين سجّل
    inventoryConsumedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_month", ["month"]),

  // ===== Online Orders (حصر طلبات المنصّات: طلبات/سنونو/رفيق/ديليفرو/كيتا) =====
  onlineOrders: defineTable({
    date: v.string(),                 // yyyy-MM-dd
    month: v.string(),                // yyyy-MM
    platform: v.union(
      v.literal("TALABAT"),
      v.literal("SNOONU"),
      v.literal("RAFEEQ"),
      v.literal("DELIVEROO"),
      v.literal("KEETA"),
      v.literal("OTHER"),
    ),
    mealsCount: v.number(),           // عدد الوجبات في الطلب
    amount: v.number(),               // قيمة الطلب بالريال
    orderRef: v.optional(v.string()), // رقم الطلب (اختياري)
    note: v.optional(v.string()),
    loggedBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_month", ["month"]),

  // ===== Leaves (إجازات الموظفين) =====
  leaves: defineTable({
    name: v.string(),                 // اسم الموظف
    type: v.union(
      v.literal("annual"),            // سنوية
      v.literal("sick"),              // مرضية
      v.literal("travel"),            // سفر
      v.literal("unpaid"),            // بدون راتب
      v.literal("emergency"),         // طارئة
      v.literal("other"),             // أخرى
    ),
    startDate: v.string(),            // yyyy-MM-dd
    endDate: v.string(),              // yyyy-MM-dd
    days: v.number(),                 // عدد أيام الإجازة
    paid: v.boolean(),                // مدفوعة؟
    reason: v.optional(v.string()),
    status: v.optional(v.string()),   // approved / pending
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_type", ["type"]),

  // ===== Attendance (الحضور اليومي — يدوي أو من جهاز البصمة) =====
  attendance: defineTable({
    name: v.string(),                 // اسم الموظف
    designation: v.optional(v.string()),
    date: v.string(),                 // yyyy-MM-dd
    month: v.string(),                // yyyy-MM (مشتق من التاريخ)
    status: v.union(
      v.literal("present"),           // حاضر
      v.literal("absent"),            // غائب
      v.literal("leave"),             // إجازة
      v.literal("half"),              // نصف يوم
    ),
    checkIn: v.optional(v.string()),  // HH:mm
    checkOut: v.optional(v.string()), // HH:mm
    workedHours: v.optional(v.number()),
    otHours: v.optional(v.number()),
    late: v.optional(v.boolean()),
    source: v.optional(v.union(v.literal("manual"), v.literal("biometric"))),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_date", ["date"])
    .index("by_month", ["month"])
    .index("by_name", ["name"])
    .index("by_name_date", ["name", "date"]),

  // ===== Payroll (كشف رواتب الموظفين) =====
  payroll: defineTable({
    name: v.string(),
    designation: v.string(),
    basic: v.number(),
    allowance: v.number(),
    days: v.number(),         // أيام العمل في الشهر
    overtime: v.number(),     // مبلغ الأوفرتايم
    advance: v.number(),      // سلفة
    paid: v.number(),         // المدفوع
    otHours: v.optional(v.number()),   // ساعات الأوفرتايم
    fridays: v.optional(v.number()),   // أيام الجمعة
    month: v.string(),        // "2026-05"
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    // 🔒 soft delete — الحذف الفعلي محظور، ننقل السجل لـisVoid=true مع سبب ومنفذ
    isVoid: v.optional(v.boolean()),
    voidedAt: v.optional(v.number()),
    voidedBy: v.optional(v.string()),
    voidReason: v.optional(v.string()),
  })
    .index("by_month", ["month"]),

  // ===== ساعات الدوام القياسية لكل موظف (يُحسب عليها الأوفرتايم) =====
  //   الأوفرتايم اليومي = max(0, ساعات العمل − standardHours). الافتراضي 9 لو مفيش صف.
  employeeWorkSettings: defineTable({
    name: v.string(),
    standardHours: v.number(),   // 8 / 9 / 11 ...
    // أيام الإجازة الأسبوعية (0=الأحد ... 6=السبت). الحضور فيها = كل الساعات أوفرتايم.
    restDays: v.optional(v.array(v.number())),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  // ===== Password reset codes (OTP via email) =====
  passwordResetCodes: defineTable({
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // 🔒 سجل طلبات استعادة كلمة المرور (لل rate limiting) — يحفظ فقط timestamp
  //    ولا يحفظ الكود؛ الغرض منع flooding + تعطيل الحساب.
  passwordResetRequests: defineTable({
    email: v.string(),
    at: v.number(),
  }).index("by_email", ["email"]),

  // ===== Sessions (server-side auth tokens) =====
  sessions: defineTable({
    token: v.string(),
    accountType: v.union(v.literal("staff"), v.literal("customer")),
    userId: v.optional(v.id("users")),
    customerAccountId: v.optional(v.id("customerAccounts")),
    role: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  /**
   * محاولات تسجيل الدخول الفاشلة — لمنع تخمين كلمات المرور.
   * المفتاح = البريد بحروف صغيرة. يُحذف الصف عند نجاح الدخول.
   */
  loginAttempts: defineTable({
    key: v.string(),
    count: v.number(),
    firstAt: v.number(),
    lastAt: v.number(),
  }).index("by_key", ["key"]),

  /**
   * دلاء تحديد المعدّل للدوال العامة المكلِّفة (استدعاءات الذكاء الاصطناعي).
   * Convex لا يكشف عنوان IP، لذلك المفتاح = اسم الدالة (دلو عام) أو
   * "الدالة:الهاتف" عند توفّره.
   */
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStart: v.number(),
  }).index("by_key", ["key"]),

  // ===== Customer Accounts (for public login) =====
  customerAccounts: defineTable({
    restaurantKey: v.optional(v.string()),
    email: v.string(),
    passwordHash: v.string(),
    phone: v.string(),
    fullName: v.string(),
    customerId: v.optional(v.id("customers")), // Link to subscription
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_customerId", ["customerId"]),

  customers: defineTable({
    restaurantKey: v.optional(v.string()),
    fullName: v.string(),
    phone: v.string(),
    gender: v.optional(v.union(v.literal("MALE"), v.literal("FEMALE"))),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    startDate: v.string(), // yyyy-MM-dd
    endDate: v.string(), // yyyy-MM-dd

    address: v.optional(v.string()),
    // ✅ إحداثيات الموقع للخريطة والتوصيل (من التحويل التلقائي أو تحديد يدوي)
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    goals: v.optional(v.string()),
    allergies: v.optional(v.string()),
    notes: v.optional(v.string()),
    
    // ✅ التفضيلات والممنوعات والكميات (تُنقل للمطبخ تلقائياً)
    avoid: v.optional(v.string()), // الممنوعات: "بدون بصل، بدون مايونيز"
    preferences: v.optional(v.string()), // التفضيلات: "كثير صوص، خفيف ملح"
    portions: v.optional(v.string()), // الكميات: "نصف حصة أرز، حصة كبيرة بروتين"
    // ✅ تخصيص كميات/سعرات المشترك للوجبات الرئيسية (اختياري) — يُطبَّق فقط لمن حُدِّد له.
    //    فارغ = يستخدم الافتراضي حسب الباقة (programPortions). لا يحوّله لمخصّص.
    carbGrams: v.optional(v.number()),         // جرامات الكارب (رز) — تتجاوز افتراضي الباقة
    proteinGrams: v.optional(v.number()),      // جرامات البروتين — تتجاوز افتراضي الباقة
    mainMealCalories: v.optional(v.number()),  // سعرات الوجبة الرئيسية اليدوية — تُطبع على الستيكر
    // ✅ سعرات مخصّصة لوجبات معيّنة بذاتها (لهذا المشترك فقط) — أعلى أولوية على الستيكر.
    //    المطابقة بالاسم؛ لو الوجبة لها رقم هنا يُطبع كما هو (بلا مُعامل برنامج).
    mealCalorieOverrides: v.optional(v.array(v.object({
      meal: v.string(),        // اسم الوجبة (كما يظهر)
      calories: v.number(),    // السعرات المطلوب طباعتها
    }))),

    isActive: v.boolean(),

    // ✅ تجميد الاشتراك (سفر/ظرف طارئ) — الأيام المجمّدة تُعوَّض في آخر الاشتراك.
    //    التعويض يُحسب بأيام التوصيل (السبت→الأربعاء)، لا بالأيام التقويمية،
    //    لأن الخميس والجمعة إجازة أصلاً ولا يُخصمان من العميل.
    /**
     * فترات الاشتراك السابقة (التجديدات). التجديد كان يكتب البداية والنهاية
     * الجديدتين فوق القديمتين فتُمحى الفترة المنتهية: ستة مشتركين انتهت
     * فترتهم 30-7 وجدّدوا من 1-8، فصار سجلّهم يقول «يبدأ 1-8» وخططهم من 14-7
     * إلى 30-7 — وقد أكلوها فعلاً — تُقرأ كأنها «قبل الاشتراك»، فكادت تُحذف.
     * كل تجديد يدفع الفترة المنتهية هنا، فيبقى تاريخ العميل كاملاً.
     */
    subscriptionHistory: v.optional(v.array(v.object({
      startDate: v.string(),
      endDate: v.string(),
      packageLabel: v.optional(v.string()),
      mealsPerDay: v.optional(v.number()),
      snacksPerDay: v.optional(v.number()),
      renewedAt: v.number(),
      renewedByName: v.optional(v.string()),
    }))),

    pausedFrom: v.optional(v.string()),           // yyyy-MM-dd — أول يوم تجميد (غير موجود = نشط)
    pauseExpectedResume: v.optional(v.string()),  // yyyy-MM-dd — تاريخ رجوع متوقّع (اختياري)
    pauseHistory: v.optional(
      v.array(
        v.object({
          from: v.string(),          // أول يوم تجميد
          to: v.string(),            // أول يوم بعد الرجوع (غير مشمول)
          deliveryDays: v.number(),  // عدد أيام التوصيل التي عُوِّضت
          by: v.optional(v.string()),
          at: v.number(),
        })
      )
    ),

    // ✅ السائق الافتراضي — ربط دائم: هذا السائق مسؤول عن توصيل هذا العميل،
    //    والخطط اليومية ترثه تلقائياً (يظل قابلاً للتعديل يوم بيوم).
    defaultDriverId: v.optional(v.id("users")),

    // الخدمة الذاتية + الولاء
    skippedDates: v.optional(v.array(v.string())), // أيام التوصيل المتخطّاة yyyy-MM-dd
    loyaltyPoints: v.optional(v.number()),         // نقاط الولاء
    loyaltyCredit: v.optional(v.number()),         // رصيد الخصم المستبدَل بالنقاط (ر.ق)
    loyaltyHistory: v.optional(
      v.array(
        v.object({
          type: v.string(),        // EARN | REDEEM
          points: v.number(),      // + للكسب، - للاستبدال
          credit: v.optional(v.number()), // ر.ق ناتجة عند الاستبدال
          note: v.optional(v.string()),
          at: v.number(),
        }),
      ),
    ),
    referredBy: v.optional(v.string()),            // كود من أحاله

    durationWeeks: v.optional(v.number()),
    mealsPerDay: v.optional(v.number()),
    snacksPerDay: v.optional(v.number()),
    totalMealsPerDay: v.optional(v.number()),
    goalType: v.optional(v.string()),

    program: v.optional(v.string()),
    packageLabel: v.optional(v.string()),
    // ✅ يستلم وجبات الجمعة يوم الخميس: نفس وجبات الخميس ×2 (بوكسان). يوم الخميس فقط،
    //    للعميل المفعّل فقط. لا يمسّ حساب المدة/الأيام؛ الأخصائية تعدّل السعر يدوياً.
    fridayDouble: v.optional(v.boolean()),
    paymentMethod: v.optional(v.string()),
    price: v.optional(v.number()),
    discount: v.optional(v.number()),
    finalPrice: v.optional(v.number()),
    birthdayDate: v.optional(v.string()),
    status: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_phone", ["phone"])
    .index("by_deliveryTime", ["deliveryTime"])
    .index("by_active", ["isActive"]),

  // ===== CRM: ملاحظات ومهام المتابعة الداخلية =====
  customerFollowUps: defineTable({
    customerId: v.id("customers"),
    type: v.union(v.literal("RENEWAL"), v.literal("DELIVERY_FAILURE"), v.literal("GENERAL")),
    status: v.union(v.literal("OPEN"), v.literal("DONE"), v.literal("DISMISSED")),
    dueDate: v.optional(v.string()),
    note: v.string(),
    sourcePlanId: v.optional(v.id("dailyPlans")),
    assignedTo: v.optional(v.id("users")),
    createdBy: v.optional(v.id("users")),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_customer", ["customerId", "status"])
    .index("by_status", ["status", "dueDate"])
    .index("by_plan", ["sourcePlanId"]),

  // ===== CRM: إعدادات وسجل رسائل واتساب الآلية =====
  messageAutomationSettings: defineTable({
    channel: v.literal("WHATSAPP"),
    enabled: v.boolean(),
    testMode: v.boolean(),
    timezone: v.string(),
    sendHour: v.number(),
    renewal7Enabled: v.boolean(),
    renewal3Enabled: v.boolean(),
    expiryDayEnabled: v.boolean(),
    expired2Enabled: v.boolean(),
    deliveryFailureEnabled: v.boolean(),
    templateRenewalAr: v.string(),
    templateRenewalEn: v.string(),
    templateDeliveryAr: v.string(),
    templateDeliveryEn: v.string(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_channel", ["channel"]),

  messageAutomationLogs: defineTable({
    customerId: v.optional(v.id("customers")),
    customerName: v.string(),
    phone: v.string(),
    eventKey: v.string(),
    language: v.string(),
    status: v.union(
      v.literal("SIMULATED"),
      v.literal("QUEUED"),
      v.literal("SENT"),
      v.literal("FAILED"),
      v.literal("SKIPPED"),
    ),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_customer", ["customerId", "createdAt"])
    .index("by_event", ["eventKey", "createdAt"]),

  mealCategories: defineTable({
    name: v.string(),
    sortOrder: v.number(),
  }).index("by_sortOrder", ["sortOrder"]),

  menuItems: defineTable({
    name: v.string(),
    categoryId: v.id("mealCategories"),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fats: v.optional(v.number()),
    macros: v.optional(v.string()),
    isActive: v.boolean(),
    tags: v.optional(v.array(v.string())),
    // 🔗 الرابط الثابت بالمنيو العام (publicMeals) — مصدر الجدولة والاسم العربي
    //    والصورة. كان الربط يتم بمطابقة الاسم وقت العرض، فأي فرق إملائي
    //    (SHAWERMA/Shawarma) يُسقِط الوجبة من خطة الأخصائية بصمت بلا خطأ.
    //    الآن يُحسم مرة واحدة ويُخزَّن، فتصحيح أي اسم لا يكسر الربط.
    publicMealId: v.optional(v.id("publicMeals")),
  })
    .index("by_categoryId", ["categoryId"])
    .index("by_active", ["isActive"])
    .index("by_publicMeal", ["publicMealId"]),

  addons: defineTable({
    name: v.string(),
    price: v.optional(v.number()),
    isActive: v.boolean(),
  }).index("by_active", ["isActive"]),

  // ✅ أهم جزء: modifiers + index by_group_sort
  modifiers: defineTable({
    name: v.string(),
    // ✅ SWAP = استبدال مكوّن داخل الوجبة (رز ← بطاطس مهروسة). نوع مستقل عن
    //    الممنوعات/التفضيلات ليظهر بشكل مميّز للشيف ولا يضيع وسط الملاحظات.
    group: v.union(v.literal("AVOID"), v.literal("PREF"), v.literal("PORTION"), v.literal("SWAP")),
    isActive: v.boolean(),
    sortOrder: v.number(),
    // ── حقول الاستبدال (SWAP فقط) ──
    swapFrom: v.optional(v.string()),      // المكوّن الأصلي: "رز أبيض"
    swapTo: v.optional(v.string()),        // البديل: "بطاطس مهروسة"
    caloriesDelta: v.optional(v.number()), // فرق السعرات (سالب/موجب) — يُطبَّق تلقائياً
  })
    .index("by_group_sort", ["group", "sortOrder"])
    .index("by_active", ["isActive"]),

  dailyPlans: defineTable({
    restaurantKey: v.optional(v.string()),
    date: v.string(), // yyyy-MM-dd or ISO
    customerId: v.optional(v.id("customers")), // ✅ اختياري - قد يكون عميل جديد
    customerName: v.optional(v.string()), // ✅ اسم العميل (للطلبات الجديدة بدون ربط)
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    status: v.string(),
    notes: v.optional(v.string()),
    items: v.any(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    // استثناء يومي موثّق لعدد وجبات مختلف عن الباقة (مثلاً وجبة إضافية ليوم واحد).
    // يرتبط بالعدد المتوقع والفعلي، لذلك لا يغطي أي تعديل لاحق تلقائياً.
    mealCountOverride: v.optional(v.object({
      expected: v.number(),
      actual: v.number(),
      approvedBy: v.id("users"),
      approvedByName: v.optional(v.string()),
      approvedAt: v.number(),
    })),
    // ✅ تتبع المصدر — لو الخطة جاية من approve order، نحفظ orderId
    // عشان نمنع التكرار لو الـ approve اتنفذ أكثر من مرة لنفس الطلب
    sourceOrderId: v.optional(v.id("customerOrders")),
    // ✅ "CUSTOMIZED" = صفّ تشغيلي وُلد من قالب مخصّص عند «تحضير الكل» ليدخل
    //    صاحبه منظومة التوصيل. المطبخ والاستيكرات يقرآن القالب نفسه ويتجاهلانه.
    origin: v.optional(v.string()),
    // ✅ ختم خصم المخزون (idempotent) — يُملأ عند تحضير الخطة وخصم المكوّنات
    inventoryConsumedAt: v.optional(v.number()),
    // ✅ أختام التوصيل الحقيقية (بدل وقت العرض المتغيّر)
    outForDeliveryAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    // ✅ نظام التوصيل والتتبع الحي
    driverId: v.optional(v.id("users")),        // السائق المسند لهذه المحطة
    trackToken: v.optional(v.string()),         // توكن عشوائي لصفحة تتبع العميل العامة
    podNote: v.optional(v.string()),            // إثبات التسليم (مثال: "تُسلّم للحارس")
    podStorageId: v.optional(v.id("_storage")), // صورة إثبات التسليم (اختياري)
    routeSeq: v.optional(v.number()),           // ترتيب المحطة في مسار السائق
    nearNotifiedAt: v.optional(v.number()),     // ختم إشعار "السائق قرّب"
    failedAt: v.optional(v.number()),           // ختم فشل التوصيل
    failReason: v.optional(v.string()),         // سبب الفشل (العميل غير موجود…)
    failCode: v.optional(v.string()),           // كود سبب موحّد للتقارير
    retryAction: v.optional(v.string()),        // الإجراء المطلوب: إعادة محاولة/مسائي/غد/CRM
    recipientName: v.optional(v.string()),      // اسم مستلم الطلب عند التسليم
    deliveredLat: v.optional(v.number()),       // موقع إثبات التسليم
    deliveredLng: v.optional(v.number()),
  })
    .index("by_date", ["date"])
    .index("by_customerId", ["customerId"])
    .index("by_source_order", ["sourceOrderId"])
    .index("by_track_token", ["trackToken"])
    .index("by_driver_date", ["driverId", "date"]),

  // ===== مواقع السائقين الحيّة (تتبع لحظي أثناء الجولة) =====
  driverLocations: defineTable({
    driverId: v.id("users"),
    lat: v.number(),
    lng: v.number(),
    updatedAt: v.number(),
  }).index("by_driver", ["driverId"]),

  // ===== Inventory Management Tables =====
  suppliers: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
    crNumber: v.optional(v.string()),   // رقم السجل التجاري (CR 157972)
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
  }),

  inventoryCategories: defineTable({
    code: v.string(),
    nameAr: v.string(),
    nameEn: v.string(),
    color: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"]).index("by_active", ["isActive"]),

  inventoryLocations: defineTable({
    code: v.string(),
    nameAr: v.string(),
    nameEn: v.string(),
    locationType: v.string(),
    parentId: v.optional(v.id("inventoryLocations")),
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"]).index("by_active", ["isActive"]),

  inventoryUnits: defineTable({
    code: v.string(),
    nameAr: v.string(),
    nameEn: v.string(),
    dimension: v.string(),
    baseFactor: v.number(),
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"]).index("by_active", ["isActive"]),

  inventoryItems: defineTable({
    barcode: v.optional(v.string()),
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    category: v.string(),
    unit: v.string(),
    sku: v.optional(v.string()),
    itemType: v.optional(v.string()), // ingredient | packaging | consumable | asset
    purchaseUnit: v.optional(v.string()),
    purchaseToBaseFactor: v.optional(v.number()),
    defaultLocationId: v.optional(v.id("inventoryLocations")),
    notes: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    minStock: v.number(),
    targetStock: v.number(),
    currentStock: v.number(),
    avgWeeklyUsage: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_barcode", ["barcode"])
    .index("by_category", ["category"]),

  /**
   * ✅ ربط الصنف بمورّديه — الصنف الواحد يأتي من أكثر من مورّد بسعر مختلف،
   *    و inventoryItems.supplierId المفرد لا يتّسع لذلك. هنا سجل لكل (صنف، مورّد)
   *    يحمل آخر سعر وتاريخه وكود الصنف عند المورّد ووحدة الشراء، فتُقارَن الأسعار.
   */
  itemSuppliers: defineTable({
    itemId: v.id("inventoryItems"),
    supplierId: v.id("suppliers"),
    supplierSku: v.optional(v.string()),   // كود الصنف عند المورّد (476816…)
    supplierItemName: v.optional(v.string()), // اسمه في فاتورة المورّد كما هو
    purchaseUnit: v.optional(v.string()),  // CTN / KG / PCS …
    packSize: v.optional(v.string()),      // "24*400GM" — كما في الفاتورة
    lastUnitCost: v.optional(v.number()),  // آخر سعر لوحدة الشراء
    lastPurchasedAt: v.optional(v.string()), // yyyy-MM-dd
    timesPurchased: v.optional(v.number()),
    isPreferred: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_supplier", ["supplierId"])
    .index("by_item_supplier", ["itemId", "supplierId"]),

  /** رأس فاتورة الشراء كما وردت من المورّد — مرجع للتدقيق ومنع الاستيراد مرتين. */
  purchaseInvoices: defineTable({
    supplierId: v.id("suppliers"),
    supplierName: v.string(),
    invoiceNo: v.string(),
    invoiceDate: v.string(),               // yyyy-MM-dd
    // بيانات ترد على وجه الفاتورة ويُسأل عنها لاحقاً عند المراجعة أو النزاع
    lpoNo: v.optional(v.string()),         // رقم أمر الشراء (E758008621)
    deliveryNo: v.optional(v.string()),    // رقم الشحنة/التوصيل
    salesman: v.optional(v.string()),      // مندوب المبيعات
    receivedBy: v.optional(v.string()),    // من استلم البضاعة
    dueDate: v.optional(v.string()),       // تاريخ الاستحقاق
    paymentTerms: v.optional(v.string()),  // Credit / Cash / 0007
    currency: v.optional(v.string()),
    subtotal: v.optional(v.number()),
    discount: v.optional(v.number()),
    vat: v.optional(v.number()),
    total: v.number(),
    lineCount: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_supplier", ["supplierId"])
    .index("by_invoiceNo", ["invoiceNo"])
    .index("by_date", ["invoiceDate"]),

  inventoryBatches: defineTable({
    itemId: v.id("inventoryItems"),
    quantityReceived: v.number(),
    quantityRemaining: v.number(),
    unitCost: v.number(), // QAR
    supplierId: v.optional(v.id("suppliers")),
    expiryDate: v.optional(v.string()), // yyyy-MM-dd
    lotNumber: v.optional(v.string()),
    locationId: v.optional(v.id("inventoryLocations")),
    receivedAt: v.string(), // yyyy-MM-dd
    notes: v.optional(v.string()),
  })
    .index("by_itemId", ["itemId"])
    .index("by_expiryDate", ["expiryDate"]),

  inventoryMovements: defineTable({
    itemId: v.id("inventoryItems"),
    type: v.union(v.literal("receive"), v.literal("consume"), v.literal("adjust")),
    quantity: v.number(),
    unitCost: v.optional(v.number()),
    supplierId: v.optional(v.id("suppliers")),
    batchId: v.optional(v.id("inventoryBatches")),
    locationId: v.optional(v.id("inventoryLocations")),
    referenceType: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_itemId", ["itemId"])
    .index("by_type", ["type"])
    .index("by_createdAt", ["createdAt"]),

  inventoryStocktakes: defineTable({
    title: v.string(),
    stocktakeType: v.string(), // OPENING | CYCLE | FULL
    status: v.string(), // DRAFT | REVIEW | APPROVED | CANCELLED
    locationId: v.optional(v.id("inventoryLocations")),
    countedAt: v.string(),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    approvedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    approvedAt: v.optional(v.number()),
  }).index("by_status", ["status"]).index("by_createdAt", ["createdAt"]),

  inventoryStocktakeLines: defineTable({
    stocktakeId: v.id("inventoryStocktakes"),
    itemId: v.id("inventoryItems"),
    systemQuantity: v.number(),
    countedQuantity: v.number(),
    unitCost: v.optional(v.number()),
    expiryDate: v.optional(v.string()),
    lotNumber: v.optional(v.string()),
    locationId: v.optional(v.id("inventoryLocations")),
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_stocktake", ["stocktakeId"]).index("by_item", ["itemId"]),

  // أوامر الشراء (إعادة طلب من المورّد)
  purchaseOrders: defineTable({
    supplierId: v.optional(v.id("suppliers")),
    supplierName: v.optional(v.string()),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("SENT"),
      v.literal("RECEIVED"),
      v.literal("CANCELLED")
    ),
    items: v.array(
      v.object({
        itemId: v.id("inventoryItems"),
        nameAr: v.string(),
        unit: v.string(),
        quantity: v.number(),
        estUnitCost: v.number(),
        estLineCost: v.number(),
      })
    ),
    totalEst: v.number(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
  })
    .index("by_supplier", ["supplierId"])
    .index("by_status", ["status"]),

  // ===== Public Website Tables =====
  banners: defineTable({
    titleAr: v.string(),
    titleEn: v.optional(v.string()),
    subtitleAr: v.optional(v.string()),
    subtitleEn: v.optional(v.string()),
    imageUrl: v.string(),
    imageStorageId: v.optional(v.id("_storage")), // For deletion
    sortOrder: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_sortOrder", ["sortOrder"])
    .index("by_active", ["isActive"]),

  publicPlans: defineTable({
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    slug: v.string(), // diet-pack, bulking-pack, fitness-pack
    descriptionAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    imageUrl: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    duration: v.union(v.literal("week"), v.literal("two_weeks"), v.literal("month")),
    options: v.array(
      v.object({
        mealsCount: v.number(),
        snacksCount: v.number(),
        priceQAR: v.number(),
      })
    ),
    features: v.optional(v.array(v.string())),
    // Marketing fields
    badge: v.optional(v.union(
      v.literal("most_requested"),
      v.literal("best_value"),
      v.literal("most_chosen_business"),
      v.literal("special_offer")
    )),
    isFeatured: v.optional(v.boolean()), // Highlight this plan
    showInComparison: v.optional(v.boolean()), // Show in comparison table
    sortOrder: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_duration", ["duration"])
    .index("by_sortOrder", ["sortOrder"])
    .index("by_active", ["isActive"]),

  payLaterPayments: defineTable({
    orderId: v.string(),
    checkoutToken: v.string(),
    planId: v.id("publicPlans"),
    planName: v.string(),
    optionIndex: v.number(),
    amount: v.number(),
    /* أثر الخصم: السعر قبله، والكود، وقيمة الحسم. يُحفظ مع الدفعة نفسها
       فيُعرف لاحقاً ما جلبته كل حملة، ولا يُحتسب الاستخدام إلا بنجاح الدفع. */
    originalAmount: v.optional(v.number()),
    couponCode: v.optional(v.string()),
    couponDiscount: v.optional(v.number()),
    couponCounted: v.optional(v.boolean()),
    /* ختمُ إبلاغ الطاقم — يُكتب مرّةً فلا يتكرّر الإشعار مع كل استعلامٍ عن الحالة. */
    staffNotifiedAt: v.optional(v.number()),
    /* ردّ البوّابة كما ورد. الكود يعرف رمزين — ٢ نجاحاً و٣ فشلاً — وما عداهما
       يقع في «معلّقة». فلو ردّت برمزٍ آخر لرفض بطاقةٍ مثلاً، ظهرت الدفعة
       معلّقةً وهي مرفوضة، ولا شيء يدلّ على السبب. فيُحفظ الأصل ليُقرأ. */
    gatewayStatus: v.optional(v.string()),
    gatewayRaw: v.optional(v.string()),
    currency: v.literal("QAR"),
    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    environment: v.union(v.literal("sandbox"), v.literal("production")),
    status: v.union(v.literal("created"), v.literal("pending"), v.literal("success"), v.literal("failed")),
    payLaterOrderId: v.optional(v.string()),
    paymentLinkUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_orderId", ["orderId"])
    .index("by_checkoutToken", ["checkoutToken"]),

  publicMeals: defineTable({
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    slug: v.string(), // grilled-salmon-bowl
    descriptionAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    aboutAr: v.optional(v.string()), // long description
    aboutEn: v.optional(v.string()),
    imageUrl: v.optional(v.string()), // deprecated: use storageId instead
    storageId: v.optional(v.id("_storage")), // NEW: Convex storage ID
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fats: v.number(),
    category: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("salad"),
      v.literal("snack")
    ),
    tags: v.array(v.string()), // ["غني بالبروتين", "قليل الكربوهيدرات"]
    ingredients: v.array(v.string()),
    priceQAR: v.number(),
    // ✅ التكلفة التقديرية لتحضير الوجبة (ر.ق) — مطلوبة لتقارير الربحية وMenu Engineering.
    //    اختيارية: لو مش متعبّاة، تظهر الوجبة "بدون تكلفة" في التقارير.
    costQAR: v.optional(v.number()),
    // ✅ سعر مؤقّت للجم (اختياري). لو موجود يُستخدم كما هو في فواتير الجم؛
    //    لو غير موجود يُحسب من priceQAR بخصم الجم (gymAccounts.discountPct).
    gymPrice: v.optional(v.number()),
    // Optional display names used only by gym sales, without changing the public menu names.
    gymNameAr: v.optional(v.string()),
    gymNameEn: v.optional(v.string()),
    // Expected return window for gym consignments. Defaults to 4 for snacks/sweets, otherwise 2.
    gymReturnAfterDays: v.optional(v.number()),
    // ✅ يحدد لو الصنف يظهر في POS الجم (المدير يفعّل/يعطل من واجهة إدارة الأصناف).
    //    الأصناف الافتراضية = false (مش هتظهر في الجم).
    isGymItem: v.optional(v.boolean()),
    isGymOnly: v.optional(v.boolean()),
    // ✅ تصنيف المنفذ الحقيقي (PROTEIN/SIDES/SAUCE/SANDWICHES/SWEETS…) — لأصناف
    //    المنافذ التي لا تنتمي لتصنيفات المنيو الخمسة. يُستخدم للعرض والتجميع فقط.
    outletCategory: v.optional(v.string()),
    // ✅ وحدة السعر: "gram" (bulk بالجرام) أو "piece" (بالقطعة). للعرض وحساب الفاتورة.
    priceUnit: v.optional(v.union(v.literal("gram"), v.literal("piece"))),
    // Created specifically for the online/delivery POS. Never expose on the subscriber menu.
    isOnlineOnly: v.optional(v.boolean()),
    isActive: v.boolean(),
    sortOrder: v.number(),
    // Scheduling fields
    weeks: v.optional(v.array(v.number())), // legacy
    days: v.optional(v.array(v.string())),  // legacy
    // Exact week+day pairs from meal schedule (e.g. [{week:1,day:"saturday"}])
    schedule: v.optional(v.array(v.object({ week: v.number(), day: v.string() }))),
    cutoffTime: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  // ===== Customer Orders (from public website) =====
  customerOrders: defineTable({
    restaurantKey: v.optional(v.string()),
    // Customer Info
    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    customerId: v.optional(v.id("customers")), // ربط بالمشترك الفعلي
    
    // Order Info
    status: v.union(
      v.literal("pending"),    // في انتظار المراجعة
      v.literal("confirmed"),  // تم التأكيد
      v.literal("active"),     // قيد التنفيذ
      v.literal("completed"),  // اكتمل
      v.literal("cancelled")   // ملغي
    ),
    totalMeals: v.number(),
    totalPrice: v.number(), // QAR
    totalCalories: v.number(),
    
    // Metadata
    orderNumber: v.string(), // رقم الطلب الفريد
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()), // وقت الموافقة
    approvalNotes: v.optional(v.string()), // ملاحظات الموافقة
    rejectedAt: v.optional(v.number()), // وقت الرفض
    rejectionReason: v.optional(v.string()), // سبب الرفض
    notes: v.optional(v.string()),
    // ✅ تاريخ بداية التوصيل الذي اختاره العميل — تُملأ به الأخصائية عند الاعتماد
    preferredStartDate: v.optional(v.string()),
    // ✅ توكن سرّي لصفحة جدول الوجبات العامة (رابط يُرسَل للعميل)
    planToken: v.optional(v.string()),
    // 🔒 توكن تتبع للعميل — عشوائي وطويل (بديل رقم الطلب المتوقّع)
    trackingToken: v.optional(v.string()),
    // 🔒 مفتاح idempotency لمنع تكرار الطلب
    idempotencyKey: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_phone", ["customerPhone"])
    .index("by_orderNumber", ["orderNumber"])
    .index("by_createdAt", ["createdAt"])
    .index("by_plan_token", ["planToken"])
    .index("by_tracking_token", ["trackingToken"])
    .index("by_idem", ["idempotencyKey"]),

  // ===== Customer Order Items =====
  customerOrderItems: defineTable({
    orderId: v.id("customerOrders"),
    mealId: v.id("publicMeals"),
    
    // Snapshot of meal data at time of order
    mealNameAr: v.string(),
    mealNameEn: v.optional(v.string()),
    calories: v.number(),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fats: v.optional(v.number()),
    category: v.string(),
    imageUrl: v.optional(v.string()),
    priceQAR: v.number(),
    
    // Schedule
    week: v.number(),
    day: v.string(), // "saturday", "sunday", etc.

    // ✅ ملاحظة الأخصائية على الوجبة (إضافة/تعديل) — تمرّ للمطبخ والاستيكر
    specialNotes: v.optional(v.string()),
    // Review-only provenance. Optional so existing orders remain valid.
    originalMealNameAr: v.optional(v.string()),
    originalMealNameEn: v.optional(v.string()),
    modifiedByName: v.optional(v.string()),
    modifiedByRole: v.optional(v.string()),
    modifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()), // لتعديل الوجبة من الأدمن
  })
    .index("by_orderId", ["orderId"])
    .index("by_mealId", ["mealId"])
    .index("by_week_day", ["week", "day"]),

  // ===== Notifications =====
  notifications: defineTable({
    // الجمهور المستهدف
    targetRole: v.optional(v.union(
      v.literal("ADMIN"),
      v.literal("KITCHEN"),
      v.literal("DELIVERY"),
      v.literal("NUTRITIONIST"),
      v.literal("INVENTORY_MANAGER")
    )),
    targetUserId: v.optional(v.id("users")), // إشعار شخصي لمستخدم محدد
    targetCustomerId: v.optional(v.id("customers")), // إشعار لعميل محدد (بوابة العميل)
    // المحتوى
    type: v.union(
      v.literal("NEW_ORDER"),         // طلب جديد من الموقع
      v.literal("ORDER_APPROVED"),    // تم اعتماد طلب
      v.literal("PLAN_CONFIRMED"),    // تم تأكيد خطة
      v.literal("MEAL_PREPARED"),     // تم تحضير وجبات
      v.literal("MEAL_DELIVERED"),    // تم التوصيل
      v.literal("LOW_STOCK"),         // مخزون منخفض
      v.literal("SYSTEM")             // إشعار عام
    ),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),     // رابط للانتقال عند الضغط
    relatedId: v.optional(v.string()), // ID مرتبط (order/plan/customer)
    // الحالة
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_targetRole", ["targetRole", "isRead"])
    .index("by_targetUserId", ["targetUserId", "isRead"])
    .index("by_targetCustomer", ["targetCustomerId", "isRead"])
    .index("by_createdAt", ["createdAt"]),

  // ===== Audit Log (تتبع الأحداث الحساسة) =====
  auditLog: defineTable({
    actorUserId: v.optional(v.id("users")),
    actorName: v.optional(v.string()),
    actorRole: v.optional(v.string()),
    action: v.string(),           // "CREATE_ORDER" / "APPROVE_ORDER" / "DELETE_PLAN" ...
    entityType: v.string(),       // "customer" / "order" / "plan" / "inventory" ...
    entityId: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_action", ["action"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_createdAt", ["createdAt"]),

  // ===== Recipe Ingredients (ربط الوجبة بمكوّنات المخزون) =====
  mealIngredients: defineTable({
    // publicMeals is the canonical meal catalogue. menuItemId remains optional
    // only so legacy recipes can be migrated without breaking historical data.
    publicMealId: v.optional(v.id("publicMeals")),
    menuItemId: v.optional(v.id("menuItems")),
    inventoryItemId: v.id("inventoryItems"),
    quantityPerServing: v.number(),  // الكمية المستهلكة لكل حصة
    unit: v.string(),                // الوحدة (kg, piece, etc.)
    createdAt: v.number(),
  })
    .index("by_publicMeal", ["publicMealId"])
    .index("by_menuItem", ["menuItemId"])
    .index("by_inventoryItem", ["inventoryItemId"]),

  // ===== Customer Ratings (تقييمات العملاء) =====
  ratings: defineTable({
    customerId: v.optional(v.id("customers")),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    menuItemId: v.optional(v.id("menuItems")),
    publicMealId: v.optional(v.id("publicMeals")),
    mealName: v.string(),
    stars: v.number(),               // 1..5
    comment: v.optional(v.string()),
    planDate: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_menuItem", ["menuItemId"])
    .index("by_publicMeal", ["publicMealId"])
    .index("by_customer", ["customerId"]),

  // ===== Coupons =====
  coupons: defineTable({
    /* المطعم الذي يسري عليه الكود. غيابه = أدرينالين، فالكوبونات القديمة
       تبقى كما كانت ولا ينفتح خصمُ مطعمٍ على الآخر. */
    restaurantKey: v.optional(v.string()),
    /* حدٌّ أدنى لقيمة الاشتراك كي يسري الكود — تُترك فارغة فيسري على الكل. */
    minOrderQAR: v.optional(v.number()),
    code: v.string(),
    discountType: v.union(v.literal("PERCENT"), v.literal("FIXED")),
    discountValue: v.number(),
    maxUses: v.optional(v.number()),
    usedCount: v.number(),
    expiresAt: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),

  // ===== قوالب الوجبات المخصّصة (لكل عميل مخصّص) =====
  //  العميل المخصّص يأكل نفس الوجبات يومياً، فنخزّن قالباً واحداً لكل عميل.
  //  slots: مصفوفة خانات (MEAL 1 / SNACK 1 / MEAL 2 …) كل خانة إمّا رئيسية
  //  ببنّاء الجرامات أو سناك/سلطة (اختيار طبق) أو OFF. text = النص المركّب
  //  الجاهز للمطبخ/الاستيكر ("150 G LEMON CHICKEN + 200 G RICE").
  customizedTemplates: defineTable({
    customerId: v.id("customers"),
    slots: v.any(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_customer", ["customerId"]),

  // ✅ مكتبة الأطباق المخصّصة الجاهزة (مبذورة من كشوف المطبخ) — تظهر كتركيبات
  //    قابلة للنقر في منتقي الوجبات المخصّصة، بالإنجليزي للمطبخ.
  customizedDishLibrary: defineTable({
    name: v.string(),                 // نص الطبق كما يقرؤه المطبخ (إنجليزي)
    type: v.string(),                 // MAIN | SNACK
    count: v.optional(v.number()),    // عدد مرات الاستخدام (للترتيب)
  }).index("by_name", ["name"]),

  /**
   * ✅ مبيعات الجم بالجملة — وجبات تُورَّد يوميًا لصالة الجم (زي نقطة بيع).
   *    كل سجل: التاريخ، اسم الجم، عدد الوجبات، سعر بيع الوجبة، والإجمالي.
   *    يُجمَّع أسبوعيًا/شهريًا لحصر كم وجبة راحت وكم إيراد.
   */
  // ⚠️ القديم — يُبقى للتوافق الرجعي مع سجلات مسبقة. نضيف تحته جداول تفصيلية جديدة.
  gymSales: defineTable({
    date: v.string(),                 // yyyy-MM-dd
    gymName: v.optional(v.string()),  // اسم الجم/الصالة
    meals: v.number(),                // عدد الوجبات
    unitPrice: v.number(),            // سعر بيع الوجبة (ر.ق)
    total: v.number(),                // الإجمالي = meals * unitPrice
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_date", ["date"]),

  // ✅ الجديد: قائمة الجمات (يبدأ بواحد، قابل للإضافة).
  gymAccounts: defineTable({
    name: v.string(),
    outletType: v.optional(v.union(v.literal("GYM"), v.literal("STORE"), v.literal("KIOSK"), v.literal("OTHER"))),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    discountPct: v.number(), // نسبة الخصم على سعر المنيو (0..100). افتراضي 20.
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_active", ["isActive"]),

  // Per-outlet catalogue: availability and prices stay isolated from all other channels.
  outletCatalogItems: defineTable({
    outletId: v.id("gymAccounts"),
    mealId: v.id("publicMeals"),
    price: v.number(),
    /* حقائق هذا المنفذ وحده — لكل محل حصّته وتقديمه، وبيانات المشترك على
       `publicMeals` مضبوطة ولا يجوز أن يحرّكها تعديل يخصّ محلاً. تُترك فارغة
       فيقرأ الملصق من مصدره القديم، وتُملأ فتغلب على كل ما عداها. */
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fats: v.optional(v.number()),
    // باركود هذا المنفذ إن اختلف؛ فارغاً يُستعمل باركود المنتج المطبوع
    barcode: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_outlet", ["outletId"])
    .index("by_outlet_meal", ["outletId", "mealId"]),

  // Standalone thermal labels for outlet products. This catalogue is deliberately
  // independent from subscriber plans and their kitchen sticker workflow.
  outletProductLabels: defineTable({
    sequence: v.number(),
    barcode: v.string(),
    nameEn: v.string(),
    price: v.optional(v.number()),
    calories: v.optional(v.number()),
    carbs: v.optional(v.number()),
    protein: v.optional(v.number()),
    fats: v.optional(v.number()),
    // ✅ ربط بصنف المنيو الأونلاين (POS) — لتحديث السعر/السعرات عند إعادة الاستيراد بدون تكرار
    publicMealId: v.optional(v.id("publicMeals")),
    // ✅ مصدر الصنف: "gym" (القائمة الأصلية) أو "online" (مستورد من POS). كتالوجان منفصلان.
    source: v.optional(v.union(v.literal("gym"), v.literal("online"))),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_sequence", ["sequence"])
    .index("by_barcode", ["barcode"])
    .index("by_publicMeal", ["publicMealId"])
    .index("by_active", ["isActive"]),

  // ✅ الجديد: طلبية جم يومية (رأس الفاتورة).
  // NOTE: gymOrders — idempotencyKey handled at app-level via unique constraint search.
  gymOrders: defineTable({
    date: v.string(),                 // yyyy-MM-dd
    gymId: v.id("gymAccounts"),
    discountPct: v.number(),          // خصم مطبّق (يُنسخ من gymAccounts وقت الحفظ)
    subtotal: v.number(),              // مجموع أسعار المنيو قبل الخصم
    discountAmount: v.number(),        // قيمة الخصم بالريال
    total: v.number(),                 // الصافي المستحق = subtotal - discountAmount
    mealsCount: v.number(),            // إجمالي الوجبات في الطلبية
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    // 🔒 soft delete — الحذف الفعلي محظور، ننقل الطلبية لـisVoid=true مع سبب ومنفذ
    isVoid: v.optional(v.boolean()),
    voidedAt: v.optional(v.number()),
    voidedBy: v.optional(v.string()),
    voidReason: v.optional(v.string()),
    // 🔒 تتبع تسجيل المرتجعات (كل الأسطر مع بعض)
    hasReturns: v.optional(v.boolean()),
    returnsRecordedAt: v.optional(v.number()),
    returnsRecordedBy: v.optional(v.string()),
    returnedTotal: v.optional(v.number()),      // مجموع المرتجعات (وجبات)
    wasteValue: v.optional(v.number()),          // قيمة الهالك (unitPrice × returnedQty)
    netTotal: v.optional(v.number()),            // الفاتورة الفعلية = total - wasteValue - shortageValue
    // ✅ تأكيد استلام الفرع بالماسح
    receiptConfirmedAt: v.optional(v.number()),
    receiptConfirmedBy: v.optional(v.string()),
    receivedCount: v.optional(v.number()),       // إجمالي الوجبات التي وصلت فعلاً
    shortageQty: v.optional(v.number()),         // المُرسَل − المستلم (وجبات)
    shortageValue: v.optional(v.number()),       // قيمة النقص بالريال — تُخصم من الفاتورة
    scanNotes: v.optional(v.string()),           // باركودات مُسحت وليست في الطلبية
  })
    .index("by_date", ["date"])
    .index("by_gym_date", ["gymId", "date"]),

  // ✅ الجديد: أسطر تفصيلية للطلبية.
  gymOrderLines: defineTable({
    orderId: v.id("gymOrders"),
    date: v.string(),                  // مكرّر من الطلبية عشان استعلامات التقارير السريعة
    gymId: v.id("gymAccounts"),
    mealId: v.optional(v.id("publicMeals")),
    mealNameEn: v.optional(v.string()),
    mealNameAr: v.optional(v.string()),
    qty: v.number(),
    listPrice: v.number(),             // السعر الأصلي من المنيو
    unitPrice: v.number(),             // السعر الفعلي بعد الخصم/gymPrice
    priceUnit: v.optional(v.string()),   // "gram" للموزون — يحدّد خانات العرض
    lineTotal: v.number(),             // qty * unitPrice
    // 🔒 المرتجعات = هالك (مدّة الوجبة يومين، ما بترجعش للمخزون)
    returnedQty: v.optional(v.number()),  // عدد الوجبات اللي رجعت من هذا السطر
    // ✅ تأكيد الاستلام بالماسح: كم وصل فعلاً مقابل qty المُرسَل.
    //    qty يبقى كما هو دائماً — لو عدّلناه لاختفى النقص من السجل ولم يعرف
    //    المطبخ الرئيسي أنه حدث أصلاً.
    receivedQty: v.optional(v.number()),
  })
    .index("by_order", ["orderId"])
    .index("by_meal_date", ["mealId", "date"])
    .index("by_date", ["date"]),

  // Every save is an immutable return batch tied to the original invoice.
  gymReturnBatches: defineTable({
    orderId: v.id("gymOrders"),
    gymId: v.id("gymAccounts"),
    orderDate: v.string(),
    returnDate: v.string(),
    totalQty: v.number(),
    wasteValue: v.number(),
    recordedBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_return_date", ["returnDate"])
    .index("by_gym_return_date", ["gymId", "returnDate"]),

  gymReturnBatchLines: defineTable({
    returnId: v.id("gymReturnBatches"),
    orderId: v.id("gymOrders"),
    orderLineId: v.id("gymOrderLines"),
    mealId: v.optional(v.id("publicMeals")),
    mealNameEn: v.optional(v.string()),
    mealNameAr: v.optional(v.string()),
    qty: v.number(),
    unitPrice: v.number(),
    wasteValue: v.number(),
    expectedAfterDays: v.number(),
  })
    .index("by_return", ["returnId"])
    .index("by_order", ["orderId"]),

  // ===== Restaurant Settings =====
  restaurantSettings: defineTable({
    /**
     * ✅ أسبوع دورة الوجبات الذي يطبخه المطبخ حالياً (1..4). موحّد لكل المطعم.
     * يتقدّم تلقائياً كل سبت (بداية أسبوع التوصيل) عبر crons، والأخصائية تراه
     * وتقدر ترجّعه. عليه يعتمد:
     *   - المنيو والخطة الذكية يبدآن من هذا الأسبوع (لا من 1).
     *   - عرض المطبخ يعرف أي أسبوع يجهّز.
     */
    currentCookingWeek: v.optional(v.number()),
    /** yyyy-MM-dd لآخر سبت تقدّم فيه الأسبوع تلقائياً — يمنع التقدّم مرتين. */
    cookingWeekAdvancedOn: v.optional(v.string()),
    /**
     * ✅ حصص البرامج (من كشف حسابات المطبخ): لكل برنامج جرامات الكارب،
     *    مدى البروتين (نص مثل "80-90")، ومُعامل السعرات لعرض سعرات المنيو
     *    حسب هدف العميل. شكلها:
     *    { DIET:{carb:100,protein:"80-90",calFactor:1}, FITNESS:{...}, BULK:{...} }
     */
    programPortions: v.optional(v.any()),
    /**
     * ✅ إعدادات برنامج الولاء (النظام القياسي للمطاعم):
     *    pointsPerOrder: نقاط تُمنح مع كل طلب معتمد (افتراضي 10)
     *    riyalPerPoint: قيمة النقطة بالريال عند الاستبدال (افتراضي 0.10)
     *    minRedeem: أقل عدد نقاط للاستبدال (افتراضي 100 = 10 ر.ق)
     */
    loyalty: v.optional(
      v.object({
        pointsPerOrder: v.number(),
        riyalPerPoint: v.number(),
        minRedeem: v.number(),
      }),
    ),
    // ✅ إعدادات الضريبة على مبيعات POS (قطر: افتراضي 0% حالياً — عدّلها إذا لزم)
    //    inclusive=true → السعر شامل الضريبة (نستخرجها منه للعرض)
    //    inclusive=false → نضيفها فوق السعر
    posTax: v.optional(v.object({
      pct: v.number(),
      inclusive: v.boolean(),
      label: v.optional(v.string()), // "VAT" أو "ضريبة"
    })),
    // ✅ معامل الأوفرتايم في المطعم (ساعة الأوفرتايم = المعدّل الساعي × هذا المعامل). افتراضي 1.5
    attendanceOtRate: v.optional(v.number()),
    // ✅ رسوم التوصيل الثابتة للطلبات المباشرة (سائق المطعم). افتراضي 10. للمنصّات لا تُضاف.
    posDeliveryFee: v.optional(v.number()),
    // ✅ تقرير POS اليومي بالإيميل (Z-report): مفعّل + مستقبلين + وقت الإرسال (HH:MM بتوقيت قطر)
    posDailyReport: v.optional(v.object({
      enabled: v.boolean(),
      recipients: v.array(v.string()),
      sendTime: v.optional(v.string()),   // "HH:MM" — الكرون يرسل عند تطابق الساعة/الدقيقة (قطر)
      lastSentDate: v.optional(v.string()), // yyyy-MM-dd — يمنع الإرسال مرتين في نفس اليوم
    })),
    // Contact Information
    phone: v.string(),
    email: v.string(),
    addressAr: v.string(),
    addressEn: v.string(),
    // ✅ إحداثيات المطعم (نقطة انطلاق التوصيل على الخريطة)
    storeLat: v.optional(v.number()),
    storeLng: v.optional(v.number()),

    // Social Media Links
    instagramUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    facebookUrl: v.optional(v.string()),
    tiktokUrl: v.optional(v.string()),
    snapchatUrl: v.optional(v.string()),
    whatsappNumber: v.optional(v.string()),
    
    // About / Description
    descriptionAr: v.string(),
    descriptionEn: v.string(),
    
    // Working Hours
    workingHoursAr: v.optional(v.string()),
    workingHoursEn: v.optional(v.string()),
    
    // Footer Links
    privacyPolicyUrl: v.optional(v.string()),
    termsUrl: v.optional(v.string()),
    
    // Hero Section Content
    heroTitleAr: v.optional(v.string()),
    heroTitleEn: v.optional(v.string()),
    heroSubtitleAr: v.optional(v.string()),
    heroSubtitleEn: v.optional(v.string()),
    heroLogoUrl: v.optional(v.string()), // شعار Hero Section
    heroLogoStorageId: v.optional(v.id("_storage")), // لحذف الصورة
    
    // Hero CTA Buttons
    heroCta1TextAr: v.optional(v.string()),
    heroCta1TextEn: v.optional(v.string()),
    heroCta1Link: v.optional(v.string()),
    heroCta2TextAr: v.optional(v.string()),
    heroCta2TextEn: v.optional(v.string()),
    heroCta2Link: v.optional(v.string()),
    
    // Metadata
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }),

  // ==================================================================
  // ===== المالية (Finance Core) — قيد مزدوج كامل، موديول مستقل =====
  //   بادئة fin* لكل الجداول. إضافي تمامًا — لا يمسّ أي منطق قائم.
  //   شركة واحدة (Adrenaline)؛ الفرع = posBranches؛ الضريبة من restaurantSettings.
  // ==================================================================

  // شجرة الحسابات (Chart of Accounts) — هرمية عبر parentId.
  finAccounts: defineTable({
    code: v.string(),                          // كود الحساب (مثال 1100)
    parentId: v.optional(v.id("finAccounts")), // الحساب الأب (null = جذر)
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    accountType: v.union(
      v.literal("asset"),      // أصول
      v.literal("liability"),  // خصوم
      v.literal("equity"),     // حقوق ملكية
      v.literal("revenue"),    // إيرادات
      v.literal("expense"),    // مصروفات
    ),
    accountSubType: v.optional(v.string()),    // تصنيف فرعي (cash/bank/cogs/payroll…)
    isPostable: v.boolean(),                   // هل يُرحَّل عليه مباشرة؟ (الأوراق فقط)
    normalBalance: v.union(v.literal("debit"), v.literal("credit")),
    // نوع تشغيلي للفلترة السريعة: cash | bank | trade_receivable | trade_payable | other
    operationalType: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    isSystem: v.optional(v.boolean()),         // حساب نظام (يمنع الحذف)
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_parent", ["parentId"])
    .index("by_type", ["accountType"])
    .index("by_active", ["isActive"]),

  // مراكز التكلفة (مطبخ/توصيل/جم/فرع…) — لربح كل نشاط على حدة.
  finCostCenters: defineTable({
    code: v.string(),
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    branchId: v.optional(v.id("posBranches")),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_active", ["isActive"]),

  // الفترات المالية — قفل يمنع التعديل بعد الإقفال.
  finPeriods: defineTable({
    name: v.string(),                          // "2026-07" أو "يوليو 2026"
    fiscalYear: v.number(),                    // 2026
    startDate: v.string(),                     // yyyy-MM-dd
    endDate: v.string(),                       // yyyy-MM-dd
    status: v.union(
      v.literal("open"),      // مفتوحة — يُسمح بالترحيل
      v.literal("locked"),    // مقفولة مؤقتًا
      v.literal("closed"),    // مقفلة نهائيًا (نهاية سنة)
    ),
    closedAt: v.optional(v.number()),
    closedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_year", ["fiscalYear"])
    .index("by_status", ["status"])
    .index("by_dates", ["startDate"]),

  // القيد اليومي — الرأس. مجموع المدين = مجموع الدائن (يُتحقَّق قبل الترحيل).
  finJournalEntries: defineTable({
    entryNumber: v.string(),                   // متسلسل (JV-000123)
    journalType: v.union(
      v.literal("general"),        // قيد يدوي عام
      v.literal("opening"),        // رصيد افتتاحي
      v.literal("adjustment"),     // تسوية
      v.literal("closing"),        // إقفال
      v.literal("reversing"),      // عكسي
      v.literal("auto_sales"),     // ترحيل تلقائي: مبيعات POS
      v.literal("auto_purchase"),  // مشتريات/استلام
      v.literal("auto_inventory"), // حركة/هدر مخزون
      v.literal("auto_payroll"),   // رواتب
      v.literal("auto_receipt"),   // سند قبض
      v.literal("auto_payment"),   // سند صرف
      v.literal("auto_gym"),       // مبيعات الجم
    ),
    entryDate: v.string(),                     // yyyy-MM-dd
    periodId: v.optional(v.id("finPeriods")),
    costCenterId: v.optional(v.id("finCostCenters")),
    branchId: v.optional(v.id("posBranches")),
    description: v.string(),
    totalDebit: v.number(),
    totalCredit: v.number(),
    postingStatus: v.union(
      v.literal("draft"),    // مسودة — قابلة للتعديل
      v.literal("posted"),   // مُرحَّلة — لا تُعدَّل (تُعكَس فقط)
      v.literal("reversed"), // معكوسة
    ),
    isAutoGenerated: v.boolean(),
    // مصدر الترحيل التلقائي (لمنع التكرار وربط القيد بالمستند)
    sourceType: v.optional(v.string()),        // "posTicket" | "purchaseOrder" | "payroll"…
    sourceId: v.optional(v.string()),
    reversedEntryId: v.optional(v.id("finJournalEntries")), // القيد الذي عكسه هذا
    reversalEntryId: v.optional(v.id("finJournalEntries")), // القيد العاكس لهذا
    postedBy: v.optional(v.id("users")),
    postedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_number", ["entryNumber"])
    .index("by_date", ["entryDate"])
    .index("by_period", ["periodId"])
    .index("by_type", ["journalType"])
    .index("by_status", ["postingStatus"])
    .index("by_source", ["sourceType", "sourceId"]),

  // أسطر القيد — كل سطر مدين أو دائن على حساب.
  finJournalLines: defineTable({
    entryId: v.id("finJournalEntries"),
    lineNumber: v.number(),
    accountId: v.id("finAccounts"),
    description: v.optional(v.string()),
    costCenterId: v.optional(v.id("finCostCenters")),
    debit: v.number(),                         // 0 إن كان دائنًا
    credit: v.number(),                        // 0 إن كان مدينًا
    // ذمة فرعية اختيارية (مورد/عميل/شركة) لأعمار الديون
    partyType: v.optional(v.string()),         // "supplier" | "customer" | "company"
    partyId: v.optional(v.string()),
    documentRef: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_entry", ["entryId"])
    .index("by_account", ["accountId"])
    .index("by_party", ["partyType", "partyId"]),

  // قواعد الترحيل التلقائي — تربط نوع الحدث بالحسابات (يعدّلها المحاسب دون كود).
  finPostingRules: defineTable({
    eventType: v.string(),                     // "pos_sale_cash" | "purchase_receipt"…
    nameAr: v.string(),
    debitAccountId: v.optional(v.id("finAccounts")),
    creditAccountId: v.optional(v.id("finAccounts")),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_event", ["eventType"]),

  // ✅ أرقام بوكس مجمّدة لكل مشترك في يوم معيّن — تمنع تغيّر الرقم خلال اليوم.
  //    يُسنَد الرقم مرة واحدة (أبجدياً 1..N)؛ أي مشترك يُضاف بعدها ياخد رقماً مُلحقاً
  //    دون تحريك الآخرين. كل يوم له ترقيمه المستقل.
  stickerBoxNumbers: defineTable({
    date: v.string(),                 // yyyy-MM-dd
    customerId: v.id("customers"),
    boxNo: v.number(),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_date_customer", ["date", "customerId"]),

  // تعديلات تغذية خاصة بطباعة استيكر محدد في يوم محدد.
  // تبقى منفصلة عن المنيو والخطط حتى لا تؤثر في الأيام أو المشتركين الآخرين.
  stickerCalorieOverrides: defineTable({
    date: v.string(),
    customerId: v.id("customers"),
    stickerKey: v.string(),
    calories: v.number(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_date_key", ["date", "stickerKey"]),

  // ✅ انهيارات الواجهة كما حدثت فعلاً — الرقم المرجعي وحده لم يكن يقود لأي سجل،
  //    فكنا نخمّن سبب الانهيار. هنا نحفظ الرسالة والمسار والجهاز لنعرف بالدليل.
  clientErrors: defineTable({
    refCode: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    path: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userName: v.optional(v.string()),
    at: v.number(),
  }).index("by_at", ["at"]),

  /**
   * العُهد النقدية: كل موظف يأخذ سلفة نقدية ويصرف منها مصاريف تشغيل
   * (بنزين، تصليح، نثريات) ثم يُسوّى الرصيد. كل حركة تُرحَّل قيداً مزدوجاً
   * على حساب «عُهد نقدية لدى الموظفين» (1115) فلا تضيع فلوس خارج الدفاتر.
   */
  pettyCashTxns: defineTable({
    holderId: v.id("users"),
    holderName: v.string(),                  // مخزّن للعرض السريع دون قراءة المستخدم
    date: v.string(),                        // yyyy-MM-dd
    type: v.union(
      v.literal("ADVANCE"),                  // صرف سلفة للموظف
      v.literal("EXPENSE"),                  // مصروف صرفه الموظف من العهدة
      v.literal("RETURN"),                   // إرجاع باقي الكاش للخزنة
    ),
    amount: v.number(),
    expenseAccountCode: v.optional(v.string()), // 6160 بنزين / 6190 صيانة …
    description: v.optional(v.string()),
    receiptNo: v.optional(v.string()),
    costCenterId: v.optional(v.id("finCostCenters")),
    journalEntryId: v.optional(v.id("finJournalEntries")),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_holder", ["holderId"])
    .index("by_date", ["date"])
    .index("by_holder_date", ["holderId", "date"]),

  /** جرد الفكة: الكاش المعدود فعلياً مقابل الرصيد الدفتري، لكشف أي عجز. */
  pettyCashCounts: defineTable({
    holderId: v.id("users"),
    holderName: v.string(),
    date: v.string(),
    denominations: v.any(),                  // { "500": 0, "200": 1, … }
    countedTotal: v.number(),
    bookBalance: v.number(),                 // الرصيد الدفتري وقت الجرد
    variance: v.number(),                    // معدود − دفتري (سالب = عجز)
    notes: v.optional(v.string()),
    countedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_holder", ["holderId"])
    .index("by_date", ["date"]),

  // عدّادات أرقام المستندات المالية (قيود/سندات).
  finCounters: defineTable({
    key: v.string(),                           // "journal" | "receipt" | "payment"
    prefix: v.optional(v.string()),            // "JV-"
    value: v.number(),
  }).index("by_key", ["key"]),
});
