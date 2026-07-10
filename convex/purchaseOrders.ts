// convex/purchaseOrders.ts
// أوامر الشراء — توليد من النواقص مجمّعة حسب المورّد + متابعة الحالة (هوية أدرينالين)
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";

export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db.query("purchaseOrders").collect();
    return rows.sort((a, z) => z.createdAt - a.createdAt);
  },
});

// يبني أوامر شراء مسودة من الأصناف الناقصة، مجمّعة حسب المورّد الافتراضي،
// ويعيد طلب كل صنف حتى مخزونه المستهدف بتكلفة آخر دفعة.
export const generateFromLowStock = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
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
        itemId: it._id,
        nameAr: it.nameAr,
        unit: it.unit,
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
    await requireStaff(ctx, args.sessionToken);
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

export const updateStatus = mutation({
  args: {
    id: v.id("purchaseOrders"),
    status: v.union(v.literal("DRAFT"), v.literal("SENT"), v.literal("RECEIVED"), v.literal("CANCELLED")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const patch: any = { status: args.status };
    if (args.status === "SENT") patch.sentAt = Date.now();
    if (args.status === "RECEIVED") patch.receivedAt = Date.now();
    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("purchaseOrders"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
