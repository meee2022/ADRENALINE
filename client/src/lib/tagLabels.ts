/**
 * @file tagLabels.ts
 * @description ترجمة وسوم الوجبات (tags) الشائعة من العربي للإنجليزي للعرض.
 *  الوسوم مخزّنة بالعربي في قاعدة البيانات؛ نترجم المعروف ونُبقي الباقي كما هو.
 */
const TAG_EN: Record<string, string> = {
  "لحم بقري": "Beef",
  "دجاج": "Chicken",
  "لحم": "Meat",
  "سمك": "Fish",
  "أرز": "Rice",
  "خضار": "Vegetables",
  "خضروات": "Vegetables",
  "سلطة": "Salad",
  "حلويات": "Dessert",
  "حلوى": "Dessert",
  "مشروب": "Drink",
  "عصير": "Juice",
  "سناك": "Snack",
  "فطور": "Breakfast",
  "غداء": "Lunch",
  "عشاء": "Dinner",
  "وجبة صحية": "Healthy",
  "صحي": "Healthy",
  "طازج": "Fresh",
  "طازة": "Fresh",
  "لذيذ": "Delicious",
  "لذيذة": "Delicious",
  "غني بالبروتين": "High Protein",
  "عالي البروتين": "High Protein",
  "بروتين عالي": "High Protein",
  "قليل الكربوهيدرات": "Low Carb",
  "قليل السعرات": "Low Calorie",
  "قليل الدهون": "Low Fat",
  "كيتو": "Keto",
  "نباتي": "Vegetarian",
  "خالي من الغلوتين": "Gluten Free",
  "حار": "Spicy",
  "مشوي": "Grilled",
  "شاورما": "Shawarma",
  "برجر": "Burger",
  "باستا": "Pasta",
  "بيتزا": "Pizza",
};

export function tagLabel(tag: string, isRtl: boolean): string {
  if (isRtl) return tag;
  const key = String(tag || "").trim();
  return TAG_EN[key] || key; // غير المعروف يظل كما هو
}
