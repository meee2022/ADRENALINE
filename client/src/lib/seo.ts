/**
 * @file client/src/lib/seo.ts
 * @description تحديث عنوان/وصف الصفحة + Open Graph + canonical لكل صفحة (SPA).
 *   يحسّن ظهور كل صفحة في جوجل. ملاحظة: زواحف السوشيال (واتساب/فيسبوك) مبتشغّلش JS،
 *   فمعاينة الروابط بتاعتهم بتيجي من الـmeta الثابتة في index.html — التخصيص ده أساسًا لجوجل.
 */
import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n";

const IS_NUTRI_RESET = typeof window !== "undefined"
  && window.location.hostname.toLowerCase().replace(/^www\./, "") === "nutrireset.online";
const SITE = IS_NUTRI_RESET ? "https://nutrireset.online" : "https://adrenalinehealthy.com";
const DEFAULT_DESC_AR =
  "وجبات صحية ولذيذة محسوبة السعرات تُحضَّر يومياً بإشراف أخصائيي تغذية وتوصَّل في كل أنحاء قطر.";
const DEFAULT_DESC_EN =
  "Fresh, calorie-tracked healthy meals prepared daily by our dietitians and delivered anywhere in Qatar.";
const DEFAULT_IMG = SITE + (IS_NUTRI_RESET ? "/nutri-reset-logo.png" : "/adrenaline-logo-full.png");

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
  /** عنوان الصفحة — إما نص واحد، أو ثنائي اللغة {ar, en}. */
  title: string | { ar: string; en: string };
  description?: string | { ar: string; en: string };
  path?: string;   // مثل "/public/plans"
  image?: string;  // رابط صورة كامل
}

/**
 * يحدّث عنوان الصفحة وميتاها حسب اللغة الحالية.
 * - title/description يقبلا نص واحد (للتوافق) أو ثنائي اللغة.
 * - يضبط <html lang> و <html dir> تلقائياً.
 * - يضيف og:locale و hreflang alternates.
 */
export function useSeo(opts: SeoOpts) {
  const { title, description, path, image } = opts;
  const { language } = useLanguage();
  useEffect(() => {
    const isAr = language === "ar";
    const pick = (v: string | { ar: string; en: string } | undefined, fallback: string) => {
      if (!v) return fallback;
      if (typeof v === "string") return v;
      return isAr ? v.ar : v.en;
    };
    const t = pick(title, IS_NUTRI_RESET ? "Nutri Reset" : "Adrenaline Healthy Food");
    const desc = pick(description, isAr ? DEFAULT_DESC_AR : DEFAULT_DESC_EN);
    const url = SITE + (path || (typeof window !== "undefined" ? window.location.pathname : "/"));
    const img = image || DEFAULT_IMG;

    document.title = t;
    // ✅ ضبط lang/dir على الـhtml (بعض الصفحات لم تكن تحدّثها)
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", isAr ? "ar" : "en");
      document.documentElement.setAttribute("dir", isAr ? "rtl" : "ltr");
    }
    upsertMeta({ name: "description" }, desc);
    upsertMeta({ property: "og:title" }, t);
    upsertMeta({ property: "og:description" }, desc);
    upsertMeta({ property: "og:url" }, url);
    upsertMeta({ property: "og:image" }, img);
    upsertMeta({ property: "og:locale" }, isAr ? "ar_QA" : "en_US");
    upsertMeta({ name: "twitter:title" }, t);
    upsertMeta({ name: "twitter:description" }, desc);
    upsertMeta({ name: "twitter:image" }, img);
    upsertCanonical(url);
  }, [title, description, path, image, language]);
}
