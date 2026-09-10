/**
 * @file HeroEditorial.tsx
 * @description هيرو «تحريري» هادئ: خلفية كحلية داكنة، عنوان ثلاثي السطور بخطٍّ ثقيل،
 *  زرّان كبسولة، صورة طبق واحدة كبيرة، وبطاقة صغيرة عائمة لطبقٍ حقيقي بسعراته وماكروزه.
 *  اللون الوحيد المضاف هو سماوي البراند؛ الباقي أبيض وكحلي. لا يلمس أي منطق —
 *  كل البيانات تأتيه جاهزة من الصفحة.
 */
import * as React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export interface FeaturedMeal {
  nameAr?: string; nameEn?: string;
  calories?: number; protein?: number; carbs?: number; fats?: number;
  imageUrl?: string;
}

interface Props {
  images: string[];
  /** سطور العنوان — آخر سطر يُلوَّن بالسماوي */
  linesAr: string[]; linesEn: string[];
  subtitleAr: string; subtitleEn: string;
  featured?: FeaturedMeal | null;
  onSubscribeClick: () => void;
  onMenuClick: () => void;
  onSmartPlanClick: () => void;
}

const TRUST = [
  { ar: "+200 مشترك", en: "200+ subscribers" },
  { ar: "3 فروع في قطر", en: "3 branches in Qatar" },
  { ar: "توصيل يومي", en: "Daily delivery" },
];

const CYAN = "#3CC4F0";

export function HeroEditorial({
  images, linesAr, linesEn, subtitleAr, subtitleEn, featured,
  onSubscribeClick, onMenuClick, onSmartPlanClick,
}: Props) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const lines = isRtl ? linesAr : linesEn;

  const slides = React.useMemo(() => images.filter(Boolean), [images]);
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as any },
  });

  const macro = (v: number | undefined, label: string) =>
    typeof v === "number" && v > 0 ? (
      <div className="flex flex-col items-center leading-none">
        <span className="text-[13px] font-black text-[#0F1516]" style={{ fontVariantNumeric: "tabular-nums" }}>{v}g</span>
        <span className="text-[9px] font-semibold tracking-[0.12em] text-[#6B7C8C] mt-1">{label}</span>
      </div>
    ) : null;

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      className="relative w-full overflow-hidden"
      style={{
        background: "radial-gradient(1200px 600px at 85% 10%, rgba(60,196,240,0.16), transparent 60%), linear-gradient(180deg, #0B2138 0%, #07131F 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-10 pb-16 md:pt-16 md:pb-20 lg:pt-20">
        <div className="grid items-center gap-10 lg:gap-14 lg:grid-cols-[1.05fr_1fr]">

          {/* ── النص ── */}
          <div className="text-center lg:text-start">
            <motion.div {...fadeUp(0)}
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: CYAN, boxShadow: `0 0 0 4px ${CYAN}33` }} />
              <span className="text-[11px] md:text-xs font-bold tracking-wide text-white/80">
                {isRtl ? "قطر · تُحضَّر يومياً · بإشراف أخصائيي تغذية" : "Qatar · Cooked daily · Nutritionist-supervised"}
              </span>
            </motion.div>

            <motion.h1 {...fadeUp(0.08)}
              className="font-black text-white tracking-tight"
              style={{ fontFamily: "'Cairo',sans-serif", fontSize: "clamp(34px, 5.4vw, 72px)", lineHeight: 1.08 }}>
              {lines.map((l, i) => (
                <span key={i} className="block" style={i === lines.length - 1 ? { color: CYAN } : undefined}>{l}</span>
              ))}
            </motion.h1>

            <motion.p {...fadeUp(0.16)}
              className="mt-5 md:mt-6 text-base md:text-lg leading-relaxed text-white/70 mx-auto lg:mx-0"
              style={{ maxWidth: 520 }}>
              {isRtl ? subtitleAr : subtitleEn}
            </motion.p>

            <motion.div {...fadeUp(0.24)} className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <button onClick={onSubscribeClick}
                className="h-12 md:h-14 px-7 md:px-8 rounded-full font-black text-[15px] md:text-base inline-flex items-center gap-2 transition-transform hover:scale-[1.03] active:scale-[0.98]"
                style={{ background: "#fff", color: "#0B2138", boxShadow: "0 12px 30px -10px rgba(255,255,255,0.35)" }}>
                {isRtl ? "احصل على خطتك" : "Get your plan"}
                {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
              <button onClick={onMenuClick}
                className="h-12 md:h-14 px-7 md:px-8 rounded-full font-bold text-[15px] md:text-base text-white transition-colors hover:bg-white/10"
                style={{ border: "1.5px solid rgba(255,255,255,0.35)" }}>
                {isRtl ? "استكشف القائمة" : "Explore the menu"}
              </button>
              <button onClick={onSmartPlanClick}
                className="h-11 px-3 rounded-full text-sm font-bold inline-flex items-center gap-1.5 transition-colors hover:bg-white/5"
                style={{ color: CYAN }}>
                <Sparkles className="h-4 w-4" />
                {isRtl ? "خطتي الذكية" : "Smart plan"}
              </button>
            </motion.div>

            <motion.ul {...fadeUp(0.32)}
              className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-[13px] font-semibold text-white/55">
              {TRUST.map((t, i) => (
                <li key={i} className="flex items-center gap-5">
                  {i > 0 && <span className="h-1 w-1 rounded-full bg-white/30" />}
                  {isRtl ? t.ar : t.en}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* ── الصورة + البطاقة العائمة ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -inset-6 rounded-[40px] pointer-events-none"
              style={{ background: `radial-gradient(60% 60% at 50% 60%, ${CYAN}2E, transparent 70%)`, filter: "blur(30px)" }} />
            <div className="relative overflow-hidden rounded-[28px] md:rounded-[32px] aspect-[4/5] sm:aspect-square"
              style={{ background: "#0F2A44", border: "1px solid rgba(255,255,255,0.08)" }}>
              {slides.map((src, i) => (
                <img key={src} src={src} alt="" loading={i === 0 ? "eager" : "lazy"} decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
                  style={{ opacity: i === idx ? 1 : 0 }} />
              ))}
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(7,19,31,0.55) 100%)" }} />
            </div>

            {featured && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="absolute -bottom-6 rounded-2xl bg-white p-2.5 flex items-center gap-3 w-[min(92%,320px)]"
                style={{ insetInlineStart: "clamp(-24px, -2vw, 16px)", boxShadow: "0 24px 50px -18px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.12)" }}>
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl" style={{ background: "#EAF3FB" }}>
                  {featured.imageUrl && <img src={featured.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-black text-white mb-1" style={{ background: CYAN }}>
                    {isRtl ? "الأكثر طلباً" : "Best seller"}
                  </span>
                  <p className="text-[13px] font-black text-[#0F1516] leading-tight line-clamp-1">
                    {isRtl ? featured.nameAr : featured.nameEn || featured.nameAr}
                  </p>
                  <div className="mt-1.5 flex items-center gap-4">
                    {typeof featured.calories === "number" && (
                      <span className="text-[12px] font-bold text-[#0E76AC]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {featured.calories} {isRtl ? "سعرة" : "kcal"}
                      </span>
                    )}
                    {macro(featured.protein, isRtl ? "بروتين" : "PROTEIN")}
                    {macro(featured.carbs, isRtl ? "كارب" : "CARBS")}
                    {macro(featured.fats, isRtl ? "دهون" : "FAT")}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
