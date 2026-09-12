/** Native orchestration only. Business rules remain in shared/rules. */
import { addMealVerdict, countPicks, dailyLimits, dayComplete, mealAvailableOn, orderedSubscriptionSlots, slotKey, subscriptionShortfall, restrictionHit, restrictionWords, avoidTokens, isMainCategory, isSnackCategory } from './rules';

export type Subscriber = { _id: string; fullName?: string; startDate?: string; endDate?: string; mealsPerDay?: number; snacksPerDay?: number; allergies?: string; avoid?: string; program?: string; isActive?: boolean; pausedFrom?: string };
export type SelectionMeal = { _id: string; nameAr: string; nameEn?: string; category?: string; [key: string]: any };
export type Pick = { meal: SelectionMeal; week: number; day: string };
export const picksAt = (picks: Pick[], week: number, day: string) => picks.filter(p => p.week === week && p.day === day);
export const selectionToday = () => new Date(Date.now()+3*60*60*1000).toISOString().slice(0,10);
/** Same sequential navigation boundary for manual selection and smart review. */
export function dayNavigationAllowed(index:number, firstIncomplete:number, slotCount:number) {
  return Number.isInteger(index) && index>=0 && index<slotCount
    && (firstIncomplete<0 || index<=firstIncomplete);
}
export function selectableMeal(meal:SelectionMeal,week:number,day:string) {
  return meal.isActive!==false&&!meal.isGymOnly&&!meal.isOnlineOnly
    &&(isMainCategory(meal.category)||isSnackCategory(meal.category))&&mealAvailableOn(meal,week,day);
}
export function swapCandidate(original: Pick, meal: SelectionMeal) {
  return meal._id!==original.meal._id && meal.category===original.meal.category
    && selectableMeal(meal,original.week,original.day);
}
/** Atomic replacement: preserve slot, count, and original on stale/invalid selection. */
export function replacePick(customer:Subscriber,rotation:number,picks:Pick[],index:number,expected:Pick,meal:SelectionMeal,approved=false,today?:string) {
  const current=picks[index];
  if(!current||current.meal._id!==expected.meal._id||current.week!==expected.week||current.day!==expected.day)return picks;
  const state=selectionState(customer,rotation,picks,today);
  if(!state.slots.some(s=>s.week===current.week&&s.day===current.day)||!swapCandidate(current,meal))return picks;
  const others=picksAt(picks.filter((_,i)=>i!==index),current.week,current.day);
  const verdict=addMealVerdict(meal.category,countPicks(others.map(p=>p.meal)),state.limits);
  const restriction=restrictionHit(meal,restrictionWords(customer.avoid,customer.allergies),avoidTokens(customer.allergies,customer.avoid));
  if(verdict.block||(!approved&&(verdict.secondBreakfast||restriction||others.some(p=>p.meal._id===meal._id))))return picks;
  return picks.map((p,i)=>i===index?{...p,meal}:p);
}
const subscriptionCount = (value: unknown) => Number.isFinite(Number(value))&&Number(value)>0?Math.floor(Number(value)):0;
export function selectionState(customer: Subscriber, rotation: number, picks: Pick[], today = selectionToday()) {
  const paused = !!customer.pausedFrom || (customer.isActive===false && !(customer.startDate && customer.startDate>today));
  const validRotation = Number.isInteger(rotation)&&rotation>=1&&rotation<=4;
  const slots = (paused||!validRotation?[]:orderedSubscriptionSlots(customer.startDate, customer.endDate, rotation, today))
    .filter((s, i, all) => all.findIndex(x => slotKey(x.week, x.day) === slotKey(s.week, s.day)) === i);
  // Match customerOrderRules exactly: subscriber counts are finite integers; missing means zero.
  const limits = dailyLimits({mealsPerDay:subscriptionCount(customer.mealsPerDay),snacksPerDay:subscriptionCount(customer.snacksPerDay)});
  limits.noMealPlan = limits.mealsPerDay===0&&limits.snacksPerDay===0;
  const completed = slots.map(s => dayComplete(countPicks(picksAt(picks, s.week, s.day).map(p => p.meal)), limits));
  const firstIncomplete = completed.findIndex(x => !x);
  const shortfall = subscriptionShortfall(picks.map(p => ({ week: p.week, day: p.day, category: p.meal.category })), slots, limits.mealsPerDay, limits.snacksPerDay);
  return { slots, limits, completed, firstIncomplete, shortfall };
}
export function pickVerdict(customer: Subscriber, rotation: number, picks: Pick[], week: number, day: string, meal: SelectionMeal, today?: string): { block: string | null; secondBreakfast?: boolean; duplicate?: boolean; restriction?: string | null } {
  const state = selectionState(customer, rotation, picks, today);
  const index = state.slots.findIndex(s => s.week === week && s.day === day);
  if (index < 0) return { block: 'outsideSubscription' };
  if (meal.isActive===false||meal.isGymOnly||meal.isOnlineOnly||(!isMainCategory(meal.category)&&!isSnackCategory(meal.category))) return {block:'unavailable'};
  if (state.firstIncomplete >= 0 && index > state.firstIncomplete) return { block: 'previousDayIncomplete' };
  if (!mealAvailableOn(meal, week, day)) return { block: 'unavailable' };
  const dayPicks = picksAt(picks, week, day);
  const verdict = addMealVerdict(meal.category, countPicks(dayPicks.map(p => p.meal)), state.limits);
  return { ...verdict,
    duplicate: dayPicks.some(p => p.meal._id === meal._id),
    restriction: restrictionHit(meal, restrictionWords(customer.avoid, customer.allergies), avoidTokens(customer.allergies, customer.avoid)),
  };
}

export function selectionReady(customer: Subscriber, rotation: number, picks: Pick[], today?: string) {
  const state = selectionState(customer, rotation, picks, today);
  if (!picks.length || picks.length>500 || !state.slots.length || state.limits.noMealPlan || state.shortfall.incompleteDays) return false;
  // Recheck schedule and limits against the latest catalog/subscription before submission.
  for (const s of state.slots) {
    const dayPicks = picksAt(picks, s.week, s.day);
    const counts = countPicks(dayPicks.map(p => p.meal));
    if (counts.meals > state.limits.mealsPerDay || counts.snacks > state.limits.snacksPerDay) return false;
  }
  return picks.every(p => p.meal.isActive!==false&&!p.meal.isGymOnly&&!p.meal.isOnlineOnly&&(isMainCategory(p.meal.category)||isSnackCategory(p.meal.category))&&state.slots.some(s => s.week === p.week && s.day === p.day) && mealAvailableOn(p.meal, p.week, p.day));
}
