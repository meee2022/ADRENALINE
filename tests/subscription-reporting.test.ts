import { describe, expect, it } from "vitest";
import { qatarReportingDate, subscriptionReportingState } from "../client/src/lib/subscriptionReporting";

const today = "2026-10-08";
const customer = { isActive: true, startDate: "2026-10-01", endDate: "2026-10-31" };
describe("read-only subscriber metrics", () => {
  it("includes both boundaries, including the last subscription day", () => {
    expect(subscriptionReportingState(customer, customer.startDate)).toBe("current");
    expect(subscriptionReportingState(customer, customer.endDate)).toBe("current");
  });
  it("does not count an enabled but expired account as current", () => {
    expect(subscriptionReportingState({ ...customer, endDate: "2026-10-07" }, today)).toBe("expired");
  });
  it("excludes future starts, paused and disabled accounts", () => {
    expect(subscriptionReportingState({ ...customer, startDate: "2026-10-09" }, today)).toBe("upcoming");
    expect(subscriptionReportingState({ ...customer, pausedFrom: today }, today)).toBe("paused");
    expect(subscriptionReportingState({ ...customer, isActive: false }, today)).toBe("inactive");
  });
  it("counts the ongoing previous period when a renewal starts later, once per subscriber", () => {
    expect(subscriptionReportingState({ ...customer, startDate: "2026-11-01", endDate: "2026-11-30", subscriptionHistory: [customer] }, today)).toBe("current");
    expect(subscriptionReportingState({ ...customer, startDate: "2026-11-01", endDate: "2026-11-30", subscriptionHistory: [{ startDate: "2026-09-01", endDate: "2026-09-30" }] }, today)).toBe("upcoming");
  });
  it("does not guess with missing, impossible or reversed dates", () => {
    for (const invalid of [{}, { startDate: today }, { startDate: "2026-02-30", endDate: "2026-10-31" }, { startDate: "2026-10-31", endDate: today }]) {
      expect(subscriptionReportingState({ isActive: true, ...invalid }, today)).toBe("unknown");
    }
  });
  it("uses Qatar midnight even when the viewer is in another timezone", () => {
    expect(qatarReportingDate(Date.parse("2026-10-07T20:59:59Z"))).toBe("2026-10-07");
    expect(qatarReportingDate(Date.parse("2026-10-07T21:00:00Z"))).toBe(today);
  });
  it("never mutates dates, history, activation, restrictions or daily plans", () => {
    const value = { ...customer, subscriptionHistory: [{ ...customer }], allergies: "nuts", avoid: ["milk"], dailyPlans: [{ status: "CONFIRMED", meals: ["meal1"] }] };
    const before = JSON.stringify(value);
    subscriptionReportingState(value, today);
    expect(JSON.stringify(value)).toBe(before);
  });
});
