import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "@/theme";
import { Platform, View } from 'react-native';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useContentLanguage } from '@/useContentLanguage';

/* الويب فقط: react-native-web يضغط اسم التبويب إلى 3px في مساحة 48px فيُقصّ (ظهر في لقطات المتجر).
   على iOS الشريط سليم — متحقَّق على TestFlight build 3 — فقيم الجهاز تبقى كما هي حرفياً. */
const WEB = Platform.OS === 'web';

export default function TabsLayout() {
  const { tr } = useContentLanguage();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}><LanguagePicker/><Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cyanDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11, ...(WEB ? { lineHeight: 18 } : { lineHeight: 13, marginBottom: 3 }) },
        tabBarIconStyle: WEB ? { marginTop: 0 } : { marginTop: 3 },
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: colors.line, ...(WEB ? { height: 66 + insets.bottom, paddingBottom: insets.bottom + 4, paddingTop: 4 } : { height: 60 + insets.bottom, paddingBottom: insets.bottom + 6, paddingTop: 6 }) },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr("الرئيسية"), tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="menu" options={{ title: tr("اختيار وجبات اشتراكي"), tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="restaurant-menu" options={{ href: null }} />
      <Tabs.Screen name="plans" options={{ title: tr("الخطط"), tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: tr("حسابي"), tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
    </Tabs></View>
  );
}
