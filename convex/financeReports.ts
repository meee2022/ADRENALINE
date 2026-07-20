import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRoleOrPermission } from "./sessions";

const requireFinance = (ctx: any, token?: string) => requireRoleOrPermission(ctx, token, {
  roles: ["ACCOUNTANT", "FINANCE_MANAGER"], permissions: ["/finance"],
});

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
  args: { fromDate: v.optional(v.string()), toDate: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
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
  args: { fromDate: v.optional(v.string()), toDate: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
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
  args: { asOfDate: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
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
  args: { accountId: v.id("finAccounts"), fromDate: v.optional(v.string()), toDate: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
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
  args: { partyType: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
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
  args: { fromDate: v.optional(v.string()), toDate: v.optional(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
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

/** Cash and bank movement with opening/closing balances and source breakdown. */
export const cashFlow = query({
  args: { fromDate: v.string(), toDate: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
    const accounts = (await ctx.db.query("finAccounts").collect()).filter((a: any) => a.isPostable && ["cash", "bank"].includes(a.operationalType));
    const ids = new Set(accounts.map((a: any) => String(a._id)));
    const entries = await ctx.db.query("finJournalEntries").collect();
    const entryMap = new Map(entries.map((e: any) => [String(e._id), e]));
    const lines = await ctx.db.query("finJournalLines").collect();
    let opening = 0, inflows = 0, outflows = 0;
    const bySource = new Map<string, { inflow: number; outflow: number }>();
    for (const line of lines as any[]) {
      if (!ids.has(String(line.accountId))) continue;
      const entry: any = entryMap.get(String(line.entryId));
      if (!entry || entry.postingStatus !== "posted" || entry.entryDate > args.toDate) continue;
      const net = Number(line.debit || 0) - Number(line.credit || 0);
      if (entry.entryDate < args.fromDate) { opening += net; continue; }
      if (net >= 0) inflows += net; else outflows += -net;
      const key = String(entry.sourceType || entry.journalType || "manual");
      const row = bySource.get(key) || { inflow: 0, outflow: 0 };
      if (net >= 0) row.inflow += net; else row.outflow += -net;
      bySource.set(key, row);
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      openingBalance: round(opening), inflows: round(inflows), outflows: round(outflows),
      netChange: round(inflows - outflows), closingBalance: round(opening + inflows - outflows),
      bySource: [...bySource.entries()].map(([source, values]) => ({ source, inflow: round(values.inflow), outflow: round(values.outflow), net: round(values.inflow - values.outflow) })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    };
  },
});

/** Operational profitability by sales channel, based only on posted accounting entries. */
export const channelProfitability = query({
  args: { fromDate: v.string(), toDate: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
    const entries = (await ctx.db.query("finJournalEntries").collect()).filter((e: any) => e.postingStatus === "posted" && e.entryDate >= args.fromDate && e.entryDate <= args.toDate);
    const rows = new Map<string, { channel: string; revenue: number; returns: number; expenses: number; transactions: number }>();
    const accounts = await ctx.db.query("finAccounts").collect();
    const accountMap = new Map(accounts.map((a: any) => [String(a._id), a]));
    for (const entry of entries as any[]) {
      const channel = entry.sourceType === "posTicket" ? "pos" : entry.sourceType === "gymOrder" || entry.sourceType === "gymReturn" ? "outlets" : entry.sourceType === "inventoryReceipt" ? "purchases" : "other";
      const row = rows.get(channel) || { channel, revenue: 0, returns: 0, expenses: 0, transactions: 0 };
      const lines = await ctx.db.query("finJournalLines").withIndex("by_entry", (q: any) => q.eq("entryId", entry._id)).collect();
      for (const line of lines as any[]) {
        const account: any = accountMap.get(String(line.accountId));
        if (!account) continue;
        const amount = Number(line.credit || 0) - Number(line.debit || 0);
        if (account.accountSubType === "contra_revenue") row.returns += -amount;
        else if (account.accountType === "revenue") row.revenue += amount;
        else if (account.accountType === "expense") row.expenses += -amount;
      }
      row.transactions += 1;
      rows.set(channel, row);
    }
    return [...rows.values()].map((r) => ({ ...r, net: r.revenue - r.returns - r.expenses })).sort((a, b) => b.net - a.net);
  },
});

/** Item and raw-material performance for kitchen purchasing and menu decisions. */
export const itemAndMaterialPerformance = query({
  args: { fromDate: v.string(), toDate: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
    const startMs = new Date(`${args.fromDate}T00:00:00`).getTime();
    const endMs = new Date(`${args.toDate}T23:59:59.999`).getTime();
    const meals = await ctx.db.query("publicMeals").collect();
    const mealMap = new Map(meals.map((m: any) => [String(m._id), m]));
    const itemMap = new Map<string, any>();
    const add = (key: string, nameAr: string, nameEn: string, qty: number, revenue: number, returned: number, estimatedCost: number, hasCost: boolean) => {
      const row = itemMap.get(key) || { key, nameAr, nameEn, soldQty: 0, returnedQty: 0, revenue: 0, estimatedCost: 0, missingCost: false };
      row.soldQty += qty; row.returnedQty += returned; row.revenue += revenue; row.estimatedCost += estimatedCost;
      if (!hasCost) row.missingCost = true;
      itemMap.set(key, row);
    };
    const tickets = await ctx.db.query("posTickets").collect();
    for (const ticket of tickets as any[]) {
      const at = Number(ticket.paidAt || ticket.createdAt || 0);
      if (ticket.status !== "PAID" || ticket.isNonRevenue || at < startMs || at > endMs) continue;
      const lines = await ctx.db.query("posTicketLines").withIndex("by_ticket", (q: any) => q.eq("ticketId", ticket._id)).collect();
      for (const line of lines as any[]) {
        const meal: any = line.mealId ? mealMap.get(String(line.mealId)) : null;
        add(String(line.mealId || line.name), meal?.nameAr || line.name, meal?.nameEn || line.name, Number(line.qty), Number(line.lineTotal), 0, Number(meal?.costQAR || 0) * Number(line.qty), meal?.costQAR != null);
      }
    }
    const gymOrders = await ctx.db.query("gymOrders").collect();
    const validOrders = new Set(gymOrders.filter((o: any) => !o.isVoid && o.date >= args.fromDate && o.date <= args.toDate).map((o: any) => String(o._id)));
    const gymLines = await ctx.db.query("gymOrderLines").collect();
    for (const line of gymLines as any[]) {
      if (!validOrders.has(String(line.orderId))) continue;
      const meal: any = line.mealId ? mealMap.get(String(line.mealId)) : null;
      const returned = Number(line.returnedQty || 0);
      const sold = Math.max(0, Number(line.qty) - returned);
      add(String(line.mealId || line.mealNameEn), line.mealNameAr || meal?.nameAr || "", line.mealNameEn || meal?.nameEn || "", sold, sold * Number(line.unitPrice || 0), returned, Number(meal?.costQAR || 0) * Number(line.qty), meal?.costQAR != null);
    }
    const menuItems = [...itemMap.values()].map((r: any) => ({
      ...r, grossProfit: r.revenue - r.estimatedCost,
      marginPct: r.missingCost || !r.revenue ? null : Math.round(((r.revenue - r.estimatedCost) / r.revenue) * 1000) / 10,
      returnRate: r.soldQty + r.returnedQty ? Math.round((r.returnedQty / (r.soldQty + r.returnedQty)) * 1000) / 10 : 0,
    })).sort((a: any, b: any) => b.revenue - a.revenue);

    const inventoryItems = await ctx.db.query("inventoryItems").collect();
    const invMap = new Map(inventoryItems.map((i: any) => [String(i._id), i]));
    const materialMap = new Map<string, any>();
    const movements = await ctx.db.query("inventoryMovements").collect();
    for (const mv of movements as any[]) {
      if (mv.createdAt < startMs || mv.createdAt > endMs || mv.type === "receive") continue;
      const item: any = invMap.get(String(mv.itemId));
      if (!item) continue;
      const key = String(mv.itemId);
      const row = materialMap.get(key) || { itemId: key, nameAr: item.nameAr, nameEn: item.nameEn, unit: item.unit, consumedQty: 0, wasteQty: 0, consumedValue: 0, wasteValue: 0 };
      const qty = Math.abs(Number(mv.quantity || 0));
      const value = qty * Number(mv.unitCost || 0);
      const isWaste = /waste|expired|spoil|هدر|تالف|منتهي/i.test(String(mv.note || ""));
      if (isWaste) { row.wasteQty += qty; row.wasteValue += value; }
      else { row.consumedQty += qty; row.consumedValue += value; }
      materialMap.set(key, row);
    }
    const materials = [...materialMap.values()].map((r: any) => ({ ...r, wasteRate: r.consumedQty + r.wasteQty ? Math.round((r.wasteQty / (r.consumedQty + r.wasteQty)) * 1000) / 10 : 0 })).sort((a: any, b: any) => b.wasteValue - a.wasteValue);
    return { menuItems, materials };
  },
});
