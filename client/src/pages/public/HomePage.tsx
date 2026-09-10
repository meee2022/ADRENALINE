/**
 * @file client/src/pages/public/HomePage.tsx
 * @description Compact premium homepage — Hero, Plans, Testimonials, FAQ, CTA, Footer
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useBanners, usePublicPlans } from "@/lib/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { HeroEditorial } from "@/components/public/HeroEditorial";
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

/** صورة بطاقة الباقة — روابط Convex Storage القديمة المخزّنة على الباقات ترجع 404،
 *  فنستبدلها بالأصول الثابتة المرفقة (نفس منطق صفحة الخطط PublicPlansNew). */
function planCardImage(plan: any): string {
  const key = `${plan?.slug || ""} ${plan?.nameEn || ""} ${plan?.nameAr || ""}`.toLowerCase();
  if (key.includes("diet") || key.includes("tanshif") || key.includes("تنشيف") || key.includes("تنظيف")) return "/plan-tanshif-real.jpg";
  if (key.includes("fitness") || key.includes("liyaqa") || key.includes("لياقة") || key.includes("لياقت")) return "/plan-liyaqa-real.jpg";
  if (key.includes("bulk") || key.includes("tadkhim") || key.includes("تضخيم")) return "/plan-tadkhim-real.jpg";
  return "/custom-plan-meals.jpg";
}

export default function HomePage() {
  const { language, dir } = useLanguage();
  useSeo({ title: "أدرينالين للوجبات الصحية | وجبات صحية وتوصيل يومي في قطر", description: "وجبات صحية محسوبة السعرات تُحضَّر يوميًا بإشراف أخصائيي تغذية وتصل إلى باب منزلك في قطر. اشترك في باقتك الآن.", path: "/" });
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
      <HeroEditorial
        images={heroImages}
        linesAr={["أكل حقيقي.", "سعرات محسوبة.", "ويوصلك طازج كل يوم."]}
        linesEn={["Real food.", "Counted calories.", "Fresh at your door, daily."]}
        subtitleAr="وجبات تُطبخ صباح كل يوم بإشراف أخصائيي تغذية، مصمّمة حول هدفك لا حول منيو المطاعم."
        subtitleEn="Meals cooked every morning under nutritionist supervision, built around your goal — not a restaurant menu."
        featured={bestSellers[0] || null}
        onSubscribeClick={handleGeneralInquiry}
        onMenuClick={() => setLocation("/public/menu")}
        onSmartPlanClick={() => setLocation("/customer/smart-plan")}
      />

      {/* ═══════════ TRUST STRIP — صف هادئ بلا تداخل ولا تدرّجات ═══════════ */}
      <section className="bg-white border-b" style={{ borderColor: "#E4EEF6" }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4" style={{ direction: isRtl ? "rtl" : "ltr" }}>
            {[
              { icon: Leaf, ar: "مكونات طازجة", en: "Fresh ingredients", subAr: "تُطبخ صباح كل يوم", subEn: "Cooked every morning" },
              { icon: ChefHat, ar: "شيفات محترفون", en: "Expert chefs", subAr: "وصفات معتمدة", subEn: "Approved recipes" },
              { icon: Truck, ar: "توصيل يومي", en: "Daily delivery", subAr: "مجاني لكل المشتركين", subEn: "Free for subscribers" },
              { icon: Award, ar: "جودة معتمدة", en: "Certified quality", subAr: "بإشراف أخصائيي تغذية", subEn: "Nutritionist-supervised" },
            ].map(({ icon: Icon, ar, en, subAr, subEn }, i) => (
              <div key={i}
                className={cn("flex items-center gap-3 py-5 md:py-6 px-2 md:px-5",
                  i % 2 === 1 && "border-s md:border-s", i >= 2 && "border-t md:border-t-0", i > 0 && "md:border-s")}
                style={{ borderColor: "#E4EEF6" }}>
                <div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center" style={{ background: "#EAF3FB" }}>
                  <Icon className="h-[18px] w-[18px]" style={{ color: "#0E76AC" }} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] md:text-sm font-black text-[#0F1516] leading-tight">{isRtl ? ar : en}</p>
                  <p className="text-[11px] md:text-xs mt-0.5 leading-tight" style={{ color: "#6B7C8C" }}>{isRtl ? subAr : subEn}</p>
                </div>
              </div>
            ))}
          </div>
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

      {/* ═══════════ PLANS — بطاقات هادئة: صورة دائرية، اسم، سعر كبير، باقتان، زر مفرّغ ═══════════ */}
      <section id="plans-section" className="py-12 md:py-20" style={{ background: "#E6EEF5", direction: isRtl ? "rtl" : "ltr" }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="font-black text-[#0E2A4A] tracking-tight" style={{ fontFamily: "'Cairo',sans-serif", fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 1.15 }}>
              {isRtl ? "برامج مبنية حول هدفك" : "Programs built around your goal"}
            </h2>
            <p className="mt-2 text-[15px] text-[#6B7C8C]">
              {isRtl ? "اختر الباقة وعدد وجباتك، ونتكفّل بالباقي." : "Pick a plan and your meal count. We handle the rest."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {weekPlans.slice(0, 3).map((plan: any, idx: number) => {
              const isPopular = idx === 1;
              const name = isRtl ? plan.nameAr : plan.nameEn || plan.nameAr;
              const opts: any[] = plan.options || [];
              const prices = opts.map((o) => Number(o.priceQAR) || 0).filter((n) => n > 0);
              const minPrice = prices.length ? Math.min(...prices) : 0;
              return (
                <motion.div
                  key={plan._id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: idx * 0.08 }}
                  className="relative rounded-[24px] p-5 md:p-6 flex flex-col gap-5"
                  style={{
                    background: "#FFFFFF",
                    border: `1.5px solid ${isPopular ? "#3CC4F0" : "#FFFFFF"}`,
                    boxShadow: "0 1px 2px rgba(14,42,74,0.04), 0 14px 32px -18px rgba(14,42,74,0.22)",
                  }}
                >
                  {isPopular && (
                    <span className="absolute top-4 rounded-full px-2.5 py-0.5 text-[11px] font-black text-white"
                      style={{ insetInlineEnd: 16, background: "#3CC4F0" }}>
                      {isRtl ? "الأكثر طلباً" : "Most popular"}
                    </span>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 md:h-[72px] md:w-[72px] shrink-0 rounded-full overflow-hidden"
                      style={{ background: "#EAF3FB", boxShadow: "0 8px 18px -10px rgba(14,42,74,0.45)" }}>
                      <img
                        src={planCardImage(plan)}
                        alt=""
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/heart-logo.png"; }}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl md:text-[22px] font-black text-[#0E2A4A] leading-tight">{name}</h3>
                      <p className="mt-1 text-[13px] text-[#6B7C8C] leading-snug line-clamp-2">
                        {isRtl ? plan.descriptionAr : plan.descriptionEn || plan.descriptionAr}
                      </p>
                    </div>
                  </div>

                  {minPrice > 0 && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[13px] font-bold text-[#6B7C8C]">{isRtl ? "من" : "from"}</span>
                      <span className="text-[32px] font-black text-[#0E2A4A] leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{minPrice}</span>
                      <span className="text-sm font-bold text-[#0E76AC]">{isRtl ? "ر.ق / أسبوع" : "QAR / week"}</span>
                    </div>
                  )}

                  {/* الباقات — الضغط على باقة يفتح واتساب بنفس الرسالة السابقة */}
                  <div className="flex flex-col gap-2">
                    {opts.slice(0, 2).map((option: any, oi: number) => (
                      <button
                        key={oi}
                        onClick={() => handleSubscribe(name, option)}
                        className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-start transition-colors hover:border-[#3CC4F0]"
                        style={{ background: "#F4F8FB", border: "1px solid #E4EEF6" }}
                      >
                        <span className="text-sm font-bold text-[#0E2A4A]">
                          {option.mealsCount} {isRtl ? "وجبات" : "meals"} + {option.snacksCount} {isRtl ? "سناك" : "snacks"}
                        </span>
                        <span className="text-sm font-black text-[#0E76AC] whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {Number(option.priceQAR) > 0 ? `${option.priceQAR} ${isRtl ? "ر.ق" : "QAR"}` : (isRtl ? "اشترك" : "Subscribe")}
                        </span>
                      </button>
                    ))}
                    <p className="text-[11px] text-[#8AA6BD] px-1">
                      {isRtl ? "اضغط على الباقة للاشتراك عبر واتساب" : "Tap a package to subscribe on WhatsApp"}
                    </p>
                  </div>

                  <a
                    href="/public/plans"
                    className="mt-auto h-12 rounded-full inline-flex items-center justify-center font-black text-[15px] text-[#0E2A4A] transition-colors hover:bg-[#EAF7FD]"
                    style={{ border: "1.5px solid #0E2A4A", textDecoration: "none" }}
                  >
                    {isRtl ? "استكشف الخطة" : "Explore the plan"}
                  </a>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <a href="/public/plans" className="inline-flex items-center gap-1.5 text-sm font-black text-[#0E76AC] hover:underline underline-offset-4" style={{ textDecoration: "none" }}>
              {isRtl ? "كل الخطط والأسعار" : "All plans & prices"}
              {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ BEST SELLERS — بطاقة الطبق نفسها التي في المنيو ═══════════ */}
      {(bestSellersLoading || bestSellers.length > 0) && (
        <section className="py-12 md:py-20 bg-white" style={{ direction: isRtl ? "rtl" : "ltr" }}>
          <div className="max-w-6xl mx-auto px-5 md:px-8">
            <div className="flex items-end justify-between gap-4 mb-6 md:mb-8">
              <div>
                <h2 className="font-black text-[#0E2A4A] tracking-tight" style={{ fontFamily: "'Cairo',sans-serif", fontSize: "clamp(24px,3.2vw,36px)", lineHeight: 1.15 }}>
                  {isRtl ? "الأكثر طلباً" : "Best sellers"}
                </h2>
                <p className="mt-1.5 text-[14px] text-[#6B7C8C]">{isRtl ? "ما يختاره مشتركونا أكثر" : "What our subscribers pick most"}</p>
              </div>
              <a href="/public/menu" className="shrink-0 inline-flex items-center gap-1 text-sm font-black text-[#0E76AC] hover:underline underline-offset-4" style={{ textDecoration: "none" }}>
                {isRtl ? "القائمة كاملة" : "Full menu"}
                {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {bestSellersLoading && Array.from({ length: 6 }).map((_, i) => (
                <div key={`sk-${i}`} className="rounded-[24px] p-2" style={{ background: "#F3F7FA" }}>
                  <div className="w-full aspect-square rounded-[18px] animate-pulse" style={{ background: "#E4EEF6" }} />
                  <div className="px-1.5 pt-3 pb-2 space-y-2">
                    <div className="h-3 rounded animate-pulse" style={{ background: "#E4EEF6", width: "80%" }} />
                    <div className="h-2.5 rounded animate-pulse" style={{ background: "#EAF3FB", width: "50%" }} />
                  </div>
                </div>
              ))}
              {!bestSellersLoading && bestSellers.map((m: any, i: number) => (
                <motion.a key={m.id} href={m.slug ? `/public/meal/${m.slug}` : "/public/menu"}
                  initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.05 }}
                  className="group block rounded-[24px] p-2 transition-colors border border-transparent hover:border-[#3CC4F0]/60"
                  style={{ background: "#F3F7FA", textDecoration: "none" }}>
                  <div className="relative w-full aspect-square overflow-hidden rounded-[18px]" style={{ background: "#EAF3FB" }}>
                    {m.imageUrl && <img src={m.imageUrl} alt={isRtl ? m.nameAr : m.nameEn}
                      loading="lazy" decoding="async"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
                    <span className={cn("absolute top-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-black text-[#0E76AC]", isRtl ? "right-2" : "left-2")}
                      style={{ fontVariantNumeric: "tabular-nums", boxShadow: "0 1px 3px rgba(14,42,74,0.12)" }}>
                      {m.calories}<span className="font-semibold text-[#47759C]">{isRtl ? "سعرة" : "kcal"}</span>
                    </span>
                    {i < 3 && (
                      <span className={cn("absolute bottom-2 rounded-full px-2 py-0.5 text-[10px] font-black text-white", isRtl ? "right-2" : "left-2")}
                        style={{ background: "#0E2A4A" }}>
                        #{i + 1}
                      </span>
                    )}
                  </div>
                  <div className="px-1.5 pt-2.5 pb-1.5">
                    <p className="text-[13px] font-black text-[#0E2A4A] leading-tight line-clamp-2" style={{ fontFamily: "'Cairo',sans-serif" }}>
                      {isRtl ? m.nameAr : m.nameEn}
                    </p>
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
                a: isRtl ? "اختر الخطة المناسبة واضغط على زر الاشتراك عبر واتساب، وسيتواصل معك فريقنا فورًا." : "Choose your plan and click the WhatsApp subscribe button. We'll contact you immediately.",
              },
              {
                q: isRtl ? "هل التوصيل مجاني؟" : "Is delivery free?",
                a: isRtl ? "نعم! التوصيل مجاني تماماً لجميع المشتركين في كل أنحاء قطر." : "Yes! Delivery is completely free for all subscribers across Qatar.",
              },
              {
                q: isRtl ? "هل أقدر أغير وجباتي؟" : "Can I customize meals?",
                a: isRtl ? "بالتأكيد. يمكنك اختيار وجباتك من القائمة وطلب التعديلات وفق تفضيلاتك." : "Of course! Pick meals from our menu and request modifications.",
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
