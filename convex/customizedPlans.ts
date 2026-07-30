/**
 * @file convex/customizedPlans.ts
 * @description قوالب الوجبات المخصّصة — لكل عميل مخصّص قالب وجبات ثابت
 *   (رئيسية بجرامات + سناك/سلطة). تُبنى بالضغط بدل الكتابة الحرة، وتغذّي
 *   المطبخ والاستيكر لاحقاً.
 * @frontend client/src/pages/Customized.tsx
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";

/** عملاء البرنامج المخصّص + هل لهم قالب محفوظ. للموظفين. */
export const listCustomized = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const customers = await ctx.db.query("customers").collect();
    const custom = customers.filter(
      (c: any) =>
        c.isActive &&
        String(c.program || c.goalType || c.goals || "").toUpperCase().includes("CUSTOM"),
    );
    const templates = await ctx.db.query("customizedTemplates").collect();
    const byCust = new Map(templates.map((t) => [String(t.customerId), t]));
    // عدّاد الأيام المكتملة (بنية جديدة {days}) أو الخانات (قالب قديم مصفوفة)
    const countDays = (daysObj: any): number =>
      Object.values(daysObj || {}).filter(
        (arr: any) => Array.isArray(arr) && arr.some((s: any) => s && s.type !== "OFF" && s.baseName),
      ).length;
    const filledCount = (tpl: any): number => {
      const slots = tpl?.slots;
      if (slots && slots.weeks && typeof slots.weeks === "object") {
        return Object.values(slots.weeks).reduce((sum: number, wk: any) => sum + countDays(wk?.days), 0);
      }
      if (slots && slots.days && typeof slots.days === "object") return countDays(slots.days);
      if (Array.isArray(slots)) return slots.filter((s: any) => s && s.type !== "OFF").length;
      return 0;
    };
    return custom
      .map((c: any) => ({
        _id: c._id,
        fullName: c.fullName,
        phone: c.phone,
        deliveryTime: c.deliveryTime,
        allergies: c.allergies || "",
        avoid: c.avoid || "",
        mealsPerDay: c.mealsPerDay,
        snacksPerDay: c.snacksPerDay,
        hasTemplate: byCust.has(String(c._id)),
        slotCount: filledCount(byCust.get(String(c._id))),
      }))
      .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), "ar"));
  },
});

/**
 * ✅ وجبات العملاء المخصّصين ليوم معيّن (من قوالبهم) — للمطبخ والاستيكر.
 *    يختار خانات يوم الأسبوع من قالب كل عميل، ويرجّع النص المركّب + الكميات.
 */
export const forDate = query({
  args: { date: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayKey = DOW[new Date(args.date + "T00:00:00Z").getUTCDay()];

    // ✅ أسبوع دورة المطبخ لهذا التاريخ (نفس منطق restaurantSettings.rotationWeekAt):
    //    الدورة تتقدّم +1 كل جمعة وتلفّ 1..4، فكل أسبوع يطلع وجبات أسبوع الدورة الصحيح.
    const settings = await ctx.db.query("restaurantSettings").first();
    const cur = Number((settings as any)?.currentCookingWeek) || 1;
    const todayISO = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10); // توقيت قطر
    const target = String(args.date).slice(0, 10);
    let fridays = 0;
    const c = new Date(todayISO + "T00:00:00Z");
    const end = new Date(target + "T00:00:00Z");
    for (let i = 0; i < 400 && c < end; i++) {
      c.setUTCDate(c.getUTCDate() + 1);
      if (c.getUTCDay() === 5) fridays++;
    }
    const rotWeek = ((cur - 1 + fridays) % 4) + 1;

    const templates = await ctx.db.query("customizedTemplates").collect();
    const out: any[] = [];
    for (const tpl of templates) {
      const sl = tpl.slots as any;
      // بنية جديدة: weeks[1..4].days[dayKey]. توافق خلفي: days[dayKey] (أسبوع واحد) أو مصفوفة.
      const weekDays = sl?.weeks ? (sl.weeks[rotWeek] || sl.weeks[String(rotWeek)])?.days : null;
      const days = weekDays || sl?.days;
      const slots: any[] = Array.isArray(days?.[dayKey]) ? days[dayKey] : Array.isArray(sl) ? sl : [];
      const items = slots
        .filter((s) => s && s.type !== "OFF" && (s.baseName || s.text))
        .map((s) => ({
          text: s.text || s.baseName || "",
          baseMealId: s.baseMealId || null,
          baseName: s.baseName || "",
          type: s.type,
          proteinName: s.proteinName || "",
          proteinG: s.proteinG || null,
          carbName: s.carbName || "",
          carbG: s.carbG || null,
          notes: s.notes || "",
        }));
      if (!items.length) continue;
      const c: any = await ctx.db.get(tpl.customerId);
      if (!c) continue;
      /**
       * الاستبعاد يكون **بتاريخ الكشف**، لا بحالة الحساب اليوم.
       *
       * كان الشرط `!c.isActive` وحده، فمن يُوقَف اعتباراً من 29 يختفي فوراً من
       * كشف 28 — يوم هو مشترك فيه ووجباته مطبوخة له. حدث فعلاً مع
       * RASHED ALMANSOURI: أربع وجبات سقطت من كشف 28-7 لأن حسابه أُوقف من 29.
       * المطبخ لا يحضّرها ولا يُطبع لها استيكر، ويكتشف الأمر عند التوصيل.
       *
       * فالإيقاف يسري من `pausedFrom` فصاعداً، والانتهاء من بعد `endDate`،
       * والبدء قبل `startDate` لا يُطعِم أحداً. أما `isActive=false` بلا تاريخ
       * فهو إيقاف فوري يسري على كل التواريخ.
       */
      const d = String(args.date).slice(0, 10);
      const pausedFrom = String(c.pausedFrom || "").slice(0, 10);
      if (pausedFrom) { if (d >= pausedFrom) continue; }
      else if (!c.isActive) continue;
      /* اليوم المتخطّى (سفر يومٍ واحد) لا يُطبخ. التخطّي كان يعمل بحذف الخطة
         اليومية — والمخصّص لا خطة له، وجباته تُقرأ من قالبه مباشرةً — فبقي
         `skippedDates` مسجّلاً في حسابه ولا يقرؤه أحد: لطيفة الدوسري تخطّت
         1-8 ونزلت وجباتها للمطبخ كأن شيئاً لم يكن. */
      const skipped: string[] = Array.isArray((c as any).skippedDates) ? (c as any).skippedDates : [];
      if (skipped.some((x: any) => String(x).slice(0, 10) === d)) continue;
      out.push({
        customerId: String(tpl.customerId),
        customerName: c.fullName || "",
        phone: c.phone || "",
        deliveryTime: c.deliveryTime || "MORNING",
        allergies: c.allergies || "",
        avoid: c.avoid || "",
        items,
      });
    }
    return out.sort((a, b) => String(a.customerName).localeCompare(String(b.customerName), "ar"));
  },
});

/**
 * ✅ مكتبة إعادة الاستخدام — كل الأطباق/التركيبات المميّزة المستخدمة سابقاً في أي
 *    قالب (طبق حر بالاسم، أو تركيبة بروتين+كارب+جرامات)، مرتّبة بالأكثر استخداماً.
 *    تُعرض في منتقي الأطباق فتُملأ الخانة بضغطة واحدة.
 */
export const presets = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const templates = await ctx.db.query("customizedTemplates").collect();
    const map = new Map<string, any>();
    for (const tpl of templates) {
      const sl = tpl.slots as any;
      const dayMaps: any[] = [];
      if (sl?.weeks && typeof sl.weeks === "object") {
        for (const wk of Object.values(sl.weeks)) if ((wk as any)?.days) dayMaps.push((wk as any).days);
      } else if (sl?.days && typeof sl.days === "object") {
        dayMaps.push(sl.days);
      } else if (Array.isArray(sl)) {
        dayMaps.push({ _: sl });
      }
      for (const days of dayMaps) {
        for (const arr of Object.values(days || {})) {
          if (!Array.isArray(arr)) continue;
          for (const s of arr as any[]) {
            if (!s || s.type === "OFF") continue;
            const hasContent = s.baseName || s.proteinG || (s.carbName && s.carbG);
            if (!hasContent) continue;
            const sig = [s.baseMealId || "", s.baseName || "", s.proteinName || "", s.proteinG || "", s.carbName || "", s.carbG || ""].join("|");
            const existing = map.get(sig);
            if (existing) { existing.count++; continue; }
            map.set(sig, {
              baseMealId: s.baseMealId || null,
              baseName: s.baseName || "",
              proteinName: s.proteinName || "",
              proteinG: s.proteinG || null,
              carbName: s.carbName || "",
              carbG: s.carbG || null,
              type: s.type || "MAIN",
              text: s.text || "",
              count: 1,
            });
          }
        }
      }
    }
    // ✅ ادمج مكتبة الأطباق المبذورة (أطباق حرة بالاسم) مع المشتقّة من القوالب
    const library = await ctx.db.query("customizedDishLibrary").collect();
    for (const lib of library) {
      const sig = ["", lib.name, "", "", "", ""].join("|");
      const existing = map.get(sig);
      if (existing) { existing.count += Number(lib.count || 0); continue; }
      map.set(sig, {
        baseMealId: null,
        baseName: lib.name,
        proteinName: "",
        proteinG: null,
        carbName: "",
        carbG: null,
        type: lib.type || "MAIN",
        text: lib.name,
        count: Number(lib.count || 1),
      });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 400);
  },
});

/** بذر/تحديث مكتبة الأطباق الجاهزة (upsert بالاسم). للموظفين. */
export const seedLibrary = mutation({
  args: {
    items: v.array(v.object({ name: v.string(), type: v.string(), count: v.optional(v.number()) })),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    let inserted = 0, updated = 0;
    for (const it of args.items) {
      const name = it.name.trim();
      if (!name) continue;
      const existing = await ctx.db
        .query("customizedDishLibrary")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (existing) { await ctx.db.patch(existing._id, { type: it.type, count: it.count ?? existing.count }); updated++; }
      else { await ctx.db.insert("customizedDishLibrary", { name, type: it.type, count: it.count ?? 1 }); inserted++; }
    }
    return { inserted, updated };
  },
});

/** قالب عميل واحد. للموظفين. */
export const getTemplate = query({
  args: { customerId: v.id("customers"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const t = await ctx.db
      .query("customizedTemplates")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .first();
    return t || null;
  },
});

/** حفظ/تحديث قالب عميل. للموظفين. */
export const saveTemplate = mutation({
  args: {
    customerId: v.id("customers"),
    slots: v.any(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await requireStaff(ctx, args.sessionToken);
    const who = (id as any)?.user?.name || (id as any)?.user?.username || undefined;
    const existing = await ctx.db
      .query("customizedTemplates")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { slots: args.slots, updatedAt: Date.now(), updatedBy: who });
      return { id: existing._id, updated: true };
    }
    const newId = await ctx.db.insert("customizedTemplates", {
      customerId: args.customerId,
      slots: args.slots,
      updatedAt: Date.now(),
      updatedBy: who,
    });
    return { id: newId, updated: false };
  },
});

/**
 * ✅ حفظ يوم واحد فقط — يحدّث weeks[week].days[day] بدون المساس بباقي الأيام/الأسابيع.
 *    للأخصائية اللي عايزة تحفظ اليوم اللي شغّالة عليه فقط دون تأثير على باقي الأسبوع.
 */
export const saveTemplateDay = mutation({
  args: {
    customerId: v.id("customers"),
    week: v.number(),
    day: v.string(),
    slots: v.any(),          // مصفوفة خانات اليوم فقط
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await requireStaff(ctx, args.sessionToken);
    const who = (id as any)?.user?.name || (id as any)?.user?.username || undefined;
    const existing = await ctx.db
      .query("customizedTemplates")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .first();
    const wkKey = String(args.week);
    if (existing) {
      const sl: any = existing.slots || {};
      if (!sl.weeks) sl.weeks = {};
      // ندعم المفتاح رقماً أو نصاً (نكتب على الموجود إن وُجد، وإلا نصّاً)
      const key = sl.weeks[args.week] ? args.week : (sl.weeks[wkKey] ? wkKey : wkKey);
      if (!sl.weeks[key]) sl.weeks[key] = { days: {} };
      if (!sl.weeks[key].days) sl.weeks[key].days = {};
      sl.weeks[key].days[args.day] = args.slots;
      await ctx.db.patch(existing._id, { slots: sl, updatedAt: Date.now(), updatedBy: who });
      return { id: existing._id, updated: true, day: args.day, week: args.week };
    }
    // قالب جديد: ننشئه بهذا اليوم فقط
    const slots = { weeks: { [wkKey]: { days: { [args.day]: args.slots } } } };
    const newId = await ctx.db.insert("customizedTemplates", {
      customerId: args.customerId, slots, updatedAt: Date.now(), updatedBy: who,
    });
    return { id: newId, updated: false, day: args.day, week: args.week };
  },
});
