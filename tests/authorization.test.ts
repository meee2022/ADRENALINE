/**
 * @file tests/authorization.test.ts
 * @description اختبارات negative للـauthorization لكل دور — تتحقق أن كل مسار
 *   ما بيقبلش أدوار غير مصرّح لها. تختبر pure helpers مباشرة (assertRole,
 *   validateSession logic) بدون Convex context — عشان تفضل سريعة وموثوقة.
 *
 *   جدول الأدوار المتوقّع:
 *   - ADMIN                → super-user، يمرّ على كل الاختبارات
 *   - ACCOUNTANT           → يقدر يشوف الرواتب
 *   - FINANCE_MANAGER      → يقدر يشوف الرواتب + التقارير المالية
 *   - KITCHEN              → المطبخ فقط
 *   - DELIVERY             → التوصيل فقط
 *   - NUTRITIONIST         → خطط العملاء فقط
 *   - INVENTORY_MANAGER    → المخزون فقط
 *   - CASHIER              → POS فقط
 */
import { describe, it, expect } from "vitest";
import { assertRole, type Identity, AUTH_ERR, ROLE_ERR } from "../convex/sessions";

/* Helpers لبناء identity بدور */
const staff = (role: string): Identity => ({ accountType: "staff", userId: "u1", role });
const customer = (): Identity => ({ accountType: "customer", customerAccountId: "c1" });

describe("assertRole — negative authorization", () => {

  /* ───────── قواعد عامة ───────── */
  it("null identity → يرمي AUTH_ERR", () => {
    expect(() => assertRole(null, ["ADMIN"])).toThrow(AUTH_ERR);
  });
  it("customer identity → يرمي AUTH_ERR حتى لو الدور المسموح بأي شيء", () => {
    expect(() => assertRole(customer(), ["ADMIN", "CASHIER"])).toThrow(AUTH_ERR);
  });
  it("ADMIN يمرّ حتى لو مش في القائمة (super-user)", () => {
    expect(() => assertRole(staff("ADMIN"), ["ACCOUNTANT"])).not.toThrow();
    expect(() => assertRole(staff("ADMIN"), [])).not.toThrow();
  });
  it("case-insensitive: دور بحروف صغيرة يُعامَل زي capitalized", () => {
    expect(() => assertRole(staff("admin"), ["ADMIN"])).not.toThrow();
    expect(() => assertRole(staff("Kitchen"), ["kitchen"])).not.toThrow();
  });

  /* ───────── الرواتب: ACCOUNTANT / FINANCE_MANAGER / ADMIN فقط ───────── */
  describe("payroll roles", () => {
    const allowed = ["ACCOUNTANT", "FINANCE_MANAGER"];
    it("ACCOUNTANT يمرّ", () => expect(() => assertRole(staff("ACCOUNTANT"), allowed)).not.toThrow());
    it("FINANCE_MANAGER يمرّ", () => expect(() => assertRole(staff("FINANCE_MANAGER"), allowed)).not.toThrow());
    it("ADMIN يمرّ (super-user)", () => expect(() => assertRole(staff("ADMIN"), allowed)).not.toThrow());
    it("KITCHEN يُرفض", () => expect(() => assertRole(staff("KITCHEN"), allowed)).toThrow(ROLE_ERR));
    it("DELIVERY يُرفض", () => expect(() => assertRole(staff("DELIVERY"), allowed)).toThrow(ROLE_ERR));
    it("NUTRITIONIST يُرفض", () => expect(() => assertRole(staff("NUTRITIONIST"), allowed)).toThrow(ROLE_ERR));
    it("INVENTORY_MANAGER يُرفض", () => expect(() => assertRole(staff("INVENTORY_MANAGER"), allowed)).toThrow(ROLE_ERR));
    it("CASHIER يُرفض", () => expect(() => assertRole(staff("CASHIER"), allowed)).toThrow(ROLE_ERR));
    it("null role يُرفض", () => expect(() => assertRole(staff(""), allowed)).toThrow(ROLE_ERR));
    it("unknown role يُرفض", () => expect(() => assertRole(staff("HACKER"), allowed)).toThrow(ROLE_ERR));
  });

  /* ───────── POS: CASHIER / ADMIN فقط ───────── */
  describe("POS roles", () => {
    const allowed = ["CASHIER"];
    it("CASHIER يمرّ", () => expect(() => assertRole(staff("CASHIER"), allowed)).not.toThrow());
    it("ADMIN يمرّ (super-user)", () => expect(() => assertRole(staff("ADMIN"), allowed)).not.toThrow());
    it("KITCHEN يُرفض", () => expect(() => assertRole(staff("KITCHEN"), allowed)).toThrow(ROLE_ERR));
    it("DELIVERY يُرفض", () => expect(() => assertRole(staff("DELIVERY"), allowed)).toThrow(ROLE_ERR));
    it("NUTRITIONIST يُرفض", () => expect(() => assertRole(staff("NUTRITIONIST"), allowed)).toThrow(ROLE_ERR));
    it("ACCOUNTANT يُرفض", () => expect(() => assertRole(staff("ACCOUNTANT"), allowed)).toThrow(ROLE_ERR));
  });

  /* ───────── المخزون: INVENTORY_MANAGER / ADMIN ───────── */
  describe("Inventory roles", () => {
    const allowed = ["INVENTORY_MANAGER"];
    it("INVENTORY_MANAGER يمرّ", () => expect(() => assertRole(staff("INVENTORY_MANAGER"), allowed)).not.toThrow());
    it("ADMIN يمرّ", () => expect(() => assertRole(staff("ADMIN"), allowed)).not.toThrow());
    it("CASHIER يُرفض", () => expect(() => assertRole(staff("CASHIER"), allowed)).toThrow(ROLE_ERR));
    it("KITCHEN يُرفض", () => expect(() => assertRole(staff("KITCHEN"), allowed)).toThrow(ROLE_ERR));
    it("DELIVERY يُرفض", () => expect(() => assertRole(staff("DELIVERY"), allowed)).toThrow(ROLE_ERR));
    it("NUTRITIONIST يُرفض", () => expect(() => assertRole(staff("NUTRITIONIST"), allowed)).toThrow(ROLE_ERR));
    it("ACCOUNTANT يُرفض", () => expect(() => assertRole(staff("ACCOUNTANT"), allowed)).toThrow(ROLE_ERR));
    it("FINANCE_MANAGER يُرفض", () => expect(() => assertRole(staff("FINANCE_MANAGER"), allowed)).toThrow(ROLE_ERR));
  });

  /* ───────── المطبخ: KITCHEN / ADMIN ───────── */
  describe("Kitchen roles", () => {
    const allowed = ["KITCHEN"];
    it("KITCHEN يمرّ", () => expect(() => assertRole(staff("KITCHEN"), allowed)).not.toThrow());
    it("ADMIN يمرّ", () => expect(() => assertRole(staff("ADMIN"), allowed)).not.toThrow());
    it("DELIVERY يُرفض", () => expect(() => assertRole(staff("DELIVERY"), allowed)).toThrow(ROLE_ERR));
    it("CASHIER يُرفض", () => expect(() => assertRole(staff("CASHIER"), allowed)).toThrow(ROLE_ERR));
    it("NUTRITIONIST يُرفض", () => expect(() => assertRole(staff("NUTRITIONIST"), allowed)).toThrow(ROLE_ERR));
  });

  /* ───────── التوصيل: DELIVERY / ADMIN ───────── */
  describe("Delivery roles", () => {
    const allowed = ["DELIVERY"];
    it("DELIVERY يمرّ", () => expect(() => assertRole(staff("DELIVERY"), allowed)).not.toThrow());
    it("ADMIN يمرّ", () => expect(() => assertRole(staff("ADMIN"), allowed)).not.toThrow());
    it("KITCHEN يُرفض", () => expect(() => assertRole(staff("KITCHEN"), allowed)).toThrow(ROLE_ERR));
    it("CASHIER يُرفض", () => expect(() => assertRole(staff("CASHIER"), allowed)).toThrow(ROLE_ERR));
  });

  /* ───────── أدوار متعددة: قائمة تقبل أكثر من واحد ───────── */
  describe("Multi-role allowances", () => {
    it("KITCHEN مسموح مع [KITCHEN, DELIVERY]", () => {
      expect(() => assertRole(staff("KITCHEN"), ["KITCHEN", "DELIVERY"])).not.toThrow();
    });
    it("DELIVERY مسموح مع [KITCHEN, DELIVERY]", () => {
      expect(() => assertRole(staff("DELIVERY"), ["KITCHEN", "DELIVERY"])).not.toThrow();
    });
    it("CASHIER يُرفض مع [KITCHEN, DELIVERY]", () => {
      expect(() => assertRole(staff("CASHIER"), ["KITCHEN", "DELIVERY"])).toThrow(ROLE_ERR);
    });
  });

  /* ───────── حالات حافّة ───────── */
  describe("Edge cases", () => {
    it("قائمة أدوار فارغة + غير ADMIN → يُرفض", () => {
      expect(() => assertRole(staff("CASHIER"), [])).toThrow(ROLE_ERR);
    });
    it("staff بدون role field → يُرفض من أي قائمة", () => {
      const noRole: Identity = { accountType: "staff", userId: "u1" };
      expect(() => assertRole(noRole, ["CASHIER"])).toThrow(ROLE_ERR);
    });
    it("staff بـrole = 'ADMIN' صراحة مع أحرف كبيرة يمرّ حتى لو القائمة فاضية", () => {
      expect(() => assertRole(staff("ADMIN"), [])).not.toThrow();
    });
  });
});
