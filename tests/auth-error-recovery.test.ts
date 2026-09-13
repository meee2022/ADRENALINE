import { describe, expect, it } from "vitest";
import { isAuthError } from "../client/src/lib/authError";

describe("session error classification", () => {
  it("recognizes a redacted Convex message with structured auth data", () => {
    const error = Object.assign(new Error("Server Error"), { data: "غير مصرّح — سجّل الدخول من جديد" });
    expect(isAuthError(error)).toBe(true);
  });
  it("recognizes the legacy error message", () => {
    expect(isAuthError(new Error("غير مصرّح — سجّل الدخول من جديد"))).toBe(true);
  });
  it("does not log out staff for insufficient permissions", () => {
    expect(isAuthError(new Error("هذه العملية تتطلب صلاحية مدير"))).toBe(false);
  });
  it("does not mistake an outage for an invalid session", () => {
    expect(isAuthError(new Error("[CONVEX Q(gymSales:listGyms)] Server Error"))).toBe(false);
    expect(isAuthError(new Error("Failed to fetch"))).toBe(false);
  });
});
