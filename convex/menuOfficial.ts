/**
 * @file convex/menuOfficial.ts
 * @description جدول المنيو الرسمي — مولّد من ملفَي الإكسل، لا يُحرّر يدوياً.
 *
 *   المصدر: ADRENALINE HEALTHY NEW.xlsx (إنجليزي) + ADRENALINE HEALTHY  عربي.xlsx
 *   المولِّد: tmp/parse_excel.py
 *
 *   البنية: "أسبوع:يوم" → أسماء الوجبات (الخياران معاً، بلا تكرار داخل اليوم).
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
