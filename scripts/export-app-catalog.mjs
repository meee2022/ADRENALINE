import fs from 'node:fs';
import { buildCatalog } from '../shared/restaurantCatalogBuild.mjs';
const rows=JSON.parse(fs.readFileSync('output/restaurant-menu/source.json','utf8'));
const ingredients=JSON.parse(fs.readFileSync('shared/menuIngredients.json','utf8'));
// أداة فحص فقط: الموقع والتطبيق يقرآن المنيو حياً من convex/restaurantCatalog.ts بنفس القواعد
// (shared/restaurantCatalogBuild.mjs). هذه اللقطة تُكتب في output/ للمراجعة ولا تدخل في البناء.
const meals=buildCatalog(rows,{imageFor:()=>null,ingredientsFor:(g,r)=>[r,...g].map(x=>x.ingredients).find(l=>Array.isArray(l)&&l.length)||ingredients[r._id]||[]});
fs.writeFileSync('output/restaurant-menu/catalog.json',JSON.stringify(meals,null,2));
console.log(`${meals.length} public catalog dishes`);
