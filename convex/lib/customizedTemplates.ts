/** Same test the Customized page uses to list its customers. */
export const isCustomProgram = (c: any): boolean =>
  String(c?.program || c?.goalType || c?.goals || "").toUpperCase().includes("CUSTOM");

/**
 * The customized templates that still drive kitchen, stickers, audit and delivery.
 *
 * A template outlives a package change: LATEFA ALDOSARI moved from customized to FITNESS
 * (2026-10-14) and her old template kept cooking beside her new plan, while the stickers
 * dropped the plan in favour of the template. Read templates through here, never raw.
 * Templates whose customer is gone are kept so the audit can still report them.
 */
export async function liveCustomizedTemplates(ctx: any): Promise<any[]> {
  const all = await ctx.db.query("customizedTemplates").collect();
  const owners = await Promise.all(all.map((t: any) => ctx.db.get(t.customerId)));
  return all.filter((_: any, i: number) => !owners[i] || isCustomProgram(owners[i]));
}
