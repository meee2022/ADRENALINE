/**
 * «طلباتي وخطتي المعتمدة» — قراءة فقط. الطلب يظهر تلقائياً على الجهاز الذي أُرسل
 * منه، ولصاحب الحساب المسجَّل على أي جهاز، ويُستعاد برقم الطلب + الهاتف.
 * بعد الاعتماد يُعرض الجدول الفعلي من خطط المطبخ (نفس ما يُوصَّل)، مباشرةً (Convex حي).
 */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, convex } from '@/api';
import { Btn, T } from '@/components/ui';
import { TextInput } from '@/components/LocalizedTextInput';
import { colors, fonts } from '@/theme';
import { useContentLanguage } from '@/useContentLanguage';
import { useCustomerSession } from '@/customerSession';
import { loadMyOrders, rememberOrders, type SavedOrder } from '@/myOrders';
import { mealImageSources } from '@/mealImage';

type Tr = (ar: string, en: string) => string;
const STATUS: Record<string, [string, string, string]> = {
  pending: ['بانتظار مراجعة الأخصائية', 'Awaiting nutritionist review', colors.amber],
  confirmed: ['معتمد من الأخصائية', 'Approved by the nutritionist', '#1E9E5A'],
  active: ['الخطة قيد التنفيذ', 'Plan in progress', '#1E9E5A'],
  completed: ['اكتمل', 'Completed', colors.muted2],
  cancelled: ['لم يُعتمد', 'Not approved', '#C0392B'],
};
const DAY: Record<string, [string, string]> = {
  saturday: ['السبت', 'Saturday'], sunday: ['الأحد', 'Sunday'], monday: ['الاثنين', 'Monday'],
  tuesday: ['الثلاثاء', 'Tuesday'], wednesday: ['الأربعاء', 'Wednesday'], thursday: ['الخميس', 'Thursday'], friday: ['الجمعة', 'Friday'],
};

function MealRow({ m, t, en }: { m: any; t: Tr; en: boolean }) {
  const src = mealImageSources(null, m.imageUrl)[0];
  return <View style={[s.meal, { flexDirection: en ? 'row' : 'row-reverse' }]}>
    {src ? <Image source={src} style={s.thumb} /> : <View style={[s.thumb, s.thumbEmpty]}><Ionicons name="restaurant-outline" size={20} color={colors.muted2} /></View>}
    <View style={{ flex: 1, gap: 2 }}>
      <T w="bold" literal style={{ color: colors.navy2, textAlign: en ? 'left' : 'right' }}>{(en && m.mealNameEn) || m.mealNameAr || m.mealNameEn}</T>
      {m.calories != null && <T style={{ color: colors.muted, fontSize: 13, textAlign: en ? 'left' : 'right' }}>{`${m.calories} ${t('سعرة', 'kcal')}${m.protein ? ` · ${t('بروتين', 'Protein')} ${m.protein}g` : ''}`}</T>}
    </View>
  </View>;
}

function OrderCard({ saved, t, en, locale }: { saved: SavedOrder; t: Tr; en: boolean; locale: string }) {
  const o = useQuery(api.subscriberOrders.view, { token: saved.token });
  const [open, setOpen] = useState(false);
  if (o === undefined) return <View style={s.card}><T style={{ color: colors.muted }}>{t('جارٍ التحميل…', 'Loading…')}</T></View>;
  if (o === null) return null;
  const st = STATUS[o.status] || [o.status, o.status, colors.muted2];
  const fmt = (ms?: number | null) => ms ? new Date(ms).toLocaleDateString(locale, { timeZone: 'Asia/Qatar', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
  const align = { textAlign: en ? 'left' as const : 'right' as const };

  // قبل الاعتماد (أو بلا خطط): الوجبات كما طلبها المشترك، أسبوع ← يوم.
  const requested: Array<[string, any[]]> = [];
  if (!o.schedule.length) {
    const g = new Map<string, any[]>();
    for (const it of o.items) { const k = `${it.week}|${it.day}`; (g.get(k) || g.set(k, []).get(k)!).push(it); }
    const order = Object.keys(DAY);
    requested.push(...[...g.entries()].sort(([a], [b]) => {
      const [wa, da] = a.split('|'), [wb, db] = b.split('|');
      return Number(wa) - Number(wb) || order.indexOf(da) - order.indexOf(db);
    }));
  }

  return <View style={s.card}>
    <Pressable accessibilityRole="button" onPress={() => setOpen(v => !v)} style={{ gap: 8 }}>
      <View style={[s.row, { alignItems: 'center' }]}>
        <T w="black" literal selectable style={{ fontSize: 17, color: colors.navy2, writingDirection: 'ltr' }}>{o.orderNumber}</T>
        <View style={[s.pill, { backgroundColor: `${st[2]}1A`, borderColor: st[2] }]}><T w="bold" style={{ color: st[2], fontSize: 13 }}>{t(st[0], st[1])}</T></View>
      </View>
      <T style={[s.meta, align]}>{`${t('أُرسل', 'Sent')}: ${fmt(o.createdAt)}${o.approvedAt ? `  ·  ${t('اعتُمد', 'Approved')}: ${fmt(o.approvedAt)}` : ''}`}</T>
      <T style={[s.meta, align]}>{`${t('عدد الوجبات', 'Meals')}: ${o.totalMeals}${o.schedule.length ? `  ·  ${t('أيام التوصيل', 'Delivery days')}: ${o.schedule.length}` : ''}`}</T>
      {!!o.rejectionReason && <T style={[s.meta, align, { color: '#C0392B' }]}>{`${t('السبب', 'Reason')}: ${o.rejectionReason}`}</T>}
      <T w="bold" style={[{ color: colors.cyanDark }, align]}>{open ? t('إخفاء الوجبات', 'Hide meals') : o.schedule.length ? t('عرض خطتي المعتمدة', 'View my approved plan') : t('عرض الوجبات المطلوبة', 'View requested meals')}</T>
    </Pressable>
    {open && o.schedule.length > 0 && o.schedule.map((d: any) => <View key={`${d.date}${d.deliveryTime}`} style={s.day}>
      <T w="black" style={[s.dayTitle, align]}>{dayLabel(d.date)}</T>
      {d.meals.map((m: any, i: number) => <MealRow key={i} m={m} t={t} en={en} />)}
    </View>)}
    {open && !o.schedule.length && <>
      {o.status !== 'cancelled' && <T style={[s.meta, align]}>{t('هذه اختياراتك كما أرسلتها. بعد اعتماد الأخصائية تظهر هنا بتواريخ التوصيل الفعلية.', 'These are your choices as sent. Once approved, they appear here with the actual delivery dates.')}</T>}
      {requested.map(([k, meals]) => {
        const [w, d] = k.split('|');
        return <View key={k} style={s.day}>
          <T w="black" style={[s.dayTitle, align]}>{`${t('الأسبوع', 'Week')} ${w} · ${DAY[d] ? t(DAY[d][0], DAY[d][1]) : d}`}</T>
          {meals.map((m: any, i: number) => <MealRow key={i} m={m} t={t} en={en} />)}
        </View>;
      })}
    </>}
  </View>;
}

export default function MyOrders() {
  const router = useRouter(), insets = useSafeAreaInsets();
  const { language, t } = useContentLanguage();
  const tr = t as unknown as Tr;
  const en = language === 'en', locale = en ? 'en-QA' : 'ar-QA';
  const { session, ready } = useCustomerSession();
  const [saved, setSaved] = useState<SavedOrder[] | null>(null);
  const [num, setNum] = useState(''), [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void (async () => {
      let list = await loadMyOrders();
      if (session) {
        try {
          const mine = await convex.mutation(api.subscriberOrders.forAccount, { accountId: session.accountId, sessionToken: session.token });
          if (Array.isArray(mine) && mine.length) list = await rememberOrders(mine);
        } catch { /* الطلبات المحفوظة على الجهاز تبقى ظاهرة */ }
      }
      if (alive) setSaved(list);
    })();
    return () => { alive = false; };
  }, [ready, session?.accountId]);

  const recover = async () => {
    const digits = phone.replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g, '');
    if (!num.trim() || digits.length < 8) { setMsg(tr('اكتب رقم الطلب ورقم الهاتف المسجّل معه.', 'Enter the order number and the phone registered with it.')); return; }
    setBusy(true); setMsg('');
    try {
      const r = await convex.mutation(api.subscriberOrders.recover, { orderNumber: num.trim(), phone: digits });
      if (!r) setMsg(tr('لم نجد طلباً بهذا الرقم وهذا الهاتف معاً.', 'No order matches this number and phone.'));
      else { setSaved(await rememberOrders([r])); setNum(''); setPhone(''); }
    } catch { setMsg(tr('تعذّر الاتصال. أعد المحاولة.', 'Connection failed. Try again.')); }
    finally { setBusy(false); }
  };

  const align = { textAlign: en ? 'left' as const : 'right' as const };
  return <ScrollView keyboardShouldPersistTaps="handled" style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}>
    <View style={s.row}><Btn label={tr('رجوع', 'Back')} variant="outline" onPress={() => router.canGoBack() ? router.back() : router.replace('/account')} /></View>
    <T accessibilityRole="header" w="black" style={[s.title, align]}>{tr('طلباتي وخطتي المعتمدة', 'My orders & approved plan')}</T>
    <T style={[s.meta, align]}>{tr('طلباتك تظهر هنا تلقائياً، وبعد اعتماد الأخصائية تجد وجباتك يوماً بيوم بتواريخ التوصيل.', 'Your orders appear here automatically. Once approved, you’ll see your meals day by day with delivery dates.')}</T>
    {saved === null && <T style={s.meta}>{tr('جارٍ التحميل…', 'Loading…')}</T>}
    {saved?.length === 0 && <View style={s.card}><T style={[s.meta, align]}>{tr('لا توجد طلبات على هذا الجهاز بعد. أرسل خطتك من «اختيار وجبات اشتراكي»، أو استعد طلباً سابقاً بالأسفل.', 'No orders on this device yet. Send your plan from “Choose my subscription meals”, or recover a previous order below.')}</T></View>}
    {saved?.map(o => <OrderCard key={o.token} saved={o} t={tr} en={en} locale={locale} />)}

    <View style={[s.card, { gap: 10 }]}>
      <T w="black" style={[{ fontSize: 17, color: colors.navy2 }, align]}>{tr('غيّرت جهازك؟ استعد طلبك', 'New device? Recover your order')}</T>
      <T style={[s.meta, align]}>{tr('رقم الطلب موجود في رسالة الأخصائية أو شاشة تأكيد الإرسال.', 'The order number is in the nutritionist’s message or the submission screen.')}</T>
      <TextInput accessibilityLabel={tr('رقم الطلب', 'Order number')} placeholder="ORD-…" value={num} onChangeText={v => { setNum(v); setMsg(''); }} autoCapitalize="characters" autoCorrect={false} maxLength={40} style={s.input} />
      <TextInput accessibilityLabel={tr('رقم الهاتف', 'Phone number')} placeholder={tr('رقم الهاتف', 'Phone number')} value={phone} onChangeText={v => { setPhone(v); setMsg(''); }} keyboardType="phone-pad" maxLength={20} style={s.input} />
      <Btn label={busy ? tr('جارٍ البحث…', 'Searching…') : tr('إضافة الطلب', 'Add order')} disabled={busy} onPress={() => void recover()} />
      {!!msg && <T accessibilityRole="alert" style={[s.meta, align]}>{msg}</T>}
    </View>
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 14, width: '100%', maxWidth: 650, alignSelf: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 28, lineHeight: 42, color: colors.navy2 },
  meta: { fontSize: 14, lineHeight: 22, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: colors.line },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  day: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  dayTitle: { fontSize: 15, color: colors.cyanDark },
  meal: { alignItems: 'center', gap: 12 },
  thumb: { width: 54, height: 54, borderRadius: 12, backgroundColor: colors.bg2 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.muted2, borderRadius: 12, padding: 12, fontFamily: fonts.regular, fontSize: 16, color: colors.navy2, backgroundColor: colors.card, textAlign: 'left', writingDirection: 'ltr' },
});
