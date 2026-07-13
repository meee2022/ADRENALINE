// convex/stickers.ts
import { query } from "./_generated/server";
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
    const plans = plansAll.filter(
      (p: any) =>
        (wantAll || String(p.deliveryTime || "") === args.deliveryTime) &&
        isPrintableStatus(p.status),
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

    // 0) الترقيم اليومي التسلسلي: فقط عملاء هذه الجلسة مرتبين أبجدياً
    // الشيف يرى أرقاماً من 1 لـ N كل يوم — بسيط ومنطقي للمطبخ
    const sessionCustomers = Array.from(customerMap.values())
      .sort((a, b) =>
        String(a.fullName || "").localeCompare(String(b.fullName || ""), "ar")
      );

    const customerNoById = new Map<string, number>();
    sessionCustomers.forEach((c, idx) => {
      customerNoById.set(String(c._id), idx + 1);
    });

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
    const publicMealsByName = new Map<string, any>();
    publicMealsAll.forEach((pm: any) => {
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
      FITNESS: { calFactor: 1.25 },
      BULK: { calFactor: 1.5 },
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
        .filter((it: any) => it && !it.isOff && (it.menuItemId || it.mealNameEn || it.mealNameAr))
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
        const pmLookup = publicMealsByName.get(String(lookupName).trim().toLowerCase())
          || publicMealsByName.get(String((menu as any)?.nameAr || "").trim().toLowerCase())
          || publicMealsByName.get(String((menu as any)?.nameEn || "").trim().toLowerCase());

        // ✅ اسم العرض بلغة الواجهة: إنجليزي من (لقطة الطلب / publicMeals) وإلا العربي
        const mealName = args.lang === "en"
          ? (it.mealNameEn || (pmLookup as any)?.nameEn || (menu as any)?.nameEn || lookupName)
          : lookupName;

        // ترتيب الأولوية: 1) item نفسه، 2) publicMeals، 3) menuItem
        const itemProtein = Number((it as any).protein ?? 0) || 0;
        const itemCarbs   = Number((it as any).carbs   ?? 0) || 0;
        const itemFats    = Number((it as any).fats    ?? 0) || 0;
        const itemCalories = Number((it as any).calories ?? 0) || 0;

        const baseProtein = itemProtein || Number(pmLookup?.protein ?? 0) || 0;
        const baseCarbs   = itemCarbs   || Number(pmLookup?.carbs   ?? 0) || 0;
        const baseFats    = itemFats    || Number(pmLookup?.fats    ?? 0) || 0;
        const baseCalories = itemCalories || Number(pmLookup?.calories ?? 0) || Number(menu?.calories ?? 0) || 0;

        // ✅ غداء/عشاء: القيم تُضرب في مُعامل برنامج العميل (الحصة أكبر/أصغر
        //    حسب الهدف). الماكروز تُضرب بنفس النسبة حتى يبقى الاستيكر متسقاً
        //    (السعرات = مجموع الماكروز). باقي التصنيفات حصتها ثابتة.
        // برنامج العميل قد يكون في program أو goalType أو goals (بيانات قديمة)
        const f = isMainCourse(category) ? factorFor(String(c.program || (c as any).goalType || (c as any).goals || "")) : 1;
        const protein  = Math.round(baseProtein * f);
        const carbs    = Math.round(baseCarbs * f);
        const fats     = Math.round(baseFats * f);
        const calories = Math.round(baseCalories * f);

        const hasMacros = protein > 0 || carbs > 0 || fats > 0;

        // النص الكامل للملاحظات (للنسخة القديمة)
        const modText = buildModifierText(it.modifierIds, modifiers);
        const special = String(it.specialNotes || "")
          .replace(/\[(?:⚠|✕|⚖|★)[^\]]*\]/g, "")
          .trim();

        // ✅ الكمية النصّية من الخطط المستوردة (مثال: 200 جم لمون تشيكن + 180 جم رز)
        const portionsText = String(it.portions || "").trim();
        const extraParts = [special, portionsText, modText].filter(Boolean);
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
        const parts: string[] = [];
        if (s.baseName) parts.push(en(String(s.baseName).trim()));
        if (s.type === "MAIN") {
          const inner: string[] = [];
          if (s.proteinG) inner.push(`${en(s.proteinName) || "Protein"} ${s.proteinG}g`);
          if (s.carbG && String(s.carbName || "").trim() && !/^none|بدون/i.test(String(s.carbName))) inner.push(`${en(s.carbName)} ${s.carbG}g`);
          if (inner.length) parts.push(parts.length ? `+ ${inner.join(" + ")}` : inner.join(" + "));
        }
        return (parts.join(" ").trim() || String(s.text || s.baseName || "").trim());
      };

      // أسبوع الدورة + يوم الأسبوع لهذا التاريخ (نفس منطق forDate)
      const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayKey = DOW[new Date(args.date + "T00:00:00Z").getUTCDay()];
      const settings = await ctx.db.query("restaurantSettings").first();
      const curWk = Number((settings as any)?.currentCookingWeek) || 1;
      const todayISO = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
      let fridays = 0;
      const cc = new Date(todayISO + "T00:00:00Z");
      const endD = new Date(String(args.date).slice(0, 10) + "T00:00:00Z");
      for (let i = 0; i < 400 && cc < endD; i++) { cc.setUTCDate(cc.getUTCDate() + 1); if (cc.getUTCDay() === 5) fridays++; }
      const rotWeek = ((curWk - 1 + fridays) % 4) + 1;

      const stickered = new Set(mealStickers.map((s) => String(s.customerId)));
      let custNo = mealStickers.length ? Math.max(...mealStickers.map((s) => Number(s.customerNo) || 0)) : 0;
      const templates = await ctx.db.query("customizedTemplates").collect();
      for (const tpl of templates) {
        const c: any = await ctx.db.get(tpl.customerId);
        if (!c || !c.isActive) continue;
        if (stickered.has(String(c._id))) continue; // تجنّب تكرار من عنده dailyPlans
        const cTime = String(c.deliveryTime || "MORNING");
        if (args.deliveryTime !== "ALL" && cTime !== args.deliveryTime) continue;

        const sl: any = tpl.slots;
        const weekDays = sl?.weeks ? (sl.weeks[rotWeek] || sl.weeks[String(rotWeek)])?.days : null;
        const days = weekDays || sl?.days;
        const slots: any[] = Array.isArray(days?.[dayKey]) ? days[dayKey] : Array.isArray(sl) ? sl : [];
        const active = slots.filter((s) => s && s.type !== "OFF" && (s.baseName || s.text || s.proteinG));
        if (!active.length) continue;

        custNo++;
        const warnings = [String(c.allergies || "").trim(), String(c.avoid || "").trim()].filter(Boolean).join(" • ");
        let mIdx = 1;
        for (const s of active) {
          const mealName = engText(s);
          if (!mealName) continue;
          const cal = estimateCalories(mealName) || estimateFromParts(s.proteinName, s.proteinG, s.carbName, s.carbG);
          mealStickers.push({
            customerId: String(c._id),
            customerNo: custNo,
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
