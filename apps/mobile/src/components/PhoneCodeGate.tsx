import { translate as localize, useContentLanguage as useUILanguage } from '@/useContentLanguage';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput } from '@/components/LocalizedTextInput';
import { api, convex } from '@/api';
import { colors, fonts } from '@/theme';
import { Btn, T } from './ui';

export type VerifiedSubscriber = { customerId: string; token: string; name: string; phone: string };

/**
 * Phone → 6-digit code (WhatsApp/SMS) → subscriber session. Used only when the restaurant
 * has switched the check on; otherwise screens keep the plain phone gate.
 */
export function PhoneCodeGate({ title, copy, onVerified }: { title: string; copy: string; onVerified: (s: VerifiedSubscriber) => void }) {
  useUILanguage();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [choices, setChoices] = useState<{ _id: string; fullName: string; program: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const lock = useRef(false);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  const digits = () => phone.replace(/\D/g, '');
  const errText = (e: any, fallback: string) => (typeof e?.data === 'string' && e.data.trim()) || fallback;

  const request = async () => {
    if (lock.current) return;
    if (digits().length < 8) { setError('أدخل رقم هاتف صحيحًا.'); return; }
    lock.current = true; setBusy(true); setError(''); setMsg('');
    try {
      const r: any = await convex.mutation(api.phoneOtp.request, { phone: digits() });
      setMsg(r?.message || ''); setStep('code'); setCode(''); setChoices(null); setCooldown(60);
    } catch (e: any) { setError(errText(e, 'تعذّر إرسال الكود. تحقق من الاتصال وحاول مرة أخرى.')); }
    finally { lock.current = false; setBusy(false); }
  };
  const verify = async (customerId?: string) => {
    if (lock.current) return;
    if (code.replace(/\D/g, '').length !== 6) { setError('اكتب الكود المكوّن من 6 أرقام.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const r: any = await convex.mutation(api.phoneOtp.verify, { phone: digits(), code: code.replace(/\D/g, ''), customerId: customerId as any });
      if (r?.needsChoice) { setChoices(r.subscribers || []); return; }
      onVerified({ customerId: r.customerId, token: r.token, name: r.name || '', phone: r.phone || digits() });
    } catch (e: any) { setError(errText(e, 'الكود غير صحيح.')); }
    finally { lock.current = false; setBusy(false); }
  };

  return <View style={s.panel}>
    <T w="black" style={s.title}>{title}</T>
    <T style={s.copy}>{step === 'phone' ? copy : 'أرسلنا كوداً من 6 أرقام إلى رقمك. اكتبه هنا.'}</T>
    {step === 'phone' ? <>
      <TextInput accessibilityLabel={localize(String('رقم الهاتف'))} keyboardType="phone-pad" autoComplete="tel" value={phone} editable={!busy}
        onChangeText={v => { setPhone(v); setError(''); }} onSubmitEditing={() => void request()} placeholder={localize(String('رقم الهاتف'))} placeholderTextColor={colors.muted2} style={s.input}/>
      <Btn label={busy ? 'جارٍ الإرسال…' : 'أرسل لي الكود'} disabled={busy} onPress={() => void request()}/>
    </> : <>
      {!!msg && <T style={s.copy}>{msg}</T>}
      {!choices ? <>
        <TextInput accessibilityLabel={localize(String('كود التحقق'))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" value={code} editable={!busy} maxLength={6}
          onChangeText={v => { setCode(v); setError(''); }} onSubmitEditing={() => void verify()} placeholder="123456" placeholderTextColor={colors.muted2} style={[s.input, s.code]}/>
        <Btn label={busy ? 'جارٍ التحقق…' : 'تأكيد'} disabled={busy} onPress={() => void verify()}/>
      </> : <>
        <T w="bold">اختر صاحب الاشتراك</T>
        {choices.map(c => <Btn key={c._id} variant="outline" disabled={busy} label={`${c.fullName || 'مشترك'} — ${c.program || 'اشتراك'}`} onPress={() => void verify(c._id)}/>)}
      </>}
      <View style={s.row}>
        <Btn variant="outline" label="تغيير الرقم" disabled={busy} onPress={() => { setStep('phone'); setChoices(null); setError(''); setMsg(''); }}/>
        <Btn variant="outline" label={cooldown > 0 ? `إعادة الإرسال بعد ${cooldown} ث` : 'إعادة إرسال الكود'} disabled={busy || cooldown > 0} onPress={() => void request()}/>
      </View>
    </>}
    {!!error && <T accessibilityRole="alert" style={s.err}>{error}</T>}
  </View>;
}
const s = StyleSheet.create({
  panel: { width: '100%', gap: 12, marginTop: 20, padding: 16, borderRadius: 16, backgroundColor: colors.cyanSoft },
  title: { fontSize: 20, color: colors.navy2 },
  copy: { fontSize: 13, lineHeight: 23, color: colors.muted2 },
  err: { fontSize: 13, lineHeight: 22, color: '#b91c1c' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, color: colors.navy2, fontFamily: fonts.regular, textAlign: 'left', writingDirection: 'ltr' },
  code: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
});
