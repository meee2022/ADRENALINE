import React, { useEffect, useState } from "react";
import { I18nManager, Platform, View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ConvexProvider } from "convex/react";
import { useFonts, Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_900Black } from "@expo-google-fonts/cairo";
import { convex } from "@/api";
import { colors } from "@/theme";
import { AnimatedSplash } from "@/components/AnimatedSplash";

/* عربي من اليمين لليسار في كل الشاشات. على الجهاز يسري بعد أول تشغيل. */
if (Platform.OS === "web") {
  if (typeof document !== "undefined") document.documentElement.dir = "rtl";
} else if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 300 });

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_900Black });
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  return (
    <ConvexProvider client={convex}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style={splashDone ? "dark" : "light"} />
        {fontsLoaded ? (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="meal/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
            <Stack.Screen name="admin" options={{ presentation: "fullScreenModal" }} />
          </Stack>
        ) : null}
        <AnimatedSplash ready={fontsLoaded} onDone={() => setSplashDone(true)} />
      </View>
    </ConvexProvider>
  );
}
