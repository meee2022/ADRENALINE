import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {groupCatalogRows,catalogNames} from '../shared/restaurantCatalogIdentity.mjs';
const raw=JSON.parse(execFileSync(process.execPath,['node_modules/convex/bin/main.js','data','publicMeals','--deployment-name','laudable-mongoose-958','--limit','2000','--format','json'],{encoding:'utf8',maxBuffer:20000000}));
const catalog=JSON.parse(fs.readFileSync('output/restaurant-menu/catalog.json','utf8'));
const ids=new Set(catalog.flatMap(m=>m.sourceIds));
const rows=raw.filter(r=>ids.has(r._id));
const updates=groupCatalogRows(rows).flatMap(group=>{const n=catalogNames(group);return group.filter(r=>r.nameAr!==n.ar||r.nameEn!==n.en).map(r=>({id:r._id,beforeAr:r.nameAr,...(r.nameEn===undefined?{}:{beforeEn:r.nameEn}),nameAr:n.ar,nameEn:n.en}));});
fs.mkdirSync('output/restaurant-menu/rename',{recursive:true});
fs.writeFileSync('output/restaurant-menu/rename/preview.json',JSON.stringify({dryRun:true,updates},null,2));
// Whole original rows retained locally for invariant checking; do not ship this file.
fs.writeFileSync('output/restaurant-menu/rename/before-private.json',JSON.stringify(raw));
console.log(JSON.stringify({catalog:catalog.length,targetRows:rows.length,renames:updates.length}));
