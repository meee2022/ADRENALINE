// convex/inventory.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ===== QUERIES =====

// Get all inventory items with search and filter
export const listItems = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    lowStock: v.optional(v.boolean()),
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
  args: { id: v.id("inventoryItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get item by barcode
export const getItemByBarcode = query({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
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
  handler: async (ctx) => {
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

// Get batches for an item
export const getBatchesByItem = query({
  args: { itemId: v.id("inventoryItems") },
  handler: async (ctx, args) => {
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
  handler: async (ctx) => {
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
    category: v.union(
      v.literal("vegetables"),
      v.literal("proteins"),
      v.literal("dairy"),
      v.literal("dry_goods"),
      v.literal("other")
    ),
    unit: v.union(
      v.literal("kg"),
      v.literal("piece"),
      v.literal("liter"),
      v.literal("pack"),
      v.literal("box")
    ),
    supplierId: v.optional(v.id("suppliers")),
    minStock: v.number(),
    targetStock: v.number(),
  },
  handler: async (ctx, args) => {
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
    category: v.optional(
      v.union(
        v.literal("vegetables"),
        v.literal("proteins"),
        v.literal("dairy"),
        v.literal("dry_goods"),
        v.literal("other")
      )
    ),
    unit: v.optional(
      v.union(
        v.literal("kg"),
        v.literal("piece"),
        v.literal("liter"),
        v.literal("pack"),
        v.literal("box")
      )
    ),
    supplierId: v.optional(v.id("suppliers")),
    minStock: v.optional(v.number()),
    targetStock: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

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
    receivedAt: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

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
  },
  handler: async (ctx, args) => {
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

    // Create movement
    await ctx.db.insert("inventoryMovements", {
      itemId: args.itemId,
      type: "consume",
      quantity: -args.quantity,
      note: args.note,
      createdAt: now,
    });

    // Update current stock
    await ctx.db.patch(args.itemId, {
      currentStock: item.currentStock - args.quantity,
      updatedAt: now,
    });

    // Deduct from batches (FIFO - First In First Out)
    let remaining = args.quantity;
    const batches = await ctx.db
      .query("inventoryBatches")
      .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
      .collect();

    // Sort by received date (oldest first for FIFO)
    batches.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

    for (const batch of batches) {
      if (remaining <= 0) break;
      if (batch.quantityRemaining <= 0) continue;

      const toDeduct = Math.min(batch.quantityRemaining, remaining);
      await ctx.db.patch(batch._id, {
        quantityRemaining: batch.quantityRemaining - toDeduct,
      });
      remaining -= toDeduct;
    }

    return { success: true };
  },
});

// Adjust stock (manual correction)
export const adjustStock = mutation({
  args: {
    itemId: v.id("inventoryItems"),
    newQuantity: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.newQuantity < 0) {
      throw new Error("Quantity cannot be negative");
    }

    // Get current item
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    const difference = args.newQuantity - item.currentStock;
    const now = Date.now();

    // Create movement
    await ctx.db.insert("inventoryMovements", {
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

    return { success: true };
  },
});

// Create supplier
export const createSupplier = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplierId = await ctx.db.insert("suppliers", {
      name: args.name,
      phone: args.phone,
      createdAt: Date.now(),
    });
    return supplierId;
  },
});
