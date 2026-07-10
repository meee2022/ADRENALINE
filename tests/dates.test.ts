/**
 * @file tests/dates.test.ts
 * @description أخطر حساب في النظام: أيام التوصيل.
 *
 * عليه يعتمد تعويض أيام التجميد (فلوس العميل) وجدولة الطلبات.
 * قاعدة العمل: التوصيل من السبت إلى الخميس (6 أيام). الجمعة وحدها بلا توصيل.
 */
import { describe, it, expect } from "vitest";
import {
  parseDate,
  fmtDate,
  addDays,
  dateToDays,
  isDeliveryDay,
  countDeliveryDays,
  addDeliveryDays,
  getDayOffset,
  DELIVERY_DAYS,
} from "../convex/lib/dates";

// 2026-07-11 سبت · 12 أحد · 13 اثنين · 14 ثلاثاء · 15 أربعاء · 16 خميس · 17 جمعة
const SAT = "2026-07-11";
const WED = "2026-07-15";
const THU = "2026-07-16";
const FRI = "2026-07-17";

describe("parseDate / fmtDate", () => {
  it("تقرأ التاريخ عند منتصف ليل UTC (لا تنزلق مع المنطقة الزمنية)", () => {
    const d = parseDate(SAT);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(6); // يوليو = 6
    expect(d.getUTCDate()).toBe(11);
    expect(d.getUTCHours()).toBe(0);
  });

  it("تعود لنفس النص (round-trip)", () => {
    expect(fmtDate(parseDate(SAT))).toBe(SAT);
  });
});

describe("isDeliveryDay", () => {
  it("السبت→الخميس أيام توصيل (6 أيام)", () => {
    for (const d of [SAT, "2026-07-12", "2026-07-13", "2026-07-14", WED, THU]) {
      expect(isDeliveryDay(parseDate(d))).toBe(true);
    }
  });

  it("الجمعة وحدها بلا توصيل", () => {
    expect(isDeliveryDay(parseDate(FRI))).toBe(false);
    expect(isDeliveryDay(parseDate(THU))).toBe(true); // الخميس توصيل
  });
});

describe("countDeliveryDays", () => {
  it("أسبوعان تقويميان (14 يوماً) = 12 يوم توصيل (جمعتان فقط إجازة)", () => {
    // سيناريو المشترك المسافر: 14 يوم - جمعتان = 12 يوم توصيل
    expect(countDeliveryDays(SAT, "2026-07-25")).toBe(12);
  });

  it("المدى نصف مفتوح: يوم النهاية غير محتسب", () => {
    expect(countDeliveryDays(SAT, SAT)).toBe(0);
    expect(countDeliveryDays(SAT, "2026-07-12")).toBe(1); // السبت وحده
  });

  it("تجميد الخميس يكلّف يوم توصيل (الخميس يوم توصيل)", () => {
    expect(countDeliveryDays(THU, FRI)).toBe(1);
  });

  it("الجمعة وحدها لا تُحتسب", () => {
    expect(countDeliveryDays(FRI, "2026-07-18")).toBe(0); // الجمعة → السبت (exclusive)
  });

  it("تستبعد الأيام التي تخطّاها العميل مسبقاً (لا تعويض مزدوج)", () => {
    expect(countDeliveryDays(SAT, "2026-07-14", ["2026-07-12"])).toBe(2); // 3 - 1
  });
});

describe("addDeliveryDays", () => {
  it("تمديد 12 يوم توصيل يقفز فوق الجُمَع", () => {
    expect(addDeliveryDays("2026-07-31", 12)).toBe("2026-08-13");
  });

  it("التمديد ينتهي دائماً على يوم توصيل", () => {
    for (let n = 1; n <= 20; n++) {
      expect(isDeliveryDay(parseDate(addDeliveryDays(SAT, n)))).toBe(true);
    }
  });

  it("عكسية countDeliveryDays: ما يُضاف يُقرأ بنفس العدد", () => {
    for (const n of [1, 2, 4, 5, 10, 13]) {
      const end = addDeliveryDays(SAT, n);
      const endExclusive = fmtDate(addDays(parseDate(end), 1));
      // نعدّ من اليوم التالي للبداية حتى نهاية المدة شاملةً
      const from = fmtDate(addDays(parseDate(SAT), 1));
      expect(countDeliveryDays(from, endExclusive)).toBe(n);
    }
  });

  it("صفر أيام لا يحرّك التاريخ", () => {
    expect(addDeliveryDays(SAT, 0)).toBe(SAT);
  });
});

describe("dateToDays", () => {
  it("تصاعدية ومتّسقة", () => {
    expect(dateToDays("2026-07-12") - dateToDays(SAT)).toBe(1);
    expect(dateToDays("2026-08-11") - dateToDays("2026-07-11")).toBe(31);
  });
});

describe("getDayOffset", () => {
  it("السبت 0 … الخميس 5", () => {
    DELIVERY_DAYS.forEach((d, i) => expect(getDayOffset(d)).toBe(i));
    expect(getDayOffset("thursday")).toBe(5); // الخميس يوم توصيل صحيح
  });

  it("لا تتأثر بحالة الحروف", () => {
    expect(getDayOffset("SATURDAY")).toBe(0);
  });

  it("الجمعة/المجهول → الخميس (آخر يوم توصيل)، لا خطأ يعطّل اعتماد الطلب", () => {
    expect(getDayOffset("friday")).toBe(5);
    expect(getDayOffset("")).toBe(5);
  });
});
