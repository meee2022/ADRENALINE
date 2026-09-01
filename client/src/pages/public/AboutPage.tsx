/**
 * @file client/src/pages/public/AboutPage.tsx
 * @description Company profile — bilingual (AR/EN), printable, with real meal images
 */
import * as React from "react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { MessageCircle, Printer, Globe } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";

/* ─── Brand tokens ─── */
const B = {
  brand:  "#3AC7F4",
  accent: "#0E76AC",
  ink:    "#0E2A4A",
  ink2:   "#2D4A67",
  muted:  "#6A7E91",
  bg:     "#FFFFFF",
  bg2:    "#EAF3FB",
  surf:   "#F2F8FC",
  line:   "#D9E6F1",
};
const SD = "0 1px 2px rgba(14,42,74,.05),0 10px 22px -10px rgba(14,42,74,.16),0 34px 64px -26px rgba(14,42,74,.24)";

/* ─── Featured meals (stable local assets, safe on Netlify and in print) ─── */
const FEATURED_MEALS = [
  { ar:"سالمون بالعسل",            en:"Honey Glaze Salmon",      img:"/profile/assets/b04419be-2c9d-4dd5-9fa4-c73da87b9067.jpg", cat:"dinner" },
  { ar:"ستيك بزبدة الثوم والبطاطس", en:"Garlic Butter Steak",      img:"/profile/assets/268845a5-f45e-47dc-9cd8-5649da5dcbf1.jpg", cat:"dinner" },
  { ar:"باستا الدجاج بالكاجون",     en:"Cajun Chicken Pasta",      img:"/profile/assets/689035a6-1726-48eb-808b-3eaa52674f7e.jpg", cat:"lunch"  },
  { ar:"سلطة الشمندر",              en:"Beetroot Salad",           img:"/profile/assets/b0e8807a-5ba2-404a-9580-61ca7b00f117.jpg", cat:"snack"  },
  { ar:"سلطة الدجاج",                en:"Chicken Salad",             img:"/profile/assets/f166aaba-8787-44f0-a49b-02190459f903.jpg", cat:"snack"  },
  { ar:"راب الدجاج",                 en:"Chicken Wrap",              img:"/profile/assets/b2812f93-9a05-41cd-be8b-f15e3fdc43be.jpg", cat:"dinner" },
];

/* ─── i18n helper ─── */
type T = { ar: string; en: string };
const t = (x: T, ar: boolean) => ar ? x.ar : x.en;

/* ─── Small reusable pieces ─── */
function Eyebrow({ ar, en, isAr }: { ar:string; en:string; isAr:boolean }) {
  return (
    <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:12, fontWeight:700,
      letterSpacing:"0.2em", color:B.accent, margin:"0 0 14px",
      display:"flex", alignItems:"center", gap:10 }}>
      {t({ar,en},isAr)}
      <span style={{ flex:"0 0 auto", width:40, height:3, background:B.brand, borderRadius:2 }}/>
    </p>
  );
}
function H2({ ar, en, isAr, light }: { ar:string; en:string; isAr:boolean; light?:boolean }) {
  return (
    <h2 style={{ fontFamily:"'Cairo',sans-serif",
      fontSize:"clamp(26px,4vw,46px)", fontWeight:800,
      color: light ? "#fff" : B.ink, lineHeight:1.1, margin:"0 0 20px",
      letterSpacing:"-0.01em" }}>
      {t({ar,en},isAr)}
    </h2>
  );
}
function P({ ar, en, isAr, style }: { ar:string; en:string; isAr:boolean; style?: React.CSSProperties }) {
  return (
    <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:"clamp(14px,1.8vw,17px)",
      lineHeight:1.8, color:B.ink2, margin:"0 0 12px", ...style }}>
      {t({ar,en},isAr)}
    </p>
  );
}
function Card({ children, style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return (
    <div style={{ background:"linear-gradient(158deg,#fff 0%,#ECF5FC 100%)",
      border:`1px solid ${B.line}`, borderRadius:18, padding:"24px 22px",
      boxShadow:SD, ...style }}>
      {children}
    </div>
  );
}
function IcWrap({ children, color, bg }: { children:React.ReactNode; color?:string; bg?:string }) {
  const c = color || B.brand;
  return (
    <div style={{ width:56, height:56, borderRadius:16, flexShrink:0,
      display:"flex", alignItems:"center", justifyContent:"center",
      background: bg || `linear-gradient(145deg,${c}28 0%,${c}10 100%)`,
      boxShadow:`inset 0 1px 0 rgba(255,255,255,.6), 0 6px 18px -6px ${c}55`,
      border:`1.5px solid ${c}25`,
      marginBottom:14 }}>
      {children}
    </div>
  );
}
function Sec({ id, bg, children, style }: { id?:string; bg?:string; children:React.ReactNode; style?:React.CSSProperties }) {
  return (
    <section id={id} style={{ background:bg||B.bg, padding:"64px 0",
      position:"relative", overflow:"hidden", ...style }}>
      <div className="sec-inner" style={{ maxWidth:1080, margin:"0 auto", padding:"0 22px" }}>
        {children}
      </div>
    </section>
  );
}
function CentreHead({ eyeAr,eyeEn, titleAr,titleEn, subAr,subEn, isAr }: any) {
  return (
    <div style={{ textAlign:"center", marginBottom:48 }}>
      <Eyebrow ar={eyeAr} en={eyeEn} isAr={isAr}/>
      <H2 ar={titleAr} en={titleEn} isAr={isAr}/>
      {subAr && <P ar={subAr} en={subEn} isAr={isAr} style={{ maxWidth:560, margin:"0 auto", color:B.muted }}/>}
    </div>
  );
}

/* ─── SVG icons (all self-contained) ─── */
const SVG = ({ children, color, size=24 }: { children: React.ReactNode; color?:string; size?:number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color||B.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const IcPin   = ({ color }:{color?:string}) => <SVG color={color}><path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10z"/><circle cx="12" cy="11" r="2.5"/></SVG>;
const IcNut   = ({ color }:{color?:string}) => <SVG color={color}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" strokeWidth="1.8"/></SVG>;
const IcClk   = ({ color }:{color?:string}) => <SVG color={color}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></SVG>;
const IcTruck = ({ color }:{color?:string}) => <SVG color={color}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v4h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></SVG>;
const IcShld  = ({ color }:{color?:string}) => <SVG color={color}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></SVG>;
const IcLeaf  = ({ color }:{color?:string}) => <SVG color={color}><path d="M2 22s4-2 8-8c3-4.5 4-10 4-10s-6 1-10 5c-3 3-2 13-2 13z"/><path d="M2 22l8-8"/></SVG>;
const IcEye   = ({ color }:{color?:string}) => <SVG color={color}><circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/></SVG>;
const IcBox   = ({ color }:{color?:string}) => <SVG color={color}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></SVG>;
const IcStar  = ({ color }:{color?:string}) => <SVG color={color}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></SVG>;
const IcFlame = ({ color }:{color?:string}) => <SVG color={color}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></SVG>;
const IcCheck = ({ color }: { color:string }) => (
  <svg width="10" height="10" viewBox="0 0 10 10">
    <polyline points="2,5 4,8 8,2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function AboutPage() {
  const { language } = useLanguage();
  useSeo({ title: "من نحن | أدرينالين للوجبات الصحية", description: "أدرينالين — مطبخ وجبات صحية في قطر يقدّم أكل لذيذ محسوب السعرات بإشراف أخصائيي تغذية.", path: "/public/about" });
  const [isAr, setIsAr] = React.useState(language === "ar");
  const [showAllMeals, setShowAllMeals] = React.useState(false);
  const settings = useQuery(api.restaurantSettings.get);
  const publicMeals = useQuery(api.publicMeals.list, {});
  const mealsWithImages = React.useMemo(
    () => (publicMeals || [])
      .filter((meal: any) => Boolean(meal.imageUrl))
      .sort((a: any, b: any) =>
        Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999)
        || String(a.nameEn || a.nameAr || "").localeCompare(String(b.nameEn || b.nameAr || ""))
      ),
    [publicMeals],
  );
  const displayedMeals = showAllMeals ? mealsWithImages : mealsWithImages.slice(0, 12);
  const phone = String(settings?.phone || "97451144366").replace(/\D/g, "");
  const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(isAr ? "مرحباً 👋\nأرغب في الاستفسار عن خدمات أدرينالين." : "Hello 👋\nI'd like to inquire about Adrenaline services.")}`;

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior:"smooth" });
  const handlePrint = () => {
    // Preload meal + branch photos before printing to avoid blank images in Chrome
    const srcs = [
      ...FEATURED_MEALS.map(m => m.img),
      "/promo-adrenaline-lifestyle.png",
      "/profile/assets/b04419be-2c9d-4dd5-9fa4-c73da87b9067.jpg",
      "/profile/assets/268845a5-f45e-47dc-9cd8-5649da5dcbf1.jpg",
    ];
    const imgPromises = srcs.map(src => new Promise<void>(resolve => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve();
      img.onerror = () => resolve(); // resolve even on error
      img.src = src;
    }));
    Promise.all(imgPromises).then(() => window.print());
  };

  const toc = [
    { n:"01", ar:"عن أدرينالين",          en:"About Adrenaline",     id:"about"    },
    { n:"02", ar:"قصتنا",                 en:"Our Story",            id:"story"    },
    { n:"03", ar:"الرؤية والرسالة",       en:"Vision & Mission",     id:"vision"   },
    { n:"04", ar:"قيمنا",                 en:"Our Values",           id:"values"   },
    { n:"05", ar:"فلسفتنا الغذائية",      en:"Food Philosophy",      id:"philo"    },
    { n:"06", ar:"ماذا نقدّم",            en:"What We Offer",        id:"offer"    },
    { n:"07", ar:"من قائمتنا",            en:"From Our Menu",        id:"menu"     },
    { n:"08", ar:"برامج الاشتراكات",      en:"Subscription Plans",   id:"plans"    },
    { n:"09", ar:"الفعاليات والمناسبات",  en:"Events & Catering",    id:"events"   },
    { n:"10", ar:"من مطبخنا إليك",        en:"From Kitchen to You",  id:"process"  },
    { n:"11", ar:"مواقعنا",               en:"Our Locations",        id:"locations"},
    { n:"12", ar:"من مطبخنا",             en:"From Our Kitchen",     id:"gallery"  },
    { n:"13", ar:"لماذا أدرينالين",       en:"Why Adrenaline",       id:"why"      },
    { n:"14", ar:"تواصل معنا",            en:"Contact Us",           id:"contact"  },
  ];

  const catLabel = (cat: string) => {
    const m: Record<string,{ar:string;en:string}> = {
      breakfast:{ar:"إفطار",en:"Breakfast"}, lunch:{ar:"غداء",en:"Lunch"},
      dinner:{ar:"عشاء",en:"Dinner"}, snack:{ar:"سناك",en:"Snack"}, salad:{ar:"سلطة",en:"Salad"},
    };
    return t(m[cat]||{ar:cat,en:cat}, isAr);
  };

  return (
    <PublicLayout>
     <div dir={isAr ? "rtl" : "ltr"} style={{ direction: isAr ? "rtl" : "ltr", textAlign: isAr ? "right" : "left" }}>
      {/* ─── Responsive + Print CSS ─── */}
      <style>{`
        /* ══ MOBILE RESPONSIVE ══ */
        @media (max-width: 768px) {
          /* Cover */
          #cover { padding: 48px 18px !important; min-height: auto !important; }
          .ab-cover-grid { grid-template-columns: 1fr !important; }
          .ab-cover-logo-wrap { display: none !important; }
          #cover h1 { font-size: 28px !important; }

          /* TOC */
          .ab-toc-grid { grid-template-columns: 1fr !important; }
          .ab-toc-intro { display: none !important; }
          .ab-toc-buttons { grid-template-columns: 1fr 1fr !important; }

          /* 2-col sections → 1-col */
          .ab-grid-2 { grid-template-columns: 1fr !important; }

          /* 4-col → 2-col */
          .ab-grid-4 { grid-template-columns: 1fr 1fr !important; }

          /* 3-col → 1-col */
          .ab-grid-3 { grid-template-columns: 1fr !important; }
          /* صورة الفعالية الرئيسية تمتدّ عمودين على الشاشة الواسعة، وعمودٌ
             واحدٌ هنا — وإلا وُلِّد عمودٌ ثانٍ ضمنيّ وخرجت الشبكة عن الشاشة. */
          .ab-ev-lead { grid-column: span 1 !important; }

          /* General section padding */
          section { padding: 40px 0 !important; }
          section > div { padding: 0 14px !important; }

          /* Testimonial cards — ensure text doesn't overflow */
          .ab-grid-3 > div { overflow: hidden !important; word-break: break-word !important; }

          /* Floating buttons */
          .ab-fab { bottom: 16px !important; left: 16px !important; }
        }

        @media (max-width: 480px) {
          .ab-grid-4 { grid-template-columns: 1fr !important; }
          .ab-toc-buttons { grid-template-columns: 1fr !important; }
        }

        @media print {
          /* ══ BASE ══ */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box !important; }
          body, html { background: #fff !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

          /* ══ PREVENT SHRINK-TO-FIT — no element may force the page wider ══ */
          html, body, #root, #root > div, main, main > div {
            width: 100% !important; max-width: 100% !important;
            margin: 0 !important; float: none !important; overflow-x: hidden !important;
          }
          * { max-width: 100% !important; }

          /* ══ HIDE CHROME ══ */
          nav, header, footer, .no-print, #toc { display: none !important; }

          /* ══ RUNNING FOOTER (every page) ══ */
          .print-running-footer {
            display: flex !important;
            position: fixed !important;
            bottom: 0 !important; left: 0 !important; right: 0 !important;
            height: 24px !important;
            background: #0E2A4A !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 0 16px !important;
            z-index: 9999 !important;
          }
          .print-running-footer span {
            font-size: 8px !important; font-weight: 700 !important;
            color: rgba(255,255,255,0.55) !important;
            letter-spacing: 0.12em !important;
            font-family: 'Cairo',sans-serif !important;
          }

          /* ══ SECTIONS — allow content to flow freely ══ */
          section {
            padding: 14px 0 !important;
            margin: 0 !important;
            background: #fff !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
            overflow: visible !important;
          }
          .sec-inner { padding: 0 16px !important; max-width: 100% !important; overflow: visible !important; }

          /* ══ KEEP RTL/LTR DIRECTION IN PRINT ══ */
          section, .sec-inner, p, h2, h3, h4, li, span, div {
            direction: ${isAr ? "rtl" : "ltr"} !important;
          }
          p, h2, h3, h4, li, .sec-inner > div, .ab-grid-2 > div, .ab-grid-3 > div, .ab-grid-4 > div {
            text-align: ${isAr ? "right" : "left"} !important;
          }
          /* Preserve intentionally centred blocks */
          [style*="textAlign:center"], [style*="textAlign:\"center\""],
          [style*="text-align: center"], #cover, #stats-bar, .print-running-footer {
            text-align: center !important;
          }

          /* ══ FIX ORPHAN HEADINGS — h2 never alone at page bottom ══ */
          h2, h3 {
            page-break-after: avoid !important;
            break-after: avoid !important;
            font-size: 18px !important; font-weight: 800 !important;
            color: #0E2A4A !important;
            padding-bottom: 6px !important;
            border-bottom: 2px solid #3AC7F4 !important;
            margin-bottom: 12px !important;
          }
          h3 { font-size: 13px !important; border-bottom: none !important; }
          h4 { font-size: 12px !important; color: #0E2A4A !important; }
          p  { font-size: 11px !important; line-height: 1.6 !important; color: #2D4A67 !important; }

          /* ══ GRIDS ══ */
          .ab-grid-2 { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .ab-grid-3 { grid-template-columns: repeat(3,1fr) !important; gap: 8px !important; }
          .ab-grid-4 { grid-template-columns: repeat(4,1fr) !important; gap: 8px !important; }

          /* ══ CARDS — clean, no shadow ══ */
          .ab-grid-2 > div,
          .ab-grid-3 > div,
          .ab-grid-4 > div {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: 1px solid #D9E6F1 !important;
            border-radius: 8px !important;
            background: #FAFCFE !important;
            padding: 12px !important;
          }
          /* ══ STATS BAR CELLS — must stay transparent (white text on gradient) ══ */
          #stats-bar .ab-grid-4 > div {
            background: transparent !important;
            border: none !important;
            color: #fff !important;
          }
          #stats-bar .ab-grid-4 > div * { color: #fff !important; }

          /* ══ PAGE MODEL — each main section starts on a fresh page ══
             KEY FIX. Forcing a clean break BEFORE every section stops headings
             from being stranded at the bottom of a page (titles split over two
             pages). Dropping the old break-inside:avoid on whole (tall) sections
             stops their content from being clipped (text cut off) — a block
             taller than one page that is told not to break gets cut. Tall
             sections now flow naturally across pages; only small cards stay
             whole (rule below). The result is a tidy, send-ready PDF. */
          section {
            page-break-before: always !important;
            break-before: page !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          /* Cover is the first page; the stats bar + table of contents ride the
             second page together — never break before these three. */
          #cover, #stats-bar, #toc {
            page-break-before: avoid !important;
            break-before: avoid !important;
          }

          /* A heading (and the centred header block) must never be the last
             thing on a page — glue it to the content that follows. */
          .sec-inner > div:first-child,
          h2, h3, h4 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Remove overflow:hidden from all sections — critical to avoid blank pages */
          section, section > div, section > div > div {
            overflow: visible !important;
          }

          /* ══ COVER — fills full A4 page, content centred ══ */
          #cover {
            background: linear-gradient(145deg, #071830 0%, #0E4070 40%, #0E76AC 75%, #3AC7F4 100%) !important;
            min-height: 25.7cm !important;
            padding: 2cm 1.5cm !important;
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            position: relative !important;
          }
          /* Single centred column in print */
          #cover .ab-cover-grid {
            display: block !important; max-width: 640px !important; margin: 0 auto !important;
            text-align: center !important;
          }
          #cover .ab-cover-grid > div:first-child {
            display: flex !important; flex-direction: column !important; align-items: center !important;
          }
          /* Hide the inline grid logo + faint side heart — use the print brand lockup instead */
          #cover .ab-cover-grid img { display: none !important; }
          #cover .ab-cover-logo-wrap { display: none !important; }

          /* Print brand lockup: official cyan heart + wordmark, centred above title */
          .cover-print-brand {
            display: flex !important; flex-direction: column !important; align-items: center !important;
            gap: 18px !important; margin-bottom: 30px !important;
          }
          .cover-print-brand .cpb-heart { width: 92px !important; height: auto !important; }
          .cover-print-brand .cpb-word  { height: 44px !important; width: auto !important; }

          #cover h1 { font-size: 42px !important; color: #fff !important; line-height: 1.2 !important; text-align: center !important; }
          #cover p  { color: rgba(255,255,255,0.85) !important; font-size: 14px !important; text-align: center !important; margin-left: auto !important; margin-right: auto !important; max-width: 540px !important; }
          #cover span { color: rgba(255,255,255,0.6) !important; }
          /* Centre the CR / location / year meta line */
          #cover .ab-cover-grid > div:first-child > div:last-child { justify-content: center !important; }
          #cover p[style*="letterSpacing"] { color: #3AC7F4 !important; }

          /* ══ STATS BAR ══ */
          #stats-bar {
            background: linear-gradient(135deg, #0E2A4A 0%, #0E76AC 60%, #3AC7F4 100%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            padding: 20px 16px !important;
          }
          #stats-bar * { color: #fff !important; }
          #stats-bar .ab-grid-4 > div { border-right-color: rgba(255,255,255,0.2) !important; }

          /* ══ COVER PHOTO — fit nicely on the title page ══ */
          .ab-cover-photo { max-width: 540px !important; margin-top: 30px !important; }
          .ab-cover-photo img { height: 200px !important; }

          /* ══ GALLERY — real branch photos (section gets its own page) ══ */
          #gallery .ab-gallery { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
          #gallery figure { break-inside: avoid !important; page-break-inside: avoid !important; box-shadow: none !important; border: 1px solid #D9E6F1 !important; }
          #gallery figure > div { height: 200px !important; }
          #gallery img { display: block !important; visibility: visible !important; opacity: 1 !important; width: 100% !important; height: 200px !important; object-fit: cover !important; }
          #gallery figcaption { font-size: 11px !important; padding: 8px 10px !important; }

          /* ══ TESTIMONIALS / MENU — each gets its own page; only the small
             cards inside must stay whole so none is split across a page edge. */
          #reviews .ab-grid-3 > div { break-inside: avoid !important; page-break-inside: avoid !important; }
          #menu .ab-grid-3 > div { break-inside: avoid !important; page-break-inside: avoid !important; }

          /* ══ MEAL IMAGES ══ */
          #menu img {
            display: block !important; visibility: visible !important;
            opacity: 1 !important; width: 100% !important;
            height: 110px !important; object-fit: cover !important;
          }
          #menu div[style*="height:180px"],
          #menu div[style*="height: 180px"] { height: 110px !important; overflow: hidden !important; }

          /* ══ OFFER PILLS ══ */
          #offer .sec-inner > div > div {
            padding: 5px 12px !important; font-size: 10px !important;
            border: 1px solid #D9E6F1 !important; background: #F2F8FC !important;
            color: #0E2A4A !important; border-radius: 50px !important;
          }

          /* ══ PLANS — all same style in print ══ */
          #plans .ab-grid-3 > div,
          #plans .ab-grid-3 > div * { color: #0E2A4A !important; background: #FAFCFE !important; }
          #plans .ab-grid-3 > div a {
            background: #0E76AC !important; color: #fff !important;
            font-size: 10px !important; padding: 7px 0 !important; border-radius: 50px !important;
          }

          /* ══ CONTACT ══ */
          #contact, #contact * { background-color: transparent !important; color: #0E2A4A !important; }
          #contact { background: #fff !important; border-top: 4px solid #0E76AC !important; padding-top: 24px !important; }
          #contact > .sec-inner > .ab-grid-2 > div:last-child > div {
            background: #EAF3FB !important; border: 1px solid #D9E6F1 !important;
          }
          #contact a[href*="wa.me"] {
            background: #0E76AC !important; color: #fff !important;
            padding: 10px 20px !important; border-radius: 50px !important;
            display: inline-flex !important; text-decoration: none !important;
          }
          #contact a[style*="rgba(255,255,255"] {
            background: #EAF3FB !important; border: 1px solid #D9E6F1 !important; color: #0E76AC !important;
          }
          #contact img { opacity: 0.35 !important; filter: none !important; }

          /* ══ QR: show in print only ══ */
          .print-only { display: block !important; }

          /* ══ REMOVE DECORATIVE ELEMENTS ══ */
          div[style*="pointer-events: none"],
          div[style*="radial-gradient"] { display: none !important; }
          [style*="min-height:380px"], [style*="minHeight:380px"] { min-height: 0 !important; }

          /* ══ STORY LOGO BOX — hide in print, saves vertical space ══ */
          .story-logo-box { display: none !important; }
          #story .ab-grid-2 { grid-template-columns: 1fr !important; }

          /* ══ EYEBROW LABELS ══ */
          p[style*="0.2em"], p[style*="0.25em"] {
            font-size: 8px !important; color: #0E76AC !important;
          }

          /* ══ REMOVE LARGE PADDING FROM CENTRED HEADERS ══ */
          div[style*="textAlign:\"center\""][style*="marginBottom:48px"],
          div[style*="textAlign:center"][style*="marginBottom:48px"],
          div[style*="text-align: center"][style*="margin-bottom: 48px"] {
            margin-bottom: 12px !important;
          }
          /* Reduce all large margins in print */
          div[style*="marginBottom:48"], div[style*="marginBottom: 48"],
          div[style*="marginTop:48"],   div[style*="marginTop: 48"],
          div[style*="marginBottom:40"], div[style*="marginTop:40"] {
            margin-bottom: 12px !important;
            margin-top: 12px !important;
          }

          /* ══ ICON WRAP — smaller in print ══ */
          div[style*="width:56px"] { width: 36px !important; height: 36px !important; border-radius: 8px !important; }
          div[style*="width:56px"] svg { width: 18px !important; height: 18px !important; }

          /* ══ BODY PADDING for footer ══ */
          body { padding-bottom: 28px !important; }
        }

        @page        { size: A4 portrait; margin: 1.2cm 1cm 1.5cm 1cm; }
        @page :first { size: A4 portrait; margin: 0; }
      `}</style>

      {/* ─── Print footer (fixed, shows on every printed page) ─── */}
      <div className="print-running-footer" style={{ display:"none" }}>
        <span>{isAr ? "أدرينالين للأكل الصحي — الملف التعريفي 2026" : "Adrenaline Healthy Food — Company Profile 2026"}</span>
        <img src="/adrenaline-logo.png" alt="Adrenaline" style={{ height:14, filter:"brightness(0) invert(0.6)" }}/>
        <span>{isAr ? "الدوحة، قطر · 195910/01" : "Doha, Qatar · CR 195910/01"}</span>
      </div>

      {/* ─── Floating action bar ─── */}
      <div className="no-print ab-fab" style={{
        position:"fixed", bottom:90, left:16, zIndex:999,
        display:"flex", flexDirection:"column", gap:10,
      }}>
        <button onClick={handlePrint} title={isAr?"طباعة":"Print"}
          style={{ width:44, height:44, borderRadius:"50%", border:`1px solid ${B.line}`,
            background:"#fff", cursor:"pointer", display:"flex",
            alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 14px rgba(14,42,74,.15)" }}>
          <Printer size={18} color={B.accent}/>
        </button>
        <button onClick={() => setIsAr(!isAr)} title="EN / عربي"
          style={{ width:44, height:44, borderRadius:"50%", border:`1px solid ${B.line}`,
            background:"#fff", cursor:"pointer", display:"flex",
            alignItems:"center", justifyContent:"center",
            boxShadow:"0 4px 14px rgba(14,42,74,.15)",
            fontFamily:"'Cairo',sans-serif", fontSize:11, fontWeight:800, color:B.accent }}>
          {isAr ? "EN" : "ع"}
        </button>
      </div>

      {/* ══ 01 COVER ══ */}
      <section id="cover" style={{
        background:`linear-gradient(135deg,#0A2240 0%,${B.accent} 45%,${B.brand} 100%)`,
        padding:"72px 24px", minHeight:380, position:"relative", overflow:"hidden",
        display:"flex", alignItems:"center",
      }}>
        <div style={{ position:"absolute", top:-180, right:-180, width:520, height:520,
          borderRadius:"50%", background:`radial-gradient(circle,rgba(255,255,255,0.18) 0%,transparent 65%)`,
          pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:-100, left:-100, width:400, height:400,
          borderRadius:"50%", background:`radial-gradient(circle,${B.accent}55 0%,transparent 65%)`,
          pointerEvents:"none" }}/>
        {/* Print-only centered brand lockup (official cyan logo + heart) */}
        <div className="cover-print-brand" style={{ display:"none" }}>
          <img src="/heart-logo.png" alt="" className="cpb-heart"/>
          <img src="/adrenaline-logo.png" alt="Adrenaline" className="cpb-word"/>
        </div>
        <div className="ab-cover-grid" style={{ maxWidth:1080, margin:"0 auto", width:"100%",
          display:"grid", gridTemplateColumns:"1fr auto", gap:40, alignItems:"center" }}>
          <div>
            <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:11, fontWeight:700,
              letterSpacing:"0.25em", color:B.brand, marginBottom:18 }}>
              {isAr ? "الملف التعريفي للشركة" : "COMPANY PROFILE"}
            </p>
            <img src="/adrenaline-logo.png" alt="ADRENALINE"
              style={{ height:56, marginBottom:26, filter:"brightness(0) invert(1)" }}/>
            <h1 style={{ fontFamily:"'Cairo',sans-serif",
              fontSize:"clamp(30px,5vw,58px)", fontWeight:800, color:"#fff",
              lineHeight:1.15, margin:"0 0 18px" }}>
              {isAr ? "الأكل الصحي .. خيارٌ يومي" : "Healthy Food .. A Daily Choice"}
            </h1>
            <p style={{ fontFamily:"'Cairo',sans-serif",
              fontSize:"clamp(14px,1.8vw,17px)", color:"rgba(255,255,255,0.72)",
              lineHeight:1.8, maxWidth:520, margin:"0 0 30px" }}>
              {isAr
                ? "وجباتٌ صحية طازجة ومتوازنة، تُحضَّر يوميًا بإشراف اختصاصيي تغذية — في قطر."
                : "Fresh and balanced healthy meals, prepared daily under the supervision of nutritionists — in Qatar."}
            </p>
            <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              {[
                isAr ? "س.ت 195910/01" : "CR 195910/01",
                isAr ? "المرخية، الدوحة، قطر" : "Al Maarkhiya, Doha, Qatar",
                "2026"
              ].map((x,i)=>(
                <React.Fragment key={i}>
                  {i>0&&<span style={{width:3,height:3,borderRadius:"50%",background:"rgba(255,255,255,0.35)"}}/>}
                  <span style={{fontFamily:"'Cairo',sans-serif",fontSize:12,color:"rgba(255,255,255,0.55)"}}>{x}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="ab-cover-logo-wrap" style={{ textAlign:"center" }}>
            <img src="/heart-logo.png" alt="♥"
              style={{ width:120, opacity:0.15, filter:"brightness(0) invert(1)" }}/>
          </div>
        </div>
        {/* Stable local lifestyle photo — framed band, shows on screen + print */}
        <div className="ab-cover-photo" style={{ width:"100%", maxWidth:640, margin:"34px auto 0",
          borderRadius:18, overflow:"hidden", border:"1px solid rgba(255,255,255,0.22)",
          boxShadow:"0 18px 50px -20px rgba(0,0,0,0.55)" }}>
          <img src="/promo-adrenaline-lifestyle.png" alt={isAr ? "أسلوب حياة صحي مع أدرينالين" : "Healthy lifestyle with Adrenaline"}
            style={{ width:"100%", height:230, objectFit:"cover", display:"block" }}
            onError={(e)=>{ const w=e.currentTarget.closest('.ab-cover-photo') as HTMLElement|null; if(w) w.style.display="none"; }}/>
        </div>
      </section>

      {/* ══ STATS BAR ══ */}
      <div id="stats-bar" style={{ background:`linear-gradient(135deg,#0A2240 0%,${B.accent} 50%,${B.brand} 100%)`, padding:"36px 24px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-60, right:-60, width:240, height:240, borderRadius:"50%", background:"rgba(255,255,255,0.04)", pointerEvents:"none" }}/>
        <div className="ab-grid-4" style={{ maxWidth:1080, margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0, textAlign:"center" }}>
          {[
            { num:"200+", icon:"👥", unit:{ar:"عميل راضٍ",en:"Happy Clients"}, sub:{ar:"في قطر",en:"Across Qatar"} },
            { num:"90%+", icon:"🔁", unit:{ar:"اشتراكات",en:"Subscriptions"}, sub:{ar:"من إجمالي الطلبات",en:"of total orders"} },
            { num:"5",    icon:"🚀", unit:{ar:"تطبيقات توصيل",en:"Delivery Apps"}, sub:{ar:"طلبات · سنونو · ديليفرو · كيتا · رفيق",en:"Talabat · Snoonu · Deliveroo · Keeta · Rafeeq"} },
            { num:"3",    icon:"📍", unit:{ar:"مواقع تشغيلية",en:"Locations"}, sub:{ar:"الثمامة · المرخية · لوسيل",en:"Al Thumama · Al Maarkhiya · Lusail"} },
          ].map((s,i)=>(
            <div key={i} style={{ padding:"16px 12px", borderRight: i<3?"1px solid rgba(255,255,255,0.15)":"none" }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:"clamp(30px,4vw,48px)", fontWeight:800, color:"#fff", lineHeight:1 }}>{s.num}</div>
              <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.95)", margin:"5px 0 4px" }}>{t(s.unit,isAr)}</div>
              <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:11, color:"rgba(255,255,255,0.55)", lineHeight:1.5 }}>{t(s.sub,isAr)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ 02 TOC ══ */}
      <Sec id="toc" bg={B.bg2}>
        <div className="ab-toc-grid" style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:48, alignItems:"start" }}>
          <div className="ab-toc-intro">
            <Eyebrow ar="الملف التعريفي" en="PROFILE" isAr={isAr}/>
            <H2 ar="المحتويات" en="Contents" isAr={isAr}/>
            <P ar="دليلٌ سريع لأقسام ملف أدرينالين التعريفي."
               en="A quick guide to the sections of Adrenaline's company profile." isAr={isAr}/>
          </div>
          <div className="ab-toc-buttons" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))", gap:10 }}>
            {toc.map(item=>(
              <button key={item.id} onClick={()=>scrollTo(item.id)}
                style={{ background:"#fff", border:`1px solid ${B.line}`,
                  borderRadius:12, padding:"12px 16px",
                  display:"flex", alignItems:"center", gap:12, cursor:"pointer",
                  textAlign:"right" as const, direction:"rtl" as const,
                  transition:"all .2s", boxShadow:"0 2px 6px rgba(14,42,74,.05)" }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=B.brand;(e.currentTarget as HTMLElement).style.transform="translateY(-2px)"}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=B.line;(e.currentTarget as HTMLElement).style.transform="translateY(0)"}}>
                <span style={{ fontFamily:"'Cairo',sans-serif", fontSize:20,
                  fontWeight:800, color:B.brand, minWidth:30 }}>{item.n}</span>
                <span style={{ fontFamily:"'Cairo',sans-serif", fontSize:13,
                  fontWeight:700, color:B.ink, lineHeight:1.3 }}>{t(item,isAr)}</span>
              </button>
            ))}
          </div>
        </div>
      </Sec>

      {/* ══ 03 ABOUT ══ */}
      <Sec id="about">
        <div className="ab-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:56, alignItems:"start" }}>
          <div>
            <Eyebrow ar="من نحن" en="WHO WE ARE" isAr={isAr}/>
            <H2 ar="عن أدرينالين" en="About Adrenaline" isAr={isAr}/>
            <P ar="أدرينالين علامة قطرية متخصّصة في الأكل الصحي، نقدّم وجباتٍ طازجة ومتوازنة تُحضَّر يوميًا بإشراف اختصاصيي تغذية. نجعل الخيار الصحي سهلًا ولذيذًا — في الفرع أو عبر التوصيل في جميع أنحاء قطر."
               en="Adrenaline is a Qatari brand specializing in healthy food, offering fresh and balanced meals prepared daily under the supervision of nutritionists. We make the healthy choice easy and delicious — at our branch or through delivery across Qatar." isAr={isAr}/>
            <div style={{ background:`linear-gradient(150deg,${B.brand} 0%,${B.accent} 70%)`,
              borderRadius:14, padding:"16px 20px", display:"flex",
              alignItems:"center", gap:14, marginTop:20,
              boxShadow:`0 12px 28px ${B.brand}40` }}>
              <img src="/heart-logo.png" alt="" style={{ width:40, height:40,
                filter:"brightness(0) invert(1)", opacity:0.85 }}/>
              <div>
                <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:11,
                  color:"rgba(255,255,255,0.8)", letterSpacing:"0.12em", fontWeight:700 }}>
                  {isAr ? "صُنع في قطر" : "MADE IN QATAR"}
                </div>
                <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:16,
                  fontWeight:800, color:"#fff" }}>
                  {isAr ? "بمعايير غذائية عالية" : "To the Highest Nutritional Standards"}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {[
              { ic:<IcPin/>, ar:"علامة قطرية", en:"Qatari Brand",
                dAr:"مفهومٌ قطري وُلد محليًا ليقدّم تجربة أكل صحي تناسب ذوق المنطقة.",
                dEn:"A Qatari concept born locally to offer a healthy eating experience that suits regional taste." },
              { ic:<IcNut/>, ar:"إشراف تغذوي", en:"Nutrition Supervised",
                dAr:"قوائمنا يصمّمها اختصاصيو تغذية بسعراتٍ ونِسبٍ غذائية محسوبة.",
                dEn:"Our menus are designed by nutritionists with calculated calories and macros." },
              { ic:<IcClk/>, ar:"تحضير يومي", en:"Daily Prep",
                dAr:"وجباتٌ طازجة تُحضَّر كل يوم في مطبخنا، بلا حفظٍ طويل.",
                dEn:"Fresh meals prepared every day in our kitchen — no long storage." },
              { ic:<IcTruck/>, ar:"توصيل في كل قطر", en:"Qatar-Wide Delivery",
                dAr:"نوصل الخيار الصحي إلى باب عملائنا في جميع أنحاء قطر.",
                dEn:"We deliver the healthy choice to our customers' doors across Qatar." },
            ].map((f,i)=>(
              <Card key={i}>
                <IcWrap>{f.ic}</IcWrap>
                <h4 style={{ fontFamily:"'Cairo',sans-serif", fontSize:14, fontWeight:800,
                  color:B.ink, margin:"0 0 7px" }}>{t({ar:f.ar,en:f.en},isAr)}</h4>
                <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:12, lineHeight:1.65,
                  color:B.ink2, margin:0 }}>{t({ar:f.dAr,en:f.dEn},isAr)}</p>
              </Card>
            ))}
          </div>
        </div>
      </Sec>

      {/* ══ 04 STORY ══ */}
      <Sec id="story" bg={B.bg2}>
        <div className="ab-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:56, alignItems:"center" }}>
          <div>
            <Eyebrow ar="رحلتنا" en="OUR JOURNEY" isAr={isAr}/>
            <H2 ar="قصتنا" en="Our Story" isAr={isAr}/>
            <P ar="بدأت أدرينالين من قناعةٍ بسيطة: أنّ الطعام الصحي يجب أن يكون متاحًا، لذيذًا، وملائمًا لإيقاع الحياة اليومي. من هذه الفكرة وُلِد مطبخٌ يحضّر وجباتٍ متوازنة طازجة، وثلاجةٌ جاهزة تتيح للعميل أن يختار وجبته الصحية في ثوانٍ."
               en="Adrenaline started from a simple belief: that healthy food should be accessible, delicious, and fit for daily life. From this idea, a kitchen was born that prepares fresh balanced meals, and a ready-to-grab fridge that lets customers pick their healthy meal in seconds." isAr={isAr}/>
            <p style={{ fontFamily:"'Cairo',sans-serif",
              fontSize:"clamp(20px,3vw,34px)", fontWeight:800,
              color:B.brand, lineHeight:1.3, margin:"20px 0 0" }}>
              {isAr ? "نجعل الخيار الصحي متاحًا للجميع" : "Making Healthy Food Accessible to All"}
            </p>
          </div>
          <div style={{ borderRadius:22, overflow:"hidden", boxShadow:SD,
            background:B.surf, minHeight:260, display:"flex",
            alignItems:"center", justifyContent:"center", position:"relative" }}
            className="story-logo-box">
            <img src="/adrenaline-story-meals.jpeg"
              alt={isAr ? "وجبات أدرينالين الصحية بتغليفها المميز" : "Adrenaline healthy meals in signature packaging"}
              loading="lazy"
              style={{ width:"100%", height:320, objectFit:"cover", objectPosition:"center", display:"block" }}/>
            <div aria-hidden="true" style={{ position:"absolute", inset:0,
              background:"linear-gradient(180deg,transparent 62%,rgba(14,42,74,.18) 100%)",
              pointerEvents:"none" }}/>
          </div>
        </div>
      </Sec>

      {/* ══ 05 VISION & MISSION ══ */}
      <Sec id="vision">
        <CentreHead eyeAr="توجّهنا" eyeEn="OUR DIRECTION"
          titleAr="الرؤية والرسالة" titleEn="Vision & Mission" isAr={isAr}/>
        <div className="ab-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:22 }}>
          {[
            { kAr:"الرؤية", kEn:"Vision",
              tAr:"الخيار الأول للأكل الصحي", tEn:"The First Choice for Healthy Food",
              dAr:"أن نكون الخيار الأول للأكل الصحي في قطر والمنطقة، وأن نجعل نمط الحياة الصحي في متناول الجميع.",
              dEn:"To be the first choice for healthy food in Qatar and the region, and to make a healthy lifestyle accessible to everyone." },
            { kAr:"الرسالة", kEn:"Mission",
              tAr:"وجبات متوازنة بإشراف تغذوي", tEn:"Balanced Meals Under Nutritional Supervision",
              dAr:"تقديم وجباتٍ صحية لذيذة ومتوازنة، طازجة يوميًا وبإشراف اختصاصي تغذية، عبر تجربةٍ سهلة في الفرع وخدمة توصيل موثوقة.",
              dEn:"Offering delicious and balanced healthy meals, fresh daily under nutritionist supervision, through an easy in-branch experience and reliable delivery service." },
          ].map((vm,i)=>(
            <Card key={i} style={{ padding:"32px 28px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                <img src="/heart-logo.png" alt="" style={{ width:32, height:32 }}/>
                <span style={{ fontFamily:"'Cairo',sans-serif", fontSize:12, fontWeight:800,
                  color:B.brand, letterSpacing:"0.12em" }}>{t({ar:vm.kAr,en:vm.kEn},isAr)}</span>
              </div>
              <h3 style={{ fontFamily:"'Cairo',sans-serif",
                fontSize:"clamp(16px,2.2vw,22px)", fontWeight:800,
                color:B.ink, margin:"0 0 12px" }}>{t({ar:vm.tAr,en:vm.tEn},isAr)}</h3>
              <P ar={vm.dAr} en={vm.dEn} isAr={isAr} style={{ margin:0, fontSize:14 }}/>
            </Card>
          ))}
        </div>
      </Sec>

      {/* ══ 06 VALUES ══ */}
      <Sec id="values" bg={B.bg2}>
        <CentreHead eyeAr="ما نؤمن به" eyeEn="WHAT WE BELIEVE"
          titleAr="قيمنا" titleEn="Our Values" isAr={isAr}/>
        <div className="ab-grid-4" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:18 }}>
          {[
            { color:"#0E76AC", ic:(c:string)=><IcShld color={c}/>, ar:"الجودة", en:"Quality",
              dAr:"مكوّناتٌ مختارة وتحضيرٌ يومي وفق معايير عالية.",
              dEn:"Carefully selected ingredients and daily preparation to the highest standards." },
            { color:"#5BC4A0", ic:(c:string)=><IcLeaf color={c}/>, ar:"النضارة", en:"Freshness",
              dAr:"وجباتٌ تُحضَّر طازجة كل يوم، بلا حفظٍ طويل.",
              dEn:"Meals prepared fresh every day, with no long storage." },
            { color:"#3AC7F4", ic:(c:string)=><IcEye color={c}/>,  ar:"الشفافية", en:"Transparency",
              dAr:"قيمٌ غذائية واضحة وإشرافٌ من اختصاصيي التغذية.",
              dEn:"Clear nutritional values and oversight from nutrition specialists." },
            { color:"#F4A93A", ic:(c:string)=><IcTruck color={c}/>, ar:"الراحة", en:"Convenience",
              dAr:"خيارٌ صحي سريع في الفرع وعبر خدمة التوصيل.",
              dEn:"A quick healthy choice at the branch or via delivery service." },
          ].map((v,i)=>(
            <Card key={i} style={{ textAlign:"center", padding:"28px 18px",
              borderTop:`3px solid ${v.color}` }}>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <IcWrap color={v.color} bg={`linear-gradient(145deg,${v.color}25 0%,${v.color}10 100%)`}>
                  {v.ic(v.color)}
                </IcWrap>
              </div>
              <h4 style={{ fontFamily:"'Cairo',sans-serif", fontSize:16, fontWeight:800,
                color:B.ink, margin:"0 0 8px" }}>{t({ar:v.ar,en:v.en},isAr)}</h4>
              <div style={{ width:36, height:3, background:v.color,
                borderRadius:2, margin:"0 auto 12px" }}/>
              <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:12, lineHeight:1.65,
                color:B.ink2, margin:0 }}>{t({ar:v.dAr,en:v.dEn},isAr)}</p>
            </Card>
          ))}
        </div>
      </Sec>

      {/* ══ 07 PHILOSOPHY ══ */}
      <Sec id="philo">
        <div className="ab-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:56, alignItems:"center" }}>
          <div>
            <Eyebrow ar="لماذا الأكل الصحي" en="WHY HEALTHY FOOD" isAr={isAr}/>
            <H2 ar="فلسفتنا الغذائية" en="Our Food Philosophy" isAr={isAr}/>
            <P ar="نؤمن أنّ الغذاء المتوازن أساس صحة الجسم وطاقته. لذلك نصمّم وجباتنا بسعراتٍ محسوبة ومكوّناتٍ طبيعية، توازن بين الطعم والفائدة لتناسب مختلف الأهداف الصحية."
               en="We believe balanced nutrition is the foundation of body health and energy. That's why we design our meals with calculated calories and natural ingredients, balancing taste and benefit to suit various health goals." isAr={isAr}/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:24 }}>
              {[
                { ar:"متوازن", en:"Balanced", dAr:"نِسبٌ مدروسة من البروتين والكربوهيدرات والدهون.", dEn:"Measured ratios of protein, carbs and fats." },
                { ar:"طازج",   en:"Fresh",    dAr:"مكوّناتٌ طبيعية تُحضَّر في اليوم نفسه.", dEn:"Natural ingredients prepared the same day." },
                { ar:"مدروس", en:"Planned",  dAr:"قوائم يصمّمها اختصاصيو التغذية.", dEn:"Menus designed by nutrition specialists." },
                { ar:"شخصي",  en:"Personal", dAr:"يناسب مختلف الأهداف الغذائية.", dEn:"Suits various nutritional goals." },
              ].map((p,i)=>(
                <div key={i} style={{ background:B.surf, borderRadius:12, padding:"14px 16px",
                  border:`1px solid ${B.line}` }}>
                  <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:14, fontWeight:800,
                    color:B.accent, marginBottom:5 }}>{t({ar:p.ar,en:p.en},isAr)}</div>
                  <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:12, lineHeight:1.6,
                    color:B.ink2 }}>{t({ar:p.dAr,en:p.dEn},isAr)}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Donut chart */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:18 }}>
            <svg viewBox="0 0 200 200" width={200} height={200}
              style={{ filter:`drop-shadow(0 18px 36px ${B.ink}25)` }}>
              {[
                { pct:35, color:B.brand,   offset:0  },
                { pct:40, color:B.accent,  offset:35 },
                { pct:10, color:"#5BC4A0", offset:75 },
                { pct:15, color:"#F4A93A", offset:85 },
              ].map((s,i)=>{
                const r=78,cx=100,cy=100,c=2*Math.PI*r;
                const dash=c*s.pct/100, gap=c-dash;
                const rot=s.offset*360/100-90;
                return <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                  stroke={s.color} strokeWidth={26}
                  strokeDasharray={`${dash} ${gap}`}
                  transform={`rotate(${rot} ${cx} ${cy})`}/>;
              })}
              <circle cx={100} cy={100} r={65} fill="#fff"/>
              <text x={100} y={96} textAnchor="middle"
                style={{ fontFamily:"'Cairo',sans-serif", fontSize:12, fill:B.muted }}>
                {isAr?"طبقٌ":"Balanced"}
              </text>
              <text x={100} y={113} textAnchor="middle"
                style={{ fontFamily:"'Cairo',sans-serif", fontSize:13, fontWeight:700, fill:B.ink }}>
                {isAr?"متوازن":"Plate"}
              </text>
            </svg>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, width:"100%" }}>
              {[
                { color:B.brand,   ar:"بروتين",             en:"Protein"        },
                { color:B.accent,  ar:"كربوهيدرات معقدة",   en:"Complex Carbs"  },
                { color:"#5BC4A0", ar:"خضار وألياف",         en:"Vegetables & Fiber" },
                { color:"#F4A93A", ar:"دهون صحية",           en:"Healthy Fats"   },
              ].map((l,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <span style={{ width:10, height:10, borderRadius:"50%",
                    background:l.color, flexShrink:0 }}/>
                  <span style={{ fontFamily:"'Cairo',sans-serif", fontSize:12,
                    color:B.ink2 }}>{t({ar:l.ar,en:l.en},isAr)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Sec>

      {/* ══ 08 WHAT WE OFFER ══ */}
      <Sec id="offer" bg={B.bg2}>
        <CentreHead eyeAr="قوائمنا" eyeEn="OUR MENUS"
          titleAr="ماذا نقدّم" titleEn="What We Offer" isAr={isAr}/>
        <div style={{ display:"flex", flexWrap:"wrap", gap:12, justifyContent:"center" }}>
          {[
            { ar:"الفطور",              en:"Breakfast"         },
            { ar:"الأطباق الرئيسية",    en:"Main Dishes"       },
            { ar:"السندويتشات واللفائف",en:"Sandwiches & Wraps"},
            { ar:"السلطات",             en:"Salads"            },
            { ar:"الشوربات",            en:"Soups"             },
            { ar:"الحلويات الصحية",     en:"Healthy Desserts"  },
            { ar:"العصائر والسموذي",    en:"Juices & Smoothies"},
            { ar:"الفواكه",             en:"Fruits"            },
          ].map((c,i)=>(
            <div key={i} style={{ background:"#fff", border:`1px solid ${B.line}`,
              borderRadius:50, padding:"11px 22px",
              fontFamily:"'Cairo',sans-serif", fontSize:14, fontWeight:700, color:B.ink,
              boxShadow:"0 2px 6px rgba(14,42,74,.05)" }}>
              {t(c,isAr)}
            </div>
          ))}
        </div>
      </Sec>

      {/* ══ 09 FROM OUR MENU (live names + images from the public menu) ══ */}
      <Sec id="menu">
        <CentreHead eyeAr="مختارات" eyeEn="HIGHLIGHTS"
          titleAr="قائمة وجباتنا" titleEn="Our Meal Menu"
          subAr={mealsWithImages.length ? `${mealsWithImages.length} وجبة بصورها وأسمائها الفعلية` : "وجبات من مطبخنا، متوازنة ولذيذة"}
          subEn={mealsWithImages.length ? `${mealsWithImages.length} real meals with their actual names and photos` : "Meals from our kitchen, balanced and delicious"}
          isAr={isAr}/>
        <div className="ab-grid-3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {(publicMeals === undefined ? FEATURED_MEALS : displayedMeals).map((m:any,i:number)=>(
            <div key={m._id || m.slug || `${m.en}-${i}`} style={{ borderRadius:18, overflow:"hidden",
              background:"linear-gradient(158deg,#fff 0%,#ECF5FC 100%)",
              border:`1px solid ${B.line}`, boxShadow:SD }}>
              <div style={{ height:180, overflow:"hidden", position:"relative" }}>
                <img src={m.imageUrl || m.img} alt={isAr ? (m.nameAr || m.ar) : (m.nameEn || m.en)} loading="lazy" crossOrigin="anonymous"
                  style={{ width:"100%", height:"100%", objectFit:"cover",
                    transition:"transform .4s" }}
                  onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.06)")}
                  onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}
                  onError={(e)=>{
                    const fallback = FEATURED_MEALS[i % FEATURED_MEALS.length].img;
                    if (e.currentTarget.src.endsWith(fallback)) return;
                    e.currentTarget.src = fallback;
                  }}/>
                <div style={{ position:"absolute", top:10, right:10,
                  background:`${B.brand}`, color:"#fff", borderRadius:50,
                  padding:"3px 11px", fontFamily:"'Cairo',sans-serif",
                  fontSize:11, fontWeight:700 }}>
                  {catLabel(m.category || m.cat)}
                </div>
              </div>
              <div style={{ padding:"16px 18px" }}>
                <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:15,
                  fontWeight:800, color:B.ink, marginBottom:3 }}>
                  {isAr ? (m.nameAr || m.ar) : (m.nameEn || m.en)}
                </div>
                <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:12,
                  color:B.muted }}>
                  {isAr ? (m.nameEn || m.en) : (m.nameAr || m.ar)}
                </div>
              </div>
            </div>
          ))}
        </div>
        {publicMeals !== undefined && mealsWithImages.length > 12 && (
          <div style={{ display:"flex", justifyContent:"center", marginTop:32 }}>
            <button type="button" onClick={() => setShowAllMeals((value) => !value)}
              style={{ minHeight:44, padding:"10px 24px", borderRadius:999,
                border:`1px solid ${B.brand}`, background:showAllMeals ? B.surf : B.brand,
                color:showAllMeals ? B.accent : "#fff", cursor:"pointer",
                fontFamily:"'Cairo',sans-serif", fontSize:14, fontWeight:800 }}>
              {showAllMeals
                ? (isAr ? "عرض المختارات فقط" : "Show highlights only")
                : (isAr ? `عرض كل الوجبات (${mealsWithImages.length})` : `Show all meals (${mealsWithImages.length})`)}
            </button>
          </div>
        )}
      </Sec>

      {/* ══ EVENTS & CATERING ══
          الزائر يقرأ الاشتراكات فيظنّ أنها كلُّ ما نصنع. والمطبخ نفسه يغطّي
          فعاليةَ وزارةٍ وحفلَ مئة ضيف، فيُقال ذلك صراحةً وبصور تُثبته. */}
      <Sec id="events">
        <CentreHead eyeAr="خدمات الضيافة" eyeEn="CATERING & EVENTS"
          titleAr="لسنا اشتراكات فقط — نغطّي فعالياتكم"
          titleEn="More Than Subscriptions — We Cater Your Events"
          subAr="من اجتماعٍ في وزارة إلى حفلٍ يضمّ المئات: التخطيط والتحضير والتقديم من مطبخنا نفسه."
          subEn="From a ministry meeting to a hall of hundreds — planned, prepared and served from our own kitchen."
          isAr={isAr}/>

        <div className="ab-grid-3" style={{ display:"grid",
          gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:40 }}>
          {[
            { ar:"الوزارات والجهات الحكومية", en:"Ministries & Government",
              dAr:"اجتماعات ومؤتمرات رسمية بفواتير وأوراق معتمدة",
              dEn:"Official meetings and conferences, with proper invoicing" },
            { ar:"الشركات والمكاتب", en:"Corporate & Offices",
              dAr:"ضيافة يومية أو مناسبة واحدة — نلتزم بموعدكم",
              dEn:"Daily hospitality or a one-off event — on your schedule" },
            { ar:"المؤتمرات والمعارض", en:"Conferences & Expos",
              dAr:"أعداد كبيرة وتقديم منظّم على مدار اليوم",
              dEn:"Large volumes, served in an organised flow all day" },
            { ar:"الأعراس والمناسبات الخاصة", en:"Weddings & Private Events",
              dAr:"قوائم تُفصَّل معكم، وتقديم يليق بالمناسبة",
              dEn:"Menus tailored with you, served as the occasion deserves" },
            { ar:"التخرّج وأعياد الميلاد", en:"Graduations & Birthdays",
              dAr:"بوفيهات وحلويات صحية بأعداد مرنة",
              dEn:"Buffets and healthy desserts, flexible headcounts" },
            { ar:"المدارس والجامعات", en:"Schools & Universities",
              dAr:"شراكات وأيام تعريفية وتغذية للطلاب بخصمٍ خاص",
              dEn:"Partnerships, open days and student nutrition at a special rate" },
            { ar:"الأندية والفعاليات الرياضية", en:"Clubs & Sports Events",
              dAr:"وجباتٌ محسوبة السعرات لطبيعة الحدث",
              dEn:"Calorie-counted catering built for the occasion" },
          ].map((c,i)=>(
            <div key={i} style={{ background:B.surf, border:`1px solid ${B.line}`,
              borderRadius:16, padding:"18px 20px", boxShadow:"0 2px 8px rgba(14,42,74,.05)" }}>
              <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:15, fontWeight:800,
                color:B.ink, marginBottom:6 }}>{t(c,isAr)}</div>
              <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:13, lineHeight:1.7,
                color:B.muted }}>{isAr ? c.dAr : c.dEn}</div>
            </div>
          ))}
        </div>

        {/* الصور دليلٌ لا زينة: الصورة الغائبة تُخفي بطاقتها ولا تترك إطاراً فارغاً. */}
        <div className="ab-grid-3" style={{ display:"grid",
          gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
          {[
            { src:"/events/event-1.jpg", cap:{ar:"شراكة مع مدرسة قطر للعلوم والتكنولوجيا", en:"Partnership with Qatar Science & Technology School"} },
            { src:"/events/event-2.jpg", cap:{ar:"ضيافة مؤتمرات وشركات", en:"Conference & corporate hospitality"} },
            { src:"/events/event-3.jpg", cap:{ar:"بوفيه مناسبات خاصة",   en:"Private event buffet"} },
            { src:"/events/event-4.jpg", cap:{ar:"تجهيز وتقديم في الموقع", en:"On-site setup and service"} },
            { src:"/events/event-5.jpg", cap:{ar:"حلويات وضيافة صحية",   en:"Healthy desserts and hospitality"} },
            { src:"/events/event-6.jpg", cap:{ar:"أعداد كبيرة بترتيب دقيق", en:"Large volumes, precisely organised"} },
          ].map((g,i)=>(
            /* الصورة الأولى تأخذ عمودين وارتفاعاً أكبر: هي أوضح دليلٍ في القسم
               (شعارا الطرفين واللافتة والطلاب في لقطة واحدة)، ولأن القسم قد
               يبدأ بصورةٍ واحدة فلا تبدو تائهةً في ثلث الصفّ. */
            <figure key={i} className={i === 0 ? "ab-ev-lead" : undefined}
              style={{ margin:0, borderRadius:16, overflow:"hidden",
                gridColumn: i === 0 ? "span 2" : undefined,
                border:`1px solid ${B.line}`, boxShadow:SD, background:B.surf }}>
              <div style={{ height:i === 0 ? 340 : 220, overflow:"hidden", background:B.bg2 }}>
                <img src={g.src} alt={t(g.cap,isAr)} loading="lazy" crossOrigin="anonymous"
                  style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                  onError={(e)=>{ const f=e.currentTarget.closest('figure') as HTMLElement|null; if(f) f.style.display="none"; }}/>
              </div>
              <figcaption style={{ padding:"11px 14px", fontFamily:"'Cairo',sans-serif",
                fontSize:12.5, fontWeight:700, color:B.ink, textAlign:"center" }}>
                {t(g.cap,isAr)}
              </figcaption>
            </figure>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"center", marginTop:36 }}>
          <a href={`https://wa.me/${phone}?text=${encodeURIComponent(isAr
            ? "مرحباً 👋\nأرغب في عرض سعر لتغطية فعالية.\nنوع المناسبة:\nالتاريخ:\nعدد الضيوف:"
            : "Hello 👋\nI'd like a quote for event catering.\nOccasion:\nDate:\nGuests:")}`}
            target="_blank" rel="noreferrer"
            style={{ minHeight:48, display:"inline-flex", alignItems:"center", gap:10,
              padding:"13px 30px", borderRadius:999, background:B.accent, color:"#fff",
              textDecoration:"none", fontFamily:"'Cairo',sans-serif", fontSize:15, fontWeight:800,
              boxShadow:"0 10px 24px -10px rgba(14,118,172,.7)" }}>
            {isAr ? "اطلب عرض سعر لفعاليتك" : "Request an event quote"}
          </a>
        </div>
      </Sec>

      {/* ══ 10 PLANS ══ */}
      <Sec id="plans" bg={B.bg2}>
        <CentreHead eyeAr="اشتراكات صحية" eyeEn="HEALTHY SUBSCRIPTIONS"
          titleAr="برامج الوجبات والاشتراكات" titleEn="Meal Plans & Subscriptions" isAr={isAr}/>
        <div className="ab-grid-3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {[
            { badge:{ar:"مرونة",en:"Flexible"},
              title:{ar:"يومي",en:"Daily"},
              desc:{ar:"وجبةٌ أو أكثر تُجهَّز طازجة كل يوم — مثالية للتجربة والمرونة.",
                    en:"One or more meals prepared fresh daily — ideal for trying and flexibility."},
              feats:[{ar:"تنويعٌ يومي للقائمة",en:"Daily menu variety"},
                     {ar:"أخذٌ من الفرع أو توصيل",en:"Pick-up or delivery"},
                     {ar:"دون التزامٍ طويل",en:"No long commitment"}],
              hl:false },
            { badge:{ar:"الأكثر اختيارًا ★",en:"Most Popular ★"},
              title:{ar:"شهري",en:"Monthly"},
              desc:{ar:"برنامجٌ متكامل بإشراف تغذوي وخطةٍ مخصّصة — أفضل قيمة والتزام.",
                    en:"A comprehensive program with nutritional supervision and a personalized plan — best value."},
              feats:[{ar:"خطةٌ مخصّصة حسب الهدف",en:"Goal-based custom plan"},
                     {ar:"إشرافٌ من اختصاصي التغذية",en:"Nutritionist supervision"},
                     {ar:"توصيلٌ يومي طوال الشهر",en:"Daily delivery all month"}],
              hl:true },
            { badge:{ar:"توازن",en:"Balance"},
              title:{ar:"أسبوعي",en:"Weekly"},
              desc:{ar:"خطة 5–6 أيام بوجباتٍ متنوّعة — توازنٌ وتنويع طوال الأسبوع.",
                    en:"A 5–6 day plan with varied meals — balance and variety throughout the week."},
              feats:[{ar:"قائمةٌ أسبوعية متجدّدة",en:"Renewed weekly menu"},
                     {ar:"توصيلٌ منتظم",en:"Regular delivery"},
                     {ar:"توازنٌ غذائي مدروس",en:"Planned nutritional balance"}],
              hl:false },
          ].map((pl,i)=>(
            <div key={i} style={{
              background: pl.hl
                ? `linear-gradient(155deg,${B.accent} 0%,${B.ink} 100%)`
                : "linear-gradient(158deg,#fff 0%,#ECF5FC 100%)",
              border:`2px solid ${pl.hl ? B.brand : B.line}`,
              borderRadius:22, padding:"30px 26px", position:"relative",
              boxShadow: pl.hl ? `0 20px 50px ${B.accent}50` : SD,
            }}>
              {pl.hl && (
                <div style={{ position:"absolute", top:-13, right:22,
                  background:B.brand, color:B.ink, borderRadius:50,
                  padding:"3px 14px", fontFamily:"'Cairo',sans-serif",
                  fontSize:11, fontWeight:800 }}>
                  {isAr ? "أفضل قيمة" : "Best Value"}
                </div>
              )}
              <span style={{ fontFamily:"'Cairo',sans-serif", fontSize:11, fontWeight:700,
                letterSpacing:"0.15em",
                color: pl.hl ? "rgba(255,255,255,0.65)" : B.brand }}>
                {t(pl.badge,isAr)}
              </span>
              <h3 style={{ fontFamily:"'Cairo',sans-serif",
                fontSize:"clamp(24px,3.5vw,36px)", fontWeight:800,
                color: pl.hl ? "#fff" : B.ink, margin:"6px 0 12px", lineHeight:1 }}>
                {t(pl.title,isAr)}
              </h3>
              <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:13, lineHeight:1.7,
                color: pl.hl ? "rgba(255,255,255,0.78)" : B.ink2,
                margin:"0 0 20px" }}>{t(pl.desc,isAr)}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                {pl.feats.map((f,j)=>(
                  <div key={j} style={{ display:"flex", alignItems:"center", gap:9 }}>
                    <span style={{ width:18, height:18, borderRadius:"50%", flexShrink:0,
                      background: pl.hl ? "rgba(255,255,255,0.18)" : `${B.brand}22`,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <IcCheck color={pl.hl?"#fff":B.brand}/>
                    </span>
                    <span style={{ fontFamily:"'Cairo',sans-serif", fontSize:12,
                      color: pl.hl ? "rgba(255,255,255,0.82)" : B.ink2 }}>{t(f,isAr)}</span>
                  </div>
                ))}
              </div>
              <a href={waLink} target="_blank" rel="noopener noreferrer" style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                marginTop:24, padding:"12px 0", borderRadius:50,
                background: pl.hl ? "#fff" : `linear-gradient(135deg,${B.brand},${B.accent})`,
                color: pl.hl ? B.ink : "#fff",
                fontFamily:"'Cairo',sans-serif", fontSize:13, fontWeight:800,
                textDecoration:"none",
              }}>
                <MessageCircle size={15}/>
                {isAr ? "اشترك الآن" : "Subscribe Now"}
              </a>
            </div>
          ))}
        </div>
      </Sec>

      {/* ══ 11 PROCESS ══ */}
      <Sec id="process">
        <CentreHead eyeAr="كيف نعمل" eyeEn="HOW WE WORK"
          titleAr="من مطبخنا إليك" titleEn="From Our Kitchen to You" isAr={isAr}/>
        <div className="ab-grid-4" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:18 }}>
          {[
            { n:"01", color:"#0E76AC", ic:(c:string)=><IcBox color={c}/>,   ar:"المطبخ المركزي — الثمامة", en:"Central Kitchen — Al Thumama",
              dAr:"إنتاجٌ يومي في مطبخنا الرئيسي بالثمامة، وهو القائم على توزيع الوجبات.",
              dEn:"Daily production in our main kitchen in Al Thumama, the hub of meal distribution." },
            { n:"02", color:"#5BC4A0", ic:(c:string)=><IcLeaf color={c}/>,  ar:"تحضيرٌ طازج يوميًا", en:"Fresh Daily Preparation",
              dAr:"وجباتٌ متوازنة بمكوّناتٍ طبيعية تُطهى في يومها.",
              dEn:"Balanced meals with natural ingredients cooked on the same day." },
            { n:"03", color:"#3AC7F4", ic:(c:string)=><IcShld color={c}/>,  ar:"تعبئةٌ بعناية", en:"Careful Packaging",
              dAr:"عبواتٌ صديقة للبيئة تحفظ نضارة الوجبة وقيمتها الغذائية.",
              dEn:"Eco-friendly containers that preserve meal freshness and nutritional value." },
            { n:"04", color:"#F4A93A", ic:(c:string)=><IcTruck color={c}/>, ar:"الفرع والتوصيل", en:"Branch & Delivery",
              dAr:"إلى ثلاجة فرع المرخية وإلى بابك عبر التطبيقات.",
              dEn:"To our Al Maarkhiya branch fridge and to your door via delivery apps." },
          ].map((s,i)=>(
            <Card key={i} style={{ textAlign:"center", padding:"28px 18px",
              borderTop:`3px solid ${s.color}` }}>
              <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:30, fontWeight:800,
                color:s.color, opacity:0.3, lineHeight:1, marginBottom:6 }}>{s.n}</div>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <IcWrap color={s.color} bg={`linear-gradient(145deg,${s.color}25 0%,${s.color}10 100%)`}>
                  {s.ic(s.color)}
                </IcWrap>
              </div>
              <h4 style={{ fontFamily:"'Cairo',sans-serif", fontSize:13, fontWeight:800,
                color:B.ink, margin:"0 0 8px", lineHeight:1.4 }}>{t({ar:s.ar,en:s.en},isAr)}</h4>
              <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:12, lineHeight:1.65,
                color:B.ink2, margin:0 }}>{t({ar:s.dAr,en:s.dEn},isAr)}</p>
            </Card>
          ))}
        </div>
      </Sec>

      {/* ══ 12 LOCATIONS ══ */}
      <Sec id="locations" bg={B.bg2}>
        <CentreHead eyeAr="شبكتنا التشغيلية" eyeEn="OUR NETWORK"
          titleAr="مواقعنا" titleEn="Our Locations" isAr={isAr}/>
        <div className="ab-grid-3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {[
            { bAr:"الإنتاج والتوزيع", bEn:"Production & Distribution",
              tAr:"المطبخ الرئيسي — الثمامة", tEn:"Central Kitchen — Al Thumama",
              dAr:"المطبخ المركزي الذي تُحضَّر فيه الوجبات يوميًا وتُوزَّع منه على الفرع وخدمات التوصيل في جميع أنحاء قطر.",
              dEn:"The central kitchen where meals are prepared daily and distributed to branches and delivery services across Qatar." },
            { bAr:"بيع وأخذ مباشر", bEn:"Direct Sales & Pick-up",
              tAr:"فرع المرخية — الدوحة", tEn:"Al Maarkhiya Branch — Doha",
              dAr:"نقطة البيع والأخذ المباشر، حيث تختار وجبتك الصحية من ثلاجة العرض في ثوانٍ.",
              dEn:"The direct sales point, where you choose your healthy meal from the display fridge in seconds." },
            { bAr:"بيع وأخذ مباشر", bEn:"Direct Sales & Pick-up",
              tAr:"فرع لوسيل — لوسيل", tEn:"Lusail Branch — Lusail",
              dAr:"فرعنا في مدينة لوسيل، يقدّم التجربة نفسها من الاختيار المباشر للوجبات الصحية الطازجة.",
              dEn:"Our branch in Lusail City, offering the same experience of directly choosing fresh healthy meals." },
          ].map((loc,i)=>(
            <Card key={i} style={{ padding:"26px 22px" }}>
              <span style={{ display:"inline-block", background:`${B.brand}18`,
                color:B.accent, borderRadius:50, padding:"3px 12px",
                fontFamily:"'Cairo',sans-serif", fontSize:11, fontWeight:700, marginBottom:12 }}>
                {t({ar:loc.bAr,en:loc.bEn},isAr)}
              </span>
              <h3 style={{ fontFamily:"'Cairo',sans-serif", fontSize:16, fontWeight:800,
                color:B.ink, margin:"0 0 10px" }}>{t({ar:loc.tAr,en:loc.tEn},isAr)}</h3>
              <P ar={loc.dAr} en={loc.dEn} isAr={isAr} style={{ margin:0, fontSize:13 }}/>
            </Card>
          ))}
        </div>
        <div style={{ marginTop:28, textAlign:"center",
          fontFamily:"'Cairo',sans-serif", fontSize:13, color:B.muted }}>
          {isAr
            ? "متوفّرون عبر تطبيقات التوصيل: طلبات · سنونو · ديليفرو · كيتا · رفيق"
            : "Available on delivery apps: Talabat · Snoonu · Deliveroo · Keeta · Rafeeq"}
        </div>
      </Sec>

      {/* ══ GALLERY — real Adrenaline meal photography ══ */}
      <Sec id="gallery">
        <CentreHead eyeAr="من مطبخنا" eyeEn="FROM OUR KITCHEN"
          titleAr="جودة تراها في كل طبق" titleEn="Quality You Can See"
          subAr="صور حقيقية من أطباق أدرينالين التي نحضّرها بعناية"
          subEn="Real Adrenaline dishes, prepared with care"
          isAr={isAr}/>
        <div className="ab-grid-2 ab-gallery" style={{ display:"grid",
          gridTemplateColumns:"1fr 1fr", gap:20 }}>
          {[
            { src:"/profile/assets/b04419be-2c9d-4dd5-9fa4-c73da87b9067.jpg", cap:{ar:"مكونات طازجة وتقديم متوازن", en:"Fresh ingredients, balanced presentation"} },
            { src:"/profile/assets/268845a5-f45e-47dc-9cd8-5649da5dcbf1.jpg", cap:{ar:"بروتين محسوب وخضروات يومية", en:"Portioned protein and daily vegetables"} },
          ].map((g,i)=>(
            <figure key={i} style={{ margin:0, borderRadius:18, overflow:"hidden",
              border:`1px solid ${B.line}`, boxShadow:SD, background:B.surf }}>
              <div style={{ height:300, overflow:"hidden", background:B.bg2 }}>
                <img src={g.src} alt={t(g.cap,isAr)} crossOrigin="anonymous"
                  style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                  onError={(e)=>{ const f=e.currentTarget.closest('figure') as HTMLElement|null; if(f) f.style.display="none"; }}/>
              </div>
              <figcaption style={{ padding:"12px 16px", fontFamily:"'Cairo',sans-serif",
                fontSize:13, fontWeight:700, color:B.ink, textAlign:"center" }}>
                {t(g.cap,isAr)}
              </figcaption>
            </figure>
          ))}
        </div>
      </Sec>

      {/* ══ 13 WHY ADRENALINE ══ */}
      <Sec id="why">
        <CentreHead eyeAr="نقاط تميّزنا" eyeEn="WHY CHOOSE US"
          titleAr="لماذا أدرينالين" titleEn="Why Adrenaline" isAr={isAr}/>
        <div className="ab-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
          {[
            { n:"01", color:"#0E76AC", ic:(c:string)=><IcNut color={c}/>, ar:"إشراف تغذوي", en:"Nutrition Supervision",
              dAr:"وجباتٌ يصمّمها اختصاصيو التغذية بسعراتٍ محسوبة.",
              dEn:"Meals designed by nutrition specialists with calculated calories." },
            { n:"02", color:"#3AC7F4", ic:(c:string)=><IcClk color={c}/>, ar:"تحضيرٌ يومي", en:"Daily Preparation",
              dAr:"تحضيرٌ طازج كل يوم، من المطبخ إلى الثلاجة مباشرة.",
              dEn:"Fresh preparation every day, from the kitchen straight to the fridge." },
            { n:"03", color:"#5BC4A0", ic:(c:string)=><IcLeaf color={c}/>, ar:"تنوّعٌ واسع", en:"Wide Variety",
              dAr:"قوائم تناسب كل ذوقٍ وهدف — من الفطور إلى الحلويات.",
              dEn:"Menus for every taste and goal — from breakfast to desserts." },
            { n:"04", color:"#F4A93A", ic:(c:string)=><IcTruck color={c}/>, ar:"توصيلٌ في كل قطر", en:"Qatar-Wide Delivery",
              dAr:"متوفّر عبر أبرز تطبيقات التوصيل في الدولة.",
              dEn:"Available through the leading delivery apps in the country." },
          ].map((w,i)=>(
            <Card key={i} style={{ display:"flex", alignItems:"flex-start",
              gap:18, padding:"26px 24px",
              borderTop:`3px solid ${w.color}` }}>
              <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:38, fontWeight:800,
                color:w.color, opacity:0.18, lineHeight:1, minWidth:46, userSelect:"none" }}>{w.n}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <IcWrap color={w.color} bg={`linear-gradient(145deg,${w.color}25 0%,${w.color}10 100%)`}>
                    {w.ic(w.color)}
                  </IcWrap>
                  <h4 style={{ fontFamily:"'Cairo',sans-serif", fontSize:17, fontWeight:800,
                    color:B.ink, margin:0 }}>{t({ar:w.ar,en:w.en},isAr)}</h4>
                </div>
                <P ar={w.dAr} en={w.dEn} isAr={isAr} style={{ margin:0, fontSize:13, color:B.muted }}/>
              </div>
            </Card>
          ))}
        </div>
      </Sec>

      {/* ══ TESTIMONIALS ══ */}
      <Sec id="reviews" bg={B.bg2}>
        <CentreHead eyeAr="يقولون عنّا" eyeEn="WHAT THEY SAY"
          titleAr="آراء عملائنا" titleEn="Client Reviews"
          subAr="من تجارب حقيقية لعملاء أدرينالين"
          subEn="Real experiences from Adrenaline clients"
          isAr={isAr}/>
        <div className="ab-grid-3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {[
            { ar:"من أفضل قرارات السنة! الوجبات طازجة، السعرات محسوبة بدقة، وساعدتني أخسر ٦ كيلو في شهرين.",
              en:"One of my best decisions this year! Fresh meals, precise calories — helped me lose 6kg in two months.",
              name:"أحمد العنزي", role:{ar:"مشترك أسبوعي",en:"Weekly subscriber"}, avatar:"أ", color:"#0E76AC" },
            { ar:"أفضل اشتراك وجبات جربته في قطر. التوصيل دايم في الموعد والطعم ما يخيب أبداً.",
              en:"Best meal plan I've tried in Qatar. Always on time and the taste never disappoints.",
              name:"سارة المري", role:{ar:"مشتركة شهرية",en:"Monthly subscriber"}, avatar:"س", color:"#5BC4A0" },
            { ar:"خيار الاشتراك الأسبوعي وفّر عليّ وقت ومجهود كبير، وكل وجبة تحس إنها مطبوخة لك بالاسم.",
              en:"The weekly plan saved me incredible time. Every meal feels personally crafted for you.",
              name:"محمد الشمري", role:{ar:"مشترك يومي",en:"Daily subscriber"}, avatar:"م", color:"#F4A93A" },
          ].map((r,i)=>(
            <div key={i} style={{ background:"#fff", borderRadius:20, padding:"24px 20px",
              boxShadow:SD, border:`1px solid ${B.line}`, position:"relative", overflow:"hidden" }}>
              {/* Quote mark — decorative background only */}
              <div style={{ position:"absolute", top:-8, right:isAr?8:undefined, left:isAr?undefined:8,
                fontSize:80, lineHeight:1, color:r.color, opacity:0.07,
                fontFamily:"Georgia,serif", pointerEvents:"none", userSelect:"none",
                zIndex:0 }}>"</div>
              {/* Stars */}
              <div style={{ display:"flex", gap:3, marginBottom:14, position:"relative", zIndex:1 }}>
                {[1,2,3,4,5].map(j=>(
                  <svg key={j} width="15" height="15" viewBox="0 0 24 24" fill="#F4A93A" stroke="none">
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                  </svg>
                ))}
              </div>
              {/* Quote */}
              <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:14, lineHeight:1.85,
                color:B.ink2, margin:"0 0 18px", position:"relative", zIndex:1,
                wordBreak:"keep-all" }}>
                {isAr ? r.ar : r.en}
              </p>
              {/* Divider */}
              <div style={{ height:1, background:B.line, marginBottom:16, position:"relative", zIndex:1 }}/>
              {/* Name + role */}
              <div style={{ display:"flex", alignItems:"center", gap:12, position:"relative", zIndex:1 }}>
                <div style={{ width:42, height:42, borderRadius:"50%", flexShrink:0,
                  background:`linear-gradient(135deg,${r.color}cc,${r.color}88)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:"'Cairo',sans-serif", fontSize:16, fontWeight:800, color:"#fff",
                  boxShadow:`0 4px 12px ${r.color}44` }}>
                  {r.avatar}
                </div>
                <div>
                  <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:14,
                    fontWeight:800, color:B.ink }}>{r.name}</div>
                  <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:11,
                    color:r.color, fontWeight:700 }}>{t(r.role,isAr)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Delivery Apps */}
        <div style={{ marginTop:48, background:"#fff", borderRadius:20,
          padding:"28px 32px", border:`1px solid ${B.line}`, boxShadow:SD }}>
          <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:12, fontWeight:700,
            letterSpacing:"0.18em", color:B.muted, textAlign:"center", marginBottom:20 }}>
            {isAr ? "اطلب وجباتك الآن عبر" : "ORDER NOW VIA"}
          </p>
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center",
            flexWrap:"wrap", gap:16 }}>
            {[
              { ar:"طلبات",   en:"Talabat",   color:"#FF5A00", img:"/app-talabat.png" },
              { ar:"سنونو",   en:"Snoonu",    color:"#8B2FC9", img:"/app-snoonu.png" },
              { ar:"ديليفرو", en:"Deliveroo", color:"#00CCBC", img:"/app-deliveroo.png" },
              { ar:"كيتا",    en:"Keeta",     color:"#E31837", img:"/app-keeta.png" },
              { ar:"رفيق",    en:"Rafeeq",    color:"#0E76AC", img:"/app-rafeeq.png" },
            ].map((app,i)=>(
              <div key={i} style={{ width:128, height:84, borderRadius:16,
                background:"#fff", border:`1px solid ${B.line}`,
                boxShadow:"0 6px 18px -8px rgba(14,42,74,.22)",
                display:"flex", alignItems:"center", justifyContent:"center",
                padding:"12px 16px", overflow:"hidden" }}>
                <img src={app.img} alt={app.en}
                  style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }}
                  onError={(e)=>{
                    const t=e.currentTarget; t.style.display="none";
                    const f=t.nextElementSibling as HTMLElement|null; if(f) f.style.display="block";
                  }}/>
                <span style={{ display:"none", fontFamily:"'Cairo',sans-serif",
                  fontSize:15, fontWeight:900, color:app.color, textAlign:"center" }}>
                  {isAr ? app.ar : app.en}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Sec>

      {/* ══ 14 CONTACT ══ */}
      <Sec id="contact" bg={B.ink}>
        <div className="ab-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:56, alignItems:"start" }}>
          {/* LEFT */}
          <div>
            <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:11, fontWeight:700,
              letterSpacing:"0.25em", color:B.brand, marginBottom:18 }}>
              {isAr ? "تواصل معنا" : "GET IN TOUCH"}
            </p>
            <h2 style={{ fontFamily:"'Cairo',sans-serif",
              fontSize:"clamp(26px,4vw,44px)", fontWeight:800,
              color:"#fff", lineHeight:1.2, margin:"0 0 14px" }}>
              {isAr ? "لنبقَ على تواصل" : "Let's Stay Connected"}
            </h2>
            <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:15, lineHeight:1.8,
              color:"rgba(255,255,255,0.65)", margin:"0 0 24px" }}>
              {isAr ? "للاستفسار، الاشتراك، أو استشارة اختصاصي التغذية"
                     : "For inquiries, subscriptions, or nutrition consultation"}
            </p>

            {/* WhatsApp CTA */}
            <a href={waLink} target="_blank" rel="noopener noreferrer" style={{
              display:"inline-flex", alignItems:"center", gap:10,
              background:"#25D366", color:"#fff",
              padding:"14px 28px", borderRadius:50,
              fontFamily:"'Cairo',sans-serif", fontSize:15, fontWeight:800,
              textDecoration:"none", marginBottom:20,
              boxShadow:"0 8px 24px rgba(37,211,102,0.4)",
            }}>
              <MessageCircle size={18}/>
              {settings?.phone || "+974 5114 4366"}
            </a>

            {/* Social media */}
            <div style={{ marginTop:8 }}>
              <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:11, fontWeight:700,
                color:"rgba(255,255,255,0.4)", letterSpacing:"0.15em", marginBottom:12 }}>
                {isAr ? "تابعنا" : "FOLLOW US"}
              </p>
              <div style={{ display:"flex", gap:10 }}>
                {[
                  { label:"Instagram", icon:"📸", href:"https://www.instagram.com/adrenaline.qa" },
                  { label:"TikTok",    icon:"🎵", href:"https://www.tiktok.com/@adrenaline.qa" },
                  { label:"Snapchat",  icon:"👻", href:"#" },
                ].map((s,i)=>(
                  <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                    style={{ display:"flex", alignItems:"center", gap:6,
                      background:"rgba(255,255,255,0.09)",
                      border:"1px solid rgba(255,255,255,0.14)",
                      borderRadius:50, padding:"8px 14px",
                      fontFamily:"'Cairo',sans-serif", fontSize:12, fontWeight:700,
                      color:"rgba(255,255,255,0.8)", textDecoration:"none" }}>
                    <span>{s.icon}</span>{s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {[
              { lAr:"الموقع", lEn:"📍 Location",
                vAr:"المرخية، الدوحة، قطر", vEn:"Al Maarkhiya, Doha, Qatar" },
              { lAr:"واتساب", lEn:"💬 WhatsApp",
                vAr:settings?.phone||"+974 5114 4366", vEn:settings?.phone||"+974 5114 4366" },
              { lAr:"تطبيقات التوصيل", lEn:"🚀 Delivery Apps",
                vAr:"طلبات · سنونو · ديليفرو · كيتا · رفيق",
                vEn:"Talabat · Snoonu · Deliveroo · Keeta · Rafeeq" },
              { lAr:"السجل التجاري", lEn:"📄 Commercial Reg.",
                vAr:"195910/01", vEn:"195910/01" },
            ].map((row,i)=>(
              <div key={i} style={{ background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.1)", borderRadius:14,
                padding:"14px 20px" }}>
                <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:11, fontWeight:700,
                  color:B.brand, letterSpacing:"0.1em", marginBottom:5 }}>
                  {t({ar:row.lAr,en:row.lEn},isAr)}
                </div>
                <div style={{ fontFamily:"'Cairo',sans-serif", fontSize:14, fontWeight:700,
                  color:"rgba(255,255,255,0.88)", lineHeight:1.6 }}>
                  {t({ar:row.vAr,en:row.vEn},isAr)}
                </div>
              </div>
            ))}

            {/* QR for print */}
            <div className="print-only" style={{ display:"none",
              background:"#fff", borderRadius:14, padding:"16px",
              textAlign:"center", marginTop:4 }}>
              <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:11, fontWeight:700,
                color:B.accent, marginBottom:8 }}>
                {isAr ? "امسح للتواصل عبر واتساب" : "Scan to contact via WhatsApp"}
              </p>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(waLink)}`}
                alt="QR" style={{ width:100, height:100 }}/>
            </div>

            <div style={{ textAlign:"center", paddingTop:6 }}>
              <img src="/adrenaline-logo.png" alt="Adrenaline"
                style={{ height:30, filter:"brightness(0) invert(1)", opacity:0.25 }}/>
              <p style={{ fontFamily:"'Cairo',sans-serif", fontSize:12, fontWeight:700,
                color:"rgba(255,255,255,0.25)", margin:"6px 0 0" }}>
                {isAr ? "الأكل الصحي .. خيارٌ يومي" : "Healthy Food .. A Daily Choice"}
              </p>
            </div>
          </div>
        </div>
      </Sec>
     </div>
    </PublicLayout>
  );
}
