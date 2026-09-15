import { internalMutation } from './_generated/server';
import { v } from 'convex/values';

// CLI-only, compare-and-set, name fields only. All IDs and operational data stay intact.
export const apply = internalMutation({
  args: { dryRun: v.boolean(), updates: v.array(v.object({
    id:v.id('publicMeals'), beforeAr:v.string(), beforeEn:v.optional(v.string()),
    nameAr:v.string(), nameEn:v.string(),
  })) },
  handler: async (ctx, {dryRun, updates}) => {
    if(new Set(updates.map(u=>u.id)).size!==updates.length) throw new Error('Duplicate target');
    const ready=[];
    for(const u of updates){
      const row=await ctx.db.get(u.id);
      if(!row) throw new Error('Missing meal: '+u.id);
      if(row.nameAr===u.nameAr&&row.nameEn===u.nameEn) continue;
      if(row.nameAr!==u.beforeAr||row.nameEn!==u.beforeEn) throw new Error('Name changed since review: '+u.id);
      if(!u.nameAr.trim()||!u.nameEn.trim()) throw new Error('Empty name');
      ready.push(u);
    }
    if(!dryRun)for(const u of ready)await ctx.db.patch(u.id,{nameAr:u.nameAr,nameEn:u.nameEn});
    return {dryRun,changed:ready.length,ids:ready.map(u=>u.id)};
  },
});
