/** Runtime-only: no passwords or tokens in URLs, logs, or plain storage. */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
export type CustomerSession = { accountId: string; token: string };
/** هاتف مربوط باشتراك بكود الأخصائية (بلا حساب بريد) — لإشعارات الطلبات فقط. */
export type LinkedSubscriber = { customerId: string; token: string; name: string };
const KEY='adrenaline.customer-session.v1';
const LINK_KEY='adrenaline.linked-subscriber.v1';
const Context = createContext<{session:CustomerSession|null;ready:boolean;setSession:(s:CustomerSession|null)=>Promise<void>;linked:LinkedSubscriber|null;setLinked:(v:LinkedSubscriber|null)=>Promise<void>}>({session:null,ready:false,setSession:async()=>{},linked:null,setLinked:async()=>{}});
export function CustomerSessionProvider({children}:{children:React.ReactNode}) {
  const [session,updateSession]=useState<CustomerSession|null>(null);
  const [linked,updateLinked]=useState<LinkedSubscriber|null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let alive=true;
    void (async()=>{
      try {
        if(Platform.OS!=='web'){
          const raw=await SecureStore.getItemAsync(KEY);
          if(raw){const value=JSON.parse(raw);if(typeof value?.accountId==='string'&&value.accountId&&typeof value?.token==='string'&&value.token){if(alive)updateSession(value);}}
          const rawLink=await SecureStore.getItemAsync(LINK_KEY);
          if(rawLink){const l=JSON.parse(rawLink);if(typeof l?.customerId==='string'&&l.customerId&&typeof l?.token==='string'&&l.token){if(alive)updateLinked({customerId:l.customerId,token:l.token,name:typeof l?.name==='string'?l.name:''});}}
        }
      } catch { /* No token fallback to unencrypted storage. Login remains available. */ }
      finally {if(alive)setReady(true);}
    })();
    return()=>{alive=false;};
  },[]);
  const setSession=async(value:CustomerSession|null)=>{
    if(!ready)throw new Error('Session storage not ready');
    if(Platform.OS!=='web'){
      if(value)await SecureStore.setItemAsync(KEY,JSON.stringify(value),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
      else await SecureStore.deleteItemAsync(KEY);
    }
    updateSession(value);
  };
  const setLinked=async(value:LinkedSubscriber|null)=>{
    if(!ready)throw new Error('Session storage not ready');
    if(Platform.OS!=='web'){
      if(value)await SecureStore.setItemAsync(LINK_KEY,JSON.stringify(value),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
      else await SecureStore.deleteItemAsync(LINK_KEY);
    }
    updateLinked(value);
  };
  return <Context.Provider value={{session,ready,setSession,linked,setLinked}}>{children}</Context.Provider>;
}
export const useCustomerSession=()=>useContext(Context);
