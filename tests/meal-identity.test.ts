/**
 * @file tests/meal-identity.test.ts
 * @description هوية الوجبة ودمج البطاقات المكررة — الحالات من الإنتاج 2026-09-15.
 */
import { describe, it, expect } from "vitest";
import { mealChannel, normMealName, sameNameSameChannel, mergeSchedules, mergePlan } from "../convex/lib/mealIdentity";

describe("normMealName / mealChannel", () => {
  it("يتجاهل الحالة والمسافات والرموز ويقرأ w/ كـ with", () => {
    expect(normMealName("Dynamite Shrimp w/Rice")).toBe(normMealName("dynamite shrimp with rice"));
    expect(normMealName("Mix Strawberry & Blueberry")).toBe(normMealName("MIX STRAWBERRY AND BLUEBERRY"));
    expect(normMealName("سلطة البحر المتوسط و الفيتا")).toBe(normMealName("سلطة  البحر المتوسط والفيتا"));
  });
  it("القناة من العلمين", () => {
    expect(mealChannel({ isOnlineOnly: true })).toBe("online");
    expect(mealChannel({ isGymOnly: true })).toBe("outlet");
    expect(mealChannel({})).toBe("subscription");
  });
  it("نفس الاسم في قناتين مختلفتين ليس تكراراً (صف أونلاين وصف مشتركين لنفس الطبق مقصودان)", () => {
    expect(sameNameSameChannel({ nameEn: "Beef Burger" }, { nameEn: "Beef Burger", isOnlineOnly: true })).toBe(false);
    expect(sameNameSameChannel({ nameEn: "Beef Burger" }, { nameEn: "BEEF BURGER" })).toBe(true);
  });
});

describe("mergeSchedules / mergePlan — سلطة الفيتا فبراير + يوليو", () => {
  const feb = { _id: "feb", nameEn: "Mediterranean Feta Salad", schedule: [{ week: 1, day: "thursday" }], calories: 219, priceQAR: 45, storageId: "img-feb" };
  const jul = { _id: "jul", nameEn: "Mediterranean Feta Salad", schedule: [{ week: 2, day: "thursday" }, { week: 3, day: "thursday" }, { week: 4, day: "thursday" }], calories: 222, priceQAR: 0, storageId: "img-jul" };
  it("الجدولة تصير اتحاد الاثنتين بلا تكرار", () => {
    expect(mergeSchedules(jul.schedule, feb.schedule)).toEqual([1, 2, 3, 4].map((week) => ({ week, day: "thursday" })));
    expect(mergeSchedules([{ week: 3, day: "Thursday" }], [{ week: 3, day: "thursday" }])).toEqual([{ week: 3, day: "thursday" }]);
  });
  it("الباقية تحتفظ باسمها وسعراتها وصورتها، وتأخذ الجدولة الناقصة فقط", () => {
    const patch = mergePlan(jul, feb);
    expect(patch).toEqual({ schedule: [1, 2, 3, 4].map((week) => ({ week, day: "thursday" })) });
  });
  it("الحقول الفارغة تُكمَّل من المقفلة (صورة/وصف) ولا تُستبدل الموجودة", () => {
    const patch = mergePlan({ nameEn: "x", schedule: [] }, { nameEn: "x", schedule: [], storageId: "old-img", descriptionAr: "وصف" });
    expect(patch).toEqual({ storageId: "old-img", descriptionAr: "وصف" });
  });
  it("رابط صورة قديم لا يُنسخ إلى بطاقة لها صورة مخزّنة (النودلز: رابط تخزين التطوير)", () => {
    expect(mergePlan({ storageId: "kg-new", schedule: [] }, { imageUrl: "https://dev.convex.cloud/x", schedule: [] })).toEqual({});
  });
  it("بطاقة بلا جدولة (نودلز فبراير) لا تضيف شيئاً لجدولة يوليو", () => {
    expect(mergePlan({ schedule: [{ week: 3, day: "thursday" }] }, { schedule: [], weeks: [], days: [] })).toEqual({});
  });
});
