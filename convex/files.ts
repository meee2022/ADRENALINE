import { mutation, query } from "./_generated/server";
import { requireStaff } from "./sessions";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, { storageId, sessionToken }) => {
    await requireStaff(ctx, sessionToken);
    const url = await ctx.storage.getUrl(storageId);
    return url;
  },
});
