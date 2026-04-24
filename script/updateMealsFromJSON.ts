// script/updateMealsFromJSON.ts
// تحديث/إضافة الوجبات مباشرة من داخل السكربت (بدون ملف خارجي)
// ملاحظة: الماكروز (Protein/Carbs/Fats) هنا "تقديرية" كبداية، ويمكن تعديلها لاحقًا.

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const convexUrl =
  process.env.CONVEX_URL || "https://rightful-parakeet-660.convex.cloud";
const client = new ConvexHttpClient(convexUrl);

// Helper: Convert category to lowercase
function normalizeCategory(
  category: string
): "breakfast" | "lunch" | "dinner" | "salad" | "snack" {
  const cat = category.toLowerCase();
  if (cat.includes("breakfast")) return "breakfast";
  if (cat.includes("lunch")) return "lunch";
  if (cat.includes("dinner")) return "dinner";
  if (cat.includes("salad")) return "salad";
  // snack 1 / snack 2 -> snack
  return "snack";
}

// Helper: Convert week to number
function parseWeek(week: string): number {
  const match = week.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

// Helper: Convert day to lowercase format
function normalizeDay(day: string): string {
  const dayMap: Record<string, string> = {
    saturday: "saturday",
    sunday: "sunday",
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    sat: "saturday",
    sun: "sunday",
    mon: "monday",
    tue: "tuesday",
    wed: "wednesday",
    thu: "thursday",
    fri: "friday",
  };
  return dayMap[day.toLowerCase()] || "saturday";
}

// Helper: Generate slug from English name
function toSlug(nameEn: string): string {
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Helper: Map tags to Arabic
function tagsToArabic(tags: string[]): string[] {
  const tagMap: Record<string, string> = {
    chicken: "دجاج",
    beef: "لحم بقري",
    fish: "سمك",
    rice: "أرز",
    pasta: "مكرونة",
    soup: "شوربة",
    salads: "سلطات",
    salad: "سلطات",
    sandwich: "ساندويتش",
    burger: "برغر",
    sweets: "حلويات",
    desserts: "حلويات",
    egg: "بيض",
    wrap: "راب",
    vegetarian: "نباتي",
    spicy: "حار",
    "no carb": "بدون كربوهيدرات",
    drink: "مشروب",
    oatmeal: "شوفان",
    quinoa: "كينوا",
    "high protein": "غني بالبروتين",
  };

  return tags.map((t) => tagMap[t.toLowerCase()] || t);
}

// Macros estimation function
function estimateMacros(
  calories: number,
  category: "breakfast" | "lunch" | "dinner" | "salad" | "snack",
  tags: string[]
): { protein: number; carbs: number; fats: number } {
  const t = tags.map((x) => x.toLowerCase());
  const hasBeef = t.includes("beef");
  const hasChicken = t.includes("chicken");
  const hasFish = t.includes("fish");
  const isDessert = t.includes("desserts") || t.includes("sweets");
  const isSoup = t.includes("soup");
  const isSaladTag = t.includes("salads") || category === "salad";

  // Baselines by category
  let pPct = 0.28;
  let cPct = 0.45;
  let fPct = 0.27;

  if (category === "breakfast") {
    pPct = 0.22;
    cPct = 0.50;
    fPct = 0.28;
  } else if (category === "lunch" || category === "dinner") {
    pPct = 0.30;
    cPct = 0.43;
    fPct = 0.27;
  } else if (category === "snack") {
    pPct = 0.18;
    cPct = 0.55;
    fPct = 0.27;
  } else if (category === "salad") {
    pPct = 0.22;
    cPct = 0.35;
    fPct = 0.43;
  }

  // Adjustments
  if (isDessert) {
    pPct -= 0.06;
    cPct += 0.08;
    fPct -= 0.02;
  }
  if (isSoup) {
    pPct -= 0.03;
    cPct += 0.05;
    fPct -= 0.02;
  }
  if (isSaladTag) {
    cPct -= 0.05;
    fPct += 0.05;
  }
  if (hasFish) {
    pPct += 0.03;
    fPct += 0.02;
    cPct -= 0.05;
  }
  if (hasBeef || hasChicken) {
    pPct += 0.03;
    cPct -= 0.02;
    fPct -= 0.01;
  }

  // Convert macros from calories:
  const protein = Math.round((calories * pPct) / 4);
  const carbs = Math.round((calories * cPct) / 4);
  const fats = Math.round((calories * fPct) / 9);

  return {
    protein: Math.max(2, Math.min(60, protein)),
    carbs: Math.max(5, Math.min(90, carbs)),
    fats: Math.max(1, Math.min(35, fats)),
  };
}

type MealInput = {
  name_en: string;
  name_ar: string;
  short_description_en: string;
  short_description_ar: string;
  full_description_en: string;
  full_description_ar: string;
  category: string;
  weeks: number[];
  days: string[];
  calories: number;
  tags: string[];
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  priceQAR?: number;
  cutoffTime?: string;
};

// ✅ 40 وجبة (الصفحتين) مع ماكروز تقديرية
const mealsData: MealInput[] = [
  // ---------- Page 1 ----------
  {
    name_en: "Garlic Butter Steak & Potato",
    name_ar: "ستيك بزبدة الثوم والبطاطس",
    short_description_en: "Juicy steak with crispy potatoes in garlic-butter sauce.",
    short_description_ar: "ستيك طري مع بطاطس مقرمشة بصلصة زبدة الثوم.",
    full_description_en:
      "Tender, seasoned steak served with oven-crisp potatoes, finished with a rich garlic-butter glaze. Balanced, satisfying, and perfect for dinner.",
    full_description_ar:
      "ستيك متبل وطري يُقدَّم مع بطاطس مقرمشة، ولمسة صوص زبدة الثوم الغني. وجبة مشبعة ومتوازنة مناسبة للعشاء.",
    category: "Dinner",
    weeks: [2],
    days: ["sunday"],
    calories: 460,
    tags: ["Beef"],
  },
  {
    name_en: "Salmon NO Carb",
    name_ar: "سالمون بدون كربوهيدرات",
    short_description_en: "Clean salmon dinner with carb-free sides.",
    short_description_ar: "سالمون صحي مع جوانب بدون كربوهيدرات.",
    full_description_en:
      "Perfectly cooked salmon paired with fresh, carb-free sides to keep the meal light yet satisfying—ideal for a clean dinner plan.",
    full_description_ar:
      "سالمون مطهو بإتقان مع جوانب خفيفة بدون كربوهيدرات لوجبة عشاء نظيفة ومشبعة.",
    category: "Dinner",
    weeks: [2, 4],
    days: ["saturday"],
    calories: 423,
    tags: ["Fish", "Salads"],
  },
  {
    name_en: "Shishawook wrap",
    name_ar: "راب شيش طاووق",
    short_description_en: "Grilled chicken wrap with crisp veggies and signature sauce.",
    short_description_ar: "راب دجاج مشوي مع خضار مقرمشة وصوص مميز.",
    full_description_en:
      "Tender marinated chicken wrapped with fresh vegetables and a savory signature sauce. A satisfying dinner option with great balance.",
    full_description_ar:
      "دجاج متبل ومشوي داخل راب مع خضار طازجة وصوص مميز. خيار عشاء مشبع ومتوازن.",
    category: "Dinner",
    weeks: [3],
    days: ["tuesday"],
    calories: 468,
    tags: ["Chicken", "Sandwich"],
  },
  {
    name_en: "Chicken Herbs",
    name_ar: "دجاج بالأعشاب",
    short_description_en: "Herb-seasoned chicken with balanced sides.",
    short_description_ar: "دجاج متبل بالأعشاب مع جوانب متوازنة.",
    full_description_en:
      "Lean chicken with aromatic herbs served with smart sides for steady energy and clean macros—perfect for dinner.",
    full_description_ar:
      "دجاج قليل الدهن متبل بالأعشاب العطرية مع جوانب ذكية لطاقة ثابتة وقيم غذائية نظيفة.",
    category: "Dinner",
    weeks: [2, 4],
    days: ["sunday"],
    calories: 430,
    tags: ["Chicken", "Rice"],
  },
  {
    name_en: "Buffalo Chicken Wrap",
    name_ar: "راب دجاج بافلو",
    short_description_en: "Spicy buffalo chicken wrap with crunchy veggies.",
    short_description_ar: "راب دجاج بافلو حار مع خضار مقرمشة.",
    full_description_en:
      "Zesty buffalo chicken with crisp lettuce and a cool, balanced finish—wrapped for an easy, satisfying dinner.",
    full_description_ar:
      "دجاج بافلو بنكهة حارة مع خس وخضار منعشة داخل راب عملي ومشبع للعشاء.",
    category: "Dinner",
    weeks: [2, 4],
    days: ["monday"],
    calories: 475,
    tags: ["Chicken", "Wrap"],
  },
  {
    name_en: "Beef Shawarma Sandwich",
    name_ar: "ساندويتش شاورما لحم",
    short_description_en: "Juicy beef shawarma sandwich with fresh add-ons.",
    short_description_ar: "ساندويتش شاورما لحم مع إضافات طازجة.",
    full_description_en:
      "Spiced beef shawarma, roasted to perfection, served as a satisfying sandwich with fresh veggies and a light sauce.",
    full_description_ar:
      "شاورما لحم متبلة ومحمّرة بإتقان داخل ساندويتش مع خضار طازجة وصوص خفيف.",
    category: "Dinner",
    weeks: [4],
    days: ["tuesday"],
    calories: 465,
    tags: ["Beef", "Sandwich"],
  },
  {
    name_en: "Chicken Majbous",
    name_ar: "مجبوس الدجاج",
    short_description_en: "Traditional Gulf chicken majbous with aromatic rice.",
    short_description_ar: "مجبوس دجاج خليجي مع أرز عطِر.",
    full_description_en:
      "A fragrant Gulf classic—tender chicken cooked with aromatic rice and warm spices. Comforting and balanced for dinner.",
    full_description_ar:
      "طبق خليجي أصيل: دجاج طري مطهو مع أرز عطِر وتوابل دافئة. خيار عشاء مريح ومتوازن.",
    category: "Dinner",
    weeks: [4],
    days: ["wednesday"],
    calories: 452,
    tags: ["Chicken", "Rice"],
  },
  {
    name_en: "Dawoud Basha",
    name_ar: "داوود باشا",
    short_description_en: "Meatballs with tomato sauce and potatoes, classic comfort.",
    short_description_ar: "كرات لحم بصلصة الطماطم والبطاطس بطابع شرقي.",
    full_description_en:
      "A Middle Eastern comfort dish featuring tender meatballs in tomato sauce with potatoes—served as a hearty dinner.",
    full_description_ar:
      "وجبة شرقية مريحة: كرات لحم طرية بصلصة الطماطم مع بطاطس، مناسبة لعشاء مشبع.",
    category: "Dinner",
    weeks: [2, 4],
    days: ["monday"],
    calories: 499,
    tags: ["Beef", "Rice"],
  },
  {
    name_en: "Beef Burger",
    name_ar: "برغر لحم",
    short_description_en: "Juicy grilled beef burger with a classic bun.",
    short_description_ar: "برغر لحم مشوي عصيري مع خبز طري.",
    full_description_en:
      "A satisfying beef burger grilled to perfection, served on a toasted bun with fresh toppings.",
    full_description_ar:
      "برغر لحم مشوي بإتقان داخل خبز محمص مع إضافات طازجة لوجبة مشبعة.",
    category: "Dinner",
    weeks: [2, 4],
    days: ["thursday"],
    calories: 500,
    tags: ["Beef", "Burger"],
  },
  {
    name_en: "Chicken Parmesan",
    name_ar: "دجاج بارميزان",
    short_description_en: "Crispy chicken topped with marinara and parmesan.",
    short_description_ar: "دجاج مقرمش مع صلصة مارينارا وبارميزان.",
    full_description_en:
      "Golden, crispy chicken cutlet finished with a rich marinara-style sauce—comforting and perfect for dinner.",
    full_description_ar:
      "صدر دجاج مقرمش بلون ذهبي مع صلصة طماطم غنية ولمسة بارميزان—عشاء مريح ومميز.",
    category: "Dinner",
    weeks: [1],
    days: ["monday"],
    calories: 487,
    tags: ["Chicken"],
  },
  {
    name_en: "Stuffed Pepper",
    name_ar: "فلفل محشي",
    short_description_en: "Tender bell peppers filled with savory beef and rice.",
    short_description_ar: "فلفل رومي محشي بلحم وأرز بنكهة غنية.",
    full_description_en:
      "Roasted bell peppers stuffed with a savory beef-and-rice mix, baked until tender—hearty and balanced for dinner.",
    full_description_ar:
      "فلفل رومي مشوي محشي بخليط لحم وأرز متبل، مطهو حتى يصبح طريًا—عشاء مشبع ومتوازن.",
    category: "Dinner",
    weeks: [3],
    days: ["sunday"],
    calories: 491,
    tags: ["Beef", "Rice"],
  },
  {
    name_en: "Crispy Chicken Strips",
    name_ar: "شرائح دجاج مقرمشة",
    short_description_en: "Golden crispy chicken strips with a light side.",
    short_description_ar: "شرائح دجاج مقرمشة بلون ذهبي مع جانب خفيف.",
    full_description_en:
      "Crunchy, juicy chicken strips prepared with a crisp coating—great as a satisfying dinner with controlled portions.",
    full_description_ar:
      "شرائح دجاج مقرمشة وعصيرية بقشرة خفيفة—خيار عشاء عملي ومشبع بحصص محسوبة.",
    category: "Dinner",
    weeks: [3],
    days: ["saturday"],
    calories: 474,
    tags: ["Chicken", "Rice"],
  },
  {
    name_en: "Southwest Chicken Wrap",
    name_ar: "راب دجاج ساوث ويست",
    short_description_en: "Chicken wrap with beans, corn, peppers, and southwest flavor.",
    short_description_ar: "راب دجاج بنكهات ساوث ويست مع فاصوليا وذرة وفلفل.",
    full_description_en:
      "A flavor-packed wrap with grilled chicken, beans, corn, and peppers—balanced and perfect for a quick dinner.",
    full_description_ar:
      "راب غني بالنكهة يجمع الدجاج المشوي مع الفاصوليا والذرة والفلفل—عشاء سريع ومتوازن.",
    category: "Dinner",
    weeks: [1],
    days: ["tuesday"],
    calories: 433,
    tags: ["Chicken", "Sandwich"],
  },
  {
    name_en: "Shrimp Tacos",
    name_ar: "تاكوس الروبيان",
    short_description_en: "Coastal-style shrimp tacos with fresh toppings.",
    short_description_ar: "تاكوس روبيان بنكهة بحرية مع إضافات طازجة.",
    full_description_en:
      "Soft tortillas filled with tender shrimp and crisp toppings—light, tasty, and ideal for dinner.",
    full_description_ar:
      "تورتيلا طرية محشوة بروبيان طري مع إضافات مقرمشة—خفيف ولذيذ ومناسب للعشاء.",
    category: "Dinner",
    weeks: [1],
    days: ["sunday"],
    calories: 469,
    tags: ["Fish", "Sandwich"],
  },
  {
    name_en: "Honey Glaze Salmon",
    name_ar: "سالمون بالعسل",
    short_description_en: "Pan-seared salmon with a sweet, savory honey glaze.",
    short_description_ar: "سالمون مشوي بصلصة عسل حلوة-مالحة.",
    full_description_en:
      "Flaky salmon finished with a honey glaze for a balanced sweet-savory flavor—great as a satisfying dinner.",
    full_description_ar:
      "سالمون طري بلمسة صوص عسل تمنح توازنًا بين الحلو والمالح—خيار عشاء ممتاز.",
    category: "Dinner",
    weeks: [1],
    days: ["saturday"],
    calories: 507,
    tags: ["Fish"],
  },
  {
    name_en: "Shishatwook with Rice",
    name_ar: "شيش طاووق مع أرز",
    short_description_en: "Grilled shish tawook served with fluffy rice.",
    short_description_ar: "شيش طاووق مشوي مع أرز خفيف.",
    full_description_en:
      "Tender marinated chicken skewers served with seasoned rice—clean, filling, and great for lunch.",
    full_description_ar:
      "أسياخ دجاج شيش طاووق متبلة ومشوية تُقدّم مع أرز متبل—غداء نظيف ومشبع.",
    category: "Lunch",
    weeks: [1],
    days: ["wednesday"],
    calories: 455,
    tags: ["Chicken", "Rice"],
  },
  {
    name_en: "Chicken Alfredo",
    name_ar: "دجاج ألفريدو",
    short_description_en: "Grilled chicken with creamy alfredo-style pasta.",
    short_description_ar: "دجاج مشوي مع مكرونة بصوص ألفريدو كريمي.",
    full_description_en:
      "Tender grilled chicken served with a creamy alfredo-style pasta—comforting lunch with balanced portions.",
    full_description_ar:
      "دجاج مشوي طري مع مكرونة بصوص ألفريدو كريمي—غداء مريح بحصص متوازنة.",
    category: "Lunch",
    weeks: [3],
    days: ["thursday"],
    calories: 487,
    tags: ["Chicken", "Rice"],
  },
  {
    name_en: "Beef Alfredo",
    name_ar: "ألفريدو اللحم البقري",
    short_description_en: "Beef alfredo with a velvety house-style sauce.",
    short_description_ar: "ألفريدو لحم بصوص كريمي مخملي.",
    full_description_en:
      "Savory beef served in a rich, velvety alfredo-style sauce—built as a satisfying lunch meal.",
    full_description_ar:
      "لحم بقري بنكهة غنية مع صوص ألفريدو كريمي مخملي—غداء مشبع ومميز.",
    category: "Lunch",
    weeks: [1],
    days: ["monday"],
    calories: 496,
    tags: ["Beef", "Rice"],
  },
  {
    name_en: "Beef Stragnoff",
    name_ar: "ستروغانوف اللحم البقري",
    short_description_en: "Beef strips with mushrooms in a creamy sauce.",
    short_description_ar: "شرائح لحم مع فطر بصلصة كريمية.",
    full_description_en:
      "Tender beef strips and mushrooms in a creamy sauce, served over rice—comforting and balanced for lunch.",
    full_description_ar:
      "شرائح لحم طرية مع الفطر بصلصة كريمية، تُقدّم مع الأرز—غداء مريح ومتوازن.",
    category: "Lunch",
    weeks: [1],
    days: ["tuesday"],
    calories: 440,
    tags: ["Beef", "Rice"],
  },
  {
    name_en: "Chicken Teryaki",
    name_ar: "دجاج ترياكي",
    short_description_en: "Glazed teriyaki chicken with rice for steady energy.",
    short_description_ar: "دجاج ترياكي بصوص لامع مع أرز لطاقة ثابتة.",
    full_description_en:
      "Juicy chicken glazed in a savory teriyaki-style sauce, served with rice—clean, satisfying lunch.",
    full_description_ar:
      "دجاج طري بصوص ترياكي لذيذ يُقدّم مع الأرز—غداء نظيف ومشبع.",
    category: "Lunch",
    weeks: [1],
    days: ["saturday"],
    calories: 491,
    tags: ["Chicken", "Rice"],
  },
  {
    name_en: "Sweet Chilly Chicken",
    name_ar: "دجاج بالفلفل الحلو",
    short_description_en: "Crispy chicken in a sweet-chili signature sauce.",
    short_description_ar: "دجاج مقرمش بصوص فلفل حلو مميز.",
    full_description_en:
      "Crispy chicken tossed in a sweet-chili sauce for a perfect balance of flavor—great lunch with rice.",
    full_description_ar:
      "دجاج مقرمش بصوص الفلفل الحلو بتوازن ممتاز—غداء رائع مع الأرز.",
    category: "Lunch",
    weeks: [2, 4],
    days: ["thursday"],
    calories: 497,
    tags: ["Chicken", "Rice"],
  },
  {
    name_en: "Cajun Shrimp Pasta",
    name_ar: "مكرونة روبيان كاجون",
    short_description_en: "Creamy cajun shrimp pasta with bold spice.",
    short_description_ar: "مكرونة روبيان كاجون ببهارات قوية وصوص كريمي.",
    full_description_en:
      "Perfectly cooked shrimp with pasta in a cajun-inspired creamy sauce—bold, satisfying, and ideal for lunch.",
    full_description_ar:
      "روبيان مطهو بإتقان مع المكرونة وصوص كريمي بنكهة الكاجون—غداء قوي ومشبع.",
    category: "Lunch",
    weeks: [3],
    days: ["monday"],
    calories: 491,
    tags: ["Fish", "Pasta"],
  },
  {
    name_en: "Cajun chicken Pasta",
    name_ar: "باستا الدجاج بالكاجون",
    short_description_en: "Creamy cajun chicken pasta with a rich finish.",
    short_description_ar: "مكرونة دجاج بالكاجون بلمسة كريمية.",
    full_description_en:
      "Cajun-spiced chicken with pasta in a creamy sauce—balanced, flavorful lunch.",
    full_description_ar:
      "دجاج متبل بالكاجون مع مكرونة وصوص كريمي—غداء لذيذ ومتوازن.",
    category: "Lunch",
    weeks: [4],
    days: ["monday"],
    calories: 498,
    tags: ["Chicken", "Pasta"],
  },
  {
    name_en: "Mongolian Beef with Noodles",
    name_ar: "لحم منغولي بالنودلز",
    short_description_en: "Stir-fried beef with noodles and crisp veggies.",
    short_description_ar: "لحم سوتيه مع نودلز وخضار مقرمشة.",
    full_description_en:
      "Tender beef and noodles wok-tossed with vegetables—high flavor and satisfying lunch.",
    full_description_ar:
      "لحم طري مع نودلز وخضار على طريقة الووك—نكهة قوية وغداء مشبع.",
    category: "Lunch",
    weeks: [3],
    days: ["thursday"],
    calories: 514,
    tags: ["Beef", "Pasta"],
  },
  {
    name_en: "Chicken Curry with Rice",
    name_ar: "كاري الدجاج مع الأرز",
    short_description_en: "Aromatic chicken curry served with rice.",
    short_description_ar: "كاري دجاج عطِر يُقدَّم مع الأرز.",
    full_description_en:
      "Tender chicken cooked in a flavorful curry sauce, served with rice—comforting lunch with steady energy.",
    full_description_ar:
      "دجاج طري مطهو في صوص كاري غني بالنكهة ويُقدّم مع الأرز—غداء مريح وطاقة ثابتة.",
    category: "Lunch",
    weeks: [1],
    days: ["sunday"],
    calories: 486,
    tags: ["Chicken", "Rice"],
  },
  {
    name_en: "Lemon Chicken",
    name_ar: "دجاج بالليمون",
    short_description_en: "Tender chicken with a bright lemon glaze.",
    short_description_ar: "دجاج طري بلمسة ليمون منعشة.",
    full_description_en:
      "Perfectly seasoned chicken finished with a zesty lemon glaze, served with rice—fresh and balanced lunch.",
    full_description_ar:
      "دجاج متبل بإتقان مع صوص ليمون منعش ويُقدّم مع الأرز—غداء خفيف ومتوازن.",
    category: "Lunch",
    weeks: [2],
    days: ["tuesday"],
    calories: 422,
    tags: ["Chicken", "Rice"],
  },
  {
    name_en: "Creamy Garlic Chicken",
    name_ar: "دجاج بالثوم الكريمي",
    short_description_en: "Juicy chicken in a creamy garlic sauce.",
    short_description_ar: "دجاج عصيري بصلصة ثوم كريمية.",
    full_description_en:
      "Chicken breast smothered in a creamy garlic sauce and served with rice—comforting, high-protein lunch.",
    full_description_ar:
      "صدر دجاج بصلصة ثوم كريمية ويُقدَّم مع الأرز—غداء مريح وغني بالبروتين.",
    category: "Lunch",
    weeks: [1],
    days: ["thursday"],
    calories: 450,
    tags: ["Chicken", "Rice"],
  },

  // --- Breakfasts ---
  {
    name_en: "Chocolate Peanut Butter",
    name_ar: "زبدة الفول السوداني بالشوكولاتة",
    short_description_en: "Creamy peanut butter & chocolate combo for breakfast.",
    short_description_ar: "مزيج زبدة فول سوداني وشوكولاتة لفطور لذيذ.",
    full_description_en:
      "A breakfast treat combining creamy peanut butter and rich chocolate notes—balanced sweetness with a satisfying bite.",
    full_description_ar:
      "فطور بطعم مميز يجمع زبدة الفول السوداني مع لمسة شوكولاتة—حلاوة محسوبة وشبع لطيف.",
    category: "Breakfast",
    weeks: [2],
    days: ["wednesday"],
    calories: 316,
    tags: ["Sweets", "Desserts"],
  },
  {
    name_en: "Croissant Zaatar",
    name_ar: "كرواسون بالزعتر",
    short_description_en: "Flaky croissant with savory zaatar.",
    short_description_ar: "كرواسون هش بنكهة الزعتر.",
    full_description_en:
      "A golden flaky croissant finished with aromatic zaatar—simple, satisfying breakfast.",
    full_description_ar:
      "كرواسون ذهبي هش بلمسة زعتر عطرية—فطور بسيط ومشبع.",
    category: "Breakfast",
    weeks: [2, 4],
    days: ["sunday"],
    calories: 291,
    tags: ["Sandwich"],
  },
  {
    name_en: "Egg Quesadilla",
    name_ar: "كاساديا البيض",
    short_description_en: "Egg quesadilla with melted cheese, breakfast-ready.",
    short_description_ar: "كاساديا بيض مع جبن ذائب مناسبة للفطور.",
    full_description_en:
      "Perfectly cooked eggs with melted cheese inside a warm tortilla—quick, satisfying breakfast.",
    full_description_ar:
      "بيض مطهو بإتقان مع جبن ذائب داخل تورتيلا دافئة—فطور سريع ومشبع.",
    category: "Breakfast",
    weeks: [3],
    days: ["thursday"],
    calories: 279,
    tags: ["Egg", "Sandwich"],
  },
  {
    name_en: "Mexican Omelette",
    name_ar: "أومليت مكسيكي",
    short_description_en: "Fluffy omelette with zesty Mexican-inspired flavor.",
    short_description_ar: "أومليت بنكهة مكسيكية خفيفة ومنعشة.",
    full_description_en:
      "A hearty omelette with a zesty profile—great for a protein-forward breakfast.",
    full_description_ar:
      "أومليت مشبع بنكهة لطيفة—خيار فطور غني بالبروتين.",
    category: "Breakfast",
    weeks: [4],
    days: ["monday"],
    calories: 265,
    tags: ["Egg"],
  },
  {
    name_en: "Egg Burrito",
    name_ar: "بوريتو البيض",
    short_description_en: "Breakfast burrito packed with fluffy eggs.",
    short_description_ar: "بوريتو فطور محشو ببيض طري.",
    full_description_en:
      "A simple, satisfying breakfast burrito with scrambled eggs—easy, filling, and balanced.",
    full_description_ar:
      "بوريتو فطور عملي ومشبع ببيض مخفوق—متوازن وسهل.",
    category: "Breakfast",
    weeks: [1],
    days: ["tuesday"],
    calories: 311,
    tags: ["Egg", "Sandwich"],
  },
  {
    name_en: "Egg with Zaatar",
    name_ar: "بيض مع الزعتر",
    short_description_en: "Eggs with zaatar for a savory breakfast bite.",
    short_description_ar: "بيض مع زعتر لفطور مالح ولذيذ.",
    full_description_en:
      "A savory breakfast featuring eggs with aromatic zaatar—simple and satisfying.",
    full_description_ar:
      "فطور مالح يجمع البيض مع نكهة الزعتر العطرية—بسيط ومشبع.",
    category: "Breakfast",
    weeks: [1],
    days: ["saturday"],
    calories: 284,
    tags: ["Egg", "Sandwich"],
  },
  {
    name_en: "Egg Avocado Sandwich",
    name_ar: "شطيرة البيض والأفوكادو",
    short_description_en: "Creamy avocado with eggs in a balanced breakfast sandwich.",
    short_description_ar: "أفوكادو كريمي مع بيض داخل ساندويتش فطور متوازن.",
    full_description_en:
      "A satisfying sandwich combining eggs and avocado for a smart mix of protein and healthy fats.",
    full_description_ar:
      "ساندويتش يجمع البيض مع الأفوكادو لمزيج ذكي من البروتين والدهون الصحية.",
    category: "Breakfast",
    weeks: [4],
    days: ["wednesday"],
    calories: 290,
    tags: ["Egg", "Sandwich"],
  },
  {
    name_en: "Egg Shashouka",
    name_ar: "شكشوكة البيض",
    short_description_en: "Eggs simmered in a rich tomato-based sauce.",
    short_description_ar: "بيض مطهو في صلصة طماطم غنية.",
    full_description_en:
      "A comforting shakshouka-style breakfast with poached eggs in a rich sauce—warm and satisfying.",
    full_description_ar:
      "شكشوكة بطابع مريح: بيض مطهو في صلصة غنية—دافئة ومشبعة.",
    category: "Breakfast",
    weeks: [2, 3],
    days: ["tuesday", "wednesday"],
    calories: 280,
    tags: ["Egg"],
  },
  {
    name_en: "Egg Muffin",
    name_ar: "فطيرة البيض",
    short_description_en: "Quick egg muffin breakfast with a fluffy bite.",
    short_description_ar: "فطور سريع فطيرة بيض خفيفة ومشبعة.",
    full_description_en:
      "A quick and delicious breakfast packed with eggs—light, portable, and portion-controlled.",
    full_description_ar:
      "فطور سريع ولذيذ غني بالبيض—خفيف وسهل وحصته محسوبة.",
    category: "Breakfast",
    weeks: [3],
    days: ["saturday"],
    calories: 295,
    tags: ["Egg", "Burger"],
  },
  {
    name_en: "Oriental Breakfast",
    name_ar: "فطور شرقي",
    short_description_en: "A taste of tradition with an oriental breakfast plate.",
    short_description_ar: "فطور شرقي بطابع تقليدي ونكهات أصيلة.",
    full_description_en:
      "A classic oriental-style breakfast built for a satisfying start—simple, flavorful, and comforting.",
    full_description_ar:
      "فطور شرقي كلاسيكي لبداية مشبعة—بسيط ولذيذ ومريح.",
    category: "Breakfast",
    weeks: [2, 4],
    days: ["saturday"],
    calories: 303,
    tags: ["Breakfast"],
  },
  {
    name_en: "Foul",
    name_ar: "فول",
    short_description_en: "Classic fava beans breakfast, slow-cooked and comforting.",
    short_description_ar: "فول تقليدي مطهو ببطء بطابع مريح.",
    full_description_en:
      "A traditional fava beans dish, served warm for a hearty and satisfying breakfast.",
    full_description_ar:
      "طبق فول تقليدي يُقدّم دافئًا—فطور مشبع ومريح.",
    category: "Breakfast",
    weeks: [4],
    days: ["tuesday"],
    calories: 305,
    tags: ["Breakfast"],
  },
  {
    name_en: "Egg Sandwich",
    name_ar: "شطيرة بيض",
    short_description_en: "Fluffy eggs in a classic breakfast sandwich.",
    short_description_ar: "بيض طري داخل ساندويتش فطور كلاسيكي.",
    full_description_en:
      "A simple egg sandwich with balanced portions—reliable, filling, and easy.",
    full_description_ar:
      "ساندويتش بيض بسيط بحصة مناسبة—عملي ومشبع.",
    category: "Breakfast",
    weeks: [2],
    days: ["sunday"],
    calories: 289,
    tags: ["Egg", "Sandwich"],
  },

  // --- Snacks / Soups / Salads / Desserts ---
  {
    name_en: "Fruit Salad",
    name_ar: "سلطة فواكه",
    short_description_en: "Fresh seasonal fruit salad—light and refreshing.",
    short_description_ar: "سلطة فواكه موسمية—خفيفة ومنعشة.",
    full_description_en:
      "A colorful mix of seasonal fruits—naturally sweet, refreshing, and perfect as a clean snack.",
    full_description_ar:
      "مزيج ملون من فواكه موسمية بحلاوة طبيعية—منعش ومناسب كسناك نظيف.",
    category: "Snack",
    weeks: [2, 3, 4],
    days: ["sunday", "thursday"],
    calories: 138,
    tags: ["Salads"],
  },
  {
    name_en: "Waldorf salad",
    name_ar: "سلطة والدورف",
    short_description_en: "Crisp apple salad with a light creamy touch.",
    short_description_ar: "سلطة تفاح مقرمشة بلمسة كريمية خفيفة.",
    full_description_en:
      "A classic Waldorf-style salad with crisp apples and fresh elements—light, crunchy, and refreshing.",
    full_description_ar:
      "سلطة والدورف بطابع كلاسيكي مع تفاح مقرمش ومكونات منعشة—خفيفة ولذيذة.",
    category: "Snack",
    weeks: [1, 3],
    days: ["wednesday", "saturday"],
    calories: 138,
    tags: ["Salads"],
  },
  {
    name_en: "Crab Salad",
    name_ar: "سلطة السلطعون",
    short_description_en: "Crab salad with celery and a light creamy dressing.",
    short_description_ar: "سلطة سلطعون مع كرفس وصوص كريمي خفيف.",
    full_description_en:
      "A refreshing seafood salad made with crab and crisp veggies—clean and flavorful as a snack.",
    full_description_ar:
      "سلطة بحرية منعشة بالسلطعون وخضار مقرمشة—خيار سناك نظيف ومميز.",
    category: "Snack",
    weeks: [1, 3],
    days: ["tuesday"],
    calories: 129,
    tags: ["Salads"],
  },
  {
    name_en: "Mediterrnnen Feta Salad",
    name_ar: "سلطة الجبن الفيتا المتوسطية",
    short_description_en: "Greens, tomatoes, cucumbers, olives, and feta with a zesty dressing.",
    short_description_ar: "خضار طازجة مع طماطم وخيار وزيتون وفيتا بتتبيلة ليمونية.",
    full_description_en:
      "A crisp Mediterranean salad featuring crunchy vegetables, olives, and feta cheese, finished with a light lemon-herb dressing.",
    full_description_ar:
      "سلطة متوسطية منعشة تجمع خضارًا مقرمشة مع الزيتون والفيتا وصوص ليمون وأعشاب خفيف.",
    category: "Snack",
    weeks: [1, 2, 3, 4],
    days: ["thursday"],
    calories: 123,
    tags: ["Salads"],
  },
  {
    name_en: "Passion Fruit Quinoa Salad",
    name_ar: "سلطة كينوا بفاكهة الباشن",
    short_description_en: "Vibrant quinoa salad with tropical passion fruit notes.",
    short_description_ar: "سلطة كينوا منعشة بلمسة فاكهة الباشن.",
    full_description_en:
      "A refreshing salad combining quinoa and crisp greens with a bright passion-fruit inspired flavor—light and clean.",
    full_description_ar:
      "سلطة تجمع الكينوا مع خضار مقرمشة ولمسة نكهة الباشن—خفيفة ونظيفة.",
    category: "Snack",
    weeks: [2, 3, 4],
    days: ["monday", "wednesday"],
    calories: 148,
    tags: ["Salads"],
  },
  {
    name_en: "Pistachio Salad",
    name_ar: "سلطة الفستق",
    short_description_en: "Fresh greens with crunchy pistachios and a light dressing.",
    short_description_ar: "خضار طازجة مع فستق مقرمش وتتبيلة خفيفة.",
    full_description_en:
      "A light salad with fresh greens and crunchy pistachios—refreshing, clean, and satisfying.",
    full_description_ar:
      "سلطة خفيفة بخضار طازجة وفستق مقرمش—منعشة ونظيفة ومشبعة.",
    category: "Snack",
    weeks: [1, 3],
    days: ["monday", "sunday"],
    calories: 144,
    tags: ["Salads"],
  },
  {
    name_en: "Beetroot Salad",
    name_ar: "سلطة الشمندر",
    short_description_en: "Roasted beetroot with fresh greens and a tangy finish.",
    short_description_ar: "شمندر مشوي مع خضار طازجة ولمسة حامضة.",
    full_description_en:
      "A vibrant beetroot salad—naturally sweet, colorful, and perfect as a light snack.",
    full_description_ar:
      "سلطة شمندر ملونة بحلاوة طبيعية—خيار مثالي كسناك خفيف.",
    category: "Snack",
    weeks: [2],
    days: ["sunday"],
    calories: 140,
    tags: ["Salads"],
  },
  {
    name_en: "Chicken Ceasar Salad",
    name_ar: "سلطة سيزر بالدجاج",
    short_description_en: "Classic Caesar salad with chicken in a lighter style.",
    short_description_ar: "سلطة سيزر بالدجاج بطابع أخف.",
    full_description_en:
      "Crisp greens topped with chicken and a lighter Caesar-style dressing—fresh, filling, and protein-friendly.",
    full_description_ar:
      "خس مقرمش مع دجاج وصوص سيزر خفيف—منعش ومشبع وغني بالبروتين.",
    category: "Snack",
    weeks: [1, 2],
    days: ["sunday", "saturday"],
    calories: 161,
    tags: ["Salads", "Chicken"],
  },
  {
    name_en: "Vegetable Soup",
    name_ar: "شوربة الخضار",
    short_description_en: "Warm vegetable soup with a clean seasoned broth.",
    short_description_ar: "شوربة خضار دافئة بمرق خفيف ومتبل.",
    full_description_en:
      "A light, nourishing soup made with mixed vegetables—low-calorie comfort, ideal as a snack.",
    full_description_ar:
      "شوربة خضار خفيفة ومغذية—مريحة وقليلة السعرات ومناسبة كسناك.",
    category: "Snack",
    weeks: [2, 3],
    days: ["wednesday", "thursday"],
    calories: 131,
    tags: ["Soup"],
  },
  {
    name_en: "Mushroom Soup",
    name_ar: "شوربة الفطر",
    short_description_en: "Smooth mushroom soup with a light creamy base.",
    short_description_ar: "شوربة فطر ناعمة بقاعدة كريمية خفيفة.",
    full_description_en:
      "A comforting mushroom soup made lighter for clean plans—warm and easy to enjoy.",
    full_description_ar:
      "شوربة فطر مريحة بنسخة أخف تناسب الخطط الصحية—دافئة وسهلة.",
    category: "Snack",
    weeks: [3],
    days: ["sunday"],
    calories: 130,
    tags: ["Soup"],
  },
  {
    name_en: "Lentil Soup",
    name_ar: "شوربة العدس",
    short_description_en: "Classic lentil soup—nutritious and comforting.",
    short_description_ar: "شوربة عدس كلاسيكية—مغذية ومريحة.",
    full_description_en:
      "A wholesome lentil soup with a comforting taste—great as a light snack alongside your plan.",
    full_description_ar:
      "شوربة عدس مفيدة بطابع مريح—خيار ممتاز كسناك خفيف ضمن خطتك.",
    category: "Snack",
    weeks: [1, 2, 3, 4],
    days: ["monday", "tuesday"],
    calories: 138,
    tags: ["Soup"],
  },
  {
    name_en: "Brocculi Soup",
    name_ar: "شوربة البروكلي",
    short_description_en: "Creamy broccoli soup—light and comforting.",
    short_description_ar: "شوربة بروكلي كريمية—خفيفة ومريحة.",
    full_description_en:
      "A cozy broccoli soup with a creamy texture—perfect as a warm snack.",
    full_description_ar:
      "شوربة بروكلي بطابع كريمي لطيف—مناسبة كسناك دافئ.",
    category: "Snack",
    weeks: [3],
    days: ["saturday"],
    calories: 104,
    tags: ["Soup"],
  },
  {
    name_en: "Chia Seed Pudding",
    name_ar: "بودينغ بذور الشيا",
    short_description_en: "Creamy chia pudding packed with nutrients.",
    short_description_ar: "بودينغ شيا كريمي غني بالعناصر.",
    full_description_en:
      "A wholesome chia seed pudding with a creamy texture—light, satisfying, and great as a snack.",
    full_description_ar:
      "بودينغ شيا بقوام كريمي—خفيف ومشبع ومناسب كسناك.",
    category: "Snack",
    weeks: [2, 4],
    days: ["tuesday"],
    calories: 133,
    tags: ["Desserts", "Sweets"],
  },
  {
    name_en: "Rice Pudding",
    name_ar: "بودينغ الأرز",
    short_description_en: "Classic rice pudding with a gentle creamy finish.",
    short_description_ar: "بودينغ أرز كلاسيكي بقوام كريمي لطيف.",
    full_description_en:
      "A comforting rice pudding crafted with controlled sweetness—perfect as a light dessert snack.",
    full_description_ar:
      "بودينغ أرز مريح بحلاوة محسوبة—مناسب كسناك تحلية خفيف.",
    category: "Snack",
    weeks: [2, 4],
    days: ["thursday"],
    calories: 186,
    tags: ["Desserts", "Sweets"],
  },
  {
    name_en: "Raspberry Rice Pudding",
    name_ar: "بودينغ الأرز بالتوت",
    short_description_en: "Creamy rice pudding with raspberry notes.",
    short_description_ar: "بودينغ أرز كريمي بلمسة توت.",
    full_description_en:
      "A creamy rice pudding with tangy raspberry flavor—sweet, light, and satisfying as a snack.",
    full_description_ar:
      "بودينغ أرز كريمي بنكهة توت منعشة—تحلية خفيفة ومشبعة.",
    category: "Snack",
    weeks: [3],
    days: ["thursday"],
    calories: 185,
    tags: ["Desserts", "Sweets"],
  },
  {
    name_en: "Dates Balls",
    name_ar: "كرات التمر",
    short_description_en: "Simple date balls—sweet, quick, and satisfying.",
    short_description_ar: "كرات تمر بسيطة—حلوة وسهلة ومشبعة.",
    full_description_en:
      "A naturally sweet snack made from ground dates, rolled into bite-sized balls—perfect when you want a small treat.",
    full_description_ar:
      "سناك طبيعي بحلاوة التمر، على شكل كرات صغيرة—مناسب كتحلية خفيفة.",
    category: "Snack",
    weeks: [1],
    days: ["wednesday"],
    calories: 182,
    tags: ["Desserts", "Sweets"],
  },
  {
    name_en: "Cookies",
    name_ar: "كوكيز",
    short_description_en: "Soft cookies with a wholesome comforting taste.",
    short_description_ar: "كوكيز طري بطعم مريح وسعرات محسوبة.",
    full_description_en:
      "A portion-controlled cookie snack designed to satisfy sweet cravings without overdoing calories.",
    full_description_ar:
      "كوكيز بحصة مناسبة ليشبع رغبتك في الحلو دون مبالغة بالسعرات.",
    category: "Snack",
    weeks: [2, 4],
    days: ["monday"],
    calories: 180,
    tags: ["Desserts", "Sweets"],
  },
  {
    name_en: "Brownies",
    name_ar: "براونيز",
    short_description_en: "Rich chocolate brownies crafted for a sweet snack.",
    short_description_ar: "براونيز شوكولاتة غنية كسناك تحلية.",
    full_description_en:
      "A chocolate brownie snack with a rich taste—sweet comfort with controlled portions.",
    full_description_ar:
      "براونيز بطعم شوكولاتة غني—تحلية مريحة بحصة محسوبة.",
    category: "Snack",
    weeks: [1],
    days: ["sunday"],
    calories: 208,
    tags: ["Desserts", "Sweets"],
  },
  {
    name_en: "Bahama Lava Cake",
    name_ar: "كيكة اللافا الباهاما",
    short_description_en: "Decadent lava cake with a warm molten center.",
    short_description_ar: "كيكة لافا غنية بقلب شوكولاتة دافئ.",
    full_description_en:
      "A decadent chocolate lava cake with a warm, molten center—perfect as a dessert snack.",
    full_description_ar:
      "كيكة شوكولاتة لافا بقلب دافئ—تحلية فاخرة كسناك.",
    category: "Snack",
    weeks: [1, 3],
    days: ["tuesday", "saturday"],
    calories: 190,
    tags: ["Desserts", "Sweets"],
  },
  {
    name_en: "Lazy Cake",
    name_ar: "ليزي كيك",
    short_description_en: "Classic no-bake dessert with a rich, sweet bite.",
    short_description_ar: "حلى ليزي كيك كلاسيكي بطعم غني.",
    full_description_en:
      "A classic no-bake dessert layered with biscuits and a rich chocolate base—sweet comfort in a controlled portion.",
    full_description_ar:
      "حلى ليزي كيك بطبقات بسكويت وقاعدة شوكولاتة غنية—تحلية مريحة بحصة محسوبة.",
    category: "Snack",
    weeks: [3],
    days: ["monday"],
    calories: 163,
    tags: ["Desserts", "Sweets"],
  },
  {
    name_en: "Chocolate Pancake",
    name_ar: "بان كيك بالشوكولاتة",
    short_description_en: "Golden pancake with a soft chocolatey center.",
    short_description_ar: "بان كيك ذهبي بحشوة شوكولاتة ناعمة.",
    full_description_en:
      "A chocolate-style pancake with balanced sweetness and portion control—perfect for breakfast.",
    full_description_ar:
      "بان كيك بالشوكولاتة بحلاوة محسوبة وحجم مناسب—مناسب للفطور.",
    category: "Breakfast",
    weeks: [2, 4],
    days: ["saturday"],
    calories: 298,
    tags: ["Desserts", "Sweets"],
  },
  {
    name_en: "Omelette Pizza",
    name_ar: "بيتزا الأومليت",
    short_description_en: "Hearty omelette with pizza-style toppings.",
    short_description_ar: "أومليت مشبع بطابع بيتزا.",
    full_description_en:
      "A breakfast omelette with a fun pizza-inspired twist—high satisfaction and protein-friendly.",
    full_description_ar:
      "أومليت فطور بطابع بيتزا—مشبع ومناسب للبروتين.",
    category: "Breakfast",
    weeks: [3],
    days: ["monday"],
    calories: 280,
    tags: ["Egg"],
  },
  {
    name_en: "GREEK INFUSION",
    name_ar: "جرِيك إنفيوجن",
    short_description_en: "Greek-inspired flavor infusion—bright and refreshing.",
    short_description_ar: "نكهة مستوحاة من المطبخ اليوناني—منعشة.",
    full_description_en:
      "A refreshing snack item inspired by Greek flavors—oregano, lemon, and olive oil notes.",
    full_description_ar:
      "سناك مستوحى من النكهات اليونانية—أوريجانو وليمون ولمسة زيت زيتون.",
    category: "Snack",
    weeks: [1, 3],
    days: ["wednesday"],
    calories: 198,
    tags: ["Snack"],
  },
  {
    name_en: "Matcha Smoothie Shake",
    name_ar: "سموثي ماتشا شيك",
    short_description_en: "Refreshing matcha smoothie with a creamy blend.",
    short_description_ar: "سموثي ماتشا منعش بقوام كريمي.",
    full_description_en:
      "A vibrant matcha smoothie shake—light, refreshing, and perfect as a snack.",
    full_description_ar:
      "سموثي ماتشا بنكهة مميزة—خفيف ومنعش ومناسب كسناك.",
    category: "Snack",
    weeks: [4],
    days: ["wednesday"],
    calories: 188,
    tags: ["Drink"],
  },
];

async function main() {
  console.log("🚀 Starting meals update...\n");

  const existingMeals = (await client.query(api.publicMeals.list, {})) as any[];
  console.log(`📊 Existing meals count: ${existingMeals.length}\n`);

  let updatedCount = 0;
  let createdCount = 0;
  let errorCount = 0;

  for (const mealData of mealsData) {
    try {
      const slug = toSlug(mealData.name_en);

      const existingMeal = existingMeals.find(
        (m) =>
          (m.nameEn?.toLowerCase?.() || "") === mealData.name_en.toLowerCase() ||
          m.nameAr === mealData.name_ar ||
          m.slug === slug
      );

      const category = normalizeCategory(mealData.category);
      const tagsAr = tagsToArabic(mealData.tags);
      
      // Handle both weeks/days arrays and merge with existing
      const weeks = existingMeal
        ? Array.from(new Set([...(existingMeal.weeks || []), ...mealData.weeks]))
        : mealData.weeks;
      
      const days = existingMeal
        ? Array.from(new Set([...(existingMeal.days || []), ...mealData.days.map(normalizeDay)]))
        : mealData.days.map(normalizeDay);
      
      // Calculate macros if missing
      const macros = mealData.protein_g && mealData.carbs_g && mealData.fat_g
        ? { protein: mealData.protein_g, carbs: mealData.carbs_g, fats: mealData.fat_g }
        : estimateMacros(mealData.calories, category, mealData.tags);

      const payload: any = {
        nameAr: mealData.name_ar,
        nameEn: mealData.name_en,
        slug,
        descriptionAr: mealData.short_description_ar,
        descriptionEn: mealData.short_description_en,
        aboutAr: mealData.full_description_ar,
        aboutEn: mealData.full_description_en,
        calories: mealData.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fats: macros.fats,
        category,
        tags: tagsAr,
        weeks: weeks.sort((a, b) => a - b),
        days: days,
        cutoffTime: mealData.cutoffTime || "18:00",
      };

      if (existingMeal) {
        await client.mutation(api.publicMeals.update, {
          id: existingMeal._id,
          ...payload,
        });
        console.log(
          `✅ Updated: ${mealData.name_en} | weeks=${weeks.join(",")} days=${days.join(",")}`
        );
        updatedCount++;
      } else {
        await client.mutation(api.publicMeals.create, {
          ...payload,
          ingredients: [],
          priceQAR: mealData.priceQAR ?? 45,
          isActive: true,
          sortOrder: 999,
        });
        console.log(
          `✨ Created: ${mealData.name_en} | weeks=${weeks.join(",")} days=${days.join(",")}`
        );
        createdCount++;
      }

      await new Promise((r) => setTimeout(r, 250));
    } catch (error: any) {
      console.error(
        `❌ Error: ${mealData.name_en} -> ${error?.message || error}`
      );
      errorCount++;
    }
  }

  console.log(`\n🎉 Done!`);
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`✨ Created: ${createdCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
