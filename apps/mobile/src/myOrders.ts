/**
 * طلبات هذا الجهاز: توكن التتبع السرّي لكل طلب أرسله المشترك من هنا (أو استعاده
 * برقم الطلب + الهاتف). في التخزين الآمن فقط، ولا يُعرض التوكن في أي شاشة.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type SavedOrder = { token: string; orderNumber: string; createdAt: number };
const KEY = 'adrenaline.my-orders.v1';
const MAX = 12; // حدّ SecureStore ~2KB

export async function loadMyOrders(): Promise<SavedOrder[]> {
  if (Platform.OS === 'web') return [];
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((o: any) => typeof o?.token === 'string' && o.token) : [];
  } catch { return []; }
}

export async function rememberOrders(add: SavedOrder[]): Promise<SavedOrder[]> {
  const current = await loadMyOrders();
  const byToken = new Map(current.map(o => [o.token, o]));
  for (const o of add) if (o?.token) byToken.set(o.token, o);
  const next = [...byToken.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX);
  if (Platform.OS !== 'web') {
    try { await SecureStore.setItemAsync(KEY, JSON.stringify(next), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); } catch { /* يبقى الاستعادة برقم الطلب متاحاً */ }
  }
  return next;
}
