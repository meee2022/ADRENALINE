import { translate as localize, localizedField, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/** Presentation only. The parent owns queries and navigation; no meal-picking rules here. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, PanResponder, Platform, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";
import { Btn, T } from "./ui";

type Meal = { imageUrl?: string; nameAr?: string; calories?: number; protein?: number };
/** شريحة من لوحة التحكم (صفحة البانرات، الوجهة «التطبيق»): طبق مقصوص أو إعلان بصورة كاملة. */
export type HeroSlide = { id: string; kind: 'dish' | 'promo'; imageUrl: string; titleAr: string; titleEn?: string; subtitleAr?: string; subtitleEn?: string; linkUrl?: string };
type Slide = { key: string; kind: 'dish' | 'promo'; source: any; nameAr: string; nameEn?: string; descriptionAr?: string; descriptionEn?: string; linkUrl?: string };
// Editorial photographs, not menu records: never attach another meal's macros.
// أطباق حقيقية من تصوير المنيو الجديد (مقصوصة بخلفية شفافة) — تنوّع: رئيسي، سلطة، بحري، فطور، ساندويتش، حلو.
const dishes: Slide[] = ([
  ['steak', 'ستيك بزبدة الثوم والبطاطس', 'Garlic Butter Steak & Potato', require('../../assets/hero/steak.webp')],
  ['caesar', 'سلطة سيزر', 'Caesar Salad', require('../../assets/hero/caesar.webp')],
  ['salmon', 'سلمون بالعسل', 'Honey Glaze Salmon', require('../../assets/hero/salmon.webp')],
  ['pancake', 'بان كيك بالشوكولاتة', 'Chocolate Pancake', require('../../assets/hero/pancake.webp')],
  ['burger', 'برغر الدجاج المشوي', 'Grilled Chicken Burger', require('../../assets/hero/burger.webp')],
  ['shrimp-pasta', 'باستا روبيان كاجون', 'Cajun Shrimp Pasta', require('../../assets/hero/shrimp-pasta.webp')],
  ['beet-salad', 'سلطة الشمندر', 'Beetroot Salad', require('../../assets/hero/beet-salad.webp')],
  ['teriyaki', 'ترياكي الدجاج', 'Chicken Teriyaki Bowl', require('../../assets/hero/teriyaki.webp')],
  ['dates-balls', 'كرات التمر', 'Dates Balls', require('../../assets/hero/dates-balls.webp')],
  ['wrap', 'ساندويتش فاهيتا الدجاج', 'Chicken Fajita Sandwich', require('../../assets/hero/wrap.webp')],
  ['parmesan', 'دجاج بارميزان', 'Chicken Parmesan', require('../../assets/hero/parmesan.webp')],
  ['lava-cake', 'كيكة اللافا الباهاما', 'Bahama Lava Cake', require('../../assets/hero/lava-cake.webp')],
] as const).map(([key, nameAr, nameEn, source]) => ({ key, kind: 'dish' as const, source, nameAr, nameEn }));
type Props = { meals: Meal[]; fallback: string; inset: number; visible: boolean; liveSlides?: HeroSlide[]; onOpenLink?: (url: string) => void; onPlans: () => void; onMenu: () => void; onContact: () => void };
export function HomeHero({ meals, fallback, inset, visible, liveSlides, onOpenLink, onPlans, onMenu, onContact }: Props) {
  // شرائح اللوحة أولاً (إعلانات ثم ما يُضاف)، والأطباق المدموجة تبقى ما لم تُرفع أطباق من اللوحة.
  const slides = useMemo<Slide[]>(() => {
    const live: Slide[] = (liveSlides || []).map((b) => ({ key: b.id, kind: b.kind, source: { uri: b.imageUrl }, nameAr: b.titleAr, nameEn: b.titleEn, descriptionAr: b.subtitleAr, descriptionEn: b.subtitleEn, linkUrl: b.linkUrl }));
    return live.some((x) => x.kind === 'dish') ? live : [...live, ...dishes];
  }, [liveSlides]);
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
  const uri = current?.key ?? String(index);
  const [previous, setPrevious] = useState<Slide | null>(null);
  const shown = useRef<Slide | null>(null);
  useEffect(() => { setPrevious(shown.current); shown.current = current; }, [current]);
  useEffect(() => { setIndex((i) => (slides.length ? i % slides.length : 0)); }, [slides.length]);
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
  // سحب أفقي لتبديل الشرائح؛ لا يلتقط اللمس إلا إذا غلبت الحركة الأفقية فيبقى تمرير الصفحة الرأسي سليماً.
  const changeRef = useRef(change); changeRef.current = change;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderRelease: (_e, g) => { if (Math.abs(g.dx) > 36) changeRef.current(g.dx < 0 ? 1 : -1); },
  })).current;
  const promo = current?.kind === 'promo';
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
          <View style={s.photo} {...pan.panHandlers}>
          {!reduced && previous && previous.key !== current?.key && <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity: enter.interpolate({inputRange:[0,.65,1],outputRange:[1,0,0]}), transform:[{translateX:enter.interpolate({inputRange:[0,1],outputRange:[0,-170]})},{rotate:enter.interpolate({inputRange:[0,1],outputRange:['0deg','-15deg']})},{scale:enter.interpolate({inputRange:[0,1],outputRange:[1,.82]})}] }]}>
            <Image source={previous.source} style={[StyleSheet.absoluteFill, previous.kind === 'promo' && s.promoImage]} contentFit={previous.kind === 'promo' ? 'cover' : 'contain'} />
          </Animated.View>}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: enter.interpolate({ inputRange: [0, .25, 1], outputRange: [0, .7, 1] }), transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 170, 0] }) }, { rotate: enter.interpolate({inputRange:[0,1],outputRange:[reduced||promo?'0deg':'16deg','0deg']}) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.82, 1] }) }] }]}>
            {failed === uri ? <View style={s.error}><Ionicons name="restaurant-outline" size={40} color={colors.muted2} /><T style={{ color: colors.muted }}>الصورة غير متاحة حاليًا</T></View> :
              <Pressable disabled={!current?.linkUrl || !onOpenLink} accessibilityRole={current?.linkUrl ? 'link' : 'image'} onPress={() => current?.linkUrl && onOpenLink?.(current.linkUrl)} style={StyleSheet.absoluteFill}>
                <Image source={current.source} style={[StyleSheet.absoluteFill, promo && s.promoImage]} contentFit={promo ? 'cover' : 'contain'} cachePolicy="disk" accessibilityLabel={localize(String(localizedField(current)))} onError={() => setFailed(uri)} />
              </Pressable>}
          </Animated.View>
          </View>
          {/* الإعلان صورة مصمَّمة كلامها بداخلها — تكرار العنوان تحتها يزحم الهيرو. العنوان يبقى للقارئ الصوتي في accessibilityLabel. */}
          {current && !promo && <View style={s.caption}>
            <T w="bold" style={s.mealName}>{localizedField(current, 'name')}</T>
            {!!localizedField(current, 'description') && <T style={s.promoText}>{localizedField(current, 'description')}</T>}
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
  promoImage: { borderRadius: 18 },
  promoText: { fontSize: 13, lineHeight: 21, color: '#EAF4FA', textAlign: "center" },
  nutrition: { flexDirection: "row", gap: 20, flexWrap: "wrap" },
  macro: { fontSize: 13, color: colors.cyanDark },
  controls: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  control: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: "center", justifyContent: "center" },
  counter: { color: '#FFFFFF', fontSize: 12, fontVariant: ["tabular-nums"] },
  description: { color: '#FFFFFF', fontSize: 14, lineHeight: 23, textAlign: "center", marginTop: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
});
