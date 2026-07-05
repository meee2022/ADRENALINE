/**
 * @file convex/seedRealPlans.ts
 * @description Add all plans for all durations (week, two_weeks, month) with correct prices
 */
import { mutation } from "./_generated/server";

export const seedRealPlans = mutation({
  handler: async (ctx) => {
    // 🔒 حماية: يمسح كل الباقات ثم يعيد زرعها — معطّل افتراضياً.
    // فعّله مؤقتاً: npx convex env set ALLOW_DESTRUCTIVE true
    if (process.env.ALLOW_DESTRUCTIVE !== "true") {
      throw new Error("إعادة زرع الباقات معطّلة لأسباب أمنية (تمسح البيانات الحالية)");
    }
    // Delete existing plans
    const existingPlans = await ctx.db.query("publicPlans").collect();
    for (const plan of existingPlans) {
      await ctx.db.delete(plan._id);
    }

    // ===== DIET PACK =====
    // 1 Week
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة التنحيف",
      nameEn: "DIET PACK",
      slug: "diet-pack-week",
      descriptionAr: "خطة متكاملة لخسارة الوزن بشكل صحي - أسبوع واحد",
      descriptionEn: "Complete plan for healthy weight loss - 1 Week",
      imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600",
      duration: "week",
      options: [
        { mealsCount: 2, snacksCount: 2, priceQAR: 650 },
        { mealsCount: 3, snacksCount: 2, priceQAR: 750 },
      ],
      features: [
        "وجبات قليلة السعرات",
        "غنية بالبروتين",
        "توصيل يومي مجاني",
        "متابعة مع أخصائي تغذية",
      ],
      badge: undefined,
      isFeatured: true,
      sortOrder: 1,
      isActive: true,
      createdAt: Date.now(),
    });

    // 2 Weeks
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة التنحيف",
      nameEn: "DIET PACK",
      slug: "diet-pack-two-weeks",
      descriptionAr: "خطة متكاملة لخسارة الوزن بشكل صحي - أسبوعين",
      descriptionEn: "Complete plan for healthy weight loss - 2 Weeks",
      imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600",
      duration: "two_weeks",
      options: [
        { mealsCount: 2, snacksCount: 2, priceQAR: 1150 },
        { mealsCount: 3, snacksCount: 2, priceQAR: 1350 },
      ],
      features: [
        "وجبات قليلة السعرات",
        "غنية بالبروتين",
        "توصيل يومي مجاني",
        "متابعة مع أخصائي تغذية",
      ],
      badge: undefined,
      sortOrder: 4,
      isActive: true,
      createdAt: Date.now(),
    });

    // 1 Month
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة التنحيف",
      nameEn: "DIET PACK",
      slug: "diet-pack-month",
      descriptionAr: "خطة متكاملة لخسارة الوزن بشكل صحي - شهر كامل",
      descriptionEn: "Complete plan for healthy weight loss - 1 Month",
      imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600",
      duration: "month",
      options: [
        { mealsCount: 2, snacksCount: 2, priceQAR: 2100 },
        { mealsCount: 3, snacksCount: 2, priceQAR: 2500 },
      ],
      features: [
        "وجبات قليلة السعرات",
        "غنية بالبروتين",
        "توصيل يومي مجاني",
        "متابعة مع أخصائي تغذية",
        "خصم 10% على الشهر الكامل",
      ],
      badge: "special_offer",
      sortOrder: 7,
      isActive: true,
      createdAt: Date.now(),
    });

    // ===== FITNESS PACK =====
    // 1 Week
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة اللياقة",
      nameEn: "FITNESS PACK",
      slug: "fitness-pack-week",
      descriptionAr: "خطة متوازنة للحفاظ على اللياقة - أسبوع واحد",
      descriptionEn: "Balanced plan for fitness maintenance - 1 Week",
      imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600",
      duration: "week",
      options: [
        { mealsCount: 2, snacksCount: 2, priceQAR: 700 },
        { mealsCount: 3, snacksCount: 2, priceQAR: 800 },
      ],
      features: [
        "متوازنة البروتين والكربوهيدرات",
        "قليلة الدهون",
        "متنوعة ولذيذة",
        "توصيل يومي مجاني",
      ],
      badge: undefined,
      sortOrder: 2,
      isActive: true,
      createdAt: Date.now(),
    });

    // 2 Weeks
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة اللياقة",
      nameEn: "FITNESS PACK",
      slug: "fitness-pack-two-weeks",
      descriptionAr: "خطة متوازنة للحفاظ على اللياقة - أسبوعين",
      descriptionEn: "Balanced plan for fitness maintenance - 2 Weeks",
      imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600",
      duration: "two_weeks",
      options: [
        { mealsCount: 2, snacksCount: 2, priceQAR: 1300 },
        { mealsCount: 3, snacksCount: 2, priceQAR: 1500 },
      ],
      features: [
        "متوازنة البروتين والكربوهيدرات",
        "قليلة الدهون",
        "متنوعة ولذيذة",
        "توصيل يومي مجاني",
      ],
      badge: undefined,
      sortOrder: 5,
      isActive: true,
      createdAt: Date.now(),
    });

    // 1 Month
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة اللياقة",
      nameEn: "FITNESS PACK",
      slug: "fitness-pack-month",
      descriptionAr: "خطة متوازنة للحفاظ على اللياقة - شهر كامل",
      descriptionEn: "Balanced plan for fitness maintenance - 1 Month",
      imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600",
      duration: "month",
      options: [
        { mealsCount: 2, snacksCount: 2, priceQAR: 2400 },
        { mealsCount: 3, snacksCount: 2, priceQAR: 2800 },
      ],
      features: [
        "متوازنة البروتين والكربوهيدرات",
        "قليلة الدهون",
        "متنوعة ولذيذة",
        "توصيل يومي مجاني",
        "خصم 10% على الشهر الكامل",
      ],
      badge: undefined,
      sortOrder: 8,
      isActive: true,
      createdAt: Date.now(),
    });

    // ===== BULKING PACK =====
    // 1 Week
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة التضخيم",
      nameEn: "BULKING PACK",
      slug: "bulking-pack-week",
      descriptionAr: "خطة لزيادة الكتلة العضلية - أسبوع واحد",
      descriptionEn: "Plan for muscle mass gain - 1 Week",
      imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600",
      duration: "week",
      options: [
        { mealsCount: 3, snacksCount: 2, priceQAR: 900 },
        { mealsCount: 4, snacksCount: 2, priceQAR: 950 },
      ],
      features: [
        "عالية البروتين والكربوهيدرات",
        "وجبات كبيرة الحجم",
        "مثالية للرياضيين",
        "توصيل يومي مجاني",
      ],
      badge: undefined,
      sortOrder: 3,
      isActive: true,
      createdAt: Date.now(),
    });

    // 2 Weeks
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة التضخيم",
      nameEn: "BULKING PACK",
      slug: "bulking-pack-two-weeks",
      descriptionAr: "خطة لزيادة الكتلة العضلية - أسبوعين",
      descriptionEn: "Plan for muscle mass gain - 2 Weeks",
      imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600",
      duration: "two_weeks",
      options: [
        { mealsCount: 3, snacksCount: 2, priceQAR: 1700 },
        { mealsCount: 4, snacksCount: 2, priceQAR: 1800 },
      ],
      features: [
        "عالية البروتين والكربوهيدرات",
        "وجبات كبيرة الحجم",
        "مثالية للرياضيين",
        "توصيل يومي مجاني",
      ],
      badge: undefined,
      sortOrder: 6,
      isActive: true,
      createdAt: Date.now(),
    });

    // 1 Month
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة التضخيم",
      nameEn: "BULKING PACK",
      slug: "bulking-pack-month",
      descriptionAr: "خطة لزيادة الكتلة العضلية - شهر كامل",
      descriptionEn: "Plan for muscle mass gain - 1 Month",
      imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600",
      duration: "month",
      options: [
        { mealsCount: 3, snacksCount: 2, priceQAR: 3100 },
        { mealsCount: 4, snacksCount: 2, priceQAR: 3400 },
      ],
      features: [
        "عالية البروتين والكربوهيدرات",
        "وجبات كبيرة الحجم",
        "مثالية للرياضيين",
        "توصيل يومي مجاني",
        "خصم 10% على الشهر الكامل",
      ],
      badge: undefined,
      sortOrder: 9,
      isActive: true,
      createdAt: Date.now(),
    });

    return {
      message: "✅ Real plans seeded successfully!",
      count: 9,
    };
  },
});
