// convex/customerOrders.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff, requireAdmin, requireRole, newToken } from "./sessions";

// 🔒 قصر دورة الطلبات (approve/reject/updateStatus) على الأدوار المسؤولة
const ORDER_REVIEW_ROLES = ["NUTRITIONIST"];
import { addDeliveryDays, isDeliveryDay, parseDate, fmtDate, addDays, dayNameOf, rotationWeekAtDate } from "./lib/dates";
import { loyaltyConfig } from "./loyalty";
import { qatarTodayISO, validateCustomerOrderSelection } from "./lib/customerOrderRules";

// Helper: Generate unique order number
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
  return `ORD-${year}${month}${day}-${random}`;
}

/**
 * 🔔 يعلّم إشعارات "طلب جديد" (NEW_ORDER) الخاصة بطلب معيّن كمقروءة — يُستدعى
 *    عند اعتماد أو رفض الطلب، فيقلّ عدّاد الجرس بدل أن يتراكم بلا نهاية.
 */
async function markOrderNotificationsRead(ctx: any, orderId: string): Promise<void> {
  const oid = String(orderId);
  const notifs = await ctx.db
    .query("notifications")
    .filter((q: any) => q.eq(q.field("relatedId"), oid))
    .collect();
  const now = Date.now();
  for (const n of notifs) {
    if (n.type === "NEW_ORDER" && !n.isRead) {
      await ctx.db.patch(n._id, { isRead: true, readAt: now });
    }
  }
}

// ===== CREATE ORDER =====
export const create = mutation({
  args: {
    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    // 🔒 نستقبل فقط معرّفات + كميات + جدولة. كل الأسعار والسعرات وأسماء الوجبات
    //    والصور تُقرأ من قاعدة البيانات على الخادم — نستحيل التلاعب من العميل.
    items: v.array(
      v.object({
        mealId: v.id("publicMeals"),
        week: v.number(),
        day: v.string(),
      })
    ),
    notes: v.optional(v.string()),
    preferredStartDate: v.optional(v.string()),
    // 🔒 مفتاح idempotency: يمنع تكرار الطلب لو الفورم اتضغط مرتين أو النت قطع
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 🔒 التحقق: على الأقل وجبة واحدة، حد أقصى معقول (يمنع abuse)
    if (args.items.length === 0) throw new Error("يجب اختيار وجبة واحدة على الأقل");
    if (args.items.length > 500) throw new Error("عدد الوجبات كبير جداً");
    if (!args.customerName.trim() || !args.customerPhone.trim()) {
      throw new Error("الاسم ورقم الهاتف مطلوبان");
    }

    // 🔒 Idempotency: لو المفتاح متكرر، رجّع نفس الطلب الأصلي
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("customerOrders")
        .withIndex("by_idem", (q) => q.eq("idempotencyKey", args.idempotencyKey))
        .first();
      if (existing) {
        return { orderId: existing._id, orderNumber: existing.orderNumber, duplicate: true };
      }
    }

    // 🔒 Rate limit: أقصى 3 طلبات لكل رقم هاتف في آخر ساعة
    const phone = args.customerPhone.trim();
    const cutoff = now - 60 * 60 * 1000;
    const recentByPhone = await ctx.db
      .query("customerOrders")
      .withIndex("by_phone", (q) => q.eq("customerPhone", phone))
      .collect();
    const recent = recentByPhone.filter((o: any) => o.createdAt >= cutoff);
    if (recent.length >= 3) {
      throw new Error("عدد طلبات كبير من نفس الرقم — انتظر قليلاً");
    }

    // 🔒 نجيب كل الوجبات من الخادم ونتحقق أنها موجودة ونشطة
    const mealCache = new Map<string, any>();
    for (const it of args.items) {
      const key = String(it.mealId);
      if (mealCache.has(key)) continue;
      const meal: any = await ctx.db.get(it.mealId);
      if (!meal || !meal.isActive) {
        throw new Error("الوجبة غير متاحة، وربما أُزيلت من قائمة الوجبات");
      }
      mealCache.set(key, meal);
    }

    // Server-side mirror of the manual/smart-plan guards. This only rejects an
    // invalid new request; approval dates and existing kitchen plans are untouched.
    const normalizedPhone = (value: unknown) => String(value || "").replace(/\D/g, "");
    let subscriptionCustomer: any = null;
    if (args.customerId) {
      subscriptionCustomer = await ctx.db.get(args.customerId);
      if (!subscriptionCustomer || normalizedPhone(subscriptionCustomer.phone) !== normalizedPhone(phone)) {
        throw new Error("ORDER_VALIDATION:CUSTOMER_IDENTITY_MISMATCH");
      }
    } else {
      subscriptionCustomer = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", phone))
        .first();
    }

    const todayISO = qatarTodayISO(now);
    let startRotationWeek = 1;
    if (subscriptionCustomer?.startDate) {
      const settings: any = await ctx.db.query("restaurantSettings").first();
      const currentWeek = Number(settings?.currentCookingWeek) || 1;
      const advancedOn = String(settings?.cookingWeekAdvancedOn || "");
      const anchorISO = /^\d{4}-\d{2}-\d{2}$/.test(advancedOn) ? advancedOn : todayISO;
      startRotationWeek = rotationWeekAtDate(currentWeek, anchorISO, String(subscriptionCustomer.startDate));
    }

    validateCustomerOrderSelection({
      items: args.items.map((item) => ({
        ...item,
        meal: mealCache.get(String(item.mealId)),
      })),
      customer: subscriptionCustomer,
      startRotationWeek,
      todayISO,
    });

    // 🔒 نحسب الإجماليات من بيانات الخادم فقط
    let totalCalories = 0;
    let totalPrice = 0;
    const serverItems = args.items.map((it) => {
      const meal = mealCache.get(String(it.mealId));
      const price = Number(meal.priceQAR) || 0;
      const cal = Number(meal.calories) || 0;
      totalCalories += cal;
      totalPrice += price;
      return {
        mealId: it.mealId,
        mealNameAr: meal.nameAr,
        mealNameEn: meal.nameEn,
        calories: cal,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats,
        category: meal.category,
        imageUrl: meal.imageUrl,
        priceQAR: price,
        week: it.week,
        day: it.day,
      };
    });
    totalPrice = Math.round(totalPrice * 100) / 100;

    const orderNumber = generateOrderNumber();
    // 🔒 توكن تتبع طويل وعشوائي — بديل رقم الطلب المتوقّع في رابط التتبع العام
    const trackingToken = newToken();

    // Create order (Server-computed totals)
    const orderId = await ctx.db.insert("customerOrders", {
      customerName: args.customerName.trim(),
      customerPhone: phone,
      customerEmail: args.customerEmail?.trim(),
      customerId: args.customerId,
      status: "pending",
      totalMeals: serverItems.length,
      totalPrice,
      totalCalories,
      orderNumber,
      trackingToken,
      createdAt: now,
      notes: args.notes?.trim(),
      preferredStartDate: args.preferredStartDate,
      idempotencyKey: args.idempotencyKey,
    } as any);

    // Create order items with server-computed values
    for (const item of serverItems) {
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
      message: `${args.customerName} - ${serverItems.length} وجبة (${orderNumber})`,
      link: `/orders/review/${orderId}`,
      relatedId: orderId,
      isRead: false,
      createdAt: now,
    });
    await ctx.db.insert("notifications", {
      targetRole: "ADMIN",
      type: "NEW_ORDER",
      title: "طلب جديد على الموقع",
      message: `${args.customerName} - ${args.customerPhone}`,
      link: `/orders/review/${orderId}`,
      relatedId: orderId,
      isRead: false,
      createdAt: now,
    });

    return {
      orderId,
      orderNumber,
      trackingToken,
    };
  },
});

/** ✅ استعلام بتوكن التتبع — بديل getByOrderNumber المتوقّع. عام (بلا جلسة). */
export const getByTrackingToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token || token.length < 20) return null;
    const order = await ctx.db
      .query("customerOrders")
      .withIndex("by_tracking_token", (q) => q.eq("trackingToken", token))
      .first();
    if (!order) return null;
    const items = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();
    return { ...publicOrderView(order), items };
  },
});

// ===== GET ORDER BY ID =====
/** ✅ يولّد (أو يرجّع) توكن مشاركة جدول الوجبات للطلب. للموظفين. */
export const getPlanShareToken = mutation({
  args: { orderId: v.id("customerOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { orderId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    let token = (order as any).planToken as string | undefined;
    if (!token) {
      token = newToken();
      await ctx.db.patch(orderId, { planToken: token });
    }
    return { token };
  },
});

/**
 * ✅ استعلام عام (بلا جلسة): جدول وجبات العميل عبر رابط سرّي (planToken).
 *    يعيد الوجبات مجمّعة بالأسبوع واليوم لعرضها كصفحة مشاركة جميلة.
 */
export const publicMealPlan = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const order = await ctx.db
      .query("customerOrders")
      .withIndex("by_plan_token", (q) => q.eq("planToken", token))
      .first();
    if (!order) return null;

    const items = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();

    // تجميع: أسبوع → يوم → وجبات
    const byWeek: Record<number, Record<string, any[]>> = {};
    for (const it of items) {
      const w = Number((it as any).week) || 1;
      const d = String((it as any).day || "").toLowerCase();
      (byWeek[w] ||= {});
      (byWeek[w][d] ||= []);
      byWeek[w][d].push({
        mealNameAr: (it as any).mealNameAr,
        mealNameEn: (it as any).mealNameEn,
        category: (it as any).category,
        calories: (it as any).calories ?? null,
        protein: (it as any).protein ?? null,
        imageUrl: (it as any).imageUrl ?? null,
        notes: (it as any).specialNotes || "",
      });
    }
    const dayOrder: Record<string, number> = { saturday: 0, sunday: 1, monday: 2, tuesday: 3, wednesday: 4, thursday: 5 };
    const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b).map((w) => ({
      week: w,
      days: Object.keys(byWeek[w])
        .sort((a, b) => (dayOrder[a] ?? 99) - (dayOrder[b] ?? 99))
        .map((d) => ({ day: d, meals: byWeek[w][d] })),
    }));

    return {
      customerName: order.customerName,
      totalMeals: items.length,
      weeksCount: weeks.length,
      weeks,
    };
  },
});

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
/**
 * 🔒 استعلام بالرقم — يتطلّب الآن رقم هاتف مطابق كتحقق (منع enumeration).
 *    الترجيح: الجدد يستخدموا trackingToken. الرقم متروك للتوافق الرجعي.
 */
export const getByOrderNumber = query({
  args: { orderNumber: v.string(), phone: v.optional(v.string()) },
  handler: async (ctx, { orderNumber, phone }) => {
    const order = await ctx.db
      .query("customerOrders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", orderNumber))
      .first();

    if (!order) return null;
    // 🔒 لو مافيش رقم هاتف مطابق، ما نُرجعش شيئاً — يمنع تخمين الأرقام
    const normPhone = (p?: string) => String(p || "").replace(/\D/g, "");
    if (!phone || normPhone(phone) !== normPhone((order as any).customerPhone)) {
      return null;
    }

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
    await requireRole(ctx, sessionToken, ORDER_REVIEW_ROLES);
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
    await requireRole(ctx, sessionToken, ORDER_REVIEW_ROLES);
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

    // 🔔 الطلب اتعامل معاه → علّم إشعاراته "طلب جديد" كمقروءة (لا يتراكم العدّاد)
    await markOrderNotificationsRead(ctx, orderId);

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

    // 🚫 لا توصيل يوم الجمعة — والبداية نفسها قد تقع فيها. ننقلها لأول يوم توصيل.
    const startIso = String(startDate).slice(0, 10);
    const firstDelivery = isDeliveryDay(parseDate(startIso))
      ? startIso
      : addDeliveryDays(startIso, 1);

    // مرجع الدورة: أسبوع الطبخ الحالي عند اليوم — منه نشتقّ دورة أي تاريخ.
    const settings = await ctx.db.query("restaurantSettings").first();
    const curCookWeek = Number((settings as any)?.currentCookingWeek) || 1;
    const anchorISO = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); // قطر

    /**
     * التاريخ الحقيقي لصنف يحمل (week=دورة, day=اليوم): نمشي على التقويم من أول
     * يوم توصيل ونلتقط أول يوم يومُه = day ودورتُه = week. هذا يَعكس بالضبط ما
     * فعله مولّد خطة العميل (ai.buildWeek): يمشي على التقويم، يتخطّى الجمعة،
     * ويعطي كل يوم اسمَه الحقيقي ودورتَه الحقيقية. فالاسم يطابق التاريخ دائماً،
     * والجمعة تُتخطّى بحكم التعريف (ليست يوم توصيل فلا يقع عليها تطابق).
     *
     * ⚠️ لا نجمع ترتيباً × 6 على التقويم: الأسبوع 7 أيام لا 6، فالجمع يزحلق يوماً
     *    كل أسبوع ويضع «السبت» على يوم اثنين. المطابقة بالتاريخ الحقيقي تُنهي ذلك.
     */
    const dateForSlot = (week: number, day: string): string | null => {
      const target = String(day).toLowerCase();
      let cur = parseDate(firstDelivery);
      for (let i = 0; i < 366; i++) {
        const iso = fmtDate(cur);
        if (isDeliveryDay(cur) && dayNameOf(iso) === target
          && rotationWeekAtDate(curCookWeek, anchorISO, iso) === Number(week)) {
          return iso;
        }
        cur = addDays(cur, 1);
      }
      return null;
    };

    for (const item of items) {
      const overrideKey = `${item.week}-${item.day}`;
      const overrideDate = dateOverrides?.[overrideKey];

      let dateKey: string | null;
      if (overrideDate && /^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
        dateKey = overrideDate;
      } else {
        dateKey = dateForSlot(Number(item.week), item.day);
      }
      if (!dateKey) continue; // لا تاريخ مطابق (يوم غير صالح) — نتخطّى بدل وضعه غلط

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
      const lcfg = await loyaltyConfig(ctx);
      const earned = lcfg.pointsPerOrder;
      const hist = Array.isArray(cust?.loyaltyHistory) ? cust.loyaltyHistory : [];
      await ctx.db.patch(effectiveCustomerId, {
        loyaltyPoints: Number(cust?.loyaltyPoints || 0) + earned,
        loyaltyHistory: [
          ...hist,
          { type: "EARN", points: earned, note: `طلب معتمد ${order.orderNumber || ""}`.trim(), at: Date.now() },
        ].slice(-50),
        updatedAt: Date.now(),
      });
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
    await requireRole(ctx, sessionToken, ORDER_REVIEW_ROLES);
    const order = await ctx.db.get(orderId);
    await ctx.db.patch(orderId, {
      status: "cancelled",
      rejectionReason: reason,
      rejectedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 🔔 الطلب اتعامل معاه (رفض) → علّم إشعارات "طلب جديد" كمقروءة
    await markOrderNotificationsRead(ctx, orderId);

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
