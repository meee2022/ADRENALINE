// convex/customerOrders.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Helper: Generate unique order number
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `ORD-${year}${month}${day}-${random}`;
}

// ===== CREATE ORDER =====
export const create = mutation({
  args: {
    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    customerId: v.optional(v.id("customers")), // ✅ ربط بالمشترك
    totalMeals: v.number(),
    totalPrice: v.number(),
    totalCalories: v.number(),
    items: v.array(
      v.object({
        mealId: v.id("publicMeals"),
        mealNameAr: v.string(),
        mealNameEn: v.optional(v.string()),
        calories: v.number(),
        protein: v.optional(v.number()),
        carbs: v.optional(v.number()),
        fats: v.optional(v.number()),
        category: v.string(),
        imageUrl: v.optional(v.string()),
        priceQAR: v.number(),
        week: v.number(),
        day: v.string(),
      })
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orderNumber = generateOrderNumber();
    const now = Date.now();

    // Create order
    const orderId = await ctx.db.insert("customerOrders", {
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      customerEmail: args.customerEmail,
      customerId: args.customerId, // ✅ حفظ المشترك
      status: "pending",
      totalMeals: args.totalMeals,
      totalPrice: args.totalPrice,
      totalCalories: args.totalCalories,
      orderNumber,
      createdAt: now,
      notes: args.notes,
    });

    // Create order items
    for (const item of args.items) {
      await ctx.db.insert("customerOrderItems", {
        orderId,
        mealId: item.mealId,
        mealNameAr: item.mealNameAr,
        mealNameEn: item.mealNameEn,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
        category: item.category,
        imageUrl: item.imageUrl,
        priceQAR: item.priceQAR,
        week: item.week,
        day: item.day,
        createdAt: now,
      });
    }

    return {
      orderId,
      orderNumber,
    };
  },
});

// ===== GET ORDER BY ID =====
export const getById = query({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;

    const items = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();

    return {
      ...order,
      items,
    };
  },
});

// ===== GET ORDER BY NUMBER =====
export const getByOrderNumber = query({
  args: { orderNumber: v.string() },
  handler: async (ctx, { orderNumber }) => {
    const order = await ctx.db
      .query("customerOrders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", orderNumber))
      .first();

    if (!order) return null;

    const items = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();

    return {
      ...order,
      items,
    };
  },
});

// ===== LIST ALL ORDERS (Admin) =====
export const list = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit = 50 }) => {
    if (status) {
      const orders = await ctx.db
        .query("customerOrders")
        .withIndex("by_status", (q) => q.eq("status", status as any))
        .order("desc")
        .take(limit);
      return orders;
    }

    const orders = await ctx.db
      .query("customerOrders")
      .order("desc")
      .take(limit);

    return orders;
  },
});

// ===== UPDATE ORDER STATUS =====
export const updateStatus = mutation({
  args: {
    orderId: v.id("customerOrders"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, { orderId, status }) => {
    await ctx.db.patch(orderId, {
      status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ===== GET ORDERS BY PHONE =====
export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const orders = await ctx.db
      .query("customerOrders")
      .withIndex("by_phone", (q) => q.eq("customerPhone", phone))
      .order("desc")
      .collect();

    return orders;
  },
});

// ===== COUNT PENDING ORDERS =====
export const countPending = query({
  handler: async (ctx) => {
    const orders = await ctx.db
      .query("customerOrders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    
    return orders.length;
  },
});

// ===== APPROVE ORDER (Admin) =====
export const approve = mutation({
  args: {
    orderId: v.id("customerOrders"),
    customerId: v.optional(v.id("customers")), // ✅ ربط بمشترك (من الأخصائية)
    startDate: v.string(), // ✅ تاريخ بداية التوصيل (YYYY-MM-DD) - مطلوب
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, customerId, startDate, notes }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");

    // 1. تحديث حالة الطلب + ربط المشترك
    await ctx.db.patch(orderId, {
      status: "confirmed",
      customerId: customerId || order.customerId, // ✅ حفظ المشترك المربوط
      approvedAt: Date.now(),
      approvalNotes: notes,
      updatedAt: Date.now(),
    });

    // 2. جلب عناصر الطلب
    const items = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();

    // ✅ جلب بيانات المشترك (للتفضيلات/الممنوعات/الكميات)
    const linkedCustomer = customerId || order.customerId 
      ? await ctx.db.get((customerId || order.customerId)!)
      : null;

    // 3. تجميع الوجبات حسب التاريخ (date) - بناءً على startDate من الأخصائية
    const mealsByDate: Record<string, typeof items> = {};
    const startDateObj = new Date(startDate); // ✅ تاريخ البداية المحدد من الأخصائية
    
    for (const item of items) {
      // ✅ حساب التاريخ - الأسبوع = 6 أيام عمل (السبت-الأربعاء)
      // الخميس والجمعة ليسوا أيام عمل
      const weekOffset = (item.week - 1) * 6; // ✅ 6 أيام بدلاً من 7
      const dayOffset = getDayOffset(item.day);
      
      const deliveryDate = new Date(startDateObj);
      deliveryDate.setDate(deliveryDate.getDate() + weekOffset + dayOffset);
      
      const dateKey = deliveryDate.toISOString().split("T")[0]; // YYYY-MM-DD
      
      if (!mealsByDate[dateKey]) {
        mealsByDate[dateKey] = [];
      }
      mealsByDate[dateKey].push(item);
    }

    // 4. إنشاء خطة يومية لكل تاريخ (خطة واحدة تحتوي على جميع وجبات اليوم)
    for (const [date, dayMeals] of Object.entries(mealsByDate)) {
      await ctx.db.insert("dailyPlans", {
        customerId: (customerId || order.customerId) || undefined, // ✅ اختياري الآن
        customerName: order.customerName, // ✅ حفظ اسم العميل للعرض في Kitchen
        date, // YYYY-MM-DD
        deliveryTime: "MORNING", // ✅ افتراضي
        status: "CONFIRMED", // ✅ بحروف كبيرة
        notes: notes || "",
        items: dayMeals.map((meal) => ({
          mealId: meal.mealId,
          mealNameAr: meal.mealNameAr,
          mealNameEn: meal.mealNameEn,
          category: meal.category,
          calories: meal.calories,
          protein: meal.protein || 0,
          carbs: meal.carbs || 0,
          fats: meal.fats || 0,
          imageUrl: meal.imageUrl,
          week: meal.week,
          day: meal.day,
          // ✅ إضافة التفضيلات/الممنوعات/الكميات من المشترك
          avoid: linkedCustomer?.avoid || undefined,
          preferences: linkedCustomer?.preferences || undefined,
          portions: linkedCustomer?.portions || undefined,
        })),
        createdAt: Date.now(),
      });
    }

    return { success: true, message: "تم اعتماد الطلب وإضافته للمطبخ" };
  },
});

// Helper: تحويل اسم اليوم إلى رقم
// Helper: Get day offset (0 = Saturday, 4 = Wednesday)
// ⚠️ الخميس والجمعة ليسوا أيام عمل في المطعم
function getDayOffset(day: string): number {
  const dayMap: Record<string, number> = {
    saturday: 0,
    sunday: 1,
    monday: 2,
    tuesday: 3,
    wednesday: 4,
    // ⚠️ الخميس والجمعة غير مدعومين (أيام إجازة)
    // thursday: 5,
    // friday: 6,
  };
  const offset = dayMap[day.toLowerCase()];
  
  // ✅ إذا كان اليوم خميس/جمعة، نرمي خطأ
  if (offset === undefined) {
    throw new Error(`Invalid day: ${day}. Thursday and Friday are not working days.`);
  }
  
  return offset;
}

// ===== REJECT ORDER (Admin) =====
export const reject = mutation({
  args: {
    orderId: v.id("customerOrders"),
    reason: v.string(),
  },
  handler: async (ctx, { orderId, reason }) => {
    await ctx.db.patch(orderId, {
      status: "cancelled",
      rejectionReason: reason,
      rejectedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ===== UPDATE ORDER ITEM MEAL (Admin - Replace meal) =====
export const updateOrderItemMeal = mutation({
  args: {
    itemId: v.id("customerOrderItems"),
    newMealId: v.id("publicMeals"),
    newMealNameAr: v.string(),
    newMealNameEn: v.optional(v.string()),
    newCalories: v.number(),
    newProtein: v.optional(v.number()),
    newCarbs: v.optional(v.number()),
    newFats: v.optional(v.number()),
    newCategory: v.string(),
    newImageUrl: v.optional(v.string()),
    newPriceQAR: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, {
      mealId: args.newMealId,
      mealNameAr: args.newMealNameAr,
      mealNameEn: args.newMealNameEn,
      calories: args.newCalories,
      protein: args.newProtein,
      carbs: args.newCarbs,
      fats: args.newFats,
      category: args.newCategory,
      imageUrl: args.newImageUrl,
      priceQAR: args.newPriceQAR,
      updatedAt: Date.now(),
    });

    // Recalculate order totals
    const item = await ctx.db.get(args.itemId);
    if (!item) return { success: false };

    const allItems = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", item.orderId))
      .collect();

    const totalCalories = allItems.reduce((sum, i) => sum + i.calories, 0);
    const totalPrice = allItems.reduce((sum, i) => sum + i.priceQAR, 0);

    await ctx.db.patch(item.orderId, {
      totalCalories,
      totalPrice,
      totalMeals: allItems.length,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
