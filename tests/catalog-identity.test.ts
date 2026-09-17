import {describe,it,expect} from 'vitest';
// The same generator module is used for the exported catalogs and name migration.
// @ts-ignore JavaScript build helper
import {groupCatalogRows,catalogNames} from '../shared/restaurantCatalogIdentity.mjs';
// @ts-ignore JavaScript build helper
import {buildCatalog} from '../shared/restaurantCatalogBuild.mjs';
describe('restaurant catalog identity',()=>{
 it('groups spelling aliases and keeps all IDs',()=>{
  const rows=[{_id:'a',nameEn:'Beef Kofta w/Saffron Rice',nameAr:'old',isGymOnly:true},{_id:'b',nameEn:'Beef Kofta with Safran Rice',nameAr:'كفتة مع أرز الزعفران'}];
  const groups=groupCatalogRows(rows);expect(groups).toHaveLength(1);expect(groups[0].map((r:any)=>r._id)).toEqual(['a','b']);expect(catalogNames(groups[0])).toEqual({ar:'كفتة مع أرز الزعفران',en:'Beef Kofta with Saffron Rice'});
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
