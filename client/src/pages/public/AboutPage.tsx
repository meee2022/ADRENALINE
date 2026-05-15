/**
 * @file client/src/pages/public/AboutPage.tsx
 * @description Premium About page — Adrenaline brand story
 */
import * as React from "react";
import { motion } from "framer-motion";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PremiumPageHero } from "@/components/public/PremiumPageHero";
import { PremiumFooter, PremiumContact } from "@/components/public/PremiumSections";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import {
  Heart, Award, Users, Utensils, ChefHat, Leaf, Target, Zap,
  ShieldCheck, Sparkles, MessageCircle, ArrowLeft, ArrowRight,
} from "lucide-react";

export default function AboutPage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const settings = useQuery(api.restaurantSettings.get);

  const phoneClean = String(settings?.phone || "+97412345678").replace(/\D/g, "");
  const handleSubscribe = () => {
    const msg = isRtl
      ? `مرحباً 👋\nأرغب في الاشتراك في خطط أدرينالين الصحية.`
      : `Hello 👋\nI'd like to subscribe to Adrenaline plans.`;
    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const values = [
    { icon: Leaf, ar: "مكونات طازجة", en: "Fresh Ingredients", descAr: "نختار يومياً من أفضل الموردين", descEn: "Daily-sourced from top suppliers" },
    { icon: ChefHat, ar: "طبخ احترافي", en: "Expert Cooking", descAr: "شيفات بخبرة 10+ سنوات", descEn: "Chefs with 10+ years experience" },
    { icon: Target, ar: "محسوب بدقة", en: "Precision Tracked", descAr: "كل سعرة وكل ماكرو مدروس", descEn: "Every calorie and macro counted" },
    { icon: ShieldCheck, ar: "جودة معتمدة", en: "Certified Quality", descAr: "معايير صحية عالمية", descEn: "International health standards" },
    { icon: Zap, ar: "توصيل سريع", en: "Fast Delivery", descAr: "في وقت محدد كل يوم", descEn: "On-time, every day" },
    { icon: Heart, ar: "نهتم بأهدافك", en: "We Care About Goals", descAr: "أخصائيو تغذية يدعمونك", descEn: "Nutritionists supporting you" },
  ];

  const stats = [
    { val: "500+", ar: "مشترك سعيد", en: "Happy Subscribers" },
    { val: "10K+", ar: "وجبة موصّلة", en: "Meals Delivered" },
    { val: "50+", ar: "وصفة في القائمة", en: "Menu Items" },
    { val: "4.9", ar: "تقييم العملاء", en: "Customer Rating" },
  ];

  return (
    <PublicLayout>
      <PremiumPageHero
        badgeIcon={<Sparkles className="h-4 w-4" />}
        badgeAr="من نحن" badgeEn="ABOUT US"
        titleAr={<>قصة <span style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>أدرينالين</span></>}
        titleEn={<>The <span style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Adrenaline</span> Story</>}
        subtitleAr="رحلة بدأت بشغف الأكل الصحي اللذيذ، وكبرت لتكون عائلة من 500+ مشترك في كل أنحاء قطر"
        subtitleEn="A journey that started with passion for tasty healthy food, and grew into a family of 500+ subscribers across Qatar"
      />

      {/* ─── Story Section ─── */}
      <section className="relative py-20 md:py-28 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: isRtl ? 40 : -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="relative aspect-[4/5] max-w-md mx-auto">
                <div className="absolute inset-4 rounded-[2.5rem] -rotate-3"
                  style={{ background: "linear-gradient(135deg, #3CC4F0 0%, #47759C 100%)", boxShadow: "0 30px 60px rgba(60,196,240,0.25)" }} />
                <div className="relative h-full rounded-[2.5rem] overflow-hidden rotate-2"
                  style={{ border: "8px solid white", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
                  <img src="/hero-banner.png" alt="Our kitchen" loading="lazy" className="w-full h-full object-cover" />
                </div>
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: isRtl ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.15 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
                style={{ background: "linear-gradient(135deg, #3CC4F015, #47759C10)", border: "1px solid #3CC4F030" }}>
                <Heart className="h-4 w-4" style={{ color: "#3CC4F0" }} />
                <span className="text-xs md:text-sm font-bold tracking-wider" style={{ color: "#47759C" }}>
                  {isRtl ? "كيف بدأنا" : "HOW WE STARTED"}
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0F1516] mb-3 leading-[1.15] tracking-tight">
                {isRtl ? "أكثر من مجرد وجبات" : "More Than Just Meals"}
              </h2>
              <p className="text-base md:text-lg font-semibold mb-5" style={{ color: "rgba(71,117,156,0.6)" }} dir={isRtl ? "ltr" : "rtl"}>
                {isRtl ? "More Than Just Meals" : "أكثر من مجرد وجبات"}
              </p>

              <div className="space-y-4 text-base md:text-lg leading-relaxed" style={{ color: "#47759C" }}>
                <p>
                  {isRtl
                    ? "أدرينالين بدأت كحلم بسيط: نعمل أكل صحي يكون لذيذ فعلاً، مش بس \"حمية صعبة\". اشتغلنا مع شيفات وأخصائيي تغذية محترفين عشان كل وجبة تكون متوازنة ومدروسة."
                    : "Adrenaline began as a simple dream: make healthy food that's actually delicious — not just a 'hard diet.' We worked with expert chefs and nutritionists to ensure every meal is balanced and thoughtful."}
                </p>
                <p>
                  {isRtl
                    ? "اليوم، بنخدم أكثر من 500 مشترك في قطر، بنوصلهم وجبات يومية طازجة على باب البيت، وبنساعدهم يوصلوا لأهدافهم الصحية بدون ما يضحوا بطعم الأكل."
                    : "Today, we serve 500+ subscribers across Qatar, delivering fresh daily meals to their doorstep — helping them hit their goals without sacrificing flavor."}
                </p>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-2 gap-3 mt-8">
                {stats.slice(0, 2).map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                    className="rounded-2xl p-4 text-center"
                    style={{ background: "linear-gradient(135deg, #3CC4F015, #47759C10)", border: "1px solid #3CC4F030" }}
                  >
                    <div className="text-2xl md:text-3xl font-black tabular-nums" style={{ color: "#3CC4F0" }}>{s.val}</div>
                    <div className="text-xs md:text-sm font-bold mt-1" style={{ color: "#47759C" }}>{isRtl ? s.ar : s.en}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Values ─── */}
      <section className="py-20 md:py-28 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)" }}>
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{ background: "linear-gradient(135deg, #3CC4F015, #47759C10)", border: "1px solid #3CC4F030" }}
            >
              <Award className="h-4 w-4" style={{ color: "#3CC4F0" }} />
              <span className="text-xs md:text-sm font-bold tracking-wider" style={{ color: "#47759C" }}>
                {isRtl ? "قيمنا" : "OUR VALUES"}
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0F1516] mb-4 tracking-tight"
            >
              {isRtl ? "ما يميزنا" : "What Sets Us Apart"}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-base md:text-lg max-w-2xl mx-auto"
              style={{ color: "#47759C" }}
            >
              {isRtl ? "نلتزم بست قيم أساسية في كل وجبة نحضّرها" : "Six core values drive every meal we craft"}
            </motion.p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {values.map((v, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                className="group relative bg-white rounded-3xl p-6 md:p-7"
                style={{
                  boxShadow: "0 8px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div className="absolute top-0 inset-x-0 h-1 rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "linear-gradient(90deg, #3CC4F0, #47759C)" }} />

                <motion.div
                  whileHover={{ scale: 1.1, rotate: 6 }}
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{
                    background: "linear-gradient(135deg, #3CC4F0, #47759C)",
                    boxShadow: "0 8px 20px rgba(60,196,240,0.3)",
                  }}
                >
                  <v.icon className="h-7 w-7 text-white" />
                </motion.div>

                <h3 className="text-lg md:text-xl font-black text-[#0F1516] mb-2">
                  {isRtl ? v.ar : v.en}
                </h3>
                <p className="text-sm md:text-base leading-relaxed" style={{ color: "#47759C" }}>
                  {isRtl ? v.descAr : v.descEn}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Big stats banner ─── */}
      <section className="py-16 md:py-20 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F1516 0%, #1a2628 50%, #0F1516 100%)" }}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #3CC4F0, transparent 70%)" }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #47759C, transparent 70%)" }} />

        <div className="relative max-w-6xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center backdrop-blur-md rounded-2xl p-5 md:p-6"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div className="text-3xl md:text-5xl font-black tabular-nums leading-none mb-2"
                  style={{
                    background: "linear-gradient(135deg, #3CC4F0, #47759C)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}>
                  {s.val}
                </div>
                <div className="text-xs md:text-sm font-bold" style={{ color: "#BCBEBF" }}>
                  {isRtl ? s.ar : s.en}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 md:py-24 px-5 md:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden text-center"
            style={{
              background: "linear-gradient(135deg, #3CC4F0 0%, #2bb0dc 50%, #47759C 100%)",
              boxShadow: "0 30px 80px rgba(60,196,240,0.4)",
            }}
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)" }} />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-15"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)" }} />

            <div className="relative">
              <Sparkles className="h-12 w-12 mx-auto mb-6 text-white" />
              <h2 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight">
                {isRtl ? "انضم لعائلة أدرينالين" : "Join the Adrenaline Family"}
              </h2>
              <p className="text-base md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
                {isRtl ? "ابدأ رحلتك الصحية اليوم — أول وجبة بعد 24 ساعة" : "Start your healthy journey today — first meal in 24 hours"}
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubscribe}
                className="h-14 px-10 rounded-full font-bold text-base inline-flex items-center gap-2.5"
                style={{ background: "#fff", color: "#0F1516", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
              >
                <MessageCircle className="h-5 w-5" style={{ color: "#25D366" }} />
                {isRtl ? "اشترك عبر واتساب" : "Subscribe via WhatsApp"}
                {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Contact section ─── */}
      <PremiumContact phone={settings?.phone} />
    </PublicLayout>
  );
}
