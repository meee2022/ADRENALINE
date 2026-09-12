import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translateUI } from './uiTranslations';

type Language = 'ar' | 'en';
const key = 'adrenaline.content-language.v1';
let state = { language: 'ar' as Language, ready: false, error: false };
const listeners = new Set<() => void>();
let hydration: Promise<void> | undefined;
let writes = Promise.resolve();
function publish(next: typeof state) { state = next; listeners.forEach(fn => fn()); }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => state;
function hydrate() {
  hydration ??= AsyncStorage.getItem(key).then(value => {
    publish({ language: value === 'en' ? 'en' : 'ar', ready: true, error: false });
  }).catch(() => publish({ ...state, ready: true, error: true }));
}
async function change(language: Language) {
  if (!state.ready) return;
  publish({ ...state, language });
  writes = writes.catch(() => {}).then(() => AsyncStorage.setItem(key, language));
  try { await writes; if (state.language === language) publish({ ...state, error: false }); }
  catch { if (state.language === language) publish({ ...state, error: true }); }
}
export const translate = (value: string) => translateUI(value, state.language);
export const contentLanguage = () => state.language;
export function mealAllowance(meals: number, snacks: number, perDay = false) {
  return state.language === 'ar' ? `${meals} وجبات + ${snacks} سناك${perDay ? ' يوميًا' : ''}`
    : `${meals} ${meals === 1 ? 'meal' : 'meals'} + ${snacks} ${snacks === 1 ? 'snack' : 'snacks'}${perDay ? ' per day' : ''}`;
}
export function subscriptionMessage(name: string, duration: string, option?: { mealsCount: number; snacksCount: number; priceQAR?: number }) {
  if (state.language === 'en') return `Hello!\nI would like to subscribe to ${name} (${translate(duration)}).${option ? `\n${mealAllowance(option.mealsCount, option.snacksCount)}${option.priceQAR ? `\nPrice: ${option.priceQAR} QAR` : ''}` : ''}\nPlease contact me to complete my subscription.`;
  return `السلام عليكم\nأرغب في الاشتراك في ${name} (${duration})${option ? `\n${mealAllowance(option.mealsCount, option.snacksCount)}${option.priceQAR ? `\nالسعر: ${option.priceQAR} ر.ق` : ''}` : ''}\nأرجو التواصل معي لإتمام الاشتراك.`;
}
export function localizedField(record: { nameAr?: string; nameEn?: string; descriptionAr?: string; descriptionEn?: string } | null | undefined, field: 'name' | 'description' = 'name') {
  const ar = record?.[`${field}Ar`] || '';
  return state.language === 'en' ? record?.[`${field}En`] || translate(ar) : ar || record?.[`${field}En`] || '';
}
// Shared preference; changing language never remounts subscriber drafts.
export function useContentLanguage() {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(hydrate, []);
  return { ...current, change, tr: translate, t: (ar: string, en: string) => current.language === 'ar' ? ar : en };
}
