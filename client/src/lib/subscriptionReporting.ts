/** Read-only reporting classification. Never use this to authorize or schedule meals. */
export type ReportingCustomer = {
  isActive?: boolean;
  pausedFrom?: string | null;
  startDate?: string;
  endDate?: string;
  subscriptionHistory?: Array<{ startDate?: string; endDate?: string }>;
};

export function qatarReportingDate(now = Date.now()): string {
  return new Date(now + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function reportingPeriods(customer: ReportingCustomer) {
  // A renewal can start in the future while the previous period still covers today.
  return [customer, ...(customer.subscriptionHistory ?? [])].filter(
    (period): period is { startDate: string; endDate: string } =>
      validDate(period.startDate) && validDate(period.endDate) && period.endDate >= period.startDate,
  );
}

export function subscriptionReportingState(customer: ReportingCustomer, today: string) {
  const periods = reportingPeriods(customer);
  if (!validDate(today) || !periods.length) return "unknown";
  const coversToday = periods.some((p) => p.startDate <= today && p.endDate >= today);
  if (!coversToday) return periods.some((p) => p.startDate > today) ? "upcoming" : "expired";
  if (customer.pausedFrom) return "paused";
  if (!customer.isActive) return "inactive";
  return "current";
}
