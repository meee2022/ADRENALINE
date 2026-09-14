import type { MutationCtx } from "../_generated/server";
import { nextDriverLabelCode } from "../../shared/driverLabelCode";

/** Retain mappings even when a driver leaves: printed codes must never be recycled. */
export async function ensureDriverLabelCodes(ctx: MutationCtx) {
  const rows = await ctx.db.query("driverLabelCodes").collect();
  const assigned = new Set(rows.map(r => String(r.driverId)));
  const codes = rows.map(r => r.code);
  const drivers = await ctx.db.query("users").withIndex("by_role", q => q.eq("role", "DELIVERY")).collect();
  drivers.sort((a,b) => a._creationTime - b._creationTime || String(a._id).localeCompare(String(b._id)));
  for (const driver of drivers) {
    if (!driver.isActive || assigned.has(String(driver._id))) continue;
    const code = nextDriverLabelCode(codes);
    await ctx.db.insert("driverLabelCodes", { driverId: driver._id, code });
    codes.push(code);
  }
}
