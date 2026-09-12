/** Formula parity with client/src/pages/public/CalorieCalculator.tsx. No IO. */
export type Goal = 'lose' | 'maintain' | 'gain';
export type CalculatorInput = { sex: 'male' | 'female'; age: number; height: number; weight: number; activity: number; goal: Goal; pace: number };
export const activities = [
  { value: 1.2, label: 'قليل الحركة', detail: 'عمل مكتبي، دون تمارين منتظمة' },
  { value: 1.375, label: 'نشاط خفيف', detail: 'تمرين 1 إلى 3 أيام أسبوعيًا' },
  { value: 1.55, label: 'نشاط متوسط', detail: 'تمرين 3 إلى 5 أيام أسبوعيًا' },
  { value: 1.725, label: 'نشاط مرتفع', detail: 'تمرين قوي 6 إلى 7 أيام أسبوعيًا' },
  { value: 1.9, label: 'نشاط رياضي مكثف', detail: 'تدريب يومي مكثف أو عمل بدني' },
];
export const paces = {
  lose: [{ value: .25, label: 'هادئ' }, { value: .5, label: 'متوازن' }, { value: .75, label: 'سريع' }],
  gain: [{ value: .15, label: 'نظيف' }, { value: .25, label: 'متوازن' }, { value: .4, label: 'سريع' }],
};
export function calculateCalories({ sex, age, height, weight, activity, goal, pace }: CalculatorInput) {
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const safeAge = clamp(age || 0, 14, 90), safeHeight = clamp(height || 0, 120, 230), safeWeight = clamp(weight || 0, 35, 250);
  const bmr = 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge + (sex === 'male' ? 5 : -161);
  const tdee = bmr * activity;
  const adjustment = Math.min(((goal === 'maintain' ? 0 : pace) * 7700) / 7, tdee * .25);
  const targetCalories = Math.round(goal === 'lose' ? tdee - adjustment : goal === 'gain' ? tdee + adjustment : tdee);
  const protein = Math.round(safeWeight * (goal === 'lose' ? 2.2 : goal === 'gain' ? 1.8 : 1.6));
  const fat = Math.round(safeWeight * (goal === 'gain' ? .9 : .8));
  // Preserve website ordering: macros are calculated before its calorie floor.
  const carbs = Math.max(0, Math.round((targetCalories - protein * 4 - fat * 9) / 4));
  const minimum = sex === 'female' ? 1200 : 1500;
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories: Math.max(targetCalories, minimum), protein, fat, carbs,
    bmi: safeWeight / Math.pow(safeHeight / 100, 2), water: Math.round(safeWeight * .035 * 10) / 10, belowFloor: targetCalories < minimum };
}
export function recommendPlans(plans: any[], goal: Goal) {
  const terms = { lose: ['tanshif','diet','weight loss','تنشيف','خسارة','نزول'], maintain: ['liyaqa','fitness','balanced','لياقة','توازن','ثبات'], gain: ['tadkhim','bulking','muscle','تضخيم','كتلة','عضلات'] };
  const active = plans.filter(p => p.isActive !== false);
  const matched = active.map(plan => {
    const text = [plan.slug,plan.nameAr,plan.nameEn,plan.descriptionAr,plan.descriptionEn].filter(Boolean).join(' ').toLowerCase();
    return { plan, score: terms[goal].reduce((n, term) => n + (text.includes(term) ? 1 : 0), 0) };
  }).filter(p => p.score > 0).sort((a,b) => b.score-a.score || a.plan.sortOrder-b.plan.sortOrder);
  const candidates = matched.length ? matched : active.map(plan => ({plan,score:0})).sort((a,b) => a.plan.sortOrder-b.plan.sortOrder);
  return ['week','two_weeks','month'].map(duration => candidates.find(p => p.plan.duration === duration)?.plan).filter(Boolean);
}
/** Website comparison uses the first published option for each duration. */
export function planSaving(plan: any, weeklyPrice: number) {
  const price = Number(plan.options?.[0]?.priceQAR);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(weeklyPrice) || weeklyPrice <= 0) return 0;
  return Math.max(0, weeklyPrice * (plan.duration === 'month' ? 4 : plan.duration === 'two_weeks' ? 2 : 1) - price);
}
