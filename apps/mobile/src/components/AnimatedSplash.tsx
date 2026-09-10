/**
 * سبلاش متحرّك يكمل السبلاش الأصلي: نفس الشعار على الكحلي، يتنفّس لحظة ثم يرتفع
 * ويتلاشى ليكشف الرئيسية — بلا مكتبات إضافية (Animated من React Native).
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/theme";
import { T } from "./ui";

export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone?: () => void }) {
  const [gone, setGone] = useState(false);
  const scale = useRef(new Animated.Value(0.92)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [scale, glow]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lift, { toValue: -40, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]).start(() => { setGone(true); onDone?.(); });
    }, 650);
    return () => clearTimeout(t);
  }, [ready, fade, lift, onDone]);

  if (gone) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, { opacity: fade }]}>
      <Animated.View style={[styles.glow, { opacity: glow }]} />
      <Animated.View style={{ alignItems: "center", transform: [{ scale }, { translateY: lift }] }}>
        <Image source={require("../../assets/splash-icon.png")} style={{ width: 220, height: 220 }} contentFit="contain" />
        <T w="semibold" style={styles.tag}>أكل حقيقي · سعرات محسوبة · يوصلك طازج كل يوم</T>
      </Animated.View>
      <View style={styles.footer}>
        <T w="semibold" style={styles.footerT}>قطر · توصيل يومي</T>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", zIndex: 50 },
  glow: { position: "absolute", width: 420, height: 420, borderRadius: 210, backgroundColor: "rgba(60,196,240,0.14)", top: "22%" },
  tag: { color: "rgba(255,255,255,0.7)", fontSize: 12.5, marginTop: -8, textAlign: "center" },
  footer: { position: "absolute", bottom: 48 },
  footerT: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
});
