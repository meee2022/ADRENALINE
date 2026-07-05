/**
 * @file convex/seedPublicWebsite.ts
 * @description Seed data for public website (banners, plans, meals)
 */
import { mutation } from "./_generated/server";

export const seedPublicWebsite = mutation({
  handler: async (ctx) => {
    // Check if already seeded
    const existingBanner = await ctx.db.query("banners").first();
    if (existingBanner) {
      return { message: "Public website data already seeded" };
    }

    // ===== Seed Banners =====
    await ctx.db.insert("banners", {
      titleAr: "غذاء ذكي لحياة حيوية أذكى",
      titleEn: "Smart Food for Smarter Lifestyle",
      subtitleAr: "وجبات صحية ولذيذة توصل لباب بيتك",
      subtitleEn: "Healthy & delicious meals delivered to your door",
      imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200",
      sortOrder: 1,
      isActive: true,
      createdAt: Date.now(),
    });

    await ctx.db.insert("banners", {
      titleAr: "ابدأ رحلتك الصحية اليوم",
      titleEn: "Start Your Health Journey Today",
      subtitleAr: "خطط غذائية متكاملة تناسب أهدافك",
      subtitleEn: "Complete meal plans tailored to your goals",
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200",
      sortOrder: 2,
      isActive: true,
      createdAt: Date.now(),
    });

    await ctx.db.insert("banners", {
      titleAr: "وجبات متوازنة لجسم صحي",
      titleEn: "Balanced Meals for Healthy Body",
      subtitleAr: "مكونات طازجة وقيم غذائية محسوبة",
      subtitleEn: "Fresh ingredients with calculated nutrition",
      imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?w=1200",
      sortOrder: 3,
      isActive: true,
      createdAt: Date.now(),
    });

    // ===== Seed Public Plans =====
    // DIET PACK
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة التنحيف",
      nameEn: "DIET PACK",
      slug: "diet-pack",
      descriptionAr: "خطة متكاملة لخسارة الوزن بشكل صحي",
      descriptionEn: "Complete plan for healthy weight loss",
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
      ],
      sortOrder: 1,
      isActive: true,
      createdAt: Date.now(),
    });

    // BULKING PACK
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة التضخيم",
      nameEn: "BULKING PACK",
      slug: "bulking-pack",
      descriptionAr: "خطة لزيادة الكتلة العضلية",
      descriptionEn: "Plan for muscle mass gain",
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
      ],
      sortOrder: 2,
      isActive: true,
      createdAt: Date.now(),
    });

    // FITNESS PACK
    await ctx.db.insert("publicPlans", {
      nameAr: "باقة اللياقة",
      nameEn: "FITNESS PACK",
      slug: "fitness-pack",
      descriptionAr: "خطة متوازنة للحفاظ على اللياقة",
      descriptionEn: "Balanced plan for fitness maintenance",
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
      ],
      sortOrder: 3,
      isActive: true,
      createdAt: Date.now(),
    });

    // ===== Seed Public Meals =====
    // Breakfast meals
    await ctx.db.insert("publicMeals", {
      nameAr: "وعاء كينوا السلمون المشوي",
      nameEn: "Grilled Salmon Quinoa Bowl",
      slug: "grilled-salmon-quinoa-bowl",
      descriptionAr: "غداء صحي متكامل",
      descriptionEn: "Healthy complete lunch",
      aboutAr: "وجبة متوازنة تماماً مصممة لتزويدك بالطاقة المستدامة طوال اليوم. السلمون الغني بالأوميغا 3 مقرن مع الكينوا العنية بالألياف، لضمان الشبع والنشاط. مثالية للرياضيين والباحثين عن نمط حياة صحي.",
      aboutEn: "Perfectly balanced meal designed to provide sustained energy throughout the day.",
      imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
      calories: 284,
      protein: 32,
      carbs: 18,
      fats: 12,
      category: "lunch",
      tags: ["غني بالبروتين", "خالي من الغلوتين", "غني بالأوميغا 3"],
      ingredients: [
        "سلمون نرويجي منخفض بالاعتناب",
        "كينوا عضوية مسلوقة",
        "خضروات موسمية (فليفلة، طماطم، خيار)",
        "صلصة ليمون ونعناع خفيفة",
      ],
      priceQAR: 650,
      isActive: true,
      sortOrder: 1,
      createdAt: Date.now(),
    });

    await ctx.db.insert("publicMeals", {
      nameAr: "سلطة المعكرونة الملونة",
      nameEn: "Colorful Pasta Salad",
      slug: "colorful-pasta-salad",
      descriptionAr: "سلطة خفيفة ومنعشة",
      descriptionEn: "Light and refreshing salad",
      aboutAr: "سلطة مليئة بالألوان والنكهات الطبيعية. مثالية كوجبة خفيفة أو جانبية.",
      aboutEn: "Salad full of colors and natural flavors.",
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800",
      calories: 220,
      protein: 8,
      carbs: 35,
      fats: 6,
      category: "salad",
      tags: ["خفيفة", "غنية بالألياف", "نباتية"],
      ingredients: [
        "معكرونة قمح كامل",
        "طماطم كرزية",
        "خيار طازج",
        "زيتون أسود",
        "جبنة فيتا",
      ],
      priceQAR: 450,
      isActive: true,
      sortOrder: 2,
      createdAt: Date.now(),
    });

    await ctx.db.insert("publicMeals", {
      nameAr: "فطور بروتيني",
      nameEn: "Protein Breakfast",
      slug: "protein-breakfast",
      descriptionAr: "فطور صحي غني بالبروتين",
      descriptionEn: "Healthy protein-rich breakfast",
      aboutAr: "ابدأ يومك بطاقة عالية مع هذا الفطور المتكامل.",
      aboutEn: "Start your day with high energy with this complete breakfast.",
      imageUrl: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800",
      calories: 350,
      protein: 25,
      carbs: 30,
      fats: 15,
      category: "breakfast",
      tags: ["غني بالبروتين", "مشبع", "سريع التحضير"],
      ingredients: [
        "بيض مخفوق",
        "خبز توست قمح كامل",
        "أفوكادو",
        "طماطم",
      ],
      priceQAR: 550,
      isActive: true,
      sortOrder: 3,
      createdAt: Date.now(),
    });

    await ctx.db.insert("publicMeals", {
      nameAr: "دجاج مشوي مع خضار",
      nameEn: "Grilled Chicken with Vegetables",
      slug: "grilled-chicken-vegetables",
      descriptionAr: "وجبة غداء متوازنة",
      descriptionEn: "Balanced lunch meal",
      aboutAr: "دجاج طري ومشوي بشكل مثالي مع مجموعة من الخضروات الطازجة.",
      aboutEn: "Tender and perfectly grilled chicken with a variety of fresh vegetables.",
      imageUrl: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800",
      calories: 380,
      protein: 42,
      carbs: 20,
      fats: 14,
      category: "lunch",
      tags: ["غني بالبروتين", "قليل الكربوهيدرات", "خالي من الغلوتين"],
      ingredients: [
        "صدور دجاج مشوية",
        "بروكلي مطهو على البخار",
        "جزر مشوي",
        "كوسا",
      ],
      priceQAR: 600,
      isActive: true,
      sortOrder: 4,
      createdAt: Date.now(),
    });

    await ctx.db.insert("publicMeals", {
      nameAr: "سلطة البحر المتوسط",
      nameEn: "Mediterranean Salad",
      slug: "mediterranean-salad",
      descriptionAr: "سلطة منعشة بنكهة البحر المتوسط",
      descriptionEn: "Refreshing Mediterranean salad",
      aboutAr: "مزيج رائع من النكهات المتوسطية الطازجة.",
      aboutEn: "Wonderful blend of fresh Mediterranean flavors.",
      imageUrl: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800",
      calories: 180,
      protein: 6,
      carbs: 15,
      fats: 10,
      category: "salad",
      tags: ["خفيفة", "منعشة", "نباتية"],
      ingredients: [
        "خس روماني",
        "طماطم",
        "خيار",
        "زيتون",
        "جبنة فيتا",
        "زيت زيتون",
      ],
      priceQAR: 400,
      isActive: true,
      sortOrder: 5,
      createdAt: Date.now(),
    });

    await ctx.db.insert("publicMeals", {
      nameAr: "ستيك لحم بقري",
      nameEn: "Beef Steak",
      slug: "beef-steak",
      descriptionAr: "ستيك طري ولذيذ",
      descriptionEn: "Tender and delicious steak",
      aboutAr: "لحم بقري طري مشوي بشكل مثالي مع بطاطا مشوية.",
      aboutEn: "Tender beef grilled to perfection with roasted potatoes.",
      imageUrl: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800",
      calories: 520,
      protein: 48,
      carbs: 25,
      fats: 22,
      category: "dinner",
      tags: ["غني بالبروتين", "مشبع", "للرياضيين"],
      ingredients: [
        "ستيك لحم بقري",
        "بطاطا مشوية",
        "خضروات مشكلة",
      ],
      priceQAR: 850,
      isActive: true,
      sortOrder: 6,
      createdAt: Date.now(),
    });

    await ctx.db.insert("publicMeals", {
      nameAr: "سموذي الفواكه",
      nameEn: "Fruit Smoothie",
      slug: "fruit-smoothie",
      descriptionAr: "سموذي منعش وصحي",
      descriptionEn: "Refreshing and healthy smoothie",
      aboutAr: "مزيج من الفواكه الطازجة والغنية بالفيتامينات.",
      aboutEn: "Blend of fresh fruits rich in vitamins.",
      imageUrl: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800",
      calories: 150,
      protein: 4,
      carbs: 32,
      fats: 2,
      category: "snack",
      tags: ["منعش", "غني بالفيتامينات", "طبيعي"],
      ingredients: [
        "موز",
        "فراولة",
        "توت",
        "زبادي يوناني",
        "عسل",
      ],
      priceQAR: 300,
      isActive: true,
      sortOrder: 7,
      createdAt: Date.now(),
    });

    await ctx.db.insert("publicMeals", {
      nameAr: "بان كيك بروتين",
      nameEn: "Protein Pancakes",
      slug: "protein-pancakes",
      descriptionAr: "فطور حلو وصحي",
      descriptionEn: "Sweet and healthy breakfast",
      aboutAr: "بان كيك شهي وغني بالبروتين، مثالي لعشاق الفطور الحلو.",
      aboutEn: "Delicious protein-rich pancakes, perfect for sweet breakfast lovers.",
      imageUrl: "https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=800",
      calories: 320,
      protein: 22,
      carbs: 38,
      fats: 8,
      category: "breakfast",
      tags: ["حلو", "غني بالبروتين", "مشبع"],
      ingredients: [
        "دقيق شوفان",
        "بروتين باودر",
        "بيض",
        "موز",
        "عسل طبيعي",
      ],
      priceQAR: 450,
      isActive: true,
      sortOrder: 8,
      createdAt: Date.now(),
    });

    await ctx.db.insert("publicMeals", {
      nameAr: "سلطة الكينوا",
      nameEn: "Quinoa Salad",
      slug: "quinoa-salad",
      descriptionAr: "سلطة غنية بالبروتين النباتي",
      descriptionEn: "Protein-rich plant-based salad",
      aboutAr: "سلطة كينوا كاملة بالخضروات والنكهات الطازجة.",
      aboutEn: "Complete quinoa salad with vegetables and fresh flavors.",
      imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800",
      calories: 260,
      protein: 12,
      carbs: 35,
      fats: 8,
      category: "salad",
      tags: ["نباتي", "غني بالألياف", "خالي من الغلوتين"],
      ingredients: [
        "كينوا مطبوخة",
        "خيار",
        "طماطم",
        "نعناع طازج",
        "ليمون",
      ],
      priceQAR: 480,
      isActive: true,
      sortOrder: 9,
      createdAt: Date.now(),
    });

    await ctx.db.insert("publicMeals", {
      nameAr: "سمك مشوي مع أرز",
      nameEn: "Grilled Fish with Rice",
      slug: "grilled-fish-rice",
      descriptionAr: "وجبة عشاء خفيفة وصحية",
      descriptionEn: "Light and healthy dinner",
      aboutAr: "سمك طازج مشوي مع أرز بني وخضروات.",
      aboutEn: "Fresh grilled fish with brown rice and vegetables.",
      imageUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800",
      calories: 410,
      protein: 35,
      carbs: 42,
      fats: 10,
      category: "dinner",
      tags: ["غني بالبروتين", "خفيف", "أوميغا 3"],
      ingredients: [
        "فيليه سمك أبيض",
        "أرز بني",
        "خضروات مشوية",
        "ليمون وأعشاب",
      ],
      priceQAR: 680,
      isActive: true,
      sortOrder: 10,
      createdAt: Date.now(),
    });

    return {
      message: "Public website seeded successfully!",
      counts: {
        banners: 3,
        plans: 3,
        meals: 10,
      },
    };
  },
});
