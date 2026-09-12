import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { dayNavigationAllowed: allowed, selectionState } = createRequire(import.meta.url)('../apps/mobile/src/subscriberSelection.ts') as typeof import('../apps/mobile/src/subscriberSelection');
const customer={_id:'fixture',startDate:'2026-09-12',endDate:'2026-09-13',mealsPerDay:1,snacksPerDay:1};
const main={_id:'main',nameAr:'Fixture',category:'lunch'};
const snack={_id:'snack',nameAr:'Fixture',category:'salad'};
const first={meal:main,week:2,day:'saturday'};
const second={meal:snack,week:2,day:'saturday'};
for(const picks of [[],[first]]){
 const state=selectionState(customer,2,picks,'2026-09-11');
 assert.equal(allowed(0,state.firstIncomplete,state.slots.length),true);
 assert.equal(allowed(1,state.firstIncomplete,state.slots.length),false);
}
const completeDay=selectionState(customer,2,[first,second],'2026-09-11');
assert.equal(allowed(1,completeDay.firstIncomplete,completeDay.slots.length),true);
assert.equal(allowed(0,completeDay.firstIncomplete,completeDay.slots.length),true);
assert.equal(allowed(1,-1,2),true);
assert.equal(allowed(-1,-1,2),false);
assert.equal(allowed(2,-1,2),false);
assert.equal(allowed(0,0,0),false);
assert.equal(allowed(1,0,2),false); // an earlier day becoming incomplete relocks later days
console.log('Day navigation: 11 assertions passed, fixtures only.');
