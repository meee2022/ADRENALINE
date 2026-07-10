import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./sessions";

const FIXES = [
  // شكشوكة بيض جديدة — remove W2-wednesday and W4-wednesday
  {
    id: "kh787t1eacpxryznhmg5fa7pq987mxay",
    schedule: [
      { week: 2, day: "tuesday" },
      { week: 3, day: "wednesday" },
      { week: 4, day: "tuesday" },
    ],
  },
  // شوربة العدس — remove W2-monday and W4-monday
  {
    id: "kh7b07g3v8ewdk2mwfjw6a5v3d80tzmd",
    schedule: [
      { week: 1, day: "monday" },
      { week: 2, day: "tuesday" },
      { week: 3, day: "monday" },
      { week: 4, day: "tuesday" },
    ],
  },
];

export const run = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    let patched = 0;
    for (const fix of FIXES) {
      const meal = await ctx.db.get(fix.id as any);
      if (!meal) continue;
      await ctx.db.patch(fix.id as any, { schedule: fix.schedule });
      patched++;
    }
    return { patched };
  },
});
