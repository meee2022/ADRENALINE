import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pick, SelectionMeal } from './subscriberSelection';
export type Draft={version:1;customerId:string;updatedAt:number;items:{id:string;week:number;day:string}[];attempt?:any;submitted?:string};
const queues=new Map<string,Promise<void>>();
const key=(id:string)=>'adrenaline.draft.v1.'+id;
export function saveDraft(draft:Draft){
  const id=key(draft.customerId);
  const task=(queues.get(id)||Promise.resolve()).catch(()=>{}).then(()=>AsyncStorage.setItem(id,JSON.stringify(draft)));
  queues.set(id,task);return task;
}
export async function loadDraft(id:string):Promise<Draft|null>{
  await queues.get(key(id));
  const raw=await AsyncStorage.getItem(key(id));if(!raw)return null;
  const d=JSON.parse(raw);
  if(d.version!==1||d.customerId!==id||!Array.isArray(d.items)||d.items.length>500)throw new Error('Invalid draft');
  if(!d.items.every((i:any)=>typeof i.id==='string'&&Number.isInteger(i.week)&&typeof i.day==='string'))throw new Error('Invalid draft items');
  return d;
}
/** مسودة تالفة (JSON مكسور/إصدار قديم) كانت تجمّد شاشة الاختيار للأبد — تُحذف ويبدأ المشترك من جديد. */
export async function discardDraft(id:string){await queues.get(key(id));await AsyncStorage.removeItem(key(id));}
export function restorePicks(draft:Draft,catalog:SelectionMeal[]):Pick[]{
  return draft.items.map(i=>({week:i.week,day:i.day,meal:catalog.find(m=>m._id===i.id)||{_id:i.id,nameAr:'وجبة لم تعد متاحة',isActive:false}}));
}
export function makeDraft(customerId:string,picks:Pick[],attempt?:any,submitted?:string):Draft{
  return {version:1,customerId,updatedAt:Date.now(),items:picks.map(p=>({id:p.meal._id,week:p.week,day:p.day})),attempt,submitted};
}
