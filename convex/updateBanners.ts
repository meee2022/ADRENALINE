import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./sessions";

export const run = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const banners = await ctx.db.query("banners").collect();
    // Sort them so we get consistent ordering
    banners.sort((a, b) => a.sortOrder - b.sortOrder);
    
    if (banners.length >= 3) {
      // Update second banner
      await ctx.db.patch(banners[1]._id, {
        imageUrl: "/hero-banner.webp",
      });
      // Update third banner
      await ctx.db.patch(banners[2]._id, {
        titleAr: "اشترك في خططنا الغذائية",
        titleEn: "Subscribe to Our Meal Plans",
        subtitleAr: "واحصل على خصم 20% لفترة محدودة!",
        subtitleEn: "And get a 20% discount for a limited time!",
        imageUrl: "/discount-banner.png",
      });
    }
    return "Banners updated successfully";
  }
});
