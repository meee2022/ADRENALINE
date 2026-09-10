/** مكوّنات أساسية صغيرة: نص بخط Cairo، كبسولة، عنوان قسم، زر. */
import React from "react";
import { Pressable, StyleSheet, Text, TextProps, View, ViewStyle, StyleProp, TextStyle } from "react-native";
import { colors, fonts, radii } from "@/theme";

type Weight = "regular" | "semibold" | "bold" | "black";

export function T({ w = "regular", style, ...rest }: TextProps & { w?: Weight }) {
  return <Text {...rest} style={[styles.base, { fontFamily: fonts[w] }, style]} />;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <T w={active ? "black" : "semibold"} style={[styles.chipText, active && { color: colors.cyanDark }]}>{label}</T>
    </Pressable>
  );
}

export function Btn({
  label, onPress, variant = "primary", style, icon,
}: { label: string; onPress?: () => void; variant?: "primary" | "outline" | "outlineLight" | "white" | "cyan"; style?: StyleProp<ViewStyle>; icon?: React.ReactNode }) {
  const v = styles[`btn_${variant}` as const] as ViewStyle;
  const tv = styles[`btnT_${variant}` as const] as TextStyle;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, v, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, style]}>
      <T w="black" style={[styles.btnText, tv]}>{label}</T>
      {icon}
    </Pressable>
  );
}

export function SectionTitle({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.secHead}>
      <View style={{ flex: 1 }}>
        <T w="black" style={styles.secTitle}>{title}</T>
        {sub ? <T style={styles.secSub}>{sub}</T> : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <T w="black" style={styles.secAction}>{action} ←</T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontSize: 14, textAlign: "right", writingDirection: "rtl" },
  chip: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff", paddingHorizontal: 16, height: 36, justifyContent: "center" },
  chipActive: { borderColor: colors.cyan, backgroundColor: colors.cyanSoft },
  chipText: { fontSize: 14, color: colors.muted },
  btn: { height: 50, borderRadius: radii.pill, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  btnText: { fontSize: 15 },
  btn_primary: { backgroundColor: colors.navy2 }, btnT_primary: { color: "#fff" },
  btn_cyan: { backgroundColor: colors.cyan }, btnT_cyan: { color: "#fff" },
  btn_white: { backgroundColor: "#fff" }, btnT_white: { color: colors.navy },
  btn_outline: { borderWidth: 1.5, borderColor: colors.navy2, backgroundColor: "transparent" }, btnT_outline: { color: colors.navy2 },
  btn_outlineLight: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "transparent" }, btnT_outlineLight: { color: "#fff" },
  secHead: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 14 },
  secTitle: { fontSize: 24, color: colors.navy2, lineHeight: 32 },
  secSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  secAction: { fontSize: 13, color: colors.cyanDark },
});
