/**
 * @file convex/menuItems.ts
 * @description Convex functions لعناصر القائمة (Menu Items)
 */
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";
import { v } from "convex/values";

export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.db.query("menuItems").collect();
  },
});

export const getById = query({
  args: { id: v.id("menuItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    categoryId: v.id("mealCategories"),
    calories: v.optional(v.number()),
    macros: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const menuItemId = await ctx.db.insert("menuItems", {
      name: args.name,
      categoryId: args.categoryId,
      calories: args.calories,
      macros: args.macros,
      tags: args.tags,
      isActive: args.isActive ?? true,
    });
    return menuItemId;
  },
});

export const update = mutation({
  args: {
    id: v.id("menuItems"),
    name: v.optional(v.string()),
    categoryId: v.optional(v.id("mealCategories")),
    calories: v.optional(v.number()),
    macros: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const { id, sessionToken: _t, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("menuItems"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * ✅ مزامنة publicMeals → menuItems
 * بياخد كل الوجبات من منيو الموقع العام ويضيفها لقائمة الإدارة
 * - بيدور على تصنيف مطابق (mealCategories) — لو مش موجود ينشئه
 * - بيتجاهل الوجبات اللي اسمها موجود مسبقاً (بدون تكرار)
 * - بيحفظ macros كـ string موحد "P:30 C:40 F:15"
 */
export const syncFromPublicMeals = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    // 1) جلب كل البيانات
    const publicMeals = await ctx.db.query("publicMeals").collect();
    const existingMenuItems = await ctx.db.query("menuItems").collect();
    const existingCategories = await ctx.db.query("mealCategories").collect();

    // 2) Maps للبحث السريع
    const menuItemsByNameLower = new Map<string, any>();
    existingMenuItems.forEach((mi) => {
      menuItemsByNameLower.set(String(mi.name || "").trim().toLowerCase(), mi);
    });

    const categoryByNameLower = new Map<string, any>();
    existingCategories.forEach((c) => {
      categoryByNameLower.set(String(c.name || "").trim().toLowerCase(), c);
    });

    // 3) خريطة من category public → Arabic category name
    const publicToArabicCategory: Record<string, { ar: string; sort: number }> = {
      breakfast: { ar: "فطور", sort: 1 },
      lunch:     { ar: "غداء", sort: 2 },
      dinner:    { ar: "عشاء", sort: 3 },
      salad:     { ar: "سلطات", sort: 4 },
      snack:     { ar: "سناك", sort: 5 },
    };

    // 4) إنشاء التصنيفات الناقصة أولاً
    for (const key of Object.keys(publicToArabicCategory)) {
      const { ar, sort } = publicToArabicCategory[key];
      const arLower = ar.toLowerCase();
      if (!categoryByNameLower.has(arLower) && !categoryByNameLower.has(key)) {
        const newCatId = await ctx.db.insert("mealCategories", {
          name: ar,
          sortOrder: sort,
        });
        const newCat = await ctx.db.get(newCatId);
        if (newCat) {
          categoryByNameLower.set(arLower, newCat);
          categoryByNameLower.set(key, newCat);
        }
      }
    }

    // 5) مزامنة الوجبات
    let createdCount = 0;
    let skippedCount = 0;

    for (const pm of publicMeals) {
      const mealName = String((pm as any).nameAr || (pm as any).nameEn || "").trim();
      if (!mealName) {
        skippedCount++;
        continue;
      }

      // تجاهل لو الوجبة موجودة بنفس الاسم
      if (menuItemsByNameLower.has(mealName.toLowerCase())) {
        skippedCount++;
        continue;
      }

      // ابحث عن تصنيف مطابق
      const pmCategory = String((pm as any).category || "").toLowerCase();
      const arName = publicToArabicCategory[pmCategory]?.ar || "";
      const category = categoryByNameLower.get(arName.toLowerCase())
                    || categoryByNameLower.get(pmCategory);

      if (!category) {
        skippedCount++;
        continue;
      }

      // بناء macros string
      const p = Number((pm as any).protein ?? 0) || 0;
      const c = Number((pm as any).carbs ?? 0) || 0;
      const f = Number((pm as any).fats ?? 0) || 0;
      const macrosStr =
        p > 0 || c > 0 || f > 0
          ? `P:${p}g C:${c}g F:${f}g`
          : undefined;

      await ctx.db.insert("menuItems", {
        name: mealName,
        categoryId: category._id,
        calories: Number((pm as any).calories ?? 0) || undefined,
        macros: macrosStr,
        isActive: true,
      });
      createdCount++;
    }

    return {
      success: true,
      created: createdCount,
      skipped: skippedCount,
      total: publicMeals.length,
      message: `تم نسخ ${createdCount} وجبة من منيو الموقع العام. تم تجاهل ${skippedCount} (موجودة مسبقاً أو بدون اسم).`,
    };
  },
});
