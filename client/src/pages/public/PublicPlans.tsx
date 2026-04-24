/**
 * @file client/src/pages/public/PublicPlans.tsx
 * @description صفحة الخطط للموقع العام - Tabs + Cards
 */
import { useState } from "react";
import { usePublicPlans } from "@/lib/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function PublicPlansPage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  const [activeDuration, setActiveDuration] = useState<"week" | "two_weeks" | "month">("week");

  const { data: plans = [] } = usePublicPlans(activeDuration);

  return (
    <PublicLayout>
      {/* Page Header */}
      <section className="bg-gradient-to-b from-[#0F1516] to-[#47759C] text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-4">
            {isRtl ? "خطط الوجبات" : "Meal Plans"}
          </h1>
          <p className="text-xl text-[#BCBEBF]">
            {isRtl
              ? "اختر الخطة المناسبة لأهدافك ومدتك المفضلة"
              : "Choose the plan that suits your goals and preferred duration"}
          </p>
        </div>
      </section>

      {/* Duration Tabs */}
      <section className="bg-white border-b border-gray-100 sticky top-[73px] z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setActiveDuration("week")}
              className={cn(
                "px-8 py-3 rounded-full font-bold text-lg transition-all",
                activeDuration === "week"
                  ? "bg-[#3CC4F0] text-white shadow-lg"
                  : "bg-gray-100 text-[#47759C] hover:bg-gray-200"
              )}
            >
              {isRtl ? "أسبوعي" : "Weekly"}
            </button>
            <button
              onClick={() => setActiveDuration("two_weeks")}
              className={cn(
                "px-8 py-3 rounded-full font-bold text-lg transition-all",
                activeDuration === "two_weeks"
                  ? "bg-[#3CC4F0] text-white shadow-lg"
                  : "bg-gray-100 text-[#47759C] hover:bg-gray-200"
              )}
            >
              {isRtl ? "أسبوعين" : "Bi-Weekly"}
            </button>
            <button
              onClick={() => setActiveDuration("month")}
              className={cn(
                "px-8 py-3 rounded-full font-bold text-lg transition-all",
                activeDuration === "month"
                  ? "bg-[#3CC4F0] text-white shadow-lg"
                  : "bg-gray-100 text-[#47759C] hover:bg-gray-200"
              )}
            >
              {isRtl ? "شهري" : "Monthly"}
            </button>
          </div>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          {plans.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl text-[#47759C]">
                {isRtl
                  ? "لا توجد خطط متاحة حالياً لهذه المدة"
                  : "No plans available for this duration"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan: any) => (
                <Card
                  key={plan._id}
                  className="group hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-[#3CC4F0] overflow-hidden bg-white"
                >
                  {/* Plan Image */}
                  <div className="relative h-56 overflow-hidden bg-gradient-to-br from-[#3CC4F0]/5 to-[#47759C]/5">
                    <img
                      src={plan.imageUrl}
                      alt={isRtl ? plan.nameAr : plan.nameEn || plan.nameAr}
                      className="w-full h-full object-cover scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    
                    {/* Plan Title Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="text-3xl font-bold text-white mb-1">
                        {isRtl ? plan.nameAr : plan.nameEn || plan.nameAr}
                      </h3>
                      {plan.descriptionAr && (
                        <p className="text-sm text-white/90">
                          {isRtl ? plan.descriptionAr : plan.descriptionEn || plan.descriptionAr}
                        </p>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-6">
                    {/* Options */}
                    <div className="space-y-3 mb-6">
                      {plan.options?.map((option: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#3CC4F0] hover:bg-[#3CC4F0]/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-[#3CC4F0]/10 flex items-center justify-center">
                              <Check className="h-5 w-5 text-[#3CC4F0]" />
                            </div>
                            <div>
                              <p className="font-bold text-[#0F1516]">
                                {option.mealsCount} {isRtl ? "وجبات" : "MEALS"}
                              </p>
                              <p className="text-xs text-[#47759C]">
                                + {option.snacksCount} {isRtl ? "سناك" : "SNACKS"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[#3CC4F0]">
                              {option.priceQAR}
                            </p>
                            <p className="text-xs text-[#47759C]">
                              {isRtl ? "ر.ق" : "QAR"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Features */}
                    {plan.features && plan.features.length > 0 && (
                      <div className="space-y-2 mb-6 p-4 bg-[#3CC4F0]/5 rounded-xl">
                        <p className="text-xs font-bold text-[#47759C] uppercase mb-2">
                          {isRtl ? "المميزات" : "Features"}
                        </p>
                        {plan.features.map((feature: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-[#0F1516]">
                            <Check className="h-4 w-4 text-[#3CC4F0] flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CTA Button */}
                    <Button className="w-full h-14 rounded-full bg-[#3CC4F0] hover:bg-[#47759C] text-white font-bold text-lg shadow-md">
                      {isRtl ? "اشترك الآن" : "Subscribe Now"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[#0F1516] text-center mb-12">
            {isRtl ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
          </h2>
          <div className="space-y-4">
            <details className="group p-6 bg-gray-50 rounded-xl">
              <summary className="font-bold text-[#0F1516] cursor-pointer list-none flex items-center justify-between">
                {isRtl ? "كيف يتم التوصيل؟" : "How is delivery done?"}
                <span className="text-[#3CC4F0] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-4 text-[#47759C]">
                {isRtl
                  ? "نوصل طلبك لباب منزلك في الوقت المحدد صباحاً أو مساءً حسب اختيارك."
                  : "We deliver to your doorstep at the specified time, morning or evening, according to your choice."}
              </p>
            </details>

            <details className="group p-6 bg-gray-50 rounded-xl">
              <summary className="font-bold text-[#0F1516] cursor-pointer list-none flex items-center justify-between">
                {isRtl ? "هل يمكنني تخصيص الوجبات؟" : "Can I customize meals?"}
                <span className="text-[#3CC4F0] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-4 text-[#47759C]">
                {isRtl
                  ? "نعم، يمكنك اختيار وجباتك المفضلة وإضافة ملاحظات خاصة للحساسية أو التفضيلات."
                  : "Yes, you can choose your favorite meals and add special notes for allergies or preferences."}
              </p>
            </details>

            <details className="group p-6 bg-gray-50 rounded-xl">
              <summary className="font-bold text-[#0F1516] cursor-pointer list-none flex items-center justify-between">
                {isRtl ? "ما هي طرق الدفع؟" : "What are the payment methods?"}
                <span className="text-[#3CC4F0] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-4 text-[#47759C]">
                {isRtl
                  ? "نقبل الدفع نقداً عند الاستلام أو عن طريق التحويل البنكي."
                  : "We accept cash on delivery or bank transfer."}
              </p>
            </details>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
