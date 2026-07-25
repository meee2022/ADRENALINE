// convex/pettyCash.ts
/**
 * العُهد النقدية: الموظف يأخذ سلفة، يصرف منها بنزين/تصليح/نثريات، ثم يُسوّى.
 * كل حركة تُرحَّل قيداً مزدوجاً على «عُهد نقدية لدى الموظفين» (1115):
 *   صرف سلفة : من 1115 عهدة الموظف   إلى 1110 الصندوق
 *   مصروف     : من 6xxx حساب المصروف  إلى 1115 عهدة الموظف
 *   إرجاع      : من 1110 الصندوق       إلى 1115 عهدة الموظف
 * فيبقى رصيد 1115 مساوياً لمجموع ما في أيدي الموظفين في أي لحظة.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireStaff, requireRoleOrPermission } from "./sessions";
import { postEntry } from "./financePost";

const ADVANCE_ACC = "1115"; // عُهد نقدية لدى الموظفين
const CASH_ACC = "1110";    // الصندوق

async function requireFinance(ctx: any, token?: string) {
  return await requireRoleOrPermission(ctx, token, {
    roles: ["ACCOUNTANT", "FINANCE_MANAGER"],
    permissions: ["/finance"],
  });
}

/** معرّف المستخدم من الهوية — Identity تحمل userId نصياً لا مستنداً. */
const actorId = (a: any): Id<"users"> | undefined =>
  a?.userId ? (a.userId as Id<"users">) : undefined;

async function accByCode(ctx: any, code: string): Promise<Id<"finAccounts"> | null> {
  const a = await ctx.db.query("finAccounts").withIndex("by_code", (q: any) => q.eq("code", code)).first();
  return a?._id ?? null;
}

/** المصروفات التي تُصرف عادةً من العهدة — تظهر كقائمة جاهزة بدل حفظ الأكواد. */
export const expenseAccounts = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const all = await ctx.db
      .query("finAccounts")
      .withIndex("by_type", (q) => q.eq("accountType", "expense"))
      .collect();
    return all
      .filter((a: any) => a.isPostable && a.isActive)
      .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)))
      .map((a: any) => ({ code: a.code, nameAr: a.nameAr, nameEn: a.nameEn }));
  },
});

/** رصيد كل موظف = السلف − المصروفات − المُرجَع. */
export const holders = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const txns = await ctx.db.query("pettyCashTxns").collect();
    const byHolder = new Map<string, any>();
    for (const t of txns) {
      const k = String(t.holderId);
      if (!byHolder.has(k)) {
        byHolder.set(k, {
          holderId: k, holderName: t.holderName,
          advances: 0, expenses: 0, returns: 0, balance: 0,
          lastActivity: t.date, txnCount: 0,
        });
      }
      const h = byHolder.get(k);
      h.txnCount++;
      if (t.type === "ADVANCE") h.advances += t.amount;
      else if (t.type === "EXPENSE") h.expenses += t.amount;
      else h.returns += t.amount;
      if (String(t.date) > String(h.lastActivity)) h.lastActivity = t.date;
    }
    const rows = [...byHolder.values()];
    // آخر جرد لكل موظف — لإظهار عجز/زيادة لم تُسوّ بعد
    const counts = await ctx.db.query("pettyCashCounts").collect();
    for (const r of rows) {
      r.balance = Math.round((r.advances - r.expenses - r.returns) * 100) / 100;
      const mine = counts.filter((c: any) => String(c.holderId) === r.holderId)
        .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
      r.lastCount = mine[0]
        ? { date: mine[0].date, counted: mine[0].countedTotal, variance: mine[0].variance }
        : null;
    }
    return rows.sort((a, b) => b.balance - a.balance);
  },
});

/** كشف حساب موظف واحد بترتيب زمني مع رصيد جارٍ. */
export const statement = query({
  args: {
    holderId: v.id("users"),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const all = await ctx.db
      .query("pettyCashTxns")
      .withIndex("by_holder", (q) => q.eq("holderId", args.holderId))
      .collect();
    const accounts = await ctx.db.query("finAccounts").collect();
    const nameOf = new Map(accounts.map((a: any) => [a.code, a.nameAr]));

    const rows = all
      .filter((t: any) => (!args.from || t.date >= args.from) && (!args.to || t.date <= args.to))
      .sort((a: any, b: any) =>
        String(a.date).localeCompare(String(b.date)) || a.createdAt - b.createdAt);

    let running = 0;
    return rows.map((t: any) => {
      running += t.type === "ADVANCE" ? t.amount : -t.amount;
      return {
        id: String(t._id),
        date: t.date,
        type: t.type,
        amount: t.amount,
        expenseAccountCode: t.expenseAccountCode,
        expenseAccountName: t.expenseAccountCode ? nameOf.get(t.expenseAccountCode) || "" : "",
        description: t.description || "",
        receiptNo: t.receiptNo || "",
        balance: Math.round(running * 100) / 100,
      };
    });
  },
});

export const record = mutation({
  args: {
    holderId: v.id("users"),
    date: v.string(),
    type: v.union(v.literal("ADVANCE"), v.literal("EXPENSE"), v.literal("RETURN")),
    amount: v.number(),
    expenseAccountCode: v.optional(v.string()),
    description: v.optional(v.string()),
    receiptNo: v.optional(v.string()),
    costCenterId: v.optional(v.id("finCostCenters")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireFinance(ctx, args.sessionToken);
    if (args.amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
    if (args.type === "EXPENSE" && !args.expenseAccountCode) {
      throw new Error("اختر نوع المصروف (بنزين، صيانة…) حتى يُرحَّل على حسابه");
    }

    const holder: any = await ctx.db.get(args.holderId);
    if (!holder) throw new Error("الموظف غير موجود");

    // منع صرف أكثر مما في اليد — العجز الدفتري يُخفي خطأً لا يُكتشف لاحقاً
    if (args.type === "EXPENSE" || args.type === "RETURN") {
      const prev = await ctx.db
        .query("pettyCashTxns")
        .withIndex("by_holder", (q) => q.eq("holderId", args.holderId))
        .collect();
      const bal = prev.reduce(
        (s: number, t: any) => s + (t.type === "ADVANCE" ? t.amount : -t.amount), 0,
      );
      if (args.amount > bal + 0.01) {
        throw new Error(`الرصيد المتاح ${bal.toFixed(2)} ريال فقط — لا يمكن صرف ${args.amount.toFixed(2)}`);
      }
    }

    const advanceAcc = await accByCode(ctx, ADVANCE_ACC);
    const cashAcc = await accByCode(ctx, CASH_ACC);
    if (!advanceAcc || !cashAcc) {
      throw new Error("شجرة الحسابات غير مزروعة — شغّل seedChartOfAccounts أولاً");
    }

    let lines: any[] = [];
    let desc = "";
    if (args.type === "ADVANCE") {
      desc = `صرف عهدة نقدية — ${holder.fullName || holder.username}`;
      lines = [
        { accountId: advanceAcc, debit: args.amount, description: desc },
        { accountId: cashAcc, credit: args.amount, description: desc },
      ];
    } else if (args.type === "RETURN") {
      desc = `إرجاع باقي العهدة — ${holder.fullName || holder.username}`;
      lines = [
        { accountId: cashAcc, debit: args.amount, description: desc },
        { accountId: advanceAcc, credit: args.amount, description: desc },
      ];
    } else {
      const expAcc = await accByCode(ctx, args.expenseAccountCode!);
      if (!expAcc) throw new Error(`حساب المصروف ${args.expenseAccountCode} غير موجود`);
      desc = args.description?.trim()
        || `مصروف من عهدة ${holder.fullName || holder.username}`;
      lines = [
        { accountId: expAcc, debit: args.amount, description: desc, documentRef: args.receiptNo },
        { accountId: advanceAcc, credit: args.amount, description: desc },
      ];
    }

    const { entryId } = await postEntry(ctx, {
      entryDate: args.date,
      description: desc,
      lines,
      journalType: "general",
      costCenterId: args.costCenterId,
      sourceType: "pettyCash",
      isAutoGenerated: true,
      createdBy: actorId(actor),
    });

    const id = await ctx.db.insert("pettyCashTxns", {
      holderId: args.holderId,
      holderName: holder.fullName || holder.username || "",
      date: args.date,
      type: args.type,
      amount: args.amount,
      expenseAccountCode: args.expenseAccountCode,
      description: args.description,
      receiptNo: args.receiptNo,
      costCenterId: args.costCenterId,
      journalEntryId: entryId,
      createdBy: actorId(actor),
      createdAt: Date.now(),
    });
    return { ok: true, id: String(id) };
  },
});

/**
 * جرد الفكة. لا يُرحَّل قيداً — هو إثبات عدّ فقط؛ أي فرق يُسوّى بحركة صريحة
 * ليبقى واضحاً في الدفاتر من قرّر التسوية ومتى.
 */
export const saveCount = mutation({
  args: {
    holderId: v.id("users"),
    date: v.string(),
    denominations: v.any(),
    notes: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireFinance(ctx, args.sessionToken);
    const holder: any = await ctx.db.get(args.holderId);
    if (!holder) throw new Error("الموظف غير موجود");

    const counted = Object.entries(args.denominations || {}).reduce(
      (s, [den, qty]) => s + Number(den) * (Number(qty) || 0), 0,
    );
    const prev = await ctx.db
      .query("pettyCashTxns")
      .withIndex("by_holder", (q) => q.eq("holderId", args.holderId))
      .collect();
    const book = prev.reduce(
      (s: number, t: any) => s + (t.type === "ADVANCE" ? t.amount : -t.amount), 0,
    );

    const id = await ctx.db.insert("pettyCashCounts", {
      holderId: args.holderId,
      holderName: holder.fullName || holder.username || "",
      date: args.date,
      denominations: args.denominations,
      countedTotal: Math.round(counted * 100) / 100,
      bookBalance: Math.round(book * 100) / 100,
      variance: Math.round((counted - book) * 100) / 100,
      notes: args.notes,
      countedBy: actorId(actor),
      createdAt: Date.now(),
    });
    return {
      ok: true, id: String(id),
      counted: Math.round(counted * 100) / 100,
      book: Math.round(book * 100) / 100,
      variance: Math.round((counted - book) * 100) / 100,
    };
  },
});

export const counts = query({
  args: { holderId: v.optional(v.id("users")), limit: v.optional(v.number()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const all = await ctx.db.query("pettyCashCounts").collect();
    return all
      .filter((c: any) => !args.holderId || String(c.holderId) === String(args.holderId))
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
      .slice(0, Math.min(Number(args.limit) || 30, 100));
  },
});
