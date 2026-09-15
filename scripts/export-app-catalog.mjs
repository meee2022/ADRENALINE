import fs from 'node:fs';
import path from 'node:path';
const rows=JSON.parse(fs.readFileSync('output/restaurant-menu/source.json','utf8'));
const artwork=JSON.parse(fs.readFileSync('shared/menuArtwork.json','utf8'));
const catalogArtwork=JSON.parse(fs.readFileSync('shared/restaurantCatalogArtwork.json','utf8'));
const ingredients=JSON.parse(fs.readFileSync('shared/menuIngredients.json','utf8'));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g,'');
const excluded=new Set(['SAUCE','SPRINKLES','SALSA','CARBS','SIDES','PROTEIN']);
const groups=new Map();
for(const r of rows){
 if(!r.isActive||r.priceUnit==='gram'||/\b\d+\s*g\b/i.test(r.nameEn||'')||excluded.has(r.outletCategory)||/sundried tomato|balsamic dressing/i.test(r.nameEn||''))continue;
 const key=norm(r.nameEn||r.nameAr);groups.set(key,[...(groups.get(key)||[]),r]);
}
function category(r){const n=(r.nameEn||r.nameAr).toLowerCase();
 if(/gathering box/.test(n))return 'boxes';
 if(/juice|shot|drink|water|smoothie|matcha|^golden$|^detox$/.test(n))return 'drinks';
 if(/salad|soup|fattoush|feta/.test(n))return 'salads';
 if(/cake|brownie|basbousa|pudding|snicker|kunafa|pecan|talbina|umm|tarte|heaven|power ball|energy ball|dates ball|chips|cookies/.test(n)||r.category==='snack'||r.outletCategory==='SWEETS')return 'snacks';
 if(r.category==='breakfast')return 'breakfast';
 if(/sandwich|wrap|burger|tacos|shawarma/.test(n)&&!/rice/.test(n))return 'sandwiches';
 if(/pasta|spaghetti|noodle|lasagna/.test(n))return 'pasta';
 if(/salmon|shrimp|fish/.test(n))return 'seafood';
 if(/beef|steak|kofta|tenderloin|dawoud/.test(n))return 'beef';
 if(/chicken|cordon|tawook|crispy strips/.test(n))return 'chicken';
 return 'other';
}
fs.mkdirSync('client/public/restaurant-catalog',{recursive:true});
const meals=[...groups.values()].map(group=>{
 const r=group.find(x=>!x.isGymOnly&&!x.isOnlineOnly)||group[0];
 let image=group.map(x=>catalogArtwork[x._id]||artwork[x._id]).find(x=>x&&fs.existsSync('client/public'+x))||null;
 const fallback='output/restaurant-menu/assets/'+r._id+'.webp';
 if(!image&&fs.existsSync(fallback)){fs.copyFileSync(fallback,'client/public/restaurant-catalog/'+r._id+'.webp');image='/restaurant-catalog/'+r._id+'.webp';}
 const value=k=>Number.isFinite(r[k])&&r[k]>0?r[k]:null;
 return {id:r._id,ingredients:ingredients[r._id]||[],ar:/[\u0600-\u06ff]/.test(r.nameAr)?r.nameAr:'',en:r.nameEn||r.nameAr,category:category(r),channels:[...new Set(group.map(x=>x.isOnlineOnly?'online':x.isGymOnly?'outlet':'subscription'))],image,calories:value('calories'),protein:value('protein'),carbs:value('carbs'),fats:value('fats')};
});
meals.sort((a,b)=>Number(Boolean(b.image))-Number(Boolean(a.image))||a.en.localeCompare(b.en));
fs.writeFileSync('client/src/lib/restaurantCatalog.json',JSON.stringify(meals,null,2));
console.log(`${meals.length} public catalog dishes; ${meals.filter(m=>m.image).length} matched photos`);
