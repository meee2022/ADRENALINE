import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.adrenalinehealthy.app",
  appName: "Adrenaline Healthy",
  webDir: "dist/public",
  ios: {
    backgroundColor: "#F1F5F9",
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
  android: {
    backgroundColor: "#FFFFFF",
    /* المتجر يرفض النصّ المكشوف؛ والتطبيق كلّه يخاطب Convex عبر HTTPS
       فلا حاجة إليه أصلاً. */
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
