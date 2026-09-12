/** Development-only replay of the actual component. */
import React, { useState } from "react";
import { View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { Btn, T } from "@/components/ui";
import { colors } from "@/theme";
export default function BrandPreview() {
  const [run, setRun] = useState(0);
  const [release, setRelease] = useState(false);
  const router = useRouter();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", padding: 28, gap: 20 }}>
      <T w="bold" style={{ color: colors.navy, fontSize: 22 }}>معاينة بداية أدرينالين</T>
      <T style={{ color: colors.muted, textAlign: "center" }}>الشعار الأصلي، القلب، ثم انتقال هادئ للتطبيق.</T>
      <Btn label="إعادة الحركة" onPress={() => { setRelease(false); setRun((value) => value + 1); }} />
      <Btn label="شاهد الرئيسية" variant="outline" onPress={() => router.replace("/")} />
      <AnimatedSplash key={run} ready={release} />
      {!release && <View style={{ position: "absolute", bottom: 48, zIndex: 60 }}>
        <Btn label="شاهد الانتقال" variant="white" onPress={() => setRelease(true)} />
      </View>}
    </View>
  );
}
