/**
 * @file client/src/pages/public/MealDetails.tsx
 * @description صفحة تفاصيل الوجبة - Hero Image + Nutrition + Ingredients + Sticky Bottom Bar
 */
import { useParams } from "wouter";
import { usePublicMealBySlug } from "@/lib/api";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { tagLabel } from "@/lib/tagLabels";

export default function MealDetailsPage() {
  const { language, dir } = useLanguage();
  const isRtl = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";

  const params = useParams();
  const slug = params.slug || "";

  const { data: meal } = usePublicMealBySlug(slug);

  if (!meal) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-xl text-[#47759C]">
            {isRtl ? "جاري التحميل..." : "Loading..."}
          </p>
        </div>
      </PublicLayout>
    );
  }

  const totalMacros = meal.protein + meal.carbs + meal.fats;
  const proteinPercent = ((meal.protein * 4) / meal.calories) * 100;
  const carbsPercent = ((meal.carbs * 4) / meal.calories) * 100;
  const fatsPercent = ((meal.fats * 9) / meal.calories) * 100;

  return (
    <PublicLayout>
      {/* Hero Image */}
      <section className="relative h-96 overflow-hidden">
        <img
          src={meal.imageUrl}
          alt={isRtl ? meal.nameAr : meal.nameEn || meal.nameAr}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Calories Badge */}
        <div className="absolute top-6 right-6">
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-5 py-3 rounded-full">
            <Flame className="h-6 w-6 text-orange-500" />
            <div>
              <p className="text-xs text-[#47759C] font-medium">
                {isRtl ? "سعرات" : "Calories"}
              </p>
              <p className="text-xl font-bold text-[#0F1516]">{meal.calories}</p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => window.history.back()}
          className="absolute top-6 left-6 h-12 w-12 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
        >
          {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
              {isRtl ? meal.nameAr : meal.nameEn || meal.nameAr}
            </h1>
            {meal.nameEn && isRtl && (
              <p className="text-xl text-white/90">{meal.nameEn}</p>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 pb-32">
        <div className="max-w-4xl mx-auto px-4">
          {/* Tags */}
          {meal.tags && meal.tags.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-8">
              {meal.tags.map((tag: string, idx: number) => (
                <Badge
                  key={idx}
                  className="text-sm px-4 py-2 rounded-full bg-[#3CC4F0]/10 text-[#3CC4F0] border-2 border-[#3CC4F0]/20 font-medium"
                >
                  {tagLabel(tag, isRtl)}
                </Badge>
              ))}
            </div>
          )}

          {/* Nutrition Circles */}
          <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-100 p-8 mb-8">
            <h2 className="text-2xl font-bold text-[#0F1516] mb-6 text-center">
              {isRtl ? "القيم الغذائية" : "Nutrition Facts"}
            </h2>
            
            <div className="grid grid-cols-3 gap-6">
              {/* Protein */}
              <div className="text-center">
                <div className="relative w-28 h-28 mx-auto mb-3">
                  <svg className="transform -rotate-90 w-28 h-28">
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      stroke="#f3f4f6"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      stroke="#ef4444"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${proteinPercent * 3.14} ${314 - proteinPercent * 3.14}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div>
                      <p className="text-2xl font-bold text-[#0F1516]">{meal.protein}g</p>
                      <p className="text-xs text-[#47759C]">{proteinPercent.toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm font-bold text-[#0F1516]">
                  {isRtl ? "بروتين" : "Protein"}
                </p>
              </div>

              {/* Carbs */}
              <div className="text-center">
                <div className="relative w-28 h-28 mx-auto mb-3">
                  <svg className="transform -rotate-90 w-28 h-28">
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      stroke="#f3f4f6"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      stroke="#eab308"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${carbsPercent * 3.14} ${314 - carbsPercent * 3.14}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div>
                      <p className="text-2xl font-bold text-[#0F1516]">{meal.carbs}g</p>
                      <p className="text-xs text-[#47759C]">{carbsPercent.toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm font-bold text-[#0F1516]">
                  {isRtl ? "كربوهيدرات" : "Carbs"}
                </p>
              </div>

              {/* Fats */}
              <div className="text-center">
                <div className="relative w-28 h-28 mx-auto mb-3">
                  <svg className="transform -rotate-90 w-28 h-28">
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      stroke="#f3f4f6"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="50"
                      stroke="#3b82f6"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${fatsPercent * 3.14} ${314 - fatsPercent * 3.14}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div>
                      <p className="text-2xl font-bold text-[#0F1516]">{meal.fats}g</p>
                      <p className="text-xs text-[#47759C]">{fatsPercent.toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm font-bold text-[#0F1516]">
                  {isRtl ? "دهون" : "Fats"}
                </p>
              </div>
            </div>
          </div>

          {/* Ingredients */}
          {meal.ingredients && meal.ingredients.length > 0 && (
            <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-100 p-8 mb-8">
              <h2 className="text-2xl font-bold text-[#0F1516] mb-6">
                {isRtl ? "المكونات" : "Ingredients"}
              </h2>
              <ul className="space-y-3">
                {meal.ingredients.map((ingredient: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 text-[#47759C]">
                    <div className="h-2 w-2 rounded-full bg-[#3CC4F0] mt-2 flex-shrink-0" />
                    <span className="text-base">{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* About */}
          {(meal.aboutAr || meal.aboutEn) && (
            <div className="bg-[#3CC4F0]/5 rounded-3xl p-8">
              <h2 className="text-2xl font-bold text-[#0F1516] mb-4">
                {isRtl ? "عن الوجبة" : "About This Meal"}
              </h2>
              <p className="text-base text-[#47759C] leading-relaxed">
                {isRtl ? meal.aboutAr : meal.aboutEn || meal.aboutAr}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 shadow-2xl z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[#47759C] mb-1 font-semibold uppercase tracking-wide">
                {isRtl ? "ضمن اشتراكك" : "Included in plan"}
              </p>
              <p className="text-2xl font-black text-[#3CC4F0] flex items-center gap-2">
                {meal.calories}
                <span className="text-sm text-[#47759C]">{isRtl ? "كالوري" : "kcal"}</span>
              </p>
            </div>
            <Button className="h-14 px-10 rounded-full bg-[#3CC4F0] hover:bg-[#47759C] text-white font-bold text-lg shadow-lg">
              {isRtl ? "أضف للخطة" : "Add to Plan"}
            </Button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
