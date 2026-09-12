import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const {calculateCalories,recommendPlans,planSaving}=createRequire(import.meta.url)('../apps/mobile/src/calorieCalculator.ts') as typeof import('../apps/mobile/src/calorieCalculator');
// Execute the current website's actual pure calculation body as parity oracle.
const source=readFileSync(new URL('../client/src/pages/public/CalorieCalculator.tsx',import.meta.url),'utf8');
const body=source.match(/const result = useMemo\(\(\) => \{([\s\S]*?)\}, \[activity, age, goal, height, pace, sex, weight\]\);/)?.[1];
assert.ok(body,'Website calculator shape changed: review parity oracle');
const website=new Function('sex','age','height','weight','activity','goal','pace','clamp',body);
let count=0;
for(const sex of ['male','female'] as const) for(const goal of ['lose','maintain','gain'] as const)
for(const activity of [1.2,1.375,1.55,1.725,1.9]) for(const [age,height,weight] of [[30,175,75],[90,120,35],[14,230,250]]) {
  const input={sex,goal,activity,age,height,weight,pace:goal==='gain'?.25:.5};
  assert.deepEqual(calculateCalories(input),website(sex,age,height,weight,activity,goal,input.pace,(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v)))); count++;
}
assert.deepEqual(recommendPlans([], 'lose'),[]);
assert.deepEqual(recommendPlans([{_id:'hidden',slug:'diet',isActive:false,duration:'week'},{_id:'shown',slug:'diet',duration:'week',sortOrder:1}], 'lose').map(p=>p._id),['shown']);
assert.equal(planSaving({duration:'month',options:[{priceQAR:2400}]},700),400);
assert.equal(planSaving({duration:'two_weeks',options:[{priceQAR:1300}]},700),100);
assert.equal(planSaving({duration:'week',options:[{priceQAR:700}]},700),0);
assert.equal(planSaving({duration:'month',options:[{priceQAR:3000}]},700),0);
assert.equal(planSaving({duration:'month',options:[]},700),0);
assert.equal(planSaving({duration:'month',options:[{priceQAR:2400}]},0),0);
console.log(`${count} website calculation comparisons, 2 recommendation checks and 6 savings checks passed`);
