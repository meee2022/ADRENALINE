/**
 * @file convex/menuOfficial.ts
 * @description جدول المنيو الرسمي — مولّد من ملفَي الإكسل، لا يُحرّر يدوياً.
 *
 *   المصدر: ADRENALINE HEALTHY NEW.xlsx (إنجليزي) + ADRENALINE HEALTHY  عربي.xlsx
 *   المولِّد: tmp/parse_excel.py
 *
 *   البنية: OFFICIAL = "أسبوع:يوم" → أسماء الوجبات (الخياران معاً، بلا تكرار).
 *          OFFICIAL_SLOTS = "أسبوع:يوم" → { اسم: تصنيف } — الخانة من الإكسل.
 *   6 أيام (السبت→الخميس) × 4 أسابيع = 24 يوماً × 9 وجبات = 216.
 *   الجمعة إجازة فلا تظهر.
 */

export const OFFICIAL: Record<string, string[]> = {
  "1:saturday": ["BEEF KOFTA WRAP", "BEETROOT SALAD", "CHICKEN SOUP", "CHICKEN TERYAKI BOWL", "EGG WITH ZAATER", "GARLIC BUTTER CHICKEN", "HALLOUMI SANDWICH", "HONEY GLAZE SALMON", "SWEET POTATO ENERGY BOOSTER"],
  "1:sunday": ["BEEF BALLS WITH RICE", "BROWNIES", "CEASAR SALAD", "CHICKEN CURRY", "CINNAMON APPLE YOGURT", "HUUMUS", "MIX VEGE OMELETE", "SHRIMP TACOS", "SPAGHETTI BOLOGNESE"],
  "1:monday": ["BEEF ALFREDO", "CHICKEN PARMESAN", "CHICKEN SHAWARMA", "EGG CROISANT", "HEALTHY CHICKEN MAJBOUS", "LENTIL SOUP", "NORMAL Pancake", "PISTACHIO SALAD", "UMM ALI"],
  "1:tuesday": ["BAHAMAS LAVA CAKE", "BEEF LASAGNA", "BEEF STROGANOF", "CRAB SALAD", "CRISPY CHICKEN CUTLETS", "EGG BURRITO", "SOUTHWEST CHICKEN WRAP", "SUNNY SIDE EGG W/ BROWN BREAD", "VEGETABLES SOUP"],
  "1:wednesday": ["BEEF KOFTA DELIGHT", "CHICKEN FAJITA SANDWICH", "CROISANT CHEESE", "DATE BALLS", "DYNAMITE SHRIMP", "GREEK INFUSION", "OMELETE PIZZA", "SHISHTAWOOK & RICE", "WALDORAF SALAD"],
  "1:thursday": ["BEEF SHAWERMA W/ BEETROOT RICE", "BERRY OATMEAL BOWL", "CREAMY GARLIC CHICKEN", "FRUIT SALAD", "MEDITERRANEAN FETA SALAD", "NEW GREEK CHICKEN", "SALMON PESTO PASTA", "TIRAMISU", "TURKEY CHEESE WRAP"],
  "2:saturday": ["BROCOLI SOUP", "CEASAR SALAD", "CHICKEN TACOS", "CHOCOLATE Pancakes", "IRANIAN CHICKEN", "ORIENTAL BREAKFAST", "SALMON NO CARB", "STEAK SANDWICH", "TALBINA"],
  "2:sunday": ["BEETROOT SALAD", "CHICKEN HERBS", "CINNAMON APPLE YOGURT", "CORDON BLUE", "CROISANT ZAATER", "FISH SYADIAH", "FRUIT SALAD", "GARLIC BUTTER STEAK & POTATOES", "NEW Egg sandwich"],
  "2:monday": ["BUFFALO CHICKEN WRAP", "CAJUN CHICKEN PASTA", "CHICKEN VEGETABLES", "COOKIES", "DAWOUD BASHA", "FATTOUSH", "MEXICAN OMELETE", "MUSHROOM SOUP", "SWEET POTATO DELIGHT"],
  "2:tuesday": ["BEEF SHAWERMA SANDWICH", "Chia  Seeds  Pudding", "ENERGY BALLS", "FOUL", "IRANIAN KOFTA", "LEMON CHICKEN", "NEW EGG SHAKSHOUKA", "SHRIMP CURRY", "lentil soup"],
  "2:wednesday": ["BEEF PASTRAMI SANDWICH", "BEEF VINDALO & RICE", "CHICKEN MAJBOUS", "CHOCOLATE PEANUTBUTTER", "CORN SOUP", "EGG AVOCADO TOAST", "JAMAICAN JERK SALMON", "MATCHA SMOOTHIE SHAKE", "PASSION FRUIT QUINOA SALAD"],
  "2:thursday": ["BEEF BURGER", "BEEF NOODLES", "Chicken Avocado Sandwich", "FALAFEL WRAP", "LEBANESE TRADITIONAL MUFFIN", "MEDITERRANEEN FETA SALAD", "RICE PUDDING", "SWEET CHILI CHICKEN", "VEGETABLES SOUP"],
  "3:saturday": ["BAHAMAS LAVA CAKE", "BEEF KOFTA W/ SAFRON RICE", "BROCOLI SOUP", "CRISPY STRIPS", "EGG MUFFIN", "LEMON SHRIMP", "NORMAL PANCAKES", "PENNE CHICKEN PASTA", "WALDORAF SALAD"],
  "3:sunday": ["CHICKEN BIRYANI", "CHICKEN MESAKHAN", "CROISANT TURKEY", "HALLOUMI MUFFIN", "MUFFIN", "MUSHROOM SOUP", "PISTACHIO SALAD", "SALMON W/ SALSA", "STUFFED PEPPERS"],
  "3:monday": ["BEEF ROLLS SWEET POTATOES", "CAJUN SHRIMP PASTA", "CHICKEN FATTAH", "CROISANT EGG RING", "LAZY CAKE", "LENTIL SOUP", "NEW Roasted Beef Sandwich", "OMELETE PIZZA", "PASSION FRUIT QUINOA SALAD"],
  "3:tuesday": ["CHOCOLATE PANCAKES", "CORN SOUP", "CRAB SALAD", "Peri  Peri Chicken & Rice", "SHISHTAWOOK WRAP", "SPAGHETTI BEEF BALLS", "SUNNY SIDE EGG W/ BROWN BREAD", "TIRAMISU", "TURKEY SANDWICH"],
  "3:wednesday": ["CEASAR SALAD", "CHICKEN STROGANOF", "FAJITA BEEF SANDWICH", "GREEK INFUSION", "NEW EGG SHAKSHOUKA", "SHRIMP MAJBOUS", "STEAK W/ MASHED POTATOES", "TURKEY ENGLISH MUFFIN", "VEGETABLES SOUP"],
  "3:thursday": ["CHICKEN ALFREDO", "CHICKEN TAJEN", "EGG QUESADILLAS", "FRUIT SALAD", "GRILLED CHICKEN BURGER", "MANGOLIAN NOODLES", "MEDITERRANEEN FETA SALAD", "PEANUTBUTTER OATMEAL", "RASPBERRY RICE PUDDING"],
  "4:saturday": ["BROCOLI SOUP", "CEASAR SALAD", "CHICKEN TACOS", "CHOCOLATE Pancakes", "IRANIAN CHICKEN", "ORIENTAL BREAKFAST", "SALMON NO CARB", "STEAK SANDWICH", "TALBINA"],
  "4:sunday": ["BEETROOT SALAD", "CHICKEN HERBS", "CINNAMON APPLE YOGURT", "CORDON BLUE", "CREAMY ZUCCHINI CHICKEN PASTA", "CROISANT ZAATER", "FISH SYADIAH", "FRUIT SALAD", "NEW Egg sandwich"],
  "4:monday": ["BUFFALO CHICKEN WRAP", "CAJUN SHRIMP PASTA", "CHICKEN VEGETABLES", "COOKIES", "DAWOUD BASHA", "FATTOUSH", "MEXICAN OMELETE", "MUSHROOM SOUP", "SWEET POTATO DELIGHT"],
  "4:tuesday": ["BEEF SHAWERMA SANDWICH", "Chia  Seeds  Pudding", "ENERGY BALLS", "FOUL", "IRANIAN KOFTA", "LEMON CHICKEN", "NEW EGG SHAKSHOUKA", "SALMON CURRY", "lentil soup"],
  "4:wednesday": ["BEEF PASTRAMI SANDWICH", "BEEF VINDALO & RICE", "CHICKEN MAJBOUS", "CHICKEN RIZOTTO", "CHOCOLATE PEANUTBUTTER", "CORN SOUP", "EGG AVOCADO TOAST", "MATCHA SMOOTHIE SHAKE", "PASSION FRUIT QUINOA SALAD"],
  "4:thursday": ["BEEF BURGER", "BEEF NOODLES", "Chicken Avocado Sandwich", "FALAFEL WRAP", "LEBANESE TRADITIONAL MUFFIN", "MEDITERRANEEN FETA SALAD", "RICE PUDDING", "SWEET CHILI CHICKEN", "VEGETABLES SOUP"],
};

/** المقابل العربي — للمراجعة البشرية فقط؛ المطابقة تتم بالإنجليزي. */
export const OFFICIAL_AR: Record<string, string[]> = {
  "1:saturday": ["انيرجي بوستر مع البطاطا الحلو", "بيض مع الزعتر", "ترياكي الدجاج", "راب كفته لحم", "سلطة الشمندر", "سلمون مع عسل", "شوربة دجاج", "ﺩﺟﺎﺝ ﺑﺎﻟﺯﺑﺩﺓ ﻭﺍﻟﺛﻭﻡ", "ﺳﺎﻧﺩﻭﻳﺗﺵ ﺣﻠﻭﻣﻲ"],
  "1:sunday": ["الحمص", "اومليت مع ﺍﻟﺧﺿﺎﺭ", "براونيز", "زبادي بالقرفة والتفاح", "سباغتي بلونيز", "سلطة السيزر", "ﺗﺎﻛﻭ ﺍﻟﺟﻣﺑﺭﻱ", "ﻛﺎﺭﻱ ﺍﻟﺩﺟﺎﺝ", "ﻛﺭﺍﺕ ﺍﻟﻠﺣﻡ ﻣﻊ ﺍﻷﺭﺯ"],
  "1:monday": ["الفريدو لحم", "ام علي", "بانكيك", "سلطة الفستق", "شاورما دجاج", "شوربة عدس", "مجبوس دجاج", "ﺑﺎﺭﻣﻳﺯﺍﻥ ﺑﺎﻟﺩﺟﺎﺝ", "ﻛﺭﻭﺍﺳﻭﻥ ﺍﻟﺑﻳﺽ"],
  "1:tuesday": ["استراغنوف ﺍﻟﻠﺣﻡ", "بيض عيون مع توست", "سلطة الكراب", "شرايح ﺍﻟﺩﺟﺎﺝ ﺍﻟﻣﻘﺭﻣﺷﺔ", "شوربة خضار", "لازانيا لحم", "لافا كيك", "ﺑﻭﺭﻳﺗﻭ ﺍﻟﺑﻳﺽ", "ﺭﺍﺏ ﺍﻟﺩﺟﺎﺝ ﺍﻟﺟﻧﻭﺑﻲ ﺍﻟﻐﺭﺑﻲ"],
  "1:wednesday": ["جريك انفيوجن", "ديناميت الربيان", "سندويش فاهيتا  ﺍﻟﺩﺟﺎﺝ", "شيش طاووق مع الارز", "كرات تمر", "كرواسون جبن", "كفتة لحم ديلايت", "ﺑﻳﺗﺯﺍ ﺍﻭﻣﻠﻳﺕ", "ﺳﻠﻁﺔ والدورف"],
  "1:thursday": ["تيراميسو", "دجاج يوناني", "سلطة البحر المتوسط و الفيتا", "سلمون مع البيستو والباستا", "شاورما لحم مع رز بالشمندر", "شوفان مع التوت", "ﺩﺟﺎﺝ ﺑﺎﻟﺛﻭﻡ ﺍﻟﻛﺭﻳﻣﻲ", "ﺭﺍﺏ ﺍﻟتركي ﻭﺍﻟﺟﺑﻥ", "ﺳﻠﻁﺔ ﻓﻭﺍﻛﻪ"],
  "2:saturday": ["بانكيك الشوكولا", "تاكو الدجاج", "تلبينة", "سلمون بدون كارب", "شوربة البروكلي", "ﺇﻓﻁﺎﺭ ﺷﺭﻗﻲ", "ﺩﺟﺎﺝ ﺇﻳﺭﺍﻧﻲ", "ﺳﺎﻧﺩﻭﻳﺗﺵ ﺳﺗﻳﻙ", "ﺳﻠﻁﺔ ﺳﻳﺯﺭ"],
  "2:sunday": ["دجاج مع الاعشاب", "ستيك ﺑﺎﻟﺯﺑﺩﺓ ﻭﺍﻟﺛﻭﻡ مع البطاطا", "سلطة الشمندر", "سندويش البيض", "كرواسون زعتر", "كوردن بلو", "ﺯﺑﺎﺩﻱ ﺑﺎﻟﻘﺭﻓﺔ ﻭﺍﻟﺗﻔﺎﺡ", "ﺳﻠﻁﺔ ﻓﻭﺍﻛﻪ", "ﺳﻣﻙ ﺻﻳﺎﺩﻳﺔ"],
  "2:monday": ["اومليت ميكسيكي", "داوود باشا", "دجاج بافلو راب", "دجاج مع الخضروات", "ديلايت البطاطا الحلوه", "شوربة الفطر", "فتوش", "كوكيز", "ﺩﺟﺎﺝ ﻛﺎﺟﻭﻥ ﻣﻌﻛﺭﻭﻧﺔ"],
  "2:tuesday": ["دجاج مع الليمون", "سندويش شاورما لحم", "شكشوكة", "شوربة عدس", "فول", "كاري الربيان", "كرات الطاقة", "كفتة ايرانية", "ﺑﻭﺩﻳﻧﺞ ﺑﺫﻭﺭ ﺍﻟﺷﻳﺎ"],
  "2:wednesday": ["توست البيض مع الافوكادو", "سلطة الكينوا مع الباشن فروت", "سموذي  الماﺗﺷﺎ", "سندويش لحم البسطرمه", "شوربة ذرة", "شوفان مع زبدة الفول السوداني", "لحم البقر فيندالو مع ارز", "مجبوس الدجاج", "ﺳﻣﻙ ﺍﻟﺳﻠﻣﻭﻥ ﺍﻟﺟﺎﻣﺎﻳﻛﻲ"],
  "2:thursday": ["برغر لحم بقري", "بودينج مع الارز", "سلطة البحر المتوسط و الفيتا", "سندويش دجاج مع افوكادو", "شوربة الخضار", "فلافل راب", "مافن لبناني", "نودلز اللحم", "ﺩﺟﺎﺝ ﺑﺎﻟﻔﻠﻔﻝ ﺍﻟﺣﻠﻭ"],
  "3:saturday": ["بانكيك", "ربيان مع الليمون", "سلطة والدورف", "شوربة البروكلي", "كفته لحم مع عيش بالزعفران", "لافا كيك", "مافن البيض", "ﺑﺎﺳﺗﺎ ﺍﻟﺩﺟﺎﺝ ﺑﺎﻟﻛﺭﻳﻣﺔ", "ﺷﺭﺍﺋﺢ ﻣﻘﺭﻣﺷﺔ"],
  "3:sunday": ["شوربة فطر", "مافن", "مافن الحلوم", "مسخن الدجاج", "ﺑﺭﻳﺎﻧﻲ ﺩﺟﺎﺝ", "ﺳﻠﻁﺔ ﺍالفستق", "ﺳﻣﻙ ﺍﻟﺳﻠﻣﻭﻥ مع الصلصة", "ﻓﻠﻔﻝ ﻣﺣﺷﻲ", "ﻛﺭﻭﺍﺳﻭﻥ تركي"],
  "3:monday": ["اومليت بيتزا", "ربيان ﻛﺎﺟﻭﻥ ﻣﻌﻛﺭﻭﻧﺔ", "سلطة الكينوا مع الباشن فروت", "شوربة العدس", "فتة الدجاج", "كرواسون مع البيض", "ليزي كيك", "ﺳﺎﻧﺩﻭﻳﺗﺵ ﻟﺣﻡ ﺑﻘﺭﻱ ﻣﺷﻭﻱ", "ﻟﻔﺎﺋﻑ ﺍﻟﻠﺣﻡ ﺑﺎﻟﺑﻁﺎﻁﺎ ﺍﻟﺣﻠﻭﺓ"],
  "3:tuesday": ["بانكيك ﺍﻟﺷﻭﻛﻭﻻﺗﺔ", "بيض عيون مع توست", "تيراميسو", "دجاج بيري بيري و الارز", "سباغتي مع كرات اللحم", "سلطة الكراب", "شوربة ذرة", "ﺭﺍﺏ ﺷﻳﺵ ﻁﺎﻭﻭﻕ", "ﺳﺎﻧﺩﻭﺗﺵ ﺗﺭﻛﻲ"],
  "3:wednesday": ["استراغنوف الدجاج", "جريك انفيوجن", "ستيك مع البطاطا المهروسه", "سلطة السيزر", "شوربة الخضار", "مافن التركي", "مجبوس الربيان", "ﺑﻳﺽ ﺷﻛﺷﻭﻛﺔ", "ﺳﺎﻧﺩﻭﺗﺵ ﻓﺎﻫﻳﺗﺎ ﻟﺣﻡ"],
  "3:thursday": ["الفريدو دجاج", "بودينج مع الارز و التوت", "دجاج طاجن", "سلطة البحر المتوسط و الفيتا", "شوكولاته مع زبدة الفول السوداني", "نودلز المانجوليان", "ﺑﺭﺟﺭ الدﺟﺎﺝ المشوي", "ﺳﻠﻁﺔ ﻓﻭﺍﻛﻪ", "ﻛﺎﺳﺎﺩﻳﺎ ﺍﻟﺑﻳﺽ"],
  "4:saturday": ["بانكيك الشوكولا", "تاكو الدجاج", "تلبينة", "سلمون بدون كارب", "شوربة البروكلي", "ﺇﻓﻁﺎﺭ ﺷﺭﻗﻲ", "ﺩﺟﺎﺝ ﺇﻳﺭﺍﻧﻲ", "ﺳﺎﻧﺩﻭﻳﺗﺵ ﺳﺗﻳﻙ", "ﺳﻠﻁﺔ ﺳﻳﺯﺭ"],
  "4:sunday": ["باستا الدجاج والكوسة", "دجاج مع الاعشاب", "سلطة الشمندر", "سندويش البيض", "كرواسون زعتر", "كوردن بلو", "ﺯﺑﺎﺩﻱ ﺑﺎﻟﻘﺭﻓﺔ ﻭﺍﻟﺗﻔﺎﺡ", "ﺳﻠﻁﺔ ﻓﻭﺍﻛﻪ", "ﺳﻣﻙ ﺻﻳﺎﺩﻳﺔ"],
  "4:monday": ["اومليت ميكسيكي", "داوود باشا", "دجاج بافلو راب", "دجاج مع الخضروات", "ديلايت البطاطا الحلوه", "شوربة الفطر", "فتوش", "كوكيز", "ﺩﺟﺎﺝ ﻛﺎﺟﻭﻥ ﻣﻌﻛﺭﻭﻧﺔ"],
  "4:tuesday": ["دجاج مع الليمون", "سندويش شاورما لحم", "شكشوكة", "شوربة عدس", "فول", "كاري السلمون", "كرات الطاقة", "كفتة ايرانية", "ﺑﻭﺩﻳﻧﺞ ﺑﺫﻭﺭ ﺍﻟﺷﻳﺎ"],
  "4:wednesday": ["توست البيض مع الافوكادو", "ريزوتو الدجاج", "سلطة الكينوا مع الباشن فروت", "سموذي  الماﺗﺷﺎ", "سندويش لحم البسطرمه", "شوربة ذرة", "شوفان مع زبدة الفول السوداني", "لحم البقر فيندالو مع ارز", "مجبوس الدجاج"],
  "4:thursday": ["برغر لحم بقري", "بودينج مع الارز", "سلطة البحر المتوسط و الفيتا", "سندويش دجاج مع افوكادو", "شوربة الخضار", "فلافل راب", "مافن لبناني", "نودلز اللحم", "ﺩﺟﺎﺝ ﺑﺎﻟﻔﻠﻔﻝ ﺍﻟﺣﻠﻭ"],
};

/**
 * خانة كل وجبة في الإكسل: "أسبوع:يوم" → { اسم الوجبة: التصنيف }.
 *
 * ⚠️ أُضيف بعد اكتشاف أن OFFICIAL يحفظ الأسماء **بلا خانتها**، فمرّ صنفان
 *    بتصنيف مخالف للإكسل بصمت: FALAFEL WRAP (فطور في الإكسل، غداء في القاعدة)
 *    وSPAGHETTI BOLOGNESE (عشاء في الإكسل، غداء في القاعدة). المرجع الناقص
 *    لا يكشف الخطأ.
 *
 * سناك1 وسناك2 في الإكسل كلاهما "snack" في القاعدة — تصنيف واحد لا اثنان.
 */
export const OFFICIAL_SLOTS: Record<string, Record<string, string>> = {
  "1:saturday": { "BEEF KOFTA WRAP": "dinner", "BEETROOT SALAD": "snack", "CHICKEN SOUP": "snack", "CHICKEN TERYAKI BOWL": "lunch", "EGG WITH ZAATER": "breakfast", "GARLIC BUTTER CHICKEN": "lunch", "HALLOUMI SANDWICH": "breakfast", "HONEY GLAZE SALMON": "dinner", "SWEET POTATO ENERGY BOOSTER": "snack" },
  "1:sunday": { "BEEF BALLS WITH RICE": "lunch", "BROWNIES": "snack", "CEASAR SALAD": "snack", "CHICKEN CURRY": "lunch", "CINNAMON APPLE YOGURT": "snack", "HUUMUS": "breakfast", "MIX VEGE OMELETE": "breakfast", "SHRIMP TACOS": "dinner", "SPAGHETTI BOLOGNESE": "dinner" },
  "1:monday": { "BEEF ALFREDO": "lunch", "CHICKEN PARMESAN": "dinner", "CHICKEN SHAWARMA": "dinner", "EGG CROISANT": "breakfast", "HEALTHY CHICKEN MAJBOUS": "lunch", "LENTIL SOUP": "snack", "NORMAL Pancake": "breakfast", "PISTACHIO SALAD": "snack", "UMM ALI": "snack" },
  "1:tuesday": { "BAHAMAS LAVA CAKE": "snack", "BEEF LASAGNA": "dinner", "BEEF STROGANOF": "lunch", "CRAB SALAD": "snack", "CRISPY CHICKEN CUTLETS": "lunch", "EGG BURRITO": "breakfast", "SOUTHWEST CHICKEN WRAP": "dinner", "SUNNY SIDE EGG W/ BROWN BREAD": "breakfast", "VEGETABLES SOUP": "snack" },
  "1:wednesday": { "BEEF KOFTA DELIGHT": "dinner", "CHICKEN FAJITA SANDWICH": "dinner", "CROISANT CHEESE": "breakfast", "DATE BALLS": "snack", "DYNAMITE SHRIMP": "lunch", "GREEK INFUSION": "snack", "OMELETE PIZZA": "breakfast", "SHISHTAWOOK & RICE": "lunch", "WALDORAF SALAD": "snack" },
  "1:thursday": { "BEEF SHAWERMA W/ BEETROOT RICE": "dinner", "BERRY OATMEAL BOWL": "breakfast", "CREAMY GARLIC CHICKEN": "lunch", "FRUIT SALAD": "snack", "MEDITERRANEAN FETA SALAD": "snack", "NEW GREEK CHICKEN": "lunch", "SALMON PESTO PASTA": "dinner", "TIRAMISU": "snack", "TURKEY CHEESE WRAP": "breakfast" },
  "2:saturday": { "BROCOLI SOUP": "snack", "CEASAR SALAD": "snack", "CHICKEN TACOS": "lunch", "CHOCOLATE Pancakes": "breakfast", "IRANIAN CHICKEN": "lunch", "ORIENTAL BREAKFAST": "breakfast", "SALMON NO CARB": "dinner", "STEAK SANDWICH": "dinner", "TALBINA": "snack" },
  "2:sunday": { "BEETROOT SALAD": "snack", "CHICKEN HERBS": "dinner", "CINNAMON APPLE YOGURT": "snack", "CORDON BLUE": "lunch", "CROISANT ZAATER": "breakfast", "FISH SYADIAH": "lunch", "FRUIT SALAD": "snack", "GARLIC BUTTER STEAK & POTATOES": "dinner", "NEW Egg sandwich": "breakfast" },
  "2:monday": { "BUFFALO CHICKEN WRAP": "dinner", "CAJUN CHICKEN PASTA": "lunch", "CHICKEN VEGETABLES": "lunch", "COOKIES": "snack", "DAWOUD BASHA": "dinner", "FATTOUSH": "snack", "MEXICAN OMELETE": "breakfast", "MUSHROOM SOUP": "snack", "SWEET POTATO DELIGHT": "breakfast" },
  "2:tuesday": { "BEEF SHAWERMA SANDWICH": "dinner", "Chia  Seeds  Pudding": "snack", "ENERGY BALLS": "snack", "FOUL": "breakfast", "IRANIAN KOFTA": "dinner", "LEMON CHICKEN": "lunch", "NEW EGG SHAKSHOUKA": "breakfast", "SHRIMP CURRY": "lunch", "lentil soup": "snack" },
  "2:wednesday": { "BEEF PASTRAMI SANDWICH": "dinner", "BEEF VINDALO & RICE": "lunch", "CHICKEN MAJBOUS": "dinner", "CHOCOLATE PEANUTBUTTER": "breakfast", "CORN SOUP": "snack", "EGG AVOCADO TOAST": "breakfast", "JAMAICAN JERK SALMON": "lunch", "MATCHA SMOOTHIE SHAKE": "snack", "PASSION FRUIT QUINOA SALAD": "snack" },
  "2:thursday": { "BEEF BURGER": "dinner", "BEEF NOODLES": "lunch", "Chicken Avocado Sandwich": "dinner", "FALAFEL WRAP": "breakfast", "LEBANESE TRADITIONAL MUFFIN": "breakfast", "MEDITERRANEEN FETA SALAD": "snack", "RICE PUDDING": "snack", "SWEET CHILI CHICKEN": "lunch", "VEGETABLES SOUP": "snack" },
  "3:saturday": { "BAHAMAS LAVA CAKE": "snack", "BEEF KOFTA W/ SAFRON RICE": "lunch", "BROCOLI SOUP": "snack", "CRISPY STRIPS": "dinner", "EGG MUFFIN": "breakfast", "LEMON SHRIMP": "dinner", "NORMAL PANCAKES": "breakfast", "PENNE CHICKEN PASTA": "lunch", "WALDORAF SALAD": "snack" },
  "3:sunday": { "CHICKEN BIRYANI": "lunch", "CHICKEN MESAKHAN": "dinner", "CROISANT TURKEY": "breakfast", "HALLOUMI MUFFIN": "breakfast", "MUFFIN": "snack", "MUSHROOM SOUP": "snack", "PISTACHIO SALAD": "snack", "SALMON W/ SALSA": "lunch", "STUFFED PEPPERS": "dinner" },
  "3:monday": { "BEEF ROLLS SWEET POTATOES": "dinner", "CAJUN SHRIMP PASTA": "lunch", "CHICKEN FATTAH": "dinner", "CROISANT EGG RING": "breakfast", "LAZY CAKE": "snack", "LENTIL SOUP": "snack", "NEW Roasted Beef Sandwich": "lunch", "OMELETE PIZZA": "breakfast", "PASSION FRUIT QUINOA SALAD": "snack" },
  "3:tuesday": { "CHOCOLATE PANCAKES": "breakfast", "CORN SOUP": "snack", "CRAB SALAD": "snack", "Peri  Peri Chicken & Rice": "lunch", "SHISHTAWOOK WRAP": "dinner", "SPAGHETTI BEEF BALLS": "lunch", "SUNNY SIDE EGG W/ BROWN BREAD": "breakfast", "TIRAMISU": "snack", "TURKEY SANDWICH": "dinner" },
  "3:wednesday": { "CEASAR SALAD": "snack", "CHICKEN STROGANOF": "lunch", "FAJITA BEEF SANDWICH": "dinner", "GREEK INFUSION": "snack", "NEW EGG SHAKSHOUKA": "breakfast", "SHRIMP MAJBOUS": "lunch", "STEAK W/ MASHED POTATOES": "dinner", "TURKEY ENGLISH MUFFIN": "breakfast", "VEGETABLES SOUP": "snack" },
  "3:thursday": { "CHICKEN ALFREDO": "lunch", "CHICKEN TAJEN": "dinner", "EGG QUESADILLAS": "breakfast", "FRUIT SALAD": "snack", "GRILLED CHICKEN BURGER": "dinner", "MANGOLIAN NOODLES": "lunch", "MEDITERRANEEN FETA SALAD": "snack", "PEANUTBUTTER OATMEAL": "breakfast", "RASPBERRY RICE PUDDING": "snack" },
  "4:saturday": { "BROCOLI SOUP": "snack", "CEASAR SALAD": "snack", "CHICKEN TACOS": "lunch", "CHOCOLATE Pancakes": "breakfast", "IRANIAN CHICKEN": "lunch", "ORIENTAL BREAKFAST": "breakfast", "SALMON NO CARB": "dinner", "STEAK SANDWICH": "dinner", "TALBINA": "snack" },
  "4:sunday": { "BEETROOT SALAD": "snack", "CHICKEN HERBS": "dinner", "CINNAMON APPLE YOGURT": "snack", "CORDON BLUE": "lunch", "CREAMY ZUCCHINI CHICKEN PASTA": "dinner", "CROISANT ZAATER": "breakfast", "FISH SYADIAH": "lunch", "FRUIT SALAD": "snack", "NEW Egg sandwich": "breakfast" },
  "4:monday": { "BUFFALO CHICKEN WRAP": "dinner", "CAJUN SHRIMP PASTA": "lunch", "CHICKEN VEGETABLES": "lunch", "COOKIES": "snack", "DAWOUD BASHA": "dinner", "FATTOUSH": "snack", "MEXICAN OMELETE": "breakfast", "MUSHROOM SOUP": "snack", "SWEET POTATO DELIGHT": "breakfast" },
  "4:tuesday": { "BEEF SHAWERMA SANDWICH": "dinner", "Chia  Seeds  Pudding": "snack", "ENERGY BALLS": "snack", "FOUL": "breakfast", "IRANIAN KOFTA": "dinner", "LEMON CHICKEN": "lunch", "NEW EGG SHAKSHOUKA": "breakfast", "SALMON CURRY": "lunch", "lentil soup": "snack" },
  "4:wednesday": { "BEEF PASTRAMI SANDWICH": "dinner", "BEEF VINDALO & RICE": "lunch", "CHICKEN MAJBOUS": "dinner", "CHICKEN RIZOTTO": "lunch", "CHOCOLATE PEANUTBUTTER": "breakfast", "CORN SOUP": "snack", "EGG AVOCADO TOAST": "breakfast", "MATCHA SMOOTHIE SHAKE": "snack", "PASSION FRUIT QUINOA SALAD": "snack" },
  "4:thursday": { "BEEF BURGER": "dinner", "BEEF NOODLES": "lunch", "Chicken Avocado Sandwich": "dinner", "FALAFEL WRAP": "breakfast", "LEBANESE TRADITIONAL MUFFIN": "breakfast", "MEDITERRANEEN FETA SALAD": "snack", "RICE PUDDING": "snack", "SWEET CHILI CHICKEN": "lunch", "VEGETABLES SOUP": "snack" },
};
