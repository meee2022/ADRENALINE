import { mutation, query } from "./_generated/server";
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
  const skippedDates: string[] = Array.isArray(customer.skippedDates) ? customer.skippedDates : [];
  if (skippedDates.some((skippedDate: unknown) => dateOnly(skippedDate) === date)) return false;
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
    const [dayPlans, templates, boxNumbers] = await Promise.all([
      ctx.db.query("dailyPlans").withIndex("by_date", (q) => q.eq("date", date)).collect(),
      ctx.db.query("customizedTemplates").collect(),
      ctx.db.query("stickerBoxNumbers").withIndex("by_date", (q) => q.eq("date", date)).collect(),
    ]);

    const operational = dayPlans.filter(
      (plan: any) =>
        OPERATIONAL_STATUSES.has(String(plan.status || "").toUpperCase()) &&
        plan.origin !== "CUSTOMIZED",
    );
    const pausedPlans = dayPlans.filter(
      (plan: any) =>
        String(plan.status || "").toUpperCase() === "PAUSED" &&
        plan.origin !== "CUSTOMIZED",
    );
    const customerIds = new Set<string>();
    for (const plan of operational as any[]) {
      if (plan.customerId) customerIds.add(String(plan.customerId));
    }
    for (const plan of pausedPlans as any[]) {
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

    // الخطة PAUSED تكون صحيحة فقط إذا كان اليوم نفسه مجمّدًا/متخطًى أو خارج الاشتراك.
    // إذا كان العميل نشطًا واليوم صالحًا فهي خطة "مدفونة": لا تظهر للمطبخ ولا كان
    // التدقيق القديم يراها لأنه كان يبدأ من الحالات التشغيلية فقط.
    for (const plan of pausedPlans as any[]) {
      const customerId = String(plan.customerId || "");
      const customer = customerById.get(customerId);
      if (customer && customerRunsOnDate(customer, date)) {
        issues.push({
          code: "ORPHANED_PAUSED_PLAN",
          severity: "BLOCKER",
          customerId,
          customerName: String(customer.fullName || plan.customerName || "Unknown"),
          messageAr: "الخطة مدفونة بحالة PAUSED رغم أن الاشتراك نشط واليوم صالح — اضغط الإصلاح الآمن لإعادتها",
          messageEn: "Plan is hidden as PAUSED although the subscription is active for this date",
          planIds: [String(plan._id)],
        });
      }
    }

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

      for (const plan of plans) {
        const planShift = String(plan.deliveryTime || "").toUpperCase();
        const customerShift = String(customer.deliveryTime || "").toUpperCase();
        if (planShift && customerShift && planShift !== customerShift) {
          issues.push({
            code: "DELIVERY_SHIFT_MISMATCH",
            severity: "BLOCKER",
            customerId,
            customerName: name,
            messageAr: `وردية الخطة ${planShift} بينما وردية المشترك ${customerShift}`,
            messageEn: `Plan shift is ${planShift} while customer shift is ${customerShift}`,
            planIds: [String(plan._id)],
          });
        }

        const items = (Array.isArray(plan.items) ? plan.items : []).filter((item: any) => !item?.isOff);
        const slotIds = items.map((item: any) => String(item?.id || "")).filter(Boolean);
        const duplicateSlotIds = slotIds.filter((id: string, index: number) => slotIds.indexOf(id) !== index);
        if (duplicateSlotIds.length) {
          issues.push({
            code: "DUPLICATE_MEAL_SLOT",
            severity: "BLOCKER",
            customerId,
            customerName: name,
            messageAr: "نفس خانة الوجبة مكررة داخل الخطة",
            messageEn: "The same meal slot is duplicated inside the plan",
            planIds: [String(plan._id)],
          });
        }

        const mainMealKeys = items
          .filter((item: any) => {
            const category = String(item?.category || item?.categoryName || "").toUpperCase();
            return !category.includes("SNACK") && !category.includes("SALAD");
          })
          .map((item: any) => String(item?.publicMealId || item?.mealId || item?.menuItemId || ""))
          .filter(Boolean);
        const repeatedMain = mainMealKeys.filter(
          (key: string, index: number) => mainMealKeys.indexOf(key) !== index,
        );
        if (repeatedMain.length) {
          issues.push({
            code: "REPEATED_MAIN_MEAL",
            severity: "WARNING",
            customerId,
            customerName: name,
            messageAr: "نفس الوجبة الرئيسية مختارة أكثر من مرة داخل خطة اليوم",
            messageEn: "The same main meal is selected more than once in the daily plan",
            planIds: [String(plan._id)],
          });
        }
      }

      /* التجديد ينقل startDate/endDate إلى الفترة الجديدة ويحفظ القديمة في
         subscriptionHistory. الخطة قد تكون صحيحة بسبب الفترة السابقة، لكن من
         دون إظهار ذلك تبدو للأخصائية كخطة زائدة ويختلف العد بين الشاشات. */
      const currentStart = dateOnly(customer.startDate);
      const currentEnd = dateOnly(customer.endDate);
      const inCurrentPeriod = !!(
        currentStart && currentEnd && date >= currentStart && date <= currentEnd
      );
      const matchingHistory = (Array.isArray(customer.subscriptionHistory)
        ? customer.subscriptionHistory
        : []).find((period: any) => {
          const start = dateOnly(period?.startDate);
          const end = dateOnly(period?.endDate);
          return start && end && date >= start && date <= end;
        });
      if (!inCurrentPeriod && matchingHistory) {
        const historyStart = dateOnly(matchingHistory.startDate);
        const historyEnd = dateOnly(matchingHistory.endDate);
        issues.push({
          code: "PLAN_IN_RENEWAL_HISTORY",
          severity: "WARNING",
          customerId,
          customerName: name,
          messageAr: `الخطة صحيحة ضمن فترة سابقة محفوظة بعد التجديد (${historyStart} إلى ${historyEnd})، والفترة الحالية ${currentStart} إلى ${currentEnd}`,
          messageEn: `Valid plan from a previous subscription period (${historyStart} to ${historyEnd}); current period is ${currentStart} to ${currentEnd}`,
          planIds: plans.map((p) => String(p._id)),
        });
      }

      if (!customerRunsOnDate(customer, date)) {
        const pausedFrom = dateOnly(customer.pausedFrom);
        const skippedDates: string[] = Array.isArray(customer.skippedDates) ? customer.skippedDates : [];
        const isSkipped = skippedDates.some((skippedDate: unknown) => dateOnly(skippedDate) === date);
        const reasonAr = isSkipped
          ? `المشترك متخطٍ يوم ${date}`
          : pausedFrom && date >= pausedFrom
          ? `الاشتراك مجمّد من ${pausedFrom}`
          : customer.isActive === false
            ? "المشترك غير نشط"
            : `التاريخ خارج الاشتراك (${dateOnly(customer.startDate)} إلى ${dateOnly(customer.endDate)})`;
        const reasonEn = isSkipped
          ? `Customer skipped ${date}`
          : pausedFrom && date >= pausedFrom
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

    const rosterByName = new Map<string, Array<{ id: string; name: string }>>();
    const rosterIds = new Set<string>(plansByCustomer.keys());
    for (const [customerId] of templateGroups) {
      const customer = customerById.get(customerId);
      if (customerRunsOnDate(customer, date)) rosterIds.add(customerId);
    }
    for (const customerId of rosterIds) {
      const customer = customerById.get(customerId);
      if (!customer) continue;
      const normalizedName = String(customer.fullName || "")
        .trim()
        .toLocaleUpperCase()
        .replace(/\s+/g, " ");
      if (!normalizedName) continue;
      const rows = rosterByName.get(normalizedName) || [];
      rows.push({ id: customerId, name: String(customer.fullName) });
      rosterByName.set(normalizedName, rows);
    }
    for (const rows of rosterByName.values()) {
      const uniqueIds = new Set(rows.map((row) => row.id));
      if (uniqueIds.size > 1) {
        issues.push({
          code: "DUPLICATE_ROSTER_NAME",
          severity: "BLOCKER",
          customerName: rows[0].name,
          messageAr: `الاسم نفسه يظهر لـ ${uniqueIds.size} مشتركين مختلفين في كشف اليوم`,
          messageEn: `The same name belongs to ${uniqueIds.size} different customers in today's roster`,
        });
      }
    }
    const rosterByPhone = new Map<string, Array<{ id: string; name: string }>>();
    for (const customerId of rosterIds) {
      const customer = customerById.get(customerId);
      if (!customer?.phone) continue;
      const phone = String(customer.phone).replace(/\D/g, "");
      if (!phone) continue;
      const rows = rosterByPhone.get(phone) || [];
      rows.push({ id: customerId, name: String(customer.fullName || "Unknown") });
      rosterByPhone.set(phone, rows);
    }
    for (const rows of rosterByPhone.values()) {
      if (new Set(rows.map((row) => row.id)).size <= 1) continue;
      issues.push({
        code: "SHARED_PHONE_NUMBER",
        severity: "WARNING",
        customerName: rows.map((row) => row.name).join(" / "),
        messageAr: "رقم الهاتف نفسه مرتبط بأكثر من مشترك في كشف اليوم؛ تأكدي من اختيار الحساب الصحيح",
        messageEn: "The same phone number belongs to multiple customers in today's roster; verify the selected account",
      });
    }

    const boxByCustomer = new Map<string, any[]>();
    const boxByNumber = new Map<number, any[]>();
    for (const row of boxNumbers as any[]) {
      const customerRows = boxByCustomer.get(String(row.customerId)) || [];
      customerRows.push(row);
      boxByCustomer.set(String(row.customerId), customerRows);
      const numberRows = boxByNumber.get(Number(row.boxNo)) || [];
      numberRows.push(row);
      boxByNumber.set(Number(row.boxNo), numberRows);
    }
    for (const [customerId, rows] of boxByCustomer) {
      if (rows.length <= 1) continue;
      const customer = customerById.get(customerId);
      issues.push({
        code: "DUPLICATE_BOX_STICKER_NUMBER",
        severity: "BLOCKER",
        customerId,
        customerName: String(customer?.fullName || "Unknown"),
        messageAr: `${rows.length} أرقام بوكس محفوظة لنفس المشترك في اليوم نفسه`,
        messageEn: `${rows.length} saved box numbers for the same customer and date`,
      });
    }
    for (const [boxNo, rows] of boxByNumber) {
      if (rows.length <= 1) continue;
      issues.push({
        code: "DUPLICATE_BOX_NUMBER",
        severity: "BLOCKER",
        customerName: `Box #${boxNo}`,
        messageAr: `رقم البوكس ${boxNo} مخصص لأكثر من مشترك`,
        messageEn: `Box number ${boxNo} is assigned to more than one customer`,
      });
    }

    const blockers = issues.filter((issue) => issue.severity === "BLOCKER");
    const byCode: Record<string, number> = {};
    for (const issue of issues) byCode[issue.code] = (byCode[issue.code] || 0) + 1;
    const statusCounts: Record<string, number> = {};
    for (const plan of operational as any[]) {
      const status = String(plan.status || "UNKNOWN").toUpperCase();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    return {
      date,
      canPrint: blockers.length === 0,
      checkedAt: Date.now(),
      operationalPlans: operational.length,
      uniqueCustomers: plansByCustomer.size,
      blockerCount: blockers.length,
      warningCount: issues.length - blockers.length,
      statusCounts,
      plannedMealItems: operational.reduce((sum: number, plan: any) => sum + activeItemCount(plan), 0),
      byCode,
      issues,
    };
  },
});

/**
 * إصلاحات آمنة وقابلة للمراجعة:
 * لا تُحذف الخطط ولا تُعدّل خطة سبق تحضيرها. النسخ الزائدة تُلغى، والخطط
 * غير الصالحة تُوقف، واختلاف العدد يعيدها لمسودة كي تصححها الأخصائية.
 */
export const repairDate = mutation({
  args: {
    date: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const staff: any = await requireStaff(ctx, args.sessionToken);
    const date = dateOnly(args.date);
    const plans = await ctx.db.query("dailyPlans").withIndex("by_date", (q) => q.eq("date", date)).collect();
    const regular = plans.filter((plan: any) =>
      plan.origin !== "CUSTOMIZED" &&
      ["DRAFT", "CONFIRMED", "PAUSED"].includes(String(plan.status || "").toUpperCase()));
    const ids = Array.from(new Set(regular.map((plan: any) => String(plan.customerId || "")).filter(Boolean)));
    const customers = await Promise.all(ids.map((id) => ctx.db.get(id as any)));
    const customerById = new Map(customers.filter(Boolean).map((customer: any) => [String(customer._id), customer]));

    let duplicatesCancelled = 0;
    let plansPaused = 0;
    let plansRestored = 0;
    let plansReturnedToDraft = 0;
    let shiftsUpdated = 0;
    let duplicateBoxRowsRemoved = 0;

    const groups = new Map<string, any[]>();
    for (const plan of regular as any[]) {
      const id = String(plan.customerId || "");
      if (!id) continue;
      const rows = groups.get(id) || [];
      rows.push(plan);
      groups.set(id, rows);
    }

    for (const [customerId, rows] of groups) {
      const customer: any = customerById.get(customerId);
      const ordered = [...rows].sort((a: any, b: any) =>
        Number(b.updatedAt || b.createdAt || b._creationTime || 0)
        - Number(a.updatedAt || a.createdAt || a._creationTime || 0));
      const keep = ordered[0];
      for (const duplicate of ordered.slice(1)) {
        if (String(duplicate.status).toUpperCase() === "CONFIRMED") {
          await ctx.db.patch(duplicate._id, {
            status: "CANCELLED",
            notes: [duplicate.notes, `Auto-cancelled duplicate on ${Date.now()}`].filter(Boolean).join(" | "),
            updatedAt: Date.now(),
          });
          duplicatesCancelled++;
        }
      }
      if (!customer) continue;
      const keepStatus = String(keep.status).toUpperCase();
      if (!customerRunsOnDate(customer, date)) {
        if (keepStatus !== "PAUSED") {
          await ctx.db.patch(keep._id, { status: "PAUSED", updatedAt: Date.now() });
          plansPaused++;
        }
        continue;
      }
      const expected = Math.max(0, Number(customer.mealsPerDay) || 0)
        + Math.max(0, Number(customer.snacksPerDay) || 0);
      const actual = activeItemCount(keep);
      const patch: any = { updatedAt: Date.now() };
      let changed = false;
      if (keepStatus === "PAUSED") {
        let previousStatus = "";
        try {
          const parsed = keep.notes ? JSON.parse(keep.notes) : null;
          previousStatus = String(parsed?.pausedPrevStatus || "").toUpperCase();
        } catch { /* الملاحظات العادية لا تمنع الإصلاح */ }
        patch.status = ["DRAFT", "CONFIRMED"].includes(previousStatus)
          ? previousStatus
          : expected > 0 && actual === expected
            ? "CONFIRMED"
            : "DRAFT";
        if (patch.status === "CONFIRMED") plansRestored++;
        else plansReturnedToDraft++;
        changed = true;
      } else if (keepStatus !== "CONFIRMED") {
        continue;
      }
      if (customer.deliveryTime && keep.deliveryTime !== customer.deliveryTime) {
        patch.deliveryTime = customer.deliveryTime;
        shiftsUpdated++;
        changed = true;
      }
      if (actual === 0 || (expected > 0 && actual !== expected)) {
        patch.status = "DRAFT";
        plansReturnedToDraft++;
        changed = true;
      }
      if (changed) await ctx.db.patch(keep._id, patch);
    }

    const boxRows = await ctx.db.query("stickerBoxNumbers").withIndex("by_date", (q) => q.eq("date", date)).collect();
    const seenCustomers = new Set<string>();
    const seenNumbers = new Set<number>();
    for (const row of [...boxRows].sort((a: any, b: any) => Number(a.createdAt || a._creationTime) - Number(b.createdAt || b._creationTime)) as any[]) {
      const customerKey = String(row.customerId);
      const numberKey = Number(row.boxNo);
      if (seenCustomers.has(customerKey) || seenNumbers.has(numberKey)) {
        await ctx.db.delete(row._id);
        duplicateBoxRowsRemoved++;
        continue;
      }
      seenCustomers.add(customerKey);
      seenNumbers.add(numberKey);
    }

    await ctx.db.insert("auditLog", {
      actorUserId: staff?.userId,
      actorName: staff?.name || staff?.username || "Staff",
      actorRole: staff?.role,
      action: "PRODUCTION_AUDIT_REPAIR",
      entityType: "dailyPlans",
      entityId: date,
      details: JSON.stringify({
        duplicatesCancelled,
        plansPaused,
        plansRestored,
        plansReturnedToDraft,
        shiftsUpdated,
        duplicateBoxRowsRemoved,
      }),
      createdAt: Date.now(),
    });

    return {
      duplicatesCancelled,
      plansPaused,
      plansRestored,
      plansReturnedToDraft,
      shiftsUpdated,
      duplicateBoxRowsRemoved,
    };
  },
});

/** إصلاح موجّه لمشترك واحد؛ مفيد من رابط الخطأ ولا يلمس بقية كشف اليوم. */
export const restoreActiveCustomerPausedPlans = mutation({
  args: {
    customerId: v.id("customers"),
    fromDate: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const staff: any = await requireStaff(ctx, args.sessionToken);
    const customer: any = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("المشترك غير موجود");

    const plans = await ctx.db
      .query("dailyPlans")
      .withIndex("by_customerId", (q) => q.eq("customerId", args.customerId))
      .collect();
    let restoredConfirmed = 0;
    let restoredDraft = 0;
    for (const plan of plans as any[]) {
      const date = dateOnly(plan.date);
      if (
        date < dateOnly(args.fromDate) ||
        String(plan.status || "").toUpperCase() !== "PAUSED" ||
        !customerRunsOnDate(customer, date)
      ) continue;

      const expected = Math.max(0, Number(customer.mealsPerDay) || 0)
        + Math.max(0, Number(customer.snacksPerDay) || 0);
      const actual = activeItemCount(plan);
      let target = expected > 0 && actual === expected ? "CONFIRMED" : "DRAFT";
      let notes = plan.notes;
      try {
        const parsed = plan.notes ? JSON.parse(plan.notes) : null;
        if (["DRAFT", "CONFIRMED"].includes(String(parsed?.pausedPrevStatus || "").toUpperCase())) {
          target = String(parsed.pausedPrevStatus).toUpperCase();
        }
        notes = parsed?.prevNotes || undefined;
      } catch { /* ملاحظات نصية عادية */ }
      await ctx.db.patch(plan._id, {
        status: target,
        notes,
        deliveryTime: customer.deliveryTime || plan.deliveryTime,
        updatedAt: Date.now(),
      });
      if (target === "CONFIRMED") restoredConfirmed++;
      else restoredDraft++;
    }

    await ctx.db.insert("auditLog", {
      actorUserId: staff?.userId,
      actorName: staff?.name || staff?.username || "Staff",
      actorRole: staff?.role,
      action: "RESTORE_ORPHANED_PAUSED_PLANS",
      entityType: "customers",
      entityId: String(args.customerId),
      details: JSON.stringify({ fromDate: dateOnly(args.fromDate), restoredConfirmed, restoredDraft }),
      createdAt: Date.now(),
    });
    return { restoredConfirmed, restoredDraft };
  },
});
