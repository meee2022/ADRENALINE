/** Runtime-only: no passwords or tokens in URLs, logs, or plain storage. */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
export type CustomerSession = { accountId: string; token: string };
const KEY='adrenaline.customer-session.v1';
const Context = createContext<{session:CustomerSession|null;ready:boolean;setSession:(s:CustomerSession|null)=>Promise<void>}>({session:null,ready:false,setSession:async()=>{}});
export function CustomerSessionProvider({children}:{children:React.ReactNode}) {
  const [session,updateSession]=useState<CustomerSession|null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let alive=true;
    void (async()=>{
      try {
        if(Platform.OS!=='web'){
          const raw=await SecureStore.getItemAsync(KEY);
          if(raw){const value=JSON.parse(raw);if(typeof value?.accountId==='string'&&value.accountId&&typeof value?.token==='string'&&value.token){if(alive)updateSession(value);}}
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
  return <Context.Provider value={{session,ready,setSession}}>{children}</Context.Provider>;
}
export const useCustomerSession=()=>useContext(Context);
