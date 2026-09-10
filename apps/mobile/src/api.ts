/** نفس واجهة Convex التي يستخدمها الموقع — لا استعلامات خاصة بالجوال. */
import { ConvexReactClient } from "convex/react";
import Constants from "expo-constants";

/* الواجهة المولّدة (api.js) هي anyApi أصلاً؛ نستخدمها بلا أنواعها كي لا يجمع التطبيق
   شفرة الخادم كلها (ملفات node) أثناء فحص الأنواع. الأسماء نفسها: api.publicMeals.listMeals … */
import { anyApi } from "convex/server";
export const api: any = anyApi;

const extra = (Constants.expoConfig?.extra || {}) as { convexUrl?: string; siteUrl?: string };
export const CONVEX_URL = extra.convexUrl || "https://laudable-mongoose-958.convex.cloud";
export const SITE_URL = extra.siteUrl || "https://adrenalinehealthy.com";

export const convex = new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false });
