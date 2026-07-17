import { useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Beef,
  Calculator,
  Check,
  Droplets,
  Flame,
  Gauge,
  HeartPulse,
  Minus,
  Plus,
  Scale,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { useLanguage } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { useQuery } from "convex/react";
import { api } from "@/../../convex/_generated/api";

type Sex = "male" | "female";
type Goal = "lose" | "maintain" | "gain";

const activityLevels = [
  { value: 1.2, ar: "قليل الحركة", en: "Mostly sedentary", detailAr: "عمل مكتبي، دون تمارين منتظمة", detailEn: "Desk work, no regular training" },
  { value: 1.375, ar: "نشاط خفيف", en: "Lightly active", detailAr: "تمرين 1 إلى 3 أيام أسبوعيًا", detailEn: "Training 1-3 days per week" },
  { value: 1.55, ar: "نشاط متوسط", en: "Moderately active", detailAr: "تمرين 3 إلى 5 أيام أسبوعيًا", detailEn: "Training 3-5 days per week" },
  { value: 1.725, ar: "نشاط مرتفع", en: "Very active", detailAr: "تمرين قوي 6 إلى 7 أيام أسبوعيًا", detailEn: "Hard training 6-7 days per week" },
  { value: 1.9, ar: "نشاط رياضي مكثف", en: "Athlete level", detailAr: "تدريب يومي مكثف أو عمل بدني", detailEn: "Intense daily training or physical work" },
];

const paceOptions: Record<Exclude<Goal, "maintain">, { value: number; ar: string; en: string }[]> = {
  lose: [
    { value: 0.25, ar: "هادئ", en: "Gentle" },
    { value: 0.5, ar: "متوازن", en: "Balanced" },
    { value: 0.75, ar: "سريع", en: "Fast" },
  ],
  gain: [
    { value: 0.15, ar: "نظيف", en: "Lean" },
    { value: 0.25, ar: "متوازن", en: "Balanced" },
    { value: 0.4, ar: "سريع", en: "Fast" },
  ],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function CalorieCalculator() {
  const { language, dir } = useLanguage();
  const isAr = (dir ?? (language === "ar" ? "rtl" : "ltr")) === "rtl";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  useSeo({
    title: t("حاسبة السعرات والماكروز | أدرينالين", "Calorie & Macro Calculator | Adrenaline"),
    description: t("احسب سعراتك اليومية والبروتين والكربوهيدرات والدهون حسب جسمك ونشاطك وهدفك.", "Calculate daily calories and macros for your body, activity and goal."),
    path: "/public/calorie-calculator",
  });

  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState(30);
  const [height, setHeight] = useState(175);
  const [weight, setWeight] = useState(75);
  const [activity, setActivity] = useState(1.55);
  const [goal, setGoal] = useState<Goal>("maintain");
  const [pace, setPace] = useState(0.5);
  const restaurantPlans = useQuery(api.publicPlans.list) || [];

  const result = useMemo(() => {
    const safeAge = clamp(age || 0, 14, 90);
    const safeHeight = clamp(height || 0, 120, 230);
    const safeWeight = clamp(weight || 0, 35, 250);
    const bmr = 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge + (sex === "male" ? 5 : -161);
    const tdee = bmr * activity;
    const weeklyPace = goal === "maintain" ? 0 : pace;
    const rawAdjustment = (weeklyPace * 7700) / 7;
    const adjustmentCap = tdee * 0.25;
    const adjustment = Math.min(rawAdjustment, adjustmentCap);
    const targetCalories = Math.round(goal === "lose" ? tdee - adjustment : goal === "gain" ? tdee + adjustment : tdee);
    const proteinPerKg = goal === "lose" ? 2 : goal === "gain" ? 1.8 : 1.6;
    const protein = Math.round(safeWeight * proteinPerKg);
    const fat = Math.round(safeWeight * (goal === "gain" ? 0.9 : 0.8));
    const carbs = Math.max(0, Math.round((targetCalories - protein * 4 - fat * 9) / 4));
    const bmi = safeWeight / Math.pow(safeHeight / 100, 2);
    const water = Math.round((safeWeight * 0.035) * 10) / 10;
    const minimum = sex === "female" ? 1200 : 1500;
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories: Math.max(targetCalories, minimum), protein, fat, carbs, bmi, water, belowFloor: targetCalories < minimum };
  }, [activity, age, goal, height, pace, sex, weight]);

  const bmiLabel = result.bmi < 18.5
    ? t("أقل من النطاق الصحي", "Below healthy range")
    : result.bmi < 25
      ? t("ضمن النطاق الصحي", "Within healthy range")
      : result.bmi < 30
        ? t("أعلى من النطاق الصحي", "Above healthy range")
        : t("مرتفع", "High");

  const recommendedPlans = useMemo(() => {
    const goalTerms: Record<Goal, string[]> = {
      lose: ["tanshif", "diet", "weight loss", "تنشيف", "خسارة", "نزول"],
      maintain: ["liyaqa", "fitness", "balanced", "لياقة", "توازن", "ثبات"],
      gain: ["tadkhim", "bulking", "muscle", "تضخيم", "كتلة", "عضلات"],
    };
    const score = (plan: any) => {
      const haystack = [plan.slug, plan.nameAr, plan.nameEn, plan.descriptionAr, plan.descriptionEn].filter(Boolean).join(" ").toLowerCase();
      return goalTerms[goal].reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    };
    const active = restaurantPlans.filter((plan: any) => plan.isActive !== false);
    const matched = active
      .map((plan: any) => ({ plan, score: score(plan) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.plan.sortOrder - b.plan.sortOrder);
    const candidates = matched.length
      ? matched
      : active.map((plan: any) => ({ plan, score: 0 })).sort((a, b) => a.plan.sortOrder - b.plan.sortOrder);
    const durationOrder = ["week", "two_weeks", "month"];
    return durationOrder
      .map((duration) => candidates.find((item) => item.plan.duration === duration)?.plan)
      .filter(Boolean);
  }, [goal, restaurantPlans]);

  const setGoalSafe = (next: Goal) => {
    setGoal(next);
    if (next === "lose") setPace(0.5);
    if (next === "gain") setPace(0.25);
  };

  const weeklyReferencePrice = Number(
    recommendedPlans.find((plan: any) => plan.duration === "week")?.options?.[0]?.priceQAR || 0,
  );

  return (
    <PublicLayout>
      <main className="min-h-screen bg-[#eef5f8] text-[#102b46]" dir={isAr ? "rtl" : "ltr"}>
        <section className="relative overflow-hidden bg-[#0d3556] text-white">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 10%, #3cc4f0 0, transparent 32%), radial-gradient(circle at 85% 90%, #47759c 0, transparent 30%)" }} />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1.2fr_.8fr] md:px-8 md:py-16">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold">
                <Calculator className="h-4 w-4 text-[#52d1f7]" />
                {t("حساب علمي، نتيجة عملية", "Science-based, made practical")}
              </div>
              <h1 className="max-w-[640px] text-[28px] font-black leading-[1.2] md:text-[38px] lg:text-[42px]">
                {t("اعرف احتياج جسمك، وابنِ هدفك على أرقام واضحة", "Know what your body needs and build your goal on clear numbers")}
              </h1>
              <p className="mt-4 max-w-[680px] text-base leading-8 text-sky-100 md:text-[17px]">
                {t("نتيجة مخصصة للسعرات والماكروز والماء، محسوبة حسب العمر والجسم والنشاط وسرعة الوصول للهدف.", "A personal calorie, macro and hydration target based on your body, activity and preferred pace.")}
              </p>
            </div>
            <div className="flex items-end md:justify-end">
              <div className="grid w-full max-w-md grid-cols-3 gap-2 rounded-2xl border border-white/15 bg-white/[.08] p-3">
                {[{ icon: ShieldCheck, ar: "خصوصية كاملة", en: "Private" }, { icon: Gauge, ar: "نتيجة فورية", en: "Instant" }, { icon: Target, ar: "حسب الهدف", en: "Goal-based" }].map((item) => (
                  <div key={item.en} className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
                    <item.icon className="h-6 w-6 text-[#52d1f7]" />
                    <span className="text-xs font-bold text-sky-50">{t(item.ar, item.en)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8 lg:py-12">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#fbfdfe] shadow-[0_14px_45px_rgba(15,42,67,.08)]">
            <div className="border-b border-slate-200 px-5 py-5 md:px-7">
              <h2 className="text-xl font-black">{t("بيانات الحساب", "Your details")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("لا يتم حفظ أو إرسال هذه البيانات.", "These details are not stored or sent.")}</p>
            </div>
            <div className="space-y-8 p-5 md:p-7">
              <FieldGroup label={t("الجنس", "Sex")}>
                <div className="grid grid-cols-2 gap-3">
                  <Choice active={sex === "male"} onClick={() => setSex("male")} label={t("ذكر", "Male")} />
                  <Choice active={sex === "female"} onClick={() => setSex("female")} label={t("أنثى", "Female")} />
                </div>
              </FieldGroup>

              <div className="grid gap-5 sm:grid-cols-3">
                <NumberField label={t("العمر", "Age")} value={age} onChange={setAge} min={14} max={90} unit={t("سنة", "years")} />
                <NumberField label={t("الطول", "Height")} value={height} onChange={setHeight} min={120} max={230} unit={t("سم", "cm")} />
                <NumberField label={t("الوزن", "Weight")} value={weight} onChange={setWeight} min={35} max={250} unit={t("كجم", "kg")} />
              </div>

              <FieldGroup label={t("مستوى النشاط اليومي", "Daily activity level")}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activityLevels.map((item) => (
                    <button key={item.value} type="button" onClick={() => setActivity(item.value)} className={`min-h-[72px] rounded-lg border px-4 py-3 text-start transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 ${activity === item.value ? "border-[#159aca] bg-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <span className="flex items-center justify-between gap-3 font-bold">
                        {t(item.ar, item.en)}
                        {activity === item.value && <Check className="h-4 w-4 text-[#087fae]" />}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{t(item.detailAr, item.detailEn)}</span>
                    </button>
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup label={t("ما هدفك؟", "What is your goal?")}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <GoalChoice active={goal === "lose"} onClick={() => setGoalSafe("lose")} icon={TrendingDown} title={t("تنزيل الوزن", "Lose weight")} detail={t("عجز محسوب", "Calorie deficit")} />
                  <GoalChoice active={goal === "maintain"} onClick={() => setGoalSafe("maintain")} icon={Scale} title={t("ثبات الوزن", "Maintain")} detail={t("توازن الطاقة", "Energy balance")} />
                  <GoalChoice active={goal === "gain"} onClick={() => setGoalSafe("gain")} icon={TrendingUp} title={t("زيادة الكتلة", "Build mass")} detail={t("فائض مضبوط", "Controlled surplus")} />
                </div>
              </FieldGroup>

              {goal !== "maintain" && (
                <FieldGroup label={t("سرعة الوصول للهدف", "Preferred pace")}>
                  <div className="grid grid-cols-3 gap-2">
                    {paceOptions[goal].map((item) => (
                      <button key={item.value} type="button" onClick={() => setPace(item.value)} className={`min-h-14 rounded-lg border px-2 text-sm font-bold transition ${pace === item.value ? "border-[#159aca] bg-[#0d3556] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                        {t(item.ar, item.en)}
                        <span className={`mt-0.5 block text-[10px] ${pace === item.value ? "text-sky-200" : "text-slate-400"}`}>{item.value} {t("كجم/أسبوع", "kg/week")}</span>
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              )}
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-lg bg-[#0d3556] text-white shadow-[0_18px_55px_rgba(13,53,86,.22)]">
              <div className="border-b border-white/10 px-6 py-5">
                <p className="text-xs font-bold text-sky-200">{t("هدفك اليومي المقترح", "Suggested daily target")}</p>
                <div className="mt-2 flex items-end gap-2" dir="ltr">
                  <strong className="text-5xl font-black tabular-nums">{result.calories.toLocaleString("en-US")}</strong>
                  <span className="pb-1 text-sm font-bold text-sky-200">{t("سعرة", "kcal")}</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#3cc4f0]" style={{ width: `${clamp((result.calories / Math.max(result.tdee, 1)) * 72, 42, 96)}%` }} />
                </div>
                <p className="mt-3 text-xs leading-5 text-sky-100">
                  {goal === "lose" ? t("عجز سعرات مدروس لدعم نزول الوزن.", "A measured deficit to support weight loss.") : goal === "gain" ? t("فائض سعرات مضبوط لدعم بناء الكتلة.", "A controlled surplus to support mass gain.") : t("قريب من احتياجك للحفاظ على الوزن.", "Close to your estimated maintenance needs.")}
                </p>
              </div>

              <div className="grid grid-cols-3 border-b border-white/10">
                <Macro value={result.protein} label={t("بروتين", "Protein")} color="#55d49c" />
                <Macro value={result.carbs} label={t("كارب", "Carbs")} color="#52d1f7" />
                <Macro value={result.fat} label={t("دهون", "Fat")} color="#ffc76b" />
              </div>

              <div className="space-y-3 p-5">
                <ResultRow icon={Flame} label={t("معدل الأيض الأساسي", "Basal metabolic rate")} value={`${result.bmr} ${t("سعرة", "kcal")}`} />
                <ResultRow icon={Activity} label={t("احتياج الحفاظ", "Maintenance calories")} value={`${result.tdee} ${t("سعرة", "kcal")}`} />
                <ResultRow icon={Droplets} label={t("الماء المقترح", "Suggested water")} value={`${result.water} ${t("لتر", "L")}`} />
                <ResultRow icon={HeartPulse} label={t("مؤشر كتلة الجسم", "Body mass index")} value={`${result.bmi.toFixed(1)} · ${bmiLabel}`} />
              </div>

              {result.belowFloor && (
                <div className="mx-5 mb-5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs leading-5 text-amber-50">
                  {t("تم رفع النتيجة إلى الحد الأدنى العام للسعرات. استشر مختصًا قبل اتباع عجز أكبر.", "The result was raised to the general calorie floor. Consult a professional before using a larger deficit.")}
                </div>
              )}

              {/* يقفز لقسم «الباقة الأقرب لهدفك» المحسوب أدناه، لا لصفحة الباقات
                  العامة — فالزائر يرى ما حُسب له فعلاً. القفز عبر href الأصلي
                  (#anchor) فهو يعمل دائماً؛ لا نستخدم preventDefault + scrollIntoView
                  لأن السلاسة قد تفشل بصمت فيُلغى القفز كلياً. السلاسة بـCSS
                  (scroll-smooth على القسم). وإن لم توجد باقات مطابقة نوجّه لكل الباقات. */}
              <a
                href={recommendedPlans.length > 0 ? "#recommended-plans" : "/public/plans"}
                className="m-5 mt-0 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#3cc4f0] px-5 font-black text-[#082a45] transition hover:bg-[#62d7fa] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
              >
                {t("شاهد الخطط المناسبة", "Explore suitable plans")}
                {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </a>
            </div>
            <p className="px-2 pt-4 text-xs leading-6 text-slate-500">
              {t("هذه نتيجة تقديرية للبالغين الأصحاء وليست تشخيصًا طبيًا. الحمل والرضاعة، العمر أقل من 18 سنة، اضطرابات الأكل، أو الحالات المزمنة تتطلب مراجعة طبيب أو أخصائي تغذية.", "This is an estimate for healthy adults, not medical advice. Pregnancy, breastfeeding, age under 18, eating disorders or chronic conditions require a doctor or dietitian.")}
            </p>
          </aside>
        </section>

        {recommendedPlans.length > 0 && (
          <section id="recommended-plans" className="scroll-mt-20 border-t border-slate-200 bg-white px-4 py-12">
            <div className="mx-auto max-w-6xl">
              <div>
                <div className="max-w-3xl">
                  <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-black text-[#087fae]">
                    <Target className="h-4 w-4" />
                    {t("من باقات أدرينالين الحالية", "From current Adrenaline plans")}
                  </span>
                  <h2 className="mt-4 text-2xl font-black md:text-3xl">{t("الباقة الأقرب لهدفك", "The closest plan to your goal")}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                    {t("هذه توصية من الباقات المنشورة فعليًا في المطعم. عدد الوجبات والسناك والسعر معروض كما هو، ويُضبط اختيار الوجبات داخل الباقة حسب احتياجك المحسوب.", "This recommendation only uses plans currently published by the restaurant. Meal counts, snacks and prices are shown exactly as listed; meal selection can then be adjusted around your calculated target.")}
                  </p>
                </div>
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {recommendedPlans.map((plan: any, index: number) => {
                    const option = plan.options?.[0];
                    const duration = plan.duration === "month" ? t("شهري", "Monthly") : plan.duration === "two_weeks" ? t("أسبوعان", "Two weeks") : t("أسبوعي", "Weekly");
                    const isMonthly = plan.duration === "month";
                    const isTwoWeeks = plan.duration === "two_weeks";
                    const comparisonWeeks = isMonthly ? 4 : isTwoWeeks ? 2 : 1;
                    const saving = option && weeklyReferencePrice
                      ? Math.max(0, weeklyReferencePrice * comparisonWeeks - Number(option.priceQAR))
                      : 0;
                    return (
                      <article key={plan._id} className={`relative overflow-hidden rounded-lg border shadow-[0_12px_36px_rgba(15,42,67,.09)] ${isMonthly ? "border-[#0d3556] bg-[#0d3556] text-white md:-translate-y-2" : "border-slate-200 bg-[#f8fbfc]"}`}>
                        {isMonthly && <div className="absolute inset-x-0 top-0 z-10 bg-[#3cc4f0] px-3 py-2 text-center text-[11px] font-black text-[#082a45]">{t("أفضل قيمة للاشتراك المنتظم", "Best value for a regular subscription")}</div>}
                        <div className={`grid grid-cols-[120px_1fr] ${isMonthly ? "pt-8" : ""}`}>
                          <div className="relative min-h-48 overflow-hidden bg-[#e8f4f8]">
                            {plan.imageUrl ? <img src={plan.imageUrl} alt={isAr ? plan.nameAr : (plan.nameEn || plan.nameAr)} className="absolute inset-0 h-full w-full object-cover" /> : null}
                          </div>
                          <div className="flex flex-col p-4">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-black ${isMonthly ? "text-sky-200" : "text-[#087fae]"}`}>{duration}</span>
                              {isTwoWeeks && <span className="rounded-full bg-cyan-100 px-2 py-1 text-[9px] font-black text-[#075e82]">{t("اختيار عملي", "Practical choice")}</span>}
                              {!isMonthly && !isTwoWeeks && index === 0 && <span className="rounded-full bg-[#0d3556] px-2 py-1 text-[9px] font-black text-white">{t("للتجربة", "Try it")}</span>}
                            </div>
                            <h3 className="mt-3 font-black leading-6">{isAr ? String(plan.nameAr || "").replace(/حزمة/g, "باقة") : (plan.nameEn || plan.nameAr)}</h3>
                            {option && (
                              <div className={`mt-3 text-xs leading-6 ${isMonthly ? "text-sky-100" : "text-slate-600"}`}>
                                <p>{option.mealsCount} {t("وجبات", "meals")} + {option.snacksCount} {t("سناك", "snacks")}</p>
                                <strong className={`mt-1 block text-xl font-black ${isMonthly ? "text-[#52d1f7]" : "text-[#0d6f9d]"}`} dir="ltr">{option.priceQAR} QAR</strong>
                                {saving > 0 && (
                                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${isMonthly ? "bg-emerald-400/15 text-emerald-200" : "bg-emerald-50 text-emerald-700"}`}>
                                    {t(`وفر ${saving} ر.ق مقارنة بتكرار الأسبوع`, `Save ${saving} QAR vs repeating weekly`)}
                                  </span>
                                )}
                              </div>
                            )}
                            <a href={`/public/plans?duration=${plan.duration}`} className={`mt-auto pt-4 inline-flex items-center gap-1 text-xs font-black hover:underline ${isMonthly ? "text-[#52d1f7]" : "text-[#087fae]"}`}>
                              {t("التفاصيل والخيارات", "Details and options")}
                              {isAr ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="border-t border-slate-200 bg-[#f8fbfc] px-4 py-12">
          <div className="mx-auto max-w-5xl">
            <div className="mb-7 max-w-2xl">
              <h2 className="text-2xl font-black">{t("كيف وصلنا إلى النتيجة؟", "How the result is calculated")}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{t("نستخدم معادلة ميفلين سانت جيور ثم نطبق مستوى النشاط والهدف بمعدل أسبوعي واقعي.", "We use the Mifflin-St Jeor equation, then apply activity and a realistic weekly goal rate.")}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[{ n: "01", titleAr: "معدل الأيض", titleEn: "Metabolism", textAr: "تقدير الطاقة التي يحتاجها الجسم في الراحة.", textEn: "Estimated energy your body uses at rest." }, { n: "02", titleAr: "الحركة اليومية", titleEn: "Daily activity", textAr: "تحويل معدل الأيض إلى احتياج يومي واقعي.", textEn: "Turns resting needs into a real daily estimate." }, { n: "03", titleAr: "الهدف والماكروز", titleEn: "Goal and macros", textAr: "عجز أو فائض محدود ثم توزيع البروتين والدهون والكارب.", textEn: "A capped deficit or surplus, then macro allocation." }].map((item) => (
                <div key={item.n} className="border-t border-[#159aca] bg-white p-5 shadow-[0_8px_28px_rgba(15,42,67,.06)]">
                  <span className="text-xs font-black text-[#159aca]">{item.n}</span>
                  <h3 className="mt-4 font-black">{t(item.titleAr, item.titleEn)}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{t(item.textAr, item.textEn)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <fieldset><legend className="mb-3 text-sm font-black text-[#173b5b]">{label}</legend>{children}</fieldset>;
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-12 rounded-lg border font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 ${active ? "border-[#159aca] bg-[#0d3556] text-white" : "border-slate-200 bg-white hover:border-slate-300"}`}>{label}</button>;
}

function NumberField({ label, value, onChange, min, max, unit }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; unit: string }) {
  const update = (next: number) => onChange(clamp(next, min, max));
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[#173b5b]">{label}</span>
      <span className="flex h-14 overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-[#159aca] focus-within:ring-4 focus-within:ring-cyan-100">
        <button type="button" onClick={() => update(value - 1)} className="grid w-11 place-items-center border-e border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Decrease"><Minus className="h-4 w-4" /></button>
        <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} onBlur={() => update(value)} className="min-w-0 flex-1 bg-transparent px-2 text-center text-lg font-black tabular-nums outline-none" />
        <span className="flex items-center text-xs font-bold text-slate-400">{unit}</span>
        <button type="button" onClick={() => update(value + 1)} className="grid w-11 place-items-center border-s border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Increase"><Plus className="h-4 w-4" /></button>
      </span>
    </label>
  );
}

function GoalChoice({ active, onClick, icon: Icon, title, detail }: { active: boolean; onClick: () => void; icon: typeof TrendingDown; title: string; detail: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-28 rounded-lg border p-4 text-start transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 ${active ? "border-[#159aca] bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <Icon className={`h-6 w-6 ${active ? "text-[#087fae]" : "text-slate-400"}`} />
      <span className="mt-3 block font-black">{title}</span>
      <span className="mt-1 block text-xs text-slate-500">{detail}</span>
    </button>
  );
}

function Macro({ value, label, color }: { value: number; label: string; color: string }) {
  return <div className="border-e border-white/10 px-2 py-4 text-center last:border-0" dir="ltr"><strong className="block text-xl font-black tabular-nums" style={{ color }}>{value}g</strong><span className="mt-1 block text-[10px] font-bold text-sky-100">{label}</span></div>;
}

function ResultRow({ icon: Icon, label, value }: { icon: typeof Beef; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg bg-white/[.06] px-3 py-3"><Icon className="h-4 w-4 shrink-0 text-[#52d1f7]" /><span className="min-w-0 flex-1 text-xs text-sky-100">{label}</span><strong className="text-end text-xs font-black tabular-nums">{value}</strong></div>;
}
