/**
 * @file HeroClean.tsx
 * @description هيرو نظيف Premium — صورة طعام حقيقية واحدة + overlay + شريط ثقة.
 *  أداء خفيف: حركة دخول واحدة فقط، بدون جزيئات لا نهائية.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ArrowLeft, ArrowRight, Sparkles, Star } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface Props {
  image?: string;                // صورة واحدة (توافق قديم)
  images?: string[];             // عدة صور حقيقية للكاروسيل
  videoUrl?: string;             // فيديو خلفية متحرك (اختياري) — يُشغَّل بدل الكاروسيل
  titleAr: string; titleEn: string;
  subtitleAr: string; subtitleEn: string;
  onSubscribeClick: () => void;
  onMenuClick: () => void;
  onSmartPlanClick: () => void;
}

const TRUST = [
  { ar: "+200 عميل", en: "200+ clients" },
  { ar: "3 فروع", en: "3 branches" },
  { ar: "توصيل عبر 5 تطبيقات", en: "5 delivery apps" },
];

export function HeroClean({ image, images, videoUrl, titleAr, titleEn, subtitleAr, subtitleEn, onSubscribeClick, onMenuClick, onSmartPlanClick }: Props) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  // مصدر الصور: مصفوفة الصور أو الصورة الواحدة كـfallback
  const slides = React.useMemo(
    () => (images && images.length ? images : (image ? [image] : [])),
    [images, image]
  );
  const [idx, setIdx] = React.useState(0);
  const hasMultiple = slides.length > 1;

  React.useEffect(() => {
    if (!hasMultiple) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [hasMultiple, slides.length]);

  return (
    <section dir={isRtl ? "rtl" : "ltr"}
      className="relative w-full overflow-hidden flex items-center py-12 md:py-0"
      style={{ minHeight: "min(74vh, 720px)", background: "#0E2A4A" }}>
      {/* Background — video (if provided) else soft-crossfade photos */}
      {videoUrl ? (
        <video
          src={videoUrl}
          poster={slides[0]}
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.55) saturate(1.05)" }}
        />
      ) : (
        <AnimatePresence mode="sync">
          <motion.img
            key={idx}
            src={slides[idx]} alt={isRtl ? "وجبة صحية طازجة من أدرينالين" : "Fresh healthy meal by Adrenaline"}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.55) saturate(1.05)" }}
          />
        </AnimatePresence>
      )}
      {/* Directional gradient for text legibility */}
      <div className="absolute inset-0" style={{
        background: isRtl
          ? "linear-gradient(270deg, rgba(8,22,40,0.92) 0%, rgba(8,22,40,0.7) 45%, rgba(8,22,40,0.25) 100%)"
          : "linear-gradient(90deg, rgba(8,22,40,0.92) 0%, rgba(8,22,40,0.7) 45%, rgba(8,22,40,0.25) 100%)",
      }} />
      {/* extra bottom gradient on mobile (content sits low) */}
      <div className="absolute inset-0 md:hidden pointer-events-none" style={{
        background: "linear-gradient(to top, rgba(8,22,40,0.95) 0%, rgba(8,22,40,0.6) 35%, transparent 70%)",
      }} />
      {/* subtle brand glow */}
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,#3AC7F455,transparent 70%)", filter: "blur(40px)" }} />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-2xl text-center md:text-start">
          {/* AI badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 md:px-4 md:py-1.5 mb-3 md:mb-5"
            style={{ background: "rgba(58,199,244,0.14)", border: "1px solid rgba(58,199,244,0.3)" }}>
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: "#3AC7F4" }} />
            <span className="text-[10px] md:text-sm font-bold tracking-wider" style={{ color: "#3AC7F4" }}>
              {isRtl ? "مدعوم بالذكاء الاصطناعي" : "AI-POWERED MEAL PLANS"}
            </span>
          </div>

          <h1 className="font-black text-white leading-[1.15] mb-2.5 md:mb-4"
            style={{ fontSize: "clamp(24px,5.2vw,56px)", fontFamily: "'Cairo',sans-serif" }}>
            {isRtl ? titleAr : titleEn}
          </h1>

          <p className="mb-5 md:mb-7 leading-relaxed mx-auto md:mx-0"
            style={{ color: "rgba(255,255,255,0.82)", fontSize: "clamp(13px,1.8vw,18px)", maxWidth: 540 }}>
            {isRtl ? subtitleAr : subtitleEn}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 md:gap-3 mb-4 md:mb-8 justify-center md:justify-start">
            <button onClick={onSubscribeClick}
              className="w-full sm:w-auto h-11 md:h-12 px-6 md:px-7 rounded-full font-black text-white text-sm md:text-base flex items-center justify-center gap-2 transition-transform hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg,#3AC7F4,#0E76AC)", boxShadow: "0 12px 30px -8px rgba(58,199,244,.5)" }}>
              <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
              {isRtl ? "اشترك الآن" : "Subscribe Now"}
            </button>
            <button onClick={onSmartPlanClick}
              className="w-full sm:w-auto h-11 md:h-12 px-6 md:px-7 rounded-full font-bold text-white text-sm md:text-base flex items-center justify-center gap-2 backdrop-blur-md transition-colors hover:bg-white/10"
              style={{ border: "2px solid rgba(255,255,255,0.28)" }}>
              <Sparkles className="w-4 h-4" style={{ color: "#3AC7F4" }} />
              {isRtl ? "جرّب خطتي الذكية" : "Try Smart Plan"}
            </button>
            <button onClick={onMenuClick}
              className="hidden sm:flex w-full sm:w-auto h-11 md:h-12 px-5 rounded-full font-bold text-white/90 text-sm md:text-base items-center justify-center gap-2 transition-colors hover:text-white">
              {isRtl ? "تصفّح القائمة" : "Browse Menu"}
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center gap-x-3 md:gap-x-5 gap-y-2 justify-center md:justify-start">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" style={{ color: "#F4C037" }} />)}
            </div>
            {TRUST.map((t, i) => (
              <span key={i} className="text-xs md:text-sm font-bold text-white/85 flex items-center gap-1.5 md:gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3AC7F4" }} />
                {isRtl ? t.ar : t.en}
              </span>
            ))}
          </div>

          {/* Carousel dots */}
          {!videoUrl && hasMultiple && (
            <div className="flex items-center gap-2.5 mt-5 md:mt-8 justify-center md:justify-start">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} aria-label={`صورة ${i + 1}`}
                  className="rounded-full transition-all duration-500"
                  style={{
                    width: idx === i ? 28 : 8, height: 8,
                    background: idx === i ? "#3AC7F4" : "rgba(255,255,255,0.3)",
                    boxShadow: idx === i ? "0 0 10px rgba(58,199,244,0.5)" : "none",
                  }} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
