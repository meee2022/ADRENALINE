/** لوحة التحكم على الويب (معاينة التطوير فقط): iframe للموقع. النسخة الأصلية للأجهزة في admin.tsx. */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SITE_URL } from "@/api";
import { colors } from "@/theme";
import { T } from "@/components/ui";

export default function AdminWeb() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}><Ionicons name="close" size={20} color="#fff" /></Pressable>
        <T w="black" style={{ color: "#fff", fontSize: 15 }}>لوحة التحكم</T>
        <View style={{ width: 36 }} />
      </View>
      <iframe src={`${SITE_URL}/login`} style={{ flex: 1, border: 0, width: "100%", height: "100%" } as any} title="لوحة التحكم" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.navy },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
});
