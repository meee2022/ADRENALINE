import { query } from "./_generated/server";
import { v } from "convex/values";

// ==================================================================
// المالية — المرحلة 4: التقارير المالية (كلها لحظية من دفتر الأستاذ)
//   ميزان مراجعة · قائمة دخل · ميزانية عمومية · دفتر أستاذ · أعمار ديون
// ==================================================================

type Ctx = any;

// تجميع أرصدة الحسابات من الأسطر المُرحَّلة ضمن نطاق تاريخ.
async function accountBalances(ctx: Ctx, fromDate?: string, toDate?: string) {
  const entries = await ctx.db.query("finJournalEntries").collect();
  const posted = new Map<string, any>();
  for (const e of entries) {
    if (e.postingStatus !== "posted") continue;
    if (fromDate && e.entryDate < fromDate) continue;
    if (toDate && e.entryDate > toDate) continue;
    posted.set(String(e._id), e);
  }
  const lines = await ctx.db.query("finJournalLines").collect();
  const bal = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    if (!posted.has(String(l.entryId))) continue;
    const k = String(l.accountId);
    const cur = bal.get(k) || { debit: 0, credit: 0 };
    cur.debit += l.debit || 0;
    cur.credit += l.credit || 0;
    bal.set(k, cur);
  }
  return bal;
}

// ميزان المراجعة — كل حساب بمدينه ودائنه ورصيده الصافي.
export const trialBalance = query({
  args: { fromDate: v.optional(v.string()), toDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const bal = await accountBalances(ctx, args.fromDate, args.toDate);
    const accounts = await ctx.db.query("finAccounts").collect();
    const rows = accounts
      .filter((a: any) => a.isPostable)
      .map((a: any) => {
        const b = bal.get(String(a._id)) || { debit: 0, credit: 0 };
        const net = b.debit - b.credit;
        const isDebitNormal = a.normalBalance === "debit";
        return {
          accountId: a._id, code: a.code, nameAr: a.nameAr, nameEn: a.nameEn,
          accountType: a.accountType,
          debit: b.debit, credit: b.credit,
          balanceDebit: net > 0 ? net : 0,
          balanceCredit: net < 0 ? -net : 0,
          net: isDebitNormal ? net : -net,
        };
      })
      .filter((r: any) => r.debit !== 0 || r.credit !== 0)
      .sort((a: any, b: any) => a.code.localeCompare(b.code));
    const totalDebit = rows.reduce((s: number, r: any) => s + r.balanceDebit, 0);
    const totalCredit = rows.reduce((s: number, r: any) => s + r.balanceCredit, 0);
    return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  },
});

// قائمة الدخل (P&L) — الإيرادات ناقص المصروفات = صافي الربح.
export const incomeStatement = query({
  args: { fromDate: v.optional(v.string()), toDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const bal = await accountBalances(ctx, args.fromDate, args.toDate);
    const accounts = await ctx.db.query("finAccounts").collect();
    const line = (a: any) => {
      const b = bal.get(String(a._id)) || { debit: 0, credit: 0 };
      // الإيراد = دائن-مدين ؛ المصروف = مدين-دائن
      const amt = a.accountType === "revenue" ? b.credit - b.debit : b.debit - b.credit;
      return { code: a.code, nameAr: a.nameAr, nameEn: a.nameEn, subType: a.accountSubType, amount: amt };
    };
    const revenue = accounts.filter((a: any) => a.accountType === "revenue" && a.isPostable).map(line).filter((r: any) => r.amount !== 0);
    const cogs = accounts.filter((a: any) => a.accountType === "expense" && a.isPostable && a.accountSubType && ["cogs", "wastage", "variance"].includes(a.accountSubType)).map(line).filter((r: any) => r.amount !== 0);
    const opex = accounts.filter((a: any) => a.accountType === "expense" && a.isPostable && !(a.accountSubType && ["cogs", "wastage", "variance"].includes(a.accountSubType))).map(line).filter((r: any) => r.amount !== 0);
    const totalRevenue = revenue.reduce((s: number, r: any) => s + r.amount, 0);
    const totalCogs = cogs.reduce((s: number, r: any) => s + r.amount, 0);
    const totalOpex = opex.reduce((s: number, r: any) => s + r.amount, 0);
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalOpex;
    return {
      revenue, cogs, opex,
      totalRevenue, totalCogs, totalOpex,
      grossProfit, netProfit,
      grossMarginPct: totalRevenue ? (grossProfit / totalRevenue) * 100 : 0,
      netMarginPct: totalRevenue ? (netProfit / totalRevenue) * 100 : 0,
    };
  },
});

// الميزانية العمومية — الأصول = الخصوم + حقوق الملكية + صافي الربح.
export const balanceSheet = query({
  args: { asOfDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const bal = await accountBalances(ctx, undefined, args.asOfDate);
    const accounts = await ctx.db.query("finAccounts").collect();
    const val = (a: any) => {
      const b = bal.get(String(a._id)) || { debit: 0, credit: 0 };
      return a.normalBalance === "debit" ? b.debit - b.credit : b.credit - b.debit;
    };
    const group = (type: string) =>
      accounts.filter((a: any) => a.accountType === type && a.isPostable)
        .map((a: any) => ({ code: a.code, nameAr: a.nameAr, nameEn: a.nameEn, amount: val(a) }))
        .filter((r: any) => r.amount !== 0);
    const assets = group("asset");
    const liabilities = group("liability");
    const equity = group("equity");
    // صافي الربح الجاري (إيراد-مصروف) يُضاف لحقوق الملكية
    let rev = 0, exp = 0;
    for (const a of accounts as any[]) {
      if (!a.isPostable) continue;
      const b = bal.get(String(a._id)) || { debit: 0, credit: 0 };
      if (a.accountType === "revenue") rev += b.credit - b.debit;
      if (a.accountType === "expense") exp += b.debit - b.credit;
    }
    const netProfit = rev - exp;
    const totalAssets = assets.reduce((s: number, r: any) => s + r.amount, 0);
    const totalLiabilities = liabilities.reduce((s: number, r: any) => s + r.amount, 0);
    const totalEquity = equity.reduce((s: number, r: any) => s + r.amount, 0) + netProfit;
    return {
      assets, liabilities, equity,
      netProfit,
      totalAssets, totalLiabilities, totalEquity,
      totalLiabAndEquity: totalLiabilities + totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    };
  },
});

// دفتر أستاذ حساب معيّن — الحركات + الرصيد الجاري.
export const generalLedger = query({
  args: { accountId: v.id("finAccounts"), fromDate: v.optional(v.string()), toDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const acc: any = await ctx.db.get(args.accountId);
    if (!acc) return null;
    const allLines = await ctx.db.query("finJournalLines").withIndex("by_account", (q) => q.eq("accountId", args.accountId)).collect();
    const rows: any[] = [];
    for (const l of allLines) {
      const e: any = await ctx.db.get(l.entryId);
      if (!e || e.postingStatus !== "posted") continue;
      if (args.fromDate && e.entryDate < args.fromDate) continue;
      if (args.toDate && e.entryDate > args.toDate) continue;
      rows.push({ date: e.entryDate, entryNumber: e.entryNumber, description: l.description || e.description, debit: l.debit || 0, credit: l.credit || 0 });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.entryNumber.localeCompare(b.entryNumber));
    let running = 0;
    const sign = acc.normalBalance === "debit" ? 1 : -1;
    for (const r of rows) { running += sign * (r.debit - r.credit); r.balance = running; }
    const totDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totCredit = rows.reduce((s, r) => s + r.credit, 0);
    return { account: { code: acc.code, nameAr: acc.nameAr, nameEn: acc.nameEn, normalBalance: acc.normalBalance }, rows, totDebit, totCredit, closingBalance: running };
  },
});

// أعمار الديون (ذمم مدينة/دائنة) حسب الطرف.
export const agedParties = query({
  args: { partyType: v.string() },
  handler: async (ctx, args) => {
    const lines = await ctx.db.query("finJournalLines").collect();
    const map = new Map<string, { debit: number; credit: number }>();
    for (const l of lines) {
      if (l.partyType !== args.partyType || !l.partyId) continue;
      const e: any = await ctx.db.get(l.entryId);
      if (!e || e.postingStatus !== "posted") continue;
      const cur = map.get(l.partyId) || { debit: 0, credit: 0 };
      cur.debit += l.debit || 0; cur.credit += l.credit || 0;
      map.set(l.partyId, cur);
    }
    const rows = [...map.entries()].map(([partyId, b]) => ({ partyId, debit: b.debit, credit: b.credit, balance: b.debit - b.credit }))
      .filter((r) => Math.abs(r.balance) > 0.01);
    return { rows, totalBalance: rows.reduce((s, r) => s + r.balance, 0) };
  },
});

// لوحة مالية مختصرة (KPIs) — للصفحة الرئيسية للمالية.
export const financeDashboard = query({
  args: { fromDate: v.optional(v.string()), toDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const bal = await accountBalances(ctx, args.fromDate, args.toDate);
    const accounts = await ctx.db.query("finAccounts").collect();
    let revenue = 0, expense = 0, cogs = 0, cash = 0, receivable = 0, payable = 0;
    // النقدية/الذمم تُحسب من كل التاريخ حتى toDate (رصيد لحظي)
    const balAll = await accountBalances(ctx, undefined, args.toDate);
    for (const a of accounts as any[]) {
      if (!a.isPostable) continue;
      const b = bal.get(String(a._id)) || { debit: 0, credit: 0 };
      const bAll = balAll.get(String(a._id)) || { debit: 0, credit: 0 };
      if (a.accountType === "revenue") revenue += b.credit - b.debit;
      if (a.accountType === "expense") { expense += b.debit - b.credit; if (["cogs", "wastage", "variance"].includes(a.accountSubType)) cogs += b.debit - b.credit; }
      if (a.operationalType === "cash" || a.operationalType === "bank") cash += bAll.debit - bAll.credit;
      if (a.operationalType === "trade_receivable") receivable += bAll.debit - bAll.credit;
      if (a.operationalType === "trade_payable") payable += bAll.credit - bAll.debit;
    }
    return {
      revenue, expense, cogs, netProfit: revenue - expense,
      grossProfit: revenue - cogs,
      cashOnHand: cash, receivable, payable,
      netMarginPct: revenue ? ((revenue - expense) / revenue) * 100 : 0,
    };
  },
});
