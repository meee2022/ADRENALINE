import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireRoleOrPermission } from "./sessions";

const requireFinance = (ctx: any, token?: string) => requireRoleOrPermission(ctx, token, {
  roles: ["ACCOUNTANT", "FINANCE_MANAGER"], permissions: ["/finance"],
});

// ==================================================================
// المالية — المرحلة 1: شجرة الحسابات + عدّاد + استعلامات أساسية
//   موديول مستقل. لا يمسّ أي منطق قائم.
// ==================================================================

type Acc = {
  code: string;
  nameAr: string;
  nameEn: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  sub?: string;
  op?: string;           // operationalType
  postable?: boolean;    // false = عنوان/مجموعة
  parent?: string;       // كود الأب
};

// شجرة حسابات مصمّمة لمطعم + مطبخ مركزي + توصيل + جم (قطر).
// المستوى الأول مجموعات (غير قابلة للترحيل)، والأوراق قابلة للترحيل.
const CHART: Acc[] = [
  // ===== 1 الأصول =====
  { code: "1", nameAr: "الأصول", nameEn: "Assets", type: "asset", postable: false },
  { code: "11", nameAr: "الأصول المتداولة", nameEn: "Current Assets", type: "asset", postable: false, parent: "1" },
  { code: "1110", nameAr: "الصندوق (كاش)", nameEn: "Cash on Hand", type: "asset", sub: "cash", op: "cash", parent: "11" },
  { code: "1111", nameAr: "درج الكاشير", nameEn: "POS Cash Drawer", type: "asset", sub: "cash", op: "cash", parent: "11" },
  { code: "1120", nameAr: "البنك", nameEn: "Bank Accounts", type: "asset", sub: "bank", op: "bank", parent: "11" },
  { code: "1130", nameAr: "شبكة/بطاقات تحت التحصيل", nameEn: "Card Settlements Receivable", type: "asset", sub: "receivable", op: "trade_receivable", parent: "11" },
  { code: "1140", nameAr: "منصّات التوصيل تحت التحصيل", nameEn: "Delivery Platforms Receivable", type: "asset", sub: "receivable", op: "trade_receivable", parent: "11" },
  { code: "1150", nameAr: "ذمم العملاء والشركات", nameEn: "Trade Receivables", type: "asset", sub: "receivable", op: "trade_receivable", parent: "11" },
  { code: "1160", nameAr: "مخزون الخامات", nameEn: "Raw Materials Inventory", type: "asset", sub: "inventory", parent: "11" },
  { code: "1161", nameAr: "مخزون البضاعة الجاهزة", nameEn: "Finished Goods Inventory", type: "asset", sub: "inventory", parent: "11" },
  { code: "1162", nameAr: "مخزون الجم (مكمّلات)", nameEn: "Gym Supplements Inventory", type: "asset", sub: "inventory", parent: "11" },
  { code: "1170", nameAr: "مصروفات مدفوعة مقدمًا", nameEn: "Prepaid Expenses", type: "asset", sub: "prepaid", parent: "11" },
  { code: "12", nameAr: "الأصول الثابتة", nameEn: "Fixed Assets", type: "asset", postable: false, parent: "1" },
  { code: "1210", nameAr: "معدات المطبخ", nameEn: "Kitchen Equipment", type: "asset", sub: "fixed_asset", parent: "12" },
  { code: "1220", nameAr: "أثاث وتجهيزات", nameEn: "Furniture & Fixtures", type: "asset", sub: "fixed_asset", parent: "12" },
  { code: "1230", nameAr: "سيارات التوصيل", nameEn: "Delivery Vehicles", type: "asset", sub: "fixed_asset", parent: "12" },
  { code: "1290", nameAr: "مجمّع الإهلاك", nameEn: "Accumulated Depreciation", type: "asset", sub: "contra_asset", parent: "12" },

  // ===== 2 الخصوم =====
  { code: "2", nameAr: "الخصوم", nameEn: "Liabilities", type: "liability", postable: false },
  { code: "21", nameAr: "الخصوم المتداولة", nameEn: "Current Liabilities", type: "liability", postable: false, parent: "2" },
  { code: "2110", nameAr: "ذمم الموردين", nameEn: "Trade Payables", type: "liability", sub: "payable", op: "trade_payable", parent: "21" },
  { code: "2120", nameAr: "رواتب مستحقة", nameEn: "Accrued Salaries", type: "liability", sub: "payable", parent: "21" },
  { code: "2130", nameAr: "ضريبة القيمة المضافة المستحقة", nameEn: "VAT Payable", type: "liability", sub: "tax", parent: "21" },
  { code: "2140", nameAr: "مصروفات مستحقة", nameEn: "Accrued Expenses", type: "liability", sub: "payable", parent: "21" },
  { code: "2150", nameAr: "إيراد اشتراكات مؤجّل", nameEn: "Deferred Subscription Revenue", type: "liability", sub: "deferred", parent: "21" },

  // ===== 3 حقوق الملكية =====
  { code: "3", nameAr: "حقوق الملكية", nameEn: "Equity", type: "equity", postable: false },
  { code: "3110", nameAr: "رأس المال", nameEn: "Capital", type: "equity", sub: "capital", parent: "3" },
  { code: "3120", nameAr: "مسحوبات الملاك", nameEn: "Owner Drawings", type: "equity", sub: "drawings", parent: "3" },
  { code: "3130", nameAr: "الأرباح المرحّلة", nameEn: "Retained Earnings", type: "equity", sub: "retained", parent: "3" },

  // ===== 4 الإيرادات =====
  { code: "4", nameAr: "الإيرادات", nameEn: "Revenue", type: "revenue", postable: false },
  { code: "4110", nameAr: "مبيعات المطعم (POS)", nameEn: "Restaurant Sales (POS)", type: "revenue", sub: "sales", parent: "4" },
  { code: "4120", nameAr: "مبيعات التوصيل/الأونلاين", nameEn: "Delivery / Online Sales", type: "revenue", sub: "sales", parent: "4" },
  { code: "4130", nameAr: "إيراد الاشتراكات", nameEn: "Subscription Revenue", type: "revenue", sub: "sales", parent: "4" },
  { code: "4140", nameAr: "مبيعات الجم (مكمّلات)", nameEn: "Gym Sales", type: "revenue", sub: "sales", parent: "4" },
  { code: "4190", nameAr: "مردودات المبيعات", nameEn: "Sales Returns", type: "revenue", sub: "contra_revenue", parent: "4" },
  { code: "4195", nameAr: "الخصومات الممنوحة", nameEn: "Discounts Given", type: "revenue", sub: "contra_revenue", parent: "4" },

  // ===== 5 تكلفة المبيعات =====
  { code: "5", nameAr: "تكلفة المبيعات", nameEn: "Cost of Sales", type: "expense", postable: false },
  { code: "5110", nameAr: "تكلفة البضاعة المباعة (خامات)", nameEn: "COGS - Food", type: "expense", sub: "cogs", parent: "5" },
  { code: "5120", nameAr: "تكلفة مبيعات الجم", nameEn: "COGS - Gym", type: "expense", sub: "cogs", parent: "5" },
  { code: "5130", nameAr: "هدر وتلف", nameEn: "Wastage & Spoilage", type: "expense", sub: "wastage", parent: "5" },
  { code: "5140", nameAr: "منتهي الصلاحية", nameEn: "Expired Stock", type: "expense", sub: "wastage", parent: "5" },
  { code: "5150", nameAr: "فروق الجرد", nameEn: "Inventory Variance", type: "expense", sub: "variance", parent: "5" },

  // ===== 6 المصروفات التشغيلية =====
  { code: "6", nameAr: "المصروفات التشغيلية", nameEn: "Operating Expenses", type: "expense", postable: false },
  { code: "6110", nameAr: "الرواتب والأجور", nameEn: "Salaries & Wages", type: "expense", sub: "payroll", parent: "6" },
  { code: "6115", nameAr: "أوفرتايم ومكافآت", nameEn: "Overtime & Bonuses", type: "expense", sub: "payroll", parent: "6" },
  { code: "6120", nameAr: "الإيجار", nameEn: "Rent", type: "expense", sub: "opex", parent: "6" },
  { code: "6130", nameAr: "الكهرباء والماء", nameEn: "Utilities", type: "expense", sub: "opex", parent: "6" },
  { code: "6140", nameAr: "الغاز", nameEn: "Gas", type: "expense", sub: "opex", parent: "6" },
  { code: "6150", nameAr: "عمولات منصّات التوصيل", nameEn: "Delivery Platform Commissions", type: "expense", sub: "opex", parent: "6" },
  { code: "6160", nameAr: "مصاريف التوصيل (سائقين/وقود)", nameEn: "Delivery Costs", type: "expense", sub: "opex", parent: "6" },
  { code: "6170", nameAr: "تسويق وإعلانات", nameEn: "Marketing & Advertising", type: "expense", sub: "opex", parent: "6" },
  { code: "6180", nameAr: "مستلزمات تغليف", nameEn: "Packaging Supplies", type: "expense", sub: "opex", parent: "6" },
  { code: "6190", nameAr: "صيانة ونظافة", nameEn: "Maintenance & Cleaning", type: "expense", sub: "opex", parent: "6" },
  { code: "6200", nameAr: "رسوم بنكية وشبكة", nameEn: "Bank & Card Fees", type: "expense", sub: "opex", parent: "6" },
  { code: "6210", nameAr: "اتصالات وإنترنت واشتراكات برامج", nameEn: "Telecom & Software", type: "expense", sub: "opex", parent: "6" },
  { code: "6220", nameAr: "رسوم حكومية وتراخيص", nameEn: "Government Fees & Licenses", type: "expense", sub: "opex", parent: "6" },
  { code: "6230", nameAr: "الإهلاك", nameEn: "Depreciation Expense", type: "expense", sub: "depreciation", parent: "6" },
  { code: "6900", nameAr: "مصروفات أخرى", nameEn: "Other Expenses", type: "expense", sub: "opex", parent: "6" },
];

const normalFor = (t: string): "debit" | "credit" =>
  t === "asset" || t === "expense" ? "debit" : "credit";

// زرع/تحديث شجرة الحسابات (idempotent — يكرّر بأمان، يحدّث الموجود بالكود).
export const seedChartOfAccounts = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
    const now = Date.now();
    const byCode = new Map<string, any>();
    for (const a of await ctx.db.query("finAccounts").collect()) byCode.set(a.code, a);

    let created = 0, updated = 0;
    // تمريرة أولى: إنشاء/تحديث بدون parent (نربط الآباء بعد اكتمال الخريطة)
    for (const a of CHART) {
      const existing = byCode.get(a.code);
      const base = {
        code: a.code,
        nameAr: a.nameAr,
        nameEn: a.nameEn,
        accountType: a.type,
        accountSubType: a.sub,
        isPostable: a.postable !== false,
        normalBalance: normalFor(a.type),
        operationalType: a.op,
        isActive: true,
        sortOrder: Number(a.code),
        isSystem: true,
      };
      if (existing) {
        await ctx.db.patch(existing._id, { ...base, updatedAt: now });
        updated++;
      } else {
        const id = await ctx.db.insert("finAccounts", { ...base, createdAt: now });
        byCode.set(a.code, { ...base, _id: id });
        created++;
      }
    }
    // تمريرة ثانية: ربط الآباء
    for (const a of CHART) {
      if (!a.parent) continue;
      const child = byCode.get(a.code);
      const parent = byCode.get(a.parent);
      if (child && parent) await ctx.db.patch(child._id, { parentId: parent._id });
    }
    // عدّاد القيود
    const c = await ctx.db.query("finCounters").withIndex("by_key", (q) => q.eq("key", "journal")).first();
    if (!c) await ctx.db.insert("finCounters", { key: "journal", prefix: "JV-", value: 0 });
    return { created, updated, total: CHART.length };
  },
});

// شجرة الحسابات كاملة (للعرض الهرمي).
export const listAccounts = query({
  args: { activeOnly: v.optional(v.boolean()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
    let accs = await ctx.db.query("finAccounts").collect();
    if (args.activeOnly) accs = accs.filter((a) => a.isActive);
    return accs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },
});

// تشخيص سريع لحالة الموديول المالي.
export const financeStatus = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
    const accounts = await ctx.db.query("finAccounts").collect();
    const entries = await ctx.db.query("finJournalEntries").collect();
    const periods = await ctx.db.query("finPeriods").collect();
    return {
      accounts: accounts.length,
      postableAccounts: accounts.filter((a) => a.isPostable).length,
      journalEntries: entries.length,
      postedEntries: entries.filter((e) => e.postingStatus === "posted").length,
      periods: periods.length,
    };
  },
});

export const listPeriods = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.sessionToken);
    return await ctx.db.query("finPeriods").withIndex("by_dates").order("desc").collect();
  },
});

export const setPeriodStatus = mutation({
  args: {
    periodId: v.id("finPeriods"),
    status: v.union(v.literal("open"), v.literal("locked"), v.literal("closed")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, args.sessionToken, ["FINANCE_MANAGER"]);
    const period: any = await ctx.db.get(args.periodId);
    if (!period) throw new Error("الفترة المالية غير موجودة");
    if (period.status === "closed" && args.status !== "closed") {
      throw new Error("الفترة المقفلة نهائيًا لا يعاد فتحها إلا بقيد افتتاحي في فترة جديدة");
    }
    await ctx.db.patch(args.periodId, {
      status: args.status,
      closedAt: args.status === "closed" ? Date.now() : undefined,
      closedBy: args.status === "closed" ? actor.userId as any : undefined,
    });
    const user: any = actor.userId ? await ctx.db.get(actor.userId as any) : null;
    await ctx.db.insert("auditLog", {
      actorUserId: actor.userId as any,
      actorName: user?.name,
      actorRole: actor.role,
      action: "FINANCE_PERIOD_STATUS_CHANGED",
      entityType: "finPeriod",
      entityId: String(args.periodId),
      details: JSON.stringify({ period: period.name, from: period.status, to: args.status }),
      createdAt: Date.now(),
    });
    return { success: true };
  },
});
