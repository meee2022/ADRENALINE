// Display-only identity rules. Never change operational meal IDs or recipes.
export const normalizeName = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, '');
const aliases = {
 'Beef Kofta w/Saffron Rice':'Beef Kofta with Saffron Rice',
 'Beef Kofta Saffron Rice':'Beef Kofta with Saffron Rice',
 'Beef Kofta with Safran Rice':'Beef Kofta with Saffron Rice',
 'Beef Shawarma Beetroot Rice':'Beef Shawarma with Beetroot Rice',
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
 'Beef Shawarma':'شاورما لحم','Beetroot Shot':'شوت الشمندر','Classic Fattoush Salad':'سلطة فتوش كلاسيكية',
 'Crispy Chicken Burger':'برجر الدجاج المقرمش','Detox Shot':'شوت ديتوكس','Energy Balls 3pcs':'كرات الطاقة - 3 قطع',
 'French Toast':'فرنش توست','Fresh Mandarin with Pomegranate':'يوسفي طازج مع الرمان',
 'Fresh Orange Juice':'عصير برتقال طازج','Fresh Pineapple Cut':'قطع أناناس طازجة',
 'Gathering Box Burgers':'بوكس برجر للمشاركة','Gathering Box Sandwiches':'بوكس ساندويتشات للمشاركة',
 'Gathering Box Sub Sandwiches':'بوكس ساندويتشات صب للمشاركة','Gathering Box Tacos':'بوكس تاكو للمشاركة',
 'Halloumi Pesto Sandwich':'ساندويتش حلوم بالبيستو','Hazelnut Lava Cake':'لافا كيك بالبندق',
 'Heaven Ball':'هيفن بول','Kunafa Pistachio Balls':'كرات الكنافة بالفستق','Matcha Cheesecake':'تشيز كيك الماتشا',
 'Matcha Glow Juice':'عصير ماتشا جلو','Mix Pomegranate&pineapple':'مزيج الرمان والأناناس',
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
export function catalogNames(group){
 const preferred=group.find(r=>!r.isGymOnly&&!r.isOnlineOnly)||group[0];
 const raw=canonicalName(preferred);
 const en=raw.replace(/\b[A-Z][A-Z]+\b/g,s=>s[0]+s.slice(1).toLowerCase());
 const ar=arabic.get(normalizeName(raw))||group.map(r=>r.nameAr).find(n=>/[\u0600-\u06ff]/.test(n||''))||'';
 return {ar,en};
}
