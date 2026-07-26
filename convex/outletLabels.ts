import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";
import { v } from "convex/values";

type SeedRow = [string, number?, number?, number?, number?, number?];

// Source: the approved Gym List supplied by the restaurant (barcode 100001..100066).
// Values are: name, price, calories, carbs, protein, fats. Missing cells stay undefined.
const LABELS: SeedRow[] = [
  ["CHICKEN CEASAR SALAD", 30, 362, 24, 26, 18],
  ["CRISPY CHICKEN", 45, 490, 40, 42, 18],
  ["CHICKEN SHAWRMA", 35, 403, 31, 36, 15],
  ["BEEF SHAWARMA BEETROOT", 54, 435, 32, 34, 19],
  ["SHISHTAWOOK WITH RICE", 45, 422, 31, 34, 16],
  ["BEEF SHAWARMA", 42, 404, 31, 40, 15],
  ["BEEF KOFTA & MASH DELIGHT", 50, 419, 38, 43, 18],
  ["CHICKEN BREAST W\\RICE", 42, 486, 33, 35, 17],
  ["IRANIAN KOFTA", 52, 425, 30, 11, 19],
  ["SPICY TUNA SANDWICH", 35, 295, 20, 11, 19],
  ["CHICKEN AVO SANDWICH", 35, 221, 20, 15, 9],
  ["POWER BALLS", 20, 166, 11, 8, 10],
  ["CRISPY CHICKEN W/RICE", 45, 471, 41, 43, 15],
  ["PROTEIN BROWNIES", 22, 179, 11, 18, 7],
  ["VANILLA MUFFIN PROTEIN", 22, 163, 10, 15, 7],
  ["BEETROOT SALAD", 25, 140, 7, 10, 8],
  ["SWEET CHILLI CHICKEN", 45, 518, 39, 41, 22],
  ["EGG WRAP", 30, 234, 14, 22, 10],
  ["TURKEY SPINACH PASTA", 42, 237, 21, 18, 9],
  ["SWEET POTATOES DELIGHT", 34, 259, 17, 23, 11],
  ["BEEF FAJITA WRAP", 37, 362, 25, 34, 14],
  ["NO CARB TACOS", 30, 279, 13, 32, 11],
  ["CRISPY CHICKEN W/ HONEY MUSTARD", 30, 408, 19, 38, 20],
  ["WALDORF SALAD", 25, 138, 5, 7, 10],
  ["TUNA COROUESTS", 30, 371, 21, 29, 19],
  ["CHICKEN BURGER", 35, 421, 28, 39, 17],
  ["SPAGHETTI MEAT BALLS", 45, 439, 30, 37, 19],
  ["PISTACHIO SALAD", 30, 144, 5, 13, 8],
  ["MEDITERRANEEN FETA SALAD", 30, 123, 6, 9, 7],
  ["MAXICAN NACHOS", 20, 295, 27, 22, 11],
  ["TENDERLOIN W/ RICE", 49, 336, 23, 25, 16],
  ["TERYAKI TOFU W/ RICE", 37, 325, 25, 27, 13],
  ["STUFFED ZUCCHINI W/ CHEESE SAUCE", 32, 290, 18, 23, 14],
  ["MONGOLIAN BEEF", 49, 404, 29, 36, 16],
  ["AMERICAN BREAKFAST", 30, 269, 17, 21, 13],
  ["TURKEY AND CHEESE CLUB SANDWICH", 25, 290, 19, 22, 14],
  ["AVOCADO TURKEY SANDWICH", 25, 292, 17, 20, 16],
  ["HALLOUMI PESTO SANDWICH", 25, 289, 29, 23, 9],
  ["COOKIES", 20, 156, 12, 9, 8],
  ["CRIPSY CHICKEN WRAP", 35, 377, 18, 38, 17],
  ["PROTEIN LAVA CAKE", 20, 157, 8, 11, 9],
  ["PROTEIN LAZY CAKE", 18, 143, 9, 11, 7],
  ["BEEF FAJITA SANDWICH", 38, 362, 25, 34, 14],
  ["COCONUT BASBOUSA", undefined, 338, 33, 11, 18],
  ["PISTACHIO BASBOUSA", undefined, 385, 37, 12, 21],
  ["PISTACHIO BASBOUSA", 30, 385, 37, 12, 21],
  ["MATCHA CHEESE CAKE", undefined, 359, 25, 13, 23],
  ["CORDON BLEU", 42, 546, 35, 35, 22],
  ["SHISHTAWOOK SANDWICH", 34, 456, 51, 45, 8],
  ["STEAK SANDWICH", 42, 484, 39, 28, 24],
  ["TURKEY AND CHEESE CLUB SANDWICH"],
  ["BEEF LASAGNA", 48, 489, 35, 31, 25],
  ["DYNAMITE SHRIMP W/ RICE", 42, 368, 27, 29, 16],
  ["SWEET AND SOUR CHICKEN"],
  ["MANGOLIAN NOODLES", 52, 433, 34, 36, 17],
  ["BEEF KOFTA WITH SAFFRAN RICE", 50, 489, 38, 37, 21],
  ["CHICKEN TACOS", 35, 201, 14, 16, 9],
  ["ADRENALINE HEALTHY MAJBOOS", 48, 452, 33, 35, 20],
  ["CLASSIC FATTOUSH", 30, 140, 10, 7, 8],
  ["EGG SANDWICH", 28, 302, 19, 25, 14],
  ["HONEY GLAZE SALMON", 68, 447, 25, 35, 23],
  ["SPAGHETTI MEAT BALLS", 45, 450, 35, 37, 18],
  ["DYNAMITE SHRIMP", 40, 368, 27, 29, 16],
  ["NO CARB SALMON", 65, 396, 13, 32, 24],
  ["GREEK CHICKEN", 43, 441, 39, 33, 17],
  ["CHICKEN FAJITA SANDWICH", 40, 418, 35, 38, 14],
];

/**
 * قائمة الاستيكرات. حين يُمرَّر `outletId` يُقرأ السعر **لحظياً** من كتالوج ذلك
 * المنفذ بدل السعر المخزَّن في صف الاستيكر.
 *
 * لماذا: السعر المخزَّن لقطة أُخذت مرة واحدة من `posItems.posPrice`، فكان ينحرف
 * كلما تغيّر سعر المنفذ ولا يعود أحد لتحديثه — Beetroot Salad كتالوجه 25
 * واستيكره 35، وCookies كتالوجه 20 واستيكره 18. الباركود هوية المنتج، والسعر
 * يخصّ المنفذ، فيُقرأ من مصدره الواحد: شاشة «أصناف المنافذ».
 *
 * ويُطبع **سعر ما قبل الخصم**: خصم المنفذ ربحه هو، وما على العلبة هو ما يدفعه
 * الزبون في المحل.
 */
export const list = query({
  args: { outletId: v.optional(v.id("gymAccounts")), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db.query("outletProductLabels").withIndex("by_sequence").collect();
    if (!args.outletId) return rows.map((r: any) => ({ ...r, priceSource: "label" as const }));

    const cat = await ctx.db
      .query("outletCatalogItems")
      .withIndex("by_outlet", (q) => q.eq("outletId", args.outletId!))
      .collect();
    const priceByMeal = new Map<string, number>();
    cat.forEach((c: any) => { if (c.isActive) priceByMeal.set(String(c.mealId), Number(c.price)); });

    return rows.map((r: any) => {
      const live = r.publicMealId ? priceByMeal.get(String(r.publicMealId)) : undefined;
      return live === undefined
        // غير مربوط بوجبة أو ليس في كتالوج هذا المنفذ ⇒ نُبقي المخزَّن ونُعلمه
        ? { ...r, priceSource: "label" as const }
        : { ...r, price: live, priceSource: "outlet" as const };
    });
  },
});

export const seed = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const now = Date.now();
    for (let i = 0; i < LABELS.length; i++) {
      const sequence = i + 1;
      const barcode = String(100000 + sequence);
      const [nameEn, price, calories, carbs, protein, fats] = LABELS[i];
      const existing = await ctx.db.query("outletProductLabels").withIndex("by_barcode", q => q.eq("barcode", barcode)).first();
      const values = { sequence, barcode, nameEn, price, calories, carbs, protein, fats, source: "gym" as const, isActive: true, updatedAt: now };
      if (existing) await ctx.db.patch(existing._id, values);
      else await ctx.db.insert("outletProductLabels", { ...values, createdAt: now });
    }
    return { count: LABELS.length };
  },
});

/** 🔗 استيراد أصناف الأونلاين (POS) للكتالوج: يجيب الأصناف المسعّرة في الكاشير
 *   (posItems.posPrice) مع بيانات publicMeals (سعر/سعرات/ماكروز)، ويربطها بـpublicMealId.
 *   - موجود مربوط → يحدّث السعر/السعرات/الاسم (الباركود يفضل ثابت).
 *   - غير مربوط لكن نفس الاسم → يتبنّاه (يربطه) ويحدّثه بدل ما يعمل تكرار.
 *   - جديد → باركود ثابت جديد. */
export const importFromPos = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const now = Date.now();
    const metas = await ctx.db.query("posItems").collect();
    const priced = metas.filter((m: any) => m.posPrice != null && Number.isFinite(Number(m.posPrice)));

    const all = await ctx.db.query("outletProductLabels").collect();
    // كتالوج الأونلاين منفصل عن الجم: نطابق فقط الصفوف المربوطة بوجبة (online). لا نلمس أصناف الجم.
    const byMeal = new Map<string, any>();
    let maxSeq = 0;
    for (const r of all) {
      maxSeq = Math.max(maxSeq, Number(r.sequence) || 0);
      if (r.publicMealId) byMeal.set(String(r.publicMealId), r);
    }

    let added = 0, updated = 0, skipped = 0;
    for (const meta of priced) {
      const meal: any = await ctx.db.get(meta.mealId);
      if (!meal || !meal.isActive) { skipped++; continue; }
      const nameEn = (meta.displayName || meal.nameEn || meal.nameAr || "").trim();
      if (!nameEn) { skipped++; continue; }
      const data = {
        nameEn,
        price: Number(meta.posPrice),
        calories: meal.calories != null ? Number(meal.calories) : undefined,
        carbs: meal.carbs != null ? Number(meal.carbs) : undefined,
        protein: meal.protein != null ? Number(meal.protein) : undefined,
        fats: meal.fats != null ? Number(meal.fats) : undefined,
        publicMealId: meal._id,
        source: "online" as const,
        isActive: true,
        updatedAt: now,
      };
      const linked = byMeal.get(String(meal._id));
      if (linked) { await ctx.db.patch(linked._id, data); updated++; continue; }
      maxSeq += 1;
      await ctx.db.insert("outletProductLabels", { ...data, sequence: maxSeq, barcode: String(100000 + maxSeq), createdAt: now });
      added++;
    }
    return { added, updated, skipped, total: priced.length };
  },
});

export const update = mutation({
  args: {
    id: v.id("outletProductLabels"),
    nameEn: v.string(),
    price: v.optional(v.number()),
    calories: v.optional(v.number()),
    carbs: v.optional(v.number()),
    protein: v.optional(v.number()),
    fats: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const { id, sessionToken: _sessionToken, ...values } = args;
    await ctx.db.patch(id, { ...values, nameEn: values.nameEn.trim(), updatedAt: Date.now() });
    return { ok: true };
  },
});

/** حذف صنف استيكر نهائياً (لإزالة صنف غلط). قائمة مستقلة بلا مراجع، فالحذف آمن. */
export const remove = mutation({
  args: { id: v.id("outletProductLabels"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

export const create = mutation({
  args: {
    nameEn: v.string(),
    price: v.number(),
    calories: v.number(),
    carbs: v.number(),
    protein: v.number(),
    fats: v.number(),
    source: v.optional(v.union(v.literal("gym"), v.literal("online"))),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const nameEn = args.nameEn.trim();
    if (!nameEn) throw new Error("اكتب اسم الصنف");
    for (const value of [args.price, args.calories, args.carbs, args.protein, args.fats]) {
      if (!Number.isFinite(value) || value < 0) throw new Error("بيانات الاستيكر غير صالحة");
    }
    const rows = await ctx.db.query("outletProductLabels").collect();
    const sequence = rows.reduce((max, row) => Math.max(max, Number(row.sequence) || 0), 0) + 1;
    const barcode = String(100000 + sequence);
    const duplicate = await ctx.db.query("outletProductLabels").withIndex("by_barcode", q => q.eq("barcode", barcode)).first();
    if (duplicate) throw new Error("رقم الباركود مستخدم بالفعل");
    const now = Date.now();
    const id = await ctx.db.insert("outletProductLabels", {
      sequence,
      barcode,
      nameEn,
      price: args.price,
      calories: args.calories,
      carbs: args.carbs,
      protein: args.protein,
      fats: args.fats,
      source: args.source ?? "gym",
      isActive: true,
      createdAt: now,
    });
    return { id, sequence, barcode };
  },
});
