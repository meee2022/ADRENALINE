/**
 * @file client/src/pages/public/HomePage.tsx
 * @description Premium homepage — modern, professional design with WhatsApp integration
 */
import { useState } from "react";
import { useBanners, usePublicPlans } from "@/lib/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { HeroCarousel } from "@/components/public/HeroCarousel";
import {
  Check, ArrowLeft, ArrowRight, Star, Clock, Truck, Heart, Users, Award,
  Leaf, ChefHat, Sparkles, MessageCircle, Phone, ShoppingBag, Calendar,
  ChevronDown, Quote, Zap, ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  const { data: banners = [] } = useBanners();
  const { data: allPlans = [] } = usePublicPlans("week");
  const settings = useQuery(api.restaurantSettings.get);

  const weekPlans = allPlans.filter((p: any) => p.duration === "week");

  // ─── WhatsApp helper ───
  const phoneRaw = (settings?.phone || "+97412345678").replace(/\D/g, "");
  const whatsappLink = (message: string) =>
    `https://wa.me/${phoneRaw}?text=${encodeURIComponent(message)}`;

  const handleSubscribe = (planName: string, option: any) => {
    const msg = isRtl
      ? `مرحباً 👋\nأرغب في الاشتراك في خطة *${planName}*\n\nالباقة: ${option.mealsCount} وجبات + ${option.snacksCount} سناك\n\nمن فضلك أرسلوا لي تفاصيل الاشتراك والأسعار.`
      : `Hello 👋\nI'd like to subscribe to the *${planName}* plan.\n\nPackage: ${option.mealsCount} meals + ${option.snacksCount} snacks\n\nPlease send me subscription details and pricing.`;
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
      {/* ═══════════ HERO CAROUSEL ═══════════ */}
      <HeroCarousel banners={banners} isRtl={isRtl} settings={settings} />

      {/* ═══════════ STATS BAR (social proof) ═══════════ */}
      <section className="relative -mt-12 z-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div
            className="rounded-3xl p-6 md:p-8 backdrop-blur-md grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.97), rgba(255,255,255,0.92))",
              boxShadow: "0 20px 60px rgba(60,196,240,0.15), 0 4px 20px rgba(0,0,0,0.08)",
              border: "1px solid rgba(60,196,240,0.15)",
            }}
          >
            {[
              { icon: Users,    val: "500+",  label: isRtl ? "مشترك سعيد"   : "Happy Subscribers" },
              { icon: ChefHat,  val: "50+",   label: isRtl ? "وجبة في القائمة" : "Menu Items" },
              { icon: Truck,    val: "10K+",  label: isRtl ? "وجبة موصّلة"  : "Meals Delivered" },
              { icon: Star,     val: "4.9",   label: isRtl ? "تقييم العملاء" : "Customer Rating" },
            ].map(({ icon: Icon, val, label }, i) => (
              <div key={i} className="flex items-center gap-3 md:gap-4">
                <div
                  className="h-12 w-12 md:h-14 md:w-14 rounded-2xl flex-shrink-0 flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #3CC4F0, #47759C)",
                    boxShadow: "0 4px 14px rgba(60,196,240,0.35)",
                  }}
                >
                  <Icon className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-black text-[#0F1516] tabular-nums leading-none">{val}</div>
                  <div className="text-[11px] md:text-xs text-[#47759C] font-semibold mt-1">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PLANS ═══════════ */}
      <section id="plans-section" className="py-24 bg-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-20 -right-32 w-80 h-80 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #3CC4F0, transparent)" }} />
        <div className="absolute bottom-20 -left-32 w-80 h-80 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #47759C, transparent)" }} />

        <div className="max-w-7xl mx-auto px-4 relative">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{ background: "linear-gradient(135deg, #3CC4F015, #47759C10)", border: "1px solid #3CC4F030" }}>
              <Sparkles className="h-4 w-4" style={{ color: "#3CC4F0" }} />
              <span className="text-sm font-bold" style={{ color: "#47759C" }}>
                {isRtl ? "خطط مرنة لكل أهدافك" : "Flexible plans for every goal"}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[#0F1516] mb-4 tracking-tight">
              {isRtl ? "استكشف خططنا" : "Explore Our Plans"}
            </h2>
            <p className="text-base md:text-lg text-[#47759C] max-w-2xl mx-auto leading-relaxed">
              {isRtl
                ? "اختر الخطة المناسبة لأهدافك الصحية واستمتع بوجبات لذيذة ومتوازنة محضّرة بحب"
                : "Choose the plan that suits your health goals and enjoy delicious balanced meals prepared with love"}
            </p>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {weekPlans.slice(0, 3).map((plan: any, idx: number) => {
              const isPopular = idx === 1;
              return (
                <div
                  key={plan._id}
                  className={cn(
                    "group relative bg-white rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-2",
                    isPopular && "md:-translate-y-2"
                  )}
                  style={{
                    boxShadow: isPopular
                      ? "0 20px 60px rgba(60,196,240,0.25), 0 8px 20px rgba(0,0,0,0.06)"
                      : "0 8px 30px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)",
                    border: isPopular ? "2px solid #3CC4F0" : "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  {/* Popular ribbon */}
                  {isPopular && (
                    <div className="absolute top-4 right-4 z-10">
                      <div className="px-3 py-1.5 rounded-full text-xs font-black text-white flex items-center gap-1"
                        style={{
                          background: "linear-gradient(135deg, #3CC4F0, #47759C)",
                          boxShadow: "0 4px 12px rgba(60,196,240,0.4)",
                        }}>
                        <Sparkles className="h-3 w-3" />
                        {isRtl ? "الأكثر شعبية" : "MOST POPULAR"}
                      </div>
                    </div>
                  )}

                  {/* Image */}
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={plan.imageUrl}
                      alt={isRtl ? plan.nameAr : plan.nameEn || plan.nameAr}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0"
                      style={{
                        background: "linear-gradient(180deg, transparent 30%, rgba(15,21,22,0.85) 100%)",
                      }} />
                    <div className="absolute bottom-4 inset-x-5">
                      <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                        {isRtl ? plan.nameAr : plan.nameEn || plan.nameAr}
                      </h3>
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Description */}
                    <p className="text-sm text-[#47759C] mb-5 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                      {isRtl ? plan.descriptionAr : plan.descriptionEn || plan.descriptionAr}
                    </p>

                    {/* Options */}
                    <div className="space-y-2.5 mb-6">
                      {plan.options?.map((option: any, oi: number) => (
                        <button
                          key={oi}
                          onClick={() => handleSubscribe(isRtl ? plan.nameAr : plan.nameEn || plan.nameAr, option)}
                          className="w-full group/opt flex items-center justify-between px-4 py-3 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.99]"
                          style={{
                            background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                            border: "1.5px solid #e2e8f0",
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: "#3CC4F015" }}>
                              <Check className="h-3.5 w-3.5" style={{ color: "#3CC4F0" }} />
                            </div>
                            <span className="text-sm font-bold text-[#0F1516]">
                              {option.mealsCount} {isRtl ? "وجبات" : "meals"} + {option.snacksCount} {isRtl ? "سناك" : "snacks"}
                            </span>
                          </div>
                          <ArrowLeft className="h-4 w-4 flex-shrink-0" style={{ color: "#3CC4F0" }} />
                        </button>
                      ))}
                    </div>

                    {/* Features */}
                    {plan.features && plan.features.length > 0 && (
                      <div className="space-y-2 mb-6 pb-6 border-b border-gray-100">
                        {plan.features.map((feature: string, fi: number) => (
                          <div key={fi} className="flex items-center gap-2 text-sm text-[#47759C]">
                            <ShieldCheck className="h-4 w-4 flex-shrink-0" style={{ color: "#3CC4F0" }} />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* WhatsApp CTA */}
                    <button
                      onClick={() => handleSubscribe(
                        isRtl ? plan.nameAr : plan.nameEn || plan.nameAr,
                        plan.options?.[0] || { mealsCount: 0, snacksCount: 0, priceQAR: 0 }
                      )}
                      className="w-full h-12 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: "linear-gradient(135deg, #25D366, #128C7E)",
                        boxShadow: "0 6px 20px rgba(37,211,102,0.35)",
                      }}
                    >
                      <MessageCircle className="h-5 w-5" />
                      {isRtl ? "اشترك عبر واتساب" : "Subscribe via WhatsApp"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* View all */}
          <div className="text-center mt-12">
            <a
              href="/public/plans"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-full font-bold transition-all hover:gap-4"
              style={{
                background: "transparent",
                border: "2px solid #3CC4F0",
                color: "#3CC4F0",
              }}
            >
              {isRtl ? "عرض جميع الخطط" : "View All Plans"}
              {isRtl ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-24 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #f8fafc 0%, #ecfeff 50%, #f0f9ff 100%)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{ background: "#3CC4F015", border: "1px solid #3CC4F030" }}>
              <Zap className="h-4 w-4" style={{ color: "#3CC4F0" }} />
              <span className="text-sm font-bold" style={{ color: "#47759C" }}>
                {isRtl ? "بسيط وسريع" : "Simple & Easy"}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[#0F1516] mb-4 tracking-tight">
              {isRtl ? "كيف تشترك معنا؟" : "How It Works"}
            </h2>
            <p className="text-base md:text-lg text-[#47759C] max-w-2xl mx-auto">
              {isRtl ? "4 خطوات بسيطة وأنت في طريقك لحياة صحية" : "4 simple steps to a healthier lifestyle"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {[
              { icon: ShoppingBag,  title: isRtl ? "اختر خطتك"      : "Choose Your Plan",    desc: isRtl ? "تصفح خططنا واختر اللي يناسب أهدافك"  : "Browse and pick the plan that fits your goals" },
              { icon: MessageCircle, title: isRtl ? "تواصل واتساب"    : "Chat on WhatsApp",    desc: isRtl ? "تواصل معنا عبر الواتساب لتأكيد التفاصيل" : "Reach out via WhatsApp to confirm details" },
              { icon: ChefHat,      title: isRtl ? "نحضّر وجباتك"    : "We Prepare Your Meals", desc: isRtl ? "شيفنا يحضر وجباتك بمكونات طازجة يومياً" : "Our chefs prepare your meals with fresh ingredients" },
              { icon: Truck,        title: isRtl ? "نوصلها لباب بيتك" : "Delivered to You",    desc: isRtl ? "نوصل وجباتك في الوقت اللي يناسبك"     : "We deliver to your doorstep on time" },
            ].map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-white rounded-3xl p-6 h-full transition-all hover:-translate-y-1"
                  style={{
                    boxShadow: "0 8px 30px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.05)",
                  }}>
                  {/* Number badge */}
                  <div className="absolute -top-4 -right-4 h-10 w-10 rounded-full flex items-center justify-center font-black text-white text-lg"
                    style={{
                      background: "linear-gradient(135deg, #3CC4F0, #47759C)",
                      boxShadow: "0 4px 14px rgba(60,196,240,0.35)",
                    }}>
                    {i + 1}
                  </div>
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background: "linear-gradient(135deg, #3CC4F015, #47759C10)",
                      border: "1.5px solid #3CC4F030",
                    }}>
                    <step.icon className="h-7 w-7" style={{ color: "#3CC4F0" }} />
                  </div>
                  <h3 className="text-lg font-black text-[#0F1516] mb-2">{step.title}</h3>
                  <p className="text-sm text-[#47759C] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ WHY CHOOSE US ═══════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{ background: "#3CC4F015", border: "1px solid #3CC4F030" }}>
              <Heart className="h-4 w-4" style={{ color: "#3CC4F0" }} />
              <span className="text-sm font-bold" style={{ color: "#47759C" }}>
                {isRtl ? "لماذا تختارنا" : "Why Choose Us"}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[#0F1516] mb-4 tracking-tight">
              {isRtl ? "أكثر من مجرد وجبات" : "More Than Just Meals"}
            </h2>
            <p className="text-base md:text-lg text-[#47759C] max-w-2xl mx-auto">
              {isRtl ? "نلتزم بأعلى معايير الجودة والصحة في كل وجبة" : "We commit to the highest quality and health standards in every meal"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Leaf,       title: isRtl ? "مكونات طازجة"      : "Fresh Ingredients",   desc: isRtl ? "نختار أجود المكونات الطازجة يومياً من مصادر موثوقة"      : "We pick the finest fresh ingredients daily from trusted sources" },
              { icon: ChefHat,    title: isRtl ? "شيفات محترفون"     : "Expert Chefs",        desc: isRtl ? "فريقنا من الشيفات المحترفين يحضر وجباتك بإتقان"           : "Our team of expert chefs prepares your meals with precision" },
              { icon: Truck,      title: isRtl ? "توصيل مجاني"        : "Free Delivery",       desc: isRtl ? "نوصل لباب بيتك بدون رسوم إضافية في كل مكان بقطر"        : "We deliver to your doorstep with no extra charges across Qatar" },
              { icon: Award,      title: isRtl ? "قيم غذائية محسوبة"  : "Calculated Nutrition", desc: isRtl ? "كل وجبة مصممة بدقة لتناسب أهدافك الصحية والغذائية"        : "Every meal is precisely designed for your health goals" },
              { icon: ShieldCheck, title: isRtl ? "ضمان الجودة"      : "Quality Guaranteed",   desc: isRtl ? "نلتزم بأعلى معايير الجودة والنظافة في كل خطوة"          : "We maintain the highest quality and hygiene standards" },
              { icon: Calendar,   title: isRtl ? "خطط مرنة"          : "Flexible Plans",       desc: isRtl ? "اختر من خطط أسبوعية وشهرية تناسب احتياجاتك"            : "Choose from weekly and monthly plans that fit your needs" },
            ].map((feat, i) => (
              <div key={i}
                className="group relative bg-white rounded-3xl p-6 transition-all hover:-translate-y-1"
                style={{
                  boxShadow: "0 4px 20px rgba(0,0,0,0.04), 0 1px 6px rgba(0,0,0,0.02)",
                  border: "1px solid rgba(0,0,0,0.05)",
                }}>
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "linear-gradient(90deg, #3CC4F0, #47759C)" }} />
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{
                    background: "linear-gradient(135deg, #3CC4F0, #47759C)",
                    boxShadow: "0 6px 20px rgba(60,196,240,0.3)",
                  }}>
                  <feat.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-lg font-black text-[#0F1516] mb-2">{feat.title}</h3>
                <p className="text-sm text-[#47759C] leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="py-24 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F1516 0%, #1a2628 50%, #0F1516 100%)" }}>
        {/* Decorative glows */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #3CC4F0, transparent)" }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, #47759C, transparent)" }} />

        <div className="max-w-7xl mx-auto px-4 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{ background: "rgba(60,196,240,0.15)", border: "1px solid rgba(60,196,240,0.3)" }}>
              <Star className="h-4 w-4" style={{ color: "#3CC4F0" }} />
              <span className="text-sm font-bold" style={{ color: "#3CC4F0" }}>
                {isRtl ? "آراء عملائنا" : "Testimonials"}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
              {isRtl ? "ما يقوله عملاؤنا" : "What Our Clients Say"}
            </h2>
            <p className="text-base md:text-lg text-[#BCBEBF] max-w-2xl mx-auto">
              {isRtl ? "قصص حقيقية من عملاء غيّروا حياتهم معنا" : "Real stories from clients who transformed their lives with us"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: isRtl ? "أحمد المالكي"   : "Ahmed Al-Maliki",   role: isRtl ? "رياضي محترف" : "Pro Athlete",       text: isRtl ? "أفضل خطة وجبات صحية جربتها! الطعام لذيذ والتوصيل دايماً في الميعاد. ساعدتني أوصل لأهدافي بسهولة." : "The best meal plan I've tried! Delicious food, always on time. Helped me reach my goals easily." },
              { name: isRtl ? "فاطمة العبدالله" : "Fatima Al-Abdullah", role: isRtl ? "مدربة لياقة"  : "Fitness Coach",     text: isRtl ? "خسرت 8 كيلو في شهرين بدون ما أحس إني على دايت! الوجبات متنوعة والشيف محترف فعلاً." : "Lost 8kg in 2 months without feeling I'm dieting! Varied meals, truly expert chef." },
              { name: isRtl ? "محمد الكواري"   : "Mohammed Al-Kuwari", role: isRtl ? "رجل أعمال"   : "Businessman",       text: isRtl ? "حياتي اتغيرت 100%. الوجبات جاهزة وصحية ومحسوبة، توفرلي وقت كتير وطاقتي زادت." : "My life changed 100%. Meals are ready, healthy, calculated — saved tons of time, energy boosted." },
            ].map((t, i) => (
              <div key={i} className="rounded-3xl p-6 backdrop-blur-sm relative"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}>
                <Quote className="absolute top-4 left-4 h-8 w-8 opacity-20" style={{ color: "#3CC4F0" }} />

                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, si) => (
                    <Star key={si} className="h-4 w-4 fill-current" style={{ color: "#fbbf24" }} />
                  ))}
                </div>

                <p className="text-[#BCBEBF] text-sm leading-relaxed mb-6">
                  "{t.text}"
                </p>

                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black text-white"
                    style={{ background: "linear-gradient(135deg, #3CC4F0, #47759C)" }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{t.name}</p>
                    <p className="text-xs" style={{ color: "#3CC4F0" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{ background: "#3CC4F015", border: "1px solid #3CC4F030" }}>
              <ChevronDown className="h-4 w-4" style={{ color: "#3CC4F0" }} />
              <span className="text-sm font-bold" style={{ color: "#47759C" }}>
                {isRtl ? "أسئلة شائعة" : "Common Questions"}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[#0F1516] mb-4 tracking-tight">
              {isRtl ? "الأسئلة الأكثر شيوعاً" : "Frequently Asked Questions"}
            </h2>
            <p className="text-base md:text-lg text-[#47759C]">
              {isRtl ? "كل ما تحتاج معرفته قبل الاشتراك" : "Everything you need to know before subscribing"}
            </p>
          </div>

          <div className="space-y-3">
            {[
              { q: isRtl ? "كيف أبدأ الاشتراك؟"        : "How do I start a subscription?",     a: isRtl ? "ببساطة اختر الخطة المناسبة من صفحتنا واضغط على زر الاشتراك عبر واتساب، وفريقنا هيتواصل معاك فوراً لتأكيد التفاصيل." : "Simply choose your preferred plan and click the WhatsApp subscribe button. Our team will contact you immediately to confirm details." },
              { q: isRtl ? "هل التوصيل مجاني؟"        : "Is delivery free?",                  a: isRtl ? "نعم! التوصيل مجاني تماماً لجميع المشتركين في كل أنحاء قطر، ونوصلك في الوقت اللي تختاره."                                : "Yes! Delivery is completely free for all subscribers across Qatar at the time you choose." },
              { q: isRtl ? "هل أقدر أغير وجباتي؟"     : "Can I customize my meals?",          a: isRtl ? "أكيد! تقدر تختار وجباتك من القائمة وتطلب تعديلات حسب تفضيلاتك أو حساسيتك من الطعام."                                       : "Of course! You can pick meals from our menu and request modifications based on preferences or allergies." },
              { q: isRtl ? "كم مدة الاشتراك؟"          : "How long is the subscription?",      a: isRtl ? "عندنا خطط أسبوعية وشهرية، تقدر تختار اللي يناسبك وتجدد في أي وقت بسهولة."                                                  : "We offer weekly and monthly plans. Choose what suits you and renew anytime easily." },
              { q: isRtl ? "هل الأكل مناسب للحميات الخاصة؟" : "Are meals suitable for special diets?", a: isRtl ? "نعم! عندنا خطط متنوعة تشمل كيتو، لو-كارب، نباتي، وخطط مخصصة لأهدافك الصحية."                                              : "Yes! We have diverse plans including Keto, Low-carb, Vegetarian, and custom plans for your health goals." },
            ].map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div
            className="rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden text-center"
            style={{
              background: "linear-gradient(135deg, #3CC4F0 0%, #2bb0dc 50%, #47759C 100%)",
              boxShadow: "0 30px 80px rgba(60,196,240,0.4)",
            }}
          >
            {/* Decorative shapes */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #ffffff80, transparent 70%)" }} />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-15"
              style={{ background: "radial-gradient(circle, #ffffff80, transparent 70%)" }} />

            <div className="relative">
              <Sparkles className="h-12 w-12 mx-auto mb-6 text-white" />
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
                {isRtl ? "ابدأ رحلتك الصحية اليوم" : "Start Your Healthy Journey Today"}
              </h2>
              <p className="text-base md:text-xl text-white/90 max-w-2xl mx-auto mb-8 leading-relaxed">
                {isRtl
                  ? "انضم لـ 500+ عميل سعيد بيستمتعوا بوجبات صحية ولذيذة كل يوم"
                  : "Join 500+ happy customers enjoying healthy delicious meals every day"}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={handleGeneralInquiry}
                  className="h-14 px-8 rounded-full font-bold text-base flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: "#fff",
                    color: "#0F1516",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  }}
                >
                  <MessageCircle className="h-5 w-5" style={{ color: "#25D366" }} />
                  {isRtl ? "تواصل واتساب" : "Chat on WhatsApp"}
                </button>
                <a
                  href="/public/plans"
                  className="h-14 px-8 rounded-full font-bold text-base flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    border: "1.5px solid rgba(255,255,255,0.4)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  {isRtl ? "تصفح الخطط" : "Browse Plans"}
                  {isRtl ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating WhatsApp button */}
      <button
        onClick={handleGeneralInquiry}
        aria-label="WhatsApp"
        className="fixed bottom-24 md:bottom-8 left-6 z-40 h-14 w-14 rounded-full flex items-center justify-center transition-all hover:scale-110"
        style={{
          background: "linear-gradient(135deg, #25D366, #128C7E)",
          boxShadow: "0 8px 24px rgba(37,211,102,0.5)",
        }}
      >
        <MessageCircle className="h-6 w-6 text-white" />
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ background: "#25D366" }} />
      </button>
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
