import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { appDestination } from '@/appLinks';
export function NotificationRouter(){
  const router=useRouter();
  useEffect(()=>{
    if(Platform.OS==='web')return;
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
