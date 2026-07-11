/**
 * @file convex/geo.ts
 * @description تحويل العناوين إلى إحداثيات (geocoding) عبر OpenStreetMap Nominatim (مجاني، بدون مفتاح)،
 *   + حفظ إحداثيات العملاء (تلقائي أو يدوي). للاستخدام في خريطة التوصيل.
 */
import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

type GeoResult = { lat: number; lng: number } | null;

/** تحويل نص عنوان إلى إحداثيات عبر Nominatim. يفضّل قطر افتراضياً. */
async function geocodeOne(address: string): Promise<GeoResult> {
  const q = String(address || "").trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=qa&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "AdrenalineMealsManager/1.0 (delivery routing)", "Accept-Language": "ar,en" },
    });
    if (!r.ok) return null;
    const data: any = await r.json();
    if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    // محاولة ثانية بدون تقييد الدولة
    const url2 = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", Qatar")}`;
    const r2 = await fetch(url2, { headers: { "User-Agent": "AdrenalineMealsManager/1.0", "Accept-Language": "ar,en" } });
    if (r2.ok) {
      const d2: any = await r2.json();
      if (Array.isArray(d2) && d2[0]?.lat && d2[0]?.lon) return { lat: parseFloat(d2[0].lat), lng: parseFloat(d2[0].lon) };
    }
  } catch (e) {
    console.error("geocode error:", e);
  }
  return null;
}

/** إجراء: حوّل عنواناً واحداً وأرجع الإحداثيات (للاستخدام في منتقي الموقع اليدوي). */
export const geocodeAddress = action({
  args: { address: v.string() },
  handler: async (_ctx, args): Promise<GeoResult> => {
    return await geocodeOne(args.address);
  },
});

/** يستخرج إحداثيات من نص رابط خرائط (Google/OSM) أو من إحداثيات خام. */
function coordsFromText(text: string): GeoResult {
  const s = String(text || "");
  const pats: RegExp[] = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,          // .../@25.28,51.53,15z
    /[?&](?:q|ll|sll|daddr|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/i, // ?q=lat,lng
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,      // !3dLAT!4dLNG (الترتيب الشائع)
    /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/, // "25.28, 51.53" خام
  ];
  for (const re of pats) {
    const m = s.match(re);
    if (m) {
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }
  }
  // احتياطي: !3d (خط العرض) و!4d (خط الطول) موجودان لكن بترتيب/مسافة مختلفة
  const d3 = s.match(/!3d(-?\d{1,2}\.\d+)/);
  const d4 = s.match(/!4d(-?\d{1,3}\.\d+)/);
  if (d3 && d4) {
    const lat = parseFloat(d3[1]), lng = parseFloat(d4[1]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

/**
 * ✅ إجراء: حوّل **رابط موقع** (Google Maps / OSM) أو إحداثيات خام إلى lat/lng.
 *    يدعم الروابط المختصرة (goo.gl / maps.app.goo.gl) بمتابعة التحويل من الخادم.
 *    الأدق للتوصيل: العميل يشارك موقع بيته كرابط، فنستخرج نقطته بالضبط.
 */
export const resolveLocationLink = action({
  args: { link: v.string() },
  handler: async (_ctx, args): Promise<GeoResult> => {
    const raw = String(args.link || "").trim();
    if (!raw) return null;

    // 1) إحداثيات خام أو رابط كامل فيه إحداثيات مباشرة
    const direct = coordsFromText(raw);
    if (direct) return direct;

    // 2) رابط — نتبع التحويل (المختصر يفتح على رابط كامل فيه الإحداثيات)
    if (/^https?:\/\//i.test(raw)) {
      try {
        const r = await fetch(raw, {
          redirect: "follow",
          headers: { "User-Agent": "AdrenalineMealsManager/1.0 (delivery)", "Accept-Language": "ar,en" },
        });
        // الرابط النهائي بعد التحويل غالباً يحمل @lat,lng أو !3d!4d
        const fromFinalUrl = coordsFromText(r.url || "");
        if (fromFinalUrl) return fromFinalUrl;
        // احتياطي: نفتّش نص الصفحة
        const body = await r.text();
        const fromBody = coordsFromText(body);
        if (fromBody) return fromBody;
      } catch (e) {
        console.error("resolveLocationLink error:", e);
      }
    }
    return null;
  },
});

/** إجراء: حوّل كل العملاء اللي عندهم عنوان وبدون إحداثيات (دفعة، مع مهلة بين الطلبات). */
export const geocodeAllCustomers = action({
  args: { sessionToken: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ updated: number; failed: number; remaining: number }> => {
    const customers: any[] = await ctx.runQuery(api.customers.list, {
      sessionToken: args.sessionToken,
    } as any);
    const targets = customers.filter(
      (c) => c.address && String(c.address).trim() && (c.lat == null || c.lng == null),
    );
    const cap = args.limit ?? 25; // نعالج دفعة صغيرة لاحترام حدود Nominatim (1 طلب/ثانية)
    const batch = targets.slice(0, cap);
    let updated = 0, failed = 0;
    for (const c of batch) {
      const geo = await geocodeOne(c.address);
      if (geo) {
        await ctx.runMutation(internal.geo.setCustomerCoords, {
          customerId: c._id, lat: geo.lat, lng: geo.lng,
        });
        updated++;
      } else {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 1100)); // احترام حد المعدّل
    }
    return { updated, failed, remaining: Math.max(0, targets.length - batch.length) };
  },
});

/**
 * حفظ إحداثيات عميل. داخلية (internalMutation): تُستدعى من geocodeAllCustomers فقط
 * ولا يمكن نداؤها من الإنترنت. كانت mutation عامة تقبل sessionToken وتتجاهله،
 * فكان أي شخص يقدر يغيّر إحداثيات أي عميل.
 */
export const setCustomerCoords = internalMutation({
  args: {
    customerId: v.id("customers"),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.customerId, { lat: args.lat, lng: args.lng, updatedAt: Date.now() });
    return { success: true };
  },
});
