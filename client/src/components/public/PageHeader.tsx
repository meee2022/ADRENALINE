/**
 * @file PageHeader.tsx
 * @description هيدر صفحة موحّد مضغوط — هوية بصرية ثابتة لكل الصفحات الداخلية.
 *  بانر قصير (~260px) + عنوان + وصف + (اختياري) صورة قسم + بادج + breadcrumb.
 */
import * as React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";

interface Props {
  titleAr: string; titleEn: string;
  subtitleAr?: string; subtitleEn?: string;
  image?: string;                 // صورة خلفية خاصة بالقسم (اختياري)
  eyebrowAr?: string; eyebrowEn?: string; // شارة صغيرة فوق العنوان
  icon?: React.ReactNode;
}

export function PageHeader({ titleAr, titleEn, subtitleAr, subtitleEn, image, eyebrowAr, eyebrowEn, icon }: Props) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  return (
    <section dir={isRtl ? "rtl" : "ltr"}
      className="relative w-full overflow-hidden flex items-center"
      style={{
        minHeight: 240,
        background: image ? "#0E2A4A" : "linear-gradient(135deg,#0B2138 0%,#143A57 55%,#0E76AC 100%)",
      }}>
      {/* Optional section photo */}
      {image && (
        <>
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.45) saturate(1.05)" }} />
          <div className="absolute inset-0" style={{
            background: "linear-gradient(135deg,rgba(11,33,56,0.88),rgba(14,118,172,0.55))",
          }} />
        </>
      )}

      {/* Brand glows */}
      <div className="absolute -top-24 -right-24 w-[320px] h-[320px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,#3AC7F455,transparent 70%)", filter: "blur(40px)" }} />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-10 py-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center md:text-start max-w-2xl mx-auto md:mx-0">
          {(eyebrowAr || eyebrowEn) && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3"
              style={{ background: "rgba(58,199,244,0.14)", border: "1px solid rgba(58,199,244,0.3)" }}>
              {icon}
              <span className="text-[11px] md:text-xs font-bold tracking-wider" style={{ color: "#3AC7F4" }}>
                {isRtl ? eyebrowAr : eyebrowEn}
              </span>
            </div>
          )}
          <h1 className="font-black text-white leading-tight mb-2"
            style={{ fontSize: "clamp(26px,4vw,42px)", fontFamily: "'Cairo',sans-serif" }}>
            {isRtl ? titleAr : titleEn}
          </h1>
          {(subtitleAr || subtitleEn) && (
            <p className="leading-relaxed mx-auto md:mx-0"
              style={{ color: "rgba(255,255,255,0.8)", fontSize: "clamp(13px,1.6vw,16px)", maxWidth: 560 }}>
              {isRtl ? subtitleAr : subtitleEn}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
