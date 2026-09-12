import { translate as localize, useContentLanguage as useUILanguage } from '@/useContentLanguage';
/** Local-only brand entrance; no session, subscription or network logic. */
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/theme";

export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone?: () => void }) {
  useUILanguage();
  const { width } = useWindowDimensions();
  const [gone, setGone] = useState(false);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [entered, setEntered] = useState(false);
  const word = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let active = true;
    const fallback = setTimeout(() => { if (active) setReduced(true); }, 250);
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) { clearTimeout(fallback); setReduced(value); }
    }).catch(() => { if (active) setReduced(true); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; clearTimeout(fallback); listener.remove(); };
  }, []);
  useEffect(() => {
    if (reduced === null) return;
    const animation = Animated.stagger(reduced ? 0 : 180, [
      Animated.timing(word, { toValue: 1, duration: reduced ? 100 : 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(heart, { toValue: 1, duration: reduced ? 100 : 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => { if (finished) setEntered(true); });
    return () => animation.stop();
  }, [reduced, word, heart]);
  useEffect(() => {
    if (reduced !== false || gone) return;
    const animation = Animated.timing(backdrop, { toValue: 1, duration: 6000, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [reduced, gone, backdrop]);
  useEffect(() => {
    if (!ready || !entered) return;
    const animation = Animated.sequence([
      Animated.delay(reduced ? 80 : 220),
      Animated.timing(fade, { toValue: 0, duration: reduced ? 100 : 300, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => { if (finished) { setGone(true); done.current?.(); } });
    return () => animation.stop();
  }, [ready, entered, reduced, fade]);
  if (gone) return null;
  const logoWidth = Math.min(width - 64, 340);
  return (
    <Animated.View accessibilityViewIsModal accessibilityLabel={localize(String("أدرينالين للوجبات الصحية"))} style={[StyleSheet.absoluteFill, styles.wrap, { opacity: fade }]}>
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.backgroundName, { transform: [{ translateX: reduced ? 0 : backdrop.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] }) }] }]}>
        <Image source={require("../../assets/wordmark-white.png")} style={{ width: Math.max(0, width - 64), height: Math.max(0, width - 64) * 187 / 1024 }} contentFit="contain" />
      </Animated.View>
      <View style={styles.identity}>
        <Animated.View style={{ opacity: word, transform: [{ translateY: reduced ? 0 : word.interpolate({ inputRange: [0, 1], outputRange: [-48, 0] }) }] }}>
          <Image source={require("../../assets/brand-wordmark-navy.png")} style={{ width: logoWidth, height: logoWidth * 169 / 686 }} contentFit="contain" accessibilityLabel={localize(String("ADRENALINE HEALTHY FOOD"))} />
        </Animated.View>
        <Animated.View style={{ marginTop: 32, opacity: heart, transform: [{ translateX: 8 }, { translateY: reduced ? 0 : heart.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { scale: reduced ? 1 : heart.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
          <Image source={require("../../assets/brand-heart-original.png")} style={{ width: 148, height: 141 }} contentFit="contain" accessibilityLabel={localize(String("قلب أدرينالين"))} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 50 },
  identity: { alignItems: "center", justifyContent: "center" },
  backgroundName: { position: "absolute", top: "18%", opacity: 0.035 },
});
