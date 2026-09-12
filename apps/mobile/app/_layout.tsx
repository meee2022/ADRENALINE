import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ConvexProvider } from "convex/react";
import { useFonts, Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_900Black } from "@expo-google-fonts/cairo";
import { convex } from "@/api";
import { colors } from "@/theme";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { CustomerSessionProvider } from '@/customerSession';
import { NotificationRouter } from '@/components/NotificationRouter';
import { useContentLanguage } from '@/useContentLanguage';

// Direction is presentation state, not a forced device setting requiring a restart.

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 300 });

export default function RootLayout() {
  const router = useRouter();
  const { language } = useContentLanguage();
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
  }, [language]);
  const [fontsLoaded, fontError] = useFonts({ Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold, Cairo_900Black });
  const appReady = fontsLoaded || !!fontError;
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    if (!appReady || Platform.OS === 'web') return;
    let active = true;
    void AsyncStorage.getItem('adrenaline.staff-entry.v1').then(value => {
      if (active && value === 'driver') router.replace('/admin');
    }).catch(() => {});
    return () => { active = false; };
  }, [appReady, router]);

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  return (
    <ConvexProvider client={convex}>
      <CustomerSessionProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg, direction: language === 'ar' ? 'rtl' : 'ltr' }}>
        <StatusBar style={splashDone ? "dark" : "light"} />
        {appReady ? (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="meal/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
            <Stack.Screen name="admin" options={{ presentation: "fullScreenModal" }} />
          </Stack>
        ) : null}
        {appReady&&<NotificationRouter/>}
        {!splashDone && <AnimatedSplash ready={appReady} onDone={() => setSplashDone(true)} />}
      </View>
      </CustomerSessionProvider>
    </ConvexProvider>
  );
}
