import type { CapacitorConfig } from "@capacitor/cli";

/* وضعان:
   - القشرة (CAP_SHELL=1 — أندرويد): تحمّل الموقع الحيّ، فتتحدّث مع الموقع دون
     إعادة رفع وحجمها ٣ ميغابايت بدل ٨٢. الشبكة شرطٌ في الحالتين أصلاً.
   - الكاملة (الافتراضي — iOS): الواجهة مضمّنة من dist/public، لأن مراجعة آبل
     (البند 4.2) ترفض التطبيق الذي هو موقعٌ في قشرة. */
const shell = process.env.CAP_SHELL === "1";

const config: CapacitorConfig = {
  appId: "com.adrenalinehealthy.app",
  appName: "Adrenaline Healthy",
  webDir: shell ? "android-shell" : "dist/public",
  ...(shell
    ? { server: { url: "https://adrenalinehealthy.com", androidScheme: "https", cleartext: false } }
    : {}),
  ios: {
    backgroundColor: "#F1F5F9",
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
  android: {
    backgroundColor: "#FFFFFF",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
