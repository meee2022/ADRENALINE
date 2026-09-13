import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { appDestination } from '@/appLinks';
import { translate } from '@/useContentLanguage';

/** Order updates show as a banner with sound even while the app is open (the default is silent in the foreground). */
if(Platform.OS!=='web'){
  Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
}

export const ORDERS_CHANNEL='orders';
/** Android: the channel must exist before the first push, and its importance is fixed when it is first created. */
export async function ensureOrdersChannel(){
  if(Platform.OS!=='android')return;
  await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL,{name:translate('طلباتك'),importance:Notifications.AndroidImportance.HIGH});
}
export function NotificationRouter(){
  const router=useRouter();
  useEffect(()=>{
    if(Platform.OS==='web')return;
    void ensureOrdersChannel().catch(()=>{});
    let alive=true;
    const open=(response:Notifications.NotificationResponse|null)=>{
      if(!alive||!response)return;
      const url=response.notification.request.content.data?.url;
      const destination=typeof url==='string'?appDestination(url):null;
      if(destination)router.push(destination as any);
      void Notifications.clearLastNotificationResponseAsync();
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const subscription=Notifications.addNotificationResponseReceivedListener(open);
    return()=>{alive=false;subscription.remove();};
  },[router]);
  return null;
}
