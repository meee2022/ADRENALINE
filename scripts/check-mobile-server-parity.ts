import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {selectionReady,selectionState}=require('../apps/mobile/src/subscriberSelection.ts');
const {validateCustomerOrderSelection}=require('../convex/lib/customerOrderRules.ts');
const today='2026-09-11';
let checked=0;
for(const mains of [undefined,0,1,2,1.9,-1,NaN])for(const snacks of [undefined,0,1,2]){
  const customer={_id:'fixture',isActive:true,startDate:'2026-09-12',endDate:'2026-09-13',mealsPerDay:mains,snacksPerDay:snacks};
  for(const variant of ['valid','missing','extra','wrongWeek','wrongDay','inactive','gym','online','category','unscheduled','paused','expired','futureInactive']){
    const c={...customer};
    if(variant==='paused')Object.assign(c,{pausedFrom:'2026-09-12'});
    if(variant==='expired')c.endDate='2026-09-10';
    if(variant==='futureInactive')c.isActive=false;
    const picks:any[]=[];
    for(const day of ['saturday','sunday'])for(const [category,count] of [['lunch',mains],['salad',snacks]] as const){
      for(let i=0;i<(Number.isFinite(count)&&Number(count)>0?Math.floor(Number(count)):0);i++)picks.push({week:2,day,meal:{_id:`${category}${i}`,nameAr:'fixture',category,isActive:true,schedule:[{week:2,day}]}});
    }
    if(variant==='missing')picks.pop();
    if(picks[0]){
      if(variant==='extra')picks.push({...picks[0]});
      if(variant==='wrongWeek')picks[0].week=3;
      if(variant==='wrongDay')picks[0].day='friday';
      if(variant==='inactive')picks[0].meal.isActive=false;
      if(variant==='gym')picks[0].meal.isGymOnly=true;
      if(variant==='online')picks[0].meal.isOnlineOnly=true;
      if(variant==='category')picks[0].meal.category='unknown';
      if(variant==='unscheduled')picks[0].meal.schedule=[];
    }
    let accepted=picks.length>0&&picks.length<=500;
    try{validateCustomerOrderSelection({customer:c,startRotationWeek:2,todayISO:today,items:picks.map(p=>({...p,mealId:p.meal._id}))});}catch{accepted=false;}
    assert.equal(selectionReady(c,2,picks,today),accepted,`${mains}/${snacks}/${variant}`);checked++;
  }
}
assert.equal(selectionState({_id:'fixture',startDate:'2026-09-12',endDate:'2026-09-13'},NaN,[],today).slots.length,0);
console.log(`${checked} mobile/server acceptance comparisons + invalid rotation check passed; no backend writes.`);
