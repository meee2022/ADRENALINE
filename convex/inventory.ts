// convex/inventory.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { isWithinSubscription } from "./lib/subscriptionPeriods";
import { convertUnit } from "./units";
import { requireStaff, requireAdmin, requireRole } from "./sessions";
import { dayNameOf, rotationWeekAtDate } from "./lib/dates";
import { autoPostInventoryMovement, autoPostInventoryReceipt } from "./financePost";

async function fifoValue(ctx: any, itemId: Id<"inventoryItems">, quantity: number) {
  const batches = await ctx.db.query("inventoryBatches")
    .withIndex("by_itemId", (q: any) => q.eq("itemId", itemId)).collect();
  batches.sort((a: any, b: any) => a.receivedAt.localeCompare(b.receivedAt));
  let remaining = Math.abs(quantity);
  let value = 0;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const used = Math.min(Number(batch.quantityRemaining || 0), remaining);
    value += used * Number(batch.unitCost || 0);
    remaining -= used;
  }
  if (remaining > 0) {
    const priced = batches.filter((batch: any) => Number(batch.unitCost || 0) > 0);
    const fallback = priced.length ? Number(priced[priced.length - 1].unitCost) : 0;
    value += remaining * fallback;
  }
  return Math.round(value * 100) / 100;
}

// 🔒 صلاحيات المخزون — منفصلة عن staff العام
const INV_MANAGE_ROLES = ["INVENTORY_MANAGER"];   // استلام/استهلاك/تسوية/هالك (ADMIN تلقائي)
// إدارة الأصناف والموردين والاستلام الجماعي → ADMIN فقط (قرار مالي)

// ينشئ إشعار "مخزون منخفض" لمدير المخزون عند هبوط الصنف للحد الأدنى — بدون تكرار
async function maybeLowStockAlert(ctx: any, itemId: Id<"inventoryItems">, newStock: number) {
  const item = await ctx.db.get(itemId);
  if (!item || newStock > item.minStock) return;
  // تجنّب التكرار: لو فيه إشعار غير مقروء بالفعل لنفس الصنف
  const unread = await ctx.db
    .query("notifications")
    .withIndex("by_targetRole", (q: any) => q.eq("targetRole", "INVENTORY_MANAGER").eq("isRead", false))
    .collect();
  if (unread.some((n: any) => n.type === "LOW_STOCK" && n.relatedId === String(itemId))) return;
  const isOut = newStock <= 0;
  await ctx.db.insert("notifications", {
    targetRole: "INVENTORY_MANAGER",
    type: "LOW_STOCK",
    title: isOut ? "نفد المخزون" : "مخزون منخفض",
    message: isOut
      ? `${item.nameAr} نفد تماماً — يجب إعادة الطلب`
      : `${item.nameAr} وصل إلى ${newStock} ${item.unit} (الحد الأدنى ${item.minStock})`,
    relatedId: String(itemId),
    link: `/inventory/alerts`,
    isRead: false,
    createdAt: Date.now(),
  });
}

// عند ترصيع الصنف فوق الحد الأدنى، أغلق إشعارات النقص المفتوحة له تلقائياً
async function resolveLowStock(ctx: any, itemId: Id<"inventoryItems">, newStock: number) {
  const item = await ctx.db.get(itemId);
  if (!item || newStock <= item.minStock) return;
  const unread = await ctx.db
    .query("notifications")
    .withIndex("by_targetRole", (q: any) => q.eq("targetRole", "INVENTORY_MANAGER").eq("isRead", false))
    .collect();
  for (const n of unread) {
    if (n.type === "LOW_STOCK" && n.relatedId === String(itemId)) {
      await ctx.db.patch(n._id, { isRead: true, readAt: Date.now() });
    }
  }
}

// ===== QUERIES =====

// Get all inventory items with search and filter
export const listItems = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    lowStock: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let items = await ctx.db.query("inventoryItems").collect();

    // Search by name or barcode
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      items = items.filter(
        (item) =>
          item.nameAr.toLowerCase().includes(searchLower) ||
          item.nameEn?.toLowerCase().includes(searchLower) ||
          item.barcode?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by category
    if (args.category && args.category !== "all") {
      items = items.filter((item) => item.category === args.category);
    }

    // Filter low stock
    if (args.lowStock) {
      items = items.filter((item) => item.currentStock <= item.minStock);
    }

    // Sort by name
    items.sort((a, b) => a.nameAr.localeCompare(b.nameAr));

    return items;
  },
});

// Alias for compatibility
export const list = listItems;

// Get single item by ID
export const getItemById = query({
  args: { id: v.id("inventoryItems"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.db.get(args.id);
  },
});

// Get item by barcode
export const getItemByBarcode = query({
  args: { barcode: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const item = await ctx.db
      .query("inventoryItems")
      .withIndex("by_barcode", (q) => q.eq("barcode", args.barcode))
      .first();
    
    if (!item) {
      return { found: false, barcode: args.barcode };
    }
    
    return { found: true, item };
  },
});

// Get summary KPIs
export const getSummary = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const items = await ctx.db.query("inventoryItems").collect();
    const batches = await ctx.db.query("inventoryBatches").collect();

    // Total items count
    const totalItems = items.length;

    // Low stock count (current_stock <= min_stock)
    const lowStockCount = items.filter(
      (item) => item.currentStock <= item.minStock
    ).length;

    // Expiring soon count (within 3 days)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

    const expiringSoonCount = batches.filter((batch) => {
      if (!batch.expiryDate || batch.quantityRemaining <= 0) return false;
      return batch.expiryDate <= threeDaysStr;
    }).length;

    // Stock value (QAR)
    const stockValue = batches.reduce(
      (sum, batch) => sum + batch.quantityRemaining * batch.unitCost,
      0
    );

    return {
      totalItems,
      lowStockCount,
      expiringSoonCount,
      stockValue: Math.round(stockValue),
    };
  },
});

// Alerts: low-stock (reorder) + expiring-soon + expired batches
export const getAlerts = query({
  args: { days: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const days = args.days ?? 7;
    const today = new Date().toISOString().split("T")[0];
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);
    const horizonStr = horizon.toISOString().split("T")[0];

    const items = await ctx.db.query("inventoryItems").collect();
    const batches = await ctx.db.query("inventoryBatches").collect();
    const itemMap = new Map(items.map((i) => [i._id, i]));

    const lowStock = items
      .filter((it) => Number(it.currentStock) <= Number(it.minStock))
      .map((it) => {
        const target = Number(it.targetStock) || Number(it.minStock) || 0;
        return {
          itemId: it._id,
          nameAr: it.nameAr,
          nameEn: it.nameEn,
          unit: it.unit,
          currentStock: Number(it.currentStock || 0),
          minStock: Number(it.minStock || 0),
          reorderQty: Math.max(0, target - Number(it.currentStock || 0)),
          isOut: Number(it.currentStock || 0) <= 0,
          deficit: Number(it.minStock || 0) - Number(it.currentStock || 0),
        };
      })
      .sort((a, b) => b.deficit - a.deficit);

    const active = batches.filter(
      (b) => b.expiryDate && Number(b.quantityRemaining) > 0
    );
    const mapBatch = (b: any) => {
      const inv = itemMap.get(b.itemId);
      const qty = Number(b.quantityRemaining || 0);
      const unitCost = Number(b.unitCost || 0);
      const daysLeft = Math.round(
        (new Date(b.expiryDate).getTime() - new Date(today).getTime()) / 86400000
      );
      return {
        batchId: b._id,
        itemId: b.itemId,
        nameAr: inv?.nameAr || "—",
        nameEn: inv?.nameEn,
        unit: inv?.unit || "",
        quantity: qty,
        value: Math.round(qty * unitCost * 100) / 100,
        expiryDate: b.expiryDate,
        daysLeft,
      };
    };
    const expiring = active
      .filter((b) => b.expiryDate! > today && b.expiryDate! <= horizonStr)
      .map(mapBatch)
      .sort((a, z) => a.daysLeft - z.daysLeft);
    const expired = active
      .filter((b) => b.expiryDate! <= today)
      .map(mapBatch)
      .sort((a, z) => a.daysLeft - z.daysLeft);
    const atRiskValue = [...expiring, ...expired].reduce((s, b) => s + b.value, 0);

    return {
      days,
      lowStock,
      expiring,
      expired,
      counts: {
        lowStock: lowStock.length,
        outOfStock: lowStock.filter((l) => l.isOut).length,
        expiring: expiring.length,
        expired: expired.length,
        total: lowStock.length + expiring.length + expired.length,
      },
      atRiskValue: Math.round(atRiskValue * 100) / 100,
    };
  },
});

// Get batches for an item
export const getBatchesByItem = query({
  args: { itemId: v.id("inventoryItems"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const batches = await ctx.db
      .query("inventoryBatches")
      .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
      .collect();

    // Sort by received date (newest first)
    batches.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

    return batches;
  },
});

// Get movements for an item
export const getMovementsByItem = query({
  args: { itemId: v.id("inventoryItems"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let movements = await ctx.db
      .query("inventoryMovements")
      .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
      .collect();

    // Sort by creation time (newest first)
    movements.sort((a, b) => b.createdAt - a.createdAt);

    // Limit results
    if (args.limit) {
      movements = movements.slice(0, args.limit);
    }

    return movements;
  },
});

// Get all suppliers
export const getSuppliers = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const suppliers = await ctx.db.query("suppliers").collect();
    suppliers.sort((a, b) => a.name.localeCompare(b.name));
    return suppliers;
  },
});

// ===== MUTATIONS =====

// Create new item
export const createItem = mutation({
  args: {
    barcode: v.optional(v.string()),
    nameAr: v.string(),
    nameEn: v.optional(v.string()),
    category: v.string(),
    unit: v.string(),
    sku: v.optional(v.string()),
    itemType: v.optional(v.string()),
    purchaseUnit: v.optional(v.string()),
    purchaseToBaseFactor: v.optional(v.number()),
    defaultLocationId: v.optional(v.id("inventoryLocations")),
    notes: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    minStock: v.number(),
    targetStock: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken); // 🔒 إنشاء صنف = قرار مالي
    // Check if barcode already exists
    if (args.barcode) {
      const existing = await ctx.db
        .query("inventoryItems")
        .withIndex("by_barcode", (q) => q.eq("barcode", args.barcode!))
        .first();
      if (existing) {
        throw new Error("Barcode already exists");
      }
    }

    const now = Date.now();
    const itemId = await ctx.db.insert("inventoryItems", {
      barcode: args.barcode,
      nameAr: args.nameAr,
      nameEn: args.nameEn,
      category: args.category,
      unit: args.unit,
      sku: args.sku,
      itemType: args.itemType || "ingredient",
      purchaseUnit: args.purchaseUnit,
      purchaseToBaseFactor: args.purchaseToBaseFactor,
      defaultLocationId: args.defaultLocationId,
      notes: args.notes,
      supplierId: args.supplierId,
      minStock: args.minStock,
      targetStock: args.targetStock,
      currentStock: 0,
      avgWeeklyUsage: 0,
      createdAt: now,
      updatedAt: now,
    });

    return itemId;
  },
});

// Update item
export const updateItem = mutation({
  args: {
    id: v.id("inventoryItems"),
    barcode: v.optional(v.string()),
    nameAr: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    category: v.optional(v.string()),
    unit: v.optional(v.string()),
    sku: v.optional(v.string()),
    itemType: v.optional(v.string()),
    purchaseUnit: v.optional(v.string()),
    purchaseToBaseFactor: v.optional(v.number()),
    defaultLocationId: v.optional(v.id("inventoryLocations")),
    notes: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    minStock: v.optional(v.number()),
    targetStock: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken); // 🔒 تعديل الحد الأدنى/المستهدف يؤثر على قرارات الشراء
    // ⚠️ sessionToken يُستبعد من الـrest-spread وإلا خُزِّن داخل الوثيقة
    const { id, sessionToken: _t, ...updates } = args;

    // Check if barcode already exists (excluding current item)
    if (updates.barcode) {
      const existing = await ctx.db
        .query("inventoryItems")
        .withIndex("by_barcode", (q) => q.eq("barcode", updates.barcode!))
        .first();
      if (existing && existing._id !== id) {
        throw new Error("Barcode already exists");
      }
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

// Receive stock (add batch + movement + update current stock)
export const receiveStock = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    quantity: v.number(),
    unitCost: v.number(),
    supplierId: v.optional(v.id("suppliers")),
    expiryDate: v.optional(v.string()),
    lotNumber: v.optional(v.string()),
    locationId: v.optional(v.id("inventoryLocations")),
    receivedAt: v.string(),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, INV_MANAGE_ROLES); // 🔒 مدير مخزون أو ADMIN
    if (args.quantity <= 0) {
      throw new Error("Quantity must be positive");
    }
    if (args.unitCost < 0) throw new Error("التكلفة لا يمكن أن تكون سالبة");

    // Get current item
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    const now = Date.now();

    // Create batch
    const batchId = await ctx.db.insert("inventoryBatches", {
      itemId: args.itemId,
      quantityReceived: args.quantity,
      quantityRemaining: args.quantity,
      unitCost: args.unitCost,
      supplierId: args.supplierId,
      expiryDate: args.expiryDate,
      lotNumber: args.lotNumber,
      locationId: args.locationId || item.defaultLocationId,
      receivedAt: args.receivedAt,
      notes: args.notes,
    });

    // Create movement
    await ctx.db.insert("inventoryMovements", {
      itemId: args.itemId,
      type: "receive",
      quantity: args.quantity,
      unitCost: args.unitCost,
      supplierId: args.supplierId,
      batchId,
      locationId: args.locationId || item.defaultLocationId,
      note: args.notes,
      createdAt: now,
    });

    // Update current stock
    await ctx.db.patch(args.itemId, {
      currentStock: item.currentStock + args.quantity,
      updatedAt: now,
    });

    return batchId;
  },
});

// Consume stock (for kitchen usage)
export const consumeStock = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    quantity: v.number(),
    note: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, INV_MANAGE_ROLES); // 🔒
    if (args.quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    // Get current item
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    if (item.currentStock < args.quantity) {
      throw new Error("Insufficient stock");
    }

    const now = Date.now();

    const movementValue = await fifoValue(ctx, args.itemId, args.quantity);
    // Create movement
    const movementId = await ctx.db.insert("inventoryMovements", {
      itemId: args.itemId,
      type: "consume",
      quantity: -args.quantity,
      note: args.note,
      createdAt: now,
    });

    // Update current stock
    const newStock = item.currentStock - args.quantity;
    await ctx.db.patch(args.itemId, {
      currentStock: newStock,
      updatedAt: now,
    });
    await maybeLowStockAlert(ctx, args.itemId, newStock);

    // Deduct from batches (FIFO - First In First Out)
    let remaining = args.quantity;
    const batches = await ctx.db
      .query("inventoryBatches")
      .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
      .collect();

    // Sort by received date (oldest first for FIFO)
    batches.sort((a: any, b: any) => a.receivedAt.localeCompare(b.receivedAt));

    for (const batch of batches) {
      if (remaining <= 0) break;
      if (batch.quantityRemaining <= 0) continue;

      const toDeduct = Math.min(batch.quantityRemaining, remaining);
      await ctx.db.patch(batch._id, {
        quantityRemaining: batch.quantityRemaining - toDeduct,
      });
      remaining -= toDeduct;
    }

    await autoPostInventoryMovement(ctx, {
      movementId,
      date: new Date(now).toISOString().slice(0, 10),
      amount: movementValue,
      kind: "consume",
      quantity: -args.quantity,
      itemId: args.itemId,
    });

    return { success: true };
  },
});

// Adjust stock (manual correction)
export const adjustStock = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    newQuantity: v.number(),
    note: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, INV_MANAGE_ROLES); // 🔒 التسويات = مدير مخزون أو ADMIN
    if (args.newQuantity < 0) {
      throw new Error("Quantity cannot be negative");
    }
    if (!args.note || args.note.trim().length < 3) {
      throw new Error("سبب التسوية مطلوب (3 أحرف أو أكثر)"); // 🔒 لا تسوية بدون سبب
    }

    // Get current item
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    const difference = args.newQuantity - item.currentStock;
    const now = Date.now();

    const movementValue = await fifoValue(ctx, args.itemId, Math.abs(difference));
    // Create movement
    const movementId = await ctx.db.insert("inventoryMovements", {
      itemId: args.itemId,
      type: "adjust",
      quantity: difference,
      note: args.note,
      createdAt: now,
    });

    // Update current stock
    await ctx.db.patch(args.itemId, {
      currentStock: args.newQuantity,
      updatedAt: now,
    });

    await autoPostInventoryMovement(ctx, {
      movementId,
      date: new Date(now).toISOString().slice(0, 10),
      amount: movementValue,
      kind: "adjust",
      quantity: difference,
      itemId: args.itemId,
    });

    return { success: true };
  },
});

// ⛔ seedWasteDemo — دالة تجريبية. مقفولة على ADMIN فقط لمنع تلويث بيانات الإنتاج.
//    تُبقى للاستخدام في بيئة اختبار مبدئية؛ في الإنتاج لا يُستدعى إطلاقاً.
export const seedWasteDemo = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken); // 🔒 ADMIN فقط (كان requireStaff)
    const now = Date.now();
    const items = (await ctx.db.query("inventoryItems").collect()).slice(0, 6);
    if (items.length === 0) throw new Error("لا توجد أصناف في المخزون — أضف أصناف أولاً");
    const costs = [18, 55, 42, 8, 12, 15];
    const reasons = ["تالف", "انتهت الصلاحية", "انسكاب", "خطأ تحضير"];
    let n = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const cost = costs[i % costs.length];
      // a priced opening batch (so the report has a unit cost)
      await ctx.db.insert("inventoryBatches", {
        itemId: it._id,
        quantityReceived: 60,
        quantityRemaining: 60,
        unitCost: cost,
        receivedAt: new Date(now - 9 * 86400000).toISOString().slice(0, 10),
        notes: "دفعة تجريبية",
      });
      // kitchen consumption
      await ctx.db.insert("inventoryMovements", {
        itemId: it._id, type: "consume", quantity: -(3 + i),
        note: "استهلاك المطبخ", createdAt: now - (i + 1) * 86400000,
      });
      // waste
      await ctx.db.insert("inventoryMovements", {
        itemId: it._id, type: "consume", quantity: -(0.5 + i * 0.3),
        note: `هالك: ${reasons[i % reasons.length]}`, createdAt: now - (i + 2) * 86400000,
      });
      n++;
    }
    return { seededItems: n };
  },
});

// ===== Record waste (الهالك) — deduct stock + log a consume movement tagged "هالك" =====
export const recordWaste = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    quantity: v.number(),
    reason: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, INV_MANAGE_ROLES); // 🔒
    if (args.quantity <= 0) throw new Error("الكمية يجب أن تكون أكبر من صفر");
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("الصنف غير موجود");
    // 🔒 لا يُسمح بتسجيل هالك أكبر من الرصيد — يمنع عدم اتساق الحركة مع الرصيد
    if (args.quantity > item.currentStock) {
      throw new Error(`الكمية (${args.quantity}) أكبر من الرصيد المتاح (${item.currentStock}) — عدّل الرصيد بتسوية أولاً`);
    }
    const now = Date.now();
    const newStock = item.currentStock - args.quantity; // معروف إنه ≥ 0 بعد التحقق أعلاه
    const movementValue = await fifoValue(ctx, args.itemId, args.quantity);
    const movementId = await ctx.db.insert("inventoryMovements", {
      itemId: args.itemId,
      type: "consume",
      quantity: -args.quantity,
      note: `هالك: ${args.reason || "غير محدد"}`,
      createdAt: now,
    });
    await ctx.db.patch(args.itemId, { currentStock: newStock, updatedAt: now });
    await maybeLowStockAlert(ctx, args.itemId, newStock);
    await resolveLowStock(ctx, args.itemId, newStock);
    // FIFO batch deduct
    let remaining = args.quantity;
    const batches = await ctx.db
      .query("inventoryBatches")
      .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
      .collect();
    batches.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    for (const b of batches) {
      if (remaining <= 0) break;
      if (b.quantityRemaining <= 0) continue;
      const d = Math.min(b.quantityRemaining, remaining);
      await ctx.db.patch(b._id, { quantityRemaining: b.quantityRemaining - d });
      remaining -= d;
    }
    await autoPostInventoryMovement(ctx, {
      movementId,
      date: new Date(now).toISOString().slice(0, 10),
      amount: movementValue,
      kind: "waste",
      quantity: -args.quantity,
      itemId: args.itemId,
    });
    return { success: true, newStock };
  },
});

// ===== Consumption & waste report (kitchen vs waste, with cost from latest batch) =====
export const getConsumptionReport = query({
  args: { days: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const days = args.days ?? 30;
    const since = Date.now() - days * 86400000;
    const movements = (await ctx.db.query("inventoryMovements").collect()).filter(
      (m) => m.type === "consume" && m.createdAt >= since,
    );
    const items = await ctx.db.query("inventoryItems").collect();
    const itemMap = new Map(items.map((i) => [i._id, i]));
    const batches = await ctx.db.query("inventoryBatches").collect();
    const costMap = new Map<string, number>();
    for (const b of batches.sort((a, z) => String(a.receivedAt).localeCompare(String(z.receivedAt)))) {
      costMap.set(b.itemId, b.unitCost ?? 0); // last write = latest
    }
    let kitchenQty = 0, wasteQty = 0, totalWasteValue = 0, totalConsumedValue = 0;
    const perItem: Record<string, any> = {};
    const byReason: Record<string, { qty: number; value: number }> = {};
    for (const m of movements) {
      const qty = Math.abs(m.quantity || 0);
      const note = typeof m.note === "string" ? m.note : "";
      const isWaste = note.startsWith("هالك");
      const inv = itemMap.get(m.itemId);
      const unitCost = costMap.get(m.itemId) || 0;
      const value = qty * unitCost;
      const key = m.itemId as string;
      if (!perItem[key])
        perItem[key] = { itemId: key, nameAr: inv?.nameAr || "—", unit: inv?.unit || "", unitCost, consumed: 0, wasted: 0, consumedCost: 0, wastedCost: 0 };
      if (isWaste) {
        wasteQty += qty; totalWasteValue += value;
        perItem[key].wasted += qty; perItem[key].wastedCost += value;
        const r = note.replace(/^هالك:\s*/, "").trim() || "غير محدد";
        if (!byReason[r]) byReason[r] = { qty: 0, value: 0 };
        byReason[r].qty += qty; byReason[r].value += value;
      } else {
        kitchenQty += qty; totalConsumedValue += value;
        perItem[key].consumed += qty; perItem[key].consumedCost += value;
      }
    }
    const wastePct = kitchenQty + wasteQty > 0 ? Math.round((wasteQty / (kitchenQty + wasteQty)) * 100) : 0;
    return {
      days,
      totalConsumed: kitchenQty,
      totalWasted: wasteQty,
      totalWasteValue: Math.round(totalWasteValue * 100) / 100,
      totalConsumedValue: Math.round(totalConsumedValue * 100) / 100,
      wastePct,
      byReason: Object.entries(byReason).map(([reason, v2]) => ({ reason, ...v2 })).sort((a, b) => b.value - a.value),
      perItem: Object.values(perItem).sort((a: any, b: any) => b.wastedCost - a.wastedCost),
    };
  },
});

// ===== Bulk receive (purchase invoice) — add many items to stock at once =====
export const receiveMany = mutation({
  args: {
    supplierId: v.optional(v.id("suppliers")),
    receivedAt: v.string(),
    invoiceNo: v.optional(v.string()),
    lines: v.array(
      v.object({
        itemId: v.optional(v.id("inventoryItems")),
        newItem: v.optional(
          v.object({
            nameAr: v.string(),
            nameEn: v.optional(v.string()),
            category: v.string(),
            unit: v.string(),
            minStock: v.optional(v.number()),
            targetStock: v.optional(v.number()),
          }),
        ),
        quantity: v.number(),
        unitCost: v.number(),
        quantityInPurchaseUnit: v.optional(v.boolean()),
        expiryDate: v.optional(v.string()),
        lotNumber: v.optional(v.string()),
        locationId: v.optional(v.id("inventoryLocations")),
      }),
    ),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.sessionToken); // 🔒 استلام جماعي = فاتورة مالية → ADMIN
    const now = Date.now();
    const note = args.invoiceNo ? `فاتورة: ${args.invoiceNo}` : "استلام بضاعة";
    let count = 0, totalQty = 0, totalCost = 0;
    for (const line of args.lines) {
      if (!line.quantity || line.quantity <= 0) continue;
      let itemId = line.itemId;
      if (!itemId && line.newItem) {
        itemId = await ctx.db.insert("inventoryItems", {
          nameAr: line.newItem.nameAr,
          nameEn: line.newItem.nameEn,
          category: line.newItem.category,
          unit: line.newItem.unit,
          supplierId: args.supplierId,
          minStock: line.newItem.minStock ?? 0,
          targetStock: line.newItem.targetStock ?? line.quantity,
          currentStock: 0,
          avgWeeklyUsage: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (!itemId) continue;
      const item = await ctx.db.get(itemId);
      if (!item) continue;
      const factor = line.quantityInPurchaseUnit ? Math.max(0.000001, item.purchaseToBaseFactor || 1) : 1;
      const qty = line.quantity * factor;
      const baseUnitCost = line.quantityInPurchaseUnit ? line.unitCost / factor : line.unitCost;
      const batchId = await ctx.db.insert("inventoryBatches", {
        itemId,
        quantityReceived: qty,
        quantityRemaining: qty,
        unitCost: baseUnitCost,
        supplierId: args.supplierId,
        expiryDate: line.expiryDate,
        lotNumber: line.lotNumber,
        locationId: line.locationId || item.defaultLocationId,
        receivedAt: args.receivedAt,
        notes: note,
      });
      await ctx.db.insert("inventoryMovements", {
        itemId,
        type: "receive",
        quantity: qty,
        unitCost: baseUnitCost,
        supplierId: args.supplierId,
        batchId,
        locationId: line.locationId || item.defaultLocationId,
        note,
        createdAt: now,
      });
      await ctx.db.patch(itemId, { currentStock: item.currentStock + qty, updatedAt: now });
      await resolveLowStock(ctx, itemId, item.currentStock + qty);
      count++; totalQty += qty; totalCost += line.quantity * line.unitCost;
    }
    const roundedCost = Math.round(totalCost * 100) / 100;
    await autoPostInventoryReceipt(ctx, {
      sourceId: `${now}-${args.invoiceNo || "receipt"}`,
      date: args.receivedAt,
      amount: roundedCost,
      supplierId: args.supplierId ? String(args.supplierId) : undefined,
      invoiceNo: args.invoiceNo,
      createdBy: actor.userId as any,
    });
    return { count, totalQty, totalCost: roundedCost };
  },
});

// Create supplier
export const createSupplier = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken); // 🔒 إنشاء مورد = قرار شراء
    const supplierId = await ctx.db.insert("suppliers", {
      name: args.name,
      phone: args.phone,
      contactName: args.contactName,
      email: args.email,
      address: args.address,
      taxNumber: args.taxNumber,
      paymentTerms: args.paymentTerms,
      notes: args.notes,
      isActive: true,
      createdAt: Date.now(),
    });
    return supplierId;
  },
});

export const updateSupplier = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken); // 🔒 تعديل مورد
    // ⚠️ sessionToken يُستبعد من الـrest-spread وإلا خُزِّن داخل الوثيقة
    const { id, sessionToken: _t, ...rest } = args;
    await ctx.db.patch(id, rest);
    return id;
  },
});

// إحصائيات مشتريات لكل مورّد (عدد فواتير، قيمة، أصناف، آخر شراء)
export const getSupplierStats = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const batches = await ctx.db.query("inventoryBatches").collect();
    const stats: Record<string, { purchases: number; totalValue: number; items: Set<string>; lastPurchase: string }> = {};
    for (const b of batches) {
      const sid = b.supplierId;
      if (!sid) continue;
      if (!stats[sid]) stats[sid] = { purchases: 0, totalValue: 0, items: new Set(), lastPurchase: "" };
      stats[sid].purchases += 1;
      stats[sid].totalValue += Number(b.quantityReceived || 0) * Number(b.unitCost || 0);
      stats[sid].items.add(b.itemId);
      if (String(b.receivedAt || "") > stats[sid].lastPurchase) stats[sid].lastPurchase = b.receivedAt || "";
    }
    return Object.entries(stats).map(([supplierId, s]) => ({
      supplierId,
      purchases: s.purchases,
      totalValue: Math.round(s.totalValue * 100) / 100,
      itemCount: s.items.size,
      lastPurchase: s.lastPurchase || null,
    }));
  },
});

// ===== تحضير خطة + خصم المخزون تلقائياً حسب الرسيبي (idempotent) =====
// يستدعيه المطبخ عند تأكيد تحضير خطة اليوم. يخصم مكوّنات كل وجبة من المخزون.
/** جوهر «تم التحضير»: خصم مكوّنات خطة واحدة وتعليمها PREPARED — idempotent.
    يستدعى من زرّ الخطة الواحدة ومن زرّ «تحضير الكل» فلا يفترق سلوكهما. */
async function prepareAndConsumeOne(ctx: any, planId: Id<"dailyPlans">) {
    const plan: any = await ctx.db.get(planId);
    if (!plan) throw new Error("Plan not found");

    // idempotency: لو سبق خصم مكوّنات هذه الخطة، لا نكرّر الخصم
    if (plan.inventoryConsumedAt) {
      if (plan.status !== "PREPARED") {
        await ctx.db.patch(planId, { status: "PREPARED", updatedAt: Date.now() });
      }
      return { alreadyConsumed: true, consumed: [] as any[] };
    }

    // 1) جمّع الكمية المطلوبة لكل صنف مخزون من رسيبيات كل وجبة في الخطة
    const need = new Map<string, number>(); // inventoryItemId -> totalQty
    const items: any[] = Array.isArray(plan.items) ? plan.items : [];
    for (const it of items) {
      if (it?.isOff) continue;
      const publicMealId = it.publicMealId || (!it.menuItemId ? it.mealId : null);
      const recipe = publicMealId
        ? await ctx.db.query("mealIngredients").withIndex("by_publicMeal", (q: any) => q.eq("publicMealId", publicMealId)).collect()
        : it.menuItemId
          ? await ctx.db.query("mealIngredients").withIndex("by_menuItem", (q: any) => q.eq("menuItemId", it.menuItemId)).collect()
          : [];
      for (const ing of recipe) {
        const key = String(ing.inventoryItemId);
        const invItem: any = await ctx.db.get(ing.inventoryItemId);
        if (!invItem) continue;
        // حوّل كمية الرسيبي لوحدة المخزون (جرام→كيلو..) قبل التجميع
        const qty = convertUnit(Number(ing.quantityPerServing) || 0, (ing as any).unit, invItem.unit);
        need.set(key, (need.get(key) || 0) + qty);
      }
    }

    // 2) اخصم من المخزون (لا نوقف التحضير لو المخزون أقل — نخصم المتاح ونسجّل)
    const now = Date.now();
    const consumed: { itemId: string; requested: number; deducted: number; shortBy: number }[] = [];
    for (const [itemId, qty] of Array.from(need.entries())) {
      if (qty <= 0) continue;
      const item = await ctx.db.get(itemId as Id<"inventoryItems">);
      if (!item) continue;
      const deduct = Math.min(item.currentStock, qty);
      if (deduct > 0) {
        await ctx.db.insert("inventoryMovements", {
          itemId: item._id, type: "consume", quantity: -deduct,
          note: `تحضير خطة ${plan.date}`, createdAt: now,
        });
        await ctx.db.patch(item._id, { currentStock: item.currentStock - deduct, updatedAt: now });
        await maybeLowStockAlert(ctx, item._id, item.currentStock - deduct);
        // خصم FIFO من الدفعات
        let remaining = deduct;
        const batches = await ctx.db
          .query("inventoryBatches")
          .withIndex("by_itemId", (q: any) => q.eq("itemId", item._id))
          .collect();
        batches.sort((a: any, b: any) => a.receivedAt.localeCompare(b.receivedAt));
        for (const b of batches) {
          if (remaining <= 0) break;
          if (b.quantityRemaining <= 0) continue;
          const d = Math.min(b.quantityRemaining, remaining);
          await ctx.db.patch(b._id, { quantityRemaining: b.quantityRemaining - d });
          remaining -= d;
        }
      }
      consumed.push({ itemId, requested: qty, deducted: deduct, shortBy: Math.max(0, qty - deduct) });
    }

    // 3) علّم الخطة كمحضّرة + ختم الخصم
    await ctx.db.patch(planId, { status: "PREPARED", inventoryConsumedAt: now, updatedAt: now });

    return { alreadyConsumed: false, consumed };
}

export const prepareAndConsume = mutation({
  args: { planId: v.id("dailyPlans"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { planId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    return await prepareAndConsumeOne(ctx, planId);
  },
});

/**
 * «تحضير الكل»: يعلّم كل خطط اليوم المؤكدة PREPARED ويخصم مخزونها دفعة واحدة.
 * المطبخ كان يفتح 90+ كرتاً واحداً واحداً بعد التغليف. يمس CONFIRMED فقط —
 * المسودّة لم تُعتمد بعد، والمحضَّر أصلاً يتخطاه ختمُ الخصم داخل الجوهر نفسه.
 */
export const prepareAndConsumeAllForDate = mutation({
  args: {
    date: v.string(),
    deliveryTime: v.optional(v.string()), // MORNING/EVENING — اختياري: وردية واحدة
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { date, deliveryTime, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const plans = await ctx.db
      .query("dailyPlans")
      .withIndex("by_date", (q: any) => q.eq("date", date))
      .collect();
    // حاجز خادمي: لا يكفي تعطيل الزر في الواجهة، لأن أي تبويب قديم أو استدعاء
    // مباشر يجب ألا يجهّز يوماً فاشلاً في التدقيق.
    const candidates = (plans as any[]).filter((p) =>
      p.status === "CONFIRMED" &&
      p.origin !== "CUSTOMIZED" &&
      (!deliveryTime || String(p.deliveryTime) === deliveryTime));
    const seenCustomers = new Set<string>();
    for (const plan of candidates) {
      const customerId = String(plan.customerId || "");
      if (!customerId || seenCustomers.has(customerId)) {
        throw new Error("فشل تدقيق الإنتاج: توجد خطة مكررة أو خطة بلا مشترك. افتح شاشة تدقيق الإنتاج اليومي.");
      }
      seenCustomers.add(customerId);
      const customer: any = await ctx.db.get(plan.customerId);
      if (!customer) throw new Error("فشل تدقيق الإنتاج: مشترك الخطة غير موجود.");
      const pausedFrom = String(customer.pausedFrom || "").slice(0, 10);
      if (customer.isActive === false || (pausedFrom && date >= pausedFrom) || !isWithinSubscription(customer, date)) {
        throw new Error(`فشل تدقيق الإنتاج: اشتراك ${customer.fullName || "مشترك"} غير صالح لهذا اليوم.`);
      }
      const expected = Math.max(0, Number(customer.mealsPerDay) || 0)
        + Math.max(0, Number(customer.snacksPerDay) || 0);
      const actual = (Array.isArray(plan.items) ? plan.items : []).filter((item: any) => !item?.isOff).length;
      if (actual === 0 || (expected > 0 && actual !== expected)) {
        throw new Error(`فشل تدقيق الإنتاج: عدد وجبات ${customer.fullName || "مشترك"} لا يطابق الباقة.`);
      }
      if (customer.deliveryTime && plan.deliveryTime !== customer.deliveryTime) {
        throw new Error(`فشل تدقيق الإنتاج: وردية ${customer.fullName || "مشترك"} غير متطابقة.`);
      }
    }
    let prepared = 0, skipped = 0;
    for (const p of plans as any[]) {
      if (p.status !== "CONFIRMED") { skipped++; continue; }
      if (deliveryTime && String(p.deliveryTime) !== deliveryTime) { skipped++; continue; }
      await prepareAndConsumeOne(ctx, p._id);
      prepared++;
    }

    /* المخصّصون: وجباتهم في القوالب لا في الخطط اليومية، فكانت منظومة التوصيل
       لا تعرفهم إطلاقاً — لا لوحة التوصيل ولا تطبيق السائق. عند «تحضير الكل»
       نولّد لكل مخصّصٍ محسوبٍ في هذا اليوم صفَّ خطة تشغيلياً (origin=CUSTOMIZED،
       PREPARED مباشرة) ليركب سلسلة التوصيل كأي مشترك. المطبخ والاستيكرات
       يقرآن القالب نفسه ويستبعدان صفوف أصحاب القوالب، فلا ازدواج.
       ولا خصم مخزون هنا: وجبات القوالب نصوص وصفات بلا رسيبيات مربوطة. */
    const withPlan = new Set((plans as any[]).map((p) => String(p.customerId || "")));
    const templates = await ctx.db.query("customizedTemplates").collect();
    const settings: any = await ctx.db.query("restaurantSettings").first();
    const curWk = Number(settings?.currentCookingWeek) || 1;
    const anchor = String(settings?.cookingWeekAdvancedOn || "");
    const rot = /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? rotationWeekAtDate(curWk, anchor, date) : curWk;
    const dayKey = dayNameOf(date);
    let preparedCustomized = 0;
    for (const t of templates as any[]) {
      if (withPlan.has(String(t.customerId))) continue; // له صفّ فعلاً — لا تكرار
      const c: any = await ctx.db.get(t.customerId);
      if (!c) continue;
      const pf = String(c.pausedFrom || "").slice(0, 10);
      if (pf ? date >= pf : !c.isActive) continue;
      if (c.startDate && String(c.startDate).slice(0, 10) > date) continue;
      if (c.endDate && String(c.endDate).slice(0, 10) < date) continue;
      const cTime = String(c.deliveryTime || "MORNING");
      if (deliveryTime && cTime !== deliveryTime) continue;
      const wk = t.slots?.weeks ? (t.slots.weeks[rot] || t.slots.weeks[String(rot)])?.days : null;
      const days = wk || t.slots?.days;
      const arr: any[] = Array.isArray(days?.[dayKey]) ? days[dayKey] : [];
      const filled = arr.filter((x: any) => x && x.type !== "OFF" && (x.baseName || x.text || x.proteinG));
      if (!filled.length) continue; // يومه فاضي — لا شيء يوصَل
      const now = Date.now();
      await ctx.db.insert("dailyPlans", {
        date, customerId: t.customerId, deliveryTime: cTime as any,
        status: "PREPARED", origin: "CUSTOMIZED",
        items: filled.map((x: any) => ({ mealNameEn: String(x.text || x.baseName || "").trim(), isOff: false })),
        inventoryConsumedAt: now, // ختم يمنع أي خصم لاحق بالخطأ
        createdAt: now, updatedAt: now,
      });
      preparedCustomized++;
    }
    return { prepared, skipped, preparedCustomized };
  },
});

// ===== قائمة إعادة الطلب (Reorder) — أصناف وصلت/تحت الحد الأدنى مع الكمية المقترحة =====
export const getReorderList = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("inventoryItems").collect();
    const suppliers = await ctx.db.query("suppliers").collect();
    const supplierMap = new Map(suppliers.map((s) => [String(s._id), s]));

    const low = items
      .filter((it) => it.currentStock <= it.minStock)
      .map((it) => {
        // الكمية المقترحة = الوصول للمخزون المستهدف (أو ضعف الحد الأدنى كحد احتياطي)
        const target = it.targetStock && it.targetStock > 0 ? it.targetStock : it.minStock * 2;
        const suggestedQty = Math.max(0, Math.round((target - it.currentStock) * 100) / 100);
        const sup = it.supplierId ? supplierMap.get(String(it.supplierId)) : undefined;
        return {
          id: it._id,
          nameAr: it.nameAr,
          nameEn: it.nameEn || "",
          unit: it.unit,
          category: it.category,
          currentStock: it.currentStock,
          minStock: it.minStock,
          targetStock: target,
          suggestedQty,
          supplierId: it.supplierId ? String(it.supplierId) : null,
          supplierName: sup?.name || null,
          supplierPhone: sup?.phone || null,
        };
      })
      .sort((a, b) => a.currentStock / (a.minStock || 1) - b.currentStock / (b.minStock || 1));

    // تجميع حسب المورّد
    const bySupplier: Record<string, { supplierName: string | null; supplierPhone: string | null; items: any[] }> = {};
    for (const it of low) {
      const key = it.supplierId || "_none";
      if (!bySupplier[key]) {
        bySupplier[key] = { supplierName: it.supplierName, supplierPhone: it.supplierPhone, items: [] };
      }
      bySupplier[key].items.push(it);
    }

    return {
      count: low.length,
      items: low,
      groups: Object.entries(bySupplier).map(([supplierId, g]) => ({ supplierId, ...g })),
    };
  },
});

/* ════════════════════════════════════════════════════════════════════
   🗑️ حذف الأصناف
   الحذف يُرفض افتراضياً لأي صنف له أثر (رصيد/دفعات/حركات/وصفة/أمر شراء)
   حتى لا تختفي تكلفة أو استهلاك من السجل. force يتخطّى ذلك عن قصد.
   ════════════════════════════════════════════════════════════════════ */

/** يجمع كل ما يتعلّق بصنف — يُستخدم للمنع وللعرض قبل الحذف. */
async function itemUsage(ctx: any, itemId: Id<"inventoryItems">) {
  const [batches, movements, recipes] = await Promise.all([
    ctx.db.query("inventoryBatches").withIndex("by_itemId", (q: any) => q.eq("itemId", itemId)).collect(),
    ctx.db.query("inventoryMovements").withIndex("by_itemId", (q: any) => q.eq("itemId", itemId)).collect(),
    ctx.db.query("mealIngredients").withIndex("by_inventoryItem", (q: any) => q.eq("inventoryItemId", itemId)).collect(),
  ]);
  const pos = await ctx.db.query("purchaseOrders").collect();
  const inPO = pos.filter((p: any) => (p.items || []).some((i: any) => String(i.itemId) === String(itemId)));
  const item: any = await ctx.db.get(itemId);
  return {
    stock: Number(item?.currentStock || 0),
    batches: batches.length,
    movements: movements.length,
    recipes: recipes.length,
    purchaseOrders: inPO.length,
    blocked:
      Number(item?.currentStock || 0) !== 0 ||
      batches.length > 0 || movements.length > 0 ||
      recipes.length > 0 || inPO.length > 0,
    _batches: batches, _movements: movements, _recipes: recipes, _pos: inPO,
  };
}

/** ما الذي سيتأثّر لو حذفنا؟ يُعرض للمستخدم قبل أن يؤكّد. */
export const deletePreview = query({
  args: { ids: v.optional(v.array(v.id("inventoryItems"))), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const all = await ctx.db.query("inventoryItems").collect();
    const targets = args.ids?.length
      ? all.filter((i: any) => args.ids!.some((x) => String(x) === String(i._id)))
      : all;
    const rows: any[] = [];
    for (const it of targets) {
      const u = await itemUsage(ctx, it._id);
      rows.push({
        id: String(it._id), nameAr: it.nameAr, category: it.category, unit: it.unit,
        stock: u.stock, batches: u.batches, movements: u.movements,
        recipes: u.recipes, purchaseOrders: u.purchaseOrders, blocked: u.blocked,
      });
    }
    return {
      total: rows.length,
      safe: rows.filter((r) => !r.blocked).length,
      blocked: rows.filter((r) => r.blocked).length,
      rows,
    };
  },
});

export const deleteItem = mutation({
  args: {
    id: v.id("inventoryItems"),
    force: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken); // 🔒 حذف صنف = قرار مالي
    const u = await itemUsage(ctx, args.id);
    if (u.blocked && !args.force) {
      throw new Error(
        `لا يمكن حذف الصنف: رصيد ${u.stock}، ${u.batches} دفعة، ${u.movements} حركة، ${u.recipes} وصفة، ${u.purchaseOrders} أمر شراء. استخدم الحذف القسري لو متأكد.`,
      );
    }
    // الحذف القسري ينظّف الأثر كله حتى لا تبقى سجلات معلّقة على صنف غير موجود
    for (const b of u._batches) await ctx.db.delete(b._id);
    for (const m of u._movements) await ctx.db.delete(m._id);
    for (const r of u._recipes) await ctx.db.delete(r._id);
    for (const p of u._pos) {
      const kept = (p.items || []).filter((i: any) => String(i.itemId) !== String(args.id));
      if (kept.length) await ctx.db.patch(p._id, { items: kept });
      else await ctx.db.delete(p._id);
    }
    await ctx.db.delete(args.id);
    return { ok: true, removed: { batches: u.batches, movements: u.movements, recipes: u.recipes } };
  },
});

/**
 * مسح كامل للأصناف. يتطلّب كتابة كلمة تأكيد حرفية حتى لا يقع بضغطة خطأ.
 * بدون force يحذف الآمن فقط ويترك ما له أثر ويخبرك بعددهم.
 */
export const deleteAllItems = mutation({
  args: {
    confirm: v.string(),          // يجب أن تساوي "DELETE ALL"
    force: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    if (args.confirm !== "DELETE ALL") throw new Error('اكتب "DELETE ALL" للتأكيد');
    const all = await ctx.db.query("inventoryItems").collect();
    let deleted = 0, skipped = 0;
    const skippedNames: string[] = [];
    for (const it of all) {
      const u = await itemUsage(ctx, it._id);
      if (u.blocked && !args.force) {
        skipped++;
        if (skippedNames.length < 20) skippedNames.push(it.nameAr);
        continue;
      }
      for (const b of u._batches) await ctx.db.delete(b._id);
      for (const m of u._movements) await ctx.db.delete(m._id);
      for (const r of u._recipes) await ctx.db.delete(r._id);
      for (const p of u._pos) {
        const kept = (p.items || []).filter((i: any) => String(i.itemId) !== String(it._id));
        if (kept.length) await ctx.db.patch(p._id, { items: kept });
        else await ctx.db.delete(p._id);
      }
      await ctx.db.delete(it._id);
      deleted++;
    }
    return { deleted, skipped, skippedNames };
  },
});
