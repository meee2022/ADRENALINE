import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const raw=execFileSync(process.execPath,['node_modules/convex/bin/main.js','data','publicMeals','--deployment-name','laudable-mongoose-958','--limit','2000','--format','json'],{encoding:'utf8',maxBuffer:12e6});
const rows=JSON.parse(raw);
const keys=['_id','nameAr','nameEn','category','outletCategory','isActive','isGymOnly','isGymItem','isOnlineOnly','priceUnit','imageUrl','calories','protein','carbs','fats','ingredients'];
const safe=rows.map(r=>Object.fromEntries(keys.filter(k=>r[k]!==undefined).map(k=>[k,r[k]])));
fs.mkdirSync('output/restaurant-menu',{recursive:true});
fs.writeFileSync('output/restaurant-menu/source.json',JSON.stringify(safe,null,2));
console.log(JSON.stringify({total:safe.length,active:safe.filter(r=>r.isActive).length,categories:[...new Set(safe.map(r=>r.outletCategory||r.category))],sample:safe.filter(r=>r.isOnlineOnly).slice(0,5)},null,2));
