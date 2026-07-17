/**
 * @file convex/menuSync.ts
 * @description مزامنة جدولة المنيو مع جدول الإكسل الرسمي — معاينة ثم تطبيق.
 *
 *   ═══ المرجع ═══
 *   ملفا الإكسل (إنجليزي/عربي) هما خطة المطبخ: لكل (أسبوع, يوم) خياران
 *   لكل خانة (فطور/سناك1/غداء/سناك2/عشاء). الخياران كلاهما يظهر للمشترك،
 *   والوجبة المتكرّرة داخل اليوم (سناك1 = سناك2) تظهر مرة واحدة.
 *   الناتج: 9 وجبات مميّزة لكل يوم × 24 يوماً = 216.
 *
 *   ═══ ما تفعله ═══
 *   تجعل جدولة publicMeals **نسخة طبق الأصل** من الإكسل:
 *     - أي (أسبوع, يوم) في الإكسل ⇒ الوجبة مجدولة له
 *     - أي جدولة في القاعدة ليست في الإكسل ⇒ تُشال
 *   ولا تحذف أي وجبة: الجدولة فقط. الطلبات والمراجع تبقى سليمة، والخطوة
 *   رجّاعة بإعادة الجدولة.
 *
 *   ═══ الصيغة ═══
 *   توحّد الجدولة في `schedule[]` وتفرّغ `weeks[]/days[]` — الصيغتان معاً
 *   كانتا مصدر بق (المنيو يقرأ واحدة والذكية الأخرى).
 *
 *   ⚠️ الجدول مولّد من الإكسل عبر tmp/parse_excel.py — لا يُحرّر يدوياً.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";
import { OFFICIAL } from "./menuOfficial";

/**
 * توحيد الاسم للمطابقة بين الإكسل والقاعدة.
 *
 * ⚠️ الترتيب مقصود: نصحّح **قبل** إزالة المسافات. لو أزلناها أولاً تتلزق
 *    الكلمات وتتصادم القواعد — «Vegetable Soup» تصير «vegetablesoup» فتلتقط
 *    قاعدةُ الجمع «vegetables» داخلها وتحوّلها «vegetableoup».
 *    لذلك نعمل على النص المفصول بحدود كلمات، ثم نضغط في النهاية.
 */
function norm(s: any): string {
  let x = " " + String(s || "").toLowerCase() + " ";
  x = x.replace(/&/g, " and ").replace(/w\//g, " with ").replace(/[\/\-_,.()]/g, " ");
  x = x.replace(/\s+/g, " ");
  /* تصحيح تحريفات المصدر — بحدود كلمات، فلا تتسرّب داخل كلمة أخرى. */
  const FIX: [RegExp, string][] = [
    [/\bhuumus\b/g, "hummus"], [/\bcroisant\b/g, "croissant"],
    [/\bwaldoraf\b/g, "waldorf"], [/\bter+[iy]?aki\b/g, "teriyaki"],
    [/\bomelete\b/g, "omelette"], [/\bstra?gann?of+\b/g, "stroganoff"],
    [/\bstroganof\b/g, "stroganoff"], [/\bceasar\b/g, "caesar"],
    [/\bmangolian\b/g, "mongolian"], [/\bslamon\b/g, "salmon"],
    [/\bspaghett?e\b/g, "spaghetti"], [/\bfalafal\b/g, "falafel"],
    [/\bvindalo+\b/g, "vindaloo"], [/\bfattouch\b/g, "fattoush"],
    [/\bbriyani\b/g, "biryani"], [/\bshawerma\b/g, "shawarma"],
    [/\bharps\b/g, "herbs"], [/\bcreamu\b/g, "creamy"],
    [/\bzaater\b/g, "zaatar"], [/\bbahamas\b/g, "bahama"],
    [/\brizotto\b/g, "risotto"], [/\bbrocoli\b/g, "broccoli"],
    [/\bsaf+r[oa]n\b/g, "saffron"], [/\bs[iy]adia?h\b/g, "sayadieh"],
    [/\bpenn[ei]\b/g, "penn"], [/\bblue\b/g, "bleu"],
    // جمع/مفرد — بحدود كلمات فلا تأكل حروف الكلمة التالية
    [/\bvegetables\b/g, "vegetable"], [/\bpeppers\b/g, "pepper"],
    [/\bpotatoes\b/g, "potato"], [/\bquesadillas\b/g, "quesadilla"],
    [/\bpancakes\b/g, "pancake"], [/\bseeds\b/g, "seed"],
    [/\bballs\b/g, "ball"], [/\bdates\b/g, "date"], [/\bnoodels\b/g, "noodles"],
    // «NEW …» بادئة استيراد تسرّبت لأسماء الإكسل نفسها
    [/^\s*new\s+/, " "],
    // الإكسل يسقط "and": TURKEY CHEESE WRAP ⇄ Turkey and Cheese Wrap
    [/\band\b/g, " "],
  ];
  for (const [re, b] of FIX) x = x.replace(re, b);
  return x.replace(/[^a-z0-9]/g, "");   // الضغط في النهاية فقط
}

/**
 * درجة اكتمال الوجبة — لاختيار الفائز بين نسختين لنفس الطبق.
 * الترتيب: الاكتمال أولاً (سعر/سعرات ⇒ نسخة حقيقية لا بقايا استيراد)،
 * ثم — بقرار صاحب المطعم — **الأقل سعرات** عند تساوي الاكتمال.
 */
function completeness(m: any): number[] {
  const cal = Number(m.calories || 0);
  return [
    Number(m.priceQAR || 0) > 0 ? 1 : 0,
    cal > 0 ? 1 : 0,
    (m.tags?.length || 0) > 0 ? 1 : 0,
    m.isActive ? 1 : 0,
    cal > 0 ? -cal : 0,                    // ⬅️ الأقل سعرات يكسب
    -(m._creationTime || 0),
  ];
}
function better(a: any, b: any): any {
  const A = completeness(a), B = completeness(b);
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return A[i] > B[i] ? a : b;
  return a;
}

async function build(ctx: any) {
  const meals = await ctx.db.query("publicMeals").collect();
  const byNorm = new Map<string, any[]>();
  for (const m of meals as any[]) {
    const k = norm(m.nameEn);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k)!.push(m);
  }

  /** الفائز لكل اسم في الإكسل — نسخة واحدة تُجدول، والباقي يُشال من الجدولة. */
  const winner = new Map<string, any>();   // normName → meal
  const unmatched: string[] = [];
  const chosen: any[] = [];
  const names = new Set<string>();
  for (const day of Object.values(OFFICIAL)) for (const n of day as string[]) names.add(n);

  for (const raw of names) {
    const k = norm(raw);
    const cands = byNorm.get(k) || [];
    if (!cands.length) { unmatched.push(raw); continue; }
    const w = cands.reduce(better);
    winner.set(k, w);
    if (cands.length > 1) {
      chosen.push({
        excel: raw,
        picked: `${w.nameAr} | ${w.nameEn} | ${w.priceQAR} ر.ق | ${w.calories} سعرة`,
        dropped: cands.filter((c: any) => c._id !== w._id)
          .map((c: any) => `${c.nameAr} | ${c.nameEn} | ${c.priceQAR} ر.ق | ${c.calories} سعرة`),
      });
    }
  }

  /** الجدولة المستهدفة لكل وجبة فائزة. */
  const target = new Map<string, Set<string>>();  // mealId → "week:day"
  for (const [key, list] of Object.entries(OFFICIAL)) {
    for (const raw of list as string[]) {
      const w = winner.get(norm(raw));
      if (!w) continue;
      const id = String(w._id);
      if (!target.has(id)) target.set(id, new Set());
      target.get(id)!.add(key);
    }
  }

  return { meals, winner, unmatched, chosen, target };
}

/**
 * مراجع الوجبة عبر الجداول الثمانية. الوجبة المكررة تُحذف **فقط** لو صفر
 * مراجع — وإلا تُشال من الجدولة وتبقى، فالطلبات وكتالوج المنافذ تظل سليمة.
 */
async function refCounts(ctx: any) {
  const [posItems, posLines, issu, ordItems, rat, outlet, gymL, gymRet] = await Promise.all([
    ctx.db.query("posItems").collect(),
    ctx.db.query("posTicketLines").collect(),
    ctx.db.query("mealIssuances").collect(),
    ctx.db.query("customerOrderItems").collect(),
    ctx.db.query("ratings").collect(),
    ctx.db.query("outletCatalogItems").collect(),
    ctx.db.query("gymOrderLines").collect(),
    ctx.db.query("gymReturnBatchLines").collect(),
  ]);
  const count = new Map<string, Record<string, number>>();
  const bump = (id: any, where: string) => {
    const k = String(id ?? "");
    if (!k) return;
    if (!count.has(k)) count.set(k, {});
    const r = count.get(k)!;
    r[where] = (r[where] || 0) + 1;
  };
  for (const r of ordItems) bump((r as any).mealId, "orders");
  for (const r of posLines) bump((r as any).mealId, "posTickets");
  for (const r of posItems) bump((r as any).mealId, "posItems");
  for (const r of outlet) bump((r as any).mealId, "outletCatalog");
  for (const r of gymL) bump((r as any).mealId, "outletOrders");
  for (const r of gymRet) bump((r as any).mealId, "outletReturns");
  for (const r of issu) bump((r as any).publicMealId, "issuances");
  for (const r of rat) bump((r as any).publicMealId, "ratings");
  return count;
}

function cur(m: any): Set<string> {
  const out = new Set<string>();
  if (Array.isArray(m.schedule) && m.schedule.length) {
    for (const s of m.schedule) out.add(`${Number(s.week)}:${String(s.day).toLowerCase()}`);
  } else {
    for (const w of (m.weeks || [])) for (const d of (m.days || [])) out.add(`${Number(w)}:${String(d).toLowerCase()}`);
  }
  return out;
}

/** 🔍 معاينة — لا تكتب شيئاً. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const { meals, unmatched, chosen, target } = await build(ctx);
    const refs = await refCounts(ctx);

    let addSlots = 0, dropSlots = 0, unscheduled = 0, changed = 0;
    const samples: any[] = [];
    for (const m of meals as any[]) {
      const now = cur(m);
      const want = target.get(String(m._id)) || new Set<string>();
      const add = [...want].filter((x) => !now.has(x));
      const drop = [...now].filter((x) => !want.has(x));
      if (!add.length && !drop.length) continue;
      changed++;
      addSlots += add.length; dropSlots += drop.length;
      if (!want.size && now.size) unscheduled++;
      if (samples.length < 25) samples.push({ meal: `${m.nameAr} | ${m.nameEn}`, add, drop });
    }
    /* الوجبات اللي هتفضل بلا جدولة: تُحذف لو صفر مراجع، وتبقى لو مستخدمة. */
    const deletable: any[] = [], keepUnscheduled: any[] = [];
    for (const m of meals as any[]) {
      const want = target.get(String(m._id));
      if (want && want.size) continue;             // لسه مجدولة
      if (!cur(m).size) continue;                  // مكانتش مجدولة أصلاً — لا تُمسّ
      const r = refs.get(String(m._id)) || {};
      const total = Object.values(r).reduce((a: number, b: any) => a + b, 0);
      const row = { meal: `${m.nameAr} | ${m.nameEn}`, refs: r };
      (total ? keepUnscheduled : deletable).push(row);
    }

    return {
      summary: {
        excelSlots: Object.values(OFFICIAL).reduce((s, v: any) => s + v.length, 0),
        excelDays: Object.keys(OFFICIAL).length,
        mealsChanged: changed,
        slotsAdded: addSlots,
        slotsRemoved: dropSlots,
        mealsFullyUnscheduled: unscheduled,
        excelNamesWithNoMeal: unmatched.length,
        willDelete: deletable.length,
        keepButUnscheduled: keepUnscheduled.length,
      },
      unmatched,
      duplicateChoices: chosen,
      deletable,
      keepUnscheduled,
      samples,
    };
  },
});

/** ✅ تطبيق — ADMIN فقط. يكتب الجدولة فقط ويوحّدها في schedule[]. */
export const apply = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const { meals, unmatched, target } = await build(ctx);
    const refs = await refCounts(ctx);
    // 🔒 لا نكتب لو في اسم في الإكسل بلا وجبة — الصورة ناقصة، والنتيجة تبقى منيو ناقص
    if (unmatched.length) {
      throw new Error(`أسماء في الإكسل بلا وجبة مطابقة (${unmatched.length}): ${unmatched.slice(0, 5).join(" · ")}`);
    }
    let updated = 0;
    for (const m of meals as any[]) {
      const now = cur(m);
      const want = target.get(String(m._id)) || new Set<string>();
      const same = now.size === want.size && [...want].every((x) => now.has(x));
      if (same && Array.isArray(m.schedule) && !(m.weeks?.length || m.days?.length)) continue;
      const schedule = [...want].map((x) => {
        const [w, d] = x.split(":");
        return { week: Number(w), day: d };
      });
      // نوحّد الصيغة: schedule[] هو المصدر، وweeks/days تُفرَّغ
      await ctx.db.patch(m._id, { schedule, weeks: [], days: [] });
      updated++;
    }

    /* حذف المكرر غير المستخدم — بقرار صاحب المطعم. أي مرجع واحد يمنع الحذف
     * فتبقى الوجبة بلا جدولة (مخفية عن المشترك) وطلباتها سليمة. */
    let deleted = 0;
    const kept: string[] = [];
    for (const m of meals as any[]) {
      const want = target.get(String(m._id));
      if (want && want.size) continue;
      if (!cur(m).size) continue;
      const r = refs.get(String(m._id)) || {};
      const total = Object.values(r).reduce((a: number, b: any) => a + b, 0);
      if (total) { kept.push(`${m.nameAr} (${Object.keys(r).join("·")})`); continue; }
      if ((m as any).storageId) { try { await ctx.storage.delete((m as any).storageId); } catch { /* ignore */ } }
      await ctx.db.delete(m._id);
      deleted++;
    }
    return { updated, deleted, keptBecauseUsed: kept };
  },
});
