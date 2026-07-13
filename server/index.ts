/**
 * @file server/index.ts
 * @description مضيف Express رفيع. وظيفته الوحيدة تقديم الواجهة:
 *   - في التطوير: Vite كـ middleware
 *   - في الإنتاج: ملفات dist الثابتة (النشر الفعلي على Netlify)
 *
 * ⚠️ لا توجد واجهة REST هنا. كل البيانات تمرّ عبر Convex.
 *    طبقة `/api` القديمة (routes/storage/seed/db + Drizzle) كانت ميتة —
 *    صفر نداءات من الواجهة — ومصدر 140 خطأ أنواع، فحُذفت.
 */
import express from "express";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

(async () => {
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5001", 10);
  httpServer.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();
