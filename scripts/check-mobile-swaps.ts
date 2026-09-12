import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { Pick } from '../apps/mobile/src/subscriberSelection';
const {replacePick,swapCandidate}=createRequire(import.meta.url)('../apps/mobile/src/subscriberSelection.ts') as typeof import('../apps/mobile/src/subscriberSelection');
const customer={_id:'test',startDate:'2099-01-03',endDate:'2099-01-04',mealsPerDay:2,snacksPerDay:0};
const meal={_id:'a',nameAr:'وجبة',category:'lunch',schedule:[{week:1,day:'saturday'}]};
const alternate={...meal,_id:'b'};
const picks:Pick[]=[{meal,week:1,day:'saturday'}];
const next=replacePick(customer,1,picks,0,picks[0],alternate);
assert.equal(next.length,1);assert.equal(next[0].meal._id,'b');assert.equal(next[0].day,'saturday');assert.equal(picks[0].meal._id,'a');
for(const invalid of [{...alternate,category:'salad'},{...alternate,isActive:false},{...alternate,isGymOnly:true},{...alternate,isOnlineOnly:true},{...alternate,schedule:[{week:2,day:'saturday'}]},{...alternate,schedule:[{week:1,day:'sunday'}]}]){
  assert.equal(swapCandidate(picks[0],invalid),false);
  assert.equal(replacePick(customer,1,picks,0,picks[0],invalid),picks);
}
assert.equal(replacePick(customer,1,next,0,picks[0],{...alternate,_id:'c'}),next);
const duplicate=[...picks,{meal:alternate,week:1,day:'saturday'}];
assert.equal(replacePick(customer,1,duplicate,0,picks[0],alternate),duplicate);
assert.equal(replacePick(customer,1,duplicate,0,picks[0],alternate,true)[0].meal._id,'b');
assert.equal(replacePick({...customer,pausedFrom:'2099-01-03'},1,picks,0,picks[0],alternate),picks);
console.log('Swap checks passed: atomic replacement, stale target, category/day/week, channel, duplicate confirmation, pause.');
