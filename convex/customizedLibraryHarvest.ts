/**
 * @file convex/customizedLibraryHarvest.ts
 * @description حصاد نصوص الوجبات المخصّصة من الخطط المستوردة → مكتبة الأطباق.
 *
 *   ═══ الخلفية ═══
 *   اتستوردت وجبات قديمة لعملاء مخصّصين عشان تبقى «مكتبة» تختار منها الأخصائية
 *   بدل ما تكتب. لكن الاستيراد نزل في dailyPlans (نص في mealNameEn/mealNameAr
 *   بلا menuItemId)، بينما مكتبة الأطباق اللي بتعرضها الواجهة (customizedPlans.presets)
 *   بتقرأ من:
 *     1) customizedTemplates  — قوالب العملاء
 *     2) customizedDishLibrary — أطباق حرة بالاسم
 *   فالنصوص المستوردة كانت غير مرئية للأخصائية.
 *
 *   ═══ الحل ═══
 *   نحصد النصوص الفريدة من خطط المخصّصين ونضيفها لـcustomizedDishLibrary.
 *   لا نحذف الخطط ولا نلمس القوالب — إضافة فقط.
 *
 *   ═══ نطاق التأثير ═══
 *   يكتب في customizedDishLibrary فقط. لا يمس publicMeals/menuItems/posItems/
 *   outletCatalogItems — فلا علاقة له بمنيو العميل ولا الأونلاين ولا المنافذ.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";

/** توحيد النص للمقارنة (مسافات + حالة الأحرف). */
function norm(s: string): string {
  return String(s || "").trim().replace(/\s+/g, " ").toUpperCase();
}

/** هل العميل مخصّص؟ (نفس القاعدة المستخدمة في listCustomized) */
function isCustomized(c: any): boolean {
  return String(c?.program || c?.goalType || c?.goals || "").toUpperCase().includes("CUSTOM");
}

/**
 * تخمين النوع (MAIN/SNACK) — قيمة أولية فقط، الأخصائية تقدر تعدّل.
 *
 * ⚠️ لا نبدأ من category القادم من الاستيراد: الكشف القديم فيه أطباق رئيسية
 *    مسجّلة snack (مثل "180 G BEEF STROGANOF +150 G RICE")، فلو اعتمدنا عليه
 *    ظهر الطبق في منتقي السناك. نقرأ النص نفسه أولاً:
 *      بروتين رئيسي أو نشويات ⇒ MAIN
 *      حلويات بلا بروتين      ⇒ SNACK
 *      غير حاسم               ⇒ نرجع لـcategory
 */
function guessType(text: string, category?: string): "MAIN" | "SNACK" {
  const t = norm(text);
  const mainProtein = /\b(CHICKEN|BEEF|STEAK|SALMON|FISH|SHRIMP|TAWOOK|SHISH\w*|KOFTA|TURKEY|LAMB|STROGANOF\w*|LASAGNA|BURRITO|SANDWICH|WRAP|CUTLETS?|SHAWARMA|MAJBOOS)\b/.test(t);
  const carb = /\b(RICE|PASTA|POTATO(ES)?|BREAD|NOODLES?|SPAGHETTI|QUINOA|BULGUR)\b/.test(t);
  const dessert = /\b(CAKE|BROWNIES?|COOKIES?|YOGURT|PUDDING|SMOOTHIE|MUFFINS?|TIRAMISU|BERRIES|FRUIT|TALBINA)\b/.test(t);

  if (dessert && !mainProtein) return "SNACK";
  if (mainProtein || carb) return "MAIN";
  const c = String(category || "").toLowerCase();
  if (c === "snack" || c === "salad") return "SNACK";
  return "MAIN";
}

/** يجمع الحقائق المشتركة بين preview و apply. */
async function analyze(ctx: any) {
  const customers = await ctx.db.query("customers").collect();
  const customIds = new Set(
    customers.filter((c: any) => c.isActive && isCustomized(c)).map((c: any) => String(c._id)),
  );

  // 1) النصوص الموجودة في المكتبة الحرة
  const library = await ctx.db.query("customizedDishLibrary").collect();
  const inLibrary = new Set(library.map((l: any) => norm(l.name)));

  // 2) النصوص المشتقّة من قوالب العملاء (presets بتعرضها أصلاً)
  const templates = await ctx.db.query("customizedTemplates").collect();
  const inTemplates = new Set<string>();
  for (const tpl of templates) {
    const sl: any = tpl.slots;
    const dayMaps: any[] = [];
    if (sl?.weeks && typeof sl.weeks === "object") {
      for (const wk of Object.values(sl.weeks)) if ((wk as any)?.days) dayMaps.push((wk as any).days);
    } else if (sl?.days && typeof sl.days === "object") dayMaps.push(sl.days);
    else if (Array.isArray(sl)) dayMaps.push({ _: sl });
    for (const days of dayMaps) {
      for (const arr of Object.values(days || {})) {
        if (!Array.isArray(arr)) continue;
        for (const s of arr as any[]) {
          if (!s || s.type === "OFF") continue;
          for (const key of [s.baseName, s.text]) if (key) inTemplates.add(norm(key));
        }
      }
    }
  }

  // 3) حصاد نصوص خطط المخصّصين
  const plans = await ctx.db.query("dailyPlans").collect();
  const found = new Map<string, { name: string; type: string; count: number }>();
  for (const p of plans) {
    if (!p.customerId || !customIds.has(String(p.customerId))) continue;
    for (const it of (Array.isArray(p.items) ? p.items : [])) {
      const raw = String(it?.mealNameEn || it?.mealNameAr || "").trim();
      if (!raw) continue;
      const k = norm(raw);
      const hit = found.get(k);
      if (hit) { hit.count++; continue; }
      found.set(k, { name: raw, type: guessType(raw, it?.category), count: 1 });
    }
  }

  const already: any[] = [];
  const toAdd: any[] = [];
  for (const [k, v] of found.entries()) {
    if (inLibrary.has(k) || inTemplates.has(k)) already.push(v);
    else toAdd.push(v);
  }
  toAdd.sort((a, b) => b.count - a.count);

  return { found, toAdd, already, libraryCount: library.length };
}

/**
 * 🔍 معاينة — لا تكتب أي شيء. تعرض بالضبط ما ستضيفه apply().
 */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const a = await analyze(ctx);
    return {
      summary: {
        textsFoundInPlans: a.found.size,
        alreadyVisibleToNutritionist: a.already.length,
        missingWillBeAdded: a.toAdd.length,
        dishLibraryNow: a.libraryCount,
        dishLibraryAfter: a.libraryCount + a.toAdd.length,
      },
      willAdd: a.toAdd,
    };
  },
});

/**
 * ✅ تنفيذ — ADMIN فقط. إضافة فقط (upsert بالاسم) — لا حذف ولا تعديل لأي جدول آخر.
 */
export const apply = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const a = await analyze(ctx);
    let inserted = 0;
    for (const item of a.toAdd) {
      // 🔒 فحص أخير مباشر قبل الإدراج — لا نعتمد على تحليل قديم
      const existing = await ctx.db
        .query("customizedDishLibrary")
        .withIndex("by_name", (q: any) => q.eq("name", item.name))
        .first();
      if (existing) continue;
      await ctx.db.insert("customizedDishLibrary", {
        name: item.name,
        type: item.type,
        count: item.count,
      });
      inserted++;
    }
    return { inserted, skippedAlreadyPresent: a.already.length };
  },
});
