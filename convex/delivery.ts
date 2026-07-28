/**
 * @file convex/delivery.ts
 * @description نظام التوصيل والتتبع — مؤمّن:
 *   - state machine صارمة: PREPARED → OUT_FOR_DELIVERY → DELIVERED / FAILED
 *     ورجعة (reschedule) FAILED/OUT → PREPARED (ADMIN فقط)
 *   - إسناد/إدارة السواقين وربطهم بالعملاء وإعادة الجدولة → ADMIN
 *   - تنفيذ (start/deliver/fail) → صاحب المحطة (DELIVERY) أو ADMIN
 *   - updateMyLocation → DELIVERY فقط
 *   - tracking عام (بتوكن سرّي)
 */
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireStaff, requireAdmin, requireRole, requireRoleOrPermission, newToken } from "./sessions";

// 🔒 مسؤولو التوصيل (لا يشمل السائق نفسه) — يقدروا يسندوا سواقين، يعدّلوا مسار،
//    ويعيدوا الجدولة. ADMIN مسموح تلقائياً. أي موظف عنده صلاحية صفحة /drivers
//    أو /delivery في users.permissions مسموح كذلك.
const DELIVERY_MANAGER_ROLES = ["ACCOUNTANT", "FINANCE_MANAGER"];
const DELIVERY_MANAGER_PAGES = ["/drivers", "/delivery"];

/* ───────────────────────── أدوات المسافة ───────────────────────── */

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function etaMinutes(km: number): number { return Math.max(1, Math.round((km / 28) * 60) + 2); }
const NEAR_KM = 1.2;

// 🔒 State machine — الانتقالات المسموحة فقط
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PREPARED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  DELIVERED: [],           // نهائية
  FAILED: ["PREPARED"],    // إعادة جدولة فقط
};
function assertTransition(from: string, to: string) {
  const list = ALLOWED_TRANSITIONS[from] || [];
  if (!list.includes(to)) {
    throw new Error(`انتقال غير مسموح: ${from} → ${to}`);
  }
}

/** يتحقق أن المستدعي هو صاحب المحطة (سائقها) أو ADMIN. */
function assertStopOwnershipOrAdmin(staff: any, plan: any) {
  const role = String(staff.role || "").toUpperCase();
  if (role === "ADMIN") return;
  // السائق يقدر ينفّذ محطاته فقط
  if (role !== "DELIVERY") throw new Error("هذه العملية للسائق أو الأدمن فقط");
  if (!plan.driverId || String(plan.driverId) !== String(staff.userId)) {
    throw new Error("هذه المحطة مسندة لسائق آخر");
  }
}

/* ───────────────────────── السائقون ───────────────────────── */

export const listDrivers = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const drivers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "DELIVERY"))
      .collect();
    return drivers
      .filter((d) => d.isActive)
      .map((d) => ({ _id: d._id, name: d.name, phone: (d as any).phone || "" }));
  },
});

/** 🔒 تحديث هاتف السائق → ADMIN. */
export const setDriverPhone = mutation({
  args: { driverId: v.id("users"), phone: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { driverId, phone, sessionToken }) => {
    await requireAdmin(ctx, sessionToken);
    await ctx.db.patch(driverId, { phone: phone.trim() || undefined, updatedAt: Date.now() } as any);
    return { success: true };
  },
});

/* ───────────────────────── الإسناد وترتيب المسار ───────────────────────── */

/** 🔒 إسناد وردية كاملة لسائق → ADMIN. */
export const assignShift = mutation({
  args: {
    date: v.string(),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    driverId: v.id("users"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { date, deliveryTime, driverId, sessionToken }) => {
    await requireRoleOrPermission(ctx, sessionToken, { roles: DELIVERY_MANAGER_ROLES, permissions: DELIVERY_MANAGER_PAGES });

    const plans = (
      await ctx.db.query("dailyPlans").withIndex("by_date", (q) => q.eq("date", date)).collect()
    ).filter((p) => p.deliveryTime === deliveryTime && p.status !== "DELIVERED" && p.status !== "CONFIRMED" && p.status !== "DRAFT");

    if (plans.length === 0) return { assigned: 0 };

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

    const settings = await ctx.db.query("restaurantSettings").first();
    let curLat = (settings as any)?.storeLat ?? 25.2854;
    let curLng = (settings as any)?.storeLng ?? 51.531;

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

/** 🔒 إسناد محطة واحدة → ADMIN. */
export const assignOne = mutation({
  args: { planId: v.id("dailyPlans"), driverId: v.id("users"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { planId, driverId, sessionToken }) => {
    await requireRoleOrPermission(ctx, sessionToken, { roles: DELIVERY_MANAGER_ROLES, permissions: DELIVERY_MANAGER_PAGES });
    await ctx.db.patch(planId, { driverId, updatedAt: Date.now() });
    return { success: true };
  },
});

/** 🔒 إسناد جماعي → ADMIN أو مسؤول توصيل. */
export const assignMany = mutation({
  args: {
    assignments: v.array(v.object({ planId: v.id("dailyPlans"), driverId: v.id("users") })),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { assignments, sessionToken }) => {
    await requireRoleOrPermission(ctx, sessionToken, { roles: DELIVERY_MANAGER_ROLES, permissions: DELIVERY_MANAGER_PAGES });
    if (!assignments.length) return { assigned: 0, drivers: 0 };

    const settings = await ctx.db.query("restaurantSettings").first();
    const storeLat = (settings as any)?.storeLat ?? 25.2854;
    const storeLng = (settings as any)?.storeLng ?? 51.531;

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

/** 🔒 ربط سائق بعميل → ADMIN. */
export const setCustomerDriver = mutation({
  args: {
    customerId: v.id("customers"),
    driverId: v.optional(v.id("users")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { customerId, driverId, sessionToken }) => {
    await requireRoleOrPermission(ctx, sessionToken, { roles: DELIVERY_MANAGER_ROLES, permissions: DELIVERY_MANAGER_PAGES });
    await ctx.db.patch(customerId, { defaultDriverId: driverId ?? undefined, updatedAt: Date.now() });
    return { success: true };
  },
});

export const customerAssignments = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const customers = await ctx.db.query("customers").collect();
    return customers
      .filter((c: any) => c.isActive)
      .map((c: any) => ({
        id: String(c._id),
        name: c.fullName || "",
        phone: c.phone || "",
        area: String(c.address || "").split(/[,،\-|]/)[0].trim(),
        deliveryTime: c.deliveryTime || "MORNING",
        driverId: c.defaultDriverId ? String(c.defaultDriverId) : "",
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, "ar"));
  },
});

/** 🔒 تطبيق السواقين الافتراضيين → ADMIN. */
export const applyDefaultDrivers = mutation({
  args: {
    date: v.string(),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING"), v.literal("ALL")),
    overwrite: v.optional(v.boolean()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { date, deliveryTime, overwrite, sessionToken }) => {
    await requireRoleOrPermission(ctx, sessionToken, { roles: DELIVERY_MANAGER_ROLES, permissions: DELIVERY_MANAGER_PAGES });
    const plans = (
      await ctx.db.query("dailyPlans").withIndex("by_date", (q) => q.eq("date", date)).collect()
    ).filter((p: any) =>
      (deliveryTime === "ALL" || p.deliveryTime === deliveryTime) &&
      p.status !== "DELIVERED" && p.status !== "DRAFT");

    const settings = await ctx.db.query("restaurantSettings").first();
    const storeLat = (settings as any)?.storeLat ?? 25.2854;
    const storeLng = (settings as any)?.storeLng ?? 51.531;

    const byDriver = new Map<string, { plan: any; lat: number | null; lng: number | null }[]>();
    let matched = 0, skipped = 0;
    for (const p of plans) {
      if (!overwrite && p.driverId) { skipped++; continue; }
      const c: any = p.customerId ? await ctx.db.get(p.customerId) : null;
      const dId = c?.defaultDriverId ? String(c.defaultDriverId) : null;
      if (!dId) continue;
      if (!byDriver.has(dId)) byDriver.set(dId, []);
      byDriver.get(dId)!.push({ plan: p, lat: c?.lat ?? null, lng: c?.lng ?? null });
      matched++;
    }

    for (const [driverId, stops] of byDriver) {
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
      }
    }
    return { assigned: matched, skippedAlreadyAssigned: skipped, drivers: byDriver.size };
  },
});

export const driverBoard = query({
  args: {
    date: v.string(),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING"), v.literal("ALL")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const plans = (
      await ctx.db.query("dailyPlans").withIndex("by_date", (q) => q.eq("date", args.date)).collect()
    ).filter((p: any) =>
      (args.deliveryTime === "ALL" || p.deliveryTime === args.deliveryTime) && p.status !== "DRAFT");

    const drivers = (await ctx.db.query("users").collect()).filter((u: any) => u.role === "DELIVERY" && u.isActive !== false);
    const byId = new Map(drivers.map((d: any) => [String(d._id), d]));

    const board = new Map<string, any>();
    const ensure = (id: string, name: string) => {
      if (!board.has(id)) board.set(id, { driverId: id, driver: name, total: 0, delivered: 0, onTheWay: 0, remaining: 0, stops: [] as any[] });
      return board.get(id);
    };

    let unassigned = 0;
    const unassignedStops: any[] = [];
    for (const p of plans) {
      const c: any = p.customerId ? await ctx.db.get(p.customerId) : null;
      const stop = {
        planId: String(p._id),
        customer: c?.fullName || (p as any).customerName || "—",
        phone: c?.phone || "",
        area: String(c?.address || "").split(/[,،\-|]/)[0].trim(),
        status: p.status,
        seq: (p as any).routeSeq || 0,
      };
      const dId = (p as any).driverId ? String((p as any).driverId) : (c?.defaultDriverId ? String(c.defaultDriverId) : null);
      if (!dId || !byId.has(dId)) { unassigned++; unassignedStops.push(stop); continue; }
      const row = ensure(dId, (byId.get(dId) as any).name || "");
      row.total++;
      if (p.status === "DELIVERED") row.delivered++;
      else if (p.status === "OUT_FOR_DELIVERY") { row.onTheWay++; row.remaining++; }
      else row.remaining++;
      row.stops.push(stop);
    }
    for (const row of board.values()) row.stops.sort((a: any, b: any) => a.seq - b.seq);
    return {
      drivers: Array.from(board.values()).sort((a, b) => b.total - a.total),
      unassigned,
      unassignedStops: unassignedStops.slice(0, 50),
    };
  },
});

/* ───────────────────────── دورة حياة التوصيل (state machine صارمة) ───────────────────────── */

/** 🔒 يبدأ توصيل: PREPARED → OUT_FOR_DELIVERY فقط. سائق المحطة أو ADMIN. */
export const startDelivery = mutation({
  args: { planId: v.id("dailyPlans"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { planId, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const plan: any = await ctx.db.get(planId);
    if (!plan) throw new Error("المحطة غير موجودة");
    assertStopOwnershipOrAdmin(staff, plan);
    assertTransition(plan.status, "OUT_FOR_DELIVERY");
    const token = plan.trackToken || newToken();
    await ctx.db.patch(planId, {
      status: "OUT_FOR_DELIVERY",
      outForDeliveryAt: Date.now(),
      trackToken: token,
      driverId: plan.driverId || (staff.userId as any),
      updatedAt: Date.now(),
    });
    return { success: true, trackToken: token };
  },
});

/** 🔒 تسليم: OUT_FOR_DELIVERY → DELIVERED فقط. */
export const markDelivered = mutation({
  args: {
    planId: v.id("dailyPlans"),
    podNote: v.optional(v.string()),
    podStorageId: v.optional(v.id("_storage")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { planId, podNote, podStorageId, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const plan: any = await ctx.db.get(planId);
    if (!plan) throw new Error("المحطة غير موجودة");
    assertStopOwnershipOrAdmin(staff, plan);
    assertTransition(plan.status, "DELIVERED");
    await ctx.db.patch(planId, {
      status: "DELIVERED",
      deliveredAt: Date.now(),
      podNote: podNote || plan.podNote,
      podStorageId: podStorageId || plan.podStorageId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** 🔒 تعذّر التوصيل: OUT_FOR_DELIVERY → FAILED فقط، بسبب إلزامي. */
export const markFailed = mutation({
  args: {
    planId: v.id("dailyPlans"),
    reason: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { planId, reason, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const plan: any = await ctx.db.get(planId);
    if (!plan) throw new Error("المحطة غير موجودة");
    assertStopOwnershipOrAdmin(staff, plan);
    assertTransition(plan.status, "FAILED");
    const r = String(reason || "").trim();
    if (r.length < 3) throw new Error("سبب الفشل مطلوب (3 أحرف أو أكثر)");
    await ctx.db.patch(planId, {
      status: "FAILED",
      failedAt: Date.now(),
      failReason: r,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** 🔒 إعادة جدولة FAILED → PREPARED → ADMIN فقط. */
export const reschedule = mutation({
  args: { planId: v.id("dailyPlans"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { planId, sessionToken }) => {
    await requireRoleOrPermission(ctx, sessionToken, { roles: DELIVERY_MANAGER_ROLES, permissions: DELIVERY_MANAGER_PAGES });
    const plan: any = await ctx.db.get(planId);
    if (!plan) throw new Error("المحطة غير موجودة");
    if (plan.status !== "FAILED" && plan.status !== "OUT_FOR_DELIVERY") {
      throw new Error("إعادة الجدولة مسموحة فقط للمحطات الفاشلة أو التي في الطريق");
    }
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

/** رابط رفع صورة إثبات التسليم — للسائق أو ADMIN. */
export const generatePodUploadUrl = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.storage.generateUploadUrl();
  },
});

/* ───────────────────────── بثّ موقع السائق ───────────────────────── */

/** 🔒 بث الموقع → DELIVERY فقط (ADMIN تلقائي). */
export const updateMyLocation = mutation({
  args: { lat: v.number(), lng: v.number(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { lat, lng, sessionToken }) => {
    const staff = await requireRole(ctx, sessionToken, ["DELIVERY"]);
    const driverId = staff.userId as any;
    if (!driverId) return { success: false };
    // 🔒 حدود جغرافية عامة (منع bogus values)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("إحداثيات غير صالحة");
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error("إحداثيات خارج النطاق");

    const existing = await ctx.db
      .query("driverLocations")
      .withIndex("by_driver", (q) => q.eq("driverId", driverId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lat, lng, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("driverLocations", { driverId, lat, lng, updatedAt: Date.now() });
    }

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

export const myStops = query({
  args: {
    date: v.string(),
    deliveryTime: v.union(v.literal("MORNING"), v.literal("EVENING")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, { date, deliveryTime, sessionToken }) => {
    const staff = await requireStaff(ctx, sessionToken);
    const driverId = staff.userId as any;
    /* نفس قاعدة لوحة المشرف حرفياً: الإسناد المباشر على الخطة أولاً، وإلا
       السائق الافتراضي للعميل. كانت هذه الشاشة تقرأ الإسناد المباشر وحده،
       بينما «سواقين التوصيل» يوزّع افتراضياً — فرأى المشرف التوزيع كاملاً
       وفتح مهند تطبيقه على «لا توجد محطات» رغم 105 خطط محضّرة. */
    const rows = (
      await ctx.db.query("dailyPlans").withIndex("by_date", (q: any) => q.eq("date", date)).collect()
    ).filter((p: any) => String(p.driverId || "") === String(driverId) || !p.driverId);
    const stops = [];
    for (const p of rows) {
      if (p.deliveryTime !== deliveryTime) continue;
      if (p.status === "DRAFT" || p.status === "CONFIRMED") continue;
      if (!p.driverId) {
        const c0: any = p.customerId ? await ctx.db.get(p.customerId) : null;
        if (String(c0?.defaultDriverId || "") !== String(driverId)) continue;
      }
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
      const c = p.customerId ? await ctx.db.get(p.customerId) : null;
      const effDriverId = p.driverId
        ? String(p.driverId)
        : ((c as any)?.defaultDriverId ? String((c as any).defaultDriverId) : null);
      let driverName: string | null = null;
      if (effDriverId) {
        if (!driverNames.has(effDriverId)) {
          const d = await ctx.db.get(effDriverId as any);
          driverNames.set(effDriverId, (d as any)?.name || "سائق");
        }
        driverName = driverNames.get(effDriverId)!;
        if (!perDriver[effDriverId]) perDriver[effDriverId] = { name: driverName, delivered: 0, total: 0 };
        perDriver[effDriverId].total++;
        if (p.status === "DELIVERED") perDriver[effDriverId].delivered++;
      }
      if (p.status === "DELIVERED" && (p as any).outForDeliveryAt && (p as any).deliveredAt) {
        totalDeliveredMs += (p as any).deliveredAt - (p as any).outForDeliveryAt;
        deliveredWithTime++;
      }
      stops.push({
        planId: p._id,
        seq: (p as any).routeSeq ?? 999,
        status: p.status,
        driverId: effDriverId,
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
        total: stops.length, delivered, outForDelivery, failed,
        pending: stops.length - delivered - outForDelivery - failed,
        avgDeliveryMinutes: deliveredWithTime > 0 ? Math.round(totalDeliveredMs / deliveredWithTime / 60000) : null,
        perDriver: Object.values(perDriver),
      },
    };
  },
});

/* ───────────────────────── تتبع العميل (عام) ───────────────────────── */

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

    let driver: { lat: number; lng: number; name: string | null } | null = null;
    let driverPhone: string | null = null;
    let etaMin: number | null = null;
    let isNear = false;
    if (plan.status === "OUT_FOR_DELIVERY" && plan.driverId) {
      const loc = await ctx.db
        .query("driverLocations")
        .withIndex("by_driver", (q) => q.eq("driverId", plan.driverId!))
        .first();
      const d = await ctx.db.get(plan.driverId);
      driverPhone = String((d as any)?.phone || "").trim() || null;
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
      status: plan.status,
      mealsCount: Array.isArray(plan.items) ? plan.items.filter((i: any) => !i.isOff).length : 0,
      preparedAt: (plan as any).updatedAt ?? plan.createdAt ?? null,
      outForDeliveryAt: (plan as any).outForDeliveryAt ?? null,
      deliveredAt: (plan as any).deliveredAt ?? null,
      deliveryTime: plan.deliveryTime,
      store, dest,
      driver: driver && Number.isFinite(driver.lat) ? driver : (driver ? { lat: null, lng: null, name: driver.name } : null),
      driverPhone, etaMin, isNear,
      podNote: plan.status === "DELIVERED" ? ((plan as any).podNote || null) : null,
      podPhotoUrl: plan.status === "DELIVERED" && (plan as any).podStorageId
        ? await ctx.storage.getUrl((plan as any).podStorageId)
        : null,
    };
  },
});
