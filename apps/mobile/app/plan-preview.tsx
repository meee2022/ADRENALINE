import React, { useState } from 'react';
import { Pick, replacePick } from '@/subscriberSelection';
import { ScrollView } from 'react-native';
import { PlanOverview } from '@/components/PlanOverview';
import { T } from '@/components/ui';
import { colors } from '@/theme';
import { menuArtwork } from '@/menuArtwork';

/** Local visual fixture only. No subscriber lookup, AI action or order mutations. */
export default function PlanPreview(){
  const customer={_id:'visual-fixture',startDate:'2099-01-03',endDate:'2099-01-04',mealsPerDay:1,snacksPerDay:1};
  const catalog=Object.keys(menuArtwork).slice(0,4).map((_id,i)=>({_id,nameAr:'صنف تجريبي '+(i+1),category:i%2?'salad':'lunch',calories:200,protein:10,carbs:20,fats:8,schedule:[{week:1,day:'saturday'},{week:1,day:'sunday'}]}));
  const [picks,setPicks]=useState<Pick[]>(()=>['saturday','sunday'].flatMap(day=>catalog.slice(0,2).map(meal=>({meal,day,week:1}))));
  if(!__DEV__)return null;
  return <ScrollView style={{flex:1,backgroundColor:colors.bg}} contentContainerStyle={{padding:20}}><T w="black">معاينة محلية ببيانات تجريبية — ليست خطة مشترك</T><PlanOverview customer={customer} rotation={1} picks={picks} catalog={catalog} factor={1} frozen={false} onRemove={()=>{}} onEdit={()=>{}} onReplace={(index,expected,meal,approved)=>setPicks(p=>replacePick(customer,1,p,index,expected,meal,approved))}/></ScrollView>;
}
