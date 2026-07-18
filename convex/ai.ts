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
import { validateSession } from "./sessions";

/** ✅ استعلام مساعد داخلي — يستخرج الهوية من التوكن (للـactions). */
export const _whoAmI = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const id = await validateSession(ctx, args.sessionToken);
    if (!id) return null;
    return { userId: id.userId ?? null, customerAccountId: id.customerAccountId ?? null, accountType: id.accountType };
  },
});

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
    todayDay: v.optional(v.string()),
    todayDate: v.optional(v.string()),
    overrideRotationWeek: v.optional(v.number()),
    // ✅ للحماية: sessionToken اختياري. لو موجود ومتحقّق نُرجع البيانات الحساسة
    //    (allergies/avoid/preferences). لو غير موجود، نُرجع بيانات محدودة فقط
    //    (found + الأهداف والعدد بدون تفاصيل صحية) — يمنع أي حد من تسريب
    //    الملف الصحي لرقم هاتف عشوائي.
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 🔒 نتحقق لو المستدعي معتمد (موظف أو صاحب الاشتراك)
    //    ⚠️ validateSession مستوردة في أعلى الملف — Convex لا يدعم
    //    `await import()` الديناميكي وكان يرمي "dynamic module import unsupported"
    //    لكل مستخدم مسجّل دخول (الزائر بلا توكن كان يمر فلم يظهر البق).
    let authorized = false;
    if (args.sessionToken) {
      const id = await validateSession(ctx, args.sessionToken);
      if (id?.accountType === "staff") authorized = true;
      else if (id?.customerAccountId && args.customerId) {
        const acct: any = await ctx.db.get(id.customerAccountId as any);
        if (acct && String(acct.customerId) === String(args.customerId)) authorized = true;
      }
    }

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

    /* 2) بناء بروفايل.
     *
     *   🔴 كان الشرط (customer && authorized): المشترك اللي بيدخل رقمه في
     *   الموقع العام مالوش sessionToken ⇒ authorized=false ⇒ found=false،
     *   فيقع على الافتراضي (3 وجبات + 1 سناك = 4) مهما كان اشتراكه، وتظهر له
     *   «لم نجد اشتراكاً مرتبطاً» بينما بطاقة الاشتراك فوقها تعرض اسمه وتواريخه
     *   — تناقض على نفس الشاشة. (مثال حقيقي: اشتراك 4 وجبات + 2 سناك ⇒ طلعت 4.)
     *
     *   والحجب مكانش بيحمي أصلاً: customers.findPublicByPhone استعلام عام بلا
     *   أي حماية وبيرجّع mealsPerDay/snacksPerDay/allergies/avoid لنفس الرقم —
     *   ونفس الصفحة بتناديه. فحجبها هنا كان بيكسر التخصيص بلا أي مقابل أمني.
     *
     *   ⚖️ الحدّ: الحقول المكشوفة عامّاً بالفعل تُستخدم بمطابقة الهاتف.
     *   والهدف منها: goals قيمته مكرّرة في program، وprogram موجود في
     *   publicCustomerView ⇒ استخدامه لا يكشف جديداً. أما preferences فغير
     *   مكشوف في أي مسار عام ⇒ يظل للمعتمدين فقط.
     *
     *   ⚠️ الحماية الحقيقية = التحقق من ملكية الرقم (OTP)، وهي شغل منفصل.
     */
    const profile = customer
      ? {
          found: true,
          // الهدف يحدّد السعرات المستهدفة (targetCaloriesFor). بدونه كل
          // المشتركين بالرقم كانوا ياخدوا 2000 سعرة الافتراضية مهما كان هدفهم.
          goal: customer.goalType || customer.goals || customer.program || "",
          allergies: customer.allergies || "",
          avoid: customer.avoid || "",
          preferences: authorized ? (customer.preferences || "") : "",
          mealsPerDay: customer.mealsPerDay ?? 3,
          snacksPerDay: customer.snacksPerDay ?? 1,
        }
      : { found: false, goal: "", allergies: "", avoid: "", preferences: "", mealsPerDay: 3, snacksPerDay: 1 };

    // 2.5) هل بدأ الاشتراك؟ وتحديد «يوم/تاريخ» الخطة الفعلي.
    //    اشتراك لم يبدأ بعد: «خطة اليوم» = أول يوم توصيل في الاشتراك (لا تاريخ
    //    اليوم) — فما يراه العميل هو فعلاً ما سيصله أول يوم.
    let started = true;
    let effDay = (args.todayDay || "").toLowerCase();
    let effDate = args.todayDate || "";
    if (customer?.startDate && args.todayDate) {
      const start = new Date(customer.startDate + "T00:00:00");
      const today = new Date(args.todayDate + "T00:00:00");
      if (today.getTime() < start.getTime()) started = false;
    }
    const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    if (!started && !args.overrideRotationWeek && customer?.startDate) {
      const s = new Date(customer.startDate + "T00:00:00");
      if (s.getDay() === 5) s.setDate(s.getDate() + 1); // الجمعة بلا توصيل → السبت
      effDay = names[s.getDay()];
      const yyyy = s.getFullYear(), mm = String(s.getMonth() + 1).padStart(2, "0"), dd = String(s.getDate()).padStart(2, "0");
      effDate = `${yyyy}-${mm}-${dd}`;
    }

    // ✅ أسبوع الدورة = دورة **المطعم** في تاريخ التوصيل (لا دورة نسبية للعميل).
    //    المطبخ يطبخ منيو دورة ذلك الأسبوع لكل العملاء، فلا بد أن يطابقها العميل.
    //    نفس منطق restaurantSettings.rotationWeekAt: currentCookingWeek + عدد
    //    الجُمَع بين اليوم وتاريخ التوصيل (كل جمعة = تقدّم دورة، تلفّ 1..4).
    const rsettings: any = await ctx.db.query("restaurantSettings").first();
    const curCook = Number(rsettings?.currentCookingWeek) || 1;
    let rotationWeek = curCook;
    if (args.todayDate && effDate) {
      let fridays = 0;
      const c = new Date(args.todayDate + "T00:00:00");
      const end = new Date(effDate + "T00:00:00");
      for (let i = 0; i < 400 && c.getTime() < end.getTime(); i++) {
        c.setDate(c.getDate() + 1);
        if (c.getDay() === 5) fridays++;
      }
      rotationWeek = ((curCook - 1 + fridays) % 4) + 1;
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

    const day = effDay;
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
        date: effDate,
        // 🔒 بيانات الاشتراك (مدة/بداية/نهاية) = خاصة — لا تُرجع إلا للمعتمدين.
        //    للزائر بلا جلسة نعيد null حتى لا يستطيع كشف وجود اشتراك بهاتف عشوائي.
        durationWeeks: authorized ? ((customer as any)?.durationWeeks ?? null) : null,
        startDate: authorized ? ((customer as any)?.startDate ?? null) : null,
        endDate: authorized ? ((customer as any)?.endDate ?? null) : null,
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

    // 🔒 حدود طول: يمنع payload ضخم يستنزف tokens
    const MAX_MSG_CHARS = 2000;
    const MAX_TOTAL_CHARS = 12000;
    let total = 0;
    for (const m of args.messages) {
      const len = (m.content || "").length;
      if (len > MAX_MSG_CHARS) {
        return { ok: false, reply: isEn
          ? `Message too long (max ${MAX_MSG_CHARS} chars).`
          : `الرسالة طويلة جداً (الحد ${MAX_MSG_CHARS} حرف).` };
      }
      total += len;
    }
    if (total > MAX_TOTAL_CHARS) {
      return { ok: false, reply: isEn
        ? "Conversation too long. Please start a new chat."
        : "المحادثة طويلة جداً. ابدأ محادثة جديدة." };
    }

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

  /* 🔴 كان: mains مرتّبة بالبروتين ثم نأخذ أعلى N بلا نظر للتصنيف — فمشترك
   *    3 وجبات ممكن ياخد 3 عشاء وما ياخدش فطور ولا غدا، لأن الأعلى بروتيناً
   *    صادف إنهم عشاء. الخطة لازم تغطّي اليوم: فطور ثم غداء ثم عشاء، وأي
   *    وجبة زيادة (mealsPerDay=4 وعندنا 3 تصنيفات) تدور على نفس الترتيب.
   *    الأعلى بروتيناً يبقى معيار الاختيار **داخل** كل تصنيف. */
  const byCat: Record<string, any[]> = { breakfast: [], lunch: [], dinner: [] };
  for (const m of mains) (byCat[m.category] ||= []).push(m); // mains مرتّبة بالبروتين أصلاً
  const ORDER = ["breakfast", "lunch", "dinner"];
  for (let i = 0; i < nMeals; i++) {
    const cat = ORDER[i % ORDER.length];
    // لو التصنيف خلص (أو لا وجبات فيه اليوم) نقع على أي رئيسية متبقية
    const m = byCat[cat]?.shift()
      || ORDER.map((c) => byCat[c]).find((arr) => arr?.length)?.shift();
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
    // ✅ targetDate (yyyy-MM-dd) — تاريخ اليوم المطلوب (عادةً بكرة).
    //     يحسبه العميل بالتوقيت المحلي لتفادي مشاكل UTC.
    //     غير مضبوط ⇒ السيرفر يستخدم "الآن UTC" (سلوك رجعي).
    targetDate: v.optional(v.string()),
    // 🔒 sessionToken: لو موجود نستخدم accountId/userId كمفتاح rate limit مقاوم للتحايل.
    //    غير موجود = زائر — حد أضيق + دلو عام صارم.
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    // 🔒 نستخرج مفتاح ثابت من الجلسة لو موجود — يمنع تجاوز الحد بتغيير phone.
    let identityKey = "anon";
    if (args.sessionToken) {
      const id: any = await ctx.runQuery(api.ai._whoAmI, { sessionToken: args.sessionToken });
      if (id?.userId) identityKey = `staff:${id.userId}`;
      else if (id?.customerAccountId) identityKey = `cust:${id.customerAccountId}`;
    }
    const visitor = identityKey === "anon";
    // 💸 حدود: زائر أضيق بكثير من مستخدم موثّق
    const perIdentityLimit = visitor ? 2 : 10;
    const rlKey = `ai:generateSmartPlan:${identityKey}`;
    for (const [key, limit] of [[rlKey, perIdentityLimit], ["ai:generateSmartPlan:global", visitor ? 20 : 60]] as const) {
      const gate = await ctx.runMutation(internal.rateLimit.consume, {
        key, limit, windowMs: 10 * 60 * 1000,
      });
      if (!gate.ok) throw new Error("طلبات كثيرة — جرّب بعد دقائق قليلة");
    }

    // ✅ اسم اليوم + التاريخ — نفضّل targetDate من العميل (بالتوقيت المحلي)
    //     لتفادي انزلاق اليوم بسبب UTC. لو مش موجود، نرجع للسلوك القديم.
    let todayDay: string;
    let todayDate: string;
    if (args.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(args.targetDate)) {
      todayDate = args.targetDate;
      const [y, m, d] = args.targetDate.split("-").map(Number);
      todayDay = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    } else {
      const now = new Date();
      todayDay = WEEKDAYS[now.getDay()];
      todayDate = now.toISOString().slice(0, 10);
    }

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
    // 🔒 sessionToken اختياري — لو موجود ومعتمد، نمرّره لـgetSmartPlanData
    //    فترجع تواريخ الاشتراك. غير معتمد → null (لا تسريب وجود اشتراك).
    sessionToken: v.optional(v.string()),
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
      sessionToken: args.sessionToken,
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
    startDate: v.optional(v.string()),
    weeks: v.optional(v.number()),
    startRotationWeek: v.optional(v.number()),
    // ✅ نهاية الاشتراك — لو مضبوطة، يقف التوليد عند هذا التاريخ
    //   حتى لو الأسبوع لم يكتمل (مثلاً اشتراك يخلص الاثنين → أحد+اثنين فقط).
    endDate: v.optional(v.string()),
    // 🔓 sessionToken اختياري: الموثّق (جلسة) بحدّ أوسع؛ والزائر بالرقم المتحقق
    //    فقط مسموح لكن بحدّ صارم جداً لأن التوليد الشهري = عشرات نداءات AI.
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    const weeksCount = Math.min(4, Math.max(1, Math.floor(args.weeks || 1)));

    // 🔑 الهوية: جلسة موثّقة إن وُجدت، وإلا الرقم المتحقق (زائر). لا هذا ولا ذاك ⇒ رفض.
    const identity: any = args.sessionToken
      ? await ctx.runQuery(api.ai._whoAmI, { sessionToken: args.sessionToken })
      : null;
    let identityKey: string;
    let visitor: boolean;
    if (identity?.userId) { identityKey = `staff:${identity.userId}`; visitor = false; }
    else if (identity?.customerAccountId) { identityKey = `cust:${identity.customerAccountId}`; visitor = false; }
    else if (args.phone && args.phone.replace(/\D/g, "").length >= 6) {
      identityKey = `phone:${args.phone.replace(/\D/g, "")}`; visitor = true;
    } else {
      throw new Error("أدخل رقمك المتحقق أو سجّل الدخول لتوليد خطة");
    }

    // 💸 حدّ معدّل: الموثّق أوسع؛ الزائر (رقم فقط) صارم — توليدة واحدة كل 10 دقائق
    //    لأن الخطة الشهرية = عشرات نداءات AI. نستهلك وحدة واحدة لكل توليدة.
    const perId = visitor ? 1 : 6;
    const globalCap = visitor ? 8 : 40;
    const rlKey = `ai:generateWeeklyPlan:${identityKey}`;
    for (const [key, limit] of [[rlKey, perId], ["ai:generateWeeklyPlan:global", globalCap]] as const) {
      const gate = await ctx.runMutation(internal.rateLimit.consume, {
        key, limit, windowMs: 10 * 60 * 1000,
      });
      if (!gate.ok) {
        throw new Error(visitor
          ? "ولّدت خطة للتو — انتظر بضع دقائق قبل توليد خطة أخرى."
          : "طلبات كثيرة — جرّب بعد دقائق قليلة");
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    // ✅ حد النهاية — يُوقف التوليد عند نهاية الاشتراك حتى لو الأسبوع مش كامل
    const endBoundary = args.endDate && /^\d{4}-\d{2}-\d{2}$/.test(args.endDate)
      ? new Date(args.endDate + "T00:00:00")
      : null;

    /**
     * ✅ يولّد أيام "bucket" واحدة — يبدأ من `cur` وينتهي عند أول جمعة أو
     *   نهاية الاشتراك أو 6 أيام. الدورة تُتقدّم عند الجمعة، فيتوافق كل يوم
     *   مع دورة المطبخ الحقيقية له.
     * يعيد `nextRotationWeek` عشان الـbucket اللي بعده يبدأ بالدورة الصحيحة.
     */
    const buildWeek = async (
      cur: Date,
      initialRotation: number,
    ): Promise<{ days: any[]; profileFound: boolean; reachedEnd: boolean; nextRotationWeek: number }> => {
      const out: any[] = [];
      let profileFound = false;
      let reachedEnd = false;
      let rotWeek = initialRotation;
      for (let guard = 0; guard < 12 && out.length < WORKING_DAYS.length; guard++) {
        if (endBoundary && cur.getTime() > endBoundary.getTime()) { reachedEnd = true; break; }
        const dow = cur.getDay();
        if (dow === 5) {
          // ✅ الجمعة: نغلق الـbucket الحالي (الأسبوع الحالي انتهى) ونتقدّم للدورة التالية.
          //    الأيام بعد الجمعة تنتمي لأسبوع دورة جديد → outer loop يفتح bucket تاني.
          rotWeek = (rotWeek % 4) + 1;
          cur.setDate(cur.getDate() + 1);
          break;
        }
        // يوم توصيل عادي
        const dayName = WEEKDAYS[dow];
        const dateStr = cur.toISOString().slice(0, 10);
        const { profile, candidates, meta } = await ctx.runQuery(api.ai.getSmartPlanData, {
          customerId: args.customerId,
          phone: args.phone,
          todayDay: dayName,
          todayDate: dateStr,
          overrideRotationWeek: rotWeek, // ✅ الدورة الحقيقية لهذا اليوم
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
          rotationWeek: rotWeek,
          picks,
          summary,
          engine,
          empty: picks.length === 0,
        });
        cur.setDate(cur.getDate() + 1);
      }
      return { days: out, profileFound, reachedEnd, nextRotationWeek: rotWeek };
    };

    // نبدأ من startDate أو من اليوم
    const cursor = args.startDate ? new Date(args.startDate + "T00:00:00") : new Date();
    const weeks: any[] = [];
    let anyProfile = false;
    // ✅ نبدأ بالدورة اللي حددها العميل (rotationWeek عند تاريخ بداية اشتراكه)،
    //    والدورة تتقدّم تلقائياً داخل buildWeek لما نعبر جمعة.
    let rotForNext = args.startRotationWeek ? Math.floor(args.startRotationWeek) : 1;

    // ✅ لو fيه endDate، ما نضطرش نوقف عند weeksCount — buildWeek بيرجع buckets
    //    قد تكون قصيرة (مثلاً bucket فيه يوم واحد قبل الجمعة). نستمر لحد ما نصل
    //    نهاية الاشتراك أو نكمل weeksCount buckets مع أيام فعلية.
    // لو endDate مضبوط، ما نحدد بـweeksCount (server يوقف عند reachedEnd).
    // بدون endDate، نحدد بـweeksCount + safety guard 8.
    const maxBuckets = endBoundary ? 8 : weeksCount;
    const bucketCap = endBoundary ? maxBuckets : weeksCount;
    let bucketsWithDays = 0;
    for (let g = 0; g < maxBuckets && bucketsWithDays < bucketCap; g++) {
      const { days, profileFound, reachedEnd, nextRotationWeek } = await buildWeek(cursor, rotForNext);
      anyProfile = anyProfile || profileFound;
      if (days.length > 0) {
        weeks.push({
          index: weeks.length + 1,
          rotationWeek: days[0]?.rotationWeek ?? rotForNext,
          days,
        });
        bucketsWithDays++;
      }
      rotForNext = nextRotationWeek;
      // ✅ لو وصلنا لنهاية الاشتراك، نوقف كل التوليد
      if (reachedEnd) break;
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
