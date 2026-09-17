import { subscriptionMessage, mealAllowance, translate as localize, localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/** الخطط — كل الباقات (أسبوع/أسبوعان/شهر) ببطاقة ناعمة؛ الاشتراك عبر واتساب كما في الموقع. اختيار الوجبات من التطبيق لاحقاً. */
import React, { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { planArtwork } from '@/planArtwork';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from "convex/react";
import { Image } from 'expo-image';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, SITE_URL } from "@/api";
import { restaurantPhone } from '@/contact';
import { colors } from "@/theme";
import { Btn, Chip, T } from "@/components/ui";
import { PlanChoice, PlanOption, optionFingerprint, resolvePlanChoice, payablePrice } from '@/planChoice';
import { openWeb } from '@/openWeb';

const DURS = [{ id: "week", l: "أسبوع" }, { id: "two_weeks", l: "أسبوعان" }, { id: "month", l: "شهر" }] as const;

export default function Plans() {
  useUILanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const twoColumns = width >= 800;
  const cardWidth = twoColumns ? (Math.min(width, 1120) - 56) / 2 : undefined;
  const [dur, setDur] = useState<(typeof DURS)[number]["id"]>("week");
  const [selected, setSelected] = useState<Record<string, PlanChoice>>({});
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const { duration } = useLocalSearchParams<{ duration?: string }>();
  useFocusEffect(useCallback(() => {
    if (duration === 'week' || duration === 'two_weeks' || duration === 'month') {
      setDur(duration); setError(null);
    }
  }, [duration]));
  const result = useQuery(api.publicPlans.listByDuration, { duration: dur }) as any[] | undefined;
  const plans = result || [];
  const settings = useQuery(api.restaurantSettings.get, {}) as any;
  const phone = restaurantPhone(settings);
  const open = async (url: string, id: string) => {
    setError(null);
    try { await openWeb(url); } catch { setError({ id, text: 'تعذّر فتح الرابط. تحقق من الاتصال وحاول مرة أخرى.' }); }
  };
  const durLabel = DURS.find((d) => d.id === dur)!.l;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg2 }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <T w="black" style={styles.title}>اختر خطتك</T>
        <T style={styles.sub}>اختر المدة وعدد وجباتك، ثم أكمل اشتراكك بالطريقة المناسبة لك.</T>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {DURS.map((d) => <Chip key={d.id} label={d.l} active={dur === d.id} onPress={() => { setDur(d.id); setError(null); }} />)}
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={()=>router.push('/menu')} style={{minHeight:48,padding:12,justifyContent:'center'}}><T w="bold" style={{color:colors.cyanDark,textAlign:'center'}}>مشترك بالفعل؟ اختر وجباتك يدويًا أو بذكاء</T></Pressable>
      <View style={[styles.grid, twoColumns && { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' }]}>
        {plans.map((plan: any) => {
          const opts: PlanOption[] = Array.isArray(plan.options) ? plan.options : [];
          const prices = opts.map((o) => Number(o.priceQAR)).filter((n) => Number.isFinite(n) && n > 0);
          const min = prices.length ? Math.min(...prices) : 0;
          const selectionKey = `${dur}:${plan._id}`;
          const choice = selected[selectionKey];
          const option = resolvePlanChoice(opts, choice);
          const index = option ? choice.index : undefined;
          const price = Number(option?.priceQAR);
          const contact = () => void open(`https://wa.me/${phone}?text=${encodeURIComponent(subscriptionMessage(localizedField(plan), durLabel, option))}`, selectionKey);
          return (
            <View key={plan._id} style={[styles.card, cardWidth ? { width: cardWidth } : { width: '100%' }]}>
              <View style={{paddingHorizontal:16,paddingVertical:14,gap:4}}>
                <T w="black" style={{fontSize:22,color:colors.navy2}}>{localizedField(plan, 'name')}</T>
                <T style={styles.hint}>اشتراك {durLabel} · {option ? mealAllowance(option.mealsCount, option.snacksCount, true) : 'حدّد عدد وجباتك بالأسفل'}</T>
              </View>
              <Image source={planArtwork(plan)} accessibilityLabel={localize(String(`صورة ${localizedField(plan)}`))} contentFit="contain" transition={150} style={styles.photo} />
              <View style={styles.content}>
              {localizedField(plan, 'description') ? <T style={styles.description}>{localizedField(plan, 'description')}</T> : null}
              {min > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 12 }}>
                  <T w="bold" style={{ fontSize: 12, color: colors.muted }}>{option ? 'اختيارك' : 'من'}</T>
                  <T w="black" style={{ fontSize: 30, color: colors.cyanDark, fontVariant: ["tabular-nums"] }}>{option ? option.priceQAR : min}</T>
                  <T w="bold" style={{ fontSize: 13, color: colors.cyanDark }}>ر.ق / {durLabel}</T>
                </View>
              ) : null}
              <View style={{ gap: 10, marginTop: 16 }}>
                {!!opts.length && <T w="bold" style={styles.optionHeading}>عدد الوجبات يوميًا</T>}
                {opts.map((o, oi) => (
                  <Pressable key={oi} accessibilityRole="radio" accessibilityLabel={localize(String(`${localizedField(plan)}، ${o.mealsCount} وجبات و${o.snacksCount} سناك يوميًا، ${o.priceQAR} ر.ق لمدة ${durLabel}`))} accessibilityState={{checked:index===oi}} style={({pressed}) => [styles.opt, index===oi && styles.optSelected, pressed && { opacity: .8 }]}
                    onPress={() => { setSelected(prev => ({...prev,[selectionKey]:{index:oi,fingerprint:optionFingerprint(o)}})); setError(null); }}>
                    <View style={styles.optionLabel}><Ionicons name={index===oi ? 'radio-button-on' : 'radio-button-off'} size={22} color={index===oi ? colors.cyanDark : colors.muted2}/><T w="bold" style={styles.optionText}>{mealAllowance(o.mealsCount, o.snacksCount)}</T></View>
                    <T w="black" style={styles.optionPrice}>{payablePrice(o) ? `${o.priceQAR} ر.ق` : "تواصل معنا"}</T>
                  </Pressable>
                ))}
                {opts.length > 0 ? <>
                  <View style={styles.checkout}>
                    <T style={styles.hint}>{option ? 'تم تحديد اختيارك. أكمل الاشتراك بالطريقة المناسبة لك.' : 'اختر عدد الوجبات أعلاه لتفعيل طرق الاشتراك.'}</T>
                    <Btn label={payablePrice(option) ? `ادفع ${price} ر.ق مع PayLater` : 'الدفع مع PayLater'} icon={<Ionicons name="card-outline" size={20} color={colors.card}/>} disabled={!payablePrice(option)} onPress={() => void open(`${SITE_URL}/public/paylater?plan=${encodeURIComponent(String(plan._id))}&option=${index}`, selectionKey)} />
                    <Btn label="واتساب الأخصائية" variant="outline" icon={<Ionicons name="logo-whatsapp" size={20} color={colors.navy2}/>} disabled={!option} onPress={contact} />
                  </View>
                </> : <View style={styles.checkout}><Btn label="خصص باقتك عبر واتساب" icon={<Ionicons name="logo-whatsapp" size={20} color={colors.card}/>} onPress={contact} /></View>}
                {error?.id === selectionKey && <T accessibilityRole="alert" style={styles.hint}>{error.text}</T>}
              </View>
              </View>
            </View>
          );
        })}
        {result === undefined ? <View accessibilityLabel={localize(String("جارٍ تحميل الباقات"))} style={styles.loading}><View style={styles.loadingImage}/><T style={styles.hint}>نحمّل باقات {durLabel}…</T></View> : !plans.length ? <View style={styles.loading}><Ionicons name="calendar-outline" size={30} color={colors.muted2}/><T style={styles.hint}>لا توجد باقات متاحة لهذه المدة حاليًا. جرّب مدة أخرى.</T></View> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: colors.card, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.line, alignItems: 'center' },
  title: { fontSize: 30, color: colors.navy2, lineHeight: 40 },
  sub: { fontSize: 13, color: colors.muted2, marginTop: 6, lineHeight: 23, textAlign: 'center', maxWidth: 480 },
  grid: { paddingHorizontal: 20, paddingTop: 20, gap: 16, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1.7, backgroundColor: colors.cyanSoft },
  content: { padding: 16, flex: 1 },
  description: { fontSize: 13, color: colors.muted2, lineHeight: 23, marginTop: 4 },
  optionHeading: { fontSize: 13, color: colors.navy2 },
  opt: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, minHeight: 56 },
  optSelected: { backgroundColor: colors.cyanSoft, borderColor: colors.cyanDark },
  optionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  optionText: { fontSize: 14, color: colors.navy2, flexShrink: 1 },
  optionPrice: { fontSize: 15, color: colors.cyanDark, fontVariant: ['tabular-nums'] },
  checkout: { gap: 10, paddingTop: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.line },
  hint: { fontSize: 12, lineHeight: 22, color: colors.muted2 },
  loading: { width: '100%', gap: 16, padding: 16, alignItems: 'center' },
  loadingImage: { width: '100%', maxWidth: 500, height: 180, borderRadius: 16, backgroundColor: colors.line },
});
