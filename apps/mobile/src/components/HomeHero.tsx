import { translate as localize, localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/** Presentation only. The parent owns queries and navigation; no meal-picking rules here. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";
import { Btn, T } from "./ui";

type Meal = { imageUrl?: string; nameAr?: string; calories?: number; protein?: number };
// Editorial photographs, not menu records: never attach another meal's macros.
const slides = [
  { source: require('../../assets/hero/green-rice.png'), nameAr: 'كرات اللحم مع الأرز الأخضر' },
  { source: require('../../assets/hero/shawarma.png'), nameAr: 'شاورما اللحم مع أرز الشمندر' },
];
type Props = { meals: Meal[]; fallback: string; inset: number; visible: boolean; onPlans: () => void; onMenu: () => void; onContact: () => void };
export function HomeHero({ meals, fallback, inset, visible, onPlans, onMenu, onContact }: Props) {
  useUILanguage();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [failed, setFailed] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const enter = useRef(new Animated.Value(1)).current;
  const current = slides[index % Math.max(slides.length, 1)];
  const uri = String(index);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduced(v); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    const state = AppState.addEventListener("change", (v) => setActive(v === "active"));
    return () => { mounted = false; motion.remove(); state.remove(); };
  }, []);
  useEffect(() => {
    if (paused || reduced || !active || !focused || !visible || slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6500);
    return () => clearInterval(timer);
  }, [paused, reduced, active, focused, visible, slides.length]);
  useEffect(() => {
    enter.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(enter, { toValue: 1, duration: reduced ? 0 : 1100, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" });
    animation.start();
    return () => animation.stop();
  }, [uri, reduced, enter]);
  const change = (step: number) => { setPaused(true); setIndex((i) => (i + step + slides.length) % slides.length); };
  return (
    <View style={[s.hero, { paddingTop: inset + 14 }]}>
      <View style={s.header}>
        <Image source={require("../../assets/brand-wordmark-original.png")} style={{ width: 174, height: 43 }} contentFit="contain" accessibilityLabel={localize(String("ADRENALINE HEALTHY FOOD"))} />
        <Pressable accessibilityRole="button" accessibilityLabel={localize(String("تواصل عبر واتساب"))} onPress={onContact} style={s.contact}>
          <Ionicons name="logo-whatsapp" size={22} color={colors.navy2} />
        </Pressable>
      </View>
      <View style={s.content}>
        <T w="black" accessibilityRole="header" style={s.title}>أكل حقيقي.</T>
        <T w="black" style={s.title}>سعرات محسوبة.</T>
        <T w="semibold" style={s.promise}>ويوصلك طازج كل يوم.</T>
        <View style={s.stage}>
          <View style={s.photo}>
          {!reduced && <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity: enter.interpolate({inputRange:[0,.65,1],outputRange:[1,0,0]}), transform:[{translateX:enter.interpolate({inputRange:[0,1],outputRange:[0,-170]})},{rotate:enter.interpolate({inputRange:[0,1],outputRange:['0deg','-15deg']})},{scale:enter.interpolate({inputRange:[0,1],outputRange:[1,.82]})}] }]}>
            <Image source={slides[(index+1)%slides.length].source} style={StyleSheet.absoluteFill} contentFit="contain" />
          </Animated.View>}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: enter.interpolate({ inputRange: [0, .25, 1], outputRange: [0, .7, 1] }), transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 170, 0] }) }, { rotate: enter.interpolate({inputRange:[0,1],outputRange:[reduced?'0deg':'16deg','0deg']}) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.82, 1] }) }] }]}>
            {failed === uri ? <View style={s.error}><Ionicons name="restaurant-outline" size={40} color={colors.muted2} /><T style={{ color: colors.muted }}>الصورة غير متاحة حاليًا</T></View> :
              <Image source={current.source} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={localize(String(localizedField(current)))} onError={() => setFailed(uri)} />}
          </Animated.View>
          </View>
          {current && <View style={s.caption}>
            <T w="bold" style={s.mealName}>{localizedField(current, 'name')}</T>
          </View>}
        </View>
        {slides.length > 1 && <View style={s.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel={localize(String("الوجبة السابقة"))} style={s.control} onPress={() => change(-1)}><Ionicons name="chevron-forward" size={20} color={colors.navy2} /></Pressable>
          <T style={s.counter}>{index % slides.length + 1} / {slides.length}</T>
          <Pressable accessibilityRole="button" accessibilityLabel={localize(String("الوجبة التالية"))} style={s.control} onPress={() => change(1)}><Ionicons name="chevron-back" size={20} color={colors.navy2} /></Pressable>
          {!reduced && <Pressable accessibilityRole="button" accessibilityLabel={localize(String(paused ? "تشغيل تبديل الوجبات" : "إيقاف تبديل الوجبات"))} style={s.control} onPress={() => setPaused((v) => !v)}><Ionicons name={paused ? "play-outline" : "pause-outline"} size={18} color={colors.navy2} /></Pressable>}
        </View>}
        <T style={s.description}>وجبات تُطبخ صباح كل يوم بإشراف أخصائيي تغذية، مصمّمة حول هدفك لا حول منيو المطاعم.</T>
        <View style={s.actions}>
          <Btn label="احصل على خطتك" onPress={onPlans} style={{ flex: 1, minHeight: 50 }} />
          <Btn label="استكشف القائمة" variant="outline" onPress={onMenu} style={{ flex: 1, minHeight: 50, backgroundColor: '#FFFFFF' }} />
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  hero: { backgroundColor: '#47759C', paddingHorizontal: 20, paddingBottom: 28, overflow: 'hidden' },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  contact: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg2, alignItems: "center", justifyContent: "center" },
  content: { width: "100%", maxWidth: 620, alignSelf: "center" },
  title: { fontSize: 32, lineHeight: 43, color: '#FFFFFF', textAlign: "center" },
  promise: { fontSize: 17, lineHeight: 28, color: '#FFFFFF', textAlign: "center", marginTop: 4 },
  stage: { marginTop: 10 },
  photo: { width: "100%", aspectRatio: 1.4 },
  error: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  caption: { paddingVertical: 4, gap: 6 },
  mealName: { fontSize: 17, lineHeight: 26, color: '#FFFFFF', textAlign: "center" },
  nutrition: { flexDirection: "row", gap: 20, flexWrap: "wrap" },
  macro: { fontSize: 13, color: colors.cyanDark },
  controls: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  control: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: "center", justifyContent: "center" },
  counter: { color: '#FFFFFF', fontSize: 12, fontVariant: ["tabular-nums"] },
  description: { color: '#FFFFFF', fontSize: 14, lineHeight: 23, textAlign: "center", marginTop: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
});
