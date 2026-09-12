/**
 * اختبارات ثابتة لقواعد shared/rules — تُشغَّل قبل أي رفع: `npm run check:rules`.
 * كل حالة هنا من مشكلة حقيقية وقعت أو من قاعدة اتُّفق عليها؛ لو تغيّرت قاعدة ولم
 * تُطبَّق في مكان، ينكسر الاختبار هنا لا عند المشترك.
 */
import assert from "node:assert/strict";
import {
  dailyLimits, countPicks, dayComplete, addMealVerdict, slotFull, subscriptionSlotKeys,
  orderedSubscriptionSlots, slotToDate, mealAvailableOn, defaultDeliveryDay, nextDeliveryDateISO,
  restrictionWords, restrictionHit, avoidTokens, scaledNutrition, programCalFactor,
  BREAKFAST_MAX_PER_DAY, isSnackCategory,
} from "../shared/rules";

let n = 0;
function t(name: string, fn: () => void) { fn(); n++; console.log("  ✓", name); }

// ── الحدود اليومية ──
t("صفر يعني صفر: مشترك بلا سناك لا يفتح له سناك بلا نهاية", () => {
  const l = dailyLimits({ mealsPerDay: 3, snacksPerDay: 0 });
  assert.equal(l.snacksPerDay, 0); assert.equal(l.hasSnackLimit, true); assert.equal(l.noMealPlan, false);
});
t("بلا أرقام مسجَّلة = بلا حد، ومشترك مسجَّل بلا أي عدد = noMealPlan", () => {
  assert.equal(dailyLimits(null).noMealPlan, false);
  assert.equal(dailyLimits({}).mealsPerDay, Infinity);
  assert.equal(dailyLimits({ mealsPerDay: null, snacksPerDay: "" }).noMealPlan, true);
});

// ── اكتمال اليوم ──
const L32 = dailyLimits({ mealsPerDay: 3, snacksPerDay: 2 });
t("اليوم يكتمل عند ٣ رئيسية + ٢ سناك (السلطة سناك)", () => {
  const c = countPicks([{ category: "breakfast" }, { category: "lunch" }, { category: "dinner" }, { category: "snack" }, { category: "salad" }]);
  assert.deepEqual([c.meals, c.snacks, c.breakfasts], [3, 2, 1]);
  assert.equal(dayComplete(c, L32), true);
});
t("بلا حدود مسجَّلة لا يكتمل اليوم أبداً (يبقى مفتوحاً)", () => {
  assert.equal(dayComplete(countPicks([{ category: "lunch" }]), dailyLimits(null)), false);
});
t("حد سناك فقط (بلا حد رئيسية): يكتمل بالسناك — حكم واحد في كل الأسابيع", () => {
  const l = dailyLimits({ snacksPerDay: 1 });
  assert.equal(dayComplete(countPicks([{ category: "snack" }]), l), true);
});

// ── الحكم على الإضافة ──
t("سناك ثالث يُرفض، والغداء الرابع يُرفض، وفطار ثانٍ يحتاج تأكيداً", () => {
  const full = countPicks([{ category: "breakfast" }, { category: "lunch" }, { category: "dinner" }, { category: "snack" }, { category: "snack" }]);
  assert.equal(addMealVerdict("snack", full, L32).block, "snacksFull");
  assert.equal(addMealVerdict("lunch", full, L32).block, "mealsFull");
  const one = countPicks([{ category: "breakfast" }]);
  const v = addMealVerdict("breakfast", one, L32);
  assert.equal(v.block, null); assert.equal(v.secondBreakfast, true); assert.equal(BREAKFAST_MAX_PER_DAY, 1);
  assert.equal(slotFull("salad", full, L32), true); assert.equal(isSnackCategory("salad"), true);
});
t("اشتراك بلا عدد وجبات يمنع أي إضافة", () => {
  assert.equal(addMealVerdict("lunch", countPicks([]), dailyLimits({ mealsPerDay: null })).block, "noMealPlan");
});

// ── الخانات والتواريخ (تواريخ مستقبلية حتى لا يتدخّل «بكرة») ──
const Y = new Date().getFullYear() + 1;
t("أسبوع من السبت للخميس يتخطّى الجمعة ويتقدّم الدورة بعدها", () => {
  // نبحث عن أول سبت في يناير من السنة القادمة
  const d = new Date(`${Y}-01-01T00:00:00`); while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const end = new Date(d); end.setDate(end.getDate() + 7); // السبت التالي
  const slots = orderedSubscriptionSlots(iso(d), iso(end), 4);
  assert.deepEqual(slots.map((s) => `${s.week}:${s.day}`), [
    "4:saturday", "4:sunday", "4:monday", "4:tuesday", "4:wednesday", "4:thursday", "1:saturday",
  ]);
  const keys = subscriptionSlotKeys(iso(d), iso(end), 4)!;
  assert.equal(keys.size, 7); assert.equal(keys.has("1:saturday"), true); assert.equal(keys.has("4:friday" as any), false);
  assert.equal(slotToDate(iso(d), 4, 1, "saturday"), iso(end));
  assert.equal(subscriptionSlotKeys(null, iso(end), 1), null);
});
t("بداية الاشتراك يوم جمعة: دورة البداية محسوبة لتلك الجمعة فلا تتقدّم مرتين، وتتقدّم في الجمعة التالية", () => {
  // كان يتقدّم مرتين (مرة في حساب دورة البداية ومرة عند المرور على نفس الجمعة) فيرى المشترك
  // الدورة 3 والمطبخ في 2، وتقع خطته أسبوعاً متأخراً. مُصلَح 2026-09-12. لا مشترك بدأ جمعة قبلها.
  const f = new Date(`${Y}-01-01T00:00:00`); while (f.getDay() !== 5) f.setDate(f.getDate() + 1);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const before = new Date(f); before.setDate(before.getDate() - 1);   // «اليوم» قبل البداية
  const sat = new Date(f); sat.setDate(sat.getDate() + 1);            // السبت التالي مباشرة
  const end = new Date(f); end.setDate(end.getDate() + 8);            // سبت الأسبوع التالي
  const slots = orderedSubscriptionSlots(iso(f), iso(end), 2, iso(before));
  assert.deepEqual(slots.map((s) => `${s.week}:${s.day}`), [
    "2:saturday", "2:sunday", "2:monday", "2:tuesday", "2:wednesday", "2:thursday", "3:saturday",
  ]);
  assert.equal(slotToDate(iso(f), 2, 2, "saturday", iso(before)), iso(sat));
  assert.equal(slotToDate(iso(f), 2, 3, "saturday", iso(before)), iso(end));
});
t("الخادم يمرّر «يوم قطر»: لو اليوم = يوم البداية تبدأ الخانات من بكرة (كما في المنيو)", () => {
  const sat = new Date(`${Y}-01-01T00:00:00`); while (sat.getDay() !== 6) sat.setDate(sat.getDate() + 1);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const end = new Date(sat); end.setDate(end.getDate() + 5); // الخميس
  const fromSat = orderedSubscriptionSlots(iso(sat), iso(end), 1, iso(sat)).map((s) => s.day);
  assert.deepEqual(fromSat, ["sunday", "monday", "tuesday", "wednesday", "thursday"]);
  const before = orderedSubscriptionSlots(iso(sat), iso(end), 1, `${Y - 1}-12-01`).map((s) => s.day);
  assert.deepEqual(before, ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"]);
});
t("اليوم الافتراضي: الجمعة → السبت، والخميس يبقى الخميس", () => {
  assert.equal(defaultDeliveryDay(new Date("2026-09-11T10:00:00")), "saturday"); // جمعة
  assert.equal(defaultDeliveryDay(new Date("2026-09-10T10:00:00")), "thursday");
  assert.equal(nextDeliveryDateISO(new Date("2026-09-11T10:00:00")), "2026-09-12");
});

// ── الجدولة ──
t("الجدولة الحديثة توحّد النوع (\"2\"/\"Saturday\")، والقديمة حرفية، وبلا جدولة لا تُعرض", () => {
  assert.equal(mealAvailableOn({ schedule: [{ week: "2", day: "Saturday" }] }, 2, "saturday"), true);
  assert.equal(mealAvailableOn({ schedule: [{ week: 2, day: "saturday" }] }, 2, null), true);
  assert.equal(mealAvailableOn({ weeks: [1, 2], days: ["monday"] }, 2, "monday"), true);
  assert.equal(mealAvailableOn({ weeks: [1, 2], days: ["monday"] }, 2, "tuesday"), false);
  assert.equal(mealAvailableOn({}, 1, "monday"), false);
});

// ── الممنوعات ──
t("NO SALT/TURKEY تُطابق الاسم والمكوّنات، والوصف يُفحص احتياطاً", () => {
  const words = restrictionWords("turkey, avocado", "NO SALT");
  const tokens = avoidTokens("NO SALT", "turkey, avocado");
  assert.equal(restrictionHit({ nameEn: "Turkey wrap", ingredients: [] }, words, tokens), "turkey");
  assert.equal(restrictionHit({ nameEn: "Beef", ingredients: ["salt"] }, words, tokens), "salt");
  assert.equal(restrictionHit({ nameEn: "Beef", descriptionEn: "with avocado" }, words, tokens), "avocado");
  assert.equal(restrictionHit({ nameEn: "Chicken rice", ingredients: ["rice"] }, words, tokens), null);
});

// ── التغذية ──
t("معامل البرنامج يسري على الغداء/العشاء فقط، والسعرات من الماكروز 4/4/9", () => {
  assert.equal(programCalFactor("BULK", { BULK: { calFactor: 1.15 } }), 1.15);
  assert.equal(programCalFactor("", undefined), 1);
  const lunch = scaledNutrition({ category: "lunch", protein: 40, carbs: 35, fats: 12, calories: 408 }, 1.15);
  assert.deepEqual(lunch, { calories: 46 * 4 + 40 * 4 + 14 * 9, protein: 46, carbs: 40, fats: 14 });
  const bf = scaledNutrition({ category: "breakfast", protein: 20, carbs: 30, fats: 10, calories: 290 }, 1.15);
  assert.deepEqual(bf, { calories: 290, protein: 20, carbs: 30, fats: 10 });
});

console.log(`\n${n} قاعدة متحقَّقة ✓`);
