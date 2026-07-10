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
import { api, internal } from "./_generated/api";
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
    // ✅ فرض أسبوع دورة معيّن (1..4) بدل حسابه من التاريخ — يستخدمه توليد
    //    عدة أسابيع ليختار وجبات كل دورة على حدة.
    overrideRotationWeek: v.optional(v.number()),
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

    // 2.5) حساب أسبوع الدورة (1..4) من تاريخ بداية اشتراك العميل.
    // أسبوع التوصيل = 6 أيام (السبت→الخميس، الجمعة وحدها بلا توصيل)، فالدورة
    // تتقدّم كل 6 أيام توصيل. (كان يعدّ 5 ويقسم على 6 — تقدُّم غير منتظم؛ صار متّسقاً.)
    let rotationWeek = 1;
    let started = true;
    if (customer?.startDate && args.todayDate) {
      const start = new Date(customer.startDate + "T00:00:00");
      const today = new Date(args.todayDate + "T00:00:00");
      if (today.getTime() < start.getTime()) {
        started = false; rotationWeek = 1;
      } else {
        // عُدّ أيام التوصيل من البداية حتى اليوم (شامل)، مع حدّ أقصى احترازي
        let workingDays = 0;
        const cur = new Date(start);
        for (let i = 0; i < 400 && cur.getTime() <= today.getTime(); i++) {
          if (cur.getDay() !== 5) workingDays++; // الجمعة وحدها بلا توصيل
          cur.setDate(cur.getDate() + 1);
        }
        const idx = Math.max(0, workingDays - 1); // 0-based لليوم الحالي ضمن أيام التوصيل
        rotationWeek = (Math.floor(idx / 6) % 4) + 1;
      }
    }

    // فرض أسبوع دورة محدّد (توليد عدة أسابيع) — يتجاوز الحساب أعلاه.
    if (args.overrideRotationWeek && args.overrideRotationWeek >= 1 && args.overrideRotationWeek <= 4) {
      rotationWeek = Math.floor(args.overrideRotationWeek);
      started = true;
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
      meta: {
        rotationWeek,
        started,
        day,
        date: args.todayDate || "",
        // مدة اشتراك العميل — تقترحها الواجهة كعدد أسابيع افتراضي
        durationWeeks: (customer as any)?.durationWeeks ?? null,
        // ✅ تواريخ الاشتراك — تعرضها الواجهة وتشتق منها دورة البداية (كالمنيو اليدوي)
        startDate: (customer as any)?.startDate ?? null,
        endDate: (customer as any)?.endDate ?? null,
      },
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
    const settings = await ctx.db.query("restaurantSettings").first();

    return {
      meals: meals.slice(0, 40).map((m) => ({
        name: m.nameAr, cat: m.category, kcal: m.calories,
        p: m.protein, c: m.carbs, f: m.fats, tags: (m.tags || []).join(","),
      })),
      plans: plans.map((p) => ({
        name: p.nameAr, slug: p.slug, duration: p.duration,
        prices: (p.options || []).map((o) => `${o.mealsCount} وجبة + ${o.snacksCount} سناك = ${o.priceQAR} ر.ق`).join(" · "),
      })),
      contact: {
        phone: settings?.phone || "",
        whatsapp: settings?.whatsappNumber || settings?.phone || "",
        address: settings?.addressAr || "",
        hours: settings?.workingHoursAr || "",
      },
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
    lang: v.optional(v.string()), // "ar" | "en"
  },
  handler: async (ctx, args): Promise<any> => {
    const isEn = args.lang === "en";

    // 💸 دلو عام: سقف تكلفة مطلق على المساعد الذكي (نقطة نهاية عامة)
    const gate = await ctx.runMutation(internal.rateLimit.consume, {
      key: "ai:chat",
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (!gate.ok) {
      return { ok: false, reply: isEn
        ? "The assistant is busy right now. Please try again in a few minutes."
        : "المساعد مشغول حالياً. جرّب بعد دقائق قليلة." };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, reply: isEn
        ? "The smart assistant is currently unavailable. Contact us on WhatsApp and we'll help right away 🌿"
        : "خدمة المساعد الذكي غير مفعّلة حالياً. تواصل معنا عبر واتساب وسنساعدك فوراً 🌿" };
    }

    const ctxData = await ctx.runQuery(api.ai.getChatContext, {});
    const menuStr = ctxData.meals.map((m: any) =>
      `${m.name} (${m.cat}, ${m.kcal}kcal, بروتين ${m.p})`).join(" | ");
    const plansStr = ctxData.plans.map((p: any) => `${p.name} [${p.duration}]: ${p.prices}`).join(" || ");
    const c = ctxData.contact || ({} as any);
    const contactStr = [
      c.phone ? `الهاتف/الاستفسارات: ${c.phone}` : "",
      c.whatsapp ? `واتساب: ${c.whatsapp}` : "",
      c.address ? `العنوان: ${c.address}` : "",
      c.hours ? `مواعيد العمل: ${c.hours}` : "",
    ].filter(Boolean).join(" · ") || "غير متوفّر";

    const system = `أنت "مساعد أدرينالين" — مساعد تغذية ودود لمطعم أدرينالين للأكل الصحي في قطر.
- ${isEn ? "Reply in ENGLISH, briefly and clearly, in an encouraging tone." : "رد بالعربي بإيجاز ووضوح وبأسلوب مشجّع."}
- رشّح من قائمتنا الحقيقية فقط: ${menuStr}
- باقات الاشتراك وأسعارها الرسمية (استخدم هذه الأرقام حرفيًا بلا تقريب أو تغيير): ${plansStr}
- بيانات التواصل الرسمية: ${contactStr}
- عند السؤال عن السعر: اذكر الرقم الرسمي أعلاه بالضبط. لا تُقرّب ولا تخمّن. لو الباقة غير مذكورة، قل "تواصل معنا للتفاصيل" مع إعطاء رقم الهاتف.
- عند السؤال عن رقم الاستفسارات/التواصل: أعطِ رقم الهاتف والواتساب أعلاه إن وُجدا. لا تقل "لا يوجد رقم" طالما الرقم موجود في البيانات.
- لا تقدّم نصائح طبية تشخيصية؛ للحالات الخاصة انصح بمراجعة أخصائي.
- ممنوع اختراع وجبات أو أسعار أو أرقام غير المذكورة.`;

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
    // 💸 حدّ معدّل: لكل هاتف + دلو عام (استدعاء مدفوع لواجهة Anthropic)
    const rlKey = args.phone ? `ai:generateSmartPlan:${args.phone}` : "ai:generateSmartPlan:anon";
    for (const [key, limit] of [[rlKey, 6], ["ai:generateSmartPlan:global", 60]] as const) {
      const gate = await ctx.runMutation(internal.rateLimit.consume, {
        key, limit, windowMs: 10 * 60 * 1000,
      });
      if (!gate.ok) throw new Error("طلبات كثيرة — جرّب بعد دقائق قليلة");
    }

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

// ═══════════════════════════════════════════════════════════
//  خطة أسبوعية ذكية — تولّد خطة لكل أيام العمل (السبت→الأربعاء)
// ═══════════════════════════════════════════════════════════
// أيام التوصيل: السبت→الخميس (6 أيام). الجمعة وحدها بلا توصيل.
const WORKING_DAYS = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"];

/**
 * ✅ اقتراحات التوليد قبل تشغيل الذكاء الاصطناعي (بلا تكلفة):
 *    - suggestedWeeks: من مدة اشتراك العميل (شهر=4، أسبوعين=2…)
 *    - currentRotationWeek: أسبوع الدورة الذي يعمل عليه العميل اليوم
 *  الواجهة تملأ بها الحقول افتراضياً، والأخصائية تعدّلها.
 */
export const getPlanSuggestions = query({
  args: {
    customerId: v.optional(v.id("customers")),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    const today = new Date();
    const wd = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][today.getDay()];
    const dateStr = today.toISOString().slice(0, 10);
    const { meta, profile } = await ctx.runQuery(api.ai.getSmartPlanData, {
      customerId: args.customerId,
      phone: args.phone,
      todayDay: wd,
      todayDate: dateStr,
    });
    // مدة الاشتراك قد تكون 5+ أسابيع، لكن دورة الوجبات 4 أسابيع فقط،
    // فنقترح حتى 4 (لا 1). القيمة صفر/غير معروفة ⇒ نقترح أسبوعاً واحداً.
    const dur = Number(meta?.durationWeeks || 0);
    const suggestedWeeks = dur >= 1 ? Math.min(4, dur) : 1;

    // الدورة موحّدة للمطعم: نفضّل إعداد المطبخ الحالي على الحساب لكل عميل.
    const settings = await ctx.db.query("restaurantSettings").first();
    const cook = Number((settings as any)?.currentCookingWeek);
    const currentRotationWeek = cook >= 1 && cook <= 4 ? cook : (meta?.rotationWeek ?? 1);

    return {
      found: profile.found,
      suggestedWeeks,
      currentRotationWeek,
      durationWeeks: meta?.durationWeeks ?? null,
      // ✅ تواريخ الاشتراك — لتعرضها الواجهة وتشتق منها دورة البداية عبر rotationWeekAt
      startDate: meta?.startDate ?? null,
      endDate: meta?.endDate ?? null,
    };
  },
});

export const generateWeeklyPlan = action({
  args: {
    customerId: v.optional(v.id("customers")),
    phone: v.optional(v.string()),
    startDate: v.optional(v.string()), // yyyy-MM-dd (افتراضي: أقرب يوم عمل من اليوم)
    // ✅ عدد الأسابيع المطلوب توليدها (1..4). افتراضي 1 للتوافق الرجعي.
    weeks: v.optional(v.number()),
    // ✅ أسبوع الدورة الذي يبدأ منه (1..4). لكل أسبوع تالٍ نلفّ +1 على دورة 4.
    //    غير محدّد ⇒ يُحسب من تاريخ اشتراك العميل كما كان.
    startRotationWeek: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const weeksCount = Math.min(4, Math.max(1, Math.floor(args.weeks || 1)));

    // 💸 حدّ معدّل: نستهلك وحدة لكل أسبوع (كل أسبوع = 5 استدعاءات مدفوعة).
    const rlKey = args.phone ? `ai:generateWeeklyPlan:${args.phone}` : "ai:generateWeeklyPlan:anon";
    for (const [key, limit] of [[rlKey, 6], ["ai:generateWeeklyPlan:global", 60]] as const) {
      for (let w = 0; w < weeksCount; w++) {
        const gate = await ctx.runMutation(internal.rateLimit.consume, {
          key, limit, windowMs: 10 * 60 * 1000,
        });
        if (!gate.ok) throw new Error("طلبات كثيرة — جرّب بعد دقائق قليلة");
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    /** يولّد أيام عمل أسبوع واحد ابتداءً من تاريخ، بأسبوع دورة مفروض اختيارياً. */
    const buildWeek = async (
      cur: Date,
      forcedRotation: number | undefined,
    ): Promise<{ days: any[]; profileFound: boolean }> => {
      const out: any[] = [];
      let profileFound = false;
      for (let guard = 0; guard < 12 && out.length < WORKING_DAYS.length; guard++) {
        const dow = cur.getDay();
        if (dow !== 5) { // الجمعة وحدها بلا توصيل
          const dayName = WEEKDAYS[dow];
          const dateStr = cur.toISOString().slice(0, 10);

          const { profile, candidates, meta } = await ctx.runQuery(api.ai.getSmartPlanData, {
            customerId: args.customerId,
            phone: args.phone,
            todayDay: dayName,
            todayDate: dateStr,
            overrideRotationWeek: forcedRotation,
          });
          profileFound = profile.found;

          let picks: any[] = [];
          let summary = "";
          let engine = "none";
          if (candidates && candidates.length > 0) {
            let result;
            if (apiKey) {
              try { result = await aiPlan(profile, candidates, apiKey); }
              catch { result = ruleBasedPlan(profile, candidates); }
            } else {
              result = ruleBasedPlan(profile, candidates);
            }
            const byId = new Map(candidates.map((c: any) => [c.id, c]));
            picks = (result.picks || [])
              .filter((p: any) => byId.has(p.id))
              .map((p: any) => ({ ...byId.get(p.id), reason: p.reason || "" }));
            summary = result.summary;
            engine = result.engine;
          }

          out.push({
            date: dateStr,
            day: dayName,
            rotationWeek: meta?.rotationWeek ?? forcedRotation ?? 1,
            picks,
            summary,
            engine,
            empty: picks.length === 0,
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
      return { days: out, profileFound };
    };

    // نبدأ من startDate أو من اليوم
    const cursor = args.startDate ? new Date(args.startDate + "T00:00:00") : new Date();
    const weeks: any[] = [];
    let anyProfile = false;

    for (let w = 0; w < weeksCount; w++) {
      // أسبوع الدورة لكل أسبوع: startRotationWeek + w، ملفوفة على 1..4
      const forced = args.startRotationWeek
        ? ((Math.floor(args.startRotationWeek) - 1 + w) % 4) + 1
        : undefined;
      const { days, profileFound } = await buildWeek(cursor, forced);
      anyProfile = anyProfile || profileFound;
      weeks.push({
        index: w + 1,
        rotationWeek: days[0]?.rotationWeek ?? forced ?? w + 1,
        days,
      });
      // cursor يكون قد تجاوز أيام هذا الأسبوع؛ تخطَّ الخميس/الجمعة للأسبوع التالي
    }

    const allDays = weeks.flatMap((wk) => wk.days);
    const totalMeals = allDays.reduce((s, d) => s + d.picks.length, 0);

    // للتوافق الرجعي: نُبقي `days` مسطّحة، ونضيف `weeks` للعرض المتعدد.
    return {
      ok: totalMeals > 0,
      profileFound: anyProfile,
      weeks,
      days: allDays,
      weeksCount,
      totalMeals,
    };
  },
});
