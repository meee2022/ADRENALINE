/**
 * @file convex/menuAlignment.ts
 * @description توحيد منيو المطبخ (menuItems) مع منيو العميل (publicMeals).
 *
 *   ═══ لماذا هذا الملف ═══
 *   المشروع فيه أربع قنوات منفصلة تماماً على مستوى الجداول:
 *     1) منيو المشتركين  → publicMeals.schedule + publicMeals.category
 *     2) الأونلاين        → posItems.posPrice + posCategories   (جدول منفصل)
 *     3) المنافذ          → outletCatalogItems                   (جدول منفصل)
 *     4) خانات المطبخ     → menuItems.categoryId → mealCategories
 *
 *   هذا الملف يلمس (4) فقط. لا يقرأ ولا يكتب في posItems/posCategories ولا
 *   outletCatalogItems ولا publicMeals — فلا يمكن أن يؤثر على الأونلاين أو المنافذ.
 *
 *   ═══ المشكلة ═══
 *   menuItems.categoryId بيانات داخلية قديمة انحرفت عن منيو العميل:
 *     - أصناف تشاور على تصنيفات محذوفة (تختفي من كل الخانات)
 *     - سناكات مصنّفة "فطور"
 *     - خانة "other" مليانة أصناف لكن لا تُستخدم في أي خطة
 *   publicMeals.category هو مصدر الحقيقة (نفس الحقل اللي بيفلتر بيه العميل).
 *
 *   ═══ الاستخدام ═══
 *   1) preview()  — تقرير كامل بلا أي كتابة. شغّلها الأول دائماً.
 *   2) apply()    — تنفّذ نفس التغييرات المعروضة في preview.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

/** تصنيف المنيو العام → أسماء خانات الأخصائية المقابلة (عربي/إنجليزي). */
const PUBLIC_CAT_ALIASES: Record<string, string[]> = {
  breakfast: ["breakfast", "فطور", "فطار", "الفطور", "الفطار"],
  lunch: ["lunch", "غداء", "الغداء"],
  dinner: ["dinner", "عشاء", "العشاء"],
  snack: ["snacks", "snack", "سناك", "سناكس", "سناكات"],
  salad: ["salad", "salads", "سلطات", "سلطة"],
};

/**
 * تطبيع اسم للمطابقة — يُبقي الحروف العربية (النسخة القديمة في الواجهة كانت
 * تمسحها فيفشل الرجوع للاسم العربي دائماً).
 */
function normName(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]/g, "")
    .replace(/s/g, "")
    .replace(/(.)\1+/g, "$1");
}

/** يبني: تصنيف عام → أول خانة مطابقة (نفضّل الأقل sortOrder = الخانة الأساسية). */
function buildSlotMap(cats: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [pubCat, aliases] of Object.entries(PUBLIC_CAT_ALIASES)) {
    const matches = cats
      .filter((c) => aliases.includes(String(c?.name || "").trim().toLowerCase()))
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    if (matches.length) out[pubCat] = matches[0];
  }
  return out;
}

/** يجمع الحقائق المشتركة بين preview و apply. */
async function analyze(ctx: any) {
  const cats = await ctx.db.query("mealCategories").collect();
  const menu = await ctx.db.query("menuItems").collect();
  const pubs = await ctx.db.query("publicMeals").collect();
  const plans = await ctx.db.query("dailyPlans").collect();

  const catIds = new Set(cats.map((c: any) => String(c._id)));
  const catName: Record<string, string> = {};
  for (const c of cats) catName[String(c._id)] = c.name;

  const slotMap = buildSlotMap(cats);

  // فهرس المنيو العام بالاسم المطبَّع (النشط له الأولوية)
  const pubByNorm = new Map<string, any>();
  for (const p of [...pubs].sort((a: any, b: any) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))) {
    for (const key of [p.nameEn, p.nameAr]) {
      const k = normName(String(key || ""));
      if (k && !pubByNorm.has(k)) pubByNorm.set(k, p);
    }
  }

  // كم خانة مستخدمة فعلياً في خطط محفوظة (لا نحذف أي خانة مستخدمة)
  const usedInPlans = new Set<string>();
  for (const pl of plans) {
    for (const it of (Array.isArray(pl.items) ? pl.items : [])) {
      if (it?.categoryId) usedInPlans.add(String(it.categoryId));
    }
  }

  // 1) إعادة تصنيف الأصناف حسب منيو العميل
  const reassign: any[] = [];
  const unmatched: any[] = [];
  for (const m of menu) {
    const pub = pubByNorm.get(normName(m.name));
    if (!pub) {
      if (!catIds.has(String(m.categoryId))) unmatched.push({ id: m._id, name: m.name, reason: "orphan+no-public-match" });
      continue;
    }
    const slot = slotMap[String(pub.category)];
    if (!slot) continue;
    if (String(m.categoryId) === String(slot._id)) continue; // مضبوط بالفعل
    reassign.push({
      id: m._id,
      name: m.name,
      from: catName[String(m.categoryId)] || "(محذوف)",
      to: slot.name,
      toId: slot._id,
      publicCategory: pub.category,
    });
  }

  // 2) خانات فاضية وغير مستخدمة (قابلة للحذف بأمان)
  const afterCounts: Record<string, number> = {};
  for (const c of cats) afterCounts[String(c._id)] = 0;
  const movedIds = new Set(reassign.map((r) => String(r.id)));
  for (const m of menu) {
    const moved = reassign.find((r) => String(r.id) === String(m._id));
    const finalCat = moved ? String(moved.toId) : String(m.categoryId);
    if (finalCat in afterCounts) afterCounts[finalCat]++;
  }
  const deletable = cats
    .filter((c: any) => afterCounts[String(c._id)] === 0 && !usedInPlans.has(String(c._id)))
    .map((c: any) => ({ id: c._id, name: c.name }));

  return { cats, menu, catIds, catName, slotMap, reassign, unmatched, afterCounts, deletable, usedInPlans };
}

/**
 * 🔍 معاينة — لا تكتب أي شيء. تعرض بالضبط ما ستفعله apply().
 */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const a = await analyze(ctx);
    return {
      summary: {
        totalMenuItems: a.menu.length,
        willReassign: a.reassign.length,
        orphansWithNoPublicMatch: a.unmatched.length,
        emptyCategoriesToDelete: a.deletable.length,
      },
      slotsAfter: a.cats.map((c: any) => ({
        name: c.name,
        itemsAfter: a.afterCounts[String(c._id)] || 0,
        usedInSavedPlans: a.usedInPlans.has(String(c._id)),
      })),
      reassign: a.reassign.slice(0, 200),
      unmatched: a.unmatched.slice(0, 50),
      deletable: a.deletable,
    };
  },
});

/**
 * ✅ تنفيذ — ADMIN فقط.
 *   - reassignCategories: يصحّح menuItems.categoryId من منيو العميل.
 *   - deleteEmptyCategories: يحذف الخانات الفاضية وغير المستخدمة في أي خطة محفوظة.
 *   لا يلمس publicMeals ولا posItems/posCategories ولا outletCatalogItems.
 *   الخطط المحفوظة تحتفظ بالـcategoryId بداخلها ولا تتأثر.
 */
export const apply = mutation({
  args: {
    reassignCategories: v.optional(v.boolean()),
    deleteEmptyCategories: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const a = await analyze(ctx);

    let reassigned = 0;
    if (args.reassignCategories) {
      for (const r of a.reassign) {
        await ctx.db.patch(r.id, { categoryId: r.toId });
        reassigned++;
      }
    }

    let deleted = 0;
    const deletedNames: string[] = [];
    if (args.deleteEmptyCategories) {
      for (const d of a.deletable) {
        // 🔒 فحص أخير مباشرة قبل الحذف — لا نعتمد على تحليل قديم
        const stillHas = await ctx.db
          .query("menuItems")
          .withIndex("by_categoryId", (q: any) => q.eq("categoryId", d.id))
          .take(1);
        if (stillHas.length > 0) continue;
        if (a.usedInPlans.has(String(d.id))) continue;
        await ctx.db.delete(d.id);
        deleted++;
        deletedNames.push(d.name);
      }
    }

    return { reassigned, deletedCategories: deleted, deletedNames };
  },
});
