// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ===== Users & Authentication =====
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("ADMIN"),
      v.literal("KITCHEN"),
      v.literal("DELIVERY"),
      v.literal("NUTRITIONIST"),
      v.literal("INVENTORY_MANAGER")
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // ===== Customer Accounts (for public login) =====
  customerAccounts: defineTable({
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
    fullName: v.string(),
    phone: v.string(),
    gender: v.optional(v.union(v.literal("MALE"), v.literal("FEMALE"))),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    startDate: v.string(), // yyyy-MM-dd
    endDate: v.string(), // yyyy-MM-dd

    address: v.optional(v.string()),
    goals: v.optional(v.string()),
    allergies: v.optional(v.string()),
    notes: v.optional(v.string()),
    
    // ✅ التفضيلات والممنوعات والكميات (تُنقل للمطبخ تلقائياً)
    avoid: v.optional(v.string()), // الممنوعات: "بدون بصل، بدون مايونيز"
    preferences: v.optional(v.string()), // التفضيلات: "كثير صوص، خفيف ملح"
    portions: v.optional(v.string()), // الكميات: "نصف حصة أرز، حصة كبيرة بروتين"

    isActive: v.boolean(),

    durationWeeks: v.optional(v.number()),
    mealsPerDay: v.optional(v.number()),
    snacksPerDay: v.optional(v.number()),
    totalMealsPerDay: v.optional(v.number()),
    goalType: v.optional(v.string()),

    program: v.optional(v.string()),
    packageLabel: v.optional(v.string()),
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

  mealCategories: defineTable({
    name: v.string(),
    sortOrder: v.number(),
  }).index("by_sortOrder", ["sortOrder"]),

  menuItems: defineTable({
    name: v.string(),
    categoryId: v.id("mealCategories"),
    calories: v.optional(v.number()),
    macros: v.optional(v.string()),
    isActive: v.boolean(),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_categoryId", ["categoryId"])
    .index("by_active", ["isActive"]),

  addons: defineTable({
    name: v.string(),
    price: v.optional(v.number()),
    isActive: v.boolean(),
  }).index("by_active", ["isActive"]),

  // ✅ أهم جزء: modifiers + index by_group_sort
  modifiers: defineTable({
    name: v.string(),
    group: v.union(v.literal("AVOID"), v.literal("PREF"), v.literal("PORTION")),
    isActive: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_group_sort", ["group", "sortOrder"])
    .index("by_active", ["isActive"]),

  dailyPlans: defineTable({
    date: v.string(), // yyyy-MM-dd or ISO
    customerId: v.optional(v.id("customers")), // ✅ اختياري - قد يكون عميل جديد
    customerName: v.optional(v.string()), // ✅ اسم العميل (للطلبات الجديدة بدون ربط)
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    status: v.string(),
    notes: v.optional(v.string()),
    items: v.any(),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_customerId", ["customerId"]),

  // ===== Inventory Management Tables =====
  suppliers: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
    createdAt: v.number(),
  }),

  inventoryItems: defineTable({
    barcode: v.optional(v.string()),
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    category: v.union(
      v.literal("vegetables"),
      v.literal("proteins"),
      v.literal("dairy"),
      v.literal("dry_goods"),
      v.literal("other")
    ),
    unit: v.union(
      v.literal("kg"),
      v.literal("piece"),
      v.literal("liter"),
      v.literal("pack"),
      v.literal("box")
    ),
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

  inventoryBatches: defineTable({
    itemId: v.id("inventoryItems"),
    quantityReceived: v.number(),
    quantityRemaining: v.number(),
    unitCost: v.number(), // QAR
    supplierId: v.optional(v.id("suppliers")),
    expiryDate: v.optional(v.string()), // yyyy-MM-dd
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
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_itemId", ["itemId"])
    .index("by_type", ["type"])
    .index("by_createdAt", ["createdAt"]),

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
    isActive: v.boolean(),
    sortOrder: v.number(),
    // NEW: Scheduling fields
    weeks: v.optional(v.array(v.number())), // [1, 2, 3, 4]
    days: v.optional(v.array(v.string())), // ["saturday", "sunday", "monday", ...]
    cutoffTime: v.optional(v.string()), // "18:00" - time when selection locks
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  // ===== Customer Orders (from public website) =====
  customerOrders: defineTable({
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
  })
    .index("by_status", ["status"])
    .index("by_phone", ["customerPhone"])
    .index("by_orderNumber", ["orderNumber"])
    .index("by_createdAt", ["createdAt"]),

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
    
    createdAt: v.number(),
    updatedAt: v.optional(v.number()), // لتعديل الوجبة من الأدمن
  })
    .index("by_orderId", ["orderId"])
    .index("by_mealId", ["mealId"])
    .index("by_week_day", ["week", "day"]),

  // ===== Restaurant Settings =====
  restaurantSettings: defineTable({
    // Contact Information
    phone: v.string(),
    email: v.string(),
    addressAr: v.string(),
    addressEn: v.string(),
    
    // Social Media Links
    instagramUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    facebookUrl: v.optional(v.string()),
    tiktokUrl: v.optional(v.string()),
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
});
