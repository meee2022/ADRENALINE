// Read-only public DTO export for local artwork matching. No mutations or credentials.
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { mkdir, writeFile } from 'node:fs/promises';
const client = new ConvexHttpClient('https://laudable-mongoose-958.convex.cloud');
const meals = await client.query(anyApi.publicMeals.listMeals, {});
await mkdir('output/mobile-menu', {recursive:true});
await writeFile('output/mobile-menu/public-meals.json', JSON.stringify(meals.map(({_id,nameAr,nameEn})=>({_id,nameAr,nameEn})),null,2));
console.log(`Read ${meals.length} public meals; no data changed.`);
