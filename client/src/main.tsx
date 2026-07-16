import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { convex } from "./lib/convex";
import { purgeLegacyIdentity } from "./lib/customerIdentity";
import App from "./App";
import "./index.css";

// 🧹 هوية العميل بقت في sessionStorage (تُمسح عند إغلاق التطبيق). العملاء
//    الحاليون رقمهم متخزّن في localStorage من النسخة القديمة — نمسحه مرة
//    واحدة، وإلا فضل محفوظاً على أجهزتهم بلا قارئ.
purgeLegacyIdentity();

createRoot(document.getElementById("root")!).render(
  <ConvexProvider client={convex}>
    <div dir="rtl" className="rtl">
      <App />
    </div>
  </ConvexProvider>,
);
