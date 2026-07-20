/**
 * @file convex/dupMerge.ts
 * @description دمج المشتركين المكررين — معاينة ثم تنفيذ.
 *
 *   ═══ القاعدة (بقرار المستخدم) ═══
 *   لا تُحذف نسخة إلا إذا طابقت أخرى في: الرقم **و** الاسم **و** تاريخ البداية
 *   **و** تاريخ النهاية — الأربعة معاً. أي اختلاف في تاريخ ⇒ ليست تكراراً،
 *   تبقى وتُعرَض للمراجعة (قد يكون تجديد اشتراك أو شخص آخر).
 *
 *   نُبقي الأقدم (أول إنشاء) كأصل، ونحذف الأحدث المطابق. وقبل الحذف ننقل أي
 *   خطة/طلب/تقييم مربوط بالنسخة المحذوفة إلى الأصل، فلا يضيع عمل.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

const pk = (p: any) => { const d = String(p || "").replace(/\D/g, ""); return d.length >= 8 ? d.slice(-8) : d; };
const nk = (s: any) => String(s || "").toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");
const nm = (c: any) => c.name || c.fullName || c.customerName || "";

/** بصمة التكرار: رقم | اسم | بداية | نهاية — الأربعة. */
function sig(c: any): string {
  return [pk(c.phone || c.mobile || c.whatsapp), nk(nm(c)), c.startDate || "", c.endDate || ""].join("¦");
}

async function plan(ctx: any) {
  const cs = await ctx.db.query("customers").collect();
  const groups = new Map<string, any[]>();
  for (const c of cs as any[]) {
    const s = sig(c);
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(c);
  }
  const merges: any[] = [];
  for (const [, arr] of groups) {
    if (arr.length < 2) continue;
    // الأصل = الأقدم إنشاءً
    arr.sort((a, b) => a._creationTime - b._creationTime);
    const keep = arr[0];
    const drop = arr.slice(1);
    merges.push({
      name: nm(keep), phone: keep.phone || keep.mobile,
      start: keep.startDate || "", end: keep.endDate || "",
      keepId: String(keep._id), dropIds: drop.map((c: any) => String(c._id)), copies: arr.length,
    });
  }
  return merges;
}

/** كم خطة/طلب مربوط بالنسخ اللي هتتحذف؟ */
async function refsOf(ctx: any, dropIds: Set<string>) {
  const plans = await ctx.db.query("dailyPlans").collect();
  const orders = await ctx.db.query("customerOrders").collect();
  return {
    plans: (plans as any[]).filter((p) => dropIds.has(String(p.customerId ?? ""))).length,
    orders: (orders as any[]).filter((o) => dropIds.has(String(o.customerId ?? ""))).length,
  };
}

/** 🔍 معاينة — لا تحذف. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const merges = await plan(ctx);
    const dropIds = new Set<string>(merges.flatMap((m) => m.dropIds));
    const refs = await refsOf(ctx, dropIds);
    return {
      groups: merges.length,
      willDelete: [...dropIds].length,
      refs, // خطط/طلبات على النسخ الزيادة — هتتنقل للأصل مش تتحذف
      merges,
    };
  },
});

/** ✅ تنفيذ — ADMIN. ينقل المراجع للأصل ثم يحذف النسخة الزيادة. مع باك أب. */
export const apply = mutation({
  args: { sessionToken: v.optional(v.string()), confirm: v.literal("MERGE") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const merges = await plan(ctx);
    let deleted = 0, movedPlans = 0, movedOrders = 0, movedRatings = 0;
    const backup: any[] = [];

    for (const m of merges) {
      for (const dropId of m.dropIds) {
        const c: any = await ctx.db.get(dropId as any);
        if (!c) continue;
        // 🔒 نعيد التأكد أن البصمة ما زالت مطابقة للأصل
        const keep: any = await ctx.db.get(m.keepId as any);
        if (!keep || sig(c) !== sig(keep)) continue;
        backup.push({ __t: "customer", ...c });

        // انقل المراجع للأصل بدل حذفها
        for (const p of await ctx.db.query("dailyPlans").filter((q: any) => q.eq(q.field("customerId"), dropId)).collect() as any[]) {
          await ctx.db.patch(p._id, { customerId: m.keepId as any }); movedPlans++;
        }
        for (const o of await ctx.db.query("customerOrders").filter((q: any) => q.eq(q.field("customerId"), dropId)).collect() as any[]) {
          await ctx.db.patch(o._id, { customerId: m.keepId as any }); movedOrders++;
        }
        for (const r of await ctx.db.query("ratings").filter((q: any) => q.eq(q.field("customerId"), dropId)).collect() as any[]) {
          await ctx.db.patch(r._id, { customerId: m.keepId as any }); movedRatings++;
        }
        // حساب الدخول: لو النسخة الزيادة عندها حساب والأصل لأ، ننقله؛ وإلا نحذفه
        for (const a of await ctx.db.query("customerAccounts").filter((q: any) => q.eq(q.field("customerId"), dropId)).collect() as any[]) {
          const keepHas = await ctx.db.query("customerAccounts").filter((q: any) => q.eq(q.field("customerId"), m.keepId)).first();
          if (keepHas) { backup.push({ __t: "account", ...a }); await ctx.db.delete(a._id); }
          else await ctx.db.patch(a._id, { customerId: m.keepId as any });
        }
        await ctx.db.delete(dropId as any); deleted++;
      }
    }
    return { deleted, movedPlans, movedOrders, movedRatings, backupCount: backup.length, backup };
  },
});
