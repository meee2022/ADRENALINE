import { translate as localize, localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/** بطاقة الطبق — نفس بطاقة الويب بعد إعادة التصميم: صورة، شارة سعرات سماوية، اسم، تصنيف، ٣ ماكروز. */
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/theme";
import { T } from "./ui";
import { customerCategoryLabel } from "@/rules";
import { mealImageSources } from "@/mealImage";
import { Ionicons } from "@expo/vector-icons";
import { useContentLanguage } from '@/useContentLanguage';

export type MealLite = {
  _id: string; nameAr: string; nameEn?: string; category?: string;
  calories?: number; protein?: number; carbs?: number; fats?: number; imageUrl?: string | null;
};

export function MealCard({ meal, onPress, width, rank, compact = false }: { meal: MealLite; onPress?: () => void; width?: number; rank?: number; compact?: boolean }) {
  useUILanguage();
  const [failures, setFailures] = useState(0);
  const {language,t}=useContentLanguage();
  const name=language==='en'?(meal.nameEn||meal.nameAr):meal.nameAr;
  const source = mealImageSources(meal._id, meal.imageUrl)[failures];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={localize(String(`${t('تفاصيل','Details')} ${name}`))} onPress={onPress} style={({ pressed }) => [styles.card, width ? { width } : null, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={styles.imgWrap}>
        {source ? <Image source={source} cachePolicy="disk" accessibilityLabel={localize(String(localizedField(meal)))} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} onError={() => setFailures((n) => n + 1)} /> : <View style={styles.placeholder}><Ionicons name="restaurant-outline" size={28} color={colors.muted2}/><T style={{fontSize:12,color:colors.muted2}}>الصورة الجديدة قريبًا</T></View>}
        <View style={styles.badge}>
          <Ionicons name="flame-outline" size={15} color={colors.navy2} />
          <T w="black" style={styles.badgeNum}>{meal.calories ?? "—"}</T>
          <T w="semibold" style={styles.badgeUnit}>{t('سعرة','kcal')}</T>
        </View>
        {rank ? <View style={styles.rank}><T w="black" style={{ color: "#fff", fontSize: 10 }}>#{rank}</T></View> : null}
      </View>
      <View style={styles.body}>
        <T w="black" numberOfLines={3} style={[styles.name, {textAlign:language==='ar'?'right':'left',writingDirection:language==='ar'?'rtl':'ltr'}, compact && { minHeight: 44 }]}>{name}</T>
        <T w="bold" style={styles.cat}>{customerCategoryLabel(meal.category, language==='ar')}</T>
        <View style={styles.macros}>
          <Macro v={meal.protein} l={t('بروتين','Protein')} />
          <Macro v={meal.carbs} l={t('كارب','Carbs')} />
          <Macro v={meal.fats} l={t('دهون','Fat')} />
        </View>
      </View>
    </Pressable>
  );
}

function Macro({ v, l }: { v?: number; l: string }) {
  useUILanguage();
  return (
    <View style={{ gap: 2, flex: 1, alignItems: 'center', minWidth: 36 }}>
      <T w="black" style={styles.macroV}>{typeof v === 'number' ? `${v}g` : '—'}</T>
      <T w="semibold" style={styles.macroL}>{l}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cyanSoft, borderRadius: 20, padding: 8, borderWidth: 1, borderColor: colors.line },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imgWrap: { aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: "#EAF3FB" },
  badge: { position: "absolute", top: 8, start: 8, backgroundColor: colors.cyan, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, minHeight: 32, flexDirection: "row", alignItems: "center", gap: 4 },
  badgeNum: { fontSize: 14, color: colors.navy2, fontVariant: ["tabular-nums"] },
  badgeUnit: { fontSize: 11, color: colors.navy2 },
  rank: { position: "absolute", bottom: 8, start: 8, backgroundColor: colors.navy2, borderRadius: 999, paddingHorizontal: 8, height: 20, justifyContent: "center" },
  body: { paddingHorizontal: 6, paddingTop: 12, paddingBottom: 8, gap: 8 },
  name: { fontSize: 15, lineHeight: 22, minHeight: 66, color: colors.navy2 },
  cat: { fontSize: 12, color: colors.cyanDark },
  macros: { flexDirection: "row", justifyContent: 'space-between', gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, flexWrap: 'wrap' },
  macroV: { fontSize: 16, color: colors.cyanDark, fontVariant: ["tabular-nums"] },
  macroL: { fontSize: 11, color: colors.muted2 },
});
