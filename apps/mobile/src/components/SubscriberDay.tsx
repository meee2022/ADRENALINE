import { translate as localize, contentLanguage as uiLanguage, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/** Read-only order viewer. Selection and fulfillment rules remain server-owned. */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { convex, api } from '@/api';
import { colors } from '@/theme';
import { Btn, T } from './ui';
import { Image } from 'expo-image';


type Plan = { status?: string; items?: Array<{ isOff?: boolean; publicMealId?: string; mealId?: string; menuItemId?: string; mealNameAr?: string; mealNameEn?: string; quantity?: number }> };
function qatarToday() {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function SubscriberDay({ customerId, token, skippedDates = [] }: { customerId: string; token: string; skippedDates?: string[] }) {
  useUILanguage();
  const [date, setDate] = useState(qatarToday);
  const [result, setResult] = useState<{ key: string; plan: Plan | null } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const key = `${customerId}:${date}:${retry}`;
  useEffect(() => {
    let active = true;
    setResult(null); setError('');
    convex.query(api.dailyPlans.getByDateAndCustomer, { customerId, date, sessionToken: token })
      .then(plan => { if (active) setResult({ key, plan }); })
      .catch(() => { if (active) setError('تعذّر تحميل وجبات اليوم. تحقق من الاتصال أو أعد تسجيل الدخول.'); });
    return () => { active = false; };
  }, [customerId, token, date, retry, key]);
  const plan = result?.key === key ? result.plan : null;
  // الصور من Convex وحده (نفس مصدر الموقع) — لا صور مدموجة في الكود.
  const [images, setImages] = useState<Record<string, string>>({});
  const items = Array.isArray(plan?.items) ? plan.items.filter(i => i && !i.isOff && (i.publicMealId || i.mealId || i.menuItemId || i.mealNameAr || i.mealNameEn)) : [];
  const mealIds = items.map(i => String(i.publicMealId || i.mealId || i.menuItemId || '')).filter(Boolean);
  const idsKey = mealIds.join(',');
  useEffect(() => {
    let active = true;
    if (!idsKey) { setImages({}); return; }
    convex.query(api.publicMeals.imagesByIds, { ids: idsKey.split(',') })
      .then((m: Record<string, string>) => { if (active) setImages(m || {}); })
      .catch(() => { if (active) setImages({}); });
    return () => { active = false; };
  }, [idsKey]);
  const status = ({ DRAFT: 'مسودة', CONFIRMED: 'مؤكد', PREPARED: 'جاهز للتوصيل', OUT_FOR_DELIVERY:'خرج مع السائق', FAILED:'تعذّر التوصيل', CANCELLED:'ملغي', DELIVERED: 'تم التسليم' } as Record<string, string>)[plan?.status || ''] || 'حالة غير محددة';
  return <View style={s.panel}>
    <T w="black" style={s.heading}>وجباتك المسجّلة</T>
    <T style={s.hint}>وجباتك المسجّلة وحالة التوصيل. الخطة المعتمدة لا تحتاج اختيارًا جديدًا.</T>
    <View style={s.dates}>
      <Btn label="السابق" variant="outline" onPress={() => setDate(d => shiftDate(d, -1))} style={s.nav}/>
      <T w="bold" style={s.date}>{date}</T>
      <Btn label="التالي" variant="outline" onPress={() => setDate(d => shiftDate(d, 1))} style={s.nav}/>
    </View>
    <Btn label="العودة إلى اليوم" variant="outline" onPress={() => setDate(qatarToday())}/>
    {skippedDates.includes(date) && <T w="bold" style={s.hint}>هذا اليوم مسجّل ضمن الأيام المتخطّاة.</T>}
    {error ? <><T accessibilityRole="alert" style={s.hint}>{error}</T><Btn label="إعادة المحاولة" onPress={() => setRetry(n => n + 1)}/></> : result?.key !== key ? <ActivityIndicator accessibilityLabel={localize(String("جارٍ تحميل الوجبات"))} color={colors.cyanDark} style={{ margin: 24 }}/> : !plan ? <T style={s.empty}>لا يوجد طلب مسجّل لهذا التاريخ.</T> : <>
      <T w="bold" style={s.status}>{status}</T>
      {items.length ? items.map((item, index) => <View key={index} style={s.row}>
        {!!images[item.publicMealId||item.mealId||item.menuItemId||'']&&<Image source={{uri:images[item.publicMealId||item.mealId||item.menuItemId||'']}} cachePolicy="disk" contentFit="cover" style={{width:72,height:72,borderRadius:12}} accessibilityLabel={(uiLanguage()==='en' ? item.mealNameEn || item.mealNameAr : item.mealNameAr || item.mealNameEn) || localize('وجبة اليوم')}/>}
        <T literal style={{ flex: 1 }}>{(uiLanguage()==='en' ? item.mealNameEn || item.mealNameAr : item.mealNameAr || item.mealNameEn) || localize(`وجبة مسجّلة ${index + 1}`)}</T>
        {typeof item.quantity === 'number' && <T w="bold" style={{ color: colors.cyanDark }}>× {item.quantity}</T>}
      </View>) : <T style={s.empty}>لا توجد تفاصيل وجبات متاحة في هذا الطلب.</T>}
    </>}
  </View>;
}
const s = StyleSheet.create({
  panel: { padding: 20, borderRadius: 16, backgroundColor: colors.card, gap: 12 },
  heading: { fontSize: 20, color: colors.navy2 },
  hint: { fontSize: 13, lineHeight: 23, color: colors.muted2 },
  dates: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nav: { paddingHorizontal: 14, height: 44 },
  date: { flex: 1, minWidth: 104, textAlign: 'center', color: colors.navy2, writingDirection: 'ltr' },
  empty: { paddingVertical: 20, color: colors.muted2, lineHeight: 24 },
  status: { alignSelf: 'flex-start', padding: 10, borderRadius: 12, backgroundColor: colors.cyanSoft, color: colors.cyanDark },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
});
