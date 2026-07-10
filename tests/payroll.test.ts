/**
 * @file tests/payroll.test.ts
 * @description حساب ساعات العمل ومطابقة أسماء جهاز البصمة — يؤثران مباشرةً على الرواتب.
 */
import { describe, it, expect } from "vitest";
import { computeHours, lev } from "../convex/attendance";
import { normalizePhone } from "../convex/lib/phone";

describe("computeHours", () => {
  it("وردية نهارية عادية: 8 ساعات بلا أوفرتايم", () => {
    const r = computeHours("09:00", "17:00");
    expect(r.workedHours).toBe(8);
    expect(r.otHours).toBe(0);
  });

  it("وردية ليلية تعبر منتصف الليل: 3 عصراً → 3 فجراً = 12 ساعة، منها 3 أوفرتايم", () => {
    // هذه الحالة بالضبط هي ما كان جهاز البصمة يحسبه دخولاً جديداً بدل خروج.
    // الدوام القياسي 9 ساعات (WORK_HOURS_PER_DAY في convex/attendance.ts).
    const r = computeHours("15:00", "03:00");
    expect(r.workedHours).toBe(12);
    expect(r.otHours).toBe(3);
  });

  it("بلا دخول أو خروج → undefined (لا صفر، حتى لا يُحتسب غياباً بالخطأ)", () => {
    expect(computeHours("09:00", undefined).workedHours).toBeUndefined();
    expect(computeHours(undefined, "17:00").workedHours).toBeUndefined();
    expect(computeHours(undefined, undefined).otHours).toBeUndefined();
  });

  it("نصف ساعة تُحسب كسراً لا تُقرَّب لصفر", () => {
    expect(computeHours("09:00", "09:30").workedHours).toBeCloseTo(0.5, 2);
  });

  it("الأوفرتايم لا يكون سالباً عند الوردية القصيرة", () => {
    expect(computeHours("09:00", "12:00").otHours).toBe(0);
  });

  it("خروج بعد منتصف الليل بدقيقة يُحسب يوماً كاملاً تقريباً لا سالباً", () => {
    const r = computeHours("23:59", "00:01");
    expect(r.workedHours).toBeCloseTo(0.03, 2);
  });
});

describe("lev (مسافة ليفنشتاين — مطابقة أسماء البصمة بالرواتب)", () => {
  it("المطابق التام = 0", () => {
    expect(lev("ahmed", "ahmed")).toBe(0);
  });

  it("حرف واحد مختلف = 1", () => {
    expect(lev("ahmed", "ahmad")).toBe(1);
  });

  it("متماثلة في الاتجاهين", () => {
    expect(lev("mohamed", "mohammed")).toBe(lev("mohammed", "mohamed"));
  });

  it("النص الفارغ = طول الآخر", () => {
    expect(lev("", "abcd")).toBe(4);
    expect(lev("abcd", "")).toBe(4);
  });

  it("أسماء مختلفة تماماً تعطي مسافة كبيرة", () => {
    expect(lev("abeer", "mohamed")).toBeGreaterThan(4);
  });
});

describe("normalizePhone", () => {
  it("تُبقي الأرقام فقط", () => {
    expect(normalizePhone("+974 5114-4366")).toBe("97451144366");
    expect(normalizePhone("(030) 296 555")).toBe("030296555");
  });

  it("تتعامل مع القيم الفارغة بلا انهيار", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
  });

  it("نفس الرقم بصيغ مختلفة يُطبَّع لنفس المفتاح", () => {
    expect(normalizePhone("30296555")).toBe(normalizePhone("+30-296-555"));
  });
});
