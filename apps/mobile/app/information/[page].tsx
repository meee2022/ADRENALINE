import { translate as localize, useContentLanguage as useUILanguage } from '@/useContentLanguage';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useQuery } from 'convex/react';
import { api } from '@/api';
import { restaurantPhone } from '@/contact';
import { colors } from '@/theme';
import { Btn, T } from '@/components/ui';
import { useContentLanguage } from '@/useContentLanguage';
import { openWeb } from '@/openWeb';

// Content adapted from the official AboutPage and HowToSubscribe pages.
const steps = [
  ['اختر باقتك', 'Choose your plan', 'اختر المدة والهدف وعدد الوجبات المناسب لك.', 'Choose the duration, goal and meal count that suit you.'],
  ['تواصل معنا', 'Get in touch', 'أرسل هدفك والحساسية والتفضيلات ووقت التوصيل المناسب للأخصائية.', 'Share your goal, allergies, preferences and preferred delivery time with the nutritionist.'],
  ['مراجعة الأخصائية', 'Nutritionist review', 'تراجع الأخصائية خطتك ووجباتك قبل اعتمادها.', 'Your nutritionist reviews your plan and meals before approval.'],
  ['التوصيل', 'Delivery', 'تابع وجباتك المسجلة والتوصيل حسب أيام اشتراكك.', 'Follow your registered meals and delivery on your subscription days.'],
];

export default function Information() {
  useUILanguage();
  const { page } = useLocalSearchParams<{ page: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language, ready, error: storageError, change, t } = useContentLanguage();
  const settings = useQuery(api.restaurantSettings.get, {});
  const [error, setError] = useState('');
  const phone = restaurantPhone(settings);
  const textStyle = { textAlign: language === 'ar' ? 'right' as const : 'left' as const, writingDirection: language === 'ar' ? 'rtl' as const : 'ltr' as const };
  const open = async (url: string) => {
    setError('');
    try { await openWeb(url); }
    catch { setError('تعذّر فتح الرابط. حاول مرة أخرى.'); }
  };
  const title = page === 'about' ? t('عن أدرينالين', 'About Adrenaline') : page === 'how-to-subscribe' ? t('كيف تشترك؟', 'How to subscribe') : page === 'contact' ? t('تواصل معنا', 'Contact us') : t('الصفحة غير موجودة', 'Page not found');
  return <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}>
    <View style={s.toolbar}>
      <Btn label={t('رجوع', 'Back')} variant="outline" onPress={() => router.canGoBack() ? router.back() : router.replace('/account')} />
      <Btn label={language === 'ar' ? 'English' : 'العربية'} variant="outline" disabled={!ready} onPress={() => void change(language === 'ar' ? 'en' : 'ar')} />
    </View>
    <Image source={require('../../assets/brand-wordmark-original.png')} contentFit="contain" accessibilityLabel={localize(String("Adrenaline Healthy Food"))} style={s.logo} />
    <T accessibilityRole="header" w="black" style={[s.title, textStyle]}>{title}</T>
    {storageError && <T accessibilityRole="alert" style={textStyle}>{t('تعذّر حفظ لغة الصفحات على الجهاز.', 'Could not save the page language on this device.')}</T>}
    {page === 'about' && <>
      <T style={[s.body, textStyle]}>{t('أدرينالين علامة قطرية متخصّصة في الأكل الصحي، نقدّم وجبات طازجة ومتوازنة تُحضّر يوميًا بإشراف اختصاصيي تغذية.', 'Adrenaline is a Qatari healthy food brand, offering fresh, balanced meals prepared daily under the supervision of nutritionists.')}</T>
      <T accessibilityRole="header" w="bold" style={[s.heading, textStyle]}>{t('طعام صحي يناسب يومك', 'Healthy food for your day')}</T>
      <T style={[s.body, textStyle]}>{t('نصمّم وجباتنا بسعرات محسوبة ومكوّنات طبيعية، مع التوازن بين الطعم والفائدة لتناسب مختلف الأهداف الصحية.', 'We design meals with calculated calories and natural ingredients, balancing taste and nutrition for different health goals.')}</T>
      <Btn label={t('تصفّح الوجبات', 'Browse meals')} onPress={() => router.push('/menu')} />
    </>}
    {page === 'how-to-subscribe' && <>
      {steps.map(([ar, en, arBody, enBody], index) => <View key={en} style={s.step}>
        <T w="black" style={[s.number, textStyle]}>{index + 1}</T>
        <T accessibilityRole="header" w="bold" style={[s.heading, textStyle]}>{t(ar, en)}</T>
        <T style={[s.body, textStyle]}>{t(arBody, enBody)}</T>
      </View>)}
      <T style={[s.body, textStyle]}>{t('لو خطتك معتمدة بالفعل، لا تحتاج لاختيار وجبات الغد من جديد.', 'If your plan is already approved, you do not need to choose tomorrow’s meals again.')}</T>
      <Btn label={t('عرض الباقات', 'View plans')} onPress={() => router.push('/plans')} />
    </>}
    {page === 'contact' && <>
      <T style={[s.body, textStyle]}>{t('للاستفسار عن الاشتراك أو التوصيل أو مراجعة خطتك، تواصل مع فريق أدرينالين.', 'Contact the Adrenaline team for subscription, delivery or meal-plan support.')}</T>
      <T w="bold" selectable style={s.phone}>+{phone}</T>
      <Btn label={t('تواصل عبر واتساب', 'Contact via WhatsApp')} onPress={() => void open(`https://wa.me/${phone}`)} />
      <Btn label={t('اتصل بالمطعم', 'Call the restaurant')} variant="outline" onPress={() => void open(`tel:+${phone}`)} />
      <T style={[s.body, textStyle]}>{t('يفتح واتساب أو تطبيق الهاتف لإكمال التواصل. لا تُرسل أي رسالة تلقائيًا.', 'Opens WhatsApp or your phone app. No message is sent automatically.')}</T>
    </>}
    {!!error && <T accessibilityRole="alert" style={textStyle}>{error}</T>}
  </ScrollView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, gap: 20, width: '100%', maxWidth: 650, alignSelf: 'center' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  logo: { width: '100%', maxWidth: 260, height: 76, alignSelf: 'center' },
  title: { fontSize: 30, lineHeight: 44, color: colors.navy2 },
  heading: { fontSize: 20, lineHeight: 30, color: colors.navy2 },
  body: { fontSize: 16, lineHeight: 29, color: colors.navy2 },
  step: { paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  number: { fontSize: 24, color: colors.cyanDark },
  phone: { fontSize: 24, textAlign: 'center', writingDirection: 'ltr', color: colors.cyanDark },
});
