/**
 * @file convex/posBranches.ts
 * @description إدارة فروع نقطة البيع (POS متعدّد الفروع). CRUD للأدمن + قائمة عامة.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff, requireAdmin } from "./sessions";

/** قائمة الفروع النشطة (للأدمن ولوجهة اختيار الفرع). */
export const list = query({
  args: { sessionToken: v.optional(v.string()), includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx, args.sessionToken);
    const rows = await ctx.db.query("posBranches").collect();
    return rows
      .filter((b) => args.includeInactive || b.isActive)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
      .map((b) => ({
        id: String(b._id), name: b.name, code: b.code || null,
        phone: b.phone || null, address: b.address || null, isActive: b.isActive,
      }));
  },
});

export const create = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    name: v.string(),
    code: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const name = args.name.trim();
    if (!name) throw new Error("اسم الفرع مطلوب");
    const count = (await ctx.db.query("posBranches").collect()).length;
    const id = await ctx.db.insert("posBranches", {
      name,
      code: args.code?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      address: args.address?.trim() || undefined,
      isActive: true,
      sortOrder: count,
      createdAt: Date.now(),
    });
    return { id: String(id) };
  },
});

export const update = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    id: v.id("posBranches"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.code !== undefined) patch.code = args.code.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.address !== undefined) patch.address = args.address.trim() || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(args.id, patch);
    return { ok: true };
  },
});
