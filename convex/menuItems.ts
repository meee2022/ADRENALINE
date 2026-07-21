/**
 * @file convex/menuItems.ts
 * @description Convex functions لعناصر القائمة (Menu Items)
 */
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";
import { v } from "convex/values";

function canonicalMenuItem(menuItem: any, publicMeal: any | null) {
  if (!publicMeal) return menuItem;
  const protein = Number(publicMeal.protein ?? 0) || 0;
  const carbs = Number(publicMeal.carbs ?? 0) || 0;
  const fats = Number(publicMeal.fats ?? 0) || 0;
  return {
    ...menuItem,
    name: String(publicMeal.nameEn || publicMeal.nameAr || menuItem.name),
    calories: Number(publicMeal.calories ?? 0) || menuItem.calories,
    protein,
    carbs,
    fats,
    macros: protein || carbs || fats ? `P:${protein}g C:${carbs}g F:${fats}g` : menuItem.macros,
    tags: publicMeal.tags || menuItem.tags,
    canonicalNameAr: publicMeal.nameAr,
    canonicalNameEn: publicMeal.nameEn,
    canonicalImageUrl: publicMeal.imageUrl,
  };
}

function publicCategoryFor(categoryName: string, mealName: string) {
  const category = String(categoryName || "").toLowerCase();
  const name = String(mealName || "").toLowerCase();
  if (category.includes("breakfast")) return "breakfast" as const;
  if (category.includes("dinner")) return "dinner" as const;
  if (category.includes("snack")) return "snack" as const;
  if (category.includes("salad") || name.includes("salad")) return "salad" as const;
  if (category.includes("lunch")) return "lunch" as const;
  if (/cookie|cake|brownie|muffin|ball|dessert|sweet|snack|soup/.test(name)) return "snack" as const;
  if (/egg|omelet|omelette|breakfast|pancake|oat|croissant/.test(name)) return "breakfast" as const;
  return "lunch" as const;
}

async function uniqueSlug(ctx: any, name: string) {
  const base = String(name || "meal")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "meal";
  let slug = base.length >= 2 ? base : `meal-${base}`;
  let suffix = 2;
  while (await ctx.db.query("publicMeals").withIndex("by_slug", (q: any) => q.eq("slug", slug)).first()) {
    slug = `${base.slice(0, 70)}-${suffix++}`;
  }
  return slug;
}

export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const [items, publicMeals] = await Promise.all([
      ctx.db.query("menuItems").collect(),
      ctx.db.query("publicMeals").collect(),
    ]);
    const publicById = new Map(publicMeals.map((meal) => [String(meal._id), meal]));
    return items.map((item) => canonicalMenuItem(item, publicById.get(String(item.publicMealId || "")) || null));
  },
});

export const getById = query({
  args: { id: v.id("menuItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) return null;
    const publicMeal = item.publicMealId ? await ctx.db.get(item.publicMealId) : null;
    return canonicalMenuItem(item, publicMeal);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    categoryId: v.id("mealCategories"),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fats: v.optional(v.number()),
    macros: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const category = await ctx.db.get(args.categoryId);
    const protein = Number(args.protein ?? 0) || 0;
    const carbs = Number(args.carbs ?? 0) || 0;
    const fats = Number(args.fats ?? 0) || 0;
    const publicMealId = await ctx.db.insert("publicMeals", {
      nameAr: args.name,
      nameEn: /^[\x00-\x7F]+$/.test(args.name) ? args.name : undefined,
      slug: await uniqueSlug(ctx, args.name),
      calories: Number(args.calories ?? 0) || Math.round(protein * 4 + carbs * 4 + fats * 9),
      protein,
      carbs,
      fats,
      tags: args.tags || [],
      ingredients: [],
      category: publicCategoryFor(category?.name || "", args.name),
      priceQAR: 0,
      sortOrder: 999,
      // New legacy-catalog entries require image/channel/schedule review before public exposure.
      isActive: false,
      isOnlineOnly: false,
      createdAt: Date.now(),
    });
    const menuItemId = await ctx.db.insert("menuItems", {
      name: args.name,
      categoryId: args.categoryId,
      calories: args.calories,
      protein: args.protein,
      carbs: args.carbs,
      fats: args.fats,
      macros: args.macros,
      tags: args.tags,
      isActive: args.isActive ?? true,
      publicMealId,
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
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fats: v.optional(v.number()),
    macros: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const { id, sessionToken: _t, ...updates } = args;
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Menu item not found");
    await ctx.db.patch(id, updates);
    if (current.publicMealId) {
      const publicUpdates: any = {};
      if (updates.name !== undefined) {
        if (/^[\x00-\x7F]+$/.test(updates.name)) publicUpdates.nameEn = updates.name;
        else publicUpdates.nameAr = updates.name;
      }
      for (const field of ["calories", "protein", "carbs", "fats", "tags", "isActive"] as const) {
        if (updates[field] !== undefined) publicUpdates[field] = updates[field];
      }
      if (updates.categoryId !== undefined) {
        const category = await ctx.db.get(updates.categoryId);
        publicUpdates.category = publicCategoryFor(category?.name || "", updates.name || current.name);
      }
      await ctx.db.patch(current.publicMealId, publicUpdates);
    }
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("menuItems"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const item = await ctx.db.get(args.id);
    if (!item) return { success: true };
    // Preserve historical daily-plan and recipe references. Canonical deletion is
    // managed from publicMeals, which performs full reference checks.
    await ctx.db.patch(args.id, { isActive: false });
    if (item.publicMealId) await ctx.db.patch(item.publicMealId, { isActive: false });
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

    for (const pm of publicMeals.filter((meal: any) => !meal.isOnlineOnly && !meal.isGymOnly)) {
      const mealName = String((pm as any).nameAr || (pm as any).nameEn || "").trim();
      if (!mealName) {
        skippedCount++;
        continue;
      }

      const existing = menuItemsByNameLower.get(mealName.toLowerCase());
      if (existing) {
        if (!existing.publicMealId) {
          await ctx.db.patch(existing._id, {
            publicMealId: pm._id,
            calories: pm.calories,
            protein: pm.protein,
            carbs: pm.carbs,
            fats: pm.fats,
            macros: `P:${pm.protein}g C:${pm.carbs}g F:${pm.fats}g`,
          });
        }
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
        protein: p || undefined,
        carbs: c || undefined,
        fats: f || undefined,
        macros: macrosStr,
        publicMealId: pm._id,
        isActive: pm.isActive,
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
