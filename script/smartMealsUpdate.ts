// script/smartMealsUpdate.ts
// ✅ Smart meal updates with:
// - Image preservation (keeps existing storageId)
// - Week/Day merging (adds new weeks/days without removing old ones)
// - Description/Macros updates
// - Duplicate prevention via slug matching

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const convexUrl =
  process.env.CONVEX_URL || "https://rightful-parakeet-660.convex.cloud";
const client = new ConvexHttpClient(convexUrl);

// Helpers
function normalizeCategory(
  category: string
): "breakfast" | "lunch" | "dinner" | "salad" | "snack" {
  const cat = category.toLowerCase();
  if (cat.includes("breakfast")) return "breakfast";
  if (cat.includes("lunch")) return "lunch";
  if (cat.includes("dinner")) return "dinner";
  if (cat.includes("salad")) return "salad";
  return "snack";
}

function normalizeDay(day: string): string {
  const dayMap: Record<string, string> = {
    saturday: "saturday",
    sunday: "sunday",
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
  };
  return dayMap[day.toLowerCase()] || "saturday";
}

function toSlug(nameEn: string): string {
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

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
    juice: "عصير",
    shawarma: "شاورما",
  };
  return tags
    .map((t) => (t || "").toLowerCase().trim())
    .filter(Boolean)
    .map((t) => tagMap[t] || t);
}

// Macros estimation
function estimateMacros(
  calories: number,
  category: string,
  tags: string[]
): { protein: number; carbs: number; fats: number } {
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

// === PASTE YOUR MEALS DATA HERE ===
const newMealsData: MealInput[] = [
  // Copy-paste from your message...
  {
    name_en: "Garlic Butter Steak & Potato",
    name_ar: "ستيك بزبدة الثوم والبطاطس",
    short_description_en: "Juicy steak with crispy potatoes in garlic-butter sauce.",
    short_description_ar: "ستيك طري مع بطاطس مقرمشة بصلصة زبدة الثوم.",
    full_description_en:
      "Tender, seasoned steak served with oven-crisp potatoes, finished with a rich garlic-butter glaze.",
    full_description_ar:
      "ستيك متبل وطري يُقدَّم مع بطاطس مقرمشة، ولمسة صوص زبدة الثوم الغني.",
    category: "Dinner",
    weeks: [2],
    days: ["sunday"],
    calories: 460,
    tags: ["Beef"],
  },
  // ... add ALL meals from your message here
];

async function main() {
  console.log("🚀 Smart Meals Update - Starting...\n");

  const existingMeals = (await client.query(api.publicMeals.list, {})) as any[];
  console.log(`📊 Existing meals: ${existingMeals.length}\n`);

  let updatedCount = 0;
  let createdCount = 0;
  let mergedCount = 0;

  for (const meal of newMealsData) {
    try {
      const slug = toSlug(meal.name_en);
      console.log(`\n🔍 Processing: ${meal.name_ar} (${meal.name_en})`);

      // ✅ SMART MATCHING: Find existing by slug/name
      const existing = existingMeals.find((m: any) => {
        const mSlug = (m.slug || "").toLowerCase();
        const mNameEn = (m.nameEn || "").toLowerCase();
        const mNameAr = (m.nameAr || "").toLowerCase();

        // Match by slug (most reliable)
        if (mSlug === slug) return true;

        // Match by exact name
        if (mNameEn === meal.name_en.toLowerCase()) return true;
        if (mNameAr === meal.name_ar.toLowerCase()) return true;

        return false;
      });

      const category = normalizeCategory(meal.category);
      const tagsAr = tagsToArabic(meal.tags);
      const macros =
        meal.protein_g && meal.carbs_g && meal.fat_g
          ? { protein: meal.protein_g, carbs: meal.carbs_g, fats: meal.fat_g }
          : estimateMacros(meal.calories, category, meal.tags);

      // ✅ MERGE WEEKS/DAYS (don't replace, ADD new ones)
      const weeks = existing
        ? Array.from(new Set([...(existing.weeks || []), ...meal.weeks])).sort()
        : meal.weeks;

      const days = existing
        ? Array.from(
            new Set([
              ...(existing.days || []).map((d: string) => d.toLowerCase()),
              ...meal.days.map(normalizeDay),
            ])
          )
        : meal.days.map(normalizeDay);

      const payload: any = {
        nameAr: meal.name_ar,
        nameEn: meal.name_en,
        slug,
        descriptionAr: meal.short_description_ar,
        descriptionEn: meal.short_description_en,
        aboutAr: meal.full_description_ar,
        aboutEn: meal.full_description_en,
        calories: meal.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fats: macros.fats,
        category,
        tags: tagsAr,
        weeks,
        days,
        cutoffTime: meal.cutoffTime || "18:00",
      };

      if (existing) {
        // ✅ UPDATE: Keep imageStorageId + other fields
        console.log(`   📝 Updating existing meal...`);
        console.log(`   🔸 Old weeks: ${(existing.weeks || []).join(", ")}`);
        console.log(`   🔸 New weeks: ${weeks.join(", ")}`);
        console.log(`   🔸 Old days: ${(existing.days || []).join(", ")}`);
        console.log(`   🔸 New days: ${days.join(", ")}`);

        await client.mutation(api.publicMeals.update, {
          id: existing._id,
          ...payload,
          // ✅ PRESERVE IMAGE if exists
          imageStorageId: existing.imageStorageId,
        });

        if (weeks.length > (existing.weeks || []).length || days.length > (existing.days || []).length) {
          console.log(`   ✅ Updated + MERGED weeks/days`);
          mergedCount++;
        } else {
          console.log(`   ✅ Updated (no new schedule)`);
        }
        updatedCount++;
      } else {
        // ✅ CREATE: New meal
        console.log(`   ✨ Creating new meal...`);
        await client.mutation(api.publicMeals.create, {
          ...payload,
          ingredients: [],
          priceQAR: meal.priceQAR ?? 45,
          isActive: true,
          sortOrder: 999,
        });
        console.log(`   ✅ Created`);
        createdCount++;
      }

      await new Promise((r) => setTimeout(r, 200)); // Rate limiting
    } catch (error: any) {
      console.error(`   ❌ Error: ${error?.message || error}`);
    }
  }

  console.log(`\n🎉 DONE!`);
  console.log(`   ✅ Updated: ${updatedCount}`);
  console.log(`   🔀 Merged (weeks/days added): ${mergedCount}`);
  console.log(`   ✨ Created: ${createdCount}`);
  console.log(`   📊 Total processed: ${newMealsData.length}`);
}

main().catch((error) => {
  console.error("❌ Fatal:", error);
  process.exit(1);
});
