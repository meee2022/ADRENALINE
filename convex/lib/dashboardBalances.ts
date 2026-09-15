/** Read each ledger table once; derive period and lifetime balances together. */
export async function dashboardBalances(ctx: any, fromDate?: string, toDate?: string) {
  const entries = await ctx.db.query("finJournalEntries")
    .withIndex("by_status", (q: any) => q.eq("postingStatus", "posted")).collect();
  const dates = new Map<string, string>();
  for (const entry of entries) {
    if (!toDate || entry.entryDate <= toDate) dates.set(String(entry._id), entry.entryDate);
  }
  const lines = await ctx.db.query("finJournalLines").collect();
  const period = new Map<string, { debit: number; credit: number }>();
  const lifetime = new Map<string, { debit: number; credit: number }>();
  const add = (map: typeof period, line: any) => {
    const key = String(line.accountId);
    const value = map.get(key) || { debit: 0, credit: 0 };
    value.debit += line.debit || 0;
    value.credit += line.credit || 0;
    map.set(key, value);
  };
  for (const line of lines) {
    const date = dates.get(String(line.entryId));
    if (date === undefined) continue;
    add(lifetime, line);
    if (!fromDate || date >= fromDate) add(period, line);
  }
  return { period, lifetime };
}
