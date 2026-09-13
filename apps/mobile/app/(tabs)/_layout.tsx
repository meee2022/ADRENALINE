import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "@/theme";
import { View } from 'react-native';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useContentLanguage } from '@/useContentLanguage';

export default function TabsLayout() {
  const { tr } = useContentLanguage();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}><LanguagePicker/><Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cyanDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 18 }, // Cairo يحتاج 18px؛ 13 كان يقصّ النص
        tabBarIconStyle: { marginTop: 0 },
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: colors.line, height: 66 + insets.bottom, paddingBottom: insets.bottom + 4, paddingTop: 4 }, // مساحة 58px للأيقونة والاسم (كانت 48 فانضغط الاسم إلى 3px)
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr("الرئيسية"), tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="menu" options={{ title: tr("القائمة"), tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="plans" options={{ title: tr("الخطط"), tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: tr("حسابي"), tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
    </Tabs></View>
  );
}
