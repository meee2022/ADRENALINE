// convex/restaurantSettings.ts
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireStaff } from "./sessions";

// ===== GET SETTINGS (Single) =====
export const get = query({
  handler: async (ctx) => {
    // Return the first (and only) settings document
    const settings = await ctx.db.query("restaurantSettings").first();
    return settings;
  },
});

/**
 * ✅ ضبط أسبوع دورة الوجبات الذي يطبخه المطبخ حالياً (1..4).
 *    تستخدمه الأخصائية يدوياً. mutation مستقلة صغيرة حتى لا تُجبَر على
 *    تمرير كل حقول الإعدادات لتغيير رقم واحد.
 *    الضبط اليدوي يُثبّت `cookingWeekAdvancedOn` على جمعة هذا الأسبوع حتى لا
 *    يقفز التقدّم التلقائي فوق اختيار الأخصائية في نفس الأسبوع.
 */
export const setCookingWeek = mutation({
  args: { week: v.number(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const week = Math.min(4, Math.max(1, Math.floor(args.week)));
    const existing = await ctx.db.query("restaurantSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        currentCookingWeek: week,
        cookingWeekAdvancedOn: lastFridayISO(),
      });
    }
    return { currentCookingWeek: week };
  },
});

/**
 * ✅ حفظ حصص البرامج (كارب/بروتين/مُعامل سعرات لكل برنامج).
 *    mutation مستقلة صغيرة — نفس فلسفة setCookingWeek.
 */
/** ✅ إعدادات ضريبة POS (Owner فقط). */
export const setPosTax = mutation({
  args: {
    pct: v.number(),                // 0..100
    inclusive: v.boolean(),         // شامل / إضافي
    label: v.optional(v.string()),  // "VAT" / "ضريبة"
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db.query("restaurantSettings").first();
    const posTax = {
      pct: Math.max(0, Math.min(100, args.pct)),
      inclusive: args.inclusive,
      label: args.label?.trim() || undefined,
    };
    if (existing) await ctx.db.patch(existing._id, { posTax } as any);
    return { ok: true };
  },
});

/** رسوم التوصيل الثابتة للطلبات المباشرة (سائق المطعم). للمنصّات لا تُضاف. */
export const setPosDeliveryFee = mutation({
  args: { fee: v.number(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db.query("restaurantSettings").first();
    const fee = Math.max(0, Number(args.fee) || 0);
    if (existing) await ctx.db.patch(existing._id, { posDeliveryFee: fee } as any);
    return { ok: true, fee };
  },
});

export const setProgramPortions = mutation({
  args: {
    portions: v.any(), // { DIET:{carb,protein,calFactor}, FITNESS:{...}, BULK:{...} }
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db.query("restaurantSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, { programPortions: args.portions });
    }
    return { ok: true };
  },
});

/**
 * ✅ أسبوع دورة المطبخ في تاريخ مستقبلي.
 *    الدورة تتقدّم +1 كل جمعة، فنعدّ الجُمَع بين اليوم والتاريخ ونلفّها 1..4.
 *    هكذا يختار العميل *تاريخ بداية* والنظام يعرف لوحده أي دورة سيطبخها المطبخ
 *    حينها — دون أن يفهم العميل مفهوم «أسبوع الدورة».
 */
export const rotationWeekAt = query({
  args: { targetDate: v.string() }, // yyyy-MM-dd
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("restaurantSettings").first();
    const cur = Number((settings as any)?.currentCookingWeek) || 1;

    const todayISO = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10); // قطر
    const target = String(args.targetDate).slice(0, 10);

    // عدّ الجُمَع في المدى (اليوم، الهدف] — كل جمعة = تقدّم دورة.
    let fridays = 0;
    const c = new Date(todayISO + "T00:00:00Z");
    const end = new Date(target + "T00:00:00Z");
    for (let i = 0; i < 400 && c < end; i++) {
      c.setUTCDate(c.getUTCDate() + 1);
      if (c.getUTCDay() === 5) fridays++;
    }
    const week = ((cur - 1 + fridays) % 4) + 1;
    return { rotationWeek: week, currentCookingWeek: cur, fridaysAhead: fridays };
  },
});

/** yyyy-MM-dd لآخر جمعة (أو اليوم إن كان جمعة) بتوقيت +03 (قطر). */
function lastFridayISO(now = Date.now()): string {
  // قطر +03:00؛ نحسب اليوم المحلي دون مكتبات.
  const qatar = new Date(now + 3 * 60 * 60 * 1000);
  const dow = qatar.getUTCDay(); // بعد الإزاحة، getUTCDay = يوم قطر
  const back = (dow - 5 + 7) % 7; // الجمعة = 5
  qatar.setUTCDate(qatar.getUTCDate() - back);
  return qatar.toISOString().slice(0, 10);
}

/**
 * ✅ التقدّم التلقائي (crons): كل جمعة يقدّم أسبوع الدورة +1 (يلفّ 4→1).
 *    المطبخ يحضّر الجمعة على الأسبوع الجديد ليوصّل العميل السبت.
 *    محمي بـ`cookingWeekAdvancedOn`: لا يتقدّم أكثر من مرة في نفس الجمعة،
 *    ولا يتجاوز ضبطاً يدوياً حصل هذا الأسبوع.
 */
export const advanceCookingWeek = internalMutation({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("restaurantSettings").first();
    if (!settings) return { advanced: false, reason: "no settings" };

    const fri = lastFridayISO();
    if ((settings as any).cookingWeekAdvancedOn === fri) {
      return { advanced: false, reason: "already advanced this week", week: (settings as any).currentCookingWeek };
    }

    const cur = Number((settings as any).currentCookingWeek) || 1;
    const next = (cur % 4) + 1; // 1→2→3→4→1
    await ctx.db.patch(settings._id, {
      currentCookingWeek: next,
      cookingWeekAdvancedOn: fri,
    });
    return { advanced: true, from: cur, to: next, on: fri };
  },
});

// ===== UPDATE SETTINGS =====
export const update = mutation({
  args: {
    phone: v.string(),
    email: v.string(),
    addressAr: v.string(),
    addressEn: v.string(),
    
    instagramUrl: v.optional(v.string()),
    twitterUrl: v.optional(v.string()),
    facebookUrl: v.optional(v.string()),
    tiktokUrl: v.optional(v.string()),
    snapchatUrl: v.optional(v.string()),
    whatsappNumber: v.optional(v.string()),
    
    descriptionAr: v.string(),
    descriptionEn: v.string(),
    
    workingHoursAr: v.optional(v.string()),
    workingHoursEn: v.optional(v.string()),
    
    privacyPolicyUrl: v.optional(v.string()),
    termsUrl: v.optional(v.string()),
    
    // Hero Section
    heroTitleAr: v.optional(v.string()),
    heroTitleEn: v.optional(v.string()),
    heroSubtitleAr: v.optional(v.string()),
    heroSubtitleEn: v.optional(v.string()),
    heroCta1TextAr: v.optional(v.string()),
    heroCta1TextEn: v.optional(v.string()),
    heroCta1Link: v.optional(v.string()),
    heroCta2TextAr: v.optional(v.string()),
    heroCta2TextEn: v.optional(v.string()),
    heroCta2Link: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    // ⚠️ sessionToken لا يُخزَّن داخل الوثيقة
    const { sessionToken: _t, ...fields } = args;
    const existing = await ctx.db.query("restaurantSettings").first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        ...fields,
        updatedAt: Date.now(),
      });
      return { success: true, id: existing._id };
    } else {
      // Create new (first time)
      const id = await ctx.db.insert("restaurantSettings", {
        ...fields,
        updatedAt: Date.now(),
      });
      return { success: true, id };
    }
  },
});

// ===== UPDATE HERO LOGO =====
export const updateHeroLogo = mutation({
  args: {
    storageId: v.id("_storage"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db.query("restaurantSettings").first();
    
    if (!existing) {
      throw new Error("Settings not found. Please initialize settings first.");
    }

    // Get URL from storage
    const imageUrl = await ctx.storage.getUrl(args.storageId);
    
    if (!imageUrl) {
      throw new Error("Failed to get image URL from storage");
    }

    // Delete old logo if exists
    if (existing.heroLogoStorageId) {
      try {
        await ctx.storage.delete(existing.heroLogoStorageId);
      } catch (err) {
        console.warn("Failed to delete old hero logo:", err);
      }
    }

    // Update with new logo
    await ctx.db.patch(existing._id, {
      heroLogoUrl: imageUrl,
      heroLogoStorageId: args.storageId,
      updatedAt: Date.now(),
    });

    return { success: true, imageUrl };
  },
});

// ===== DELETE HERO LOGO =====
export const deleteHeroLogo = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db.query("restaurantSettings").first();
    
    if (!existing) {
      throw new Error("Settings not found");
    }

    // Delete from storage if exists
    if (existing.heroLogoStorageId) {
      try {
        await ctx.storage.delete(existing.heroLogoStorageId);
      } catch (err) {
        console.warn("Failed to delete hero logo from storage:", err);
      }
    }

    // Remove from settings
    await ctx.db.patch(existing._id, {
      heroLogoUrl: undefined,
      heroLogoStorageId: undefined,
      updatedAt: Date.now(),
    });

    return { success: true, message: "Logo deleted successfully" };
  },
});

// ===== INITIALIZE DEFAULT SETTINGS (if none exist) =====
export const initializeDefault = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const existing = await ctx.db.query("restaurantSettings").first();
    
    if (!existing) {
      await ctx.db.insert("restaurantSettings", {
        phone: "+974 1234 5678",
        email: "info@adrenaline.qa",
        addressAr: "الدوحة، قطر",
        addressEn: "Doha, Qatar",
        
        instagramUrl: "https://instagram.com/adrenaline",
        twitterUrl: "https://twitter.com/adrenaline",
        facebookUrl: "https://facebook.com/adrenaline",
        
        descriptionAr: "أدرينالين - نقدم لكم وجبات صحية ولذيذة مصممة خصيصاً لتحقيق أهدافكم الغذائية. نستخدم أفضل المكونات الطازجة ونعد كل وجبة بحب واهتمام.",
        descriptionEn: "Adrenaline - We offer healthy and delicious meals specially designed to achieve your nutritional goals. We use the finest fresh ingredients and prepare each meal with love and care.",
        
        workingHoursAr: "السبت - الخميس: 8 صباحاً - 10 مساءً",
        workingHoursEn: "Sat - Thu: 8 AM - 10 PM",
        
        // Default Hero Content
        heroTitleAr: "أدرينالين - وجبات صحية لحياة نشيطة",
        heroTitleEn: "Adrenaline - Healthy Meals for Active Life",
        heroSubtitleAr: "نقدم لك وجبات مُصممة خصيصاً لأهدافك الصحية والرياضية",
        heroSubtitleEn: "Delivering meals tailored to your health and fitness goals",
        heroCta1TextAr: "اشترك الآن",
        heroCta1TextEn: "Subscribe Now",
        heroCta1Link: "#plans-section",
        heroCta2TextAr: "المنيو",
        heroCta2TextEn: "Menu",
        heroCta2Link: "/public/menu",
        
        updatedAt: Date.now(),
      });
      return { success: true, message: "Default settings initialized" };
    }
    
    return { success: false, message: "Settings already exist" };
  },
});
