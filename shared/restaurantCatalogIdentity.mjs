// Display-only identity rules. Never change operational meal IDs or recipes.
export const normalizeName = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, '');
const aliases = {
 'Beef Kofta w/Saffron Rice':'Beef Kofta with Saffron Rice',
 'Beef Kofta Saffron Rice':'Beef Kofta with Saffron Rice',
 'Beef Kofta with Safran Rice':'Beef Kofta with Saffron Rice',
 'Beef Shawarma Beetroot Rice':'Beef Shawarma with Beetroot Rice',
 'Beef Shawarma':'Beef Shawarma Sandwich',
 'CHICKEN AVACADO SANDWICH':'Chicken Avocado Sandwich',
 'CLASSIC FRENCH TOAST':'French Toast',
 'CROISANT EGG SANDWICH':'Egg Croissant',
 'CROISANT ZAATAR SANDWICH':'Croissant Zaatar',
 'EGG AVACADO TOAST':'Egg Avocado Toast',
 'TURKEY CHEESE WRAP':'Turkey and Cheese Wrap',
 'CHICKEN SHAWARMA SANDWICH':'Chicken Shawarma',
 'Mediterraneen Feta Salad':'Mediterranean Feta Salad',
 'Mongolian Noodles':'Mongolian Beef Noodles',
 'MATCHA CHEESE CAKE':'Matcha Cheesecake',
 'Matcha Glow Juice':'Matcha Smoothie Shake',
 'Ummali':'Umm Ali',
 // نفس المنتج مسجل بأسماء القنوات المختلفة. نبقي كل سجل تشغيلياً
 // (الاشتراك/الأونلاين/المنفذ) ونجمعها تحت هوية واحدة في الكتالوج.
 'Talbina Majdoul':'Talbina',
 'Detox Shot':'Detox',
 'Water Alkaline 500ml':'Water Alkaline Small',
 'Shakshouka':'New Egg Shakshouka',
 'Energy Balls 3pcs':'Energy Balls',
 'Fajita Beef Sandwich':'Beef Fajita Sandwich',
 'Healthy Chicken Majboos':'Healthy Chicken Majbous',
 'Chicken Alfredo Pasta':'Chicken Alfredo',
 'Oxygen Chips Chipotle Chilli':'Oxygen Chips Chipotle Chili',
 'Oxygen Chips Sweet Chilli Pepper':'Oxygen Chips Sweet Chili Pepper',
 'Oxygen Chips Sweet Honey BBQ':'Oxygen Chips Hot Honey BBQ',
 'PROTIEN BROWNIES':'Protein Brownies',
};
const lookup=new Map(Object.entries(aliases).map(([a,b])=>[normalizeName(a),b]));
export function canonicalName(row){const name=row.nameEn||row.nameAr||row.en||row.ar;return lookup.get(normalizeName(name))||name;}
export function groupCatalogRows(rows){
 const groups=new Map();
 for(const r of rows){const key=normalizeName(canonicalName(r))||String(r._id||r.id);const group=groups.get(key)||[];group.push(r);groups.set(key,group);}
 return [...groups.values()];
}
const translations = {
 'Adrenaline Beef Burger':'برجر لحم أدرينالين','Adrenaline Snickers':'سنيكرز أدرينالين',
 'Basbousa Coconut':'بسبوسة جوز الهند','Basbousa Pistachio':'بسبوسة الفستق',
 'Beef Shawarma':'ساندويتش شاورما لحم','Beef Shawarma Sandwich':'ساندويتش شاورما لحم','Beetroot Shot':'شوت الشمندر','Classic Fattoush Salad':'سلطة فتوش كلاسيكية',
 'Crispy Chicken Burger':'برجر الدجاج المقرمش','Detox Shot':'شوت ديتوكس','Energy Balls 3pcs':'كرات الطاقة - 3 قطع',
 'French Toast':'فرنش توست','Fresh Mandarin with Pomegranate':'يوسفي طازج مع الرمان',
 'Fresh Orange Juice':'عصير برتقال طازج','Fresh Pineapple Cut':'قطع أناناس طازجة',
 'Gathering Box Burgers':'بوكس برجر للمشاركة','Gathering Box Sandwiches':'بوكس ساندويتشات للمشاركة',
 'Gathering Box Sub Sandwiches':'بوكس ساندويتشات صب للمشاركة','Gathering Box Tacos':'بوكس تاكو للمشاركة',
 'Halloumi Pesto Sandwich':'ساندويتش حلوم بالبيستو','Hazelnut Lava Cake':'لافا كيك بالبندق',
 'Heaven Ball':'هيفن بول','Kunafa Pistachio Balls':'كرات الكنافة بالفستق','Matcha Cheesecake':'تشيز كيك الماتشا',
 'Matcha Glow Juice':'سموثي ماتشا شيك','Matcha Smoothie Shake':'سموثي ماتشا شيك','Mix Pomegranate&pineapple':'مزيج الرمان والأناناس',
 'Mix Strawberry & Blueberry':'مزيج الفراولة والتوت الأزرق','Oxygen Chips Chipotle Chili':'شيبس أوكسجين بفلفل الشيبوتلي',
 'Oxygen Chips Salted Vinegar':'شيبس أوكسجين بالملح والخل','Oxygen Chips Sweet Chilli Pepper':'شيبس أوكسجين بالفلفل الحلو الحار',
 'Oxygen Chips Sweet Chili Pepper':'شيبس أوكسجين بالفلفل الحلو الحار','Oxygen Chips Hot Honey BBQ':'شيبس أوكسجين بالعسل الحار والباربكيو','Pecan Caramel Cheesecake':'تشيز كيك البيكان والكراميل',
 'Pecan with Chocolate':'بيكان بالشوكولاتة','Pepperoni Pizza':'بيتزا بيبروني','Pistachio Lava Cake':'لافا كيك بالفستق',
 'Pizza Slice Pepperoni':'شريحة بيتزا بيبروني','Pizza Slice Veggie':'شريحة بيتزا خضار','Pomegranate':'رمان',
 'Power Ball':'باور بول','Protein Lava Cake':'بروتين لافا كيك','Protein Lazy Cake':'ليزي كيك بالبروتين',
 'Shakshouka':'شكشوكة','Shishtawook Sandwich':'ساندويتش شيش طاووق','Talbina Majdoul':'تلبينة المجهول',
 'Tarte':'تارت','Tuna Sandwich':'ساندويتش تونة','Vanilla Muffin':'مافن الفانيليا','Vegan Avocado Toast':'توست أفوكادو نباتي',
 'Veggie Pizza':'بيتزا خضار','Vitargo Drink-mango Flavour':'مشروب فيتارجو بنكهة المانجو',
 'Vitargo Drink-orange Flavour':'مشروب فيتارجو بنكهة البرتقال','Vitargo Drink-raspberry Flavour':'مشروب فيتارجو بنكهة توت العليق',
 'Water Alkaline 500ml':'مياه قلوية 500 مل','Water alkaline small':'مياه قلوية صغيرة','Zaatar Omlette':'أومليت بالزعتر',
 'Zuchini Pasta':'باستا الكوسا','American Breakfast':'فطور أمريكي','Avocado Chicken Wrap':'راب الدجاج والأفوكادو',
 'Avocado Turkey Sandwich':'ساندويتش ديك رومي وأفوكادو','Beef Fajita Wrap':'راب فاهيتا اللحم',
 'Blueberry Muffin':'مافن التوت الأزرق','Chicken Breast w/Rice':'صدر دجاج مع الأرز','Chocolate Muffin':'مافن الشوكولاتة',
 'Crispy Chicken':'دجاج مقرمش','Crispy Chicken w/ Honey Mustard':'دجاج مقرمش بصوص العسل والخردل',
 'Crispy Chicken Wrap':'راب الدجاج المقرمش','Detox':'ديتوكس','Dynamite Shrimp w/Rice':'ديناميت روبيان مع الأرز',
 'Golden':'جولدن','Grilled Chicken Wrap':'راب الدجاج المشوي','Immune Shot':'شوت إميون','Mongolian Beef':'لحم منغولي',
 'Protein Brownies':'براونيز بالبروتين','Teriyaki Tofu w/Rice':'توفو ترياكي مع الأرز','Tropical Shot':'شوت تروبيكال',
 'Turkey and Cheese Sandwich':'ساندويتش ديك رومي وجبن',
 'Chicken Avocado Wrap':'راب الدجاج بالأفوكادو','Lava Cake':'لافا كيك',
};
const arabic=new Map(Object.entries(translations).map(([a,b])=>[normalizeName(a),b]));
// \u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0645\u0639\u0631\u0648\u0636 \u064a\u0623\u062a\u064a \u0645\u0646 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a (Convex) \u0644\u0627 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0641: \u0645\u0627 \u064a\u0633\u0645\u0651\u064a\u0647 \u0627\u0644\u0637\u0627\u0642\u0645 \u0641\u064a \u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645
// \u0647\u0648 \u0645\u0627 \u064a\u0638\u0647\u0631 \u0641\u064a \u0627\u0644\u0645\u0648\u0642\u0639 \u0648\u0627\u0644\u062a\u0637\u0628\u064a\u0642. \u062c\u062f\u0648\u0644\u0627 aliases \u0648translations \u064a\u0628\u0642\u064a\u0627\u0646 **\u0644\u0644\u062a\u062c\u0645\u064a\u0639 \u0641\u0642\u0637** \u0648\u0644\u0633\u062f\u0651 \u0627\u0644\u0646\u0642\u0635
// \u062d\u064a\u0646 \u064a\u0643\u0648\u0646 \u0627\u0644\u062d\u0642\u0644 \u0627\u0644\u0639\u0631\u0628\u064a \u0645\u0643\u062a\u0648\u0628\u0627\u064b \u0628\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629 \u0623\u0648 \u0641\u0627\u0631\u063a\u0627\u064b.
export function catalogNames(group){
 const preferred=group.find(r=>!r.isGymOnly&&!r.isOnlineOnly)||group[0];
 const isArabic=(n)=>/[\u0600-\u06ff]/.test(n||'');
 const tidy=(s)=>String(s||'').replace(/\b[A-Z][A-Z]+\b/g,(w)=>w[0]+w.slice(1).toLowerCase());
 const en=tidy(preferred.nameEn||group.map(r=>r.nameEn).find(Boolean)||canonicalName(preferred));
 const ar=(isArabic(preferred.nameAr)&&preferred.nameAr)
   ||group.map(r=>r.nameAr).find(isArabic)
   ||arabic.get(normalizeName(canonicalName(preferred)))
   ||'';
 return {ar,en};
}
