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
