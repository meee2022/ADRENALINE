// convex/restaurantSettings.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== GET SETTINGS (Single) =====
export const get = query({
  handler: async (ctx) => {
    // Return the first (and only) settings document
    const settings = await ctx.db.query("restaurantSettings").first();
    return settings;
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("restaurantSettings").first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: Date.now(),
      });
      return { success: true, id: existing._id };
    } else {
      // Create new (first time)
      const id = await ctx.db.insert("restaurantSettings", {
        ...args,
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
  },
  handler: async (ctx, args) => {
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
  args: {},
  handler: async (ctx) => {
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
  handler: async (ctx) => {
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
