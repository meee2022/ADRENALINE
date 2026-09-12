import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useContentLanguage } from '@/useContentLanguage';
import { colors, fonts } from '@/theme';
import { Text } from 'react-native';

export function LanguagePicker() {
  const { language, ready, change, error } = useContentLanguage();
  return <View style={s.bar}>
    <View accessibilityRole="radiogroup" accessibilityLabel={language === 'ar' ? 'لغة التطبيق' : 'App language'} style={s.options}>
      {(['ar', 'en'] as const).map(value => <Pressable key={value} accessibilityRole="radio"
        accessibilityLabel={value === 'ar' ? 'العربية' : 'English'} accessibilityState={{ checked: language === value, disabled: !ready }}
        disabled={!ready} onPress={() => void change(value)} style={[s.option, language === value && s.active]}>
        <Text style={[s.label, language === value && { color: colors.navy2 }]}>{value === 'ar' ? 'العربية' : 'English'}</Text>
      </Pressable>)}
    </View>
    {error && <Text accessibilityRole="alert" style={s.error}>{language === 'ar' ? 'تعذّر حفظ اللغة؛ اخترها مجددًا للمحاولة.' : 'Language could not be saved. Select it again to retry.'}</Text>}
  </View>;
}
const s = StyleSheet.create({
  bar: { backgroundColor: colors.bg, paddingHorizontal: 16, alignItems: 'center' },
  options: { flexDirection: 'row', alignSelf: 'flex-end', gap: 4 },
  option: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  active: { borderBottomColor: colors.cyanDark },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.muted2 },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.navy2, paddingVertical: 6 },
});
