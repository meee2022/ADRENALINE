/**
 * @file convex/fixWrongPlanDates.ts
 * @description تصحيح خطط أُرّخت على الجمعة (لا توصيل فيها) — معاينة ثم تطبيق.
 *
 *   ═══ المشكلة ═══
 *   باگ ×6 القديم في اعتماد الطلب كان يُنشئ خططاً بتاريخ الجمعة. الوجبات التي
 *   يجب أن تُطبخ ليوم آخر وقعت على يوم بلا توصيل. الكود صُلِح، لكن هذه الخطط
 *   القائمة ما زالت بتواريخ خاطئة، والمطبخ يراها.
 *
 *   ═══ الحل بلا تخمين ═══
 *   كل صنف داخل الخطة يحمل (week, day) الصحيحين اللذين اختارهما المشترك.
 *   نقرأ اليوم من الأصناف، ونحسب تاريخ التوصيل الصحيح = أقرب يوم يطابق
 *   (الأسبوع، اليوم) في دورة المطعم عند/بعد تاريخ بداية اشتراك المشترك.
 *
 *   ⚠️ خطة قد تضمّ **يومين** (لصقهما الباگ في تاريخ واحد) — تُقسَّم إلى خطتين،
 *      كل يوم في تاريخه. لا نخمّن؛ نوزّع الأصناف حسب حقل day الخاص بكلٍّ منها.
 *
 *   ⚠️ لا نُنشئ خطة على تاريخ فيه خطة أخرى لنفس المشترك ونفس الوقت — نُبلّغ
 *      عن التعارض ونتخطّاه بدل الدهس.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./sessions";
import { parseDate, fmtDate, addDays, isDeliveryDay, dayNameOf, rotationWeekAtDate, DELIVERY_DAYS } from "./lib/dates";

/** أقرب تاريخ توصيل ≥ from يوافق (week, day) في دورة المطعم. */
function correctDateFor(fromISO: string, week: number, day: string, curWeek: number, anchorISO: string): string | null {
  const target = String(day).toLowerCase();
  if (!DELIVERY_DAYS.includes(target as any)) return null;
  let cur = parseDate(fromISO);
  for (let i = 0; i < 366; i++) {
    if (isDeliveryDay(cur)) {
      const iso = fmtDate(cur);
      if (dayNameOf(iso) === target && rotationWeekAtDate(curWeek, anchorISO, iso) === Number(week)) return iso;
    }
    cur = addDays(cur, 1);
  }
  return null;
}

async function plan(ctx: any) {
  const plans = await ctx.db.query("dailyPlans").collect();
  const custs = await ctx.db.query("customers").collect();
  // مرجع الدورة: أسبوع الطبخ الحالي عند اليوم
  const settings = await ctx.db.query("restaurantSettings").first();
  const curWeek = Number((settings as any)?.currentCookingWeek) || 1;
  const anchorISO = fmtDate(parseDate(new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)));
  const startById = new Map(custs.map((c: any) => [String(c._id), c.startDate || ""]));
  const nameById = new Map(custs.map((c: any) => [String(c._id), c.name || c.fullName || c.customerName || ""]));

  const fixes: any[] = [];
  for (const p of plans as any[]) {
    const dow = parseDate(p.date).getUTCDay();
    if (dow !== 5) continue; // نصلّح خطط الجمعة فقط
    const items = Array.isArray(p.items) ? p.items : [];
    if (!items.length) continue;

    // جمّع الأصناف حسب (week, day) — قد يكون فيها أكثر من يوم
    const groups = new Map<string, any[]>();
    for (const it of items) {
      const key = `${Number(it.week)}|${String(it.day || "").toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(it);
    }

    const start = (p.customerId && startById.get(String(p.customerId))) || p.date;
    const targets: any[] = [];
    for (const [key, groupItems] of groups) {
      const [ws, day] = key.split("|");
      const newDate = correctDateFor(String(start).slice(0, 10), Number(ws), day, curWeek, anchorISO);
      targets.push({ week: Number(ws), day, itemCount: groupItems.length, newDate });
    }
    fixes.push({
      planId: String(p._id), oldDate: p.date, status: p.status,
      customer: p.customerName || nameById.get(String(p.customerId)) || "(بلا اسم)",
      deliveryTime: p.deliveryTime, splits: targets.length,
      targets,
    });
  }
  return fixes;
}

/** 🔍 معاينة — لا تكتب. تُظهر كل خطة إلى أين تذهب وكيف تُقسَّم. */
export const preview = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const fixes = await plan(ctx);
    // اكشف التعارضات: تاريخ جديد عليه خطة أخرى لنفس المشترك ونفس الوقت
    const plans = await ctx.db.query("dailyPlans").collect();
    const occupied = new Set(
      (plans as any[]).map((p) => `${String(p.customerId)}|${p.date}|${p.deliveryTime}`)
    );
    for (const f of fixes) {
      const pid = (plans as any[]).find((p) => String(p._id) === f.planId)?.customerId;
      for (const t of f.targets) {
        t.conflict = t.newDate
          ? occupied.has(`${String(pid)}|${t.newDate}|${f.deliveryTime}`) && t.newDate !== f.oldDate
          : false;
        t.unresolved = !t.newDate;
      }
    }
    return {
      wrongPlans: fixes.length,
      totalTargets: fixes.reduce((s, f) => s + f.targets.length, 0),
      splits: fixes.filter((f) => f.splits > 1).length,
      conflicts: fixes.flatMap((f) => f.targets.filter((t: any) => t.conflict)).length,
      unresolved: fixes.flatMap((f) => f.targets.filter((t: any) => t.unresolved)).length,
      fixes,
    };
  },
});

/** ✅ تطبيق — ADMIN. يعيد تأريخ الخطة، ويقسّمها لو ضمّت يومين. */
export const apply = mutation({
  args: { sessionToken: v.optional(v.string()), confirm: v.literal("FIX") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const fixes = await plan(ctx);
    let moved = 0, split = 0, skipped = 0;

    for (const f of fixes) {
      const cur: any = await ctx.db.get(f.planId as any);
      if (!cur || cur.date !== f.oldDate) { skipped++; continue; }
      const items = Array.isArray(cur.items) ? cur.items : [];

      // كل هدف صالح ولا تعارض؟ وإلا نتخطّى الخطة كلها (لا دهس)
      const good = f.targets.filter((t: any) => t.newDate);
      if (!good.length) { skipped++; continue; }

      // فحص التعارض لحظة التطبيق
      let blocked = false;
      for (const t of good) {
        const clash = (await ctx.db.query("dailyPlans")
          .withIndex("by_date", (q: any) => q.eq("date", t.newDate)).collect() as any[])
          .some((p) => String(p.customerId) === String(cur.customerId) && p.deliveryTime === cur.deliveryTime && String(p._id) !== f.planId);
        if (clash) { blocked = true; break; }
      }
      if (blocked) { skipped++; continue; }

      if (good.length === 1) {
        // يوم واحد: نُعيد تأريخ الخطة كما هي
        await ctx.db.patch(f.planId as any, { date: good[0].newDate, updatedAt: Date.now() });
        moved++;
      } else {
        // يومان أو أكثر: أول هدف يبقى على الخطة الأصلية، والباقي خطط جديدة
        for (let i = 0; i < good.length; i++) {
          const t = good[i];
          const sub = items.filter((it: any) =>
            Number(it.week) === t.week && String(it.day || "").toLowerCase() === t.day);
          if (i === 0) {
            await ctx.db.patch(f.planId as any, { date: t.newDate, items: sub, updatedAt: Date.now() });
          } else {
            const { _id, _creationTime, ...rest } = cur;
            await ctx.db.insert("dailyPlans", { ...rest, date: t.newDate, items: sub, createdAt: Date.now(), updatedAt: Date.now() });
          }
        }
        split++;
      }
    }
    return { moved, split, skipped };
  },
});
