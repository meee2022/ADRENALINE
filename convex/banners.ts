// convex/banners.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ===== LIST ALL BANNERS (Admin) =====
export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const banners = await ctx.db
      .query("banners")
      .collect();

    const bannersWithUrls = await Promise.all(
      banners.map(async (banner) => {
        const imageUrl = banner.imageStorageId
          ? await ctx.storage.getUrl(banner.imageStorageId)
          : banner.imageUrl;
        return {
          ...banner,
          imageUrl,
        };
      })
    );

    return bannersWithUrls.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// ===== LIST ACTIVE BANNERS (Public) =====
export const listActiveBanners = query({
  args: {},
  handler: async (ctx) => {
    const banners = await ctx.db
      .query("banners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const bannersWithUrls = await Promise.all(
      banners.map(async (banner) => {
        const imageUrl = banner.imageStorageId
          ? await ctx.storage.getUrl(banner.imageStorageId)
          : banner.imageUrl;
        return {
          ...banner,
          imageUrl,
        };
      })
    );

    return bannersWithUrls.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// ===== CREATE BANNER =====
export const create = mutation({
  args: {
    titleAr: v.string(),
    titleEn: v.optional(v.string()),
    subtitleAr: v.optional(v.string()),
    subtitleEn: v.optional(v.string()),
    imageStorageId: v.id("_storage"),
    sortOrder: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate URL from storage ID
    const imageUrl = await ctx.storage.getUrl(args.imageStorageId);
    
    return await ctx.db.insert("banners", {
      titleAr: args.titleAr,
      titleEn: args.titleEn,
      subtitleAr: args.subtitleAr,
      subtitleEn: args.subtitleEn,
      imageStorageId: args.imageStorageId,
      imageUrl: imageUrl || "", // Fallback to empty string if URL generation fails
      isActive: true,
      sortOrder: args.sortOrder,
      createdAt: Date.now(),
    });
  },
});

// ===== DELETE BANNER =====
export const remove = mutation({
  args: { id: v.id("banners"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    const banner = await ctx.db.get(id);
    if (!banner) {
      throw new Error("Banner not found");
    }

    // Delete the image from storage
    if (banner.imageStorageId) {
      await ctx.storage.delete(banner.imageStorageId);
    }

    await ctx.db.delete(id);
    return { success: true };
  },
});

// ===== TOGGLE ACTIVE STATUS =====
export const toggleActive = mutation({
  args: { id: v.id("banners"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { id, sessionToken }) => {
    const banner = await ctx.db.get(id);
    if (!banner) {
      throw new Error("Banner not found");
    }

    await ctx.db.patch(id, {
      isActive: !banner.isActive,
    });

    return { success: true };
  },
});
