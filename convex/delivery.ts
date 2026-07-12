/**
 * @file convex/delivery.ts
 * @description نظام التوصيل والتتبع الحي — "أدرينالين دليفري".
 *
 *   دورة الحياة:  PREPARED → OUT_FOR_DELIVERY → DELIVERED  (بأختام زمنية).
 *
 *   المكوّنات:
 *     - إسناد السائقين + ترتيب المسار (أقرب-جار من المطعم).
 *     - بثّ موقع السائق الحي (driverLocations) أثناء الجولة.
 *     - صفحة تتبع عامة للعميل عبر توكن عشوائي (بلا PII زائدة).
 *     - ETA وإشارة "السائق قرّب" محسوبة من المسافة.
 *
 *   الأمان: كل شيء خلف requireStaff عدا `tracking` (عامة عمداً — العميل يفتحها
 *   برابط سرّي يُرسل له، وتعرض حقولاً محدودة فقط).
 */
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireStaff, newToken } from "./sessions";

/* ───────────────────────── أدوات المسافة ───────────────────────── */

/** مسافة هافرسين بالكيلومتر بين نقطتين. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** تقدير زمن الوصول بالدقائق (متوسط 28كم/س داخل المدينة + دقيقتان توقّف). */
function etaMinutes(km: number): number {
  return Math.max(1, Math.round((km / 28) * 60) + 2);
}

const NEAR_KM = 1.2; // "السائق قرّب" ضمن 1.2 كم

/* ───────────────────────── السائقون ───────────────────────── */

export const listDrivers = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const drivers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "DELIVERY"))
      .collect();
    // نضيف الأدمن كخيار (قد يوصّل بنفسه في المطاعم الصغيرة)
    return drivers
      .filter((d) => d.isActive)
      .map((d) => ({ _id: d._id, name: d.name }));
  },
});

/* ───────────────────────── الإسناد وترتيب المسار ───────────────────────── */

/**
 * يسند سائقاً لكل محطات (date + shift) غير المسلّمة، ويرتّب المسار بأقرب-جار
 * انطلاقاً من موقع المطعم. المحطات بلا إحداثيات تُوضع في النهاية.
 */
export const assignShift = mutation({
  args: {
    date: v.string(),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    driverId: v.id("users"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { date, deliveryTime, driverId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);

    const plans = (
      await ctx.db.query("dailyPlans").withIndex("by_date", (q) => q.eq("date", date)).collect()
    ).filter((p) => p.deliveryTime === deliveryTime && p.status !== "DELIVERED" && p.status !== "CONFIRMED" && p.status !== "DRAFT");

    if (plans.length === 0) return { assigned: 0 };

    // إحداثيات كل محطة من بيانات العميل
    const withCoords: { plan: any; lat: number; lng: number }[] = [];
    const noCoords: any[] = [];
    for (const p of plans) {
      const c = p.customerId ? await ctx.db.get(p.customerId) : null;
      if (c && (c as any).lat != null && (c as any).lng != null) {
        withCoords.push({ plan: p, lat: (c as any).lat, lng: (c as any).lng });
      } else {
        noCoords.push(p);
      }
    }

    // نقطة الانطلاق: المطعم
    const settings = await ctx.db.query("restaurantSettings").first();
    let curLat = (settings as any)?.storeLat ?? 25.2854;
    let curLng = (settings as any)?.storeLng ?? 51.531;

    // ترتيب أقرب-جار
    const ordered: any[] = [];
    const pool = [...withCoords];
    while (pool.length) {
      let best = 0;
      let bestKm = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const km = haversineKm(curLat, curLng, pool[i].lat, pool[i].lng);
        if (km < bestKm) { bestKm = km; best = i; }
      }
      const next = pool.splice(best, 1)[0];
      ordered.push(next.plan);
      curLat = next.lat; curLng = next.lng;
    }
    const finalOrder = [...ordered, ...noCoords];

    let seq = 1;
    for (const p of finalOrder) {
      await ctx.db.patch(p._id, { driverId, routeSeq: seq++, updatedAt: Date.now() });
    }
    return { assigned: finalOrder.length };
  },
});

/** إسناد محطة واحدة لسائق (تعديل يدوي). */
export const assignOne = mutation({
  args: { planId: v.id("dailyPlans"), driverId: v.id("users"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { planId, driverId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    await ctx.db.patch(planId, { driverId, updatedAt: Date.now() });
    return { success: true };
  },
});

/**
 * ✅ إسناد جماعي: كل محطة لسائقها (تقسيم بالمنطقة). الواجهة تحسب أي منطقة
 *    لأي سائق وترسل قائمة {planId, driverId}. هنا نُسند ونرتّب مسار كل سائق
 *    على حدة (أقرب-جار من المطعم) فيبقى لكل سائق جولته مرتّبة.
 */
export const assignMany = mutation({
  args: {
    assignments: v.array(v.object({ planId: v.id("dailyPlans"), driverId: v.id("users") })),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { assignments, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    if (!assignments.length) return { assigned: 0, drivers: 0 };

    const settings = await ctx.db.query("restaurantSettings").first();
    const storeLat = (settings as any)?.storeLat ?? 25.2854;
    const storeLng = (settings as any)?.storeLng ?? 51.531;

    // جمّع المحطات حسب السائق
    const byDriver = new Map<string, { plan: any; lat: number | null; lng: number | null }[]>();
    for (const a of assignments) {
      const plan = await ctx.db.get(a.planId);
      if (!plan) continue;
      const c = (plan as any).customerId ? await ctx.db.get((plan as any).customerId) : null;
      const lat = (c as any)?.lat ?? null, lng = (c as any)?.lng ?? null;
      const key = String(a.driverId);
      if (!byDriver.has(key)) byDriver.set(key, []);
      byDriver.get(key)!.push({ plan, lat, lng });
    }

    let assigned = 0;
    for (const [driverId, stops] of byDriver) {
      // ترتيب أقرب-جار من المطعم لكل سائق
      const withC = stops.filter((s) => s.lat != null && s.lng != null);
      const noC = stops.filter((s) => s.lat == null || s.lng == null);
      let curLat = storeLat, curLng = storeLng;
      const ordered: any[] = [];
      const pool = [...withC];
      while (pool.length) {
        let best = 0, bestKm = Infinity;
        for (let i = 0; i < pool.length; i++) {
          const km = haversineKm(curLat, curLng, pool[i].lat as number, pool[i].lng as number);
          if (km < bestKm) { bestKm = km; best = i; }
        }
        const next = pool.splice(best, 1)[0];
        ordered.push(next); curLat = next.lat as number; curLng = next.lng as number;
      }
      let seq = 1;
      for (const s of [...ordered, ...noC]) {
        await ctx.db.patch(s.plan._id, { driverId: driverId as any, routeSeq: seq++, updatedAt: Date.now() });
        assigned++;
      }
    }
    return { assigned, drivers: byDriver.size };
  },
});

/* ───────────────────────── دورة حياة التوصيل ───────────────────────── */

/**
 * يبدأ توصيل محطة: OUT_FOR_DELIVERY + ختم زمني + توليد توكن تتبع (مرة واحدة).
 * يرجّع trackToken لإرساله للعميل.
 */
export const startDelivery = mutation({
  args: { planId: v.id("dailyPlans"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { planId, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const plan = await ctx.db.get(planId);
    if (!plan) return { success: false, error: "المحطة غير موجودة" };
    // سائق التوصيل لا يبدأ إلا محطاته
    if (String(staff.role) === "DELIVERY" && plan.driverId && String(plan.driverId) !== String(staff.userId)) {
      return { success: false, error: "هذه المحطة مسندة لسائق آخر" };
    }
    const token = (plan as any).trackToken || newToken();
    await ctx.db.patch(planId, {
      status: "OUT_FOR_DELIVERY",
      outForDeliveryAt: Date.now(),
      trackToken: token,
      // لو لم يُسند سائق بعد، اجعله السائق الحالي
      driverId: plan.driverId || (staff.userId as any),
      updatedAt: Date.now(),
    });
    return { success: true, trackToken: token };
  },
});

/** يعلّم المحطة مُسلّمة + إثبات تسليم اختياري (ملاحظة/صورة). */
export const markDelivered = mutation({
  args: {
    planId: v.id("dailyPlans"),
    podNote: v.optional(v.string()),
    podStorageId: v.optional(v.id("_storage")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { planId, podNote, podStorageId, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const plan = await ctx.db.get(planId);
    if (!plan) return { success: false, error: "المحطة غير موجودة" };
    if (String(staff.role) === "DELIVERY" && plan.driverId && String(plan.driverId) !== String(staff.userId)) {
      return { success: false, error: "هذه المحطة مسندة لسائق آخر" };
    }
    await ctx.db.patch(planId, {
      status: "DELIVERED",
      deliveredAt: Date.now(),
      podNote: podNote || (plan as any).podNote,
      podStorageId: podStorageId || (plan as any).podStorageId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** تعذّر التوصيل — حالة FAILED بسبب، فلا تبقى "في الطريق" للأبد. */
export const markFailed = mutation({
  args: {
    planId: v.id("dailyPlans"),
    reason: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { planId, reason, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const plan = await ctx.db.get(planId);
    if (!plan) return { success: false, error: "المحطة غير موجودة" };
    if (String(staff.role) === "DELIVERY" && plan.driverId && String(plan.driverId) !== String(staff.userId)) {
      return { success: false, error: "هذه المحطة مسندة لسائق آخر" };
    }
    await ctx.db.patch(planId, {
      status: "FAILED",
      failedAt: Date.now(),
      failReason: reason,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** إعادة جدولة محطة فاشلة/في الطريق → ترجع PREPARED لإعادة الإسناد والمحاولة. */
export const reschedule = mutation({
  args: { planId: v.id("dailyPlans"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { planId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const plan = await ctx.db.get(planId);
    if (!plan) return { success: false, error: "المحطة غير موجودة" };
    await ctx.db.patch(planId, {
      status: "PREPARED",
      outForDeliveryAt: undefined,
      failedAt: undefined,
      failReason: undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** رابط رفع صورة إثبات التسليم (Convex storage). */
export const generatePodUploadUrl = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.storage.generateUploadUrl();
  },
});

/* ───────────────────────── بثّ موقع السائق ───────────────────────── */

export const updateMyLocation = mutation({
  args: { lat: v.number(), lng: v.number(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { lat, lng, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const driverId = staff.userId as any;
    if (!driverId) return { success: false };
    const existing = await ctx.db
      .query("driverLocations")
      .withIndex("by_driver", (q) => q.eq("driverId", driverId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lat, lng, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("driverLocations", { driverId, lat, lng, updatedAt: Date.now() });
    }

    // ✅ إشعار "السائق قرّب" (مرة واحدة لكل محطة) — عند دخول نطاق NEAR_KM
    let notifiedNear = 0;
    const stops = await ctx.db
      .query("dailyPlans")
      .withIndex("by_driver_date", (q) => q.eq("driverId", driverId))
      .collect();
    for (const p of stops) {
      if (p.status !== "OUT_FOR_DELIVERY") continue;
      if ((p as any).nearNotifiedAt) continue;
      if (!p.customerId) continue;
      const c: any = await ctx.db.get(p.customerId);
      if (!c || c.lat == null || c.lng == null) continue;
      if (haversineKm(lat, lng, c.lat, c.lng) <= NEAR_KM) {
        await ctx.db.patch(p._id, { nearNotifiedAt: Date.now() });
        await ctx.db.insert("notifications", {
          targetCustomerId: p.customerId,
          type: "SYSTEM",
          title: "السائق اقترب منك! 🚚",
          message: `سائقنا على وشك الوصول بوجبات ${String(p.date).slice(0, 10)}`,
          link: (p as any).trackToken ? `/track/${(p as any).trackToken}` : "/customer/profile",
          relatedId: p._id,
          isRead: false,
          createdAt: Date.now(),
        });
        notifiedNear++;
      }
    }
    return { success: true, notifiedNear };
  },
});

/* ───────────────────────── استعلامات السائق ───────────────────────── */

/** محطات السائق الحالي ليوم/جولة، مرتّبة بالمسار، مع بيانات العميل. */
export const myStops = query({
  args: {
    date: v.string(),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { date, deliveryTime, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const driverId = staff.userId as any;
    const rows = await ctx.db
      .query("dailyPlans")
      .withIndex("by_driver_date", (q) => q.eq("driverId", driverId).eq("date", date))
      .collect();
    const stops = [];
    for (const p of rows) {
      if (p.deliveryTime !== deliveryTime) continue;
      if (p.status === "DRAFT" || p.status === "CONFIRMED") continue;
      const c = p.customerId ? await ctx.db.get(p.customerId) : null;
      stops.push({
        planId: p._id,
        seq: (p as any).routeSeq ?? 999,
        status: p.status,
        customerName: (c as any)?.fullName || p.customerName || "عميل",
        phone: (c as any)?.phone || null,
        address: (c as any)?.address || null,
        lat: (c as any)?.lat ?? null,
        lng: (c as any)?.lng ?? null,
        mealsCount: Array.isArray(p.items) ? p.items.filter((i: any) => !i.isOff).length : 0,
        notes: p.notes || null,
        trackToken: (p as any).trackToken || null,
        deliveredAt: (p as any).deliveredAt ?? null,
        failReason: (p as any).failReason ?? null,
      });
    }
    stops.sort((a, b) => a.seq - b.seq);
    return stops;
  },
});

/* ───────────────────────── لوحة المشرف ───────────────────────── */

/** كل محطات (date + shift) مع الإسناد والحالة + تحليلات موجزة. */
export const supervisorBoard = query({
  args: {
    date: v.string(),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { date, deliveryTime, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const rows = (
      await ctx.db.query("dailyPlans").withIndex("by_date", (q) => q.eq("date", date)).collect()
    ).filter((p) => p.deliveryTime === deliveryTime && p.status !== "DRAFT" && p.status !== "CONFIRMED");

    const driverNames = new Map<string, string>();
    let totalDeliveredMs = 0;
    let deliveredWithTime = 0;
    const perDriver: Record<string, { name: string; delivered: number; total: number }> = {};

    const stops = [];
    for (const p of rows) {
      let driverName: string | null = null;
      if (p.driverId) {
        const key = String(p.driverId);
        if (!driverNames.has(key)) {
          const d = await ctx.db.get(p.driverId);
          driverNames.set(key, (d as any)?.name || "سائق");
        }
        driverName = driverNames.get(key)!;
        if (!perDriver[key]) perDriver[key] = { name: driverName, delivered: 0, total: 0 };
        perDriver[key].total++;
        if (p.status === "DELIVERED") perDriver[key].delivered++;
      }
      if (p.status === "DELIVERED" && (p as any).outForDeliveryAt && (p as any).deliveredAt) {
        totalDeliveredMs += (p as any).deliveredAt - (p as any).outForDeliveryAt;
        deliveredWithTime++;
      }
      const c = p.customerId ? await ctx.db.get(p.customerId) : null;
      stops.push({
        planId: p._id,
        seq: (p as any).routeSeq ?? 999,
        status: p.status,
        driverId: p.driverId ? String(p.driverId) : null,
        driverName,
        customerName: (c as any)?.fullName || p.customerName || "عميل",
        phone: (c as any)?.phone || null,
        address: (c as any)?.address || null,
        trackToken: (p as any).trackToken || null,
        outForDeliveryAt: (p as any).outForDeliveryAt ?? null,
        deliveredAt: (p as any).deliveredAt ?? null,
        failReason: (p as any).failReason ?? null,
      });
    }
    stops.sort((a, b) => a.seq - b.seq);

    const delivered = stops.filter((s) => s.status === "DELIVERED").length;
    const outForDelivery = stops.filter((s) => s.status === "OUT_FOR_DELIVERY").length;
    const failed = stops.filter((s) => s.status === "FAILED").length;
    return {
      stops,
      analytics: {
        total: stops.length,
        delivered,
        outForDelivery,
        failed,
        pending: stops.length - delivered - outForDelivery - failed,
        avgDeliveryMinutes: deliveredWithTime > 0 ? Math.round(totalDeliveredMs / deliveredWithTime / 60000) : null,
        perDriver: Object.values(perDriver),
      },
    };
  },
});

/* ───────────────────────── تتبع العميل (عام) ───────────────────────── */

/**
 * ⚠️ استعلام عام (بلا توكن جلسة) — العميل يفتحه برابط سرّي فيه trackToken.
 *    يعرض: الاسم الأول، الحالة والأختام، اسم السائق، موقع السائق (أثناء الجولة
 *    فقط)، وجهة العميل، ETA، وإشارة "قرّب". لا يعرض هاتفاً ولا عنواناً نصّياً.
 */
export const tracking = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const plan = await ctx.db
      .query("dailyPlans")
      .withIndex("by_track_token", (q) => q.eq("trackToken", token))
      .first();
    if (!plan) return null;

    const c = plan.customerId ? await ctx.db.get(plan.customerId) : null;
    const firstName = String((c as any)?.fullName || plan.customerName || "عميلنا").split(" ")[0];

    const settings = await ctx.db.query("restaurantSettings").first();
    const store = (settings as any)?.storeLat != null && (settings as any)?.storeLng != null
      ? { lat: (settings as any).storeLat, lng: (settings as any).storeLng } : null;

    const dest = (c as any)?.lat != null && (c as any)?.lng != null
      ? { lat: (c as any).lat, lng: (c as any).lng } : null;

    // موقع السائق يُكشف فقط أثناء "في الطريق"
    let driver: { lat: number; lng: number; name: string | null } | null = null;
    let etaMin: number | null = null;
    let isNear = false;
    if (plan.status === "OUT_FOR_DELIVERY" && plan.driverId) {
      const loc = await ctx.db
        .query("driverLocations")
        .withIndex("by_driver", (q) => q.eq("driverId", plan.driverId!))
        .first();
      const d = await ctx.db.get(plan.driverId);
      // نعرض الموقع لو حديث (آخر 10 دقائق)
      if (loc && Date.now() - loc.updatedAt < 10 * 60 * 1000) {
        driver = { lat: loc.lat, lng: loc.lng, name: (d as any)?.name || null };
        if (dest) {
          const km = haversineKm(loc.lat, loc.lng, dest.lat, dest.lng);
          etaMin = etaMinutes(km);
          isNear = km <= NEAR_KM;
        }
      } else {
        driver = { lat: NaN, lng: NaN, name: (d as any)?.name || null };
      }
    }

    return {
      firstName,
      status: plan.status, // PREPARED | OUT_FOR_DELIVERY | DELIVERED
      mealsCount: Array.isArray(plan.items) ? plan.items.filter((i: any) => !i.isOff).length : 0,
      preparedAt: (plan as any).updatedAt ?? plan.createdAt ?? null,
      outForDeliveryAt: (plan as any).outForDeliveryAt ?? null,
      deliveredAt: (plan as any).deliveredAt ?? null,
      deliveryTime: plan.deliveryTime,
      store,
      dest,
      driver: driver && Number.isFinite(driver.lat) ? driver : (driver ? { lat: null, lng: null, name: driver.name } : null),
      etaMin,
      isNear,
      podNote: plan.status === "DELIVERED" ? ((plan as any).podNote || null) : null,
      podPhotoUrl: plan.status === "DELIVERED" && (plan as any).podStorageId
        ? await ctx.storage.getUrl((plan as any).podStorageId)
        : null,
    };
  },
});
