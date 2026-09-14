/**
 * @file tests/attendance-merge.test.ts
 * @description الحضور — دمج نوافذ السحب الجزئية مع الصف المحفوظ.
 *   الحالات هنا من الإنتاج (2026-08-25 → 2026-09-13): نصف الطاقم صار دخوله = خروجه
 *   (صفر ساعة) لأن نافذة الـ18 ساعة، حين تنزلق عن بصمة الصباح، تُعيد بصمة المساء
 *   وحدها دخولاً فتمحو الدخول الحقيقي.
 */
import { describe, it, expect } from "vitest";
import { buildShifts, effectiveMode, mergeShift } from "../convex/attendance";

const bio = (checkIn?: string, checkOut?: string) => ({ checkIn, checkOut, source: "biometric" as const });

describe("mergeShift — نافذة جزئية (merge)", () => {
  it("سعيدول 2026-09-13: بصمة المساء وحدها لا تمحو دخول الصباح ولا تصنع صفر ساعة", () => {
    // المحفوظ صحيح من سحب الليل، ثم نافذة الظهر التالية لا تحوي إلا 23:30
    expect(mergeShift(bio("12:06", "23:30"), { checkIn: "23:30" })).toEqual({ checkIn: "12:06", checkOut: "23:30" });
  });

  it("الترتيب: نافذة الصباح فقط ثم المساء فقط تبني اليوم كاملاً", () => {
    const afterMorning = mergeShift(null, { checkIn: "11:52" });
    expect(afterMorning).toEqual({ checkIn: "11:52", checkOut: undefined });
    const afterEvening = mergeShift(bio(afterMorning.checkIn, afterMorning.checkOut), { checkIn: "22:54" });
    expect(afterEvening).toEqual({ checkIn: "11:52", checkOut: "22:54" });
  });

  it("خروج بعد منتصف الليل (11:53 → 00:22) يبقى خروجاً حين يصل وحده", () => {
    expect(mergeShift(bio("11:53", "00:22"), { checkIn: "00:22" })).toEqual({ checkIn: "11:53", checkOut: "00:22" });
    expect(mergeShift(bio("11:53"), { checkOut: "00:22" })).toEqual({ checkIn: "11:53", checkOut: "00:22" });
  });

  it("بكري 05:44 → 15:39: الدخول الصباحي المبكر لا ينقلب خروجاً", () => {
    expect(mergeShift(bio("05:44", "15:39"), { checkIn: "15:39" })).toEqual({ checkIn: "05:44", checkOut: "15:39" });
  });

  it("شيفت ليلي بإشارة الجهاز: خروج 02:34 وحده لا يمحو دخول 15:39", () => {
    expect(mergeShift(bio("15:39", "02:34"), { checkOut: "02:34" })).toEqual({ checkIn: "15:39", checkOut: "02:34" });
    expect(mergeShift(bio(undefined, "02:34"), { checkIn: "15:39" })).toEqual({ checkIn: "15:39", checkOut: "02:34" });
  });

  it("بصمة استراحة في المنتصف لا تزحزح الدخول", () => {
    expect(mergeShift(bio("12:00", "23:30"), { checkIn: "16:00", checkOut: "23:30" })).toEqual({ checkIn: "12:00", checkOut: "23:30" });
  });

  it("نافذة سابقة حفظت دخولاً متأخراً (16:00) ثم وصل الدخول الأبكر (12:00)", () => {
    expect(mergeShift(bio("16:00", "23:30"), { checkIn: "12:00", checkOut: "16:00" })).toEqual({ checkIn: "12:00", checkOut: "23:30" });
  });

  it("خروج وحده يبقى خروجاً، ودخول وحده يبقى دخولاً", () => {
    expect(mergeShift(bio(undefined, "02:34"), { checkOut: "02:34" })).toEqual({ checkIn: undefined, checkOut: "02:34" });
    expect(mergeShift(bio("14:00"), { checkIn: "14:00" })).toEqual({ checkIn: "14:00", checkOut: undefined });
  });

  it("صف تالف (دخول = خروج) يُترك لسحب الأيام الكاملة ولا يتحوّل إلى دخول بلا خروج", () => {
    // لو تحوّل إلى {23:30, —} لأكلت القاعدةُ السياقية بصمةَ صباح الغد خروجاً له
    expect(mergeShift(bio("23:30", "23:30"), { checkIn: "23:30" })).toEqual({ checkIn: "23:30", checkOut: "23:30" });
  });

  it("اتحاد يتجاوز 16 ساعة يثق بالوارد الطازج", () => {
    expect(mergeShift(bio("00:18", "23:22"), { checkIn: "12:02", checkOut: "23:22" })).toEqual({ checkIn: "12:02", checkOut: "23:22" });
  });

  it("الصف اليدوي وغير البصمي لا يُدمج معه (يُعاد الوارد كما هو)", () => {
    expect(mergeShift({ checkIn: "09:00", checkOut: "17:00", source: "manual" }, { checkIn: "23:30" })).toEqual({ checkIn: "23:30", checkOut: undefined });
  });
});

describe("mergeShift — سحب الأيام الكاملة (replace)", () => {
  it("يستبدل الصف التالف بما يحمله اليوم كاملاً", () => {
    expect(mergeShift(bio("23:04", "23:04"), { checkIn: "11:55", checkOut: "23:04" }, "replace")).toEqual({ checkIn: "11:55", checkOut: "23:04" });
  });

  it("حدّ المقطع: خروج الفجر 02:35 يصل وحده في المقطع التالي فيُدمج ولا يمحو دخول 16:11", () => {
    // وقع فعلاً في إعادة سحب 2026-09-13: شريفول وشروب وعارف فقدوا خروجهم
    const s = { checkIn: undefined, checkOut: "02:35" };
    expect(effectiveMode(s, "replace")).toBe("merge");
    expect(mergeShift(bio("16:11"), s, effectiveMode(s, "replace"))).toEqual({ checkIn: "16:11", checkOut: "02:35" });
    // أما شيفت يحمل دخوله فيستبدل فعلاً
    expect(effectiveMode({ checkIn: "11:55", checkOut: "23:04" }, "replace")).toBe("replace");
  });
});

describe("buildShifts — إشارة الجهاز مع البصمات الحرّة", () => {
  it("خروج ليلي أُلحق بيوم الدخول (وقته أصغر) يُرتَّب آخراً ويبقى الدخول الحرّ محفوظاً", () => {
    const s = buildShifts([
      { name: "A", date: "2026-09-13", time: "14:00" },
      { name: "A", date: "2026-09-13", time: "02:00", kind: "out" },
    ]);
    expect(s).toEqual([{ name: "A", date: "2026-09-13", checkIn: "14:00", checkOut: "02:00" }]);
  });

  it("بلا إشارة: أول بصمة دخول وآخرها خروج داخل اليوم التقويمي", () => {
    const s = buildShifts([
      { name: "A", date: "2026-09-13", time: "23:30" },
      { name: "A", date: "2026-09-13", time: "12:06" },
      { name: "A", date: "2026-09-13", time: "16:00" },
    ]);
    expect(s).toEqual([{ name: "A", date: "2026-09-13", checkIn: "12:06", checkOut: "23:30" }]);
  });

  it("بصمة واحدة بلا إشارة = دخول بلا خروج (لا دخول = خروج)", () => {
    expect(buildShifts([{ name: "A", date: "2026-09-13", time: "23:30" }]))
      .toEqual([{ name: "A", date: "2026-09-13", checkIn: "23:30", checkOut: undefined }]);
  });
});
