import { translate as localize, useContentLanguage as useUILanguage } from '@/useContentLanguage';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput } from '@/components/LocalizedTextInput';
import { api, convex } from '@/api';
import { colors, fonts } from '@/theme';
import { Btn, T } from './ui';

export type PublicSubscriber = { _id: string; fullName?: string; phone?: string; program?: string; mealsPerDay?: number; snacksPerDay?: number; startDate?: string; endDate?: string; allergies?: string; avoid?: string };
/** Uses the same bounded public lookup as PublicMenu; never downloads all customers. */
export function SubscriberPhoneGate({ onSelect }: { onSelect: (customer: PublicSubscriber, phone: string) => void }) {
  useUILanguage();
  const [phone, setPhone] = useState('');
  const [matches, setMatches] = useState<PublicSubscriber[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const verify = async () => {
    if (lock.current) return;
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 8) { setError('أدخل رقم هاتف صحيحًا.'); return; }
    lock.current = true; setBusy(true); setError(''); setMatches(null);
    try {
      const result = await convex.query(api.customers.findPublicByPhone, { phone: normalized, restaurantKey: 'ADRENALINE' }) as PublicSubscriber[];
      if (!mounted.current) return;
      setMatches(result);
      if (result.length === 1) onSelect(result[0], normalized);
    } catch { if (mounted.current) setError('تعذّر التحقق من الرقم. تحقق من الاتصال وحاول مرة أخرى.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <View style={s.panel}>
    <T w="black" style={s.title}>وجبات اشتراكك</T>
      <T style={s.copy}>أدخل رقم هاتفك المسجّل لتختار بين الخطة اليدوية والذكية، أو تصفّح قائمة الوجبات بالأسفل.</T>
      <TextInput accessibilityLabel={localize(String("رقم هاتف المشترك"))} keyboardType="phone-pad" autoComplete="tel" value={phone} editable={!busy} onChangeText={value => { setPhone(value); setMatches(null); setError(''); }} onSubmitEditing={() => void verify()} placeholder={localize(String("رقم الهاتف"))} placeholderTextColor={colors.muted2} style={s.input}/>
      <Btn label={busy ? 'جارٍ التحقق…' : 'متابعة'} disabled={busy} onPress={() => void verify()}/>
      {matches?.length === 0 && <T accessibilityRole="alert" style={s.copy}>الرقم غير مسجّل. راجع الرقم أو تواصل مع الأخصائية لربط اشتراكك.</T>}
      {!!matches && matches.length > 1 && <>
        <T w="bold">اختر صاحب الاشتراك</T>
        {matches.map(c => <Btn key={c._id} variant="outline" label={`${c.fullName || 'مشترك'} — ${c.program || 'اشتراك'}`} onPress={() => onSelect(c, phone.replace(/\D/g, ''))}/>)}
      </>}
    {!!error && <T accessibilityRole="alert" style={s.copy}>{error}</T>}
  </View>;
}
const s = StyleSheet.create({
  panel: { width: '100%', gap: 12, marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: colors.cyanSoft },
  title: { fontSize: 20, color: colors.navy2 },
  copy: { fontSize: 13, lineHeight: 23, color: colors.muted2 },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, color: colors.navy2, fontFamily: fonts.regular, textAlign: 'left', writingDirection: 'ltr' },
});
