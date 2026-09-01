// convex/customerOrders.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff, requireAdmin, requireRole, newToken } from "./sessions";

// 🔒 قصر دورة الطلبات (approve/reject/updateStatus) على الأدوار المسؤولة
const ORDER_REVIEW_ROLES = ["NUTRITIONIST", "ADMIN"];
import { addDeliveryDays, isDeliveryDay, parseDate, fmtDate, addDays, dayNameOf, rotationWeekAtDate } from "./lib/dates";
import { isWithinSubscription } from "./lib/subscriptionPeriods";
import { trail } from "./lib/trail";
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

/** Qatar phone numbers arrive from public forms in several equivalent shapes
 * (`55981998`, `+97455981998`, `974 5598 1998`).  Database indexes compare
 * strings literally, so identity checks must use one canonical value. */
function canonicalPhone(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("974") ? digits.slice(3) : digits;
}

async function findRestaurantCustomerByPhone(ctx: any, phone: unknown, restaurantKey: string) {
  const wanted = canonicalPhone(phone);
  if (!wanted) return null;
  // The table is small, and a normalized comparison is required because old
  // rows predate canonical phone storage and therefore cannot use by_phone.
  const matches = (await ctx.db.query("customers").collect()).filter((customer: any) =>
    canonicalPhone(customer.phone) === wanted
    && String(customer.restaurantKey || "ADRENALINE") === restaurantKey,
  );
  if (matches.length > 1) {
    throw new Error("ORDER_VALIDATION:DUPLICATE_CUSTOMER_PHONE");
  }
  return matches[0] || null;
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
    restaurantKey: v.optional(v.union(v.literal("ADRENALINE"), v.literal("NUTRI_RESET"))),
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
    const restaurantKey = args.restaurantKey === "NUTRI_RESET" ? "NUTRI_RESET" : "ADRENALINE";

    // 🔒 التحقق: على الأقل وجبة واحدة، حد أقصى معقول (يمنع abuse)
    if (args.items.length === 0) throw new Error("يجب اختيار وجبة واحدة على الأقل");
    if (args.items.length > 500) throw new Error("عدد الوجبات كبير جداً");
    if (!args.customerPhone.trim()) throw new Error("رقم الهاتف مطلوب");

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
    let subscriptionCustomer: any = null;
    if (args.customerId) {
      subscriptionCustomer = await ctx.db.get(args.customerId);
      if (!subscriptionCustomer || canonicalPhone(subscriptionCustomer.phone) !== canonicalPhone(phone)) {
        throw new Error("ORDER_VALIDATION:CUSTOMER_IDENTITY_MISMATCH");
      }
      const customerRestaurant = String((subscriptionCustomer as any).restaurantKey || "ADRENALINE");
      if (customerRestaurant !== restaurantKey) {
        throw new Error("ORDER_VALIDATION:RESTAURANT_MISMATCH");
      }
    } else {
      subscriptionCustomer = await findRestaurantCustomerByPhone(ctx, phone, restaurantKey);
    }
    // الاسم اختياري في شاشة العميل: الحساب المعروف يُؤخذ اسمه من قاعدة البيانات،
    // والزائر الذي يتركه فارغاً يظهر للطاقم برقمه بدل تعطيل إرسال الخطة.
    const effectiveCustomerName = args.customerName.trim()
      || String(subscriptionCustomer?.fullName || "").trim()
      || phone;

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
      restaurantKey,
      customerName: effectiveCustomerName,
      customerPhone: phone,
      customerEmail: args.customerEmail?.trim(),
      // Persist the server-resolved customer too. Previously this wrote only
      // args.customerId, losing a valid phone match and creating orphan plans.
      customerId: args.customerId || subscriptionCustomer?._id,
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
      message: `${effectiveCustomerName} - ${serverItems.length} وجبة (${orderNumber})`,
      link: `/orders/review/${orderId}`,
      relatedId: orderId,
      isRead: false,
      createdAt: now,
    });
    await ctx.db.insert("notifications", {
      targetRole: "ADMIN",
      type: "NEW_ORDER",
      title: "طلب جديد على الموقع",
      message: `${effectiveCustomerName} - ${args.customerPhone}`,
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
    restaurantKey: v.optional(v.union(v.literal("ADRENALINE"), v.literal("NUTRI_RESET"))),
    limit: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { status, restaurantKey, limit = 50, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const matchesRestaurant = (order: any) => !restaurantKey
      || String(order.restaurantKey || "ADRENALINE") === restaurantKey;
    if (status) {
      const orders = await ctx.db
        .query("customerOrders")
        .withIndex("by_status", (q) => q.eq("status", status as any))
        .order("desc")
        .take(limit);
      return orders.filter(matchesRestaurant);
    }

    const orders = await ctx.db
      .query("customerOrders")
      .order("desc")
      .take(limit);

    return orders.filter(matchesRestaurant);
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
    const approver = await requireRole(ctx, sessionToken, ORDER_REVIEW_ROLES);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");

    const restaurantKey = String((order as any).restaurantKey || "ADRENALINE");
    let effectiveCustomerId: any = customerId || order.customerId;
    let linkedCustomer: any = effectiveCustomerId ? await ctx.db.get(effectiveCustomerId) : null;
    if (!linkedCustomer) {
      linkedCustomer = await findRestaurantCustomerByPhone(ctx, order.customerPhone, restaurantKey);
      effectiveCustomerId = linkedCustomer?._id;
    }
    if (!linkedCustomer || !effectiveCustomerId) {
      throw new Error("ORDER_VALIDATION:CUSTOMER_LINK_REQUIRED");
    }
    if (canonicalPhone(linkedCustomer.phone) !== canonicalPhone(order.customerPhone)) {
      throw new Error("ORDER_VALIDATION:CUSTOMER_IDENTITY_MISMATCH");
    }

    // ✅ idempotency: لا نعتمد الطلب أكثر من مرة (يمنع تكرار الخطط/النقاط/الإشعارات)
    if (order.status !== "pending") {
      return { success: true, alreadyApproved: true };
    }

    // 1. تحديث حالة الطلب + ربط المشترك
    await ctx.db.patch(orderId, {
      status: "confirmed",
      customerId: effectiveCustomerId, // ✅ حفظ المشترك المربوط أو المكتشف بالهاتف
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
    // ✅ الاعتماد يستبدل أي خطة قائمة لنفس (عميل + تاريخ + وقت) — يدوية أو من طلب أقدم.
    let replacedPlans = 0; // كم خطة زائدة حُذفت (تكرار سابق) — نُرجعها للواجهة
    // ✅ وقت التوصيل من اشتراك العميل نفسه (صباحي/مسائي) بدل MORNING الثابت —
    //    وإلا كل طلب معتمد يذهب للجولة الصباحية فقط، فالخدمة المسائية تُكسر.
    const deliveryTime: "MORNING" | "EVENING" =
      (linkedCustomer as any)?.deliveryTime === "EVENING" ? "EVENING" : "MORNING";

    /* 🔒 الاعتماد لا يكتب خططاً في أيامٍ لا تُطعم أحداً. كان يبني على التاريخ
       المحسوب من الطلب مهما كان: ثلاثة طلبات معلّقة تطلب البدء 30-6 و11-7 —
       تواريخ فاتت — واعتمادها كان سيُنشئ خططاً في الماضي. والحارس الذي أضيف في
       dailyPlans.create لا يحمي هذا المسار لأنه يكتب في الجدول مباشرةً.
       يُتخطّى: اليوم الماضي، وما هو خارج كل فترات اشتراك العميل (المجدَّدة
       محسوبة). ما يُتخطّى يُبلَّغ للأخصائية بدل أن يُهمَل بصمت. */
    const approveTodayISO = qatarTodayISO(Date.now());
    const skippedDates: string[] = [];
    for (const [date, dayMeals] of Object.entries(mealsByDate)) {
      const dISO = String(date).slice(0, 10);
      // اليوم الفائت لا يُطبخ: المطبخ يطبخ اليوم لتوصيل الغد، فما مضى مضى.
      if (dISO < approveTodayISO) { skippedDates.push(`${dISO} (فات موعد طبخه)`); continue; }
      if (linkedCustomer && !isWithinSubscription(linkedCustomer, dISO)) {
        skippedDates.push(`${dISO} (خارج الاشتراك)`); continue;
      }
      // ⛔ لا تُنشأ خطط داخل فترة تجميد المشترك — هذا المسار يكتب في dailyPlans
      //    مباشرةً، فلا يمرّ على الحارس الموجود في dailyPlans.create.
      const pausedFrom = (linkedCustomer as any)?.pausedFrom as string | undefined;
      if (pausedFrom && String(date).slice(0, 10) >= pausedFrom) continue;

      const planItems = dayMeals.map((meal) => ({
        /* بصمةُ الصنف في الطلب: بها يُعرف — بعد الاعتماد — أيُّ وجبةٍ في الخطة
           اليومية تقابل أيَّ صنفٍ في الطلب، فيُنزَّل التعديل على موضعه بالضبط
           لا على أوّل وجبةٍ تشبهه. */
        orderItemId: meal._id,
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

      // ✅ الاعتماد **يستبدل** أي خطة قائمة لنفس (عميل + تاريخ + وقت توصيل) أياً كان
      //    مصدرها — يدوية من الأخصائية أو من طلب أقدم. اعتمادها للطلب = موافقة على
      //    اختيار العميل، فلا يصح أن تتعايش خطتان لنفس اليوم (ضعف الأكل وبوكسان).
      //    ⚠️ كان الشرط يتطلّب sourceOrderId === orderId، والخطة اليدوية بلا مصدر،
      //       فلا تتطابق أبداً → تُنشأ خطة ثانية بجوارها (حالة FATMA BAHZAD 26-7).
      const sameSlot = existingPlans.filter((p: any) => {
        const sameCustomer = effectiveCustomerId
          ? p.customerId === effectiveCustomerId
          : p.customerName === order.customerName;
        return sameCustomer && p.deliveryTime === deliveryTime;
      });
      // نفضّل تحديث خطة نفس الطلب (إعادة اعتماد)، وإلا نستبدل الموجودة.
      const duplicatePlan = sameSlot.find((p: any) => p.sourceOrderId === orderId) ?? sameSlot[0];

      if (duplicatePlan) {
        // ✅ تحديث الـ plan الموجودة بدل إنشاء جديدة
        await ctx.db.patch(duplicatePlan._id, {
          restaurantKey: String((order as any).restaurantKey || "ADRENALINE"),
          items: planItems,
          notes: notes || "",
          status: "CONFIRMED",
          sourceOrderId: orderId, // صارت مملوكة لهذا الطلب
          updatedAt: Date.now(),
        });
        // 🧹 أي خطط زائدة لنفس الخانة (تكرار سابق) تُحذف — وإلا بقي الأكل مضاعفاً
        for (const extra of sameSlot) {
          if (String(extra._id) !== String(duplicatePlan._id)) {
            await ctx.db.delete(extra._id);
            replacedPlans++;
          }
        }
      } else {
        // إنشاء plan جديدة
        await ctx.db.insert("dailyPlans", {
          restaurantKey: String((order as any).restaurantKey || "ADRENALINE"),
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

    await trail(ctx, {
      action: "ORDER_APPROVED", entityType: "order", entityId: String(orderId),
      details: `${order.orderNumber || ""} — ${order.customerName || ""} — ${Object.keys(mealsByDate).length} يوم`
        + (skippedDates.length ? ` — تُخطّي ${skippedDates.length} تاريخاً` : ""),
      staff: approver as any,
    });
    return {
      success: true,
      message: skippedDates.length
        ? `تم اعتماد الطلب ✓ — باقي الأيام أُنشئت. تُخطّي ${skippedDates.length} تاريخاً لا يمكن طبخها: ${skippedDates.join(" · ")}`
        : "تم اعتماد الطلب وإضافته للمطبخ",
      replacedPlans, // خطط زائدة حُذفت لمنع ازدواج الأكل
      skippedDates,  // أيام لم تُنشأ لها خطة — تراجعها الأخصائية
    };
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
    await trail(ctx, {
      action: "ORDER_REJECTED", entityType: "order", entityId: String(orderId),
      details: `${(order as any)?.orderNumber || ""} — ${(order as any)?.customerName || ""} — ${reason}`,
      staff: null,
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

/* ═══ تعديل الخطة بعد اعتمادها ═══════════════════════════════════════════
   كان التعديل ممنوعاً بعد المراجعة، فالمشترك الذي يستثقل وجبةً بعد أسبوع
   يُضطرّ معه الطاقم إلى فتح الخطط اليومية يوماً بيوم. والطلب هو الخطة كاملةً
   في شاشةٍ واحدة، فيُفتح للأخصائية — على أن ينزل كلُّ تعديلٍ فوراً على الخطة
   اليومية المولَّدة منه، وإلا افترقت الشاشتان وطبخ المطبخ القديم. */

/** الحالات التي يجوز فيها التعديل: قبل المراجعة، وبعد الاعتماد. */
function assertOrderEditable(order: any, verb: string) {
  if (!order) throw new Error("الطلب غير موجود");
  if (order.status !== "pending" && order.status !== "confirmed") {
    throw new Error(`لا يمكن ${verb} وجبات طلبٍ ${order.status === "rejected" ? "مرفوض" : "منتهٍ"}`);
  }
}

/** موضع الصنف داخل الخطة اليومية المولَّدة من الطلب. */
async function findPlanSlot(ctx: any, orderId: any, item: any) {
  const plans = await ctx.db
    .query("dailyPlans")
    .withIndex("by_source_order", (q: any) => q.eq("sourceOrderId", orderId))
    .collect();
  for (const plan of plans) {
    const items: any[] = Array.isArray(plan.items) ? plan.items : [];
    /* البصمة أولاً. والخطط المعتمَدة قبل إضافتها لا تحملها، فيُرجَع إلى
       (الدورة + اليوم + الوجبة) — وهي تكفي إلا أن تتكرّر الوجبة نفسها في
       اليوم نفسه، وذلك ما يمنعه مولّد الخطة أصلاً. */
    let idx = items.findIndex((it) => it?.orderItemId && String(it.orderItemId) === String(item._id));
    if (idx < 0) {
      idx = items.findIndex((it) =>
        String(it?.mealId) === String(item.mealId)
        && Number(it?.week) === Number(item.week)
        && String(it?.day) === String(item.day));
    }
    if (idx >= 0) return { plan, items, idx };
  }
  return null;
}

/**
 * يمنع التعديل على يومٍ خرج من يد الأخصائية.
 *
 * بعد «جاهزة» يكون المطبخ طبخ والاستيكر طُبع، والمخزون خُصم مرّةً واحدة فما
 * يُضاف بعدها لا يُخصم أبداً. فيُردّ التعديل على ذلك اليوم وحده، ويبقى بقيّة
 * الخطة مفتوحاً — التعديل على الخطة الكاملة لا يسقط لأجل يومٍ واحدٍ فات.
 */
function assertPlanDayEditable(plan: any) {
  const st = String(plan?.status || "");
  if (st === "PREPARED" || st === "DELIVERED" || st === "CANCELLED") {
    const label: Record<string, string> = {
      PREPARED: "جهّزه المطبخ", DELIVERED: "وصل للمشترك", CANCELLED: "أُلغي",
    };
    throw new Error(`يوم ${plan.date} ${label[st]} — لا يُعدَّل. عدّل الأيام التالية.`);
  }
}

/**
 * تنبيه المطبخ بتعديلٍ وقع بعد الاعتماد.
 *
 * الورقة قد تكون طُبعت والاستيكر لُصق، فالتغيير الصامت يصل إلى البوكس ولا
 * يصل إلى الشيف. ولا يُرسَل قبل الاعتماد: التعديل حينها هو المراجعة نفسها.
 */
async function notifyKitchenOfEdit(
  ctx: any, order: any, byName: string | undefined, detail: string, dates: string[],
) {
  if (!order || order.status !== "confirmed") return;
  await ctx.db.insert("notifications", {
    targetRole: "KITCHEN",
    type: "PLAN_EDITED_AFTER_APPROVAL",
    title: "⚠️ تعديل على خطة معتمدة",
    message: `${order.customerName} — ${detail}`
      + (dates.length ? ` — ${dates.length === 1 ? "يوم" : "أيام"} ${dates.sort().join("، ")}` : "")
      + (byName ? ` — بواسطة ${byName}` : ""),
    link: `/kitchen`,
    relatedId: order._id,
    isRead: false,
    createdAt: Date.now(),
  });
}

// ===== UPDATE ORDER ITEM MEAL (Admin - Replace meal) =====
/** ✅ ملاحظة الأخصائية على وجبة داخل الطلب — تظهر للمطبخ وعلى الاستيكر بعد الاعتماد. */
export const updateOrderItemNote = mutation({
  args: {
    itemId: v.id("customerOrderItems"),
    note: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, ORDER_REVIEW_ROLES);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("الصنف غير موجود");
    const order = await ctx.db.get(item.orderId);
    assertOrderEditable(order, "تعديل");
    const note = args.note.trim() || undefined;

    if (order!.status === "confirmed") {
      const slot = await findPlanSlot(ctx, item.orderId, item);
      if (slot) {
        assertPlanDayEditable(slot.plan);
        const items = [...slot.items];
        items[slot.idx] = { ...items[slot.idx], specialNotes: note };
        await ctx.db.patch(slot.plan._id, { items, updatedAt: Date.now() });
      }
    }

    await ctx.db.patch(args.itemId, { specialNotes: note, updatedAt: Date.now() });
    return { success: true };
  },
});

export const updateOrderItemMeal = mutation({
  args: {
    itemId: v.id("customerOrderItems"),
    newMealId: v.id("publicMeals"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const specialist = await requireRole(ctx, args.sessionToken, ORDER_REVIEW_ROLES);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("الصنف غير موجود");
    const order = await ctx.db.get(item.orderId);
    assertOrderEditable(order, "تبديل");
    const meal = await ctx.db.get(args.newMealId);
    if (!meal || !meal.isActive || meal.isGymOnly || meal.isOnlineOnly) {
      throw new Error("الوجبة المختارة ليست ضمن منيو المشتركين");
    }
    const oldMealName = item.mealNameAr || item.mealNameEn || String(item.mealId);
    const specialistUser: any = specialist.userId
      ? await ctx.db.get(specialist.userId as any)
      : null;
    const byName = specialistUser?.name || specialistUser?.username || undefined;

    /* يُبحث عن موضع الصنف قبل تعديله: البحث الاحتياطي يستدلّ بوجبته القديمة. */
    let planDate: string | undefined;
    if (order!.status === "confirmed") {
      const slot = await findPlanSlot(ctx, item.orderId, item);
      if (slot) {
        assertPlanDayEditable(slot.plan);
        planDate = slot.plan.date;
        const items = [...slot.items];
        items[slot.idx] = {
          ...items[slot.idx],
          orderItemId: String(item._id),
          mealId: args.newMealId,
          mealNameAr: meal.nameAr,
          mealNameEn: meal.nameEn,
          category: meal.category,
          calories: Number(meal.calories) || 0,
          protein: Number(meal.protein) || 0,
          carbs: Number(meal.carbs) || 0,
          fats: Number(meal.fats) || 0,
          imageUrl: meal.imageUrl,
          /* أثرٌ يقرؤه المطبخ على ورقة الطلبات والاستيكر: الوجبة تغيّرت بعد
             الاعتماد، ومَن غيّرها ومتى. */
          editedAfterApproval: true,
          replacedMealNameAr: items[slot.idx]?.mealNameAr,
          editedByName: byName,
          editedByRole: specialist.role || undefined,
          editedAt: Date.now(),
        };
        await ctx.db.patch(slot.plan._id, { items, updatedAt: Date.now() });
      }
    }

    // The catalogue is authoritative. Never trust nutrition or price snapshots
    // supplied by the review UI.
    await ctx.db.patch(args.itemId, {
      mealId: args.newMealId,
      mealNameAr: meal.nameAr,
      mealNameEn: meal.nameEn,
      calories: Number(meal.calories) || 0,
      protein: Number(meal.protein) || 0,
      carbs: Number(meal.carbs) || 0,
      fats: Number(meal.fats) || 0,
      category: meal.category,
      imageUrl: meal.imageUrl,
      priceQAR: Number(meal.priceQAR) || 0,
      originalMealNameAr: item.originalMealNameAr || item.mealNameAr,
      originalMealNameEn: item.originalMealNameEn || item.mealNameEn,
      modifiedByName: byName,
      modifiedByRole: specialist.role || undefined,
      modifiedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Recalculate order totals
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

    await notifyKitchenOfEdit(ctx, order, byName, `${oldMealName} ← ${meal.nameAr}`, planDate ? [planDate] : []);

    /* التعديل بعد الاعتماد يُسجَّل باسمٍ يخصّه: هو ما يُسأل عنه لاحقاً حين
       يختلف ما في البوكس عمّا وافق عليه المشترك. */
    await trail(ctx, {
      action: order!.status === "confirmed" ? "ORDER_MEAL_REPLACED_AFTER_APPROVAL" : "ORDER_MEAL_REPLACED",
      entityType: "order",
      entityId: String(item.orderId),
      details: `${oldMealName} → ${meal.nameAr} (${item.week}-${item.day}${planDate ? ` — ${planDate}` : ""})`,
      staff: specialist,
    });

    return { success: true };
  },
});

/**
 * استبدال وجبةٍ في الخطة كلّها دفعةً واحدة.
 *
 * المشترك لا يقول «غيّر ثلاثاء الأسبوع الثاني»، بل «الوجبة دي مش عايزها».
 * وهي تتكرّر عبر الدورات، فتبديلها صنفاً صنفاً عملٌ طويل يُنسى منه واحد.
 * فتُبدَّل مواضعها كلّها في نداءٍ واحد.
 *
 * والأيام التي جهّزها المطبخ تُتخطّى ولا تُسقط العملية — ثم تُذكر بأسمائها
 * للأخصائية، فتعرف ما لم يتغيّر بدل أن تظنّ الكلّ تبدّل.
 */
export const replaceMealAcrossOrder = mutation({
  args: {
    orderId: v.id("customerOrders"),
    oldMealId: v.id("publicMeals"),
    newMealId: v.id("publicMeals"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const specialist = await requireRole(ctx, args.sessionToken, ORDER_REVIEW_ROLES);
    const order = await ctx.db.get(args.orderId);
    assertOrderEditable(order, "تبديل");
    if (String(args.oldMealId) === String(args.newMealId)) {
      throw new Error("الوجبة الجديدة هي نفسها القديمة");
    }

    const meal = await ctx.db.get(args.newMealId);
    if (!meal || !meal.isActive || meal.isGymOnly || meal.isOnlineOnly) {
      throw new Error("الوجبة المختارة ليست ضمن منيو المشتركين");
    }

    const items = (await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect()).filter((i: any) => String(i.mealId) === String(args.oldMealId));
    if (!items.length) throw new Error("الوجبة غير موجودة في هذه الخطة");

    const specialistUser: any = specialist.userId ? await ctx.db.get(specialist.userId as any) : null;
    const byName = specialistUser?.name || specialistUser?.username || undefined;
    const now = Date.now();
    const oldName = items[0].mealNameAr || items[0].mealNameEn || "";

    let replaced = 0;
    const skipped: string[] = [];

    for (const item of items) {
      /* الخطة اليومية أولاً: لو رُدَّ اليوم لم يُمسّ صنفُه في الطلب، فيبقى
         الطلب مرآةً لما سيُطبخ فعلاً لا لما نوينا تغييره. */
      if (order!.status === "confirmed") {
        const slot = await findPlanSlot(ctx, args.orderId, item);
        if (slot) {
          const st = String(slot.plan.status || "");
          if (st === "PREPARED" || st === "DELIVERED" || st === "CANCELLED") {
            skipped.push(slot.plan.date);
            continue;
          }
          const planItems = [...slot.items];
          planItems[slot.idx] = {
            ...planItems[slot.idx],
            orderItemId: String(item._id),
            mealId: args.newMealId,
            mealNameAr: meal.nameAr,
            mealNameEn: meal.nameEn,
            category: meal.category,
            calories: Number(meal.calories) || 0,
            protein: Number(meal.protein) || 0,
            carbs: Number(meal.carbs) || 0,
            fats: Number(meal.fats) || 0,
            imageUrl: meal.imageUrl,
            editedAfterApproval: true,
            replacedMealNameAr: planItems[slot.idx]?.mealNameAr,
            editedByName: byName,
            editedByRole: specialist.role || undefined,
            editedAt: now,
          };
          await ctx.db.patch(slot.plan._id, { items: planItems, updatedAt: now });
        }
      }

      await ctx.db.patch(item._id, {
        mealId: args.newMealId,
        mealNameAr: meal.nameAr,
        mealNameEn: meal.nameEn,
        calories: Number(meal.calories) || 0,
        protein: Number(meal.protein) || 0,
        carbs: Number(meal.carbs) || 0,
        fats: Number(meal.fats) || 0,
        category: meal.category,
        imageUrl: meal.imageUrl,
        priceQAR: Number(meal.priceQAR) || 0,
        originalMealNameAr: item.originalMealNameAr || item.mealNameAr,
        originalMealNameEn: item.originalMealNameEn || item.mealNameEn,
        modifiedByName: byName,
        modifiedByRole: specialist.role || undefined,
        modifiedAt: now,
        updatedAt: now,
      });
      replaced++;
    }

    const all = await ctx.db
      .query("customerOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect();
    await ctx.db.patch(args.orderId, {
      totalCalories: all.reduce((sum, i) => sum + (i.calories || 0), 0),
      totalPrice: all.reduce((sum, i) => sum + (i.priceQAR || 0), 0),
      totalMeals: all.length,
      updatedAt: now,
    });

    if (replaced > 0) {
      await notifyKitchenOfEdit(ctx, order, byName, `${oldName} ← ${meal.nameAr} (${replaced} مواضع)`, []);
    }

    await trail(ctx, {
      action: order!.status === "confirmed" ? "ORDER_MEAL_REPLACED_ALL_AFTER_APPROVAL" : "ORDER_MEAL_REPLACED_ALL",
      entityType: "order",
      entityId: String(args.orderId),
      details: `${oldName} → ${meal.nameAr} — ${replaced} موضعاً`
        + (skipped.length ? ` — تُخطّي ${skipped.length} (${skipped.sort().join("، ")})` : ""),
      staff: specialist,
    });

    return { success: true, replaced, skipped: skipped.sort(), newMealNameAr: meal.nameAr, oldMealNameAr: oldName };
  },
});

/**
 * ✅ حذف صنف (وجبة) من الطلب قبل الاعتماد، وإعادة حساب إجماليات الطلب.
 *    تستخدمه الأخصائية في مراجعة الطلب للتجربة أو لإزالة وجبة زائدة.
 */
export const removeOrderItem = mutation({
  args: { itemId: v.id("customerOrderItems"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const specialist = await requireRole(ctx, args.sessionToken, ORDER_REVIEW_ROLES);
    const item = await ctx.db.get(args.itemId);
    if (!item) return { success: false, error: "الصنف غير موجود" };

    const orderId = item.orderId;
    const order = await ctx.db.get(orderId);
    assertOrderEditable(order, "حذف");

    if (order!.status === "confirmed") {
      const slot = await findPlanSlot(ctx, orderId, item);
      if (slot) {
        assertPlanDayEditable(slot.plan);
        const items = slot.items.filter((_: any, i: number) => i !== slot.idx);
        await ctx.db.patch(slot.plan._id, { items, updatedAt: Date.now() });
      }
    }

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

    await trail(ctx, {
      action: "ORDER_MEAL_REMOVED",
      entityType: "order",
      entityId: String(orderId),
      details: `${item.mealNameAr || item.mealNameEn} (${item.week}-${item.day})`,
      staff: specialist,
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

/**
 * ⚠️ تنبيه ما قبل الاعتماد: خطط قائمة لنفس العميل في التواريخ المستهدفة — سيتم
 *    استبدالها عند الاعتماد. تعرضها شاشة المراجعة للأخصائية قبل الضغط، فلا تتفاجأ
 *    بأن خطتها اليدوية اختفت أو تظن أن الأكل تضاعف.
 *    قراءة فقط — لا تعدّل شيئاً.
 */
export const plansToBeReplaced = query({
  args: {
    customerId: v.optional(v.id("customers")),
    dates: v.array(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    if (!args.customerId || args.dates.length === 0) return { total: 0, rows: [] };
    const wanted = new Set(args.dates.map((d) => String(d).slice(0, 10)));
    const all = await ctx.db
      .query("dailyPlans")
      .filter((q: any) => q.eq(q.field("customerId"), args.customerId))
      .collect();
    const rows = (all as any[])
      .filter((p) => wanted.has(String(p.date).slice(0, 10)))
      .map((p) => ({
        date: p.date,
        deliveryTime: p.deliveryTime,
        status: p.status,
        source: p.sourceOrderId ? "order" : "manual",
        items: (p.items || []).filter((i: any) => !i?.isOff).length,
      }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return {
      total: rows.length,
      manual: rows.filter((r) => r.source === "manual").length,
      rows,
    };
  },
});
