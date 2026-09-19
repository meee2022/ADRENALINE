/** لوحة التحكم — الموقع الحالي كما هو داخل التطبيق (نفس الحسابات وكل الصفحات). */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from "react-native-webview";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SITE_URL } from "@/api";
import { colors } from "@/theme";
import { T } from "@/components/ui";

/** اسم ملف آمن للنظام (بلا محارف ممنوعة) مع إبقاء العربية. */
const safeName = (n: string) => (String(n || "مستند").replace(/[\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "مستند");

export default function Admin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /**
   * WebView لا ينزّل ملفات ولا يطبع: الموقع يرسل المستند عبر postMessage،
   * وهنا نحوّله PDF بمحرّك النظام (يدعم العربية) ثم نفتح ورقة الحفظ/المشاركة.
   */
  const onMessage = async (event: { nativeEvent: { data: string } }) => {
    let msg: any;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    try {
      if (msg?.type === "print-doc" && typeof msg.html === "string") {
        const { uri } = await Print.printToFileAsync({ html: msg.html });
        const target = FileSystem.cacheDirectory + safeName(msg.fileName) + ".pdf";
        try { await FileSystem.deleteAsync(target, { idempotent: true }); } catch { /* لا شيء */ }
        await FileSystem.moveAsync({ from: uri, to: target });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(target, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
        return;
      }
      if (msg?.type === "save-file" && typeof msg.base64 === "string") {
        const target = FileSystem.cacheDirectory + safeName(msg.filename);
        await FileSystem.writeAsStringAsync(target, msg.base64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(target, { mimeType: msg.mime || undefined });
      }
    } catch (e: any) {
      if (!/cancel/i.test(String(e?.message || ""))) Alert.alert("تعذّر تجهيز الملف", "حاول مرة أخرى.");
    }
  };
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
        domStorageEnabled
        onNavigationStateChange={({url}) => {
          try {
            const next = new URL(url);
            if (next.origin !== new URL(SITE_URL).origin) return;
            if (next.pathname === '/driver') void AsyncStorage.setItem('adrenaline.staff-entry.v1', 'driver').catch(() => {});
            else if (next.pathname === '/login') void AsyncStorage.removeItem('adrenaline.staff-entry.v1').catch(() => {});
          } catch { /* Ignore non-site navigation. No credentials leave the WebView. */ }
        }}
        onMessage={(e) => { void onMessage(e as any); }}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: colors.navy },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
});
