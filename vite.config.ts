import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

const appBuildId =
  process.env.COMMIT_REF ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.RENDER_GIT_COMMIT ||
  new Date().toISOString();

const appVersionPlugin = {
  name: "adrenaline-app-version",
  generateBundle(this: any) {
    this.emitFile({
      type: "asset",
      fileName: "app-version.json",
      source: JSON.stringify({ version: appBuildId }),
    });
  },
};

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    metaImagesPlugin(),
    appVersionPlugin,
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // ✅ react/wouter فقط في حزمة vendor ثابتة — كل صفحة تحتاجهما.
    //
    // ⚠️ لا تُضِف recharts/xlsx هنا. تسمية حزمة يدوياً تجعلها جزءاً من رسم
    //    استيراد الدخول، فيُضاف لها `modulepreload` في index.html وتُحمَّل على
    //    كل زيارة للموقع العام (كانت 103KB من recharts لكل زائر) رغم أنها
    //    لا تُستخدم إلا في لوحة التحكم. اتركهما لتقسيم Vite التلقائي
    //    ليُحمَّلا مع الصفحة الكسولة التي تستوردهما.
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "wouter"],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    hmr: {
      path: "/vite-hmr",
    },
  },
});
