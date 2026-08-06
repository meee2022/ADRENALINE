/**
 * @file convex/dailyPlans.ts
 * @description Convex functions للخطط اليومية
 * @frontend client/src/pages/Plans.tsx, client/src/pages/Kitchen.tsx, client/src/pages/Delivery.tsx, client/src/pages/Dashboard.tsx
 */
import { mutation, query } from "./_generated/server";
import { convertUnit } from "./units";
import { v } from "convex/values";
import { requireStaff, requireStaffOrSubscriptionOwner } from "./sessions";
import { isWithinSubscription } from "./lib/subscriptionPeriods";
import { trail } from "./lib/trail";

type PlanStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PREPARED"
  | "DELIVERED"
  | "CANCELLED";

const ALLOWED_STATUSES: PlanStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "PREPARED",
  "DELIVERED",
  "CANCELLED",
];

function normalizeStatus(x: any): PlanStatus {
  const s = String(x || "")
    .trim()
    .toUpperCase();
  return (
    ALLOWED_STATUSES.includes(s as PlanStatus) ? s : "DRAFT"
  ) as PlanStatus;
}

function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  if (to === from) return true;

  // السماح بالإلغاء من أي حالة
  if (to === "CANCELLED") return true;

  // مسارات طبيعية
  if (from === "DRAFT" && to === "CONFIRMED") return true;
  if (from === "CONFIRMED" && to === "PREPARED") return true;
  if (from === "PREPARED" && to === "DELIVERED") return true;

  // السماح بالرجوع من CONFIRMED إلى DRAFT (اختياري)
  if (from === "CONFIRMED" && to === "DRAFT") return true;

  // غير ذلك مرفوض
  return false;
}

// ✅ تقديم حالة طلب العميل المرتبط (لتتبّع العميل) — للأمام فقط، لا يلمس الملغي.
const ORDER_RANK: Record<string, number> = { pending: 0, confirmed: 1, active: 2, completed: 3 };
async function advanceOrder(ctx: any, sourceOrderId: any, target: "active" | "completed") {
  if (!sourceOrderId) return;
  const order = await ctx.db.get(sourceOrderId);
  if (!order) return;
  const cur = String(order.status || "pending");
  if (cur === "cancelled" || cur === "completed") return;
  if ((ORDER_RANK[target] ?? 0) > (ORDER_RANK[cur] ?? 0)) {
    await ctx.db.patch(sourceOrderId, { status: target, updatedAt: Date.now() });
  }
}

function stripSystemFields(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const safe = { ...(obj || {}) };
  delete safe._id;
  delete safe._creationTime;
  delete safe.createdAt;
  // ختم الاستثناء يكتبه الخادم فقط بعد إعادة تأكيد صريحة من موظف.
  delete safe.mealCountOverride;
  delete safe.approveMealCountMismatch;
  return safe;
}

async function recipeForPlanItem(ctx: any, item: any) {
  const publicMealId = item?.publicMealId || (!item?.menuItemId ? item?.mealId : null);
  if (publicMealId) {
    return await ctx.db
      .query("mealIngredients")
      .withIndex("by_publicMeal", (q: any) => q.eq("publicMealId", publicMealId))
      .collect();
  }
  if (item?.menuItemId) {
    return await ctx.db
      .query("mealIngredients")
      .withIndex("by_menuItem", (q: any) => q.eq("menuItemId", item.menuItemId))
      .collect();
  }
  return [];
}

export const list = query({
  args: { date: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { date, sessionToken }) => {
    await requireStaff(ctx, sessionToken); // 🔒 خطط اليوم فيها بيانات مشتركين
    if (date) {
      return await ctx.db
        .query("dailyPlans")
        .withIndex("by_date", (q) => q.eq("date", date))
        .collect();
    }
    return await ctx.db.query("dailyPlans").order("desc").collect();
  },
});

/**
 * كل خطط مشترك واحد (اختيارياً ضمن مدى تواريخ) — لطباعة جدول وجباته.
 * نفلتر على السيرفر بدل تنزيل كل الخطط للمتصفح.
 */
export const listByCustomer = query({
  args: {
    customerId: v.id("customers"),
    from: v.optional(v.string()), // yyyy-MM-dd (شامل)
    to: v.optional(v.string()),   // yyyy-MM-dd (شامل)
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db
      .query("dailyPlans")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.customerId))
      .collect();

    return rows
      .filter((p) => {
        const d = String(p.date).slice(0, 10);
        if (args.from && d < args.from) return false;
        if (args.to && d > args.to) return false;
        return true;
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  },
});

export const getByDateAndCustomer = query({
  args: {
    date: v.string(),
    customerId: v.id("customers"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { date, customerId, sessionToken }) => {
    // 🔒 لازم موظف أو صاحب الاشتراك نفسه
    await requireStaffOrSubscriptionOwner(ctx, sessionToken, String(customerId));
    const plans = await ctx.db
      .query("dailyPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    return plans.find((p) => String(p.customerId) === String(customerId)) || null;
  },
});

export const get = query({
  args: { id: v.id("dailyPlans"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    // 🔒 نجيب الخطة أولاً ثم نتحقق أن المستدعي موظف أو صاحب الاشتراك
    const plan = await ctx.db.get(id);
    if (!plan) return null;
    if ((plan as any).customerId) {
      await requireStaffOrSubscriptionOwner(ctx, sessionToken, String((plan as any).customerId));
    } else {
      await requireStaff(ctx, sessionToken);
    }
    return plan;
  },
});

export const create = mutation({
  args: {
    date: v.string(),
    customerId: v.id("customers"),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    status: v.string(),
    notes: v.optional(v.string()),
    items: v.any(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx, args.sessionToken);
    // ⚠️ sessionToken لا يُخزَّن — الـinsert أدناه يعمل ...fields وليس ...args
    const { sessionToken: _t, ...fields } = args;

    // مشترك مجمّد (سفر) لا تُنشأ له خطط في أو بعد يوم التجميد — وإلا يطبخ له المطبخ
    // رغم أنه غير موجود، ويخسر يومه مرتين. انظر convex/subscriptionPause.ts
    const customer = await ctx.db.get(args.customerId);
    const pausedFrom = (customer as any)?.pausedFrom as string | undefined;
    if (pausedFrom && String(args.date).slice(0, 10) >= pausedFrom) {
      throw new Error("اشتراك هذا المشترك مجمّد — لا يمكن إنشاء خطة في فترة التجميد");
    }
    const planDate = String(args.date).slice(0, 10);
    const skippedDates: string[] = Array.isArray((customer as any)?.skippedDates)
      ? (customer as any).skippedDates
      : [];
    if (skippedDates.some((skippedDate: unknown) => String(skippedDate).slice(0, 10) === planDate)) {
      throw new Error(`المشترك متخطٍ يوم ${planDate} — لا يمكن إنشاء خطة أو إرسال وجبات لهذا اليوم`);
    }
    /* 🔒 ولا خطة خارج الاشتراك. كان الفحص للتجميد وحده، فمرّت خطط لمن لم يبدأ
       اشتراكه بعد أو انتهى — والمطبخ يطبخها. الفترات المجدَّدة محسوبة، فمن
       جدّد لا تُرفض أيامه القديمة التي أكلها. */
    if (!isWithinSubscription(customer, String(args.date))) {
      const c: any = customer;
      throw new Error(
        `التاريخ خارج مدة اشتراك هذا المشترك (${String(c?.startDate || "?").slice(0,10)} → ${String(c?.endDate || "?").slice(0,10)}) — راجع تواريخ الاشتراك أو جدّده`,
      );
    }

    /* 🔒 خطة واحدة لكل (مشترك + تاريخ) — لا استثناء.
       سبق أن تعايشت خطتان لليوم نفسه بطريقتين: ضغطة حفظ مزدوجة أنشأت نسختين
       بفارق ثانيتين (عبدالله المعلا 30-7)، واختلافُ الوردية بين خطة قديمة
       وأخرى من طلبٍ معتمد جعل النظام يحسبهما خانتين (خمسة مشتركين 1-8).
       النتيجة في الحالتين: المطبخ يطبخ الضعف. الوردية ليست جزءاً من هوية
       اليوم — العميل له يوم واحد ووجبات يوم واحد. */
    const sameDay = (
      await ctx.db.query("dailyPlans").withIndex("by_customerId", (q: any) => q.eq("customerId", args.customerId)).collect()
    ).filter((p: any) => String(p.date).slice(0, 10) === String(args.date).slice(0, 10)
      && p.status !== "CANCELLED");
    if (sameDay.length) {
      const live = sameDay[0] as any;
      // إعادة الإرسال/الضغط المزدوج: نُحدّث القائمة بدل إنشاء ثانية بجوارها
      await ctx.db.patch(live._id, {
        items: args.items,
        notes: args.notes ?? live.notes,
        deliveryTime: args.deliveryTime,
        updatedAt: Date.now(),
      });
      return live._id;
    }

    const requested = normalizeStatus(args.status);

    const safeStatus: PlanStatus =
      requested === "PREPARED" || requested === "DELIVERED"
        ? "CONFIRMED"
        : requested;

    const newPlanId = await ctx.db.insert("dailyPlans", {
      ...fields,
      status: safeStatus,
      createdAt: Date.now(),
    });
    await trail(ctx, {
      action: "PLAN_CREATED", entityType: "plan", entityId: String(newPlanId),
      details: `خطة ${args.date} — ${(customer as any)?.fullName || "?"} — ${safeStatus}`,
      staff: staff as any,
    });
    return newPlanId;
  },
});

export const update = mutation({
  args: {
    id: v.id("dailyPlans"),
    data: v.any(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, data, sessionToken }) => {
    // انتقال الحالة إلى PREPARED يخصم المخزون ويُطلق إشعارات — موظفون فقط
    const staffU = await requireStaff(ctx, sessionToken);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Daily plan not found");

    const currentStatus = normalizeStatus((existing as any).status);
    const requestedStatus =
      data && typeof data === "object" && "status" in data
        ? normalizeStatus((data as any).status)
        : currentStatus;

    // ✅ طبق قواعد الانتقال
    const finalStatus = canTransition(currentStatus, requestedStatus)
      ? requestedStatus
      : currentStatus;

    const approveMealCountMismatch = data?.approveMealCountMismatch === true;
    const safe = stripSystemFields(data || {});
    safe.status = finalStatus;

    /* أول تأكيد لخطة بعدد مختلف يظل خطأً مانعاً في تدقيق الإنتاج. إذا فتح
       الموظف الخطة المؤكدة وراجعها ثم ضغط «تأكيد» مرة ثانية، نختم الاستثناء
       لهذا العدد بعينه. تغيير العدد أو الرجوع لمسودة يلغي صلاحية الختم، ولا
       يمكن لهذا المسار تجاوز أي خطأ آخر في تدقيق الإنتاج. */
    const proposedItems = Object.prototype.hasOwnProperty.call(safe, "items")
      ? safe.items
      : (existing as any).items;
    const actualCount = (Array.isArray(proposedItems) ? proposedItems : [])
      .filter((item: any) => !item?.isOff).length;
    const customer: any = (existing as any).customerId
      ? await ctx.db.get((existing as any).customerId)
      : null;
    const expectedCount = Math.max(0, Number(customer?.mealsPerDay) || 0)
      + Math.max(0, Number(customer?.snacksPerDay) || 0);
    const previousOverride: any = (existing as any).mealCountOverride;
    const overrideStillMatches = previousOverride
      && Number(previousOverride.expected) === expectedCount
      && Number(previousOverride.actual) === actualCount;
    let overrideApproved = false;
    if (
      approveMealCountMismatch
      && currentStatus === "CONFIRMED"
      && finalStatus === "CONFIRMED"
      && expectedCount > 0
      && actualCount > 0
      && actualCount !== expectedCount
    ) {
      const approverRole = String(staffU?.role || "").toUpperCase();
      if (approverRole !== "ADMIN" && approverRole !== "NUTRITIONIST") {
        throw new Error("اعتماد اختلاف عدد الوجبات متاح للأخصائية أو المدير فقط");
      }
      const approver: any = staffU?.userId ? await ctx.db.get(staffU.userId as any) : null;
      safe.mealCountOverride = {
        expected: expectedCount,
        actual: actualCount,
        approvedBy: staffU.userId,
        approvedByName: approver?.name || approver?.username || undefined,
        approvedAt: Date.now(),
      };
      overrideApproved = true;
    } else if (finalStatus !== "CONFIRMED" || !overrideStillMatches) {
      safe.mealCountOverride = undefined;
    }

    await ctx.db.patch(id, safe);
    if (overrideApproved) {
      await trail(ctx, {
        action: "PLAN_MEAL_COUNT_OVERRIDE_APPROVED",
        entityType: "plan",
        entityId: String(id),
        details: `${(existing as any).date} — ${customer?.fullName || "?"} — الباقة ${expectedCount} / الخطة ${actualCount}`,
        staff: staffU as any,
      });
    }
    /* نسجّل انتقال الحالة وحده: تعديل الوجبات يقع عشرات المرات يومياً فيُغرق
       السجل، أما الحالة فهي ما يُحاسَب عليه (طُبخ؟ خرج؟ أُلغي؟). */
    if (finalStatus !== currentStatus) {
      const c0: any = (existing as any).customerId ? await ctx.db.get((existing as any).customerId) : null;
      await trail(ctx, {
        action: `PLAN_${finalStatus}`, entityType: "plan", entityId: String(id),
        details: `${(existing as any).date} — ${c0?.fullName || "?"} — ${currentStatus} ← ${finalStatus}`,
        staff: staffU as any,
      });
    }

    // 🔔 إشعارات + خصم مخزون عند تغيير الحالة
    if (finalStatus !== currentStatus) {
      const plan: any = await ctx.db.get(id);
      const customerName = plan?.customerName || "عميل";
      const planDate = plan?.date || "";

      if (finalStatus === "PREPARED") {
        // إشعار للتوصيل
        await ctx.db.insert("notifications", {
          targetRole: "DELIVERY",
          type: "MEAL_PREPARED",
          title: "وجبات جاهزة للتوصيل",
          message: `${customerName} - ${planDate}`,
          link: `/delivery`,
          relatedId: id,
          isRead: false,
          createdAt: Date.now(),
        });

        // ✅ خصم المخزون التلقائي — idempotent: لا نخصم لو سبق خصم مكوّنات هذه الخطة
        // (يمنع الخصم المزدوج مع inventory.prepareAndConsume أو عند تكرار التحديث)
        if (!plan?.inventoryConsumedAt) {
          try {
            const items = Array.isArray(plan?.items) ? plan.items : [];
            for (const it of items) {
              if (it?.isOff) continue;
              const ingredients = await recipeForPlanItem(ctx, it);

              for (const ing of ingredients) {
                const invItem: any = await ctx.db.get(ing.inventoryItemId);
                if (!invItem) continue;
                // حوّل كمية الرسيبي إلى وحدة المخزون (جرام→كيلو مثلاً) قبل الخصم
                const deduct = convertUnit(Number(ing.quantityPerServing), (ing as any).unit, invItem.unit);
                const newStock = Math.max(0, (invItem.currentStock || 0) - deduct);
                await ctx.db.patch(ing.inventoryItemId, {
                  currentStock: newStock,
                  updatedAt: Date.now(),
                });
                await ctx.db.insert("inventoryMovements", {
                  itemId: ing.inventoryItemId,
                  type: "consume",
                  quantity: -deduct, // ✅ سالب (استهلاك) — كان موجباً ويُفسد التقارير
                  note: `استهلاك آلي: ${customerName} - ${planDate}`,
                  createdAt: Date.now(),
                });

                // تحذير مخزون منخفض (يشمل الوصول لصفر — أخطر حالة)
                if (newStock <= (invItem.minStock || 0)) {
                  await ctx.db.insert("notifications", {
                    targetRole: "INVENTORY_MANAGER",
                    type: "LOW_STOCK",
                    title: "تحذير: مخزون منخفض",
                    message: `${invItem.nameAr} - متبقي ${newStock} ${invItem.unit}`,
                    link: `/inventory`,
                    relatedId: ing.inventoryItemId,
                    isRead: false,
                    createdAt: Date.now(),
                  });
                }
              }
            }
            // ختم الخصم حتى لا يتكرر من أي مسار آخر
            await ctx.db.patch(id, { inventoryConsumedAt: Date.now() });
          } catch (e) {
            console.error("Inventory deduction error:", e);
          }
        }
        // ✅ تتبّع العميل: الطلب دخل مرحلة التنفيذ (قيد التحضير/التوصيل)
        await advanceOrder(ctx, (plan as any)?.sourceOrderId, "active");
      } else if (finalStatus === "DELIVERED") {
        // ✅ ختم وقت التسليم الحقيقي (مرة واحدة)
        if (!(plan as any)?.deliveredAt) {
          await ctx.db.patch(id, { deliveredAt: Date.now() });
        }
        // ✅ تتبّع العميل: أكمل الطلب فقط لو كل خطط نفس الطلب اتسلّمت، وإلا يفضل "قيد التنفيذ"
        const srcOrderId = (plan as any)?.sourceOrderId;
        if (srcOrderId) {
          const siblings = await ctx.db
            .query("dailyPlans")
            .withIndex("by_source_order", (q: any) => q.eq("sourceOrderId", srcOrderId))
            .collect();
          const allDelivered = siblings.length > 0 && siblings.every(
            (p: any) => normalizeStatus(p.status) === "DELIVERED",
          );
          await advanceOrder(ctx, srcOrderId, allDelivered ? "completed" : "active");
        }
        await ctx.db.insert("notifications", {
          targetRole: "ADMIN",
          type: "MEAL_DELIVERED",
          title: "تم توصيل وجبات",
          message: `${customerName} - ${planDate}`,
          link: `/plans`,
          relatedId: id,
          isRead: false,
          createdAt: Date.now(),
        });
        // 🔔 إشعار للعميل بوصول وجباته
        if ((plan as any)?.customerId) {
          await ctx.db.insert("notifications", {
            targetCustomerId: (plan as any).customerId,
            type: "MEAL_DELIVERED",
            title: "تم توصيل وجباتك 🚚",
            message: `وصلت وجبات ${planDate} — بالهنا والشفا`,
            link: "/customer/profile",
            relatedId: id,
            isRead: false,
            createdAt: Date.now(),
          });
        }
      }
    }

    return { success: true, mealCountOverrideApproved: overrideApproved, expectedCount, actualCount };
  },
});

/**
 * ✅ تعليم وجبة واحدة داخل الخطة كـ"جاهزة" (تقدّم الشيف داخل الطلب) —
 *    مستقلّ عن حالة الخطة، فلا يخصم مخزوناً (الخصم يبقى مع PREPARED للخطة كلها).
 */
export const toggleItemPrepared = mutation({
  args: {
    id: v.id("dailyPlans"),
    itemIndex: v.number(),
    prepared: v.boolean(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { id, itemIndex, prepared, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const plan: any = await ctx.db.get(id);
    if (!plan) return { success: false };
    const items = Array.isArray(plan.items) ? [...plan.items] : [];
    if (itemIndex < 0 || itemIndex >= items.length) return { success: false };
    items[itemIndex] = { ...items[itemIndex], prepared };
    await ctx.db.patch(id, { items, updatedAt: Date.now() });
    return { success: true };
  },
});

/**
 * ✅ تعليم كل حصص طبق معيّن كجاهزة دفعة واحدة (batch من شاشة التجميع).
 *    الكلاينت يمرّر مواقع (planId + itemIndex) الناتجة عن تطبيع اسم الطبق.
 */
export const bulkToggleItemsPrepared = mutation({
  args: {
    locations: v.array(v.object({ planId: v.id("dailyPlans"), itemIndex: v.number() })),
    prepared: v.boolean(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { locations, prepared, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    // اجمع المواقع حسب الخطة لتقليل الكتابات
    const byPlan = new Map<string, number[]>();
    for (const loc of locations) {
      const k = String(loc.planId);
      if (!byPlan.has(k)) byPlan.set(k, []);
      byPlan.get(k)!.push(loc.itemIndex);
    }
    let updated = 0;
    for (const [planId, idxs] of byPlan) {
      const plan: any = await ctx.db.get(planId as any);
      if (!plan || !Array.isArray(plan.items)) continue;
      const items = [...plan.items];
      for (const i of idxs) {
        if (i >= 0 && i < items.length) { items[i] = { ...items[i], prepared }; updated++; }
      }
      await ctx.db.patch(planId as any, { items, updatedAt: Date.now() });
    }
    return { success: true, updated };
  },
});

/**
 * ✅ قائمة مكوّنات اليوم المجمّعة (mise-en-place) — تجمع كل مكوّنات وجبات اليوم
 *    (CONFIRMED + PREPARED، الفترتين) وتحوّلها لوحدة المخزون، فيعرف الشيف
 *    "محتاج كام كيلو دجاج، كام بيضة" بدل عدّ الأطباق فقط.
 */
export const todayIngredients = query({
  args: { date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { date, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const plans = (
      await ctx.db.query("dailyPlans").withIndex("by_date", (q) => q.eq("date", date)).collect()
    ).filter((p: any) => p.status === "CONFIRMED" || p.status === "PREPARED");

    // Canonical publicMealId → servings required today.
    const servings = new Map<string, { count: number; item: any }>();
    for (const p of plans as any[]) {
      for (const it of (Array.isArray(p.items) ? p.items : [])) {
        if (it?.isOff) continue;
        const mid = it?.publicMealId || it?.mealId || it?.menuItemId;
        if (!mid) continue;
        const key = `${it?.publicMealId || (!it?.menuItemId ? it?.mealId : "")}|${it?.menuItemId || ""}`;
        const current = servings.get(key);
        servings.set(key, { count: (current?.count || 0) + 1, item: it });
      }
    }

    // اجمع المكوّنات عبر كل الأطباق
    const agg = new Map<string, { name: string; unit: string; qty: number; low: boolean }>();
    for (const { count, item } of servings.values()) {
      const ings = await recipeForPlanItem(ctx, item);
      for (const ing of ings) {
        const inv: any = await ctx.db.get(ing.inventoryItemId);
        if (!inv) continue;
        const perServing = convertUnit(Number(ing.quantityPerServing), (ing as any).unit, inv.unit);
        const key = String(ing.inventoryItemId);
        const prev = agg.get(key) || { name: inv.nameAr || inv.nameEn || "-", unit: inv.unit, qty: 0, low: false };
        prev.qty += perServing * count;
        prev.low = (inv.currentStock || 0) < prev.qty; // المخزون الحالي لا يكفي احتياج اليوم
        agg.set(key, prev);
      }
    }

    return Array.from(agg.values())
      .map((x) => ({ ...x, qty: Math.round(x.qty * 100) / 100 }))
      .sort((a, b) => b.qty - a.qty);
  },
});

/**
 * اعتماد كل مسودّات يومٍ دفعةً واحدة (DRAFT → CONFIRMED فقط).
 * المخطِّط ينهي 90+ خطة ثم يصطاد المسودّتين المنسيّتين واحدة واحدة —
 * يوم 29-7 قال التخطيط 94 والمراجعة 92 ولم يعرف أحد أين الفارق.
 * لا يمسّ إلا DRAFT: الموقوف (PAUSED) والمؤكد وما بعده يبقون كما هم،
 * ولا يُعتمد ما لا وجبات فيه.
 */
export const confirmAllDrafts = mutation({
  args: { date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { date, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const plans = await ctx.db
      .query("dailyPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    let confirmed = 0, skippedEmpty = 0;
    for (const p of plans as any[]) {
      if (normalizeStatus(p.status) !== "DRAFT") continue;
      const activeItems = (Array.isArray(p.items) ? p.items : []).filter((item: any) => !item?.isOff);
      if (activeItems.length === 0) { skippedEmpty++; continue; }
      await ctx.db.patch(p._id, { status: "CONFIRMED" });
      confirmed++;
    }
    return { confirmed, skippedEmpty };
  },
});

export const remove = mutation({
  args: { id: v.id("dailyPlans"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    const staffD = await requireStaff(ctx, sessionToken);
    /* الحذف لا رجعة فيه: نلتقط ما يكفي للإجابة لاحقاً عن «أين ذهبت خطة فلان؟» */
    const gone: any = await ctx.db.get(id);
    const gc: any = gone?.customerId ? await ctx.db.get(gone.customerId) : null;
    await ctx.db.delete(id);
    await trail(ctx, {
      action: "PLAN_DELETED", entityType: "plan", entityId: String(id),
      details: `${gone?.date || "?"} — ${gc?.fullName || "?"} — ${gone?.status || "?"} — ${(gone?.items || []).length} وجبة`,
      staff: staffD as any,
    });
    return true;
  },
});
