/**
 * @file client/src/pages/public/HomePage.tsx
 * @description الصفحة الرئيسية للموقع العام - Hero + معاينة الخطط
 */
import { useBanners, usePublicPlans } from "@/lib/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { HeroCarousel } from "@/components/public/HeroCarousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";

export default function HomePage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  const { data: banners = [] } = useBanners();
  const { data: allPlans = [] } = usePublicPlans("week"); // فقط خطط الأسبوع
  const settings = useQuery(api.restaurantSettings.get);

  // فلترة الخطط: نريد فقط خطط الأسبوع (3 باقات)
  const weekPlans = allPlans.filter((p: any) => p.duration === "week");

  return (
    <PublicLayout>
      {/* Hero Carousel */}
      <HeroCarousel banners={banners} isRtl={isRtl} settings={settings} />

      {/* Plans Preview Section */}
      <section id="plans-section" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0F1516] mb-4">
              {isRtl ? "استكشف خططنا" : "Explore Our Plans"}
            </h2>
            <p className="text-lg text-[#47759C] max-w-2xl mx-auto">
              {isRtl
                ? "اختر الخطة المناسبة لأهدافك الصحية واستمتع بوجبات لذيذة ومتوازنة"
                : "Choose the plan that suits your health goals and enjoy delicious balanced meals"}
            </p>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {weekPlans.slice(0, 3).map((plan: any) => (
              <Card
                key={plan._id}
                className="group hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-[#3CC4F0] overflow-hidden"
              >
                {/* Plan Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={plan.imageUrl}
                    alt={isRtl ? plan.nameAr : plan.nameEn || plan.nameAr}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-2xl font-bold text-white">
                      {isRtl ? plan.nameAr : plan.nameEn || plan.nameAr}
                    </h3>
                  </div>
                </div>

                <CardContent className="p-6">
                  {/* Description */}
                  <p className="text-sm text-[#47759C] mb-6 min-h-[3rem]">
                    {isRtl ? plan.descriptionAr : plan.descriptionEn || plan.descriptionAr}
                  </p>

                  {/* Options */}
                  <div className="space-y-3 mb-6">
                    {plan.options?.map((option: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2 text-sm font-medium text-[#0F1516]">
                          <Check className="h-4 w-4 text-[#3CC4F0]" />
                          <span>
                            {option.mealsCount} {isRtl ? "وجبات" : "MEALS"} + {option.snacksCount}{" "}
                            {isRtl ? "سناك" : "SNACKS"}
                          </span>
                        </div>
                        <span className="font-bold text-[#3CC4F0]">
                          {option.priceQAR} {isRtl ? "ر.ق" : "QAR"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Features */}
                  {plan.features && plan.features.length > 0 && (
                    <div className="space-y-2 mb-6">
                      {plan.features.map((feature: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-[#47759C]">
                          <Check className="h-4 w-4 text-[#3CC4F0] flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA Button */}
                  <Button className="w-full h-12 rounded-full bg-[#3CC4F0] hover:bg-[#47759C] text-white font-bold">
                    {isRtl ? "اشترك الآن" : "Subscribe Now"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* View All Plans Button */}
          <div className="text-center mt-12">
            <Button
              onClick={() => (window.location.href = "/public/plans")}
              variant="outline"
              className="h-12 px-8 rounded-full border-2 border-[#3CC4F0] text-[#3CC4F0] hover:bg-[#3CC4F0] hover:text-white font-bold"
            >
              {isRtl ? "عرض جميع الخطط" : "View All Plans"}
              {isRtl ? (
                <ArrowLeft className="mr-2 h-5 w-5" />
              ) : (
                <ArrowRight className="ml-2 h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-[#3CC4F0]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🥗</span>
              </div>
              <h3 className="text-xl font-bold text-[#0F1516] mb-2">
                {isRtl ? "وجبات طازجة يومياً" : "Fresh Daily Meals"}
              </h3>
              <p className="text-[#47759C]">
                {isRtl
                  ? "نستخدم أفضل المكونات الطازجة ونعد كل وجبة بحب واهتمام"
                  : "We use the finest fresh ingredients and prepare each meal with love and care"}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-[#3CC4F0]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🚚</span>
              </div>
              <h3 className="text-xl font-bold text-[#0F1516] mb-2">
                {isRtl ? "توصيل مجاني" : "Free Delivery"}
              </h3>
              <p className="text-[#47759C]">
                {isRtl
                  ? "نوصل طلبك لباب منزلك في الوقت المحدد بدون رسوم إضافية"
                  : "We deliver to your doorstep on time with no extra charges"}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-[#3CC4F0]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">💪</span>
              </div>
              <h3 className="text-xl font-bold text-[#0F1516] mb-2">
                {isRtl ? "قيم غذائية محسوبة" : "Calculated Nutrition"}
              </h3>
              <p className="text-[#47759C]">
                {isRtl
                  ? "كل وجبة مصممة بدقة لتناسب أهدافك الصحية والغذائية"
                  : "Each meal is precisely designed to match your health and nutrition goals"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
