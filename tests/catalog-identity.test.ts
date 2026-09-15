import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
// The same generator module is used for the exported catalogs and name migration.
// @ts-ignore JavaScript build helper
import {groupCatalogRows,catalogNames} from '../shared/restaurantCatalogIdentity.mjs';
describe('restaurant catalog identity',()=>{
 it('groups spelling aliases and keeps all IDs',()=>{
  const rows=[{_id:'a',nameEn:'Beef Kofta w/Saffron Rice',nameAr:'old',isGymOnly:true},{_id:'b',nameEn:'Beef Kofta with Safran Rice',nameAr:'كفتة مع أرز الزعفران'}];
  const groups=groupCatalogRows(rows);expect(groups).toHaveLength(1);expect(groups[0].map((r:any)=>r._id)).toEqual(['a','b']);expect(catalogNames(groups[0])).toEqual({ar:'كفتة مع أرز الزعفران',en:'Beef Kofta with Saffron Rice'});
 });
 it('does not merge different meals from a shared photo or Arabic-only empty keys',()=>{
  expect(groupCatalogRows([{nameEn:'Crispy Strips',image:'same'},{nameEn:'Crispy Chicken Cutlets',image:'same'},{nameAr:'وجبة أ'},{nameAr:'وجبة ب'}])).toHaveLength(4);
 });
 it('ships identical bilingual catalogs with unique names and original links',()=>{
  const web=JSON.parse(fs.readFileSync('client/src/lib/restaurantCatalog.json','utf8'));
  const mobile=JSON.parse(fs.readFileSync('apps/mobile/src/restaurantCatalog.json','utf8'));
  expect(web).toEqual(mobile);
  for(const field of ['ar','en']){expect(web.every((m:any)=>m[field].trim())).toBe(true);expect(new Set(web.map((m:any)=>m[field].toLowerCase())).size).toBe(web.length);}
  const ids=web.flatMap((m:any)=>m.sourceIds);expect(new Set(ids).size).toBe(ids.length);
  for(const m of web)if(m.image)expect(fs.existsSync('client/public'+m.image)).toBe(true);
 });
});
