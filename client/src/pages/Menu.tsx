// client/src/pages/Menu.tsx
/**
 * @file client/src/pages/Menu.tsx
 * @description إدارة القائمة - الأصناف والوجبات + Modifiers (التفضيلات/الممنوعات/الكميات)
 * @convex convex/mealCategories.ts, convex/menuItems.ts, convex/modifiers.ts
 */
import React, { useMemo, useState, useEffect } from "react";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useReorderCategories,
  useDeleteCategory,
  useMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  MealCategory,
  MenuItem,

  // ✅ Modifiers
  useModifiers,
  useCreateModifier,
  useUpdateModifier,
  useDeleteModifier,
  type Modifier,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuItemCard } from "@/components/MenuItemCard";
import {
  Plus,
  Edit2,
  ArrowUp,
  ArrowDown,
  Database,
  Trash2,
  SlidersHorizontal,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * ✅ SEED MENU
 * - Breakfast
 * - Lunch
 * - Dinner
 * - Snacks
 * + ✅ Other (للوجبات غير المصنفة / Unknown)
 */
const SEED_CATEGORIES = [
  { name: "Breakfast", sortOrder: 1 },
  { name: "Lunch", sortOrder: 2 },
  { name: "Dinner", sortOrder: 3 },
  { name: "Snacks", sortOrder: 4 },
  { name: "Other", sortOrder: 5 }, // ✅ NEW
] as const;

type SeedCategoryName = (typeof SEED_CATEGORIES)[number]["name"];

/**
 * ✅ القائمة الأساسية (زي ما كانت عندك)
 */
const SEED_MENU: Record<Exclude<SeedCategoryName, "Other">, string[]> = {
  Breakfast: [
    "BERRY OATMEAL BOWL",
    "CHOCOLATE Pancakes",
    "CHOCOLATE PEANUTBUTTER",
    "CROISANT CHEESE",
    "CROISANT EGG RING",
    "CROISANT TURKEY",
    "CROISANT ZAATER",
    "EGG AVOCADO TOAST",
    "EGG BURRITO",
    "EGG CROISANT",
    "EGG MUFFIN",
    "EGG QUESADILLAS",
    "EGG WITH ZAATER",
    "FALAFEL WRAP",
    "FOUL",
    "HALLOUMI MUFFIN",
    "HALLOUMI SANDWICH",
    "HUUMUS",
    "LEBANESE TRADITIONAL MUFFIN",
    "MEXICAN OMELETE",
    "MIX VEGE OMELETE",
    "NEW Egg sandwich",
    "NEW EGG SHAKSHOUKA",
    "NORMAL Pancake",
    "NORMAL PANCAKES",
    "OMELETE PIZZA",
    "ORIENTAL BREAKFAST",
    "PEANUTBUTTER OATMEAL",
    "SUNNY SIDE EGG W/ BROWN BREAD",
    "SWEET POTATO DELIGHT",
    "TURKEY CHEESE WRAP",
    "TURKEY ENGLISH MUFFIN",
  ],
  Lunch: [
    "BEEF ALFREDO",
    "BEEF BALLS WITH RICE",
    "BEEF KOFTA W/ SAFRON RICE",
    "BEEF NOODLES",
    "BEEF STROGANOF",
    "BEEF VINDALO & RICE",
    "CAJUN CHICKEN PASTA",
    "CAJUN SHRIMP PASTA",
    "CHICKEN ALFREDO",
    "CHICKEN BIRYANI",
    "CHICKEN CURRY",
    "CHICKEN RIZOTTO",
    "CHICKEN STROGANOF",
    "CHICKEN TACOS",
    "CHICKEN TERYAKI BOWL",
    "CHICKEN VEGETABLES",
    "CORDON BLUE",
    "CREAMY GARLIC CHICKEN",
    "CRISPY CHICKEN CUTLETS",
    "DYNAMITE SHRIMP",
    "FISH SYADIAH",
    "GARLIC BUTTER CHICKEN",
    "HEALTHY BEEF MAJBOUS",
    "HEALTHY CHICKEN MAJBOUS",
    "IRANIAN CHICKEN",
    "JAMAICAN JERK SALMON",
    "LEMON CHICKEN",
    "MANGOLIAN NOODLES",
    "NEW GREEK CHICKEN",
    "NEW Roasted Beef Sandwich",
    "PENNE CHICKEN PASTA",
    "Peri Peri Chicken & Rice",
    "SALMON CURRY",
    "SALMON W/ SALSA",
    "SHISHTAWOOK & RICE",
    "SHRIMP CURRY",
    "SHRIMP MAJBOUS",
    "SPAGHETTI BEEF BALLS",
    "SWEET CHILI CHICKEN",
  ],
  Dinner: [
    "BEEF BURGER",
    "BEEF KOFTA DELIGHT",
    "BEEF KOFTA WRAP",
    "BEEF LASAGNA",
    "BEEF PASTRAMI SANDWICH",
    "BEEF ROLLS SWEET POTATOES",
    "BEEF SHAWERMA SANDWICH",
    "BEEF SHAWERMA W/ BEETROOT RICE",
    "BUFFALO CHICKEN WRAP",
    "Chicken Avocado Sandwich",
    "CHICKEN FAJITA SANDWICH",
    "CHICKEN FATTAH",
    "CHICKEN HERBS",
    "CHICKEN MAJBOUS",
    "CHICKEN MESAKHAN",
    "CHICKEN PARMESAN",
    "CHICKEN QUESADILLAS",
    "CHICKEN SHAWERMA WRAP",
    "CHICKEN SHAWERMA W/ SWEET POTATO",
    "CHICKEN SOUP",
    "CHICKEN TACO SALAD",
    "CHICKEN ZING SANDWICH",
    "FAJITA BEEF SANDWICH",
    "GARLIC BUTTER STEAK & POTATOES",
    "GRILLED CHICKEN BURGER",
    "HONEY GLAZE SALMON",
    "IRANIAN KOFTA",
    "LEMON SHRIMP",
    "SALMON NO CARB",
    "SALMON PESTO PASTA",
    "SHISHTAWOOK WRAP",
    "SHRIMP TACOS",
    "SOUTHWEST CHICKEN WRAP",
    "SPAGHETTI BOLOGNESE",
    "STEAK SANDWICH",
    "STEAK W/ MASHED POTATOES",
    "STUFFED PEPPERS",
    "TURKEY SANDWICH",
  ],
  Snacks: [
    "BEETROOT SALAD",
    "BROWNIES",
    "CEASAR SALAD",
    "CINNAMON APPLE YOGURT",
    "COOKIES",
    "FRUIT SALAD",
    "SWEET POTATO ENERGY BOOSTER",
    "TALBINA",
    "AVO SALAD",
    "BAKED POTATOES",
    "BROCOLI SOUP",
    "CAESAR SALAD",
    "CARROT CAKE",
    "EGGS SALAD",
    "GREEK SALAD",
    "GREEK YOGURT",
    "GRILLED VEGE",
    "JALAPENO POPPERS",
    "LENTIL SOUP",
    "MUSHROOM SOUP",
    "OAT PEANUTBUTTER BALLS",
    "OMLETTE",
    "ORANGE",
    "POPCORN CHICKEN",
    "PROTEIN PANCAKE",
    "PROTEIN SMOOTHIE",
    "SWEET POTATO CHIPS",
    "TURKEY SALAD",
  ],
};

/**
 * ✅ جدول الوجبات (TSV)
 */
const ALL_MEALS_TSV = `
Breakfast	BERRY OATMEAL BOWL	280
Breakfast	CHIA SEEDS PUDDING
Breakfast	CHOCOLATE PANCAKES	298
Breakfast	CHOCOLATE PEANUTBUTTER
Breakfast	COOKIES	152
Breakfast	CORN SOUP	132
Breakfast	CROISANT CHEESE	320
Breakfast	CROISANT EGG RING
Breakfast	CROISANT TURKEY
Breakfast	CROISANT ZAATER	291
Breakfast	DATE BALLS	182
Breakfast	EGG AVOCADO TOAST
Breakfast	EGG BURRITO	319
Breakfast	EGG CROISANT
Breakfast	EGG MUFFIN
Breakfast	EGG QUESADILLAS
Breakfast	EGG WITH ZAATER
Breakfast	FALAFEL WRAP
Breakfast	FOUL
Breakfast	FRUIT SALAD	138
Breakfast	HALLOUMI MUFFIN
Breakfast	HALLOUMI SANDWICH
Breakfast	HUUMUS
Breakfast	LEBANESE TRADITIONAL MUFFIN
Breakfast	MEDITERRANEEN FETA SALAD
Breakfast	MEXICAN OMELETE
Breakfast	MIX VEGE OMELETE
Breakfast	MUSHROOM SOUP	130
Breakfast	NEW EGG SANDWICH
Breakfast	NEW EGG SHAKSHOUKA
Breakfast	NORMAL PANCAKE
Breakfast	NORMAL PANCAKES
Breakfast	OMELETE PIZZA
Breakfast	ORIENTAL BREAKFAST	303
Breakfast	PASSION FRUIT QUINOA SALAD
Breakfast	PEANUTBUTTER OATMEAL
Breakfast	RASPBERRY RICE PUDDING
Breakfast	RICE PUDDING	186
Breakfast	SUNNY SIDE EGG W/ BROWN BREAD
Breakfast	SWEET POTATO DELIGHT
Breakfast	TALBINA
Breakfast	TIRAMISU
Breakfast	TURKEY CHEESE WRAP	313
Breakfast	TURKEY ENGLISH MUFFIN
Breakfast	WALDORAF SALAD
Lunch	BEEF ALFREDO
Lunch	BEEF BALLS WITH RICE
Lunch	BEEF KOFTA W/ SAFRON RICE
Lunch	BEEF NOODLES	397
Lunch	BEEF STROGANOF
Lunch	BEEF VINDALO & RICE	360
Lunch	CAJUN CHICKEN PASTA	382
Lunch	CAJUN SHRIMP PASTA	491
Lunch	CHICKEN ALFREDO	392
Lunch	CHICKEN BIRYANI	350
Lunch	CHICKEN CURRY
Lunch	CHICKEN RIZOTTO
Lunch	CHICKEN STROGANOF	365
Lunch	CHICKEN TACOS	392
Lunch	CHICKEN TERYAKI BOWL
Lunch	CHICKEN VEGETABLES
Lunch	CORDON BLUE	365
Lunch	CREAMY GARLIC CHICKEN
Lunch	CRISPY CHICKEN CUTLETS	390
Lunch	DYNAMITE SHRIMP
Lunch	FISH SYADIAH	355
Lunch	GARLIC BUTTER CHICKEN
Lunch	HEALTHY CHICKEN MAJBOUS
Lunch	IRANIAN CHICKEN	341
Lunch	JAMAICAN JERK SALMON	399
Lunch	LEMON CHICKEN	321
Lunch	MANGOLIAN NOODLES
Lunch	NEW GREEK CHICKEN
Lunch	NEW ROASTED BEEF SANDWICH
Lunch	PENNE CHICKEN PASTA
Lunch	PERI PERI CHICKEN & RICE	373
Lunch	SALMON CURRY
Lunch	SALMON W/ SALSA
Lunch	SHISHTAWOOK & RICE	325
Lunch	SHRIMP CURRY
Lunch	SHRIMP MAJBOUS	364
Lunch	SPAGHETTI BEEF BALLS	410
Lunch	SWEET CHILI CHICKEN	371
Snack	BAHAMAS LAVA CAKE
Snack	BEETROOT SALAD
Snack	BROCOLI SOUP
Snack	BROWNIES
Snack	CEASAR SALAD
Snack	CHICKEN SOUP
Snack	CINNAMON APPLE YOGURT	147
Snack	CRAB SALAD
Snack	ENERGY BALLS
Snack	FATTOUSH
Snack	GREEK INFUSION
Snack	LAZY CAKE
Snack	LENTIL SOUP	138
Snack	MATCHA SMOOTHIE SHAKE
Snack	MEDITERRANEAN FETA SALAD
Snack	MUFFIN
Snack	PISTACHIO SALAD
Snack	SWEET POTATO ENERGY BOOSTER
Snack	UMM ALI	156
Snack	VEGETABLES SOUP
Dinner	BEEF BURGER	413
Dinner	BEEF KOFTA DELIGHT	399
Dinner	BEEF KOFTA WRAP	463
Dinner	BEEF LASAGNA	394
Dinner	BEEF PASTRAMI SANDWICH
Dinner	BEEF ROLLS SWEET POTATOES
Dinner	BEEF SHAWERMA SANDWICH	396
Dinner	BEEF SHAWERMA W/ BEETROOT RICE
Dinner	BUFFALO CHICKEN WRAP	391
Dinner	CHICKEN AVOCADO SANDWICH
Dinner	CHICKEN FAJITA SANDWICH	345
Dinner	CHICKEN FATTAH
Dinner	CHICKEN HERBS	337
Dinner	CHICKEN MAJBOUS	340
Dinner	CHICKEN MESAKHAN	394
Dinner	CHICKEN PARMESAN	534
Dinner	CHICKEN SHAWARMA
Dinner	CHICKEN TAJEN	384
Dinner	CREAMY ZUCCHINI CHICKEN PASTA
Dinner	CRISPY STRIPS
Dinner	DAWOUD BASHA	386
Dinner	FAJITA BEEF SANDWICH	393
Dinner	GARLIC BUTTER STEAK & POTATOES
Dinner	GRILLED CHICKEN BURGER
Dinner	HONEY GLAZE SALMON
Dinner	IRANIAN KOFTA	380
Dinner	LEMON SHRIMP	356
Dinner	SALMON NO CARB	345
Dinner	SALMON PESTO PASTA
Dinner	SHISHTAWOOK WRAP	389
Dinner	SHRIMP TACOS
Dinner	SOUTHWEST CHICKEN WRAP
Dinner	SPAGHETTI BOLOGNESE
Dinner	STEAK SANDWICH	370
Dinner	STEAK W/ MASHED POTATOES
Dinner	STUFFED PEPPERS	385
Dinner	TURKEY SANDWICH	452
Unknown	ACAI BOWL
Unknown	BANANA BOWL
Unknown	BANANA OAT MEAL BOWL
Unknown	BANANA PEACH BOWL
Unknown	BANANA SMOOTHIE BOWL
Unknown	BEEF BALLS W/ RICE
Unknown	BEEF KOFTA W/ RICE
Unknown	BEEF KOFTA WIRH SAFRON RICE	495
Unknown	BEEF KOFTA WITH SAFRAN RICE	403
Unknown	BEEF PATTIES NOODLES
Unknown	BEEF PESTO
Unknown	BEEF ROLL SWEET POTATO
Unknown	BEEF SHAWARMA
Unknown	BEEF SHAWERMA BEETROOT RICE	399
Unknown	BEEF SPAGHETTI CREAM
Unknown	BEEF STROGANOFF	355
Unknown	BROCCOLI SOUP	104
Unknown	BUTTER MILK PANCAKE
Unknown	CARBCOLATE PANCAKE
Unknown	CARBCOLATE PEANUT BUTTER BOWL
Unknown	CHIA PUDDING	133
Unknown	CHICKEN AVO-WRAP
Unknown	CHICKEN AVOCADO WRAP	404
Unknown	CHICKEN BURGER	395
Unknown	CHICKEN SPAGHETTI
Unknown	CHICKEN VEGETABLE
Unknown	CINNAMON ROLL PANCAKES
Unknown	CLASSIC SALMON
Unknown	CREAMY ZUCCHINI CHICKEN	527
Unknown	CROISSANT EGG
Unknown	DESSERT
Unknown	EGG SANDWICH	289
Unknown	FAHETHA BEEF SANDWICH
Unknown	FUSH SYADIAH	455
Unknown	GARLIC BEEF BITES
Unknown	GARLIC BUTTER STEAK
Unknown	GARLIC HERB STEAK
Unknown	GARLIC STEAK POTATOES	381
Unknown	GOLDEN STRIPS	378
Unknown	GREEK CHICKEN	328
Unknown	GREEN PANCAKES
Unknown	HAWAIAN SHRIMP
Unknown	HUMMUS
Unknown	ITALIAN BEEF SANDWICH	552
Unknown	JAMAIKAN JERK SALMON
Unknown	KOREAN BEEF BOWL
Unknown	LEMON SHRIMPS
Unknown	MANGO SMOOTHIE BOWL
Unknown	MANGOLIAN BEEF	402
Unknown	MATCHA SMOOTHIE BOWL	172
Unknown	MC GRAND CHICKEN BURGER
Unknown	PACKAGE & REQUESTS:
Unknown	PANCAKE
Unknown	PASTA FUSILI W/VEGE
Unknown	PIZZA OMELATE	280
Unknown	POWER BALLS	149
Unknown	PROTEIN TIRAMISIU PANCAKE
Unknown	ROASTED BEEF SANDWICH
Unknown	SALMON BEETROOT
Unknown	SALMON PASTA PESTO	402
Unknown	SALMON WITH SALSA
Unknown	SHAKSHOKA
Unknown	SHISHTAWOOK W/RICE	535
Unknown	SHRIMP BIRYANI
Unknown	SOUTH CHICKEN WRAP
Unknown	SPAGHETTI BOLOGNAISE
Unknown	STEAK W/ MASHED POTATO
Unknown	STRAWBERRY BANANA SMOOTHIE
Unknown	SUNNY SIDE EGG	280
Unknown	TUNA MELT
Unknown	VEGETABLE SOUP	131
Unknown	WHITE FISH BOWL
`.trim();

/* =========================
   Helpers
========================= */
function normalizeName(s: string) {
  return (s || "").trim().replace(/\s+/g, " ").toLowerCase();
}
function normalizeMealKey(s: string) {
  return (s || "").trim().replace(/\s+/g, " ").toUpperCase();
}

type MealRow = { cat: string; name: string; calories?: number };

function parseAllMealsFromTSV(tsv: string): MealRow[] {
  const rows = tsv
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out: MealRow[] = [];
  for (const line of rows) {
    const parts = line.split("\t").map((p) => (p ?? "").trim());
    const cat = parts[0] || "";
    const name = parts[1] || "";
    const calRaw = parts[2] || "";
    if (!name) continue;

    const maybe = calRaw ? Number(calRaw) : undefined;
    const calories = Number.isFinite(maybe) ? maybe : undefined;

    out.push({ cat, name, calories });
  }
  return out;
}

// ✅ كل الصفوف من الجدول
const ALL_MEALS_ROWS: MealRow[] = parseAllMealsFromTSV(ALL_MEALS_TSV);

// ✅ خريطة سعرات من الجدول (لو موجودة)
const CALORIES_FROM_SHEET = new Map<string, number>();
ALL_MEALS_ROWS.forEach((r) => {
  const key = normalizeMealKey(r.name);
  if (typeof r.calories === "number") CALORIES_FROM_SHEET.set(key, r.calories);
});

// ✅ تقدير سعرات تقريبي (لو مش موجودة)
function estimateCalories(mealKey: string, cat: SeedCategoryName): number {
  const k = mealKey;

  // حلويات
  if (
    k.includes("CAKE") ||
    k.includes("BROWNIES") ||
    k.includes("DESSERT") ||
    k.includes("TIRAMISU") ||
    k.includes("LAZY CAKE") ||
    k.includes("UMM ALI")
  ) {
    return 420;
  }

  // سناكات/سلاطات/شوربة
  if (cat === "Snacks" || k.includes("SALAD") || k.includes("SOUP")) {
    if (k.includes("SALAD")) return 220;
    if (k.includes("SOUP")) return 180;
    if (k.includes("SMOOTHIE")) return 260;
    if (k.includes("YOGURT")) return 170;
    return 250;
  }

  // إفطار
  if (cat === "Breakfast") {
    if (k.includes("PANCAKE")) return 320;
    if (k.includes("OATMEAL") || k.includes("PUDDING")) return 280;
    if (k.includes("CROISANT")) return 360;
    if (k.includes("EGG")) return 300;
    return 310;
  }

  // غداء/عشاء
  if (k.includes("BURGER") || k.includes("SANDWICH") || k.includes("WRAP"))
    return 430;
  if (k.includes("PASTA") || k.includes("SPAGHETTI") || k.includes("NOODLES"))
    return 520;
  if (k.includes("RICE") || k.includes("BIRYANI") || k.includes("MAJBOUS"))
    return 560;
  if (k.includes("SALMON") || k.includes("SHRIMP") || k.includes("FISH"))
    return 420;

  // افتراضي
  return cat === "Lunch" || cat === "Dinner" ? 500 : 300;
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T, idx: number) => Promise<void>,
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await Promise.all(chunk.map((it, idx) => fn(it, i + idx)));
  }
}

export default function Menu() {
  const { data: categories = [] } = useCategories();
  const { data: menuItems = [] } = useMenuItems();
  const { data: modifiers = [] } = useModifiers();

  const { t, dir, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("categories");

  const isRtl = dir === "rtl";

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-heading">
            {t("menu.title")}
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            {t("menu.subtitle")}
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
        dir={dir}
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="categories">
            {t("menu.tab.categories")}
          </TabsTrigger>
          <TabsTrigger value="items">{t("menu.tab.items")}</TabsTrigger>

          {/* ✅ ONLY Modifiers (No Addons) */}
          <TabsTrigger value="modifiers" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            {language === "ar" ? "التفضيلات والكميات والممنوعات" : "Modifiers"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <CategoriesTab categories={categories} />
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <MenuItemsTab menuItems={menuItems} categories={categories} />
        </TabsContent>

        <TabsContent value="modifiers" className="space-y-4">
          <ModifiersTab modifiers={modifiers as any} />
        </TabsContent>
      </Tabs>

      <div className="text-[10px] text-muted-foreground/50 mt-8">Menu.tsx</div>
    </div>
  );
}

/* =========================
   ✅ CategoriesTab
========================= */
function CategoriesTab({ categories }: { categories: MealCategory[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<MealCategory | null>(null);
  const [name, setName] = useState("");
  const { t, language } = useLanguage();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const reorderCategories = useReorderCategories();
  const deleteCategory = useDeleteCategory();

  const sortedCategories = useMemo(
    () => categories.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateCategory.mutateAsync({ id: editing._id, data: { name } });
      } else {
        const maxSortOrder =
          categories.length > 0
            ? Math.max(...categories.map((c) => c.sortOrder))
            : 0;
        await createCategory.mutateAsync({ name, sortOrder: maxSortOrder + 1 });
      }
      setIsOpen(false);
      setEditing(null);
      setName("");
    } catch (error: any) {
      console.error("Failed to save category:", error);
      alert(
        error?.message || (language === "ar" ? "فشل الحفظ" : "Save failed"),
      );
    }
  };

  const move = async (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sortedCategories.length - 1) return;

    const newOrder = [...sortedCategories];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newOrder[index], newOrder[targetIndex]] = [
      newOrder[targetIndex],
      newOrder[index],
    ];

    const reorderedCategories = newOrder.map((cat, idx) => ({
      id: cat._id,
      sortOrder: idx + 1,
    }));

    try {
      await reorderCategories.mutateAsync(reorderedCategories);
    } catch (error: any) {
      console.error("Failed to reorder categories:", error);
      alert(
        error?.message ||
          (language === "ar" ? "فشل الترتيب" : "Reorder failed"),
      );
    }
  };

  const onDelete = async (cat: MealCategory) => {
    const ok = window.confirm(
      language === "ar"
        ? `هل تريد حذف الصنف "${cat.name}"؟\nلن يتم الحذف إذا كان عليه وجبات.`
        : `Delete category "${cat.name}"?\nIt can't be deleted if it has items.`,
    );
    if (!ok) return;

    try {
      await deleteCategory.mutateAsync(cat._id);
    } catch (error: any) {
      alert(
        error?.message || (language === "ar" ? "فشل الحذف" : "Delete failed"),
      );
    }
  };

  // Count meals per category
  const { data: menuItems } = useMenuItems();
  const getCategoryMealCount = (categoryId: string) => {
    return menuItems?.filter((item: any) => item.categoryId === categoryId).length || 0;
  };

  const totalMeals = menuItems?.length || 0;
  const activeCategories = sortedCategories.filter(c => getCategoryMealCount(c._id) > 0).length;

  // Get icon and color for each category
  const getCategoryStyle = (name: string) => {
    const n = name.toUpperCase();
    if (n.includes("BREAKFAST") || n.includes("فطور")) {
      return { icon: "☀️", color: "from-orange-400 to-orange-500", lightBg: "bg-orange-50", borderColor: "border-orange-200" };
    }
    if (n.includes("LUNCH") || n.includes("غداء")) {
      return { icon: "🍽️", color: "from-blue-400 to-blue-500", lightBg: "bg-blue-50", borderColor: "border-blue-200" };
    }
    if (n.includes("DINNER") || n.includes("عشاء")) {
      return { icon: "🌙", color: "from-purple-400 to-purple-500", lightBg: "bg-purple-50", borderColor: "border-purple-200" };
    }
    if (n.includes("SNACK") || n.includes("سناك")) {
      return { icon: "🥗", color: "from-green-400 to-green-500", lightBg: "bg-green-50", borderColor: "border-green-200" };
    }
    return { icon: "•••", color: "from-gray-400 to-gray-500", lightBg: "bg-gray-50", borderColor: "border-gray-200" };
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-cyan-50 to-blue-50 p-4 sm:p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-lg">
            <Database className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight font-heading text-gray-800">
              {language === "ar" ? "إدارة التصنيفات" : "Categories Management"}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              {language === "ar" ? "تنظيم وترتيب أنواع الوجبات" : "Organize and sort meal types"}
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setName("");
            setIsOpen(true);
          }}
          className="h-11 sm:h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg"
        >
          <Plus className={cn("h-4 w-4", language === "ar" ? "ml-2" : "mr-2")} />
          {language === "ar" ? "إضافة صنف جديد" : "Add Category"}
        </Button>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-4 sm:p-6 border-2 border-blue-100 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">📊</span>
          <h3 className="font-bold text-gray-800 text-base sm:text-lg">
            {language === "ar" ? "نظرة سريعة على القائمة" : "Quick Menu Overview"}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-cyan-600">{totalMeals}</div>
            <div className="text-xs sm:text-sm text-gray-600 font-medium">
              {language === "ar" ? "إجمالي الوجبات" : "Total Meals"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-blue-600">{activeCategories}</div>
            <div className="text-xs sm:text-sm text-gray-600 font-medium">
              {language === "ar" ? "تصنيفات نشطة" : "Active Categories"}
            </div>
          </div>
        </div>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={language === "ar" ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle
                className={language === "ar" ? "text-right" : "text-left"}
              >
                {editing ? t("menu.edit_category") : t("menu.add_category")}
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={handleSubmit}
              className={cn(
                "space-y-4 py-4",
                language === "ar" ? "text-right" : "text-left",
              )}
            >
              <div className="space-y-2">
                <Label>{t("menu.name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Breakfast"
                  required
                  className={language === "ar" ? "text-right" : "text-left"}
                />
              </div>

              <DialogFooter>
                <Button type="submit">{t("common.save")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      {/* Categories Grid */}
      {sortedCategories.length === 0 ? (
        <div className="bg-white/70 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">📂</div>
          <p className="text-gray-500 text-lg font-medium">
            {language === "ar" ? "لا توجد تصنيفات بعد" : "No categories yet"}
          </p>
          <p className="text-gray-400 text-sm mt-2">
            {language === "ar" ? "ابدأ بإضافة تصنيف جديد" : "Start by adding a new category"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {sortedCategories.map((cat: any, idx: number) => {
            const style = getCategoryStyle(cat.name);
            const mealCount = getCategoryMealCount(cat._id);

            return (
              <div
                key={cat._id}
                className={cn(
                  "group relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-2",
                  style.borderColor
                )}
              >
                {/* Gradient Header */}
                <div className={cn("h-24 bg-gradient-to-br p-4 flex items-center justify-between", style.color)}>
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{style.icon}</div>
                    <div className="text-white">
                      <div className="text-xl font-bold">{cat.name}</div>
                      <div className="text-xs opacity-90">
                        {language === "ar" ? "الترتيب" : "Order"}: #{cat.sortOrder}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Meal Count Badge */}
                  <div className="flex items-center justify-center">
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-3 rounded-xl shadow-lg">
                      <div className="text-3xl font-bold">{mealCount}</div>
                      <div className="text-xs font-medium opacity-95">
                        {language === "ar" ? "وجبة" : "Meals"}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-2">
                    {/* Move Buttons */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-cyan-50 hover:border-cyan-400 hover:text-cyan-600"
                        onClick={() => move(idx, "up")}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-cyan-50 hover:border-cyan-400 hover:text-cyan-600"
                        onClick={() => move(idx, "down")}
                        disabled={idx === sortedCategories.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Edit & Delete Buttons */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600"
                        onClick={() => {
                          setEditing(cat);
                          setName(cat.name);
                          setIsOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg hover:bg-red-50 hover:border-red-400 hover:text-red-600"
                        onClick={() => onDelete(cat)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================
   ✅ MenuItemsTab
========================= */
function MenuItemsTab({
  menuItems,
  categories,
}: {
  menuItems: MenuItem[];
  categories: MealCategory[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const { t, language, dir } = useLanguage();

  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const deleteMenuItem = useDeleteMenuItem();

  // Seed helpers
  const createCategory = useCreateCategory();
  const reorderCategories = useReorderCategories();

  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const sortedCategories = useMemo(
    () =>
      categories.slice().sort((a: any, b: any) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  useEffect(() => {
    if (!selectedCategoryId && sortedCategories.length > 0) {
      setSelectedCategoryId(sortedCategories[0]._id);
    }
  }, [sortedCategories, selectedCategoryId]);

  const selectedCategory = useMemo(
    () => sortedCategories.find((c) => c._id === selectedCategoryId) || null,
    [sortedCategories, selectedCategoryId],
  );

  const [q, setQ] = useState("");

  const filteredItems = useMemo(() => {
    const query = q.trim().toLowerCase();
    return menuItems
      .filter((it: any) =>
        selectedCategoryId ? it.categoryId === selectedCategoryId : true,
      )
      .filter((it: any) =>
        !query ? true : (it.name || "").toLowerCase().includes(query),
      );
  }, [menuItems, selectedCategoryId, q]);

  // Form state
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [calories, setCalories] = useState("");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setCategoryId(selectedCategoryId || sortedCategories[0]?._id || "");
    setCalories("");
    setIsActive(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setName(item.name);
    setCategoryId(item.categoryId);
    setCalories(item.calories?.toString() || "");
    setIsActive(item.isActive);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name,
      categoryId,
      calories: calories ? parseInt(calories) : undefined,
      isActive,
    };

    try {
      if (editing) {
        await updateMenuItem.mutateAsync({ id: editing._id, data });
      } else {
        await createMenuItem.mutateAsync({ ...data, tags: undefined });
      }
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Failed to save menu item:", error);
      alert(
        error?.message || (language === "ar" ? "فشل الحفظ" : "Save failed"),
      );
    }
  };

  const onDeleteItem = async (item: MenuItem) => {
    const ok = window.confirm(
      language === "ar"
        ? `حذف الوجبة "${item.name}"؟`
        : `Delete "${item.name}"?`,
    );
    if (!ok) return;

    try {
      await deleteMenuItem.mutateAsync(item._id);
    } catch (error: any) {
      alert(
        error?.message || (language === "ar" ? "فشل الحذف" : "Delete failed"),
      );
    }
  };

  // Seed helpers
  const categoriesByName = useMemo(() => {
    const map = new Map<string, MealCategory>();
    categories.forEach((c) => map.set(normalizeName(c.name), c));
    return map;
  }, [categories]);

  // ✅ منع التكرار "بالاسم" على مستوى كل الأصناف
  const existingNamesGlobal = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((it: any) => set.add(normalizeMealKey(it.name)));
    return set;
  }, [menuItems]);

  const seedAllMealsToMenu = async () => {
    if (seeding) return;
    setSeedMsg(null);
    setSeeding(true);

    try {
      // 1) Ensure categories exist
      const ensured: Record<string, string> = {};

      for (const c of SEED_CATEGORIES) {
        const found = categoriesByName.get(normalizeName(c.name));
        if (found) {
          ensured[c.name] = found._id;
          continue;
        }

        const maxSortOrder =
          categories.length > 0
            ? Math.max(...categories.map((x) => x.sortOrder))
            : 0;

        const created = await createCategory.mutateAsync({
          name: c.name,
          sortOrder: maxSortOrder + 1,
        });

        if ((created as any)?._id) ensured[c.name] = (created as any)._id;
      }

      // 2) Reorder categories (best-effort)
      const current = categories.slice();
      const desiredOrderNames = SEED_CATEGORIES.map((x) =>
        normalizeName(x.name),
      );

      const merged = [
        ...current
          .filter((c) => desiredOrderNames.includes(normalizeName(c.name)))
          .sort(
            (a, b) =>
              desiredOrderNames.indexOf(normalizeName(a.name)) -
              desiredOrderNames.indexOf(normalizeName(b.name)),
          ),
        ...current.filter(
          (c) => !desiredOrderNames.includes(normalizeName(c.name)),
        ),
      ].map((c, idx) => ({ id: c._id, sortOrder: idx + 1 }));

      try {
        await reorderCategories.mutateAsync(merged);
      } catch {
        // ignore
      }

      const getCatId = (catName: SeedCategoryName) => {
        if (ensured[catName]) return ensured[catName];
        const found = categoriesByName.get(normalizeName(catName));
        return found?._id || "";
      };

      // 3) Build jobs
      const jobs: Array<{ catName: SeedCategoryName; itemName: string }> = [];

      // Base seed
      (Object.keys(SEED_MENU) as Array<keyof typeof SEED_MENU>).forEach(
        (catName) => {
          SEED_MENU[catName].forEach((itemName) =>
            jobs.push({ catName, itemName }),
          );
        },
      );

      // TSV seed
      const mapTSVCatToSeed = (raw: string): SeedCategoryName => {
        const x = normalizeName(raw);
        if (x === "breakfast") return "Breakfast";
        if (x === "lunch") return "Lunch";
        if (x === "dinner") return "Dinner";
        if (x === "snack" || x === "snacks") return "Snacks";
        if (x === "unknown") return "Other";
        return "Other";
      };

      ALL_MEALS_ROWS.forEach((r) => {
        const catName = mapTSVCatToSeed(r.cat);
        const mealName = r.name;
        if (!mealName) return;

        const key = normalizeMealKey(mealName);
        if (key === "PACKAGE & REQUESTS:" || key === "PACKAGE & REQUESTS")
          return;

        jobs.push({ catName, itemName: mealName });
      });

      // 4) Insert without duplicates
      let added = 0;
      let skipped = 0;

      await runInBatches(jobs, 8, async (job) => {
        const mealKey = normalizeMealKey(job.itemName);

        if (existingNamesGlobal.has(mealKey)) {
          skipped++;
          return;
        }

        const catId = getCatId(job.catName);
        if (!catId) {
          skipped++;
          return;
        }

        const fromSheet = CALORIES_FROM_SHEET.get(mealKey);
        const finalCalories =
          typeof fromSheet === "number"
            ? fromSheet
            : estimateCalories(mealKey, job.catName);

        await createMenuItem.mutateAsync({
          name: job.itemName,
          categoryId: catId,
          calories: finalCalories,
          isActive: true,
          tags: undefined,
        });

        existingNamesGlobal.add(mealKey);
        added++;
      });

      setSeedMsg(
        language === "ar"
          ? `✅ تم الإدخال: تمت إضافة ${added} وجبة، وتخطي ${skipped} (موجود/غير صالح).`
          : `✅ Seed done: Added ${added} items, skipped ${skipped}.`,
      );
    } catch (error) {
      console.error("Seed failed:", error);
      setSeedMsg(
        language === "ar"
          ? "❌ فشل الإدخال. راجع Console."
          : "❌ Seed failed. Check console.",
      );
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header with Icon */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-cyan-50 to-blue-50 p-4 sm:p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight font-heading text-gray-800">
              {language === "ar" ? "إدارة القائمة" : "Menu Management"}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              {language === "ar" ? "تكوين وجباتك وعروضك" : "Configure your meals and offerings"}
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Button
          variant={!selectedCategoryId ? "default" : "outline"}
          size="sm"
          className="rounded-xl whitespace-nowrap h-10 px-4 shadow-sm"
          onClick={() => setSelectedCategoryId("")}
        >
          <span>{language === "ar" ? "الكل" : "All"}</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-white/30 text-xs font-bold">
            {menuItems.length}
          </span>
        </Button>
        
        {sortedCategories.map((c: any) => {
          const count = menuItems.filter((it: any) => it.categoryId === c._id).length;
          return (
            <Button
              key={c._id}
              variant={selectedCategoryId === c._id ? "default" : "outline"}
              size="sm"
              className="rounded-xl whitespace-nowrap h-10 px-4 shadow-sm"
              onClick={() => setSelectedCategoryId(c._id)}
            >
              <span>{c.name}</span>
              <span className={cn(
                "ml-2 px-2 py-0.5 rounded-full text-xs font-bold",
                selectedCategoryId === c._id ? "bg-white/30" : "bg-gray-100"
              )}>
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400", language === "ar" ? "right-4" : "left-4")} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={language === "ar" ? "بحث باسم الوجبة..." : "Search meal name..."}
            className={cn("h-11 sm:h-12 rounded-xl shadow-sm border-gray-200 bg-white text-sm", language === "ar" ? "pr-12 text-right" : "pl-12")}
          />
        </div>

        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button 
              onClick={resetForm} 
              className="h-11 sm:h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg whitespace-nowrap"
            >
              <Plus className={cn("h-4 w-4", language === "ar" ? "ml-2" : "mr-2")} />
              {t("menu.add_item")}
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle
                className={language === "ar" ? "text-right" : "text-left"}
              >
                {editing ? t("menu.edit_item") : t("menu.add_item")}
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={handleSubmit}
              className={cn(
                "space-y-4 py-4",
                language === "ar" ? "text-right" : "text-left",
              )}
            >
              <div className="space-y-2">
                <Label>{t("menu.name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={language === "ar" ? "text-right" : "text-left"}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("menu.category")}</Label>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  dir={dir}
                >
                  <SelectTrigger
                    className={language === "ar" ? "text-right" : "text-left"}
                  >
                    <SelectValue
                      placeholder={
                        language === "ar" ? "اختر الصنف" : "Select category"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedCategories.map((c: any) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("menu.calories")}</Label>
                <Input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className={language === "ar" ? "text-right" : "text-left"}
                />
              </div>

              <div
                className={cn(
                  "flex items-center space-x-2",
                  language === "ar" ? "space-x-reverse" : "",
                )}
              >
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>{t("menu.active")}</Label>
              </div>

              <DialogFooter>
                <Button type="submit">{t("common.save")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          size="sm"
          onClick={seedAllMealsToMenu}
          disabled={seeding}
          className="h-11 sm:h-12 rounded-xl whitespace-nowrap"
        >
          <Database className={cn("h-4 w-4", language === "ar" ? "ml-2" : "mr-2")} />
          <span className="hidden sm:inline">
            {seeding
              ? (language === "ar" ? "جاري الإدخال..." : "Seeding...")
              : (language === "ar" ? "إدخال" : "Seed")}
          </span>
        </Button>
      </div>

      {seedMsg ? (
        <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
          {seedMsg}
        </div>
      ) : null}

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <UtensilsCrossed className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm sm:text-base">
              {language === "ar" ? "لا توجد وجبات" : "No meals found"}
            </p>
          </div>
        ) : (
          filteredItems.map((item: any) => (
            <MenuItemCard
              key={item._id}
              item={item}
              categoryName={selectedCategory?.name || "Unknown"}
              onEdit={openEdit}
              onDelete={async (id, name) => {
                const ok = confirm(
                  language === "ar" ? `حذف ${name}؟` : `Delete ${name}?`
                );
                if (!ok) return;
                await deleteMenuItem.mutateAsync(id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* =========================
   ✅ ModifiersTab (التفضيلات/الممنوعات/الكميات)
========================= */
type ModifierGroup = "PREF" | "AVOID" | "PORTION";

function groupLabel(g: ModifierGroup, isRtl: boolean) {
  if (!isRtl) {
    if (g === "PREF") return "Preferences";
    if (g === "AVOID") return "Avoid";
    return "Portion";
  }
  if (g === "PREF") return "تفضيلات";
  if (g === "AVOID") return "ممنوعات";
  return "كميات";
}

function ModifiersTab({ modifiers }: { modifiers: Modifier[] }) {
  const { language, dir } = useLanguage();
  const isRtl = dir === "rtl" || language === "ar";

  const createModifier = useCreateModifier();
  const updateModifier = useUpdateModifier();
  const deleteModifier = useDeleteModifier();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Modifier | null>(null);

  const [name, setName] = useState("");
  const [group, setGroup] = useState<ModifierGroup>("PREF");
  const [isActive, setIsActive] = useState(true);

  const reset = () => {
    setEditing(null);
    setName("");
    setGroup("PREF");
    setIsActive(true);
  };

  const sorted = useMemo(() => {
    return (modifiers || []).slice().sort((a: any, b: any) => {
      const ga = String(a.group || "");
      const gb = String(b.group || "");
      if (ga !== gb) return ga.localeCompare(gb);

      const aa = a.isActive ? 1 : 0;
      const bb = b.isActive ? 1 : 0;
      if (aa !== bb) return bb - aa;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [modifiers]);

  const openEdit = (m: Modifier) => {
    setEditing(m);
    setName((m as any).name || "");
    setGroup(((m as any).group || "PREF") as any);
    setIsActive(!!(m as any).isActive);
    setIsOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { name, group, isActive };

    try {
      if (editing) {
        await updateModifier.mutateAsync({
          id: (editing as any)._id,
          data: payload,
        });
      } else {
        await createModifier.mutateAsync(payload);
      }
      setIsOpen(false);
      reset();
    } catch (err: any) {
      console.error(err);
      alert(isRtl ? "فشل الحفظ" : "Save failed");
    }
  };

  const onDelete = async (m: Modifier) => {
    const ok = confirm(
      isRtl ? `حذف "${(m as any).name}"؟` : `Delete "${(m as any).name}"?`,
    );
    if (!ok) return;
    try {
      await deleteModifier.mutateAsync((m as any)._id);
    } catch (err) {
      alert(isRtl ? "فشل الحذف" : "Delete failed");
    }
  };

  // Group modifiers by type
  const grouped = useMemo(() => {
    const result: Record<ModifierGroup, any[]> = {
      PREF: [],
      AVOID: [],
      PORTION: [],
    };
    sorted.forEach((m: any) => {
      const g = m.group || "PREF";
      if (result[g as ModifierGroup]) {
        result[g as ModifierGroup].push(m);
      }
    });
    return result;
  }, [sorted]);

  const counts = {
    PREF: grouped.PREF.length,
    AVOID: grouped.AVOID.length,
    PORTION: grouped.PORTION.length,
  };

  // Get icon and color for each group
  const getGroupStyle = (g: ModifierGroup) => {
    if (g === "PREF") {
      return {
        icon: "➕",
        color: "text-blue-600",
        bg: "from-blue-400 to-blue-500",
        lightBg: "bg-blue-50",
        borderColor: "border-blue-200",
      };
    }
    if (g === "AVOID") {
      return {
        icon: "🚫",
        color: "text-red-600",
        bg: "from-red-400 to-red-500",
        lightBg: "bg-red-50",
        borderColor: "border-red-200",
      };
    }
    return {
      icon: "⚖️",
      color: "text-orange-600",
      bg: "from-orange-400 to-orange-500",
      lightBg: "bg-orange-50",
      borderColor: "border-orange-200",
    };
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-cyan-50 to-blue-50 p-4 sm:p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-lg">
            <SlidersHorizontal className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight font-heading text-gray-800">
              {isRtl ? "إدارة الخيارات" : "Options Management"}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              {isRtl ? "تخصيص الوجبات والتفضيلات" : "Customize meals and preferences"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {(["PREF", "AVOID", "PORTION"] as ModifierGroup[]).map((g) => {
          const style = getGroupStyle(g);
          return (
            <div
              key={g}
              className={cn(
                "rounded-2xl border-2 p-4 sm:p-5 text-center shadow-md",
                style.lightBg,
                style.borderColor
              )}
            >
              <div className="text-3xl sm:text-4xl mb-2">{style.icon}</div>
              <div className={cn("text-2xl sm:text-3xl font-bold mb-1", style.color)}>
                {counts[g]}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium">
                {groupLabel(g, isRtl)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <Dialog
          open={isOpen}
          onOpenChange={(o) => {
            setIsOpen(o);
            if (!o) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={reset} className="h-11 sm:h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg">
              <Plus className={cn("h-4 w-4", isRtl ? "ml-2" : "mr-2")} />
              {isRtl ? "إضافة خيار +" : "Add Option +"}
            </Button>
          </DialogTrigger>

          <DialogContent
            className="sm:max-w-[425px]"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <DialogHeader>
              <DialogTitle className={isRtl ? "text-right" : "text-left"}>
                {editing ? (isRtl ? "تعديل" : "Edit") : isRtl ? "إضافة" : "Add"}
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={onSubmit}
              className={cn(
                "space-y-4 py-4",
                isRtl ? "text-right" : "text-left",
              )}
            >
              <div className="space-y-2">
                <Label>{isRtl ? "الاسم" : "Name"}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={isRtl ? "text-right" : "text-left"}
                  placeholder={isRtl ? "مثال: بدون طماطم" : "e.g. No tomato"}
                />
              </div>

              <div className="space-y-2">
                <Label>{isRtl ? "النوع" : "Group"}</Label>
                <Select
                  value={group}
                  onValueChange={(v) => setGroup(v as any)}
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  <SelectTrigger className={isRtl ? "text-right" : "text-left"}>
                    <SelectValue
                      placeholder={isRtl ? "اختر النوع" : "Select group"}
                    />
                  </SelectTrigger>
                  <SelectContent dir={isRtl ? "rtl" : "ltr"}>
                    <SelectItem value="PREF">
                      {groupLabel("PREF", isRtl)}
                    </SelectItem>
                    <SelectItem value="AVOID">
                      {groupLabel("AVOID", isRtl)}
                    </SelectItem>
                    <SelectItem value="PORTION">
                      {groupLabel("PORTION", isRtl)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div
                className={cn(
                  "flex items-center gap-2",
                  isRtl ? "flex-row-reverse" : "flex-row",
                )}
              >
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>{isRtl ? "نشط" : "Active"}</Label>
              </div>

              <DialogFooter
                className={cn(isRtl ? "flex-row-reverse" : "flex-row")}
              >
                <Button type="submit">{isRtl ? "حفظ" : "Save"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grouped Modifiers */}
      {(["AVOID", "PREF", "PORTION"] as ModifierGroup[]).map((g) => {
        const items = grouped[g];
        if (items.length === 0) return null;
        
        const style = getGroupStyle(g);
        
        return (
          <div key={g} className="space-y-3">
            {/* Group Header */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold shadow-lg bg-gradient-to-r",
                style.bg
              )}>
                <span className="text-xl">{style.icon}</span>
                <span>{groupLabel(g, isRtl)}</span>
                <span className="px-2 py-0.5 rounded-full bg-white/30 text-sm">
                  {items.length}
                </span>
              </div>
            </div>

            {/* Group Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((m: any) => (
                <div
                  key={m._id}
                  className={cn(
                    "rounded-xl border-2 p-4 shadow-md hover:shadow-lg transition-all duration-300 active:scale-98",
                    style.lightBg,
                    style.borderColor
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1 rounded-lg font-semibold text-sm",
                      m.isActive 
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-sm" 
                        : "bg-gray-200 text-gray-500"
                    )}>
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        m.isActive ? "bg-white animate-pulse" : "bg-gray-400"
                      )} />
                      <span>{m.isActive ? (isRtl ? "نشط" : "Active") : (isRtl ? "غير نشط" : "Inactive")}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-white/80"
                        onClick={() => openEdit(m)}
                      >
                        <Edit2 className="h-4 w-4 text-gray-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-red-50"
                        onClick={() => onDelete(m)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-white/80 rounded-lg p-3 border border-white/50">
                    <p className="font-bold text-gray-900 text-sm sm:text-base">
                      {m.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {sorted.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <SlidersHorizontal className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm sm:text-base">
            {isRtl ? "لا توجد خيارات بعد" : "No options yet"}
          </p>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            {isRtl ? "اضغط زر الإضافة لبدء إضافة الخيارات" : "Click add button to start"}
          </p>
        </div>
      )}

      <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-xl border border-blue-100">
        <span className="font-semibold text-blue-700">ℹ️ </span>
        {isRtl
          ? "هذه الخيارات تظهر تلقائياً في شاشة المطبخ (Kitchen Display) وفي ملصقات الوجبات. تأكد من تفعيل الخيارات المتاحة فقط."
          : "These options appear automatically in Kitchen Display and meal stickers. Make sure to activate only available options."}
      </div>
    </div>
  );
}
