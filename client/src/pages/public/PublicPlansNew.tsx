/**
 * @file client/src/pages/public/PublicPlansNew.tsx
 * @description صفحة الباقات العامة المحسّنة
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { PageHeader } from "@/components/public/PageHeader";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, TrendingUp, Briefcase, Tag, Zap } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";

const badgeConfig = {
  most_requested: { ar: "⭐ الأكثر طلبًا", en: "⭐ Most Requested", color: "bg-gradient-to-r from-yellow-400 to-yellow-500", textColor: "text-gray-900", icon: Sparkles },
  best_value: { ar: "🏆 الأفضل قيمة", en: "🏆 Best Value", color: "bg-gradient-to-r from-green-400 to-green-500", textColor: "text-white", icon: TrendingUp },
  most_chosen_business: { ar: "💼 الأكثر اختيارًا للشركات", en: "💼 Top for Business", color: "bg-gradient-to-r from-blue-400 to-blue-500", textColor: "text-white", icon: Briefcase },
  special_offer: { ar: "🎁 عرض خاص", en: "🎁 Special Offer", color: "bg-gradient-to-r from-red-400 to-red-500", textColor: "text-white", icon: Tag },
};

export default function PublicPlansNew() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  useSeo({
    title: isRtl ? "الباقات والأسعار | أدرينالين للوجبات الصحية" : "Plans & Pricing | Adrenaline Healthy Meals",
    description: isRtl
      ? "اختر باقتك: تنحيف، لياقة، أو تضخيم — وجبات صحية محسوبة السعرات بأسعار مناسبة وتوصيل يومي في قطر."
      : "Choose your plan: weight loss, fitness, or bulking — calorie-counted healthy meals at great prices with daily delivery in Qatar.",
    path: "/public/plans",
  });
  // اسم الباقة: إنجليزي في الوضع الإنجليزي، وعربي مع استبدال "حزمة" بـ"باقة"
  const planName = (p: any) => isRtl ? String(p.nameAr || "").replace(/حزمة/g, "باقة") : (p.nameEn || p.nameAr);
  // في الإنجليزي: لا نرجع للعربي حتى لا يظهر وصف عربي في وضع اللغة الإنجليزية
  const planDesc = (p: any) => isRtl ? p.descriptionAr : (p.descriptionEn || "");
  // نفتح على المدة القادمة من ?duration= (رابط «التفاصيل» في حاسبة السعرات
  // يمرّرها) لتُفتح الصفحة على تاب الباقة الموصى بها مباشرةً، لا على الأسبوعي دائماً.
  const initialDuration = (() => {
    const d = new URLSearchParams(window.location.search).get("duration");
    return d === "two_weeks" || d === "month" ? d : "week";
  })();
  const [selectedDuration, setSelectedDuration] = useState<"week" | "two_weeks" | "month">(initialDuration);
  const plans = useQuery(api.publicPlans.listByDuration, { duration: selectedDuration }) || [];
  const settings = useQuery(api.restaurantSettings.get);
  const meals = useQuery(api.publicMeals.list, {}) || [];
  const headerImage = (meals.find((m: any) => m.imageUrl)?.imageUrl) || undefined;
  const comparisonPlans = plans.filter(p => p.showInComparison);

  const fallbackPlanImage = (plan: any) => {
    const key = `${plan.slug || ""} ${plan.nameEn || ""}`.toLowerCase();
    if (key.includes("diet") || key.includes("tanshif")) return "/plan-tanshif-real.png";
    if (key.includes("fitness") || key.includes("liyaqa")) return "/plan-liyaqa-real.png";
    if (key.includes("bulk") || key.includes("tadkhim")) return "/plan-tadkhim-real.jpg";
    return "/adrenaline-logo-full.png";
  };

  const planImage = (plan: any) => {
    const source = String(plan.imageUrl || "").trim();
    // Old Convex Storage URLs in the current plan records return 404. Known
    // packages use the bundled brand assets; external/custom images stay intact.
    return !source || source.includes(".convex.cloud/api/storage/") ? fallbackPlanImage(plan) : source;
  };

  const phoneRaw = (settings?.phone || "+97451144366").replace(/\D/g, "");

  const handleSubscribe = (planName: string, option: any) => {
    const mealsCount = option?.mealsCount || 0;
    const snacksCount = option?.snacksCount || 0;
    const msg = `مرحباً 👋\nأرغب في الاشتراك في خطة *${planName}*\n\nالباقة: ${mealsCount} وجبات + ${snacksCount} سناك\n\nمن فضلك أرسلوا لي تفاصيل الاشتراك.`;
    const url = `https://wa.me/${phoneRaw}?text=${encodeURIComponent(msg)}`;
    // نحوّل في نفس التبويب حتى لا يبقى تبويب فارغ خلف واتساب على الجوال
    window.location.href = url;
  };

  // ✅ باقة مخصّصة (بلا أسعار جاهزة): تواصل مع الأخصائية لتحديد الكميات والوجبات
  const handleCustomContact = (planName: string) => {
    const msg = isRtl
      ? `السلام عليكم\nأرغب في الاشتراك في *${planName}*.\nأرجو التنسيق مع أخصائية التغذية لتحديد الوجبات والكميات المناسبة لي.\nوشكرًا.`
      : `Hello,\nI'd like to subscribe to the *${planName}*.\nPlease coordinate with the nutritionist to set the meals and quantities that suit me.\nThank you.`;
    window.location.href = `https://wa.me/${phoneRaw}?text=${encodeURIComponent(msg)}`;
  };

  const getBadgeLabel = (badge: string) => badgeConfig[badge as keyof typeof badgeConfig];

  return (
    <PublicLayout>
      {/* Unified compact header */}
      <PageHeader
        eyebrowAr="باقات الاشتراك" eyebrowEn="SUBSCRIPTION PLANS"
        titleAr="استكشف خططنا" titleEn="Explore Our Plans"
        subtitleAr="اختر الباقة المناسبة لأهدافك الصحية واللياقة البدنية"
        subtitleEn="Choose the plan that suits your health and fitness goals"
        image={headerImage}
      />

      {/* Duration Tabs bar */}
      <div className="bg-white border-b border-gray-100 sticky top-[73px] z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-5 flex justify-center gap-3">
          {[
            { value: "week", label: isRtl ? "أسبوعي" : "Weekly" },
            { value: "two_weeks", label: isRtl ? "أسبوعين" : "2 Weeks" },
            { value: "month", label: isRtl ? "شهري" : "Monthly" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedDuration(tab.value as any)}
              className={`px-3 md:px-8 py-2 md:py-3 rounded-full font-bold text-sm md:text-lg transition-all ${
                selectedDuration === tab.value
                  ? "bg-[#3CC4F0] text-white shadow-lg scale-105"
                  : "bg-gray-100 text-[#47759C] hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-16">

        {/* Plans Grid */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {plans
              .sort((a, b) => {
                // Featured plans first
                if (a.isFeatured && !b.isFeatured) return -1;
                if (!a.isFeatured && b.isFeatured) return 1;
                return a.sortOrder - b.sortOrder;
              })
              .map((plan) => {
                const isFeatured = plan.isFeatured;
                const badge = plan.badge ? getBadgeLabel(plan.badge) : null;

                return (
                  <div
                    key={plan._id}
                    className={`relative bg-white rounded-3xl overflow-hidden transition-all duration-300 flex flex-col ${
                      isFeatured
                        ? "shadow-2xl ring-4 ring-[#3CC4F0] md:scale-105"
                        : "shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    }`}
                  >
                    {/* Badge - Small Circle */}
                    {badge && (
                      <div
                        className={`absolute top-3 left-3 ${badge.color} ${badge.textColor} px-3 py-1.5 rounded-full text-xs font-bold shadow-md z-10 flex items-center gap-1`}
                      >
                        {isRtl ? badge.ar : badge.en}
                      </div>
                    )}

                    {/* Image - uniform 4:3, fills the frame */}
                    <div className="w-full aspect-[4/3] overflow-hidden relative bg-[#EAF3FB]">
                      <img
                        src={planImage(plan)}
                        alt={plan.nameAr}
                        className="w-full h-full object-cover"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = fallbackPlanImage(plan);
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-3 flex-1 flex flex-col">
                      <div>
                        <h3 className="text-xl font-black text-[#0F1516] mb-1">
                          {planName(plan)}
                        </h3>
                        <p className="text-gray-500 text-xs leading-relaxed">
                          {planDesc(plan)}
                        </p>
                      </div>

                      {/* Pricing options — each meal-count with its price */}
                      {plan.options && plan.options.length > 0 ? (
                        <div className="space-y-1.5 py-1">
                          {plan.options.map((opt: any, oi: number) => (
                            <div key={oi}
                              className="flex items-center justify-between px-3 py-2 rounded-xl"
                              style={{ background: "#3cc4f00d", border: "1px solid #3cc4f026" }}>
                              <span className="text-xs font-bold text-[#47759C]">
                                {isRtl
                                  ? `${opt.mealsCount} وجبات + ${opt.snacksCount} سناك`
                                  : `${opt.mealsCount} meals + ${opt.snacksCount} snacks`}
                              </span>
                              <span className="text-sm font-black" style={{ color: "#0E76AC" }}>
                                {opt.priceQAR} {isRtl ? "ر.ق" : "QAR"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* ✅ باقة مخصّصة: بدل الأسعار الجاهزة — رسالة تواصل مع الأخصائية */
                        <div className="py-2">
                          <div className="px-3 py-3 rounded-xl text-center" style={{ background: "#3cc4f00d", border: "1px dashed #3cc4f04d" }}>
                            <div className="text-sm font-black text-[#0E76AC] mb-1">{isRtl ? "باقة مصمّمة وفق احتياجك" : "Designed around your needs"}</div>
                            <div className="text-xs font-bold text-[#47759C] leading-relaxed">
                              {isRtl
                                ? "تُحدَّد الوجبات والكميات والسعر بالتنسيق مع أخصائية التغذية بما يتناسب مع هدفك. تواصل معنا لتفصيل باقتك."
                                : "Meals, quantities and price are set in coordination with our nutritionist to suit your goal. Contact us to tailor your plan."}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Features */}
                      {plan.features && plan.features.length > 0 && (
                        <ul className="space-y-2 flex-1">
                          {plan.features.slice(0, 5).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <div className="mt-0.5">
                                <svg className="w-4 h-4 text-[#3CC4F0]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                </svg>
                              </div>
                              <span className="text-xs text-gray-600 leading-snug">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* CTA Button */}
                      {(() => {
                        const isCustom = !plan.options || plan.options.length === 0;
                        return (
                          <Button
                            onClick={() => isCustom ? handleCustomContact(planName(plan)) : handleSubscribe(planName(plan), plan.options?.[0])}
                            className={`w-full h-12 text-base font-bold rounded-full transition-all mt-auto ${
                              isFeatured
                                ? "bg-[#3CC4F0] hover:bg-[#2ab3df] text-white shadow-md"
                                : "bg-[#0F1516] hover:bg-[#1a1f20] text-white"
                            }`}
                          >
                            {isCustom ? (isRtl ? "تواصل مع أخصائية التغذية" : "Contact our nutritionist") : (isRtl ? "اختر الباقة" : "Choose Plan")}
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Comparison Table */}
        {comparisonPlans.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 mt-20">
            <h2 className="text-4xl font-black text-center text-[#0F1516] mb-8">
              {isRtl ? "مقارنة الباقات" : "Compare Plans"}
            </h2>
            
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#3CC4F0] text-white">
                    <tr>
                      <th className="py-2 md:py-4 px-2 md:px-6 text-right text-xs md:text-base font-bold whitespace-nowrap sticky right-0 md:right-auto bg-[#3CC4F0] z-10">{isRtl ? "الميزة" : "Feature"}</th>
                      {comparisonPlans.map((plan) => (
                        <th key={plan._id} className="py-2 md:py-4 px-2 md:px-6 text-center text-xs md:text-base font-bold whitespace-nowrap">
                          {planName(plan)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Extract all unique features */}
                    {Array.from(
                      new Set(
                        comparisonPlans.flatMap((p) => p.features || [])
                      )
                    ).map((feature, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <td className={`py-2 md:py-4 px-2 md:px-6 text-right text-xs md:text-base font-medium text-gray-700 whitespace-nowrap sticky right-0 md:right-auto z-10 ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                          {feature}
                        </td>
                        {comparisonPlans.map((plan) => (
                          <td key={plan._id} className="py-2 md:py-4 px-2 md:px-6 text-center">
                            {plan.features?.includes(feature) ? (
                              <Check className="h-6 w-6 text-[#3CC4F0] mx-auto" />
                            ) : (
                              <X className="h-6 w-6 text-gray-300 mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
