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
 *
 * ⚠️ Reads the whole table (120 rows ≈ 2 MB). Only for callers that need every week
 *    (the Customized page, presets). Day-based callers use `liveTemplatesForDay`.
 */
export async function liveCustomizedTemplates(ctx: any): Promise<any[]> {
  const all = await ctx.db.query("customizedTemplates").collect();
  const owners = await Promise.all(all.map((t: any) => ctx.db.get(t.customerId)));
  return all.filter((_: any, i: number) => !owners[i] || isCustomProgram(owners[i]));
}

export const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_KEYS = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];

/** The slot array a template holds for (week, day) — the exact lookup every consumer did inline. */
export function templateDaySlots(slots: any, week: number, dayKey: string): any[] {
  const sl: any = slots;
  const weekDays = sl?.weeks ? (sl.weeks[week] || sl.weeks[String(week)])?.days : null;
  const days = weekDays || sl?.days;
  return Array.isArray(days?.[dayKey]) ? days[dayKey] : Array.isArray(sl) ? sl : [];
}

/**
 * Day rows for one (rotation week, weekday), shaped like templates so existing code that
 * does `slots.weeks[week].days[day]` keeps working unchanged.
 *
 * Why: the five day-based readers (stickers, audit, kitchen customized list, box numbers,
 * prepare-all) each pulled the full 2 MB table on every reactive refresh — ~19 GB/week of
 * database I/O. A day row is ~1 KB, so this reads ~120 KB instead.
 *
 * Safety net: a template with no day rows yet (summary not built, or a write that slipped
 * past the hooks) is read in full once, so no customer can silently vanish from a day.
 */
export async function liveTemplatesForDay(ctx: any, week: number, dayKey: string): Promise<any[]> {
  const rows = await ctx.db.query("customizedTemplateDays")
    .withIndex("by_week_day", (q: any) => q.eq("week", week).eq("day", dayKey)).collect();
  // Which templates are summarised at all: tiny marker rows (day = "*"), one per template.
  const markers = await ctx.db.query("customizedTemplateDays")
    .withIndex("by_week_day", (q: any) => q.eq("week", 0).eq("day", "*")).collect();
  const out: any[] = [];
  const seen = new Set<string>();
  for (const m of markers as any[]) {
    const id = String(m.templateId);
    seen.add(id);
    const r = rows.find((x: any) => String(x.templateId) === id);
    out.push({ _id: m.templateId, customerId: m.customerId, updatedAt: m.updatedAt,
      slots: { weeks: { [week]: { days: { [dayKey]: r ? r.slots : [] } } } } });
  }
  // Fallback for templates never summarised (summary not built yet, or a write that slipped
  // past the hooks): read those in full once, so no customer vanishes from a day.
  if (markers.length === 0) {
    // Nothing summarised yet → behave exactly like before (full table).
    const all = await ctx.db.query("customizedTemplates").collect();
    for (const t of all as any[]) out.push({ _id: t._id, customerId: t.customerId, updatedAt: t.updatedAt,
      slots: { weeks: { [week]: { days: { [dayKey]: templateDaySlots(t.slots, week, dayKey) } } } } });
  }
  const owners = await Promise.all(out.map((t: any) => ctx.db.get(t.customerId)));
  return out.filter((_: any, i: number) => !owners[i] || isCustomProgram(owners[i]));
}

/** Rebuild the day rows of one template from its slots. Called by every template write. */
export async function rebuildTemplateDays(ctx: any, template: any): Promise<number> {
  const old = await ctx.db.query("customizedTemplateDays")
    .withIndex("by_template", (q: any) => q.eq("templateId", template._id)).collect();
  for (const r of old) await ctx.db.delete(r._id);
  // Marker row: "this template is summarised" (even if every day is empty).
  await ctx.db.insert("customizedTemplateDays", {
    templateId: template._id, customerId: template.customerId, week: 0, day: "*", slots: [], updatedAt: Date.now(),
  });
  let n = 0;
  for (let week = 1; week <= 4; week++) {
    for (const day of DAY_KEYS) {
      const slots = templateDaySlots(template.slots, week, day);
      if (!slots.length) continue;
      await ctx.db.insert("customizedTemplateDays", {
        templateId: template._id, customerId: template.customerId, week, day, slots, updatedAt: Date.now(),
      });
      n++;
    }
  }
  return n;
}

/**
 * Just {_id, customerId, updatedAt} for every live template, from the marker rows
 * (one ~100-byte row per template). For readers that need "who has a template" but no slots.
 * Falls back to the full table while the summary is unbuilt.
 */
export async function liveTemplateIndex(ctx: any): Promise<any[]> {
  const markers = await ctx.db.query("customizedTemplateDays")
    .withIndex("by_week_day", (q: any) => q.eq("week", 0).eq("day", "*")).collect();
  const base = markers.length
    ? (markers as any[]).map((m) => ({ _id: m.templateId, customerId: m.customerId, updatedAt: m.updatedAt }))
    : (await ctx.db.query("customizedTemplates").collect()).map((t: any) => ({ _id: t._id, customerId: t.customerId, updatedAt: t.updatedAt }));
  const owners = await Promise.all(base.map((t: any) => ctx.db.get(t.customerId)));
  return base.filter((_: any, i: number) => !owners[i] || isCustomProgram(owners[i]));
}
