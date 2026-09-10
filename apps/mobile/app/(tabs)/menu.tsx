/** القائمة — رأس نصّي بعدد الأطباق، بحث، كبسولات تصنيف، شبكة عمودين من بطاقة الطبق. تصفّح فقط (الطلب لاحقاً). */
import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api";
import { colors, fonts } from "@/theme";
import { Chip, T } from "@/components/ui";
import { MealCard } from "@/components/MealCard";
import { isSnackCategory } from "@/rules";

const CATS = [
  { id: "all", l: "الكل" }, { id: "breakfast", l: "الإفطار" }, { id: "lunch", l: "الغداء" },
  { id: "dinner", l: "العشاء" }, { id: "snack", l: "سناكس" },
];

export default function Menu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const all = (useQuery(api.publicMeals.listMeals, { search: q || undefined }) || []) as any[];

  const meals = useMemo(() => all.filter((m) => {
    if (cat === "all") return true;
    if (cat === "snack") return isSnackCategory(m.category);
    return String(m.category || "").toLowerCase() === cat;
  }), [all, cat]);

  const gap = 12, pad = 16;
  const cardW = (width - pad * 2 - gap) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={meals}
        keyExtractor={(m) => String(m._id)}
        numColumns={2}
        columnWrapperStyle={{ gap, paddingHorizontal: pad }}
        contentContainerStyle={{ gap, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 14 }}>
            <View style={styles.head}>
              <T w="black" style={styles.title}>قائمة الوجبات</T>
              <T w="black" style={styles.count}>{all.length} طبقاً من إعداد الشيف · تتنوّع على مدار الشهر</T>
              <T style={styles.sub}>محسوبة السعرات بإشراف أخصائيي تغذية، وتُطبخ صباح كل يوم.</T>
            </View>
            <View style={styles.tools}>
              <View style={styles.search}>
                <Ionicons name="search-outline" size={18} color={colors.muted} />
                <TextInput value={q} onChangeText={setQ} placeholder="ابحث عن وجبة…" placeholderTextColor="#98A8B6" style={styles.input} />
              </View>
              <FlatList horizontal data={CATS} keyExtractor={(c) => c.id} showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: pad, paddingBottom: 12 }}
                renderItem={({ item }) => <Chip label={item.l} active={cat === item.id} onPress={() => setCat(item.id)} />} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <MealCard meal={item} width={cardW} onPress={() => router.push({ pathname: "/meal/[id]", params: { id: String(item._id) } })} />
        )}
        ListEmptyComponent={<T style={{ textAlign: "center", color: colors.muted, padding: 40 }}>{all.length ? "لا وجبات في هذا التصنيف" : "جارٍ التحميل…"}</T>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, alignItems: "center" },
  title: { fontSize: 30, color: colors.navy2, lineHeight: 40 },
  count: { fontSize: 14, color: colors.cyanDark, marginTop: 6, textAlign: "center" },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 4, textAlign: "center" },
  tools: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 4 },
  search: { marginHorizontal: 16, marginBottom: 10, height: 44, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text, textAlign: "right", paddingVertical: 0 },
});
