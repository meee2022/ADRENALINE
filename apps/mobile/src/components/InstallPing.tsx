/**
 * عدّاد التنزيلات: يخبر الخادم مرة عند الفتح أن هذا الجهاز عليه التطبيق. المعرّف
 * عشوائي يتولّد هنا ويُحفظ في التخزين الآمن — لا معرّف جهاز ولا بيانات شخصية.
 * أي فشل هنا صامت؛ العدّاد لا يعطّل التطبيق أبداً.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { api, convex } from '@/api';
import { useCustomerSession } from '@/customerSession';

const KEY = 'adrenaline.install-id.v1';

async function installId(): Promise<string> {
  const saved = await SecureStore.getItemAsync(KEY);
  if (saved && /^[a-f0-9]{32}$/.test(saved)) return saved;
  const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  await SecureStore.setItemAsync(KEY, id);
  return id;
}

export function InstallPing() {
  const { session, linked, ready } = useCustomerSession();
  const signedIn = !!session || !!linked;
  useEffect(() => {
    if (!ready || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
    void (async () => {
      try {
        await convex.mutation(api.appInstalls.ping, {
          installId: await installId(), platform: Platform.OS,
          appVersion: String(Constants.expoConfig?.version || ''), signedIn,
        });
      } catch { /* صامت */ }
    })();
  }, [ready, signedIn]);
  return null;
}
