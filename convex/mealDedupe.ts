/**
 * @file convex/mealDedupe.ts
 * @description تنظيف الوجبات المكررة من الاستيراد القديم — معاينة ثم حذف.
 *
 *   ═══ القاعدة ═══
 *   «مكرر» لا تعني «زائد». الوجبة قد تبدو مكررة بالاسم بينما نسختها الأخرى
 *   مستعملة في نقطة البيع أو كتالوج المنافذ أو الأونلاين — فهي ليست مكرراً
 *   بل صنف مطلوب. لذلك لا نحكم بالاسم إطلاقاً، بل بالاستعمال الفعلي.
 *
 *   لا تُحذف نسخة إلا إذا اجتمع فيها:
 *     • صفر إشارة في **كل** الجداول العشرة أدناه، و
 *     • غير مجدولة على دورة الإكسل، و
 *     • لها شقيقة باقية بنفس الاسم (فلا يختفي الصنف من المنيو).
 *   أي شكّ ⇒ تبقى. وجبة خاطئة تصل المشترك = مشكلة حقيقية في المطعم.
 *
 *   ⚠️ dailyPlans.items نوعه v.any() — الـmealId بداخله **ليس مفتاحاً** في
 *      السكيما فلا يظهر في أي بحث عن id("publicMeals"). نسيانه يترك خطة
 *      مطبخ تشير إلى وجبة محذوفة. يُفحص هنا صراحةً.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

/** اسم موحَّد للتجميع: فروق الحالة والمسافات ليست فروق أصناف. */
function key(s: any): string {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** خريطة: mealId → أين هو مستعمَل. تُبنى مرة واحدة لكل الوجبات. */
async function usageMap(ctx: any) {
  const use = new Map<string, Record<string, number>>();
  const bump = (id: any, where: string) => {
    const k = String(id || "");
    if (!k) return;
    if (!use.has(k)) use.set(k, {});
    use.get(k)![where] = (use.get(k)![where] ?? 0) + 1;
  };

  // ⚠️ المفاتيح ASCII إجباراً: Convex يرفض أسماء الحقول العربية
  //    («Field name ... has invalid character»). العربية للعرض فقط.
  const SRC: [string, string, string][] = [
    ["posItems", "mealId", "posItems"],
    ["posTicketLines", "mealId", "posTickets"],
    ["mealIssuances", "publicMealId", "issuances"],
    ["menuItems", "publicMealId", "manualPlanLink"],
    ["customerOrderItems", "mealId", "customerOrders"],
    ["ratings", "publicMealId", "ratings"],
    ["outletCatalogItems", "mealId", "outletCatalog"],
    ["gymOrderLines", "mealId", "outletOrders"],
    ["gymReturnBatchLines", "mealId", "outletReturns"],
  ];
  for (const [table, field, label] of SRC) {
    const rows = await ctx.db.query(table as any).collect();
    for (const r of rows as any[]) bump(r[field], label);
  }

  // ⚠️ العاشر: داخل dailyPlans.items (v.any) — لا يظهر كمفتاح في السكيما
  const plans = await ctx.db.query("dailyPlans").collect();
  for (const p of plans as any[]) {
    for (const it of Array.isArray(p.items) ? p.items : []) bump(it?.mealId, "dailyPlans");
  }
  return use;
}

async function survey(ctx: any) {
  const meals = await ctx.db.query("publicMeals").collect();
  const use = await usageMap(ctx);

  const groups = new Map<string, any[]>();
  for (const m of meals as any[]) {
    const k = key(m.nameEn) || key(m.nameAr);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }

  const out: any[] = [];
  for (const [k, rows] of groups) {
    if (rows.length < 2) continue;
    const enriched = rows.map((m: any) => {
      const u = use.get(String(m._id)) ?? {};
      const total = Object.values(u).reduce((a: number, b: any) => a + b, 0);
      return {
        id: String(m._id), nameEn: m.nameEn, nameAr: m.nameAr,
        calories: m.calories ?? 0, price: m.priceQAR ?? 0,
        scheduled: Array.isArray(m.schedule) ? m.schedule.length : 0,
        gymOnly: !!m.isGymOnly, onlineOnly: !!m.isOnlineOnly,
        hasImage: !!(m.storageId || m.imageUrl),
        usedIn: u, usedTotal: total,
        // 🔒 مرشّح للحذف: بلا استعمال وبلا جدولة
        idle: total === 0 && !(Array.isArray(m.schedule) && m.schedule.length),
      };
    });
    const keepers = enriched.filter((r) => !r.idle);
    const idle = enriched.filter((r) => r.idle);
    // 🔒 لا نحذف مجموعة بأكملها — لا بد أن يبقى صنف واحد على الأقل
    const drop = keepers.length > 0 ? idle : idle.slice(1);
    out.push({
      key: k, rows: enriched,
      dropIds: drop.map((r) => r.id),
      keepCount: enriched.length - drop.length,
    });
  }
  out.sort((a, b) => b.dropIds.length - a.dropIds.length);
  return out;
}

/** 🔍 معاينة — لا تحذف شيئاً. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const g = await survey(ctx);
    return {
      dupGroups: g.length,
      willDelete: g.reduce((s, x) => s + x.dropIds.length, 0),
      groups: g,
    };
  },
});

/** ✅ حذف — ADMIN فقط. يُعيد الفحص لكل صف قبل حذفه. */
export const purge = mutation({
  args: { sessionToken: v.optional(v.string()), confirm: v.literal("DELETE") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const g = await survey(ctx);
    const use = await usageMap(ctx);
    let deleted = 0, skipped = 0;
    for (const grp of g) {
      for (const id of grp.dropIds) {
        const cur: any = await ctx.db.get(id as any);
        // 🔒 فحص أخير: قد يكون الصف استُعمل أو جُدول بعد المعاينة
        const u = use.get(String(id)) ?? {};
        const total = Object.values(u).reduce((a: number, b: any) => a + b, 0);
        if (!cur || total > 0 || (Array.isArray(cur.schedule) && cur.schedule.length)) { skipped++; continue; }
        // الصورة مشتركة بين النسخ أحياناً — لا نلمس التخزين هنا،
        // فتنظيف الملفات اليتيمة له أداة مستقلة (storageCleanup).
        await ctx.db.delete(id as any);
        deleted++;
      }
    }
    return { deleted, skipped };
  },
});
