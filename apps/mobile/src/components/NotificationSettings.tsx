import React,{useState} from 'react';
import { Platform,View } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api,convex } from '@/api';
import { useCustomerSession } from '@/customerSession';
import { Btn,T } from './ui';
import { translate } from '@/useContentLanguage';
import { ensureOrdersChannel } from './NotificationRouter';
export function NotificationSettings({customerId}:{customerId:string}){
  const {session}=useCustomerSession();const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const enable=async()=>{
    const extra=Constants.expoConfig?.extra as any;
    if(!extra?.subscriberPushEnabled){setMessage('خدمة إشعارات الجوال تنتظر نشر الخادم وإعداد مفاتيح Android وiOS.');return;}
    if(Platform.OS==='web'||!Device.isDevice){setMessage('فعّل الإشعارات من نسخة التطبيق المثبتة على هاتفك.');return;}
    const projectId=Constants.easConfig?.projectId||extra?.eas?.projectId;
    if(!projectId||!session){setMessage('إعداد الإشعارات أو جلسة الحساب غير مكتمل.');return;}
    setBusy(true);
    try{
      await ensureOrdersChannel();
      const permission=await Notifications.requestPermissionsAsync();
      if(permission.status!=='granted'){setMessage('الإشعارات غير مسموحة؛ يمكنك تفعيلها من إعدادات الهاتف.');return;}
      const push=await Notifications.getExpoPushTokenAsync({projectId});
      await convex.mutation(api.mobilePush.register,{customerId,sessionToken:session.token,token:push.data});
      setMessage('تم تسجيل الجهاز لاستقبال تحديثات طلباتك.');
    }catch{setMessage('تعذّر تفعيل الإشعارات. حاول لاحقًا.');}finally{setBusy(false);}
  };
  return <View style={{gap:10}}><Btn label="تفعيل إشعارات الطلبات" disabled={busy} variant="outline" onPress={()=>void enable()}/>{!!message&&<T accessibilityRole="alert">{message}</T>}</View>;
}
