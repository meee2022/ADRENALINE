/**
 * @file client/src/lib/seo.ts
 * @description تحديث عنوان/وصف الصفحة + Open Graph + canonical لكل صفحة (SPA).
 *   يحسّن ظهور كل صفحة في جوجل. ملاحظة: زواحف السوشيال (واتساب/فيسبوك) مبتشغّلش JS،
 *   فمعاينة الروابط بتاعتهم بتيجي من الـmeta الثابتة في index.html — التخصيص ده أساسًا لجوجل.
 */
import { useEffect } from "react";

const SITE = "https://adrenalinehealthy.com";
const DEFAULT_DESC =
  "وجبات صحية ولذيذة محسوبة السعرات تُحضَّر يومياً بإشراف أخصائيي تغذية وتوصَّل في كل أنحاء قطر.";
const DEFAULT_IMG = SITE + "/adrenaline-logo-full.png";

function upsertMeta(key: { name?: string; property?: string }, content: string) {
  const sel = key.name ? `meta[name="${key.name}"]` : `meta[property="${key.property}"]`;
  let el = document.head.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    if (key.name) el.setAttribute("name", key.name);
    if (key.property) el.setAttribute("property", key.property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export interface SeoOpts {
  title: string;
  description?: string;
  path?: string;   // مثل "/public/plans"
  image?: string;  // رابط صورة كامل (للوجبات)
}

/** يحدّث عنوان الصفحة وميتاها. استخدمه في أول أي صفحة عامة. */
export function useSeo(opts: SeoOpts) {
  const { title, description, path, image } = opts;
  useEffect(() => {
    const desc = description || DEFAULT_DESC;
    const url = SITE + (path || (typeof window !== "undefined" ? window.location.pathname : "/"));
    const img = image || DEFAULT_IMG;

    document.title = title;
    upsertMeta({ name: "description" }, desc);
    upsertMeta({ property: "og:title" }, title);
    upsertMeta({ property: "og:description" }, desc);
    upsertMeta({ property: "og:url" }, url);
    upsertMeta({ property: "og:image" }, img);
    upsertMeta({ name: "twitter:title" }, title);
    upsertMeta({ name: "twitter:description" }, desc);
    upsertMeta({ name: "twitter:image" }, img);
    upsertCanonical(url);
  }, [title, description, path, image]);
}
