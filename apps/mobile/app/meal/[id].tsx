import { translate as localize, contentLanguage as uiLanguage, localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/** تفاصيل الطبق — نفس نافذة الويب: صورة أولاً، سطر تصنيف/وسوم، اسم، وصف، ٤ خانات قيم، مكوّنات ككبسولات. */
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api";
import { colors } from "@/theme";
import { Btn, T } from "@/components/ui";
import { customerCategoryLabel } from "@/rules";
import { menuArtwork } from "@/menuArtwork";
import { MealRating } from '@/components/MealRating';

export default function MealDetail() {
  useUILanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const result = useQuery(api.publicMeals.listMeals, {}) as any[] | undefined;
  const all = result || [];
  const meal = all.find((m) => String(m._id) === String(id));
  const source = meal && menuArtwork[String(meal._id)];
  const [failed, setFailed] = useState<number | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ width:'100%',maxWidth:760,alignSelf:'center', padding: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
        <View style={styles.imgWrap}>
          {source && source !== failed ? <Image source={source} accessibilityLabel={localize(String(localizedField(meal)))} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} onError={()=>setFailed(source)}/> : <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:12}}><Ionicons name="restaurant-outline" size={36} color={colors.muted2}/><T>{result === undefined ? 'جارٍ التحميل…' : 'الصورة الجديدة غير متاحة بعد'}</T></View>}
          <Pressable accessibilityRole="button" accessibilityLabel={localize(String("العودة إلى القائمة"))} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/menu')} style={styles.close} hitSlop={8}><Ionicons name="close" size={20} color={colors.navy2} /></Pressable>
          {meal ? (
            <View style={styles.badge}>
              <T w="black" style={{ fontSize: 12, color: colors.cyanDark }}>{meal.calories}</T>
              <T w="semibold" style={{ fontSize: 11, color: colors.muted2 }}>سعرة</T>
            </View>
          ) : null}
        </View>

        {meal ? (
          <>
            <T w="bold" style={styles.catLine}>
              {customerCategoryLabel(meal.category, uiLanguage() === 'ar')}
              {meal.tags?.length ? <T w="semibold" style={{ color: colors.muted, fontSize: 12 }}> · {meal.tags.slice(0, 3).join(" · ")}</T> : null}
            </T>
            <T w="black" style={styles.name}>{localizedField(meal, 'name')}</T>
            {uiLanguage() === 'ar' && meal.nameEn ? <T literal style={{ color: colors.muted, fontSize: 13, writingDirection:'ltr' }}>{meal.nameEn}</T> : null}

            {localizedField(meal, 'description') ? (
              <View style={{ marginTop: 18 }}>
                <T w="bold" style={styles.label}>الوصف</T>
                <T style={{ fontSize: 14.5, lineHeight: 24, color: "#3D4F5C" }}>{localizedField(meal, 'description')}</T>
              </View>
            ) : null}

            <View style={{ marginTop: 18 }}>
              <T w="bold" style={styles.label}>القيم الغذائية</T>
              <View style={{ flexDirection: "row", gap: 8, flexWrap:'wrap' }}>
                {[[meal.calories, "", "سعرة"], [meal.protein, "g", "بروتين"], [meal.carbs, "g", "كارب"], [meal.fats, "g", "دهون"]].map(([v, u, l], i) => (
                  <View key={i} style={styles.tile}>
                    <T w="black" style={{ fontSize: 19, color: colors.navy2, fontVariant: ["tabular-nums"] }}>{typeof v === 'number' ? `${v}${u}` : '—'}</T>
                    <T w="semibold" style={{ fontSize: 10.5, color: colors.muted2, marginTop: 4 }}>{l as string}</T>
                  </View>
                ))}
              </View>
            </View>

            {meal.ingredients?.length ? (
              <View style={{ marginTop: 18 }}>
                <T w="bold" style={styles.label}>المكونات</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {meal.ingredients.map((x: string, i: number) => (
                    <View key={i} style={styles.ing}><T w="semibold" style={{ fontSize: 12.5, color: colors.navy2 }}>{x}</T></View>
                  ))}
                </View>
              </View>
            ) : null}
            <MealRating mealId={String(meal._id)} mealName={localizedField(meal, 'name')}/>
          </>
        ) : (
          <T style={{ color: colors.muted2, textAlign: "center", padding: 30 }}>{result === undefined ? 'جارٍ التحميل…' : 'هذه الوجبة غير متاحة في القائمة الحالية.'}</T>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <T w="semibold" style={{ fontSize: 12, color: colors.muted2, flex: 1 }}>تصفّح الباقات المتاحة</T>
        <Btn label="اختر خطتك" variant="cyan" onPress={() => router.push("/(tabs)/plans")} style={{ height: 46, paddingHorizontal: 22 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  imgWrap: { aspectRatio: 16 / 10, borderRadius: 20, overflow: "hidden", backgroundColor: "#EAF3FB" },
  close: { position: "absolute", top: 10, end: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", bottom: 12, start: 12, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 12, height: 28, flexDirection: "row", alignItems: "center", gap: 4 },
  catLine: { fontSize: 12, color: colors.cyanDark, marginTop: 16 },
  name: { fontSize: 22, lineHeight: 32, color: colors.navy2, marginTop: 2 },
  label: { fontSize: 11, color: colors.muted2, letterSpacing: 0.6, marginBottom: 8 },
  tile: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  ing: { backgroundColor: colors.bg2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 12 },
});
