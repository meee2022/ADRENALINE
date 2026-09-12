import assert from 'node:assert/strict';
import { orderedSubscriptionSlots, slotToDate } from '../shared/rules/subscription';
import { rotationWeekAtDate, parseDate, fmtDate, addDays, dayNameOf, isDeliveryDay } from '../convex/lib/dates';
const anchor='2026-09-09';
const mismatches:unknown[]=[];
let checked=0;
for(let offset=1;offset<=14;offset++)for(let rotation=1;rotation<=4;rotation++){
 const start=fmtDate(addDays(parseDate(anchor),offset));
 const end=fmtDate(addDays(parseDate(start),20));
 const startRotation=rotationWeekAtDate(rotation,anchor,start);
 let last='';
 for(const slot of orderedSubscriptionSlots(start,end,startRotation,anchor)){
   const date=slotToDate(start,startRotation,slot.week,slot.day,anchor)!;
   assert.ok(date>=start&&date<=end);
   assert.ok(date>last);last=date;
   assert.ok(isDeliveryDay(parseDate(date)));
   assert.equal(dayNameOf(date),slot.day);
   const kitchenWeek=rotationWeekAtDate(rotation,anchor,date);
   if(kitchenWeek!==slot.week)mismatches.push({start,date,selectedWeek:slot.week,kitchenWeek});
   checked++;
 }
}
console.log(JSON.stringify({checked,mismatchCount:mismatches.length,examples:mismatches.slice(0,4)},null,2));
assert.equal(mismatches.length,0,'Selection dates must match kitchen rotation, including Friday subscription starts');
