import { translate as localize, useContentLanguage as useUILanguage } from '@/useContentLanguage';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TextInput } from '@/components/LocalizedTextInput';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, convex } from '@/api';
import { Btn, T } from '@/components/ui';
import { colors, fonts } from '@/theme';
import { useContentLanguage } from '@/useContentLanguage';
import { appDestination } from '@/appLinks';

type Order = { _id: string; orderNumber: string; status: string; totalMeals: number; createdAt: number };
const labels: Record<string, [string,string]> = {
  pending: ['بانتظار المراجعة','Awaiting review'], confirmed: ['تم التأكيد','Confirmed'],
  active: ['الخطة قيد التنفيذ','Plan active'], completed: ['الطلب مكتمل','Order completed'], cancelled: ['الطلب ملغي','Order cancelled'],
};
export default function OrderTracking() {
  useUILanguage();
  const router = useRouter(), insets = useSafeAreaInsets();
  const { language, change, ready, t } = useContentLanguage();
  const [phone,setPhone] = useState(''), [number,setNumber] = useState('');
  const [trackingLink,setTrackingLink] = useState(''), [trackingError,setTrackingError] = useState(false);
  const [orders,setOrders] = useState<Order[] | null>(null), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const request = useRef(0);
  useEffect(()=>()=>{request.current++;},[]);
  const text = { textAlign: language === 'ar' ? 'right' as const : 'left' as const, writingDirection: language === 'ar' ? 'rtl' as const : 'ltr' as const };
  const edit = (value:string, field:'phone'|'number') => {
    request.current++; setBusy(false); setOrders(null); setError('');
    field==='phone'?setPhone(value):setNumber(value);
  };
  const search = async () => {
    const digits = phone.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g,'');
    if(digits.length<8||digits.length>15){setError('أدخل رقم هاتف صحيحًا.');return;}
    const current=++request.current;
    setBusy(true);setError('');setOrders(null);
    try {
      // Same public, limited DTOs as the official tracking page. No session created.
      const result=number.trim()
        ? await convex.query(api.customerOrders.getByOrderNumber,{orderNumber:number.trim(),phone:digits}).then(o=>o?[o]:[])
        : await convex.query(api.customerOrders.getByPhone,{phone:digits});
      if(current===request.current)setOrders(result);
    } catch {if(current===request.current)setError('تعذّر تحميل الطلبات. تحقق من اتصالك وأعد المحاولة.');}
    finally {if(current===request.current)setBusy(false);}
  };
  return <ScrollView keyboardShouldPersistTaps="handled" style={s.screen} contentContainerStyle={[s.content,{paddingTop:insets.top+20,paddingBottom:insets.bottom+28}]}>
    <View style={s.row}>
      <Btn label={t('رجوع','Back')} variant="outline" onPress={()=>router.canGoBack()?router.back():router.replace('/account')}/>
      <Btn label={language==='ar'?'English':'العربية'} variant="outline" disabled={!ready} onPress={()=>void change(language==='ar'?'en':'ar')}/>
    </View>
    <T accessibilityRole="header" w="black" style={[s.title,text]}>{t('تتبّع طلبك','Track your order')}</T>
    <T style={[s.body,text]}>{t('تابع مراجعة طلبك وتنفيذه. حالة الطلب لا تعني أن وجبات اليوم وصلت.','Follow your order review and progress. Order status does not confirm today’s meal delivery.')}</T>
    <T w="bold" style={text}>{t('رقم الهاتف المسجّل مع الطلب','Phone number registered with the order')}</T>
    <TextInput accessibilityLabel={localize(String(t('رقم الهاتف','Phone number')))} value={phone} onChangeText={v=>edit(v,'phone')} keyboardType="phone-pad" maxLength={20} style={s.input}/>
    <T w="bold" style={text}>{t('رقم الطلب — اختياري','Order number — optional')}</T>
    <TextInput accessibilityLabel={localize(String(t('رقم الطلب','Order number')))} value={number} onChangeText={v=>edit(v,'number')} autoCapitalize="characters" autoCorrect={false} maxLength={80} style={s.input}/>
    <Btn label={busy?t('جارٍ البحث…','Searching…'):t('بحث / تحديث','Search / refresh')} disabled={busy} onPress={()=>void search()}/>
    {!!error&&<T accessibilityRole="alert" style={text}>{error}</T>}
    <T accessibilityRole="header" w="bold" style={[s.status,text]}>{t('معك رابط تتبّع التوصيل؟','Have a delivery tracking link?')}</T>
    <TextInput accessibilityLabel={localize(String(t('رابط تتبّع التوصيل','Delivery tracking link')))} value={trackingLink} onChangeText={v=>{setTrackingLink(v);setTrackingError(false);}} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={1000} style={s.input}/>
    <Btn label={t('فتح تتبّع التوصيل','Open delivery tracking')} variant="outline" onPress={()=>{
      const destination=appDestination(trackingLink.trim());
      if(!destination?.startsWith('/track/')){setTrackingError(true);return;}
      setTrackingError(false);router.push(destination);
    }}/>
    {trackingError&&<T accessibilityRole="alert" style={text}>{t('ألصق رابط التتبّع المرسل من أدرينالين بصيغة /track/.','Paste the Adrenaline delivery link containing /track/.')}</T>}
    {orders?.length===0&&<T style={[s.body,text]}>{t('لا توجد طلبات مطابقة. تأكد من صيغة الهاتف المسجّلة، مع مفتاح الدولة أو بدونه.','No matching orders. Check the registered phone format, with or without the country code.')}</T>}
    {orders?.map(order=><View key={order._id} style={s.order}>
      <T w="black" selectable style={[s.number,{writingDirection:'ltr'}]}>{order.orderNumber}</T>
      <T w="bold" style={[s.status,text]}>{labels[order.status]?t(...labels[order.status]):t('حالة غير معروفة','Unknown status')}</T>
      <T style={text}>{Number.isFinite(order.createdAt)?new Date(order.createdAt).toLocaleDateString(language==='ar'?'ar-QA':'en-QA',{timeZone:'Asia/Qatar'}):'—'}</T>
      <T style={text}>{t('إجمالي الوجبات: ','Total meals: ')}{order.totalMeals}</T>
    </View>)}
  </ScrollView>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.bg},content:{paddingHorizontal:24,gap:16,width:'100%',maxWidth:650,alignSelf:'center'},
  row:{flexDirection:'row',justifyContent:'space-between',gap:12},title:{fontSize:30,lineHeight:44,color:colors.navy2},body:{fontSize:15,lineHeight:26,color:colors.navy2},
  input:{minHeight:52,borderWidth:1,borderColor:colors.muted2,borderRadius:12,padding:12,fontFamily:fonts.regular,fontSize:16,color:colors.navy2,backgroundColor:colors.card,textAlign:'left',writingDirection:'ltr'},
  order:{padding:20,gap:10,backgroundColor:colors.card,borderRadius:16},number:{fontSize:18,color:colors.navy2},status:{color:colors.cyanDark,fontSize:17},
});
