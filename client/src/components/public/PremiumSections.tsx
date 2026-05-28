/**
 * @file client/src/components/public/PremiumSections.tsx
 * @description Premium homepage sections with framer-motion animations
 */
import * as React from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ChefHat, Sparkles, Star, Quote, MapPin, Phone, Clock, Instagram,
  ArrowLeft, ArrowRight, Leaf, Award, Heart, Users, MessageCircle,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

/* ════════════════════════════════════════════════════
   Reusable: Section Header (badge + title + subtitle)
   ════════════════════════════════════════════════════ */
interface SectionHeaderProps {
  badgeIcon: React.ReactNode;
  badgeAr: string;
  badgeEn: string;
  titleAr: React.ReactNode;
  titleEn: React.ReactNode;
  subtitleAr: string;
  subtitleEn: string;
  light?: boolean;
}
const SectionHeader: React.FC<SectionHeaderProps> = ({
  badgeIcon, badgeAr, badgeEn, titleAr, titleEn, subtitleAr, subtitleEn, light,
}) => {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  return (
    <div className="text-center mb-12 md:mb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 backdrop-blur-md"
        style={
          light
            ? { background: "rgba(60,196,240,0.15)", border: "1px solid rgba(60,196,240,0.3)" }
            : { background: "linear-gradient(135deg, #3CC4F015, #47759C10)", border: "1px solid #3CC4F030" }
        }
      >
        <span style={{ color: "#3CC4F0" }}>{badgeIcon}</span>
        <span
          className="text-xs md:text-sm font-bold tracking-wider"
          style={{ color: light ? "#3CC4F0" : "#47759C" }}
        >
          {isRtl ? badgeAr : badgeEn}
        </span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight leading-[1.15]"
        style={{ color: light ? "#FFFFFF" : "#0F1516" }}
      >
        {isRtl ? titleAr : titleEn}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
        style={{ color: light ? "#BCBEBF" : "#47759C" }}
      >
        {isRtl ? subtitleAr : subtitleEn}
      </motion.p>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   Section: About
   ════════════════════════════════════════════════════ */
export function PremiumAbout() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-white">
      <div className="absolute top-0 inset-x-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(60,196,240,0.4), transparent)" }} />

      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              <div className="absolute inset-4 rounded-[2.5rem] -rotate-3"
                style={{
                  background: "linear-gradient(135deg, #3CC4F0 0%, #47759C 100%)",
                  boxShadow: "0 30px 60px rgba(60,196,240,0.25)",
                }} />
              <div className="relative aspect-square rounded-[2.5rem] overflow-hidden rotate-2"
                style={{ border: "8px solid white", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
                <img src="/hero-banner.png" alt="Adrenaline" loading="lazy" className="w-full h-full object-cover" />
                <div className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, transparent 60%, rgba(15,21,22,0.4) 100%)" }} />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl flex items-center gap-2.5 backdrop-blur-md"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))",
                  border: "1px solid rgba(60,196,240,0.3)",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                }}
              >
                <ChefHat className="h-5 w-5" style={{ color: "#3CC4F0" }} />
                <span className="text-xs font-bold text-[#0F1516]">
                  {isRtl ? "محضّر بإتقان" : "Crafted with care"}
                </span>
              </motion.div>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: isRtl ? -40 : 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
              style={{ background: "linear-gradient(135deg, #3CC4F015, #47759C10)", border: "1px solid #3CC4F030" }}>
              <Heart className="h-4 w-4" style={{ color: "#3CC4F0" }} />
              <span className="text-xs md:text-sm font-bold tracking-wider" style={{ color: "#47759C" }}>
                {isRtl ? "قصتنا" : "OUR STORY"}
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0F1516] mb-2 leading-[1.15] tracking-tight">
              {isRtl ? (<>الصحة لذيذة <span style={{ color: "#3CC4F0" }}>والوجبات تليق بحياتك</span></>) : (<>Health is Tasty <span style={{ color: "#3CC4F0" }}>and Meals Match Your Life</span></>)}
            </h2>
            <p className="text-base md:text-lg font-semibold mb-5" style={{ color: "rgba(71,117,156,0.6)" }} dir={isRtl ? "ltr" : "rtl"}>
              {isRtl ? "Health is Tasty and Meals Match Your Life" : "الصحة لذيذة والوجبات تليق بحياتك"}
            </p>

            <p className="text-base md:text-lg leading-relaxed mb-6" style={{ color: "#47759C" }}>
              {isRtl
                ? "في أدرينالين، نؤمن أن الأكل الصحي مش لازم يكون ممل. فريقنا من الشيفات وأخصائيي التغذية يحضّر لك وجبات يومية متوازنة، طازجة، ومدروسة بدقة تناسب أهدافك."
                : "At Adrenaline, we believe healthy eating doesn't have to be boring. Our team of chefs and nutritionists crafts daily meals that are balanced, fresh, and tailored to your goals."}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { icon: Leaf, ar: "مكونات طازجة", en: "Fresh ingredients" },
                { icon: Award, ar: "جودة معتمدة", en: "Certified quality" },
                { icon: Users, ar: "أخصائيو تغذية", en: "Nutrition experts" },
                { icon: ChefHat, ar: "شيفات محترفون", en: "Expert chefs" },
              ].map(({ icon: Icon, ar, en }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.07 }}
                  className="flex items-center gap-2.5"
                >
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #3CC4F015, #47759C10)", border: "1px solid #3CC4F030" }}>
                    <Icon className="h-4 w-4" style={{ color: "#3CC4F0" }} />
                  </div>
                  <span className="text-sm font-bold text-[#0F1516]">{isRtl ? ar : en}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════
   Section: Menu Highlights
   ════════════════════════════════════════════════════ */
export function PremiumMenuHighlights({ onBrowseMenu }: { onBrowseMenu: () => void }) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  const dishes = [
    { img: "/hero-banner.png", tagAr: "الأكثر طلباً", tagEn: "Bestseller", titleAr: "كيتو بولز", titleEn: "Keto Bowls", descAr: "بروتين عالي وكارب منخفض", descEn: "High protein, low carb", kcal: 450 },
    { img: "/hero-banner.png", tagAr: "صباحي", tagEn: "Breakfast", titleAr: "أوتميل التوت", titleEn: "Berry Oatmeal", descAr: "بداية يوم متوازنة", descEn: "Balanced morning start", kcal: 380 },
    { img: "/hero-banner.png", tagAr: "خفيف", tagEn: "Light", titleAr: "سلطة سيزر", titleEn: "Caesar Salad", descAr: "خضروات طازجة وبروتين", descEn: "Fresh greens with protein", kcal: 320 },
    { img: "/hero-banner.png", tagAr: "مميز", tagEn: "Signature", titleAr: "ستيك مع كينوا", titleEn: "Steak & Quinoa", descAr: "وجبة كاملة العناصر", descEn: "Complete nutrition plate", kcal: 520 },
  ];

  return (
    <section className="relative py-20 md:py-28 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHeader
          badgeIcon={<Sparkles className="h-4 w-4" />}
          badgeAr="وجبات مختارة" badgeEn="FEATURED DISHES"
          titleAr="أشهر أطباقنا" titleEn="Our Most Loved Dishes"
          subtitleAr="اطلع على نخبة من أطباقنا الأكثر شعبية" subtitleEn="A taste of what our subscribers love most"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {dishes.map((dish, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              onClick={onBrowseMenu}
              className="group relative bg-white rounded-3xl overflow-hidden cursor-pointer"
              style={{
                boxShadow: "0 8px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <motion.img
                  src={dish.img}
                  alt={isRtl ? dish.titleAr : dish.titleEn}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
                <div className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, transparent 50%, rgba(15,21,22,0.65) 100%)" }} />
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] md:text-xs font-black px-3 py-1.5 rounded-full backdrop-blur-md"
                    style={{ background: "rgba(60,196,240,0.95)", color: "white", letterSpacing: "0.5px" }}>
                    {isRtl ? dish.tagAr : dish.tagEn}
                  </span>
                </div>
                <div className="absolute bottom-3 left-3">
                  <span className="text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full text-white backdrop-blur-md"
                    style={{ background: "rgba(15,21,22,0.55)", border: "1px solid rgba(255,255,255,0.2)" }}>
                    {dish.kcal} {isRtl ? "كالوري" : "kcal"}
                  </span>
                </div>
              </div>
              <div className="p-4 md:p-5">
                <h3 className="text-base md:text-lg font-black text-[#0F1516] mb-1 group-hover:text-[#3CC4F0] transition-colors">
                  {isRtl ? dish.titleAr : dish.titleEn}
                </h3>
                <p className="text-xs md:text-sm" style={{ color: "#47759C" }}>
                  {isRtl ? dish.descAr : dish.descEn}
                </p>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "linear-gradient(90deg, #3CC4F0, #47759C)" }} />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12 md:mt-14"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={onBrowseMenu}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-full font-bold transition-all"
            style={{ background: "transparent", border: "2px solid #3CC4F0", color: "#3CC4F0" }}
          >
            <span>{isRtl ? "تصفح القائمة كاملة" : "View Full Menu"}</span>
            {isRtl ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════
   Section: Testimonials Carousel
   ════════════════════════════════════════════════════ */
export function PremiumTestimonials() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const [activeIdx, setActiveIdx] = React.useState(0);

  const testimonials = [
    { nameAr: "أحمد المالكي", nameEn: "Ahmed Al-Maliki", roleAr: "رياضي محترف", roleEn: "Pro Athlete",
      textAr: "أفضل خطة وجبات صحية جربتها! الطعام لذيذ والتوصيل دايماً في الميعاد. ساعدتني أوصل لأهدافي بسهولة.",
      textEn: "The best meal plan I've tried! Delicious food, always on time. Helped me reach my goals easily." },
    { nameAr: "فاطمة العبدالله", nameEn: "Fatima Al-Abdullah", roleAr: "مدربة لياقة", roleEn: "Fitness Coach",
      textAr: "خسرت 8 كيلو في شهرين بدون ما أحس إني على دايت! الوجبات متنوعة والشيف محترف فعلاً.",
      textEn: "Lost 8kg in 2 months without feeling I'm dieting! Varied meals, truly expert chef." },
    { nameAr: "محمد الكواري", nameEn: "Mohammed Al-Kuwari", roleAr: "رجل أعمال", roleEn: "Businessman",
      textAr: "حياتي اتغيرت 100%. الوجبات جاهزة وصحية ومحسوبة، توفرلي وقت كتير وطاقتي زادت.",
      textEn: "My life changed 100%. Meals are ready, healthy, calculated — saved tons of time, energy boosted." },
  ];

  React.useEffect(() => {
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % testimonials.length), 6000);
    return () => clearInterval(t);
  }, [testimonials.length]);

  const t = testimonials[activeIdx];

  return (
    <section className="relative py-12 md:py-16 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #e8f8fd 50%, #eaf1f7 100%)" }}>
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #3CC4F0, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #47759C, transparent 70%)" }} />

      <div className="relative max-w-4xl mx-auto px-5 md:px-8">
        {/* Compact header */}
        <div className="text-center mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
            style={{ background: "rgba(60,196,240,0.15)", border: "1px solid rgba(60,196,240,0.35)" }}
          >
            <Star className="h-3.5 w-3.5 fill-current" style={{ color: "#3CC4F0" }} />
            <span className="text-[11px] font-bold tracking-wider" style={{ color: "#47759C" }}>
              {isRtl ? "آراء عملائنا" : "TESTIMONIALS"}
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight"
            style={{ color: "#0F1516" }}
          >
            {isRtl ? "ما يقوله عملاؤنا" : "What Our Clients Say"}
          </motion.h2>
        </div>

        {/* Compact testimonial card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative rounded-2xl md:rounded-3xl p-5 md:p-8 bg-white"
          style={{
            boxShadow: "0 12px 40px rgba(60,196,240,0.12), 0 4px 16px rgba(0,0,0,0.05)",
            border: "1px solid rgba(60,196,240,0.2)",
          }}
        >
          <Quote className="absolute top-4 right-4 md:top-5 md:right-5 h-7 w-7 md:h-9 md:w-9 opacity-10" style={{ color: "#3CC4F0" }} />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
              transition={{ duration: 0.35 }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-3 md:mb-4">
                {[...Array(5)].map((_, si) => (
                  <Star key={si} className="h-3.5 w-3.5 md:h-4 md:w-4 fill-current" style={{ color: "#fbbf24" }} />
                ))}
              </div>

              {/* Quote text */}
              <p className="text-sm md:text-base leading-relaxed mb-4 md:mb-5 font-medium" style={{ color: "#47759C" }}>
                "{isRtl ? t.textAr : t.textEn}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-3 md:pt-4" style={{ borderTop: "1px solid rgba(60,196,240,0.15)" }}>
                <div className="h-10 w-10 md:h-11 md:w-11 rounded-xl flex items-center justify-center text-sm md:text-base font-black text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)", boxShadow: "0 6px 16px rgba(60,196,240,0.3)" }}>
                  {(isRtl ? t.nameAr : t.nameEn).charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-sm truncate" style={{ color: "#0F1516" }}>{isRtl ? t.nameAr : t.nameEn}</p>
                  <p className="text-[11px] md:text-xs" style={{ color: "#3CC4F0" }}>{isRtl ? t.roleAr : t.roleEn}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-5 md:mt-6">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              aria-label={`Testimonial ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: activeIdx === i ? "28px" : "7px",
                height: "7px",
                background: activeIdx === i ? "#3CC4F0" : "rgba(71,117,156,0.25)",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════
   Section: Contact / Location
   ════════════════════════════════════════════════════ */
export function PremiumContact({ phone }: { phone?: string }) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const phoneClean = (phone || "+97412345678").replace(/\D/g, "");

  const items = [
    {
      icon: MapPin, titleAr: "موقعنا", titleEn: "Our Location",
      valueAr: "الدوحة، قطر", valueEn: "Doha, Qatar",
      action: () => window.open("https://maps.google.com/?q=Doha+Qatar", "_blank"),
      ctaAr: "افتح الخريطة", ctaEn: "Open Map",
    },
    {
      icon: Phone, titleAr: "اتصل بنا", titleEn: "Call Us",
      valueAr: phone || "+974 1234 5678", valueEn: phone || "+974 1234 5678",
      action: () => window.open(`tel:+${phoneClean}`),
      ctaAr: "اتصل الآن", ctaEn: "Call Now",
    },
    {
      icon: Clock, titleAr: "أوقات العمل", titleEn: "Working Hours",
      valueAr: "السبت - الأربعاء", valueEn: "Sat - Wed", sub: "9 AM — 9 PM",
    },
    {
      icon: MessageCircle, titleAr: "واتساب", titleEn: "WhatsApp",
      valueAr: "تواصل سريع", valueEn: "Quick chat",
      action: () => window.open(`https://wa.me/${phoneClean}`, "_blank"),
      ctaAr: "تواصل", ctaEn: "Chat",
    },
  ];

  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionHeader
          badgeIcon={<MapPin className="h-4 w-4" />}
          badgeAr="تواصل معنا" badgeEn="GET IN TOUCH"
          titleAr="نحن هنا لخدمتك" titleEn="We're Here For You"
          subtitleAr="تواصل معنا في أي وقت بالطريقة اللي تناسبك" subtitleEn="Reach us anytime, the way you prefer"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative rounded-3xl overflow-hidden min-h-[400px]"
            style={{
              boxShadow: "0 20px 50px rgba(60,196,240,0.15), 0 4px 20px rgba(0,0,0,0.06)",
              border: "1px solid rgba(60,196,240,0.15)",
            }}
          >
            <iframe
              title="Adrenaline Doha Map"
              width="100%"
              height="100%"
              loading="lazy"
              style={{ border: 0, minHeight: "400px" }}
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d115502.50820625307!2d51.4424!3d25.2854!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e45c534ffdce87f%3A0x1cfa88cf812b4032!2sDoha!5e0!3m2!1sen!2sqa!4v1700000000000"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  onClick={item.action}
                  className={`group relative bg-white rounded-2xl p-5 md:p-6 ${item.action ? "cursor-pointer" : ""}`}
                  style={{
                    boxShadow: "0 4px 20px rgba(0,0,0,0.04), 0 1px 6px rgba(0,0,0,0.02)",
                    border: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "linear-gradient(90deg, #3CC4F0, #47759C)" }} />

                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="h-12 w-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background: "linear-gradient(135deg, #3CC4F0, #47759C)",
                      boxShadow: "0 6px 20px rgba(60,196,240,0.3)",
                    }}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </motion.div>

                  <h3 className="text-sm md:text-base font-black text-[#0F1516] mb-1">
                    {isRtl ? item.titleAr : item.titleEn}
                  </h3>
                  <p className="text-sm md:text-base font-semibold mb-1" style={{ color: "#47759C" }}>
                    {isRtl ? item.valueAr : item.valueEn}
                  </p>
                  {item.sub && (
                    <p className="text-xs font-bold tabular-nums" style={{ color: "#3CC4F0" }}>{item.sub}</p>
                  )}
                  {item.ctaAr && (
                    <p className="text-xs font-bold mt-2 inline-flex items-center gap-1 group-hover:gap-2 transition-all"
                      style={{ color: "#3CC4F0" }}>
                      {isRtl ? item.ctaAr : item.ctaEn}
                      {isRtl ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════
   Section: Footer
   ════════════════════════════════════════════════════ */
export function PremiumFooter({ phone, onSubscribeClick }: { phone?: string; onSubscribeClick: () => void }) {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  return (
    <footer className="relative pt-20 pb-8 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0F1516 0%, #1a2628 100%)" }}>
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #3CC4F0, transparent 70%)" }} />

      <div className="relative max-w-7xl mx-auto px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12 pb-12 border-b border-white/10"
        >
          <div className="md:col-span-2">
            <img src="/adrenaline-logo-full.png" alt="Adrenaline" className="h-10 w-auto mb-4 brightness-0 invert" loading="lazy" />
            <p className="text-sm leading-relaxed mb-5 max-w-md" style={{ color: "#BCBEBF" }}>
              {isRtl
                ? "وجبات صحية ولذيذة، توصيل يومي، وفريق محترف يهتم بأهدافك الغذائية."
                : "Healthy delicious meals, daily delivery, and a professional team focused on your goals."}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={onSubscribeClick}
              className="h-11 px-6 rounded-full text-sm font-bold flex items-center gap-2"
              style={{
                background: "linear-gradient(135deg, #25D366, #128C7E)",
                color: "#fff",
                boxShadow: "0 6px 20px rgba(37,211,102,0.35)",
              }}
            >
              <MessageCircle className="h-4 w-4" />
              {isRtl ? "تواصل واتساب" : "Chat on WhatsApp"}
            </motion.button>
          </div>

          <div>
            <h4 className="text-sm font-black text-white mb-4 tracking-wider uppercase">
              {isRtl ? "روابط سريعة" : "Quick Links"}
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: "/public/menu", ar: "القائمة", en: "Menu" },
                { href: "/public/plans", ar: "الخطط", en: "Plans" },
                { href: "/public/about", ar: "من نحن", en: "About" },
                { href: "/public/contact", ar: "اتصل بنا", en: "Contact" },
              ].map((l, i) => (
                <li key={i}>
                  <a href={l.href} className="text-sm transition-colors hover:text-[#3CC4F0]" style={{ color: "#BCBEBF" }}>
                    {isRtl ? l.ar : l.en}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-black text-white mb-4 tracking-wider uppercase">
              {isRtl ? "تواصل" : "Contact"}
            </h4>
            <ul className="space-y-3 text-sm" style={{ color: "#BCBEBF" }}>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: "#3CC4F0" }} />
                <span>{isRtl ? "الدوحة، قطر" : "Doha, Qatar"}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0" style={{ color: "#3CC4F0" }} />
                <span dir="ltr" className="tabular-nums">{phone || "+974 1234 5678"}</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 flex-shrink-0" style={{ color: "#3CC4F0" }} />
                <span>9 AM — 9 PM</span>
              </li>
            </ul>

            <div className="flex items-center gap-2 mt-5">
              <motion.a
                whileHover={{ scale: 1.1, y: -2 }}
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="h-9 w-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <Instagram className="h-4 w-4 text-white" />
              </motion.a>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={{ color: "#BCBEBF" }}>
          <p>© {new Date().getFullYear()} ADRENALINE Healthy Food. {isRtl ? "جميع الحقوق محفوظة" : "All rights reserved."}</p>
          <p className="flex items-center gap-1.5">
            <span>{isRtl ? "صُنع بـ" : "Made with"}</span>
            <Heart className="h-3 w-3 fill-current" style={{ color: "#3CC4F0" }} />
            <span>{isRtl ? "في قطر" : "in Qatar"}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
