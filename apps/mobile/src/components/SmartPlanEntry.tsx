import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/theme';
import { Btn, T } from './ui';

/** One subscriber entry for both native planning modes. */
export function SmartPlanEntry() {
  const router = useRouter();
  return <View style={s.panel}>
    <View style={s.heading}><Ionicons name="sparkles-outline" size={24} color={colors.cyanDark}/><T accessibilityRole="header" w="black" style={s.title}>خطط وجبات اشتراكك</T></View>
    <T style={s.copy}>أدخل رقم المشترك، ثم اختر وجباتك يدويًا أو بمساعدة الخطة الذكية. المراجعة والإرسال داخل التطبيق.</T>
    <Btn label="ابدأ برقم المشترك" onPress={() => router.push('/menu')}/>
  </View>;
}
const s = StyleSheet.create({
  panel: { padding: 20, gap: 12, backgroundColor: colors.cyanSoft, borderRadius: 16, width: '100%' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 20, lineHeight: 30, color: colors.navy2 },
  copy: { fontSize: 14, lineHeight: 24, color: colors.navy2 },
  note: { fontSize: 12, lineHeight: 21, color: colors.muted2 },
});
