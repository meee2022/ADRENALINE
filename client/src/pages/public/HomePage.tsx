/**
 * @file client/src/pages/public/HomePage.tsx
 * @description Compact premium homepage — Hero, Plans, Testimonials, FAQ, CTA, Footer
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useBanners, usePublicPlans } from "@/lib/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { HeroClean } from "@/components/public/HeroClean";
import { PremiumTestimonials, PremiumFooter } from "@/components/public/PremiumSections";
import {
  Check, ArrowLeft, ArrowRight, ShieldCheck, Sparkles, MessageCircle,
  ChevronDown, Leaf, ChefHat, Truck, Award,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { language, dir } = useLanguage();
  useSeo({ title: "أدرينالين للوجبات الصحية | وجبات دايت وتوصيل يومي في قطر", description: "وجبات صحية محسوبة السعرات تُحضَّر يومياً بإشراف أخصائيي تغذية وتوصَّل لباب بيتك في قطر. اشترك في باقتك الآن.", path: "/" });
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const [, setLocation] = useLocation();

  const { data: allPlans = [] } = usePublicPlans("week");
  const { data: banners = [] } = useBanners();
  const settings = useQuery(api.restaurantSettings.get);
  const allMeals = useQuery(api.publicMeals.list, {}) || [];
  const bestSellersRaw = useQuery((api.publicMeals as any).bestSellers, { limit: 6 });
  const bestSellers = bestSellersRaw || [];
  const bestSellersLoading = bestSellersRaw === undefined;
  const weekPlans = allPlans.filter((p: any) => p.duration === "week");

  // Hero carousel: prefer admin-managed banners (lifestyle hero shots),
  // fall back to real dish images, then stock.
  const heroImages: string[] = (() => {
    const bannerImgs = (banners || []).map((b: any) => b.imageUrl).filter(Boolean);
    if (bannerImgs.length) return bannerImgs;
    const dishImgs = allMeals.filter((m: any) => m.imageUrl).slice(0, 5).map((m: any) => m.imageUrl);
    if (dishImgs.length) return dishImgs;
    return ["/1.webp", "/2.webp", "/3.webp"];
  })();

  const phoneRaw = (settings?.phone || "+97412345678").replace(/\D/g, "");
  const whatsappLink = (message: string) =>
    `https://wa.me/${phoneRaw}?text=${encodeURIComponent(message)}`;

  const handleSubscribe = (planName: string, option: any) => {
    const msg = isRtl
      ? `مرحباً 👋\nأرغب في الاشتراك في خطة *${planName}*\n\nالباقة: ${option.mealsCount} وجبات + ${option.snacksCount} سناك\n\nمن فضلك أرسلوا لي تفاصيل الاشتراك.`
      : `Hello 👋\nI'd like to subscribe to the *${planName}* plan.\n\nPackage: ${option.mealsCount} meals + ${option.snacksCount} snacks\n\nPlease send me subscription details.`;
    window.open(whatsappLink(msg), "_blank");
  };

  const handleGeneralInquiry = () => {
    const msg = isRtl
      ? "مرحباً 👋\nأرغب في معرفة المزيد عن خطط أدرينالين الصحية."
      : "Hello 👋\nI'd like to learn more about Adrenaline healthy meal plans.";
    window.open(whatsappLink(msg), "_blank");
  };

  return (
    <PublicLayout>
      {/* ═══════════ HERO — clean premium carousel with real dish photos ═══════════ */}
      <HeroClean
        images={heroImages}
        titleAr="طعام صحي بمذاق لا يُقاوم"
        titleEn="Healthy Food That Tastes Amazing"
        subtitleAr="وجبات طازجة محسوبة السعرات تُحضَّر يومياً بإشراف أخصائيي تغذية — وتوصَّل لباب بيتك في قطر."
        subtitleEn="Fresh, calorie-counted meals prepared daily by nutritionists — delivered to your door in Qatar."
        onSubscribeClick={handleGeneralInquiry}
        onMenuClick={() => setLocation("/public/menu")}
        onSmartPlanClick={() => setLocation("/customer/smart-plan")}
      />

      {/* ═══════════ FEATURE STRIP — Floating glass card overlapping hero ═══════════ */}
      <section className="relative -mt-12 md:-mt-16 z-30 px-4 md:px-6 mb-8 md:mb-10">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="rounded-2xl md:rounded-3xl backdrop-blur-xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))",
              boxShadow: "0 20px 60px rgba(60,196,240,0.18), 0 4px 20px rgba(0,0,0,0.08)",
              border: "1px solid rgba(60,196,240,0.18)",
            }}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100"
              style={{ direction: isRtl ? "rtl" : "ltr" }}>
              {[
                { icon: Leaf, ar: "مكونات", en: "Fresh", subAr: "طازجة يومياً", subEn: "Daily-sourced" },
                { icon: ChefHat, ar: "شيفات", en: "Expert", subAr: "محترفون", subEn: "Chefs" },
                { icon: Truck, ar: "توصيل", en: "Free", subAr: "مجاني للجميع", subEn: "Delivery" },
                { icon: Award, ar: "جودة", en: "Premium", subAr: "معتمدة عالمياً", subEn: "Certified" },
              ].map(({ icon: Icon, ar, en, subAr, subEn }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
                  className="group relative px-4 md:px-5 py-5 md:py-6 flex items-center gap-3 md:gap-4 transition-colors hover:bg-gray-50/50"
                >
                  <div className="h-11 w-11 md:h-12 md:w-12 rounded-2xl flex-shrink-0 flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3"
                    style={{
                      background: "linear-gradient(135deg, #3CC4F0 0%, #47759C 100%)",
                      boxShadow: "0 6px 18px rgba(60,196,240,0.32)",
                    }}>
                    <Icon className="h-5 w-5 md:h-5.5 md:w-5.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm md:text-base font-black text-[#0F1516] leading-tight truncate">
                      {isRtl ? ar : en}
                    </p>
                    <p className="text-[10px] md:text-xs font-semibold mt-0.5 truncate" style={{ color: "#47759C" }}>
                      {isRtl ? subAr : subEn}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════ SMART PLAN PROMO ═══════════ */}
      <section className="px-4 md:px-6 py-10 md:py-14">
        <div className="max-w-6xl mx-auto rounded-3xl overflow-hidden relative"
          style={{ background: "linear-gradient(135deg,#0B2138 0%,#143A57 55%,#0E76AC 100%)" }}>
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle,#3AC7F455,transparent 70%)", filter: "blur(50px)" }} />
          <div className="relative z-10 grid md:grid-cols-[1.3fr_1fr] gap-6 items-center p-7 md:p-12"
            style={{ direction: isRtl ? "rtl" : "ltr" }}>
            <div className="text-center md:text-start">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4"
                style={{ background: "rgba(58,199,244,0.16)", border: "1px solid rgba(58,199,244,0.3)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "#3AC7F4" }} />
                <span className="text-xs font-bold tracking-wider" style={{ color: "#3AC7F4" }}>
                  {isRtl ? "جديد · مدعوم بالذكاء الاصطناعي" : "NEW · AI-POWERED"}
                </span>
              </div>
              <h2 className="font-black text-white mb-3" style={{ fontSize: "clamp(24px,3.5vw,40px)", fontFamily: "'Cairo',sans-serif" }}>
                {isRtl ? "خطتك الذكية لليوم — في ثوانٍ" : "Your Smart Daily Plan — in seconds"}
              </h2>
              <p className="text-white/80 mb-6 leading-relaxed mx-auto md:mx-0" style={{ maxWidth: 520 }}>
                {isRtl
                  ? "يختار لك الذكاء الاصطناعي وجبات اليوم المتاحة حسب هدفك وسعراتك وما لا تحبه — ثم يراجعها أخصائي التغذية."
                  : "AI picks today's available meals by your goal, calories, and dislikes — then a nutritionist reviews them."}
              </p>
              <button onClick={() => setLocation("/customer/smart-plan")}
                className="h-12 px-7 rounded-full font-black text-white inline-flex items-center gap-2 transition-transform hover:scale-[1.03]"
                style={{ background: "linear-gradient(135deg,#3AC7F4,#0E76AC)", boxShadow: "0 12px 30px -8px rgba(58,199,244,.5)" }}>
                <Sparkles className="w-5 h-5" />
                {isRtl ? "جرّب خطتي الذكية" : "Try Smart Plan"}
              </button>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <div className="flex flex-col gap-3 w-full max-w-xs">
                {[
                  { ar: "حسب هدفك", en: "By your goal", icon: "🎯" },
                  { ar: "محسوبة السعرات", en: "Calorie-counted", icon: "🔥" },
                  { ar: "تتجنّب ما لا تحبه", en: "Skips your dislikes", icon: "🚫" },
                  { ar: "مراجعة الأخصائي", en: "Nutritionist-reviewed", icon: "✅" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                    <span style={{ fontSize: 20 }}>{f.icon}</span>
                    <span className="text-white font-bold text-sm">{isRtl ? f.ar : f.en}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ PLANS ═══════════ */}
      <section id="plans-section" className="py-10 md:py-20 bg-white relative overflow-hidden">
        <div className="absolute top-20 -right-32 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #3CC4F0, transparent)" }} />
        <div className="absolute bottom-20 -left-32 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #47759C, transparent)" }} />

        <div className="max-w-7xl mx-auto px-5 md:px-8 relative">
          <div className="text-center mb-6 md:mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{ background: "linear-gradient(135deg, #3CC4F015, #47759C10)", border: "1px solid #3CC4F030" }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "#3CC4F0" }} />
              <span className="text-xs md:text-sm font-bold tracking-wider" style={{ color: "#47759C" }}>
                {isRtl ? "خطط مرنة" : "FLEXIBLE PLANS"}
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0F1516] mb-3 tracking-tight"
            >
              {isRtl ? "استكشف خططنا" : "Explore Our Plans"}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base max-w-xl mx-auto"
              style={{ color: "#47759C" }}
            >
              {isRtl
                ? "اختر الخطة المناسبة لأهدافك"
                : "Choose the plan that suits your goals"}
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {weekPlans.slice(0, 3).map((plan: any, idx: number) => {
              const isPopular = idx === 1;
              return (
                <motion.div
                  key={plan._id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  whileHover={{ y: -8 }}
                  className="group relative bg-white rounded-3xl overflow-hidden"
                  style={{
                    boxShadow: isPopular
                      ? "0 20px 60px rgba(60,196,240,0.25), 0 8px 20px rgba(0,0,0,0.06)"
                      : "0 8px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)",
                    border: isPopular ? "2px solid #3CC4F0" : "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  {isPopular && (
                    <div className="absolute top-4 right-4 z-10">
                      <div className="px-3 py-1.5 rounded-full text-[10px] font-black text-white flex items-center gap-1"
                        style={{
                          background: "linear-gradient(135deg, #3CC4F0, #47759C)",
                          boxShadow: "0 4px 12px rgba(60,196,240,0.4)",
                        }}>
                        <Sparkles className="h-3 w-3" />
                        {isRtl ? "الأكثر شعبية" : "POPULAR"}
                      </div>
                    </div>
                  )}

                  <div className="relative h-32 md:h-48 overflow-hidden">
                    <motion.img
                      src={plan.imageUrl}
                      alt={isRtl ? plan.nameAr : plan.nameEn || plan.nameAr}
                      loading="lazy"
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.7 }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0"
                      style={{ background: "linear-gradient(180deg, transparent 30%, rgba(15,21,22,0.85) 100%)" }} />
                    <div className="absolute bottom-3 inset-x-4">
                      <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
                        {isRtl ? plan.nameAr : plan.nameEn || plan.nameAr}
                      </h3>
                    </div>
                  </div>

                  <div className="p-4 md:p-5">
                    <p className="text-sm mb-3 md:mb-4 line-clamp-2" style={{ color: "#47759C" }}>
                      {isRtl ? plan.descriptionAr : plan.descriptionEn || plan.descriptionAr}
                    </p>

                    <div className="space-y-2 mb-3 md:mb-4">
                      {plan.options?.slice(0, 2).map((option: any, oi: number) => (
                        <button
                          key={oi}
                          onClick={() => handleSubscribe(isRtl ? plan.nameAr : plan.nameEn || plan.nameAr, option)}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all hover:scale-[1.02]"
                          style={{
                            background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                            border: "1.5px solid #e2e8f0",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5" style={{ color: "#3CC4F0" }} />
                            <span className="text-xs md:text-sm font-bold text-[#0F1516]">
                              {option.mealsCount} {isRtl ? "وجبات" : "meals"} + {option.snacksCount} {isRtl ? "سناك" : "snacks"}
                            </span>
                          </div>
                          <ArrowLeft className={cn("h-3.5 w-3.5 flex-shrink-0", !isRtl && "rotate-180")} style={{ color: "#3CC4F0" }} />
                        </button>
                      ))}
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSubscribe(
                        isRtl ? plan.nameAr : plan.nameEn || plan.nameAr,
                        plan.options?.[0] || { mealsCount: 0, snacksCount: 0 }
                      )}
                      className="w-full h-11 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
                      style={{
                        background: "linear-gradient(135deg, #3cc4f0, #47759c)",
                        boxShadow: "0 6px 16px rgba(60,196,240,0.35)",
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {isRtl ? "اشترك" : "Subscribe"}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center mt-8"
          >
            <a
              href="/public/plans"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full font-bold text-sm transition-all hover:gap-3"
              style={{
                background: "transparent",
                border: "2px solid #3CC4F0",
                color: "#3CC4F0",
              }}
            >
              {isRtl ? "عرض جميع الخطط" : "View All Plans"}
              {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </a>
          </motion.div>
        </div>
      </section>

      {/* ═══════════ BEST SELLERS ═══════════ */}
      {(bestSellersLoading || bestSellers.length > 0) && (
        <section className="py-10 md:py-20 bg-[#F7FBFE]" style={{ direction: isRtl ? "rtl" : "ltr" }}>
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="text-center mb-6 md:mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
                style={{ background: "#3CC4F015", border: "1px solid #3CC4F030" }}>
                <Sparkles className="h-4 w-4" style={{ color: "#0E76AC" }} />
                <span className="text-xs md:text-sm font-bold tracking-wider" style={{ color: "#0E76AC" }}>
                  {isRtl ? "اختيارات عملائنا" : "CUSTOMER FAVORITES"}
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-[#0E2A4A] mb-2" style={{ fontFamily: "'Cairo',sans-serif" }}>
                {isRtl ? "الأكثر طلبًا" : "Best Sellers"}
              </h2>
              <p className="text-base" style={{ color: "#47759C" }}>
                {isRtl ? "أكثر الوجبات التي يحبها مشتركونا" : "The meals our subscribers love most"}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {bestSellersLoading && Array.from({ length: 6 }).map((_, i) => (
                <div key={`sk-${i}`} className="rounded-3xl overflow-hidden bg-white" style={{ border: "1px solid #D9E6F1" }}>
                  <div className="w-full aspect-[4/3] animate-pulse" style={{ background: "#E4EEF6" }} />
                  <div className="p-4 space-y-2">
                    <div className="h-3 rounded animate-pulse" style={{ background: "#E4EEF6", width: "80%" }} />
                    <div className="h-2.5 rounded animate-pulse" style={{ background: "#EAF3FB", width: "55%" }} />
                  </div>
                </div>
              ))}
              {!bestSellersLoading && bestSellers.map((m: any, i: number) => (
                <motion.a key={m.id} href={m.slug ? `/public/meal/${m.slug}` : "/public/menu"}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="group rounded-3xl overflow-hidden bg-white block"
                  style={{ border: "1px solid #D9E6F1", boxShadow: "0 10px 30px -16px rgba(14,42,74,.3)", textDecoration: "none" }}>
                  <div className="relative w-full aspect-[4/3]" style={{ background: "#EAF3FB", overflow: "hidden" }}>
                    {m.imageUrl && <img src={m.imageUrl} alt={isRtl ? m.nameAr : m.nameEn}
                      loading="lazy" decoding="async"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105" />}
                    {i < 3 && (
                      <span className="absolute top-2 px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                        style={{ insetInlineStart: 8, background: i === 0 ? "#F4A93A" : "#0E76AC" }}>
                        {isRtl ? `#${i + 1} الأكثر طلبًا` : `#${i + 1} Best`}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="font-bold text-[#0E2A4A] text-sm leading-tight mb-1 line-clamp-1"
                      style={{ fontFamily: "'Cairo',sans-serif" }}>
                      {isRtl ? m.nameAr : m.nameEn}
                    </div>
                    {/* بدون سعر — أسعار المشتركين غير معروضة هنا (كانت خطأ) */}
                    <div className="flex items-center text-[11px]" style={{ color: "#47759C" }}>
                      <span>{m.calories} {isRtl ? "سعرة" : "kcal"}</span>
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <PremiumTestimonials />

      {/* ═══════════ FAQ (compact, 3 questions) ═══════════ */}
      <section className="py-10 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-5 md:px-8">
          <div className="text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{ background: "#3CC4F015", border: "1px solid #3CC4F030" }}
            >
              <ChevronDown className="h-4 w-4" style={{ color: "#3CC4F0" }} />
              <span className="text-xs md:text-sm font-bold tracking-wider" style={{ color: "#47759C" }}>
                {isRtl ? "أسئلة شائعة" : "FAQ"}
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl md:text-4xl font-black text-[#0F1516] mb-3 tracking-tight"
            >
              {isRtl ? "أكثر الأسئلة شيوعاً" : "Common Questions"}
            </motion.h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: isRtl ? "كيف أبدأ الاشتراك؟" : "How do I start?",
                a: isRtl ? "اختر الخطة المناسبة واضغط على زر الاشتراك عبر واتساب، وفريقنا هيتواصل معاك فوراً." : "Choose your plan and click the WhatsApp subscribe button. We'll contact you immediately.",
              },
              {
                q: isRtl ? "هل التوصيل مجاني؟" : "Is delivery free?",
                a: isRtl ? "نعم! التوصيل مجاني تماماً لجميع المشتركين في كل أنحاء قطر." : "Yes! Delivery is completely free for all subscribers across Qatar.",
              },
              {
                q: isRtl ? "هل أقدر أغير وجباتي؟" : "Can I customize meals?",
                a: isRtl ? "أكيد! تقدر تختار وجباتك من القائمة وتطلب تعديلات حسب تفضيلاتك." : "Of course! Pick meals from our menu and request modifications.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <FAQItem q={item.q} a={item.a} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="py-10 md:py-20 px-5 md:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-12 lg:p-14 relative overflow-hidden text-center"
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
              <Sparkles className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-4 text-white" />
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-white mb-3 tracking-tight leading-tight">
                {isRtl ? "ابدأ رحلتك الصحية اليوم" : "Start Your Healthy Journey"}
              </h2>
              <p className="text-sm md:text-lg text-white/90 max-w-xl mx-auto mb-6">
                {isRtl ? "انضم لـ 500+ عميل سعيد بيستمتعوا بوجبات صحية ولذيذة كل يوم" : "Join 500+ happy customers enjoying healthy meals daily"}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGeneralInquiry}
                  className="h-12 md:h-14 px-6 md:px-8 rounded-full font-bold text-sm md:text-base flex items-center gap-2"
                  style={{ background: "#fff", color: "#0F1516", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
                >
                  <MessageCircle className="h-5 w-5" style={{ color: "#25D366" }} />
                  {isRtl ? "تواصل واتساب" : "Chat on WhatsApp"}
                </motion.button>
                <motion.a
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  href="/public/plans"
                  className="h-12 md:h-14 px-6 md:px-8 rounded-full font-bold text-sm md:text-base flex items-center gap-2 backdrop-blur-md"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    border: "1.5px solid rgba(255,255,255,0.4)",
                  }}
                >
                  {isRtl ? "تصفح الخطط" : "Browse Plans"}
                  {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </motion.a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Floating WhatsApp button */}
      <motion.button
        onClick={handleGeneralInquiry}
        aria-label="WhatsApp"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-24 md:bottom-8 left-6 z-40 h-14 w-14 rounded-full flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #25D366, #128C7E)",
          boxShadow: "0 8px 24px rgba(37,211,102,0.5)",
        }}
      >
        <MessageCircle className="h-6 w-6 text-white" />
        <span className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ background: "#25D366" }} />
      </motion.button>
    </PublicLayout>
  );
}

// ─── FAQ Item ───
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: open ? "linear-gradient(135deg, #ecfeff, #f0f9ff)" : "#f8fafc",
        border: `1.5px solid ${open ? "#3CC4F0" : "#e2e8f0"}`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between text-right transition-colors"
      >
        <ChevronDown
          className="h-5 w-5 flex-shrink-0 transition-transform"
          style={{
            color: open ? "#3CC4F0" : "#94a3b8",
            transform: open ? "rotate(180deg)" : "rotate(0)",
          }}
        />
        <span className="font-bold text-[#0F1516] flex-1 mr-3">{q}</span>
      </button>
      {open && (
        <div className="px-5 pb-4 text-[#47759C] text-sm leading-relaxed border-t border-[#3CC4F0]/20 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}
