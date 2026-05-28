/**
 * @file client/src/components/public/PremiumHero.tsx
 * @description Premium hero — modern split layout + glassmorphism & floating elements
 */
import * as React from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  MessageCircle, Star, ArrowLeft, ArrowRight, Sparkles,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
        className="absolute w-1.5 h-1.5 rounded-full"
        style={{
          background: i % 3 === 0 ? "#3CC4F0" : i % 3 === 1 ? "#47759C" : "rgba(255,255,255,0.4)",
          filter: "blur(1px)",
        }}
        initial={{ x: `${Math.random() * 100}%`, y: `${Math.random() * 100}%`, opacity: 0 }}
        animate={{ y: [null, `${Math.random() * -100 - 50}%`], opacity: [0, 0.8, 0] }}
        transition={{ duration: Math.random() * 5 + 4, repeat: Infinity, delay: Math.random() * 3, ease: "easeOut" }}
      />
    ))}
  </div>
);

/* ─── Floating Stat Badge (for visual column) ─── */
const FloatingBadge = ({ icon: Icon, title, value, delay, className, style }: any) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ delay, duration: 0.6, type: "spring" }}
    whileHover={{ scale: 1.05 }}
    className={cn(
      "absolute z-30 flex items-center gap-3 backdrop-blur-xl px-4 py-3 rounded-2xl",
      className
    )}
    style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))",
      border: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
      ...style
    }}
  >
    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
      style={{ background: "rgba(60,196,240,0.15)", color: "#3CC4F0" }}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex flex-col">
      <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/60">{title}</span>
      <span className="text-sm md:text-base font-black text-white">{value}</span>
    </div>
  </motion.div>
);

/* ─── Hero ─── */
export function PremiumHero({
  banners,
  onSubscribeClick,
  onMenuClick,
  heroImage = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1920&q=85&auto=format&fit=crop",
  fallbackTitleAr = "وجبات صحية",
  fallbackTitleEn = "Healthy Meals",
  fallbackSubtitleAr,
  fallbackSubtitleEn,
  settings,
}: PremiumHeroProps) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const heroRef = React.useRef<HTMLElement>(null);
  const isInView = useInView(heroRef, { once: true, margin: "-10%" });

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
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [hasMultiple, slides.length]);

  const slide = slides[activeIdx];

  return (
    <section
      ref={heroRef}
      dir={isRtl ? "rtl" : "ltr"}
      className="relative w-full overflow-hidden flex items-center pt-8 md:pt-14 pb-10 md:pb-16"
      style={{ background: "linear-gradient(135deg, #0f1516 0%, #162535 50%, #1e3a50 100%)" }}
    >
      <ParticleEffect />

      {/* Decorative ambient glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-30 blur-[100px] pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, #3CC4F0, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, #47759C, transparent 70%)" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-10 blur-[140px] pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse, #3CC4F0, transparent 60%)" }} />
      
      {/* Grid pattern overlay for tech/premium feel */}
      <div className="absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "40px 40px"
        }} />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 md:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-12">
          
          {/* ─── TEXT COLUMN ─── */}
          <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="inline-flex items-center gap-2 backdrop-blur-md rounded-full px-4 py-1.5 mb-4 shadow-lg"
              style={{ background: "rgba(60,196,240,0.1)", border: "1px solid rgba(60,196,240,0.25)" }}
            >
              <Sparkles className="w-4 h-4" style={{ color: "#3CC4F0" }} />
              <span className="text-xs md:text-sm font-bold tracking-widest uppercase" style={{ color: "#3CC4F0" }}>
                {isRtl ? "أدرينالين • وجبات صحية" : "ADRENALINE • PREMIUM HEALTHY FOOD"}
              </span>
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.h1
                key={slide.titleAr}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5.5xl font-black text-white mb-3 leading-[1.2] tracking-tight"
              >
                {isRtl ? slide.titleAr : slide.titleEn}
                <span
                  className="block mt-1 pb-1"
                  style={{
                    background: "linear-gradient(135deg, #3CC4F0 0%, #2BB0DC 50%, #47759C 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {isRtl ? "تليق بهدفك" : "Built For Your Goals"}
                </span>
              </motion.h1>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.p
                key={slide.subtitleAr}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-xs sm:text-sm md:text-base max-w-lg mb-6 leading-relaxed font-medium"
                style={{ color: "#BCBEBF" }}
              >
                {isRtl ? slide.subtitleAr : slide.subtitleEn}
              </motion.p>
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
            >
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 15px 30px rgba(60,196,240,0.25)" }}
                whileTap={{ scale: 0.97 }}
                onClick={onSubscribeClick}
                className="w-full sm:w-auto h-12 px-6 rounded-full font-black text-white flex items-center justify-center gap-2 transition-all relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, #3CC4F0 0%, #2BB0DC 50%, #47759C 100%)",
                }}
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
                <MessageCircle className="w-4 h-4 relative z-10" />
                <span className="relative z-10 text-sm md:text-base">{isRtl ? "اشترك عبر واتساب" : "Subscribe via WhatsApp"}</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03, backgroundColor: "rgba(255,255,255,0.1)" }}
                whileTap={{ scale: 0.97 }}
                onClick={onMenuClick}
                className="w-full sm:w-auto h-12 px-6 rounded-full font-bold text-white flex items-center justify-center gap-2 backdrop-blur-md transition-all"
                style={{ border: "2px solid rgba(255,255,255,0.2)" }}
              >
                <span className="text-sm md:text-base">{isRtl ? "تصفح القائمة" : "Browse Menu"}</span>
                {isRtl ? <ArrowLeft className="w-4 h-4 opacity-70" /> : <ArrowRight className="w-4 h-4 opacity-70" />}
              </motion.button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="mt-5 flex items-center gap-4 pt-4 border-t border-white/10 w-full max-w-md justify-center lg:justify-start"
            >
              <div className="flex flex-col items-center lg:items-start gap-1">
                <div className="flex items-center gap-1 text-yellow-400">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-white/60">
                  {isRtl ? "تقييم 4.9 من عملائنا" : "4.9 Rating from clients"}
                </span>
              </div>
              
              <div className="h-6 w-px bg-white/10" />

              <div className="flex flex-col items-center lg:items-start gap-1">
                <div className="flex -space-x-1.5 rtl:space-x-reverse">
                  {[1, 2, 3, 4].map((i) => (
                    <img key={i} src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="user" className="w-5.5 h-5.5 rounded-full border-2 border-[#0A0F10]" />
                  ))}
                  <div className="w-5.5 h-5.5 rounded-full border-2 border-[#0A0F10] bg-[#3CC4F0] flex items-center justify-center text-[7px] font-bold text-white">
                    +500
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-white/60">
                  {isRtl ? "مشترك نشط" : "Active Subscribers"}
                </span>
              </div>
            </motion.div>

          </div>

          {/* ─── VISUAL COLUMN (Interactive 3D Cards Stack & Flexible Ratio) ─── */}
          <div className="w-full lg:w-1/2 relative h-[280px] md:h-[360px] lg:h-[480px] flex items-center justify-center">
            <motion.div 
              className="relative w-full max-w-[360px] md:max-w-[420px] lg:max-w-[480px] aspect-[4/3] flex items-center justify-center"
              whileHover="hover"
            >
              {/* Stack Card 1 (Back Decorative Glass Card) */}
              <motion.div
                variants={{
                  hover: { rotate: -8, scale: 0.95, x: isRtl ? 15 : -15, y: -5 }
                }}
                transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
                className="absolute inset-0 rounded-[2rem] opacity-30 z-0"
                style={{
                  background: "linear-gradient(135deg, rgba(60,196,240,0.4), rgba(71,117,156,0.1))",
                  border: "1px solid rgba(255,255,255,0.1)",
                  transform: "rotate(-4deg) scale(0.96)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
                }}
              />

              {/* Stack Card 2 (Middle Decorative Glass Card) */}
              <motion.div
                variants={{
                  hover: { rotate: 6, scale: 0.98, x: isRtl ? -10 : 10, y: 5 }
                }}
                transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
                className="absolute inset-0 rounded-[2rem] opacity-50 z-0"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(255,255,255,0.15)",
                  transform: "rotate(3deg) scale(0.98)",
                  boxShadow: "0 15px 45px rgba(0,0,0,0.35)"
                }}
              />
              
              {/* The Main Framed Image Container (Front Card) */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                variants={{
                  hover: { scale: 1.02, y: -5 }
                }}
                transition={{ delay: 0.3, duration: 0.8, type: "spring", stiffness: 100 }}
                className="relative w-full h-full rounded-[2.2rem] overflow-hidden z-10"
                style={{
                  boxShadow: "0 30px 60px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.25)",
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  background: "rgba(22, 37, 53, 0.4)"
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeIdx}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.03 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <img
                      src={slide.image}
                      alt="Healthy Food"
                      className="w-full h-full object-cover"
                      style={{ filter: "brightness(0.95) saturate(1.05)" }}
                    />
                    {/* Subtle inner gradient to ensure image looks rich and premium */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>

            {/* Carousel Dots / Pills */}
            {hasMultiple && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1.2, duration: 0.5 }}
                className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2.5 z-20"
              >
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    aria-label={`Slide ${i + 1}`}
                    className="rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: activeIdx === i ? "28px" : "8px",
                      height: "8px",
                      background: activeIdx === i ? "#3CC4F0" : "rgba(255,255,255,0.25)",
                      boxShadow: activeIdx === i ? "0 0 10px rgba(60,196,240,0.5)" : "none"
                    }}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
