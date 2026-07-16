import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRoleOrPermission } from "./sessions";

const MANAGE = { roles: ["INVENTORY_MANAGER"], permissions: ["/inventory"] };
const cleanCode = (value: string) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
const cleanName = (value: string) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const DEFAULT_CATEGORIES = [
  ["vegetables", "خضروات وفواكه", "Vegetables & fruit", "#22c55e"],
  ["proteins", "لحوم وبروتينات", "Meat & proteins", "#ef4444"],
  ["dairy", "ألبان ومبردات", "Dairy & chilled", "#38bdf8"],
  ["dry_goods", "مواد جافة", "Dry goods", "#f59e0b"],
  ["frozen", "مجمدات", "Frozen", "#06b6d4"],
  ["beverages", "مشروبات", "Beverages", "#3b82f6"],
  ["sauces", "صوصات وتوابل", "Sauces & spices", "#f97316"],
  ["bakery", "مخبوزات", "Bakery", "#eab308"],
  ["packaging", "تغليف وتعبئة", "Packaging", "#8b5cf6"],
  ["cleaning", "نظافة وتعقيم", "Cleaning", "#14b8a6"],
  ["consumables", "أدوات مستهلكة", "Consumables", "#64748b"],
  ["assets", "عهد وأصول", "Assets", "#334155"],
  ["other", "أخرى", "Other", "#94a3b8"],
] as const;

const DEFAULT_LOCATIONS = [
  ["dry_store", "المخزن الجاف", "Dry store", "STORE"],
  ["chiller", "الثلاجات", "Chiller", "CHILLER"],
  ["freezer", "الفريزر", "Freezer", "FREEZER"],
  ["kitchen", "المطبخ", "Kitchen", "KITCHEN"],
  ["packaging_store", "مخزن التغليف", "Packaging store", "STORE"],
  ["cleaning_store", "مخزن النظافة", "Cleaning store", "STORE"],
] as const;

const DEFAULT_UNITS = [
  ["kg", "كجم", "kg", "mass", 1000], ["g", "جرام", "g", "mass", 1],
  ["liter", "لتر", "liter", "volume", 1000], ["ml", "مل", "ml", "volume", 1],
  ["piece", "قطعة", "piece", "count", 1], ["pack", "عبوة", "pack", "count", 1],
  ["box", "صندوق", "box", "count", 1], ["carton", "كرتونة", "carton", "count", 1],
  ["bag", "كيس", "bag", "count", 1], ["bottle", "زجاجة", "bottle", "count", 1],
] as const;

export const getSetupData = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireRoleOrPermission(ctx, args.sessionToken, MANAGE);
    const [categories, locations, units, suppliers, items, sessions] = await Promise.all([
      ctx.db.query("inventoryCategories").collect(), ctx.db.query("inventoryLocations").collect(),
      ctx.db.query("inventoryUnits").collect(), ctx.db.query("suppliers").collect(),
      ctx.db.query("inventoryItems").collect(), ctx.db.query("inventoryStocktakes").collect(),
    ]);
    return {
      categories: categories.sort((a, b) => a.sortOrder - b.sortOrder),
      locations: locations.sort((a, b) => a.sortOrder - b.sortOrder),
      units: units.sort((a, b) => a.sortOrder - b.sortOrder),
      suppliers: suppliers.filter((s) => s.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)),
      itemCount: items.length,
      sessions: sessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20),
    };
  },
});

export const seedDefaults = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireRoleOrPermission(ctx, args.sessionToken, MANAGE);
    const now = Date.now(); let created = 0;
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const [code, nameAr, nameEn, color] = DEFAULT_CATEGORIES[i];
      if (!(await ctx.db.query("inventoryCategories").withIndex("by_code", q => q.eq("code", code)).first())) {
        await ctx.db.insert("inventoryCategories", { code, nameAr, nameEn, color, isActive: true, sortOrder: i, createdAt: now }); created++;
      }
    }
    for (let i = 0; i < DEFAULT_LOCATIONS.length; i++) {
      const [code, nameAr, nameEn, locationType] = DEFAULT_LOCATIONS[i];
      if (!(await ctx.db.query("inventoryLocations").withIndex("by_code", q => q.eq("code", code)).first())) {
        await ctx.db.insert("inventoryLocations", { code, nameAr, nameEn, locationType, isActive: true, sortOrder: i, createdAt: now }); created++;
      }
    }
    for (let i = 0; i < DEFAULT_UNITS.length; i++) {
      const [code, nameAr, nameEn, dimension, baseFactor] = DEFAULT_UNITS[i];
      if (!(await ctx.db.query("inventoryUnits").withIndex("by_code", q => q.eq("code", code)).first())) {
        await ctx.db.insert("inventoryUnits", { code, nameAr, nameEn, dimension, baseFactor, isActive: true, sortOrder: i, createdAt: now }); created++;
      }
    }
    return { created };
  },
});

export const upsertCategory = mutation({
  args: { id: v.optional(v.id("inventoryCategories")), code: v.string(), nameAr: v.string(), nameEn: v.string(), color: v.optional(v.string()), isActive: v.optional(v.boolean()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireRoleOrPermission(ctx, args.sessionToken, MANAGE);
    const { id, sessionToken: _t, ...data } = args; const code = cleanCode(data.code);
    if (!code || !data.nameAr.trim()) throw new Error("التصنيف والرمز مطلوبان");
    if (id) { await ctx.db.patch(id, { ...data, code }); return id; }
    const old = await ctx.db.query("inventoryCategories").withIndex("by_code", q => q.eq("code", code)).first();
    if (old) { await ctx.db.patch(old._id, { ...data, code }); return old._id; }
    return await ctx.db.insert("inventoryCategories", { ...data, code, isActive: data.isActive ?? true, sortOrder: Date.now(), createdAt: Date.now() });
  },
});

export const upsertLocation = mutation({
  args: { id: v.optional(v.id("inventoryLocations")), code: v.string(), nameAr: v.string(), nameEn: v.string(), locationType: v.string(), isActive: v.optional(v.boolean()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireRoleOrPermission(ctx, args.sessionToken, MANAGE);
    const { id, sessionToken: _t, ...data } = args; const code = cleanCode(data.code);
    if (!code || !data.nameAr.trim()) throw new Error("الموقع والرمز مطلوبان");
    if (id) { await ctx.db.patch(id, { ...data, code }); return id; }
    const old = await ctx.db.query("inventoryLocations").withIndex("by_code", q => q.eq("code", code)).first();
    if (old) { await ctx.db.patch(old._id, { ...data, code }); return old._id; }
    return await ctx.db.insert("inventoryLocations", { ...data, code, isActive: data.isActive ?? true, sortOrder: Date.now(), createdAt: Date.now() });
  },
});

export const upsertUnit = mutation({
  args: { id: v.optional(v.id("inventoryUnits")), code: v.string(), nameAr: v.string(), nameEn: v.string(), dimension: v.string(), baseFactor: v.number(), isActive: v.optional(v.boolean()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireRoleOrPermission(ctx, args.sessionToken, MANAGE);
    const { id, sessionToken: _t, ...data } = args; const code = cleanCode(data.code);
    if (!code || !data.nameAr.trim()) throw new Error("الوحدة والرمز مطلوبان");
    if (!Number.isFinite(data.baseFactor) || data.baseFactor <= 0) throw new Error("معامل التحويل يجب أن يكون أكبر من صفر");
    if (id) { await ctx.db.patch(id, { ...data, code }); return id; }
    const old = await ctx.db.query("inventoryUnits").withIndex("by_code", q => q.eq("code", code)).first();
    if (old) { await ctx.db.patch(old._id, { ...data, code }); return old._id; }
    return await ctx.db.insert("inventoryUnits", { ...data, code, isActive: data.isActive ?? true, sortOrder: Date.now(), createdAt: Date.now() });
  },
});

const openingRow = v.object({
  nameAr: v.string(), nameEn: v.optional(v.string()), barcode: v.optional(v.string()), sku: v.optional(v.string()),
  category: v.string(), unit: v.string(), purchaseUnit: v.optional(v.string()), purchaseToBaseFactor: v.optional(v.number()),
  itemType: v.optional(v.string()), quantity: v.number(), unitCost: v.optional(v.number()), minStock: v.optional(v.number()),
  targetStock: v.optional(v.number()), supplierName: v.optional(v.string()), locationCode: v.optional(v.string()),
  expiryDate: v.optional(v.string()), lotNumber: v.optional(v.string()), note: v.optional(v.string()),
});

export const createOpeningStocktake = mutation({
  args: { title: v.string(), countedAt: v.string(), notes: v.optional(v.string()), rows: v.array(openingRow), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireRoleOrPermission(ctx, args.sessionToken, MANAGE);
    if (!args.rows.length) throw new Error("أضف صنفاً واحداً على الأقل");
    const now = Date.now();
    const stocktakeId = await ctx.db.insert("inventoryStocktakes", { title: args.title.trim() || "الجرد الافتتاحي", stocktakeType: "OPENING", status: "DRAFT", countedAt: args.countedAt, notes: args.notes, createdBy: identity.userId as any, createdAt: now });
    const allItems = await ctx.db.query("inventoryItems").collect();
    const itemByName = new Map(allItems.map(i => [cleanName(i.nameAr), i]));
    for (const row of args.rows) {
      if (!row.nameAr.trim() || row.quantity < 0) continue;
      let item = row.barcode ? await ctx.db.query("inventoryItems").withIndex("by_barcode", q => q.eq("barcode", row.barcode)).first() : null;
      item ||= itemByName.get(cleanName(row.nameAr)) || null;
      let locationId: any = undefined;
      if (row.locationCode) locationId = (await ctx.db.query("inventoryLocations").withIndex("by_code", q => q.eq("code", cleanCode(row.locationCode!))).first())?._id;
      let supplierId: any = undefined;
      if (row.supplierName?.trim()) {
        let supplier = (await ctx.db.query("suppliers").collect()).find(s => cleanName(s.name) === cleanName(row.supplierName!));
        if (!supplier) { const id = await ctx.db.insert("suppliers", { name: row.supplierName.trim(), isActive: true, createdAt: now }); supplier = await ctx.db.get(id) as any; }
        supplierId = supplier?._id;
      }
      if (!item) {
        const itemId = await ctx.db.insert("inventoryItems", {
          barcode: row.barcode, sku: row.sku, nameAr: row.nameAr.trim(), nameEn: row.nameEn,
          category: cleanCode(row.category) || "other", unit: cleanCode(row.unit) || "piece",
          itemType: row.itemType || "ingredient", purchaseUnit: row.purchaseUnit,
          purchaseToBaseFactor: row.purchaseToBaseFactor || 1, defaultLocationId: locationId, supplierId,
          minStock: row.minStock || 0, targetStock: Math.max(row.targetStock || row.quantity, row.minStock || 0),
          currentStock: 0, avgWeeklyUsage: 0, notes: row.note, createdAt: now, updatedAt: now,
        });
        item = await ctx.db.get(itemId) as any;
        if (!item) throw new Error(`تعذر إنشاء الصنف: ${row.nameAr}`);
        itemByName.set(cleanName(row.nameAr), item);
      }
      await ctx.db.insert("inventoryStocktakeLines", { stocktakeId, itemId: item!._id, systemQuantity: item!.currentStock, countedQuantity: row.quantity, unitCost: row.unitCost, expiryDate: row.expiryDate, lotNumber: row.lotNumber, locationId: locationId || item!.defaultLocationId, note: row.note, createdAt: now });
    }
    return stocktakeId;
  },
});

export const getStocktake = query({
  args: { id: v.id("inventoryStocktakes"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireRoleOrPermission(ctx, args.sessionToken, MANAGE);
    const stocktake = await ctx.db.get(args.id); if (!stocktake) return null;
    const lines = await ctx.db.query("inventoryStocktakeLines").withIndex("by_stocktake", q => q.eq("stocktakeId", args.id)).collect();
    return { ...stocktake, lines: await Promise.all(lines.map(async line => ({ ...line, item: await ctx.db.get(line.itemId), variance: line.countedQuantity - line.systemQuantity }))) };
  },
});

export const setStocktakeStatus = mutation({
  args: { id: v.id("inventoryStocktakes"), status: v.union(v.literal("REVIEW"), v.literal("CANCELLED")), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => { await requireRoleOrPermission(ctx, args.sessionToken, MANAGE); await ctx.db.patch(args.id, { status: args.status }); return args.id; },
});

export const approveStocktake = mutation({
  args: { id: v.id("inventoryStocktakes"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireRoleOrPermission(ctx, args.sessionToken, MANAGE);
    const stocktake = await ctx.db.get(args.id); if (!stocktake) throw new Error("الجرد غير موجود");
    if (stocktake.status === "APPROVED") return { alreadyApproved: true };
    if (stocktake.status === "CANCELLED") throw new Error("لا يمكن اعتماد جرد ملغي");
    const lines = await ctx.db.query("inventoryStocktakeLines").withIndex("by_stocktake", q => q.eq("stocktakeId", args.id)).collect();
    const now = Date.now(); let adjusted = 0;
    for (const line of lines) {
      const item = await ctx.db.get(line.itemId); if (!item) continue;
      const delta = line.countedQuantity - item.currentStock;
      if (delta !== 0) {
        await ctx.db.insert("inventoryMovements", { itemId: item._id, type: "adjust", quantity: delta, unitCost: line.unitCost, locationId: line.locationId, referenceType: "STOCKTAKE", referenceId: String(args.id), note: `اعتماد ${stocktake.title}`, createdAt: now });
        await ctx.db.patch(item._id, { currentStock: line.countedQuantity, updatedAt: now }); adjusted++;
      }
      if (delta > 0 && line.unitCost != null) {
        await ctx.db.insert("inventoryBatches", { itemId: item._id, quantityReceived: delta, quantityRemaining: delta, unitCost: line.unitCost, expiryDate: line.expiryDate, lotNumber: line.lotNumber, locationId: line.locationId, receivedAt: stocktake.countedAt, notes: `رصيد افتتاحي: ${stocktake.title}` });
      } else if (delta < 0) {
        let remaining = Math.abs(delta);
        const batches = await ctx.db.query("inventoryBatches").withIndex("by_itemId", q => q.eq("itemId", item._id)).collect();
        batches.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
        for (const batch of batches) {
          if (remaining <= 0) break;
          const deduct = Math.min(batch.quantityRemaining, remaining);
          if (deduct > 0) await ctx.db.patch(batch._id, { quantityRemaining: batch.quantityRemaining - deduct });
          remaining -= deduct;
        }
      }
    }
    await ctx.db.patch(args.id, { status: "APPROVED", approvedBy: identity.userId as any, approvedAt: now });
    return { alreadyApproved: false, adjusted, lines: lines.length };
  },
});
