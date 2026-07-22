/**
 * POS-only image catalogue. These assets are deliberately separate from
 * publicMeals so using them cannot change the website or subscriber menu.
 */
const POS_MEAL_IMAGES: Record<string, string> = {
  "LENTIL SOUP": "Lantin Soup شوربة العدس.jpg",
  "CLASSIC FATTOUSH SALAD": "Classic Fattouch فتوش كلاسيكي.jpg",
  "MEDITERRANEEN FETA SALAD": "Mediterrnnen Feta Salad  سلطة البحر الأبيض المتوسط بالفيتا.jpg",
  "PISTACHIO SALAD": "Pistachio Salad سلطة الفستق.jpg",
  "CRAB SALAD": "Crab Salad سلطة السلطعون.jpg",
  "BEETROOT SALAD": "Beetroot Salad سلطة الشمندر.jpg",
  "BEEF BURGER": "Beef Burger رجر لحم البقر.jpg",
  "STEAK SANDWICH": "Steak Sandwich ساندويتش ستيك.jpg",
  "HEALTHY CHICKEN MAJBOOS": "Adrenaline Healthy Majboos مجبوس صحي.jpg",
  "GREEK CHICKEN": "Greek Chicken دجاج يوناني.jpg",
  "BEEF KOFTA SAFFRON RICE": "Beef Kofta with Safran Rice كفتة لحم البقر مع أرز الزعفران.jpg",
  "BEEF KOFTA DELIGHT": "Beef Kofta Delight كفتة لحم البقر اللذيذة.jpg",
  "MONGOLIAN BEEF WITH NOODLES": "Mongolia Beef Noodles نودلز لحم البقر المنغولي.jpg",
  "ZUCHINI PASTA": "Creamu Zucchini Pasta باستا الكوسا بالكريمة.jpg",
  "IRANIAN KOFTA": "Iranian Kofta إيراني كفتة.jpg",
  "BEEF STROGANOFF": "Beef Stragnoff ستروجانوف اللحم البقري.jpg",
  "CHICKEN CURRY": "Chicken Curry كاري الدجاج.jpg",
  "CHICKEN ALFREDO PASTA": "Chicken Alfredo دجاج ألفريدو.jpg",
  "BEEF SHAWARMA BEETROOT RICE": "Beef Shawarma  with Beetroot Rice شاورما لحم البقر مع أرز الشمندر.jpg",
  "BEEF ALFREDO": "Beef Alfredo ألفريدو اللحم البقري.jpg",
  "CORDON BLEU": "Cordon Blue كوردون بلو.jpg",
  "FALAFIL WRAP": "Falafal Wrap لفافة الفلافل.jpg",
  "EGG MUFFIN": "Egg Muffin فطيرة البيض.jpg",
  "BUFFALO CHICKEN WRAP": "Buffalo Chicken Wrap لفافة دجاج بافالو.jpg",
  "BEEF FAJITA SANDWICH": "Fajita Beef Sandwich شطيرة لحم البقر بالفاهيتا.jpg",
  "BEEF SHAWARMA": "Beef Shawarma شاورما اللحم البقري.jpg",
  "CHICKEN SHAWARMA": "Chicken Shawarma شاورما الدجاج.jpg",
  "RICE PUDDING": "Rice Pudding بودينغ الأرز.jpg",
  "RASPBERRY RICE PUDDING": "Raspberry Rice Pudding بودينغ الأرز بالتوت.jpg",
  "ENERGY BALLS 3PCS": "Energy Balls كرات الطاقة.jpg",
  "TIRAMISU": "Tiramisu تيراميسو.jpg",
  "SWEET POTATO ENERGY BOOSTER": "Sweet Potatoes Energy Booster بطاطا الحلوة.jpg",
  "UMMALI": "Umm Ali أم علي.jpg",
  "POWER BALL": "Power Balls كرات الطاقة.jpg",
  "PROTEIN LAZY CAKE": "Protein Lazy Cake ليزي كيك بالبروتين.jpg",
  "SWEET POTATO DELIGHT": "Sweet Potato Delight بطاطا حلوة لذيذة.jpg",
  "CHICKEN TACOS": "Chicken Tacos تاكو الدجاج.jpg",
  "DYNAMITE SHRIMP": "Dynamite Shrimp ديناميت شرمب.jpg",
  "SHAKSHOUKA": "New Shashouka شكشوكة.jpg",
  "ORIENTAL BREAKFAST": "Oriental Breakfast فطور شرقي.jpg",
};

function normalizeMealName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export function getPosMealImage(...names: Array<string | null | undefined>) {
  for (const name of names) {
    if (!name) continue;
    const filename = POS_MEAL_IMAGES[normalizeMealName(name)];
    if (filename) {
      const thumbnail = filename.replace(/\.[^.]+$/, ".webp");
      return `/pos-meals/thumbs/${encodeURIComponent(thumbnail)}`;
    }
  }
  return null;
}
