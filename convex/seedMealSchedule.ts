/**
 * @file convex/seedMealSchedule.ts
 * @description Seed all 140 meals from the 4-week Adrenaline schedule (Excel)
 * Run from Convex dashboard: seedMealSchedule.seed
 */
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./sessions";

type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "salad";

const SCHEDULE: {
  nameEn: string;
  nameAr?: string;
  weeks: number[];
  days: string[];
  category: MealCategory;
}[] = [
  { nameEn: "Halloumi Sandwich", nameAr: "ساندويتش الهالومي", weeks: [1], days: ["saturday"], category: "breakfast" },
  { nameEn: "Egg With Zaater", nameAr: "بيض مع الزعتر", weeks: [1], days: ["saturday"], category: "breakfast" },
  { nameEn: "Beetroot Salad", nameAr: "سلطة البنجر", weeks: [1, 2, 4], days: ["saturday", "sunday"], category: "snack" },
  { nameEn: "Sweet Potato Energy Booster", nameAr: "منشط الطاقة بالبطاطا الحلوة", weeks: [1], days: ["saturday"], category: "snack" },
  { nameEn: "Garlic Butter Chicken", nameAr: "دجاج بزبدة الثوم", weeks: [1], days: ["saturday"], category: "lunch" },
  { nameEn: "Chicken Teriyaki Bowl", nameAr: "وعاء دجاج تيرياكي", weeks: [1], days: ["saturday"], category: "lunch" },
  { nameEn: "Chicken Soup", nameAr: "حساء الدجاج", weeks: [1], days: ["saturday"], category: "snack" },
  { nameEn: "Beef Kofta Wrap", nameAr: "راب كفتة اللحم", weeks: [1], days: ["saturday"], category: "dinner" },
  { nameEn: "Honey Glaze Salmon", nameAr: "سلمون بصوص العسل", weeks: [1], days: ["saturday"], category: "dinner" },
  { nameEn: "Hummus", nameAr: "حمص", weeks: [1], days: ["sunday"], category: "breakfast" },
  { nameEn: "Mix Vege Omelette", nameAr: "أومليت الخضار المشكلة", weeks: [1], days: ["sunday"], category: "breakfast" },
  { nameEn: "Brownies", nameAr: "براونيز", weeks: [1], days: ["sunday"], category: "snack" },
  { nameEn: "Caesar Salad", nameAr: "سلطة سيزار", weeks: [1, 2, 3, 4], days: ["saturday", "sunday", "wednesday"], category: "snack" },
  { nameEn: "Chicken Curry", nameAr: "كاري الدجاج", weeks: [1], days: ["sunday"], category: "lunch" },
  { nameEn: "Beef Balls With Rice", nameAr: "كرات اللحم مع الأرز", weeks: [1], days: ["sunday"], category: "lunch" },
  { nameEn: "Cinnamon Apple Yogurt", nameAr: "زبادي التفاح بالقرفة", weeks: [1, 2, 4], days: ["sunday"], category: "snack" },
  { nameEn: "Spaghetti Bolognese", nameAr: "سباغيتي بولونيز", weeks: [1], days: ["sunday"], category: "dinner" },
  { nameEn: "Shrimp Tacos", nameAr: "تاكو الروبيان", weeks: [1], days: ["sunday"], category: "dinner" },
  { nameEn: "Normal Pancake", nameAr: "بان كيك عادي", weeks: [1], days: ["monday"], category: "breakfast" },
  { nameEn: "Egg Croissant", nameAr: "كرواسان البيض", weeks: [1], days: ["monday"], category: "breakfast" },
  { nameEn: "Lentil Soup", nameAr: "شوربة العدس", weeks: [1, 2, 3, 4], days: ["monday", "tuesday"], category: "snack" },
  { nameEn: "Pistachio Salad", nameAr: "سلطة الفستق", weeks: [1, 3], days: ["monday", "sunday"], category: "snack" },
  { nameEn: "Healthy Chicken Majbous", nameAr: "مجبوس دجاج صحي", weeks: [1], days: ["monday"], category: "lunch" },
  { nameEn: "Beef Alfredo", nameAr: "ألفريدو اللحم", weeks: [1], days: ["monday"], category: "lunch" },
  { nameEn: "Umm Ali", nameAr: "أم علي", weeks: [1], days: ["monday"], category: "snack" },
  { nameEn: "Chicken Shawarma", nameAr: "شاورما الدجاج", weeks: [1], days: ["monday"], category: "dinner" },
  { nameEn: "Chicken Parmesan", nameAr: "دجاج البارميزان", weeks: [1], days: ["monday"], category: "dinner" },
  { nameEn: "Sunny Side Egg With Brown Bread", nameAr: "بيض مقلي مع خبز أسمر", weeks: [1, 3], days: ["tuesday"], category: "breakfast" },
  { nameEn: "Egg Burrito", nameAr: "بوريتو البيض", weeks: [1], days: ["tuesday"], category: "breakfast" },
  { nameEn: "Bahamas Lava Cake", nameAr: "كيك اللافا باهاماز", weeks: [1, 3], days: ["saturday", "tuesday"], category: "snack" },
  { nameEn: "Crab Salad", nameAr: "سلطة الكابوريا", weeks: [1, 3], days: ["tuesday"], category: "snack" },
  { nameEn: "Beef Stroganoff", nameAr: "ستروغانوف اللحم", weeks: [1], days: ["tuesday"], category: "lunch" },
  { nameEn: "Crispy Chicken Cutlets", nameAr: "شرائح الدجاج المقرمشة", weeks: [1], days: ["tuesday"], category: "lunch" },
  { nameEn: "Vegetables Soup", nameAr: "شوربة الخضار", weeks: [1, 2, 3, 4], days: ["thursday", "tuesday", "wednesday"], category: "snack" },
  { nameEn: "Beef Lasagna", nameAr: "لازانيا اللحم", weeks: [1], days: ["tuesday"], category: "dinner" },
  { nameEn: "Southwest Chicken Wrap", nameAr: "راب الدجاج الجنوبي الغربي", weeks: [1], days: ["tuesday"], category: "dinner" },
  { nameEn: "Croissant Cheese", nameAr: "كرواسان الجبن", weeks: [1], days: ["wednesday"], category: "breakfast" },
  { nameEn: "Omelette Pizza", nameAr: "بيتزا أومليت", weeks: [1, 3], days: ["monday", "wednesday"], category: "breakfast" },
  { nameEn: "Date Balls", nameAr: "كرات التمر", weeks: [1], days: ["wednesday"], category: "snack" },
  { nameEn: "Waldorf Salad", nameAr: "سلطة والدورف", weeks: [1, 3], days: ["saturday", "wednesday"], category: "snack" },
  { nameEn: "Dynamite Shrimp", nameAr: "روبيان ديناميت", weeks: [1], days: ["wednesday"], category: "lunch" },
  { nameEn: "Shish Tawook & Rice", nameAr: "شيش طاووق مع أرز", weeks: [1], days: ["wednesday"], category: "lunch" },
  { nameEn: "Greek Infusion", nameAr: "تشكيلة يونانية", weeks: [1, 3], days: ["wednesday"], category: "snack" },
  { nameEn: "Chicken Fajita Sandwich", nameAr: "ساندويتش فاهيتا الدجاج", weeks: [1], days: ["wednesday"], category: "dinner" },
  { nameEn: "Beef Kofta Delight", nameAr: "كفتة اللحم الفاخرة", weeks: [1], days: ["wednesday"], category: "dinner" },
  { nameEn: "Berry Oatmeal Bowl", nameAr: "وعاء الشوفان بالتوت", weeks: [1], days: ["thursday"], category: "breakfast" },
  { nameEn: "Turkey Cheese Wrap", nameAr: "راب الديك الرومي بالجبن", weeks: [1], days: ["thursday"], category: "breakfast" },
  { nameEn: "Tiramisu", nameAr: "تيراميسو", weeks: [1, 3], days: ["thursday", "tuesday"], category: "snack" },
  { nameEn: "Fruit Salad", nameAr: "سلطة الفواكه", weeks: [1, 2, 3, 4], days: ["sunday", "thursday"], category: "snack" },
  { nameEn: "Creamy Garlic Chicken", nameAr: "دجاج كريمي بالثوم", weeks: [1], days: ["thursday"], category: "lunch" },
  { nameEn: "New Greek Chicken", nameAr: "دجاج يوناني جديد", weeks: [1], days: ["thursday"], category: "lunch" },
  { nameEn: "Mediterranean Feta Salad", nameAr: "سلطة فيتا المتوسطية", weeks: [1], days: ["thursday"], category: "snack" },
  { nameEn: "Beef Shawarma With Beetroot Rice", nameAr: "شاورما اللحم مع أرز البنجر", weeks: [1], days: ["thursday"], category: "dinner" },
  { nameEn: "Salmon Pesto Pasta", nameAr: "باستا السلمون بالبيستو", weeks: [1], days: ["thursday"], category: "dinner" },
  // Week 2
  { nameEn: "Chocolate Pancakes", nameAr: "بان كيك بالشوكولاتة", weeks: [2, 3, 4], days: ["saturday", "tuesday"], category: "breakfast" },
  { nameEn: "Oriental Breakfast", nameAr: "فطور شرقي", weeks: [2, 4], days: ["saturday"], category: "breakfast" },
  { nameEn: "Talbina", nameAr: "تلبينة", weeks: [2, 4], days: ["saturday"], category: "snack" },
  { nameEn: "Chicken Tacos", nameAr: "تاكو الدجاج", weeks: [2, 4], days: ["saturday"], category: "lunch" },
  { nameEn: "Iranian Chicken", nameAr: "دجاج إيراني", weeks: [2, 4], days: ["saturday"], category: "lunch" },
  { nameEn: "Broccoli Soup", nameAr: "شوربة البروكلي", weeks: [2, 3, 4], days: ["saturday"], category: "snack" },
  { nameEn: "Salmon No Carb", nameAr: "سلمون بدون كربوهيدرات", weeks: [2, 4], days: ["saturday"], category: "dinner" },
  { nameEn: "Steak Sandwich", nameAr: "ساندويتش ستيك", weeks: [2, 4], days: ["saturday"], category: "dinner" },
  { nameEn: "Croissant Zaatar", nameAr: "كرواسان الزعتر", weeks: [2, 4], days: ["sunday"], category: "breakfast" },
  { nameEn: "New Egg Sandwich", nameAr: "ساندويتش بيض جديد", weeks: [2, 4], days: ["sunday"], category: "breakfast" },
  { nameEn: "Cordon Bleu", nameAr: "كوردون بلو", weeks: [2, 4], days: ["sunday"], category: "lunch" },
  { nameEn: "Fish Sayadieh", nameAr: "صيادية السمك", weeks: [2, 4], days: ["sunday"], category: "lunch" },
  { nameEn: "Garlic Butter Steak & Potatoes", nameAr: "ستيك بزبدة الثوم مع البطاطس", weeks: [2], days: ["sunday"], category: "dinner" },
  { nameEn: "Chicken Herbs", nameAr: "دجاج بالأعشاب", weeks: [2, 4], days: ["sunday"], category: "dinner" },
  { nameEn: "Sweet Potato Delight", nameAr: "فطور البطاطا الحلوة", weeks: [2, 4], days: ["monday"], category: "breakfast" },
  { nameEn: "Mexican Omelette", nameAr: "أومليت مكسيكي", weeks: [2, 4], days: ["monday"], category: "breakfast" },
  { nameEn: "Mushroom Soup", nameAr: "شوربة الفطر", weeks: [2, 3, 4], days: ["monday", "sunday"], category: "snack" },
  { nameEn: "Cookies", nameAr: "كوكيز", weeks: [2, 4], days: ["monday"], category: "snack" },
  { nameEn: "Cajun Chicken Pasta", nameAr: "باستا الدجاج كاجون", weeks: [2], days: ["monday"], category: "lunch" },
  { nameEn: "Chicken Vegetables", nameAr: "دجاج بالخضار", weeks: [2, 4], days: ["monday"], category: "lunch" },
  { nameEn: "Fattoush", nameAr: "فتوش", weeks: [2, 4], days: ["monday"], category: "snack" },
  { nameEn: "Dawoud Basha", nameAr: "داود باشا", weeks: [2, 4], days: ["monday"], category: "dinner" },
  { nameEn: "Buffalo Chicken Wrap", nameAr: "راب دجاج بافالو", weeks: [2, 4], days: ["monday"], category: "dinner" },
  { nameEn: "Foul", nameAr: "فول", weeks: [2, 4], days: ["tuesday"], category: "breakfast" },
  { nameEn: "New Egg Shakshouka", nameAr: "شكشوكة بيض جديدة", weeks: [2, 3, 4], days: ["tuesday", "wednesday"], category: "breakfast" },
  { nameEn: "Chia Seeds Pudding", nameAr: "بودينغ بذور الشيا", weeks: [2, 4], days: ["tuesday"], category: "snack" },
  { nameEn: "Lemon Chicken", nameAr: "دجاج بالليمون", weeks: [2, 4], days: ["tuesday"], category: "lunch" },
  { nameEn: "Shrimp Curry", nameAr: "كاري الروبيان", weeks: [2], days: ["tuesday"], category: "lunch" },
  { nameEn: "Energy Balls", nameAr: "كرات الطاقة", weeks: [2, 4], days: ["tuesday"], category: "snack" },
  { nameEn: "Beef Shawarma Sandwich", nameAr: "ساندويتش شاورما اللحم", weeks: [2, 4], days: ["tuesday"], category: "dinner" },
  { nameEn: "Iranian Kofta", nameAr: "كفتة إيرانية", weeks: [2, 4], days: ["tuesday"], category: "dinner" },
  { nameEn: "Chocolate Peanut Butter", nameAr: "شوكولاتة بزبدة الفول السوداني", weeks: [2, 4], days: ["wednesday"], category: "breakfast" },
  { nameEn: "Egg Avocado Toast", nameAr: "توست الأفوكادو بالبيض", weeks: [2, 4], days: ["wednesday"], category: "breakfast" },
  { nameEn: "Passion Fruit Quinoa Salad", nameAr: "سلطة كينوا فاكهة الشغف", weeks: [2, 3, 4], days: ["monday", "wednesday"], category: "snack" },
  { nameEn: "Corn Soup", nameAr: "شوربة الذرة", weeks: [2, 3, 4], days: ["tuesday", "wednesday"], category: "snack" },
  { nameEn: "Beef Vindalo & Rice", nameAr: "فيندالو اللحم مع أرز", weeks: [2, 4], days: ["wednesday"], category: "lunch" },
  { nameEn: "Jamaican Jerk Salmon", nameAr: "سلمون جاميكي حار", weeks: [2], days: ["wednesday"], category: "lunch" },
  { nameEn: "Matcha Smoothie Shake", nameAr: "شيك ماتشا", weeks: [2, 4], days: ["wednesday"], category: "snack" },
  { nameEn: "Beef Pastrami Sandwich", nameAr: "ساندويتش باسترامي اللحم", weeks: [2, 4], days: ["wednesday"], category: "dinner" },
  { nameEn: "Chicken Majbous", nameAr: "مجبوس الدجاج", weeks: [2, 4], days: ["wednesday"], category: "dinner" },
  { nameEn: "Falafel Wrap", nameAr: "راب الفلافل", weeks: [2, 4], days: ["thursday"], category: "breakfast" },
  { nameEn: "Lebanese Traditional Muffin", nameAr: "مافن لبناني تقليدي", weeks: [2, 4], days: ["thursday"], category: "breakfast" },
  { nameEn: "Rice Pudding", nameAr: "أرز بالحليب", weeks: [2, 4], days: ["thursday"], category: "snack" },
  { nameEn: "Mediterranean Feta Salad", nameAr: "سلطة فيتا المتوسطية", weeks: [2, 3, 4], days: ["thursday"], category: "snack" },
  { nameEn: "Sweet Chili Chicken", nameAr: "دجاج بالفلفل الحلو", weeks: [2, 4], days: ["thursday"], category: "lunch" },
  { nameEn: "Beef Noodles", nameAr: "نودلز اللحم", weeks: [2, 4], days: ["thursday"], category: "lunch" },
  { nameEn: "Beef Burger", nameAr: "برغر اللحم", weeks: [2, 4], days: ["thursday"], category: "dinner" },
  { nameEn: "Chicken Avocado Sandwich", nameAr: "ساندويتش الدجاج بالأفوكادو", weeks: [2, 4], days: ["thursday"], category: "dinner" },
  // Week 3
  { nameEn: "Egg Muffin", nameAr: "مافن البيض", weeks: [3], days: ["saturday"], category: "breakfast" },
  { nameEn: "Normal Pancakes", nameAr: "بان كيك عادي", weeks: [3], days: ["saturday"], category: "breakfast" },
  { nameEn: "Penne Chicken Pasta", nameAr: "باستا بيني بالدجاج", weeks: [3], days: ["saturday"], category: "lunch" },
  { nameEn: "Beef Kofta With Saffron Rice", nameAr: "كفتة اللحم مع أرز الزعفران", weeks: [3], days: ["saturday"], category: "lunch" },
  { nameEn: "Crispy Strips", nameAr: "شرائح مقرمشة", weeks: [3], days: ["saturday"], category: "dinner" },
  { nameEn: "Lemon Shrimp", nameAr: "روبيان بالليمون", weeks: [3], days: ["saturday"], category: "dinner" },
  { nameEn: "Halloumi Muffin", nameAr: "مافن الهالومي", weeks: [3], days: ["sunday"], category: "breakfast" },
  { nameEn: "Croissant Turkey", nameAr: "كرواسان الديك الرومي", weeks: [3], days: ["sunday"], category: "breakfast" },
  { nameEn: "Chicken Biryani", nameAr: "برياني الدجاج", weeks: [3], days: ["sunday"], category: "lunch" },
  { nameEn: "Salmon With Salsa", nameAr: "سلمون بصلصة السالسا", weeks: [3], days: ["sunday"], category: "lunch" },
  { nameEn: "Muffin", nameAr: "مافن", weeks: [3], days: ["sunday"], category: "snack" },
  { nameEn: "Stuffed Peppers", nameAr: "فلفل محشي", weeks: [3], days: ["sunday"], category: "dinner" },
  { nameEn: "Chicken Musakhan", nameAr: "مسخن الدجاج", weeks: [3], days: ["sunday"], category: "dinner" },
  { nameEn: "Croissant Egg Ring", nameAr: "حلقة بيض كرواسان", weeks: [3], days: ["monday"], category: "breakfast" },
  { nameEn: "New Roasted Beef Sandwich", nameAr: "ساندويتش لحم مشوي جديد", weeks: [3], days: ["monday"], category: "lunch" },
  { nameEn: "Cajun Shrimp Pasta", nameAr: "باستا روبيان كاجون", weeks: [3, 4], days: ["monday"], category: "lunch" },
  { nameEn: "Lazy Cake", nameAr: "كيك الكسول", weeks: [3], days: ["monday"], category: "snack" },
  { nameEn: "Chicken Fattah", nameAr: "فتة الدجاج", weeks: [3], days: ["monday"], category: "dinner" },
  { nameEn: "Beef Rolls Sweet Potatoes", nameAr: "رولات اللحم بالبطاطا الحلوة", weeks: [3], days: ["monday"], category: "dinner" },
  { nameEn: "Peri Peri Chicken & Rice", nameAr: "دجاج بيري بيري مع أرز", weeks: [3], days: ["tuesday"], category: "lunch" },
  { nameEn: "Spaghetti Beef Balls", nameAr: "سباغيتي كرات اللحم", weeks: [3], days: ["tuesday"], category: "lunch" },
  { nameEn: "Turkey Sandwich", nameAr: "ساندويتش الديك الرومي", weeks: [3], days: ["tuesday"], category: "dinner" },
  { nameEn: "Shish Tawook Wrap", nameAr: "راب شيش طاووق", weeks: [3], days: ["tuesday"], category: "dinner" },
  { nameEn: "Turkey English Muffin", nameAr: "مافن إنجليزي بالديك الرومي", weeks: [3], days: ["wednesday"], category: "breakfast" },
  { nameEn: "Shrimp Majbous", nameAr: "مجبوس الروبيان", weeks: [3], days: ["wednesday"], category: "lunch" },
  { nameEn: "Chicken Stroganoff", nameAr: "ستروغانوف الدجاج", weeks: [3], days: ["wednesday"], category: "lunch" },
  { nameEn: "Fajita Beef Sandwich", nameAr: "ساندويتش فاهيتا اللحم", weeks: [3], days: ["wednesday"], category: "dinner" },
  { nameEn: "Steak With Mashed Potatoes", nameAr: "ستيك مع بطاطس مهروسة", weeks: [3], days: ["wednesday"], category: "dinner" },
  { nameEn: "Peanut Butter Oatmeal", nameAr: "شوفان بزبدة الفول السوداني", weeks: [3], days: ["thursday"], category: "breakfast" },
  { nameEn: "Egg Quesadillas", nameAr: "كيساديا البيض", weeks: [3], days: ["thursday"], category: "breakfast" },
  { nameEn: "Raspberry Rice Pudding", nameAr: "أرز بالحليب والتوت", weeks: [3], days: ["thursday"], category: "snack" },
  { nameEn: "Mongolian Noodles", nameAr: "نودلز مغولية", weeks: [3], days: ["thursday"], category: "lunch" },
  { nameEn: "Chicken Alfredo", nameAr: "دجاج ألفريدو", weeks: [3], days: ["thursday"], category: "lunch" },
  { nameEn: "Chicken Tajine", nameAr: "طاجن الدجاج", weeks: [3], days: ["thursday"], category: "dinner" },
  { nameEn: "Grilled Chicken Burger", nameAr: "برغر الدجاج المشوي", weeks: [3], days: ["thursday"], category: "dinner" },
  // Week 4 unique
  { nameEn: "Creamy Zucchini Chicken Pasta", nameAr: "باستا الدجاج بالكوسا الكريمية", weeks: [4], days: ["sunday"], category: "dinner" },
  { nameEn: "Salmon Curry", nameAr: "كاري السلمون", weeks: [4], days: ["tuesday"], category: "lunch" },
  { nameEn: "Chicken Risotto", nameAr: "ريزوتو الدجاج", weeks: [4], days: ["wednesday"], category: "lunch" },
];

const IMG: Record<MealCategory, string> = {
  breakfast: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800",
  lunch: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
  dinner: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
  snack: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800",
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const seed = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const existing = await ctx.db.query("publicMeals").collect();
    const existingMap = new Map<string, typeof existing[0]>();
    for (const m of existing) {
      if (m.nameEn) existingMap.set(normalize(m.nameEn), m);
    }

    let created = 0;
    let updated = 0;
    // deduplicate by nameEn (some entries have same English name e.g. Mediterranean Feta Salad)
    const seen = new Set<string>();

    for (let i = 0; i < SCHEDULE.length; i++) {
      const item = SCHEDULE[i];
      const key = normalize(item.nameEn);
      if (seen.has(key)) {
        // merge weeks/days into already-processed record
        continue;
      }
      seen.add(key);

      // Merge all entries with same name
      const merged = { weeks: new Set(item.weeks), days: new Set(item.days), category: item.category };
      for (let j = i + 1; j < SCHEDULE.length; j++) {
        if (normalize(SCHEDULE[j].nameEn) === key) {
          SCHEDULE[j].weeks.forEach((w) => merged.weeks.add(w));
          SCHEDULE[j].days.forEach((d) => merged.days.add(d));
        }
      }

      const weeks = Array.from(merged.weeks).sort();
      const days = Array.from(merged.days).sort();

      const existingMeal = existingMap.get(key);
      if (existingMeal) {
        await ctx.db.patch(existingMeal._id, { weeks, days, category: item.category });
        updated++;
      } else {
        const slug = slugify(item.nameEn);
        await ctx.db.insert("publicMeals", {
          nameAr: item.nameAr ?? item.nameEn,
          nameEn: item.nameEn,
          slug: `${slug}-${Date.now()}-${i}`,
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          category: item.category,
          tags: [],
          ingredients: [],
          priceQAR: 0,
          isActive: true,
          sortOrder: i + 1,
          weeks,
          days,
          imageUrl: IMG[item.category],
          createdAt: Date.now(),
        });
        created++;
      }
    }

    return { created, updated, total: created + updated };
  },
});
