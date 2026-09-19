import {describe,it,expect} from 'vitest';
// The same generator module is used for the exported catalogs and name migration.
// @ts-ignore JavaScript build helper
import {groupCatalogRows,catalogNames} from '../shared/restaurantCatalogIdentity.mjs';
// @ts-ignore JavaScript build helper
import {buildCatalog} from '../shared/restaurantCatalogBuild.mjs';
describe('restaurant catalog identity',()=>{
 it('groups spelling aliases but shows the name stored in the database',()=>{
  // الجداول في الكود للتجميع فقط. الاسم المعروض هو ما يكتبه الطاقم في لوحة التحكم (Convex)
  // فلا يختلف الموقع عن التطبيق ولا يُلغى تعديل الطاقم.
  const rows=[{_id:'a',nameEn:'Beef Kofta w/Saffron Rice',nameAr:'old',isGymOnly:true},{_id:'b',nameEn:'Beef Kofta with Safran Rice',nameAr:'كفتة مع أرز الزعفران'}];
  const groups=groupCatalogRows(rows);expect(groups).toHaveLength(1);expect(groups[0].map((r:any)=>r._id)).toEqual(['a','b']);
  expect(catalogNames(groups[0])).toEqual({ar:'كفتة مع أرز الزعفران',en:'Beef Kofta with Safran Rice'});
 });
 it('falls back to the translation table only when the Arabic field holds English',()=>{
  const rows=[{_id:'c',nameEn:'LAVA CAKE',nameAr:'LAVA CAKE',isGymOnly:true}];
  expect(catalogNames(groupCatalogRows(rows)[0])).toEqual({ar:'لافا كيك',en:'Lava Cake'});
 });
 it('uses the subscription identity for equivalent online and outlet products without changing source rows',()=>{
  const rows=[
   {_id:'talbina-sub',nameEn:'Talbina',nameAr:'تلبينة',isActive:true,category:'snack',schedule:[{week:2,day:'saturday'}]},
   {_id:'talbina-online',nameEn:'Talbina Majdoul',nameAr:'TALBINA MAJDOUL',isActive:true,isOnlineOnly:true,category:'snack',priceQAR:30},
   {_id:'detox-outlet',nameEn:'DETOX',nameAr:'DETOX',isActive:true,isGymOnly:true,category:'snack'},
   {_id:'detox-online',nameEn:'Detox Shot',nameAr:'DETOX SHOT',isActive:true,isOnlineOnly:true,category:'snack'},
  ];
  const before=structuredClone(rows);
  const menu=buildCatalog(rows,{imageFor:()=>null,ingredientsFor:()=>[]});
  expect(menu).toHaveLength(2);
  expect(menu.find((m:any)=>m.en==='Talbina')).toMatchObject({
   id:'talbina-sub',sourceIds:['talbina-sub','talbina-online'],channels:['subscription','online'],ar:'تلبينة',
  });
  expect(menu.find((m:any)=>m.en==='Detox')).toMatchObject({
   sourceIds:['detox-outlet','detox-online'],channels:['outlet','online'],
  });
  // التجميع للعرض فقط: لا يعيد تسمية السجلات ولا يغيّر الجدولة أو الأسعار.
  expect(rows).toEqual(before);
 });
 it('shows the subscription and three-piece online energy balls as one product card',()=>{
  const rows=[
   {_id:'energy-sub',nameEn:'Energy Balls',nameAr:'كرات الطاقة',isActive:true,category:'snack',calories:251,schedule:[{week:2,day:'tuesday'}]},
   {_id:'energy-online',nameEn:'Energy Balls 3pcs',nameAr:'ENERGY BALLS 3PCS',isActive:true,isOnlineOnly:true,category:'snack',priceQAR:24},
  ];
  const menu=buildCatalog(rows,{imageFor:()=>null,ingredientsFor:()=>[]});
  expect(menu).toHaveLength(1);
  expect(menu[0]).toMatchObject({
   id:'energy-sub',en:'Energy Balls',ar:'كرات الطاقة',sourceIds:['energy-sub','energy-online'],channels:['subscription','online'],calories:251,
  });
 });
 it('unifies beef shawarma across subscriber, online, and outlet records and keeps completed macros',()=>{
  const rows=[
   {_id:'shawarma-sub',nameEn:'Beef Shawarma Sandwich',nameAr:'ساندويتش شاورما لحم',isActive:true,category:'lunch',calories:374,protein:40,carbs:31,fats:10},
   {_id:'shawarma-online',nameEn:'Beef Shawarma',nameAr:'شاورما لحم',isActive:true,isOnlineOnly:true,category:'lunch',calories:0,protein:0,carbs:0,fats:0},
   {_id:'shawarma-outlet',nameEn:'BEEF SHAWARMA SANDWICH',nameAr:'ساندويتش شاورما لحم',isActive:true,isGymOnly:true,category:'lunch'},
  ];
  const before=structuredClone(rows);
  const menu=buildCatalog(rows,{imageFor:()=>null,ingredientsFor:()=>[]});
  expect(menu).toHaveLength(1);
  expect(menu[0]).toMatchObject({
   id:'shawarma-sub',en:'Beef Shawarma Sandwich',ar:'ساندويتش شاورما لحم',
   sourceIds:['shawarma-sub','shawarma-online','shawarma-outlet'],channels:['subscription','online','outlet'],
   calories:374,protein:40,carbs:31,fats:10,
  });
  expect(rows).toEqual(before);
 });
 it('uses the subscriber matcha identity and nutrition for the equivalent online drink',()=>{
  const rows=[
   {_id:'matcha-sub',nameEn:'Matcha Smoothie Shake',nameAr:'سموثي ماتشا شيك',isActive:true,category:'snack',calories:260,protein:11,carbs:36,fats:8},
   {_id:'matcha-online',nameEn:'Matcha Glow Juice',nameAr:'عصير ماتشا جلو',isActive:true,isOnlineOnly:true,category:'snack',calories:0,protein:0,carbs:0,fats:0},
  ];
  const menu=buildCatalog(rows,{imageFor:()=>null,ingredientsFor:()=>[]});
  expect(menu).toHaveLength(1);
  expect(menu[0]).toMatchObject({
   id:'matcha-sub',en:'Matcha Smoothie Shake',ar:'سموثي ماتشا شيك',
   sourceIds:['matcha-sub','matcha-online'],channels:['subscription','online'],
   calories:260,protein:11,carbs:36,fats:8,
  });
 });
 it('does not merge different meals from a shared photo or Arabic-only empty keys',()=>{
  expect(groupCatalogRows([{nameEn:'Crispy Strips',image:'same'},{nameEn:'Crispy Chicken Cutlets',image:'same'},{nameAr:'وجبة أ'},{nameAr:'وجبة ب'}])).toHaveLength(4);
 });
 it('builds the live menu: one card per dish across channels, display dishes only, live image and macros',()=>{
  const rows=[
   {_id:'sub',nameEn:'Beef Burger',nameAr:'برغر لحم',isActive:true,category:'lunch',calories:0,ingredients:[]},
   {_id:'onl',nameEn:'BEEF BURGER',nameAr:'برغر لحم',isActive:true,isOnlineOnly:true,calories:520,protein:38,ingredients:['لحم','خبز'],img:'https://x/onl.webp'},
   {_id:'gram',nameEn:'Grilled Chicken',nameAr:'دجاج',isActive:true,isGymOnly:true,priceUnit:'gram'},
   {_id:'sauce',nameEn:'Ranch',nameAr:'رانش',isActive:true,isGymOnly:true,outletCategory:'SAUCE'},
   {_id:'off',nameEn:'Old Dish',nameAr:'قديم',isActive:false},
   {_id:'sal',nameEn:'Caesar Salad',nameAr:'سلطة سيزر',isActive:true,calories:300,protein:20,carbs:10,fats:9,img:'https://x/sal.webp'},
  ];
  const menu=buildCatalog(rows,{imageFor:(g:any[],r:any)=>[r,...g].map((x:any)=>x.img).find(Boolean)??null,ingredientsFor:(g:any[],r:any)=>[r,...g].map((x:any)=>x.ingredients).find((l:any)=>l?.length)??[]});
  expect(menu.map((m:any)=>m.id).sort()).toEqual(['sal','sub']);
  const burger=menu.find((m:any)=>m.id==='sub');
  expect(burger).toMatchObject({sourceIds:['sub','onl'],channels:['subscription','online'],category:'sandwiches',image:'https://x/onl.webp',calories:520,protein:38,carbs:null,ingredients:['لحم','خبز']});
  expect(menu.find((m:any)=>m.id==='sal')).toMatchObject({category:'salads',calories:300,fats:9});
  for(const field of ['ar','en'])expect(new Set(menu.map((m:any)=>m[field].toLowerCase())).size).toBe(menu.length);
 });
});
