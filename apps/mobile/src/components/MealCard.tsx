/** بطاقة الطبق — نفس بطاقة الويب بعد إعادة التصميم: صورة، شارة سعرات سماوية، اسم، تصنيف، ٣ ماكروز. */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { colors, radii } from "@/theme";
import { T } from "./ui";
import { customerCategoryLabel } from "@/rules";

export type MealLite = {
  _id: string; nameAr: string; nameEn?: string; category?: string;
  calories?: number; protein?: number; carbs?: number; fats?: number; imageUrl?: string | null;
};

export function MealCard({ meal, onPress, width, rank }: { meal: MealLite; onPress?: () => void; width?: number; rank?: number }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, width ? { width } : null, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={styles.imgWrap}>
        {meal.imageUrl ? <Image source={{ uri: meal.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <View style={styles.badge}>
          <T w="black" style={styles.badgeNum}>{meal.calories ?? "—"}</T>
          <T w="semibold" style={styles.badgeUnit}>سعرة</T>
        </View>
        {rank ? <View style={styles.rank}><T w="black" style={{ color: "#fff", fontSize: 10 }}>#{rank}</T></View> : null}
      </View>
      <View style={styles.body}>
        <T w="black" numberOfLines={2} style={styles.name}>{meal.nameAr}</T>
        <T w="bold" style={styles.cat}>{customerCategoryLabel(meal.category, true)}</T>
        <View style={styles.macros}>
          <Macro v={meal.protein} l="بروتين" />
          <Macro v={meal.carbs} l="كارب" />
          <Macro v={meal.fats} l="دهون" />
        </View>
      </View>
    </Pressable>
  );
}

function Macro({ v, l }: { v?: number; l: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T w="black" style={styles.macroV}>{v ?? 0}g</T>
      <T w="semibold" style={styles.macroL}>{l}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: 8 },
  imgWrap: { aspectRatio: 4 / 3, borderRadius: radii.image, overflow: "hidden", backgroundColor: "#EAF3FB" },
  badge: { position: "absolute", top: 8, start: 8, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 10, height: 24, flexDirection: "row", alignItems: "center", gap: 3, shadowColor: "#0E2A4A", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  badgeNum: { fontSize: 11.5, color: colors.cyanDark, fontVariant: ["tabular-nums"] },
  badgeUnit: { fontSize: 10.5, color: colors.muted2 },
  rank: { position: "absolute", bottom: 8, start: 8, backgroundColor: colors.navy2, borderRadius: 999, paddingHorizontal: 8, height: 20, justifyContent: "center" },
  body: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 6, gap: 6 },
  name: { fontSize: 13.5, lineHeight: 18, minHeight: 36, color: colors.navy2 },
  cat: { fontSize: 10.5, color: colors.cyanDark },
  macros: { flexDirection: "row", gap: 14, marginTop: 2 },
  macroV: { fontSize: 12.5, color: colors.navy2, fontVariant: ["tabular-nums"] },
  macroL: { fontSize: 9, color: colors.muted2, letterSpacing: 0.6 },
});
