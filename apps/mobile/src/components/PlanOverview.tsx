import { localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
import React, { useState } from 'react';
import { Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { Pick, Subscriber, SelectionMeal, selectionState, swapCandidate, replacePick, dayNavigationAllowed } from '@/subscriberSelection';
import { slotToDate, scaledNutrition, restrictionHit, restrictionWords, avoidTokens } from '@/rules';
import { colors } from '@/theme';
import { Btn, Chip, T } from './ui';
import { PlanMealCard } from './PlanMealCard';

const DAYS:Record<string,string>={saturday:'السبت',sunday:'الأحد',monday:'الإثنين',tuesday:'الثلاثاء',wednesday:'الأربعاء',thursday:'الخميس'};
/** Shared review: day-scoped cards and atomic swaps, never remove before replacing. */
export function PlanOverview({customer,rotation,picks,catalog,factor,frozen,onRemove,onEdit,onReplace}: {
  customer:Subscriber;rotation:number;picks:Pick[];catalog:SelectionMeal[];factor:number;frozen:boolean;
  onRemove:(index:number)=>void;onEdit:(index:number)=>void;
  onReplace:(index:number,expected:Pick,meal:SelectionMeal,approved:boolean)=>void;
}) {
  const { t } = useUILanguage();
  const [selected,setSelected]=useState('');
  const [fullPlan,setFullPlan]=useState(false);
  const [swap,setSwap]=useState<{index:number;pick:Pick}|null>(null);
  const [warning,setWarning]=useState<SelectionMeal|null>(null);
  const [width,setWidth]=useState(0);
  const state=selectionState(customer,rotation,picks);
  const groups=state.slots.map((slot,index)=>({...slot,index,valid:true}));
  for(const pick of picks)if(!groups.some(g=>g.week===pick.week&&g.day===pick.day))groups.push({week:pick.week,day:pick.day as any,index:-1,valid:false});
  const key=(g:{week:number;day:string})=>g.week+':'+g.day;
  const allowed=(index:number)=>dayNavigationAllowed(index,state.firstIncomplete,state.slots.length);
  const requested=groups.find(g=>key(g)===selected);
  const group=requested&&(!requested.valid||allowed(requested.index))?requested:groups[Math.max(0,state.firstIncomplete)];
  const columns=width>=760?4:width>=540?3:width>=300?2:1;
  const cardWidth=Math.max(0,(width-24-(columns-1)*10)/columns);
  const close=()=>{setSwap(null);setWarning(null);};
  const choose=(meal:SelectionMeal,approved=false)=>{
    if(!swap||frozen)return;
    const slotIndex=state.slots.findIndex(s=>s.week===swap.pick.week&&s.day===swap.pick.day);
    if(!allowed(slotIndex)){close();return;}
    const canonical=catalog.find(m=>m._id===meal._id);
    if(!canonical)return;
    if(replacePick(customer,rotation,picks,swap.index,swap.pick,canonical,approved)===picks){
      if(!approved&&replacePick(customer,rotation,picks,swap.index,swap.pick,canonical,true)!==picks)setWarning(canonical);
      return;
    }
    onReplace(swap.index,swap.pick,canonical,approved);close();
  };
  if(!group)return <T>لا توجد أيام متاحة.</T>;
  const rows=picks.map((pick,index)=>({pick,index})).filter(({pick})=>key(pick)===key(group));
  const candidates=swap?catalog.filter(m=>swapCandidate(swap.pick,m)):[];
  const restriction=warning?restrictionHit(warning,restrictionWords(customer.avoid,customer.allergies),avoidTokens(customer.allergies,customer.avoid)):null;
  const duplicate=warning&&rows.some(r=>r.index!==swap?.index&&r.pick.meal._id===warning._id);
  return <View onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={s.root}>
    <View style={{gap:6}}><T w="black" style={s.title}>خطة وجباتك</T><T style={s.copy}>{picks.length} صنفًا عبر {state.slots.length} أيام · {state.completed.filter(Boolean).length} أيام مكتملة</T><T style={s.copy}>راجع وجباتك وبدّل ما تحب قبل إرسالها للأخصائية.</T></View>
    {!swap&&<View style={{flexDirection:'row',gap:8}}><Chip label="حسب اليوم" active={!fullPlan} onPress={()=>setFullPlan(false)}/><Chip label="الخطة كاملة" active={fullPlan} onPress={()=>setFullPlan(true)}/></View>}
    {!fullPlan&&!swap&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>
      {groups.map(g=>{
        const locked=g.valid&&!allowed(g.index);
        return <Pressable key={key(g)} accessibilityRole="button" accessibilityState={{selected:key(g)===key(group),disabled:locked||frozen}} disabled={locked||frozen} onPress={()=>{if(g.valid&&!allowed(g.index))return;setSelected(key(g));close();}} style={[s.dayTab,key(g)===key(group)&&s.activeTab,(locked||frozen)&&{opacity:.5}]}>
          <T w="bold">{(DAYS[g.day]||g.day)+' · '+(g.valid?slotToDate(customer.startDate,rotation,g.week,g.day)?.slice(5):'غير متاح')}</T>
          {locked&&<T>{t('أكمل اليوم السابق أولًا','Complete the previous day first')}</T>}
        </Pressable>;
      })}
    </ScrollView>}
    {!swap&&state.firstIncomplete>=0&&<T accessibilityLiveRegion="polite" style={s.copy}>{t('أكمل الوجبات والسناكات لليوم الناقص أولًا؛ بعدها تُفتح الأيام التالية. عرض الخطة كاملة للمراجعة لا يتجاوز هذا الشرط.','Complete the meals and snacks for the unfinished day first to unlock later days. Full-plan review keeps the same rule.')}</T>}
    {swap?<>
      <T w="bold">تبديل: {localizedField(swap.pick.meal, 'name')}</T>
      <T style={s.copy}>بدائل نفس التصنيف المتاحة لهذا اليوم وأسبوع الطبخ فقط. وجبتك الحالية محفوظة حتى تختار البديل.</T>
      <Btn label="إلغاء التبديل والعودة لوجبات اليوم" variant="outline" onPress={close}/>
      {warning&&<View style={s.notice}><T accessibilityRole="alert">{restriction?'تنبيه الحساسية أو الممنوعات: '+restriction+'. اختيارها على مسؤوليتك وسيظهر التنبيه للأخصائية. ':''}{duplicate?'اخترت هذه الوجبة بالفعل؛ التبديل يعني استلامها مكررة في نفس اليوم. ':''}{!restriction&&!duplicate?'هذه وجبة فطور ثانية لنفس اليوم وتُحسب من وجباتك الرئيسية. ':''}</T><Btn label="تأكيد اختيار البديل مع التنبيه" disabled={frozen} onPress={()=>choose(warning,true)}/><Btn label="اختيار بديل آخر" variant="outline" onPress={()=>setWarning(null)}/></View>}
      {!candidates.length&&<T>لا يوجد بديل متاح من نفس التصنيف لهذا اليوم. وجبتك لم تتغير.</T>}
      <T style={s.copy}>{DAYS[swap.pick.day]} · أسبوع الطبخ {swap.pick.week}</T>
      <View style={s.grid}>{width>0&&candidates.map(meal=><PlanMealCard key={meal._id} meal={meal} factor={factor} width={cardWidth} label="اختيار البديل" disabled={frozen} onPress={()=>choose(meal)}/>)}</View>
    </>:<>
      {(fullPlan?groups:[group]).map(g=>{
        const dayRows=picks.map((pick,index)=>({pick,index})).filter(({pick})=>key(pick)===key(g));
        const calories=Math.round(dayRows.reduce((n,{pick})=>n+Number(scaledNutrition(pick.meal,factor).calories||0),0));
        return <View key={key(g)} style={s.dayPanel}>
          <View style={s.heading}><View style={{gap:2}}><T w="bold" style={s.dayTitle}>{DAYS[g.day]||g.day} · {g.valid?slotToDate(customer.startDate,rotation,g.week,g.day):'خارج الاشتراك'}</T><T style={s.dayMeta}>أسبوع الطبخ {g.week} · {dayRows.length} أصناف · {calories} سعرة</T></View><T style={s.dayMeta}>{g.valid&&state.completed[g.index]?'مكتمل':'غير مكتمل'}</T></View>
          <View style={s.grid}>{width>0&&dayRows.map(({pick,index})=><PlanMealCard key={pick.meal._id+':'+index} meal={pick.meal} factor={factor} width={cardWidth} label={g.valid?'تبديل':'إزالة غير المتاح'} disabled={frozen||(g.valid&&!allowed(g.index))} onPress={()=>{if(!g.valid){onRemove(index);return;}if(!allowed(g.index))return;setSelected(key(g));setSwap({index,pick});setWarning(null);}}/>)}</View>
          {!dayRows.length&&<T style={[s.copy,{padding:12}]}>لم تُضف وجبات لهذا اليوم بعد.</T>}
          {g.valid&&!state.completed[g.index]&&<Btn style={{margin:12}} label="استكمال وجبات هذا اليوم" disabled={frozen||(state.firstIncomplete>=0&&g.index>state.firstIncomplete)} onPress={()=>onEdit(g.index)}/>}
        </View>;
      })}
    </>}
  </View>;
}
const s=StyleSheet.create({
  dayTab:{padding:12,minHeight:48,borderRadius:12,borderWidth:1,borderColor:colors.line,backgroundColor:colors.card,gap:4},
  activeTab:{borderColor:colors.cyanDark,backgroundColor:colors.cyanSoft},
  root:{gap:16,paddingVertical:16,width:'100%',maxWidth:900,alignSelf:'center'},
  heading:{padding:14,backgroundColor:colors.navy2,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'},
  dayPanel:{borderRadius:16,overflow:'hidden',backgroundColor:colors.bg2},
  dayTitle:{fontSize:14,color:colors.card},dayMeta:{fontSize:11,color:colors.cyanSoft,lineHeight:20},
  title:{fontSize:22,color:colors.navy2},copy:{fontSize:13,lineHeight:23,color:colors.muted2},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10,padding:12},
  notice:{padding:16,gap:12,backgroundColor:colors.cyanSoft,borderRadius:16},
});
