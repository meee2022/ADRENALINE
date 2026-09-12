import { mealAllowance, translate as localize, contentLanguage as uiLanguage, localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
import React, { useRef, useState } from 'react';
import { Image } from 'expo-image';
import { planArtwork } from '@/planArtwork';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { TextInput } from '@/components/LocalizedTextInput';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import { colors, fonts } from '@/theme';
import { Btn, T } from '@/components/ui';
import { activities, calculateCalories, Goal, paces, recommendPlans, planSaving } from '@/calorieCalculator';

export default function CalorieCalculator() {
  useUILanguage();
  const router = useRouter(), insets = useSafeAreaInsets();
  const [sex,setSex] = useState<'male'|'female'>('male');
  const [age,setAge] = useState('30'), [height,setHeight] = useState('175'), [weight,setWeight] = useState('75');
  const [activity,setActivity] = useState(1.55), [goal,setGoal] = useState<Goal>('maintain'), [pace,setPace] = useState(.5);
  const plans = useQuery(api.publicPlans.list, {}) as any[] | undefined;
  const valid = [[age,14,90],[height,120,230],[weight,35,250]].every(([v,min,max]) => String(v).trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= Number(min) && Number(v) <= Number(max));
  const result = valid ? calculateCalories({sex, age:Number(age), height:Number(height), weight:Number(weight), activity,goal,pace}) : null;
  const recommended = recommendPlans(plans || [], goal);
  const scroll = useRef<ScrollView>(null);
  const [recommendationY,setRecommendationY] = useState(0);
  const weeklyPrice = Number(recommended.find(p=>p.duration==='week')?.options?.[0]?.priceQAR || 0);
  const goalDescription = goal==='lose'?'عجز سعرات مدروس لدعم نزول الوزن.':goal==='gain'?'فائض سعرات مضبوط لدعم بناء الكتلة.':'قريب من احتياجك للحفاظ على الوزن.';
  const changeGoal = (next: Goal) => { setGoal(next); if(next === 'lose')setPace(.5); if(next === 'gain')setPace(.25); };
  return <KeyboardAvoidingView style={{flex:1,backgroundColor:colors.bg}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page,{paddingTop:insets.top+16,paddingBottom:insets.bottom+32}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={localize(String("رجوع"))} style={s.back} onPress={()=>router.canGoBack()?router.back():router.replace('/')}><Ionicons name={uiLanguage() === "ar" ? "arrow-forward" : "arrow-back"} size={22} color={colors.navy2}/><T w="bold">رجوع</T></Pressable>
      <T accessibilityRole="header" w="black" style={s.title}>حاسبة السعرات والماكروز</T>
      <T style={s.copy}>اعرف احتياج جسمك حسب بياناتك ونشاطك وهدفك. لا يتم حفظ أو إرسال بيانات الحساب.</T>
      <View style={s.panel}>
        <T w="bold" style={s.label}>الجنس</T>
        <View style={s.row}><Choice label="ذكر" active={sex==='male'} onPress={()=>setSex('male')}/><Choice label="أنثى" active={sex==='female'} onPress={()=>setSex('female')}/></View>
        <NumberField label="العمر" unit="سنة" value={age} onChange={setAge} min={14} max={90}/>
        <NumberField label="الطول" unit="سم" value={height} onChange={setHeight} min={120} max={230}/>
        <NumberField label="الوزن" unit="كجم" value={weight} onChange={setWeight} min={35} max={250}/>
        <T w="bold" style={s.label}>مستوى النشاط اليومي</T>
        {activities.map(a=><Choice key={a.value} label={a.label} detail={a.detail} active={activity===a.value} onPress={()=>setActivity(a.value)}/>)}
        <T w="bold" style={s.label}>ما هدفك؟</T>
        <View style={s.row}>{([['lose','تنزيل الوزن'],['maintain','ثبات الوزن'],['gain','زيادة الكتلة']] as const).map(([g,label])=><Choice key={g} label={label} active={goal===g} onPress={()=>changeGoal(g)}/>)}</View>
        {goal!=='maintain'&&<><T w="bold" style={s.label}>سرعة الوصول للهدف</T><View style={s.row}>{paces[goal].map(p=><Choice key={p.value} label={p.label} detail={`${p.value} كجم/أسبوع`} active={pace===p.value} onPress={()=>setPace(p.value)}/>)}</View></>}
      </View>
      <View style={[s.panel,{backgroundColor:colors.navy2}]}>
        <T accessibilityRole="header" w="bold" style={{color:colors.card,fontSize:18}}>احتياجك اليومي التقديري</T>
        {!result ? <T accessibilityRole="alert" style={{color:colors.card}}>أكمل الأرقام ضمن النطاق الموضح لعرض النتيجة.</T> : <>
          <T w="black" style={{fontSize:42,color:colors.cyan}}>{result.calories} <T style={{fontSize:16,color:colors.card}}>سعرة</T></T>
          <T style={{color:colors.card,lineHeight:24}}>{goalDescription}</T>
          <View style={s.row}>{[[result.protein,'بروتين'],[result.carbs,'كارب'],[result.fat,'دهون']].map(([v,l])=><View key={l} style={{flex:1,alignItems:'center',gap:4}}><T w="black" style={{fontSize:22,color:colors.cyan}}>{v}g</T><T style={{color:colors.card}}>{l}</T></View>)}</View>
          {[[result.bmr+' سعرة','معدل الأيض الأساسي'],[result.tdee+' سعرة','احتياج الحفاظ'],[result.water+' لتر','الماء المقترح'],[result.bmi.toFixed(1),'مؤشر كتلة الجسم']].map(([v,l])=><View key={l} style={s.resultRow}><T style={{color:colors.card,flex:1}}>{l}</T><T w="bold" style={{color:colors.card}}>{v}</T></View>)}
          {result.belowFloor&&<T style={{color:colors.card,lineHeight:23}}>تم رفع النتيجة إلى الحد الأدنى العام للسعرات كما في حاسبة الموقع. استشر مختصًا قبل اتباع عجز أكبر.</T>}
          <Btn label="شاهد الخطط المناسبة" variant="white" onPress={()=>scroll.current?.scrollTo({y:recommendationY,animated:false})}/>
        </>}
      </View>
      <T style={s.copy}>هذه نتيجة تقديرية للبالغين الأصحاء وليست تشخيصًا طبيًا. الحمل والرضاعة، العمر أقل من 18 سنة، اضطرابات الأكل، أو الحالات المزمنة تتطلب مراجعة طبيب أو أخصائي تغذية.</T>
      {result&&<View onLayout={event=>setRecommendationY(event.nativeEvent.layout.y)} style={{gap:16}}>
        <T accessibilityRole="header" w="black" style={s.label}>الباقة الأقرب لهدفك</T>
        <T style={s.copy}>من باقات المطعم المنشورة، بحسب الهدف. اختيار عدد الوجبات يتم في صفحة الخطط.</T>
        {plans===undefined?<T>جارٍ تحميل الباقات…</T>:recommended.length===0?<T style={s.copy}>لا توجد باقات منشورة مطابقة حاليًا. يمكنك تصفّح كل الخطط.</T>:recommended.map((p,index)=>{
          const monthly=p.duration==='month', saving=planSaving(p,weeklyPrice);
          const ink=monthly?colors.card:colors.navy2;
          return <View key={p._id} style={{borderRadius:16,overflow:'hidden',backgroundColor:monthly?colors.navy2:colors.card}}>
            {monthly&&<View style={{backgroundColor:colors.cyan,padding:12}}><T w="black" style={{color:colors.navy2,textAlign:'center'}}>أفضل قيمة للاشتراك المنتظم</T></View>}
            <Image source={planArtwork(p)} accessibilityLabel={localize(String(`صورة ${localizedField(p)}`))} contentFit="contain" style={{width:'100%',aspectRatio:1.5,backgroundColor:colors.cyanSoft}}/>
            <View style={{padding:20,gap:12}}>
              <T w="bold" style={{color:monthly?colors.cyan:colors.cyanDark}}>{monthly?'شهري':p.duration==='two_weeks'?'أسبوعان · اختيار عملي':index===0?'أسبوعي · للتجربة':'أسبوعي'}</T>
              <T w="black" style={{fontSize:22,color:ink}}>{localizedField(p, 'name')}</T>
              {p.options?.map((o:any,i:number)=><View key={i} style={{gap:4}}><T style={{color:ink}}>{mealAllowance(o.mealsCount, o.snacksCount)}</T><T w="black" style={{fontSize:22,color:monthly?colors.cyan:colors.cyanDark}}>{o.priceQAR} ر.ق</T></View>)}
              {saving>0&&<T w="bold" style={{color:ink,lineHeight:24}}>وفر {saving} ر.ق مقارنة بتكرار الأسبوع — للخيار الأول المعروض</T>}
              <Btn label={`التفاصيل والخيارات — ${monthly?'شهري':p.duration==='two_weeks'?'أسبوعان':'أسبوعي'}`} variant={monthly?'white':'primary'} onPress={()=>router.push({pathname:'/plans',params:{duration:p.duration}})}/>
            </View>
          </View>;
        })}
        <Btn label="شاهد الخطط والخيارات" onPress={()=>router.push('/plans')}/>
      </View>}
      <T w="bold" style={s.label}>كيف وصلنا إلى النتيجة؟</T><T style={s.copy}>نستخدم معادلة ميفلين سانت جيور، ثم مستوى النشاط، وعجزًا أو فائضًا محدودًا حسب الهدف. الحساب مطابق لمعادلات الموقع الحالي.</T>
    </ScrollView>
  </KeyboardAvoidingView>;
}
function Choice({label,detail,active,onPress}:{label:string;detail?:string;active:boolean;onPress:()=>void}) {
  useUILanguage();
  return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={[s.choice,{backgroundColor:active?colors.cyanSoft:colors.card,borderColor:active?colors.cyanDark:colors.line}]}><T w="bold" style={{color:colors.navy2}}>{label}</T>{detail&&<T style={s.copy}>{detail}</T>}</Pressable>;
}
function NumberField({label,unit,value,onChange,min,max}:{label:string;unit:string;value:string;onChange:(v:string)=>void;min:number;max:number}) {
  useUILanguage();
  const normalize=(v:string)=>v.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace('٫','.');
  return <View style={{gap:6}}><T w="bold">{label} ({unit})</T><TextInput accessibilityLabel={localize(label)+' '+localize(unit)} keyboardType="decimal-pad" value={value} onChangeText={v=>onChange(normalize(v))} style={s.input}/><T style={s.copy}>من {min} إلى {max} {unit}</T></View>;
}
const s=StyleSheet.create({
  page:{paddingHorizontal:20,gap:20,width:'100%',maxWidth:760,alignSelf:'center'},
  back:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8,alignSelf:'flex-start'},
  title:{fontSize:28,lineHeight:40,color:colors.navy2},label:{fontSize:18,color:colors.navy2},
  copy:{fontSize:13,lineHeight:23,color:colors.muted2},panel:{backgroundColor:colors.card,borderRadius:16,padding:20,gap:16},
  row:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{padding:12,minHeight:48,borderWidth:1,borderRadius:12,flexGrow:1,flexShrink:1,gap:4},
  input:{fontFamily:fonts.bold,fontSize:20,color:colors.navy2,borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,minHeight:52,textAlign:'center',writingDirection:'ltr'},
  resultRow:{flexDirection:'row',gap:12,alignItems:'center',flexWrap:'wrap',paddingTop:8},
});
