/**
 * @file convex/dailyPlans.ts
 * @description Convex functions للخطط اليومية
 * @frontend client/src/pages/Plans.tsx, client/src/pages/Kitchen.tsx, client/src/pages/Delivery.tsx, client/src/pages/Dashboard.tsx
 */
import { mutation, query } from "./_generated/server";
import { convertUnit } from "./units";
import { v } from "convex/values";

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
  return safe;
}

export const list = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    if (date) {
      return await ctx.db
        .query("dailyPlans")
        .withIndex("by_date", (q) => q.eq("date", date))
        .collect();
    }
    return await ctx.db.query("dailyPlans").order("desc").collect();
  },
});

export const getByDateAndCustomer = query({
  args: {
    date: v.string(),
    customerId: v.id("customers"),
  },
  handler: async (ctx, { date, customerId }) => {
    const plans = await ctx.db
      .query("dailyPlans")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    return plans.find((p) => String(p.customerId) === String(customerId)) || null;
  },
});

export const get = query({
  args: { id: v.id("dailyPlans") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
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
  },
  handler: async (ctx, args) => {
    const requested = normalizeStatus(args.status);

    const safeStatus: PlanStatus =
      requested === "PREPARED" || requested === "DELIVERED"
        ? "CONFIRMED"
        : requested;

    return await ctx.db.insert("dailyPlans", {
      ...args,
      status: safeStatus,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("dailyPlans"),
    data: v.any(),
  },
  handler: async (ctx, { id, data }) => {
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

    const safe = stripSystemFields(data || {});
    safe.status = finalStatus;

    await ctx.db.patch(id, safe);

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
              const menuItemId = it?.menuItemId || it?.mealId;
              if (!menuItemId) continue;
              const ingredients = await ctx.db
                .query("mealIngredients")
                .withIndex("by_menuItem", (q) => q.eq("menuItemId", menuItemId))
                .collect();

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

    return true;
  },
});

export const remove = mutation({
  args: { id: v.id("dailyPlans") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return true;
  },
});
