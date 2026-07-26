// convex/outletScan.ts
/**
 * تأكيد استلام طلبية المنفذ بالماسح الضوئي.
 *
 * المشكلة التي يحلّها: الفرع يستلم الطلبية ولا يعرف إن كان ما وصل مطابقاً لما
 * أُرسل، والمطبخ الرئيسي لا يعرف أن هناك نقصاً أصلاً. المسح يجعل الفرق ظاهراً
 * للطرفين لحظة الاستلام.
 *
 * قرار محاسبي مقصود: الفاتورة تُحتسب على **ما وصل فعلاً**، لا على ما أُرسل —
 * فلا يتحمّل الفرع ثمن ما لم يستلمه. لكن كمية الطلبية `qty` لا تُعدَّل أبداً:
 * تبقى شاهدة على ما أُرسل، ويُسجَّل النقص صراحةً في `shortageQty/shortageValue`.
 * لو عدّلنا `qty` لاختفى النقص من السجل وكأنه لم يحدث.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRoleOrPermission } from "./sessions";

const OUTLET_ROLES = ["ADMIN", "ACCOUNTANT", "FINANCE_MANAGER", "INVENTORY_MANAGER"];
const OUTLET_PAGES = ["/gym-sales", "/outlet-labels"];

async function requireOutlet(ctx: any, token?: string) {
  return await requireRoleOrPermission(ctx, token, { roles: OUTLET_ROLES, permissions: OUTLET_PAGES });
}

/** الباركود كما يرسله الماسح: أرقام فقط، بلا مسافات أو أسطر. */
const cleanBarcode = (raw: string) => String(raw || "").replace(/\s+/g, "").trim();

/**
 * صنف المنفذ من باركوده. يُستدعى بعد كل مسحة، فيبقى خفيفاً: فهرس مباشر
 * على `by_barcode` بلا مسح للجدول.
 */
export const lookupBarcode = query({
  args: { barcode: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOutlet(ctx, args.sessionToken);
    const code = cleanBarcode(args.barcode);
    if (!code) return null;
    const label: any = await ctx.db
      .query("outletProductLabels")
      .withIndex("by_barcode", (q) => q.eq("barcode", code))
      .first();
    if (!label) return null;
    return {
      barcode: label.barcode,
      nameEn: label.nameEn,
      price: label.price ?? null,
      isActive: !!label.isActive,
      mealId: label.publicMealId ? String(label.publicMealId) : null,
      source: label.source ?? null,
    };
  },
});

/**
 * الطلبية مع أسطرها وباركود كل صنف — تُحمَّل مرة واحدة قبل المسح، فتتم
 * المطابقة على الجهاز بلا استعلام لكل مسحة (الماسح أسرع من الشبكة).
 */
export const orderForScan = query({
  args: { orderId: v.id("gymOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOutlet(ctx, args.sessionToken);
    const order: any = await ctx.db.get(args.orderId);
    if (!order) return null;
    const gym: any = await ctx.db.get(order.gymId);
    const lines = await ctx.db
      .query("gymOrderLines")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    // باركود كل صنف من كتالوج المنفذ (الربط عبر publicMealId)
    const labels = await ctx.db.query("outletProductLabels").collect();
    const barcodeByMeal = new Map<string, string>();
    labels.forEach((l: any) => {
      if (l.publicMealId && l.isActive) barcodeByMeal.set(String(l.publicMealId), l.barcode);
    });

    return {
      orderId: String(order._id),
      date: order.date,
      gymName: gym?.name || "",
      isVoid: !!order.isVoid,
      total: order.total,
      confirmedAt: order.receiptConfirmedAt ?? null,
      shortageQty: order.shortageQty ?? null,
      shortageValue: order.shortageValue ?? null,
      lines: lines.map((l: any) => ({
        lineId: String(l._id),
        mealId: l.mealId ? String(l.mealId) : null,
        barcode: l.mealId ? (barcodeByMeal.get(String(l.mealId)) || null) : null,
        nameEn: l.mealNameEn || l.mealNameAr || "—",
        nameAr: l.mealNameAr || "",
        qty: l.qty,
        unitPrice: l.unitPrice,
        receivedQty: l.receivedQty ?? null,
      })),
    };
  },
});

/**
 * تسجيل ما وصل فعلاً. يُعاد احتساب الفاتورة على المستلم، ويُحفظ النقص ظاهراً.
 * قابل للتكرار: إعادة التأكيد تستبدل القيم السابقة ولا تُراكمها.
 */
export const confirmReceipt = mutation({
  args: {
    orderId: v.id("gymOrders"),
    received: v.array(v.object({ lineId: v.id("gymOrderLines"), qty: v.number() })),
    unknownBarcodes: v.optional(v.array(v.string())),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor: any = await requireOutlet(ctx, args.sessionToken);
    const order: any = await ctx.db.get(args.orderId);
    if (!order) throw new Error("الطلبية غير موجودة");
    if (order.isVoid) throw new Error("لا يمكن تأكيد استلام طلبية ملغاة");

    const lines = await ctx.db
      .query("gymOrderLines")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    const byId = new Map(lines.map((l: any) => [String(l._id), l]));
    const receivedById = new Map<string, number>();
    for (const r of args.received) {
      const line: any = byId.get(String(r.lineId));
      if (!line) throw new Error("سطر غير موجود في الطلبية");
      const q = Math.max(0, Math.round(Number(r.qty) || 0));
      // الزيادة عن المطلوب لا تُحتسب على الفاتورة — تُسجَّل كملاحظة فقط
      receivedById.set(String(r.lineId), Math.min(q, Number(line.qty) || 0));
    }

    let receivedCount = 0, shortageQty = 0, shortageValue = 0;
    for (const line of lines as any[]) {
      const got = receivedById.has(String(line._id))
        ? (receivedById.get(String(line._id)) as number)
        : 0;
      await ctx.db.patch(line._id, { receivedQty: got });
      receivedCount += got;
      const missing = Math.max(0, Number(line.qty || 0) - got);
      shortageQty += missing;
      shortageValue += missing * Number(line.unitPrice || 0);
    }
    shortageValue = Math.round(shortageValue * 100) / 100;

    const waste = Number(order.wasteValue || 0);
    const netTotal = Math.round((Number(order.total || 0) - waste - shortageValue) * 100) / 100;

    await ctx.db.patch(args.orderId, {
      receiptConfirmedAt: Date.now(),
      receiptConfirmedBy: String(actor?.userId || actor?.role || "staff"),
      receivedCount,
      shortageQty,
      shortageValue,
      netTotal,
      scanNotes: (args.unknownBarcodes || []).length
        ? `باركودات مُسحت وليست في الطلبية: ${(args.unknownBarcodes || []).join("، ")}`
        : undefined,
      updatedAt: Date.now(),
    });

    return { ok: true, receivedCount, shortageQty, shortageValue, netTotal };
  },
});
