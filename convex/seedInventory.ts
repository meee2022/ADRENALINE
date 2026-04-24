// convex/seedInventory.ts
import { mutation } from "./_generated/server";

export const seedInventoryData = mutation({
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("inventoryItems").first();
    if (existing) {
      return { message: "Data already seeded" };
    }

    // Create suppliers
    const supplier1 = await ctx.db.insert("suppliers", {
      name: "مزارع اليوم للطازجة",
      phone: "+974 4444 5555",
      createdAt: Date.now(),
    });

    const supplier2 = await ctx.db.insert("suppliers", {
      name: "شركة البروتين المتميز",
      phone: "+974 3333 6666",
      createdAt: Date.now(),
    });

    const now = Date.now();

    // Create inventory items
    const items = [
      {
        barcode: "1001",
        nameAr: "صدور دجاج طازجة",
        nameEn: "Fresh Chicken Breast",
        category: "proteins" as const,
        unit: "kg" as const,
        supplierId: supplier2,
        minStock: 10,
        targetStock: 50,
        currentStock: 12,
      },
      {
        barcode: "1002",
        nameAr: "بطاطس طازجة",
        nameEn: "Fresh Potatoes",
        category: "vegetables" as const,
        unit: "kg" as const,
        supplierId: supplier1,
        minStock: 15,
        targetStock: 100,
        currentStock: 85,
      },
      {
        barcode: "1003",
        nameAr: "بروكلي",
        nameEn: "Broccoli",
        category: "vegetables" as const,
        unit: "kg" as const,
        supplierId: supplier1,
        minStock: 5,
        targetStock: 20,
        currentStock: 0,
      },
      {
        barcode: "1004",
        nameAr: "حليب طازج",
        nameEn: "Fresh Milk",
        category: "dairy" as const,
        unit: "liter" as const,
        supplierId: supplier1,
        minStock: 10,
        targetStock: 50,
        currentStock: 45,
      },
      {
        barcode: "1005",
        nameAr: "أرز أبيض",
        nameEn: "White Rice",
        category: "dry_goods" as const,
        unit: "kg" as const,
        supplierId: supplier1,
        minStock: 20,
        targetStock: 100,
        currentStock: 75,
      },
      {
        barcode: "1006",
        nameAr: "سلمون مشوي",
        nameEn: "Grilled Salmon",
        category: "proteins" as const,
        unit: "kg" as const,
        supplierId: supplier2,
        minStock: 5,
        targetStock: 25,
        currentStock: 14,
      },
      {
        barcode: "1007",
        nameAr: "طماطم",
        nameEn: "Tomatoes",
        category: "vegetables" as const,
        unit: "kg" as const,
        supplierId: supplier1,
        minStock: 10,
        targetStock: 50,
        currentStock: 32,
      },
      {
        barcode: "1008",
        nameAr: "لبن زبادي",
        nameEn: "Yogurt",
        category: "dairy" as const,
        unit: "pack" as const,
        supplierId: supplier1,
        minStock: 20,
        targetStock: 100,
        currentStock: 67,
      },
      {
        barcode: "1009",
        nameAr: "معكرونة",
        nameEn: "Pasta",
        category: "dry_goods" as const,
        unit: "pack" as const,
        supplierId: supplier1,
        minStock: 15,
        targetStock: 50,
        currentStock: 28,
      },
      {
        barcode: "1010",
        nameAr: "جبنة موزاريلا",
        nameEn: "Mozzarella Cheese",
        category: "dairy" as const,
        unit: "kg" as const,
        supplierId: supplier1,
        minStock: 5,
        targetStock: 20,
        currentStock: 8,
      },
    ];

    for (const item of items) {
      const itemId = await ctx.db.insert("inventoryItems", {
        ...item,
        avgWeeklyUsage: Math.round(item.currentStock * 0.3),
        createdAt: now,
        updatedAt: now,
      });

      // Create initial batch for items with stock
      if (item.currentStock > 0) {
        const unitCost = item.category === "proteins" ? 35 : item.category === "dairy" ? 12 : 8;
        
        // Add expiry date for perishable items
        let expiryDate: string | undefined;
        if (["proteins", "dairy", "vegetables"].includes(item.category)) {
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + (item.category === "proteins" || item.category === "dairy" ? 2 : 7));
          expiryDate = expiry.toISOString().split("T")[0];
        }

        const batchId = await ctx.db.insert("inventoryBatches", {
          itemId,
          quantityReceived: item.currentStock,
          quantityRemaining: item.currentStock,
          unitCost,
          supplierId: item.supplierId,
          expiryDate,
          receivedAt: new Date().toISOString().split("T")[0],
          notes: "Initial stock",
        });

        // Create receive movement
        await ctx.db.insert("inventoryMovements", {
          itemId,
          type: "receive",
          quantity: item.currentStock,
          unitCost,
          supplierId: item.supplierId,
          batchId,
          note: "Initial stock",
          createdAt: now,
        });
      }
    }

    return { message: "Inventory data seeded successfully", count: items.length };
  },
});
