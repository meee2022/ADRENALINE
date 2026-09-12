// Read-only public menu comparison; never updates meal records or artwork mappings.
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { readFile, readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const source = 'E:/OneDrive - Ministry of Education and Higher Education/الخاص/شغلي/abeer adrenaline/ADRENALINE - محتوى تسويقي/meals-images/new-design-samples/wide';
const out = 'output/mobile-menu/comparison';
const candidates = {
 'Beef Shawarma Sandwich':['Beef Shawarma '],
 'Roasted Beef Sandwich':['Roasted Beef'],
 'Passion Fruit Quinoa Salad':['Passion Fruit Salad'],
 'Lazy Cake':['Protein Lazy Cake'],
 'Sunny Side Egg with Brown Bread':['Egg Sunny Side'],
 'Peanut Butter Oat Meal':['Peanut Butter Bowl'],
 'Caesar Salad':['Chicken Ceasar'],
 'Healthy Chicken Majbous':['Adrenaline Healthy Majboos','Chicken Majbous'],
 'Chicken Fajita Sandwich':['Chicken Fajita Wrap'],
 'Egg Avocado Toast':['Egg Avocado Sandwich'],
 'Chicken Avocado Sandwich':['Chicken Avocado Wrap'],
 'Crispy Strips':['Crispy Chicken Strips','Crispy Chicken  Cutlets'],
 'Lemon Shrimp':[],
 'Beef Rolls Sweet Potatoes':['Beef Rolls with Potatoes'],
 'Grilled Chicken Burger':['Chicken Burger'],
 'Creamy Zucchini Chicken Pasta':['Creamu Zucchini Pasta'],
 'Chicken Teryaki Bowl':['Teriyaki Chicken'],
 'Corn Soup':['Creamy Corn Soup'],
 'Mongolian Noodles':['Mongolia Beef Noodles'],
};
const report = JSON.parse(await readFile('output/mobile-menu/artwork-report.json','utf8'));
const meals = await new ConvexHttpClient('https://laudable-mongoose-958.convex.cloud').query(anyApi.publicMeals.listMeals,{});
const files = await readdir(source);
await mkdir(out,{recursive:true});
const esc = s => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let rows = [];
for (const [i,item] of report.unmatched.entries()) {
 const meal = meals.find(m=>m._id===item._id);
 if (!meal) continue;
 const matches=files.filter(f=>/\.(png|jpe?g)$/i.test(f)&&(candidates[meal.nameEn]??[]).some(p=>f.startsWith(p)));
 let pictures=[];
 if(meal.imageUrl){const r=await fetch(meal.imageUrl);if(r.ok){await writeFile(`${out}/${i}-old.jpg`,Buffer.from(await r.arrayBuffer()));pictures.push(`<figure><figcaption>الصورة الحالية في المنيو</figcaption><img src="${i}-old.jpg"></figure>`);}}
 for(const [j,f] of matches.entries()){const name=`${i}-new-${j}${path.extname(f)}`;await copyFile(path.join(source,f),path.join(out,name));pictures.push(`<figure><figcaption>مرشح ${j+1}: ${esc(f)}</figcaption><img src="${name}"></figure>`);}
 rows.push(`<section><h2>${i+1}. ${esc(meal.nameAr)} <small dir="ltr">${esc(meal.nameEn)}</small></h2><p>${esc(meal.descriptionAr)} ${esc((meal.ingredients??[]).join(' • '))}</p><div>${pictures.join('')}</div><p class="note">${matches.length?'مرشحات للمراجعة وليست مطابقة مؤكدة. اذكر رقم الوجبة ورقم المرشح عند التأكيد.':'لم أجد صورة مرشحة مناسبة في المجلد.'}</p></section>`);
}
await writeFile(`${out}/index.html`,`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>مقارنة صور المنيو</title><style>body{font-family:Tahoma,Arial;background:#edf5f8;color:#18364b;margin:0;padding:24px}main{max-width:1400px;margin:auto}h1{color:#47759c}section{background:white;border-radius:16px;padding:20px;margin:20px 0}section>div{display:flex;gap:18px;flex-wrap:wrap}figure{margin:0;flex:1;min-width:240px}img{width:100%;height:330px;object-fit:contain;background:#fafafa}figcaption{min-height:48px;font-size:14px;overflow-wrap:anywhere}small{display:inline-block;font-size:16px;color:#47759c}p{line-height:1.8}.note{color:#566775}a{color:#47759c}</style><main><h1>مقارنة الصور الحالية بمرشحات wide</h1><p>19 وجبة للمراجعة — لم يتم تغيير الصور أو بيانات الوجبات. الصورة الحالية ثم المرشحات الجديدة لكل وجبة.</p>${rows.join('')}</main></html>`);
console.log(`Created ${rows.length} read-only comparisons: ${path.resolve(out,'index.html')}`);
