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

  // ⚡ مصغّرات POS مبنيّة 2026-07-26: كانت هذه الأصناف تُحمّل صورها الأصلية
  //    (5250×3500 ~1.2MB) لتُعرض في 142×120 — سبب تقطيع التمرير وتأخّر الكتابة.
  "BEEF SHAWARMA WITH BEETROOT RICE": "Beef Shawarma with Beetroot Rice.webp",
  "MONGOLIAN BEEF NOODLES": "Mongolian Beef Noodles.webp",
  "SALMON CURRY": "Salmon Curry.webp",
  "COOKIES": "Cookies.webp",
  "GREEK INFUSION": "Greek Infusion.webp",
  "BROWNIES": "Brownies.webp",
  "CHICKEN FAJITA SANDWICH": "Chicken Fajita Sandwich.webp",
  "EGG AVOCADO TOAST": "Egg Avocado Toast.webp",
  "CHICKEN AVOCADO SANDWICH": "Chicken Avocado Sandwich.webp",
  "CHICKEN STROGANOFF": "Chicken Stroganoff.webp",
  "SHISHTAWOOK SANDWICH": "Shishtawook Sandwich.webp",
  "PROTEIN LAVA CAKE": "Protein Lava Cake.webp",
  "GATHERING BOX SUB SANDWICHES": "Gathering Box Sub Sandwiches.webp",
  "GATHERING BOX TACOS": "Gathering Box Tacos.webp",
  "GATHERING BOX SANDWICHES": "Gathering Box Sandwiches.webp",
  "GATHERING BOX BURGERS": "Gathering Box Burgers.webp",
  "FRESH ORANGE JUICE": "Fresh Orange Juice.webp",
  "DETOX SHOT": "Detox Shot.webp",
  "BEETROOT SHOT": "Beetroot Shot.webp",
  "FRESH PINEAPPLE CUT": "Fresh Pineapple Cut.webp",
  "MIX POMEGRANATE PINEAPPLE": "Mix Pomegranate&pineapple.webp",
  "FRESH MANDARIN WITH POMEGRANATE": "Fresh Mandarin with Pomegranate.webp",
  "MIX STRAWBERRY BLUEBERRY": "Mix Strawberry & Blueberry.webp",
  "POMEGRANATE": "Pomegranate.webp",
  "PIZZA SLICE VEGGIE": "Pizza Slice Veggie.webp",
  "PIZZA SLICE PEPPERONI": "Pizza Slice Pepperoni.webp",
  "PEPPERONI PIZZA": "Pepperoni Pizza.webp",
  "VEGGIE PIZZA": "Veggie Pizza.webp",
  "CRISPY CHICKEN BURGER": "Crispy Chicken Burger.webp",
  "ADRENALINE BEEF BURGER": "Adrenaline Beef Burger.webp",
  "TUNA SANDWICH": "Tuna Sandwich.webp",
  "MASHED POTATO 100G": "Mashed Potato 100g.webp",
  "MASHED POTATO 150G": "Mashed Potato 150g.webp",
  "MASHED POTATO 200G": "Mashed Potato 200g.webp",
  "MASHED POTATO 250G": "Mashed Potato 250g.webp",
  "MASHED SWEET POTATO 100G": "Mashed Sweet Potato 100g.webp",
  "MASHED SWEET POTATO 150G": "Mashed Sweet Potato 150g.webp",
  "MASHED SWEET POTATO 200G": "Mashed Sweet Potato 200g.webp",
  "MASHED SWEET POTATO 250G": "Mashed Sweet Potato 250g.webp",
  "RICE 100G": "Rice 100g.webp",
  "RICE 150G": "Rice 150g.webp",
  "RICE 200G": "Rice 200g.webp",
  "RICE 250G": "Rice 250g.webp",
  "GRILLED CHICKEN 100G": "Grilled Chicken 100g.webp",
  "GRILLED CHICKEN 150G": "Grilled Chicken 150g.webp",
  "GRILLED CHICKEN 200G": "Grilled Chicken 200g.webp",
  "GRILLED CHICKEN 250G": "Grilled Chicken 250g.webp",
  "VEGAN AVOCADO TOAST": "Vegan Avocado Toast.webp",
  "BASBOUSA COCONUT": "Basbousa Coconut.webp",
  "BASBOUSA PISTACHIO": "Basbousa Pistachio.webp",
  "HAZELNUT LAVA CAKE": "Hazelnut Lava Cake.webp",
  "PECAN CARAMEL CHEESECAKE": "Pecan Caramel Cheesecake.webp",
  "TARTE": "Tarte.webp",
  "HEAVEN BALL": "Heaven Ball.webp",
  "KUNAFA PISTACHIO BALLS": "Kunafa Pistachio Balls.webp",
  "TALBINA MAJDOUL": "Talbina Majdoul.webp",
  "ADRENALINE SNICKERS": "Adrenaline Snickers.webp",
  "PISTACHIO LAVA CAKE": "Pistachio Lava Cake.webp",
  "PECAN WITH CHOCOLATE": "Pecan with Chocolate.webp",
  "VANILLA MUFFIN": "Vanilla Muffin.webp",
  "FRENCH TOAST": "French Toast.webp",
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
