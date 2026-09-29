/**
 * تعبئة finJournalLines.entryDate للأسطر القديمة (من CLI على دفعات).
 * node scripts/convex-prod.mjs run finBackfill:lineDates '{"cursor":null}' ثم كرّر بالـcursor المُعاد حتى isDone.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const lineDates = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("finJournalLines").paginate({ cursor: args.cursor, numItems: 1500 });
    const dates = new Map<string, string | null>();
    let patched = 0;
    for (const l of page.page as any[]) {
      if (l.entryDate) continue;
      const k = String(l.entryId);
      if (!dates.has(k)) dates.set(k, ((await ctx.db.get(l.entryId)) as any)?.entryDate ?? null);
      const d = dates.get(k);
      if (d) { await ctx.db.patch(l._id, { entryDate: d }); patched++; }
    }
    return { patched, scanned: page.page.length, cursor: page.continueCursor, isDone: page.isDone };
  },
});

/** يمسح finAccountDaily على دفعات (تمهيداً لإعادة البناء). */
export const clearDaily = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("finAccountDaily").take(3000);
    for (const r of rows) await ctx.db.delete(r._id);
    return { deleted: rows.length, isDone: rows.length < 3000 };
  },
});

/**
 * يبني finAccountDaily من القيود المرحَّلة (نفس تعريف «مرحَّل» في التقارير).
 * until = لحظة بدء البناء: القيود الأحدث أضافها الترحيل الحيّ بنفسه فلا تُعدّ مرتين.
 */
export const rebuildDaily = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), until: v.number() },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("finJournalEntries")
      .withIndex("by_status", (q) => q.eq("postingStatus", "posted"))
      .paginate({ cursor: args.cursor, numItems: 250 });
    const sums = new Map<string, { accountId: any; date: string; debit: number; credit: number }>();
    for (const e of page.page as any[]) {
      if (e._creationTime > args.until) continue;
      const lines = await ctx.db.query("finJournalLines").withIndex("by_entry", (q) => q.eq("entryId", e._id)).collect();
      for (const l of lines as any[]) {
        const k = `${l.accountId}|${e.entryDate}`;
        const x = sums.get(k) || { accountId: l.accountId, date: e.entryDate, debit: 0, credit: 0 };
        x.debit += Number(l.debit || 0); x.credit += Number(l.credit || 0);
        sums.set(k, x);
      }
    }
    for (const x of sums.values()) {
      const row: any = await ctx.db.query("finAccountDaily")
        .withIndex("by_account_date", (q) => q.eq("accountId", x.accountId).eq("date", x.date)).first();
      const debit = Math.round(((row?.debit || 0) + x.debit) * 100) / 100;
      const credit = Math.round(((row?.credit || 0) + x.credit) * 100) / 100;
      if (row) await ctx.db.patch(row._id, { debit, credit });
      else await ctx.db.insert("finAccountDaily", { accountId: x.accountId, date: x.date, debit, credit });
    }
    return { entries: page.page.length, cursor: page.continueCursor, isDone: page.isDone };
  },
});
