// convex/purchaseOrders.ts
// أوامر الشراء — مؤمّنة: إنشاء/تعديل حالة → INVENTORY_MANAGER أو ADMIN، الحذف → ADMIN.
// RECEIVED ينشئ دفعات مخزون تلقائياً (لا يُترك المخزون منفصلاً عن الشراء).
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff, requireAdmin, requireRole } from "./sessions";

const PO_MANAGE_ROLES = ["INVENTORY_MANAGER"]; // ADMIN تلقائي

export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db.query("purchaseOrders").collect();
    return rows.sort((a, z) => z.createdAt - a.createdAt);
  },
});

export const generateFromLowStock = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, PO_MANAGE_ROLES); // 🔒
    const items = await ctx.db.query("inventoryItems").collect();
    const low = items.filter((it) => Number(it.currentStock) <= Number(it.minStock));
    if (!low.length) return { count: 0, created: [] as string[] };

    const batches = await ctx.db.query("inventoryBatches").collect();
    const costMap = new Map<string, number>();
    for (const b of batches.sort((a, z) => String(a.receivedAt).localeCompare(String(z.receivedAt)))) {
      costMap.set(b.itemId, Number(b.unitCost || 0));
    }
    const suppliers = await ctx.db.query("suppliers").collect();
    const supName = new Map(suppliers.map((s) => [s._id, s.name]));

    const groups = new Map<string, any[]>();
    for (const it of low) {
      const sid = it.supplierId ?? "__none__";
      if (!groups.has(sid)) groups.set(sid, []);
      const target = Number(it.targetStock) || Number(it.minStock) || 0;
      const qty = Math.max(0, target - Number(it.currentStock || 0)) || Number(it.minStock) || 1;
      const cost = costMap.get(it._id) || 0;
      groups.get(sid)!.push({
        itemId: it._id, nameAr: it.nameAr, unit: it.unit,
        quantity: Math.round(qty * 100) / 100,
        estUnitCost: cost,
        estLineCost: Math.round(qty * cost * 100) / 100,
      });
    }

    const now = Date.now();
    const created: string[] = [];
    for (const [sid, poItems] of Array.from(groups.entries())) {
      const totalEst = poItems.reduce((s: number, i: any) => s + i.estLineCost, 0);
      const id = await ctx.db.insert("purchaseOrders", {
        supplierId: sid === "__none__" ? undefined : (sid as any),
        supplierName: sid === "__none__" ? undefined : (supName.get(sid as any) || undefined),
        status: "DRAFT",
        items: poItems,
        totalEst: Math.round(totalEst * 100) / 100,
        createdAt: now,
      });
      created.push(id);
    }
    return { count: created.length, created };
  },
});

export const create = mutation({
  args: {
    supplierId: v.optional(v.id("suppliers")),
    supplierName: v.optional(v.string()),
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
    note: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, PO_MANAGE_ROLES); // 🔒
    // 🔒 التحقق من صحة الكميات والتكاليف
    for (const it of args.items) {
      if (it.quantity <= 0) throw new Error("الكمية لازم تكون أكبر من صفر");
      if (it.estUnitCost < 0) throw new Error("التكلفة لا يمكن أن تكون سالبة");
    }
    const totalEst = (args.items || []).reduce((s, i) => s + Number(i.estLineCost || 0), 0);
    return await ctx.db.insert("purchaseOrders", {
      supplierId: args.supplierId,
      supplierName: args.supplierName,
      status: "DRAFT",
      items: args.items,
      totalEst: Math.round(totalEst * 100) / 100,
      note: args.note,
      createdAt: Date.now(),
    });
  },
});

/**
 * 🔒 تحديث الحالة — INVENTORY_MANAGER أو ADMIN.
 * عند RECEIVED: ينشئ inventoryBatches ويحدّث currentStock تلقائياً (استلام فعلي).
 * لا يُسمح بالرجوع من RECEIVED إلى حالة أدنى.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("purchaseOrders"),
    status: v.union(v.literal("DRAFT"), v.literal("SENT"), v.literal("RECEIVED"), v.literal("CANCELLED")),
    receivedAt: v.optional(v.string()), // yyyy-MM-dd — اختياري، افتراضي اليوم
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, PO_MANAGE_ROLES);
    const po: any = await ctx.db.get(args.id);
    if (!po) throw new Error("أمر الشراء غير موجود");
    if (po.status === "RECEIVED" && args.status !== "RECEIVED") {
      throw new Error("لا يمكن الرجوع من حالة RECEIVED — لأن الدفعات دخلت المخزون");
    }
    if (po.status === "CANCELLED" && args.status !== "CANCELLED") {
      throw new Error("لا يمكن إعادة تفعيل أمر شراء ملغى");
    }
    const patch: any = { status: args.status };
    if (args.status === "SENT" && !po.sentAt) patch.sentAt = Date.now();

    if (args.status === "RECEIVED" && po.status !== "RECEIVED") {
      const now = Date.now();
      const receivedAt = args.receivedAt || new Date().toISOString().slice(0, 10);
      patch.receivedAt = now;
      // 🔒 ننشئ دفعات مخزون من كل سطر — الشراء والمخزون ما بيبقوش منفصلين
      for (const line of (po.items || [])) {
        const qty = Number(line.quantity) || 0;
        if (qty <= 0) continue;
        const item: any = await ctx.db.get(line.itemId);
        if (!item) continue;
        const batchId = await ctx.db.insert("inventoryBatches", {
          itemId: line.itemId,
          quantityReceived: qty,
          quantityRemaining: qty,
          unitCost: Number(line.estUnitCost) || 0,
          supplierId: po.supplierId,
          receivedAt,
          notes: `PO#${String(args.id).slice(-6)}`,
        });
        await ctx.db.insert("inventoryMovements", {
          itemId: line.itemId,
          type: "receive",
          quantity: qty,
          unitCost: Number(line.estUnitCost) || 0,
          supplierId: po.supplierId,
          batchId,
          note: `استلام من أمر شراء`,
          createdAt: now,
        });
        await ctx.db.patch(line.itemId, {
          currentStock: (item.currentStock || 0) + qty,
          updatedAt: now,
        });
      }
    }
    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

/** 🔒 الحذف — ADMIN فقط + رفض حذف الأوامر المستلمة (تفقد أثر مخزني). */
export const remove = mutation({
  args: { id: v.id("purchaseOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const po: any = await ctx.db.get(args.id);
    if (!po) return { success: true };
    if (po.status === "RECEIVED") {
      throw new Error("لا يمكن حذف أمر مستلم — سيؤدي لفقدان أثر المخزون. ألغه بحالة CANCELLED بديلاً.");
    }
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
