import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaff } from "./sessions";
import { isWithinSubscription } from "./lib/subscriptionPeriods";

const OPERATIONAL_STATUSES = new Set([
  "CONFIRMED",
  "PREPARED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
]);

function dateOnly(value: unknown): string {
  return String(value || "").slice(0, 10);
}

function activeItemCount(plan: any): number {
  return (Array.isArray(plan?.items) ? plan.items : []).filter((item: any) => !item?.isOff).length;
}

function customerRunsOnDate(customer: any, date: string): boolean {
  if (!customer) return false;
  const pausedFrom = dateOnly(customer.pausedFrom);
  if (pausedFrom && date >= pausedFrom) return false;
  if (customer.isActive === false && !pausedFrom) return false;
  return isWithinSubscription(customer, date);
}

export const forDate = query({
  args: {
    date: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const date = dateOnly(args.date);
    const [dayPlans, templates] = await Promise.all([
      ctx.db.query("dailyPlans").withIndex("by_date", (q) => q.eq("date", date)).collect(),
      ctx.db.query("customizedTemplates").collect(),
    ]);

    const operational = dayPlans.filter(
      (plan: any) =>
        OPERATIONAL_STATUSES.has(String(plan.status || "").toUpperCase()) &&
        plan.origin !== "CUSTOMIZED",
    );
    const customerIds = new Set<string>();
    for (const plan of operational as any[]) {
      if (plan.customerId) customerIds.add(String(plan.customerId));
    }
    for (const template of templates as any[]) {
      if (template.customerId) customerIds.add(String(template.customerId));
    }

    const customerRows = await Promise.all(
      Array.from(customerIds).map((id) => ctx.db.get(id as any)),
    );
    const customerById = new Map<string, any>();
    for (const customer of customerRows) {
      if (customer) customerById.set(String(customer._id), customer);
    }

    type Issue = {
      code: string;
      severity: "BLOCKER" | "WARNING";
      customerId?: string;
      customerName: string;
      messageAr: string;
      messageEn: string;
      planIds?: string[];
      expected?: number;
      actual?: number;
    };
    const issues: Issue[] = [];

    const plansByCustomer = new Map<string, any[]>();
    for (const plan of operational as any[]) {
      const customerId = String(plan.customerId || "");
      if (!customerId) {
        issues.push({
          code: "MISSING_CUSTOMER",
          severity: "BLOCKER",
          customerName: String(plan.customerName || "Unknown"),
          messageAr: "خطة تشغيلية غير مرتبطة بمشترك",
          messageEn: "Operational plan is not linked to a customer",
          planIds: [String(plan._id)],
        });
        continue;
      }
      const group = plansByCustomer.get(customerId) || [];
      group.push(plan);
      plansByCustomer.set(customerId, group);
    }

    for (const [customerId, plans] of plansByCustomer) {
      const customer = customerById.get(customerId);
      const name = String(customer?.fullName || plans[0]?.customerName || "Unknown");
      if (!customer) {
        issues.push({
          code: "MISSING_CUSTOMER",
          severity: "BLOCKER",
          customerId,
          customerName: name,
          messageAr: "الخطة مرتبطة بمشترك محذوف أو غير موجود",
          messageEn: "Plan is linked to a missing customer",
          planIds: plans.map((p) => String(p._id)),
        });
        continue;
      }

      if (plans.length > 1) {
        issues.push({
          code: "DUPLICATE_PLAN",
          severity: "BLOCKER",
          customerId,
          customerName: name,
          messageAr: `${plans.length} خطط تشغيلية لنفس المشترك في اليوم نفسه`,
          messageEn: `${plans.length} operational plans for the same customer and date`,
          planIds: plans.map((p) => String(p._id)),
        });
      }

      if (!customerRunsOnDate(customer, date)) {
        const pausedFrom = dateOnly(customer.pausedFrom);
        const reasonAr = pausedFrom && date >= pausedFrom
          ? `الاشتراك مجمّد من ${pausedFrom}`
          : customer.isActive === false
            ? "المشترك غير نشط"
            : `التاريخ خارج الاشتراك (${dateOnly(customer.startDate)} إلى ${dateOnly(customer.endDate)})`;
        const reasonEn = pausedFrom && date >= pausedFrom
          ? `Subscription paused from ${pausedFrom}`
          : customer.isActive === false
            ? "Customer is inactive"
            : `Date is outside subscription (${dateOnly(customer.startDate)} to ${dateOnly(customer.endDate)})`;
        issues.push({
          code: "INACTIVE_OR_OUTSIDE_SUBSCRIPTION",
          severity: "BLOCKER",
          customerId,
          customerName: name,
          messageAr: reasonAr,
          messageEn: reasonEn,
          planIds: plans.map((p) => String(p._id)),
        });
      }

      for (const plan of plans) {
        const actual = activeItemCount(plan);
        const expected = Math.max(0, Number(customer.mealsPerDay) || 0)
          + Math.max(0, Number(customer.snacksPerDay) || 0);
        if (actual === 0) {
          issues.push({
            code: "EMPTY_PLAN",
            severity: "BLOCKER",
            customerId,
            customerName: name,
            messageAr: "الخطة مؤكدة ولكن لا تحتوي وجبات",
            messageEn: "Plan is confirmed but contains no meals",
            planIds: [String(plan._id)],
            expected,
            actual,
          });
        } else if (expected > 0 && actual !== expected) {
          issues.push({
            code: "MEAL_COUNT_MISMATCH",
            severity: "BLOCKER",
            customerId,
            customerName: name,
            messageAr: `الخطة تحتوي ${actual} بينما الباقة ${expected}`,
            messageEn: `Plan contains ${actual} items while subscription allows ${expected}`,
            planIds: [String(plan._id)],
            expected,
            actual,
          });
        }
      }
    }

    const templateGroups = new Map<string, any[]>();
    for (const template of templates as any[]) {
      const id = String(template.customerId || "");
      if (!id) continue;
      const group = templateGroups.get(id) || [];
      group.push(template);
      templateGroups.set(id, group);
    }
    for (const [customerId, rows] of templateGroups) {
      const customer = customerById.get(customerId);
      if (rows.length > 1 && customerRunsOnDate(customer, date)) {
        issues.push({
          code: "DUPLICATE_CUSTOM_TEMPLATE",
          severity: "BLOCKER",
          customerId,
          customerName: String(customer?.fullName || "Unknown"),
          messageAr: `${rows.length} قوالب مخصصة لنفس المشترك`,
          messageEn: `${rows.length} customized templates for the same customer`,
        });
      }
    }

    const blockers = issues.filter((issue) => issue.severity === "BLOCKER");
    const byCode: Record<string, number> = {};
    for (const issue of issues) byCode[issue.code] = (byCode[issue.code] || 0) + 1;

    return {
      date,
      canPrint: blockers.length === 0,
      checkedAt: Date.now(),
      operationalPlans: operational.length,
      uniqueCustomers: plansByCustomer.size,
      blockerCount: blockers.length,
      warningCount: issues.length - blockers.length,
      byCode,
      issues,
    };
  },
});
