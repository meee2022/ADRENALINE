import { describe, expect, it } from "vitest";
import {
  orderableSubscriptionSlots,
  validateCustomerOrderSelection,
} from "../convex/lib/customerOrderRules";

const TODAY = "2026-07-22";

function meal(category: string, overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    isGymOnly: false,
    isOnlineOnly: false,
    category,
    schedule: [{ week: 2, day: "thursday" }],
    ...overrides,
  };
}

const customer = {
  isActive: true,
  startDate: "2026-07-23",
  endDate: "2026-07-23",
  mealsPerDay: 2,
  snacksPerDay: 1,
};

function validItems() {
  return [
    { mealId: "breakfast", week: 2, day: "thursday", meal: meal("breakfast") },
    { mealId: "lunch", week: 2, day: "thursday", meal: meal("lunch") },
    { mealId: "snack", week: 2, day: "thursday", meal: meal("snack") },
  ];
}

describe("customer order server rules", () => {
  it("uses the same tomorrow-forward subscription slot walk", () => {
    expect(orderableSubscriptionSlots(customer, 2, TODAY)).toEqual([
      { week: 2, day: "thursday" },
    ]);
  });

  it("accepts a complete, scheduled subscriber selection", () => {
    expect(() => validateCustomerOrderSelection({
      items: validItems(), customer, startRotationWeek: 2, todayISO: TODAY,
    })).not.toThrow();
  });

  it.each([
    ["outlet channel", { isGymOnly: true }, "INVALID_MEAL_CHANNEL"],
    ["online-only channel", { isOnlineOnly: true }, "INVALID_MEAL_CHANNEL"],
    ["wrong schedule", { schedule: [{ week: 1, day: "saturday" }] }, "MEAL_NOT_SCHEDULED"],
  ])("rejects %s meals", (_label, overrides, code) => {
    const items = validItems();
    items[1] = { ...items[1], meal: meal("lunch", overrides) };
    expect(() => validateCustomerOrderSelection({
      items, customer, startRotationWeek: 2, todayISO: TODAY,
    })).toThrow(code);
  });

  it("rejects incomplete daily subscription counts", () => {
    expect(() => validateCustomerOrderSelection({
      items: validItems().slice(0, 2), customer, startRotationWeek: 2, todayISO: TODAY,
    })).toThrow("SUBSCRIPTION_COUNT_MISMATCH");
  });

  // ☕ الفطار الثاني مسموح عمداً: المشترك حرّ فيه بعد تأكيد صريح في المنيو
  //    (701adba). السقف يبقى على الاختيار التلقائي وحده، والعدد الكلي للوجبات
  //    الرئيسية يظلّ مفروضاً فلا يزيد أحد حصّته. هذا الاختبار يحرس ذلك.
  it("allows a second breakfast without inflating the daily count", () => {
    const items = validItems();
    items[1] = { mealId: "breakfast-2", week: 2, day: "thursday", meal: meal("breakfast") };
    expect(() => validateCustomerOrderSelection({
      items, customer, startRotationWeek: 2, todayISO: TODAY,
    })).not.toThrow();

    // لكن فطار إضافي فوق الحصّة يُرفض كأي وجبة رئيسية زائدة
    expect(() => validateCustomerOrderSelection({
      items: [...items, { mealId: "breakfast-3", week: 2, day: "thursday", meal: meal("breakfast") }],
      customer, startRotationWeek: 2, todayISO: TODAY,
    })).toThrow("SUBSCRIPTION_COUNT_MISMATCH");
  });

  it("rejects paused and expired subscriptions", () => {
    expect(() => validateCustomerOrderSelection({
      items: validItems(), customer: { ...customer, isActive: false, pausedFrom: TODAY },
      startRotationWeek: 2, todayISO: TODAY,
    })).toThrow("SUBSCRIPTION_PAUSED");
    expect(() => validateCustomerOrderSelection({
      items: validItems(), customer: { ...customer, endDate: "2026-07-21" },
      startRotationWeek: 2, todayISO: TODAY,
    })).toThrow("SUBSCRIPTION_EXPIRED");
  });
});
