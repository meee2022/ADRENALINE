import { translate as localize, useContentLanguage as useUILanguage } from '@/useContentLanguage';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { TextInput } from '@/components/LocalizedTextInput';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, convex } from '@/api';
import { useCustomerSession } from '@/customerSession';
import { colors, fonts } from '@/theme';
import { Btn, T } from './ui';

export function MealRating({ mealId, mealName }: { mealId: string; mealName: string }) {
  useUILanguage();
  const { session, ready } = useCustomerSession();
  const router = useRouter();
  const [stars, setStars] = useState(0), [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [message, setMessage] = useState('');
  const lock = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; lock.current = false;
    setStars(0); setComment(''); setSent(false); setMessage(''); setBusy(false);
    return () => { generation.current++; };
  }, [mealId, session?.accountId]);
  const submit = async () => {
    if (!session || !stars || lock.current || sent) return;
    lock.current = true; setBusy(true); setMessage('');
    const current = generation.current;
    try {
      const profile = await convex.query(api.customerAuth.getProfile, { accountId: session.accountId, sessionToken: session.token });
      if (current !== generation.current) return;
      // Linked ownership is needed for the existing server duplicate check.
      if (!profile?.subscription) { setMessage('يلزم ربط حسابك باشتراكك قبل التقييم. تواصل مع الأخصائية.'); return; }
      await convex.mutation(api.ratings.create, { publicMealId: mealId, mealName, stars, comment: comment.trim() || undefined, sessionToken: session.token });
      if (current === generation.current) { setSent(true); setMessage('شكرًا لك، تم إرسال تقييمك.'); }
    } catch {
      if (current === generation.current) setMessage('لم نتمكن من تأكيد إرسال التقييم. قد تكون قيّمت الوجبة سابقًا، أو انتهت جلسة الدخول. لم نمسح تعليقك؛ تحقق من اتصالك وحسابك قبل إعادة المحاولة.');
    } finally {
      if (current === generation.current) { lock.current = false; setBusy(false); }
    }
  };
  return <View style={s.section}>
    <T accessibilityRole="header" w="bold" style={s.title}>كيف كانت الوجبة؟</T>
    {!ready ? <T>جارٍ التحقق من الحساب…</T> : !session ? <>
      <T style={s.copy}>سجّل الدخول بحسابك لكتابة تقييم. البحث برقم الهاتف وحده لا يسجّل الدخول.</T>
      <Btn label="تسجيل الدخول للتقييم" variant="outline" onPress={() => router.push('/account')} />
    </> : <>
      <T style={s.copy}>شارك تجربتك الفعلية. قد يظهر تقييمك وتعليقك واسمك المختصر لزوار المطعم؛ لا تكتب بيانات شخصية.</T>
      <View style={s.stars}>
        {[1,2,3,4,5].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityLabel={localize(String(`${n} من 5 نجوم`))} accessibilityState={{ checked: stars === n, disabled: busy || sent }} disabled={busy || sent} onPress={() => setStars(n)} style={s.star}>
          <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={30} color={colors.cyanDark} />
        </Pressable>)}
      </View>
      <T>{stars ? `${stars} من 5` : 'اختر عدد النجوم'}</T>
      <TextInput accessibilityLabel={localize(String("تعليقك على الوجبة — اختياري"))} placeholder={localize(String("تعليقك — اختياري"))} placeholderTextColor={colors.muted2} value={comment} onChangeText={setComment} editable={!busy && !sent} multiline maxLength={1000} style={s.input} />
      <Btn label={sent ? 'تم إرسال التقييم' : busy ? 'جارٍ الإرسال…' : 'إرسال التقييم'} disabled={!stars || busy || sent} onPress={() => void submit()} />
    </>}
    {!!message && <T accessibilityLiveRegion="polite" style={s.copy}>{message}</T>}
  </View>;
}
const s = StyleSheet.create({
  section: { marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.line, gap: 14 },
  title: { fontSize: 21, color: colors.navy2 }, copy: { fontSize: 14, lineHeight: 25, color: colors.navy2 },
  stars: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, star: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 110, padding: 14, borderWidth: 1, borderColor: colors.muted2, borderRadius: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.navy2, backgroundColor: colors.bg, textAlign: 'right', writingDirection: 'rtl', textAlignVertical: 'top' },
});
