/** لوحة التحكم — الموقع الحالي كما هو داخل التطبيق (نفس الحسابات وكل الصفحات). */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SITE_URL } from "@/api";
import { colors } from "@/theme";
import { T } from "@/components/ui";

export default function Admin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}><Ionicons name="close" size={20} color="#fff" /></Pressable>
        <T w="black" style={{ color: "#fff", fontSize: 15 }}>لوحة التحكم</T>
        <View style={{ width: 36 }} />
      </View>
      <WebView
        source={{ uri: `${SITE_URL}/login` }}
        style={{ flex: 1 }}
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: colors.navy },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
});
