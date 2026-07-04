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

    // 🔔 إشعار: طلب جديد للأخصائية + الإدارة
    await ctx.db.insert("notifications", {
      targetRole: "NUTRITIONIST",
      type: "NEW_ORDER",
      title: "طلب جديد للمراجعة",
      message: `${args.customerName} - ${args.totalMeals} وجبة (${orderNumber})`,
      link: `/orders/${orderId}`,
      relatedId: orderId,
      isRead: false,
      createdAt: now,
    });
    await ctx.db.insert("notifications", {
      targetRole: "ADMIN",
      type: "NEW_ORDER",
      title: "طلب جديد على الموقع",
      message: `${args.customerName} - ${args.customerPhone}`,
      link: `/orders/${orderId}`,
      relatedId: orderId,
      isRead: false,
      createdAt: now,
    });

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
    // ✅ تعديلات اختيارية لتاريخ يوم محدد. المفتاح هو "week-day" (مثال: "1-saturday")
    // والقيمة تاريخ بصيغة YYYY-MM-DD يستبدل التاريخ المحسوب تلقائياً
    dateOverrides: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, { orderId, customerId, startDate, notes, dateOverrides }) => {
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");

    // ✅ idempotency: لا نعتمد الطلب أكثر من مرة (يمنع تكرار الخطط/النقاط/الإشعارات)
    if (order.status !== "pending") {
      return { success: true, alreadyApproved: true };
    }

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
      // ✅ إذا حدّدت الأخصائية تاريخ يدوي لـ (week, day) ده، استخدمه
      const overrideKey = `${item.week}-${item.day}`;
      const overrideDate = dateOverrides?.[overrideKey];

      let dateKey: string;
      if (overrideDate && /^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
        // استخدم التاريخ اليدوي مباشرة
        dateKey = overrideDate;
      } else {
        // احسب التاريخ تلقائياً (6 أيام عمل، السبت-الأربعاء)
        const weekOffset = (item.week - 1) * 6;
        const dayOffset = getDayOffset(item.day);
        const deliveryDate = new Date(startDateObj);
        deliveryDate.setDate(deliveryDate.getDate() + weekOffset + dayOffset);
        dateKey = deliveryDate.toISOString().split("T")[0];
      }

      if (!mealsByDate[dateKey]) {
        mealsByDate[dateKey] = [];
      }
      mealsByDate[dateKey].push(item);
    }

    // 4. إنشاء/تحديث خطة يومية لكل تاريخ
    // ✅ نمنع التكرار: لو فيه plan موجودة لنفس (customer + date + deliveryTime) من نفس الطلب،
    // نستبدلها بدلاً من إنشاء واحدة جديدة
    const effectiveCustomerId = customerId || order.customerId;
    const deliveryTime = "MORNING" as const;

    for (const [date, dayMeals] of Object.entries(mealsByDate)) {
      const planItems = dayMeals.map((meal) => ({
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
        // إضافة التفضيلات/الممنوعات/الكميات من المشترك
        avoid: linkedCustomer?.avoid || undefined,
        preferences: linkedCustomer?.preferences || undefined,
        portions: linkedCustomer?.portions || undefined,
      }));

      // فحص: في dailyPlan موجودة لنفس العميل في نفس التاريخ من نفس الطلب؟
      const existingPlans = await ctx.db
        .query("dailyPlans")
        .withIndex("by_date", (q) => q.eq("date", date))
        .collect();

      const duplicatePlan = existingPlans.find((p: any) => {
        // فحص العميل (customerId لو موجود، أو الاسم لو مش موجود)
        const sameCustomer = effectiveCustomerId
          ? p.customerId === effectiveCustomerId
          : p.customerName === order.customerName;
        const sameTime = p.deliveryTime === deliveryTime;
        const sameOrigin = p.sourceOrderId === orderId; // علامة لتمييز الـ plans اللي جاية من نفس الطلب
        return sameCustomer && sameTime && sameOrigin;
      });

      if (duplicatePlan) {
        // ✅ تحديث الـ plan الموجودة بدل إنشاء جديدة
        await ctx.db.patch(duplicatePlan._id, {
          items: planItems,
          notes: notes || "",
          status: "CONFIRMED",
          updatedAt: Date.now(),
        });
      } else {
        // إنشاء plan جديدة
        await ctx.db.insert("dailyPlans", {
          customerId: effectiveCustomerId || undefined,
          customerName: order.customerName,
          date,
          deliveryTime,
          status: "CONFIRMED",
          notes: notes || "",
          items: planItems,
          sourceOrderId: orderId, // ✅ تتبع المصدر للحماية من التكرار
          createdAt: Date.now(),
        });
      }
    }

    // 🔔 إشعار للمطبخ + الإدارة
    const planDates = Object.keys(mealsByDate).sort();
    const totalMealsCount = items.length;
    await ctx.db.insert("notifications", {
      targetRole: "KITCHEN",
      type: "ORDER_APPROVED",
      title: "خطة جديدة للتحضير",
      message: `${order.customerName} - ${totalMealsCount} وجبة على ${planDates.length} يوم`,
      link: `/kitchen`,
      relatedId: orderId,
      isRead: false,
      createdAt: Date.now(),
    });
    await ctx.db.insert("notifications", {
      targetRole: "ADMIN",
      type: "ORDER_APPROVED",
      title: "تم اعتماد طلب",
      message: `${order.customerName} - ${order.orderNumber}`,
      link: `/plans`,
      relatedId: orderId,
      isRead: false,
      createdAt: Date.now(),
    });

    // 🔔 إشعار للعميل + نقاط ولاء (تظهر في بوابة العميل)
    // ملاحظة: effectiveCustomerId مُعرّف بالفعل أعلاه (عند إنشاء الخطط)
    if (effectiveCustomerId) {
      await ctx.db.insert("notifications", {
        targetCustomerId: effectiveCustomerId,
        type: "ORDER_APPROVED",
        title: "تم اعتماد خطتك ✅",
        message: `اعتمد أخصائي التغذية طلبك ${order.orderNumber || ""} — وجباتك في الطريق إليك`,
        link: "/customer/profile",
        relatedId: orderId,
        isRead: false,
        createdAt: Date.now(),
      });
      const cust: any = await ctx.db.get(effectiveCustomerId);
      await ctx.db.patch(effectiveCustomerId, { loyaltyPoints: Number(cust?.loyaltyPoints || 0) + 10, updatedAt: Date.now() });
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

  // ✅ الخميس/الجمعة إجازة — بدل رمي خطأ يوقف اعتماد الطلب كله،
  //    نُرجّع أقرب يوم عمل (الأربعاء) حتى لا يتعطّل الاعتماد.
  if (offset === undefined) {
    return 4; // wednesday
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
    const order = await ctx.db.get(orderId);
    await ctx.db.patch(orderId, {
      status: "cancelled",
      rejectionReason: reason,
      rejectedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 🔔 إشعار للعميل بسبب الرفض (لو الطلب مربوط بمشترك)
    if (order?.customerId) {
      await ctx.db.insert("notifications", {
        targetCustomerId: order.customerId,
        type: "SYSTEM",
        title: "تحديث على طلبك",
        message: `لم يُعتمد طلبك ${order.orderNumber || ""}. السبب: ${reason}`,
        link: "/customer/profile",
        relatedId: orderId,
        isRead: false,
        createdAt: Date.now(),
      });
    }

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
