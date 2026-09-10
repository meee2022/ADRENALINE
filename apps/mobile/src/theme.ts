/** هوية أدرينالين على الجوال — نفس توكنات الويب بعد إعادة التصميم (كحلي + سماوي + أبيض، Cairo). */
export const colors = {
  navy: "#0B2138",
  navy2: "#0E2A4A",
  navyDeep: "#07131F",
  cyan: "#3CC4F0",
  cyanDark: "#0E76AC",
  cyanSoft: "#EAF7FD",
  bg: "#F3F7FA",
  bg2: "#EEF4F8",
  card: "#FFFFFF",
  line: "#E4EEF6",
  text: "#0F1516",
  muted: "#6B7C8C",
  muted2: "#47759C",
  whatsapp: "#25D366",
  amber: "#F4A93A",
} as const;

export const radii = { card: 24, image: 18, pill: 999, tile: 16 } as const;

export const fonts = {
  regular: "Cairo_400Regular",
  semibold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  black: "Cairo_900Black",
} as const;

export const space = (n: number) => n * 4;

/** ظلّ ناعم للبطاقات الطافية (iOS + Android). */
export const softShadow = {
  shadowColor: "#0E2A4A",
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 4,
} as const;
