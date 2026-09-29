/**
 * أرصدة لوحة المالية من المجاميع اليومية (finAccountDaily) — لا من أسطر القيود.
 *
 * كانت تقرأ كل finJournalLines منذ البداية، فتجاوزت حدود Convex وأسقطت لوحة التحكم
 * على كل الأجهزة (29-9). المجاميع اليومية تُحدَّث عند الترحيل وتُطرح عند العكس
 * (convex/financePost.ts → applyAccountDaily)، فحجم القراءة = أيام × حسابات، ثابت تقريباً.
 * التعريف كما كان: قيود «مرحَّلة» وتاريخها ≤ toDate؛ الفترة من fromDate.
 */
export async function dashboardBalances(ctx: any, fromDate?: string, toDate?: string, lifetimeAccountIds: string[] = []) {
  const period = new Map<string, { debit: number; credit: number }>();
  const lifetime = new Map<string, { debit: number; credit: number }>();
  const add = (map: typeof period, row: any) => {
    const key = String(row.accountId);
    const value = map.get(key) || { debit: 0, credit: 0 };
    value.debit += row.debit || 0;
    value.credit += row.credit || 0;
    map.set(key, value);
  };
  const periodRows = await ctx.db.query("finAccountDaily").withIndex("by_date", (q: any) => {
    const r = q.gte("date", fromDate || "0000-00-00");
    return toDate ? r.lte("date", toDate) : r;
  }).collect();
  for (const row of periodRows) add(period, row);
  for (const accountId of lifetimeAccountIds) {
    const rows = await ctx.db.query("finAccountDaily").withIndex("by_account_date", (q: any) => {
      const r = q.eq("accountId", accountId);
      return toDate ? r.lte("date", toDate) : r;
    }).collect();
    for (const row of rows) add(lifetime, row);
  }
  return { period, lifetime };
}
