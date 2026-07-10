/**
 * @file convex/fixPlanWording.ts
 * @description مِيوتيشن لمرة واحدة: استبدال كلمة "حزمة" بـ"باقة" في أسماء/أوصاف الباقات.
 */
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./sessions";

const swap = (s: unknown) =>
  typeof s === "string" ? s.replace(/حزمة/g, "باقة").replace(/حزم/g, "باقات") : s;

export const run = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    let updated = 0;
    const plans = await ctx.db.query("publicPlans").collect();
    for (const p of plans) {
      const patch: any = {};
      const nameAr = swap((p as any).nameAr);
      const descAr = swap((p as any).descriptionAr);
      const aboutAr = swap((p as any).aboutAr);
      if (nameAr !== (p as any).nameAr) patch.nameAr = nameAr;
      if (descAr !== (p as any).descriptionAr) patch.descriptionAr = descAr;
      if (aboutAr !== (p as any).aboutAr) patch.aboutAr = aboutAr;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(p._id, patch);
        updated++;
      }
    }
    return { ok: true, updated, total: plans.length };
  },
});
