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

function isoToDDMMYYYY(iso: string) {
  // iso = yyyy-MM-dd
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
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

  return lines.join(" | ");
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
  const rosterIds = new Set<string>();
  for (const p of plansAll as any[]) {
    if (!isPrintableStatus(p.status)) continue;
    if (!p.customerId || tplIds.has(String(p.customerId))) continue;
    rosterIds.add(String(p.customerId));
  }
  for (const tpl of templates as any[]) {
    const cid = String(tpl.customerId);
    if (rosterIds.has(cid)) continue;
    const c: any = await ctx.db.get(tpl.customerId);
    if (!c || !c.isActive) continue;
    if (activeSlots(tpl).length) rosterIds.add(cid);
  }
  const rosterCustomers = (await Promise.all(
    Array.from(rosterIds).map((id) => ctx.db.get(id as any)),
  )).filter(Boolean);
  rosterCustomers.sort((a: any, b: any) =>
    String(a.fullName || "").localeCompare(String(b.fullName || ""), "ar"));
  return rosterCustomers.map((c: any) => String(c._id));
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
    const assigned = new Set(existing.map((e: any) => String(e.customerId)));
    let maxNo = existing.reduce((m: number, e: any) => Math.max(m, e.boxNo || 0), 0);
    const now = Date.now();
    let created = 0;
    for (const id of orderedIds) {
      if (assigned.has(id)) continue;
      maxNo += 1;
      await ctx.db.insert("stickerBoxNumbers", { date: args.date, customerId: id as any, boxNo: maxNo, createdAt: now });
      created += 1;
    }
    return { total: orderedIds.length, created, frozen: existing.length + created };
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
      (p.items || []).forEach((it: any) => {
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
    const pp = restSettings?.programPortions || {
      DIET: { calFactor: 1 },
      FITNESS: { calFactor: 1.08 },
      BULK: { calFactor: 1.15 },
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
      const items = (p.items || [])
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
        const protein  = Math.round(baseProtein * f);
        const carbs    = Math.round(baseCarbs * f);
        const fats     = Math.round(baseFats * f);
        // ✅ أولوية السعرات على الستيكر:
        //   1) سعرات مخصّصة لهذه الوجبة بالذات لهذا المشترك (mealCalorieOverrides) — أعلى أولوية، تُطبع كما هي.
        //   2) سعرات الوجبة الرئيسية اليدوية (mainMealCalories) — للأطباق الرئيسية فقط.
        //   3) المحسوبة × مُعامل البرنامج.
        const normName = (s: any) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
        const ovr = Array.isArray((c as any).mealCalorieOverrides) ? (c as any).mealCalorieOverrides : [];
        const names = [lookupName, mealName, (menu as any)?.nameAr, (menu as any)?.nameEn, it.mealNameAr, it.mealNameEn].map(normName).filter(Boolean);
        const perMeal = ovr.find((o: any) => names.includes(normName(o.meal)) && Number(o.calories) > 0);
        const custCal = isMainCourse(category) ? Number((c as any).mainMealCalories) : 0;
        const calories = perMeal ? Math.round(Number(perMeal.calories))
          : custCal > 0 ? Math.round(custCal)
          : Math.round(baseCalories * f);

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

        mealStickers.push({
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
        });

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
      const en = (n: any) => AR2EN[String(n || "").trim()] || String(n || "").trim();
      const engText = (s: any): string => {
        const baseName = String(s.baseName || "").trim();
        const protName = String(s.proteinName || "").trim();
        // ✅ خانة رئيسية غير محدّدة (لا اسم وجبة ولا نوع بروتين) = يوم لم يُملأ →
        //    لا نطبع أكلاً وهمياً (Protein 150g) على الستيكر يلخبط الشيف.
        if (s.type === "MAIN" && !baseName && !protName) return "⚠ NOT SET";
        const parts: string[] = [];
        if (baseName) parts.push(en(baseName));
        if (s.type === "MAIN") {
          const inner: string[] = [];
          if (protName && s.proteinG) inner.push(`${en(protName)} ${s.proteinG}g`);
          if (s.carbG && String(s.carbName || "").trim() && !/^none|بدون/i.test(String(s.carbName))) inner.push(`${en(s.carbName)} ${s.carbG}g`);
          if (inner.length) parts.push(parts.length ? `+ ${inner.join(" + ")}` : inner.join(" + "));
        }
        return (parts.join(" ").trim() || String(s.text || baseName || "").trim());
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
        let mIdx = 1;
        for (const s of active) {
          const mealName = engText(s);
          if (!mealName) continue;
          const cal = estimateCalories(mealName) || estimateFromParts(s.proteinName, s.proteinG, s.carbName, s.carbG);
          mealStickers.push({
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
            macros: undefined,
            protein: undefined, carbs: undefined, fats: undefined,
            dateText, prodDate, expDate,
            mealIndexText: `MEAL ${mIdx}`,
          });
          mIdx++;
        }
      }
    }

    // ترتيب الطباعة: حسب نوع الوجبة (فطور → غداء → عشاء → سلطة → سناك) ثم العميل ثم رقم الوجبة
    const catRank = (s: any) => {
      const c = String(s.category || "").toUpperCase();
      if (c.includes("BREAKFAST")) return 0;
      if (c.includes("LUNCH")) return 1;
      if (c.includes("DINNER")) return 2;
      if (c.includes("SALAD")) return 3;
      if (c.includes("SNACK")) return 4;
      return 5;
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

    return { boxStickers, mealStickers };
  },
});
