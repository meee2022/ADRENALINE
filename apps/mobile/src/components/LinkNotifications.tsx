/**
 * ربط هاتف المشترك باشتراكه بكود الأخصائية، ثم تفعيل إشعارات الطلبات.
 * الكود وحده يثبت أن الهاتف لصاحب الاشتراك (يصله على واتساب الأخصائية)، فلا ربط برقم الهاتف.
 * يظهر فقط حين تُفعَّل الإشعارات (extra.subscriberPushEnabled).
 */
import React, { useState } from 'react';
import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';
import { TextInput } from '@/components/LocalizedTextInput';
import { api, convex } from '@/api';
import { useCustomerSession } from '@/customerSession';
import { colors, fonts } from '@/theme';
import { Btn, T } from './ui';
import { NotificationSettings } from './NotificationSettings';
import { translate as localize } from '@/useContentLanguage';

/** رسائل الأعمال تصل من الخادم في ConvexError.data. */
const serverMessage = (e: unknown) => { const d = (e as any)?.data; return typeof d === 'string' && d ? d : ''; };

export function LinkNotifications() {
  const { ready, linked, setLinked } = useCustomerSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!(Constants.expoConfig?.extra as any)?.subscriberPushEnabled || !ready) return null;

  const link = async () => {
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length !== 8) { setError('الكود ثمانية أحرف وأرقام. اكتبه كما وصلك من الأخصائية.'); return; }
    setBusy(true); setError('');
    try {
      const r: any = await convex.mutation(api.mobileLink.redeem, { code: clean });
      await setLinked({ customerId: String(r.customerId), token: String(r.token), name: String(r.fullName || '') });
      setCode('');
    } catch (e) {
      setError(serverMessage(e) || 'تعذّر الربط. تحقق من الاتصال وحاول مرة أخرى.');
    } finally { setBusy(false); }
  };

  const unlink = async () => {
    if (!linked) return;
    setBusy(true); setError('');
    try { await convex.mutation(api.mobilePush.unregister, { customerId: linked.customerId, sessionToken: linked.token }); }
    catch { /* قد تكون الجلسة انتهت؛ مسح الربط من الجهاز يكفي */ }
    try { await setLinked(null); } finally { setBusy(false); }
  };

  return <View style={s.panel}>
    <T w="black" style={s.title}>استقبل إشعارات طلباتك</T>
    {!linked ? <>
      <T style={s.copy}>اطلب كود الربط من الأخصائية على واتساب، ثم اكتبه هنا لتصلك إشعارات اعتماد خطتك وخروج السائق والتوصيل.</T>
      <TextInput accessibilityLabel={localize('كود الربط')} value={code} onChangeText={v => { setCode(v); setError(''); }} editable={!busy}
        autoCapitalize="characters" autoCorrect={false} maxLength={9} placeholder="ABCD-2345" placeholderTextColor={colors.muted2}
        style={s.input} returnKeyType="done" onSubmitEditing={() => void link()} />
      <Btn label={busy ? 'جارٍ الربط…' : 'ربط هاتفي باشتراكي'} disabled={busy} onPress={() => void link()} />
    </> : <>
      <T style={s.copy}>{`هاتفك مربوط باشتراك ${linked.name || 'المشترك'}.`}</T>
      <NotificationSettings customerId={linked.customerId} token={linked.token} />
      <Btn label="إلغاء الربط" variant="outline" disabled={busy} onPress={() => void unlink()} />
    </>}
    {!!error && <T accessibilityRole="alert" style={s.copy}>{error}</T>}
  </View>;
}

const s = StyleSheet.create({
  panel: { width: '100%', gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.cyanSoft },
  title: { fontSize: 18, color: colors.navy2 },
  copy: { fontSize: 13, lineHeight: 23, color: colors.muted2 },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, color: colors.navy2, fontFamily: fonts.bold, letterSpacing: 2, textAlign: 'left', writingDirection: 'ltr' },
});
