// convex/banners.ts
import { query, mutation } from "./_generated/server";
import { requireStaff } from "./sessions";
import { v, ConvexError } from "convex/values";

// ===== LIST ALL BANNERS (Admin) =====
export const list = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
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

    // شرائح التطبيق فقط لا تظهر في هيرو الموقع.
    return bannersWithUrls.filter((b) => b.target !== "app").sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

// ===== LIST APP HERO SLIDES (Public) =====
// هيرو التطبيق يُدار من صفحة البانرات: أطباق مقصوصة وإعلانات. بلا شرائح يعرض التطبيق أطباقه المدموجة.
export const listAppSlides = query({
  args: {},
  handler: async (ctx) => {
    const banners = await ctx.db
      .query("banners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const slides = await Promise.all(
      banners
        .filter((b) => b.target === "app" || b.target === "both")
        .map(async (b) => ({
          id: String(b._id),
          kind: b.kind ?? "promo",
          titleAr: b.titleAr,
          titleEn: b.titleEn,
          subtitleAr: b.subtitleAr,
          subtitleEn: b.subtitleEn,
          linkUrl: b.linkUrl,
          sortOrder: b.sortOrder,
          imageUrl: (b.imageStorageId ? await ctx.storage.getUrl(b.imageStorageId) : null) || b.imageUrl,
        }))
    );
    return slides.filter((s) => s.imageUrl).sort((a, b) => a.sortOrder - b.sortOrder);
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
    target: v.optional(v.union(v.literal("web"), v.literal("app"), v.literal("both"))),
    kind: v.optional(v.union(v.literal("dish"), v.literal("promo"))),
    linkUrl: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    // Generate URL from storage ID
    const imageUrl = await ctx.storage.getUrl(args.imageStorageId);
    
    return await ctx.db.insert("banners", {
      titleAr: args.titleAr,
      titleEn: args.titleEn,
      subtitleAr: args.subtitleAr,
      subtitleEn: args.subtitleEn,
      imageStorageId: args.imageStorageId,
      imageUrl: imageUrl || "", // Fallback to empty string if URL generation fails
      target: args.target,
      kind: args.kind,
      linkUrl: args.linkUrl?.trim() || undefined,
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
    await requireStaff(ctx, sessionToken);
    const banner = await ctx.db.get(id);
    if (!banner) {
      throw new ConvexError("Banner not found");
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
    await requireStaff(ctx, sessionToken);
    const banner = await ctx.db.get(id);
    if (!banner) {
      throw new ConvexError("Banner not found");
    }

    await ctx.db.patch(id, {
      isActive: !banner.isActive,
    });

    return { success: true };
  },
});
