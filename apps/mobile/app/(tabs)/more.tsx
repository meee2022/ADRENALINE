/** «المزيد» — كل ما ليس بياناتك: منيو المطعم، الحاسبة، التتبع، المساعدة والسياسات. */
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, SITE_URL } from '@/api';
import { openWeb } from '@/openWeb';
import { restaurantPhone } from '@/contact';
import { colors } from '@/theme';
import { T } from '@/components/ui';
import { contentLanguage as uiLanguage, useContentLanguage as useUILanguage } from '@/useContentLanguage';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string; onPress: () => void; external?: boolean; tint?: string };

export default function More() {
  useUILanguage();
  const router = useRouter(), insets = useSafeAreaInsets();
  const phone = restaurantPhone(useQuery(api.restaurantSettings.get, {}));
  const site = (path: string) => () => { void openWeb(SITE_URL + path).catch(() => {}); };
  const ar = uiLanguage() === 'ar';

  const groups: Array<{ title: string; rows: Row[] }> = [
    { title: 'اطلب واكتشف', rows: [
      { icon: 'fast-food-outline', label: 'منيو المطعم', sub: 'كل وجبات المطعم خارج الاشتراك', onPress: () => router.push('/restaurant-menu') },
      { icon: 'calculator-outline', label: 'حاسبة السعرات والماكروز', onPress: () => router.push('/calorie-calculator') },
      { icon: 'navigate-outline', label: 'تتبّع طلبك', sub: 'حالة الطلب ورابط تتبّع التوصيل', onPress: () => router.push('/order-tracking') },
    ] },
    { title: 'تواصل', rows: [
      { icon: 'logo-whatsapp', label: 'تواصل مع الأخصائية', tint: colors.whatsapp, onPress: () => { void Linking.openURL(`https://wa.me/${phone}`).catch(() => {}); } },
      { icon: 'call-outline', label: 'تواصل معنا', onPress: () => router.push('/information/contact') },
    ] },
    { title: 'المساعدة والمعلومات', rows: [
      { icon: 'help-circle-outline', label: 'طريقة الاشتراك', onPress: () => router.push('/information/how-to-subscribe') },
      { icon: 'information-circle-outline', label: 'عن أدرينالين', onPress: () => router.push('/information/about') },
      { icon: 'shield-checkmark-outline', label: 'سياسة الخصوصية', external: true, onPress: site('/privacy') },
      { icon: 'document-text-outline', label: 'الشروط والأحكام', external: true, onPress: site('/terms') },
    ] },
  ];

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[s.page, { paddingTop: 20, paddingBottom: insets.bottom + 32 }]}>
    <T w="black" accessibilityRole="header" style={[s.title, { textAlign: ar ? 'right' : 'left' }]}>المزيد</T>
    {groups.map(g => <View key={g.title} style={{ gap: 8 }}>
      <T w="bold" style={[s.group, { textAlign: ar ? 'right' : 'left' }]}>{g.title}</T>
      <View style={s.card}>
        {g.rows.map((r, i) => <Pressable key={r.label} accessibilityRole={r.external ? 'link' : 'button'} onPress={r.onPress}
          style={({ pressed }) => [s.row, { flexDirection: ar ? 'row-reverse' : 'row' }, i > 0 && s.divider, pressed && { backgroundColor: colors.bg2 }]}>
          <View style={[s.icon, { backgroundColor: r.tint ? `${r.tint}1F` : colors.cyanSoft }]}><Ionicons name={r.icon} size={20} color={r.tint || colors.cyanDark} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <T w="bold" style={[s.label, { textAlign: ar ? 'right' : 'left' }]}>{r.label}</T>
            {!!r.sub && <T style={[s.sub, { textAlign: ar ? 'right' : 'left' }]}>{r.sub}</T>}
          </View>
          <Ionicons name={r.external ? 'open-outline' : ar ? 'chevron-back' : 'chevron-forward'} size={17} color={colors.muted} />
        </Pressable>)}
      </View>
    </View>)}
  </ScrollView>;
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 18, width: '100%', maxWidth: 650, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 40, color: colors.navy2 },
  group: { fontSize: 13, color: colors.muted2, paddingHorizontal: 4 },
  card: { backgroundColor: colors.card, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  row: { alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 60, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, color: colors.navy2 },
  sub: { fontSize: 12, color: colors.muted },
});
