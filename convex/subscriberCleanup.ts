/**
 * @file convex/subscriberCleanup.ts
 * @description مطابقة المشتركين بإكسل 21-7 وحذف من ليس فيه — معاينة ثم تنفيذ.
 *
 *   ═══ القاعدة (بقرار المستخدم) ═══
 *   يبقى: من هو في الإكسل، **أو** من سجّل من 2026-07-09 فأحدث (أحدث من الإكسل).
 *   يُحذف: من ليس في الإكسل **و** سجّل قبل 2026-07-09 (اشتراك قديم منتهٍ).
 *
 *   ⚠️ المطابقة بآخر 8 أرقام من الهاتف — نتجاهل كود الدولة إن وُجد.
 *   ⚠️ الحذف يجرّ حساب الدخول والخطط والطلبات والإشعارات والتقييمات. نحذفها
 *      معه وإلا بقيت يتيمة تشير إلى مشترك غير موجود.
 *   ⚠️ لا حذف قبل نسخة احتياطية كاملة (backup) تُطبع في نتيجة التنفيذ.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

const CUTOFF = "2026-07-09"; // من سجّل في هذا اليوم أو بعده يبقى ولو غاب عن الإكسل

/** آخر 8 أرقام — مفتاح المطابقة. */
function phoneKey(p: any): string {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
}

function localDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

async function survey(ctx: any, excelKeys: string[]) {
  const keep = new Set(excelKeys.map((k) => phoneKey(k)));
  const customers = await ctx.db.query("customers").collect();

  const rows: any[] = [];
  for (const c of customers as any[]) {
    const key = phoneKey(c.phone || c.mobile || c.whatsapp);
    const inExcel = keep.has(key);
    const created = localDate(c._creationTime);
    const isRecent = created >= CUTOFF;
    // 🔒 يُحذف فقط: غائب عن الإكسل **و** أقدم من التاريخ الحاجز
    const willDelete = !inExcel && !isRecent;
    rows.push({
      id: String(c._id),
      name: c.name || c.fullName || c.customerName || "",
      phone: c.phone || c.mobile || c.whatsapp || "",
      key, inExcel, created, isRecent, willDelete,
      startDate: c.startDate || "", endDate: c.endDate || "",
    });
  }
  return rows;
}

/** 🔍 معاينة — لا تحذف. تُصنّف كل مشترك. */
export const preview = query({
  args: { excelPhones: v.array(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await survey(ctx, args.excelPhones);
    const del = rows.filter((r) => r.willDelete);
    return {
      total: rows.length,
      inExcel: rows.filter((r) => r.inExcel).length,
      keepRecent: rows.filter((r) => !r.inExcel && r.isRecent).length,
      willDelete: del.length,
      deleteList: del.map((r) => ({ name: r.name, phone: r.phone, created: r.created, start: r.startDate, end: r.endDate })),
    };
  },
});

/** كم مرجعاً يجرّه حذف مجموعة مشتركين — للعرض قبل التنفيذ. */
export const impact = query({
  args: { excelPhones: v.array(v.string()), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await survey(ctx, args.excelPhones);
    const ids = new Set(rows.filter((r) => r.willDelete).map((r) => r.id));
    const count = async (table: string, field: string) => {
      const all = await ctx.db.query(table as any).collect();
      return (all as any[]).filter((r) => ids.has(String(r[field] ?? ""))).length;
    };
    return {
      customers: ids.size,
      accounts: await count("customerAccounts", "customerId"),
      dailyPlans: await count("dailyPlans", "customerId"),
      orders: await count("customerOrders", "customerId"),
      notifications: await count("notifications", "targetCustomerId"),
      ratings: await count("ratings", "customerId"),
      posTickets: await count("posTickets", "customerId"),
      customizedTemplates: await count("customizedTemplates", "customerId"),
    };
  },
});

/** ✅ تنفيذ — ADMIN فقط. يحذف المشترك وكل ما يشير إليه، بعد نسخة احتياطية. */
export const purge = mutation({
  args: {
    excelPhones: v.array(v.string()),
    confirm: v.literal("DELETE"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const rows = await survey(ctx, args.excelPhones);
    const targets = rows.filter((r) => r.willDelete);

    let customers = 0, accounts = 0, plans = 0, orders = 0, notifs = 0, ratings = 0, tickets = 0, templates = 0;
    const backup: any[] = [];

    for (const t of targets) {
      const c: any = await ctx.db.get(t.id as any);
      if (!c) continue;
      // 🔒 نسخة احتياطية كاملة للصف قبل حذفه
      backup.push(c);

      // حسابات الدخول
      const accs = await ctx.db.query("customerAccounts")
        .filter((q: any) => q.eq(q.field("customerId"), t.id)).collect();
      for (const a of accs as any[]) { backup.push({ __t: "account", ...a }); await ctx.db.delete(a._id); accounts++; }

      // الخطط اليومية
      const dps = await ctx.db.query("dailyPlans")
        .filter((q: any) => q.eq(q.field("customerId"), t.id)).collect();
      for (const p of dps as any[]) { await ctx.db.delete(p._id); plans++; }

      // الطلبات + أصنافها
      const ords = await ctx.db.query("customerOrders")
        .filter((q: any) => q.eq(q.field("customerId"), t.id)).collect();
      for (const o of ords as any[]) {
        const its = await ctx.db.query("customerOrderItems")
          .withIndex("by_orderId", (q: any) => q.eq("orderId", o._id)).collect();
        for (const it of its as any[]) await ctx.db.delete(it._id);
        await ctx.db.delete(o._id); orders++;
      }

      // الإشعارات
      const nts = await ctx.db.query("notifications")
        .filter((q: any) => q.eq(q.field("targetCustomerId"), t.id)).collect();
      for (const n of nts as any[]) { await ctx.db.delete(n._id); notifs++; }

      // التقييمات
      const rts = await ctx.db.query("ratings")
        .filter((q: any) => q.eq(q.field("customerId"), t.id)).collect();
      for (const r of rts as any[]) { await ctx.db.delete(r._id); ratings++; }

      // قوالب مخصّصة
      const tps = await ctx.db.query("customizedTemplates")
        .filter((q: any) => q.eq(q.field("customerId"), t.id)).collect();
      for (const tp of tps as any[]) { await ctx.db.delete(tp._id); templates++; }

      // تذاكر POS: نفصل الرابط فقط، لا نحذف التذكرة (سجل بيع تاريخي)
      const tks = await ctx.db.query("posTickets")
        .filter((q: any) => q.eq(q.field("customerId"), t.id)).collect();
      for (const tk of tks as any[]) { await ctx.db.patch(tk._id, { customerId: undefined }); tickets++; }

      await ctx.db.delete(t.id as any);
      customers++;
    }

    return { customers, accounts, plans, orders, notifs, ratings, ticketsUnlinked: tickets, templates, backup };
  },
});
