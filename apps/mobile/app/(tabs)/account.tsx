import { translate as localize, contentLanguage as uiLanguage, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/** Subscriber profile is read-only; meal selection remains on the existing site. */
import React, { useCallback, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { TextInput } from '@/components/LocalizedTextInput';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from 'convex/react';
import { restaurantPhone } from '@/contact';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, convex, SITE_URL } from '@/api';
import { useCustomerSession } from '@/customerSession';
import { colors, fonts } from '@/theme';
import { Btn, T } from '@/components/ui';
import { SubscriberDay } from '@/components/SubscriberDay';
import { SmartPlanEntry } from '@/components/SmartPlanEntry';

type Profile = {account:{fullName:string;email:string;phone:string};subscription:null|{
  id:string;skippedDates?:string[];loyaltyPoints?:number;loyaltyCredit?:number;referralCode?:string;
  packageLabel?:string;program?:string;isActive:boolean;startDate?:string;endDate?:string;
  mealsPerDay?:number;snacksPerDay?:number;deliveryTime?:string;address?:string;allergies?:string[];
}};
export default function Account() {
  useUILanguage();
  const router=useRouter(), insets=useSafeAreaInsets();
  const {session,setSession,ready}=useCustomerSession();
  const settings = useQuery(api.restaurantSettings.get, {});
  const phone = restaurantPhone(settings);
  const [email,setEmail]=useState(''), [password,setPassword]=useState('');
  const [show,setShow]=useState(false), [busy,setBusy]=useState(false), [loading,setLoading]=useState(false);
  const [error,setError]=useState(''), [profile,setProfile]=useState<Profile|null>(null);
  const lock=useRef(false), request=useRef(0);
  const openSite=async(path:string)=>{
    try { await Linking.openURL(SITE_URL+path); } catch { setError('تعذّر فتح الموقع. حاول مرة أخرى.'); }
  };
  const load=useCallback(async()=>{
    const version=++request.current;
    if(!session){setProfile(null);return;}
    setLoading(true);setError('');setProfile(null);
    try {
      const data=await convex.query(api.customerAuth.getProfile,{accountId:session.accountId,sessionToken:session.token});
      if(version===request.current){
        setProfile(data as Profile|null);
        if(!data)setError('الحساب غير متاح. سجّل الدخول مجددًا أو تواصل معنا.');
      }
    } catch {
      if(version===request.current)setError('تعذّر تحميل الاشتراك. تحقق من الاتصال؛ قد تحتاج إلى تسجيل الدخول مجددًا.');
    } finally {if(version===request.current)setLoading(false);}
  },[session]);
  useFocusEffect(useCallback(()=>{void load();return()=>{request.current++;};},[load]));
  const login=async()=>{
    if(lock.current||!ready)return;
    if(!email.trim()||!password){setError('أدخل البريد الإلكتروني وكلمة المرور.');return;}
    lock.current=true;setBusy(true);setError('');
    try {
      const result=await convex.mutation(api.auth.authenticateUnified,{email:email.trim(),password});
      if(!result.success){setError(result.error||'بيانات الدخول غير صحيحة.');return;}
      if(result.accountType!=='customer'||!result.customer||!result.sessionToken){
        if(result.sessionToken)await convex.mutation(api.auth.logout,{sessionToken:result.sessionToken});
        setError('هذا المدخل للمشتركين. استخدم مدخل الطاقم أسفل الصفحة.');return;
      }
      try {await setSession({accountId:result.customer.id,token:result.sessionToken});}
      catch {
        await convex.mutation(api.auth.logout,{sessionToken:result.sessionToken});
        setError('تعذّر حفظ الجلسة بأمان. حاول مرة أخرى.');return;
      }
      setPassword('');
    } catch {setError('تعذّر الدخول. تحقق من الاتصال، وإذا تكررت المحاولات انتظر 15 دقيقة.');}
    finally{lock.current=false;setBusy(false);}
  };
  const logout=async()=>{
    if(!session||lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try {
      if(profile?.subscription&&(Constants.expoConfig?.extra as any)?.subscriberPushEnabled)
        await convex.mutation(api.mobilePush.unregister,{customerId:profile.subscription.id,sessionToken:session.token});
      await convex.mutation(api.auth.logout,{sessionToken:session.token});
      request.current++;setProfile(null);setPassword('');await setSession(null);
    } catch {setError('لم يتم تسجيل الخروج. تحقق من الاتصال وحاول مرة أخرى.');}
    finally{lock.current=false;setBusy(false);}
  };
  return <KeyboardAvoidingView style={{flex:1,backgroundColor:colors.bg}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page,{paddingTop:insets.top+20,paddingBottom:insets.bottom+32}]}>
      <Image source={require('../../assets/brand-wordmark-original.png')} contentFit="contain" style={s.logo} accessibilityLabel={localize(String("أدرينالين للوجبات الصحية"))}/>
      <T w="black" accessibilityRole="header" style={s.title}>{session?'حساب المشترك':'أهلًا بعودتك'}</T>
      <T style={s.intro}>{session?'تفاصيل حسابك واشتراكك، في مكان واحد.':'ادخل بحسابك الحالي لمتابعة تفاصيل اشتراكك.'}</T>
      {!!error&&<View accessibilityRole="alert" style={s.notice}><Ionicons name="alert-circle-outline" size={22} color={colors.navy2}/><T style={{flex:1,color:colors.navy2}}>{error}</T></View>}
      {!session ? <View style={s.panel}>
        <T w="bold" style={s.label}>البريد الإلكتروني</T>
        <TextInput accessibilityLabel={localize(String("البريد الإلكتروني"))} value={email} onChangeText={setEmail} editable={!busy} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" style={s.input} placeholder={localize(String("name@example.com"))} placeholderTextColor={colors.muted2}/>
        <T w="bold" style={s.label}>كلمة المرور</T>
        <View style={s.password}>
          <TextInput accessibilityLabel={localize(String("كلمة المرور"))} value={password} onChangeText={setPassword} editable={!busy} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" style={[s.input,{flex:1,borderWidth:0,marginBottom:0}]} returnKeyType="go" onSubmitEditing={()=>void login()}/>
          <Pressable accessibilityRole="button" accessibilityLabel={localize(String(show?'إخفاء كلمة المرور':'إظهار كلمة المرور'))} onPress={()=>setShow(!show)} style={s.eye}><Ionicons name={show?'eye-off-outline':'eye-outline'} size={22} color={colors.muted2}/></Pressable>
        </View>
        <Btn label={!ready?'جارٍ استعادة الجلسة…':busy?'جارٍ تسجيل الدخول…':'تسجيل الدخول'} disabled={busy||!ready} onPress={()=>void login()} style={{marginTop:18}}/>
        <Pressable accessibilityRole="link" onPress={()=>void openSite('/customer/auth?reset=1')} style={s.link}><T w="bold" style={s.linkText}>نسيت كلمة المرور؟</T></Pressable>
        <Btn label="إنشاء حساب على الموقع الرسمي" variant="outline" onPress={()=>void openSite('/customer/auth')}/>
        <T style={s.small}>{Platform.OS==='web'?'معاينة الويب تحتفظ بالجلسة أثناء تشغيل الصفحة فقط.':'تُحفظ الجلسة في التخزين الآمن للجهاز، دون حفظ كلمة المرور.'}</T>
      </View> : <>
        {loading ? <View accessibilityLabel={localize(String("جارٍ تحميل الاشتراك"))} style={s.panel}>{[0,1,2].map(i=><View key={i} style={{height:46,backgroundColor:colors.bg2,borderRadius:8,marginBottom:12}}/>)}</View> : profile ? <>
          <View style={s.panel}>
            <T literal w="black" style={s.name}>{profile.account.fullName}</T><T literal style={[s.intro,{writingDirection:'ltr'}]}>{profile.account.email}</T>
            <Detail label="رقم الهاتف" value={profile.account.phone}/>
          </View>
          <View style={s.panel}>
            <T w="black" style={s.section}>اشتراكك</T>
            {profile.subscription ? <>
              <T w="bold" style={s.package}>{profile.subscription.packageLabel||profile.subscription.program||'اشتراك مرتبط بحسابك'}</T>
              <Detail label="تفعيل الاشتراك" value={profile.subscription.isActive?'مفعّل حسب السجل':'غير مفعّل حسب السجل'}/>
              <Detail label="تاريخ البداية" value={profile.subscription.startDate}/><Detail label="تاريخ النهاية" value={profile.subscription.endDate}/>
              <Detail label="الوجبات يوميًا" value={profile.subscription.mealsPerDay}/><Detail label="السناك يوميًا" value={profile.subscription.snacksPerDay}/>
              <Detail label="موعد التوصيل" value={profile.subscription.deliveryTime}/><Detail label="عنوان التوصيل" value={profile.subscription.address}/>
              <Detail label="الحساسية المسجلة" value={profile.subscription.allergies?.map(localize).join(uiLanguage()==='ar'?'، ':', ')}/>
            </> : <T style={s.intro}>لا يوجد اشتراك مرتبط بهذا الحساب. تواصل مع الأخصائية لربطه.</T>}
          </View>
          {profile.subscription && <>
            <SubscriberDay key={session.accountId} customerId={profile.subscription.id} token={session.token} skippedDates={profile.subscription.skippedDates}/>
            <View style={s.panel}>
              <T w="black" style={s.section}>الأيام والولاء</T>
              <Detail label="الأيام المتخطّاة" value={profile.subscription.skippedDates?.length ? profile.subscription.skippedDates.join('، ') : 'لا توجد أيام متخطّاة'}/>
              <Detail label="نقاط الولاء" value={profile.subscription.loyaltyPoints}/>
              <Detail label="رصيد الولاء (ر.ق)" value={profile.subscription.loyaltyCredit}/>
              <Detail label="كود الإحالة" value={profile.subscription.referralCode}/>
            </View>
          </>}
        </> : null}
        <Btn label="تحديث بيانات الاشتراك" variant="outline" disabled={loading||busy} onPress={()=>void load()}/>
        <Btn label={busy?'جارٍ تسجيل الخروج…':'تسجيل الخروج'} variant="outline" disabled={busy} onPress={()=>void logout()}/>
      </>}
      {session && <Btn label="قائمة الوجبات وخدمات المشترك" onPress={()=>router.push('/menu')}/>}
      <SmartPlanEntry/>
      <Btn label="تتبّع طلبك" variant="outline" onPress={()=>router.push('/order-tracking')}/>
      <Btn label="حاسبة السعرات والماكروز" variant="outline" onPress={()=>router.push('/calorie-calculator')}/>
      {session ? <Btn label="إدارة اشتراكي على الموقع الرسمي" variant="outline" onPress={()=>void openSite('/customer/profile')}/> : null}
      <Pressable accessibilityRole="link" style={s.link} onPress={()=>void Linking.openURL(`https://wa.me/${phone}`).catch(()=>setError('تعذّر فتح واتساب.'))}><Ionicons name="logo-whatsapp" size={21} color={colors.muted2}/><T w="bold" style={s.linkText}>تواصل مع الأخصائية</T></Pressable>
      <View style={s.panel}>
        <T w="black" style={s.section}>المساعدة والمعلومات</T>
        {[
          ['how-to-subscribe', 'طريقة الاشتراك'],
          ['about', 'عن أدرينالين'],
          ['contact', 'تواصل معنا'],
        ].map(([page,label])=><Pressable key={page} accessibilityRole="button" onPress={()=>router.push(`/information/${page}`)} style={s.link}><T style={s.linkText}>{label}</T><Ionicons name={uiLanguage()==='ar'?'chevron-back':'chevron-forward'} size={16} color={colors.cyanDark}/></Pressable>)}
        <T style={s.small}>السياسات التالية تُفتح على الموقع الرسمي.</T>
        {[
          ['/privacy', 'سياسة الخصوصية'],
          ['/terms', 'الشروط والأحكام'],
        ].map(([path,label])=><Pressable key={path} accessibilityRole="link" onPress={()=>void openSite(path)} style={s.link}><T style={s.linkText}>{label}</T><Ionicons name="open-outline" size={16} color={colors.cyanDark}/></Pressable>)}
      </View>
      <Pressable accessibilityRole="button" style={s.link} onPress={()=>router.push('/admin')}><Ionicons name="settings-outline" size={20} color={colors.muted2}/><T style={s.linkText}>مدخل الطاقم — لوحة التحكم</T></Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}
function Detail({label,value}:{label:string;value:unknown}) {
  useUILanguage();
  return <View style={s.detail}><T style={{color:colors.muted2,flex:1}}>{label}</T><T w="semibold" style={{flex:1,color:colors.navy2}}>{value===undefined||value===null||value===''?'غير مسجّل':String(value)}</T></View>;
}
const s=StyleSheet.create({
  page:{padding:20,gap:16,width:'100%',maxWidth:650,alignSelf:'center'},logo:{width:195,height:48,alignSelf:'center',marginBottom:10},
  title:{fontSize:28,lineHeight:40,color:colors.navy2},intro:{fontSize:14,lineHeight:24,color:colors.muted2},
  panel:{padding:20,borderRadius:16,backgroundColor:colors.card},label:{fontSize:14,color:colors.navy2,marginBottom:8},
  input:{minHeight:50,borderWidth:1,borderColor:colors.line,borderRadius:12,paddingHorizontal:14,fontFamily:fonts.regular,fontSize:16,color:colors.navy2,textAlign:'left',writingDirection:'ltr',marginBottom:16,backgroundColor:colors.bg},
  password:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:colors.line,borderRadius:12,backgroundColor:colors.bg},
  eye:{width:48,height:50,alignItems:'center',justifyContent:'center'},link:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  linkText:{color:colors.cyanDark,fontSize:14},small:{fontSize:12,lineHeight:21,color:colors.muted2},
  section:{fontSize:19,color:colors.navy2,marginBottom:8},name:{fontSize:22,color:colors.navy2},package:{fontSize:16,color:colors.cyanDark,marginBottom:12},
  detail:{flexDirection:'row',gap:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.line},
  notice:{flexDirection:'row',gap:10,padding:16,backgroundColor:colors.cyanSoft,borderRadius:12},
});
