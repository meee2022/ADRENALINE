/** حسابي — دخول المشترك برقم الهاتف (لاحقاً)، ولوحة التحكم للطاقم تفتح الموقع كما هو داخل التطبيق. */
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SITE_URL } from "@/api";
import { colors, radii } from "@/theme";
import { Btn, T } from "@/components/ui";

export default function Account() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 14, padding: 20, gap: 14 }}>
      <T w="black" style={{ fontSize: 30, color: colors.navy2, lineHeight: 40 }}>حسابي</T>

      <View style={styles.card}>
        <T w="black" style={{ fontSize: 16, color: colors.navy2 }}>أنا مشترك</T>
        <T style={{ fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: 4 }}>الدخول برقم الهاتف واختيار وجبات أيامك من داخل التطبيق — قريباً. حالياً يمكنك المتابعة من الموقع.</T>
        <Btn label="اختيار وجباتي من الموقع" variant="outline" onPress={() => Linking.openURL(`${SITE_URL}/public/menu`)} style={{ marginTop: 12, height: 46 }} />
      </View>

      <View style={styles.card}>
        <T w="black" style={{ fontSize: 16, color: colors.navy2 }}>الطاقم</T>
        <T style={{ fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: 4 }}>لوحة التحكم بكل صفحاتها (المطبخ، الكاشير، التوصيل، المراجعة…) بنفس تسجيل الدخول.</T>
        <Pressable onPress={() => router.push("/admin")} style={styles.adminBtn}>
          <Ionicons name="settings-outline" size={18} color="#fff" />
          <T w="black" style={{ color: "#fff", fontSize: 15 }}>لوحة التحكم</T>
        </Pressable>
      </View>

      <View style={[styles.card, { flexDirection: "row", gap: 12, alignItems: "center" }]}>
        <View style={{ flex: 1 }}>
          <T w="black" style={{ fontSize: 14, color: colors.navy2 }}>تواصل معنا</T>
          <T style={{ fontSize: 12.5, color: colors.muted }}>واتساب · الموقع · سياسة الخصوصية</T>
        </View>
        <Pressable onPress={() => Linking.openURL(SITE_URL)} hitSlop={8}><Ionicons name="globe-outline" size={22} color={colors.cyanDark} /></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: radii.card, padding: 18, borderWidth: 1, borderColor: colors.line },
  adminBtn: { marginTop: 12, height: 48, borderRadius: 999, backgroundColor: colors.navy, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
});
