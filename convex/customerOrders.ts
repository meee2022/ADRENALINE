// convex/customerOrders.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff, requireAdmin } from "./sessions";
import { getDayOffset } from "./lib/dates";

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
    // ✅ تاريخ بداية التوصيل الذي اختاره العميل (yyyy-MM-dd). تراه الأخصائية
    //    مقترحاً عند الاعتماد وتقدر تعدّله.
    preferredStartDate: v.optional(v.string()),
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
      preferredStartDate: args.preferredStartDate,
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
  args: { orderId: v.id("customerOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { orderId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
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

/**
 * الحقول التي يعرضها تتبّع الطلب العام. تعمداً بلا customerName/Phone/Email:
 * الاستعلامان أدناه مفتوحان للجمهور (تتبّع برقم الطلب أو الهاتف)، فلا يجوز أن
 * يكشف تخمين رقم طلب هويةَ صاحبه. الصفحتان العامتان لا تعرضان هذه الحقول أصلاً.
 */
function publicOrderView(o: any) {
  return {
    _id: o._id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalMeals: o.totalMeals,
    totalPrice: o.totalPrice,
    totalCalories: o.totalCalories,
    rejectionReason: o.rejectionReason,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// ===== GET ORDER BY NUMBER (عام — تتبّع الطلب) =====
export const getByOrderNumber = query({
  args: { orderNumber: v.string() },
  handler: async (ctx, { orderNumber }) => {
    const order = await ctx.db
      .query("customerOrders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", orderNumber))
      .first();

    if (!order) return null;

    // الوجبات ليست بيانات شخصية — نُبقيها كما كانت
    const items = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();

    return { ...publicOrderView(order), items };
  },
});

// ===== LIST ALL ORDERS (Admin) =====
export const list = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { status, limit = 50, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, status, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    await ctx.db.patch(orderId, {
      status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ===== GET ORDERS BY PHONE (عام — تتبّع الطلبات) =====
export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const orders = await ctx.db
      .query("customerOrders")
      .withIndex("by_phone", (q) => q.eq("customerPhone", phone))
      .order("desc")
      .collect();

    return orders.map(publicOrderView);
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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, customerId, startDate, notes, dateOverrides, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
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

    // 3. تجميع الوجبات حسب التاريخ (date) - بناءً على startDate من الأخصائية.
    //
    // ⚠️ item.week هو أسبوع الدورة (1..4) الذي اختاره العميل، وليس ترتيباً من
    //    البداية. لو اختار العميل دورة 3 فقط، يجب أن يبدأ توصيله من startDate
    //    مباشرةً — لا بعد 12 يوماً. لذلك نرتّب أسابيع الدورة المختارة تصاعدياً
    //    ونحوّلها إلى ترتيب متتالٍ 0،1،2… فالأسبوع الأول المختار = أول أسبوع توصيل.
    const mealsByDate: Record<string, typeof items> = {};
    const startDateObj = new Date(startDate);

    const chosenWeeks = Array.from(new Set(items.map((it) => Number(it.week)))).sort((a, b) => a - b);
    const weekRank = new Map(chosenWeeks.map((w, i) => [w, i])); // دورة → ترتيب متتالٍ

    for (const item of items) {
      const overrideKey = `${item.week}-${item.day}`;
      const overrideDate = dateOverrides?.[overrideKey];

      let dateKey: string;
      if (overrideDate && /^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
        dateKey = overrideDate;
      } else {
        // ترتيب الأسبوع بين الأسابيع المختارة (لا رقم الدورة نفسه) × 6 أيام توصيل
        const weekOffset = (weekRank.get(Number(item.week)) ?? 0) * 6;
        const dayOffset = getDayOffset(item.day);
        const deliveryDate = new Date(startDateObj);
        deliveryDate.setDate(deliveryDate.getDate() + weekOffset + dayOffset);
        dateKey = deliveryDate.toISOString().split("T")[0];
      }

      if (!mealsByDate[dateKey]) mealsByDate[dateKey] = [];
      mealsByDate[dateKey].push(item);
    }

    // 4. إنشاء/تحديث خطة يومية لكل تاريخ
    // ✅ نمنع التكرار: لو فيه plan موجودة لنفس (customer + date + deliveryTime) من نفس الطلب،
    // نستبدلها بدلاً من إنشاء واحدة جديدة
    const effectiveCustomerId = customerId || order.customerId;
    // ✅ وقت التوصيل من اشتراك العميل نفسه (صباحي/مسائي) بدل MORNING الثابت —
    //    وإلا كل طلب معتمد يذهب للجولة الصباحية فقط، فالخدمة المسائية تُكسر.
    const deliveryTime: "MORNING" | "EVENING" =
      (linkedCustomer as any)?.deliveryTime === "EVENING" ? "EVENING" : "MORNING";

    for (const [date, dayMeals] of Object.entries(mealsByDate)) {
      // ⛔ لا تُنشأ خطط داخل فترة تجميد المشترك — هذا المسار يكتب في dailyPlans
      //    مباشرةً، فلا يمرّ على الحارس الموجود في dailyPlans.create.
      const pausedFrom = (linkedCustomer as any)?.pausedFrom as string | undefined;
      if (pausedFrom && String(date).slice(0, 10) >= pausedFrom) continue;

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
        // ✅ ملاحظة الأخصائية على الوجبة — يقرؤها المطبخ والاستيكر
        specialNotes: (meal as any).specialNotes || undefined,
        // إضافة التفضيلات/الممنوعات/الكميات/الحساسية من المشترك (snapshot —
        // يبقى ظاهراً للمطبخ حتى لو لم يكن العميل مربوطاً بحساب)
        avoid: linkedCustomer?.avoid || undefined,
        preferences: linkedCustomer?.preferences || undefined,
        portions: linkedCustomer?.portions || undefined,
        allergies: (linkedCustomer as any)?.allergies || undefined,
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

// ===== REJECT ORDER (Admin) =====
export const reject = mutation({
  args: {
    orderId: v.id("customerOrders"),
    reason: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, reason, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
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
/** ✅ ملاحظة الأخصائية على وجبة داخل الطلب — تظهر للمطبخ وعلى الاستيكر بعد الاعتماد. */
export const updateOrderItemNote = mutation({
  args: {
    itemId: v.id("customerOrderItems"),
    note: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    await ctx.db.patch(args.itemId, {
      specialNotes: args.note.trim() || undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

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
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
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

/**
 * ✅ حذف صنف (وجبة) من الطلب قبل الاعتماد، وإعادة حساب إجماليات الطلب.
 *    تستخدمه الأخصائية في مراجعة الطلب للتجربة أو لإزالة وجبة زائدة.
 */
export const removeOrderItem = mutation({
  args: { itemId: v.id("customerOrderItems"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const item = await ctx.db.get(args.itemId);
    if (!item) return { success: false, error: "الصنف غير موجود" };

    const orderId = item.orderId;
    await ctx.db.delete(args.itemId);

    const rest = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();

    await ctx.db.patch(orderId, {
      totalCalories: rest.reduce((s, i) => s + (i.calories || 0), 0),
      totalPrice: rest.reduce((s, i) => s + (i.priceQAR || 0), 0),
      totalMeals: rest.length,
      updatedAt: Date.now(),
    });

    return { success: true, remaining: rest.length };
  },
});

/**
 * ✅ حذف الطلب/الخطة نهائياً (hard delete) — للأدمن فقط.
 *    يختلف عن reject: الرفض يُبقي الطلب بحالة cancelled للسجل؛ هذا يمحوه تماماً
 *    مع أصنافه وأي خطط مطبخ تولّدت منه (sourceOrderId). مخصّص لتنظيف تجارب الأدمن.
 */
export const deleteOrder = mutation({
  args: { orderId: v.id("customerOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { orderId, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    const order = await ctx.db.get(orderId);
    if (!order) return { success: false, error: "الطلب غير موجود" };

    // 1) احذف أصناف الطلب.
    const items = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .collect();
    for (const it of items) await ctx.db.delete(it._id);

    // 2) احذف خطط المطبخ التي وُلّدت من هذا الطلب (لو كان معتمداً من قبل).
    const plans = await ctx.db
      .query("dailyPlans")
      .withIndex("by_source_order", (q) => q.eq("sourceOrderId", orderId))
      .collect();
    for (const p of plans) await ctx.db.delete(p._id);

    // 3) احذف الطلب نفسه.
    await ctx.db.delete(orderId);

    return { success: true, removedItems: items.length, removedPlans: plans.length };
  },
});
