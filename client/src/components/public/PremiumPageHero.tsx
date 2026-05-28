/**
 * @file Premium reusable page hero (for inner pages — About, Contact, Plans)
 */
import * as React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";

interface PremiumPageHeroProps {
  badgeIcon: React.ReactNode;
  badgeAr: string;
  badgeEn: string;
  titleAr: React.ReactNode;
  titleEn: React.ReactNode;
  subtitleAr: string;
  subtitleEn: string;
  bgImage?: string;
}

/* ─── Floating particles ─── */
const ParticleEffect: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
    {[...Array(15)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1.5 h-1.5 rounded-full"
        style={{
          background: i % 3 === 0 ? "#3CC4F0" : i % 3 === 1 ? "#47759C" : "rgba(255,255,255,0.4)",
          filter: "blur(1px)",
        }}
        initial={{ x: `${Math.random() * 100}%`, y: `${Math.random() * 100}%`, opacity: 0 }}
        animate={{ y: [null, `${Math.random() * -100 - 50}%`], opacity: [0, 0.7, 0] }}
        transition={{ duration: Math.random() * 5 + 4, repeat: Infinity, delay: Math.random() * 3, ease: "easeOut" }}
      />
    ))}
  </div>
);

export function PremiumPageHero({
  badgeIcon, badgeAr, badgeEn, titleAr, titleEn, subtitleAr, subtitleEn,
  bgImage = "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1920&q=85&auto=format&fit=crop",
}: PremiumPageHeroProps) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      className="relative min-h-[55vh] md:min-h-[60vh] w-full overflow-hidden flex items-center pt-20"
      style={{ background: "#0A0F10" }}
    >
      <ParticleEffect />

      {/* Background image container - smaller and framed like main hero */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 lg:w-2/3 z-0 opacity-40 md:opacity-100"
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          maskImage: "linear-gradient(to right, transparent, black 40%)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 40%)",
        }}
      >
        <img
          src={bgImage}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: "saturate(1.1) brightness(0.7)" }}
        />
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, #0A0F10 0%, transparent 100%)" }} />
      </motion.div>

      {/* Grid pattern overlay for tech/premium feel */}
      <div className="absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "40px 40px"
        }} />

      {/* Decorative glows */}
      <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full opacity-25 blur-[120px] pointer-events-none z-10"
        style={{ background: "radial-gradient(circle, #3CC4F0, transparent)" }} />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-15 blur-[120px] pointer-events-none z-10"
        style={{ background: "radial-gradient(circle, #47759C, transparent)" }} />

      {/* Content */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20 flex flex-col items-center md:items-start text-center md:text-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 backdrop-blur-xl rounded-full px-4 py-2 mb-6"
          style={{ background: "rgba(60,196,240,0.1)", border: "1px solid rgba(60,196,240,0.25)" }}
        >
          <span style={{ color: "#3CC4F0" }}>{badgeIcon}</span>
          <span className="text-xs md:text-sm font-bold tracking-widest uppercase" style={{ color: "#3CC4F0" }}>
            {isRtl ? badgeAr : badgeEn}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 leading-[1.1] tracking-tight"
        >
          {isRtl ? titleAr : titleEn}
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-lg md:text-xl lg:text-2xl font-medium mb-6"
          style={{ color: "#47759C" }}
          dir={isRtl ? "ltr" : "rtl"}
        >
          {isRtl ? titleEn : titleAr}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="text-sm md:text-base lg:text-lg max-w-xl leading-relaxed"
          style={{ color: "#BCBEBF" }}
        >
          {isRtl ? subtitleAr : subtitleEn}
        </motion.p>
      </div>
    </section>
  );
}
