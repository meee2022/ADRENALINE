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

export function PremiumPageHero({
  badgeIcon, badgeAr, badgeEn, titleAr, titleEn, subtitleAr, subtitleEn,
  bgImage = "/hero-banner.png",
}: PremiumPageHeroProps) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      className="relative min-h-[55vh] md:min-h-[60vh] w-full overflow-hidden flex items-center"
      style={{ background: "#0F1516" }}
    >
      {/* Background image */}
      <motion.div
        className="absolute inset-0 z-0"
        initial={{ scale: 1.15 }}
        animate={{ scale: 1.05 }}
        transition={{ duration: 12, ease: "easeOut" }}
      >
        <img
          src={bgImage}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: "saturate(1.05) brightness(0.55)" }}
        />
      </motion.div>

      {/* Overlays */}
      <div className="absolute inset-0 z-10"
        style={{
          background: `linear-gradient(${isRtl ? "270deg" : "90deg"}, rgba(15,21,22,0.92) 0%, rgba(15,21,22,0.6) 50%, rgba(15,21,22,0.4) 100%)`,
        }} />
      <div className="absolute inset-0 z-10"
        style={{ background: "linear-gradient(180deg, rgba(15,21,22,0.4) 0%, transparent 30%, transparent 70%, rgba(15,21,22,0.95) 100%)" }} />

      {/* Decorative glows */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none z-10"
        style={{ background: "radial-gradient(circle, #3CC4F0, transparent)" }} />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-15 blur-3xl pointer-events-none z-10"
        style={{ background: "radial-gradient(circle, #47759C, transparent)" }} />

      {/* Content */}
      <div className="relative z-20 w-full max-w-5xl mx-auto px-5 md:px-8 py-16 md:py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 backdrop-blur-xl rounded-full px-4 py-2 mb-6"
          style={{ background: "rgba(60,196,240,0.15)", border: "1px solid rgba(60,196,240,0.3)" }}
        >
          <span style={{ color: "#3CC4F0" }}>{badgeIcon}</span>
          <span className="text-xs md:text-sm font-bold tracking-wider" style={{ color: "#3CC4F0" }}>
            {isRtl ? badgeAr : badgeEn}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-3 leading-[1.1] tracking-tight"
        >
          {isRtl ? titleAr : titleEn}
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-lg md:text-xl lg:text-2xl font-semibold mb-4 md:mb-5"
          style={{ color: "rgba(255,255,255,0.5)" }}
          dir={isRtl ? "ltr" : "rtl"}
        >
          {isRtl ? titleEn : titleAr}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="text-sm md:text-base lg:text-lg max-w-2xl mx-auto leading-relaxed"
          style={{ color: "#BCBEBF" }}
        >
          {isRtl ? subtitleAr : subtitleEn}
        </motion.p>
      </div>
    </section>
  );
}
