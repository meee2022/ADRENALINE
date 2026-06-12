/**
 * @file HeroSplit.tsx
 * @description هيرو Split عصري — نص يسار + كارت طبق حقيقي نظيف يمين + بادج سعرات.
 *  أداء خفيف: حركة دخول واحدة فقط.
 */
import * as React from "react";
import { motion } from "framer-motion";
import { MessageCircle, ArrowLeft, ArrowRight, Sparkles, Star, Flame } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface Props {
  image: string;                 // صورة الطبق الحقيقية للكارت
  dishNameAr?: string; dishNameEn?: string;
  dishKcal?: number;
  titleAr: string; titleEn: string;
  subtitleAr: string; subtitleEn: string;
  onSubscribeClick: () => void;
  onMenuClick: () => void;
  onSmartPlanClick: () => void;
}

const TRUST = [
  { ar: "+200 عميل", en: "200+ clients" },
  { ar: "3 فروع", en: "3 branches" },
  { ar: "5 تطبيقات توصيل", en: "5 apps" },
];

export function HeroSplit({ image, dishNameAr, dishNameEn, dishKcal, titleAr, titleEn, subtitleAr, subtitleEn, onSubscribeClick, onMenuClick, onSmartPlanClick }: Props) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  return (
    <section dir={isRtl ? "rtl" : "ltr"}
      className="relative w-full overflow-hidden flex items-center py-14 md:py-20"
      style={{ minHeight: "min(86vh, 700px)", background: "linear-gradient(135deg,#0B2138 0%,#143A57 55%,#0E76AC 100%)" }}>
      {/* soft brand glows (static, cheap) */}
      <div className="absolute -top-40 right-0 w-[460px] h-[460px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,#3AC7F455,transparent 70%)", filter: "blur(50px)" }} />
      <div className="absolute -bottom-40 left-0 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,#0E76AC66,transparent 70%)", filter: "blur(60px)" }} />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-10">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
          {/* TEXT */}
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 30 : -30 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="w-full lg:w-[48%] text-center lg:text-start">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5"
              style={{ background: "rgba(58,199,244,0.14)", border: "1px solid rgba(58,199,244,0.3)" }}>
              <Sparkles className="w-4 h-4" style={{ color: "#3AC7F4" }} />
              <span className="text-xs md:text-sm font-bold tracking-wider" style={{ color: "#3AC7F4" }}>
                {isRtl ? "مدعوم بالذكاء الاصطناعي" : "AI-POWERED"}
              </span>
            </div>

            <h1 className="font-black text-white leading-[1.15] mb-4"
              style={{ fontSize: "clamp(30px,5vw,54px)", fontFamily: "'Cairo',sans-serif" }}>
              {isRtl ? titleAr : titleEn}
            </h1>
            <p className="mb-7 leading-relaxed mx-auto lg:mx-0"
              style={{ color: "rgba(255,255,255,0.82)", fontSize: "clamp(14px,1.8vw,18px)", maxWidth: 520 }}>
              {isRtl ? subtitleAr : subtitleEn}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 mb-7 justify-center lg:justify-start">
              <button onClick={onSubscribeClick}
                className="w-full sm:w-auto h-12 px-7 rounded-full font-black text-white flex items-center justify-center gap-2 transition-transform hover:scale-[1.03]"
                style={{ background: "linear-gradient(135deg,#3AC7F4,#0E76AC)", boxShadow: "0 12px 30px -8px rgba(58,199,244,.5)" }}>
                <MessageCircle className="w-5 h-5" />
                {isRtl ? "اشترك الآن" : "Subscribe Now"}
              </button>
              <button onClick={onSmartPlanClick}
                className="w-full sm:w-auto h-12 px-7 rounded-full font-bold text-white flex items-center justify-center gap-2 backdrop-blur-md transition-colors hover:bg-white/10"
                style={{ border: "2px solid rgba(255,255,255,0.28)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "#3AC7F4" }} />
                {isRtl ? "جرّب خطتي الذكية" : "Smart Plan"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-center lg:justify-start">
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" style={{ color: "#F4C037" }} />)}
              </div>
              {TRUST.map((t, i) => (
                <span key={i} className="text-sm font-bold text-white/85 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3AC7F4" }} />
                  {isRtl ? t.ar : t.en}
                </span>
              ))}
            </div>
          </motion.div>

          {/* DISH CARD */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="w-full lg:w-[52%] flex items-center justify-center">
            <div className="relative w-full max-w-[520px] aspect-[4/3] rounded-[2rem] overflow-hidden"
              style={{ border: "4px solid rgba(255,255,255,0.9)", boxShadow: "0 30px 70px -20px rgba(0,0,0,.55)" }}>
              <img src={image} alt={isRtl ? dishNameAr : dishNameEn}
                className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

              {/* Calories badge */}
              {dishKcal ? (
                <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full px-3 py-1.5"
                  style={{ background: "rgba(255,255,255,0.95)" }}>
                  <Flame className="w-4 h-4" style={{ color: "#F4843A" }} />
                  <span className="text-sm font-black" style={{ color: "#0E2A4A" }}>{dishKcal} سعرة</span>
                </div>
              ) : null}

              {/* Dish name */}
              {(dishNameAr || dishNameEn) && (
                <div className="absolute bottom-4 right-4 left-4 text-white">
                  <div className="text-xs font-bold opacity-80 mb-0.5">{isRtl ? "من قائمتنا اليوم" : "On today's menu"}</div>
                  <div className="text-lg font-black">{isRtl ? dishNameAr : dishNameEn}</div>
                </div>
              )}

              {/* Rating chip */}
              <div className="absolute top-4 right-4 flex items-center gap-1 rounded-full px-2.5 py-1"
                style={{ background: "rgba(14,42,74,0.85)" }}>
                <Star className="w-3.5 h-3.5 fill-current" style={{ color: "#F4C037" }} />
                <span className="text-xs font-black text-white">4.9</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
