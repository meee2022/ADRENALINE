// convex/stickers.ts
import { query, mutation } from "./_generated/server";
import { normalizePhone } from "./lib/phone";
import { estimateCalories, estimateFromParts } from "./lib/calories";
import { requireStaff } from "./sessions";
import { v } from "convex/values";

type PlanStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PREPARED"
  | "DELIVERED"
  | "CANCELLED";

function isPrintableStatus(s: any) {
  const x = String(s || "").toUpperCase() as PlanStatus;
  return x !== "DRAFT" && x !== "CANCELLED";
}

function getEffectivePlanItems(planOrItems: any): any[] {
  const items = Array.isArray(planOrItems)
    ? planOrItems
    : Array.isArray(planOrItems?.items)
      ? planOrItems.items
      : [];
  const isImportedOrderSnapshot = (item: any) =>
    Boolean(item?.mealId) && !item?.menuItemId && !item?.id && !item?.categoryId;
  const importedCount = items.filter(isImportedOrderSnapshot).length;
  const editorManagedCount = items.filter(
    (item: any) => Boolean(item?.id || item?.categoryId || item?.menuItemId),
  ).length;
  return importedCount > 0 && importedCount === editorManagedCount
    ? items.filter((item: any) => !isImportedOrderSnapshot(item))
    : items;
}

function isoToDDMMYYYY(iso: string) {
  // iso = yyyy-MM-dd
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function applyStickerCalorieOverride(sticker: any, calories: number) {
  const targetCalories = Math.max(1, Math.round(Number(calories) || 0));
  const originalCalories = Number(sticker?.calories || 0);
  const protein = Number(sticker?.protein || 0);
  const carbs = Number(sticker?.carbs || 0);
  const fats = Number(sticker?.fats || 0);
  const macroCalories = protein * 4 + carbs * 4 + fats * 9;
  const baseCalories = originalCalories > 0 ? originalCalories : macroCalories;

  if (macroCalories <= 0 || baseCalories <= 0) {
    return { ...sticker, calories: targetCalories, caloriesText: `${targetCalories} CAL` };
  }

  const ratio = targetCalories / baseCalories;
  const scale = (value: number) => Math.round(value * ratio * 10) / 10;
  return {
    ...sticker,
    calories: targetCalories,
    caloriesText: `${targetCalories} CAL`,
    macros: undefined,
    protein: protein > 0 ? scale(protein) : sticker.protein,
    carbs: carbs > 0 ? scale(carbs) : sticker.carbs,
    fats: fats > 0 ? scale(fats) : sticker.fats,
  };
}


function buildModifierText(
  modifierIds: string[] | undefined,
  modifiers: any[],
) {
  const ids = modifierIds || [];
  if (!ids.length) return "";

  const picked = ids
    .map((id) => modifiers.find((m: any) => String(m._id) === String(id)))
    .filter(Boolean);

  if (!picked.length) return "";

  // ⇄ الاستبدال أولاً وبصيغة بارزة (RICE → MASHED POTATO) — الشيف يراه فوراً
  const swaps = picked
    .filter((m: any) => m.group === "SWAP")
    .map((m: any) => {
      const from = String(m.swapFrom || "").trim();
      const to = String(m.swapTo || "").trim();
      return from && to ? `${from} → ${to}` : String(m.name || "").trim();
    })
    .filter(Boolean);

  const groups: Array<"AVOID" | "PREF" | "PORTION"> = [
    "AVOID",
    "PREF",
    "PORTION",
  ];

  const lines = groups
    .map((g) => {
      const names = picked
        .filter((m: any) => m.group === g)
        .map((m: any) => m.name);

      if (!names.length) return null;
      return `${g}: ${names.join(", ")}`;
    })
    .filter(Boolean) as string[];

  if (swaps.length) lines.unshift(`⇄ ${swaps.join(" · ")}`);
  return lines.join(" | ");
}

/** ✅ مجموع فرق السعرات من الاستبدالات المختارة — يُطبَّق تلقائياً على الاستيكر. */
function swapCaloriesDelta(modifierIds: string[] | undefined, modifiers: any[]): number {
  return (modifierIds || []).reduce((sum, id) => {
    const m: any = modifiers.find((x: any) => String(x._id) === String(id));
    return m && m.group === "SWAP" ? sum + (Number(m.caloriesDelta) || 0) : sum;
  }, 0);
}

/**
 * ✅ روستر اليوم مرتّباً أبجدياً (معرّفات المشتركين) — مصدر واحد للترقيم،
 *    يستخدمه الاستعلام (ترقيم حي احتياطي) والحفظ (ensureBoxNumbers) معاً
 *    حتى لا يختلف المنطق بينهما. يشمل عملاء الخطط العادية + المخصّصين لكل الأوقات.
 */
async function computeDayRosterOrderedIds(ctx: any, date: string): Promise<string[]> {
  const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayKey = DOW[new Date(date + "T00:00:00Z").getUTCDay()];
  const settings = await ctx.db.query("restaurantSettings").first();
  const curWk = Number((settings as any)?.currentCookingWeek) || 1;
  let fridays = 0;
  {
    const todayISO0 = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const cc0 = new Date(todayISO0 + "T00:00:00Z");
    const endD0 = new Date(String(date).slice(0, 10) + "T00:00:00Z");
    for (let i = 0; i < 400 && cc0 < endD0; i++) { cc0.setUTCDate(cc0.getUTCDate() + 1); if (cc0.getUTCDay() === 5) fridays++; }
  }
  const rotWeek = ((curWk - 1 + fridays) % 4) + 1;
  const activeSlots = (tpl: any): any[] => {
    const sl: any = tpl.slots;
    const weekDays = sl?.weeks ? (sl.weeks[rotWeek] || sl.weeks[String(rotWeek)])?.days : null;
    const days = weekDays || sl?.days;
    const slots: any[] = Array.isArray(days?.[dayKey]) ? days[dayKey] : Array.isArray(sl) ? sl : [];
    return slots.filter((s) => s && s.type !== "OFF" && (s.baseName || s.text || s.proteinG));
  };
  const plansAll = await ctx.db.query("dailyPlans").withIndex("by_date", (q: any) => q.eq("date", date)).collect();
  const templates = await ctx.db.query("customizedTemplates").collect();
  const tplIds = new Set(templates.map((t: any) => String(t.customerId)));
  // (أ) العاديون (خطط يومية، غير مخصّصين) و(ب) المخصّصون (قوالب) — منفصلان.
  const regularIds = new Set<string>();
  for (const p of plansAll as any[]) {
    if (!isPrintableStatus(p.status)) continue;
    if (!p.customerId || tplIds.has(String(p.customerId))) continue;
    regularIds.add(String(p.customerId));
  }
  const customizedIds = new Set<string>();
  for (const tpl of templates as any[]) {
    const cid = String(tpl.customerId);
    if (regularIds.has(cid)) continue;
    const c: any = await ctx.db.get(tpl.customerId);
    if (!c || !c.isActive) continue;
    if (activeSlots(tpl).length) customizedIds.add(cid);
  }
  // ترتيب كل مجموعة أبجدياً، ثم: العاديون 1..R، والمخصّصون يكمّلون R+1..N.
  const loadSorted = async (ids: Set<string>): Promise<string[]> => {
    const cs = (await Promise.all(Array.from(ids).map((id) => ctx.db.get(id as any)))).filter(Boolean);
    cs.sort((a: any, b: any) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "ar"));
    return cs.map((c: any) => String(c._id));
  };
  const regularOrdered = await loadSorted(regularIds);
  const customizedOrdered = await loadSorted(customizedIds);
  return [...regularOrdered, ...customizedOrdered];
}

/**
 * ✅ تجميد أرقام البوكس ليوم معيّن — تُستدعى من صفحة الستيكرات عند فتح اليوم.
 *    أول مرة: تُسنِد 1..N أبجدياً. بعدها: أي مشترك جديد ياخد رقماً مُلحقاً فقط،
 *    والأرقام القائمة لا تتحرك أبداً — فالكشف والستيكرات لا يختلفان خلال اليوم.
 */
export const ensureBoxNumbers = mutation({
  args: { date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const orderedIds = await computeDayRosterOrderedIds(ctx, args.date);
    const existing = await ctx.db
      .query("stickerBoxNumbers")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    // 🧹 (1) تنظيف: صفوف تشير لعميل لم يعد موجوداً في القاعدة (حُذف بعد التجميد).
    //     هذه هي مصدر الفجوات في أرقام البوكس (#4, #30 … عند المطبخ).
    //     نحذف فقط المحذوفين فعلاً — لا نلمس من خرج مؤقتاً من الروستر حتى لا يتغيّر رقمه.
    const alive: any[] = [];
    let removed = 0;
    for (const e of existing as any[]) {
      const c = await ctx.db.get(e.customerId);
      if (!c) { await ctx.db.delete(e._id); removed += 1; continue; }
      alive.push(e);
    }

    // 🔢 (2) رصّ الأرقام 1..N بلا فجوات — بنفس الترتيب القائم، فلا يتبدّل ترتيب أحد.
    alive.sort((a: any, b: any) => (a.boxNo || 0) - (b.boxNo || 0));
    let seq = 0;
    let renumbered = 0;
    for (const e of alive) {
      seq += 1;
      if (Number(e.boxNo) !== seq) { await ctx.db.patch(e._id, { boxNo: seq }); renumbered += 1; }
    }

    // ➕ (3) الجدد يكمّلون في الآخر (لا يزحزحون أحداً) — نفس السلوك السابق.
    const assigned = new Set(alive.map((e: any) => String(e.customerId)));
    const now = Date.now();
    let created = 0;
    for (const id of orderedIds) {
      if (assigned.has(id)) continue;
      seq += 1;
      await ctx.db.insert("stickerBoxNumbers", { date: args.date, customerId: id as any, boxNo: seq, createdAt: now });
      created += 1;
    }
    return { total: orderedIds.length, created, removed, renumbered, frozen: alive.length + created };
  },
});

export const setCalorieOverride = mutation({
  args: {
    date: v.string(),
    customerId: v.id("customers"),
    stickerKey: v.string(),
    calories: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireStaff(ctx, args.sessionToken);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("تاريخ الاستيكر غير صالح");
    const stickerKey = args.stickerKey.trim();
    if (!stickerKey || stickerKey.length > 300) throw new Error("معرّف الاستيكر غير صالح");

    const existing = await ctx.db
      .query("stickerCalorieOverrides")
      .withIndex("by_date_key", (q) => q.eq("date", args.date).eq("stickerKey", stickerKey))
      .first();

    if (args.calories == null) {
      if (existing) await ctx.db.delete(existing._id);
      return { saved: false };
    }

    const calories = Math.round(args.calories);
    if (!Number.isFinite(calories) || calories < 1 || calories > 3000) {
      throw new Error("يجب أن تكون السعرات بين 1 و3000");
    }

    const values = {
      customerId: args.customerId,
      calories,
      updatedBy: identity.userId as any,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
    } else {
      await ctx.db.insert("stickerCalorieOverrides", {
        date: args.date,
        stickerKey,
        ...values,
      });
    }
    return { saved: true, calories };
  },
});

export const clearCalorieOverrides = mutation({
  args: { date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db
      .query("stickerCalorieOverrides")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { removed: rows.length };
  },
});

/**
 * ✅ IMPORTANT:
 * الواجهة بتنادي api.stickers.get
 * فهنا لازم يكون export const get = query(...)
 */
export const get = query({
  args: {
    date: v.string(), // yyyy-MM-dd
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING"), v.literal("ALL")),
    lang: v.optional(v.string()), // "en" | "ar" — لغة أسماء الوجبات على الاستيكر
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const calorieOverrideRows = await ctx.db
      .query("stickerCalorieOverrides")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const calorieOverrideByKey = new Map(
      calorieOverrideRows.map((row: any) => [String(row.stickerKey), row]),
    );
    const withStoredCalorieOverride = (sticker: any, stickerKey: string) => {
      const stored = calorieOverrideByKey.get(stickerKey) as any;
      const base = { ...sticker, stickerKey, calorieOverrideSaved: Boolean(stored) };
      return stored ? applyStickerCalorieOverride(base, stored.calories) : base;
    };
    // 1) Plans of date + deliveryTime (confirmed only). "ALL" = صباحي + مسائي معاً.
    const plansAll = await ctx.db
      .query("dailyPlans")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    const wantAll = args.deliveryTime === "ALL";
    // 🔀 المخصّص الذي بُني له قالب: مصدره القالب (الكود بالأسفل)، فنستبعد أي خطة
    //    يومية قديمة له هنا — وإلا فازت الخطة على القالب وطُبع استيكر قديم.
    //    من لا قالب له تبقى خطته تعمل (fallback أثناء الانتقال).
    const tplCustomerIds = new Set(
      (await ctx.db.query("customizedTemplates").collect()).map((t: any) => String(t.customerId)),
    );
    const plans = plansAll.filter(
      (p: any) =>
        (wantAll || String(p.deliveryTime || "") === args.deliveryTime) &&
        isPrintableStatus(p.status) &&
        !(p.customerId && tplCustomerIds.has(String(p.customerId))),
    );

    // ملاحظة: لا نرجع مبكراً عند غياب الخطط العادية — العملاء المخصّصون
    // وجباتهم في القوالب (مش dailyPlans)، وكودهم بالأسفل يحتاج أن يعمل دائماً.

    // 2) Load customers for this session's plans
    // ✅ نتجاهل الخطط بدون customerId (طلبات غير مربوطة بمشترك) حتى لا يتعطّل
    //    ctx.db.get("undefined") — نعتمد على customerName لها لاحقاً.
    const customerIds = Array.from(
      new Set(plans.map((p: any) => p.customerId).filter(Boolean).map((id: any) => String(id))),
    );

    const customers = await Promise.all(
      customerIds.map((id) => ctx.db.get(id as any)),
    );

    const customerMap = new Map<string, any>();
    customers
      .filter(Boolean)
      .forEach((c: any) => customerMap.set(String(c._id), c));

    // 0) ✅ ترقيم بوكس ثابت لليوم كامله (صباحي + مسائي) — لا يتغيّر بفلتر التوصيل.
    //    يُحسب مرة واحدة على كل مشتركي اليوم مرتّبين أبجدياً، فرقم كل مشترك ثابت
    //    سواء عرضت «صباحي» أو «مسائي» أو «الكل»، ويطابق كشف اليوم.
    const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayKey = DOW[new Date(args.date + "T00:00:00Z").getUTCDay()];
    const settings = await ctx.db.query("restaurantSettings").first();
    const curWk = Number((settings as any)?.currentCookingWeek) || 1;
    let fridaysToDate = 0;
    {
      const todayISO0 = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const cc0 = new Date(todayISO0 + "T00:00:00Z");
      const endD0 = new Date(String(args.date).slice(0, 10) + "T00:00:00Z");
      for (let i = 0; i < 400 && cc0 < endD0; i++) { cc0.setUTCDate(cc0.getUTCDate() + 1); if (cc0.getUTCDay() === 5) fridaysToDate++; }
    }
    const rotWeek = ((curWk - 1 + fridaysToDate) % 4) + 1;
    // دالة: خانات القالب الفعّالة في هذا اليوم (بغض النظر عن وقت التوصيل)
    const tplActiveSlots = (tpl: any): any[] => {
      const sl: any = tpl.slots;
      const weekDays = sl?.weeks ? (sl.weeks[rotWeek] || sl.weeks[String(rotWeek)])?.days : null;
      const days = weekDays || sl?.days;
      const slots: any[] = Array.isArray(days?.[dayKey]) ? days[dayKey] : Array.isArray(sl) ? sl : [];
      return slots.filter((s) => s && s.type !== "OFF" && (s.baseName || s.text || s.proteinG));
    };
    // روستر اليوم المرتّب (دالة مشتركة) — ترقيم حي احتياطي ثم نُفضّل الأرقام المجمّدة.
    const allTemplates = await ctx.db.query("customizedTemplates").collect();
    const orderedIds = await computeDayRosterOrderedIds(ctx, args.date);
    const customerNoById = new Map<string, number>();
    orderedIds.forEach((id, idx) => customerNoById.set(id, idx + 1)); // احتياطي قبل التجميد
    // ✅ لو اليوم مُجمّد (ensureBoxNumbers)، نستخدم الأرقام المخزّنة — تمنع أي تغيير خلال اليوم
    const frozenRows = await ctx.db
      .query("stickerBoxNumbers")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    for (const f of frozenRows as any[]) customerNoById.set(String(f.customerId), f.boxNo);

    // 3) Collect menuItemIds from plans
    const menuItemIds = new Set<string>();
    plans.forEach((p: any) => {
      getEffectivePlanItems(p).forEach((it: any) => {
        if (it?.isOff) return;
        if (it?.menuItemId) menuItemIds.add(String(it.menuItemId));
      });
    });

    const menuItems = await Promise.all(
      Array.from(menuItemIds).map((id) => ctx.db.get(id as any)),
    );

    const menuMap = new Map<string, any>();
    menuItems
      .filter(Boolean)
      .forEach((m: any) => menuMap.set(String(m._id), m));

    // ✅ خريطة التصنيفات (categoryId → اسم) لعرض نوع الوجبة على الستيكر
    const categoriesAll = await ctx.db.query("mealCategories").collect();
    const categoryById = new Map<string, string>();
    categoriesAll.forEach((cat: any) => categoryById.set(String(cat._id), String(cat.name || "")));
    // تطبيع اسم التصنيف لعرض موحّد
    const catLabel = (raw: string): string => {
      const n = String(raw || "").toUpperCase();
      if (n.includes("BREAKFAST") || n.includes("فطور") || n.includes("فطار")) return "BREAKFAST";
      if (n.includes("LUNCH") || n.includes("غداء")) return "LUNCH";
      if (n.includes("DINNER") || n.includes("عشاء")) return "DINNER";
      if (n.includes("SNACK") || n.includes("سناك")) return "SNACK";
      if (n.includes("SALAD") || n.includes("سلطة") || n.includes("سلطات")) return "SALAD";
      return String(raw || "").trim().toUpperCase();
    };

    // ✅ تحميل publicMeals كمصدر إضافي للماكروز (مطابقة بالاسم)
    const publicMealsAll = await ctx.db.query("publicMeals").collect();
    const publicMealsById = new Map<string, any>();
    const publicMealsByName = new Map<string, any>();
    publicMealsAll.forEach((pm: any) => {
      publicMealsById.set(String(pm._id), pm);
      // مفاتيح متعددة للمطابقة (عربي + إنجليزي + lowercase)
      if (pm.nameAr) publicMealsByName.set(String(pm.nameAr).trim().toLowerCase(), pm);
      if (pm.nameEn) publicMealsByName.set(String(pm.nameEn).trim().toLowerCase(), pm);
    });

    // 4) Modifiers
    const portion = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "PORTION"))
      .collect();

    const avoid = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "AVOID"))
      .collect();

    const pref = await ctx.db
      .query("modifiers")
      .withIndex("by_group_sort", (q) => q.eq("group", "PREF"))
      .collect();

    const modifiers = [...portion, ...avoid, ...pref];

    const dateText = isoToDDMMYYYY(args.date);

    // ✅ مُعامل السعرات حسب برنامج العميل (دايت/لياقة/تضخيم) — من إعدادات المطعم.
    //    يسري على الأطباق الرئيسية فقط (غداء/عشاء): هي التي تتغيّر حصتها بالهدف.
    //    نفس منطق عرض المنيو للعميل، فالاستيكر يطابق ما رآه.
    const restSettings: any = await ctx.db.query("restaurantSettings").first();
    // fallback = قيم كشف المطبخ 7-7-2026 — تعمل حتى قبل أول حفظ من الإعدادات
    /* معاملات الحصص معايَرة على ملفات DATABASE (1-6 · 7-7 · 28-7) — 1519 صفاً
       و44 طبقاً — لا على تقدير، ومن مصدرين متفقين:
         • جدول السعرات الرسمي فيها: غداء 450 → 560 → 630 ⇒ ×1.24 و×1.40.
         • نفس الطبق عبر الباقات: وسيط الفتنس ×1.27، والبلك 1.49 و1.51
           (سلمون كاري · شاورما) مقابل 1.20 لراب واحد لا يتمدّد خبزه.
       والدايت أساس لا يُضرب — وسيطه في التطبيق 375 يطابق DATABASE (373 غداء
       و380 عشاء)، فالأساس سليم والخلل كان في المعامل وحده.
       الفطار والسناك لا يُضربان أصلاً (isMainCourse)، وDATABASE يؤكّد ذلك:
       فطار 298/280/280 وسناك 133/138/138 عبر الباقات الثلاث. */
    const pp = restSettings?.programPortions || {
      DIET: { calFactor: 1 },
      FITNESS: { calFactor: 1.25 },
      BULK: { calFactor: 1.4 },
    };
    const factorFor = (program: string): number => {
      if (!pp) return 1;
      const prog = String(program || "").toUpperCase();
      if (prog.includes("DIET")) return Number(pp.DIET?.calFactor) || 1;
      if (prog.includes("FITNESS")) return Number(pp.FITNESS?.calFactor) || 1;
      if (prog.includes("BULK")) return Number(pp.BULK?.calFactor) || 1;
      return 1;
    };
    const isMainCourse = (category: string) => {
      const c = String(category || "").toUpperCase();
      return c.includes("LUNCH") || c.includes("DINNER");
    };

    // ✅ تواريخ الإنتاج والصلاحية (يوم الإنتاج + يومين)
    const prodDate = dateText;
    const expDateObj = (() => {
      const d = new Date(args.date);
      d.setDate(d.getDate() + 2);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy}`;
    })();
    const expDate = expDateObj;

    // helper: استخراج تحذيرات نظيفة (avoid + allergies) كنص قصير
    const buildWarnings = (cust: any, modifierIds: string[] | undefined) => {
      const parts: string[] = [];
      // من العميل
      const allergies = String(cust?.allergies || "").trim();
      const custAvoid = String(cust?.avoid || "").trim();
      if (allergies) parts.push(allergies);
      if (custAvoid) parts.push(custAvoid);
      // من الـ modifiers (AVOID فقط)
      const ids = modifierIds || [];
      const avoidMods = ids
        .map((id) => modifiers.find((m: any) => String(m._id) === String(id)))
        .filter((m: any) => m && m.group === "AVOID")
        .map((m: any) => m.name);
      if (avoidMods.length) parts.push(avoidMods.join(", "));
      return parts.join(" • ");
    };

    // ---------- Build BOX stickers ----------
    const boxBase = plans
      .map((p: any) => {
        const c = customerMap.get(String(p.customerId));
        if (!c) return null;

        const planLabel =
          (c.packageLabel && String(c.packageLabel).trim()) ||
          (c.program && String(c.program).trim()) ||
          "DIET";

        const customerId = String(c._id);
        const customerNo = customerNoById.get(customerId) ?? 0;

        return {
          customerId,
          customerNo,
          customerName: c.fullName || "",
          customerNumber: normalizePhone(c.phone) || "",
          goal: String((c as any).goalType || (c as any).goals || "").trim(),
          // ✅ هدف/برنامج العميل (BULK / DIET / FITNESS) لعرضه على ستيكر البوكس
          program: String(c.program || (c as any).goalType || "").trim(),
          // وقت التوصيل من الخطة نفسها (عشان خيار "الكل" يعرض الوردية الصح لكل عميل)
          deliveryTime: String(p.deliveryTime || args.deliveryTime),
          planLabel,
          dateText,
          prodDate,
          expDate,
        };
      })
      .filter(Boolean) as any[];

    // ترتيب البوكس حسب رقم العميل الحقيقي (مش الاسم)
    boxBase.sort((a, b) => (a.customerNo ?? 0) - (b.customerNo ?? 0));

    // وده الناتج النهائي (خليت slNo = customerNo علشان الواجهة القديمة لو بتستخدمه)
    const boxStickers = boxBase.map((b) => ({
      ...b,
      slNo: b.customerNo, // ✅ نفس رقم العميل
    }));

    // ---------- Build MEAL stickers ----------
    const mealStickers: any[] = [];

    for (const p of plans) {
      const c = customerMap.get(String(p.customerId));
      if (!c) continue;

      const customerId = String(c._id);
      const customerNo = customerNoById.get(customerId) ?? 0;

      // ✅ لا نشترط menuItemId — الخطط المستوردة/اليدوية تحمل الاسم نصاً (mealNameEn)
      const items = getEffectivePlanItems(p)
        .filter((it: any) => it && !it.isOff && (
          it.publicMealId || it.mealId || it.menuItemId || it.mealNameEn || it.mealNameAr
        ))
        .slice();

      // ترتيب حسب meta.index لو موجود
      items.sort(
        (a: any, b: any) => (a?.meta?.index ?? 0) - (b?.meta?.index ?? 0),
      );

      let mealIndex = 1;

      for (const it of items) {
        const menu = it.menuItemId ? menuMap.get(String(it.menuItemId)) : null;
        // ✅ الاسم العربي (للبحث في publicMeals) — menuItems الداخلي فيه name واحد
        const arName = (menu as any)?.nameAr || menu?.name || it.mealNameAr || it.mealNameEn || "UNKNOWN";
        // ✅ اسم البحث ثابت (عربي) للمطابقة مع publicMeals مهما كانت لغة العرض
        const lookupName = arName;
        // ✅ تصنيف الوجبة (Lunch / Breakfast / Snack / Dinner)
        const category = catLabel(
          categoryById.get(String((menu as any)?.categoryId || (it as any).categoryId || "")) || String((it as any).category || ""),
        );

        // ✅ مطابقة بـ publicMeals بالاسم للحصول على ماكروز كاملة
        const exactPublicMealId = it.publicMealId || it.mealId || (menu as any)?.publicMealId;
        const pmLookup = publicMealsById.get(String(exactPublicMealId || ""))
          || publicMealsByName.get(String(lookupName).trim().toLowerCase())
          || publicMealsByName.get(String((menu as any)?.nameAr || "").trim().toLowerCase())
          || publicMealsByName.get(String((menu as any)?.nameEn || "").trim().toLowerCase());

        // ✅ اسم العرض بلغة الواجهة: إنجليزي من (لقطة الطلب / publicMeals) وإلا العربي
        const legacyMenuName = (menu as any)?.nameEn || (menu as any)?.name || (menu as any)?.nameAr;
        const mealName = args.lang === "en"
          ? (it.mealNameEn || (it.menuItemId ? legacyMenuName : null) || (pmLookup as any)?.nameEn || lookupName)
          : lookupName;

        // خطط الأخصائية مبنية على menuItems: قيم الوجبة الحالية أولاً، ثم لقطة
        // الخطة القديمة، والمنيو العام احتياطي فقط. هذا يبقي استيكر الأربعاء
        // متزامناً مع تصحيح التغذية من دون تغيير اختيار الوجبة المحفوظ.
        const itemProtein = Number((it as any).protein ?? 0) || 0;
        const itemCarbs   = Number((it as any).carbs   ?? 0) || 0;
        const itemFats    = Number((it as any).fats    ?? 0) || 0;
        const itemCalories = Number((it as any).calories ?? 0) || 0;

        const baseProtein = Number(pmLookup?.protein ?? 0) || Number((menu as any)?.protein ?? 0) || itemProtein || 0;
        const baseCarbs   = Number(pmLookup?.carbs   ?? 0) || Number((menu as any)?.carbs   ?? 0) || itemCarbs   || 0;
        const baseFats    = Number(pmLookup?.fats    ?? 0) || Number((menu as any)?.fats    ?? 0) || itemFats    || 0;
        const baseCalories = Number(pmLookup?.calories ?? 0) || Number(menu?.calories ?? 0) || itemCalories || 0;

        // ✅ غداء/عشاء: القيم تُضرب في مُعامل برنامج العميل (الحصة أكبر/أصغر
        //    حسب الهدف). الماكروز تُضرب بنفس النسبة حتى يبقى الاستيكر متسقاً
        //    (السعرات = مجموع الماكروز). باقي التصنيفات حصتها ثابتة.
        // برنامج العميل قد يكون في program أو goalType أو goals (بيانات قديمة)
        const f = isMainCourse(category) ? factorFor(String(c.program || (c as any).goalType || (c as any).goals || "")) : 1;
        let protein  = Math.round(baseProtein * f);
        let carbs    = Math.round(baseCarbs * f);
        let fats     = Math.round(baseFats * f);
        // ✅ أولوية السعرات على الستيكر:
        //   1) سعرات مخصّصة لهذه الوجبة بالذات لهذا المشترك (mealCalorieOverrides) — أعلى أولوية، تُطبع كما هي.
        //   2) سعرات الوجبة الرئيسية اليدوية (mainMealCalories) — للأطباق الرئيسية فقط.
        //   3) المحسوبة × مُعامل البرنامج.
        const normName = (s: any) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
        const ovr = Array.isArray((c as any).mealCalorieOverrides) ? (c as any).mealCalorieOverrides : [];
        const names = [lookupName, mealName, (menu as any)?.nameAr, (menu as any)?.nameEn, it.mealNameAr, it.mealNameEn].map(normName).filter(Boolean);
        const perMeal = ovr.find((o: any) => names.includes(normName(o.meal)) && Number(o.calories) > 0);
        const custCal = isMainCourse(category) ? Number((c as any).mainMealCalories) : 0;
        const explicitCalories = perMeal ? Math.round(Number(perMeal.calories))
          : custCal > 0 ? Math.round(custCal) : 0;
        const programCode = String(c.program || (c as any).goalType || (c as any).goals || "").toUpperCase();
        /* المدى **شبكة أمان ضد رقم شاذّ، لا أداة ضبط**.
           الأرضية العالية كانت تُسطّح المنيو: 9 أطباق بلك خرجت كلها 450 لأنها
           رُفعت للأرضية، فبدت السلطة والباستا سواء. والسقف كان يقصّ أطباق دايت
           حقيقية عند 380 بينما DATABASE فيه 389 و410.
           الأرضية الآن 250 لكل الباقات — تمسك رقماً منهاراً (وجبة بلا ماكروز)
           ولا ترفع طبقاً خفيفاً ليبدو ثقيلاً. الأطباق الخفيفة تبقى خفيفة. */
        const automaticRange = isMainCourse(category)
          ? programCode.includes("CUSTOM")
            ? { min: 250, max: 660 }
            : programCode.includes("BULK")
            ? { min: 250, max: 660 }   // DATABASE يصل 596، وجدول 1800 سعرة يعطي غداء 630
            : programCode.includes("FITNESS")
              ? { min: 250, max: 570 } // DATABASE يصل 493، وجدول 1600 يعطي 560
              : programCode.includes("DIET")
                ? { min: 250, max: 440 } // أعلى دايت في DATABASE 410
                : { min: 250, max: 570 }
          : String(category || "").toUpperCase().includes("BREAKFAST")
            ? { min: 0, max: 310 }
            : { min: 0, max: Number.POSITIVE_INFINITY };
        const macroCalories = protein * 4 + carbs * 4 + fats * 9;
        const automaticCalories = macroCalories > 0 ? macroCalories : Math.round(baseCalories * f);
        const boundedCalories = Math.max(automaticRange.min, Math.min(automaticCalories, automaticRange.max));
        const targetCalories = explicitCalories > 0 ? explicitCalories : boundedCalories;

        // Keep every printed override/range adjustment consistent: P*4 + C*4 + F*9.
        if (macroCalories > 0 && targetCalories !== macroCalories) {
          const ratio = targetCalories / macroCalories;
          protein = Math.max(0, Math.round(protein * ratio));
          carbs = Math.max(0, Math.round(carbs * ratio));
          fats = Math.max(0, Math.round(fats * ratio));
        }
        let calories = protein || carbs || fats
          ? protein * 4 + carbs * 4 + fats * 9
          : targetCalories;

        // ⇄ استبدال مكوّن (رز ← بطاطس مهروسة): فرق السعرات يُطبَّق تلقائياً هنا،
        //    ويُوزَّع على الماكروز بنفس النسبة. التعديل اليدوي للسعرات
        //    (withStoredCalorieOverride) يأتي بعده فيبقى هو الأعلى أولوية.
        const swapDelta = swapCaloriesDelta(it.modifierIds, modifiers);
        if (swapDelta !== 0 && calories > 0) {
          const adjusted = Math.max(1, Math.round(calories + swapDelta));
          const r = adjusted / calories;
          if (protein > 0) protein = Math.max(0, Math.round(protein * r));
          if (carbs > 0) carbs = Math.max(0, Math.round(carbs * r));
          if (fats > 0) fats = Math.max(0, Math.round(fats * r));
          calories = adjusted;
        }

        const hasMacros = protein > 0 || carbs > 0 || fats > 0;

        // النص الكامل للملاحظات (للنسخة القديمة)
        const modText = buildModifierText(it.modifierIds, modifiers);
        const special = String(it.specialNotes || "")
          .replace(/\[(?:⚠|✕|⚖|★)[^\]]*\]/g, "")
          .trim();

        // ✅ الكمية النصّية من الخطط المستوردة (مثال: 200 جم لمون تشيكن + 180 جم رز)
        const portionsText = String(it.portions || "").trim();
        // ✅ جرامات مخصّصة للوجبة الرئيسية (كارب/بروتين) تُطبع على الاستيكر لمن حُدِّد له
        const cCarb = isMainCourse(category) ? Number((c as any).carbGrams) : 0;
        const cProt = isMainCourse(category) ? Number((c as any).proteinGrams) : 0;
        const customGText = [
          cCarb > 0 ? (args.lang === "en" ? `Carb ${cCarb}g` : `كارب ${cCarb}جم`) : "",
          cProt > 0 ? (args.lang === "en" ? `Protein ${cProt}g` : `بروتين ${cProt}جم`) : "",
        ].filter(Boolean).join(" + ");
        const extraParts = [special, portionsText, customGText, modText].filter(Boolean);
        const mealTitle = extraParts.length
          ? `${mealName} — ${extraParts.join(" | ")}`
          : mealName;

        // تحذيرات نظيفة منفصلة (avoid على مستوى العميل + الوجبة + الحساسية)
        const warnings = [buildWarnings(c, it.modifierIds), String(it.avoid || "").trim()]
          .filter(Boolean)
          .join(" • ");

        // Macros string fallback من menuItem
        const macrosStr = String((menu as any)?.macros || "").trim();

        const sourceItemKey = String(
          (it as any).id || it.publicMealId || it.mealId || it.menuItemId || it.mealNameEn || it.mealNameAr || mealIndex,
        );
        const stickerKey = `plan:${String((p as any)._id)}:${sourceItemKey}:${mealIndex}`;
        const stk = {
          customerId,
          customerNo,
          customerName: c.fullName || "",
          customerNumber: normalizePhone(c.phone) || "",
          goal: String((c as any).goalType || (c as any).goals || "").trim(),
          category,
          mealName,
          mealTitle,
          warnings,
          caloriesText: calories ? `${calories} CAL` : "",
          calories: calories || undefined,
          macros: macrosStr || undefined,
          protein: hasMacros ? protein : undefined,
          carbs:   hasMacros ? carbs   : undefined,
          fats:    hasMacros ? fats    : undefined,
          dateText,
          prodDate,
          expDate,
          mealIndexText: `MEAL ${mealIndex}`,
        };
        mealStickers.push(withStoredCalorieOverride(stk, stickerKey));
        // ✅ يوم الخميس: العميل المفعّل (fridayDouble) يأخذ نسخة ثانية = بوكس الجمعة
        //    (نفس الوجبة، موسومة [جمعة]). يوم الخميس فقط، ولا يمسّ باقي الأيام.
        if (dayKey === "thursday" && (c as any).fridayDouble) {
          mealStickers.push(withStoredCalorieOverride({
            ...stk,
            mealTitle: `${mealTitle}${args.lang === "en" ? " — [Friday]" : " — [جمعة]"}`,
          }, stickerKey + ":fri"));
        }

        mealIndex++;
      }
    }

    // ---------- ✅ استيكرات العملاء المخصّصين (من القوالب) ----------
    //    العملاء المخصّصون وجباتهم في customizedTemplates (مش dailyPlans)، فلازم
    //    نولّد استيكراتهم هنا بالإنجليزي + سعرات تقريبية من الكميات.
    {
      const AR2EN: Record<string, string> = {
        "دجاج": "Chicken", "دجاج مشوي": "Grilled chicken", "دجاج بانيه": "Crispy chicken",
        "شيش طاووق": "Shish tawook", "سمك": "Fish", "سمك مشوي": "Grilled fish", "سلمون": "Salmon",
        "ستيك": "Steak", "لحم بقري": "Beef", "لحم مفروم": "Minced beef", "كفتة": "Kofta",
        "جمبري": "Shrimp", "ديك رومي": "Turkey", "تونة": "Tuna", "بيض": "Eggs", "بياض بيض": "Egg whites",
        "رز أبيض": "White rice", "رز بني": "Brown rice", "رز بسمتي": "Basmati rice", "رز مصري": "Egyptian rice",
        "باستا": "Pasta", "بطاطس": "Potato", "بطاطس مهروسة": "Mashed potato", "بطاطا حلوة": "Sweet potato",
        "خبز": "Bread", "خبز أسمر": "Brown bread", "برغل": "Bulgur", "كينوا": "Quinoa", "شوفان": "Oats", "بدون": "None",
      };
      /** ترجمة اسم عربي → إنجليزي: (1) جدول البروتين/الكارب، ثم (2) بحث في منيو
       *  publicMeals بالاسم العربي فنأخذ nameEn. الاستيكر إنجليزي دائماً للمطبخ،
       *  فأي صنف عربي (سلطة الفستق/مافن/شوربة الفطر…) يُترجَم تلقائياً. */
      const en = (n: any) => {
        const raw = String(n || "").trim();
        if (!raw) return "";
        const mapped = AR2EN[raw];
        if (mapped) return mapped;
        const pm: any = publicMealsByName.get(raw.toLowerCase());
        if (pm?.nameEn) return String(pm.nameEn).trim();
        return raw;
      };
      const engText = (s: any): string => {
        const baseName = String(s.baseName || "").trim();
        const protName = String(s.proteinName || "").trim();
        const baseHasGramPortions = /\d+(?:\.\d+)?\s*(?:g\b|gm\b|جم|جرام)/i.test(baseName);
        // ✅ خانة رئيسية غير محدّدة (لا اسم وجبة ولا نوع بروتين) = يوم لم يُملأ →
        //    لا نطبع أكلاً وهمياً (Protein 150g) على الستيكر يلخبط الشيف.
        if (s.type === "MAIN" && !baseName && !protName) return "⚠ NOT SET";
        const parts: string[] = [];
        if (baseName) parts.push(en(baseName));
        if (s.type === "MAIN") {
          const inner: string[] = [];
          if (!baseHasGramPortions && protName && s.proteinG) inner.push(`${en(protName)} ${s.proteinG}g`);
          if (!baseHasGramPortions && s.carbG && String(s.carbName || "").trim() && !/^none|بدون/i.test(String(s.carbName))) inner.push(`${en(s.carbName)} ${s.carbG}g`);
          if (inner.length) parts.push(parts.length ? `+ ${inner.join(" + ")}` : inner.join(" + "));
        }
        // ✅ الاحتياطي أيضاً يمرّ على الترجمة — لا يتسرّب اسم عربي للاستيكر
        return (parts.join(" ").trim() || en(String(s.text || baseName || "").trim()));
      };

      const stickered = new Set(mealStickers.map((s) => String(s.customerId)));
      for (const tpl of allTemplates) {
        const c: any = await ctx.db.get(tpl.customerId);
        if (!c || !c.isActive) continue;
        if (stickered.has(String(c._id))) continue; // تجنّب تكرار من عنده dailyPlans
        const cTime = String(c.deliveryTime || "MORNING");
        if (args.deliveryTime !== "ALL" && cTime !== args.deliveryTime) continue;

        const active = tplActiveSlots(tpl);
        if (!active.length) continue;

        const customerNo = customerNoById.get(String(c._id)) ?? 0; // ✅ رقم ثابت من روستر اليوم
        const warnings = [String(c.allergies || "").trim(), String(c.avoid || "").trim()].filter(Boolean).join(" • ");

        // ✅ استيكر بوكس للمخصّص أيضاً — boxBase يُبنى من dailyPlans فقط، والمخصّصون
        //    وجباتهم في القوالب، فكانوا بلا أي استيكر بوكس (29 عميلاً). نضيفه هنا
        //    بنفس شكل العاديين ليطبعه التغليف.
        boxStickers.push({
          customerId: String(c._id),
          customerNo,
          slNo: customerNo,
          customerName: c.fullName || "",
          customerNumber: normalizePhone(c.phone) || "",
          goal: String(c.goalType || c.goals || "").trim(),
          program: String(c.program || c.goalType || "").trim(),
          deliveryTime: cTime,
          planLabel:
            (c.packageLabel && String(c.packageLabel).trim()) ||
            (c.program && String(c.program).trim()) ||
            "CUSTOMIZED",
          dateText,
          prodDate,
          expDate,
        });

        let mIdx = 1;
        for (const s of active) {
          const mealName = engText(s);
          if (!mealName) continue;
          const canonicalSnack = s.type === "SNACK"
            ? (publicMealsByName.get(String(s.baseName || "").trim().toLowerCase())
              || publicMealsByName.get(mealName.trim().toLowerCase()))
            : undefined;
          const snackProtein = Number(canonicalSnack?.protein || 0);
          const snackCarbs = Number(canonicalSnack?.carbs || 0);
          const snackFats = Number(canonicalSnack?.fats || 0);
          const rawCal = mealName === "⚠ NOT SET" ? 0
            : Number(canonicalSnack?.calories || 0)
              || estimateCalories(mealName)
              || estimateFromParts(s.proteinName, s.proteinG, s.carbName, s.carbG);
          // Customized main meals use the larger portion band requested by operations.
          // Preserve differences between portions while avoiding extreme printed estimates.
          const cal = s.type === "MAIN"
            ? Math.min(560, 500 + Math.round(Math.max(0, rawCal - 500) * 0.1))
            : rawCal;
          const stickerKey = `custom:${String((tpl as any)._id)}:${mIdx}`;
          mealStickers.push(withStoredCalorieOverride({
            customerId: String(c._id),
            customerNo,
            customerName: c.fullName || "",
            customerNumber: normalizePhone(c.phone) || "",
            goal: "CUSTOMIZED",
            category: s.type === "SNACK" ? "SNACK" : "LUNCH",
            mealName,
            mealTitle: s.notes ? `${mealName} — ${String(s.notes).trim()}` : mealName,
            warnings,
            caloriesText: cal ? `${cal} CAL` : "",
            calories: cal || undefined,
            macros: canonicalSnack ? `P ${snackProtein} • C ${snackCarbs} • F ${snackFats}` : undefined,
            protein: canonicalSnack ? snackProtein : undefined,
            carbs: canonicalSnack ? snackCarbs : undefined,
            fats: canonicalSnack ? snackFats : undefined,
            dateText, prodDate, expDate,
            mealIndexText: `MEAL ${mIdx}`,
          }, stickerKey));
          mIdx++;
        }
      }
    }

    /* ترتيب الطباعة: **فطار → سناك → غداء → عشاء**.
       المطبخ يحضّر السناكات كلها معاً، فتأتي رزمة واحدة بعد الفطار كما يطلبها
       الطاقم. والسلطات معها لأنها تُحضَّر في نفس المحطة.
       (تقسيم السناك إلى «سناك 1/2/3» بين الوجبات غير ممكن اليوم: كل السناكات
       تصنيف واحد بلا ترقيم — 197 سناكاً في 28-7 كلها بلا index.) */
    const catRank = (s: any) => {
      const c = String(s.category || "").toUpperCase();
      if (c.includes("BREAKFAST")) return 0;
      if (c.includes("SNACK") || c.includes("SALAD")) return 1;
      if (c.includes("LUNCH")) return 2;
      if (c.includes("DINNER")) return 3;
      return 4;
    };
    mealStickers.sort((a, b) => {
      const r = catRank(a) - catRank(b);
      if (r !== 0) return r;

      const n = (a.customerNo ?? 0) - (b.customerNo ?? 0);
      if (n !== 0) return n;

      const ai = Number(String(a.mealIndexText).replace(/\D/g, "")) || 0;
      const bi = Number(String(b.mealIndexText).replace(/\D/g, "")) || 0;
      return ai - bi;
    });

    // ✅ إعادة الترتيب برقم البوكس بعد إضافة بوكسات المخصّصين (تُدفَع في آخر المصفوفة)
    boxStickers.sort((a: any, b: any) => (a.customerNo ?? 0) - (b.customerNo ?? 0));

    return { boxStickers, mealStickers };
  },
});
