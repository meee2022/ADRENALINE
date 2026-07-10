/**
 * @file tests/passwords.test.ts
 * @description تشفير كلمات المرور — أمني، وفيه فرع قديم (simpleHash) لم يكن مغطّى.
 */
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../convex/passwords";

/** نسخة من التجزئة القديمة، لتوليد قيم اختبار مطابقة لما في قاعدة البيانات. */
function legacyHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}

describe("hashPassword", () => {
  it("تُنتج الصيغة pbkdf2$iters$salt$hash", () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    return hashPassword("correct horse").then((h) => {
      const parts = h.split("$");
      expect(parts[0]).toBe("pbkdf2");
      expect(Number(parts[1])).toBeGreaterThanOrEqual(100000);
      expect(parts).toHaveLength(4);
    });
  });

  it("ملح عشوائي: نفس كلمة المرور تُنتج هاشين مختلفين", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    // ومع ذلك يتحقق كلاهما
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("same-password", b)).toBe(true);
  });
});

describe("verifyPassword — الصيغة الحديثة", () => {
  it("تقبل كلمة المرور الصحيحة", async () => {
    const h = await hashPassword("s3cret-passw0rd");
    expect(await verifyPassword("s3cret-passw0rd", h)).toBe(true);
  });

  it("ترفض الخاطئة", async () => {
    const h = await hashPassword("s3cret-passw0rd");
    expect(await verifyPassword("s3cret-passw0rdX", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });

  it("حسّاسة لحالة الحروف", async () => {
    const h = await hashPassword("CaseSensitive");
    expect(await verifyPassword("casesensitive", h)).toBe(false);
  });
});

describe("verifyPassword — التوافق الرجعي مع الهاش القديم", () => {
  it("تقبل حساباً ما زال على simpleHash", async () => {
    const stored = legacyHash("old-password");
    expect(await verifyPassword("old-password", stored)).toBe(true);
  });

  it("ترفض كلمة خاطئة على الهاش القديم", async () => {
    const stored = legacyHash("old-password");
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("الهاش القديم ضعيف فعلاً: قابل للكسر فوراً بالقوة الغاشمة", () => {
    // توثيق للخطر: مساحة الإخراج صغيرة والدالة بلا ملح ولا تكرار
    const target = legacyHash("1234");
    let found: string | null = null;
    for (let i = 0; i < 10000 && !found; i++) {
      if (legacyHash(String(i).padStart(4, "0")) === target) found = String(i).padStart(4, "0");
    }
    expect(found).toBe("1234"); // كُسر في أقل من 10 آلاف محاولة محلية
  });
});
