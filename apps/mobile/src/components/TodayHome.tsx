import React,{useCallback,useRef,useState} from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect,useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { api,convex } from '@/api';
import { useCustomerSession } from '@/customerSession';
import { colors } from '@/theme';
import { Btn,T } from './ui';
import { SubscriberDay } from './SubscriberDay';
import { NotificationSettings } from './NotificationSettings';
import { useContentLanguage } from '@/useContentLanguage';
export function TodayHome(){
  const { language } = useContentLanguage();
  const {session}=useCustomerSession();const router=useRouter();
  const [profile,setProfile]=useState<any>(null),[status,setStatus]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [stamp,setStamp]=useState<number | null>(null);
  const request=useRef(0);
  const [revision,setRevision]=useState(0);
  const load=useCallback(async()=>{
    if(!session)return;
    const current=++request.current;
    setLoading(true);setError('');setStatus(null);
    try{
      const p=await convex.query(api.customerAuth.getProfile,{accountId:session.accountId,sessionToken:session.token});
      if(current!==request.current)return;
      setProfile(p);
      if(p?.subscription&&(Constants.expoConfig?.extra as any)?.subscriberOverviewEnabled){
        const next=await convex.query(api.mobileSubscriber.overview,{customerId:p.subscription.id,sessionToken:session.token});
        if(current!==request.current)return;
        setStatus(next);
      }
      setRevision(n=>n+1);
      setStamp(Date.now());
    }catch{if(current===request.current)setError('تعذّر تحديث البيانات. لا نعتمد على حالة قديمة للسماح باختيار خطة جديدة.');}
    finally{if(current===request.current)setLoading(false);}
  },[session]);
  useFocusEffect(useCallback(()=>{setProfile(null);void load();return()=>{request.current++;};},[load]));
  if(!session)return null;
  return <ScrollView style={{flex:1,backgroundColor:colors.bg}} contentContainerStyle={{padding:24,paddingTop:48,gap:16}}>
    <T w="black" style={{fontSize:28,color:colors.navy2}}>اليوم</T>
    <T>أهلًا {profile?.account?.fullName||'بك'}</T>
    <T>{loading?'جارٍ التحديث…':error||'آخر تحديث: '+(stamp ? new Date(stamp).toLocaleTimeString(language==='ar'?'ar-QA':'en-QA',{timeZone:'Asia/Qatar',hour:'2-digit',minute:'2-digit'}) : '—')}</T>
    <Btn label="تحديث الحالة" variant="outline" disabled={loading} onPress={()=>void load()}/>
    {profile?.subscription&&<SubscriberDay key={`${profile.subscription.id}:${revision}`} customerId={profile.subscription.id} token={session.token} skippedDates={profile.subscription.skippedDates}/>}
    {profile?.subscription&&<NotificationSettings customerId={profile.subscription.id}/>}
    {status&&!error&&<View style={{padding:16,gap:10,backgroundColor:colors.cyanSoft,borderRadius:16}}>
      <T>{status.pending?'خطتك بانتظار اعتماد الأخصائية':status.hasApprovedPlan?'خطتك معتمدة؛ تابع وجباتك وحالة التوصيل هنا.':!status.active?'اشتراكك غير متاح للاختيار حاليًا.':'راجع حالة اختياراتك.'}</T>
      {status.canStartSelection&&<Btn label="متابعة اختياراتك" onPress={()=>router.push('/menu')}/>}
    </View>}
    {!status&&profile?.subscription&&<T>عرض وجبات اليوم متاح. التحقق الشامل من حالة الخطة يحتاج تفعيل خدمة المشتركين؛ لن نطلب منك اختيار خطة أخرى قبل التحقق.</T>}
    <Btn label="حسابي" variant="outline" onPress={()=>router.push('/account')}/>
  </ScrollView>;
}
