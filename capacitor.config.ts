import type { CapacitorConfig } from "@capacitor/cli";

/* نسخة المتجر قشرةٌ تحمّل الموقع الحيّ: التطبيق يتحدّث مع الموقع دون
   إعادة رفع، وحجمه ٣ ميغابايت بدل ٨٢ (كانت صور الدعاية والبروفايل تُحشر
   في الحزمة). الشبكة شرطٌ في الحالتين — التطبيق لا يعمل بلا إنترنت أصلاً. */
const config: CapacitorConfig = {
  appId: "com.adrenalinehealthy.app",
  appName: "Adrenaline Healthy",
  webDir: "android-shell",
  server: { url: "https://adrenalinehealthy.com", androidScheme: "https", cleartext: false },
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
