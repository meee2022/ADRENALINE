import React, { useCallback, useRef, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, convex, SITE_URL } from '@/api';
import { colors } from '@/theme';
import { Btn, T } from '@/components/ui';
import { useContentLanguage } from '@/useContentLanguage';

const statuses: Record<string,[string,string]> = {
  DRAFT:['الخطة قيد المراجعة','Plan under review'], CONFIRMED:['تم تأكيد الوجبات','Meals confirmed'],
  PREPARED:['وجباتك جاهزة','Your meals are ready'], OUT_FOR_DELIVERY:['السائق في الطريق','Driver on the way'],
  DELIVERED:['تم التوصيل','Delivered'], FAILED:['تعذّر التوصيل','Delivery unsuccessful'], CANCELLED:['تم إلغاء التوصيل','Delivery cancelled'],
};
type Tracking = Awaited<ReturnType<typeof convex.query<typeof api.delivery.tracking>>>;

export default function DeliveryTracking() {
  const params=useLocalSearchParams<{token:string}>();
  const token=typeof params.token==='string'&&/^[a-zA-Z0-9_-]{1,256}$/.test(params.token)?params.token:'';
  const router=useRouter(), insets=useSafeAreaInsets();
  const {language,ready,change,t}=useContentLanguage();
  const [data,setData]=useState<Tracking>(null), [loading,setLoading]=useState(true), [failed,setFailed]=useState(false), [stamp,setStamp]=useState(0), [linkError,setLinkError]=useState(false);
  const version=useRef(0);
  const load=useCallback(async()=>{
    const current=++version.current;
    setLoading(true);setFailed(false);
    if(!token){setData(null);setLoading(false);return;}
    try{
      const result=await convex.query(api.delivery.tracking,{token});
      if(current===version.current){setData(result);setStamp(Date.now());}
    }catch{if(current===version.current){setFailed(true);setData(null);}}
    finally{if(current===version.current)setLoading(false);}
  },[token]);
  useFocusEffect(useCallback(()=>{
    setData(null);void load();
    const timer=setInterval(()=>{if(AppState.currentState==='active')void load();},30000);
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')void load();});
    return()=>{version.current++;clearInterval(timer);subscription.remove();};
  },[load]));
  const text={textAlign:language==='ar'?'right' as const:'left' as const,writingDirection:language==='ar'?'rtl' as const:'ltr' as const};
  const fresh=!!data?.driver?.updatedAt&&Date.now()-data.driver.updatedAt<180000;
  const open=async(url:string)=>{setLinkError(false);try{await Linking.openURL(url);}catch{setLinkError(true);}};
  return <ScrollView style={s.screen} contentContainerStyle={[s.content,{paddingTop:insets.top+20,paddingBottom:insets.bottom+28}]}>
    <View style={s.row}>
      <Btn label={t('رجوع','Back')} variant="outline" onPress={()=>router.canGoBack()?router.back():router.replace('/order-tracking')}/>
      <Btn label={language==='ar'?'English':'العربية'} variant="outline" disabled={!ready} onPress={()=>void change(language==='ar'?'en':'ar')}/>
    </View>
    <T accessibilityRole="header" w="black" style={[s.title,text]}>{t('توصيل وجباتك','Your meal delivery')}</T>
    {loading&&<T accessibilityLiveRegion="polite" style={text}>{t('جارٍ تحديث الحالة…','Updating status…')}</T>}
    {failed?<T accessibilityRole="alert" style={text}>{t('تعذّر تحديث التوصيل. تحقق من الاتصال وأعد المحاولة.','Could not update delivery. Check your connection and retry.')}</T>:!loading&&!data?<T style={text}>{t('رابط التتبّع غير صالح أو لم يعد متاحًا. تأكد من الرابط المرسل إليك.','This tracking link is invalid or no longer available. Check the link sent to you.')}</T>:null}
    {data&&<>
      <T style={[s.body,text]}>{t('أهلًا ','Hello ')}{data.firstName}</T>
      <View style={s.summary}>
        <T w="black" style={[s.status,text]}>{statuses[data.status]?t(...statuses[data.status]):t('الحالة غير معروفة','Unknown status')}</T>
        <T style={text}>{t('عدد الوجبات: ','Meals: ')}{data.mealsCount}</T>
        {!!data.deliveryTime&&<T style={text}>{t('موعد التوصيل: ','Delivery slot: ')}{data.deliveryTime}</T>}
      </View>
      {data.status==='OUT_FOR_DELIVERY'&&<>
        <T style={[s.body,text]}>{!fresh?t('موقع السائق غير متاح أو قديم؛ لا يتوفر وقت وصول موثوق حاليًا.','Driver location is unavailable or outdated; a reliable ETA is not currently available.'):data.isNear?t('السائق اقترب منك.','Your driver is nearby.'):data.etaMin!=null?t(`الوصول خلال ${data.etaMin} دقيقة تقريبًا.`,`Arrival in approximately ${data.etaMin} minutes.`):t('جارٍ تحديد وقت الوصول.','Estimating arrival time.')}</T>
        <Btn label={t('عرض خريطة التتبّع على الموقع','View tracking map on website')} variant="outline" onPress={()=>void open(`${SITE_URL}/track/${encodeURIComponent(token)}`)}/>
      </>}
      <T style={[s.small,text]}>{t('آخر تحديث: ','Last updated: ')}{new Date(stamp).toLocaleTimeString(language==='ar'?'ar-QA':'en-QA',{timeZone:'Asia/Qatar',hour:'2-digit',minute:'2-digit'})}</T>
      <T style={[s.small,text]}>{t('تُحدَّث الحالة كل 30 ثانية أثناء فتح الشاشة. الرابط خاص بك؛ لا تشاركه علنًا.','Updates every 30 seconds while this screen is active. This is a private link; do not share it publicly.')}</T>
    </>}
    <Btn label={t('تحديث الحالة','Refresh status')} disabled={loading} onPress={()=>void load()}/>
    {linkError&&<T accessibilityRole="alert" style={text}>{t('تعذّر فتح الخريطة. حاول مرة أخرى.','Could not open the map. Please try again.')}</T>}
  </ScrollView>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.bg},content:{paddingHorizontal:24,gap:20,width:'100%',maxWidth:650,alignSelf:'center'},
  row:{flexDirection:'row',justifyContent:'space-between',gap:12},title:{fontSize:30,lineHeight:44,color:colors.navy2},body:{fontSize:16,lineHeight:28,color:colors.navy2},
  summary:{padding:20,gap:12,backgroundColor:colors.cyanSoft,borderRadius:16},status:{fontSize:23,lineHeight:34,color:colors.cyanDark},small:{fontSize:13,lineHeight:23,color:colors.muted2},
});
