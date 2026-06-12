/**
 * @file convex/ai.ts
 * @description مولّد الوجبات الذكي (المرحلة 1)
 *  - getSmartPlanData: يجمع بروفايل العميل + الوجبات المتاحة اليوم
 *  - generateSmartPlan: action تولّد خطة اليوم (Anthropic AI + fallback خوارزمي)
 *
 *  ملاحظات أمان:
 *   - الـAI يختار من قائمة الوجبات المتاحة فقط؛ أي ID مخترع يُتجاهَل.
 *   - مسار التليفون يرجّع الحد الأدنى من البيانات اللازمة للتوليد فقط.
 */
import { action, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// ─── أسماء أيام الأسبوع (تطابق publicMeals.schedule.day) ───
const WEEKDAYS = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];

// ─── السعرات المستهدفة التقريبية حسب الهدف ───
function targetCaloriesFor(goal: string | undefined): number {
  const g = (goal || "").toLowerCase();
  if (/(تنشيف|cut|diet|weight.?loss|تخسيس|رجيم)/.test(g)) return 1500;
  if (/(تضخيم|bulk|mass|gain|زيادة)/.test(g)) return 2600;
  return 2000; // توازن / محافظة (الافتراضي)
}

// ─── هل الوجبة ممنوعة على العميل؟ (مطابقة نصية بسيطة) ───
function isBlocked(meal: any, blockWords: string[]): boolean {
  if (blockWords.length === 0) return false;
  const hay = [
    meal.nameAr, meal.nameEn,
    ...(meal.ingredients || []),
    ...(meal.tags || []),
  ].join(" ").toLowerCase();
  return blockWords.some((w) => w && hay.includes(w));
}

/**
 * يجمع البروفايل + الوجبات المرشّحة المتاحة اليوم.
 * المصدر: إمّا customerId (مسجّل دخول) أو phone (بدون تسجيل).
 */
export const getSmartPlanData = query({
  args: {
    customerId: v.optional(v.id("customers")),
    phone: v.optional(v.string()),
    todayDay: v.optional(v.string()),  // اسم اليوم بالإنجليزي؛ يُمرّر من الـaction
    todayDate: v.optional(v.string()), // yyyy-MM-dd؛ يُمرّر من الـaction
  },
  handler: async (ctx, args) => {
    // 1) جلب اشتراك العميل
    let customer: any = null;
    if (args.customerId) {
      customer = await ctx.db.get(args.customerId);
    } else if (args.phone) {
      customer = await ctx.db
        .query("customers")
        .withIndex("by_phone", (q) => q.eq("phone", args.phone!))
        .first();
    }

    // 2) بناء بروفايل (الحد الأدنى — بدون اسم/عنوان/سعر)
    const profile = customer
      ? {
          found: true,
          goal: customer.goalType || customer.goals || "",
          allergies: customer.allergies || "",
          avoid: customer.avoid || "",
          preferences: customer.preferences || "",
          mealsPerDay: customer.mealsPerDay ?? 3,
          snacksPerDay: customer.snacksPerDay ?? 1,
        }
      : { found: false, goal: "", allergies: "", avoid: "", preferences: "", mealsPerDay: 3, snacksPerDay: 1 };

    // 2.5) حساب أسبوع الدورة (1..4) من تاريخ بداية اشتراك العميل
    //   weekIndex = عدد الأسابيع منذ البداية، ثم نلفّها على دورة 4 أسابيع.
    let rotationWeek = 1;
    let started = true;
    if (customer?.startDate && args.todayDate) {
      const start = new Date(customer.startDate + "T00:00:00");
      const today = new Date(args.todayDate + "T00:00:00");
      const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
      if (diffDays < 0) { started = false; rotationWeek = 1; }
      else rotationWeek = (Math.floor(diffDays / 7) % 4) + 1;
    }

    // 3) الوجبات المجدولة فعلاً لـ(أسبوع الدورة + يوم اليوم) — فلترة صارمة
    const all = await ctx.db
      .query("publicMeals")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const day = (args.todayDay || "").toLowerCase();
    const matchesToday = (m: any): boolean => {
      const sched = m.schedule;
      if (sched && sched.length > 0) {
        return sched.some((s: any) =>
          (s.day || "").toLowerCase() === day && Number(s.week) === rotationWeek);
      }
      // fallback للبيانات القديمة (weeks[] + days[])
      const weeks = m.weeks || [];
      const days = (m.days || []).map((d: string) => d.toLowerCase());
      if (weeks.length || days.length) {
        return weeks.includes(rotationWeek) && days.includes(day);
      }
      return false; // بدون جدولة → لا نُدرجها (نلتزم بمنيو اليوم)
    };
    const available = day ? all.filter(matchesToday) : [];

    // 4) استبعاد الممنوعات (حساسية + avoid)
    const blockWords = `${profile.allergies} ${profile.avoid}`
      .split(/[,،\s]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);

    const candidates = await Promise.all(
      available
        .filter((m) => !isBlocked(m, blockWords))
        .map(async (m) => ({
          id: m._id,
          nameAr: m.nameAr,
          nameEn: m.nameEn || "",
          category: m.category,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fats: m.fats,
          priceQAR: m.priceQAR,
          tags: m.tags || [],
          imageUrl: m.storageId ? await ctx.storage.getUrl(m.storageId) : (m.imageUrl || null),
        }))
    );

    return {
      profile,
      candidates,
      meta: { rotationWeek, started, day, date: args.todayDate || "" },
    };
  },
});

// ═══════════════════════════════════════════════════════════
//  المرحلة 2 — الشات بوت (مساعد التغذية الذكي)
// ═══════════════════════════════════════════════════════════

// query: سياق مختصر للشات (وجبات + باقات نشطة)
export const getChatContext = query({
  args: {},
  handler: async (ctx) => {
    const meals = await ctx.db
      .query("publicMeals")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const plans = await ctx.db
      .query("publicPlans")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return {
      meals: meals.slice(0, 40).map((m) => ({
        name: m.nameAr, cat: m.category, kcal: m.calories,
        p: m.protein, c: m.carbs, f: m.fats, tags: (m.tags || []).join(","),
      })),
      plans: plans.map((p) => ({
        name: p.nameAr, slug: p.slug,
        prices: (p.options || []).map((o) => `${o.mealsCount}وجبة/${o.priceQAR}ر.ق`).join(" · "),
      })),
    };
  },
});

/**
 * شات بوت مساعد التغذية. يرد بالعربي ويستخدم بيانات المطعم الحقيقية.
 * messages: [{role:"user"|"assistant", content:string}]
 */
export const chat = action({
  args: {
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (ctx, args): Promise<any> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, reply: "خدمة المساعد الذكي غير مفعّلة حالياً. تواصل معنا عبر واتساب وسنساعدك فوراً 🌿" };
    }

    const ctxData = await ctx.runQuery(api.ai.getChatContext, {});
    const menuStr = ctxData.meals.map((m: any) =>
      `${m.name} (${m.cat}, ${m.kcal}kcal, بروتين ${m.p})`).join(" | ");
    const plansStr = ctxData.plans.map((p: any) => `${p.name}: ${p.prices}`).join(" | ");

    const system = `أنت "مساعد أدرينالين" — مساعد تغذية ودود لمطعم أدرينالين للأكل الصحي في قطر.
- رد بالعربي بإيجاز ووضوح وبأسلوب مشجّع.
- رشّح من قائمتنا الحقيقية فقط: ${menuStr}
- باقات الاشتراك المتاحة: ${plansStr}
- لو سُئلت عن الاشتراك، شجّع بلطف ووجّه للطلب عبر الموقع أو واتساب.
- لا تقدّم نصائح طبية تشخيصية؛ للحالات الخاصة انصح بمراجعة أخصائي.
- لا تخترع وجبات أو أسعار غير المذكورة.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 600,
          system,
          messages: args.messages.slice(-12),
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const data = await res.json();
      return { ok: true, reply: data?.content?.[0]?.text || "عذراً، لم أفهم. ممكن توضّح أكثر؟" };
    } catch (e) {
      return { ok: false, reply: "حصل خطأ مؤقت. حاول تاني أو تواصل معنا عبر واتساب 🌿" };
    }
  },
});

// ─── fallback خوارزمي: اختيار وجبات تقرّب من السعرات المستهدفة ───
function ruleBasedPlan(profile: any, candidates: any[]) {
  const target = targetCaloriesFor(profile.goal);
  const mains = candidates.filter((c) =>
    ["breakfast", "lunch", "dinner"].includes(c.category)
  );
  const snacks = candidates.filter((c) =>
    ["snack", "salad"].includes(c.category)
  );

  // رتّب الوجبات الرئيسية حسب أعلى بروتين (مفيد لكل الأهداف)
  const sortByProtein = (a: any, b: any) => (b.protein || 0) - (a.protein || 0);
  mains.sort(sortByProtein);
  snacks.sort(sortByProtein);

  const picks: any[] = [];
  let kcal = 0;
  const nMeals = Math.max(1, Math.min(profile.mealsPerDay || 3, mains.length));
  const nSnacks = Math.max(0, Math.min(profile.snacksPerDay || 1, snacks.length));

  for (let i = 0; i < nMeals; i++) {
    const m = mains[i];
    if (!m) break;
    picks.push({ id: m.id, reason: "وجبة غنية بالبروتين تناسب هدفك الغذائي" });
    kcal += m.calories || 0;
  }
  for (let i = 0; i < nSnacks; i++) {
    const s = snacks[i];
    if (!s) break;
    picks.push({ id: s.id, reason: "وجبة خفيفة متوازنة بين الوجبات الرئيسية" });
    kcal += s.calories || 0;
  }

  return {
    picks,
    summary: `خطة مقترحة ~${kcal} سعرة (المستهدف ~${target}).`,
    engine: "rules",
  };
}

// ─── المسار الذكي: نداء Anthropic ───
async function aiPlan(profile: any, candidates: any[], apiKey: string) {
  const target = targetCaloriesFor(profile.goal);
  const menu = candidates.map((c) =>
    `- id:${c.id} | ${c.nameAr} | ${c.category} | ${c.calories}kcal P${c.protein}/C${c.carbs}/F${c.fats} | ${(c.tags || []).join(",")}`
  ).join("\n");

  const prompt = `أنت اختصاصي تغذية في مطعم "أدرينالين" للأكل الصحي. اختر وجبات اليوم لعميل من القائمة المتاحة فقط.

بروفايل العميل:
- الهدف: ${profile.goal || "توازن"}
- السعرات المستهدفة تقريباً: ${target}
- يفضّل: ${profile.preferences || "—"}
- عدد الوجبات الرئيسية: ${profile.mealsPerDay} | السناكس: ${profile.snacksPerDay}

القائمة المتاحة اليوم (اختر من هذه فقط، باستخدام الـ id كما هو):
${menu}

أعد ردك بصيغة JSON فقط بدون أي نص آخر، بهذا الشكل:
{"picks":[{"id":"<id من القائمة>","reason":"سبب قصير بالعربي"}],"summary":"جملة موجزة عن الخطة"}
اختر ما مجموعه ${profile.mealsPerDay} وجبات رئيسية و ${profile.snacksPerDay} سناك، قرّب من السعرات المستهدفة، ونوّع.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text || "";
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  return { picks: json.picks || [], summary: json.summary || "", engine: "ai" };
}

/**
 * يولّد خطة اليوم. يحاول AI أولاً ثم يسقط على الخوارزمية عند أي خطأ.
 */
export const generateSmartPlan = action({
  args: {
    customerId: v.optional(v.id("customers")),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    // اسم اليوم + التاريخ (يُحسبان هنا في الـaction)
    const now = new Date();
    const todayDay = WEEKDAYS[now.getDay()];
    const todayDate = now.toISOString().slice(0, 10); // yyyy-MM-dd

    const { profile, candidates, meta } = await ctx.runQuery(api.ai.getSmartPlanData, {
      customerId: args.customerId,
      phone: args.phone,
      todayDay,
      todayDate,
    });

    if (!candidates || candidates.length === 0) {
      return {
        ok: false,
        error: "لا توجد وجبات مجدولة لهذا اليوم في منيو المطعم.",
        profile, meta, picks: [],
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    let result;
    if (apiKey) {
      try {
        result = await aiPlan(profile, candidates, apiKey);
      } catch (e) {
        result = ruleBasedPlan(profile, candidates); // fallback عند فشل الـAI
      }
    } else {
      result = ruleBasedPlan(profile, candidates); // لا يوجد مفتاح → الخوارزمية
    }

    // 🛡️ حاجز أمان: نتحقق أن كل ID موجود فعلاً في القائمة المتاحة
    const byId = new Map(candidates.map((c: any) => [c.id, c]));
    const picks = (result.picks || [])
      .filter((p: any) => byId.has(p.id))
      .map((p: any) => ({ ...byId.get(p.id), reason: p.reason || "" }));

    return {
      ok: true,
      engine: result.engine,
      summary: result.summary,
      profileFound: profile.found,
      meta,
      picks,
    };
  },
});
