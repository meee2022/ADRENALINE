/**
 * @file convex/posBranches.ts
 * @description إدارة فروع نقطة البيع (POS متعدّد الفروع). CRUD للأدمن + قائمة عامة.
 */
import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
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
        menuMealIds: (b.menuMealIds || []).map(String),
        menuPrices: (b.menuPrices || []).map((p: any) => ({ mealId: String(p.mealId), price: p.price })),
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
    if (!name) throw new ConvexError("اسم الفرع مطلوب");
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
    // [] = sell the full POS menu
    menuMealIds: v.optional(v.array(v.id("publicMeals"))),
    // [] = no branch prices (everything at the shared POS price)
    menuPrices: v.optional(v.array(v.object({ mealId: v.id("publicMeals"), price: v.number() }))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.sessionToken);
    const patch: any = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.code !== undefined) patch.code = args.code.trim() || undefined;
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.address !== undefined) patch.address = args.address.trim() || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.menuMealIds !== undefined) patch.menuMealIds = args.menuMealIds.length ? args.menuMealIds : undefined;
    if (args.menuPrices !== undefined) {
      for (const p of args.menuPrices) {
        if (!Number.isFinite(p.price) || p.price < 0) throw new ConvexError("سعر الفرع غير صالح");
      }
      patch.menuPrices = args.menuPrices.length ? args.menuPrices : undefined;
    }
    await ctx.db.patch(args.id, patch);
    return { ok: true };
  },
});

/** CLI-only: set a branch's POS menu by meal ids (used to load the West Bay sheet). */
export const setMenuInternal = internalMutation({
  args: { branchId: v.id("posBranches"), mealIds: v.array(v.id("publicMeals")) },
  handler: async (ctx, { branchId, mealIds }) => {
    await ctx.db.patch(branchId, { menuMealIds: mealIds.length ? mealIds : undefined, updatedAt: Date.now() });
    return mealIds.length;
  },
});

/**
 * Public, read-only menu of one branch (the QR page /westbay). Only display fields: names,
 * the price the cashier charges (branch price, else the shared POS price) and the photo.
 */
export const publicMenu = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const branch: any = (await ctx.db.query("posBranches").collect()).find((b: any) => b.code === code && b.isActive);
    if (!branch) return null;
    const branchPrice = new Map<string, number>((branch.menuPrices || []).map((p: any) => [String(p.mealId), Number(p.price)]));
    const items = [];
    for (const id of branch.menuMealIds || []) {
      const m: any = await ctx.db.get(id);
      if (!m) continue;
      const pos: any = await ctx.db.query("posItems").withIndex("by_meal", (q) => q.eq("mealId", id)).first();
      const price = branchPrice.get(String(id)) ?? pos?.posPrice;
      if (price == null || pos?.isHidden || m.isActive === false) continue; // not sellable here
      items.push({
        id: String(id), nameEn: m.nameEn || m.name || "", nameAr: m.nameAr || "", category: m.category || "",
        price, imageUrl: m.storageId ? await ctx.storage.getUrl(m.storageId) : (m.imageUrl || null),
      });
    }
    return { name: branch.name, items };
  },
});
