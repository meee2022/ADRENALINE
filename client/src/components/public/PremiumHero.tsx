/**
 * @file client/src/components/public/PremiumHero.tsx
 * @description Premium hero — multi-banner carousel + framer-motion animations
 */
import * as React from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  MessageCircle, Star, Truck, Users, ChevronDown, ArrowLeft, ArrowRight, Sparkles,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface Banner {
  _id: string;
  titleAr: string;
  titleEn?: string;
  subtitleAr?: string;
  subtitleEn?: string;
  imageUrl: string;
}

interface PremiumHeroProps {
  banners?: Banner[];                    // Multi-banner carousel (DB-driven)
  onSubscribeClick: () => void;
  onMenuClick: () => void;
  heroImage?: string;                    // Fallback image if no banners
  fallbackTitleAr?: string;
  fallbackTitleEn?: string;
  fallbackSubtitleAr?: string;
  fallbackSubtitleEn?: string;
  settings?: any;
}

/* ─── Floating particles ─── */
const ParticleEffect: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 rounded-full"
        style={{ background: i % 2 === 0 ? "#3CC4F0" : "rgba(255,255,255,0.6)" }}
        initial={{ x: `${Math.random() * 100}%`, y: `${Math.random() * 100}%`, opacity: 0 }}
        animate={{ y: [null, `${Math.random() * -100 - 50}%`], opacity: [0, 0.6, 0] }}
        transition={{ duration: Math.random() * 4 + 3, repeat: Infinity, delay: Math.random() * 3, ease: "easeOut" }}
      />
    ))}
  </div>
);

/* ─── Scroll indicator ─── */
const ScrollIndicator: React.FC<{ label: string }> = ({ label }) => (
  <motion.div
    className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30"
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1.6, duration: 0.8 }}
  >
    <span className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold" style={{ color: "#BCBEBF" }}>
      {label}
    </span>
    <div className="w-6 h-10 rounded-full flex items-start justify-center pt-2"
      style={{ border: "1.5px solid rgba(60,196,240,0.5)" }}>
      <motion.div
        className="w-1 h-2 rounded-full"
        style={{ background: "#3CC4F0" }}
        animate={{ y: [0, 8, 0], opacity: [1, 0.3, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  </motion.div>
);

/* ─── Glassmorphism stat pill ─── */
interface StatPillProps {
  icon: React.ReactNode; value: string; labelAr: string; labelEn: string; delay: number; isRtl: boolean;
}
const StatPill: React.FC<StatPillProps> = ({ icon, value, labelAr, labelEn, delay, isRtl }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.6 }}
    whileHover={{ scale: 1.05, y: -2 }}
    className="backdrop-blur-xl rounded-2xl px-3 py-2.5 md:px-4 md:py-3 flex items-center gap-2 md:gap-3"
    style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
      border: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    }}
  >
    <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        background: "linear-gradient(135deg, rgba(60,196,240,0.25), rgba(71,117,156,0.15))",
        border: "1px solid rgba(60,196,240,0.35)",
        color: "#3CC4F0",
      }}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-base md:text-xl font-black text-white tabular-nums leading-none">{value}</div>
      <div className="text-[10px] md:text-xs mt-0.5 truncate" style={{ color: "#BCBEBF" }}>
        {isRtl ? labelAr : labelEn}
      </div>
    </div>
  </motion.div>
);

/* ─── Hero ─── */
export function PremiumHero({
  banners,
  onSubscribeClick,
  onMenuClick,
  heroImage = "/hero-banner.png",
  fallbackTitleAr = "وجبات صحية",
  fallbackTitleEn = "Healthy Meals",
  fallbackSubtitleAr,
  fallbackSubtitleEn,
  settings,
}: PremiumHeroProps) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const heroRef = React.useRef<HTMLElement>(null);
  const isInView = useInView(heroRef, { once: true });

  // Build slides from banners (or fallback to single slide)
  const slides = React.useMemo(() => {
    if (banners && banners.length > 0) {
      return banners.map((b) => ({
        image: b.imageUrl,
        titleAr: b.titleAr,
        titleEn: b.titleEn || b.titleAr,
        subtitleAr: b.subtitleAr || "",
        subtitleEn: b.subtitleEn || b.subtitleAr || "",
      }));
    }
    return [{
      image: heroImage,
      titleAr: fallbackTitleAr,
      titleEn: fallbackTitleEn,
      subtitleAr: fallbackSubtitleAr || "خطط وجبات مخصصة، مكونات طازجة، وتوصيل يومي — معتمدين من أكثر من 500 مشترك",
      subtitleEn: fallbackSubtitleEn || "Custom meal plans, fresh ingredients, daily delivery — trusted by 500+ subscribers",
    }];
  }, [banners, heroImage, fallbackTitleAr, fallbackTitleEn, fallbackSubtitleAr, fallbackSubtitleEn]);

  const [activeIdx, setActiveIdx] = React.useState(0);
  const hasMultiple = slides.length > 1;

  // Auto-rotate
  React.useEffect(() => {
    if (!hasMultiple) return;
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [hasMultiple, slides.length]);

  const goNext = () => setActiveIdx((i) => (i + 1) % slides.length);
  const goPrev = () => setActiveIdx((i) => (i - 1 + slides.length) % slides.length);

  const slide = slides[activeIdx];

  return (
    <section
      ref={heroRef}
      dir={isRtl ? "rtl" : "ltr"}
      className="relative min-h-[80vh] md:min-h-[72vh] lg:min-h-[78vh] w-full overflow-hidden flex items-center"
      style={{ background: "#0F1516", maxHeight: "760px" }}
    >
      <ParticleEffect />

      {/* Cross-fading background slides */}
      <AnimatePresence mode="sync">
        <motion.div
          key={activeIdx}
          initial={{ opacity: 0, scale: 1.15 }}
          animate={{ opacity: 1, scale: 1.05 }}
          exit={{ opacity: 0, scale: 1 }}
          transition={{ opacity: { duration: 1.2 }, scale: { duration: 8, ease: "easeOut" } }}
          className="absolute inset-0 z-0"
        >
          <img
            src={slide.image}
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: "saturate(1.1) brightness(0.6)" }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Overlays — softer + uniform (no harsh side gradient) */}
      <div className="absolute inset-0 z-10"
        style={{ background: "linear-gradient(180deg, rgba(15,21,22,0.55) 0%, rgba(15,21,22,0.65) 50%, rgba(15,21,22,0.92) 100%)" }} />

      {/* Decorative glows */}
      <div className="absolute top-1/4 right-10 w-48 md:w-72 h-48 md:h-72 rounded-full opacity-20 blur-3xl pointer-events-none z-10"
        style={{ background: "radial-gradient(circle, #3CC4F0, transparent)" }} />
      <div className="absolute bottom-1/3 left-10 w-56 md:w-80 h-56 md:h-80 rounded-full opacity-15 blur-3xl pointer-events-none z-10"
        style={{ background: "radial-gradient(circle, #47759C, transparent)" }} />

      {/* Content — centered for premium poster feel */}
      <div className="relative z-20 w-full max-w-5xl mx-auto px-5 md:px-8 py-14 md:py-16 text-center">
        <div className="mx-auto" style={{ maxWidth: "780px" }}>
          {/* Static badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center gap-2 backdrop-blur-xl rounded-full px-4 py-2 mb-6"
            style={{ background: "rgba(60,196,240,0.15)", border: "1px solid rgba(60,196,240,0.3)" }}
          >
            <Sparkles className="w-4 h-4" style={{ color: "#3CC4F0" }} />
            <span className="text-xs md:text-sm font-bold tracking-wider" style={{ color: "#3CC4F0" }}>
              {isRtl ? "أدرينالين • وجبات صحية" : "ADRENALINE • HEALTHY FOOD"}
            </span>
          </motion.div>

          {/* Static premium headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 md:mb-5 leading-[1.1] tracking-tight"
          >
            {isRtl ? "وجبات صحية" : "Healthy Meals"}
            <span
              className="block mt-2"
              style={{
                background: "linear-gradient(135deg, #3CC4F0 0%, #47759C 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {isRtl ? "تليق بهدفك" : "Built For Your Goals"}
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="text-sm md:text-base max-w-xl mx-auto mb-6 md:mb-8 leading-relaxed"
            style={{ color: "#BCBEBF" }}
          >
            {isRtl
              ? "خطط وجبات مخصصة، مكونات طازجة، وتوصيل يومي — معتمدين من أكثر من 500 مشترك في كل أنحاء قطر."
              : "Custom meal plans, fresh ingredients, daily delivery — trusted by 500+ subscribers across Qatar."}
          </motion.p>

          {/* CTA Buttons (static) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 1, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-3 mb-7 md:mb-9 justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSubscribeClick}
              className="group h-12 md:h-13 px-7 rounded-full font-bold text-sm md:text-base text-white flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #3CC4F0 0%, #2BB0DC 50%, #47759C 100%)",
                boxShadow: "0 12px 40px rgba(60,196,240,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              <MessageCircle className="w-5 h-5" />
              <span>{isRtl ? "اشترك عبر واتساب" : "Subscribe via WhatsApp"}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={onMenuClick}
              className="h-12 md:h-13 px-7 rounded-full font-bold text-sm md:text-base backdrop-blur-md flex items-center justify-center gap-2"
              style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.2)", color: "#FFFFFF" }}
            >
              <span>{isRtl ? "تصفح القائمة" : "Browse Menu"}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4 opacity-70" /> : <ArrowRight className="w-4 h-4 opacity-70" />}
            </motion.button>
          </motion.div>

          {/* Stat pills — centered, smaller, single row */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-2">
            <StatPill icon={<Users className="w-4 h-4" />} value="500+" labelAr="مشترك" labelEn="Subscribers" delay={1.2} isRtl={isRtl} />
            <StatPill icon={<Star className="w-4 h-4" fill="currentColor" />} value="4.9" labelAr="تقييم" labelEn="Rating" delay={1.3} isRtl={isRtl} />
            <StatPill icon={<Truck className="w-4 h-4" />} value={isRtl ? "مجاني" : "FREE"} labelAr="توصيل" labelEn="Delivery" delay={1.4} isRtl={isRtl} />
          </div>

          {/* Carousel Dots (only if multiple banners) */}
          {hasMultiple && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 1.5, duration: 0.5 }}
              className="flex items-center justify-center gap-2 mt-4"
            >
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  aria-label={`Slide ${i + 1}`}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: activeIdx === i ? "28px" : "7px",
                    height: "7px",
                    background: activeIdx === i ? "#3CC4F0" : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Carousel arrows removed — dots indicator is enough */}

      <ScrollIndicator label={isRtl ? "اسحب للأسفل" : "SCROLL"} />
    </section>
  );
}
